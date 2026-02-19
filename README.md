# 🧩 Awesome Chromium Plugins

A curated collection of **privacy-first** Chromium browser extensions built for everyday productivity, smart shopping, and more — all designed with one core principle: **your data stays on your device**.

---

## 🔐 Privacy Philosophy

Every extension in this repository follows strict privacy guidelines:

- ✅ **Zero external data transmission** — no analytics, no tracking, no telemetry
- ✅ **Local-first storage** — all data lives in your browser (`chrome.storage.local`)
- ✅ **No accounts required** — install and use, no sign-ups
- ✅ **No third-party CDNs** — no external font/script/asset loading
- ✅ **Open source** — audit the code yourself

---

## 📦 Extensions

| Extension | Description | Status |
|-----------|-------------|--------|
| [🦅 DealHawk India](./dealhawk-india/) | Amazon.in deal finder & price tracker — discover heavily discounted items, catch price errors, and track prices with Keepa-style charts | ✅ v1.0.0 |

---

## 🚀 Installation

All extensions are built for **Microsoft Edge** and **Google Chrome** (or any Chromium-based browser).

### Load an Extension

1. Open your browser's extensions page:
   - **Edge**: `edge://extensions/`
   - **Chrome**: `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **"Load unpacked"**
4. Navigate to the extension's folder (e.g., `dealhawk-india/`) and select it
5. The extension icon will appear in your toolbar — you're ready to go!

---

## 🗂️ Repository Structure

```
awesome-chromium-plugins/
├── README.md                  ← You are here
├── dealhawk-india/            ← Amazon.in Deal Finder & Price Tracker
│   ├── manifest.json
│   ├── popup/
│   ├── content/
│   ├── background/
│   ├── icons/
│   └── README.md
└── ...                        ← More extensions coming soon
```

---

## 🛠️ Tech Stack

All extensions are built with:

- **Manifest V3** — the latest Chrome extension platform
- **Vanilla JavaScript** — no frameworks, no bloat
- **Vanilla CSS** — custom dark themes, glassmorphism, micro-animations
- **Chrome APIs** — `storage`, `alarms`, `notifications`, content scripts

---

## 🤝 Contributing

Contributions are welcome! When adding a new extension or modifying an existing one, please ensure:

1. **No external network requests** from extension code (no CDNs, APIs, or analytics)
2. **All data stays local** — use `chrome.storage.local` or `IndexedDB`
3. **Include a README** in the extension's folder with installation & usage instructions
4. **Use Manifest V3** for all new extensions
5. **Follow the existing code style** — clean, commented, well-structured

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">
  Built with ❤️ for users who value their privacy.
</p>
