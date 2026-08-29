const { app, BrowserWindow, ipcMain, clipboard, Tray, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

ipcMain.handle('comment-copier:copy', (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle('comment-copier:app-info', () => {
    const platform = PLATFORM_NAMES[process.platform] || process.platform;
    return {
        name: 'Comment Copier',
        version: app.getVersion(),
        description: 'Comment Copier \u2014 Unique Every Time. Copy unique accept/reject comments for grading.',
        author: '@gagan.design.07',
        license: 'MIT',
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        platform: `${platform} ${process.arch === 'x64' ? 'x64' : process.arch}`,
        userData: app.getPath('userData'),
        buildDate: appBuildDate(),
        changelog: CHANGELOG,
    };
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

function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) return;

    mainWindow = new BrowserWindow({
        width: 900,
        height: 620,
        minWidth: 520,
        minHeight: 400,
        show: false,
        backgroundColor: '#0d1117',
        title: 'Comment Copier',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'mainwindow-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });

    mainWindow.loadFile('mainwindow.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

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
    createPopup();
    createTray();
});

}
