/**
 * LifeOS – goals.js
 * Goal Management using GoalTree (N-ary Tree).
 *
 * Goals form a hierarchy: Main Goal → Sub Goal → Smaller Goal.
 * Progress is calculated automatically and recursively based on child completion.
 * Nodes can be collapsed/expanded for a clean tree view.
 */

// ─────────────────────────────────────────────
// Module State
// ─────────────────────────────────────────────
let goalTree = null;

/** Set of goal IDs that are currently collapsed (UI state only – not persisted) */
const collapsedGoals = new Set();

function initGoals(tree) {
    goalTree = tree;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateGoalId() {
    return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function saveGoals() {
    saveData(KEYS.GOALS, goalTree.serialize());
}

// ─────────────────────────────────────────────
// Backend Synchronization
// ─────────────────────────────────────────────

function transformBackendGoal(g) {
    return {
        id:          g.id,
        title:       g.title,
        description: g.description || '',
        parentId:    g.parent_id || g.parentId || null,
        completed:   Boolean(g.completed || g.status === 'Completed' || (g.progress && g.progress >= 100)),
        createdAt:   g.created_at || g.createdAt || new Date().toISOString(),
        children:    Array.isArray(g.subgoals) ? g.subgoals.map(transformBackendGoal) : [],
    };
}

/**
 * Load goals from the Flask backend (SQLite DB) and rebuild GoalTree.
 */
async function loadGoalsFromBackend() {
    if (typeof API === 'undefined' || !API.getGoals) return;
    try {
        const res = await API.getGoals();
        if (res && res.status === 'success' && Array.isArray(res.goals)) {
            const transformed = res.goals.map(transformBackendGoal);
            goalTree.deserialize(transformed);
            saveGoals();
        }
    } catch (err) {
        console.warn('[LifeOS Goals] Backend fetch notice:', err.message);
    }
}

// ─────────────────────────────────────────────
// Goal CRUD
// ─────────────────────────────────────────────

/**
 * Create a new top-level goal and persist to SQLite.
 * @param {string} title
 * @param {string} description
 * @returns {Promise<GoalNode>}
 */
async function createGoal(title, description = '') {
    let id = generateGoalId();
    let cleanTitle = title.trim();
    let cleanDesc = description.trim();

    if (typeof API !== 'undefined' && API.createGoal) {
        try {
            const res = await API.createGoal({ title: cleanTitle, description: cleanDesc });
            if (res && res.goal) {
                id = res.goal.id;
                cleanTitle = res.goal.title;
                cleanDesc = res.goal.description || cleanDesc;
            }
        } catch (err) {
            console.warn('[LifeOS Goals] API create notice:', err.message);
        }
    }

    const node = goalTree.addRoot(id, cleanTitle, cleanDesc);
    saveGoals();

    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('goal', id, cleanTitle, cleanDesc, { type: 'goal' });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.GOAL_CREATED, `Created goal "${cleanTitle}"`);
    }

    renderAllGoalViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
    return node;
}

/**
 * Add a sub-goal under an existing goal and persist to SQLite.
 * @param {string|number} parentId
 * @param {string} title
 * @param {string} description
 * @returns {Promise<GoalNode|null>}
 */
async function addSubGoal(parentId, title, description = '') {
    let id = generateGoalId();
    let cleanTitle = title.trim();
    let cleanDesc = description.trim();

    if (typeof API !== 'undefined' && API.createSubgoal) {
        try {
            const res = await API.createSubgoal(parentId, { title: cleanTitle, description: cleanDesc });
            if (res && res.subgoal) {
                id = res.subgoal.id;
                cleanTitle = res.subgoal.title;
                cleanDesc = res.subgoal.description || cleanDesc;
            }
        } catch (err) {
            console.warn('[LifeOS Goals] API create subgoal notice:', err.message);
        }
    }

    const node = goalTree.addChild(parentId, id, cleanTitle, cleanDesc);
    if (!node) return null;
    saveGoals();

    const parent = goalTree.findNode(parentId);
    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('goal', id, cleanTitle, `${cleanDesc} subgoal of ${parent ? parent.title : ''}`, { type: 'subgoal', parentId });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.SUBGOAL_ADDED, `Added sub-goal "${cleanTitle}"`);
    }

    // Auto-expand parent when a child is added
    collapsedGoals.delete(parentId);

    renderAllGoalViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
    return node;
}

/**
 * Edit a goal's title/description and persist to SQLite.
 * @param {string|number} id
 * @param {Object} updates
 */
async function editGoal(id, updates) {
    if (typeof API !== 'undefined' && API.updateGoal) {
        try {
            await API.updateGoal(id, updates);
        } catch (err) {
            console.warn('[LifeOS Goals] API edit notice:', err.message);
        }
    }

    goalTree.updateNode(id, updates);
    saveGoals();

    const node = goalTree.findNode(id);
    if (node && typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('goal', id, node.title, node.description, { type: node.parentId ? 'subgoal' : 'goal' });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.GOAL_EDITED, `Edited goal "${updates.title || ''}"`);
    }

    renderAllGoalViews();
}

/**
 * Delete a goal (and all its sub-goals) from SQLite database.
 * @param {string|number} id
 */
async function deleteGoal(id) {
    const node = goalTree.findNode(id);
    if (!node) return;
    const title = node.title;

    if (typeof API !== 'undefined' && API.deleteGoal) {
        try {
            await API.deleteGoal(id);
        } catch (err) {
            console.warn('[LifeOS Goals] API delete notice:', err.message);
        }
    }

    // Remove all descendant nodes from search index
    const flatSubtree = [];
    flattenNode(node, flatSubtree);
    flatSubtree.forEach(n => {
        if (typeof searchIndex !== 'undefined' && searchIndex) {
            searchIndex.remove(n.id);
        }
        collapsedGoals.delete(n.id);
    });

    goalTree.deleteNode(id);
    saveGoals();

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.GOAL_DELETED, `Deleted goal "${title}"`);
    }

    renderAllGoalViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

function flattenNode(node, arr) {
    arr.push(node);
    node.children.forEach(c => flattenNode(c, arr));
}

/**
 * Mark a goal as completed in SQLite database.
 * Works on any node (leaf or branch). Completing a branch marks it complete
 * and recalculates all ancestor progress.
 * @param {string|number} id
 */
async function completeGoal(id) {
    const node = goalTree.findNode(id);
    if (!node || node.completed) return;

    if (typeof API !== 'undefined' && API.updateGoal) {
        try {
            await API.updateGoal(id, { completed: true, status: 'Completed' });
        } catch (err) {
            console.warn('[LifeOS Goals] API complete notice:', err.message);
        }
    }

    goalTree.updateNode(id, { completed: true });
    saveGoals();

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.GOAL_COMPLETED, `Completed goal "${node.title}"`);
    }

    // Recalc all ancestors
    _recalcAncestors(id);

    renderAllGoalViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

/**
 * Recalculate and propagate progress up the tree from a given node.
 * Called when a linked task is completed.
 * @param {string} goalId
 */
function recalcGoalProgress(goalId) {
    if (!goalTree || !goalId) return;
    const node = goalTree.findNode(goalId);
    if (!node) return;
    _recalcAncestors(goalId);
    renderAllGoalViews();
    updateSummaryCards();
}

/**
 * Walk up the parent chain and trigger re-renders.
 * (calculateProgress is pure so no data mutation needed — just re-render.)
 * @private
 */
function _recalcAncestors(startId) {
    // For each ancestor, check if all children are done → auto-complete
    let nodeId = startId;
    while (nodeId) {
        const n = goalTree.findNode(nodeId);
        if (!n) break;
        // Auto-complete if ALL children are completed and has children
        if (n.children.length > 0 && !n.completed) {
            const allChildrenDone = n.children.every(c => c.completed);
            if (allChildrenDone) {
                goalTree.updateNode(nodeId, { completed: true });
                saveGoals();
                logActivity(ACTIVITY_TYPES.GOAL_COMPLETED, `Auto-completed goal "${n.title}" (all sub-goals done)`);
            }
        }
        nodeId = n.parentId;
    }
}

// ─────────────────────────────────────────────
// Collapse / Expand
// ─────────────────────────────────────────────

/**
 * Toggle the collapsed state of a goal node.
 * @param {string} id
 */
function toggleGoalCollapse(id) {
    if (collapsedGoals.has(id)) {
        collapsedGoals.delete(id);
    } else {
        collapsedGoals.add(id);
    }
    renderGoalsModule();
}

// ─────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────

function getAllGoalNodes() { return goalTree.toArray(); }

/**
 * Get overall average progress across all root goals (0–100).
 */
function getOverallGoalProgress() {
    const roots = goalTree.getRoots();
    if (roots.length === 0) return 0;
    const sum = roots.reduce((acc, r) => acc + goalTree.calculateProgress(r), 0);
    return Math.round(sum / roots.length);
}

// ─────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────

function renderAllGoalViews() {
    renderGoalsModule();
    renderGoalsOverview();
    updateProductivityScore();
}

/** Full goals module – tree hierarchy */
function renderGoalsModule() {
    const container = document.getElementById('goals-tree-container');
    if (!container) return;

    const roots = goalTree.getRoots();
    if (roots.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🎯</span><p>No goals yet. Create your first goal!</p></div>`;
        return;
    }
    container.innerHTML = roots.map(root => renderGoalNodeHTML(root, 0)).join('');
}

/**
 * Render a single goal node and its (possibly collapsed) children.
 */
function renderGoalNodeHTML(node, depth) {
    const progress   = goalTree.calculateProgress(node);
    const isCollapsed = collapsedGoals.has(node.id);
    const hasChildren = node.children.length > 0;

    // Depth-based styling
    const depthClass = depth === 0 ? 'goal-root' : depth === 1 ? 'goal-sub' : 'goal-leaf';
    const indent     = depth * 20;
    const icon       = depth === 0 ? '🎯' : depth === 1 ? '📌' : '◦';

    // Tree connector lines
    const connector  = depth > 0
        ? `<span class="tree-connector">${depth === 1 ? '├─' : '└─'}</span>`
        : '';

    // Collapse/Expand toggle button
    const collapseBtn = hasChildren
        ? `<button class="goal-collapse-btn" onclick="toggleGoalCollapse('${node.id}')" aria-label="${isCollapsed ? 'Expand' : 'Collapse'} goal" title="${isCollapsed ? 'Expand' : 'Collapse'}">
               ${isCollapsed ? '▶' : '▼'}
           </button>`
        : `<span class="goal-collapse-placeholder"></span>`;

    // Progress bar — show for all nodes; leaf shows 0% or 100%
    const progressBar = `
        <div class="goal-progress-bar-wrap">
            <div class="goal-progress-bar" style="width:${progress}%"></div>
            <span class="goal-progress-label">${progress}%</span>
        </div>`;

    // Action buttons
    const completeBtn = !node.completed
        ? `<button class="btn btn-success btn-xs" onclick="completeGoal('${node.id}')" title="Mark as completed">✓</button>`
        : '';

    const actionsHTML = `
        <div class="goal-actions">
            ${completeBtn}
            <button class="btn btn-outline btn-xs" onclick="openAddSubGoalModal('${node.id}', '${escapeAttr(node.title)}')" title="Add sub-goal">+ Sub</button>
            <button class="btn btn-outline btn-xs" onclick="openEditGoalModal('${node.id}')" title="Edit">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteGoal('${node.id}')" title="Delete">🗑️</button>
        </div>`;

    // Children container
    const childrenHTML = hasChildren
        ? `<div class="goal-children ${isCollapsed ? 'goal-children-collapsed' : ''}">
               ${node.children.map(c => renderGoalNodeHTML(c, depth + 1)).join('')}
           </div>`
        : '';

    return `
        <div class="goal-node ${depthClass} ${node.completed ? 'goal-done' : ''}" style="margin-left:${indent}px" data-id="${node.id}">
            <div class="goal-node-header">
                <div class="goal-node-left">
                    ${collapseBtn}
                    ${connector}
                    <span class="goal-icon">${icon}</span>
                    <span class="goal-title">${escapeHtml(node.title)}</span>
                    ${node.completed ? '<span class="badge status-done">✅ Done</span>' : ''}
                </div>
                ${actionsHTML}
            </div>
            ${node.description ? `<p class="goal-description">${escapeHtml(node.description)}</p>` : ''}
            ${progressBar}
            ${childrenHTML}
        </div>
    `;
}

/** Dashboard – Goals overview cards */
function renderGoalsOverview() {
    const container = document.getElementById('goals-overview');
    if (!container) return;

    const roots = goalTree.getRoots().slice(0, 4);
    if (roots.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🎯</span><p>No goals yet.</p></div>`;
        return;
    }
    container.innerHTML = roots.map(root => {
        const progress = goalTree.calculateProgress(root);
        return `
            <div class="goal-summary-card ${root.completed ? 'goal-done' : ''}">
                <div class="goal-summary-header">
                    <span class="goal-title">🎯 ${escapeHtml(root.title)}</span>
                    <span class="goal-progress-pct">${progress}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${progress}%"></div>
                </div>
                <span class="goal-sub-count">${root.children.length} sub-goal${root.children.length !== 1 ? 's' : ''}</span>
            </div>
        `;
    }).join('');
}

// ─────────────────────────────────────────────
// Modal Openers
// ─────────────────────────────────────────────
function openAddSubGoalModal(parentId, parentTitle) {
    document.getElementById('subgoal-parent-id').value        = parentId;
    document.getElementById('subgoal-parent-name').textContent = parentTitle;
    openModal('add-subgoal-modal');
}

function openEditGoalModal(id) {
    const node = goalTree.findNode(id);
    if (!node) return;
    document.getElementById('edit-goal-id').value          = id;
    document.getElementById('edit-goal-title').value       = node.title;
    document.getElementById('edit-goal-description').value = node.description;
    openModal('edit-goal-modal');
}

function escapeAttr(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
