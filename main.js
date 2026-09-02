const { app, BrowserWindow, ipcMain, clipboard, nativeImage, Tray, screen, dialog, shell, globalShortcut, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const https = require('https');

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'signature',
        privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
]);

app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.disableHardwareAcceleration();

function portablePointerFile() {
    return path.join(app.getPath('appData'), 'comment-copier', 'portable.json');
}
function readPortablePointer() {
    try {
        const p = JSON.parse(fs.readFileSync(portablePointerFile(), 'utf8'));
        if (p && typeof p.dir === 'string' && p.dir && fs.existsSync(p.dir) && fs.statSync(p.dir).isDirectory()) {
            return { enabled: true, dir: p.dir };
        }
    } catch (e) { /* ignore */ }
    return { enabled: false, dir: '' };
}
function defaultDataRoot() {
    return path.join(app.getPath('appData'), 'comment-copier');
}
// Old (buggy) default: data used to live under the OS temp folder, which
// the OS/antivirus/cleanup tools can wipe at any time — this is what was
// causing all settings/comments to appear "erased". Kept only so existing
// installs can be migrated forward one time to the real appData location.
function legacyTempDataRoot() {
    return path.join(app.getPath('temp'), 'comment-copier');
}
function writePortablePointer(dir) {
    if (dir) {
        fs.mkdirSync(path.dirname(portablePointerFile()), { recursive: true });
        fs.writeFileSync(portablePointerFile(), JSON.stringify({ enabled: true, dir }, null, 2), 'utf8');
    } else {
        try { fs.unlinkSync(portablePointerFile()); } catch (e) { /* ignore */ }
    }
}
function copyDirSync(src, dst) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        if (entry.isDirectory()) copyDirSync(s, d);
        else if (entry.isFile()) { try { fs.copyFileSync(s, d); } catch (e) { /* skip locked files */ } }
    }
}
function migrateData(from, to) {
    if (from === to || !fs.existsSync(from)) return true;
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (entry.name === 'portable.json') continue;
        const s = path.join(from, entry.name);
        const d = path.join(to, entry.name);
        if (entry.isDirectory()) copyDirSync(s, d);
        else if (entry.isFile()) { try { fs.copyFileSync(s, d); } catch (e) { /* skip locked files */ } }
    }
    return true;
}

const portableMode = readPortablePointer();
const resolvedDataRoot = portableMode.enabled ? portableMode.dir : defaultDataRoot();
// One-time migration for installs affected by the old temp-folder bug:
// if the real data root is empty but the legacy temp location still has
// data (i.e. it survived until this launch), copy it over before anything
// reads from resolvedDataRoot.
if (!portableMode.enabled) {
    try {
        const legacy = legacyTempDataRoot();
        const legacyHasData = fs.existsSync(legacy) && fs.readdirSync(legacy).length > 0;
        const newHasData = fs.existsSync(resolvedDataRoot) && fs.readdirSync(resolvedDataRoot).length > 0;
        if (legacyHasData && !newHasData) {
            migrateData(legacy, resolvedDataRoot);
        }
    } catch (e) { /* ignore — fall through to a fresh data root */ }
}
app.setPath('userData', resolvedDataRoot);

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
        version: '1.15.8',
        categories: [
            {
                heading: 'Improved',
                notes: [
                    'The language selector is now a custom, themed dropdown showing each language in its native name and English, and defaults to English.',
                    'The About page now shows just the details that matter: the "Latest update" reflects the current app version automatically, and sensitive install/data paths plus engine version numbers are hidden from view (still available in Export diagnostics).',
                    'The About section is fully responsive and the Comment Editor navigation icon was refreshed.',
                    'The File Organizer is customizable: choose where files go (same folder or a custom target), how name clashes are handled (rename, skip, or overwrite), which file types to skip, and whether to include subfolders. A preview button shows what would be moved before doing it.',
                ],
            },
        ],
    },
    {
        version: '1.15.5',
        categories: [
            {
                heading: 'New',
                notes: [
                    'Shortcuts are now editable: open the Shortcuts page, click a shortcut, and press the new key combination to rebind it (must include Ctrl, Shift, or Alt).',
                    'The global hotkey works the same way: click it, then press the key combination to use (or click the \u00d7 to remove it).',
                    'Shortcuts persist between launches and are included in Backup/Restore.',
                    'You can reset any shortcut back to its default with its reset button.',
                ],
            },
        ],
    },
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

// Resolve a signature image source to a loadable path. Bundled signatures
// live in /signatures and are referenced by bare filename; user-picked
// signature images are stored as full file paths.
function resolveSignaturePath(filename) {
    if (typeof filename !== 'string' || !filename) return null;
    if (filename.includes('..') || filename.includes('\\')) return null;
    if (filename.includes('/')) {
        // A user-picked signature stored as a full path.
        if (!fs.existsSync(filename)) return null;
        return filename;
    }
    // Bare filename -> bundled /signatures.
    return path.join(__dirname, 'signatures', filename);
}

ipcMain.handle('comment-copier:copy-signature', (event, filename) => {
    const p = resolveSignaturePath(filename);
    if (!p) return false;
    const img = nativeImage.createFromPath(p);
    if (img.isEmpty()) return false;
    clipboard.writeImage(img);
    stats.copyCount++;
    saveStats();
    return true;
});

// Open a file picker for a trainer signature image. Returns the chosen full
// path (or null if cancelled). Used by the main-window Courses & Trainers form.
ipcMain.handle('comment-copier:pick-signature', async (event) => {
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : popupWindow;
    if (!owner) return { ok: false, canceled: true };
    let result;
    try {
        result = await dialog.showOpenDialog(owner, {
            title: 'Choose trainer signature image',
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] }],
        });
    } catch (e) {
        return { ok: false, canceled: true };
    }
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
        return { ok: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) return { ok: false, error: 'Could not read that image.' };
    return { ok: true, filePath };
});

// Combined "Copy All" for a saved course preset: puts the plain-text details
// and the trainer signature image on the clipboard in one write, so image-only
// presets (no text signature) aren't silently dropped.
ipcMain.handle('comment-copier:copy-course', (event, payload) => {
    const text = payload && typeof payload.text === 'string' ? payload.text : '';
    const file = payload && typeof payload.image === 'string' ? payload.image : '';
    let img = null;
    const p = resolveSignaturePath(file);
    if (p) {
        const shot = nativeImage.createFromPath(p);
        if (!shot.isEmpty()) img = shot;
    }
    if (!text && !img) return false;
    const data = { text };
    if (img) data.image = img;
    clipboard.write(data);
    stats.copyCount++;
    saveStats();
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
        helper: '@nishaaujla46',
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

function latestFromReleases(list) {
    let best = null;
    for (const item of list || []) {
        if (!item || item.draft) continue;
        const v = String(item.tag_name || '').replace(/^v/i, '');
        if (v && (!best || isNewerVersion(v, best))) best = v;
    }
    return best;
}

ipcMain.handle('comment-copier:check-updates', (event, channel) => {
    return new Promise((resolve) => {
        const beta = channel === 'beta';
        const url = 'https://api.github.com/repos/GagandeepSingh07/Comment-Copier-main/releases';
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
                    const list = Array.isArray(data) ? data : [data];
                    const latest = latestFromReleases(beta ? list : list.filter((r) => !r.prerelease));
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

ipcMain.handle('comment-copier:choose-portable-dir', async (event, title) => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const opts = {
        title: typeof title === 'string' && title ? title : 'Choose a folder for Comment Copier data',
        properties: ['openDirectory', 'createDirectory'],
    };
    if (process.env.PORTABLE_EXECUTABLE_DIR) opts.defaultPath = process.env.PORTABLE_EXECUTABLE_DIR;
    else opts.defaultPath = path.join(app.getPath('documents'), 'Comment Copier Data');
    const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
});

ipcMain.handle('comment-copier:get-portable-mode', () => {
    const p = readPortablePointer();
    return { enabled: p.enabled, dir: p.dir, root: app.getPath('userData') };
});

ipcMain.handle('comment-copier:enable-portable-mode', (event, dir) => {
    try {
        if (typeof dir !== 'string' || !dir.trim()) return { ok: false };
        const target = dir.trim();
        fs.mkdirSync(target, { recursive: true });
        if (app.getPath('userData') !== target) {
            migrateData(app.getPath('userData'), target);
        }
        writePortablePointer(target);
        return { ok: true, dir: target };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('comment-copier:disable-portable-mode', () => {
    try {
        const p = readPortablePointer();
        if (p.enabled && app.getPath('userData') === p.dir) {
            migrateData(p.dir, defaultDataRoot());
        }
        writePortablePointer('');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
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

function normalizeSkipExts(raw) {
    if (!raw) return [];
    return String(raw).split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}

function collectOrganizerEntries(root, recursive) {
    const out = [];
    const walk = (dir) => {
        let list;
        try {
            list = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            return;
        }
        for (const d of list) {
            if (d.isFile()) {
                out.push({ dir, name: d.name });
            } else if (recursive && d.isDirectory()) {
                walk(path.join(dir, d.name));
            }
        }
    };
    walk(root);
    return out;
}

ipcMain.handle('file-organizer:organize', async (event, folderPath, options) => {
    options = options || {};
    const destMode = options.destMode === 'custom' ? 'custom' : 'same';
    const conflict = options.conflict === 'skip' || options.conflict === 'overwrite' ? options.conflict : 'rename';
    const dryRun = !!options.dryRun;
    const skipExts = normalizeSkipExts(options.skipExt);
    const recursive = !!options.recursive;
    const targetFolder = destMode === 'custom' ? String(options.targetFolder || '') : '';

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

    if (destMode === 'custom') {
        if (!targetFolder) {
            return { ok: false, error: 'No target folder.' };
        }
        try {
            if (!fs.statSync(targetFolder).isDirectory()) {
                return { ok: false, error: 'Target is not a folder.' };
            }
        } catch (e) {
            return { ok: false, error: 'Target folder not found.' };
        }
    }

    let sweepFiles;
    try {
        sweepFiles = collectOrganizerEntries(folderPath, recursive);
    } catch (e) {
        return { ok: false, error: 'Could not read folder: ' + e.message };
    }

    let moved = 0;
    let planned = 0;
    const skipped = [];
    const previewMoves = [];

    // The destination base is either the source folder itself or the chosen
    // custom target folder. In dry-run mode no folder is ever created.
    const destBase = destMode === 'custom' ? targetFolder : folderPath;
    if (destMode === 'custom' && !dryRun) {
        try {
            if (!fs.existsSync(destBase)) fs.mkdirSync(destBase, { recursive: true });
        } catch (e) {
            return { ok: false, error: 'Could not create target folder: ' + e.message };
        }
    }

    for (const item of sweepFiles) {
        const { dir, name } = item;
        const rel = path.relative(folderPath, dir).split(path.sep).join('/');
        const displayName = rel ? rel + '/' + name : name;
        const extension = path.extname(name).toLowerCase().replace(/^\./, '');

        if (skipExts.includes(extension)) {
            skipped.push({ file: displayName, reason: 'Skipped file type ' + (extension || '(none)') });
            continue;
        }

        const folder = deriveOrganizerFolderName(name);
        if (!folder) {
            skipped.push({ file: displayName, reason: 'Could not extract a folder name' });
            continue;
        }

        const destDir = path.join(destBase, folder);
        try {
            if (!fs.existsSync(destDir) && !dryRun) fs.mkdirSync(destDir, { recursive: true });
        } catch (e) {
            skipped.push({ file: displayName, reason: 'Could not create folder: ' + e.message });
            continue;
        }

        const srcFile = path.join(dir, name);
        const baseName = path.basename(name, path.extname(name));
        const fileExt = path.extname(name);
        let finalName = name;
        let destFile = path.join(destDir, finalName);

        if (conflict === 'skip' && fs.existsSync(destFile)) {
            skipped.push({ file: displayName, reason: 'Already exists in target' });
            continue;
        }
        if (conflict === 'overwrite' && fs.existsSync(destFile)) {
            if (!dryRun) {
                try { fs.rmSync(destFile, { force: true }); } catch (e) {}
            }
        } else if (conflict === 'rename') {
            let suffix = 1;
            while (fs.existsSync(destFile) && suffix <= 1000) {
                finalName = `${baseName} (${suffix})${fileExt}`;
                destFile = path.join(destDir, finalName);
                suffix++;
            }
            if (fs.existsSync(destFile)) {
                skipped.push({ file: displayName, reason: `Destination folder '${folder}' has no free name available` });
                continue;
            }
        }

        planned++;
        previewMoves.push({ file: displayName, from: srcFile, to: destDir });
        if (dryRun) continue;

        try {
            safeMoveSync(srcFile, destFile);
            moved++;
        } catch (e) {
            skipped.push({ file: displayName, reason: e.message });
        }
    }

    return { ok: true, moved, planned, skipped, total: sweepFiles.length, preview: dryRun ? previewMoves : null };
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
    popupWindow = new BrowserWindow({        width: POPUP_WIDTH,
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

                    await popupWindow.webContents.executeJavaScript(`document.querySelector('.tab[data-tab="student"]').click()`);
                    await new Promise((r) => setTimeout(r, 200));
                    const courseSmoke = await popupWindow.webContents.executeJavaScript(`JSON.stringify({
                        items: document.querySelectorAll('#course-list .course-item').length,
                        header: document.querySelector('#course-list .course-item .course-item-header') ? document.querySelector('#course-list .course-item .course-item-header').textContent.trim() : '',
                        del: document.querySelector('#course-list .course-item .course-item-del') ? 1 : 0,
                    })`);
                    console.log('SMOKE course-list:', courseSmoke);

                    // The Course Detail dropdown shows the user a choice of
                    // courses (plus "All courses"); by default nothing is
                    // selected, so no course cards render until one is picked.
                    const filterSmoke = await popupWindow.webContents.executeJavaScript(`(() => {
                        const trigger = document.getElementById('course-filter-trigger');
                        const modalOptions = document.getElementById('course-filter-modal-options');
                        trigger.click();
                        const optionCount = [...modalOptions.querySelectorAll('.course-filter-option')].length;
                        const hasAll = [...modalOptions.querySelectorAll('.course-filter-option')].some((o) => o.dataset.value === '__all__');
                        const defaultValue = document.getElementById('course-filter-value').textContent;
                        const defaultPrompt = document.querySelector('#course-list .course-filter-prompt')
                            ? document.querySelector('#course-list .course-filter-prompt').textContent
                            : '';
                        const defaultItems = document.querySelectorAll('#course-list .course-item').length;
                        const painting = [...modalOptions.querySelectorAll('.course-filter-option')].find((o) => o.textContent.includes('Painting'));
                        painting.click();
                        const filteredItems = document.querySelectorAll('#course-list .course-item').length;
                        const filteredHeader = document.querySelector('#course-list .course-item .course-item-header')
                            ? document.querySelector('#course-list .course-item .course-item-header').textContent.trim()
                            : '';
                        const count = document.getElementById('course-list-count').textContent;
                        trigger.click();
                        const allOpt = [...modalOptions.querySelectorAll('.course-filter-option')].find((o) => o.dataset.value === '__all__');
                        allOpt.click();
                        const restored = document.querySelectorAll('#course-list .course-item').length;
                        // Return to the no-selection default and verify the list
                        // clears again (keeps repeat runs deterministic).
                        trigger.click();
                        const noneOpt = [...modalOptions.querySelectorAll('.course-filter-option')].find((o) => o.dataset.value === '');
                        noneOpt.click();
                        const cleared = document.querySelectorAll('#course-list .course-item').length;
                        return JSON.stringify({
                            optionCount,
                            hasAll,
                            hasNone: !!noneOpt,
                            defaultValue,
                            defaultPrompt,
                            defaultItems,
                            filteredItems,
                            isPainting: filteredHeader.indexOf('Painting') !== -1,
                            count,
                            restored,
                            cleared,
                        });
                    })()`);
                    console.log('SMOKE course-filter:', filterSmoke);

                    // A course with a bundled signature image copies text + the
                    // image together when its header ("copy all") is clicked.
                    // Select the painting course first (nothing shows by default).
                    const copyAll = await popupWindow.webContents.executeJavaScript(`(() => {
                        const trigger = document.getElementById('course-filter-trigger');
                        const modalOptions = document.getElementById('course-filter-modal-options');
                        let res = 'NO-ITEM';
                        trigger.click();
                        const painting = [...modalOptions.querySelectorAll('.course-filter-option')].find((o) => o.textContent.includes('Painting'));
                        if (!painting) return 'NO-OPTION';
                        painting.click();
                        const row = [...document.querySelectorAll('#course-list .course-item')].find((it) => it.textContent.includes('Sukhjinder'));
                        if (!row) return 'NO-ITEM';
                        const header = row.querySelector('.course-item-header');
                        if (!header) return 'NO-HEADER';
                        header.click();
                        res = 'CLICKED';
                        return res;
                    })()`);
                    await new Promise((r) => setTimeout(r, 500));
                    console.log('SMOKE copy-all:', copyAll, 'clipboard-has-image:', !clipboard.readImage().isEmpty(), 'text:', clipboard.readText().slice(0, 60));
                    // Leave the popup back on the no-selection default so repeat
                    // runs see the same initial state.
                    await popupWindow.webContents.executeJavaScript(`(() => {
                        const trigger = document.getElementById('course-filter-trigger');
                        trigger.click();
                        const noneOpt = [...document.getElementById('course-filter-modal-options').querySelectorAll('.course-filter-option')].find((o) => o.dataset.value === '');
                        noneOpt.click();
                    })()`);

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

                                    await mainWindow.webContents.executeJavaScript(`document.querySelector('.nav-item[data-view="courses"]').click()`);
                                    await new Promise((r) => setTimeout(r, 500));
                                    console.log('SMOKE main-courses:', await mainWindow.webContents.executeJavaScript(`JSON.stringify({
                                        active: document.querySelector('[data-view-panel="courses"]').classList.contains('active'),
                                        bannerHidden: document.getElementById('mw-course-banner').hidden,
                                        inputs: document.querySelectorAll('#mw-course-name, #mw-course-code, #mw-trainer-name').length,
                                        items: document.querySelectorAll('#mw-course-list .mw-course-item').length,
                                        copyTabs: document.querySelectorAll('#mw-course-list .mw-course-item')[0] ? document.querySelectorAll('#mw-course-list .mw-course-item .mw-course-mi').length : 0,
                                        noOverflow: (() => { const p = document.querySelector('[data-view-panel="courses"]'); const c = document.getElementById('mw-course-list'); return p.scrollWidth <= p.clientWidth && c.scrollWidth <= c.clientWidth && Array.from(c.querySelectorAll('.mw-course-item')).every(x => x.getBoundingClientRect().right <= p.getBoundingClientRect().right + 1); })(),
                                        firstTabs: Array.from(document.querySelectorAll('#mw-course-list .mw-course-item'))[0] ? Array.from(document.querySelectorAll('#mw-course-list .mw-course-item')[0].querySelectorAll('.mw-course-mi')).map(t => ({ label: t.querySelector('.mw-course-mi-label') ? t.querySelector('.mw-course-mi-label').textContent : '', value: t.querySelector('.mw-course-mi-value') ? t.querySelector('.mw-course-mi-value').textContent : '' })) : [],
                                        header: Array.from(document.querySelectorAll('#mw-course-list .mw-course-item')).map(x => ({ title: x.querySelector('.mw-course-item-title-text') ? x.querySelector('.mw-course-item-title-text').textContent : '', trainer: x.querySelector('.mw-course-item-trainer') ? x.querySelector('.mw-course-item-trainer').textContent : '', code: x.querySelector('.mw-course-item-code') ? x.querySelector('.mw-course-item-code').textContent : '' })),
                                    })`));

                                    if (process.env.SMOKE_PROBE) {
                                        const recap = await mainWindow.webContents.executeJavaScript(`JSON.stringify({
                                            header: Array.from(document.querySelectorAll('#mw-course-list .mw-course-item')).map(x => ({ title: x.querySelector('.mw-course-item-title-text') ? x.querySelector('.mw-course-item-title-text').textContent : '', trainer: x.querySelector('.mw-course-item-trainer') ? x.querySelector('.mw-course-item-trainer').textContent : '', code: x.querySelector('.mw-course-item-code') ? x.querySelector('.mw-course-item-code').textContent : '' })),
                                            mi: Array.from(document.querySelectorAll('#mw-course-list .mw-course-item'))[0] ? Array.from(document.querySelectorAll('#mw-course-list .mw-course-item')[0].querySelectorAll('.mw-course-mi')).map(t => (t.querySelector('.mw-course-mi-label') ? t.querySelector('.mw-course-mi-label').textContent : '') + '=' + (t.querySelector('.mw-course-mi-value') ? t.querySelector('.mw-course-mi-value').textContent : '')) : [],
                                        })`);
                                        fs.writeFileSync(path.join(__dirname, 'courses-recap.json'), recap);
                                    }

                                    const beforeBounds = mainWindow.getBounds();
                                    mainWindow.setSize(700, 900);
                                    await new Promise((r) => setTimeout(r, 400));
                                    console.log('SMOKE main-courses-narrow:', await mainWindow.webContents.executeJavaScript(`JSON.stringify((() => { const p = document.querySelector('[data-view-panel="courses"]'); const c = document.getElementById('mw-course-list'); return { listSW: c.scrollWidth, listCW: c.clientWidth, panelSW: p.scrollWidth, panelCW: p.clientWidth, cols: getComputedStyle(c).gridTemplateColumns, overflowedCards: Array.from(c.querySelectorAll('.mw-course-item')).filter(x => x.getBoundingClientRect().right > p.getBoundingClientRect().right).length }; })())`));
                                    mainWindow.setBounds(beforeBounds);

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

app.on('second-instance', (event, argv) => {
    if (popupWindow && !popupWindow.isDestroyed()) {
        positionPopup();
        popupWindow.show();
        popupWindow.focus();
    }
    openMainWindow();
});

app.whenReady().then(() => {
    protocol.handle('signature', (request) => {
        try {
            const url = new URL(request.url);
            const decoded = decodeURIComponent(url.pathname.replace(/^\//, ''));
            const p = resolveSignaturePath(decoded);
            if (!p || !fs.existsSync(p)) return new Response('Not found', { status: 404 });
            return net.fetch(pathToFileURL(p).toString());
        } catch (e) {
            return new Response('Bad request', { status: 400 });
        }
    });
    loadStats();
    createPopup();
    createTray();
    registerHotkey(loadConfig().globalHotkey || '');
});

}
