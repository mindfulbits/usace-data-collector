# USACE Hydropower Data Scraper

Automated GitHub Actions scraper for USACE Hydropower Generation Schedules, specifically targeting **Buford Dam/Lake Sidney Lanier** data.

## 🎯 Purpose!

This repository automatically scrapes hydropower generation schedules from the [USACE Hydropower website](https://spatialdata.usace.army.mil/hydropower/) every 6 hours and makes the data available as JSON files for consumption by other applications.

## 📊 Data Output

The scraper generates the following files in the `data/` directory:

- **`usace-latest.json`** - Complete scraped data with all schedules
- **`summary.json`** - Quick summary for API consumption  
- **`usace-backup-YYYY-MM-DD.json`** - Daily backup files

### Data Structure

```json
{
  "timestamp": "2025-10-02T20:00:00.000Z",
  "plant": "Buford Dam/Lake Sidney Lanier",
  "plantId": "2",
  "source": "USACE Hydropower Website",
  "schedules": {
    "2025-10-02": {
      "date": "10/02/2025",
      "success": true,
      "periods": [
        {
          "time": "6:00 pm - 7:00 pm",
          "generation": 64,
          "status": "active",
          "source": "USACE Real-time"
        }
      ]
    }
  },
  "statistics": {
    "totalPeriods": 12,
    "averageGeneration": 45,
    "peakGeneration": 117,
    "minGeneration": 4
  }
}
```

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
├── scripts/
│   ├── scrape-usace.js
│   └── test-scraper.js
├── data/
│   └── .gitkeep
├── package.json
└── README.md
```

### 3. Test Locally (Optional)
```bash
npm install
npm test
```

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
    - cron: '0 */6 * * *'  # Every 6 hours
    - cron: '0 8,20 * * *'  # Twice daily at 8 AM and 8 PM
```

### Plant Selection
To scrape different plants, modify `scripts/scrape-usace.js`:
```javascript
this.bufordPlantId = '2'; // Change to different plant ID
```

Available plants:
- `1` - ALLATOONA DAM AND LAKE
- `2` - BUFORD DAM/LAKE SIDNEY LANIER  
- `3` - CARTERS DAM AND LAKE
- `8` - JIM WOODRUFF DAM/LAKE SEMINOLE

## 🔧 Troubleshooting

### Actions Failing
1. Check **Actions** tab for error logs
2. Verify repository permissions allow Actions
3. Check if USACE website structure changed

### No Data Generated
1. Run manual workflow trigger
2. Check browser compatibility in scraper logs
3. Verify USACE site accessibility

### Rate Limiting
- GitHub Actions has generous limits for public repositories
- Scraper includes delays and respectful crawling practices

## 📈 Monitoring

### Success Indicators
- New commits every 6 hours with data updates
- `data/usace-latest.json` file updated with recent timestamp
- No error badges in Actions tab

### Data Quality
- Check `statistics.totalPeriods > 0`
- Verify `timestamp` is recent (within 6 hours)
- Ensure `schedules` object contains current date

## 🤝 Contributing

This is an automated scraper repository. The main integration happens in the consuming application that reads from this data source.

## 📄 License

MIT License - Feel free to use and modify for your projects.
