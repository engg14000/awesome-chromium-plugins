# 🦅 DealHawk India — Privacy-First Amazon.in Deal Finder & Price Tracker

<p align="center">
  <strong>Find heavily discounted items, catch price errors, and track prices — all without sending a single byte of your data anywhere.</strong>
</p>

---

## 🎯 What is DealHawk India?

DealHawk India is a **Microsoft Edge / Chromium extension** built to help you find the best deals on Amazon.in. Unlike other deal-finding extensions that track your browsing, collect your data, and sell it to advertisers, DealHawk India is **100% privacy-focused** — all data stays in your browser, period.

### 🔐 Privacy Promise
- **Zero external API calls** — no data ever leaves your browser
- **No analytics, no tracking, no cookies** sent to third parties
- **All price history stored locally** in `chrome.storage.local`
- **Open source** — audit the code yourself
- **No account required** — just install and use

---

## ✨ Features

### 🏷️ Deal Finder
- **Category-wide discount search** across 18+ Amazon.in categories
- **Adjustable discount slider** (10%-95%) to find your sweet spot
- **Price error detection** — flags items with suspiciously large discounts (80%+ by default, configurable)
- **Quick filters**: Lightning Deals, Low Stock, Prime Only
- **Sort options**: Highest Discount, Price Low/High, Best Rated

### 📊 Keepa-Style Price Tracking
- **Automatic price tracking** — visit any Amazon.in product page to start tracking
- **Interactive price history chart** embedded directly on product pages
- **Time period views**: 30 days, 90 days, 6 months, 1 year, All time
- **Price statistics**: Current, Lowest, Highest, Average
- **Visual indicators**: Green (price dropping), Red (price rising)
- **Sparkline mini-charts** in the tracker view

### 🔔 Smart Alerts
- **Price drop notifications** — get alerted when tracked prices fall
- **Target price alerts** — set your desired price for any product
- **Price error alerts** — catch pricing mistakes before they're corrected
- **Browser notifications** — never miss a deal

### 📈 Deal Analysis
- **Deal Score (1-10)** based on discount %, rating, reviews, and price competitiveness
- **Visual badges** on product pages: "Amazing Deal", "Good Deal", "Potential Price Error"
- **Search result highlighting** — spotted deals marked with colored borders and tags

### 🛡️ Data Control
- **Export all data** as JSON backup
- **Import data** from backup files
- **Clear tracking data** anytime
- **Configurable settings** for every feature

---

## 📥 Installation

### Microsoft Edge
1. Open Edge and navigate to `edge://extensions/`
2. Enable **"Developer mode"** (toggle in bottom-left)
3. Click **"Load unpacked"**
4. Select the `dealhawk-india` folder
5. The DealHawk India icon will appear in your toolbar

### Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `dealhawk-india` folder

---

## 🚀 How to Use

### Finding Deals
1. Click the DealHawk India icon in your toolbar
2. Enter a search term (or leave blank for all items)
3. Select a category
4. Adjust the discount slider (try 80%+ for price errors!)
5. Toggle quick filters as needed
6. Click **"Find Deals on Amazon.in"**
7. Amazon.in opens with your filters pre-applied

### Tracking Prices
1. Visit any product page on Amazon.in
2. DealHawk automatically records the price
3. A **price history chart** appears below the price section
4. Use period buttons (30D, 90D, 6M, 1Y, All) to change the view
5. Set a target price to get alerted when it drops

### Managing Alerts
1. Click the **Alerts** tab in the popup
2. View triggered alerts and their details
3. Click the settings gear to configure notification preferences

---

## 🗂️ Project Structure

```
dealhawk-india/
├── manifest.json              # Extension manifest (MV3)
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Popup styles (dark theme)
│   └── popup.js               # Popup controller logic
├── content/
│   ├── content.js             # Amazon.in page scripts
│   └── content.css            # Injected page styles
├── background/
│   └── service-worker.js      # Background service worker
├── icons/
│   ├── icon16.png             # 16x16 icon
│   ├── icon48.png             # 48x48 icon
│   ├── icon128.png            # 128x128 icon
│   ├── generate-icons.ps1     # Icon generation script
│   └── generate-icons.html    # Icon generation HTML tool
└── README.md                  # This file
```

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Price Error Threshold | 80% | Discount % that flags potential pricing errors |
| Check Interval | 6 hours | How often to check tracked prices |
| Browser Notifications | On | Show alerts for price drops |
| Show Price Chart | On | Embed price history on product pages |
| Highlight Deals | On | Mark deals in search results |
| Results Per Page | 48 | Number of deal results to load |

---

## 🔧 Technical Details

### Permissions Used
| Permission | Why |
|-----------|-----|
| `storage` | Store price history & settings locally |
| `alarms` | Schedule periodic price checks |
| `notifications` | Alert users of price drops |
| `host_permissions: amazon.in` | Read prices from Amazon.in pages |

### How Price Error Detection Works
1. Compares the current selling price against the MRP (Maximum Retail Price)
2. If the discount exceeds the configured threshold (default: 80%), it's flagged
3. Checks against the product's own price history for unusual drops
4. Assigns a Deal Score (1-10) based on discount, rating, reviews, and price ratio

### Amazon.in URL Parameters Used
- `k` — Search keyword
- `i` — Category filter
- `pct-off` — Discount percentage range
- `s` — Sort order
- `rh` — Refinement hash (for Prime filter)

---

## 🤝 Contributing

Contributions are welcome! Please ensure any changes maintain the **zero external data transmission** principle.

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">
  Made with ❤️ for Indian deal hunters who value their privacy.
</p>
