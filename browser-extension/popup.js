document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastReportedDomain', 'agentConnected'], (result) => {
    const domainEl = document.getElementById('domainVal');
    const agentStatusEl = document.getElementById('agentStatus');

    if (domainEl) {
      domainEl.textContent = result.lastReportedDomain || 'None (No active tab)';
    }

    if (agentStatusEl) {
      if (result.agentConnected === false) {
        agentStatusEl.innerHTML = '<span class="dot" style="background: #ef4444;"></span>Disconnected';
        agentStatusEl.style.color = '#ef4444';
      } else {
        agentStatusEl.innerHTML = '<span class="dot" style="background: #22c55e;"></span>Connected';
        agentStatusEl.style.color = '#22c55e';
      }
    }
  });
});
