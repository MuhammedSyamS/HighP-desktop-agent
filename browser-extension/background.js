// HighP Privacy-Safe Active Website Tracker (Manifest V3 Service Worker)
// Detects ONLY the active tab's domain. NEVER captures URLs, passwords, form fields, or search history.

const AGENT_PORT = 41789;
const AGENT_URL = `http://127.0.0.1:${AGENT_PORT}/api/browser/activity`;

let currentDomain = null;
let currentTabActivatedAt = new Date().toISOString();
let cachedBrowserName = null;

/**
 * Strict Privacy-Safe Domain Normalization (Section 8)
 * Strips protocol, www., paths, query strings, hashes, credentials, and ports.
 * Returns only the clean root hostname (e.g., 'notion.so', 'github.com').
 */
function normalizeDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    // Ignore internal browser pages and local resources
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    let host = (parsed.hostname || '').toLowerCase().trim();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    // Remove port if present
    if (host.includes(':')) {
      host = host.split(':')[0];
    }
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Identify the running browser (Brave, Chrome, Edge)
 */
async function detectBrowser() {
  if (cachedBrowserName) return cachedBrowserName;
  try {
    // Brave Detection
    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
      const isBrave = await navigator.brave.isBrave();
      if (isBrave) {
        cachedBrowserName = 'Brave';
        return 'Brave';
      }
    }
    const ua = navigator.userAgent || '';
    if (ua.includes('Edg/')) {
      cachedBrowserName = 'Microsoft Edge';
      return 'Microsoft Edge';
    }
    if (ua.includes('Chrome/')) {
      cachedBrowserName = 'Google Chrome';
      return 'Google Chrome';
    }
  } catch {}
  cachedBrowserName = 'Browser';
  return cachedBrowserName;
}

/**
 * Transmit active domain to the local HighP Desktop Agent
 */
async function reportActiveWebsite(domain) {
  if (!domain) return;
  const browser = await detectBrowser();
  const now = new Date().toISOString();

  const payload = {
    browser,
    domain,
    tabActivatedAt: currentTabActivatedAt,
    timestamp: now
  };

  try {
    const response = await fetch(AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HighP-Extension': '1.0.0'
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      chrome.storage.local.set({
        lastReportedDomain: domain,
        lastReportedAt: now,
        agentConnected: true
      });
    }
  } catch (err) {
    // Desktop agent may be temporarily stopped or not running; fail silently
    chrome.storage.local.set({ agentConnected: false });
  }
}

/**
 * Inspect active tab in focused window
 */
async function inspectActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url) return;

    const domain = normalizeDomain(tab.url);
    if (!domain) return;

    if (domain !== currentDomain) {
      currentDomain = domain;
      currentTabActivatedAt = new Date().toISOString();
      await reportActiveWebsite(domain);
    }
  } catch {}
}

// 1. Tab switched by user
chrome.tabs.onActivated.addListener(async () => {
  currentTabActivatedAt = new Date().toISOString();
  await inspectActiveTab();
});

// 2. Active tab navigated to a new URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
    await inspectActiveTab();
  }
});

// 3. Browser window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    await inspectActiveTab();
  }
});

// 4. Periodic keep-alive tick (every 10 seconds) to keep local agent updated
setInterval(async () => {
  if (currentDomain) {
    await reportActiveWebsite(currentDomain);
  } else {
    await inspectActiveTab();
  }
}, 10000);

// Initial check on load
inspectActiveTab();
