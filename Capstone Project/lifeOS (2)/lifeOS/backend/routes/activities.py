"""
LifeOS – routes/activities.py
Activity history with per-user ActivityStack isolation.
"""

from flask import Blueprint, jsonify, request
from database import db
from models import Activity
from auth_helpers import get_current_user, login_required
from routes.tasks import get_stack

activities_bp = Blueprint('activities', __name__)


def sync_activity_stack(uid: int = None):
    """Rebuild ActivityStack(s) from the database."""
    if uid is None:
        from models import User
        for u in User.query.all():
            _sync_user_stack(u.id)
    else:
        _sync_user_stack(uid)


def _sync_user_stack(uid: int):
    s = get_stack(uid)
    s.clear()
    acts = Activity.query.filter_by(user_id=uid).order_by(Activity.created_at.desc()).limit(250).all()
    for act in reversed(acts):
        s.push(act.to_dict())


@activities_bp.route('/api/activities', methods=['GET'])
@login_required
def get_activities():
    user  = get_current_user()
    sync_activity_stack(user.id)
    limit = request.args.get('limit', type=int)
    s     = get_stack(user.id)
    items = s.to_list(limit=limit)
    return jsonify({'status': 'success', 'count': s.size(), 'activities': items})


@activities_bp.route('/api/activities', methods=['POST'])
@login_required
def create_activity():
    user     = get_current_user()
    data     = request.get_json() or {}
    action   = (data.get('action') or 'User Action').strip()
    msg      = data.get('message') or data.get('description') or action
    act_type = data.get('type') or 'task_added'
    icon     = data.get('icon') or '📌'

    act = Activity(action=action, description=msg,
                   activity_type=act_type, icon=icon, user_id=user.id)
    db.session.add(act)
    db.session.commit()

    get_stack(user.id).push(act.to_dict())
    return jsonify({'status': 'success', 'activity': act.to_dict()}), 201


@activities_bp.route('/api/activities', methods=['DELETE'])
@activities_bp.route('/api/activities/all', methods=['DELETE'])
@login_required
def clear_activities():
    user = get_current_user()
    Activity.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    get_stack(user.id).clear()
    return jsonify({'status': 'success', 'message': 'Activity history cleared'})
