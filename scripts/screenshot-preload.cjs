const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('CampusBridge', {
  platform: 'electron',
  request: async () => {
    throw new Error('Screenshot preview only');
  },
  openAuth: async () => ({ success: false, url: '', cancelled: true }),
  clearSession: async () => {},
  openExternal: async () => {},
});
