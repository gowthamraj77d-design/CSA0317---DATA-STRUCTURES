/**
 * LifeOS – app.js
 * Main Application Controller (Full-Stack + Authentication).
 */

// Global authenticated user
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // ── 1. Auth gate: verify session before showing anything ─────────────
    try {
        const meRes = await API.me();
        currentUser = meRes.user;
    } catch (_) {
        localStorage.removeItem('lifeos_logged_in');
        localStorage.removeItem('lifeos_user');
        window.location.href = '/auth.html';
        return;
    }

    // ── 2. Instantiate Data Structures ──────────────────────────────────
    const queue = new TaskQueue();
    const stack = new ActivityStack();
    const tree  = new GoalTree();
    searchIndex  = new SearchIndex();

    // ── 3. Seed DS from LocalStorage cache (instant render) ─────────────
    queue.deserialize(loadData(KEYS.TASKS,      []));
    stack.deserialize(loadData(KEYS.ACTIVITIES, []));
    tree.deserialize( loadData(KEYS.GOALS,      []));
    const savedNotes = loadData(KEYS.NOTES, []);

    // ── 4. Inject into modules ───────────────────────────────────────────
    initTasks(queue);
    initGoals(tree);
    initActivities(stack);
    initSearch(searchIndex);
    initNotes(savedNotes);
    rebuildSearchIndex();

    // ── 5. Theme ─────────────────────────────────────────────────────────
    applyTheme(loadData(KEYS.THEME, 'dark'));

    // ── 6. Show authenticated user greeting ──────────────────────────────
    updateGreeting();

    // ── 7. Initial render from local cache ───────────────────────────────
    renderAllViews();

    // ── 8. Wire events ───────────────────────────────────────────────────
    wireEvents();

    // ── 9. Clock ─────────────────────────────────────────────────────────
    startClock();

    // ── 10. Fetch fresh data from SQLite via REST API ─────────────────────
    await loadDataFromBackend();

    // ── 11. System Health check ───────────────────────────────────────────
    await checkSystemStatus();

    console.info('[LifeOS] Authenticated as', currentUser.name,
                 '| Full-Stack Flask + MySQL ready.');
});


// ─────────────────────────────────────────────────────────────────────────────
// Greeting
// ─────────────────────────────────────────────────────────────────────────────
function updateGreeting() {
    const h = new Date().getHours();
    const period = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
    const name   = currentUser ? currentUser.name.split(' ')[0] : 'there';

    const greeting = document.getElementById('user-greeting');
    const sub      = document.getElementById('user-greeting-sub');
    if (greeting) greeting.textContent = `Good ${period}, ${name}!`;
    if (sub)      sub.textContent      = "Here's your productivity overview.";

    // Also update sidebar user name / email / avatar
    const sname   = document.getElementById('sidebar-user-name');
    const semail  = document.getElementById('sidebar-user-email');
    const savatar = document.getElementById('sidebar-avatar-text');
    if (sname  && currentUser) sname.textContent  = currentUser.name;
    if (semail && currentUser) semail.textContent = currentUser.email;
    if (savatar && currentUser) {
        const initial = currentUser.name ? currentUser.name.trim().charAt(0).toUpperCase() : '👤';
        savatar.textContent = initial;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Backend data load
// ─────────────────────────────────────────────────────────────────────────────
async function loadDataFromBackend() {
    try {
        await Promise.all([
            typeof loadTasksFromBackend     === 'function' ? loadTasksFromBackend()     : null,
            typeof loadGoalsFromBackend     === 'function' ? loadGoalsFromBackend()     : null,
            typeof loadNotesFromBackend     === 'function' ? loadNotesFromBackend()     : null,
            typeof loadActivitiesFromBackend=== 'function' ? loadActivitiesFromBackend(): null,
        ]);
        if (typeof rebuildSearchIndex === 'function') rebuildSearchIndex();
        renderAllViews();
    } catch (e) {
        console.warn('[LifeOS] Backend load notice:', e.message);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// System Status (real health check)
// ─────────────────────────────────────────────────────────────────────────────
async function checkSystemStatus() {
    setCard('status-queue',   typeof taskQueue    !== 'undefined' && taskQueue    ? 'Active'  : 'Offline');
    setCard('status-tree',    typeof goalTree     !== 'undefined' && goalTree     ? 'Active'  : 'Offline');
    setCard('status-stack',   typeof activityStack!== 'undefined' && activityStack? 'Active' : 'Offline');
    setCard('status-hashmap', typeof searchIndex  !== 'undefined' && searchIndex  ? 'Active'  : 'Offline');
    setCard('status-auth',    currentUser ? 'Active' : 'Offline');

    try {
        const h = await API.getHealth();
        if (h && h.status === 'ok') {
            setCard('status-backend', 'Connected');
            setCard('status-storage', h.database === 'connected' ? 'Connected' : 'Error');
            setCard('status-weather', h.weather_api || 'Active');
            setCard('status-calendar', h.google_calendar || 'Not Connected');
            setCard('status-voice', h.voice_assistant || 'Available');
            const pill = document.querySelector('.status-live-pill');
            if (pill) pill.textContent = '● All Systems Operational';
        }
    } catch (_) {
        setCard('status-backend', 'Offline');
        setCard('status-storage', 'Local Only');
        setCard('status-weather', 'Unavailable');
        setCard('status-calendar', 'Not Connected');
        setCard('status-voice', 'Available');
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Smart Dashboard Integrations: Weather, Calendar & Insights
// ─────────────────────────────────────────────────────────────────────────────
async function renderWeatherWidget() {
    const locEl = document.getElementById('weather-location');
    const tempEl = document.getElementById('weather-temp');
    const condEl = document.getElementById('weather-condition');
    const humEl = document.getElementById('weather-humidity');
    const windEl = document.getElementById('weather-wind');
    const highLowEl = document.getElementById('weather-high-low');
    const iconEl = document.getElementById('weather-icon');

    try {
        const data = await API.getWeather();
        if (data && data.weather) {
            const w = data.weather;
            if (locEl) locEl.textContent = w.location;
            if (tempEl) tempEl.textContent = w.temp;
            if (condEl) condEl.textContent = w.condition;
            if (humEl) humEl.textContent = w.humidity;
            if (windEl) windEl.textContent = w.wind;
            if (highLowEl) highLowEl.textContent = w.high_low || '';
            if (iconEl) iconEl.textContent = w.icon || '⛅';
        }
    } catch (err) {
        if (locEl) locEl.textContent = 'Weather Unavailable';
        if (tempEl) tempEl.textContent = '--°C';
        if (condEl) condEl.textContent = 'Weather information unavailable';
    }
}

async function renderCalendarWidget() {
    const calContainer = document.getElementById('calendar-events-list');
    const unifiedContainer = document.getElementById('unified-schedule-list');
    const connectWrap = document.getElementById('calendar-connect-wrap');
    const eventsWrap = document.getElementById('calendar-events-wrap');

    try {
        const data = await API.getCalendarEvents();
        const connected = data.connected;
        const events = data.events || [];

        if (connectWrap) connectWrap.style.display = connected ? 'none' : 'block';
        if (eventsWrap) eventsWrap.style.display = connected ? 'block' : 'none';

        // Render Calendar section list
        if (calContainer) {
            if (!connected) {
                calContainer.innerHTML = `<div class="empty-state">
                    <span class="empty-icon">📅</span>
                    <p>Google Calendar not connected</p>
                    <button class="btn btn-primary btn-sm" onclick="connectGoogleCalendar()" style="margin-top:10px;">CONNECT GOOGLE CALENDAR</button>
                </div>`;
            } else if (events.length === 0) {
                calContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">🎉</span><p>No upcoming calendar events for today!</p></div>`;
            } else {
                calContainer.innerHTML = events.map(e => `
                    <div class="schedule-item item-calendar">
                        <div class="schedule-time">${escapeHtml(e.time_display || e.start)}</div>
                        <div class="schedule-details">
                            <div class="schedule-title">${escapeHtml(e.title)}</div>
                            <div class="schedule-sub">${escapeHtml(e.description || e.location || 'Calendar Event')}</div>
                        </div>
                        <span class="badge badge-calendar">📅 Calendar</span>
                    </div>
                `).join('');
            }
        }

        // Render Unified Daily View (Calendar Events + LifeOS Tasks)
        renderUnifiedSchedule(events);

    } catch (err) {
        if (connectWrap) connectWrap.style.display = 'block';
        if (eventsWrap) eventsWrap.style.display = 'none';
        renderUnifiedSchedule([]);
    }
}

function renderUnifiedSchedule(calEvents = []) {
    const container = document.getElementById('unified-schedule-list');
    if (!container) return;

    // Get today's pending Tasks from Queue
    const tasks = typeof getAllTasks === 'function' ? getAllTasks() : [];
    const pendingTasks = tasks.filter(t => !t.completed);

    const unifiedItems = [];

    // Add calendar events
    calEvents.forEach(e => {
        unifiedItems.push({
            time: e.time_display || '09:00 AM',
            title: e.title,
            sub: e.description || e.location || 'Google Calendar Event',
            type: 'calendar',
            badge: '📅 Calendar',
            badgeClass: 'badge-calendar'
        });
    });

    // Add tasks
    pendingTasks.forEach(t => {
        unifiedItems.push({
            time: t.dueDate || t.due_date || 'Today',
            title: t.title,
            sub: `Priority: ${t.priority.toUpperCase()} · Status: Pending`,
            type: 'task',
            badge: '📋 LifeOS Task',
            badgeClass: 'badge-task'
        });
    });

    if (unifiedItems.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🌟</span><p>No scheduled events or tasks for today!</p></div>`;
        return;
    }

    container.innerHTML = unifiedItems.map(item => `
        <div class="schedule-item item-${item.type}">
            <div class="schedule-time">${escapeHtml(item.time)}</div>
            <div class="schedule-details">
                <div class="schedule-title">${escapeHtml(item.title)}</div>
                <div class="schedule-sub">${escapeHtml(item.sub)}</div>
            </div>
            <span class="badge ${item.badgeClass}">${escapeHtml(item.badge)}</span>
        </div>
    `).join('');
}

async function renderSmartInsights() {
    const insightsContainer = document.getElementById('smart-insights-list');
    const summaryTextEl = document.getElementById('daily-summary-text');

    try {
        const data = await API.getInsights();
        if (data && data.insights) {
            if (insightsContainer) {
                insightsContainer.innerHTML = data.insights.map(insight => `
                    <div class="insight-card">
                        <span class="insight-icon">💡</span>
                        <div class="insight-text">${escapeHtml(insight)}</div>
                    </div>
                `).join('');
            }
            if (summaryTextEl && data.summary) {
                summaryTextEl.textContent = data.summary.summary_text;
            }
        }
    } catch (_) {
        if (insightsContainer) {
            insightsContainer.innerHTML = `<div class="insight-card"><span class="insight-icon">💡</span><div class="insight-text">Keep adding tasks and completing goals to unlock smart productivity insights!</div></div>`;
        }
    }
}

async function connectGoogleCalendar() {
    try {
        await API.connectCalendar();
        if (typeof showToast === 'function') showToast('Google Calendar connected successfully!', 'success');
        await renderCalendarWidget();
        await checkSystemStatus();
    } catch (err) {
        if (typeof showToast === 'function') showToast('Could not connect to Google Calendar.', 'error');
    }
}

async function disconnectGoogleCalendar() {
    if (!confirm('Disconnect Google Calendar?')) return;
    try {
        await API.disconnectCalendar();
        if (typeof showToast === 'function') showToast('Google Calendar disconnected.', 'info');
        await renderCalendarWidget();
        await checkSystemStatus();
    } catch (err) {
        if (typeof showToast === 'function') showToast('Could not disconnect Google Calendar.', 'error');
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS = ['dashboard', 'tasks-goals', 'activity', 'search', 'analytics', 'settings', 'notes', 'profile'];
let currentSection = 'dashboard';

function navigateTo(sectionId) {
    SECTIONS.forEach(id => {
        const el  = document.getElementById(`section-${id}`);
        const nav = document.querySelector(`[data-nav="${id}"]`);
        if (el)  el.classList.toggle('active-section', id === sectionId);
        if (nav) nav.classList.toggle('nav-active',     id === sectionId);
    });
    currentSection = sectionId;

    if (sectionId === 'activity')    renderActivityFeed();
    if (sectionId === 'search')      handleSearch(document.getElementById('search-input-main')?.value || '', 'search-results');
    if (sectionId === 'analytics')   renderAnalytics();
    if (sectionId === 'notes')       renderNotes();
    if (sectionId === 'tasks-goals') { renderTasksModule(); renderGoalsModule(); }
    if (sectionId === 'profile')     renderProfile();

    if (window.innerWidth <= 768)
        document.getElementById('sidebar')?.classList.remove('sidebar-open');
}


// ─────────────────────────────────────────────────────────────────────────────
// Profile section
// ─────────────────────────────────────────────────────────────────────────────
function renderProfile() {
    if (!currentUser) return;
    setCard('profile-name',       currentUser.name);
    setCard('profile-email',      currentUser.email);
    const joined = currentUser.created_at
        ? new Date(currentUser.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';
    setCard('profile-joined',     joined);

    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) nameInput.value = currentUser.name;
}


// ─────────────────────────────────────────────────────────────────────────────
// Goal dropdown helper
// ─────────────────────────────────────────────────────────────────────────────
function populateGoalDropdown(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel || typeof goalTree === 'undefined' || !goalTree) return;
    const flat   = goalTree.toArray();
    const indent = d => '\u00A0\u00A0'.repeat(d);
    sel.innerHTML = `<option value="">— No goal link —</option>` +
        flat.map(({ node, depth }) =>
            `<option value="${node.id}" ${String(node.id) === String(selectedId) ? 'selected' : ''}>
                ${indent(depth)}${depth > 0 ? (depth === 1 ? '├ ' : '└ ') : ''}${escapeHtml(node.title)}
            </option>`
        ).join('');
}


// ─────────────────────────────────────────────────────────────────────────────
// Event wiring
// ─────────────────────────────────────────────────────────────────────────────
function wireEvents() {
    // Navigation
    document.querySelectorAll('[data-nav]').forEach(link => {
        link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.nav); });
    });

    // Hamburger
    document.getElementById('hamburger-btn')?.addEventListener('click', () =>
        document.getElementById('sidebar').classList.toggle('sidebar-open'));

    // Header search
    const headerSearch = document.getElementById('header-search');
    const mainSearch   = document.getElementById('search-input-main');
    if (headerSearch) {
        headerSearch.addEventListener('input', e => {
            if (currentSection !== 'search') navigateTo('search');
            if (mainSearch) mainSearch.value = e.target.value;
            handleSearch(e.target.value, 'search-results');
        });
    }
    if (mainSearch) {
        mainSearch.addEventListener('input', e => {
            if (headerSearch) headerSearch.value = e.target.value;
            handleSearch(e.target.value, 'search-results');
        });
    }

    // Notes search
    document.getElementById('notes-search')?.addEventListener('input', e => renderNotes(e.target.value));

    // ── Add Task ──────────────────────────────────────────────────────────
    document.getElementById('add-task-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const title    = document.getElementById('task-title').value.trim();
        const priority = document.getElementById('task-priority').value;
        const dueDate  = document.getElementById('task-date').value;
        const notes    = document.getElementById('task-notes').value.trim();
        const goalId   = document.getElementById('task-goal-link')?.value || null;
        if (!title) return showToast('Please enter a task title.', 'warning');
        await addTask(title, priority, dueDate, notes, goalId || null);
        e.target.reset();
        closeModal('add-task-modal');
        showToast(`Task "${title}" added to queue!`, 'success');
    });

    // ── Edit Task ─────────────────────────────────────────────────────────
    document.getElementById('edit-task-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const id       = document.getElementById('edit-task-id').value;
        const title    = document.getElementById('edit-task-title').value.trim();
        const priority = document.getElementById('edit-task-priority').value;
        const dueDate  = document.getElementById('edit-task-date').value;
        const notes    = document.getElementById('edit-task-notes').value.trim();
        const goalId   = document.getElementById('edit-task-goal-link')?.value || null;
        if (!title) return showToast('Title cannot be empty.', 'warning');
        await editTask(id, { title, priority, dueDate, notes, goalId: goalId || null });
        closeModal('edit-task-modal');
        showToast('Task updated!', 'success');
    });

    // ── Add Goal ──────────────────────────────────────────────────────────
    document.getElementById('add-goal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('goal-title').value.trim();
        const desc  = document.getElementById('goal-desc').value.trim();
        if (!title) return showToast('Please enter a goal title.', 'warning');
        await createGoal(title, desc);
        e.target.reset();
        closeModal('add-goal-modal');
        showToast(`Goal "${title}" created!`, 'success');
    });

    // ── Add Sub-Goal ──────────────────────────────────────────────────────
    document.getElementById('add-subgoal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const parentId = document.getElementById('subgoal-parent-id').value;
        const title    = document.getElementById('subgoal-title').value.trim();
        const desc     = document.getElementById('subgoal-desc').value.trim();
        if (!title) return showToast('Please enter a sub-goal title.', 'warning');
        await addSubGoal(parentId, title, desc);
        e.target.reset();
        closeModal('add-subgoal-modal');
        showToast(`Sub-goal "${title}" added!`, 'success');
    });

    // ── Edit Goal ─────────────────────────────────────────────────────────
    document.getElementById('edit-goal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const id    = document.getElementById('edit-goal-id').value;
        const title = document.getElementById('edit-goal-title').value.trim();
        const desc  = document.getElementById('edit-goal-description').value.trim();
        if (!title) return showToast('Title cannot be empty.', 'warning');
        await editGoal(id, { title, description: desc });
        closeModal('edit-goal-modal');
        showToast('Goal updated!', 'success');
    });

    // ── Add Note ──────────────────────────────────────────────────────────
    document.getElementById('add-note-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const title    = document.getElementById('note-title').value.trim();
        const content  = document.getElementById('note-content').value.trim();
        const category = document.getElementById('note-category').value;
        if (!title) return showToast('Please enter a note title.', 'warning');
        await addNote(title, content, category);
        e.target.reset();
        closeModal('add-note-modal');
        showToast(`Note "${title}" created!`, 'success');
    });

    // ── Edit Note ─────────────────────────────────────────────────────────
    document.getElementById('edit-note-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const id       = document.getElementById('edit-note-id').value;
        const title    = document.getElementById('edit-note-title').value.trim();
        const content  = document.getElementById('edit-note-content').value.trim();
        const category = document.getElementById('edit-note-category').value;
        if (!title) return showToast('Title cannot be empty.', 'warning');
        await editNote(id, { title, content, category });
        closeModal('edit-note-modal');
        showToast('Note updated!', 'success');
    });

    // ── Profile: update name ──────────────────────────────────────────────
    document.getElementById('profile-name-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('profile-name-input').value.trim();
        if (!name) return showToast('Name cannot be empty.', 'warning');
        try {
            const res = await API.updateProfile({ name });
            currentUser = res.user;
            updateGreeting();
            renderProfile();
            showToast('Name updated successfully!', 'success');
        } catch (err) {
            showToast(err.message || 'Could not update name.', 'error');
        }
    });

    // ── Profile: change password ──────────────────────────────────────────
    document.getElementById('profile-password-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const current  = document.getElementById('profile-current-pw').value;
        const newPw    = document.getElementById('profile-new-pw').value;
        const confirm  = document.getElementById('profile-confirm-pw').value;
        if (newPw !== confirm) return showToast('New passwords do not match.', 'warning');
        if (newPw.length < 6) return showToast('New password must be at least 6 characters.', 'warning');
        try {
            await API.changePassword({ current_password: current, new_password: newPw });
            e.target.reset();
            showToast('Password changed successfully!', 'success');
        } catch (err) {
            showToast(err.message || 'Could not change password.', 'error');
        }
    });

    // ── Sidebar User Card: Quick jump to Profile ───────────────────────────
    document.getElementById('sidebar-user-card')?.addEventListener('click', () => {
        const profileNav = document.getElementById('nav-profile');
        if (profileNav) profileNav.click();
    });

    // ── Logout ────────────────────────────────────────────────────────────
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        if (!confirm('Sign out of LifeOS?')) return;
        try { await API.logout(); } catch (_) {}
        // Clear local DS cache and redirect
        Object.values(KEYS).filter(k => k !== KEYS.THEME).forEach(k => localStorage.removeItem(k));
        window.location.href = '/auth.html';
    });

    // ── Clear completed tasks ─────────────────────────────────────────────
    document.getElementById('clear-completed-btn')?.addEventListener('click', async () => {
        const count = getCompletedTasks().length;
        if (count === 0) return showToast('No completed tasks to clear.', 'info');
        if (confirm(`Clear ${count} completed task(s)?`)) {
            await clearCompletedTasks();
            showToast(`Cleared ${count} completed task(s).`, 'success');
        }
    });

    // ── Theme ─────────────────────────────────────────────────────────────
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const t = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(t); saveData(KEYS.THEME, t);
        showToast(`Switched to ${t} mode.`, 'info');
    });
    document.getElementById('settings-theme-dark')?.addEventListener('click', () => {
        applyTheme('dark');  saveData(KEYS.THEME, 'dark');  showToast('Dark mode activated.',  'info');
    });
    document.getElementById('settings-theme-light')?.addEventListener('click', () => {
        applyTheme('light'); saveData(KEYS.THEME, 'light'); showToast('Light mode activated.', 'info');
    });

    // ── Settings reset ────────────────────────────────────────────────────
    document.getElementById('settings-reset')?.addEventListener('click', () => {
        if (confirm('Delete ALL your tasks, goals, notes and activities?')) {
            resetData();
            location.reload();
        }
    });
    document.getElementById('settings-clear-activity')?.addEventListener('click', async () => {
        if (confirm('Clear all activity history?')) {
            await clearActivities();
            showToast('Activity history cleared.', 'success');
        }
    });

    // ── Modals ────────────────────────────────────────────────────────────
    document.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay') ||
            e.target.classList.contains('modal-close'))
            closeAllModals();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
}


// ─────────────────────────────────────────────────────────────────────────────
// Modal helpers
// ─────────────────────────────────────────────────────────────────────────────
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('modal-visible');
    document.body.classList.add('modal-open');
    if (modalId === 'add-task-modal') populateGoalDropdown('task-goal-link', '');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('modal-visible');
    document.body.classList.remove('modal-open');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('modal-visible'));
    document.body.classList.remove('modal-open');
}


// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}


// ─────────────────────────────────────────────────────────────────────────────
// Summary cards
// ─────────────────────────────────────────────────────────────────────────────
function updateSummaryCards() {
    const tasks      = getAllTasks();
    const pending    = tasks.filter(t => !t.completed);
    const completed  = tasks.filter(t =>  t.completed);
    const goals      = getAllGoalNodes();
    const totalG     = goals.length;
    const completedG = goals.filter(({ node }) => node.completed).length;
    const activeG    = totalG - completedG;

    setCard('card-total-tasks',      tasks.length);
    setCard('card-pending-tasks',    pending.length);
    setCard('card-completed-tasks',  completed.length);
    setCard('card-active-goals',     activeG);
    setCard('card-completed-goals',  completedG);
    setCard('card-overall-progress', getOverallGoalProgress() + '%');
    setCard('card-productivity',     calcProductivity() + '%');
    setCard('queue-size-badge',      getQueueSize());
    setCard('queue-pending-badge',   pending.length);
}

function setCard(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function calcProductivity() {
    const tasks = getAllTasks();
    const c     = tasks.filter(t => t.completed).length;
    const g     = getAllGoalNodes();
    const cg    = g.filter(({ node }) => node.completed).length;
    if (!tasks.length && !g.length) return 0;
    const ts = tasks.length ? (c / tasks.length * 100) : 0;
    const gs = g.length    ? (cg / g.length * 100)     : 0;
    const s  = (tasks.length && g.length) ? ts * 0.6 + gs * 0.4
             : tasks.length ? ts : gs;
    return Math.round(s);
}

function updateProductivityScore() {
    const score = calcProductivity();
    const mini  = document.getElementById('productivity-score-mini');
    if (mini) mini.textContent = score + '%';
    const ring  = document.getElementById('productivity-ring-fill');
    if (ring) {
        const c = 2 * Math.PI * 54;
        ring.style.strokeDasharray  = c;
        ring.style.strokeDashoffset = c - (score / 100) * c;
    }
    const txt = document.getElementById('productivity-ring-text');
    if (txt) txt.textContent = score + '%';
    updateSummaryCards();
}


// ─────────────────────────────────────────────────────────────────────────────
// Analytics render
// ─────────────────────────────────────────────────────────────────────────────
function renderAnalytics() {
    const tasks  = getAllTasks();
    const totalT = tasks.length;
    const doneT  = tasks.filter(t => t.completed).length;
    const goals  = getAllGoalNodes();
    const totalG = goals.length;
    const doneG  = goals.filter(({ node }) => node.completed).length;
    const taskPct = totalT ? Math.round(doneT / totalT * 100) : 0;
    const goalPct = totalG ? Math.round(doneG / totalG * 100) : 0;
    const score   = calcProductivity();

    setCard('analytics-total-tasks',     totalT);
    setCard('analytics-completed-tasks', doneT);
    setCard('analytics-pending-tasks',   totalT - doneT);
    setCard('analytics-total-goals',     totalG);
    setCard('analytics-completed-goals', doneG);
    setCard('analytics-task-pct',        taskPct + '%');
    setCard('analytics-goal-pct',        goalPct + '%');
    setCard('analytics-score',           score   + '%');
    setBar('bar-task-completion', taskPct);
    setBar('bar-goal-completion', goalPct);
    setBar('bar-productivity',    score);
    setCard('analytics-activity-count', getAllActivities().length);
    updateProductivityScore();
    renderPriorityChart(tasks);
}

function setBar(id, pct) {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = pct + '%';
    const lbl = document.getElementById(id + '-label');
    if (lbl) lbl.textContent = pct + '%';
}

function renderPriorityChart(tasks) {
    const high   = tasks.filter(t => t.priority === 'high').length;
    const medium = tasks.filter(t => t.priority === 'medium').length;
    const low    = tasks.filter(t => t.priority === 'low').length;
    const total  = tasks.length || 1;
    setCard('chart-high-count',   high);
    setCard('chart-medium-count', medium);
    setCard('chart-low-count',    low);
    setBar('bar-high',   Math.round(high   / total * 100));
    setBar('bar-medium', Math.round(medium / total * 100));
    setBar('bar-low',    Math.round(low    / total * 100));
}


// ─────────────────────────────────────────────────────────────────────────────
// Clock
// ─────────────────────────────────────────────────────────────────────────────
function startClock() {
    function tick() {
        const now = new Date();
        const te  = document.getElementById('current-time');
        const de  = document.getElementById('current-date');
        if (te) te.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (de) de.textContent = now.toLocaleDateString('en-IN',  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    tick();
    setInterval(tick, 1000);
}


// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// ─────────────────────────────────────────────────────────────────────────────
// Render all
// ─────────────────────────────────────────────────────────────────────────────
function renderAllViews() {
    renderTodayTasks();
    renderGoalsOverview();
    renderDashboardActivity();
    renderTasksModule();
    renderGoalsModule();
    renderActivityFeed();
    renderNotes();
    updateSummaryCards();
    updateProductivityScore();
    renderWeatherWidget();
    renderCalendarWidget();
    renderSmartInsights();
}


// ─────────────────────────────────────────────────────────────────────────────
// Profile Page Render
// ─────────────────────────────────────────────────────────────────────────────
function renderProfile() {
    if (!currentUser) return;
    const nameEl   = document.getElementById('profile-name');
    const emailEl  = document.getElementById('profile-email');
    const joinedEl = document.getElementById('profile-joined');
    const nameInput = document.getElementById('profile-name-input');

    if (nameEl)   nameEl.textContent  = currentUser.name  || '—';
    if (emailEl)  emailEl.textContent = currentUser.email || '—';
    if (joinedEl && currentUser.created_at) {
        const d = new Date(currentUser.created_at);
        joinedEl.textContent = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (nameInput) nameInput.value = currentUser.name || '';
}


// ─────────────────────────────────────────────────────────────────────────────
// Helper: get all tasks from queue (for voice assistant unified schedule)
// ─────────────────────────────────────────────────────────────────────────────
function getAllTasks() {
    if (typeof taskQueue !== 'undefined' && taskQueue) {
        if (typeof taskQueue.toArray === 'function') return taskQueue.toArray();
        if (typeof taskQueue.getAll === 'function') return taskQueue.getAll();
        return taskQueue._data || taskQueue.items || [];
    }
    return [];
}
window.getAllTasks = getAllTasks;
