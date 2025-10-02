#!/usr/bin/env node

/**
 * USACE Hydropower Data Scraper
 * Scrapes generation schedules from https://spatialdata.usace.army.mil/hydropower/
 * Specifically targets Buford Dam/Lake Sidney Lanier data
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class USACEScraper {
    constructor() {
        this.baseUrl = 'https://spatialdata.usace.army.mil/hydropower/';
        this.bufordPlantId = '2'; // Buford Dam/Lake Sidney Lanier
        this.outputDir = path.join(__dirname, '..', 'data');
        this.browser = null;
        this.page = null;
    }

    async init() {
        console.log('🚀 Initializing USACE Scraper...');
        
        // Ensure output directory exists
        await fs.mkdir(this.outputDir, { recursive: true });
        
        // Launch browser with optimized settings for GitHub Actions
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set user agent and viewport
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await this.page.setViewport({ width: 1280, height: 720 });
        
        console.log('✅ Browser initialized');
    }

    async scrapeData() {
        try {
            console.log('🌐 Navigating to USACE Hydropower site...');
            await this.page.goto(this.baseUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            console.log('🔍 Looking for plant selector...');
            await this.page.waitForSelector('#Plant_Selector', { timeout: 10000 });

            // Select Buford Dam
            console.log('🎯 Selecting Buford Dam...');
            await this.page.select('#Plant_Selector', this.bufordPlantId);

            // Wait for date selector to populate
            await this.page.waitForTimeout(2000);

            // Get available dates
            const dates = await this.page.evaluate(() => {
                const dateSelector = document.getElementById('Date_Selector');
                return Array.from(dateSelector.options)
                    .filter(option => option.value && option.value !== '')
                    .map(option => ({
                        value: option.value,
                        text: option.text
                    }));
            });

            console.log(`📅 Found ${dates.length} available dates`);

            const results = {
                timestamp: new Date().toISOString(),
                plant: 'Buford Dam/Lake Sidney Lanier',
                plantId: this.bufordPlantId,
                source: 'USACE Hydropower Website',
                schedules: {},
                statistics: {
                    totalDays: dates.length,
                    scrapedAt: new Date().toISOString()
                }
            };

            // Scrape data for each available date (limit to last 3 days + today + next 2 days)
            const datesToScrape = dates.slice(-5); // Last 5 dates available

            for (const dateInfo of datesToScrape) {
                console.log(`📊 Scraping data for ${dateInfo.text}...`);
                
                try {
                    const scheduleData = await this.scrapeDateData(dateInfo.value, dateInfo.text);
                    if (scheduleData && scheduleData.periods.length > 0) {
                        results.schedules[dateInfo.value] = scheduleData;
                        console.log(`✅ Found ${scheduleData.periods.length} generation periods`);
                    } else {
                        console.log(`⚠️ No data found for ${dateInfo.text}`);
                    }
                } catch (error) {
                    console.error(`❌ Error scraping ${dateInfo.text}:`, error.message);
                }
            }

            // Calculate statistics
            const allPeriods = Object.values(results.schedules).flatMap(s => s.periods);
            if (allPeriods.length > 0) {
                const generations = allPeriods.map(p => parseFloat(p.generation)).filter(g => !isNaN(g));
                results.statistics = {
                    ...results.statistics,
                    totalPeriods: allPeriods.length,
                    averageGeneration: Math.round(generations.reduce((a, b) => a + b, 0) / generations.length),
                    peakGeneration: Math.max(...generations),
                    minGeneration: Math.min(...generations)
                };
            }

            return results;

        } catch (error) {
            console.error('❌ Scraping failed:', error);
            throw error;
        }
    }

    async scrapeDateData(dateValue, dateText) {
        try {
            // Select the date
            await this.page.select('#Date_Selector', dateValue);
            await this.page.waitForTimeout(1000);

            // Submit the form (look for submit button or form)
            const submitButton = await this.page.$('input[type="submit"], button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                await this.page.waitForTimeout(3000);
            }

            // Look for generation data table
            const tableData = await this.page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                const periods = [];

                for (const table of tables) {
                    const rows = table.querySelectorAll('tr');
                    
                    for (let i = 1; i < rows.length; i++) { // Skip header row
                        const cells = rows[i].querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const timeText = cells[0]?.textContent?.trim();
                            const genText = cells[1]?.textContent?.trim();
                            
                            if (timeText && genText && genText.match(/\d+/)) {
                                const generation = parseFloat(genText.match(/[\d.]+/)[0]);
                                if (generation > 0) {
                                    periods.push({
                                        time: timeText,
                                        generation: generation,
                                        status: generation > 50 ? 'peak' : generation > 10 ? 'active' : 'base',
                                        source: 'USACE Real-time'
                                    });
                                }
                            }
                        }
                    }
                }

                return periods;
            });

            return {
                date: dateText,
                dateValue: dateValue,
                success: true,
                periods: tableData,
                scrapedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error scraping date ${dateText}:`, error);
            return {
                date: dateText,
                dateValue: dateValue,
                success: false,
                error: error.message,
                periods: []
            };
        }
    }

    async saveData(data) {
        const outputFile = path.join(this.outputDir, 'usace-latest.json');
        const backupFile = path.join(this.outputDir, `usace-backup-${new Date().toISOString().split('T')[0]}.json`);
        
        try {
            // Save main data file
            await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
            console.log(`💾 Data saved to ${outputFile}`);
            
            // Save backup
            await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
            console.log(`💾 Backup saved to ${backupFile}`);
            
            // Create summary file for quick access
            const summary = {
                lastUpdated: data.timestamp,
                plant: data.plant,
                totalSchedules: Object.keys(data.schedules).length,
                statistics: data.statistics,
                latestData: Object.values(data.schedules)[0] || null
            };
            
            await fs.writeFile(
                path.join(this.outputDir, 'summary.json'), 
                JSON.stringify(summary, null, 2)
            );
            
        } catch (error) {
            console.error('❌ Error saving data:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }

    async run() {
        const startTime = Date.now();
        
        try {
            await this.init();
            const data = await this.scrapeData();
            await this.saveData(data);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Scraping completed successfully in ${duration}ms`);
            console.log(`📊 Scraped ${Object.keys(data.schedules).length} schedules`);
            
            return data;
            
        } catch (error) {
            console.error('❌ Scraping failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the scraper if called directly
if (require.main === module) {
    const scraper = new USACEScraper();
    scraper.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = USACEScraper;
