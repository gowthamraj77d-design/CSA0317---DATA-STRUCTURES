"""
LifeOS – routes/goals.py
Goal CRUD with per-user GoalTree isolation.
"""

from flask import Blueprint, jsonify, request
from database import db
from models import Goal
from data_structures.tree import GoalTree
from auth_helpers import get_current_user, login_required
from routes.tasks import log_backend_activity, get_index

goals_bp = Blueprint('goals', __name__)

# Per-user GoalTree instances
_trees: dict[int, GoalTree] = {}


def _tree(uid: int) -> GoalTree:
    if uid not in _trees:
        _trees[uid] = GoalTree()
    return _trees[uid]


def rebuild_goal_tree(uid: int = None):
    """Rebuild GoalTree(s) from the database for one or all users."""
    if uid is None:
        from models import User
        for u in User.query.all():
            _rebuild_user_tree(u.id)
    else:
        _rebuild_user_tree(uid)


def _rebuild_user_tree(uid: int):
    t   = _tree(uid)
    idx = get_index(uid)
    t.roots.clear()
    t._nodes_map.clear()

    goals = Goal.query.filter_by(user_id=uid).order_by(Goal.id.asc()).all()
    for g in goals:
        t.add_node(g.id, g.title, g.description or '',
                   g.parent_id, g.status, g.progress or 0.0)
        idx.index(
            'subgoal' if g.parent_id else 'goal',
            g.id, g.title, g.description or '',
            {'type': 'subgoal' if g.parent_id else 'goal',
             'completed': g.status == 'Completed'},
        )

    # Recalculate progress for root nodes
    for root in t.roots:
        t.calculate_progress(root.id)


# ── REST Endpoints ────────────────────────────────────────────────────────────

@goals_bp.route('/api/goals', methods=['GET'])
@login_required
def get_goals():
    user = get_current_user()
    rebuild_goal_tree(user.id)
    roots = Goal.query.filter_by(user_id=user.id, parent_id=None).order_by(Goal.id.asc()).all()
    return jsonify({
        'status': 'success',
        'count':  _tree(user.id).count(),
        'goals':  [g.to_dict(include_children=True) for g in roots],
        'tree':   _tree(user.id).traversal(),
    })


@goals_bp.route('/api/goals', methods=['POST'])
@login_required
def create_goal():
    user = get_current_user()
    data  = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Goal title is required'}), 400

    desc     = (data.get('description') or '').strip()
    deadline = data.get('deadline') or data.get('dueDate') or ''

    goal = Goal(title=title, description=desc, parent_id=None,
                status='Active', progress=0.0, deadline=deadline, user_id=user.id)
    db.session.add(goal)
    db.session.commit()

    _tree(user.id).add_node(goal.id, title, desc, None, 'Active', 0.0)
    get_index(user.id).index('goal', goal.id, title, desc, {'type': 'goal', 'completed': False})
    log_backend_activity(user.id, 'Goal Created', f'Created goal "{title}"', 'goal_created', '🎯')

    return jsonify({'status': 'success', 'message': f'Goal "{title}" created', 'goal': goal.to_dict()}), 201


@goals_bp.route('/api/goals/<int:goal_id>/subgoals', methods=['POST'])
@login_required
def create_subgoal(goal_id):
    user   = get_current_user()
    parent = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not parent:
        return jsonify({'error': 'Parent goal not found'}), 404

    data  = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Sub-goal title is required'}), 400

    desc    = (data.get('description') or '').strip()
    subgoal = Goal(title=title, description=desc, parent_id=goal_id,
                   status='Active', progress=0.0, user_id=user.id)
    db.session.add(subgoal)
    db.session.commit()

    rebuild_goal_tree(user.id)
    log_backend_activity(user.id, 'Sub-Goal Added',
                         f'Added sub-goal "{title}" to "{parent.title}"', 'subgoal_added', '📌')

    return jsonify({
        'status':   'success',
        'message':  f'Sub-goal "{title}" added',
        'subgoal':  subgoal.to_dict(),
        'parent':   parent.to_dict(include_children=False),
    }), 201


@goals_bp.route('/api/goals/<int:goal_id>', methods=['GET'])
@login_required
def get_goal(goal_id):
    user = get_current_user()
    goal = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404
    return jsonify({'status': 'success', 'goal': goal.to_dict()})


@goals_bp.route('/api/goals/<int:goal_id>', methods=['PUT'])
@login_required
def update_goal(goal_id):
    user = get_current_user()
    goal = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404

    data = request.get_json() or {}
    if 'title' in data:
        t = (data['title'] or '').strip()
        if not t:
            return jsonify({'error': 'Goal title cannot be empty'}), 400
        goal.title = t
    if 'description' in data:
        goal.description = (data['description'] or '').strip()
    if 'status' in data or 'completed' in data:
        done = data.get('completed', False) or data.get('status') in ('Completed', 'completed')
        goal.status   = 'Completed' if done else 'Active'
        goal.progress = 100.0 if done else goal.progress

    db.session.commit()
    rebuild_goal_tree(user.id)

    act_type = 'goal_completed' if goal.status == 'Completed' else 'goal_edited'
    icon     = '⭐' if goal.status == 'Completed' else '✏️'
    action   = 'Goal Completed' if goal.status == 'Completed' else 'Goal Edited'
    log_backend_activity(user.id, action, f'{action} "{goal.title}"', act_type, icon)

    return jsonify({'status': 'success', 'message': 'Goal updated', 'goal': goal.to_dict()})


@goals_bp.route('/api/goals/<int:goal_id>', methods=['DELETE'])
@login_required
def delete_goal(goal_id):
    user = get_current_user()
    goal = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not goal:
        return jsonify({'error': 'Goal not found'}), 404

    from models import Task
    Task.query.filter_by(goal_id=goal_id).update({'goal_id': None})

    title = goal.title
    db.session.delete(goal)
    db.session.commit()

    t = _tree(user.id)
    t.delete_node(goal_id)
    get_index(user.id).remove('goal',    goal_id)
    get_index(user.id).remove('subgoal', goal_id)
    log_backend_activity(user.id, 'Goal Deleted', f'Deleted goal "{title}"', 'goal_deleted', '🗑️')

    return jsonify({'status': 'success', 'message': f'Goal "{title}" deleted'})
