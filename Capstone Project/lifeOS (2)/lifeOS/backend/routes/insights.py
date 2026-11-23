"""
LifeOS – routes/insights.py
Smart Rule-based Productivity Insights calculated from real database data.
"""

from flask import Blueprint, jsonify
from models import Task, Goal, Activity
from auth_helpers import get_current_user, login_required

insights_bp = Blueprint('insights', __name__)


@insights_bp.route('/api/insights', methods=['GET'])
@login_required
def get_insights():
    user = get_current_user()

    tasks = Task.query.filter_by(user_id=user.id).all()
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == 'Completed')
    pending_tasks = total_tasks - completed_tasks
    high_priority_pending = sum(1 for t in tasks if t.status != 'Completed' and (t.priority or '').lower() == 'high')

    goals = Goal.query.filter_by(user_id=user.id).all()
    total_goals = len(goals)
    completed_goals = sum(1 for g in goals if g.status == 'Completed' or (g.progress or 0) >= 100)
    active_goals = total_goals - completed_goals

    activities_count = Activity.query.filter_by(user_id=user.id).count()

    task_pct = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0
    goal_pct = round((completed_goals / total_goals * 100), 1) if total_goals > 0 else 0.0

    if total_tasks > 0 and total_goals > 0:
        productivity_score = round(task_pct * 0.6 + goal_pct * 0.4, 1)
    elif total_tasks > 0:
        productivity_score = task_pct
    elif total_goals > 0:
        productivity_score = goal_pct
    else:
        productivity_score = 0.0

    # Rule-based insights generation
    insights = []

    # 1. Task insights
    if total_tasks == 0:
        insights.append("Start by adding your first task to your Queue!")
    else:
        insights.append(f"You completed {task_pct}% of your tasks today.")
        if high_priority_pending > 0:
            insights.append(f"You have {high_priority_pending} pending high-priority task{'s' if high_priority_pending > 1 else ''}.")
        elif pending_tasks > 0:
            insights.append("Great job! All high-priority tasks are completed.")

    # 2. Goal insights
    top_goal = Goal.query.filter_by(user_id=user.id, parent_id=None).order_by(Goal.progress.desc()).first()
    if top_goal:
        insights.append(f'Your "{top_goal.title}" goal is {round(top_goal.progress or 0, 1)}% complete.')
    elif total_goals == 0:
        insights.append("Create a goal to organize your tasks into a Goal Tree.")

    # 3. Activity insights
    if activities_count > 0:
        insights.append(f"You have logged {activities_count} total productivity actions in your Activity Stack.")

    # Summary text
    if total_tasks == 0:
        summary_text = "Welcome to LifeOS! Add a task to get started."
    elif completed_tasks == total_tasks:
        summary_text = "Fantastic job! All tasks for today are complete."
    elif completed_tasks > 0:
        summary_text = f"Good progress today. You completed {completed_tasks} of {total_tasks} tasks."
    else:
        summary_text = f"You have {pending_tasks} pending task{'s' if pending_tasks > 1 else ''} to complete today."

    return jsonify({
        'status': 'success',
        'summary': {
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'pending_tasks': pending_tasks,
            'total_goals': total_goals,
            'active_goals': active_goals,
            'completed_goals': completed_goals,
            'activity_actions': activities_count,
            'productivity_score': productivity_score,
            'summary_text': summary_text
        },
        'insights': insights
    })
