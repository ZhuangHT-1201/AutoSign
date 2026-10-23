const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CampusBridge', {
  platform: 'electron',
  request: (input) => ipcRenderer.invoke('campus:request', input),
  openAuth: (input) => ipcRenderer.invoke('campus:open-auth', input),
  clearSession: () => ipcRenderer.invoke('campus:clear-session'),
  openExternal: (url) => ipcRenderer.invoke('campus:open-external', url),
});
