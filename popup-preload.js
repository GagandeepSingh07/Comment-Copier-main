const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
    copyText: (text, count) => ipcRenderer.invoke('comment-copier:copy', text, count),
    copySignature: (filename) => ipcRenderer.invoke('comment-copier:copy-signature', filename),
    copyCourseAll: (payload) => ipcRenderer.invoke('comment-copier:copy-course', payload),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    copySheet: (html, text) => ipcRenderer.invoke('comment-copier:copy-sheet', html, text),
    pickOrganizeFolder: () => ipcRenderer.invoke('file-organizer:pick-folder'),
    organizeFolder: (folderPath, options) => ipcRenderer.invoke('file-organizer:organize', folderPath, options),
    readClipboardText: () => ipcRenderer.invoke('sheet-import:read-clipboard'),
    pushQuickState: (payload) => ipcRenderer.send('comment-copier:quick-state', payload),
    reportCopyResult: (info) => ipcRenderer.send('comment-copier:tray-copied', info),
    quitApp: () => ipcRenderer.send('popup:quit'),
    openMain: () => ipcRenderer.send('comment-copier:open-main'),
    close: () => ipcRenderer.send('popup:close'),
    resize: (size) => ipcRenderer.send('popup:resize', size),
    onClosed: (callback) => ipcRenderer.on('popup:closed', () => callback()),
    // Per-comment-type global shortcuts: the main process notifies the popup
    // (even while hidden) that a shortcut fired for a given comment-type key;
    // the popup does the actual copy+advance and reports back for the tray
    // balloon confirmation.
    onCommentShortcut: (callback) => ipcRenderer.on('comment-shortcut:trigger', (event, key) => callback(key)),
    reportShortcutCopy: (info) => ipcRenderer.send('comment-copier:shortcut-copied', info),
});
