// HighP Event-Driven Browser Telemetry Companion (Manifest V3 Service Worker)
// Detects active tab events instantaneously with zero stale caching. NEVER captures passwords, forms, or search queries.

const AGENT_PORT = 41789;
const AGENT_URL = `http://127.0.0.1:${AGENT_PORT}/api/browser/activity`;

let cachedBrowserName = null;

function normalizeDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    let host = (parsed.hostname || '').toLowerCase().trim();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    if (host.includes(':')) {
      host = host.split(':')[0];
    }
    return host || null;
  } catch {
    return null;
  }
}

function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '';
  }
}

async function detectBrowser() {
  if (cachedBrowserName) return cachedBrowserName;
  try {
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

async function transmitEvent(eventType, tabData) {
  const browser = await detectBrowser();
  const now = new Date().toISOString();

  const payload = {
    eventType,
    browser,
    active: tabData?.active ?? false,
    windowId: tabData?.windowId ?? 0,
    tabId: tabData?.tabId ?? 0,
    domain: tabData?.domain ?? null,
    url: tabData?.url ?? '',
    title: tabData?.title ?? '',
    timestamp: now
  };

  try {
    const res = await fetch(AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HighP-Extension': '2.0.0'
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      chrome.storage.local.set({
        agentConnected: true,
        lastReportedAt: now,
        lastDomain: payload.domain
      });
    }
  } catch {
    chrome.storage.local.set({ agentConnected: false });
  }
}

async function inspectAndReport(eventType = 'HEARTBEAT') {
  try {
    const lastWin = await chrome.windows.getLastFocused({ populate: false });
    if (!lastWin || !lastWin.focused) {
      // Browser window is unfocused / blurred
      await transmitEvent('WINDOW_BLURRED', { active: false });
      return;
    }

    const [activeTab] = await chrome.tabs.query({ active: true, windowId: lastWin.id });
    if (!activeTab || !activeTab.url) {
      await transmitEvent('NO_ACTIVE_TAB', { active: false, windowId: lastWin.id });
      return;
    }

    const domain = normalizeDomain(activeTab.url);
    if (!domain) {
      await transmitEvent('INTERNAL_PAGE', { active: false, windowId: lastWin.id, tabId: activeTab.id });
      return;
    }

    await transmitEvent(eventType, {
      active: true,
      windowId: activeTab.windowId,
      tabId: activeTab.id,
      domain,
      url: sanitizeUrl(activeTab.url),
      title: (activeTab.title || domain).slice(0, 300)
    });
  } catch {}
}

// 1. Instant Tab Activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const win = await chrome.windows.get(activeInfo.windowId);
    if (win && win.focused && tab && tab.url) {
      const domain = normalizeDomain(tab.url);
      if (domain) {
        await transmitEvent('TAB_ACTIVATED', {
          active: true,
          windowId: tab.windowId,
          tabId: tab.id,
          domain,
          url: sanitizeUrl(tab.url),
          title: (tab.title || domain).slice(0, 300)
        });
        return;
      }
    }
  } catch {}
  await inspectAndReport('TAB_ACTIVATED');
});

// 2. Instant Navigation / URL updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
    const domain = normalizeDomain(tab.url);
    if (domain) {
      await transmitEvent('NAVIGATED', {
        active: true,
        windowId: tab.windowId,
        tabId: tab.id,
        domain,
        url: sanitizeUrl(tab.url),
        title: (tab.title || domain).slice(0, 300)
      });
    }
  }
});

// 3. Window Focus / Blur Changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await transmitEvent('WINDOW_BLURRED', { active: false });
  } else {
    await inspectAndReport('WINDOW_FOCUSED');
  }
});

// 4. Tab Removed / Closed
chrome.tabs.onRemoved.addListener(async (_tabId, removeInfo) => {
  if (removeInfo.isWindowClosing) {
    await transmitEvent('WINDOW_BLURRED', { active: false });
  } else {
    await inspectAndReport('TAB_REMOVED');
  }
});

// 5. Periodic Heartbeat (every 5 seconds) as liveness health-check only
setInterval(async () => {
  await inspectAndReport('HEARTBEAT');
}, 5000);

// Initial broadcast on start
inspectAndReport('STARTUP');
