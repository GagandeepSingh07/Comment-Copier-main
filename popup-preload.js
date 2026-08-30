const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
    copyText: (text, count) => ipcRenderer.invoke('comment-copier:copy', text, count),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    copySheet: (html, text) => ipcRenderer.invoke('comment-copier:copy-sheet', html, text),
    pickOrganizeFolder: () => ipcRenderer.invoke('file-organizer:pick-folder'),
    organizeFolder: (folderPath, options) => ipcRenderer.invoke('file-organizer:organize', folderPath, options),
    readClipboardText: () => ipcRenderer.invoke('sheet-import:read-clipboard'),
    onSetOrganizerFolder: (callback) => ipcRenderer.on('organizer:set-folder', (event, folder) => callback(folder)),
    pushQuickState: (payload) => ipcRenderer.send('comment-copier:quick-state', payload),
    reportCopyResult: (info) => ipcRenderer.send('comment-copier:tray-copied', info),
    quitApp: () => ipcRenderer.send('popup:quit'),
    openMain: () => ipcRenderer.send('comment-copier:open-main'),
    close: () => ipcRenderer.send('popup:close'),
    resize: (size) => ipcRenderer.send('popup:resize', size),
    onClosed: (callback) => ipcRenderer.on('popup:closed', () => callback()),
});
