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
const appDurationTimer = document.getElementById('appDurationTimer');

// Website Tracking Elements
const activeWebsiteBox = document.getElementById('activeWebsiteBox');
const currentWebDomain = document.getElementById('currentWebDomain');
const currentWebTitle = document.getElementById('currentWebTitle');
const webTrackingSourceBadge = document.getElementById('webTrackingSourceBadge');
const webDurationTimer = document.getElementById('webDurationTimer');

// Timers
const activeTimer = document.getElementById('activeTimer');
const idleTimer = document.getElementById('idleTimer');
const breakTimer = document.getElementById('breakTimer');

// Action Controls
const startWorkBtn = document.getElementById('startWorkBtn');
const shiftNoticeText = document.getElementById('shiftNoticeText');
const endWorkBtn = document.getElementById('endWorkBtn');
const breakControls = document.getElementById('breakControls');
const breakReasonSelect = document.getElementById('breakReasonSelect');
const startBreakBtn = document.getElementById('startBreakBtn');
const endBreakBtn = document.getElementById('endBreakBtn');

// Forgot Password Modal Elements
const openForgotModalBtn = document.getElementById('openForgotModalBtn');
const closeForgotModalBtn = document.getElementById('closeForgotModalBtn');
const cancelForgotBtn = document.getElementById('cancelForgotBtn');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const forgotEmail = document.getElementById('forgotEmail');
const forgotNewPass = document.getElementById('forgotNewPass');
const forgotConfirmPass = document.getElementById('forgotConfirmPass');
const forgotMsg = document.getElementById('forgotMsg');
const submitForgotBtn = document.getElementById('submitForgotBtn');
const submitForgotBtnText = document.getElementById('submitForgotBtnText');

let latestState = null;

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
  if (lower.includes('highp')) {
    return '🛡️';
  }
  if (lower.includes('settings') || lower.includes('task manager') || lower.includes('desktop') || catLower === 'system') {
    return '⚙️';
  }
  return '🖥️';
}

function updateUI(state) {
  if (!state) return;
  latestState = state;

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
    } else if (state.currentApplication === 'HighP Agent') {
      displayName = 'HighP Agent';
      categoryName = 'Agent Client';
      processText = 'Active Window • Ready & Monitoring background apps';
      if (appIcon) appIcon.textContent = '🛡️';
    } else if (state.currentApplication && state.currentApplication !== 'None') {
      displayName = state.currentApplication;
      categoryName = appInfo?.category || 'General';
      processText = appInfo?.executableName ? `${appInfo.executableName}${appInfo.processId ? ` (PID: ${appInfo.processId})` : ''}` : '';
      if (appIcon) appIcon.textContent = resolveAppIcon(displayName, categoryName);
    } else {
      displayName = 'Monitoring Active Apps';
      categoryName = 'Active';
      processText = 'Switch to any work application to track';
      if (appIcon) appIcon.textContent = '⚡';
    }

    if (currentAppName) currentAppName.textContent = displayName;
    if (appCategoryBadge) appCategoryBadge.textContent = categoryName;
    if (appProcessTag) appProcessTag.textContent = processText || displayName;

    // Live Active App Duration
    const appDurSec = Number(state.currentAppDurationSeconds || state.currentApplicationInfo?.durationSeconds || 0);
    if (appDurationTimer) {
      if (state.isWorking && !state.isOnBreak && displayName && displayName !== 'Session not active' && displayName !== 'System Idle') {
        appDurationTimer.textContent = `⏱️ ${formatTime(appDurSec)}`;
        appDurationTimer.style.display = 'inline-flex';
      } else {
        appDurationTimer.style.display = 'none';
      }
    }

    // Active Website Box (The Core UX Fix)
    const hasWebsite = Boolean(state.currentWebsite && state.currentWebsite.domain);
    const isBrowserApp = Boolean(state.isBrowserActive || (displayName && (displayName.includes('Chrome') || displayName.includes('Edge') || displayName.includes('Brave') || displayName.includes('Firefox') || displayName.includes('Opera'))));

    if (state.isWorking && !state.isOnBreak && (hasWebsite || isBrowserApp)) {
      if (activeWebsiteBox) activeWebsiteBox.classList.remove('hidden');

      const webDurSec = Number(state.currentWebDurationSeconds || state.currentWebsite?.durationSeconds || 0);
      if (webDurationTimer) {
        if (hasWebsite) {
          webDurationTimer.textContent = `⏱️ ${formatTime(webDurSec)}`;
          webDurationTimer.style.display = 'inline-flex';
        } else {
          webDurationTimer.style.display = 'none';
        }
      }

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
      if (shiftNoticeText) {
        shiftNoticeText.textContent = '';
        shiftNoticeText.classList.remove('visible');
      }

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

      const now = new Date();
      const curMins = now.getHours() * 60 + now.getMinutes();
      const isBefore830 = curMins < 8 * 60 + 30;
      const isPast5PM = curMins >= 17 * 60;

      if (state.hasCompletedShiftToday) {
        startWorkBtn.disabled = true;
        startWorkBtn.classList.add('disabled-btn');
        startWorkBtn.innerHTML = '<span class="btn-icon">✓</span> Shift Completed Today';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = "Today's work shift has concluded. Next work session starts tomorrow at 8:30 AM.";
          shiftNoticeText.classList.add('visible');
        }
      } else if (isBefore830) {
        startWorkBtn.disabled = true;
        startWorkBtn.classList.add('disabled-btn');
        startWorkBtn.innerHTML = '<span class="btn-icon">🔒</span> Clock-In Opens @ 8:30 AM';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = 'Shift Window: 8:30 AM – 5:00 PM. Clock-in button enables automatically at 8:30 AM.';
          shiftNoticeText.classList.add('visible');
        }
      } else if (isPast5PM) {
        startWorkBtn.disabled = true;
        startWorkBtn.classList.add('disabled-btn');
        startWorkBtn.innerHTML = '<span class="btn-icon">🔒</span> Shift Concluded @ 5:00 PM';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = "Today's shift ended at 5:00 PM. Next work session starts tomorrow at 8:30 AM.";
          shiftNoticeText.classList.add('visible');
        }
      } else {
        startWorkBtn.disabled = false;
        startWorkBtn.classList.remove('disabled-btn');
        startWorkBtn.innerHTML = '<span class="btn-icon">▶</span> Start Work Session';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = '';
          shiftNoticeText.classList.remove('visible');
        }
      }
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
  const email = (document.getElementById('email').value || '').trim();
  const pass = document.getElementById('password').value;

  try {
    const success = await window.agentApi.login(apiUrl, email, pass);
    if (success) {
      localStorage.setItem('agent_api_url', apiUrl);
      localStorage.setItem('agent_email', email);
      // Clean password from memory and form
      const passInput = document.getElementById('password');
      if (passInput) passInput.value = '';
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
  localStorage.removeItem('agent_pass');
});

startWorkBtn.addEventListener('click', async () => {
  try {
    await window.agentApi.startWork();
  } catch (err) {
    alert(err.message || 'Could not start work session.');
  }
});

endWorkBtn.addEventListener('click', async () => {
  try {
    await window.agentApi.endWork();
  } catch (err) {
    console.error('Error ending work:', err);
  }
});

startBreakBtn.addEventListener('click', async () => {
  const reason = breakReasonSelect.value;
  await window.agentApi.startBreak(reason);
});

endBreakBtn.addEventListener('click', async () => {
  await window.agentApi.endBreak();
});

// Forgot Password Modal Handlers
function openForgotModal() {
  if (forgotPasswordModal) forgotPasswordModal.classList.remove('hidden');
  if (forgotEmail) forgotEmail.value = document.getElementById('email')?.value || '';
  if (forgotNewPass) forgotNewPass.value = '';
  if (forgotConfirmPass) forgotConfirmPass.value = '';
  if (forgotMsg) {
    forgotMsg.textContent = '';
    forgotMsg.className = 'modal-msg hidden';
  }
}

function closeForgotModal() {
  if (forgotPasswordModal) forgotPasswordModal.classList.add('hidden');
}

if (openForgotModalBtn) {
  openForgotModalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openForgotModal();
  });
}

if (closeForgotModalBtn) closeForgotModalBtn.addEventListener('click', closeForgotModal);
if (cancelForgotBtn) cancelForgotBtn.addEventListener('click', closeForgotModal);

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (forgotEmail.value || '').trim();
    const newPass = forgotNewPass.value;
    const confirmPass = forgotConfirmPass.value;

    if (!email) {
      forgotMsg.textContent = 'Please enter your work email.';
      forgotMsg.className = 'modal-msg error';
      return;
    }

    if (newPass.length < 6) {
      forgotMsg.textContent = 'Password must be at least 6 characters.';
      forgotMsg.className = 'modal-msg error';
      return;
    }

    if (newPass !== confirmPass) {
      forgotMsg.textContent = 'Passwords do not match.';
      forgotMsg.className = 'modal-msg error';
      return;
    }

    submitForgotBtn.disabled = true;
    if (submitForgotBtnText) submitForgotBtnText.textContent = 'Resetting...';
    forgotMsg.className = 'modal-msg hidden';

    try {
      const apiUrl = (document.getElementById('apiUrl')?.value || '').trim() || 'https://highp-agent-backend.onrender.com';
      await window.agentApi.resetPassword(apiUrl, email, newPass);
      forgotMsg.textContent = 'Password reset successfully! You can now sign in with your new password.';
      forgotMsg.className = 'modal-msg success';
      setTimeout(() => {
        closeForgotModal();
        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.value = email;
        const passInput = document.getElementById('password');
        if (passInput) {
          passInput.value = '';
          passInput.focus();
        }
      }, 1800);
    } catch (err) {
      forgotMsg.textContent = err.message || 'Failed to reset password. Please verify your email.';
      forgotMsg.className = 'modal-msg error';
    } finally {
      submitForgotBtn.disabled = false;
      if (submitForgotBtnText) submitForgotBtnText.textContent = 'Reset Password';
    }
  });
}

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

// Periodic ticker (re-evaluates start button unlock at 8:30 AM without reload)
setInterval(() => {
  if (latestState && !latestState.isWorking) {
    updateUI(latestState);
  }
}, 5000);

// Populate saved preferences on application launch (Clean, no auto-login)
window.addEventListener('DOMContentLoaded', () => {
  const savedUrl = localStorage.getItem('agent_api_url') || 'https://highp-agent-backend.onrender.com';
  const savedEmail = localStorage.getItem('agent_email') || '';

  const apiInput = document.getElementById('apiUrl');
  const emailInput = document.getElementById('email');

  if (apiInput) apiInput.value = savedUrl;
  if (emailInput && savedEmail) emailInput.value = savedEmail;
});
