// HighP Desktop Agent UI Controller
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');

const connectionStatus = document.getElementById('connectionStatus');
const connectionText = document.getElementById('connectionText');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userCompany = document.getElementById('userCompany');
const logoutBtn = document.getElementById('logoutBtn');

const statusBadge = document.getElementById('statusBadge');
const currentAppName = document.getElementById('currentAppName');
const appIcon = document.getElementById('appIcon');
const appCategoryBadge = document.getElementById('appCategoryBadge');
const appProcessTag = document.getElementById('appProcessTag');

// Website Tracking Elements
const activeWebsiteBox = document.getElementById('activeWebsiteBox');
const currentWebDomain = document.getElementById('currentWebDomain');
const currentWebTitle = document.getElementById('currentWebTitle');
const webTrackingSourceBadge = document.getElementById('webTrackingSourceBadge');

// Timers
const activeTimer = document.getElementById('activeTimer');
const idleTimer = document.getElementById('idleTimer');
const breakTimer = document.getElementById('breakTimer');

// Action Controls
const startWorkBtn = document.getElementById('startWorkBtn');
const endWorkBtn = document.getElementById('endWorkBtn');
const breakControls = document.getElementById('breakControls');
const breakReasonSelect = document.getElementById('breakReasonSelect');
const startBreakBtn = document.getElementById('startBreakBtn');
const endBreakBtn = document.getElementById('endBreakBtn');

// Extension Card Elements
const extLivePill = document.getElementById('extLivePill');
const copyExtPathBtn = document.getElementById('copyExtPathBtn');
const openExtFolderBtn = document.getElementById('openExtFolderBtn');
const extFolderStatus = document.getElementById('extFolderStatus');

// Diagnostics & Accordion Elements
const diagToggleBtn = document.getElementById('diagToggleBtn');
const diagContent = document.getElementById('diagContent');
const diagPlatformBadge = document.getElementById('diagPlatformBadge');
const diagPlatform = document.getElementById('diagPlatform');
const diagArch = document.getElementById('diagArch');
const diagVersion = document.getElementById('diagVersion');
const diagProvider = document.getElementById('diagProvider');
const diagBrowserBridge = document.getElementById('diagBrowserBridge');
const permissionWarningBanner = document.getElementById('permissionWarningBanner');
const permissionWarningText = document.getElementById('permissionWarningText');
const capForeground = document.getElementById('capForeground');
const capWindowId = document.getElementById('capWindowId');
const capWindowTitle = document.getElementById('capWindowTitle');
const capIdle = document.getElementById('capIdle');
const capLock = document.getElementById('capLock');
const capSleep = document.getElementById('capSleep');
const capBrowser = document.getElementById('capBrowser');

const diagConn = document.getElementById('diagConn');
const diagServer = document.getElementById('diagServer');
const diagDevice = document.getElementById('diagDevice');
const diagSession = document.getElementById('diagSession');
const diagApp = document.getElementById('diagApp');
const diagWeb = document.getElementById('diagWeb');
const diagQueue = document.getElementById('diagQueue');
const diagSync = document.getElementById('diagSync');
const diagHeartbeat = document.getElementById('diagHeartbeat');
const diagSyncPill = document.getElementById('diagSyncPill');
const telemetryErrorAlert = document.getElementById('telemetryErrorAlert');
const telemetryErrorText = document.getElementById('telemetryErrorText');
const offlineQueueBar = document.getElementById('offlineQueueBar');
const queueCount = document.getElementById('queueCount');

function renderCapabilityTag(el, status) {
  if (!el) return;
  el.className = 'cap-tag';
  if (status === 'SUPPORTED' || status === 'YES') {
    el.classList.add('pass');
    el.textContent = 'YES';
  } else if (status === 'PARTIALLY_SUPPORTED' || status === 'LIMITED') {
    el.classList.add('limited');
    el.textContent = 'LIMITED';
  } else if (status === 'REQUIRES_PERMISSION') {
    el.classList.add('perm');
    el.textContent = 'PERM REQ';
  } else {
    el.classList.add('unsupported');
    el.textContent = 'NO';
  }
}

function formatSeconds(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;
  return [h, m, remSec].map((v) => String(v).padStart(2, '0')).join(':');
}

function resolveAppIcon(appName = '', category = '') {
  const lower = appName.toLowerCase();
  const catLower = category.toLowerCase();

  if (lower.includes('chrome') || lower.includes('edge') || lower.includes('firefox') || lower.includes('brave') || lower.includes('opera') || lower.includes('safari') || lower.includes('vivaldi') || catLower === 'browsers') {
    return '🌐';
  }
  if (lower.includes('code') || lower.includes('cursor') || lower.includes('antigravity') || lower.includes('studio') || lower.includes('intellij') || lower.includes('webstorm') || lower.includes('pycharm') || catLower === 'development') {
    return '💻';
  }
  if (lower.includes('terminal') || lower.includes('powershell') || lower.includes('cmd') || lower.includes('bash') || lower.includes('git')) {
    return '📟';
  }
  if (lower.includes('slack') || lower.includes('teams') || lower.includes('discord') || lower.includes('zoom') || lower.includes('whatsapp') || lower.includes('telegram') || catLower === 'communication') {
    return '💬';
  }
  if (lower.includes('figma') || lower.includes('canva') || lower.includes('photoshop') || lower.includes('illustrator') || lower.includes('paint') || catLower === 'design') {
    return '🎨';
  }
  if (lower.includes('word') || lower.includes('excel') || lower.includes('powerpoint') || lower.includes('notion') || lower.includes('obsidian') || lower.includes('notepad') || catLower === 'productivity') {
    return '📝';
  }
  if (lower.includes('spotify') || lower.includes('vlc') || catLower === 'media') {
    return '🎵';
  }
  if (lower.includes('settings') || lower.includes('task manager') || lower.includes('desktop') || catLower === 'system') {
    return '⚙️';
  }
  return '🖥️';
}

function updateUI(state) {
  if (!state) return;

  if (state.isLoggedIn) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');

    userName.textContent = state.employeeName || state.userEmail || 'Employee';
    userAvatar.textContent = (state.employeeName || state.userEmail || 'E').charAt(0).toUpperCase();
    userCompany.textContent = `${state.companyName || 'Workforce'} • ${state.deviceId ? state.deviceId.slice(0, 12) : 'Registered'}`;

    // Connection Pill
    if (state.isOnline) {
      connectionStatus.className = 'connection-pill online';
      if (connectionText) connectionText.textContent = 'Online';
    } else {
      connectionStatus.className = 'connection-pill offline';
      if (connectionText) connectionText.textContent = 'Offline (Queued)';
    }

    // Status Badge
    const statusText = state.currentStatus || 'OFFLINE';
    statusBadge.textContent = statusText;
    statusBadge.className = `status-badge status-${statusText.toLowerCase()}`;

    // Active Application details
    const appInfo = state.currentApplicationInfo;
    let displayName = 'None';
    let categoryName = 'General';
    let processText = '';

    if (!state.isWorking) {
      displayName = 'Session not active';
      categoryName = 'Inactive';
      processText = 'Click "Start Work Session" below';
      if (appIcon) appIcon.textContent = '⏸️';
    } else if (state.isOnBreak) {
      displayName = 'On Break';
      categoryName = 'Break';
      processText = 'Session timer paused';
      if (appIcon) appIcon.textContent = '☕';
    } else if (state.currentStatus === 'IDLE') {
      displayName = 'System Idle';
      categoryName = 'Idle';
      processText = 'No physical keyboard/mouse activity';
      if (appIcon) appIcon.textContent = '⏳';
    } else if (state.currentApplication && state.currentApplication !== 'None') {
      displayName = state.currentApplication;
      categoryName = appInfo?.category || 'General';
      processText = appInfo?.executableName ? `${appInfo.executableName}${appInfo.processId ? ` (PID: ${appInfo.processId})` : ''}` : '';
      if (appIcon) appIcon.textContent = resolveAppIcon(displayName, categoryName);
    } else {
      displayName = 'Analyzing active window...';
      categoryName = 'Detecting';
      if (appIcon) appIcon.textContent = '💻';
    }

    if (currentAppName) currentAppName.textContent = displayName;
    if (appCategoryBadge) appCategoryBadge.textContent = categoryName;
    if (appProcessTag) appProcessTag.textContent = processText || displayName;

    // Active Website Box (The Core UX Fix)
    const hasWebsite = Boolean(state.currentWebsite && state.currentWebsite.domain);
    const isBrowserApp = Boolean(state.isBrowserActive || (displayName && (displayName.includes('Chrome') || displayName.includes('Edge') || displayName.includes('Brave') || displayName.includes('Firefox') || displayName.includes('Opera'))));

    if (state.isWorking && !state.isOnBreak && (hasWebsite || isBrowserApp)) {
      if (activeWebsiteBox) activeWebsiteBox.classList.remove('hidden');

      if (hasWebsite && state.currentWebsite) {
        if (currentWebDomain) currentWebDomain.textContent = state.currentWebsite.domain;
        if (currentWebTitle) {
          currentWebTitle.textContent = state.currentWebsite.title || state.currentWebsite.domain;
          currentWebTitle.classList.remove('hidden');
        }
        if (webTrackingSourceBadge) {
          webTrackingSourceBadge.textContent = state.browserBridgeConnected ? 'Companion Extension Verified' : 'Smart Title Resolution';
        }
      } else {
        // Browser active but awaiting extension ping
        if (currentWebDomain) currentWebDomain.textContent = `${displayName} Active`;
        if (currentWebTitle) {
          currentWebTitle.textContent = state.browserBridgeConnected ? 'Navigating web pages...' : 'Companion extension standby';
        }
        if (webTrackingSourceBadge) {
          webTrackingSourceBadge.textContent = state.browserBridgeConnected ? 'Browser Active' : 'Extension Ready';
        }
      }
    } else {
      if (activeWebsiteBox) activeWebsiteBox.classList.add('hidden');
    }

    // Companion Extension Status Pill
    if (extLivePill) {
      if (state.browserBridgeConnected) {
        extLivePill.className = 'ext-live-pill connected';
        extLivePill.textContent = '🟢 Connected & Streaming';
      } else {
        extLivePill.className = 'ext-live-pill waiting';
        extLivePill.textContent = '🟡 Standby / Unloaded';
      }
    }

    // Timers
    if (activeTimer) activeTimer.textContent = formatSeconds(state.activeSeconds || 0);
    if (idleTimer) idleTimer.textContent = formatSeconds(state.idleSeconds || 0);
    if (breakTimer) breakTimer.textContent = formatSeconds(state.breakSeconds || 0);

    // Primary Action Controls
    if (state.isWorking) {
      startWorkBtn.classList.add('hidden');
      endWorkBtn.classList.remove('hidden');
      breakControls.classList.remove('hidden');

      if (state.isOnBreak) {
        startBreakBtn.classList.add('hidden');
        breakReasonSelect.classList.add('hidden');
        endBreakBtn.classList.remove('hidden');
      } else {
        startBreakBtn.classList.remove('hidden');
        breakReasonSelect.classList.remove('hidden');
        endBreakBtn.classList.add('hidden');
      }
    } else {
      startWorkBtn.classList.remove('hidden');
      endWorkBtn.classList.add('hidden');
      breakControls.classList.add('hidden');
    }

    // Diagnostics Elements
    const platformDisplay = state.platform === 'win32' ? 'Windows' : (state.platform === 'darwin' ? 'macOS' : (state.platform === 'linux' ? 'Linux' : (state.platform || 'Desktop')));
    const archDisplay = state.architecture || 'x64';
    if (diagPlatformBadge) diagPlatformBadge.textContent = `${platformDisplay} (${archDisplay})`;
    if (diagPlatform) diagPlatform.textContent = platformDisplay;
    if (diagArch) diagArch.textContent = archDisplay;
    if (diagVersion) diagVersion.textContent = '2.0.0';

    if (diagProvider) {
      if (state.platform === 'win32') {
        diagProvider.textContent = state.health?.nativeTelemetryConnected ? 'Active (Win32 Hook)' : 'Active (Polling Fallback)';
      } else {
        diagProvider.textContent = 'Active (Native Provider)';
      }
    }

    if (diagBrowserBridge) {
      diagBrowserBridge.textContent = state.browserBridgeConnected ? 'Streaming (127.0.0.1:41789)' : 'Listening (127.0.0.1:41789)';
    }

    if (diagConn) diagConn.textContent = state.isOnline ? 'Online' : 'Offline (Queuing)';
    if (diagServer) diagServer.textContent = state.isOnline ? 'Reachable' : 'Unreachable';
    if (diagDevice) diagDevice.textContent = state.deviceId ? `Registered (${state.deviceId.slice(0, 8)}...)` : 'Unregistered';
    if (diagSession) diagSession.textContent = state.sessionId ? `Active (${state.sessionId.slice(0, 8)}...)` : 'No Active Session';
    if (diagApp) diagApp.textContent = displayName;
    if (diagWeb) diagWeb.textContent = state.currentWebsite?.domain || 'None';
    if (diagQueue) diagQueue.textContent = state.queuedEventsCount ? `QUEUED (${state.queuedEventsCount})` : 'HEALTHY (0)';
    if (diagSync) diagSync.textContent = state.lastSyncTime || 'Pending';
    if (diagHeartbeat) diagHeartbeat.textContent = state.lastHeartbeatTime || 'Pending';

    if (diagSyncPill) {
      if ((state.queuedEventsCount || 0) > 0) {
        diagSyncPill.className = 'sync-pill queuing';
        diagSyncPill.textContent = `${state.queuedEventsCount} Queued`;
      } else {
        diagSyncPill.className = 'sync-pill synced';
        diagSyncPill.textContent = 'Synced';
      }
    }

    // Capability Matrix
    const caps = state.capabilities || {};
    renderCapabilityTag(capForeground, caps.foregroundApplication || 'YES');
    renderCapabilityTag(capWindowId, caps.windowIdentity || 'YES');
    renderCapabilityTag(capWindowTitle, caps.windowTitle || 'YES');
    renderCapabilityTag(capIdle, caps.idleDetection || 'YES');
    renderCapabilityTag(capLock, caps.lockDetection || 'YES');
    renderCapabilityTag(capSleep, caps.sleepDetection || 'YES');
    renderCapabilityTag(capBrowser, caps.browserTracking || 'YES');

    // Telemetry Error Alert
    if (state.telemetryError) {
      telemetryErrorAlert.classList.remove('hidden');
      telemetryErrorText.textContent = state.telemetryError;
    } else {
      telemetryErrorAlert.classList.add('hidden');
    }

    // Offline Queue Bar
    if (state.queuedEventsCount > 0) {
      offlineQueueBar.classList.remove('hidden');
      queueCount.textContent = state.queuedEventsCount;
    } else {
      offlineQueueBar.classList.add('hidden');
    }
  } else {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

// Diagnostics Accordion Toggle
if (diagToggleBtn && diagContent) {
  diagToggleBtn.addEventListener('click', () => {
    const isExpanded = diagToggleBtn.getAttribute('aria-expanded') === 'true';
    diagToggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    if (isExpanded) {
      diagContent.classList.add('hidden');
    } else {
      diagContent.classList.remove('hidden');
    }
  });
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  if (loginBtnText) loginBtnText.textContent = 'Connecting...';

  const apiUrl = (document.getElementById('apiUrl').value || '').trim() || 'https://highp-agent-backend.onrender.com';
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;

  try {
    const success = await window.agentApi.login(apiUrl, email, pass);
    if (success) {
      localStorage.setItem('agent_api_url', apiUrl);
      localStorage.setItem('agent_email', email);
      localStorage.setItem('agent_pass', pass);
      await window.agentApi.startWork();
    } else {
      loginError.textContent = 'Invalid credentials or login failed.';
    }
  } catch (err) {
    loginError.textContent = err.response?.data?.message || err.message || 'Connection error';
  } finally {
    loginBtn.disabled = false;
    if (loginBtnText) loginBtnText.textContent = 'Sign In & Connect';
  }
});

logoutBtn.addEventListener('click', async () => {
  await window.agentApi.logout();
  localStorage.removeItem('agent_email');
  localStorage.removeItem('agent_pass');
});

startWorkBtn.addEventListener('click', async () => {
  await window.agentApi.startWork();
});

endWorkBtn.addEventListener('click', async () => {
  await window.agentApi.endWork();
});

startBreakBtn.addEventListener('click', async () => {
  const reason = breakReasonSelect.value;
  await window.agentApi.startBreak(reason);
});

endBreakBtn.addEventListener('click', async () => {
  await window.agentApi.endBreak();
});

// Extension Helpers
if (openExtFolderBtn) {
  openExtFolderBtn.addEventListener('click', async () => {
    try {
      const res = await window.agentApi.openExtensionFolder();
      if (extFolderStatus) {
        extFolderStatus.textContent = '✅ Extension folder opened in Explorer!';
        extFolderStatus.classList.remove('hidden');
        setTimeout(() => extFolderStatus.classList.add('hidden'), 5000);
      }
    } catch (err) {
      if (extFolderStatus) {
        extFolderStatus.textContent = '❌ Failed to open folder: ' + err.message;
        extFolderStatus.classList.remove('hidden');
      }
    }
  });
}

if (copyExtPathBtn) {
  copyExtPathBtn.addEventListener('click', async () => {
    try {
      if (window.agentApi.getExtensionPath) {
        const res = await window.agentApi.getExtensionPath();
        if (res.path) {
          await navigator.clipboard.writeText(res.path);
          if (extFolderStatus) {
            extFolderStatus.textContent = `📋 Path copied: ${res.path}`;
            extFolderStatus.classList.remove('hidden');
            setTimeout(() => extFolderStatus.classList.add('hidden'), 5000);
          }
          return;
        }
      }
      await navigator.clipboard.writeText('browser-extension');
      if (extFolderStatus) {
        extFolderStatus.textContent = '📋 Extension name copied!';
        extFolderStatus.classList.remove('hidden');
        setTimeout(() => extFolderStatus.classList.add('hidden'), 4000);
      }
    } catch (err) {
      if (extFolderStatus) {
        extFolderStatus.textContent = '❌ Could not copy path: ' + err.message;
        extFolderStatus.classList.remove('hidden');
      }
    }
  });
}

// Subscribe to state updates from main process
if (window.agentApi && window.agentApi.onStateUpdate) {
  window.agentApi.onStateUpdate((state) => {
    updateUI(state);
  });

  // Initial State Query
  window.agentApi.getState().then((state) => {
    updateUI(state);
  });
}

// Auto-start work on application launch
window.addEventListener('DOMContentLoaded', async () => {
  const defaultUrl = localStorage.getItem('agent_api_url') || 'https://highp-agent-backend.onrender.com';
  const defaultEmail = localStorage.getItem('agent_email') || 'shamsaifudheen@gmail.com';
  const defaultPass = localStorage.getItem('agent_pass') || 'Password@123';

  const apiInput = document.getElementById('apiUrl');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');

  if (apiInput) apiInput.value = defaultUrl;
  if (emailInput) emailInput.value = defaultEmail;
  if (passInput) passInput.value = defaultPass;

  try {
    const success = await window.agentApi.login(defaultUrl, defaultEmail, defaultPass);
    if (success) {
      await window.agentApi.startWork();
      console.log('[DesktopAgent] Auto-started work successfully for', defaultEmail);
    }
  } catch (err) {
    console.warn('[DesktopAgent] Auto-start bypassed:', err.message);
  }
});
