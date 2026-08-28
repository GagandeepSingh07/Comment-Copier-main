const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mainWindowAPI', {
    copyText: (text) => ipcRenderer.invoke('comment-copier:copy', text),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    quitApp: () => ipcRenderer.send('popup:quit'),
});
