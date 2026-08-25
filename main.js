const { app, BrowserWindow, ipcMain, clipboard, Tray, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(app.getPath('temp'), 'comment-copier'));

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    main();
}

// ---------------------------------------------------------------------------
// Dependency-free .xlsx reader.
// An .xlsx file is a ZIP archive of XML parts. We: (1) walk the ZIP central
// directory to locate the worksheet and shared-strings entries, (2) inflate
// them, and (3) parse the XML into a plain 2D array of row/cell text — no
// external packages required.
// ---------------------------------------------------------------------------

function listZipEntries(buffer) {
    const EOCD_SIG = 0x06054b50;
    const CD_SIG = 0x02014b50;
    const minLen = 22;
    let eocdOffset = -1;
    const searchFloor = Math.max(0, buffer.length - minLen - 65535);
    for (let i = buffer.length - minLen; i >= searchFloor; i--) {
        if (buffer.readUInt32LE(i) === EOCD_SIG) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset === -1) throw new Error('Not a valid .xlsx file (zip signature not found)');

    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    let cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = [];
    for (let n = 0; n < totalEntries; n++) {
        if (buffer.readUInt32LE(cdOffset) !== CD_SIG) break;
        const compMethod = buffer.readUInt16LE(cdOffset + 10);
        const compSize = buffer.readUInt32LE(cdOffset + 20);
        const nameLen = buffer.readUInt16LE(cdOffset + 28);
        const extraLen = buffer.readUInt16LE(cdOffset + 30);
        const commentLen = buffer.readUInt16LE(cdOffset + 32);
        const localOffset = buffer.readUInt32LE(cdOffset + 42);
        const name = buffer.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);
        entries.push({ name, compMethod, compSize, localOffset });
        cdOffset += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

function extractZipEntry(buffer, entry) {
    const LOCAL_SIG = 0x04034b50;
    if (buffer.readUInt32LE(entry.localOffset) !== LOCAL_SIG) {
        throw new Error('Corrupt zip entry: ' + entry.name);
    }
    const nameLen = buffer.readUInt16LE(entry.localOffset + 26);
    const extraLen = buffer.readUInt16LE(entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + nameLen + extraLen;
    const compData = buffer.slice(dataStart, dataStart + entry.compSize);
    if (entry.compMethod === 0) return compData;
    if (entry.compMethod === 8) return zlib.inflateRawSync(compData);
    throw new Error('Unsupported compression method in xlsx file');
}

function decodeXmlEntities(str) {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&amp;/g, '&');
}

function parseSharedStrings(xml) {
    if (!xml) return [];
    const strings = [];
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(xml))) {
        const parts = [];
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tm;
        while ((tm = tRe.exec(m[1]))) parts.push(decodeXmlEntities(tm[1]));
        strings.push(parts.join(''));
    }
    return strings;
}

function colLetterToIndex(letters) {
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
        idx = idx * 26 + (letters.charCodeAt(i) - 64);
    }
    return idx; // 1-based
}

function parseSheetRows(xml, sharedStrings) {
    const rows = [];
    const rowRe = /<row\b([^>]*)(?:\/>|>([\s\S]*?)<\/row>)/g;
    let rm;
    while ((rm = rowRe.exec(xml))) {
        const attrs = rm[1];
        const inner = rm[2] || '';
        const rMatch = attrs.match(/\br="(\d+)"/);
        const rowNum = rMatch ? parseInt(rMatch[1], 10) : rows.length + 1;
        const rowArr = [];
        const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
        let cm;
        while ((cm = cellRe.exec(inner))) {
            const cAttrs = cm[1];
            const cInner = cm[2] || '';
            const refMatch = cAttrs.match(/\br="([A-Z]+)\d+"/);
            const typeMatch = cAttrs.match(/\bt="([^"]+)"/);
            const type = typeMatch ? typeMatch[1] : null;
            let value = '';
            if (type === 'inlineStr') {
                const parts = [];
                const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
                let tm;
                while ((tm = tRe.exec(cInner))) parts.push(decodeXmlEntities(tm[1]));
                value = parts.join('');
            } else {
                const vMatch = cInner.match(/<v>([\s\S]*?)<\/v>/);
                const raw = vMatch ? vMatch[1] : '';
                if (type === 's') {
                    const idx = parseInt(raw, 10);
                    value = sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
                } else if (type === 'str' || type === 'b') {
                    value = decodeXmlEntities(raw);
                } else {
                    value = raw; // plain number
                }
            }
            const colIdx = refMatch ? colLetterToIndex(refMatch[1]) : rowArr.length + 1;
            rowArr[colIdx - 1] = value;
        }
        for (let i = 0; i < rowArr.length; i++) if (rowArr[i] === undefined) rowArr[i] = '';
        rows[rowNum - 1] = rowArr;
    }
    for (let i = 0; i < rows.length; i++) if (rows[i] === undefined) rows[i] = [];
    return rows;
}

function parseXlsxToRows(buffer) {
    const entries = listZipEntries(buffer);
    const sheetEntry = entries
        .filter((e) => /^xl\/worksheets\/sheet(\d+)\.xml$/i.test(e.name))
        .sort((a, b) => {
            const na = parseInt(a.name.match(/(\d+)/)[1], 10);
            const nb = parseInt(b.name.match(/(\d+)/)[1], 10);
            return na - nb;
        })[0];
    if (!sheetEntry) throw new Error('No worksheet found in that file');
    const sharedEntry = entries.find((e) => e.name === 'xl/sharedStrings.xml');

    const sheetXml = extractZipEntry(buffer, sheetEntry).toString('utf8');
    const sharedXml = sharedEntry ? extractZipEntry(buffer, sharedEntry).toString('utf8') : '';
    const sharedStrings = parseSharedStrings(sharedXml);
    return parseSheetRows(sheetXml, sharedStrings);
}

function main() {

const POPUP_WIDTH = 420;
const POPUP_MAX_WIDTH = 900;
const POPUP_MIN_HEIGHT = 380;
const POPUP_MAX_HEIGHT = 660;

const PLATFORM_NAMES = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

const CHANGELOG = [
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

ipcMain.handle('sheet-import:pick-and-parse', async () => {
    if (!popupWindow || popupWindow.isDestroyed()) return null;
    nativeDialogOpen = true;
    let result;
    try {
        result = await dialog.showOpenDialog(popupWindow, {
            properties: ['openFile'],
            title: 'Choose an Excel file to import',
            filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        });
    } finally {
        nativeDialogOpen = false;
    }
    if (result.canceled || !result.filePaths.length) return null;

    try {
        const buffer = fs.readFileSync(result.filePaths[0]);
        const rows = parseXlsxToRows(buffer);
        return { ok: true, rows };
    } catch (e) {
        return { ok: false, error: 'Could not read that Excel file \u2014 ' + e.message };
    }
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

                    await popupWindow.webContents.executeJavaScript(`document.querySelector('.row[data-key="accept"] [data-act="copy"]').click()`);
                    await new Promise((r) => setTimeout(r, 800));
                    console.log('SMOKE copy-clipboard:', clipboard.readText().slice(0, 60));
                    console.log('SMOKE quickState-after:', JSON.stringify(quickState));

                    await popupWindow.webContents.executeJavaScript(`document.getElementById('editor-toggle').click()`);
                    await new Promise((r) => setTimeout(r, 200));
                    console.log('SMOKE editor-open:', await popupWindow.webContents.executeJavaScript(`document.getElementById('editor').classList.contains('open')`));

                    await popupWindow.webContents.executeJavaScript(`document.getElementById('save-btn').click()`);
                    await new Promise((r) => setTimeout(r, 300));
                    console.log('SMOKE save-status:', await popupWindow.webContents.executeJavaScript(`document.getElementById('save-status').textContent`));

                    await popupWindow.webContents.executeJavaScript(`document.getElementById('prompt-btn').click()`);
                    await new Promise((r) => setTimeout(r, 300));
                    console.log('SMOKE prompt-clipboard:', clipboard.readText().slice(0, 60));

                    await popupWindow.webContents.executeJavaScript(`document.getElementById('sheet-btn').click()`);
                    await new Promise((r) => setTimeout(r, 300));
                    console.log('SMOKE sheet-clipboard-html:', clipboard.readHTML().slice(0, 120));
                    console.log('SMOKE sheet-clipboard-text:', clipboard.readText().slice(0, 60));
                } catch (e) {
                    console.error('Smoke test failed:', e);
                }
                setTimeout(() => app.quit(), 300);
            }, 2500);
        });
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
});

app.whenReady().then(() => {
    createPopup();
    createTray();
});

}
