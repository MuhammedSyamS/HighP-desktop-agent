import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, powerMonitor, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { AgentService } from './services/agentService';
import { ActivityState } from '../shared/enums';

// Ensure isolated cache and prevent file lock conflicts
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'HighPDesktopAgentApp'));
} catch {}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const agentService = new AgentService();

// Register powerMonitor listeners for sleep/resume/lock/unlock
powerMonitor.on('suspend', () => agentService.handleSystemSleep());
powerMonitor.on('resume', () => agentService.handleSystemResume());
powerMonitor.on('lock-screen', () => agentService.handleScreenLock());
powerMonitor.on('unlock-screen', () => agentService.handleScreenUnlock());

// Graceful shutdown: flush open intervals on normal quit, restart, or Windows logout/shutdown
app.on('before-quit', () => {
  agentService.handleAppShutdown();
});

app.on('will-quit', () => {
  agentService.handleAppShutdown();
});

let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 420,
    minHeight: 580,
    resizable: true,
    title: 'HighP Agent - Employee Transparency Monitor',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of quitting if active work session is running
    if (agentService.getState().isWorking && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const iconBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAwUACYGhgEGBgaG//8ZGBgY/jMwMDA8wKOBDAaA4BgNGBgYGBgY/mPDj1E3DNIN/wEArXgOD2z1FqAAAAAASUVORK5CYII=';
  const icon = nativeImage.createFromDataURL(iconBase64);
  tray = new Tray(icon);
  tray.setToolTip('HighP Activity Monitor');

  const updateContextMenu = () => {
    const state = agentService.getState();
    const loginSettings = app.getLoginItemSettings();

    const contextMenu = Menu.buildFromTemplate([
      { label: `Status: ${state.currentStatus}`, enabled: false },
      { label: `App: ${state.currentApplication}`, enabled: false },
      { type: 'separator' },
      {
        label: state.isWorking ? 'End Work' : 'Start Work',
        click: async () => {
          if (state.isWorking) await agentService.endWork();
          else await agentService.startWork();
        }
      },
      {
        label: state.isOnBreak ? 'Resume Work' : 'Take Break',
        enabled: state.isWorking,
        click: async () => {
          if (state.isOnBreak) await agentService.endBreak();
          else await agentService.startBreak('Lunch');
        }
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: loginSettings.openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
            path: process.execPath
          });
        }
      },
      {
        label: 'Open Dashboard',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      {
        label: 'Quit',
        click: async () => {
          isQuitting = true;
          agentService.handleAppShutdown();
          await agentService.logout();
          app.quit();
        }
      }
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateContextMenu();
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  agentService.setStateChangeCallback((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:state-update', state);
    }
    updateContextMenu();
  });
}

// IPC Handlers
ipcMain.handle('agent:login', async (_e, { apiUrl, email, pass }) => {
  return agentService.login(apiUrl, email, pass);
});

ipcMain.handle('agent:logout', async () => {
  return agentService.logout();
});

ipcMain.handle('agent:startWork', async () => {
  return agentService.startWork();
});

ipcMain.handle('agent:endWork', async () => {
  return agentService.endWork();
});

ipcMain.handle('agent:startBreak', async (_e, { reason, note }) => {
  return agentService.startBreak(reason, note);
});

ipcMain.handle('agent:endBreak', async () => {
  return agentService.endBreak();
});

ipcMain.handle('agent:getState', async () => {
  return agentService.getState();
});

ipcMain.handle('agent:getAutostart', async () => {
  const settings = app.getLoginItemSettings();
  return { openAtLogin: settings.openAtLogin };
});

ipcMain.handle('agent:setAutostart', async (_e, { enabled }) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath
  });
  return { openAtLogin: Boolean(enabled) };
});

ipcMain.handle('agent:openExtensionFolder', async () => {
  let targetPath = '';
  if (app.isPackaged) {
    const resPath = path.join(process.resourcesPath, 'browser-extension');
    if (fs.existsSync(resPath)) {
      targetPath = resPath;
    }
  }
  if (!targetPath) {
    const devPath = path.resolve(__dirname, '../../browser-extension');
    if (fs.existsSync(devPath)) {
      targetPath = devPath;
    } else {
      const distPath = path.resolve(__dirname, '../browser-extension');
      if (fs.existsSync(distPath)) {
        targetPath = distPath;
      }
    }
  }
  if (targetPath) {
    await shell.openPath(targetPath);
    return { success: true, path: targetPath };
  }
  return { success: false, error: 'Extension directory not found' };
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !agentService.getState().isWorking) {
    app.quit();
  }
});
