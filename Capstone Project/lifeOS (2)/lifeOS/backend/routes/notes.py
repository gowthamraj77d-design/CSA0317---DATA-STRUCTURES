"""
LifeOS – routes/notes.py
Notes CRUD with per-user data isolation.
"""

from flask import Blueprint, jsonify, request
from database import db
from models import Note
from auth_helpers import get_current_user, login_required
from routes.tasks import log_backend_activity, get_index

notes_bp = Blueprint('notes', __name__)


def sync_notes_search_index(uid: int = None):
    """Index all notes for a user into their SearchIndex."""
    if uid is None:
        from models import User
        for u in User.query.all():
            _sync_user_notes(u.id)
    else:
        _sync_user_notes(uid)


def _sync_user_notes(uid: int):
    idx = get_index(uid)
    for n in Note.query.filter_by(user_id=uid).all():
        idx.index('note', n.id, n.title, f"{n.content} {n.category}", {'category': n.category})


@notes_bp.route('/api/notes', methods=['GET'])
@login_required
def get_notes():
    user  = get_current_user()
    notes = Note.query.filter_by(user_id=user.id).order_by(Note.updated_at.desc()).all()
    return jsonify({'status': 'success', 'count': len(notes),
                    'notes': [n.to_dict() for n in notes]})


@notes_bp.route('/api/notes', methods=['POST'])
@login_required
def create_note():
    user  = get_current_user()
    data  = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Note title is required'}), 400

    content  = (data.get('content')  or '').strip()
    category = (data.get('category') or 'General').strip()

    note = Note(title=title, content=content, category=category, user_id=user.id)
    db.session.add(note)
    db.session.commit()

    get_index(user.id).index('note', note.id, title, f"{content} {category}", {'category': category})
    log_backend_activity(user.id, 'Note Created', f'Added note "{title}"', 'note_added', '📝')

    return jsonify({'status': 'success', 'message': f'Note "{title}" created', 'note': note.to_dict()}), 201


@notes_bp.route('/api/notes/<int:note_id>', methods=['GET'])
@login_required
def get_note(note_id):
    user = get_current_user()
    note = Note.query.filter_by(id=note_id, user_id=user.id).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    return jsonify({'status': 'success', 'note': note.to_dict()})


@notes_bp.route('/api/notes/<int:note_id>', methods=['PUT'])
@login_required
def update_note(note_id):
    user = get_current_user()
    note = Note.query.filter_by(id=note_id, user_id=user.id).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404

    data = request.get_json() or {}
    if 'title' in data:
        t = (data['title'] or '').strip()
        if not t:
            return jsonify({'error': 'Note title cannot be empty'}), 400
        note.title = t
    if 'content'  in data: note.content  = (data['content']  or '').strip()
    if 'category' in data: note.category = (data['category'] or 'General').strip()

    db.session.commit()
    get_index(user.id).index('note', note.id, note.title,
                              f"{note.content} {note.category}", {'category': note.category})
    log_backend_activity(user.id, 'Note Edited', f'Edited note "{note.title}"', 'note_edited', '✏️')

    return jsonify({'status': 'success', 'message': 'Note updated', 'note': note.to_dict()})


@notes_bp.route('/api/notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_note(note_id):
    user = get_current_user()
    note = Note.query.filter_by(id=note_id, user_id=user.id).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404

    title = note.title
    db.session.delete(note)
    db.session.commit()
    get_index(user.id).remove('note', note_id)
    log_backend_activity(user.id, 'Note Deleted', f'Deleted note "{title}"', 'note_deleted', '🗑️')

    return jsonify({'status': 'success', 'message': f'Note "{title}" deleted'})
