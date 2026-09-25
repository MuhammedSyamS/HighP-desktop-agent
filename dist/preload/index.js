"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('agentApi', {
    login: (apiUrl, email, pass) => electron_1.ipcRenderer.invoke('agent:login', { apiUrl, email, pass }),
    logout: () => electron_1.ipcRenderer.invoke('agent:logout'),
    startWork: () => electron_1.ipcRenderer.invoke('agent:startWork'),
    endWork: () => electron_1.ipcRenderer.invoke('agent:endWork'),
    startBreak: (reason, note) => electron_1.ipcRenderer.invoke('agent:startBreak', { reason, note }),
    endBreak: () => electron_1.ipcRenderer.invoke('agent:endBreak'),
    getState: () => electron_1.ipcRenderer.invoke('agent:getState'),
    onStateUpdate: (callback) => {
        const handler = (_event, state) => callback(state);
        electron_1.ipcRenderer.on('agent:state-update', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:state-update', handler);
    }
});
