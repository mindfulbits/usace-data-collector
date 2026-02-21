#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Exact copy of parseGenerationTable from scraper with debugging
function parseGenerationTable(html) {
    const periods = [];

    // Target GridView1 specifically
    const gridMatch = html.match(/<table[^>]+id="GridView1"[^>]*>([\s\S]*?)<\/table>/i);
    if (!gridMatch) {
        console.log('  ⚠️ GridView1 table not found in HTML');
        return periods;
    }

    console.log('  ✅ GridView1 table found');
    const tableHtml = gridMatch[1];
    console.log(`  Table HTML length: ${tableHtml.length} chars`);

    // Remove the caption section entirely to avoid nested table rows
    const tableWithoutCaption = tableHtml.replace(/<caption[^>]*>[\s\S]*?<\/caption>/gi, '');
    console.log(`  After caption removal: ${tableWithoutCaption.length} chars`);

    const rows = [...tableWithoutCaption.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    console.log(`  ✅ Found ${rows.length} rows (including header)`);

    // Show first few rows to debug
    for (let i = 0; i < Math.min(3, rows.length); i++) {
        const rowHtml = rows[i][0].substring(0, 100);
        console.log(`  Row ${i} preview: ${rowHtml}...`);
    }

    // Skip the header row (index 0)
    for (let i = 1; i < rows.length; i++) {
        const cells = [...rows[i][1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
            .map(c => c[1].replace(/<[^>]+>/g, '').trim());

        if (i <= 5) {
            console.log(`  Row ${i}: Found ${cells.length} cells - [${cells.join(', ')}]`);
        }

        if (cells.length >= 2) {
            const timeText = cells[0];
            const genMatch = cells[1].match(/^[\d.]+$/);

            if (i <= 5) {
                console.log(`    timeText="${timeText}", genText="${cells[1]}", genMatch=${!!genMatch}`);
            }

            if (timeText && genMatch) {
                const generation = parseFloat(cells[1]);
                periods.push({
                    time: timeText,
                    generation,
                    status: generation > 50 ? 'peak' : generation > 10 ? 'active' : 'base',
                    source: 'USACE Real-time'
                });
            }
        }
    }

    console.log(`  ✅ Parsed ${periods.length} periods total`);
    return periods;
}

// Read the debug HTML file
const debugFile = path.join(__dirname, 'data', 'debug-date-response.html');

if (!fs.existsSync(debugFile)) {
    console.error('❌ Debug file not found:', debugFile);
    console.log('Run the scraper first to generate debug-date-response.html');
    process.exit(1);
}

const html = fs.readFileSync(debugFile, 'utf8');

console.log('='.repeat(60));
console.log('Testing parseGenerationTable with debug HTML');
console.log('='.repeat(60));
console.log();

const periods = parseGenerationTable(html);

console.log();
console.log('='.repeat(60));
console.log(`📊 RESULT: Found ${periods.length} periods`);
console.log('='.repeat(60));

if (periods.length > 0) {
    console.log('\nFirst 5 periods:');
    periods.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.time}: ${p.generation} MW (${p.status})`);
    });
    console.log();
    console.log('✅ SUCCESS - Parser is working correctly!');
} else {
    console.log();
    console.log('❌ FAILURE - No periods were parsed');
    console.log('Check the debug output above to see what went wrong');
}
