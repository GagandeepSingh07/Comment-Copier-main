const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
    copyText: (text) => ipcRenderer.invoke('comment-copier:copy', text),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    copySheet: (html, text) => ipcRenderer.invoke('comment-copier:copy-sheet', html, text),
    pushQuickState: (payload) => ipcRenderer.send('comment-copier:quick-state', payload),
    reportCopyResult: (info) => ipcRenderer.send('comment-copier:tray-copied', info),
    quitApp: () => ipcRenderer.send('popup:quit'),
    close: () => ipcRenderer.send('popup:close'),
    resize: (size) => ipcRenderer.send('popup:resize', size),
    onClosed: (callback) => ipcRenderer.on('popup:closed', () => callback()),
});
