const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mainWindowAPI', {
    copyText: (text) => ipcRenderer.invoke('comment-copier:copy', text, true),
    copySignature: (filename) => ipcRenderer.invoke('comment-copier:copy-signature', filename),
    copyCourseAll: (payload) => ipcRenderer.invoke('comment-copier:copy-course', payload),
    pickSignatureImage: () => ipcRenderer.invoke('comment-copier:pick-signature'),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    checkForUpdates: (channel) => ipcRenderer.invoke('comment-copier:check-updates', channel),
    openExternal: (url) => ipcRenderer.invoke('comment-copier:open-external', url),
    quitApp: () => ipcRenderer.send('popup:quit'),
    exportBackup: (payload) => ipcRenderer.invoke('backup:export', payload),
    importBackup: () => ipcRenderer.invoke('backup:import'),
    setLoginItem: (enabled) => ipcRenderer.invoke('app:set-login-item', enabled),
    getLoginItem: () => ipcRenderer.invoke('app:get-login-item'),
    setStartInTray: (enabled) => ipcRenderer.invoke('app:set-start-in-tray', enabled),
    getStartInTray: () => ipcRenderer.invoke('app:get-start-in-tray'),
    setGlobalHotkey: (accelerator) => ipcRenderer.invoke('hotkey:set', accelerator),
    getGlobalHotkey: () => ipcRenderer.invoke('hotkey:get'),
    getPortableMode: () => ipcRenderer.invoke('comment-copier:get-portable-mode'),
    choosePortableDir: (title) => ipcRenderer.invoke('comment-copier:choose-portable-dir', title),
    enablePortableMode: (dir) => ipcRenderer.invoke('comment-copier:enable-portable-mode', dir),
    disablePortableMode: () => ipcRenderer.invoke('comment-copier:disable-portable-mode'),
    // Per-comment-type global shortcuts (Settings → Shortcuts UI).
    setCommentShortcut: (key, accelerator) => ipcRenderer.invoke('comment-shortcuts:set', key, accelerator),
    removeCommentShortcut: (key) => ipcRenderer.invoke('comment-shortcuts:remove', key),
    getCommentShortcuts: () => ipcRenderer.invoke('comment-shortcuts:get-all'),
});
