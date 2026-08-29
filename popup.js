
const state = {};
categories.forEach((key) => {
    state[key] = { comments: [], index: 0 };
});

const rowsEl = document.getElementById('rows');
const toastEl = document.getElementById('toast');
const cardTooltip = document.getElementById('card-tooltip');
const totalEl = document.getElementById('total-count');
const promptBtn = document.getElementById('prompt-btn');
const sheetId = document.getElementById('sheet-id');
const sheetName = document.getElementById('sheet-name');
const sheetPreviewList = document.getElementById('sheet-preview-list');
const sheetCount = document.getElementById('sheet-count');
const sheetAddCode = document.getElementById('sheet-add-code');
const markSelect = document.getElementById('mark-select');
const markSelectTrigger = document.getElementById('mark-select-trigger');
const markSelectMenu = document.getElementById('mark-select-menu');
const markSelectValue = document.getElementById('mark-select-value');
const markSelectDot = document.getElementById('mark-select-dot');
const markSelectOptions = document.querySelectorAll('.mark-select-option');
const sheetAddMarkCustom = document.getElementById('sheet-add-mark-custom');
const sheetAddBtn = document.getElementById('sheet-add-btn');
const sheetReset = document.getElementById('sheet-reset');
const sheetPasteBtn = document.getElementById('sheet-paste-btn');
const sheetPasteToggle = document.getElementById('sheet-paste-toggle');
const sheetPastePanel = document.getElementById('sheet-paste-panel');
const sheetPasteTextarea = document.getElementById('sheet-paste-textarea');
const sheetPasteImportBtn = document.getElementById('sheet-paste-import-btn');
const sheetPasteCancelBtn = document.getElementById('sheet-paste-cancel');
const sheetBtn = document.getElementById('sheet-btn');
const organizerWrap = document.querySelector('.organizer-wrap');
const organizerBtn = document.getElementById('organizer-btn');
const organizerFolderRow = document.getElementById('organizer-folder-row');
const organizerPathInput = document.getElementById('organizer-path');
const organizerBrowseBtn = document.getElementById('organizer-browse-btn');
const organizerClearBtn = document.getElementById('organizer-clear-btn');
const organizerRunBtn = document.getElementById('organizer-run-btn');
const organizerSummary = document.getElementById('organizer-summary');
const organizerList = document.getElementById('organizer-list');
const mainTabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');

let activeMainTab = 'comments';
let layoutMode = 'cards';
let sheetEntries = [];
let selectedMark = 'Checked';
let organizerFolder = '';
let organizerBusy = false;

function markDotClass(value) {
    if (value === 'Checked') return 'dot-checked';
    if (value === 'AI Detected') return 'dot-ai';
    if (value === 'Copied') return 'dot-copied';
    return 'dot-custom';
}

function openMarkMenu() {
    markSelectMenu.classList.remove('hidden');
    markSelectTrigger.classList.add('open');
    markSelectTrigger.setAttribute('aria-expanded', 'true');
    syncHeight();
}

function closeMarkMenu() {
    markSelectMenu.classList.add('hidden');
    markSelectTrigger.classList.remove('open');
    markSelectTrigger.setAttribute('aria-expanded', 'false');
    syncHeight();
}

function toggleMarkMenu() {
    if (markSelectMenu.classList.contains('hidden')) openMarkMenu();
    else closeMarkMenu();
}

function selectMark(value) {
    selectedMark = value;
    markSelectValue.textContent = value === '__custom__' ? 'Type your own' : value;
    markSelectDot.className = 'mark-select-dot ' + markDotClass(value);
    markSelectOptions.forEach((opt) => {
        const match = opt.dataset.value === value;
        opt.classList.toggle('selected', match);
        opt.setAttribute('aria-selected', match ? 'true' : 'false');
    });
    sheetAddMarkCustom.classList.toggle('hidden', value !== '__custom__');
    closeMarkMenu();
    if (value === '__custom__') sheetAddMarkCustom.focus();
}

const escapeDiv = document.createElement('div');
function escapeHtml(str) {
    escapeDiv.textContent = str;
    return escapeDiv.innerHTML;
}

function load() {
    let data = null;
    try {
        data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        data = null;
    }
    let mergedAny = false;
    categories.forEach((key) => {
        const saved = data && data[key];
        if (saved && Array.isArray(saved.comments)) {
            // Start from what's saved (keeps any custom edits/order/deletions
            // the user made), then append any newer default comments that
            // aren't already present â€” so expanding the built-in defaults
            // in code shows up for existing users without wiping their data.
            const comments = saved.comments.slice();
            const seen = new Set(comments.map((c) => c.trim().toLowerCase()));
            DEFAULTS[key].forEach((c) => {
                const norm = c.trim().toLowerCase();
                if (!seen.has(norm)) {
                    comments.push(c);
                    seen.add(norm);
                    mergedAny = true;
                }
            });
            state[key].comments = comments;
            state[key].index = typeof saved.index === 'number' ? saved.index : 0;
        } else {
            state[key].comments = [...DEFAULTS[key]];
            state[key].index = 0;
        }
    });
    if (mergedAny) save();
}

function save() {
    const payload = {};
    categories.forEach((key) => {
        payload[key] = { comments: state[key].comments, index: state[key].index };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function pushQuickState() {
    if (!window.popupAPI || typeof window.popupAPI.pushQuickState !== 'function') return;
    window.popupAPI.pushQuickState(categories.map((key) => {
        const s = state[key];
        return {
            key,
            comment: s.comments.length ? s.comments[s.index] : null,
            index: s.index,
            total: s.comments.length,
        };
    }));
}

let syncHeightScheduled = false;
function syncHeight() {
    if (syncHeightScheduled) return;
    syncHeightScheduled = true;
    requestAnimationFrame(() => {
        syncHeightScheduled = false;
        if (window.popupAPI && typeof window.popupAPI.resize === 'function') {
            window.popupAPI.resize({
                width: layoutMode === 'stack' ? 760 : (layoutMode === 'cards' ? 460 : 460),
                height: document.body.scrollHeight,
            });
        }
    });
}

let toastTimer = null;
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 1800);
}

const ROW_ICONS = {
    accept: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6"></polyline></svg>',
    aireject: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3c.4 3.1 1 4.7 2.1 5.9C15.3 10.1 16.9 10.7 20 11.1c-3.1.4-4.7 1-5.9 2.1-1.1 1.2-1.7 2.8-2.1 5.9-.4-3.1-1-4.7-2.1-5.9C8.7 12.1 7.1 11.5 4 11.1c3.1-.4 4.7-1 5.9-2.1C11.1 7.7 11.7 6.1 12 3z"/><circle cx="19" cy="5.2" r="1.3"/></svg>',
    copyreject: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
};

const MINI_ICONS = {
    prev: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>',
    reset: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
};

function renderRows() {
    rowsEl.innerHTML = '';
    categories.forEach((key) => {
        const s = state[key];
        const row = document.createElement('div');
        row.className = 'row' + (s.comments.length ? '' : ' disabled');
        row.dataset.key = key;
        row.title = '';
        const posLabel = layoutMode === 'cards'
            ? String(s.comments.length ? s.index + 1 : 0)
            : '[' + (s.comments.length ? (s.index + 1) + ' / ' + s.comments.length : 0) + ']';
        row.innerHTML =
            '<span class="row-icon" aria-hidden="true">' + ROW_ICONS[key] + '</span>' +
            '<div class="row-line">' +
                '<span class="name">' + LABELS[key] + '</span>' +
                '<span class="row-actions">' +
                    '<button type="button" class="mini" data-act="prev" title="Previous comment"><span class="mini-icon" aria-hidden="true">' + MINI_ICONS.prev + '</span><span class="mini-label">Prev</span></button>' +
                    '<button type="button" class="mini" data-act="reset" title="Reset to first comment"><span class="mini-icon" aria-hidden="true">' + MINI_ICONS.reset + '</span><span class="mini-label">Reset</span></button>' +
                '</span>' +
                '<span class="pos">' + posLabel + '</span>' +
            '</div>' +
            '<div class="preview">' + escapeHtml(s.comments.length ? s.comments[s.index] : '(no comments yet)') + '</div>';
        rowsEl.appendChild(row);
    });
}

function buildDateLine() {
    const d = new Date();
    const day = d.getDate();
    const month = d.toLocaleString('en', { month: 'long' });
    const year = d.getFullYear();
    return `___${day}____(day)/ ___${month} ____(month)/ _______${year}_____(year)`;
}

let copyCommentTimer = null;

function getDateFirstSetting() {
    const saved = localStorage.getItem(DATE_FIRST_KEY);
    return saved === null ? true : saved !== '0';
}

async function writeClipboard(text, count) {
    if (window.popupAPI && typeof window.popupAPI.copyText === 'function') {
        try {
            return await window.popupAPI.copyText(text, count !== false);
        } catch (e) {
            return false;
        }
    }
    return false;
}

async function handleCopy(key) {
    const s = state[key];
    const label = LABELS[key];
    if (!s.comments.length) {
        showToast('Nothing to copy yet \u2014 add comments first.');
        return;
    }
    if (copyCommentTimer) {
        clearTimeout(copyCommentTimer);
        copyCommentTimer = null;
    }
    const comment = s.comments[s.index];
    const copiedNumber = s.index + 1;
    if (!getDateFirstSetting()) {
        const ok = await writeClipboard(comment);
        if (!ok) {
            if (window.popupAPI && typeof window.popupAPI.reportCopyResult === 'function') {
                window.popupAPI.reportCopyResult({ ok: false, label });
            }
            showToast('Copy failed \u2014 please copy manually.');
            return;
        }
        showToast(`Copied ${label} comment ${copiedNumber}`);
        s.index = (s.index + 1) % s.comments.length;
        save();
        renderRows();
        pushQuickState();
        return;
    }
    const ok = await writeClipboard(buildDateLine(), false);
    if (!ok) {
        if (window.popupAPI && typeof window.popupAPI.reportCopyResult === 'function') {
            window.popupAPI.reportCopyResult({ ok: false, label });
        }
        showToast('Copy failed \u2014 please copy manually.');
        return;
    }
    showToast('Date copied \u2014 paste it, comment follows');
    copyCommentTimer = setTimeout(async () => {
        copyCommentTimer = null;
        const ok2 = await writeClipboard(comment);
        if (!ok2) {
            if (window.popupAPI && typeof window.popupAPI.reportCopyResult === 'function') {
                window.popupAPI.reportCopyResult({ ok: false, label });
            }
            showToast('Comment copy failed \u2014 please copy manually.');
            return;
        }
        showToast(`Copied ${label} comment ${copiedNumber}`);
        s.index = (s.index + 1) % s.comments.length;
        save();
        renderRows();
        pushQuickState();
    }, 500);
}

function prevComment(key) {
    const s = state[key];
    if (!s || s.comments.length === 0) return;
    s.index = (s.index - 1 + s.comments.length) % s.comments.length;
    save();
    renderRows();
    pushQuickState();
}

function resetComment(key) {
    const s = state[key];
    if (!s || s.comments.length === 0) return;
    s.index = 0;
    save();
    renderRows();
    pushQuickState();
}

function updateCounts() {
    let total = 0;
    categories.forEach((key) => {
        total += state[key].comments.length;
    });
    totalEl.textContent = total === 1 ? '1 comment' : `${total} comments`;
}

function setMainTab(name) {
    activeMainTab = name;
    mainTabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    tabPanels.forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
    updateFooterVisibility();
    syncHeight();
}

function updateFooterVisibility() {
    const show = layoutMode === 'stack' || layoutMode === 'cards' || activeMainTab === 'student';
    sheetBtn.classList.toggle('hidden', !show);
}

function applyLayout() {
    document.body.classList.toggle('layout-stack', layoutMode === 'stack');
    document.body.classList.toggle('layout-cards', layoutMode === 'cards');
    mainTabs.forEach((b) => b.classList.toggle('hidden', layoutMode === 'stack' || layoutMode === 'cards'));
    if (layoutMode !== 'cards') {
        hoveredRow = null;
        cardTooltip.classList.remove('active');
    }
    if (layoutMode === 'stack' || layoutMode === 'cards') {
        tabPanels.forEach((p) => p.classList.add('active'));
        updateFooterVisibility();
    } else {
        setMainTab(activeMainTab);
    }
    renderRows();
    syncHeight();
}

function loadLayout() {
    const saved = localStorage.getItem(LAYOUT_KEY);
    layoutMode = (saved === 'tabs' || saved === 'stack') ? saved : 'cards';
    applyLayout();
}

function getSavedPrompt() {
    const saved = localStorage.getItem(PROMPT_KEY);
    return saved === null ? defaultPrompt : saved;
}

async function copyPrompt() {
    const text = getSavedPrompt().trim();
    if (!text) {
        showToast('Prompt is empty \u2014 add prompt text first.');
        return;
    }
    let ok = false;
    if (window.popupAPI && typeof window.popupAPI.copyText === 'function') {
        try {
            ok = await window.popupAPI.copyText(text);
        } catch (e) {
            ok = false;
        }
    }
    if (!ok) {
        showToast('Copy failed \u2014 please copy manually.');
        return;
    }
    showToast('Prompt copied to clipboard');
}

function sheetCodeCell(code) {
    const style = 'border:' + SHEET_BORDER + ' ' + SHEET_COLORS.border +
        ';background-color:' + SHEET_COLORS.code +
        ';padding:5px;text-align:center';
    if (!code) return '<td style="' + style + '">&nbsp;</td>';
    return '<td style="' + style + '">' + escapeHtml(code) + '</td>';
}

function sheetStatusCell(status) {
    const style = 'border:' + SHEET_BORDER + ' ' + SHEET_COLORS.border +
        ';background-color:' + markColor(status) +
        ';padding:5px;text-align:center';
    if (!status) return '<td style="' + style + '">&nbsp;</td>';
    return '<td style="' + style + '">' + escapeHtml(status) + '</td>';
}

function sheetDataFromInputs() {
    const codes = [];
    const chunk = [];
    sheetEntries.forEach((cell) => {
        chunk.push({ code: cell.code, status: cell.status });
        if (chunk.length === SHEET_ASSESSMENT_COLS) {
            codes.push(chunk.slice());
            chunk.length = 0;
        }
    });
    if (chunk.length) {
        while (chunk.length < SHEET_ASSESSMENT_COLS) chunk.push({ code: '', status: '' });
        codes.push(chunk);
    }
    return {
        studentId: sheetId.value.trim(),
        name: sheetName.value.trim(),
        codes,
    };
}

function normalizeSheetEntries(saved) {
    const arr = saved && Array.isArray(saved.codes) ? saved.codes : [];
    const flat = [];
    const seen = new Set();
    function pushEntry(c) {
        let code = '';
        let status = '';
        if (typeof c === 'string') {
            code = c;
        } else if (c && typeof c.code === 'string' && c.code) {
            code = c.code;
            status = typeof c.status === 'string' ? c.status : '';
        }
        if (!code) return;
        const key = code.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        flat.push({ code, status });
    }
    arr.forEach((row) => {
        if (Array.isArray(row)) row.forEach(pushEntry);
        else pushEntry(row);
    });
    return flat;
}

function loadSheetInputs() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(SHEET_KEY));
    } catch (e) {
        saved = null;
    }
    if (!saved || !Array.isArray(saved.codes)) {
        ['comment-copier-sheet-v2', 'comment-copier-sheet-v1'].some((key) => {
            try {
                const legacy = JSON.parse(localStorage.getItem(key));
                if (legacy && Array.isArray(legacy.codes)) {
                    saved = legacy;
                    return true;
                }
            } catch (e) {}
            return false;
        });
    }
    sheetId.value = saved && typeof saved.studentId === 'string' ? saved.studentId : defaultSheetData.studentId;
    sheetName.value = saved && typeof saved.name === 'string' ? saved.name : defaultSheetData.name;
    const rawCount = saved && Array.isArray(saved.codes)
        ? saved.codes.reduce((n, row) => n + (Array.isArray(row) ? row.length : 1), 0)
        : 0;
    sheetEntries = normalizeSheetEntries(saved);
    if (sheetEntries.length !== rawCount) {
        persistSheetData();
    }
}

function updateSheetActionButton() {
    const hasData = sheetEntries.length > 0;
    sheetBtn.classList.toggle('hidden', !hasData);
}

function updateSheetCount() {
    const total = sheetEntries.length;
    sheetCount.textContent = total === 1 ? '1 entry' : `${total} entries`;
}

function renderSheetPreview() {
    updateSheetActionButton();
    updateSheetCount();
    sheetPreviewList.innerHTML = '';
    if (!sheetEntries.length) {
        const empty = document.createElement('div');
        empty.className = 'sheet-preview-empty';
        empty.textContent = 'No unit codes yet \u2014 add unit code and mark above.';
        sheetPreviewList.appendChild(empty);
        return;
    }
    sheetEntries.forEach((cell, i) => {
        const item = document.createElement('div');
        item.className = 'sheet-preview-item';
        item.title = cell.status || 'No mark';
        const codeSpan = document.createElement('span');
        codeSpan.className = 'sheet-preview-code';
        codeSpan.textContent = cell.code;
        item.appendChild(codeSpan);
        const right = document.createElement('span');
        right.className = 'sheet-preview-right';
        if (cell.status) {
            const mark = document.createElement('span');
            mark.className = 'sheet-preview-mark';
            mark.style.backgroundColor = markColor(cell.status);
            const sym = document.createElement('span');
            sym.className = 'mark-symbol';
            sym.textContent = '\u2713';
            const txt = document.createElement('span');
            txt.textContent = cell.status;
            mark.appendChild(sym);
            mark.appendChild(txt);
            right.appendChild(mark);
        }
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'sheet-preview-del';
        del.title = 'Remove';
        del.textContent = '\u00d7';
        del.addEventListener('click', () => removeSheetEntry(i));
        right.appendChild(del);
        item.appendChild(right);
        sheetPreviewList.appendChild(item);
    });
}

function addSheetEntry() {
    const code = sheetAddCode.value.trim();
    if (!code) {
        showToast('Type a code first.');
        return;
    }
    const isDuplicate = sheetEntries.some((e) => e.code.toLowerCase() === code.toLowerCase());
    if (isDuplicate) {
        showToast(`${code} is already added â€” unit codes must be unique.`);
        sheetAddCode.focus();
        sheetAddCode.select();
        return;
    }
    const isCustom = selectedMark === '__custom__';
    const mark = isCustom ? sheetAddMarkCustom.value.trim() : selectedMark;
    if (isCustom && !mark) {
        showToast('Type a mark first.');
        sheetAddMarkCustom.focus();
        return;
    }
    sheetEntries.push({ code, status: mark });
    sheetAddCode.value = '';
    sheetAddCode.classList.remove('duplicate');
    sheetAddMarkCustom.value = '';
    selectMark('Checked');
    renderSheetPreview();
    persistSheetData();
    syncHeight();
    sheetAddCode.focus();
}

function removeSheetEntry(index) {
    sheetEntries.splice(index, 1);
    renderSheetPreview();
    persistSheetData();
    syncHeight();
    const val = sheetAddCode.value.trim().toLowerCase();
    const dup = !!val && sheetEntries.some((e) => e.code.toLowerCase() === val);
    sheetAddCode.classList.toggle('duplicate', dup);
}

function persistSheetData() {
    localStorage.setItem(SHEET_KEY, JSON.stringify(sheetDataFromInputs()));
}

function resetSheetData() {
    sheetId.value = defaultSheetData.studentId;
    sheetName.value = defaultSheetData.name;
    sheetEntries = [];
    persistSheetData();
    renderSheetPreview();
    syncHeight();
    showToast('Sheet data cleared.');
}

function normalizeCell(v) {
    return (v === null || v === undefined ? '' : String(v)).trim();
}

function rowIsBlank(row) {
    return !row || row.every((c) => !normalizeCell(c));
}

// Matches a typical unit-code pattern: letters immediately followed by
// digits (e.g. "CPCCCA3002", "MSMEN272") â€” mirrors the pattern main.js uses
// for the File Organizer, so both features agree on what "looks like a code".
const CODE_LOOKS_LIKE = /^[A-Za-z]{2,10}\d{2,6}$/;

// True if a row's cells from column 2 onward are mostly unit-code-shaped.
// Used to recognize the app's own stacked block layout (Student Id | Name |
// Code, Code, Codeâ€¦) even when it's missing the literal "Student Id"/"Name"
// header text â€” which is normal, since that header only exists when the data
// came from this app's own "Copy Sheet" output. A real Excel roster export
// usually starts straight in with a row of codes.
function looksLikeCodeRow(row) {
    const rest = row.slice(2).map(normalizeCell).filter(Boolean);
    if (!rest.length) return false;
    const codeLike = rest.filter((c) => CODE_LOOKS_LIKE.test(c));
    return codeLike.length >= Math.ceil(rest.length * 0.6);
}

// Reads a plain 2D array of rows/cells (from a clipboard/pasted-text split)
// and groups it into per-student blocks. Understands two shapes:
//   1) The stacked block table â€” Student Id / Name in columns 0/1 of the
//      first row of each block, then unit codes across the rest of that
//      row, then a status row directly below it, then a blank separator
//      row before the next block. This is recognized either by a literal
//      "Student Id" + "Name" header row (the shape this app's own "Copy
//      Sheet" produces) or, if no such header exists, by the first non-
//      blank row already looking like one of these code rows (a real
//      Excel roster export usually has no header row at all). Excel only
//      stores a value in the top-left cell of a merged range, so after the
//      first block the Student Id/Name cells read as blank even though
//      they visually still belong to the same student â€” in that case the
//      codes are appended to the currently open student instead of
//      starting a new (empty-named) one.
//   2) A plain two-column Code/Mark list with no student id/name at all, in
//      which case everything is treated as one unnamed block.
function parseStudentBlocksFromRows(rows) {
    let startIdx = rows.findIndex((r) =>
        r.some((c) => /student\s*id/i.test(normalizeCell(c))) &&
        r.some((c) => /name/i.test(normalizeCell(c)))
    );
    let hasBlockHeader = startIdx !== -1;
    if (hasBlockHeader) startIdx += 1;

    if (!hasBlockHeader) {
        const firstDataIdx = rows.findIndex((r) => !rowIsBlank(r));
        if (firstDataIdx !== -1) {
            const r = rows[firstDataIdx];
            if (normalizeCell(r[0]) && normalizeCell(r[1]) && looksLikeCodeRow(r)) {
                hasBlockHeader = true;
                startIdx = firstDataIdx;
            }
        }
    }

    if (!hasBlockHeader) {
        const codeHeaderIdx = rows.findIndex((r) => r.some((c) => /code/i.test(normalizeCell(c))));
        const startRow = codeHeaderIdx === -1 ? 0 : codeHeaderIdx + 1;
        const codes = [];
        for (let i = startRow; i < rows.length; i++) {
            const row = rows[i] || [];
            const code = normalizeCell(row[0]);
            if (!code) continue;
            codes.push({ code, status: normalizeCell(row[1]) });
        }
        return codes.length ? [{ studentId: '', name: '', codes }] : [];
    }

    const blocks = [];
    let current = null;
    let i = startIdx;
    while (i < rows.length) {
        const row = rows[i] || [];
        if (rowIsBlank(row)) {
            i++;
            continue;
        }
        const studentId = normalizeCell(row[0]);
        const name = normalizeCell(row[1]);
        const codeRow = row;
        const statusRow = rows[i + 1] || [];
        const codes = [];
        const width = Math.max(codeRow.length, statusRow.length);
        for (let c = 2; c < width; c++) {
            const code = normalizeCell(codeRow[c]);
            if (!code) continue;
            codes.push({ code, status: normalizeCell(statusRow[c]) });
        }

        if (studentId || name) {
            // A Student Id or Name cell means a new student's merged region
            // starts here.
            current = { studentId, name, codes: codes.slice() };
            blocks.push(current);
        } else if (current) {
            // Blank Id/Name cells belong to a merged range â€” keep adding
            // codes to the student that's currently open.
            current.codes.push(...codes);
        } else if (codes.length) {
            // Codes with no student header at all (unlikely, but handle it).
            current = { studentId: '', name: '', codes: codes.slice() };
            blocks.push(current);
        }

        i += 2;
        while (i < rows.length && rowIsBlank(rows[i])) i++;
    }
    return blocks;
}

function applyImportedBlock(block) {
    if (block.studentId) sheetId.value = block.studentId;
    if (block.name) sheetName.value = block.name;
    const existingKeys = new Set(sheetEntries.map((e) => e.code.toLowerCase()));
    let added = 0;
    let updated = 0;
    block.codes.forEach(({ code, status }) => {
        if (!code) return;
        const key = code.toLowerCase();
        if (existingKeys.has(key)) {
            const existing = sheetEntries.find((e) => e.code.toLowerCase() === key);
            if (existing && status && existing.status !== status) {
                existing.status = status;
                updated++;
            }
            return;
        }
        existingKeys.add(key);
        sheetEntries.push({ code, status: status || '' });
        added++;
    });
    renderSheetPreview();
    persistSheetData();
    syncHeight();
    return { added, updated };
}

// Splits one line of pasted text into cells for a single row. Excel's
// clipboard paste is always tab-separated, so that's tried first (and takes
// priority for full "Student Id / Name / Assessment Code" table rows, which
// only ever come from Excel). For lines typed or pasted by hand â€” the plain
// Code/Mark case â€” we also accept a comma, a run of 2+ spaces, or (as a
// last resort) a single space, splitting only on the *first* gap so a
// multi-word mark like "AI Detected" stays intact as one cell.
function splitPastedLine(line) {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(',')) return line.split(',').map((c) => c.trim());
    const multiSpace = line.split(/ {2,}/);
    if (multiSpace.length > 1) return multiSpace.map((c) => c.trim());
    const singleSpace = line.match(/^(\S+)\s+(.+)$/);
    if (singleSpace) return [singleSpace[1], singleSpace[2].trim()];
    return [line];
}

// Splits pasted text (from the clipboard or the paste-box textarea) into
// the same plain 2D array of rows/cells that parseStudentBlocksFromRows()
// expects, one row per line.
function parsePastedText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(splitPastedLine);
}

function importRowsIntoSheet(rows) {
    const blocks = parseStudentBlocksFromRows(rows);
    if (!blocks.length) {
        showToast('No student data found in that paste.');
        return;
    }

    const currentId = sheetId.value.trim().toLowerCase();
    let target = blocks[0];
    if (currentId) {
        const match = blocks.find((b) => b.studentId.toLowerCase() === currentId);
        if (match) target = match;
    }

    const { added, updated } = applyImportedBlock(target);
    const who = target.studentId || target.name || 'student';
    let msg = `Imported ${who} \u2014 ${added} code${added === 1 ? '' : 's'} added`;
    if (updated) msg += `, ${updated} updated`;
    if (blocks.length > 1) msg += ` (${blocks.length} students found)`;
    showToast(msg + '.');
}

async function pasteFromClipboard() {
    if (!window.popupAPI || typeof window.popupAPI.readClipboardText !== 'function') {
        showToast('Clipboard paste unavailable.');
        return;
    }
    let result;
    try {
        result = await window.popupAPI.readClipboardText();
    } catch (e) {
        result = { ok: false, error: 'Could not read the clipboard.' };
    }
    if (!result || !result.ok) {
        showToast((result && result.error) || 'Clipboard is empty \u2014 copy cells from Excel first.');
        return;
    }
    importRowsIntoSheet(parsePastedText(result.text));
}

function toggleSheetPastePanel(forceOpen) {
    const willOpen = forceOpen === undefined ? sheetPastePanel.classList.contains('hidden') : forceOpen;
    sheetPastePanel.classList.toggle('hidden', !willOpen);
    if (willOpen) {
        sheetPasteTextarea.focus();
    } else {
        sheetPasteTextarea.value = '';
    }
    syncHeight();
}

function importFromPasteTextarea() {
    const text = sheetPasteTextarea.value;
    if (!text.trim()) {
        showToast('Paste some cells first.');
        return;
    }
    importRowsIntoSheet(parsePastedText(text));
    toggleSheetPastePanel(false);
}

function buildSheetHtml(data) {
    const n = SHEET_ASSESSMENT_COLS;
    const head = 'border:' + SHEET_BORDER + ' ' + SHEET_COLORS.border +
        ';background-color:' + SHEET_COLORS.header +
        ';color:' + SHEET_COLORS.headerText + ';font-weight:bold;text-align:center;padding:5px';
    const studentCell = 'border:' + SHEET_BORDER + ' ' + SHEET_COLORS.border +
        ';background-color:#FFFFFF;color:#000000;font-weight:bold;text-align:center;padding:5px';
    const rows = data.codes.filter((codesRow) => codesRow.some((c) => c.code));
    const span = Math.max(0, rows.length * 3 - 1);

    let trs = '<tr>' +
        '<td style="' + head + '">Student Id</td>' +
        '<td style="' + head + '">Name</td>' +
        '<td colspan="' + n + '" style="' + head + '">Assessment Code</td>' +
        '</tr>';

    rows.forEach((codesRow, i) => {
        trs += '<tr>';
        if (i === 0) {
            trs += '<td rowspan="' + span + '" style="' + studentCell + '">' + escapeHtml(data.studentId) + '</td>';
            trs += '<td rowspan="' + span + '" style="' + studentCell + '">' + escapeHtml(data.name) + '</td>';
        }
        codesRow.forEach((cell) => {
            trs += sheetCodeCell(cell.code);
        });
        trs += '</tr>';

        trs += '<tr>';
        codesRow.forEach((cell) => {
            trs += sheetStatusCell(cell.code ? (cell.status || '') : '');
        });
        trs += '</tr>';

        if (i < rows.length - 1) {
            const gapStyle = 'border:' + SHEET_BORDER + ' ' + SHEET_COLORS.border +
                ';background-color:#FFFFFF;height:10px';
            trs += '<tr>';
            for (let c = 0; c < n; c++) trs += '<td style="' + gapStyle + '">&nbsp;</td>';
            trs += '</tr>';
        }
    });

    trs += '<tr><td colspan="' + (n + 2) + '" style="border:' + SHEET_BORDER + ' ' + SHEET_COLORS.border +
        ';background-color:' + SHEET_COLORS.divider + ';height:8px">&nbsp;</td></tr>';

    return '<!--StartFragment--><table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">' +
        trs + '</table><!--EndFragment-->';
}

function buildSheetText(data) {
    const n = SHEET_ASSESSMENT_COLS;
    const row = (cells) => cells.join('\t') + '\n';
    const rows = data.codes.filter((codesRow) => codesRow.some((c) => c.code));
    let text = row(['Student Id', 'Name', 'Assessment Code', ...Array(n - 1).fill('')]);
    rows.forEach((codesRow, i) => {
        const idCell = i === 0 ? data.studentId : '';
        const nameCell = i === 0 ? data.name : '';
        text += row([idCell, nameCell, ...codesRow.map((c) => c.code ? c.code : '')]);
        text += row(['', '', ...codesRow.map((c) => c.code ? (c.status || '') : '')]);
        if (i < rows.length - 1) {
            text += row([...Array(n + 2)].fill(''));
        }
    });
    text += row([...Array(n + 2)].fill(''));
    return text;
}

async function copySheet() {
    const data = sheetDataFromInputs();
    persistSheetData();
    let ok = false;
    if (window.popupAPI && typeof window.popupAPI.copySheet === 'function') {
        try {
            ok = await window.popupAPI.copySheet(buildSheetHtml(data), buildSheetText(data));
        } catch (e) {
            ok = false;
        }
    }
    if (!ok) {
        showToast('Copy failed \u2014 please copy manually.');
        return;
    }
    showToast('Sheet copied \u2014 paste into Excel');
}

function loadOrganizerPath() {
    const saved = localStorage.getItem(ORGANIZER_KEY);
    if (saved) {
        organizerFolder = saved;
        organizerPathInput.value = saved;
        organizerRunBtn.disabled = false;
        organizerFolderRow.classList.add('has-folder');
    }
}

function renderOrganizerResult(result) {
    if (!result || !result.ok) {
        organizerSummary.textContent = result && result.error ? result.error : 'Something went wrong.';
        organizerList.innerHTML = '';
        return;
    }
    organizerSummary.textContent =
        `${result.moved} file${result.moved === 1 ? '' : 's'} moved, ${result.skipped.length} skipped`;
    organizerList.innerHTML = '';
    if (!result.skipped.length) {
        const empty = document.createElement('div');
        empty.className = 'organizer-empty';
        empty.textContent = result.total
            ? 'All files organized \u2014 nothing skipped.'
            : 'No files found in that folder.';
        organizerList.appendChild(empty);
        return;
    }
    result.skipped.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'organizer-item';
        el.innerHTML =
            '<div class="organizer-item-file">' + escapeHtml(item.file) + '</div>' +
            '<div class="organizer-item-reason">' + escapeHtml(item.reason) + '</div>';
        organizerList.appendChild(el);
    });
}

async function pickOrganizerFolder() {
    if (!window.popupAPI || typeof window.popupAPI.pickOrganizeFolder !== 'function') {
        showToast('Folder picker unavailable.');
        return;
    }
    let picked = null;
    try {
        picked = await window.popupAPI.pickOrganizeFolder();
    } catch (e) {
        picked = null;
    }
    if (!picked) return;
    organizerFolder = picked;
    organizerPathInput.value = picked;
    localStorage.setItem(ORGANIZER_KEY, picked);
    organizerRunBtn.disabled = false;
    organizerFolderRow.classList.add('has-folder');
    organizerSummary.textContent = '';
    organizerList.innerHTML = '';
    syncHeight();
}

function clearOrganizerFolder() {
    organizerFolder = '';
    organizerPathInput.value = '';
    localStorage.removeItem(ORGANIZER_KEY);
    organizerRunBtn.disabled = true;
    organizerFolderRow.classList.remove('has-folder');
    organizerSummary.textContent = '';
    organizerList.innerHTML = '';
    syncHeight();
}

async function runOrganizer() {
    if (organizerBusy || !organizerFolder) return;
    if (!window.popupAPI || typeof window.popupAPI.organizeFolder !== 'function') {
        showToast('File organizer unavailable.');
        return;
    }
    organizerBusy = true;
    organizerRunBtn.disabled = true;
    organizerRunBtn.textContent = 'Organizing\u2026';
    let result = null;
    try {
        result = await window.popupAPI.organizeFolder(organizerFolder);
    } catch (e) {
        result = { ok: false, error: 'Organize failed \u2014 ' + e.message };
    }
    organizerBusy = false;
    organizerRunBtn.disabled = false;
    organizerRunBtn.textContent = 'Organize Files';
    renderOrganizerResult(result);
    syncHeight();
    if (result && result.ok) {
        showToast(`Organized \u2014 ${result.moved} moved, ${result.skipped.length} skipped`);
        organizerFolder = '';
        organizerPathInput.value = '';
        localStorage.removeItem(ORGANIZER_KEY);
        organizerRunBtn.disabled = true;
    } else {
        showToast(result && result.error ? result.error : 'Organize failed.');
    }
}

rowsEl.addEventListener('click', (e) => {
    const actBtn = e.target.closest('.mini');
    if (actBtn) {
        const row = actBtn.closest('.row');
        if (!row || row.classList.contains('disabled')) return;
        const act = actBtn.dataset.act;
        if (act === 'copy') handleCopy(row.dataset.key);
        else if (act === 'prev') prevComment(row.dataset.key);
        else if (act === 'reset') resetComment(row.dataset.key);
        return;
    }
    const row = e.target.closest('.row');
    if (!row || row.classList.contains('disabled')) return;
    handleCopy(row.dataset.key);
});

let hoveredRow = null;

rowsEl.addEventListener('mouseover', (e) => {
    if (layoutMode !== 'cards') return;
    const row = e.target.closest('.row');
    if (!row || row.classList.contains('disabled') || row === hoveredRow) return;
    const s = state[row.dataset.key];
    if (!s || !s.comments.length) return;
    hoveredRow = row;
    cardTooltip.textContent = s.comments[s.index];
    const rect = row.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;
    if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
    if (left < 0) left = 4;
    if (top + 60 > window.innerHeight) top = rect.top - 60;
    cardTooltip.style.top = top + 'px';
    cardTooltip.style.left = left + 'px';
    cardTooltip.classList.add('active');
});

rowsEl.addEventListener('mouseout', (e) => {
    const row = e.target.closest('.row');
    if (!row || !row.contains(e.relatedTarget)) {
        hoveredRow = null;
        cardTooltip.classList.remove('active');
    }
});

document.addEventListener('click', (e) => {
    if (!organizerWrap.contains(e.target)) {
        organizerWrap.classList.remove('open');
        organizerBtn.setAttribute('aria-expanded', 'false');
    }
});
function closeOrganizerDropdown() {
    organizerWrap.classList.remove('open');
    organizerBtn.setAttribute('aria-expanded', 'false');
}
if (window.popupAPI && typeof window.popupAPI.onClosed === 'function') {
    window.popupAPI.onClosed(closeOrganizerDropdown);
}
organizerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = organizerWrap.classList.toggle('open');
    organizerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});
mainTabs.forEach((b) => b.addEventListener('click', () => setMainTab(b.dataset.tab)));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (organizerWrap.classList.contains('open')) {
            organizerWrap.classList.remove('open');
            organizerBtn.setAttribute('aria-expanded', 'false');
            organizerBtn.focus();
            return;
        }
        if (!markSelectMenu.classList.contains('hidden')) {
            closeMarkMenu();
            markSelectTrigger.focus();
            return;
        }
        if (window.popupAPI) window.popupAPI.close();
    }
});
document.getElementById('quit').addEventListener('click', () => {
    if (window.popupAPI) window.popupAPI.quitApp();
});
promptBtn.addEventListener('click', copyPrompt);
document.getElementById('open-main-btn').addEventListener('click', () => {
    if (window.popupAPI && typeof window.popupAPI.openMain === 'function') {
        window.popupAPI.openMain();
    }
});
sheetBtn.addEventListener('click', copySheet);
let sheetTimer = null;
[sheetId, sheetName].forEach((el) => {
    el.addEventListener('input', () => {
        clearTimeout(sheetTimer);
        sheetTimer = setTimeout(persistSheetData, 400);
    });
});
sheetReset.addEventListener('click', resetSheetData);
sheetPasteBtn.addEventListener('click', pasteFromClipboard);
sheetPasteToggle.addEventListener('click', () => toggleSheetPastePanel());
sheetPasteCancelBtn.addEventListener('click', () => toggleSheetPastePanel(false));
sheetPasteImportBtn.addEventListener('click', importFromPasteTextarea);
sheetPasteTextarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        importFromPasteTextarea();
    }
});
sheetAddBtn.addEventListener('click', addSheetEntry);
sheetAddCode.addEventListener('input', () => {
    const val = sheetAddCode.value.trim().toLowerCase();
    const dup = !!val && sheetEntries.some((e) => e.code.toLowerCase() === val);
    sheetAddCode.classList.toggle('duplicate', dup);
});
markSelectTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMarkMenu();
});
markSelectOptions.forEach((opt) => {
    opt.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMark(opt.dataset.value);
    });
});
document.addEventListener('click', (e) => {
    if (!markSelect.contains(e.target)) closeMarkMenu();
});
[sheetAddCode, sheetAddMarkCustom].forEach((el) => {
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSheetEntry();
        }
    });
});
organizerBrowseBtn.addEventListener('click', pickOrganizerFolder);
organizerFolderRow.addEventListener('click', pickOrganizerFolder);
organizerRunBtn.addEventListener('click', runOrganizer);
organizerClearBtn.addEventListener('click', clearOrganizerFolder);

load();
loadSheetInputs();
loadOrganizerPath();
renderSheetPreview();
selectMark('Checked');
renderRows();
loadLayout();
updateCounts();
pushQuickState();

// Keep in sync with comment-list edits and the popup layout chosen in the main window.
window.addEventListener('storage', (e) => {
    if (e.key === LAYOUT_KEY) {
        loadLayout();
    }
    load();
    renderRows();
    updateCounts();
});
syncHeight();
