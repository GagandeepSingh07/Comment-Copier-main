const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
    onInit: (cb) => ipcRenderer.on('overlay:init', (_e, payload) => cb(payload)),
    select: (rect) => ipcRenderer.send('overlay:selected', rect),
    cancel: () => ipcRenderer.send('overlay:cancel'),
});
