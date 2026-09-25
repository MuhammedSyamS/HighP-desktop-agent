import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('agentApi', {
  login: (apiUrl: string, email: string, pass: string) => ipcRenderer.invoke('agent:login', { apiUrl, email, pass }),
  logout: () => ipcRenderer.invoke('agent:logout'),
  startWork: () => ipcRenderer.invoke('agent:startWork'),
  endWork: () => ipcRenderer.invoke('agent:endWork'),
  startBreak: (reason: string, note?: string) => ipcRenderer.invoke('agent:startBreak', { reason, note }),
  endBreak: () => ipcRenderer.invoke('agent:endBreak'),
  getState: () => ipcRenderer.invoke('agent:getState'),
  onStateUpdate: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('agent:state-update', handler);
    return () => ipcRenderer.removeListener('agent:state-update', handler);
  }
});
