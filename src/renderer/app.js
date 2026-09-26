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

    // Diagnostics Panel (Requirement #45)
    if (diagConn) diagConn.textContent = state.isOnline ? 'Connected' : 'Disconnected (Offline)';
    if (diagServer) diagServer.textContent = state.isOnline ? 'Reachable' : 'Unreachable';
    if (diagDevice) diagDevice.textContent = state.deviceId ? `Registered (${state.deviceId})` : 'Unregistered';
    if (diagSession) diagSession.textContent = state.sessionId ? `Active (${state.sessionId.slice(0, 8)}...)` : 'None';
    if (diagApp) diagApp.textContent = state.currentApplication || 'None';
    if (diagStatus) diagStatus.textContent = state.currentStatus;
    if (diagQueue) diagQueue.textContent = String(state.queuedEventsCount || 0);
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
  const apiUrl = (document.getElementById('apiUrl').value || '').trim() || 'http://localhost:5000';
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;

  try {
    const success = await window.agentApi.login(apiUrl, email, pass);
    if (!success) {
      loginError.textContent = 'Invalid credentials or login failed.';
    }
  } catch (err) {
    loginError.textContent = err.response?.data?.message || err.message || 'Connection error';
  }
});

logoutBtn.addEventListener('click', async () => {
  await window.agentApi.logout();
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
