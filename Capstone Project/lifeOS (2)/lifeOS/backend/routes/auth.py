"""
LifeOS – routes/auth.py
Authentication API: Register, Login, Logout, Me, Profile, Change Password
"""

import re
from flask import Blueprint, jsonify, request, session
from database import db
from models import User
from auth_helpers import get_current_user, login_required

auth_bp = Blueprint('auth', __name__)

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


# ─────────────────────────────────────────────
# POST /api/auth/register
# ─────────────────────────────────────────────
@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    name     = (data.get('name') or '').strip()
    email    = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    # Validation
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if not email or not EMAIL_RE.match(email):
        return jsonify({'error': 'A valid email address is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists'}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    # Log in user immediately
    session.permanent = True
    session['user_id'] = user.id

    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(),
    }), 201


# ─────────────────────────────────────────────
# POST /api/auth/login
# ─────────────────────────────────────────────
@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    email    = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()

    # Deliberate generic message – do not reveal which field is wrong
    if user is None or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    session.permanent = True
    session['user_id'] = user.id

    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict(),
    })


# ─────────────────────────────────────────────
# POST /api/auth/logout
# ─────────────────────────────────────────────
@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'})


# ─────────────────────────────────────────────
# GET /api/auth/me
# ─────────────────────────────────────────────
@auth_bp.route('/api/auth/me', methods=['GET'])
@login_required
def me():
    user = get_current_user()
    return jsonify({'user': user.to_dict()})


# ─────────────────────────────────────────────
# PUT /api/auth/profile  – update name
# ─────────────────────────────────────────────
@auth_bp.route('/api/auth/profile', methods=['PUT'])
@login_required
def update_profile():
    user = get_current_user()
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name cannot be empty'}), 400
    user.name = name
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': user.to_dict()})


# ─────────────────────────────────────────────
# PUT /api/auth/password  – change password
# ─────────────────────────────────────────────
@auth_bp.route('/api/auth/password', methods=['PUT'])
@login_required
def change_password():
    user = get_current_user()
    data         = request.get_json() or {}
    current_pw   = data.get('current_password') or ''
    new_pw       = data.get('new_password') or ''

    if not user.check_password(current_pw):
        return jsonify({'error': 'Current password is incorrect'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'})
