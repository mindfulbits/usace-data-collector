#!/usr/bin/env node

/**
 * Simple startup test for GitHub Actions environment
 * Tests basic functionality before running the full scraper
 */

console.log('🧪 Starting GitHub Actions environment test...');

// Test 1: Node.js version
console.log(`Node.js version: ${process.version}`);

// Test 2: Check if we can require puppeteer
try {
    const puppeteer = require('puppeteer');
    console.log('✅ Puppeteer module loaded successfully');
    
    // Test 3: Try to launch browser
    (async () => {
        try {
            console.log('🚀 Testing browser launch...');
            
            const browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process'
                ]
            });
            
            console.log('✅ Browser launched successfully');
            
            const page = await browser.newPage();
            console.log('✅ Page created successfully');
            
            // Test 4: Try to navigate to a simple page
            await page.goto('https://example.com', { timeout: 10000 });
            console.log('✅ Navigation test successful');
            
            const title = await page.title();
            console.log(`Page title: ${title}`);
            
            await browser.close();
            console.log('✅ Browser closed successfully');
            
            // Test 5: File system operations
            const fs = require('fs').promises;
            const path = require('path');
            
            const testDir = path.join(__dirname, '..', 'data');
            await fs.mkdir(testDir, { recursive: true });
            console.log('✅ Data directory created');
            
            const testFile = path.join(testDir, 'test.json');
            await fs.writeFile(testFile, JSON.stringify({ test: true, timestamp: new Date().toISOString() }, null, 2));
            console.log('✅ Test file written');
            
            const content = await fs.readFile(testFile, 'utf8');
            const parsed = JSON.parse(content);
            console.log('✅ Test file read and parsed:', parsed);
            
            console.log('🎉 All tests passed! Environment is ready for scraping.');
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    })();
    
} catch (error) {
    console.error('❌ Failed to load Puppeteer:', error);
    console.error('Make sure to run: npm install puppeteer');
    process.exit(1);
}
