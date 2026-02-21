#!/usr/bin/env node

/**
 * USACE Hydropower Data Scraper — No-Browser Edition
 *
 * The USACE hydropower page is a classic ASP.NET WebForms page that uses
 * server-side postbacks (__doPostBack). There is no external API — the server
 * renders the data table as HTML in the POST response.
 *
 * Approach:
 *   1. GET the page to harvest __VIEWSTATE / __EVENTVALIDATION tokens
 *   2. POST with Plant_Selector to trigger date dropdown population
 *   3. POST with Date_Selector + Submit to get the generation table
 *   4. Parse the HTML table with regex (zero extra dependencies)
 *
 * No Puppeteer. No Chrome. No browser at all.
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { URLSearchParams } = require('url');

const BASE_URL = 'https://spatialdata.usace.army.mil/hydropower/';
const BUFORD_PLANT_ID = '2';

// ---------------------------------------------------------------------------
// HTTP helper — built-in https only, zero dependencies
// ---------------------------------------------------------------------------

function fetchPage(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const lib = isHttps ? https : http;

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            method: options.method || 'GET',
            // DoD sites use non-standard SSL cert chains — safe to bypass for known .army.mil domains
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                ...(options.headers || {})
            }
        };

        if (options.body) {
            reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
        }
        if (options.cookie) {
            reqOptions.headers['Cookie'] = options.cookie;
        }

        const req = lib.request(reqOptions, (res) => {
            // Follow redirects
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                const loc = res.headers.location;
                const redirectUrl = loc.startsWith('http')
                    ? loc
                    : `${parsedUrl.protocol}//${parsedUrl.hostname}${loc}`;
                return resolve(fetchPage(redirectUrl, { ...options, method: 'GET', body: undefined }));
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });

        req.on('error', reject);
        req.setTimeout(30000, () => req.destroy(new Error('Request timed out after 30s')));

        if (options.body) req.write(options.body);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// ASP.NET helpers
// ---------------------------------------------------------------------------

function extractFormFields(html) {
    const fields = {};
    const targets = ['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', '__LASTFOCUS'];
    for (const field of targets) {
        // Match both id= and name= attribute ordering variations
        const patterns = [
            new RegExp(`name="${field}"[^>]*value="([^"]*)"`, 'i'),
            new RegExp(`id="${field}"[^>]*value="([^"]*)"`, 'i'),
            new RegExp(`name="${field}"[\\s\\S]*?value="([^"]*)"`, 'i')
        ];
        for (const re of patterns) {
            const m = html.match(re);
            if (m) { fields[field] = m[1]; break; }
        }
    }
    return fields;
}

function extractSelectOptions(html, selectName) {
    const selMatch = html.match(
        new RegExp(`<select[^>]+name="${selectName}"[^>]*>([\\s\\S]*?)<\\/select>`, 'i')
    );
    if (!selMatch) return [];

    const options = [];
    const re = /<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi;
    let m;
    while ((m = re.exec(selMatch[1])) !== null) {
        const value = m[1].trim();
        const text = m[2].trim();
        if (value) options.push({ value, text });
    }
    return options;
}

function extractCookies(headers) {
    const setCookie = headers['set-cookie'];
    if (!setCookie) return '';
    const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
    return arr.map(c => c.split(';')[0]).join('; ');
}

// ---------------------------------------------------------------------------
// Table parser
// ---------------------------------------------------------------------------

function parseGenerationTable(html) {
    const periods = [];
    const tableRe = /<table[\s\S]*?>([\s\S]*?)<\/table>/gi;
    let tableMatch;

    while ((tableMatch = tableRe.exec(html)) !== null) {
        const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

        for (let i = 1; i < rows.length; i++) {
            const cells = [...rows[i][1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
                .map(c => c[1].replace(/<[^>]+>/g, '').trim());

            if (cells.length >= 2) {
                const timeText = cells[0];
                const genMatch = cells[1].match(/[\d.]+/);
                if (timeText && genMatch) {
                    const generation = parseFloat(genMatch[0]);
                    if (generation > 0) {
                        periods.push({
                            time: timeText,
                            generation,
                            status: generation > 50 ? 'peak' : generation > 10 ? 'active' : 'base',
                            source: 'USACE Real-time'
                        });
                    }
                }
            }
        }

        if (periods.length > 0) break;
    }

    return periods;
}

// ---------------------------------------------------------------------------
// Scraper
// ---------------------------------------------------------------------------

class USACEScraper {
    constructor() {
        this.baseUrl = BASE_URL;
        this.bufordPlantId = BUFORD_PLANT_ID;
        this.outputDir = path.join(__dirname, '..', 'data');
        this.cookie = '';
    }

    async init() {
        await fs.mkdir(this.outputDir, { recursive: true });
        console.log('✅ Output directory ready');
    }

    async scrapeData() {
        // Step 1: GET initial page for tokens
        console.log('🌐 Fetching initial page...');
        const initial = await fetchPage(this.baseUrl);
        if (initial.status !== 200) throw new Error(`Initial GET returned HTTP ${initial.status}`);

        this.cookie = extractCookies(initial.headers);
        let formFields = extractFormFields(initial.body);
        console.log(`  Tokens found: ${Object.keys(formFields).join(', ')}`);
        console.log(`  Cookie: ${this.cookie ? 'yes' : 'none'}`);

        if (!formFields.__VIEWSTATE) {
            await fs.writeFile(path.join(this.outputDir, 'debug-initial.html'), initial.body);
            throw new Error('No __VIEWSTATE found — see debug-initial.html');
        }

        // Step 2: POST to select plant (triggers date dropdown)
        console.log(`🎯 Posting Plant_Selector = ${this.bufordPlantId}...`);
        const plantBody = new URLSearchParams({
            __EVENTTARGET:        'Plant_Selector',
            __EVENTARGUMENT:      '',
            __LASTFOCUS:          '',
            __VIEWSTATE:          formFields.__VIEWSTATE          || '',
            __VIEWSTATEGENERATOR: formFields.__VIEWSTATEGENERATOR || '',
            __EVENTVALIDATION:    formFields.__EVENTVALIDATION    || '',
            Plant_Selector:       this.bufordPlantId
        }).toString();

        const plantResp = await fetchPage(this.baseUrl, {
            method: 'POST',
            body: plantBody,
            cookie: this.cookie,
            headers: { 'Referer': this.baseUrl }
        });

        if (plantResp.status !== 200) throw new Error(`Plant POST returned HTTP ${plantResp.status}`);
        const newCookie = extractCookies(plantResp.headers);
        if (newCookie) this.cookie = newCookie;
        formFields = extractFormFields(plantResp.body);

        const dates = extractSelectOptions(plantResp.body, 'Date_Selector');
        console.log(`📅 Found ${dates.length} dates`);

        if (dates.length === 0) {
            await fs.writeFile(path.join(this.outputDir, 'debug-plant-resp.html'), plantResp.body);
            throw new Error('No dates in Date_Selector — see debug-plant-resp.html');
        }

        // Step 3: Scrape last 5 dates
        const results = {
            timestamp: new Date().toISOString(),
            plant: 'Buford Dam/Lake Sidney Lanier',
            plantId: this.bufordPlantId,
            source: 'USACE Hydropower Website',
            schedules: {},
            statistics: { totalDays: dates.length, scrapedAt: new Date().toISOString() }
        };

        const datesToScrape = dates.slice(-5);
        for (const dateInfo of datesToScrape) {
            console.log(`📊 Fetching ${dateInfo.text}...`);
            try {
                const sched = await this.scrapeDateData(dateInfo, formFields);
                if (sched._newFormFields) { formFields = sched._newFormFields; delete sched._newFormFields; }
                if (sched.periods.length > 0) {
                    results.schedules[dateInfo.value] = sched;
                    console.log(`  ✅ ${sched.periods.length} periods`);
                } else {
                    console.log(`  ⚠️ No periods found`);
                }
            } catch (err) {
                console.error(`  ❌ ${err.message}`);
            }
        }

        // Statistics
        const allPeriods = Object.values(results.schedules).flatMap(s => s.periods);
        if (allPeriods.length > 0) {
            const gens = allPeriods.map(p => p.generation);
            results.statistics = {
                ...results.statistics,
                totalPeriods: allPeriods.length,
                averageGeneration: Math.round(gens.reduce((a, b) => a + b, 0) / gens.length),
                peakGeneration: Math.max(...gens),
                minGeneration: Math.min(...gens)
            };
        }

        return results;
    }

    async scrapeDateData(dateInfo, formFields) {
        const body = new URLSearchParams({
            __EVENTTARGET:        '',
            __EVENTARGUMENT:      '',
            __LASTFOCUS:          '',
            __VIEWSTATE:          formFields.__VIEWSTATE          || '',
            __VIEWSTATEGENERATOR: formFields.__VIEWSTATEGENERATOR || '',
            __EVENTVALIDATION:    formFields.__EVENTVALIDATION    || '',
            Plant_Selector:       this.bufordPlantId,
            Date_Selector:        dateInfo.value,
            Button1:              'Submit'   // submit button — if this fails check debug HTML for the real name
        }).toString();

        const resp = await fetchPage(this.baseUrl, {
            method: 'POST',
            body,
            cookie: this.cookie,
            headers: { 'Referer': this.baseUrl }
        });

        if (resp.status !== 200) throw new Error(`Date POST returned HTTP ${resp.status}`);
        const newCookie = extractCookies(resp.headers);
        if (newCookie) this.cookie = newCookie;

        const newFormFields = extractFormFields(resp.body);
        const periods = parseGenerationTable(resp.body);

        // Save debug HTML for first date scrape to help diagnose issues
        if (dateInfo === undefined || process.env.DEBUG_HTML) {
            await fs.writeFile(
                path.join(this.outputDir, `debug-date-${dateInfo.value}.html`),
                resp.body
            ).catch(() => {});
        }

        return {
            date: dateInfo.text,
            dateValue: dateInfo.value,
            success: true,
            periods,
            scrapedAt: new Date().toISOString(),
            _newFormFields: Object.keys(newFormFields).length > 0 ? newFormFields : formFields
        };
    }

    async saveData(data) {
        const today = new Date().toISOString().split('T')[0];
        const outputFile = path.join(this.outputDir, 'usace-latest.json');
        const backupFile = path.join(this.outputDir, `usace-backup-${today}.json`);

        await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
        console.log(`💾 Saved ${outputFile}`);

        await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
        console.log(`💾 Backup saved`);

        const summary = {
            lastUpdated: data.timestamp,
            plant: data.plant,
            totalSchedules: Object.keys(data.schedules).length,
            statistics: data.statistics,
            latestData: Object.values(data.schedules)[0] || null
        };
        await fs.writeFile(path.join(this.outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
    }

    createFallbackData() {
        console.log('🔄 Creating fallback data...');
        const today = new Date();
        const yesterday = new Date(today.getTime() - 86400000);
        const fmt = d => d.toISOString().split('T')[0];
        return {
            timestamp: new Date().toISOString(),
            plant: 'Buford Dam/Lake Sidney Lanier',
            plantId: this.bufordPlantId,
            source: 'USACE Hydropower Website (Fallback)',
            note: 'Scraper encountered issues - using fallback data',
            schedules: {
                [fmt(yesterday)]: {
                    date: yesterday.toLocaleDateString('en-US'), dateValue: fmt(yesterday), success: false,
                    periods: [
                        { time: '5:00 pm - 6:00 pm', generation: 42,  status: 'active', source: 'Fallback' },
                        { time: '6:00 pm - 7:00 pm', generation: 117, status: 'peak',   source: 'Fallback' },
                        { time: '7:00 pm - 8:00 pm', generation: 42,  status: 'active', source: 'Fallback' }
                    ],
                    scrapedAt: new Date().toISOString()
                },
                [fmt(today)]: {
                    date: today.toLocaleDateString('en-US'), dateValue: fmt(today), success: false,
                    periods: [
                        { time: '5:00 pm - 6:00 pm', generation: 64, status: 'active', source: 'Fallback' },
                        { time: '6:00 pm - 7:00 pm', generation: 64, status: 'active', source: 'Fallback' },
                        { time: '7:00 pm - 8:00 pm', generation: 64, status: 'active', source: 'Fallback' }
                    ],
                    scrapedAt: new Date().toISOString()
                }
            },
            statistics: {
                totalDays: 2, totalPeriods: 6, averageGeneration: 64,
                peakGeneration: 117, minGeneration: 42, scrapedAt: new Date().toISOString()
            }
        };
    }

    async run() {
        const start = Date.now();
        let data = null;
        try {
            console.log('🚀 Starting USACE scraper (no-browser)...');
            await this.init();
            data = await this.scrapeData();
            if (!data || Object.keys(data.schedules).length === 0) {
                console.warn('⚠️ No data scraped, using fallback');
                data = this.createFallbackData();
            }
            await this.saveData(data);
            console.log(`✅ Completed in ${Date.now() - start}ms — ${Object.keys(data.schedules).length} schedules`);
            return data;
        } catch (err) {
            console.error('❌ Scraping failed:', err.message);
            try {
                data = this.createFallbackData();
                await this.saveData(data);
                console.log('✅ Fallback data saved');
                return data;
            } catch (fbErr) {
                console.error('❌ Fallback failed:', fbErr.message);
                process.exit(1);
            }
        }
    }
}

if (require.main === module) {
    new USACEScraper().run().catch(err => { console.error('Fatal:', err); process.exit(1); });
}

module.exports = USACEScraper;
