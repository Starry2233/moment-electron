const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),

  backendRequest: (endpoint) => ipcRenderer.invoke('backend-request', endpoint),

  backendPost: (endpoint, body) => ipcRenderer.invoke('backend-post', { endpoint, body }),

  // Platform info
  platform: process.platform,
})
