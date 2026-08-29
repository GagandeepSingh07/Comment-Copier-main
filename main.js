const { app, BrowserWindow, ipcMain, clipboard, Tray, screen, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(app.getPath('temp'), 'comment-copier'));

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    main();
}

function main() {

const POPUP_WIDTH = 420;
const POPUP_MAX_WIDTH = 900;
const POPUP_MIN_HEIGHT = 380;
const POPUP_MAX_HEIGHT = 660;

const PLATFORM_NAMES = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

const CHANGELOG = [
    {
        version: '1.15.0',
        categories: [
            {
                heading: 'New',
                notes: [
                    'Comment Editor: search/filter box above the comment list to quickly jump to a comment.',
                    'Comment Editor: drag any comment card to a new position to reorder.',
                    'Comment Editor: duplicate comments are rejected when adding instead of being silently added.',
                    'Comment Editor: deleting a comment now offers "Undo".',
                    'Comment Editor: bulk select comments and delete them all at once.',
                    'Comment Editor: placeholders like {name} or {unit} can be used in comments and are substituted from Student Details when copying, with a live preview.',
                    'Comment Editor: usage counter shows how many times each comment has been copied.',
                ],
            },
            {
                heading: 'Settings',
                notes: [
                    'Added Backup & Restore \u2014 export all comment lists, the prompt, student details, and settings to a JSON file, and import it back.',
                    'Added a Launch at startup toggle to start the app when you sign in to Windows.',
                    'Added a configurable global hotkey to open the tray popup from anywhere.',
                    'Added a light theme option alongside the default dark theme.',
                ],
            },
            {
                heading: 'About',
                notes: [
                    'Added an "Export diagnostics" button that copies app info and comment counts for bug reports.',
                ],
            },
            {
                heading: 'Other',
                notes: [
                    'Keyboard shortcuts: Ctrl+N focuses the add-comment box, Ctrl+F focuses search, Ctrl+B backs up your data.',
                    'The main window now remembers its size and position between launches.',
                ],
            },
        ],
    },
    {
        version: '1.14.4',
        categories: [
            {
                heading: 'Import Feature',
                notes: [
                    'Student Details: Now User can import a student\'s unit codes and marks directly from the clipboard (copied from Excel) or from a .xlsx file. The app will automatically find the matching student if the file has several.',
                ],
            },
        ],
    },
    {
        version: '1.14.3',
        categories: [
            {
                heading: 'New',
                notes: [
                    'Student Details: the "Unit Code & Mark" section now shows a live count of total entries, so you can see at a glance how many codes have been added for the current student.',
                ],
            },
        ],
    },
    {
        version: '1.14.2',
        categories: [
            {
                heading: 'Improvements',
                notes: [
                    'Paste / Paste box: the stacked Student Id / Name / Assessment Code block layout is now recognized even without the literal "Student Id"/"Name" header text — a real Excel roster export (codes start straight away, no header row) now imports correctly instead of being misread as a single stray code.',
                ],
            },
        ],
    },
    {
        version: '1.14.1',
        categories: [
            {
                heading: 'Improvements',
                notes: [
                    'Paste / Paste box: a plain Code/Mark list no longer needs to be tab-separated — comma-separated, multiple-spaced, or single-spaced "CODE, Mark" lines are now understood too, so a whole list of unit codes and marks can be typed or pasted in and imported in one go.',
                ],
            },
        ],
    },
    {
        version: '1.14.0',
        categories: [
            {
                heading: 'Changed',
                notes: [
                    'Student Details: "Import Excel" (file picker) replaced with "Paste" — copy a range of cells in Excel (Ctrl+C), then click Paste to import directly from the clipboard, no file dialog needed.',
                    'Added a "Paste box" fallback: opens a text area to paste into manually, for when clipboard access isn\'t available or the data needs a quick edit before importing.',
                ],
            },
        ],
    },
    {
        version: '1.13.1',
        categories: [
            {
                heading: 'Bug Fixes',
                notes: [
                    'Import Excel: fixed only the first block of unit codes being imported when a student\'s Student Id/Name cells are merged across several stacked code/mark tables — all blocks for that student are now combined.',
                ],
            },
        ],
    },
    {
        version: '1.13.0',
        categories: [
            {
                heading: 'New',
                notes: [
                    'Student Details: added an "Import Excel" button to load a student\'s Unit Code & Mark table straight from an .xlsx file — no more retyping data that already exists in a spreadsheet.',
                    'Import understands the app\'s own "Copy Sheet" table layout (Student Id / Name / Assessment Code), and will find and load the matching student if the file has several.',
                ],
            },
        ],
    },
    {
        version: '1.12.5',
        categories: [
            {
                heading: 'Improvements',
                notes: [
                    'File Organizer: folders are now named after just the unit code (e.g. "CPCCCA3019"), ignoring any extra words, version numbers, or parentheses before or after it in the filename.',
                ],
            },
        ],
    },
    {
        version: '1.12.4',
        categories: [
            {
                heading: 'Improvements',
                notes: [
                    'Tab and Side-by-side layouts now match the Card layout sizing — larger padding, headings, and input/button dimensions across all sections.',
                    'Tab layout window width increased to 400px to match the Card layout.',
                ],
            },
            {
                heading: 'Bug Fixes',
                notes: [
                    'Fixed inconsistent heights of the Unit Code input, Mark dropdown, and Add button in Student Details.',
                ],
            },
        ],
    },
    {
        version: '1.12.0',
        notes: [
            'New Card layout: a third view (Tabs → Side by side → Cards) with quick actions shown as icon cards and Student Details stacked underneath.',
            'Quick action icons redrawn as crisp SVGs (checkmark, AI sparkle, copy) instead of text/arrow glyphs.',
            'Unit Code & Mark list restyled as full-width rows with a rounded status pill and remove button on the right — applies to every layout.',
            'Student Details heading hierarchy clarified: “Student details” is now the main heading, “Unit Code & Mark” a smaller sub-heading.',
            'Student ID, Name, and Copy Sheet now sit on a single row in the Card layout.',
        ],
    },
    {
        version: '1.11.4',
        notes: [
            'Copying a comment now adds today\'s date to the clipboard first, then switches to the comment after a short delay.',
            'File Organizer: added a Clear button, auto-clears the selected folder after organizing, and shows a how-to-use hint.',
            'Fixed the popup and File Organizer closing when the folder picker opens.',
        ],
    },
    {
        version: '1.10.0',
        notes: [
            'Layout toggle and info buttons moved to the bottom footer bar.',
            'Copy Sheet button moved next to the Name field on Student Details.',
            'Prompt button is now a compact icon in the footer.',
            'Info panel opens above the footer button with internal scrolling.',
        ],
    },
    {
        version: '1.9.7',
        notes: [
            'Copy Sheet moved to a persistent footer button on Student Details.',
            'Fixed a broken Prompt icon in the footer.',
            'Performance: fewer redundant window-resize calls and less per-click overhead.',
        ],
    },
    {
        version: '1.9.3',
        notes: [
            'Added app info panel.',
            'Four-tab comment editor: Accept, AI Reject, Copy Reject, Prompt.',
            'Styled scrollbars throughout the app.',
        ],
    },
    {
        version: '1.9.2',
        notes: [
            'Copy Reject and Prompt editors available side by side.',
        ],
    },
    {
        version: '1.9.0',
        notes: [
            'Student details sheet with unit codes and marks.',
        ],
    },
];

function appBuildDate() {
    try {
        const st = fs.statSync(app.getPath('exe'));
        const d = st.birthtime || st.mtime;
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return 'Unknown';
    }
}

let popupWindow = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let quickState = [];

// Matches a typical unit-code pattern: a run of letters immediately
// followed by a run of digits (e.g. "CPCCCA3019", "CPCWHS3001").
// Anything before or after this pattern in the filename is ignored.
const UNIT_CODE_PATTERN = /[A-Za-z]{2,10}\d{2,6}/;

let stats = { copyCount: 0 };
const statsFile = () => path.join(app.getPath('userData'), 'stats.json');
function loadStats() {
    try {
        stats = JSON.parse(fs.readFileSync(statsFile(), 'utf8'));
    } catch (e) {
        stats = { copyCount: 0 };
    }
    if (typeof stats.copyCount !== 'number') stats.copyCount = 0;
}
function saveStats() {
    try {
        fs.writeFileSync(statsFile(), JSON.stringify(stats));
    } catch (e) {}
}

function deriveOrganizerFolderName(fileName) {
    const match = fileName.match(UNIT_CODE_PATTERN);
    if (match) {
        return match[0].toUpperCase();
    }

    // Fallback for filenames with no recognizable unit-code pattern:
    // keep the previous "first token" behavior so nothing is silently skipped.
    let folder;
    if (fileName.includes('-')) {
        folder = fileName.split('-')[0];
    } else {
        folder = fileName.split(' ')[0];
    }
    folder = folder.trim();
    folder = folder.replace(/final$/i, '');
    return folder.trim();
}

function safeMoveSync(src, dest) {
    try {
        fs.renameSync(src, dest);
    } catch (err) {
        if (err.code === 'EXDEV') {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
        } else {
            throw err;
        }
    }
}

ipcMain.handle('comment-copier:copy', (event, text, count) => {
    clipboard.writeText(text);
    if (count !== false) {
        stats.copyCount++;
        saveStats();
    }
    return true;
});

ipcMain.handle('comment-copier:app-info', () => {
    const platform = PLATFORM_NAMES[process.platform] || process.platform;
    const display = screen.getPrimaryDisplay();
    return {
        name: 'Comment Copier',
        version: app.getVersion(),
        description: 'Comment Copier \u2014 Unique Every Time. Copy unique accept/reject comments for grading.',
        author: '@gagan.design.07',
        license: 'MIT',
        repository: 'https://github.com/GagandeepSingh07/Comment-Copier-main',
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        platform: `${platform} ${process.arch === 'x64' ? 'x64' : process.arch}`,
        resolution: `${display.size.width} x ${display.size.height}`,
        exePath: app.getPath('exe'),
        userData: app.getPath('userData'),
        buildDate: appBuildDate(),
        copyCount: stats.copyCount,
        changelog: CHANGELOG,
    };
});

ipcMain.handle('comment-copier:open-external', (event, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
        return true;
    }
    return false;
});

function isNewerVersion(latest, current) {
    const pa = String(latest).split('.').map(Number);
    const pb = String(current).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const a = pa[i] || 0;
        const b = pb[i] || 0;
        if (a > b) return true;
        if (a < b) return false;
    }
    return false;
}

ipcMain.handle('comment-copier:check-updates', () => {
    return new Promise((resolve) => {
        const url = 'https://api.github.com/repos/GagandeepSingh07/Comment-Copier-main/releases/latest';
        const req = https.get(url, {
            headers: { 'User-Agent': 'Comment Copier', Accept: 'application/vnd.github+json' },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    resolve({
                        ok: false,
                        error: res.statusCode === 404
                            ? 'No releases on GitHub yet.'
                            : 'Update check failed.',
                    });
                    return;
                }
                try {
                    const data = JSON.parse(body);
                    const latest = String(data.tag_name || '').replace(/^v/i, '');
                    const current = app.getVersion();
                    if (!latest) {
                        resolve({ ok: false, error: 'Could not read the latest release.' });
                        return;
                    }
                    resolve({ ok: true, latest, current, updateAvailable: isNewerVersion(latest, current) });
                } catch (e) {
                    resolve({ ok: false, error: 'Could not read the latest release.' });
                }
            });
        });
        req.on('error', () => resolve({ ok: false, error: 'Network error \u2014 check your connection.' }));
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ ok: false, error: 'Update check timed out.' });
        });
    });
});

ipcMain.handle('comment-copier:copy-sheet', (event, html, text) => {
    if (typeof html !== 'string' || !html) return false;
    clipboard.write({ html, text: typeof text === 'string' ? text : '' });
    return true;
});

let nativeDialogOpen = false;

ipcMain.handle('file-organizer:pick-folder', async () => {
    if (!popupWindow || popupWindow.isDestroyed()) return null;
    nativeDialogOpen = true;
    let result;
    try {
        result = await dialog.showOpenDialog(popupWindow, {
            properties: ['openDirectory'],
            title: 'Choose a folder to organize',
        });
    } finally {
        nativeDialogOpen = false;
    }
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
});

ipcMain.handle('file-organizer:organize', async (event, folderPath) => {
    if (typeof folderPath !== 'string' || !folderPath) {
        return { ok: false, error: 'No folder selected.' };
    }

    let stat;
    try {
        stat = fs.statSync(folderPath);
    } catch (e) {
        return { ok: false, error: 'Folder not found.' };
    }
    if (!stat.isDirectory()) {
        return { ok: false, error: 'That path is not a folder.' };
    }

    let entries;
    try {
        entries = fs.readdirSync(folderPath, { withFileTypes: true }).filter((d) => d.isFile());
    } catch (e) {
        return { ok: false, error: 'Could not read folder: ' + e.message };
    }

    let moved = 0;
    const skipped = [];

    for (const entry of entries) {
        const name = entry.name;
        const ext = path.extname(name).toLowerCase();
        if (ext === '.bat' || ext === '.ps1') {
            skipped.push({ file: name, reason: 'Tool file \u2014 left untouched' });
            continue;
        }

        const folder = deriveOrganizerFolderName(name);
        if (!folder) {
            skipped.push({ file: name, reason: 'Could not extract a folder name' });
            continue;
        }

        const destDir = path.join(folderPath, folder);
        try {
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        } catch (e) {
            skipped.push({ file: name, reason: 'Could not create folder: ' + e.message });
            continue;
        }

        const srcFile = path.join(folderPath, name);
        const baseName = path.basename(name, path.extname(name));
        const fileExt = path.extname(name);
        let finalName = name;
        let destFile = path.join(destDir, finalName);
        let suffix = 1;
        while (fs.existsSync(destFile) && suffix <= 1000) {
            finalName = `${baseName} (${suffix})${fileExt}`;
            destFile = path.join(destDir, finalName);
            suffix++;
        }
        if (fs.existsSync(destFile)) {
            skipped.push({ file: name, reason: `Destination folder '${folder}' has no free name available` });
            continue;
        }

        try {
            safeMoveSync(srcFile, destFile);
            moved++;
        } catch (e) {
            skipped.push({ file: name, reason: e.message });
        }
    }

    return { ok: true, moved, skipped, total: entries.length };
});

ipcMain.handle('sheet-import:read-clipboard', () => {
    let text = '';
    try {
        text = clipboard.readText() || '';
    } catch (e) {
        return { ok: false, error: 'Could not read the clipboard.' };
    }
    if (!text.trim()) {
        return { ok: false, error: 'Clipboard is empty \u2014 copy cells from Excel first.' };
    }
    return { ok: true, text };
});

ipcMain.handle('backup:export', async (event, payload) => {
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : popupWindow;
    if (!owner) return { ok: false, error: 'No window to attach the dialog to.' };
    const stamp = new Date().toISOString().slice(0, 10);
    let result;
    try {
        result = await dialog.showSaveDialog(owner, {
            title: 'Back up Comment Copier data',
            defaultPath: `comment-copier-backup-${stamp}.json`,
            filters: [{ name: 'JSON backup', extensions: ['json'] }],
        });
    } catch (e) {
        return { ok: false, error: 'Could not open the save dialog.' };
    }
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
        fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
        return { ok: false, error: 'Could not write the backup file.' };
    }
    return { ok: true, filePath: result.filePath };
});

ipcMain.handle('backup:import', async (event) => {
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : popupWindow;
    if (!owner) return { ok: false, error: 'No window to attach the dialog to.' };
    let result;
    try {
        result = await dialog.showOpenDialog(owner, {
            title: 'Restore Comment Copier data',
            properties: ['openFile'],
            filters: [{ name: 'JSON backup', extensions: ['json'] }],
        });
    } catch (e) {
        return { ok: false, error: 'Could not open the file dialog.' };
    }
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
        return { ok: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return { ok: false, error: 'Could not read the backup file.' };
    }
    try {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') return { ok: true, data };
        return { ok: false, error: 'Backup file has no data.' };
    } catch (e) {
        return { ok: false, error: 'Backup file is not valid JSON.' };
    }
});

ipcMain.handle('app:set-login-item', (event, enabled) => {
    try {
        app.setLoginItemSettings({ openAtLogin: !!enabled });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: 'Couldn\u2019t update the startup setting.' };
    }
});

ipcMain.handle('app:get-login-item', () => {
    try {
        const settings = app.getLoginItemSettings();
        return !!settings.openAtLogin;
    } catch (e) {
        return false;
    }
});

let registeredHotkey = null;
const configFile = () => path.join(app.getPath('userData'), 'config.json');
function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configFile(), 'utf8')) || {};
    } catch (e) {
        return {};
    }
}
function saveConfig(partial) {
    try {
        const cfg = Object.assign({}, loadConfig(), partial);
        fs.writeFileSync(configFile(), JSON.stringify(cfg), 'utf8');
    } catch (e) {}
}

function registerHotkey(accelerator) {
    const previous = registeredHotkey;
    if (!accelerator) {
        if (previous) {
            try {
                if (globalShortcut.isRegistered(previous)) globalShortcut.unregister(previous);
            } catch (e) {}
        }
        registeredHotkey = null;
        return { ok: true, registered: false, accelerator: '' };
    }
    try {
        const ok = globalShortcut.register(String(accelerator), () => {
            if (popupWindow && !popupWindow.isDestroyed()) {
                togglePopup();
            }
        });
        if (!ok) {
            // Registration failed — leave the previously-working hotkey (if any)
            // registered and untouched rather than leaving the app with none.
            return { ok: false, error: 'That shortcut is already in use or not available.', current: previous || '' };
        }
        // New accelerator registered successfully — now it's safe to release the old one.
        if (previous && previous !== String(accelerator)) {
            try {
                if (globalShortcut.isRegistered(previous)) globalShortcut.unregister(previous);
            } catch (e) {}
        }
        registeredHotkey = String(accelerator);
        saveConfig({ globalHotkey: String(accelerator) });
        return { ok: true, registered: true, accelerator: String(accelerator) };
    } catch (e) {
        return { ok: false, error: 'That shortcut is not valid.', current: previous || '' };
    }
}

ipcMain.handle('hotkey:set', (event, accelerator) => {
    const result = registerHotkey(accelerator);
    if (result.ok && !result.registered) saveConfig({ globalHotkey: '' });
    return result;
});

ipcMain.handle('hotkey:get', () => registeredHotkey || loadConfig().globalHotkey || '');

ipcMain.on('comment-copier:quick-state', (event, payload) => {
    if (Array.isArray(payload)) {
        quickState = payload;
        if (tray && !tray.isDestroyed()) {
            const acc = quickState.find((q) => q.key === 'accept');
            tray.setToolTip(acc && acc.total
                ? `Comment Copier \u2014 Accept ${acc.index + 1} of ${acc.total}`
                : 'Comment Copier');
        }
    }
});

ipcMain.on('comment-copier:tray-copied', (event, info) => {
    if (info && !info.ok && tray && !tray.isDestroyed()) {
        tray.displayBalloon({
            iconType: 'warning',
            title: 'Copy Failed',
            content: `${info.label}: copy failed, please copy manually.`,
        });
    }
});

ipcMain.on('popup:quit', () => app.quit());

ipcMain.on('popup:close', () => hidePopup());

ipcMain.on('comment-copier:open-main', () => {
    openMainWindow();
});

ipcMain.on('popup:resize', (event, size) => {
    if (!popupWindow || popupWindow.isDestroyed()) return;
    const h = size && typeof size === 'object' ? size.height : size;
    const w = size && typeof size === 'object' ? size.width : POPUP_WIDTH;
    const height = Math.min(Math.max(Math.round(h), POPUP_MIN_HEIGHT), POPUP_MAX_HEIGHT);
    const width = Math.min(Math.max(Math.round(w), POPUP_WIDTH), POPUP_MAX_WIDTH);
    popupWindow.setContentSize(width, height);
    if (popupWindow.isVisible()) positionPopup();
});

function hidePopup() {
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.hide();
        popupWindow.webContents.send('popup:closed');
    }
}

function positionPopup() {
    const tb = tray.getBounds();
    const pb = popupWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: tb.x, y: tb.y });
    const wa = display.workArea;
    const margin = 8;
    // Pin to the work area's bottom-right corner (typical tray-flyout spot)
    // instead of anchoring off the tray icon's own bounds, so every layout
    // lands in the same on-screen corner regardless of window size.
    let x = wa.x + wa.width - pb.width - margin;
    let y = wa.y + wa.height - pb.height - margin;
    x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - pb.width - 4));
    y = Math.max(wa.y + 4, Math.min(y, wa.y + wa.height - pb.height - 4));
    popupWindow.setPosition(Math.round(x), Math.round(y));
}

function togglePopup() {
    if (!popupWindow || popupWindow.isDestroyed()) return;
    if (popupWindow.isVisible()) {
        hidePopup();
        return;
    }
    positionPopup();
    popupWindow.show();
    popupWindow.focus();
}

function createPopup() {
    popupWindow = new BrowserWindow({
        width: POPUP_WIDTH,
        height: 440,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        backgroundColor: '#010409',
        webPreferences: {
            preload: path.join(__dirname, 'popup-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });

    popupWindow.loadFile('popup.html');

    popupWindow.on('blur', () => {
        if (!nativeDialogOpen) hidePopup();
    });

    popupWindow.on('closed', () => {
        popupWindow = null;
    });

    if (process.env.SMOKE_TEST) {
        popupWindow.webContents.once('did-finish-load', () => {
            setTimeout(async () => {
                try {
                    const popup = await popupWindow.webContents.executeJavaScript(`JSON.stringify({
                        head: document.querySelector('.head-title').textContent,
                        total: document.getElementById('total-count').textContent,
                        rows: document.querySelectorAll('.row').length,
                        labels: [...document.querySelectorAll('.name')].map((e) => e.textContent),
                        positions: [...document.querySelectorAll('.pos')].map((e) => e.textContent),
                        etabs: [...document.querySelectorAll('.etab')].map((e) => e.textContent),
                        actions: [...document.querySelectorAll('.action')].map((e) => e.textContent),
                        textareas: document.querySelectorAll('textarea').length,
                    })`);
                    console.log('SMOKE popup:', popup);
                    console.log('SMOKE quickStateItems:', quickState.length);

                    await popupWindow.webContents.executeJavaScript(`document.querySelector('.row[data-key="accept"]').click()`);
                    await new Promise((r) => setTimeout(r, 800));
                    console.log('SMOKE copy-clipboard:', clipboard.readText().slice(0, 60));
                    console.log('SMOKE quickState-after:', JSON.stringify(quickState));

                    await popupWindow.webContents.executeJavaScript(`document.getElementById('prompt-btn').click()`);
                    await new Promise((r) => setTimeout(r, 300));
                    console.log('SMOKE prompt-clipboard:', clipboard.readText().slice(0, 60));

                    await popupWindow.webContents.executeJavaScript(`document.getElementById('sheet-btn').click()`);
                    await new Promise((r) => setTimeout(r, 300));
                    console.log('SMOKE sheet-clipboard-html:', clipboard.readHTML().slice(0, 120));
                    console.log('SMOKE sheet-clipboard-text:', clipboard.readText().slice(0, 60));

                    openMainWindow();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.once('did-finish-load', () => {
                            setTimeout(async () => {
                                await new Promise((r) => setTimeout(r, 300));
                                try {
                                    const mainWin = await mainWindow.webContents.executeJavaScript(`JSON.stringify({
                                        nav: [...document.querySelectorAll('.nav-item')].map((e) => e.textContent.trim()),
                                        panels: document.querySelectorAll('[data-view-panel]').length,
                                        etabs: [...document.querySelectorAll('.etab')].map((e) => e.textContent),
                                        commentCards: document.querySelectorAll('#comment-list .comment-card').length,
                                        promptTextarea: !!document.getElementById('prompt-text'),
                                        saveStatus: document.getElementById('save-status').textContent,
                                    })`);
                                    console.log('SMOKE main-window:', mainWin);

                                    await mainWindow.webContents.executeJavaScript(`document.querySelector('.nav-item[data-view="settings"]').click()`);
                                    await new Promise((r) => setTimeout(r, 100));
                                    console.log('SMOKE main-settings-active:', await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-view-panel="settings"]').classList.contains('active')`));

                                    await mainWindow.webContents.executeJavaScript(`document.querySelector('.nav-item[data-view="about"]').click()`);
                                    await new Promise((r) => setTimeout(r, 300));
                                    console.log('SMOKE main-about-name:', await mainWindow.webContents.executeJavaScript(`document.getElementById('mw-info-name').textContent`));
                                } catch (e) {
                                    console.error('Main-window smoke test failed:', e);
                                }
                                setTimeout(() => app.quit(), 300);
                            }, 200);
                        });
                    } else {
                        setTimeout(() => app.quit(), 300);
                    }
                } catch (e) {
                    console.error('Smoke test failed:', e);
                    setTimeout(() => app.quit(), 300);
                }
            }, 2500);
        });
    }
}

function windowBoundsInBounds(b) {
    if (!b || typeof b.width !== 'number' || typeof b.height !== 'number') return false;
    if (b.width < 520 || b.height < 400) return false;
    const displays = screen.getAllDisplays();
    return displays.some((d) => {
        const wa = d.workArea;
        const overlapX = b.x < wa.x + wa.width && b.x + b.width > wa.x;
        const overlapY = b.y < wa.y + wa.height && b.y + b.height > wa.y;
        return overlapX && overlapY;
    });
}

function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) return;

    const saved = windowBoundsInBounds(loadConfig().mainWindowBounds) ? loadConfig().mainWindowBounds : null;
    const opts = {
        width: saved ? saved.width : 900,
        height: saved ? saved.height : 620,
        minWidth: 520,
        minHeight: 400,
        show: false,
        backgroundColor: '#0d1117',
        title: 'Comment Copier',
        icon: path.join(__dirname, 'build', 'icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'mainwindow-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    };
    if (saved) {
        opts.x = Math.round(saved.x);
        opts.y = Math.round(saved.y);
    }
    mainWindow = new BrowserWindow(opts);

    mainWindow.loadFile('mainwindow.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    let boundsTimer = null;
    const rememberBounds = () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMaximized() || mainWindow.isMinimized() || mainWindow.isFullScreen()) return;
        clearTimeout(boundsTimer);
        boundsTimer = setTimeout(() => {
            try {
                saveConfig({ mainWindowBounds: mainWindow.getBounds() });
            } catch (e) {}
        }, 400);
    };
    mainWindow.on('resize', rememberBounds);
    mainWindow.on('move', rememberBounds);

    // Keep the app alive (tray app); closing the main window just hides it.
    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function openMainWindow() {
    createMainWindow();
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'build', 'tray.png'));
    tray.setToolTip('Comment Copier');
    tray.on('click', togglePopup);
    tray.on('right-click', togglePopup);
}

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('second-instance', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
        positionPopup();
        popupWindow.show();
        popupWindow.focus();
    }
    openMainWindow();
});

app.whenReady().then(() => {
    loadStats();
    createPopup();
    createTray();
    registerHotkey(loadConfig().globalHotkey || '');
});

}
