const STORAGE_KEY = 'comment-copier-data-v7';
const PROMPT_KEY = 'comment-copier-prompt-v1';
const SHEET_KEY = 'comment-copier-sheet-v3';
const LAYOUT_KEY = 'comment-copier-layout-v1';
const ORGANIZER_KEY = 'comment-copier-organizer-path-v1';

const SHEET_ASSESSMENT_COLS = 9;

const SHEET_BORDER = '0.5pt solid';

const SHEET_COLORS = {
    header: '#92CDDC',
    headerText: '#000000',
    border: '#000000',
    code: '#DAEEF3',
    status: '#D8E4BC',
    divider: '#EEECE1',
};

const MARK_COLORS = {
    'Checked': '#C6E0B4',
    'AI Detected': '#F4B7B7',
    'Copied': '#FFFF00',
};
const MARK_COLOR_DEFAULT = '#D9D9D9';

function markColor(status) {
    return MARK_COLORS[status] || MARK_COLOR_DEFAULT;
}

const defaultSheetData = {
    studentId: '',
    name: '',
    codes: [],
};

const defaultPrompt = `**TASK:**
Create named folders in the target directory based on file names. The folder name should be the code/identifier extracted from the file's name. Then move each file into its corresponding folder.

**RULES:**
1. Read the directory to identify all files.
2. For each file, extract the folder name using this logic:
   - If the filename contains a "-", take all text before the first "-".
   - If no "-", take only the first word (code/identifier before the first space).
3. Trim any leading/trailing whitespace from the folder name.
4. Remove "final" or "Final" from the end of the folder name (if present).
5. If multiple files share the same extracted name, create only one folder.
6. Create the folder if it doesn't already exist.
7. Move each file into its corresponding folder:
   - Do NOT rename or modify the file itself (filename stays identical).
   - If the destination folder already contains a file with the same name, do not overwrite it \u2014 skip that file (or append a numeric suffix) and report it.
8. Do NOT modify, rename, or alter the contents of any file.


**EXAMPLES:**
- File: "CPCCCA3002 - Assessment.v1.0.docx"
- Folder created: \`CPCCCA3002/\`, file moved to \`CPCCCA3002/CPCCCA3002 - Assessment.v1.0.docx\`


- File: "CPCCWHS2001 - Assessment.v1.0 (1).docx"
- Folder created: \`CPCCWHS2001/\`, file moved to \`CPCCWHS2001/CPCCWHS2001 - Assessment.v1.0 (1).docx\`


- File: "BSBESB303 final.docx"
- Folder created: \`BSBESB303/\`, file moved to \`BSBESB303/BSBESB303 final.docx\`


- File: "CPCCWHS2001 Unit Assessment Pack Version 9(Final).docx"
- Folder created: \`CPCCWHS2001/\`, file moved to \`CPCCWHS2001/CPCCWHS2001 Unit Assessment Pack Version 9(Final).docx\`


**USAGE:**
Provide this prompt along with the target directory path and ask the AI to create the folders and move the files accordingly.`;

const defaultAccept = [
    "The student followed the assignment instructions carefully and produced work that met the expected standard.",
    "The submitted work demonstrates a clear understanding of the task and satisfies the key assessment requirements.",
    "The student addressed all required components effectively, resulting in work that meets the expected level of achievement.",
    "The assignment was completed accurately and in line with the stated requirements, reflecting a sound understanding of the expectations.",
    "The student's submission meets the learning outcomes and demonstrates appropriate attention to the assessment guidelines.",
    "The work reflects a competent approach to the task, with clear evidence that the required criteria have been achieved.",
    "The student demonstrated a good understanding of the assignment expectations and completed the task to the required standard.",
    "The submission is well aligned with the assessment requirements and successfully addresses the key assessment criteria.",
    "The student produced work of an acceptable standard, meeting the objectives and expectations of the assessment.",
    "The assignment was completed in a structured and appropriate manner, fulfilling the specified requirements.",
    "The student's work demonstrates satisfactory achievement of the assessment outcomes and complies with the required expectations.",
    "The submission effectively responds to the task and provides evidence that the assessment criteria have been successfully addressed.",
];

const defaultAiReject = [
    "The submission appears to be AI-generated and does not demonstrate the student's own work.",
    "The assignment shows clear signs of AI-generated text and requires review.",
    "The response was detected as likely AI-written and must be revised.",
    "The submission was flagged for potential AI use and needs to be revised.",
    "The text of the submission appears to be produced by an AI tool rather than the student.",
    "The assignment reads as AI-generated and lacks the student's own analysis.",
    "The submission shows typical patterns of AI writing and requires the student to redo it.",
    "The work does not reflect the student's own effort and appears AI-generated.",
    "The response was flagged by AI detection tools as machine-written.",
    "The submission seems to have been written by an AI and must be completed again by the student.",
    "The assignment is not written in the student's own words and appears AI-generated.",
    "The submission was identified as AI-generated content and needs to be revised.",
];

const defaultCopyReject = [
    "The content is highly similar to existing online sources and may have been copied.",
    "The response closely matches content from other sources without proper attribution.",
    "The work appears to have been copied from another student's submission.",
    "The text closely resembles published content and lacks originality.",
    "The assignment contains content copied from other sources.",
    "The work shows signs of plagiarism and must be rewritten by the student.",
    "The submission is too similar to another source to be considered original.",
    "Large parts of the assignment were copied directly from an existing source.",
    "The submission was detected as copied from another student's work.",
    "The response duplicates content found online without citing the source.",
    "The assignment is not the student's original work and appears to be copied.",
    "The submission matches existing material too closely and needs to be rewritten.",
];

const categories = ['accept', 'aireject', 'copyreject'];
const LABELS = { accept: 'Accept', aireject: 'AI Reject', copyreject: 'Copy Reject' };
const DEFAULTS = { accept: defaultAccept, aireject: defaultAiReject, copyreject: defaultCopyReject };

const state = {};
categories.forEach((key) => {
    state[key] = { comments: [], index: 0 };
});

const rowsEl = document.getElementById('rows');
const toastEl = document.getElementById('toast');
const cardTooltip = document.getElementById('card-tooltip');
const totalEl = document.getElementById('total-count');
const editorEl = document.getElementById('editor');
const editorToggle = document.getElementById('editor-toggle');
const saveBtn = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');
const editorCount = document.getElementById('editor-count');
const addInput = document.getElementById('editor-add-input');
const addBtn = document.getElementById('editor-add-btn');
const restoreBtn = document.getElementById('editor-restore');
const textareas = {
    accept: document.getElementById('accept-text'),
    aireject: document.getElementById('aireject-text'),
    copyreject: document.getElementById('copyreject-text'),
};
const promptText = document.getElementById('prompt-text');
const promptHead = document.getElementById('prompt-head');
const promptStatus = document.getElementById('prompt-status');
const promptBtn = document.getElementById('prompt-btn');
const sheetId = document.getElementById('sheet-id');
const sheetName = document.getElementById('sheet-name');
const sheetPreviewList = document.getElementById('sheet-preview-list');
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
const commentsPanel = document.querySelector('[data-panel="comments"]');
const etabs = document.querySelectorAll('.etab');
const infoWrap = document.querySelector('.info-wrap');
const infoBtn = document.getElementById('info-btn');
const layoutBtn = document.getElementById('layout-btn');
const infoName = document.getElementById('info-name');
const infoVersion = document.getElementById('info-version');
const infoDesc = document.getElementById('info-desc');
const infoMeta = document.getElementById('info-meta');
const infoChangelog = document.getElementById('info-changelog');
const infoReset = document.getElementById('info-reset');

let activeTab = 'accept';
let activeMainTab = 'comments';
let layoutMode = 'tabs';
let dirty = false;
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

function linesFrom(text) {
    return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function load() {
    let data = null;
    try {
        data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        data = null;
    }
    categories.forEach((key) => {
        const saved = data && data[key];
        if (saved && Array.isArray(saved.comments)) {
            state[key].comments = saved.comments;
            state[key].index = typeof saved.index === 'number' ? saved.index : 0;
        } else {
            state[key].comments = [...DEFAULTS[key]];
            state[key].index = 0;
        }
    });
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
                width: layoutMode === 'stack' ? 680 : (layoutMode === 'cards' ? 400 : 360),
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

function renderRows() {
    rowsEl.innerHTML = '';
    categories.forEach((key) => {
        const s = state[key];
        const row = document.createElement('div');
        row.className = 'row' + (s.comments.length ? '' : ' disabled');
        row.dataset.key = key;
        row.title = '';
        row.innerHTML =
            '<span class="row-icon" aria-hidden="true">' + ROW_ICONS[key] + '</span>' +
            '<div class="row-line">' +
                '<span class="name">' + LABELS[key] + '</span>' +
                '<span class="row-actions">' +
                    '<button type="button" class="mini mini-copy" data-act="copy" title="Copy to clipboard">Copy</button>' +
                    '<button type="button" class="mini" data-act="prev" title="Previous comment">Prev</button>' +
                    '<button type="button" class="mini" data-act="reset" title="Reset to first comment">Reset</button>' +
                '</span>' +
                '<span class="pos">[' + (s.comments.length ? s.index + 1 : 0) + ']</span>' +
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

async function writeClipboard(text) {
    if (window.popupAPI && typeof window.popupAPI.copyText === 'function') {
        try {
            return await window.popupAPI.copyText(text);
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
    const ok = await writeClipboard(buildDateLine());
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

function setDirty(value) {
    dirty = value;
    saveStatus.textContent = value ? 'Unsaved changes' : 'All changes saved';
    saveStatus.classList.toggle('dirty', value);
    saveBtn.classList.toggle('attention', value);
}

function updateCounts() {
    let total = 0;
    categories.forEach((key) => {
        total += linesFrom(textareas[key].value).length;
    });
    totalEl.textContent = total === 1 ? '1 comment' : `${total} comments`;
    if (activeTab === 'prompt') {
        const n = linesFrom(promptText.value).length;
        editorCount.textContent = n === 1 ? '1 line' : `${n} lines`;
        return;
    }
    const n = linesFrom(textareas[activeTab].value).length;
    editorCount.textContent = `${n} comment${n === 1 ? '' : 's'}`;
}

function addComment() {
    if (activeTab === 'prompt') return;
    const value = addInput.value.trim();
    if (!value) return;
    const ta = textareas[activeTab];
    ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + value;
    addInput.value = '';
    updateCounts();
    setDirty(true);
    ta.focus();
}

function setTab(key) {
    activeTab = key;
    etabs.forEach((b) => b.classList.toggle('active', b.dataset.key === key));
    categories.forEach((k) => textareas[k].classList.toggle('active', k === key));
    promptText.classList.toggle('active', key === 'prompt');
    promptHead.classList.toggle('active', key === 'prompt');
    editorEl.classList.toggle('prompt-tab', key === 'prompt');
    updateCounts();
    syncHeight();
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
    layoutBtn.setAttribute('aria-pressed', layoutMode === 'stack' ? 'true' : 'false');
    layoutBtn.title = layoutMode === 'tabs'
        ? 'Switch to Side by side layout'
        : layoutMode === 'stack'
            ? 'Switch to Card layout'
            : 'Switch to Tabs layout';
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
    syncHeight();
}

function loadLayout() {
    const saved = localStorage.getItem(LAYOUT_KEY);
    layoutMode = (saved === 'stack' || saved === 'cards') ? saved : 'tabs';
    applyLayout();
}

function saveAll() {
    categories.forEach((key) => {
        state[key].comments = linesFrom(textareas[key].value);
        if (state[key].index >= state[key].comments.length) state[key].index = 0;
    });
    save();
    renderRows();
    pushQuickState();
    updateCounts();
    setDirty(false);
    showToast('Saved all comment lists.');
}

function restoreDefaults() {
    if (activeTab === 'prompt') return;
    state[activeTab].comments = [...DEFAULTS[activeTab]];
    state[activeTab].index = 0;
    textareas[activeTab].value = state[activeTab].comments.join('\n');
    save();
    renderRows();
    pushQuickState();
    updateCounts();
    setDirty(false);
    showToast(`${LABELS[activeTab]} list reset to defaults.`);
}

function toggleEditor() {
    const open = editorEl.classList.toggle('open');
    editorToggle.textContent = open ? 'Hide editor' : 'Edit comments';
    commentsPanel.classList.toggle('editor-open', open);
    syncHeight();
}

function renderInfoMeta(info) {
    const rows = [
        ['Author', info.author],
        ['License', info.license],
        ['OS', info.platform],
        ['Electron', info.electron],
        ['Chromium', info.chrome],
        ['Node', info.node],
        ['Data', info.userData],
        ['Build', info.buildDate],
    ];
    infoMeta.innerHTML = rows.map(([label, value]) =>
        '<div class="info-meta-row">' +
            '<span class="info-meta-label">' + escapeHtml(label) + '</span>' +
            '<span class="info-meta-value">' + escapeHtml(String(value)) + '</span>' +
        '</div>'
    ).join('');
}

function renderChangelog(changelog) {
    const toggle = document.querySelector('.info-section-toggle[data-section="changelog"]');
    if (!Array.isArray(changelog) || !changelog.length) {
        if (toggle) toggle.style.display = 'none';
        return;
    }
    if (toggle) toggle.style.display = '';
    infoChangelog.innerHTML = changelog.map((entry) =>
        '<div class="info-changelog-entry">' +
            '<div class="info-changelog-version">' + escapeHtml(entry.version) + '</div>' +
            (Array.isArray(entry.notes) && entry.notes.length
                ? '<ul class="info-changelog-notes">' +
                    entry.notes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('') +
                  '</ul>'
                : '') +
        '</div>'
    ).join('');
}

let resetArmed = false;
let resetTimer = null;
function handleReset() {
    if (!resetArmed) {
        resetArmed = true;
        infoReset.textContent = 'Click again to confirm';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            resetArmed = false;
            infoReset.textContent = 'Reset app data';
        }, 3000);
        return;
    }
    localStorage.clear();
    location.reload();
}

function loadPrompt() {
    const saved = localStorage.getItem(PROMPT_KEY);
    promptText.value = saved === null ? defaultPrompt : saved;
}

let promptSaveTimer = null;
promptText.addEventListener('input', () => {
    promptStatus.textContent = 'Saving...';
    clearTimeout(promptSaveTimer);
    promptSaveTimer = setTimeout(() => {
        localStorage.setItem(PROMPT_KEY, promptText.value);
        promptStatus.textContent = 'Saved';
    }, 400);
});

async function copyPrompt() {
    const text = promptText.value.trim();
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

function renderSheetPreview() {
    updateSheetActionButton();
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
        showToast(`${code} is already added — unit codes must be unique.`);
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

editorToggle.addEventListener('click', toggleEditor);
saveBtn.addEventListener('click', saveAll);
addBtn.addEventListener('click', addComment);
addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addComment();
    }
});
restoreBtn.addEventListener('click', restoreDefaults);
document.querySelectorAll('.info-section-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
        const body = document.querySelector('.info-section-body[data-body="' + btn.dataset.section + '"]');
        const willOpen = !btn.classList.contains('open');

        document.querySelectorAll('.info-section-toggle').forEach((other) => {
            other.classList.remove('open');
            other.setAttribute('aria-expanded', 'false');
            const ob = document.querySelector('.info-section-body[data-body="' + other.dataset.section + '"]');
            if (ob) ob.classList.add('hidden');
        });

        if (willOpen) {
            btn.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
            if (body) body.classList.remove('hidden');
        }
    });
});
infoReset.addEventListener('click', handleReset);
infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = infoWrap.classList.toggle('open');
    infoBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.addEventListener('click', (e) => {
    if (!infoWrap.contains(e.target)) {
        infoWrap.classList.remove('open');
        infoBtn.setAttribute('aria-expanded', 'false');
    }
    if (!organizerWrap.contains(e.target)) {
        organizerWrap.classList.remove('open');
        organizerBtn.setAttribute('aria-expanded', 'false');
    }
});
function closeInfoDropdown() {
    infoWrap.classList.remove('open');
    infoBtn.setAttribute('aria-expanded', 'false');
}
function closeOrganizerDropdown() {
    organizerWrap.classList.remove('open');
    organizerBtn.setAttribute('aria-expanded', 'false');
}
if (window.popupAPI && typeof window.popupAPI.onClosed === 'function') {
    window.popupAPI.onClosed(closeInfoDropdown);
    window.popupAPI.onClosed(closeOrganizerDropdown);
}
organizerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = organizerWrap.classList.toggle('open');
    organizerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});
mainTabs.forEach((b) => b.addEventListener('click', () => setMainTab(b.dataset.tab)));
const LAYOUT_CYCLE = { tabs: 'stack', stack: 'cards', cards: 'tabs' };
layoutBtn.addEventListener('click', () => {
    layoutMode = LAYOUT_CYCLE[layoutMode] || 'tabs';
    localStorage.setItem(LAYOUT_KEY, layoutMode);
    applyLayout();
});
etabs.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.key)));
Object.values(textareas).forEach((ta) => {
    ta.addEventListener('input', () => {
        updateCounts();
        setDirty(true);
    });
    ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveAll();
        }
    });
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (infoWrap.classList.contains('open')) {
            infoWrap.classList.remove('open');
            infoBtn.setAttribute('aria-expanded', 'false');
            infoBtn.focus();
            return;
        }
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
sheetBtn.addEventListener('click', copySheet);
let sheetTimer = null;
[sheetId, sheetName].forEach((el) => {
    el.addEventListener('input', () => {
        clearTimeout(sheetTimer);
        sheetTimer = setTimeout(persistSheetData, 400);
    });
});
sheetReset.addEventListener('click', resetSheetData);
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
loadPrompt();
loadSheetInputs();
loadOrganizerPath();
renderSheetPreview();
selectMark('Checked');
categories.forEach((key) => {
    textareas[key].value = state[key].comments.join('\n');
});
renderRows();
setTab('accept');
loadLayout();
updateCounts();
setDirty(false);
pushQuickState();
if (window.popupAPI && typeof window.popupAPI.getAppInfo === 'function') {
    window.popupAPI.getAppInfo().then((info) => {
        if (!info) return;
        infoName.textContent = info.name;
        infoVersion.textContent = `Version ${info.version}`;
        infoDesc.textContent = info.description;
        renderInfoMeta(info);
        renderChangelog(info.changelog);
    });
}
syncHeight();
