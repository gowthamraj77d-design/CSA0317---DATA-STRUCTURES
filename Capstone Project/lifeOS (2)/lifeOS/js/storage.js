/**
 * LifeOS – storage.js
 * Persistence Layer & Global Helpers.
 */

// Global HTML Escaping Utility Guarantee
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}

if (typeof window.escapeAttr !== 'function') {
    window.escapeAttr = function(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
}

// LocalStorage Keys
const KEYS = {
    TASKS:      'lifeos_tasks',
    GOALS:      'lifeos_goals',
    NOTES:      'lifeos_notes',
    ACTIVITIES: 'lifeos_activities',
    THEME:      'lifeos_theme',
};

function loadData(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        console.warn(`[LifeOS Storage] Failed to load key "${key}":`, e);
        return fallback;
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`[LifeOS Storage] Failed to save key "${key}":`, e);
    }
}

function removeData(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn(`[LifeOS Storage] Failed to remove key "${key}":`, e);
    }
}

function resetData() {
    Object.values(KEYS).forEach(k => removeData(k));
}
