const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mainWindowAPI', {
    copyText: (text) => ipcRenderer.invoke('comment-copier:copy', text, true),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    checkForUpdates: () => ipcRenderer.invoke('comment-copier:check-updates'),
    openExternal: (url) => ipcRenderer.invoke('comment-copier:open-external', url),
    quitApp: () => ipcRenderer.send('popup:quit'),
});
