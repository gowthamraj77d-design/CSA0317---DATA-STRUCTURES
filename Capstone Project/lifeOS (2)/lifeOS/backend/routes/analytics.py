"""
LifeOS – routes/analytics.py
Real-time productivity analytics scoped to the authenticated user.
"""

from flask import Blueprint, jsonify
from models import Task, Goal
from auth_helpers import get_current_user, login_required

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/api/analytics', methods=['GET'])
@login_required
def get_analytics():
    user = get_current_user()

    tasks          = Task.query.filter_by(user_id=user.id).all()
    total_tasks    = len(tasks)
    completed_t    = sum(1 for t in tasks if t.status == 'Completed')
    pending_t      = total_tasks - completed_t

    goals          = Goal.query.filter_by(user_id=user.id).all()
    total_goals    = len(goals)
    completed_g    = sum(1 for g in goals if g.status == 'Completed' or (g.progress or 0) >= 100)
    active_g       = total_goals - completed_g

    avg_progress   = (sum(g.progress or 0 for g in goals) / total_goals) if total_goals else 0.0

    task_pct  = (completed_t / total_tasks * 100) if total_tasks else 0.0
    goal_pct  = (completed_g / total_goals * 100) if total_goals else 0.0

    if total_tasks > 0 and total_goals > 0:
        score = task_pct * 0.6 + goal_pct * 0.4
    elif total_tasks > 0:
        score = task_pct
    elif total_goals > 0:
        score = goal_pct
    else:
        score = 0.0

    return jsonify({
        'status':              'success',
        'total_tasks':         total_tasks,
        'completed_tasks':     completed_t,
        'pending_tasks':       pending_t,
        'task_completion_pct': round(task_pct, 1),
        'total_goals':         total_goals,
        'completed_goals':     completed_g,
        'active_goals':        active_g,
        'goal_completion_pct': round(goal_pct, 1),
        'goal_progress':       round(avg_progress, 1),
        'productivity_score':  round(score, 1),
    })
