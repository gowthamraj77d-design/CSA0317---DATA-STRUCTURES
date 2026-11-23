/**
 * LifeOS – api.js
 * REST API Client for Flask Backend (credentials: 'include' for session cookies).
 */

const API_BASE = '/api';   // served by Flask on port 5000

// ── Global HTML helpers ────────────────────────────────────────────────────
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Bind to window for guaranteed global access
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;

// ── Generic request wrapper ────────────────────────────────────────────────
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        credentials: 'include',   // send session cookie on every request
        headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json',
        },
    };
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    let res;
    try {
        res = await fetch(API_BASE + endpoint, options);
    } catch (networkErr) {
        console.warn('[LifeOS API] Network error for', endpoint, networkErr.message);
        throw networkErr;
    }

    // 401 → redirect to login (except for /auth/* which we call ourselves)
    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
        console.warn('[LifeOS] Session expired – redirecting to login');
        window.location.href = '/auth.html';
        throw new Error('Unauthorized');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ── Auth ───────────────────────────────────────────────────────────────────
const API = {
    // Auth
    me:             ()       => apiRequest('/auth/me'),
    login:          (d)      => apiRequest('/auth/login',    'POST', d),
    register:       (d)      => apiRequest('/auth/register', 'POST', d),
    logout:         ()       => apiRequest('/auth/logout',   'POST'),
    updateProfile:  (d)      => apiRequest('/auth/profile',  'PUT',  d),
    changePassword: (d)      => apiRequest('/auth/password', 'PUT',  d),

    // Health
    getHealth:      ()       => apiRequest('/health'),

    // Tasks
    getTasks:            ()       => apiRequest('/tasks'),
    createTask:          (d)      => apiRequest('/tasks',               'POST', d),
    updateTask:          (id, d)  => apiRequest(`/tasks/${id}`,         'PUT',  d),
    deleteTask:          (id)     => apiRequest(`/tasks/${id}`,         'DELETE'),
    clearCompletedTasks: ()       => apiRequest('/tasks/completed',     'DELETE'),

    // Goals
    getGoals:       ()        => apiRequest('/goals'),
    createGoal:     (d)       => apiRequest('/goals',                   'POST', d),
    createSubgoal:  (pid, d)  => apiRequest(`/goals/${pid}/subgoals`,   'POST', d),
    updateGoal:     (id, d)   => apiRequest(`/goals/${id}`,             'PUT',  d),
    deleteGoal:     (id)      => apiRequest(`/goals/${id}`,             'DELETE'),

    // Notes
    getNotes:       ()        => apiRequest('/notes'),
    createNote:     (d)       => apiRequest('/notes',                   'POST', d),
    updateNote:     (id, d)   => apiRequest(`/notes/${id}`,             'PUT',  d),
    deleteNote:     (id)      => apiRequest(`/notes/${id}`,             'DELETE'),

    // Activities
    getActivities:   (limit) => apiRequest(`/activities${limit ? `?limit=${limit}` : ''}`),
    clearActivities: ()      => apiRequest('/activities/all',           'DELETE'),

    // Search
    search:               (q, t) => apiRequest(`/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(t || 'ALL')}`),
    getRecentSearches:    ()      => apiRequest('/search/recent'),
    clearRecentSearches:  ()      => apiRequest('/search/recent',       'DELETE'),

    // Analytics
    getAnalytics:   ()       => apiRequest('/analytics'),

    // Weather
    getWeather:     ()       => apiRequest('/weather'),

    // Calendar
    getCalendarEvents: ()    => apiRequest('/calendar/events'),
    connectCalendar:   ()    => apiRequest('/calendar/connect',    'POST'),
    disconnectCalendar:()    => apiRequest('/calendar/disconnect', 'POST'),

    // Insights
    getInsights:    ()       => apiRequest('/insights'),
};
