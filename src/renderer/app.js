const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

const connectionStatus = document.getElementById('connectionStatus');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userCompany = document.getElementById('userCompany');
const logoutBtn = document.getElementById('logoutBtn');

const statusBadge = document.getElementById('statusBadge');
const currentAppName = document.getElementById('currentAppName');
const activeTimer = document.getElementById('activeTimer');
const idleTimer = document.getElementById('idleTimer');
const breakTimer = document.getElementById('breakTimer');

const startWorkBtn = document.getElementById('startWorkBtn');
const endWorkBtn = document.getElementById('endWorkBtn');
const breakControls = document.getElementById('breakControls');
const breakReasonSelect = document.getElementById('breakReasonSelect');
const startBreakBtn = document.getElementById('startBreakBtn');
const endBreakBtn = document.getElementById('endBreakBtn');

const offlineQueueBar = document.getElementById('offlineQueueBar');
const queueCount = document.getElementById('queueCount');

// Diagnostics elements
const diagPlatformBadge = document.getElementById('diagPlatformBadge');
const diagPlatform = document.getElementById('diagPlatform');
const diagArch = document.getElementById('diagArch');
const diagVersion = document.getElementById('diagVersion');
const diagProvider = document.getElementById('diagProvider');
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
const diagStatus = document.getElementById('diagStatus');
const diagQueue = document.getElementById('diagQueue');
const diagSync = document.getElementById('diagSync');
const diagHeartbeat = document.getElementById('diagHeartbeat');
const diagSyncPill = document.getElementById('diagSyncPill');
const telemetryErrorAlert = document.getElementById('telemetryErrorAlert');
const telemetryErrorText = document.getElementById('telemetryErrorText');

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
    el.textContent = 'REQUIRES PERMISSION';
  } else {
    el.classList.add('unsupported');
    el.textContent = 'UNSUPPORTED';
  }
}

function formatSeconds(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function updateUI(state) {
  if (!state) return;

  if (state.isLoggedIn) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');

    userName.textContent = state.employeeName || state.userEmail || 'Employee';
    userAvatar.textContent = (state.employeeName || 'E').charAt(0).toUpperCase();
    userCompany.textContent = `${state.companyName || 'Company'} • ${state.deviceId || 'PC'}`;

    // Connection Pill
    if (state.isOnline) {
      connectionStatus.className = 'connection-pill online';
      connectionStatus.innerHTML = '<span class="dot"></span> Online';
    } else {
      connectionStatus.className = 'connection-pill offline';
      connectionStatus.innerHTML = '<span class="dot"></span> Offline (Queuing)';
    }

    // Status Badge
    statusBadge.textContent = state.currentStatus;
    statusBadge.className = `status-badge status-${state.currentStatus.toLowerCase()}`;

    // App Name - Truthful, never fake "System / Desktop"
    if (!state.isWorking) {
      currentAppName.textContent = 'Session not active';
    } else if (state.isOnBreak) {
      currentAppName.textContent = 'On Break';
    } else if (state.currentApplication) {
      currentAppName.textContent = state.currentApplication;
    } else {
      currentAppName.textContent = 'Telemetry unavailable';
    }

    // Diagnostics Panel (Requirements #5 & #20)
    const platformDisplay = state.platform === 'win32' ? 'Windows' : (state.platform === 'darwin' ? 'macOS' : (state.platform === 'linux' ? 'Linux' : (state.platform || 'Desktop')));
    const archDisplay = state.architecture || 'x64';
    if (diagPlatformBadge) diagPlatformBadge.textContent = `${platformDisplay} (${archDisplay})`;
    if (diagPlatform) diagPlatform.textContent = platformDisplay;
    if (diagArch) diagArch.textContent = archDisplay;
    if (diagProvider) {
      if (state.platform === 'win32') {
        diagProvider.textContent = state.health?.nativeTelemetryConnected ? 'Connected (Win32 Hook)' : 'Standby / Polling';
      } else if (state.platform === 'darwin') {
        diagProvider.textContent = 'Active (NSWorkspace / ioreg)';
      } else {
        diagProvider.textContent = 'Active (X11 / Wayland)';
      }
    }

    // Permission Warnings (e.g. macOS Accessibility or Linux Wayland)
    const perms = state.permissions || {};
    const hasPermissionIssue = perms.accessibility === 'DENIED' || perms.accessibility === 'REQUIRES_PERMISSION';
    if (permissionWarningBanner) {
      if (hasPermissionIssue) {
        permissionWarningBanner.classList.remove('hidden');
        if (permissionWarningText) {
          permissionWarningText.textContent = state.platform === 'darwin'
            ? 'macOS Accessibility permission is required to detect window titles. Enable in System Settings > Privacy & Security > Accessibility.'
            : 'Wayland security isolation restricts window title inspection. Wayland titles will display as unsupported.';
        }
      } else {
        permissionWarningBanner.classList.add('hidden');
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

    if (diagConn) diagConn.textContent = state.isOnline ? 'Connected' : 'Disconnected (Offline)';
    if (diagServer) diagServer.textContent = state.isOnline ? 'Reachable' : 'Unreachable';
    if (diagDevice) diagDevice.textContent = state.deviceId ? `Registered (${state.deviceId.slice(0, 8)}...)` : 'Unregistered';
    if (diagSession) diagSession.textContent = state.sessionId ? `Active (${state.sessionId.slice(0, 8)}...)` : 'No Active Session';
    if (diagApp) diagApp.textContent = state.currentApplication || 'None';
    if (diagStatus) diagStatus.textContent = state.currentStatus;
    if (diagQueue) diagQueue.textContent = state.queuedEventsCount ? `QUEUING (${state.queuedEventsCount})` : 'HEALTHY (0)';
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

    // Error Alert
    if (state.telemetryError) {
      telemetryErrorAlert.classList.remove('hidden');
      telemetryErrorText.textContent = state.telemetryError;
    } else {
      telemetryErrorAlert.classList.add('hidden');
    }

    // Timers
    activeTimer.textContent = formatSeconds(state.activeSeconds || 0);
    idleTimer.textContent = formatSeconds(state.idleSeconds || 0);
    breakTimer.textContent = formatSeconds(state.breakSeconds || 0);

    // Controls
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

    // Queue Indicator
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

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
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

const openExtFolderBtn = document.getElementById('openExtFolderBtn');
const extFolderStatus = document.getElementById('extFolderStatus');
if (openExtFolderBtn) {
  openExtFolderBtn.addEventListener('click', async () => {
    try {
      const res = await window.agentApi.openExtensionFolder();
      if (extFolderStatus) {
        extFolderStatus.textContent = '✅ Extension folder opened in Explorer!';
        extFolderStatus.classList.remove('hidden');
        setTimeout(() => {
          extFolderStatus.classList.add('hidden');
        }, 5000);
      }
    } catch (err) {
      if (extFolderStatus) {
        extFolderStatus.textContent = '❌ Failed to open folder: ' + err.message;
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
