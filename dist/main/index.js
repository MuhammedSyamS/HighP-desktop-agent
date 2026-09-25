"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const agentService_1 = require("./services/agentService");
let mainWindow = null;
let tray = null;
const agentService = new agentService_1.AgentService();
let isQuitting = false;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 480,
        height: 680,
        minWidth: 420,
        minHeight: 580,
        resizable: true,
        title: 'HighP Agent - Employee Transparency Monitor',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    const rendererPath = path_1.default.join(__dirname, '../renderer/index.html');
    mainWindow.loadFile(rendererPath);
    mainWindow.on('close', (event) => {
        // Minimize to tray instead of quitting if active
        if (agentService.getState().isWorking && !isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
}
function createTray() {
    // Simple transparent 16x16 icon data
    const iconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAwUACYGhgEGBgaG//8ZGBgY/jMwMDA8wKOBDAaA4BgNGBgYGBgY/mPDj1E3DNIN/wEArXgOD2z1FqAAAAAASUVORK5CYII=';
    const icon = electron_1.nativeImage.createFromDataURL(iconBase64);
    tray = new electron_1.Tray(icon);
    tray.setToolTip('HighP Activity Monitor');
    const updateContextMenu = () => {
        const state = agentService.getState();
        const contextMenu = electron_1.Menu.buildFromTemplate([
            { label: `Status: ${state.currentStatus}`, enabled: false },
            { label: `App: ${state.currentApplication}`, enabled: false },
            { type: 'separator' },
            {
                label: state.isWorking ? 'End Work' : 'Start Work',
                click: async () => {
                    if (state.isWorking)
                        await agentService.endWork();
                    else
                        await agentService.startWork();
                }
            },
            {
                label: state.isOnBreak ? 'Resume Work' : 'Take Break',
                enabled: state.isWorking,
                click: async () => {
                    if (state.isOnBreak)
                        await agentService.endBreak();
                    else
                        await agentService.startBreak('Lunch');
                }
            },
            { type: 'separator' },
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
                    await agentService.logout();
                    electron_1.app.quit();
                }
            }
        ]);
        tray?.setContextMenu(contextMenu);
    };
    updateContextMenu();
    tray.on('click', () => {
        if (mainWindow?.isVisible()) {
            mainWindow.hide();
        }
        else {
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
electron_1.ipcMain.handle('agent:login', async (_e, { apiUrl, email, pass }) => {
    return agentService.login(apiUrl, email, pass);
});
electron_1.ipcMain.handle('agent:logout', async () => {
    return agentService.logout();
});
electron_1.ipcMain.handle('agent:startWork', async () => {
    return agentService.startWork();
});
electron_1.ipcMain.handle('agent:endWork', async () => {
    return agentService.endWork();
});
electron_1.ipcMain.handle('agent:startBreak', async (_e, { reason, note }) => {
    return agentService.startBreak(reason, note);
});
electron_1.ipcMain.handle('agent:endBreak', async () => {
    return agentService.endBreak();
});
electron_1.ipcMain.handle('agent:getState', async () => {
    return agentService.getState();
});
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !agentService.getState().isWorking) {
        electron_1.app.quit();
    }
});
