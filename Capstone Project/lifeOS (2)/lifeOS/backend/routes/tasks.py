"""
LifeOS – routes/tasks.py
Task CRUD with per-user Queue, Stack and HashMap isolation.
"""

from flask import Blueprint, jsonify, request
from database import db
from models import Task, Activity
from data_structures.queue import TaskQueue
from data_structures.stack import ActivityStack
from data_structures.hashmap import SearchIndex
from auth_helpers import get_current_user, login_required

tasks_bp = Blueprint('tasks', __name__)

# ── Per-user in-memory data structures ──────────────────────────────────────
# Keyed by user_id (int)
_queues:  dict[int, TaskQueue]     = {}
_stacks:  dict[int, ActivityStack] = {}
_indexes: dict[int, SearchIndex]   = {}


def _q(uid: int) -> TaskQueue:
    if uid not in _queues:
        _queues[uid] = TaskQueue()
    return _queues[uid]

def _s(uid: int) -> ActivityStack:
    if uid not in _stacks:
        _stacks[uid] = ActivityStack()
    return _stacks[uid]

def _idx(uid: int) -> SearchIndex:
    if uid not in _indexes:
        _indexes[uid] = SearchIndex()
    return _indexes[uid]


# ── Public accessors used by other route modules ─────────────────────────────
def get_stack(uid: int) -> ActivityStack:
    return _s(uid)

def get_index(uid: int) -> SearchIndex:
    return _idx(uid)


def sync_task_queue(uid: int = None):
    """Rebuild a user's TaskQueue and SearchIndex from the database."""
    if uid is None:
        # Sync all users
        from models import User
        for u in User.query.all():
            _sync_user_queue(u.id)
    else:
        _sync_user_queue(uid)


def _sync_user_queue(uid: int):
    q   = _q(uid)
    idx = _idx(uid)
    q.clear()
    tasks = Task.query.filter_by(user_id=uid).order_by(Task.created_at.asc()).all()
    for t in tasks:
        td = t.to_dict()
        q.enqueue(td)
        idx.index('task', t.id, t.title, f"{t.priority} {t.description or ''}", {
            'priority':  t.priority,
            'dueDate':   t.due_date,
            'completed': t.status == 'Completed',
        })


def log_backend_activity(uid: int, action: str, message: str,
                          act_type: str = 'task_added', icon: str = '📌'):
    """Save activity to DB, push onto user's Stack and index in HashMap."""
    act = Activity(action=action, description=message,
                   activity_type=act_type, icon=icon, user_id=uid)
    db.session.add(act)
    db.session.commit()

    ad = act.to_dict()
    _s(uid).push(ad)
    _idx(uid).index('activity', act.id, action, message, {
        'icon': icon, 'date': ad['date'], 'time': ad['time'], 'timestamp': ad['timestamp'],
    })


# ── REST Endpoints ────────────────────────────────────────────────────────────

@tasks_bp.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    user = get_current_user()
    sync_task_queue(user.id)
    q = _q(user.id)
    return jsonify({'status': 'success', 'count': q.size(), 'tasks': q.to_list()})


@tasks_bp.route('/api/tasks', methods=['POST'])
@login_required
def create_task():
    user = get_current_user()
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Task title is required'}), 400

    priority = (data.get('priority') or 'medium').lower()
    if priority not in ('high', 'medium', 'low'):
        priority = 'medium'
    due_date = data.get('due_date') or data.get('dueDate') or ''
    notes    = data.get('description') or data.get('notes') or ''
    raw_gid  = data.get('goal_id') or data.get('goalId') or None
    goal_id  = None
    if raw_gid:
        try:
            goal_id = int(raw_gid)
        except (ValueError, TypeError):
            goal_id = None

    task = Task(title=title, description=notes, priority=priority,
                due_date=due_date, status='Pending',
                goal_id=goal_id, user_id=user.id)
    db.session.add(task)
    db.session.commit()

    td = task.to_dict()
    _q(user.id).enqueue(td)
    _idx(user.id).index('task', task.id, title, f"{priority} {notes}", {
        'priority': priority, 'dueDate': due_date, 'completed': False,
    })
    log_backend_activity(user.id, 'Task Added', f'Added task "{title}"', 'task_added', '➕')

    return jsonify({'status': 'success', 'message': f'Task "{title}" created', 'task': td}), 201


@tasks_bp.route('/api/tasks/<int:task_id>', methods=['GET'])
@login_required
def get_task(task_id):
    user = get_current_user()
    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify({'status': 'success', 'task': task.to_dict()})


@tasks_bp.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    user = get_current_user()
    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    data = request.get_json() or {}
    if 'title' in data:
        t = (data['title'] or '').strip()
        if not t:
            return jsonify({'error': 'Task title cannot be empty'}), 400
        task.title = t
    if 'priority' in data:
        task.priority = data['priority'].lower()
    if 'due_date' in data or 'dueDate' in data:
        task.due_date = data.get('due_date') or data.get('dueDate') or ''
    if 'description' in data or 'notes' in data:
        task.description = data.get('description') or data.get('notes') or ''
    if 'goal_id' in data or 'goalId' in data:
        raw_gid = data.get('goal_id') or data.get('goalId')
        try:
            task.goal_id = int(raw_gid) if raw_gid else None
        except (ValueError, TypeError):
            task.goal_id = None
    if 'completed' in data or 'status' in data:
        done = data.get('completed', False) or data.get('status') == 'Completed'
        task.status = 'Completed' if done else 'Pending'

    db.session.commit()
    td = task.to_dict()
    _q(user.id).update_by_id(task_id, td)
    _idx(user.id).index('task', task.id, task.title, f"{task.priority} {task.description}", {
        'priority': task.priority, 'dueDate': task.due_date, 'completed': task.status == 'Completed',
    })

    if task.status == 'Completed':
        log_backend_activity(user.id, 'Task Completed', f'Completed "{task.title}"', 'task_completed', '✓')
    else:
        log_backend_activity(user.id, 'Task Edited', f'Edited "{task.title}"', 'task_edited', '✏️')

    return jsonify({'status': 'success', 'message': 'Task updated', 'task': td})


@tasks_bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    user = get_current_user()
    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    title = task.title
    db.session.delete(task)
    db.session.commit()
    _q(user.id).remove_by_id(task_id)
    _idx(user.id).remove('task', task_id)
    log_backend_activity(user.id, 'Task Deleted', f'Deleted "{title}"', 'task_deleted', '🗑️')

    return jsonify({'status': 'success', 'message': f'Task "{title}" deleted'})


@tasks_bp.route('/api/tasks/completed', methods=['DELETE'])
@login_required
def clear_completed_tasks():
    user      = get_current_user()
    completed = Task.query.filter_by(user_id=user.id, status='Completed').all()
    count     = len(completed)
    if count == 0:
        return jsonify({'status': 'info', 'message': 'No completed tasks to clear'})

    for t in completed:
        _q(user.id).remove_by_id(t.id)
        _idx(user.id).remove('task', t.id)
        db.session.delete(t)

    db.session.commit()
    log_backend_activity(user.id, 'Tasks Cleared',
                         f'Cleared {count} completed task(s)', 'task_deleted', '🗑️')
    return jsonify({'status': 'success', 'message': f'Cleared {count} completed tasks'})
