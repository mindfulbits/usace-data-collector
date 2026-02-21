# Debugging the USACE Scraper

## Current Status

The scraper is fetching data from the USACE website successfully, but the HTML parser isn't extracting the generation periods. It's falling back to hardcoded fallback data.

## Changes Made

1. **Fixed caption parsing issue** - Removed nested `<caption>` table that was interfering with row counting
2. **Added extensive debugging** - The scraper now logs detailed information about what it's parsing
3. **Created test script** - `test-parser.js` can test the parser independently

## How to Test

### Option 1: Test Locally with Node.js

If you have Node.js installed (or install it with `brew install node`):

```bash
cd "/Users/scottpalmer/Library/Mobile Documents/com~apple~CloudDocs/Projects/CRNRA/usace-data-collector"

# Run the standalone parser test
node test-parser.js

# Or run the full scraper
node scripts/scrape-usace.js
```

### Option 2: Test via GitHub Actions

1. Commit and push the changes:
   ```bash
   git add .
   git commit -m "Add debugging to scraper parser"
   git push
   ```

2. Go to your GitHub repository → Actions tab
3. Click "USACE Hydropower Data Scraper"
4. Click "Run workflow"
5. Wait for completion and check the logs for debugging output

## What to Look For

The debug output will show:
- ✅ Whether GridView1 table is found
- ✅ How many rows are detected
- ✅ What cells are found in each row
- ✅ How many periods are successfully parsed

If you see "Parsed 24 periods total", the parser is working correctly!

## Expected Output

When working, you should see in `data/usace-latest.json`:
- `"source": "USACE Hydropower Website"` (not "Fallback")
- 24 hourly periods for each date
- Generation values matching the USACE website

## Next Steps

Run the test and share the console output so we can see exactly what's happening during parsing.
