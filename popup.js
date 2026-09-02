
const state = {};
categories.forEach((key) => {
    state[key] = { comments: [], index: 0 };
});

function catLabel(key) {
    return t('etab.' + key);
}

function markLabel(value) {
    if (value === '__custom__') return t('popup.typeOwn');
    if (value === 'Checked') return t('popup.markChecked');
    if (value === 'AI Detected') return t('popup.markAi');
    if (value === 'Copied') return t('popup.markCopied');
    return value;
}

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
const courseListEl = document.getElementById('course-list');
const courseListCount = document.getElementById('course-list-count');
const courseFilterTrigger = document.getElementById('course-filter-trigger');
const courseFilterMenu = document.getElementById('course-filter-menu');
const courseFilterValue = document.getElementById('course-filter-value');
const organizerWrap = document.querySelector('.organizer-wrap');
const organizerBtn = document.getElementById('organizer-btn');
const organizerFolderRow = document.getElementById('organizer-folder-row');
const organizerPathInput = document.getElementById('organizer-path');
const organizerBrowseBtn = document.getElementById('organizer-browse-btn');
const organizerClearBtn = document.getElementById('organizer-clear-btn');
const organizerRunBtn = document.getElementById('organizer-run-btn');
const organizerPreviewBtn = document.getElementById('organizer-preview-btn');
const organizerSummary = document.getElementById('organizer-summary');
const organizerList = document.getElementById('organizer-list');
const mainTabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');

let activeMainTab = 'comments';
let layoutMode = 'cards';
let sheetEntries = [];
let selectedMark = 'Checked';
let courseList = [];
// '' = no course selected (show nothing), '__all__' = show every course,
// otherwise the preset key of the single course to show.
const COURSE_FILTER_ALL = '__all__';
let courseFilter = '';
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
    markSelectValue.textContent = markLabel(value);
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
                '<span class="name">' + catLabel(key) + '</span>' +
                '<span class="row-actions">' +
                    '<button type="button" class="mini" data-act="prev" title="' + t('popup.prevTitle') + '"><span class="mini-icon" aria-hidden="true">' + MINI_ICONS.prev + '</span><span class="mini-label">' + t('popup.prev') + '</span></button>' +
                    '<button type="button" class="mini" data-act="reset" title="' + t('popup.resetTitle') + '"><span class="mini-icon" aria-hidden="true">' + MINI_ICONS.reset + '</span><span class="mini-label">' + t('popup.reset') + '</span></button>' +
                '</span>' +
                '<span class="pos">' + posLabel + '</span>' +
            '</div>' +
            '<div class="preview">' + escapeHtml(s.comments.length ? substitutePlaceholders(s.comments[s.index], placeholderValues()) : t('popup.noCommentsYet')) + '</div>';
        rowsEl.appendChild(row);
    });
}

function buildDateLine() {
    const d = new Date();
    const day = d.getDate();
    const month = d.toLocaleString(getLang(), { month: 'long' });
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

function placeholderValues() {
    const values = {};
    if (sheetName && sheetName.value) values.name = sheetName.value.trim();
    if (sheetId && sheetId.value) values.id = sheetId.value.trim();
    if (sheetEntries && sheetEntries.length && sheetEntries[0].code) {
        values.unit = sheetEntries[0].code;
        values.code = sheetEntries[0].code;
    }
    return values;
}

function recordUsage(key, index) {
    try {
        const usage = JSON.parse(localStorage.getItem(USAGE_KEY)) || {};
        if (!usage[key]) usage[key] = {};
        usage[key][index] = (usage[key][index] || 0) + 1;
        localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch (e) {}
}

function closeAfterCopyEnabled() {
    return localStorage.getItem(CLOSE_AFTER_COPY_KEY) === '1';
}

function closePopupAfterCopy() {
    if (!closeAfterCopyEnabled()) return;
    // Give the "Copied ..." toast a moment to show, then hide the popup.
    setTimeout(() => {
        if (window.popupAPI && typeof window.popupAPI.close === 'function') {
            window.popupAPI.close();
        }
    }, 80);
}

async function handleCopy(key) {
    const s = state[key];
    const label = catLabel(key);
    if (!s.comments.length) {
        showToast(t('toast.nothing'));
        return;
    }
    if (copyCommentTimer) {
        clearTimeout(copyCommentTimer);
        copyCommentTimer = null;
    }
    const comment = substitutePlaceholders(s.comments[s.index], placeholderValues());
    const copiedNumber = s.index + 1;
    const advance = () => {
        recordUsage(key, s.index);
        s.index = (s.index + 1) % s.comments.length;
        save();
        renderRows();
        pushQuickState();
    };
    if (!getDateFirstSetting()) {
        const ok = await writeClipboard(comment);
        if (!ok) {
            if (window.popupAPI && typeof window.popupAPI.reportCopyResult === 'function') {
                window.popupAPI.reportCopyResult({ ok: false, label });
            }
            showToast(t('toast.copyFail'));
            return;
        }
        showToast(t('toast.copied', { label, n: copiedNumber }));
        advance();
        closePopupAfterCopy();
        return;
    }
    const ok = await writeClipboard(buildDateLine(), false);
    if (!ok) {
        if (window.popupAPI && typeof window.popupAPI.reportCopyResult === 'function') {
            window.popupAPI.reportCopyResult({ ok: false, label });
        }
        showToast(t('toast.copyFail'));
        return;
    }
    showToast(t('toast.dateCopied'));
    copyCommentTimer = setTimeout(async () => {
        copyCommentTimer = null;
        const ok2 = await writeClipboard(comment);
        if (!ok2) {
            if (window.popupAPI && typeof window.popupAPI.reportCopyResult === 'function') {
                window.popupAPI.reportCopyResult({ ok: false, label });
            }
            showToast(t('toast.copyFail'));
            return;
        }
        showToast(t('toast.copied', { label, n: copiedNumber }));
        advance();
        closePopupAfterCopy();
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
    totalEl.textContent = tN('count.comment', total, { n: total });
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

function applyPopupAccent() {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (saved) {
        document.body.style.setProperty('--accent', saved);
    } else {
        document.body.style.removeProperty('--accent');
    }
}

function applyReduceMotion() {
    document.body.classList.toggle('reduce-motion', localStorage.getItem(REDUCE_MOTION_KEY) === '1');
}

function getSavedPrompt() {
    const saved = localStorage.getItem(PROMPT_KEY);
    return saved === null ? defaultPrompt : saved;
}

async function copyPrompt() {
    const text = getSavedPrompt().trim();
    if (!text) {
        showToast(t('toast.promptEmpty'));
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
        showToast(t('toast.copyFail'));
        return;
    }
    showToast(t('toast.promptCopied'));
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
    let id = saved && typeof saved.studentId === 'string' ? saved.studentId : '';
    let name = saved && typeof saved.name === 'string' ? saved.name : '';
    if (!id && !name) {
        const last = lastStudentRemembered();
        if (last) {
            id = last.studentId || '';
            name = last.name || '';
        }
    }
    sheetId.value = id;
    sheetName.value = name;
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
    sheetCount.textContent = tN('count.entry', total, { n: total });
}

function renderSheetPreview() {
    updateSheetActionButton();
    updateSheetCount();
    sheetPreviewList.innerHTML = '';
    if (!sheetEntries.length) {
        const empty = document.createElement('div');
        empty.className = 'sheet-preview-empty';
        empty.textContent = t('popup.sheetEmpty');
        sheetPreviewList.appendChild(empty);
        return;
    }
    sheetEntries.forEach((cell, i) => {
        const item = document.createElement('div');
        item.className = 'sheet-preview-item';
        item.title = cell.status || t('popup.noMark');
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
        del.title = t('popup.remove');
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
        showToast(t('toast.codeFirst'));
        return;
    }
    const isDuplicate = sheetEntries.some((e) => e.code.toLowerCase() === code.toLowerCase());
    if (isDuplicate) {
        showToast(t('toast.dupCode', { code }));
        sheetAddCode.focus();
        sheetAddCode.select();
        return;
    }
    const isCustom = selectedMark === '__custom__';
    const mark = isCustom ? sheetAddMarkCustom.value.trim() : selectedMark;
    if (isCustom && !mark) {
        showToast(t('toast.markFirst'));
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
    const data = sheetDataFromInputs();
    localStorage.setItem(SHEET_KEY, JSON.stringify(data));
    rememberLastStudent(data.studentId, data.name);
}

function rememberLastStudent(studentId, name) {
    if (!studentId && !name) return;
    try {
        localStorage.setItem(LAST_STUDENT_KEY, JSON.stringify({ studentId, name }));
    } catch (e) {}
}

function lastStudentRemembered() {
    try {
        const saved = JSON.parse(localStorage.getItem(LAST_STUDENT_KEY));
        if (saved && (saved.studentId || saved.name)) return saved;
    } catch (e) {}
    return null;
}

function resetSheetData() {
    sheetId.value = defaultSheetData.studentId;
    sheetName.value = defaultSheetData.name;
    sheetEntries = [];
    persistSheetData();
    renderSheetPreview();
    syncHeight();
    showToast(t('toast.sheetCleared'));
}

/* ---------- Saved courses (quick-copy presets) ---------- */

function loadCourseList() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(COURSES_KEY));
    } catch (e) {
        saved = null;
    }
    if (Array.isArray(saved)) {
        courseList = saved
            .filter((c) => c && typeof c === 'object')
            .map((c) => ({
                name: typeof c.name === 'string' ? c.name : '',
                code: typeof c.code === 'string' ? c.code : '',
                trainer: typeof c.trainer === 'string' ? c.trainer : '',
                signature: typeof c.signature === 'string' ? c.signature : '',
                signatureFile: typeof c.signatureFile === 'string' ? c.signatureFile : '',
            }))
            .filter((c) => c.name || c.code || c.trainer || c.signature || c.signatureFile);
        // Merge in newer built-in defaults so existing installs pick up
        // newly-added fields (e.g. a trainer's signature image) without
        // losing custom presets the user has saved.
        const byCode = {};
        courseList.forEach((c) => { if (c.code) byCode[c.code.toLowerCase()] = c; });
        let mergedAny = false;
        defaultCourses.forEach((d) => {
            const found = d.code ? byCode[d.code.toLowerCase()] : null;
            if (found) {
                if (!found.signatureFile && d.signatureFile) {
                    found.signatureFile = d.signatureFile;
                    mergedAny = true;
                }
                if (!found.signature && d.signature) {
                    found.signature = d.signature;
                    mergedAny = true;
                }
            } else {
                courseList.push(Object.assign({}, d));
                mergedAny = true;
            }
        });
        if (mergedAny) saveCourseList();
    } else {
        courseList = defaultCourses.map((c) => Object.assign({}, c));
        saveCourseList();
    }
}

function saveCourseList() {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courseList));
}

function loadCourseFilter() {
    courseFilter = localStorage.getItem(COURSE_FILTER_KEY) || '';
}

function saveCourseFilter() {
    localStorage.setItem(COURSE_FILTER_KEY, courseFilter);
}

function courseFilterLabel(key) {
    if (key === COURSE_FILTER_ALL) return t('popup.allCourses');
    const item = courseList.find((c) => coursePresetKey(c) === key);
    return item ? (courseItemText(item) || t('popup.untitledCourse')) : '';
}

function renderCourseFilter() {
    if (!courseFilterMenu) return;
    courseFilterMenu.innerHTML = '';
    const makeOption = (value, label) => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'course-filter-option' + (courseFilter === value ? ' selected' : '');
        opt.dataset.value = value;
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', courseFilter === value ? 'true' : 'false');
        opt.textContent = label;
        opt.addEventListener('click', () => selectCourseFilter(value));
        courseFilterMenu.appendChild(opt);
    };
    makeOption('', t('popup.selectCourse'));
    makeOption(COURSE_FILTER_ALL, t('popup.allCourses'));
    courseList.forEach((item) => {
        makeOption(coursePresetKey(item), courseItemText(item) || t('popup.untitledCourse'));
    });
    // A saved single-course filter whose preset was since removed falls back
    // to no selection rather than pointing at a ghost option.
    if (courseFilter !== COURSE_FILTER_ALL && courseFilter && !courseList.some((c) => coursePresetKey(c) === courseFilter)) {
        courseFilter = '';
        saveCourseFilter();
    }
    courseFilterValue.textContent = courseFilter ? courseFilterLabel(courseFilter) : t('popup.selectCourse');
    courseFilterValue.classList.toggle('placeholder', !courseFilter);
}

function openCourseFilterMenu() {
    courseFilterMenu.classList.remove('hidden');
    courseFilterTrigger.classList.add('open');
    courseFilterTrigger.setAttribute('aria-expanded', 'true');
    syncHeight();
}

function closeCourseFilterMenu() {
    courseFilterMenu.classList.add('hidden');
    courseFilterTrigger.classList.remove('open');
    courseFilterTrigger.setAttribute('aria-expanded', 'false');
    syncHeight();
}

function toggleCourseFilterMenu() {
    if (courseFilterMenu.classList.contains('hidden')) openCourseFilterMenu();
    else closeCourseFilterMenu();
}

function selectCourseFilter(value) {
    courseFilter = value;
    saveCourseFilter();
    renderCourseFilter();
    closeCourseFilterMenu();
    renderCourseList();
    syncHeight();
}

function courseItemText(item) {
    return [item.name, item.code, item.trainer, item.signature].filter(Boolean).join(' - ');
}

// "Copy All" for a preset. The plain-text details go on the clipboard
// together with any bundled signature image (one combined write, so neither
// is silently dropped). The toast mentions the image when one was included.
async function copyCourseItem(item) {
    const text = courseItemText(item);
    const image = item.signatureFile || '';
    if (!text && !image) return;
    const ok = image
        ? await copyCourseAll(text, image)
        : await writeClipboard(text);
    if (!ok) {
        showToast(t('toast.copyFail'));
        return;
    }
    const label = item.name || item.code || item.trainer || '';
    const suffix = image ? t('toast.courseImageSuffix') : '';
    showToast(t('toast.courseCopied', { name: label }) + suffix);
}

async function copyCourseAll(text, filename) {
    if (window.popupAPI && typeof window.popupAPI.copyCourseAll === 'function') {
        try {
            return await window.popupAPI.copyCourseAll({ text, image: filename });
        } catch (e) {
            return false;
        }
    }
    // Fallback: copy the image on its own when the combined write isn't
    // available (it's the part the text-only "Copy All" would drop).
    if (filename) return writeClipboardImage(filename);
    return writeClipboard(text);
}

async function copyCourseField(item, field, label, isImage) {
    if (isImage) {
        if (!item.signatureFile) {
            showToast(t('toast.courseFieldEmpty'));
            return;
        }
        const ok = await writeClipboardImage(item.signatureFile);
        if (!ok) {
            showToast(t('toast.copyFail'));
            return;
        }
        showToast(t('toast.courseFieldCopied', { field: label }));
        return;
    }
    let text = '';
    if (field === 'name') text = item.name || '';
    else if (field === 'code') text = item.code || '';
    else if (field === 'trainer') text = item.trainer || '';
    else if (field === 'signature') text = item.signature || '';
    if (!text) {
        showToast(t('toast.courseFieldEmpty'));
        return;
    }
    const ok = await writeClipboard(text);
    if (!ok) {
        showToast(t('toast.copyFail'));
        return;
    }
    showToast(t('toast.courseFieldCopied', { field: label }));
}

async function writeClipboardImage(filename) {
    if (window.popupAPI && typeof window.popupAPI.copySignature === 'function') {
        try {
            return await window.popupAPI.copySignature(filename);
        } catch (e) {
            return false;
        }
    }
    return false;
}

function confirmDeleteEnabled() {
    const saved = localStorage.getItem(CONFIRM_DELETE_KEY);
    return saved === null ? true : saved !== '0';
}

let presetUndo = null;
let presetUndoExpire = 0;
let presetUndoTimer = null;

function pushPresetUndo(item, index) {
    presetUndo = { item, index };
    presetUndoExpire = Date.now() + 5000;
}

function popPresetUndo() {
    if (!presetUndo) return;
    courseList.splice(presetUndo.index, 0, presetUndo.item);
    presetUndo = null;
    saveCourseList();
    renderCourseList();
    syncHeight();
    showToast(t('toast.presetRestored'));
}

function showPresetUndoToast(message) {
    toastEl.innerHTML = '';
    toastEl.textContent = message + ' ';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'toast-undo';
    undo.textContent = t('editor.undo');
    undo.addEventListener('click', () => {
        popPresetUndo();
        clearTimeout(presetUndoTimer);
        toastEl.classList.remove('show');
    });
    toastEl.appendChild(undo);
    toastEl.classList.add('show');
    clearTimeout(presetUndoTimer);
    presetUndoTimer = setTimeout(() => {
        toastEl.classList.remove('show');
        if (presetUndo && Date.now() > presetUndoExpire) presetUndo = null;
    }, 4000);
}

function removeCourseItem(index) {
    const item = courseList[index];
    if (!item) return;
    if (confirmDeleteEnabled() && !window.confirm(t('confirm.deletePreset'))) {
        return;
    }
    const [removed] = courseList.splice(index, 1);
    saveCourseList();
    renderCourseList();
    syncHeight();
    pushPresetUndo(removed, index);
    showPresetUndoToast(t('toast.presetRemoved'));
}

const COPY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

const FIELD_ICONS = {
    name: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"></path><path d="M9 20h6"></path><path d="M12 4v16"></path></svg>',
    code: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 6 2 12 8 18"></polyline><polyline points="16 6 22 12 16 18"></polyline></svg>',
    trainer: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    signature: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
};

function renderCourseList() {
    courseListEl.innerHTML = '';
    if (!courseList.length) {
        courseListCount.textContent = tN('count.entry', 0, { n: 0 });
        const empty = document.createElement('div');
        empty.className = 'course-list-empty';
        empty.textContent = t('popup.courseListEmpty');
        courseListEl.appendChild(empty);
        return;
    }
    if (!courseFilter) {
        courseListCount.textContent = '';
        const prompt = document.createElement('div');
        prompt.className = 'course-filter-prompt';
        prompt.textContent = t('popup.courseSelectHint');
        courseListEl.appendChild(prompt);
        return;
    }
    let filtered = courseFilter === COURSE_FILTER_ALL
        ? courseList.slice()
        : courseList.filter((item) => coursePresetKey(item) === courseFilter);
    if (!filtered.length) {
        courseFilter = '';
        saveCourseFilter();
        renderCourseFilter();
        courseListCount.textContent = '';
        const prompt = document.createElement('div');
        prompt.className = 'course-filter-prompt';
        prompt.textContent = t('popup.courseSelectHint');
        courseListEl.appendChild(prompt);
        return;
    }
    courseListCount.textContent = tN('count.entry', filtered.length, { n: filtered.length });
    filtered.forEach((item) => {
        const label = item.name || item.trainer || t('popup.untitledCourse');

        const row = document.createElement('div');
        row.className = 'course-item';

        // The name + code + trainer header is the "copy everything" trigger —
        // a real <button> so reaching for Delete elsewhere on the card can't
        // accidentally overwrite the clipboard.
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'course-item-header';
        header.title = t('popup.copyAllTitle');
        header.setAttribute('aria-label', t('popup.copyAllTitle') + ': ' + label + (item.code ? ' (' + item.code + ')' : ''));

        const titleLine = document.createElement('div');
        titleLine.className = 'course-item-title';
        const titleText = document.createElement('span');
        titleText.className = 'course-item-title-text';
        titleText.textContent = label;
        titleLine.appendChild(titleText);
        if (item.code) {
            const codeBadge = document.createElement('span');
            codeBadge.className = 'course-item-code';
            codeBadge.textContent = item.code;
            titleLine.appendChild(codeBadge);
        }
        header.appendChild(titleLine);
        if (item.trainer) {
            const trainerLine = document.createElement('div');
            trainerLine.className = 'course-item-trainer';
            trainerLine.textContent = item.trainer;
            header.appendChild(trainerLine);
        }
        header.addEventListener('click', () => copyCourseItem(item));
        row.appendChild(header);

        // Each field gets its own chip so what's shown on a chip is what a
        // click copies individually (name, code, trainer, signature).
        const chips = document.createElement('div');
        chips.className = 'course-item-chips';

        const fields = [
            { field: 'name', label: t('popup.courseName'), value: item.name || '' },
            { field: 'code', label: t('popup.courseCode'), value: item.code || '' },
            { field: 'trainer', label: t('popup.trainerName'), value: item.trainer || '' },
        ];
        if (item.signature) {
            fields.push({ field: 'signature', label: t('popup.trainerSignature'), value: item.signature, isImage: false });
        }
        if (item.signatureFile) {
            fields.push({ field: 'signature', label: t('popup.trainerSignature'), value: t('popup.signatureImage'), isImage: true });
        }
        fields.forEach((f) => {
            if (!f.value) return;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'course-chip';
            chip.title = t('popup.copyFieldTitle', { field: f.label });
            chip.innerHTML =
                '<span class="course-chip-icon" aria-hidden="true">' + (FIELD_ICONS[f.field] || '') + '</span>' +
                '<span class="course-chip-text">' + escapeHtml(f.value) + '</span>';
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                copyCourseField(item, f.field, f.label, f.isImage);
            });
            chips.appendChild(chip);
        });

        row.appendChild(chips);

        // An explicit "Copy all" chip (the signature, if any, is included in
        // the combined copy handled by copyCourseItem).
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'course-chip course-chip-all';
        allBtn.title = t('popup.copyAllTitle');
        allBtn.innerHTML = '<span class="course-chip-icon" aria-hidden="true">' + COPY_ICON + '</span><span class="course-chip-text">' + escapeHtml(t('popup.copyAllShort')) + '</span>';
        allBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyCourseItem(item);
        });
        row.appendChild(allBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'course-item-del';
        delBtn.title = t('popup.remove');
        delBtn.textContent = '\u00d7';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCourseItem(courseList.indexOf(item));
        });
        row.appendChild(delBtn);

        courseListEl.appendChild(row);
    });
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
        showToast(t('toast.noStudentData'));
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
    let msg = (added === 1 ? t('toast.importedOne', { who }) : t('toast.importedMany', { who, added })).replace(/\.$/, '');
    if (updated) msg += t('toast.importedUpdated', { updated });
    if (blocks.length > 1) msg += t('toast.importedStudents', { students: blocks.length });
    showToast(msg + '.');
}

async function pasteFromClipboard() {
    if (!window.popupAPI || typeof window.popupAPI.readClipboardText !== 'function') {
        showToast(t('toast.clipboardUnavailable'));
        return;
    }
    let result;
    try {
        result = await window.popupAPI.readClipboardText();
    } catch (e) {
        result = { ok: false, error: 'Could not read the clipboard.' };
    }
    if (!result || !result.ok) {
        showToast((result && result.error) || t('toast.clipboardEmpty'));
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
        showToast(t('toast.pasteCellsFirst'));
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
        showToast(t('toast.copyFail'));
        return;
    }
    showToast(t('toast.sheetCopied'));
}

function setOrganizerEnabled(enabled) {
    organizerRunBtn.disabled = !enabled;
    organizerPreviewBtn.disabled = !enabled;
}

function basename(p) {
    return String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
}

function renderOrganizerPreview(result) {
    organizerSummary.textContent = t('org.summary', { moved: result.planned, skipped: result.skipped.length });
    organizerList.innerHTML = '';
    if (!result.preview || !result.preview.length) {
        const empty = document.createElement('div');
        empty.className = 'organizer-empty';
        empty.textContent = t('org.previewNone');
        organizerList.appendChild(empty);
        return;
    }
    const byDest = {};
    result.preview.forEach((item) => {
        (byDest[item.to] = byDest[item.to] || []).push(item);
    });
    Object.keys(byDest).forEach((destPath) => {
        const head = document.createElement('div');
        head.className = 'organizer-preview-folder';
        head.textContent = t('org.previewDest', { dir: basename(destPath) });
        organizerList.appendChild(head);
        byDest[destPath].forEach((item) => {
            const el = document.createElement('div');
            el.className = 'organizer-item';
            el.innerHTML =
                '<div class="organizer-item-file">' + escapeHtml(item.file) + '</div>' +
                '<div class="organizer-item-reason">' + escapeHtml(item.from) + '</div>';
            organizerList.appendChild(el);
        });
    });
}

function renderOrganizerResult(result) {
    if (!result || !result.ok) {
        organizerSummary.textContent = result && result.error ? result.error : t('org.somethingWrong');
        organizerList.innerHTML = '';
        return;
    }
    organizerSummary.textContent = t('org.summary', { moved: result.moved, skipped: result.skipped.length });
    organizerList.innerHTML = '';
    if (!result.skipped.length) {
        const empty = document.createElement('div');
        empty.className = 'organizer-empty';
        empty.textContent = result.total
            ? t('org.emptyDone')
            : t('org.emptyNone');
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
        showToast(t('org.folderPickUnavailable'));
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
    setOrganizerEnabled(true);
    organizerFolderRow.classList.add('has-folder');
    organizerSummary.textContent = '';
    organizerList.innerHTML = '';
    syncHeight();
}

function clearOrganizerFolder() {
    organizerFolder = '';
    organizerPathInput.value = '';
    localStorage.removeItem(ORGANIZER_KEY);
    setOrganizerEnabled(false);
    organizerFolderRow.classList.remove('has-folder');
    organizerSummary.textContent = '';
    organizerList.innerHTML = '';
    syncHeight();
}

async function runOrganizer(dryRun) {
    if (organizerBusy || !organizerFolder) return;
    if (!window.popupAPI || typeof window.popupAPI.organizeFolder !== 'function') {
        showToast(t('org.organizerUnavailable'));
        return;
    }
    organizerBusy = true;
    setOrganizerEnabled(false);
    organizerRunBtn.querySelector('span').textContent = t('org.running');
    const options = organizerOptions();
    if (dryRun) options.dryRun = true;
    let result = null;
    try {
        result = await window.popupAPI.organizeFolder(organizerFolder, options);
    } catch (e) {
        result = { ok: false, error: t('org.failed') + ' ' + e.message };
    }
    organizerBusy = false;
    setOrganizerEnabled(!!organizerFolder);
    organizerRunBtn.querySelector('span').textContent = t('org.run');
    if (dryRun) {
        if (result && result.ok) renderOrganizerPreview(result);
        else renderOrganizerResult(result);
        syncHeight();
        return;
    }
    renderOrganizerResult(result);
    syncHeight();
    if (result && result.ok) {
        showToast(t('org.organized', { moved: result.moved, skipped: result.skipped.length }));
        organizerFolder = '';
        organizerPathInput.value = '';
        localStorage.removeItem(ORGANIZER_KEY);
        setOrganizerEnabled(false);
    } else {
        showToast(result && result.error ? result.error : t('org.failed'));
    }
}

rowsEl.addEventListener('click', (e) => {
    const actBtn = e.target.closest('.mini');
    if (actBtn) {
        const row = actBtn.closest('.row');
        if (!row || row.classList.contains('disabled')) return;
        const act = actBtn.dataset.act;
        if (act === 'prev') prevComment(row.dataset.key);
        else if (act === 'reset') resetComment(row.dataset.key);
        return;
    }
    const row = e.target.closest('.row');
    if (!row || row.classList.contains('disabled')) return;
    handleCopy(row.dataset.key);
});

let hoveredRow = null;

function popupTooltipDensity() {
    const d = localStorage.getItem(TOOLTIP_DENSITY_KEY);
    return d === 'off' || d === 'compact' || d === 'detailed' ? d : 'detailed';
}

function popupTooltipText(comment) {
    if (popupTooltipDensity() === 'compact') {
        const t = comment.length > 96 ? comment.slice(0, 96) + '\u2026' : comment;
        return t;
    }
    return comment;
}

rowsEl.addEventListener('mouseover', (e) => {
    if (layoutMode !== 'cards') return;
    const row = e.target.closest('.row');
    if (!row || row.classList.contains('disabled') || row === hoveredRow) return;
    const s = state[row.dataset.key];
    if (!s || !s.comments.length) return;
    if (popupTooltipDensity() === 'off') return;
    hoveredRow = row;
    cardTooltip.textContent = substitutePlaceholders(popupTooltipText(s.comments[s.index]), placeholderValues());
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
function popupShortcutCanonical(accel) {
    if (!accel) return '';
    const parts = String(accel).trim().split(/\s*\+\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    const mods = [...new Set(parts
        .filter((p) => p === 'ctrl' || p === 'shift' || p === 'alt' || p === 'cmd' || p === 'meta')
        .map((p) => (p === 'cmd' || p === 'meta' ? 'ctrl' : p)))].sort();
    const key = parts.find((p) => !['ctrl', 'shift', 'alt', 'cmd', 'meta'].includes(p));
    const segs = mods.slice();
    if (key) segs.push(key);
    return segs.join('+');
}

function popupEventToAccel(e) {
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('ctrl');
    if (e.shiftKey) mods.push('shift');
    if (e.altKey) mods.push('alt');
    const k = String(e.key).toLowerCase();
    if (['control', 'shift', 'alt', 'meta', 'cmd'].includes(k)) return '';
    return mods.sort().join('+') + (k ? '+' + k : '');
}

function popupLayoutShortcutBindings() {
    const out = {
        tabAccept: DEFAULT_SHORTCUTS.tabAccept,
        tabAireject: DEFAULT_SHORTCUTS.tabAireject,
        tabCopyreject: DEFAULT_SHORTCUTS.tabCopyreject,
        tabPrompt: DEFAULT_SHORTCUTS.tabPrompt,
    };
    try {
        const saved = JSON.parse(localStorage.getItem(SHORTCUTS_KEY));
        if (saved && typeof saved === 'object') {
            Object.keys(out).forEach((a) => {
                if (typeof saved[a] === 'string' && saved[a].trim()) out[a] = saved[a].trim();
            });
        }
    } catch (e) {}
    return out;
}

function popupMatchLayoutShortcut(e) {
    const accel = popupEventToAccel(e);
    if (!accel) return null;
    const bindings = popupLayoutShortcutBindings();
    for (const action of ['tabAccept', 'tabAireject', 'tabCopyreject', 'tabPrompt']) {
        if (bindings[action] && popupShortcutCanonical(bindings[action]) === accel) return action;
    }
    return null;
}

function popupSwitchLayout(action) {
    const order = ['cards', 'tabs', 'stack'];
    let mode;
    if (action === 'tabPrompt') {
        const idx = order.indexOf(layoutMode);
        mode = order[(idx + 1) % order.length];
    } else {
        mode = { tabAccept: 'cards', tabAireject: 'tabs', tabCopyreject: 'stack' }[action];
    }
    localStorage.setItem(LAYOUT_KEY, mode);
    layoutMode = mode;
    applyLayout();
    showToast(t('toast.layoutSet', { name: t('layout.' + mode) }));
}

document.addEventListener('keydown', (e) => {
    const layoutAction = popupMatchLayoutShortcut(e);
    if (layoutAction) {
        e.preventDefault();
        popupSwitchLayout(layoutAction);
        return;
    }
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
        if (!courseFilterMenu.classList.contains('hidden')) {
            closeCourseFilterMenu();
            courseFilterTrigger.focus();
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
organizerRunBtn.addEventListener('click', () => runOrganizer(false));
organizerPreviewBtn.addEventListener('click', () => runOrganizer(true));
organizerClearBtn.addEventListener('click', clearOrganizerFolder);
courseFilterTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCourseFilterMenu();
});
document.addEventListener('click', (e) => {
    if (!courseFilterMenu.classList.contains('hidden') && !courseFilterMenu.contains(e.target) && !courseFilterTrigger.contains(e.target)) {
        closeCourseFilterMenu();
    }
});

function applyI18n() {
    i18nApply(document);
    renderRows();
    updateCounts();
    renderSheetPreview();
    renderCourseFilter();
    renderCourseList();
    selectMark(selectedMark);
    if (organizerRunBtn.querySelector('span')) {
        organizerRunBtn.querySelector('span').textContent = organizerBusy ? t('org.running') : t('org.run');
    }
    if (organizerPreviewBtn.querySelector('span')) {
        organizerPreviewBtn.querySelector('span').textContent = t('org.preview');
    }
}

load();
loadSheetInputs();
loadCourseList();
loadCourseFilter();
renderCourseFilter();
renderCourseList();
clearOrganizerFolder();
renderSheetPreview();
selectMark('Checked');
renderRows();
loadLayout();
applyPopupAccent();
applyReduceMotion();
updateCounts();
applyI18n();
pushQuickState();

// Keep in sync with comment-list edits and the popup layout chosen in the main window.
window.addEventListener('storage', (e) => {
    if (e.key === LANG_KEY) {
        applyI18n();
    } else if (e.key === LAYOUT_KEY) {
        loadLayout();
    } else if (e.key === ACCENT_KEY) {
        applyPopupAccent();
    } else if (e.key === REDUCE_MOTION_KEY) {
        applyReduceMotion();
    } else if (e.key === TOOLTIP_DENSITY_KEY) {
        hoveredRow = null;
        cardTooltip.classList.remove('active');
    } else if (e.key === COURSES_KEY) {
        loadCourseList();
        renderCourseFilter();
        renderCourseList();
        syncHeight();
    }
    load();
    renderRows();
    updateCounts();
});
syncHeight();
