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
const updateBtn = document.getElementById('mw-update-btn');
const diagnosticsBtn = document.getElementById('mw-diagnostics-btn');
const resetBtn = document.getElementById('mw-reset');
const layoutPickerOptions = document.querySelectorAll('#mw-layout-picker .layout-picker-option');
const dateFirstToggle = document.getElementById('mw-date-first');
const themePickerOptions = document.querySelectorAll('#mw-theme-picker .theme-option');
const startupToggle = document.getElementById('mw-startup');
const hotkeyInput = document.getElementById('mw-hotkey-input');
const hotkeyClear = document.getElementById('mw-hotkey-clear');
const backupBtn = document.getElementById('mw-backup');
const restoreBtn2 = document.getElementById('mw-restore');

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

function renderChangelog(changelog) {
    const wrap = document.getElementById('mw-changelog-card');
    if (!Array.isArray(changelog) || !changelog.length) {
        if (wrap) wrap.style.display = 'none';
        return;
    }
    if (wrap) wrap.style.display = '';
    infoChangelog.innerHTML = changelog.slice(0, 3).map((entry) => {
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
    }).join('');
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

function loadDateFirstSetting() {
    const saved = localStorage.getItem(DATE_FIRST_KEY);
    const enabled = saved === null ? true : saved !== '0';
    dateFirstToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
}

function setView(name) {
    navItems.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    panels.forEach((p) => p.classList.toggle('active', p.dataset.viewPanel === name));
    if (name === 'about') refreshAboutInfo();
}

/* ---------- Theme ---------- */

function loadThemeSetting() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('theme-light', theme === 'light');
    themePickerOptions.forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
}

function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.body.classList.toggle('theme-light', theme === 'light');
    themePickerOptions.forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
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

async function loadHotkeySetting() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.getGlobalHotkey !== 'function') return;
    try {
        const acc = await window.mainWindowAPI.getGlobalHotkey();
        hotkeyInput.value = acc || '';
    } catch (e) {}
}

function normalizeAccelerator(acc) {
    let a = String(acc || '').trim();
    if (!a) return '';
    a = a.replace(/\s*\+\s*/g, '+');
    return a;
}

async function applyHotkey() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.setGlobalHotkey !== 'function') return;
    const acc = normalizeAccelerator(hotkeyInput.value);
    const result = await window.mainWindowAPI.setGlobalHotkey(acc);
    if (result && result.ok) {
        hotkeyInput.value = result.accelerator || acc;
        showToast(result.registered ? `Hotkey set: ${result.accelerator}` : 'Hotkey removed.');
    } else if (result && result.error) {
        showToast(result.error);
        hotkeyInput.value = result.current || acc;
    }
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
    payload[HOTKEY_KEY] = localStorage.getItem(HOTKEY_KEY);
    try {
        payload[USAGE_KEY] = JSON.parse(localStorage.getItem(USAGE_KEY));
    } catch (e) {}
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
    const apply = (key, raw) => {
        if (data[key] === undefined) return false;
        if (raw === undefined || raw === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, typeof raw === 'string' ? raw : JSON.stringify(raw));
        }
        return true;
    };
    apply(STORAGE_KEY, data[STORAGE_KEY]);
    apply(PROMPT_KEY, data[PROMPT_KEY]);
    apply(SHEET_KEY, data[SHEET_KEY]);
    apply(LAYOUT_KEY, data[LAYOUT_KEY]);
    apply(DATE_FIRST_KEY, data[DATE_FIRST_KEY]);
    apply(THEME_KEY, data[THEME_KEY]);
    apply(HOTKEY_KEY, data[HOTKEY_KEY]);
    apply(USAGE_KEY, data[USAGE_KEY]);
    load();
    loadPrompt();
    renderList();
    updateCounts();
    loadLayoutSetting();
    loadDateFirstSetting();
    loadThemeSetting();
    loadHotkeySetting();
    if (hotkeyInput.value && window.mainWindowAPI && typeof window.mainWindowAPI.setGlobalHotkey === 'function') {
        await window.mainWindowAPI.setGlobalHotkey(normalizeAccelerator(hotkeyInput.value));
    }
    showToast('Data restored.');
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
}

async function checkForUpdates() {
    if (!window.mainWindowAPI || typeof window.mainWindowAPI.checkForUpdates !== 'function') {
        showToast('Update check unavailable.');
        return;
    }
    updateBtn.disabled = true;
    updateBtn.textContent = 'Checking\u2026';
    let result = null;
    try {
        result = await window.mainWindowAPI.checkForUpdates();
    } catch (e) {
        result = null;
    }
    updateBtn.disabled = false;
    updateBtn.textContent = 'Check for updates';
    if (!result || !result.ok) {
        showToast(result && result.error ? result.error : 'Update check failed.');
        return;
    }
    if (result.updateAvailable) {
        showToast(`Update available: v${result.latest} (you have v${result.current}).`);
    } else {
        showToast(`Up to date \u2014 you\u2019re on v${result.current}.`);
    }
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
    } else if (e.key === THEME_KEY) {
        loadThemeSetting();
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
let hotkeyTimer = null;
hotkeyInput.addEventListener('input', () => {
    clearTimeout(hotkeyTimer);
    hotkeyTimer = setTimeout(applyHotkey, 700);
});
hotkeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(hotkeyTimer);
        applyHotkey();
    }
});
hotkeyClear.addEventListener('click', () => {
    hotkeyInput.value = '';
    applyHotkey();
});
backupBtn.addEventListener('click', exportBackup);
restoreBtn2.addEventListener('click', importBackup);

document.addEventListener('keydown', (e) => {
    // The hotkey field's whole purpose is to capture raw key combinations
    // (including Ctrl+N/F/B) as text — don't let the app-wide shortcuts
    // below steal that keystroke away from it.
    if (e.target === hotkeyInput) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'f' && e.shiftKey) return;
    if (k === 'n') {
        if (activeTab === 'prompt') return;
        e.preventDefault();
        addInput.focus();
        addInput.select();
        return;
    }
    if (k === 'f') {
        if (activeTab === 'prompt') return;
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
    }
    if (k === 'b') {
        e.preventDefault();
        exportBackup();
        return;
    }
});
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
loadThemeSetting();
loadStartupSetting();
loadHotkeySetting();
refreshAboutInfo();
syncHeight();
