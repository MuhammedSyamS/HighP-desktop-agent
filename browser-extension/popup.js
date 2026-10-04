document.addEventListener('DOMContentLoaded', async () => {
  const domainEl = document.getElementById('domainVal');
  const agentStatusEl = document.getElementById('agentStatus');

  // Helper to extract clean domain
  function extractDomain(url) {
    if (!url) return null;
    try {
      const p = new URL(url);
      if (!['http:', 'https:'].includes(p.protocol)) return null;
      let host = (p.hostname || '').toLowerCase();
      if (host.startsWith('www.')) host = host.slice(4);
      return host || null;
    } catch {
      return null;
    }
  }

  // 1. Show cached state first
  chrome.storage.local.get(['lastReportedDomain', 'agentConnected'], (result) => {
    if (domainEl && result.lastReportedDomain) {
      domainEl.textContent = result.lastReportedDomain;
    }
    if (agentStatusEl && result.agentConnected !== undefined) {
      if (result.agentConnected) {
        agentStatusEl.innerHTML = '<span class="dot" style="background: #22c55e;"></span>Connected';
        agentStatusEl.style.color = '#22c55e';
      } else {
        agentStatusEl.innerHTML = '<span class="dot" style="background: #ef4444;"></span>Disconnected';
        agentStatusEl.style.color = '#ef4444';
      }
    }
  });

  // 2. Query active tab in the current window
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const domain = extractDomain(tab.url);
      if (domain && domainEl) {
        domainEl.textContent = domain;
      } else if (!domain && domainEl) {
        domainEl.textContent = 'None (Browser settings or blank page)';
      }
    }
  } catch {}

  // 3. Live ping Desktop Agent health on localhost:41789
  try {
    const res = await fetch('http://127.0.0.1:41789/api/browser/health', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (agentStatusEl) {
        agentStatusEl.innerHTML = '<span class="dot" style="background: #22c55e;"></span>Connected';
        agentStatusEl.style.color = '#22c55e';
      }
      if (data.domain && domainEl) {
        domainEl.textContent = data.domain;
      }
      chrome.storage.local.set({ agentConnected: true });
    } else {
      throw new Error('Not ok');
    }
  } catch {
    if (agentStatusEl) {
      agentStatusEl.innerHTML = '<span class="dot" style="background: #ef4444;"></span>Disconnected';
      agentStatusEl.style.color = '#ef4444';
    }
    chrome.storage.local.set({ agentConnected: false });
  }
});

