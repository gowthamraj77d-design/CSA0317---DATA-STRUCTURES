/**
 * LifeOS – tasks.js
 * Task Management using TaskQueue (FIFO).
 *
 * Tasks are enqueued when added and the queue order represents scheduling order.
 * Each task can optionally be linked to a Goal (goalId).
 * Completion/deletion removes a task from the queue.
 */

// ─────────────────────────────────────────────
// Module State
// ─────────────────────────────────────────────
let taskQueue = null;

function initTasks(queue) {
    taskQueue = queue;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function saveTasks() {
    saveData(KEYS.TASKS, taskQueue.serialize());
}

// ─────────────────────────────────────────────
// Backend Synchronization
// ─────────────────────────────────────────────

/**
 * Load tasks from the Flask backend (SQLite DB) and populate TaskQueue.
 */
async function loadTasksFromBackend() {
    if (typeof API === 'undefined' || !API.getTasks) return;
    try {
        const res = await API.getTasks();
        if (res && res.status === 'success' && Array.isArray(res.tasks)) {
            taskQueue.clear();
            res.tasks.forEach(t => {
                taskQueue.enqueue({
                    id:        t.id,
                    title:     t.title,
                    priority:  (t.priority || 'medium').toLowerCase(),
                    dueDate:   t.dueDate || t.due_date || '',
                    notes:     t.notes || t.description || '',
                    goalId:    t.goalId || t.goal_id || null,
                    completed: Boolean(t.completed || t.status === 'Completed'),
                    createdAt: t.created_at || t.createdAt || new Date().toISOString(),
                });
            });
            saveTasks();
        }
    } catch (err) {
        console.warn('[LifeOS Tasks] Backend fetch notice:', err.message);
    }
}

// ─────────────────────────────────────────────
// Task CRUD
// ─────────────────────────────────────────────

/**
 * Add a new task to the queue and persist to SQLite database.
 * @param {string} title
 * @param {string} priority  – 'low' | 'medium' | 'high'
 * @param {string} dueDate   – ISO date string or ''
 * @param {string} notes     – optional notes text
 * @param {string|number|null} goalId – optional linked goal id
 * @returns {Promise<Object>} created task
 */
async function addTask(title, priority = 'medium', dueDate = '', notes = '', goalId = null) {
    let task = {
        id:        generateId(),
        title:     title.trim(),
        priority:  (priority || 'medium').toLowerCase(),
        dueDate:   dueDate || '',
        notes:     notes ? notes.trim() : '',
        goalId:    goalId || null,
        completed: false,
        createdAt: new Date().toISOString(),
    };

    if (typeof API !== 'undefined' && API.createTask) {
        try {
            const res = await API.createTask({
                title:    task.title,
                priority: task.priority,
                due_date: task.dueDate,
                notes:    task.notes,
                goal_id:  task.goalId ? Number(task.goalId) : null,
            });
            if (res && res.task) {
                task = {
                    id:        res.task.id,
                    title:     res.task.title,
                    priority:  (res.task.priority || 'medium').toLowerCase(),
                    dueDate:   res.task.dueDate || res.task.due_date || '',
                    notes:     res.task.notes || res.task.description || '',
                    goalId:    res.task.goalId || res.task.goal_id || null,
                    completed: Boolean(res.task.completed || res.task.status === 'Completed'),
                    createdAt: res.task.created_at || task.createdAt,
                };
            }
        } catch (err) {
            console.warn('[LifeOS Tasks] API save notice:', err.message);
        }
    }

    taskQueue.enqueue(task);
    saveTasks();

    // Index for search
    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('task', task.id, task.title, `${task.priority} ${task.notes}`, { priority: task.priority, dueDate: task.dueDate, completed: false });
    }

    // Log activity
    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.TASK_ADDED, `Added task "${task.title}"`);
    }

    renderAllTaskViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
    return task;
}

/**
 * Mark a task as completed and persist to SQLite database.
 * @param {string|number} id
 */
async function completeTask(id) {
    const task = taskQueue.findById(id);
    if (!task || task.completed) return;

    if (typeof API !== 'undefined' && API.updateTask) {
        try {
            await API.updateTask(id, { completed: true, status: 'Completed' });
        } catch (err) {
            console.warn('[LifeOS Tasks] API complete notice:', err.message);
        }
    }

    taskQueue.updateById(id, { completed: true, completedAt: new Date().toISOString() });
    const updatedTask = taskQueue.findById(id);
    saveTasks();

    // Update search index
    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('task', id, updatedTask.title, `${updatedTask.priority} ${updatedTask.notes}`, { priority: updatedTask.priority, dueDate: updatedTask.dueDate, completed: true });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.TASK_COMPLETED, `Completed "${updatedTask.title}"`);
    }

    // ── Propagate to linked goal ──
    if (updatedTask.goalId && typeof recalcGoalProgress === 'function') {
        recalcGoalProgress(updatedTask.goalId);
    }

    renderAllTaskViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

/**
 * Delete a task from the queue and SQLite database.
 * @param {string|number} id
 */
async function deleteTask(id) {
    const task = taskQueue.findById(id);
    if (!task) return;
    const title = task.title;

    if (typeof API !== 'undefined' && API.deleteTask) {
        try {
            await API.deleteTask(id);
        } catch (err) {
            console.warn('[LifeOS Tasks] API delete notice:', err.message);
        }
    }

    taskQueue.removeById(id);
    saveTasks();

    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.remove(id);
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.TASK_DELETED, `Deleted task "${title}"`);
    }

    renderAllTaskViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

/**
 * Edit an existing task and persist to SQLite database.
 * @param {string|number} id
 * @param {Object} updates – { title, priority, dueDate, notes, goalId }
 */
async function editTask(id, updates) {
    const task = taskQueue.findById(id);
    if (!task) return;

    if (typeof API !== 'undefined' && API.updateTask) {
        try {
            await API.updateTask(id, {
                title:       updates.title !== undefined ? updates.title : task.title,
                priority:    updates.priority !== undefined ? updates.priority : task.priority,
                due_date:    updates.dueDate !== undefined ? updates.dueDate : task.dueDate,
                description: updates.notes !== undefined ? updates.notes : task.notes,
                goal_id:     updates.goalId !== undefined ? (updates.goalId ? Number(updates.goalId) : null) : task.goalId,
            });
        } catch (err) {
            console.warn('[LifeOS Tasks] API edit notice:', err.message);
        }
    }

    taskQueue.updateById(id, updates);
    const updated = taskQueue.findById(id);
    saveTasks();

    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('task', id, updated.title, `${updated.priority} ${updated.notes || ''}`, { priority: updated.priority, dueDate: updated.dueDate, completed: updated.completed });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.TASK_EDITED, `Edited task "${updated.title}"`);
    }

    renderAllTaskViews();
}

/**
 * Remove all completed tasks from queue and SQLite database.
 */
async function clearCompletedTasks() {
    const completed = getCompletedTasks();
    if (completed.length === 0) return;

    if (typeof API !== 'undefined' && API.clearCompletedTasks) {
        try {
            await API.clearCompletedTasks();
        } catch (err) {
            console.warn('[LifeOS Tasks] API clear completed notice:', err.message);
        }
    }

    completed.forEach(t => {
        taskQueue.removeById(t.id);
        if (typeof searchIndex !== 'undefined' && searchIndex) {
            searchIndex.remove(t.id);
        }
    });
    saveTasks();

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.TASK_DELETED, `Cleared ${completed.length} completed task(s)`);
    }

    renderAllTaskViews();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

// ─────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────

function getAllTasks()       { return taskQueue.toArray(); }
function getPendingTasks()   { return taskQueue.toArray().filter(t => !t.completed); }
function getCompletedTasks() { return taskQueue.toArray().filter(t =>  t.completed); }
function getQueueSize()      { return taskQueue.size(); }
function peekQueue()         { return taskQueue.peek(); }

// ─────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────

const PRIORITY_COLORS = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' };
const PRIORITY_LABELS = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(task) {
    if (!task.dueDate || task.completed) return false;
    return new Date(task.dueDate) < new Date();
}

/**
 * Build the HTML for one task card.
 * @param {Object} task
 * @param {number} queuePosition  1-indexed position in the full queue
 * @param {boolean} showCompleteBtn
 */
function taskCardHTML(task, queuePosition, showCompleteBtn = true) {
    const overdue = isOverdue(task);

    // Linked-goal label
    let goalLabel = '';
    if (task.goalId && typeof goalTree !== 'undefined' && goalTree) {
        const gNode = goalTree.findNode(task.goalId);
        if (gNode) {
            goalLabel = `<span class="task-goal-link">🔗 ${escapeHtml(gNode.title)}</span>`;
        }
    }

    // Queue position badge — only show for pending tasks
    const posBadge = task.completed
        ? `<span class="queue-position queue-position-done">✓</span>`
        : `<span class="queue-position">#${queuePosition}</span>`;

    return `
        <div class="task-card ${task.completed ? 'task-completed' : ''} ${overdue ? 'task-overdue' : ''}" data-id="${task.id}">
            <div class="task-header">
                ${posBadge}
                <span class="task-title">${escapeHtml(task.title)}</span>
                <span class="badge ${PRIORITY_COLORS[task.priority]}">${PRIORITY_LABELS[task.priority]}</span>
            </div>
            <div class="task-meta">
                <span class="task-date">📅 ${formatDate(task.dueDate)}</span>
                <span class="task-status ${task.completed ? 'status-done' : overdue ? 'status-overdue' : 'status-pending'}">
                    ${task.completed ? '✅ Completed' : overdue ? '⚠️ Overdue' : '⏳ Pending'}
                </span>
                ${goalLabel}
            </div>
            ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ''}
            <div class="task-actions">
                ${showCompleteBtn && !task.completed ? `<button class="btn btn-success btn-sm" onclick="completeTask('${task.id}')">✓ Complete</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick="openEditTaskModal('${task.id}')">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

function renderAllTaskViews() {
    renderTodayTasks();
    renderTasksModule();
    updateProductivityScore();
}

/** Dashboard – Today's Tasks widget */
function renderTodayTasks() {
    const container = document.getElementById('today-tasks');
    if (!container) return;
    const allTasks = taskQueue.toArray();
    const pending  = allTasks.filter(t => !t.completed).slice(0, 6);
    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🎉</span><p>All tasks completed! Great work.</p></div>`;
        return;
    }
    // Compute actual queue positions (1-indexed within full array)
    const allArr = allTasks;
    container.innerHTML = pending.map(t => {
        const pos = allArr.indexOf(t) + 1;
        return taskCardHTML(t, pos);
    }).join('');
}

/** Tasks & Goals module – full task list with tabs */
function renderTasksModule() {
    const pendingContainer   = document.getElementById('tasks-pending-list');
    const completedContainer = document.getElementById('tasks-completed-list');
    const allArr = taskQueue.toArray();

    if (pendingContainer) {
        const pending = getPendingTasks();
        pendingContainer.innerHTML = pending.length === 0
            ? `<div class="empty-state"><span class="empty-icon">✨</span><p>No pending tasks. Add one above!</p></div>`
            : pending.map(t => {
                const pos = allArr.indexOf(t) + 1;
                return taskCardHTML(t, pos, true);
            }).join('');
    }

    if (completedContainer) {
        const completed = getCompletedTasks();
        completedContainer.innerHTML = completed.length === 0
            ? `<div class="empty-state"><span class="empty-icon">📋</span><p>No completed tasks yet.</p></div>`
            : completed.map(t => {
                const pos = allArr.indexOf(t) + 1;
                return taskCardHTML(t, pos, false);
            }).join('');
    }

    // Update clear-completed button visibility
    const clearBtn = document.getElementById('clear-completed-btn');
    if (clearBtn) {
        clearBtn.style.display = getCompletedTasks().length > 0 ? 'inline-flex' : 'none';
    }
}

// ─────────────────────────────────────────────
// Edit Modal Opener
// ─────────────────────────────────────────────
function openEditTaskModal(id) {
    const task = taskQueue.findById(id);
    if (!task) return;

    document.getElementById('edit-task-id').value       = id;
    document.getElementById('edit-task-title').value    = task.title;
    document.getElementById('edit-task-priority').value = task.priority;
    document.getElementById('edit-task-date').value     = task.dueDate;
    document.getElementById('edit-task-notes').value    = task.notes || '';

    // Populate goal link dropdown
    if (typeof populateGoalDropdown === 'function') {
        populateGoalDropdown('edit-task-goal-link', task.goalId || '');
    }

    openModal('edit-task-modal');
}
