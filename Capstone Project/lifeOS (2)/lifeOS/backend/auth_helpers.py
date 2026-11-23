"""
LifeOS – auth_helpers.py
Shared authentication utilities used by all route modules.
"""

from functools import wraps
from flask import session, jsonify
from models import User


def get_current_user():
    """Return the authenticated User object or None."""
    uid = session.get('user_id')
    if not uid:
        return None
    return User.query.get(uid)


def login_required(f):
    """Decorator: returns 401 JSON if the request has no valid session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if user is None:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated
