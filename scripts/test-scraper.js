#!/usr/bin/env node

/**
 * Test script for USACE scraper
 * Run this locally to test the scraper before deploying to GitHub Actions
 */

const USACEScraper = require('./scrape-usace');

async function testScraper() {
    console.log('🧪 Testing USACE Scraper locally...\n');
    
    const scraper = new USACEScraper();
    
    try {
        const data = await scraper.run();
        
        console.log('\n📋 Test Results:');
        console.log('================');
        console.log(`Plant: ${data.plant}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log(`Schedules found: ${Object.keys(data.schedules).length}`);
        console.log(`Statistics:`, data.statistics);
        
        if (Object.keys(data.schedules).length > 0) {
            console.log('\n📊 Sample Schedule Data:');
            const firstSchedule = Object.values(data.schedules)[0];
            console.log(`Date: ${firstSchedule.date}`);
            console.log(`Periods: ${firstSchedule.periods.length}`);
            
            if (firstSchedule.periods.length > 0) {
                console.log('Sample periods:');
                firstSchedule.periods.slice(0, 3).forEach(period => {
                    console.log(`  ${period.time}: ${period.generation} MW (${period.status})`);
                });
            }
        }
        
        console.log('\n✅ Test completed successfully!');
        console.log('🚀 Ready to deploy to GitHub Actions');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

testScraper();
