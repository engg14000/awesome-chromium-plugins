/**
 * DealHawk India — Content Script (Amazon.in)
 * Runs on Amazon.in product pages and search results
 * 
 * Features:
 * - Extracts price data from product pages and stores locally
 * - Renders price history charts (Keepa-style)  
 * - Highlights heavily discounted items in search results
 * - Detects potential price errors
 * - Shows price alert setup UI
 * 
 * PRIVACY: All data processed and stored locally. Nothing leaves the browser.
 */

'use strict';

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const DEALHAWK_PREFIX = 'dealhawk';
const PRICE_ERROR_DEFAULT_THRESHOLD = 80;
const MAX_PRICE_HISTORY = 365; // Keep up to 1 year of daily prices
const CHART_COLORS = {
    primary: '#ff6900',
    primaryFaded: 'rgba(255, 105, 0, 0.15)',
    success: '#10b981',
    successFaded: 'rgba(16, 185, 129, 0.15)',
    danger: '#ef4444',
    dangerFaded: 'rgba(239, 68, 68, 0.15)',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    bg: '#111827',
    bgCard: '#1a2035',
    border: 'rgba(255, 255, 255, 0.08)',
    grid: 'rgba(255, 255, 255, 0.04)'
};

// ═══════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════
(async function init() {
    // Wait for page to be ready
    await waitForElement('#productTitle, .s-main-slot');

    const settings = await getSettings();

    if (isProductPage()) {
        await handleProductPage(settings);
    } else if (isSearchResultsPage()) {
        await handleSearchResults(settings);
    }
})();

// ═══════════════════════════════════════════
// Page Type Detection
// ═══════════════════════════════════════════
function isProductPage() {
    return !!document.getElementById('productTitle') || !!document.getElementById('dp');
}

function isSearchResultsPage() {
    return !!document.querySelector('.s-main-slot') || window.location.pathname.includes('/s');
}

// ═══════════════════════════════════════════
// Product Page Handler
// ═══════════════════════════════════════════
async function handleProductPage(settings) {
    const productData = extractProductData();
    if (!productData || !productData.asin) return;

    // Store price data locally
    await trackPrice(productData);

    // Show price history chart
    if (settings.showChart) {
        await injectPriceChart(productData);
    }

    // Show deal analysis badge
    injectDealAnalysis(productData, settings);
}

function extractProductData() {
    try {
        const data = {};

        // ASIN
        data.asin = extractASIN();
        if (!data.asin) return null;

        // Title
        const titleEl = document.getElementById('productTitle');
        data.title = titleEl ? titleEl.textContent.trim() : '';

        // Current price (try multiple selectors)
        data.currentPrice = extractPrice([
            '.a-price .a-offscreen',
            '#priceblock_dealprice',
            '#priceblock_ourprice',
            '#priceblock_saleprice',
            '.priceToPay .a-offscreen',
            '#corePrice_feature_div .a-offscreen',
            '#apex_offerDisplay_desktop .a-offscreen',
            '.a-price-whole'
        ]);

        // MRP / List price
        data.originalPrice = extractPrice([
            '.a-price.a-text-price .a-offscreen',
            '#priceblock_listprice',
            '.basisPrice .a-offscreen',
            '#listPrice',
            '.a-text-strike .a-offscreen'
        ]);

        // If we couldn't get originalPrice but have a separate element
        if (!data.originalPrice) {
            const strikePriceEl = document.querySelector('.a-text-price[data-a-strike="true"] .a-offscreen');
            if (strikePriceEl) {
                data.originalPrice = parsePrice(strikePriceEl.textContent);
            }
        }

        // Discount percentage
        const savingsEl = document.querySelector('.savingsPercentage, #dealprice_savings .a-color-price');
        if (savingsEl) {
            const match = savingsEl.textContent.match(/(\d+)/);
            data.discountPercent = match ? parseInt(match[1]) : 0;
        } else if (data.originalPrice && data.currentPrice && data.originalPrice > data.currentPrice) {
            data.discountPercent = Math.round((1 - data.currentPrice / data.originalPrice) * 100);
        }

        // Rating
        const ratingEl = document.querySelector('#acrPopover .a-icon-alt, .a-icon-star .a-icon-alt');
        if (ratingEl) {
            const match = ratingEl.textContent.match(/([\d.]+)/);
            data.rating = match ? parseFloat(match[1]) : 0;
        }

        // Review count  
        const reviewEl = document.getElementById('acrCustomerReviewText');
        if (reviewEl) {
            const match = reviewEl.textContent.replace(/,/g, '').match(/(\d+)/);
            data.reviewCount = match ? parseInt(match[1]) : 0;
        }

        // Image
        const imgEl = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
        data.image = imgEl ? (imgEl.dataset.oldHires || imgEl.src) : '';

        // URL
        data.url = window.location.href.split('?')[0];

        // Category
        const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div ul a');
        data.category = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].textContent.trim() : '';

        // Availability
        const availEl = document.getElementById('availability');
        data.inStock = availEl ? !availEl.textContent.toLowerCase().includes('unavailable') : true;

        return data;
    } catch (e) {
        console.warn('DealHawk: Error extracting product data', e);
        return null;
    }
}

function extractASIN() {
    // From URL
    const urlMatch = window.location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (urlMatch) return urlMatch[1];

    // From page data
    const asinInput = document.querySelector('input[name="ASIN"]');
    if (asinInput) return asinInput.value;

    // From canonical link
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        const match = canonical.href.match(/\/dp\/([A-Z0-9]{10})/);
        if (match) return match[1];
    }

    return null;
}

function extractPrice(selectors) {
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const price = parsePrice(el.textContent);
            if (price > 0) return price;
        }
    }
    return 0;
}

function parsePrice(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[^\d.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
}

// ═══════════════════════════════════════════
// Price Tracking (Local Storage)
// ═══════════════════════════════════════════
async function trackPrice(productData) {
    try {
        const stored = await chrome.storage.local.get('dealhawk_tracked');
        const tracked = stored.dealhawk_tracked || {};

        const existing = tracked[productData.asin] || {
            asin: productData.asin,
            title: productData.title,
            url: productData.url,
            image: productData.image,
            category: productData.category,
            originalPrice: productData.originalPrice,
            priceHistory: [],
            firstSeen: Date.now()
        };

        // Update title & image if newer
        existing.title = productData.title || existing.title;
        existing.image = productData.image || existing.image;
        existing.url = productData.url || existing.url;
        existing.originalPrice = productData.originalPrice || existing.originalPrice;
        existing.currentPrice = productData.currentPrice;
        existing.lastChecked = Date.now();

        // Add price to history (max 1 entry per day)
        const today = new Date().toISOString().split('T')[0];
        const lastEntry = existing.priceHistory[existing.priceHistory.length - 1];

        if (!lastEntry || lastEntry.date !== today) {
            existing.priceHistory.push({
                date: today,
                price: productData.currentPrice,
                timestamp: Date.now()
            });

            // Trim to max history length
            if (existing.priceHistory.length > MAX_PRICE_HISTORY) {
                existing.priceHistory = existing.priceHistory.slice(-MAX_PRICE_HISTORY);
            }
        } else {
            // Update today's entry
            lastEntry.price = productData.currentPrice;
            lastEntry.timestamp = Date.now();
        }

        tracked[productData.asin] = existing;
        await chrome.storage.local.set({ dealhawk_tracked: tracked });

        // Check for price drop alerts
        if (existing.priceHistory.length > 1) {
            const prevPrice = existing.priceHistory[existing.priceHistory.length - 2].price;
            if (productData.currentPrice < prevPrice) {
                checkPriceAlerts(productData, prevPrice);
            }
        }
    } catch (e) {
        console.warn('DealHawk: Error tracking price', e);
    }
}

async function checkPriceAlerts(productData, previousPrice) {
    try {
        const stored = await chrome.storage.local.get(['dealhawk_alerts_data', 'dealhawk_settings']);
        const alerts = stored.dealhawk_alerts_data || [];
        const settings = stored.dealhawk_settings || {};
        const threshold = settings.priceErrorThreshold || PRICE_ERROR_DEFAULT_THRESHOLD;

        const dropPercent = Math.round((1 - productData.currentPrice / previousPrice) * 100);

        if (dropPercent >= 20) { // Significant drop
            const newAlert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                type: dropPercent >= threshold ? 'price-error' : 'price-drop',
                asin: productData.asin,
                title: productData.title,
                description: `Price dropped ${dropPercent}%: ₹${previousPrice.toLocaleString('en-IN')} → ₹${productData.currentPrice.toLocaleString('en-IN')}`,
                oldPrice: previousPrice,
                newPrice: productData.currentPrice,
                dropPercent,
                timestamp: Date.now(),
                triggered: true,
                seen: false,
                url: productData.url
            };

            alerts.unshift(newAlert);

            // Keep max 100 alerts
            if (alerts.length > 100) alerts.splice(100);

            await chrome.storage.local.set({ dealhawk_alerts_data: alerts });

            // Send notification if enabled
            if (settings.notifications) {
                chrome.runtime.sendMessage({
                    type: 'PRICE_DROP',
                    data: newAlert
                }).catch(() => { });
            }
        }
    } catch (e) {
        console.warn('DealHawk: Error checking alerts', e);
    }
}

// ═══════════════════════════════════════════
// Price History Chart (Keepa-style)
// ═══════════════════════════════════════════
async function injectPriceChart(productData) {
    try {
        const stored = await chrome.storage.local.get('dealhawk_tracked');
        const tracked = stored.dealhawk_tracked || {};
        const existing = tracked[productData.asin];

        if (!existing || !existing.priceHistory || existing.priceHistory.length < 1) return;

        // Find injection point
        const targetEl = document.getElementById('unifiedPrice_feature_div')
            || document.getElementById('apex_desktop_newAccordionRow')
            || document.getElementById('corePrice_feature_div')
            || document.getElementById('price');

        if (!targetEl) return;

        // Create chart container
        const container = document.createElement('div');
        container.id = 'dealhawk-chart-container';
        container.innerHTML = `
      <div id="dealhawk-chart-wrapper">
        <div class="dh-chart-header">
          <div class="dh-chart-brand">
            <span class="dh-logo">₹↓</span>
            <span class="dh-brand-name">DealHawk Price History</span>
          </div>
          <div class="dh-chart-controls">
            <button class="dh-period-btn active" data-period="30">30D</button>
            <button class="dh-period-btn" data-period="90">90D</button>
            <button class="dh-period-btn" data-period="180">6M</button>
            <button class="dh-period-btn" data-period="365">1Y</button>
            <button class="dh-period-btn" data-period="0">All</button>
          </div>
        </div>
        <div class="dh-chart-stats">
          <div class="dh-stat">
            <span class="dh-stat-label">Current</span>
            <span class="dh-stat-value dh-current">₹${productData.currentPrice.toLocaleString('en-IN')}</span>
          </div>
          <div class="dh-stat">
            <span class="dh-stat-label">Lowest</span>
            <span class="dh-stat-value dh-lowest">-</span>
          </div>
          <div class="dh-stat">
            <span class="dh-stat-label">Highest</span>
            <span class="dh-stat-value dh-highest">-</span>
          </div>
          <div class="dh-stat">
            <span class="dh-stat-label">Average</span>
            <span class="dh-stat-value dh-average">-</span>
          </div>
        </div>
        <canvas id="dealhawk-price-canvas" width="700" height="200"></canvas>
        <div class="dh-chart-tooltip" id="dh-tooltip" style="display:none">
          <span class="dh-tooltip-date"></span>
          <span class="dh-tooltip-price"></span>
        </div>
        <div class="dh-chart-footer">
          <div class="dh-alert-setup">
            <span>Set Price Alert:</span>
            <input type="number" id="dh-target-price" placeholder="Target ₹" class="dh-input">
            <button id="dh-set-alert" class="dh-btn-primary">Set Alert</button>
          </div>
          <span class="dh-privacy-note">🔒 Data stored locally only</span>
        </div>
      </div>
    `;

        targetEl.parentNode.insertBefore(container, targetEl.nextSibling);

        // Draw chart
        const priceHistory = existing.priceHistory;
        drawPriceHistoryChart(priceHistory);

        // Period buttons
        container.querySelectorAll('.dh-period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.dh-period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const period = parseInt(btn.dataset.period);
                const filtered = period > 0
                    ? priceHistory.slice(-period)
                    : priceHistory;
                drawPriceHistoryChart(filtered);
            });
        });

        // Set alert button
        document.getElementById('dh-set-alert').addEventListener('click', async () => {
            const targetPrice = parseFloat(document.getElementById('dh-target-price').value);
            if (!targetPrice || targetPrice <= 0) {
                alert('Please enter a valid target price');
                return;
            }

            const stored = await chrome.storage.local.get('dealhawk_alerts_data');
            const alerts = stored.dealhawk_alerts_data || [];

            alerts.push({
                id: `alert_${Date.now()}`,
                type: 'target-price',
                asin: productData.asin,
                title: productData.title,
                description: `Alert when price drops to ₹${targetPrice.toLocaleString('en-IN')}`,
                targetPrice,
                currentPrice: productData.currentPrice,
                timestamp: Date.now(),
                triggered: false,
                seen: false,
                url: productData.url
            });

            await chrome.storage.local.set({ dealhawk_alerts_data: alerts });

            document.getElementById('dh-target-price').value = '';
            showNotification('✅ Price alert set! You\'ll be notified when the price drops.');
        });

        // Tooltip interaction
        const canvas = document.getElementById('dealhawk-price-canvas');
        canvas.addEventListener('mousemove', (e) => handleChartHover(e, priceHistory));
        canvas.addEventListener('mouseleave', () => {
            document.getElementById('dh-tooltip').style.display = 'none';
        });

    } catch (e) {
        console.warn('DealHawk: Error injecting chart', e);
    }
}

function drawPriceHistoryChart(priceHistory) {
    const canvas = document.getElementById('dealhawk-price-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 16, right: 16, bottom: 28, left: 60 };

    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const prices = priceHistory.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const range = max - min || 1;

    // Update stats
    const lowestEl = document.querySelector('.dh-lowest');
    const highestEl = document.querySelector('.dh-highest');
    const avgEl = document.querySelector('.dh-average');
    if (lowestEl) lowestEl.textContent = `₹${min.toLocaleString('en-IN')}`;
    if (highestEl) highestEl.textContent = `₹${max.toLocaleString('en-IN')}`;
    if (avgEl) avgEl.textContent = `₹${Math.round(avg).toLocaleString('en-IN')}`;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = CHART_COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        // Y-axis labels
        const priceLabel = max - (range / gridLines) * i;
        ctx.fillStyle = CHART_COLORS.textMuted;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${Math.round(priceLabel).toLocaleString('en-IN')}`, padding.left - 8, y + 4);
    }

    // X-axis labels
    const dateStep = Math.max(1, Math.floor(priceHistory.length / 5));
    ctx.fillStyle = CHART_COLORS.textMuted;
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < priceHistory.length; i += dateStep) {
        const x = padding.left + (i / (priceHistory.length - 1 || 1)) * chartW;
        const date = new Date(priceHistory[i].date);
        ctx.fillText(date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), x, h - 6);
    }

    if (prices.length < 2) {
        // Single point — show dot
        ctx.beginPath();
        ctx.arc(padding.left + chartW / 2, padding.top + chartH / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = CHART_COLORS.primary;
        ctx.fill();

        ctx.fillStyle = CHART_COLORS.text;
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tracking started — more data points will appear over time', w / 2, padding.top + chartH / 2 + 25);
        return;
    }

    const stepX = chartW / (prices.length - 1);

    // Area gradient
    const isDown = prices[prices.length - 1] <= prices[0];
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    if (isDown) {
        areaGrad.addColorStop(0, CHART_COLORS.successFaded);
        areaGrad.addColorStop(1, 'transparent');
    } else {
        areaGrad.addColorStop(0, CHART_COLORS.dangerFaded);
        areaGrad.addColorStop(1, 'transparent');
    }

    // Area
    ctx.beginPath();
    ctx.moveTo(padding.left, h - padding.bottom);
    prices.forEach((price, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - ((price - min) / range) * chartH;
        ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + (prices.length - 1) * stepX, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line
    ctx.beginPath();
    prices.forEach((price, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - ((price - min) / range) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isDown ? CHART_COLORS.success : CHART_COLORS.danger;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Average line (dashed)
    const avgY = padding.top + chartH - ((avg - min) / range) * chartH;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, avgY);
    ctx.lineTo(w - padding.right, avgY);
    ctx.strokeStyle = CHART_COLORS.primary;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Average label
    ctx.fillStyle = CHART_COLORS.primary;
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Avg', w - padding.right + 4, avgY + 3);

    // Current price dot
    const lastX = padding.left + (prices.length - 1) * stepX;
    const lastY = padding.top + chartH - ((prices[prices.length - 1] - min) / range) * chartH;

    // Glow
    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fillStyle = isDown ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = isDown ? CHART_COLORS.success : CHART_COLORS.danger;
    ctx.fill();
    ctx.strokeStyle = CHART_COLORS.bg;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Store chart metadata for tooltip
    canvas.dataset.chartPadding = JSON.stringify(padding);
    canvas.dataset.chartDimensions = JSON.stringify({ chartW, chartH });
    canvas.dataset.priceRange = JSON.stringify({ min, max, range });
}

function handleChartHover(e, priceHistory) {
    const canvas = document.getElementById('dealhawk-price-canvas');
    const tooltip = document.getElementById('dh-tooltip');
    if (!canvas || !tooltip || priceHistory.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;

    const padding = JSON.parse(canvas.dataset.chartPadding || '{}');
    const dims = JSON.parse(canvas.dataset.chartDimensions || '{}');

    if (!padding.left || !dims.chartW) return;

    const chartX = x - padding.left;
    if (chartX < 0 || chartX > dims.chartW) {
        tooltip.style.display = 'none';
        return;
    }

    const index = Math.round((chartX / dims.chartW) * (priceHistory.length - 1));
    const clamped = Math.max(0, Math.min(priceHistory.length - 1, index));
    const entry = priceHistory[clamped];

    if (!entry) return;

    tooltip.style.display = 'block';
    tooltip.querySelector('.dh-tooltip-date').textContent = new Date(entry.date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
    tooltip.querySelector('.dh-tooltip-price').textContent = `₹${entry.price.toLocaleString('en-IN')}`;

    // Position tooltip
    const tooltipX = e.clientX - rect.left;
    tooltip.style.left = `${Math.max(0, Math.min(tooltipX - 50, rect.width - 120))}px`;
    tooltip.style.top = `${e.clientY - rect.top - 50}px`;
}

// ═══════════════════════════════════════════
// Deal Analysis Badge
// ═══════════════════════════════════════════
function injectDealAnalysis(productData, settings) {
    if (!productData.discountPercent || productData.discountPercent < 10) return;

    const titleEl = document.getElementById('productTitle');
    if (!titleEl) return;

    const isPriceError = productData.discountPercent >= settings.priceErrorThreshold;
    const dealScore = calculateDealScore(productData);

    const badge = document.createElement('div');
    badge.id = 'dealhawk-deal-badge';
    badge.innerHTML = `
    <div class="dh-badge ${isPriceError ? 'dh-badge-error' : dealScore >= 8 ? 'dh-badge-great' : 'dh-badge-good'}">
      <span class="dh-badge-icon">${isPriceError ? '⚠️' : dealScore >= 8 ? '🔥' : '✅'}</span>
      <div class="dh-badge-content">
        <span class="dh-badge-title">
          ${isPriceError ? 'POTENTIAL PRICE ERROR' : dealScore >= 8 ? 'AMAZING DEAL' : 'GOOD DEAL'}
        </span>
        <span class="dh-badge-detail">
          ${productData.discountPercent}% off · Deal Score: ${dealScore}/10
          ${isPriceError ? ' · Buy now before correction!' : ''}
        </span>
      </div>
    </div>
  `;

    titleEl.parentNode.insertBefore(badge, titleEl.nextSibling);
}

function calculateDealScore(data) {
    let score = 0;

    // Discount weight (max 4 points)
    if (data.discountPercent >= 80) score += 4;
    else if (data.discountPercent >= 60) score += 3;
    else if (data.discountPercent >= 40) score += 2;
    else if (data.discountPercent >= 20) score += 1;

    // Rating weight (max 2 points)
    if (data.rating >= 4.5) score += 2;
    else if (data.rating >= 4.0) score += 1.5;
    else if (data.rating >= 3.5) score += 1;

    // Review count weight (max 2 points)
    if (data.reviewCount >= 1000) score += 2;
    else if (data.reviewCount >= 100) score += 1.5;
    else if (data.reviewCount >= 10) score += 1;

    // Price competitiveness (max 2 points)
    if (data.originalPrice > 0 && data.currentPrice > 0) {
        const ratio = data.currentPrice / data.originalPrice;
        if (ratio <= 0.2) score += 2;
        else if (ratio <= 0.4) score += 1.5;
        else if (ratio <= 0.6) score += 1;
    }

    return Math.min(10, Math.round(score));
}

// ═══════════════════════════════════════════
// Search Results Enhancement
// ═══════════════════════════════════════════
async function handleSearchResults(settings) {
    if (!settings.highlightDeals) return;

    const searchFilters = await getSearchFilters();

    // Find all search result items
    const resultItems = document.querySelectorAll('[data-component-type="s-search-result"]');

    resultItems.forEach(item => {
        try {
            // Extract discount from the result
            const discountEl = item.querySelector('.a-letter-space + span, .a-text-price + span');
            let discount = 0;

            // Try to find discount percentage text
            const allSpans = item.querySelectorAll('span');
            for (const span of allSpans) {
                const match = span.textContent.match(/\((\d+)%\s*off\)/i);
                if (match) {
                    discount = parseInt(match[1]);
                    break;
                }
            }

            // If no explicit discount, calculate from prices
            if (discount === 0) {
                const priceWhole = item.querySelector('.a-price-whole');
                const listPrice = item.querySelector('.a-price.a-text-price .a-offscreen');

                if (priceWhole && listPrice) {
                    const current = parsePrice(priceWhole.textContent);
                    const original = parsePrice(listPrice.textContent);
                    if (original > current && current > 0) {
                        discount = Math.round((1 - current / original) * 100);
                    }
                }
            }

            // Apply highlighting based on discount
            if (discount >= (settings.priceErrorThreshold || 80)) {
                // Price error styling
                item.style.borderLeft = '4px solid #ef4444';
                item.style.background = 'rgba(239, 68, 68, 0.03)';
                item.style.position = 'relative';

                const errorTag = document.createElement('div');
                errorTag.className = 'dh-search-tag dh-tag-error';
                errorTag.textContent = `⚠️ ${discount}% OFF — Possible Price Error!`;
                item.prepend(errorTag);

            } else if (discount >= 50) {
                // Great deal styling
                item.style.borderLeft = '4px solid #10b981';
                item.style.background = 'rgba(16, 185, 129, 0.02)';

                const dealTag = document.createElement('div');
                dealTag.className = 'dh-search-tag dh-tag-deal';
                dealTag.textContent = `🔥 ${discount}% OFF — Great Deal!`;
                item.prepend(dealTag);
            }

            // Low stock badge
            if (searchFilters.lowStock) {
                const stockEls = item.querySelectorAll('span');
                for (const el of stockEls) {
                    if (el.textContent.toLowerCase().includes('only') && el.textContent.toLowerCase().includes('left')) {
                        const stockTag = document.createElement('div');
                        stockTag.className = 'dh-search-tag dh-tag-stock';
                        stockTag.textContent = `⏰ ${el.textContent.trim()}`;
                        item.prepend(stockTag);
                        break;
                    }
                }
            }

        } catch (e) {
            // Ignore individual item errors
        }
    });
}

// ═══════════════════════════════════════════
// In-page Notification
// ═══════════════════════════════════════════
function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'dh-notification';
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(-10px)';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ═══════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════
async function getSettings() {
    try {
        const stored = await chrome.storage.local.get('dealhawk_settings');
        return {
            priceErrorThreshold: 80,
            showChart: true,
            highlightDeals: true,
            notifications: true,
            ...(stored.dealhawk_settings || {})
        };
    } catch (e) {
        return {
            priceErrorThreshold: 80,
            showChart: true,
            highlightDeals: true,
            notifications: true
        };
    }
}

async function getSearchFilters() {
    try {
        const stored = await chrome.storage.local.get('dealhawk_search_filters');
        return stored.dealhawk_search_filters || {};
    } catch (e) {
        return {};
    }
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}
