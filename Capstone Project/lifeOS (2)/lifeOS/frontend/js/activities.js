/**
 * LifeOS – activities.js
 * Activity & Productivity Tracking using ActivityStack (LIFO Stack).
 *
 * All user actions in Module 1 (Tasks, Goals) and Notes are automatically
 * pushed to the ActivityStack. The newest activity is always at the top (LIFO).
 */

// ─────────────────────────────────────────────
// Activity Types & Action Labels
// ─────────────────────────────────────────────
const ACTIVITY_TYPES = {
    TASK_ADDED:      'task_added',
    TASK_COMPLETED:  'task_completed',
    TASK_DELETED:    'task_deleted',
    TASK_EDITED:     'task_edited',
    GOAL_CREATED:    'goal_created',
    GOAL_COMPLETED:  'goal_completed',
    GOAL_DELETED:    'goal_deleted',
    GOAL_EDITED:     'goal_edited',
    SUBGOAL_ADDED:   'subgoal_added',
    NOTE_ADDED:      'note_added',
    NOTE_DELETED:    'note_deleted',
    NOTE_EDITED:     'note_edited',
    DATA_RESET:      'data_reset',
};

const ACTION_LABELS = {
    task_added:     'Task Added',
    task_completed: 'Task Completed',
    task_deleted:   'Task Deleted',
    task_edited:    'Task Edited',
    goal_created:   'Goal Created',
    goal_completed: 'Goal Completed',
    goal_deleted:   'Goal Deleted',
    goal_edited:    'Goal Edited',
    subgoal_added:  'Sub-Goal Added',
    note_added:     'Note Created',
    note_deleted:   'Note Deleted',
    note_edited:    'Note Edited',
    data_reset:     'Data Reset',
};

const ACTIVITY_ICONS = {
    task_added:     '➕',
    task_completed: '✓',
    task_deleted:   '🗑️',
    task_edited:    '✏️',
    goal_created:   '🎯',
    goal_completed: '⭐',
    goal_deleted:   '🗑️',
    goal_edited:    '✏️',
    subgoal_added:  '📌',
    note_added:     '📝',
    note_deleted:   '🗑️',
    note_edited:    '✏️',
    data_reset:     '🔄',
};

// ─────────────────────────────────────────────
// Module State
// ─────────────────────────────────────────────
let activityStack = null; // injected by app.js

function initActivities(stack) {
    activityStack = stack;
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Backend Synchronization
// ─────────────────────────────────────────────

/**
 * Load activities from the Flask backend (SQLite DB).
 */
async function loadActivitiesFromBackend() {
    if (typeof API === 'undefined' || !API.getActivities) return;
    try {
        const res = await API.getActivities();
        if (res && res.status === 'success' && Array.isArray(res.activities)) {
            activityStack.clear();
            // Backend returns activities; push them so newest is at the top
            // Since backend returns newest first, reverse so pushing preserves order
            const acts = [...res.activities].reverse();
            acts.forEach(a => {
                activityStack.push({
                    id:          a.id,
                    action:      a.action || ACTION_LABELS[a.type] || 'User Action',
                    type:        a.type || 'task_added',
                    description: a.description || a.message || '',
                    message:     a.message || a.description || '',
                    icon:        a.icon || ACTIVITY_ICONS[a.type] || '📌',
                    timestamp:   a.timestamp || new Date().toISOString(),
                    date:        a.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                    time:        a.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                });
            });
            saveData(KEYS.ACTIVITIES, activityStack.serialize());
        }
    } catch (err) {
        console.warn('[LifeOS Activities] Backend fetch notice:', err.message);
    }
}

// ─────────────────────────────────────────────
// Core Logging Function (Automatic Recording)
// ─────────────────────────────────────────────

/**
 * Automatically log an activity by pushing it onto the ActivityStack.
 * @param {string} type   – one of ACTIVITY_TYPES values
 * @param {string} message – descriptive text of the action
 */
function logActivity(type, message) {
    if (!activityStack) return;
    const now = new Date();
    const actionName = ACTION_LABELS[type] || 'User Action';
    const icon = ACTIVITY_ICONS[type] || '📌';

    const activity = {
        id:          `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action:      actionName,
        type:        type,
        description: message,
        message:     message,
        icon:        icon,
        timestamp:   now.toISOString(),
        date:        now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time:        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    // Push onto LIFO Stack
    activityStack.push(activity);

    // Save to LocalStorage
    saveData(KEYS.ACTIVITIES, activityStack.serialize());

    // Index into HashMap Search Index for Universal Search
    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('activity', activity.id, activity.action, activity.message, {
            icon:      activity.icon,
            date:      activity.date,
            time:      activity.time,
            timestamp: activity.timestamp,
        });
    }

    // Render activity views
    renderActivityFeed();
    renderDashboardActivity();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

/**
 * Get activities from the stack (newest first).
 * @param {number} [limit]
 * @returns {Array<Object>}
 */
function getAllActivities(limit) {
    return activityStack ? activityStack.toArray(limit) : [];
}

/**
 * Clear all activities on the stack and in the SQLite database.
 */
async function clearActivities() {
    if (!activityStack) return;

    if (typeof API !== 'undefined' && API.clearActivities) {
        try {
            await API.clearActivities();
        } catch (err) {
            console.warn('[LifeOS Activities] API clear notice:', err.message);
        }
    }

    activityStack.clear();
    saveData(KEYS.ACTIVITIES, []);
    renderActivityFeed();
    renderDashboardActivity();
    if (typeof updateSummaryCards === 'function') updateSummaryCards();
}

// ─────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────

/**
 * Render the full Activity History section including Stack DS demo & visual diagram.
 */
function renderActivityFeed() {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    const activities = getAllActivities();

    // Stack Header & Visual Demonstration
    const dsInfoHtml = `
        <div class="stack-ds-card">
            <div class="stack-ds-header">
                <div class="stack-ds-title">
                    <span class="ds-badge ds-stack">Data Structure: STACK</span>
                    <span class="stack-lifo-pill">LIFO – Last In, First Out</span>
                </div>
                <div class="stack-size-badge">
                    Stack Size: <strong>${activityStack ? activityStack.size() : 0}</strong>
                </div>
            </div>

            <!-- Academic Visual Stack Representation -->
            <div class="stack-visual-demo">
                <div class="stack-demo-label">STACK CONCEPT VISUALIZATION:</div>
                <div class="stack-diagram">
                    <div class="stack-pointer pointer-top">▲ TOP (Push / Pop)</div>
                    <div class="stack-box box-latest">
                        <span class="box-tag">Index 0</span>
                        <span>Latest Activity (Newest)</span>
                    </div>
                    <div class="stack-arrow">↓</div>
                    <div class="stack-box box-prev">
                        <span class="box-tag">Index 1</span>
                        <span>Previous Activity</span>
                    </div>
                    <div class="stack-arrow">↓</div>
                    <div class="stack-box box-older">
                        <span class="box-tag">Index N</span>
                        <span>Older Activity (Bottom)</span>
                    </div>
                    <div class="stack-pointer pointer-bottom">▼ BOTTOM</div>
                </div>
            </div>
        </div>
    `;

    if (activities.length === 0) {
        container.innerHTML = dsInfoHtml + `
            <div class="empty-state">
                <span class="empty-icon">🕒</span>
                <p>No recent activity. Start by adding or completing tasks and goals!</p>
            </div>`;
        return;
    }

    const feedListHtml = activities.map((act, index) => {
        const isTop = index === 0;
        return `
            <div class="activity-item activity-${act.type} ${isTop ? 'activity-top-item' : ''}">
                <div class="activity-icon-wrap">
                    <span class="activity-icon">${act.icon}</span>
                    ${isTop ? '<span class="top-stack-indicator" title="Top of Stack (LIFO)">TOP</span>' : ''}
                </div>
                <div class="activity-content">
                    <div class="activity-header-row">
                        <span class="activity-action-name">${escapeHtml(act.action || act.type)}</span>
                        <span class="activity-time">${act.date} · ${act.time}</span>
                    </div>
                    <p class="activity-message">${escapeHtml(act.message || act.description)}</p>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = dsInfoHtml + `
        <div class="activity-feed-list">
            <h3 class="feed-section-title">RECENT ACTIVITY HISTORY</h3>
            ${feedListHtml}
        </div>
    `;
}

/**
 * Render recent activity widget on the main Home Dashboard (latest 3–5 items).
 */
function renderDashboardActivity() {
    const container = document.getElementById('dashboard-activity');
    if (!container) return;

    const activities = getAllActivities(5); // Latest 5 from stack top

    if (activities.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🕒</span><p>No recent activity.</p></div>`;
        return;
    }

    container.innerHTML = activities.map((act, idx) => `
        <div class="activity-item activity-${act.type} ${idx === 0 ? 'activity-top-item' : ''}">
            <span class="activity-icon">${act.icon}</span>
            <div class="activity-content">
                <div class="activity-header-row">
                    <span class="activity-action-name">${escapeHtml(act.action || act.type)}</span>
                    <span class="activity-time">${act.time}</span>
                </div>
                <p class="activity-message">${escapeHtml(act.message || act.description)}</p>
            </div>
        </div>
    `).join('');
}
