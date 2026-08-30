const COMMENT_KEYS = ['accept', 'aireject', 'copyreject'];

const state = {};
categories.forEach((key) => {
    state[key] = { comments: [], index: 0 };
});

const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('[data-view-panel]');
const etabs = document.querySelectorAll('.etab');
const toastEl = document.getElementById('toast');
const editorCount = document.getElementById('editor-count');
const saveStatus = document.getElementById('save-status');
const saveBtn = document.getElementById('save-btn');
const addInput = document.getElementById('editor-add-input');
const addBtn = document.getElementById('editor-add-btn');
const restoreBtn = document.getElementById('editor-restore');
const promptBtn = document.getElementById('prompt-btn');
const commentList = document.getElementById('comment-list');
const searchInput = document.getElementById('editor-search');
const bulkDelBtn = document.getElementById('editor-bulk-del');
const editorListWrap = document.getElementById('editor-list-wrap');
const promptWrap = document.getElementById('prompt-wrap');
const promptText = document.getElementById('prompt-text');

const aboutVersion = document.getElementById('mw-version');
const infoName = document.getElementById('mw-info-name');
const infoVersion = document.getElementById('mw-info-version');
const infoDesc = document.getElementById('mw-info-desc');
const infoMeta = document.getElementById('mw-info-meta');
const infoChangelog = document.getElementById('mw-info-changelog');
const githubLink = document.getElementById('mw-github-link');
const developerEl = document.getElementById('mw-developer');
const helperEl = document.getElementById('mw-helper');
const updateBtn = document.getElementById('mw-update-btn');
const diagnosticsBtn = document.getElementById('mw-diagnostics-btn');
const resetBtn = document.getElementById('mw-reset');
const layoutPickerOptions = document.querySelectorAll('#mw-layout-picker .layout-picker-option');
const dateFirstToggle = document.getElementById('mw-date-first');
const themePickerOptions = document.querySelectorAll('#mw-theme-picker .theme-option');
const accentSwatches = document.querySelectorAll('#mw-accent-picker .accent-swatch');
const accentCustomEl = document.getElementById('mw-accent-custom-btn');
// The swatch buttons only carry their color in data-accent — nothing paints
// that onto the button itself, so give each one its background here.
accentSwatches.forEach((b) => { b.style.backgroundColor = b.dataset.accent; });
const colorPopover = document.getElementById('mw-color-popover');
const cpSv = document.getElementById('cp-sv');
const cpSvHandle = document.getElementById('cp-sv-handle');
const cpHue = document.getElementById('cp-hue');
const cpHueHandle = document.getElementById('cp-hue-handle');
const cpPreview = document.getElementById('cp-preview');
const cpEyedrop = document.getElementById('cp-eyedrop');
const cpR = document.getElementById('cp-r');
const cpG = document.getElementById('cp-g');
const cpB = document.getElementById('cp-b');
const startupToggle = document.getElementById('mw-startup');
const confirmDeleteToggle = document.getElementById('mw-confirm-delete');
const closeAfterCopyToggle = document.getElementById('mw-close-after-copy');
const autoCheckUpdatesToggle = document.getElementById('mw-auto-check-updates');
const hotkeyInput = document.getElementById('mw-hotkey-input');
const hotkeyClear = document.getElementById('mw-hotkey-clear');
const backupBtn = document.getElementById('mw-backup');
const restoreBtn2 = document.getElementById('mw-restore');
const restoreModeOptions = document.querySelectorAll('#mw-restore-mode .restore-mode-option');
const rollbackBtn = document.getElementById('mw-rollback');

let activeTab = 'accept';
let dirty = false;
let searchQuery = '';
let selectedIndices = new Set();

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
    let mergedAny = false;
    categories.forEach((key) => {
        const saved = data && data[key];
        if (saved && Array.isArray(saved.comments)) {
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

function setDirty(value) {
    dirty = value;
    saveStatus.textContent = value ? 'Unsaved changes' : 'All changes saved';
    saveStatus.classList.toggle('dirty', value);
    saveBtn.classList.toggle('attention', value);
}

function updateCounts() {
    if (activeTab === 'prompt') {
        const n = linesFrom(promptText.value).length;
        editorCount.textContent = n === 1 ? '1 line' : `${n} lines`;
        return;
    }
    const n = state[activeTab].comments.length;
    const shown = activeTab === 'prompt' ? n : filteredIndices().length;
    const base = n === 1 ? '1 comment' : `${n} comments`;
    if (activeTab !== 'prompt' && searchQuery.trim() && shown !== n) {
        editorCount.textContent = `${shown} of ${base}`;
    } else {
        editorCount.textContent = base;
    }
}

const escapeDiv = document.createElement('div');
function escapeHtml(str) {
    escapeDiv.textContent = str;
    return escapeDiv.innerHTML;
}

// Build a single comment card using DOM APIs (safer than innerHTML for
// user-entered text) and wire up its inline controls.
function createCard(key, index) {
    const list = state[key].comments;
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.dataset.index = index;
    card.draggable = true;
    if (index === state[key].index) card.classList.add('current');
    if (selectedIndices.has(index)) card.classList.add('selected');

    const top = document.createElement('div');
    top.className = 'card-top';

    const left = document.createElement('div');
    left.className = 'card-left';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'card-check';
    check.title = selectedIndices.has(index) ? 'Deselect' : 'Select for bulk action';
    check.setAttribute('aria-label', check.title);
    check.checked = selectedIndices.has(index);
    check.addEventListener('change', () => {
        if (check.checked) selectedIndices.add(index);
        else selectedIndices.delete(index);
        card.classList.toggle('selected', check.checked);
        updateBulkBtn();
    });
    left.appendChild(check);

    const num = document.createElement('span');
    num.className = 'card-index';
    num.textContent = index + 1;
    left.appendChild(num);

    top.appendChild(left);

    const tools = document.createElement('div');
    tools.className = 'card-tools';

    const mkBtn = (action, label, title) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'card-btn ' + action;
        b.dataset.action = action;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.textContent = label;
        return b;
    };

    tools.appendChild(mkBtn('up', '\u2191', 'Move up'));
    tools.appendChild(mkBtn('down', '\u2193', 'Move down'));
    tools.appendChild(mkBtn('delete', '\u2715', 'Delete comment'));

    top.appendChild(tools);
    card.appendChild(top);

    dragStart(card, index);
    dropTarget(card, index);

    const body = document.createElement('div');
    body.className = 'card-body';
    // Declared here (assigned once the button is created below) so the
    // textarea's input handler can toggle its visibility live as the user
    // types a placeholder in or out, instead of only picking it up on the
    // next full re-render.
    let previewBtn = null;
    const ta = document.createElement('textarea');
    ta.className = 'card-text';
    ta.spellcheck = false;
    ta.value = list[index];
    ta.addEventListener('input', () => {
        autosizeTextarea(ta);
        list[index] = ta.value;
        updateCardCount(card, ta.value);
        const hasTokens = placeholderTokens(ta.value).length > 0;
        if (previewBtn) previewBtn.hidden = !hasTokens;
        if (!hasTokens) {
            preview.classList.add('hidden');
            if (previewBtn) previewBtn.textContent = 'Preview';
        }
        if (!preview.classList.contains('hidden')) {
            card.querySelector('.card-preview-text').textContent =
                substitutePlaceholders(ta.value, PLACEHOLDER_SAMPLE);
        }
        updateCounts();
        setDirty(true);
    });
    ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveAll();
        }
    });
    body.appendChild(ta);
    autosizeTextarea(ta);

    const preview = document.createElement('div');
    preview.className = 'card-preview hidden';
    const previewTitle = document.createElement('div');
    previewTitle.className = 'card-preview-title';
    previewTitle.textContent = 'Preview \u2014 placeholders substituted:';
    preview.appendChild(previewTitle);
    const previewText = document.createElement('div');
    previewText.className = 'card-preview-text';
    previewText.textContent = substitutePlaceholders(list[index], PLACEHOLDER_SAMPLE);
    preview.appendChild(previewText);
    body.appendChild(preview);

    card.appendChild(body);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const current = document.createElement('button');
    current.type = 'button';
    current.className = 'card-current';
    current.textContent = 'Set as current';
    current.addEventListener('click', () => setCurrent(key, index));
    foot.appendChild(current);

    previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'card-preview-btn';
    previewBtn.textContent = 'Preview';
    previewBtn.hidden = !placeholderTokens(list[index]).length;
    previewBtn.addEventListener('click', () => {
        const show = preview.classList.toggle('hidden');
        previewBtn.textContent = show ? 'Preview' : 'Hide preview';
        previewText.textContent = substitutePlaceholders(list[index], PLACEHOLDER_SAMPLE);
    });
    foot.appendChild(previewBtn);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const count = document.createElement('span');
    count.className = 'card-charcount';
    const usage = document.createElement('span');
    usage.className = 'card-usage';
    const used = usageCount(key, index);
    usage.textContent = used === 1 ? 'used 1x' : used > 1 ? `used ${used}x` : '';
    usage.title = 'Times this comment has been copied';
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    if (index === state[key].index) badge.textContent = 'In use';
    meta.appendChild(count);
    meta.appendChild(usage);
    meta.appendChild(badge);
    foot.appendChild(meta);

    card.appendChild(foot);
    updateCardCount(card, list[index]);

    tools.querySelector('[data-action="up"]').addEventListener('click', () => moveComment(key, index, -1));
    tools.querySelector('[data-action="down"]').addEventListener('click', () => moveComment(key, index, 1));
    tools.querySelector('[data-action="delete"]').addEventListener('click', () => deleteComment(key, index));

    return card;
}

function autosizeTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}

function updateCardCount(card, text) {
    const count = card.querySelector('.card-charcount');
    if (!count) return;
    const chars = text.length;
    const lines = text ? text.split('\n').length : 0;
    count.textContent = `${chars} chars \u00b7 ${lines} line${lines === 1 ? '' : 's'}`;
}

function filteredIndices() {
    const list = state[activeTab].comments;
    if (!searchQuery.trim()) {
        return list.map((_, i) => i);
    }
    const q = searchQuery.trim().toLowerCase();
    return list.map((c, i) => ({ c, i }))
        .filter(({ c }) => c.toLowerCase().includes(q))
        .map(({ i }) => i);
}

function renderList() {
    if (activeTab === 'prompt') {
        commentList.innerHTML = '';
        return;
    }
    commentList.innerHTML = '';
    const indices = filteredIndices();
    if (!indices.length) {
        const empty = document.createElement('div');
        empty.className = 'comment-list-empty';
        empty.textContent = searchQuery.trim()
            ? 'No comments match your search.'
            : 'No comments yet \u2014 add one below.';
        commentList.appendChild(empty);
        return;
    }
    indices.forEach((i) => {
        commentList.appendChild(createCard(activeTab, i));
    });
    updateCounts();
}

function setCurrent(key, index) {
    state[key].index = index;
    save();
    renderList();
    showToast(`${LABELS[key]}: comment ${index + 1} set as current.`);
}

function deleteComment(key, index) {
    const list = state[key].comments;
    if (!list.length) return;
    if (confirmDeleteEnabled() && !window.confirm('Delete this comment? You can still use Undo right after.')) {
        return;
    }
    const [removed] = list.splice(index, 1);
    if (state[key].index >= list.length) state[key].index = list.length ? list.length - 1 : 0;
    if (index < state[key].index && state[key].index > 0) state[key].index -= 1;
    save();
    selectedIndices.delete(index);
    renderList();
    setDirty(false);
    pushUndo({ key, action: 'delete', index, text: removed });
    showUndoToast('Comment deleted.', {});
    syncHeight();
}

function moveComment(key, index, dir) {
    const list = state[key].comments;
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const tmp = list[index];
    list[index] = list[target];
    list[target] = tmp;
    if (state[key].index === index) state[key].index = target;
    else if (state[key].index === target) state[key].index = index;
    save();
    renderList();
    setDirty(false);
    showToast('Order changed.');
}

/* ---------- Usage tracking ---------- */

function loadUsage() {
    try {
        return JSON.parse(localStorage.getItem(USAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}
function saveUsage(usage) {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}
function usageCount(key, index) {
    const usage = loadUsage();
    const entry = usage[key] && usage[key][index];
    return typeof entry === 'number' ? entry : 0;
}

/* ---------- Bulk select / delete ---------- */

function updateBulkBtn() {
    bulkDelBtn.disabled = selectedIndices.size === 0;
    bulkDelBtn.textContent = selectedIndices.size
        ? `Delete selected (${selectedIndices.size})`
        : 'Delete selected';
}

function clearSelection() {
    selectedIndices.clear();
    updateBulkBtn();
}

function bulkDelete() {
    if (!selectedIndices.size) return;
    if (confirmDeleteEnabled() && !window.confirm(`Delete ${selectedIndices.size} selected comment${selectedIndices.size === 1 ? '' : 's'}?`)) {
        return;
    }
    const list = state[activeTab].comments;
    const indices = [...selectedIndices].sort((a, b) => b - a);
    const removed = indices.map((i) => ({ index: i, text: list[i] }));
    indices.forEach((i) => list.splice(i, 1));
    if (state[activeTab].index >= list.length) {
        state[activeTab].index = list.length ? list.length - 1 : 0;
    }
    let currentPos = state[activeTab].index;
    removed.forEach(({ index }) => {
        if (index < currentPos) currentPos -= 1;
    });
    state[activeTab].index = Math.max(0, Math.min(currentPos, list.length - 1));
    const insertAt = Math.min(...indices);
    save();
    clearSelection();
    renderList();
    setDirty(false);
    pushUndo({ key: activeTab, action: 'bulk-delete', index: insertAt, removed });
    showToast(`Deleted ${removed.length} comment${removed.length === 1 ? '' : 's'}.`);
    syncHeight();
}

/* ---------- Undo ---------- */

let undoStack = [];
let undoExpire = 0;

function pushUndo(entry) {
    undoStack = undoStack.filter((e) => e.key === entry.key);
    undoStack.push(entry);
    undoExpire = Date.now() + 5000;
}

let undoToastTimer = null;
function showUndoToast(message, entry) {
    toastEl.innerHTML = '';
    toastEl.textContent = message + ' ';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'toast-undo';
    undo.textContent = 'Undo';
    undo.addEventListener('click', () => {
        popUndo();
        clearTimeout(undoToastTimer);
        toastEl.classList.remove('show');
    });
    toastEl.appendChild(undo);
    toastEl.classList.add('show');
    clearTimeout(undoToastTimer);
    undoToastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
        if (undoStack.length && Date.now() > undoExpire) undoStack = [];
    }, 4000);
}

function popUndo() {
    const entry = undoStack.pop();
    if (!entry) return;
    undoStack = [];
    if (entry.key !== activeTab) {
        showToast('Undo only works in the same tab.');
        return;
    }
    if (entry.action === 'delete') {
        state[activeTab].comments.splice(entry.index, 0, entry.text);
    } else if (entry.action === 'bulk-delete') {
        // Each removed comment must go back at its own original index (in
        // ascending order) rather than all together at one spot, or a
        // non-contiguous selection (e.g. rows 2, 5, 7) comes back bunched
        // up and reversed instead of restored to its original positions.
        entry.removed.slice().sort((a, b) => a.index - b.index).forEach((r) => {
            state[activeTab].comments.splice(r.index, 0, r.text);
        });
    }
    save();
    renderList();
    setDirty(false);
    showToast('Undid deletion.');
    syncHeight();
}

/* ---------- Drag & drop reordering ---------- */

let dragIndex = null;

function dragStart(card, index) {
    card.addEventListener('dragstart', (e) => {
        dragIndex = index;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try {
            e.dataTransfer.setData('text/plain', String(index));
        } catch (err) {}
    });
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        commentList.querySelectorAll('.comment-card').forEach((c) => c.classList.remove('drag-over'));
        dragIndex = null;
    });
}

function dropTarget(card, index) {
    card.addEventListener('dragover', (e) => {
        if (dragIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });
    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (dragIndex === null || dragIndex === index) {
            dragIndex = null;
            return;
        }
        reorderComment(activeTab, dragIndex, index);
        dragIndex = null;
    });
}

function reorderComment(key, from, to) {
    const list = state[key].comments;
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    if (state[key].index === from) state[key].index = to;
    else if (state[key].index === to) state[key].index = from;
    save();
    renderList();
    setDirty(false);
    showToast('Order changed.');
}

function setTab(key) {
    activeTab = key;
    etabs.forEach((b) => b.classList.toggle('active', b.dataset.key === key));
    const isPrompt = key === 'prompt';
    editorListWrap.classList.toggle('hidden', isPrompt);
    promptWrap.classList.toggle('hidden', !isPrompt);
    promptBtn.style.display = isPrompt ? '' : 'none';
    if (searchQuery !== '' && !isPrompt) {
        searchQuery = '';
        searchInput.value = '';
    }
    clearSelection();
    if (isPrompt) loadPrompt();
    renderList();
    syncHeight();
}

function addComment() {
    if (activeTab === 'prompt') return;
    const value = addInput.value.trim();
    if (!value) return;
    const dupIndex = state[activeTab].comments.findIndex((c) => c.trim().toLowerCase() === value.toLowerCase());
    if (dupIndex !== -1) {
        showToast('That comment already exists \u2014 not adding a duplicate.');
        addInput.classList.add('duplicate');
        setTimeout(() => addInput.classList.remove('duplicate'), 1200);
        addInput.select();
        return;
    }
    state[activeTab].comments.push(value);
    addInput.value = '';
    save();
    if (searchQuery.trim() && !value.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        searchQuery = '';
        searchInput.value = '';
    }
    renderList();
    setDirty(false);
    showToast('Comment added.');
    updateCounts();
    const cards = commentList.querySelectorAll('.comment-card');
    if (cards.length) cards[cards.length - 1].querySelector('.card-text').focus();
    syncHeight();
}

function saveAll() {
    commentList.querySelectorAll('.comment-card').forEach((card) => {
        const i = Number(card.dataset.index);
        const ta = card.querySelector('.card-text');
        if (ta) state[activeTab].comments[i] = ta.value;
    });
    save();
    renderList();
    setDirty(false);
    showToast('Saved all changes.');
}

function restoreDefaults() {
    if (activeTab === 'prompt') return;
    state[activeTab].comments = [...DEFAULTS[activeTab]];
    state[activeTab].index = 0;
    save();
    clearSelection();
    renderList();
    setDirty(false);
    showToast(`${LABELS[activeTab]} list reset to defaults.`);
}

function loadPrompt() {
    if (activeTab !== 'prompt') return;
    const saved = localStorage.getItem(PROMPT_KEY);
    promptText.value = saved === null ? defaultPrompt : saved;
}

let promptSaveTimer = null;
promptText.addEventListener('input', () => {
    clearTimeout(promptSaveTimer);
    promptSaveTimer = setTimeout(() => {
        localStorage.setItem(PROMPT_KEY, promptText.value);
        setDirty(false);
    }, 400);
});

async function copyPrompt() {
    const text = promptText.value.trim();
    if (!text) {
        showToast('Prompt is empty \u2014 add prompt text first.');
        return;
    }
    let ok = false;
    if (window.mainWindowAPI && typeof window.mainWindowAPI.copyText === 'function') {
        try {
            ok = await window.mainWindowAPI.copyText(text);
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

function commentCountsText() {
    let data = null;
    try {
        data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        data = null;
    }
    const parts = [];
    let total = 0;
    categories.forEach((key) => {
        const list = data && data[key] && Array.isArray(data[key].comments)
            ? data[key].comments
            : DEFAULTS[key];
        parts.push(`${LABELS[key]} ${list.length}`);
        total += list.length;
    });
    return `${parts.join(' \u00b7 ')} (${total} total)`;
}

function dataSizeText() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += (key.length + (value ? value.length : 0)) * 2;
    }
    if (total < 1024) return `${total} B`;
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} kB`;
    return `${(total / (1024 * 1024)).toFixed(2)} MB`;
}

function renderInfoMeta(info) {
    const rows = [
        ['Author', info.author],
        ['License', info.license],
        ['OS', info.platform],
        ['Resolution', info.resolution],
        ['Electron', info.electron],
        ['Chromium', info.chrome],
        ['Node', info.node],
        ['Comments saved', commentCountsText()],
        ['Data size', dataSizeText()],
        ['Copies', info.copyCount],
        ['Install path', info.exePath],
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

function changelogEntryHtml(entry) {
    let body = '';
    if (Array.isArray(entry.categories) && entry.categories.length) {
        body = entry.categories.map((cat) =>
            '<li class="info-changelog-category">' + escapeHtml(cat.heading) + '</li>' +
            (Array.isArray(cat.notes) ? cat.notes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('') : '')
        ).join('');
    } else if (Array.isArray(entry.notes) && entry.notes.length) {
        body = entry.notes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('');
    }
    return '<div class="info-changelog-entry">' +
        '<div class="info-changelog-version">' + escapeHtml(entry.version) + '</div>' +
        (body ? '<ul class="info-changelog-notes">' + body + '</ul>' : '') +
    '</div>';
}

function renderChangelog(changelog) {
    const wrap = document.getElementById('mw-changelog-card');
    if (!Array.isArray(changelog) || !changelog.length) {
        if (wrap) wrap.style.display = 'none';
        const latest = document.getElementById('mw-latest-update');
        if (latest) latest.hidden = true;
        return;
    }
    if (wrap) wrap.style.display = '';
    const latest = document.getElementById('mw-latest-update');
    const latestVersion = document.getElementById('mw-latest-update-version');
    const latestNotes = document.getElementById('mw-latest-update-notes');
    if (latest) latest.hidden = false;
    if (latestVersion) latestVersion.textContent = changelog[0].version || '';
    if (latestNotes) latestNotes.innerHTML = changelogEntryHtml(changelog[0]);
    infoChangelog.innerHTML = changelog.slice(1, 5).map(changelogEntryHtml).join('');
}

let resetArmed = false;
let resetTimer = null;
function handleReset() {
    if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = 'Click again to confirm';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            resetArmed = false;
            resetBtn.textContent = 'Reset app data';
        }, 3000);
        return;
    }
    localStorage.clear();
    location.reload();
}

function loadLayoutSetting() {
    const saved = localStorage.getItem(LAYOUT_KEY);
    const mode = (saved === 'tabs' || saved === 'stack') ? saved : 'cards';
    layoutPickerOptions.forEach((b) => b.classList.toggle('active', b.dataset.layout === mode));
}

const LAYOUT_ORDER = ['cards', 'tabs', 'stack'];

function getEffectiveLayout() {
    const saved = localStorage.getItem(LAYOUT_KEY);
    return (saved === 'tabs' || saved === 'stack') ? saved : 'cards';
}

function setLayout(mode) {
    localStorage.setItem(LAYOUT_KEY, mode);
    layoutPickerOptions.forEach((b) => b.classList.toggle('active', b.dataset.layout === mode));
}

function cycleLayout() {
    const current = getEffectiveLayout();
    const idx = LAYOUT_ORDER.indexOf(current);
    const next = LAYOUT_ORDER[(idx + 1) % LAYOUT_ORDER.length];
    setLayout(next);
    return next;
}

function loadDateFirstSetting() {
    const saved = localStorage.getItem(DATE_FIRST_KEY);
    const enabled = saved === null ? true : saved !== '0';
    dateFirstToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
}

/* ---------- Confirm before delete ---------- */

function loadConfirmDeleteSetting() {
    const saved = localStorage.getItem(CONFIRM_DELETE_KEY);
    const enabled = saved === null ? true : saved !== '0';
    confirmDeleteToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
}

function confirmDeleteEnabled() {
    const saved = localStorage.getItem(CONFIRM_DELETE_KEY);
    return saved === null ? true : saved !== '0';
}

/* ---------- Close popup after copy ---------- */

function loadCloseAfterCopySetting() {
    const saved = localStorage.getItem(CLOSE_AFTER_COPY_KEY);
    const enabled = saved === '1';
    closeAfterCopyToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
}

/* ---------- Auto-check for updates on launch ---------- */

function loadAutoCheckUpdatesSetting() {
    const saved = localStorage.getItem(AUTO_CHECK_UPDATES_KEY);
    const enabled = saved === null ? true : saved !== '0';
    autoCheckUpdatesToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
}

function autoCheckUpdatesEnabled() {
    const saved = localStorage.getItem(AUTO_CHECK_UPDATES_KEY);
    return saved === null ? true : saved !== '0';
}

function runAutoUpdateCheck() {
    if (!autoCheckUpdatesEnabled()) return;
    // Wait for the window to settle, then quietly check. Updates surface a
    // toast; an up-to-date check stays silent.
    setTimeout(() => { checkForUpdates(true); }, 2500);
}

function setView(name) {
    navItems.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    panels.forEach((p) => p.classList.toggle('active', p.dataset.viewPanel === name));
    if (name === 'about') refreshAboutInfo();
}

/* ---------- Theme ---------- */

const THEME_NAMES = ['dark', 'light', 'midnight', 'sepia'];

function applyThemeClass(theme) {
    const t = THEME_NAMES.includes(theme) ? theme : 'dark';
    document.body.classList.remove('theme-light', 'theme-midnight', 'theme-sepia');
    document.body.classList.add('theme-' + t);
    document.body.dataset.theme = t;
    return t;
}

function applyAccent(color) {
    if (color) {
        document.body.style.setProperty('--accent', color);
    } else {
        document.body.style.removeProperty('--accent');
    }
}

let suppressPickerSync = false;

function syncAccentPicker(color) {
    accentSwatches.forEach((b) => b.classList.toggle('active', b.dataset.accent === color));
    const isPreset = !!color && Array.from(accentSwatches).some((b) => b.dataset.accent === color);
    accentCustomEl.classList.toggle('active', !!color && !isPreset);
    const customColor = color && !isPreset ? color : '#58a6ff';
    accentCustomEl.style.background = isPreset || !color
        ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'
        : customColor;
    // While the popover itself is driving a live drag, its cpHue0/cpSat0/cpVal0
    // state is the source of truth; re-deriving HSV from the rounded hex on
    // every tick would make the hue drift near the grayscale edges.
    if (!suppressPickerSync) setColorPickerState(customColor);
}

function loadAccentSetting() {
    const saved = localStorage.getItem(ACCENT_KEY);
    applyAccent(saved);
    syncAccentPicker(saved);
}

function setAccent(color, label) {
    if (color) {
        localStorage.setItem(ACCENT_KEY, color);
    } else {
        localStorage.removeItem(ACCENT_KEY);
    }
    applyAccent(color);
    syncAccentPicker(color);
    showToast(`${label || 'Accent'} applied.`);
}

/* ---------- Custom color popover (replaces the native <input type="color">
   picker, which is OS/Chromium chrome and can't be restyled) ---------- */

let cpHue0 = 209, cpSat0 = 65, cpVal0 = 100;

function clampNum(n, min, max) { return Math.min(max, Math.max(min, n)); }

function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
    };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = (((g - b) / d) % 6);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s: s * 100, v: max * 100 };
}

function rgbToHex(r, g, b) {
    const toHex = (n) => clampNum(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

// Paint the popover to match the current cpHue0/cpSat0/cpVal0 state and
// return the resulting hex.
function renderColorPopover() {
    const rgb = hsvToRgb(cpHue0, cpSat0, cpVal0);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    cpSv.style.backgroundColor = `hsl(${cpHue0}, 100%, 50%)`;
    cpSvHandle.style.left = cpSat0 + '%';
    cpSvHandle.style.top = (100 - cpVal0) + '%';
    cpHueHandle.style.left = (cpHue0 / 360 * 100) + '%';
    cpPreview.style.backgroundColor = hex;
    if (document.activeElement !== cpR) cpR.value = rgb.r;
    if (document.activeElement !== cpG) cpG.value = rgb.g;
    if (document.activeElement !== cpB) cpB.value = rgb.b;
    return hex;
}

// Load a hex color into the popover's internal HSV state (used when the
// accent changed from outside the popover — a preset click, restore, etc).
function setColorPickerState(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    cpHue0 = hsv.h;
    cpSat0 = hsv.s;
    cpVal0 = hsv.v;
    renderColorPopover();
}

// Apply the popover's current color as the app accent, without letting that
// round-trip back and clobber the popover's own HSV state mid-drag.
function commitColorPicker() {
    const hex = renderColorPopover();
    suppressPickerSync = true;
    setAccent(hex, 'Custom accent');
    suppressPickerSync = false;
}

function isColorPopoverOpen() {
    return !colorPopover.classList.contains('hidden');
}

function openColorPopover() {
    if (globalCapturing) stopGlobalCapture();
    if (capturingAction) stopCapture();
    const rect = accentCustomEl.getBoundingClientRect();
    const popW = 220;
    const popH = 300;
    let left = clampNum(rect.right - popW, 8, window.innerWidth - popW - 8);
    let top = rect.bottom + 8;
    if (top + popH > window.innerHeight - 8) top = rect.top - popH - 8;
    colorPopover.style.left = left + 'px';
    colorPopover.style.top = Math.max(8, top) + 'px';
    colorPopover.classList.remove('hidden');
    accentCustomEl.setAttribute('aria-expanded', 'true');
    renderColorPopover();
}

function closeColorPopover() {
    colorPopover.classList.add('hidden');
    accentCustomEl.setAttribute('aria-expanded', 'false');
}

accentCustomEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isColorPopoverOpen()) closeColorPopover();
    else openColorPopover();
});

document.addEventListener('click', (e) => {
    if (isColorPopoverOpen() && !colorPopover.contains(e.target) && e.target !== accentCustomEl) {
        closeColorPopover();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isColorPopoverOpen()) closeColorPopover();
});

function svPointerToState(clientX, clientY) {
    const rect = cpSv.getBoundingClientRect();
    const x = clampNum(clientX - rect.left, 0, rect.width);
    const y = clampNum(clientY - rect.top, 0, rect.height);
    cpSat0 = (x / rect.width) * 100;
    cpVal0 = 100 - (y / rect.height) * 100;
}

let svDragging = false;
cpSv.addEventListener('pointerdown', (e) => {
    svDragging = true;
    cpSv.setPointerCapture(e.pointerId);
    svPointerToState(e.clientX, e.clientY);
    commitColorPicker();
});
cpSv.addEventListener('pointermove', (e) => {
    if (!svDragging) return;
    svPointerToState(e.clientX, e.clientY);
    commitColorPicker();
});
cpSv.addEventListener('pointerup', (e) => {
    svDragging = false;
    try { cpSv.releasePointerCapture(e.pointerId); } catch (err) {}
});

function huePointerToState(clientX) {
    const rect = cpHue.getBoundingClientRect();
    const x = clampNum(clientX - rect.left, 0, rect.width);
    cpHue0 = (x / rect.width) * 360;
}

let hueDragging = false;
cpHue.addEventListener('pointerdown', (e) => {
    hueDragging = true;
    cpHue.setPointerCapture(e.pointerId);
    huePointerToState(e.clientX);
    commitColorPicker();
});
cpHue.addEventListener('pointermove', (e) => {
    if (!hueDragging) return;
    huePointerToState(e.clientX);
    commitColorPicker();
});
cpHue.addEventListener('pointerup', (e) => {
    hueDragging = false;
    try { cpHue.releasePointerCapture(e.pointerId); } catch (err) {}
});

[cpR, cpG, cpB].forEach((input) => {
    input.addEventListener('input', () => {
        input.value = input.value.replace(/[^\d]/g, '').slice(0, 3);
    });
    input.addEventListener('change', () => {
        const r = clampNum(parseInt(cpR.value, 10) || 0, 0, 255);
        const g = clampNum(parseInt(cpG.value, 10) || 0, 0, 255);
        const b = clampNum(parseInt(cpB.value, 10) || 0, 0, 255);
        const hsv = rgbToHsv(r, g, b);
        cpHue0 = hsv.h;
        cpSat0 = hsv.s;
        cpVal0 = hsv.v;
        commitColorPicker();
    });
});

// Chromium's native eyedropper, when available — no polyfill for browsers
// without it, the button just stays hidden.
if (typeof window.EyeDropper === 'function') {
    cpEyedrop.hidden = false;
    cpEyedrop.addEventListener('click', async () => {
        try {
            const result = await new window.EyeDropper().open();
            if (result && result.sRGBHex) {
                setColorPickerState(result.sRGBHex);
                commitColorPicker();
            }
        } catch (e) {
            // User canceled the pick — nothing to do.
        }
    });
}

function loadThemeSetting() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = applyThemeClass(saved);
    themePickerOptions.forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
}

function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    const t = applyThemeClass(theme);
    themePickerOptions.forEach((b) => b.classList.toggle('active', b.dataset.theme === t));
    loadAccentSetting();
}

/* ---------- Launch at startup ---------- */

async function loadStartupSetting() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.getLoginItem !== 'function') return;
    try {
        const state = await window.mainWindowAPI.getLoginItem();
        startupToggle.setAttribute('aria-checked', state ? 'true' : 'false');
    } catch (e) {}
}

/* ---------- Global hotkey ---------- */

let globalCapturing = false;

function renderGlobalHotkey() {
    if (globalCapturing) return;
    hotkeyInput.className = 'shortcut-capture hotkey-capture';
    const acc = hotkeyInput.dataset.acc || '';
    hotkeyInput.textContent = acc ? displayAccel(acc) : 'Click to set';
    hotkeyClear.disabled = !acc;
}

async function loadHotkeySetting() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.getGlobalHotkey !== 'function') return;
    try {
        const acc = await window.mainWindowAPI.getGlobalHotkey();
        hotkeyInput.dataset.acc = acc || '';
        renderGlobalHotkey();
    } catch (e) {}
}

async function applyHotkey(acc) {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.setGlobalHotkey !== 'function') return false;
    const result = await window.mainWindowAPI.setGlobalHotkey(acc || '');
    if (result && result.ok) {
        hotkeyInput.dataset.acc = result.accelerator || '';
        renderGlobalHotkey();
        if (result.registered) showToast(`Global hotkey set: ${displayAccel(result.accelerator)}`);
        else if (!acc) showToast('Global hotkey removed.');
        return true;
    } else if (result && result.error) {
        showToast(result.error);
        if (result.current) hotkeyInput.dataset.acc = result.current;
        renderGlobalHotkey();
        return false;
    }
    return false;
}

function startGlobalCapture() {
    if (globalCapturing) return;
    // End any in-window shortcut capture first so the two don't fight.
    if (capturingAction) stopCapture();
    globalCapturing = true;
    hotkeyInput.classList.add('capturing');
    hotkeyInput.textContent = 'Press keys\u2026';
}

function stopGlobalCapture() {
    if (!globalCapturing) return;
    globalCapturing = false;
    renderGlobalHotkey();
}

function handleGlobalCaptureKey(e) {
    if (!globalCapturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
        stopGlobalCapture();
        hotkeyInput.focus();
        return;
    }
    const hasMod = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;
    if (!hasMod) {
        showToast('Include Ctrl, Shift, or Alt.');
        return;
    }
    const accel = eventToAccel(e);
    if (!accel) return;
    stopGlobalCapture();
    applyHotkey(displayAccel(accel));
}

/* ---------- Backup / Restore ---------- */

function buildBackupPayload() {
    const payload = {
        app: 'comment-copier',
        version: 1,
        exported: new Date().toISOString(),
    };
    try {
        payload[STORAGE_KEY] = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {}
    payload[PROMPT_KEY] = localStorage.getItem(PROMPT_KEY);
    try {
        payload[SHEET_KEY] = JSON.parse(localStorage.getItem(SHEET_KEY));
    } catch (e) {}
    payload[LAYOUT_KEY] = localStorage.getItem(LAYOUT_KEY);
    payload[DATE_FIRST_KEY] = localStorage.getItem(DATE_FIRST_KEY);
    payload[THEME_KEY] = localStorage.getItem(THEME_KEY);
    payload[ACCENT_KEY] = localStorage.getItem(ACCENT_KEY);
    payload[HOTKEY_KEY] = localStorage.getItem(HOTKEY_KEY);
    try {
        payload[USAGE_KEY] = JSON.parse(localStorage.getItem(USAGE_KEY));
    } catch (e) {}
    payload[SHORTCUTS_KEY] = localStorage.getItem(SHORTCUTS_KEY);
    payload[CONFIRM_DELETE_KEY] = localStorage.getItem(CONFIRM_DELETE_KEY);
    payload[CLOSE_AFTER_COPY_KEY] = localStorage.getItem(CLOSE_AFTER_COPY_KEY);
    payload[AUTO_CHECK_UPDATES_KEY] = localStorage.getItem(AUTO_CHECK_UPDATES_KEY);
    return payload;
}

async function exportBackup() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.exportBackup !== 'function') {
        showToast('Backup unavailable.');
        return;
    }
    const payload = buildBackupPayload();
    const result = await window.mainWindowAPI.exportBackup(payload);
    if (result && result.ok) {
        showToast('Backup saved.');
    } else if (result && result.canceled) {
        return;
    } else {
        showToast((result && result.error) || 'Backup failed.');
    }
}

function getRestoreMode() {
    return localStorage.getItem(RESTORE_MODE_KEY) === 'merge' ? 'merge' : 'replace';
}

function syncRestoreModePicker() {
    const mode = getRestoreMode();
    restoreModeOptions.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}

function saveRollback() {
    try {
        localStorage.setItem(ROLLBACK_KEY, JSON.stringify({ snapshot: buildBackupPayload(), at: new Date().toISOString() }));
    } catch (e) {}
}

function loadRollback() {
    try {
        const cached = JSON.parse(localStorage.getItem(ROLLBACK_KEY));
        if (cached && cached.snapshot && typeof cached.snapshot === 'object') return cached;
    } catch (e) {}
    return null;
}

function renderRollbackState() {
    rollbackBtn.disabled = !loadRollback();
}

function normalizeComment(c) {
    return typeof c === 'string' ? c.trim().toLowerCase() : '';
}

function parseMaybe(raw) {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }
    return typeof raw === 'object' ? raw : null;
}

function mergeComments(backupRaw) {
    const backup = parseMaybe(backupRaw);
    if (backup === null || typeof backup !== 'object') return false;
    let current = null;
    try {
        current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        current = null;
    }
    const result = {};
    let changed = false;
    categories.forEach((key) => {
        const curEntry = current && current[key] && Array.isArray(current[key].comments) ? current[key] : null;
        const backupList = backup[key] && Array.isArray(backup[key].comments) ? backup[key].comments : [];
        const curList = curEntry ? curEntry.comments.slice() : [];
        const seen = new Set(curList.map(normalizeComment));
        backupList.forEach((c) => {
            const norm = normalizeComment(c);
            if (norm && !seen.has(norm)) {
                curList.push(c);
                seen.add(norm);
                changed = true;
            }
        });
        const curIndex = curEntry && typeof curEntry.index === 'number' ? curEntry.index : 0;
        const index = Math.min(curIndex, Math.max(curList.length - 1, 0));
        result[key] = { comments: curList, index };
    });
    if (changed) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        } catch (e) {}
    }
    return changed;
}

function mergeUsage(backupRaw) {
    const backup = parseMaybe(backupRaw);
    if (backup === null || typeof backup !== 'object') return false;
    const current = loadUsage();
    let changed = false;
    for (const cat of Object.keys(backup)) {
        const map = backup[cat];
        if (!map || typeof map !== 'object') continue;
        for (const idx of Object.keys(map)) {
            const val = typeof map[idx] === 'number' ? map[idx] : 0;
            if (val > 0) {
                if (!current[cat]) current[cat] = {};
                current[cat][idx] = (typeof current[cat][idx] === 'number' ? current[cat][idx] : 0) + val;
                changed = true;
            }
        }
    }
    if (changed) saveUsage(current);
    return changed;
}

function mergeFill(key, raw) {
    if (raw === undefined || raw === null) return false;
    const current = localStorage.getItem(key);
    let empty = current === null || current === '';
    if (key === SHEET_KEY && !empty) {
        try {
            const parsed = JSON.parse(current);
            const hasCodes = parsed && Array.isArray(parsed.codes) && parsed.codes.length > 0;
            const hasIdentity = parsed && (parsed.studentId || parsed.name);
            empty = !hasCodes && !hasIdentity;
        } catch (e) {
            empty = true;
        }
    }
    if (!empty) return false;
    localStorage.setItem(key, typeof raw === 'string' ? raw : JSON.stringify(raw));
    return true;
}

function applyBackupData(data, mode) {
    const replace = (key, raw) => {
        if (data[key] === undefined) return false;
        if (raw === undefined || raw === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, typeof raw === 'string' ? raw : JSON.stringify(raw));
        }
        return true;
    };
    if (mode !== 'merge') {
        replace(STORAGE_KEY, data[STORAGE_KEY]);
        replace(PROMPT_KEY, data[PROMPT_KEY]);
        replace(SHEET_KEY, data[SHEET_KEY]);
        replace(LAYOUT_KEY, data[LAYOUT_KEY]);
        replace(DATE_FIRST_KEY, data[DATE_FIRST_KEY]);
        replace(THEME_KEY, data[THEME_KEY]);
        replace(ACCENT_KEY, data[ACCENT_KEY]);
        replace(HOTKEY_KEY, data[HOTKEY_KEY]);
        replace(USAGE_KEY, data[USAGE_KEY]);
        replace(SHORTCUTS_KEY, data[SHORTCUTS_KEY]);
        replace(CONFIRM_DELETE_KEY, data[CONFIRM_DELETE_KEY]);
        replace(CLOSE_AFTER_COPY_KEY, data[CLOSE_AFTER_COPY_KEY]);
        replace(AUTO_CHECK_UPDATES_KEY, data[AUTO_CHECK_UPDATES_KEY]);
        return false;
    }
    mergeComments(data[STORAGE_KEY]);
    mergeFill(PROMPT_KEY, data[PROMPT_KEY]);
    mergeFill(SHEET_KEY, data[SHEET_KEY]);
    mergeFill(LAYOUT_KEY, data[LAYOUT_KEY]);
    mergeFill(DATE_FIRST_KEY, data[DATE_FIRST_KEY]);
    mergeFill(THEME_KEY, data[THEME_KEY]);
    mergeFill(ACCENT_KEY, data[ACCENT_KEY]);
    mergeFill(HOTKEY_KEY, data[HOTKEY_KEY]);
    mergeUsage(data[USAGE_KEY]);
    mergeFill(SHORTCUTS_KEY, data[SHORTCUTS_KEY]);
    mergeFill(CONFIRM_DELETE_KEY, data[CONFIRM_DELETE_KEY]);
    mergeFill(CLOSE_AFTER_COPY_KEY, data[CLOSE_AFTER_COPY_KEY]);
    mergeFill(AUTO_CHECK_UPDATES_KEY, data[AUTO_CHECK_UPDATES_KEY]);
    return true;
}

function reloadAfterRestore() {
    load();
    loadPrompt();
    renderList();
    updateCounts();
    loadLayoutSetting();
    loadDateFirstSetting();
    loadThemeSetting();
    loadAccentSetting();
    loadConfirmDeleteSetting();
    loadCloseAfterCopySetting();
    loadAutoCheckUpdatesSetting();
    loadHotkeySetting();
    syncRestoreModePicker();
    renderShortcutRows();
}

async function importBackup() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.importBackup !== 'function') {
        showToast('Restore unavailable.');
        return;
    }
    const result = await window.mainWindowAPI.importBackup();
    if (!result || result.canceled) return;
    if (!result.ok || !result.data) {
        showToast((result && result.error) || 'Restore failed.');
        return;
    }
    const data = result.data;
    if (!data || typeof data !== 'object') {
        showToast('Restore failed.');
        return;
    }
    const mode = getRestoreMode();
    saveRollback();
    applyBackupData(data, mode);
    reloadAfterRestore();
    renderRollbackState();
    showToast(mode === 'merge' ? 'Backup merged with current data.' : 'Data restored.');
}

function rollbackRestore() {
    const cached = loadRollback();
    if (!cached) {
        renderRollbackState();
        return;
    }
    applyBackupData(cached.snapshot, 'replace');
    localStorage.removeItem(ROLLBACK_KEY);
    reloadAfterRestore();
    renderRollbackState();
    showToast('Rolled back to the data from before the last restore.');
}

async function refreshAboutInfo() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.getAppInfo !== 'function') return;
    const info = await window.mainWindowAPI.getAppInfo();
    if (!info) return;
    aboutVersion.textContent = `v${info.version}`;
    infoName.textContent = info.name;
    infoVersion.textContent = `Version ${info.version}`;
    infoDesc.textContent = info.description;
    renderInfoMeta(info);
    renderChangelog(info.changelog);
    if (githubLink) githubLink.href = info.repository || githubLink.href;
    if (developerEl) developerEl.textContent = info.author;
    if (helperEl) helperEl.textContent = info.helper;
}

async function checkForUpdates(silent) {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.checkForUpdates !== 'function') {
        if (!silent) showToast('Update check unavailable.');
        return false;
    }
    if (!silent) {
        updateBtn.disabled = true;
        updateBtn.textContent = 'Checking\u2026';
    }
    let result = null;
    try {
        result = await window.mainWindowAPI.checkForUpdates();
    } catch (e) {
        result = null;
    }
    if (!silent) {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Check for updates';
    }
    if (!result || !result.ok) {
        if (!silent) showToast(result && result.error ? result.error : 'Update check failed.');
        return false;
    }
    if (result.updateAvailable) {
        showToast(`Update available: v${result.latest} (you have v${result.current}). Check What\u2019s new for the latest notes.`);
    } else if (!silent) {
        showToast(`Up to date \u2014 you\u2019re on v${result.current}.`);
    }
    return result.updateAvailable;
}

function diagnosticsText(info) {
    const lines = [];
    lines.push('Comment Copier \u2014 diagnostics');
    lines.push('==============================');
    lines.push(`Version: ${info.version}`);
    lines.push(`Build: ${info.buildDate}`);
    lines.push(`Platform: ${info.platform}`);
    lines.push(`Resolution: ${info.resolution}`);
    lines.push(`Electron: ${info.electron}`);
    lines.push(`Chromium: ${info.chrome}`);
    lines.push(`Node: ${info.node}`);
    lines.push(`Data size: ${dataSizeText()}`);
    lines.push(`Copies: ${info.copyCount}`);
    lines.push('Comments: ' + commentCountsText());
    lines.push(`Install path: ${info.exePath}`);
    lines.push(`Data path: ${info.userData}`);
    return lines.join('\n');
}

async function exportDiagnostics() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.getAppInfo !== 'function') {
        showToast('Diagnostics unavailable.');
        return;
    }
    const info = await window.mainWindowAPI.getAppInfo();
    if (!info) {
        showToast('Diagnostics unavailable.');
        return;
    }
    const text = diagnosticsText(info);
    let ok = false;
    if (window.mainWindowAPI && typeof window.mainWindowAPI.copyText === 'function') {
        try {
            ok = await window.mainWindowAPI.copyText(text);
        } catch (e) {
            ok = false;
        }
    }
    if (!ok) {
        showToast('Failed to copy diagnostics.');
        return;
    }
    showToast('Diagnostics copied \u2014 paste into your bug report.');
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

let syncHeightScheduled = false;
function syncHeight() {
    if (syncHeightScheduled) return;
    syncHeightScheduled = true;
    requestAnimationFrame(() => {
        syncHeightScheduled = false;
        const body = document.body;
        body.style.minHeight = '';
    });
}

// Keep in sync with data edited in the tray popup.
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
        const wasPrompt = activeTab === 'prompt';
        load();
        if (wasPrompt) loadPrompt();
        renderList();
        updateCounts();
    } else if (e.key === LAYOUT_KEY) {
        loadLayoutSetting();
    } else if (e.key === DATE_FIRST_KEY) {
        loadDateFirstSetting();
    } else if (e.key === CONFIRM_DELETE_KEY) {
        loadConfirmDeleteSetting();
    } else if (e.key === CLOSE_AFTER_COPY_KEY) {
        loadCloseAfterCopySetting();
    } else if (e.key === AUTO_CHECK_UPDATES_KEY) {
        loadAutoCheckUpdatesSetting();
    } else if (e.key === THEME_KEY) {
        loadThemeSetting();
    } else if (e.key === ACCENT_KEY) {
        loadAccentSetting();
    }
});

navItems.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
etabs.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.key)));
saveBtn.addEventListener('click', saveAll);
addBtn.addEventListener('click', addComment);
addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addComment();
    }
});
restoreBtn.addEventListener('click', restoreDefaults);
bulkDelBtn.addEventListener('click', bulkDelete);
searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    selectedIndices.clear();
    renderList();
    updateBulkBtn();
    syncHeight();
});
promptBtn.addEventListener('click', copyPrompt);
resetBtn.addEventListener('click', handleReset);
updateBtn.addEventListener('click', checkForUpdates);
diagnosticsBtn.addEventListener('click', exportDiagnostics);
githubLink.addEventListener('click', (e) => {
    if (window.mainWindowAPI && typeof window.mainWindowAPI.openExternal === 'function') {
        e.preventDefault();
        window.mainWindowAPI.openExternal(githubLink.href);
    }
});
layoutPickerOptions.forEach((b) => {
    b.addEventListener('click', () => {
        localStorage.setItem(LAYOUT_KEY, b.dataset.layout);
        layoutPickerOptions.forEach((x) => x.classList.toggle('active', x === b));
        showToast(`Popup layout set to ${b.textContent}.`);
    });
});
dateFirstToggle.addEventListener('click', () => {
    const enabled = dateFirstToggle.getAttribute('aria-checked') !== 'true';
    localStorage.setItem(DATE_FIRST_KEY, enabled ? '1' : '0');
    dateFirstToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    showToast(enabled ? 'Date-first copy on.' : 'Date-first copy off.');
});
themePickerOptions.forEach((b) => {
    b.addEventListener('click', () => {
        setTheme(b.dataset.theme);
        showToast(`${b.textContent} theme applied.`);
    });
});
accentSwatches.forEach((b) => {
    b.addEventListener('click', () => {
        setAccent(b.dataset.accent, b.dataset.label);
    });
});
startupToggle.addEventListener('click', async () => {
    const enabled = startupToggle.getAttribute('aria-checked') !== 'true';
    startupToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    if (window.mainWindowAPI && typeof window.mainWindowAPI.setLoginItem === 'function') {
        try {
            await window.mainWindowAPI.setLoginItem(enabled);
            showToast(enabled ? 'Will launch at startup.' : 'Won\u2019t launch at startup.');
        } catch (e) {
            startupToggle.setAttribute('aria-checked', enabled ? 'false' : 'true');
            showToast('Couldn\u2019t update startup setting.');
        }
    }
});
confirmDeleteToggle.addEventListener('click', () => {
    const enabled = confirmDeleteToggle.getAttribute('aria-checked') !== 'true';
    localStorage.setItem(CONFIRM_DELETE_KEY, enabled ? '1' : '0');
    confirmDeleteToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    showToast(enabled ? 'Confirmations on before deleting.' : 'Confirmations off \u2014 delete instantly.');
});
closeAfterCopyToggle.addEventListener('click', () => {
    const enabled = closeAfterCopyToggle.getAttribute('aria-checked') !== 'true';
    localStorage.setItem(CLOSE_AFTER_COPY_KEY, enabled ? '1' : '0');
    closeAfterCopyToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    showToast(enabled ? 'Popup will close after you copy.' : 'Popup stays open after copying.');
});
autoCheckUpdatesToggle.addEventListener('click', () => {
    const enabled = autoCheckUpdatesToggle.getAttribute('aria-checked') !== 'true';
    localStorage.setItem(AUTO_CHECK_UPDATES_KEY, enabled ? '1' : '0');
    autoCheckUpdatesToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    showToast(enabled ? 'Check for updates on launch is on.' : 'Updates are checked manually only.');
});
hotkeyInput.addEventListener('click', (e) => {
    e.stopPropagation();
    if (globalCapturing) {
        stopGlobalCapture();
    } else {
        startGlobalCapture();
    }
});
hotkeyClear.addEventListener('click', (e) => {
    e.stopPropagation();
    stopGlobalCapture();
    applyHotkey('');
});
document.addEventListener('click', (e) => {
    if (globalCapturing && !hotkeyInput.contains(e.target)) {
        stopGlobalCapture();
    }
});
backupBtn.addEventListener('click', exportBackup);
restoreBtn2.addEventListener('click', importBackup);
restoreModeOptions.forEach((b) => {
    b.addEventListener('click', () => {
        localStorage.setItem(RESTORE_MODE_KEY, b.dataset.mode);
        syncRestoreModePicker();
        showToast(b.dataset.mode === 'merge' ? 'Restores will merge with current data.' : 'Restores will replace current data.');
    });
});
rollbackBtn.addEventListener('click', rollbackRestore);

/* ---------- Rebindable in-window shortcuts ---------- */

const SHORTCUT_ORDER = ['addComment', 'search', 'backup', 'tabAccept', 'tabAireject', 'tabCopyreject', 'tabPrompt'];
const shortcutsWrap = document.getElementById('shortcuts-editable');

function getShortcuts() {
    const out = Object.assign({}, DEFAULT_SHORTCUTS);
    try {
        const saved = JSON.parse(localStorage.getItem(SHORTCUTS_KEY));
        if (saved && typeof saved === 'object') {
            SHORTCUT_ORDER.forEach((a) => {
                if (typeof saved[a] === 'string' && saved[a].trim()) out[a] = saved[a].trim();
            });
        }
    } catch (e) {}
    return out;
}

function saveShortcuts(s) {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(s));
}

function canonicalAccel(a) {
    if (!a) return '';
    const parts = String(a).trim().split(/\s*\+\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    const mods = [...new Set(parts
        .filter((p) => p === 'ctrl' || p === 'shift' || p === 'alt' || p === 'cmd' || p === 'meta')
        .map((p) => (p === 'cmd' || p === 'meta' ? 'ctrl' : p)))].sort();
    const key = parts.find((p) => p !== 'ctrl' && p !== 'shift' && p !== 'alt' && p !== 'cmd' && p !== 'meta');
    const segs = mods.slice();
    if (key) segs.push(key);
    return segs.join('+');
}

function normalizeCaptureKey(key) {
    const map = {
        ' ': 'space',
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        Escape: 'esc', Enter: 'enter', Tab: 'tab', Backspace: 'backspace',
        Delete: 'delete', Insert: 'insert', Home: 'home', End: 'end',
        PageUp: 'pageup', PageDown: 'pagedown',
    };
    if (key in map) return map[key];
    if (/^F\d{1,2}$/i.test(key)) return key.toLowerCase();
    if (key.length === 1) return key.toLowerCase();
    return key.toLowerCase();
}

// Build the canonical form of a keyboard event's combination.
function eventToAccel(e) {
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('ctrl');
    if (e.shiftKey) mods.push('shift');
    if (e.altKey) mods.push('alt');
    const key = normalizeCaptureKey(String(e.key));
    const bare = ['control', 'shift', 'alt', 'meta', 'cmd'];
    if (bare.includes(key)) return ''; // a modifier alone isn't a full shortcut
    return mods.sort().join('+') + (key ? '+' + key : '');
}

// Which shortcut action does this event match (or null)?
function matchShortcut(e) {
    const accel = eventToAccel(e);
    if (!accel) return null;
    const shortcuts = getShortcuts();
    for (const action of SHORTCUT_ORDER) {
        if (shortcuts[action] && canonicalAccel(shortcuts[action]) === accel) return action;
    }
    return null;
}

// Execute a shortcut action. Returns true if handled.
function runShortcut(action) {
    if (action === 'addComment') {
        if (activeTab === 'prompt') return false;
        addInput.focus();
        addInput.select();
        return true;
    }
    if (action === 'search') {
        if (activeTab === 'prompt') return false;
        searchInput.focus();
        searchInput.select();
        return true;
    }
    if (action === 'backup') {
        exportBackup();
        return true;
    }
    const layoutName = { cards: 'Cards', tabs: 'Tabs', stack: 'Side by side' };
    const layoutByAction = {
        tabAccept: 'cards',
        tabAireject: 'tabs',
        tabCopyreject: 'stack',
        tabPrompt: '', // '' = cycle to the next layout
    };
    if (layoutByAction[action] !== undefined) {
        const mode = layoutByAction[action] === '' ? cycleLayout() : (setLayout(layoutByAction[action]), layoutByAction[action]);
        showToast(`Popup layout set to ${layoutName[mode]}.`);
        return true;
    }
    return false;
}

let capturingAction = null; // action id currently waiting for a keypress
let capturingEl = null;

function renderShortcutRows() {
    shortcutsWrap.innerHTML = '';
    const shortcuts = getShortcuts();
    SHORTCUT_ORDER.forEach((action) => {
        const row = document.createElement('div');
        row.className = 'shortcut-row shortcut-edit';

        const desc = document.createElement('span');
        desc.className = 'shortcut-desc';
        desc.textContent = SHORTCUT_LABELS[action];
        row.appendChild(desc);

        const control = document.createElement('span');
        control.className = 'shortcut-control';

        const capture = document.createElement('button');
        capture.type = 'button';
        capture.className = 'shortcut-capture' + (capturingAction === action ? ' capturing' : '');
        capture.dataset.action = action;
        capture.title = 'Click, then press the new key combination';
        capture.textContent = shortcuts[action];
        capture.addEventListener('click', () => startCapture(action, capture));
        capture.addEventListener('blur', () => {
            if (capturingAction === action) stopCapture();
        });
        control.appendChild(capture);

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'shortcut-reset';
        reset.title = 'Reset to default';
        reset.textContent = '\u21ba';
        reset.disabled = shortcutIsDefault(action, shortcuts[action]);
        reset.addEventListener('click', (e) => {
            e.stopPropagation();
            resetShortcut(action);
        });
        control.appendChild(reset);

        row.appendChild(control);
        shortcutsWrap.appendChild(row);
    });
}

function shortcutIsDefault(action, current) {
    return canonicalAccel(current) === canonicalAccel(DEFAULT_SHORTCUTS[action]);
}

function startCapture(action, captureEl) {
    // Abandon an active global-hotkey capture so the two don't fight.
    if (globalCapturing) stopGlobalCapture();
    // Abandon any other active capture without re-rendering (which would
    // detach the element we're about to capture into).
    if (capturingEl && capturingEl !== captureEl) {
        capturingEl.classList.remove('capturing');
        const s = getShortcuts();
        if (s[capturingAction]) capturingEl.textContent = s[capturingAction];
    }
    capturingAction = action;
    capturingEl = captureEl;
    captureEl.classList.add('capturing');
    captureEl.textContent = 'Press keys\u2026';
}

function stopCapture() {
    if (!capturingAction) return;
    if (capturingEl) {
        capturingEl.classList.remove('capturing');
        const s = getShortcuts();
        if (s[capturingAction]) capturingEl.textContent = s[capturingAction];
    }
    capturingAction = null;
    capturingEl = null;
    renderShortcutRows();
}

function captureKeydown(e) {
    if (!capturingAction) return;
    e.preventDefault();
    e.stopPropagation();
    const hasMod = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;
    if (!hasMod) {
        showToast('Include Ctrl, Shift, or Alt.');
        return;
    }
    const accel = eventToAccel(e);
    if (!accel) return; // wait for a full combination
    const shortcuts = getShortcuts();

    // Reject a combination that collides with another rebindable action.
    let conflict = null;
    for (const other of SHORTCUT_ORDER) {
        if (other !== capturingAction && shortcuts[other] && canonicalAccel(shortcuts[other]) === accel) {
            conflict = other;
            break;
        }
    }
    if (conflict) {
        showToast(`That shortcut is already used for "${SHORTCUT_LABELS[conflict].toLowerCase()}".`);
        stopCapture();
        return;
    }
    shortcuts[capturingAction] = displayAccel(accel);
    saveShortcuts(shortcuts);
    showToast(`Shortcut updated to ${displayAccel(accel)}.`);
    stopCapture();
}

function displayAccel(accel) {
    const parts = canonicalAccel(accel).split('+');
    const modNames = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt' };
    return parts.map((p) => (modNames[p] || uppercaseKey(p))).join('+');
}

function uppercaseKey(k) {
    if (k === 'space') return 'Space';
    if (k.length === 1) return k.toUpperCase();
    return k.replace(/^./, (c) => c.toUpperCase());
}

function resetShortcut(action) {
    const shortcuts = getShortcuts();
    shortcuts[action] = DEFAULT_SHORTCUTS[action];
    saveShortcuts(shortcuts);
    renderShortcutRows();
    showToast(`Shortcut for "${SHORTCUT_LABELS[action].toLowerCase()}" reset to ${DEFAULT_SHORTCUTS[action]}.`);
}

document.addEventListener('keydown', (e) => {
    // If we're capturing a new in-window shortcut, consume the keystroke entirely.
    if (capturingAction) {
        captureKeydown(e);
        return;
    }
    // If we're capturing the global hotkey, consume the keystroke entirely.
    if (globalCapturing) {
        handleGlobalCaptureKey(e);
        return;
    }
    const action = matchShortcut(e);
    if (action && runShortcut(action)) e.preventDefault();
});

renderShortcutRows();

document.getElementById('mw-quit').addEventListener('click', () => {
    if (window.mainWindowAPI && typeof window.mainWindowAPI.quitApp === 'function') {
        window.mainWindowAPI.quitApp();
    }
});

load();
setTab('accept');
updateCounts();
setDirty(false);
loadLayoutSetting();
loadDateFirstSetting();
loadConfirmDeleteSetting();
loadCloseAfterCopySetting();
loadAutoCheckUpdatesSetting();
loadThemeSetting();
loadStartupSetting();
loadAccentSetting();
loadHotkeySetting();
refreshAboutInfo();
syncRestoreModePicker();
renderRollbackState();
syncHeight();
runAutoUpdateCheck();

// Re-fit auto-sized comment boxes when the window (and therefore the card
// width and line-wrapping) changes.
window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
        document.querySelectorAll('#comment-list .card-body textarea').forEach((ta) => autosizeTextarea(ta));
    });
});
