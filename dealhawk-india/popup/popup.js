/**
 * DealHawk India — Popup Controller
 * Privacy-first Amazon.in deal finder & price tracker
 * All data stays local in IndexedDB / chrome.storage.local
 */

'use strict';

// ═══════════════════════════════════════════
// Constants & Configuration
// ═══════════════════════════════════════════
const AMAZON_IN = 'https://www.amazon.in';
const CATEGORY_MAP = {
  '': '',
  'electronics': 'electronics',
  'computers': 'computers',
  'mobile-phones': 'mobile-phones',
  'fashion': 'fashion',
  'home-kitchen': 'kitchen',
  'appliances': 'appliances',
  'beauty': 'beauty',
  'sports': 'sports',
  'toys': 'toys',
  'books': 'books',
  'grocery': 'grocery',
  'automotive': 'automotive',
  'health': 'hpc',
  'garden': 'garden',
  'pet-supplies': 'pet-supplies',
  'office-products': 'office-products',
  'musical-instruments': 'musical-instruments',
  'videogames': 'videogames'
};

const DEFAULT_SETTINGS = {
  priceErrorThreshold: 80,
  checkInterval: 6,
  notifications: true,
  showChart: true,
  highlightDeals: true,
  resultsCount: 48
};

// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════
let currentTab = 'deals';
let activeFilters = new Set();
let settings = { ...DEFAULT_SETTINGS };

// ═══════════════════════════════════════════
// DOM References
// ═══════════════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ═══════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initTabs();
  initDealsFinder();
  initSlider();
  initQuickFilters();
  initSettings();
  initTracker();
  initAlerts();
  initExportImport();
  loadTrackerData();
  loadAlerts();
});

// ═══════════════════════════════════════════
// Settings Management
// ═══════════════════════════════════════════
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get('dealhawk_settings');
    if (stored.dealhawk_settings) {
      settings = { ...DEFAULT_SETTINGS, ...stored.dealhawk_settings };
    }
    applySettingsToUI();
  } catch (e) {
    console.warn('DealHawk: Could not load settings', e);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ dealhawk_settings: settings });
  } catch (e) {
    console.warn('DealHawk: Could not save settings', e);
  }
}

function applySettingsToUI() {
  const el = (id) => document.getElementById(id);
  if (el('setting-price-error-threshold')) el('setting-price-error-threshold').value = settings.priceErrorThreshold;
  if (el('setting-check-interval')) el('setting-check-interval').value = settings.checkInterval;
  if (el('setting-notifications')) el('setting-notifications').checked = settings.notifications;
  if (el('setting-show-chart')) el('setting-show-chart').checked = settings.showChart;
  if (el('setting-highlight-deals')) el('setting-highlight-deals').checked = settings.highlightDeals;
  if (el('setting-results-count')) el('setting-results-count').value = settings.resultsCount;
}

// ═══════════════════════════════════════════
// Tab Navigation
// ═══════════════════════════════════════════
function initTabs() {
  $$('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target === currentTab) return;
      
      // Update tab buttons
      $$('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update tab content
      $$('.tab-content').forEach(tc => tc.classList.remove('active'));
      $(`#tab-${target}`).classList.add('active');
      
      currentTab = target;
    });
  });
}

// ═══════════════════════════════════════════
// Deals Finder
// ═══════════════════════════════════════════
function initDealsFinder() {
  const findBtn = $('#btn-find-deals');
  const searchInput = $('#search-input');
  
  findBtn.addEventListener('click', () => findDeals());
  
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') findDeals();
  });
}

function findDeals() {
  const searchQuery = $('#search-input').value.trim();
  const category = $('#category-select').value;
  const sortBy = $('#sort-select').value;
  const minDiscount = parseInt($('#discount-slider').value);
  
  // Build Amazon.in URL with filters
  let url = `${AMAZON_IN}/s?`;
  const params = new URLSearchParams();
  
  // Search keyword
  if (searchQuery) {
    params.set('k', searchQuery);
  }
  
  // Category
  if (category && CATEGORY_MAP[category]) {
    params.set('i', CATEGORY_MAP[category]);
  }
  
  // Discount percentage
  params.set('pct-off', `${minDiscount}-`);
  
  // Sort
  switch (sortBy) {
    case 'price-asc':
      params.set('s', 'price-asc-rank');
      break;
    case 'price-desc':
      params.set('s', 'price-desc-rank');
      break;
    case 'rating-desc':
      params.set('s', 'review-rank');
      break;
    case 'discount-desc':
    default:
      // Amazon doesn't have a direct discount sort, but pct-off handles filtering
      params.set('s', 'price-asc-rank');
      break;
  }
  
  // Quick filters
  if (activeFilters.has('prime')) {
    params.set('rh', 'p_85:10440599031'); // Amazon.in Prime filter node
  }
  
  if (activeFilters.has('lightning')) {
    params.set('deals', 'lightning');
  }
  
  url += params.toString();
  
  // Open in new tab
  chrome.tabs.create({ url });
  
  // Show loading state briefly
  const findBtn = $('#btn-find-deals');
  const originalText = findBtn.innerHTML;
  findBtn.classList.add('loading');
  findBtn.innerHTML = '<span class="loading-spinner"></span> Opening Amazon.in...';
  
  setTimeout(() => {
    findBtn.classList.remove('loading');
    findBtn.innerHTML = originalText;
  }, 1500);
  
  // Send message to content script to analyze results
  if (activeFilters.has('price-error') || activeFilters.has('low-stock')) {
    chrome.storage.local.set({
      dealhawk_search_filters: {
        priceError: activeFilters.has('price-error'),
        lowStock: activeFilters.has('low-stock'),
        minDiscount: minDiscount,
        priceErrorThreshold: settings.priceErrorThreshold
      }
    });
  }
}

// ═══════════════════════════════════════════
// Discount Slider
// ═══════════════════════════════════════════
function initSlider() {
  const slider = $('#discount-slider');
  const valueDisplay = $('#discount-value');
  
  function updateSlider() {
    const val = parseInt(slider.value);
    valueDisplay.textContent = `${val}% OFF`;
    
    // Color based on discount level
    if (val >= 80) {
      valueDisplay.style.color = '#ef4444';
      valueDisplay.style.background = 'rgba(239, 68, 68, 0.1)';
    } else if (val >= 60) {
      valueDisplay.style.color = '#f59e0b';
      valueDisplay.style.background = 'rgba(245, 158, 11, 0.1)';
    } else {
      valueDisplay.style.color = '#ff6900';
      valueDisplay.style.background = 'rgba(255, 105, 0, 0.1)';
    }
    
    // Update slider track fill
    const pct = ((val - 10) / 85) * 100;
    slider.style.background = `linear-gradient(to right, #ff6900 0%, #ff4500 ${pct}%, #1a2035 ${pct}%)`;
  }
  
  slider.addEventListener('input', updateSlider);
  updateSlider();
}

// ═══════════════════════════════════════════
// Quick Filters
// ═══════════════════════════════════════════
function initQuickFilters() {
  $$('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      if (activeFilters.has(filter)) {
        activeFilters.delete(filter);
        btn.classList.remove('active');
      } else {
        activeFilters.add(filter);
        btn.classList.add('active');
      }
    });
  });
}

// ═══════════════════════════════════════════
// Settings Panel
// ═══════════════════════════════════════════
function initSettings() {
  // Open
  $('#btn-settings').addEventListener('click', () => {
    $('#settings-panel').classList.remove('hidden');
  });
  
  // Close
  $('#btn-close-settings').addEventListener('click', () => {
    $('#settings-panel').classList.add('hidden');
    collectAndSaveSettings();
  });
  
  // Auto-save on change
  const settingInputs = [
    'setting-price-error-threshold',
    'setting-check-interval',
    'setting-notifications',
    'setting-show-chart',
    'setting-highlight-deals',
    'setting-results-count'
  ];
  
  settingInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => collectAndSaveSettings());
    }
  });
}

function collectAndSaveSettings() {
  settings.priceErrorThreshold = parseInt($('#setting-price-error-threshold').value) || 80;
  settings.checkInterval = parseInt($('#setting-check-interval').value) || 6;
  settings.notifications = $('#setting-notifications').checked;
  settings.showChart = $('#setting-show-chart').checked;
  settings.highlightDeals = $('#setting-highlight-deals').checked;
  settings.resultsCount = parseInt($('#setting-results-count').value) || 48;
  
  saveSettings();
  
  // Notify background service worker of settings change
  chrome.runtime.sendMessage({
    type: 'SETTINGS_UPDATED',
    settings: settings
  }).catch(() => {});
  
  showToast('Settings saved', 'success');
}

// ═══════════════════════════════════════════
// Price Tracker
// ═══════════════════════════════════════════
function initTracker() {
  $('#btn-clear-tracker').addEventListener('click', async () => {
    if (confirm('Clear all tracked products? This cannot be undone.')) {
      await chrome.storage.local.remove('dealhawk_tracked');
      loadTrackerData();
      showToast('All tracked products cleared', 'success');
    }
  });
}

async function loadTrackerData() {
  try {
    const stored = await chrome.storage.local.get(['dealhawk_tracked', 'dealhawk_alerts_data']);
    const tracked = stored.dealhawk_tracked || {};
    const alerts = stored.dealhawk_alerts_data || [];
    
    const products = Object.values(tracked);
    const priceDrops = products.filter(p => p.priceHistory && p.priceHistory.length > 1 && 
      p.priceHistory[p.priceHistory.length - 1].price < p.priceHistory[0].price
    ).length;
    const activeAlerts = alerts.filter(a => !a.triggered).length;
    
    // Update stats
    $('#stat-tracked').textContent = products.length;
    $('#stat-drops').textContent = priceDrops;
    $('#stat-alerts-count').textContent = activeAlerts;
    
    // Render tracked products
    renderTrackedProducts(products);
  } catch (e) {
    console.warn('DealHawk: Error loading tracker data', e);
  }
}

function renderTrackedProducts(products) {
  const container = $('#tracked-products');
  
  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <p>No products tracked yet.</p>
        <span class="hint">Visit any Amazon.in product page to start tracking</span>
      </div>`;
    return;
  }
  
  container.innerHTML = products
    .sort((a, b) => (b.lastChecked || 0) - (a.lastChecked || 0))
    .map((product, i) => {
      const currentPrice = product.priceHistory && product.priceHistory.length > 0
        ? product.priceHistory[product.priceHistory.length - 1].price
        : product.currentPrice || 0;
      const firstPrice = product.priceHistory && product.priceHistory.length > 0
        ? product.priceHistory[0].price
        : product.originalPrice || currentPrice;
      const priceChange = currentPrice - firstPrice;
      const priceChangeClass = priceChange < 0 ? 'down' : priceChange > 0 ? 'up' : '';
      const priceChangeText = priceChange < 0 
        ? `↓ ₹${Math.abs(priceChange).toLocaleString('en-IN')}`
        : priceChange > 0 
          ? `↑ ₹${priceChange.toLocaleString('en-IN')}`
          : '';
      
      const sparklineData = product.priceHistory 
        ? product.priceHistory.map(h => h.price) 
        : [currentPrice];
      
      return `
        <div class="tracked-card" style="animation-delay: ${i * 60}ms">
          <div class="tracked-card-body">
            <div class="tracked-card-title" title="${escapeHtml(product.title || 'Unknown Product')}">${escapeHtml(product.title || 'Unknown Product')}</div>
            <div class="tracked-card-prices">
              <span class="tracked-current-price">₹${currentPrice.toLocaleString('en-IN')}</span>
              ${product.originalPrice ? `<span class="tracked-original-price">₹${product.originalPrice.toLocaleString('en-IN')}</span>` : ''}
              ${priceChangeText ? `<span class="price-change ${priceChangeClass}">${priceChangeText}</span>` : ''}
            </div>
            <div class="tracked-chart-container">
              <canvas class="sparkline-canvas" data-prices="${sparklineData.join(',')}" width="340" height="40"></canvas>
            </div>
          </div>
          <div class="tracked-card-actions">
            <button class="icon-btn" title="Open on Amazon" onclick="openProduct('${escapeHtml(product.url || '')}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </button>
            <button class="icon-btn" title="Remove" onclick="removeTracked('${escapeHtml(product.asin || '')}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  
  // Render sparklines
  requestAnimationFrame(() => {
    container.querySelectorAll('.sparkline-canvas').forEach(drawSparkline);
  });
}

function drawSparkline(canvas) {
  const prices = canvas.dataset.prices.split(',').map(Number);
  if (prices.length < 2) return;
  
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 4;
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  
  ctx.clearRect(0, 0, w, h);
  
  // Draw gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  const isDown = prices[prices.length - 1] <= prices[0];
  
  if (isDown) {
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
  } else {
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
  }
  
  const stepX = (w - padding * 2) / (prices.length - 1);
  
  // Area fill
  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  prices.forEach((price, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((price - min) / range) * (h - padding * 2);
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(padding + (prices.length - 1) * stepX, h - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Line
  ctx.beginPath();
  prices.forEach((price, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((price - min) / range) * (h - padding * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = isDown ? '#10b981' : '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Current price dot
  const lastX = padding + (prices.length - 1) * stepX;
  const lastY = h - padding - ((prices[prices.length - 1] - min) / range) * (h - padding * 2);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = isDown ? '#10b981' : '#ef4444';
  ctx.fill();
}

// ═══════════════════════════════════════════
// Alerts
// ═══════════════════════════════════════════
function initAlerts() {
  $('#btn-clear-alerts').addEventListener('click', async () => {
    if (confirm('Clear all alerts?')) {
      await chrome.storage.local.remove('dealhawk_alerts_data');
      loadAlerts();
      showToast('All alerts cleared', 'success');
    }
  });
}

async function loadAlerts() {
  try {
    const stored = await chrome.storage.local.get('dealhawk_alerts_data');
    const alerts = stored.dealhawk_alerts_data || [];
    
    // Update badge
    const triggered = alerts.filter(a => a.triggered && !a.seen).length;
    const alertBadge = $('#alert-badge');
    if (triggered > 0) {
      alertBadge.textContent = triggered;
      alertBadge.classList.remove('hidden');
    } else {
      alertBadge.classList.add('hidden');
    }
    
    renderAlerts(alerts);
  } catch (e) {
    console.warn('DealHawk: Error loading alerts', e);
  }
}

function renderAlerts(alerts) {
  const container = $('#alerts-list');
  
  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p>No alerts yet.</p>
        <span class="hint">Track products and set target prices to receive alerts</span>
      </div>`;
    return;
  }
  
  container.innerHTML = alerts
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map((alert, i) => {
      const iconClass = alert.type === 'price-error' ? 'error' : 'drop';
      const timeAgo = getTimeAgo(alert.timestamp);
      
      return `
        <div class="alert-card ${alert.triggered ? 'triggered' : ''}" style="animation-delay: ${i * 60}ms">
          <div class="alert-icon ${iconClass}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${alert.type === 'price-error' 
                ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                : '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'}
            </svg>
          </div>
          <div class="alert-card-body">
            <div class="alert-card-title">${escapeHtml(alert.title || 'Price Alert')}</div>
            <div class="alert-card-desc">${escapeHtml(alert.description || '')}</div>
            <div class="alert-card-time">${timeAgo}</div>
          </div>
        </div>`;
    }).join('');
  
  // Mark alerts as seen
  markAlertsSeen(alerts);
}

async function markAlertsSeen(alerts) {
  const updated = alerts.map(a => ({ ...a, seen: true }));
  await chrome.storage.local.set({ dealhawk_alerts_data: updated });
}

// ═══════════════════════════════════════════
// Data Export / Import
// ═══════════════════════════════════════════
function initExportImport() {
  $('#btn-export-data').addEventListener('click', exportData);
  $('#btn-import-data').addEventListener('click', () => {
    $('#import-file-input').click();
  });
  $('#import-file-input').addEventListener('change', importData);
}

async function exportData() {
  try {
    const data = await chrome.storage.local.get(null);
    const exportObj = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {}
    };
    
    // Only export DealHawk data
    Object.keys(data).forEach(key => {
      if (key.startsWith('dealhawk_')) {
        exportObj.data[key] = data[key];
      }
    });
    
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealhawk-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importObj = JSON.parse(text);
    
    if (!importObj.version || !importObj.data) {
      throw new Error('Invalid backup file format');
    }
    
    const confirmed = confirm(`Import ${Object.keys(importObj.data).length} data entries from backup dated ${importObj.exportDate}? This will merge with existing data.`);
    if (!confirmed) return;
    
    await chrome.storage.local.set(importObj.data);
    
    loadTrackerData();
    loadAlerts();
    showToast('Data imported successfully', 'success');
  } catch (e) {
    showToast('Import failed: ' + e.message, 'error');
  }
  
  e.target.value = '';
}

// ═══════════════════════════════════════════
// Global Functions (accessible from onclick)
// ═══════════════════════════════════════════
window.openProduct = function(url) {
  if (url) chrome.tabs.create({ url });
};

window.removeTracked = async function(asin) {
  if (!asin || !confirm('Remove this product from tracking?')) return;
  
  try {
    const stored = await chrome.storage.local.get('dealhawk_tracked');
    const tracked = stored.dealhawk_tracked || {};
    delete tracked[asin];
    await chrome.storage.local.set({ dealhawk_tracked: tracked });
    loadTrackerData();
    showToast('Product removed', 'success');
  } catch (e) {
    showToast('Failed to remove: ' + e.message, 'error');
  }
};

// ═══════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-IN');
}

function showToast(message, type = 'success') {
  let container = $('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${type === 'success' ? '#10b981' : '#ef4444'}" stroke-width="2">
      ${type === 'success'
        ? '<polyline points="20 6 9 17 4 12"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
    </svg>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
