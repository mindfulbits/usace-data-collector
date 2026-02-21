# USACE Hydropower Data Scraper

Automated GitHub Actions scraper for USACE Hydropower Generation Schedules, specifically targeting **Buford Dam/Lake Sidney Lanier** data.

## 🎯 Purpose

This repository automatically scrapes hydropower generation schedules from the [USACE Hydropower website](https://spatialdata.usace.army.mil/hydropower/) every 4 hours and makes the data available as JSON files for consumption by other applications.

**Features:**
- ⚡ Lightweight HTTP-based scraper (no browser required)
- 🔄 Runs every 4 hours via GitHub Actions
- 📦 Uses only built-in Node.js modules (no dependencies)
- 💾 Provides JSON data with 24 hourly generation periods
- 📊 Includes daily backups and summary statistics

## 📊 Data Output

The scraper generates the following files in the `data/` directory:

- **`usace-latest.json`** - Complete scraped data with all schedules
- **`summary.json`** - Quick summary for API consumption  
- **`usace-backup-YYYY-MM-DD.json`** - Daily backup files

### Data Structure

```json
{
  "timestamp": "2026-02-21T20:00:00.000Z",
  "plant": "Buford Dam/Lake Sidney Lanier",
  "plantId": "2",
  "source": "USACE Hydropower Website",
  "schedules": {
    "2/21/2026": {
      "date": "2/21/2026",
      "dateValue": "2/21/2026",
      "success": true,
      "periods": [
        {
          "time": "12:00 am - 1:00 am",
          "generation": 6,
          "status": "base",
          "source": "USACE Real-time"
        },
        {
          "time": "6:00 pm - 7:00 pm",
          "generation": 64,
          "status": "active",
          "source": "USACE Real-time"
        }
        // ... 24 total hourly periods
      ],
      "scrapedAt": "2026-02-21T20:00:00.000Z"
    }
  },
  "statistics": {
    "totalDays": 7,
    "totalPeriods": 168,
    "averageGeneration": 12,
    "peakGeneration": 117,
    "minGeneration": 6,
    "scrapedAt": "2026-02-21T20:00:00.000Z"
  }
}
```

**Note:** Date keys use `M/D/YYYY` format (e.g., `"2/21/2026"`) for backwards compatibility.

## 🚀 Setup Instructions

### 1. Create Repository
```bash
# Create new repository on GitHub (use separate account for scraping)
git clone https://github.com/YOUR_SCRAPER_ACCOUNT/usace-data-collector.git
cd usace-data-collector
```

### 2. Copy Files
Copy all files from this directory structure to your new repository:
```
usace-data-collector/
├── .github/workflows/scrape-usace.yml
├── .gitignore
├── scripts/
│   └── scrape-usace.js
├── data/
│   └── .gitkeep
├── package.json
└── README.md
```

### 3. Test Locally (Optional)
```bash
# No dependencies needed - uses built-in Node.js modules
node scripts/scrape-usace.js
```

The scraper will create JSON files in the `data/` directory.

### 4. Deploy to GitHub
```bash
git add .
git commit -m "Initial scraper setup"
git push origin main
```

### 5. Enable Actions
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Enable GitHub Actions if prompted
4. The scraper will run automatically every 6 hours

### 6. Manual Trigger
- Go to **Actions** → **USACE Hydropower Data Scraper**
- Click **Run workflow** to test immediately

## 📡 API Access

### Public Data URLs
```javascript
// Latest complete data
const response = await fetch('https://raw.githubusercontent.com/YOUR_SCRAPER_ACCOUNT/usace-data-collector/main/data/usace-latest.json');

// Quick summary
const summary = await fetch('https://raw.githubusercontent.com/YOUR_SCRAPER_ACCOUNT/usace-data-collector/main/data/summary.json');
```

### Integration Example
```javascript
async function getUSACEData() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/YOUR_SCRAPER_ACCOUNT/usace-data-collector/main/data/usace-latest.json');
        const data = await response.json();
        
        return {
            source: 'github-scraper',
            lastUpdated: data.timestamp,
            note: 'Live data from automated GitHub Actions scraper',
            data: data.schedules,
            statistics: data.statistics
        };
    } catch (error) {
        console.warn('Scraper data unavailable:', error);
        return null;
    }
}
```

## ⚙️ Configuration

### Schedule Frequency
Edit `.github/workflows/scrape-usace.yml` to change scraping frequency:
```yaml
on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
    - cron: '0 8,20 * * *'  # Twice daily at 8 AM and 8 PM
```

### Plant Selection
To scrape different plants, modify `scripts/scrape-usace.js`:
```javascript
this.bufordPlantId = '2'; // Change to different plant ID
```

Available plants (Mobile District):
- `1` - ALLATOONA DAM AND LAKE
- `2` - BUFORD DAM/LAKE SIDNEY LANIER (default)
- `3` - CARTERS DAM AND LAKE
- `4` - WEST POINT DAM AND LAKE
- `5` - MILLERS FERRY DAM AND RESERVOIR
- `6` - WALTER F. GEORGE DAM AND LAKE
- `7` - JONES BLUFF POWERHOUSE/R. F. HENRY
- `8` - JIM WOODRUFF DAM/LAKE SEMINOLE

## 🔧 Troubleshooting

### Actions Failing
1. Check **Actions** tab for error logs
2. Verify repository permissions allow Actions
3. Check if USACE website structure changed

### No Data Generated
1. Run manual workflow trigger via **Actions** → **Run workflow**
2. Check scraper logs for errors
3. Verify USACE site is accessible at https://spatialdata.usace.army.mil/hydropower/
4. If fallback data is being used, check if the HTML structure changed

### Common Issues
- **Fallback data showing**: The scraper encountered an error parsing the USACE website
- **Old timestamp**: GitHub Actions may be paused or rate-limited
- **Missing dates**: USACE only provides ~7 days of schedule data

## 🔍 How It Works

The scraper uses a lightweight HTTP-based approach:

1. **Fetches** the USACE Hydropower page using native Node.js HTTPS module
2. **Extracts** ASP.NET form tokens (`__VIEWSTATE`, `__EVENTVALIDATION`, etc.)
3. **Posts** plant selection (Buford Dam, ID=2) to populate date dropdown
4. **Iterates** through all available dates (~7 days)
5. **Parses** HTML tables to extract 24 hourly generation periods per date
6. **Saves** data to JSON files with statistics

**No dependencies required** - uses only built-in Node.js modules (`https`, `fs`, `path`).

## 📈 Monitoring

### Success Indicators
- ✅ New commits every 4 hours with data updates
- ✅ `data/usace-latest.json` has `"source": "USACE Hydropower Website"` (not "Fallback")
- ✅ No error badges in **Actions** tab
- ✅ `timestamp` is recent (within 4 hours)

### Data Quality Checks
- `statistics.totalPeriods` should be ~168 (7 days × 24 hours)
- `statistics.totalDays` should be 7
- Each schedule should have 24 periods (one per hour)
- `schedules` object should contain recent dates in `M/D/YYYY` format

## 🛠️ Technical Details

### Architecture
- **Version**: V2 (HTTP-based, no browser)
- **Runtime**: Node.js 18+
- **Dependencies**: None (uses built-in modules only)
- **Schedule**: GitHub Actions cron (every 6 hours)
- **Deployment**: Serverless via GitHub Actions

### Key Features
- ASP.NET form handling with viewstate management
- HTML table parsing using regex (no DOM parser needed)
- Greedy regex matching to handle nested tables in `<caption>` tags
- Cookie and session state management
- Fallback data generation on scraping failures
- Date format: `M/D/YYYY` (backwards compatible with V1)

### Files Generated
- `data/usace-latest.json` - Current data (overwrites each run)
- `data/usace-backup-YYYY-MM-DD.json` - Daily backups
- `data/summary.json` - Quick summary for API consumption

## 🤝 Contributing

This is an automated scraper repository. The main integration happens in the consuming application that reads from this data source.

If you find issues with the scraper or USACE website structure changes, please open an issue.

## 📄 License

MIT License - Feel free to use and modify for your projects.
