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
const editorListWrap = document.getElementById('editor-list-wrap');
const promptWrap = document.getElementById('prompt-wrap');
const promptText = document.getElementById('prompt-text');

const aboutVersion = document.getElementById('mw-version');
const infoName = document.getElementById('mw-info-name');
const infoVersion = document.getElementById('mw-info-version');
const infoDesc = document.getElementById('mw-info-desc');
const infoMeta = document.getElementById('mw-info-meta');
const infoChangelog = document.getElementById('mw-info-changelog');
const resetBtn = document.getElementById('mw-reset');

let activeTab = 'accept';
let dirty = false;

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
    editorCount.textContent = n === 1 ? '1 comment' : `${n} comments`;
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
    if (index === state[key].index) card.classList.add('current');

    const top = document.createElement('div');
    top.className = 'card-top';

    const num = document.createElement('span');
    num.className = 'card-index';
    num.textContent = index + 1;
    top.appendChild(num);

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

    const body = document.createElement('div');
    body.className = 'card-body';
    const ta = document.createElement('textarea');
    ta.className = 'card-text';
    ta.spellcheck = false;
    ta.value = list[index];
    ta.addEventListener('input', () => {
        list[index] = ta.value;
        updateCardCount(card, ta.value);
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
    card.appendChild(body);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const current = document.createElement('button');
    current.type = 'button';
    current.className = 'card-current';
    current.textContent = 'Set as current';
    current.addEventListener('click', () => setCurrent(key, index));
    foot.appendChild(current);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const count = document.createElement('span');
    count.className = 'card-charcount';
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    if (index === state[key].index) badge.textContent = 'In use';
    meta.appendChild(count);
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

function renderList() {
    if (activeTab === 'prompt') {
        commentList.innerHTML = '';
        return;
    }
    commentList.innerHTML = '';
    const list = state[activeTab].comments;
    if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'comment-list-empty';
        empty.textContent = 'No comments yet \u2014 add one below.';
        commentList.appendChild(empty);
        return;
    }
    list.forEach((_, i) => {
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
    list.splice(index, 1);
    if (state[key].index >= list.length) state[key].index = list.length ? list.length - 1 : 0;
    if (index < state[key].index && state[key].index > 0) state[key].index -= 1;
    save();
    renderList();
    setDirty(false);
    showToast('Comment deleted.');
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

function setTab(key) {
    activeTab = key;
    etabs.forEach((b) => b.classList.toggle('active', b.dataset.key === key));
    const isPrompt = key === 'prompt';
    editorListWrap.classList.toggle('hidden', isPrompt);
    promptWrap.classList.toggle('hidden', !isPrompt);
    promptBtn.style.display = isPrompt ? '' : 'none';
    if (isPrompt) loadPrompt();
    renderList();
    syncHeight();
}

function addComment() {
    if (activeTab === 'prompt') return;
    const value = addInput.value.trim();
    if (!value) return;
    state[activeTab].comments.push(value);
    addInput.value = '';
    save();
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
    const toggle = document.querySelector('.info-section-toggle[data-about-section="changelog"]');
    if (!Array.isArray(changelog) || !changelog.length) {
        if (toggle) toggle.style.display = 'none';
        return;
    }
    if (toggle) toggle.style.display = '';
    infoChangelog.innerHTML = changelog.map((entry) => {
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

function setView(name) {
    navItems.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    panels.forEach((p) => p.classList.toggle('active', p.dataset.viewPanel === name));
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
promptBtn.addEventListener('click', copyPrompt);
document.querySelectorAll('.info-section-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
        const body = document.querySelector('.about-section-body[data-about-body="' + btn.dataset.aboutSection + '"]');
        const willOpen = !btn.classList.contains('open');
        btn.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (body) body.classList.toggle('hidden', !willOpen);
    });
});
resetBtn.addEventListener('click', handleReset);
document.getElementById('mw-quit').addEventListener('click', () => {
    if (window.mainWindowAPI && typeof window.mainWindowAPI.quitApp === 'function') {
        window.mainWindowAPI.quitApp();
    }
});

load();
setTab('accept');
updateCounts();
setDirty(false);
if (window.mainWindowAPI && typeof window.mainWindowAPI.getAppInfo === 'function') {
    window.mainWindowAPI.getAppInfo().then((info) => {
        if (!info) return;
        aboutVersion.textContent = `v${info.version}`;
        infoName.textContent = info.name;
        infoVersion.textContent = `Version ${info.version}`;
        infoDesc.textContent = info.description;
        renderInfoMeta(info);
        renderChangelog(info.changelog);
    });
}
syncHeight();
