/**
 * LifeOS – search.js
 * Universal Search & Information Management using SearchIndex (HashMap Data Structure).
 *
 * Provides instant real-time search across Tasks, Goals, Sub-Goals, Notes, and Activity History.
 * Supports category filtering, keyword highlighting, recent search history, and direct section navigation.
 */

// ─────────────────────────────────────────────
// Storage Key for Recent Searches
// ─────────────────────────────────────────────
const RECENT_SEARCHES_KEY = 'lifeos_recent_searches';

// ─────────────────────────────────────────────
// Module State
// ─────────────────────────────────────────────
let searchIndex = null; // HashMap SearchIndex instance
let currentSearchFilter = 'ALL'; // 'ALL' | 'TASKS' | 'GOALS' | 'NOTES' | 'ACTIVITY'

function initSearch(index) {
    searchIndex = index;
}

// ─────────────────────────────────────────────
// Index Builder & Synchronization
// ─────────────────────────────────────────────

/**
 * Rebuild the entire HashMap search index from current application data.
 * Called on application load and whenever data is reset.
 */
function rebuildSearchIndex() {
    if (!searchIndex) return;
    searchIndex.clear();

    // 1. Index Tasks (Queue)
    if (typeof getAllTasks === 'function') {
        getAllTasks().forEach(task => {
            searchIndex.index('task', task.id, task.title, `${task.priority} priority task ${task.notes || ''}`, {
                priority:  task.priority,
                dueDate:   task.dueDate,
                completed: task.completed,
                goalId:    task.goalId,
            });
        });
    }

    // 2. Index Goal & Sub-goal Tree Nodes
    if (typeof getAllGoalNodes === 'function') {
        getAllGoalNodes().forEach(({ node, depth }) => {
            const isSub = depth > 0 || !!node.parentId;
            searchIndex.index(isSub ? 'subgoal' : 'goal', node.id, node.title, node.description || '', {
                type:      isSub ? 'subgoal' : 'goal',
                completed: node.completed,
                depth,
            });
        });
    }

    // 3. Index Notes
    if (typeof getAllNotes === 'function') {
        getAllNotes().forEach(note => {
            searchIndex.index('note', note.id, note.title, `${note.content} ${note.category}`, {
                category:  note.category,
                updatedAt: note.updatedAt,
            });
        });
    }

    // 4. Index Activity History (Stack)
    if (typeof getAllActivities === 'function') {
        getAllActivities().forEach(act => {
            searchIndex.index('activity', act.id, act.action || act.type, act.message || act.description, {
                icon:      act.icon,
                date:      act.date,
                time:      act.time,
                timestamp: act.timestamp,
            });
        });
    }
}

// ─────────────────────────────────────────────
// Recent Searches Helper Functions
// ─────────────────────────────────────────────

/**
 * Get recent search keywords from LocalStorage (max 5).
 * @returns {Array<string>}
 */
function getRecentSearches() {
    return loadData(RECENT_SEARCHES_KEY, []);
}

/**
 * Save a search query to recent searches.
 * @param {string} query
 */
function addRecentSearch(query) {
    const q = query.trim();
    if (!q || q.length < 2) return;

    let recent = getRecentSearches();
    // Remove duplicate if exists
    recent = recent.filter(s => s.toLowerCase() !== q.toLowerCase());
    // Insert at top
    recent.unshift(q);
    // Keep max 5
    if (recent.length > 5) recent = recent.slice(0, 5);

    saveData(RECENT_SEARCHES_KEY, recent);
}

/**
 * Clear all recent searches.
 */
function clearRecentSearches() {
    saveData(RECENT_SEARCHES_KEY, []);
    const mainInput = document.getElementById('search-input-main');
    handleSearch(mainInput ? mainInput.value : '');
}

/**
 * Execute search from a recent search click.
 * @param {string} query
 */
function searchFromRecent(query) {
    const mainInput = document.getElementById('search-input-main');
    const headerInput = document.getElementById('header-search');
    if (mainInput) mainInput.value = query;
    if (headerInput) headerInput.value = query;
    handleSearch(query);
}

// ─────────────────────────────────────────────
// Category Filter Setter
// ─────────────────────────────────────────────

/**
 * Set current active search category filter.
 * @param {string} filterType – 'ALL' | 'TASKS' | 'GOALS' | 'NOTES' | 'ACTIVITY'
 */
function setSearchFilter(filterType) {
    currentSearchFilter = filterType;

    // Update UI active tab class
    const filterBtns = document.querySelectorAll('.search-filter-btn');
    filterBtns.forEach(btn => {
        const isMatch = btn.dataset.filter === filterType;
        btn.classList.toggle('filter-active', isMatch);
        btn.setAttribute('aria-selected', isMatch);
    });

    const mainInput = document.getElementById('search-input-main');
    handleSearch(mainInput ? mainInput.value : '');
}

// ─────────────────────────────────────────────
// Keyword Highlighting Helper
// ─────────────────────────────────────────────

/**
 * Highlight searched query terms within text using HTML mark tags.
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
function highlightText(text, query) {
    if (!text) return '';
    const escapedText = escapeHtml(text);
    if (!query || !query.trim()) return escapedText;

    const q = escapeHtml(query.trim());
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// ─────────────────────────────────────────────
// Universal Search Execution
// ─────────────────────────────────────────────

/**
 * Perform Universal Search and render results.
 * @param {string} query
 * @param {string} containerId – DOM element container ID
 */
function handleSearch(query, containerId = 'search-results') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const q = query.trim();

    // ── Academic HashMap Indicator Banner ──
    const dsBannerHtml = `
        <div class="search-ds-banner">
            <div class="ds-banner-left">
                <span class="ds-badge ds-hashmap">Data Structure: HASH MAP</span>
                <span class="ds-purpose-pill">FAST INFORMATION RETRIEVAL O(1)</span>
            </div>
            <div class="ds-count-pill">
                Indexed Items: <strong>${searchIndex ? searchIndex.size() : 0}</strong>
            </div>
        </div>
    `;

    // ── Category Filters Row ──
    const filterTabsHtml = `
        <div class="search-filters-bar" role="tablist" aria-label="Search filter categories">
            <button class="search-filter-btn ${currentSearchFilter === 'ALL' ? 'filter-active' : ''}" data-filter="ALL" onclick="setSearchFilter('ALL')">ALL</button>
            <button class="search-filter-btn ${currentSearchFilter === 'TASKS' ? 'filter-active' : ''}" data-filter="TASKS" onclick="setSearchFilter('TASKS')">📋 TASKS</button>
            <button class="search-filter-btn ${currentSearchFilter === 'GOALS' ? 'filter-active' : ''}" data-filter="GOALS" onclick="setSearchFilter('GOALS')">🎯 GOALS</button>
            <button class="search-filter-btn ${currentSearchFilter === 'NOTES' ? 'filter-active' : ''}" data-filter="NOTES" onclick="setSearchFilter('NOTES')">📝 NOTES</button>
            <button class="search-filter-btn ${currentSearchFilter === 'ACTIVITY' ? 'filter-active' : ''}" data-filter="ACTIVITY" onclick="setSearchFilter('ACTIVITY')">🕒 ACTIVITY</button>
        </div>
    `;

    // ── Recent Searches Section ──
    const recent = getRecentSearches();
    const recentSearchesHtml = `
        <div class="recent-searches-wrap">
            <div class="recent-header">
                <span class="recent-title">🕒 RECENT SEARCHES</span>
                ${recent.length > 0 ? `<button class="btn btn-ghost btn-xs" onclick="clearRecentSearches()">Clear</button>` : ''}
            </div>
            ${recent.length > 0 ? `
                <div class="recent-pills">
                    ${recent.map(term => `<button class="recent-pill" onclick="searchFromRecent('${escapeAttr(term)}')">🔍 ${escapeHtml(term)}</button>`).join('')}
                </div>
            ` : `<p class="recent-empty">No recent searches yet.</p>`}
        </div>
    `;

    // ── Empty Input Case ──
    if (!q) {
        container.innerHTML = dsBannerHtml + filterTabsHtml + `
            <div class="search-placeholder">
                <span class="search-icon-large">🔍</span>
                <p class="search-placeholder-text">Start typing to search across your LifeOS tasks, goals, notes, and activity history.</p>
            </div>
            ${recentSearchesHtml}
        `;
        return;
    }

    // Save to recent searches
    addRecentSearch(q);

    // Query HashMap Index
    const results = searchIndex.search(q, currentSearchFilter);

    // ── No Results Found Case ──
    if (results.length === 0) {
        container.innerHTML = dsBannerHtml + filterTabsHtml + `
            <div class="search-placeholder">
                <span class="search-icon-large">😕</span>
                <h3 class="no-results-title">No results found for "${escapeHtml(q)}"</h3>
                <p class="search-placeholder-text">Try searching for a task, goal, note, or activity keyword.</p>
            </div>
            ${recentSearchesHtml}
        `;
        return;
    }

    // Render Search Results List
    const resultsListHtml = results.map(item => renderSearchResultCard(item, q)).join('');

    container.innerHTML = dsBannerHtml + filterTabsHtml + `
        <div class="search-results-header">
            <span class="search-count-label">Found <strong>${results.length}</strong> result${results.length !== 1 ? 's' : ''} for "<strong>${escapeHtml(q)}</strong>"</span>
        </div>
        <div class="search-results-list">
            ${resultsListHtml}
        </div>
        ${recentSearchesHtml}
    `;
}

// ─────────────────────────────────────────────
// Result Card Renderer & Navigation Interactivity
// ─────────────────────────────────────────────

/**
 * Render a search result card with category icon, highlighted text, and click interaction.
 * @param {Object} item
 * @param {string} query
 * @returns {string}
 */
function renderSearchResultCard(item, query) {
    const meta = item.metadata || {};
    let icon = '📌';
    let typeLabel = 'ITEM';
    let typeClass = 'task-type';
    let navTarget = 'dashboard';
    let subMeta = '';

    if (item.type === 'task') {
        icon = '📋';
        typeLabel = 'TASK';
        typeClass = 'type-badge-task';
        navTarget = 'tasks-goals';
        const PRIORITY_LABELS = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
        subMeta = `${PRIORITY_LABELS[meta.priority] || ''} · ${meta.completed ? '✅ Completed' : '⏳ Pending'}`;
        if (meta.dueDate) {
            subMeta += ` · 📅 ${new Date(meta.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
        }
    } else if (item.type === 'goal') {
        icon = '🎯';
        typeLabel = 'GOAL';
        typeClass = 'type-badge-goal';
        navTarget = 'tasks-goals';
        subMeta = meta.completed ? '✅ Completed Goal' : '🎯 Active Goal';
    } else if (item.type === 'subgoal') {
        icon = '🌳';
        typeLabel = 'SUB-GOAL';
        typeClass = 'type-badge-subgoal';
        navTarget = 'tasks-goals';
        subMeta = meta.completed ? '✅ Completed Sub-goal' : '📌 Active Sub-goal';
    } else if (item.type === 'note') {
        icon = '📝';
        typeLabel = 'NOTE';
        typeClass = 'type-badge-note';
        navTarget = 'notes';
        subMeta = `Category: ${meta.category || 'General'}`;
    } else if (item.type === 'activity') {
        icon = meta.icon || '🕒';
        typeLabel = 'ACTIVITY';
        typeClass = 'type-badge-activity';
        navTarget = 'activity';
        subMeta = `${meta.date || ''} · ${meta.time || ''}`;
    }

    const titleHighlighted = highlightText(item.title, query);
    const bodyHighlighted  = item.body ? highlightText(item.body.slice(0, 120), query) : '';

    return `
        <div class="search-result-card" onclick="onSearchResultClick('${navTarget}')" role="button" tabindex="0">
            <span class="search-result-icon">${icon}</span>
            <div class="search-result-body">
                <div class="search-result-top-row">
                    <span class="result-title">${titleHighlighted}</span>
                    <span class="search-type-badge ${typeClass}">${typeLabel}</span>
                </div>
                ${bodyHighlighted ? `<p class="result-description">${bodyHighlighted}</p>` : ''}
                <div class="search-result-submeta">${subMeta}</div>
            </div>
            <span class="result-arrow">→</span>
        </div>
    `;
}

/**
 * Handle clicking on a search result card by navigating directly to the destination module.
 * @param {string} sectionId – target section navigation id ('tasks-goals' | 'notes' | 'activity')
 */
function onSearchResultClick(sectionId) {
    if (typeof navigateTo === 'function') {
        navigateTo(sectionId);
    }
}
