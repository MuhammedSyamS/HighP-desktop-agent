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

// Shift & Attendance Overview Elements
const shiftOverviewCard = document.getElementById('shiftOverviewCard');
const shiftStartTime = document.getElementById('shiftStartTime');
const shiftTotalDuration = document.getElementById('shiftTotalDuration');
const shiftAttendanceBadge = document.getElementById('shiftAttendanceBadge');

// Action Controls
const startWorkBtn = document.getElementById('startWorkBtn');
const shiftNoticeText = document.getElementById('shiftNoticeText');
const endWorkBtn = document.getElementById('endWorkBtn');
const breakControls = document.getElementById('breakControls');
const breakSelectWrap = document.getElementById('breakSelectWrap');
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

function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : '⚡');
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

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
const formatTime = formatSeconds;

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

  try {
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

      // Shift & Attendance Overview Bar (Start Work Time, Duration, Status)
      if (shiftStartTime) {
        if (state.workStartedAt) {
          try {
            const startDate = new Date(state.workStartedAt);
            shiftStartTime.textContent = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch {
            shiftStartTime.textContent = '--:--';
          }
        } else if (state.isWorking) {
          shiftStartTime.textContent = 'Active Now';
        } else {
          shiftStartTime.textContent = '--:--';
        }
      }

      if (shiftTotalDuration) {
        let totalSec = Number(state.totalShiftSeconds || 0);
        if (totalSec <= 0 && state.workStartedAt && state.isWorking) {
          try {
            const startMs = new Date(state.workStartedAt).getTime();
            totalSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          } catch {}
        }
        if (totalSec <= 0 && state.isWorking) {
          totalSec = (state.activeSeconds || 0) + (state.idleSeconds || 0) + (state.breakSeconds || 0);
        }
        shiftTotalDuration.textContent = formatSeconds(totalSec);
      }

      if (shiftAttendanceBadge) {
        let attStatus = state.todayAttendanceStatus;
        if (!attStatus) {
          if (state.isWorking) {
            attStatus = state.isOnBreak ? 'ON BREAK' : 'PRESENT • ACTIVE';
          } else if (state.hasCompletedShiftToday) {
            attStatus = 'SHIFT COMPLETED';
          } else {
            attStatus = 'STANDBY';
          }
        }
        shiftAttendanceBadge.textContent = attStatus;
        if (attStatus.includes('ACTIVE') || attStatus === 'PRESENT') {
          shiftAttendanceBadge.className = 'attendance-pill pill-present';
        } else if (attStatus.includes('BREAK')) {
          shiftAttendanceBadge.className = 'attendance-pill pill-break';
        } else if (attStatus.includes('COMPLETED')) {
          shiftAttendanceBadge.className = 'attendance-pill pill-completed';
        } else {
          shiftAttendanceBadge.className = 'attendance-pill pill-standby';
        }
      }

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
          appDurationTimer.textContent = `⏱️ ${formatSeconds(appDurSec)}`;
          appDurationTimer.style.display = 'inline-flex';
        } else {
          appDurationTimer.style.display = 'none';
        }
      }

      // Active Website Box (The Core UX Fix)
      const hasWebsite = Boolean(state.currentWebsite && state.currentWebsite.domain);
      const isBrowserApp = Boolean(state.isBrowserActive || (displayName && (displayName.includes('Chrome') || displayName.includes('Edge') || displayName.includes('Brave') || displayName.includes('Firefox') || displayName.includes('Opera'))));

      if (state.isWorking && !state.isOnBreak && (hasWebsite || isBrowserApp)) {
        if (activeWebsiteBox) {
          activeWebsiteBox.classList.remove('hidden');
          activeWebsiteBox.style.display = 'flex';
        }

        const webDurSec = Number(state.currentWebDurationSeconds || state.currentWebsite?.durationSeconds || 0);
        if (webDurationTimer) {
          if (hasWebsite) {
            webDurationTimer.textContent = `⏱️ ${formatSeconds(webDurSec)}`;
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
        if (activeWebsiteBox) {
          activeWebsiteBox.classList.add('hidden');
          activeWebsiteBox.style.display = 'none';
        }
      }

      // Companion Extension Status Pill
      document.querySelectorAll('.extLivePill, #extLivePill').forEach((pill) => {
        if (state.browserBridgeConnected) {
          pill.className = 'ext-live-pill extLivePill connected';
          pill.textContent = '🟢 Connected & Streaming';
        } else {
          pill.className = 'ext-live-pill extLivePill waiting';
          pill.textContent = '🟡 Standby / Unloaded';
        }
      });

      // Timers
      if (activeTimer) activeTimer.textContent = formatSeconds(state.activeSeconds || 0);
      if (idleTimer) idleTimer.textContent = formatSeconds(state.idleSeconds || 0);
      if (breakTimer) breakTimer.textContent = formatSeconds(state.breakSeconds || 0);

      // Primary Action Controls
      if (state.isWorking) {
        startWorkBtn.classList.add('hidden');
        startWorkBtn.style.display = 'none';
        endWorkBtn.classList.remove('hidden');
        endWorkBtn.style.display = 'inline-flex';
        breakControls.classList.remove('hidden');
        breakControls.style.display = 'flex';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = '';
          shiftNoticeText.classList.remove('visible');
        }

        if (state.isOnBreak) {
          startBreakBtn.classList.add('hidden');
          startBreakBtn.style.display = 'none';
          if (breakSelectWrap) {
            breakSelectWrap.classList.add('hidden');
            breakSelectWrap.style.display = 'none';
          }
          breakReasonSelect.classList.add('hidden');
          breakReasonSelect.style.display = 'none';
          endBreakBtn.classList.remove('hidden');
          endBreakBtn.style.display = 'inline-flex';
        } else {
          startBreakBtn.classList.remove('hidden');
          startBreakBtn.style.display = 'inline-flex';
          if (breakSelectWrap) {
            breakSelectWrap.classList.remove('hidden');
            breakSelectWrap.style.display = 'block';
          }
          breakReasonSelect.classList.remove('hidden');
          breakReasonSelect.style.display = 'block';
          endBreakBtn.classList.add('hidden');
          endBreakBtn.style.display = 'none';
        }
      } else {
        startWorkBtn.classList.remove('hidden');
        startWorkBtn.style.display = 'inline-flex';
        endWorkBtn.classList.add('hidden');
        endWorkBtn.style.display = 'none';
        breakControls.classList.add('hidden');
        breakControls.style.display = 'none';

      const now = new Date();
      const curMins = now.getHours() * 60 + now.getMinutes();
      const isBefore830 = curMins < 8 * 60 + 30;
      const isPast5PM = curMins >= 17 * 60;

      startWorkBtn.disabled = false;
      startWorkBtn.classList.remove('disabled-btn');

      if (state.hasCompletedShiftToday) {
        startWorkBtn.innerHTML = '<span class="btn-icon">▶</span> Resume Work Session';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = "Previous session was concluded today. Click to resume tracking your work.";
          shiftNoticeText.classList.add('visible');
        }
      } else if (isBefore830) {
        startWorkBtn.innerHTML = '<span class="btn-icon">▶</span> Start Early Work Session';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = 'Early Shift Tracking • Standard shift window opens at 9:00 AM.';
          shiftNoticeText.classList.add('visible');
        }
      } else if (isPast5PM) {
        startWorkBtn.innerHTML = '<span class="btn-icon">▶</span> Start Overtime Session';
        if (shiftNoticeText) {
          shiftNoticeText.textContent = 'Overtime Session • Standard shift concluded at 5:00 PM.';
          shiftNoticeText.classList.add('visible');
        }
      } else {
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
    if (diagVersion) diagVersion.textContent = '1.1.0';

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
} catch (err) {
  console.error('[Renderer] updateUI error:', err);
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
  if (loginBtnText) loginBtnText.innerHTML = '<span class="btn-spinner"></span> Connecting to Server...';

  const apiUrl = (document.getElementById('apiUrl').value || '').trim() || 'https://highp-agent-backend.onrender.com';
  const email = (document.getElementById('email').value || '').trim();
  const pass = document.getElementById('password').value;

  try {
    const success = await window.agentApi.login(apiUrl, email, pass);
    if (success) {
      localStorage.setItem('agent_api_url', apiUrl);
      localStorage.setItem('agent_email', email);
      localStorage.setItem('agent_pass', pass);
      showToast('Signed in successfully!', 'success');
    } else {
      loginError.textContent = 'Invalid credentials or login failed.';
      showToast('Invalid credentials. Please verify email and password.', 'error');
    }
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'Connection error. Please check network/server.';
    loginError.textContent = errMsg;
    showToast(errMsg, 'error');
  } finally {
    loginBtn.disabled = false;
    if (loginBtnText) loginBtnText.textContent = 'Sign In & Connect';
  }
});

logoutBtn.addEventListener('click', async () => {
  await window.agentApi.logout();
  localStorage.removeItem('agent_pass');
  showToast('Logged out of workspace session.', 'info');
});

startWorkBtn.addEventListener('click', async () => {
  if (startWorkBtn.disabled) return;
  startWorkBtn.disabled = true;
  const originalHtml = startWorkBtn.innerHTML;
  startWorkBtn.innerHTML = '<span class="btn-spinner"></span> Starting Session...';
  showToast('Connecting work session...', 'info');

  try {
    await window.agentApi.startWork();
    showToast('Work session active! Monitoring started.', 'success');
    if (window.agentApi && window.agentApi.getState) {
      const freshState = await window.agentApi.getState();
      updateUI(freshState);
    }
  } catch (err) {
    showToast(err.message || 'Could not start work session.', 'error');
    startWorkBtn.disabled = false;
    startWorkBtn.innerHTML = originalHtml;
  }
});

endWorkBtn.addEventListener('click', async () => {
  if (endWorkBtn.disabled) return;
  endWorkBtn.disabled = true;
  const originalHtml = endWorkBtn.innerHTML;
  endWorkBtn.innerHTML = '<span class="btn-spinner"></span> Concluding Session...';
  showToast('Saving & concluding session...', 'info');

  try {
    await window.agentApi.endWork();
    showToast('Work session successfully saved & ended.', 'success');
    if (window.agentApi && window.agentApi.getState) {
      const freshState = await window.agentApi.getState();
      updateUI(freshState);
    }
  } catch (err) {
    showToast('Error ending work: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    endWorkBtn.disabled = false;
    endWorkBtn.innerHTML = originalHtml;
  }
});

startBreakBtn.addEventListener('click', async () => {
  if (startBreakBtn.disabled) return;
  startBreakBtn.disabled = true;
  const reason = breakReasonSelect.value;
  showToast(`Starting ${reason.toLowerCase()} break...`, 'info');
  try {
    await window.agentApi.startBreak(reason);
    showToast('Break active. Session paused.', 'info');
    if (window.agentApi && window.agentApi.getState) {
      const freshState = await window.agentApi.getState();
      updateUI(freshState);
    }
  } catch (err) {
    showToast(err.message || 'Could not start break.', 'error');
  } finally {
    startBreakBtn.disabled = false;
  }
});

endBreakBtn.addEventListener('click', async () => {
  if (endBreakBtn.disabled) return;
  endBreakBtn.disabled = true;
  showToast('Resuming work...', 'info');
  try {
    await window.agentApi.endBreak();
    showToast('Resumed work session! Tracking active.', 'success');
    if (window.agentApi && window.agentApi.getState) {
      const freshState = await window.agentApi.getState();
      updateUI(freshState);
    }
  } catch (err) {
    showToast(err.message || 'Could not resume work.', 'error');
  } finally {
    endBreakBtn.disabled = false;
  }
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
    const otp = (document.getElementById('forgotOtp')?.value || '').trim();

    if (!email) {
      forgotMsg.textContent = 'Please enter your work email.';
      forgotMsg.className = 'modal-msg error';
      return;
    }

    if (newPass.length < 8) {
      forgotMsg.textContent = 'Password must be at least 8 characters.';
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
      if (otp && window.agentApi.resetPasswordWithOtp) {
        await window.agentApi.resetPasswordWithOtp(apiUrl, email, otp, newPass);
      } else {
        await window.agentApi.resetPassword(apiUrl, email, newPass);
      }
      forgotMsg.textContent = 'Password reset successfully! You can now sign in with your new password.';
      forgotMsg.className = 'modal-msg success';
      setTimeout(() => {
        closeForgotModal();
        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.value = email;
        const passInput = document.getElementById('password');
        if (passInput) {
          passInput.value = newPass;
          passInput.focus();
        }
      }, 1800);
    } catch (err) {
      forgotMsg.textContent = err.message || 'Failed to reset password. Please verify your email or code.';
      forgotMsg.className = 'modal-msg error';
    } finally {
      submitForgotBtn.disabled = false;
      if (submitForgotBtnText) submitForgotBtnText.textContent = 'Reset Password';
    }
  });
}

// Authentication Modes (Sign In vs Sign Up, Password vs OTP) Controller
function wireAuthModesAndOtp() {
  const tabSignInBtn = document.getElementById('tabSignInBtn');
  const tabSignUpBtn = document.getElementById('tabSignUpBtn');
  const signInContainer = document.getElementById('signInContainer');
  const signUpContainer = document.getElementById('signUpContainer');
  const authCardTitle = document.getElementById('authCardTitle');
  const authCardDesc = document.getElementById('authCardDesc');

  const subTabPassBtn = document.getElementById('subTabPassBtn');
  const subTabOtpBtn = document.getElementById('subTabOtpBtn');
  const loginForm = document.getElementById('loginForm');
  const otpLoginForm = document.getElementById('otpLoginForm');

  // Mode Switcher (Sign In vs Sign Up)
  if (tabSignInBtn && tabSignUpBtn) {
    tabSignInBtn.addEventListener('click', () => {
      tabSignInBtn.classList.add('active');
      tabSignUpBtn.classList.remove('active');
      if (signInContainer) signInContainer.classList.remove('hidden');
      if (signUpContainer) signUpContainer.classList.add('hidden');
      if (authCardTitle) authCardTitle.textContent = 'Sign In to Work';
      if (authCardDesc) authCardDesc.textContent = 'Connect with your workforce account to log attendance and session activity.';
    });

    tabSignUpBtn.addEventListener('click', () => {
      tabSignUpBtn.classList.add('active');
      tabSignInBtn.classList.remove('active');
      if (signUpContainer) signUpContainer.classList.remove('hidden');
      if (signInContainer) signInContainer.classList.add('hidden');
      if (authCardTitle) authCardTitle.textContent = 'Create Employee Account';
      if (authCardDesc) authCardDesc.textContent = 'Register a new workforce account to start tracking work and productivity.';
    });
  }

  // Sub-tabs (Password vs OTP)
  if (subTabPassBtn && subTabOtpBtn) {
    subTabPassBtn.addEventListener('click', () => {
      subTabPassBtn.classList.add('active');
      subTabOtpBtn.classList.remove('active');
      if (loginForm) loginForm.classList.remove('hidden');
      if (otpLoginForm) otpLoginForm.classList.add('hidden');
    });

    subTabOtpBtn.addEventListener('click', () => {
      subTabOtpBtn.classList.add('active');
      subTabPassBtn.classList.remove('active');
      if (otpLoginForm) otpLoginForm.classList.remove('hidden');
      if (loginForm) loginForm.classList.add('hidden');
      const passEmail = document.getElementById('email')?.value;
      const otpEmail = document.getElementById('otpLoginEmail');
      if (otpEmail && passEmail && !otpEmail.value) otpEmail.value = passEmail;
    });
  }

  // Countdown Helper for OTP buttons
  function startOtpCountdown(btn, defaultText = 'Send Code') {
    let secondsLeft = 30;
    btn.disabled = true;
    btn.textContent = `Resend (${secondsLeft}s)`;
    const timer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = defaultText;
      } else {
        btn.textContent = `Resend (${secondsLeft}s)`;
      }
    }, 1000);
  }

  // Send OTP for Login
  const btnSendLoginOtp = document.getElementById('btnSendLoginOtp');
  if (btnSendLoginOtp) {
    btnSendLoginOtp.addEventListener('click', async () => {
      const email = (document.getElementById('otpLoginEmail')?.value || '').trim();
      const apiUrl = (document.getElementById('apiUrl')?.value || '').trim() || 'https://highp-agent-backend.onrender.com';
      if (!email) {
        showToast('Please enter your work email to receive code.', 'error');
        return;
      }
      try {
        btnSendLoginOtp.disabled = true;
        btnSendLoginOtp.textContent = 'Sending...';
        const res = await window.agentApi.sendOtp(apiUrl, email, 'LOGIN');
        showToast(res?.message || 'Verification code sent to email!', 'success');
        startOtpCountdown(btnSendLoginOtp);
      } catch (err) {
        showToast(err.message || 'Could not send verification code.', 'error');
        btnSendLoginOtp.disabled = false;
        btnSendLoginOtp.textContent = 'Send Code';
      }
    });
  }

  // Submit OTP Login
  if (otpLoginForm) {
    otpLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otpLoginError = document.getElementById('otpLoginError');
      const otpLoginBtn = document.getElementById('otpLoginBtn');
      const otpLoginBtnText = document.getElementById('otpLoginBtnText');
      if (otpLoginError) otpLoginError.textContent = '';
      if (otpLoginBtn) otpLoginBtn.disabled = true;
      if (otpLoginBtnText) otpLoginBtnText.innerHTML = '<span class="btn-spinner"></span> Verifying Code...';

      const apiUrl = (document.getElementById('apiUrl')?.value || '').trim() || 'https://highp-agent-backend.onrender.com';
      const email = (document.getElementById('otpLoginEmail')?.value || '').trim();
      const otp = (document.getElementById('otpLoginCode')?.value || '').trim();

      try {
        const success = await window.agentApi.loginWithOtp(apiUrl, email, otp);
        if (success) {
          localStorage.setItem('agent_api_url', apiUrl);
          localStorage.setItem('agent_email', email);
          showToast('OTP verified! Signed in successfully.', 'success');
        } else {
          if (otpLoginError) otpLoginError.textContent = 'Invalid or expired OTP code.';
          showToast('Invalid or expired OTP code.', 'error');
        }
      } catch (err) {
        const msg = err.message || 'OTP verification failed.';
        if (otpLoginError) otpLoginError.textContent = msg;
        showToast(msg, 'error');
      } finally {
        if (otpLoginBtn) otpLoginBtn.disabled = false;
        if (otpLoginBtnText) otpLoginBtnText.textContent = 'Verify & Sign In';
      }
    });
  }

  // Send OTP for Signup
  const btnSendSignupOtp = document.getElementById('btnSendSignupOtp');
  if (btnSendSignupOtp) {
    btnSendSignupOtp.addEventListener('click', async () => {
      const email = (document.getElementById('signupEmail')?.value || '').trim();
      const apiUrl = (document.getElementById('apiUrl')?.value || '').trim() || 'https://highp-agent-backend.onrender.com';
      if (!email) {
        showToast('Please enter your work email to receive verification code.', 'error');
        return;
      }
      try {
        btnSendSignupOtp.disabled = true;
        btnSendSignupOtp.textContent = 'Sending...';
        const res = await window.agentApi.sendOtp(apiUrl, email, 'SIGNUP');
        showToast(res?.message || 'Verification code sent to email!', 'success');
        startOtpCountdown(btnSendSignupOtp);
      } catch (err) {
        showToast(err.message || 'Could not send verification code.', 'error');
        btnSendSignupOtp.disabled = false;
        btnSendSignupOtp.textContent = 'Send Code';
      }
    });
  }

  // Submit Sign Up Form
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const signupError = document.getElementById('signupError');
      const signupSubmitBtn = document.getElementById('signupSubmitBtn');
      const signupSubmitBtnText = document.getElementById('signupSubmitBtnText');
      if (signupError) signupError.textContent = '';

      const apiUrl = (document.getElementById('apiUrl')?.value || '').trim() || 'https://highp-agent-backend.onrender.com';
      const firstName = (document.getElementById('signupFirstName')?.value || '').trim();
      const lastName = (document.getElementById('signupLastName')?.value || '').trim();
      const email = (document.getElementById('signupEmail')?.value || '').trim();
      const otp = (document.getElementById('signupOtp')?.value || '').trim();
      const password = (document.getElementById('signupPassword')?.value || '').trim();
      const designation = document.getElementById('signupDesignation')?.value || 'Developer';

      if (!firstName || !lastName || !email || !password) {
        if (signupError) signupError.textContent = 'All fields are required.';
        return;
      }

      if (password.length < 8) {
        if (signupError) signupError.textContent = 'Password must be at least 8 characters long.';
        return;
      }

      if (signupSubmitBtn) signupSubmitBtn.disabled = true;
      if (signupSubmitBtnText) signupSubmitBtnText.innerHTML = '<span class="btn-spinner"></span> Creating Account...';

      try {
        const success = await window.agentApi.signup(apiUrl, {
          firstName,
          lastName,
          email,
          password,
          otp: otp || '123456',
          designation,
          department: designation
        });
        if (success) {
          localStorage.setItem('agent_api_url', apiUrl);
          localStorage.setItem('agent_email', email);
          localStorage.setItem('agent_pass', password);
          showToast('Account created and signed in successfully!', 'success');
        }
      } catch (err) {
        const msg = err.message || 'Sign up failed. Please verify details.';
        if (signupError) signupError.textContent = msg;
        showToast(msg, 'error');
      } finally {
        if (signupSubmitBtn) signupSubmitBtn.disabled = false;
        if (signupSubmitBtnText) signupSubmitBtnText.textContent = 'Create Account & Sign In';
      }
    });
  }

  // Send OTP for Forgot Password
  const btnSendForgotOtp = document.getElementById('btnSendForgotOtp');
  if (btnSendForgotOtp) {
    btnSendForgotOtp.addEventListener('click', async () => {
      const email = (document.getElementById('forgotEmail')?.value || '').trim();
      const apiUrl = (document.getElementById('apiUrl')?.value || '').trim() || 'https://highp-agent-backend.onrender.com';
      if (!email) {
        if (forgotMsg) {
          forgotMsg.textContent = 'Please enter your work email.';
          forgotMsg.className = 'modal-msg error';
        }
        return;
      }
      try {
        btnSendForgotOtp.disabled = true;
        btnSendForgotOtp.textContent = 'Sending...';
        const res = await window.agentApi.sendOtp(apiUrl, email, 'RESET_PASSWORD');
        if (forgotMsg) {
          forgotMsg.textContent = res?.message || 'Verification code sent to email!';
          forgotMsg.className = 'modal-msg success';
        }
        startOtpCountdown(btnSendForgotOtp);
      } catch (err) {
        if (forgotMsg) {
          forgotMsg.textContent = err.message || 'Could not send reset code.';
          forgotMsg.className = 'modal-msg error';
        }
        btnSendForgotOtp.disabled = false;
        btnSendForgotOtp.textContent = 'Send Code';
      }
    });
  }
}

// Quick Preset Chips Handler
function wirePresetChips() {
  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const apiUrl = chip.getAttribute('data-api');
      const email = chip.getAttribute('data-email');
      const pass = chip.getAttribute('data-pass');

      if (apiUrl) {
        const apiInput = document.getElementById('apiUrl');
        if (apiInput) {
          apiInput.value = apiUrl;
          apiInput.focus();
        }
        showToast(`API set to ${apiUrl}`, 'info', 2000);
      }

      if (email) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
          emailInput.value = email;
        }
      }

      if (pass) {
        const passInput = document.getElementById('password');
        if (passInput) {
          passInput.value = pass;
        }
      }

      if (email || pass) {
        showToast('Preset credentials populated!', 'info', 2000);
      }
    });
  });
}

// Browser Extension Companion Helpers (Synchronized across all views)
function wireExtensionActions() {
  document.querySelectorAll('.btnOpenExtFolder, #openExtFolderBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await window.agentApi.openExtensionFolder();
        document.querySelectorAll('.extFolderStatus, #extFolderStatus').forEach((el) => {
          el.textContent = '✅ Extension folder opened in Explorer!';
          el.classList.remove('hidden');
          el.style.display = 'block';
          setTimeout(() => {
            el.classList.add('hidden');
            el.style.display = 'none';
          }, 5000);
        });
      } catch (err) {
        document.querySelectorAll('.extFolderStatus, #extFolderStatus').forEach((el) => {
          el.textContent = '❌ Failed to open folder: ' + err.message;
          el.classList.remove('hidden');
          el.style.display = 'block';
        });
      }
    });
  });

  document.querySelectorAll('.btnCopyExtPath, #copyExtPathBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        let copiedPath = 'browser-extension';
        if (window.agentApi && window.agentApi.getExtensionPath) {
          const res = await window.agentApi.getExtensionPath();
          if (res && res.path) {
            copiedPath = res.path;
          }
        }
        await navigator.clipboard.writeText(copiedPath);
        document.querySelectorAll('.extFolderStatus, #extFolderStatus').forEach((el) => {
          el.textContent = `📋 Path copied: ${copiedPath}`;
          el.classList.remove('hidden');
          el.style.display = 'block';
          setTimeout(() => {
            el.classList.add('hidden');
            el.style.display = 'none';
          }, 5000);
        });
      } catch (err) {
        document.querySelectorAll('.extFolderStatus, #extFolderStatus').forEach((el) => {
          el.textContent = '❌ Could not copy path: ' + err.message;
          el.classList.remove('hidden');
          el.style.display = 'block';
        });
      }
    });
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

// 1-second live shift ticker while working
setInterval(() => {
  if (latestState && latestState.isWorking && shiftTotalDuration) {
    if (latestState.workStartedAt) {
      try {
        const startMs = new Date(latestState.workStartedAt).getTime();
        const totalSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        shiftTotalDuration.textContent = formatSeconds(totalSec);
      } catch {}
    } else {
      latestState.totalShiftSeconds = (latestState.totalShiftSeconds || 0) + 1;
      shiftTotalDuration.textContent = formatSeconds(latestState.totalShiftSeconds);
    }
  }
}, 1000);

// Populate saved preferences & wire features on launch
window.addEventListener('DOMContentLoaded', () => {
  wireAuthModesAndOtp();
  wirePresetChips();
  wireExtensionActions();

  const savedUrl = localStorage.getItem('agent_api_url') || 'https://highp-agent-backend.onrender.com';
  const savedEmail = localStorage.getItem('agent_email') || 'shamsaifudheen@gmail.com';
  const savedPass = localStorage.getItem('agent_pass') || 'Password@123';

  const apiInput = document.getElementById('apiUrl');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');

  if (apiInput) apiInput.value = savedUrl;
  if (emailInput && !emailInput.value) emailInput.value = savedEmail;
  if (passInput && !passInput.value) passInput.value = savedPass;
});
