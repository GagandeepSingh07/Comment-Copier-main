const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mainWindowAPI', {
    copyText: (text) => ipcRenderer.invoke('comment-copier:copy', text, true),
    getAppInfo: () => ipcRenderer.invoke('comment-copier:app-info'),
    checkForUpdates: () => ipcRenderer.invoke('comment-copier:check-updates'),
    openExternal: (url) => ipcRenderer.invoke('comment-copier:open-external', url),
    quitApp: () => ipcRenderer.send('popup:quit'),
    exportBackup: (payload) => ipcRenderer.invoke('backup:export', payload),
    importBackup: () => ipcRenderer.invoke('backup:import'),
    setLoginItem: (enabled) => ipcRenderer.invoke('app:set-login-item', enabled),
    getLoginItem: () => ipcRenderer.invoke('app:get-login-item'),
    setGlobalHotkey: (accelerator) => ipcRenderer.invoke('hotkey:set', accelerator),
    getGlobalHotkey: () => ipcRenderer.invoke('hotkey:get'),
});
