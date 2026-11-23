/**
 * LifeOS – notes.js
 * Simple Notes module.
 *
 * Notes are stored as a plain array (not a DS for V1 simplicity).
 * They are fully indexed in the SearchIndex for universal search.
 */

// ─────────────────────────────────────────────
// Module State
// ─────────────────────────────────────────────
let notesData = []; // plain array

function initNotes(arr) {
    notesData = Array.isArray(arr) ? arr : [];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function saveNotes() {
    saveData(KEYS.NOTES, notesData);
}

const NOTE_CATEGORIES = ['General', 'Work', 'Personal', 'Study', 'Ideas', 'Other'];

const CATEGORY_COLORS = {
    General:  '#6c63ff',
    Work:     '#0ea5e9',
    Personal: '#f97316',
    Study:    '#22c55e',
    Ideas:    '#eab308',
    Other:    '#8b5cf6',
};

// ─────────────────────────────────────────────
// Backend Synchronization
// ─────────────────────────────────────────────

/**
 * Load notes from the Flask backend (SQLite DB).
 */
async function loadNotesFromBackend() {
    if (typeof API === 'undefined' || !API.getNotes) return;
    try {
        const res = await API.getNotes();
        if (res && res.status === 'success' && Array.isArray(res.notes)) {
            notesData = res.notes.map(n => ({
                id:        n.id,
                title:     n.title,
                content:   n.content || '',
                category:  n.category || 'General',
                createdAt: n.created_at || n.createdAt || new Date().toISOString(),
                updatedAt: n.updated_at || n.updatedAt || new Date().toISOString(),
            }));
            saveNotes();
        }
    } catch (err) {
        console.warn('[LifeOS Notes] Backend fetch notice:', err.message);
    }
}

// ─────────────────────────────────────────────
// Note CRUD
// ─────────────────────────────────────────────

/**
 * Create a new note and persist to SQLite database.
 * @param {string} title
 * @param {string} content
 * @param {string} category
 * @returns {Promise<Object>} note
 */
async function addNote(title, content = '', category = 'General') {
    let note = {
        id:        generateNoteId(),
        title:     title.trim(),
        content:   content ? content.trim() : '',
        category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (typeof API !== 'undefined' && API.createNote) {
        try {
            const res = await API.createNote({
                title:    note.title,
                content:  note.content,
                category: note.category,
            });
            if (res && res.note) {
                note = {
                    id:        res.note.id,
                    title:     res.note.title,
                    content:   res.note.content || '',
                    category:  res.note.category || note.category,
                    createdAt: res.note.created_at || note.createdAt,
                    updatedAt: res.note.updated_at || note.updatedAt,
                };
            }
        } catch (err) {
            console.warn('[LifeOS Notes] API create notice:', err.message);
        }
    }

    notesData.unshift(note); // newest first
    saveNotes();

    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('note', note.id, note.title, `${note.content} ${note.category}`, { category: note.category });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.NOTE_ADDED, `Added note "${note.title}"`);
    }

    renderNotes();
    return note;
}

/**
 * Edit an existing note and persist to SQLite database.
 * @param {string|number} id
 * @param {Object} updates – { title, content, category }
 */
async function editNote(id, updates) {
    const note = notesData.find(n => String(n.id) === String(id));
    if (!note) return;

    if (typeof API !== 'undefined' && API.updateNote) {
        try {
            await API.updateNote(id, updates);
        } catch (err) {
            console.warn('[LifeOS Notes] API edit notice:', err.message);
        }
    }

    if (updates.title    !== undefined) note.title    = updates.title.trim();
    if (updates.content  !== undefined) note.content  = updates.content.trim();
    if (updates.category !== undefined) note.category = updates.category;
    note.updatedAt = new Date().toISOString();
    saveNotes();

    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.index('note', id, note.title, `${note.content} ${note.category}`, { category: note.category });
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.NOTE_EDITED, `Edited note "${note.title}"`);
    }

    renderNotes();
}

/**
 * Delete a note from SQLite database.
 * @param {string|number} id
 */
async function deleteNote(id) {
    const idx = notesData.findIndex(n => String(n.id) === String(id));
    if (idx === -1) return;
    const title = notesData[idx].title;

    if (typeof API !== 'undefined' && API.deleteNote) {
        try {
            await API.deleteNote(id);
        } catch (err) {
            console.warn('[LifeOS Notes] API delete notice:', err.message);
        }
    }

    notesData.splice(idx, 1);
    saveNotes();

    if (typeof searchIndex !== 'undefined' && searchIndex) {
        searchIndex.remove(id);
    }

    if (typeof logActivity === 'function') {
        logActivity(ACTIVITY_TYPES.NOTE_DELETED, `Deleted note "${title}"`);
    }

    renderNotes();
}

/**
 * Get all notes.
 * @returns {Array<Object>}
 */
function getAllNotes() {
    return [...notesData];
}

// ─────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────

function renderNotes(filterQuery = '') {
    const container = document.getElementById('notes-grid');
    if (!container) return;

    let notes = getAllNotes();
    if (filterQuery) {
        const q = filterQuery.toLowerCase();
        notes = notes.filter(n =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q)
        );
    }

    if (notes.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">📝</span><p>${filterQuery ? 'No notes match your search.' : 'No notes yet. Create your first note!'}</p></div>`;
        return;
    }

    container.innerHTML = notes.map(note => {
        const color = CATEGORY_COLORS[note.category] || '#6c63ff';
        const updatedDate = new Date(note.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return `
            <div class="note-card" data-id="${note.id}" style="--note-color:${color}">
                <div class="note-header">
                    <span class="note-category" style="background:${color}20;color:${color}">${note.category}</span>
                    <div class="note-menu">
                        <button class="btn btn-outline btn-xs" onclick="openEditNoteModal('${note.id}')">✏️</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteNote('${note.id}')">🗑️</button>
                    </div>
                </div>
                <h3 class="note-title">${escapeHtml(note.title)}</h3>
                <p class="note-content">${escapeHtml(note.content) || '<em>No content</em>'}</p>
                <span class="note-date">Updated ${updatedDate}</span>
            </div>
        `;
    }).join('');
}

// ─────────────────────────────────────────────
// Modal Opener
// ─────────────────────────────────────────────
function openEditNoteModal(id) {
    const note = notesData.find(n => n.id === id);
    if (!note) return;

    document.getElementById('edit-note-id').value       = id;
    document.getElementById('edit-note-title').value    = note.title;
    document.getElementById('edit-note-content').value  = note.content;
    document.getElementById('edit-note-category').value = note.category;
    openModal('edit-note-modal');
}
