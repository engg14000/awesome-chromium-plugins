/**
 * DealHawk India — Background Service Worker
 * Handles price checking alarms, notifications, and message routing.
 * 
 * PRIVACY: No external API calls. All data stays in chrome.storage.local.
 */

'use strict';

// ═══════════════════════════════════════════
// Installation & Setup
// ═══════════════════════════════════════════
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // Initialize default settings
        const defaultSettings = {
            priceErrorThreshold: 80,
            checkInterval: 6,
            notifications: true,
            showChart: true,
            highlightDeals: true,
            resultsCount: 48
        };

        await chrome.storage.local.set({
            dealhawk_settings: defaultSettings,
            dealhawk_tracked: {},
            dealhawk_alerts_data: []
        });

        // Set up alarm for periodic price checking
        chrome.alarms.create('dealhawk-price-check', {
            periodInMinutes: defaultSettings.checkInterval * 60
        });

        console.log('DealHawk India: Extension installed successfully');
    }

    if (details.reason === 'update') {
        console.log('DealHawk India: Extension updated to v' + chrome.runtime.getManifest().version);
    }
});

// ═══════════════════════════════════════════
// Alarm Handler — Periodic Price Checks
// ═══════════════════════════════════════════
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'dealhawk-price-check') return;

    console.log('DealHawk: Running scheduled price check...');

    try {
        const stored = await chrome.storage.local.get(['dealhawk_tracked', 'dealhawk_settings']);
        const tracked = stored.dealhawk_tracked || {};
        const settings = stored.dealhawk_settings || {};

        const products = Object.values(tracked);
        if (products.length === 0) return;

        // Check each tracked product by fetching its page
        // We do this by sending a message to any open Amazon.in tabs
        const tabs = await chrome.tabs.query({ url: 'https://www.amazon.in/*' });

        if (tabs.length > 0) {
            // If there's an active Amazon tab, tell it to check prices
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'CHECK_PRICES',
                        products: products.map(p => ({ asin: p.asin, url: p.url }))
                    });
                } catch (e) {
                    // Tab might not have content script loaded
                }
            }
        }

        // Check for target price alerts
        await checkTargetPriceAlerts(tracked);

    } catch (e) {
        console.warn('DealHawk: Error in price check alarm', e);
    }
});

// ═══════════════════════════════════════════
// Message Handler
// ═══════════════════════════════════════════
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    switch (message.type) {
        case 'PRICE_DROP':
            handlePriceDrop(message.data);
            break;

        case 'SETTINGS_UPDATED':
            handleSettingsUpdate(message.settings);
            break;

        case 'GET_TRACKED':
            getTrackedProducts().then(sendResponse);
            return true; // Async response

        case 'GET_ALERTS':
            getAlerts().then(sendResponse);
            return true;
    }
});

// ═══════════════════════════════════════════
// Price Drop Notification
// ═══════════════════════════════════════════
async function handlePriceDrop(data) {
    if (!data) return;

    try {
        const settings = await getSettings();
        if (!settings.notifications) return;

        const iconUrl = chrome.runtime.getURL('icons/icon128.png');

        const notifOptions = {
            type: 'basic',
            iconUrl: iconUrl,
            title: data.type === 'price-error' ? '⚠️ Price Error Detected!' : '📉 Price Drop Alert!',
            message: `${data.title}\n${data.description}`,
            priority: data.type === 'price-error' ? 2 : 1,
            requireInteraction: data.type === 'price-error'
        };

        chrome.notifications.create(`dealhawk-${data.id}`, notifOptions);
    } catch (e) {
        console.warn('DealHawk: Error showing notification', e);
    }
}

// Handle notification click — open the product page
chrome.notifications.onClicked.addListener(async (notificationId) => {
    if (!notificationId.startsWith('dealhawk-')) return;

    try {
        const alertId = notificationId.replace('dealhawk-', '');
        const stored = await chrome.storage.local.get('dealhawk_alerts_data');
        const alerts = stored.dealhawk_alerts_data || [];
        const alert = alerts.find(a => a.id === alertId);

        if (alert && alert.url) {
            chrome.tabs.create({ url: alert.url });
        }
    } catch (e) {
        console.warn('DealHawk: Error handling notification click', e);
    }
});

// ═══════════════════════════════════════════
// Settings Update
// ═══════════════════════════════════════════
async function handleSettingsUpdate(newSettings) {
    if (!newSettings) return;

    // Update alarm interval
    if (newSettings.checkInterval) {
        await chrome.alarms.clear('dealhawk-price-check');
        chrome.alarms.create('dealhawk-price-check', {
            periodInMinutes: newSettings.checkInterval * 60
        });
        console.log(`DealHawk: Price check interval updated to ${newSettings.checkInterval} hours`);
    }
}

// ═══════════════════════════════════════════
// Target Price Alerts Check
// ═══════════════════════════════════════════
async function checkTargetPriceAlerts(tracked) {
    try {
        const stored = await chrome.storage.local.get('dealhawk_alerts_data');
        const alerts = stored.dealhawk_alerts_data || [];
        let updated = false;

        for (const alert of alerts) {
            if (alert.type !== 'target-price' || alert.triggered) continue;

            const product = tracked[alert.asin];
            if (!product || !product.currentPrice) continue;

            if (product.currentPrice <= alert.targetPrice) {
                alert.triggered = true;
                alert.seen = false;
                alert.timestamp = Date.now();
                alert.description = `Price dropped to ₹${product.currentPrice.toLocaleString('en-IN')} (target: ₹${alert.targetPrice.toLocaleString('en-IN')})`;
                updated = true;

                // Send notification
                handlePriceDrop(alert);
            }
        }

        if (updated) {
            await chrome.storage.local.set({ dealhawk_alerts_data: alerts });
        }
    } catch (e) {
        console.warn('DealHawk: Error checking target price alerts', e);
    }
}

// ═══════════════════════════════════════════
// Data Getters
// ═══════════════════════════════════════════
async function getTrackedProducts() {
    try {
        const stored = await chrome.storage.local.get('dealhawk_tracked');
        return stored.dealhawk_tracked || {};
    } catch (e) {
        return {};
    }
}

async function getAlerts() {
    try {
        const stored = await chrome.storage.local.get('dealhawk_alerts_data');
        return stored.dealhawk_alerts_data || [];
    } catch (e) {
        return [];
    }
}

async function getSettings() {
    try {
        const stored = await chrome.storage.local.get('dealhawk_settings');
        return stored.dealhawk_settings || {};
    } catch (e) {
        return {};
    }
}
