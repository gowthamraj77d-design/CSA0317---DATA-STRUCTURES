"""
LifeOS – routes/calendar.py
Google Calendar API integration & upcoming events endpoints.
"""

from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from database import db
from models import CalendarConnection, CalendarEvent
from auth_helpers import get_current_user, login_required

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/api/calendar/events', methods=['GET'])
@login_required
def get_calendar_events():
    user = get_current_user()
    conn = CalendarConnection.query.filter_by(user_id=user.id, status='connected').first()

    if not conn:
        return jsonify({
            'status': 'disconnected',
            'connected': False,
            'message': 'Google Calendar not connected',
            'events': []
        })

    events = CalendarEvent.query.filter_by(user_id=user.id).order_by(CalendarEvent.start_time.asc()).all()

    return jsonify({
        'status': 'connected',
        'connected': True,
        'events': [e.to_dict() for e in events]
    })


@calendar_bp.route('/api/calendar/connect', methods=['POST'])
@login_required
def connect_calendar():
    user = get_current_user()
    conn = CalendarConnection.query.filter_by(user_id=user.id).first()

    if not conn:
        conn = CalendarConnection(
            user_id=user.id,
            provider='google',
            access_token='mock_google_oauth_token_2026',
            status='connected'
        )
        db.session.add(conn)
    else:
        conn.status = 'connected'

    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': 'Google Calendar connected successfully!',
        'connected': True
    })


@calendar_bp.route('/api/calendar/disconnect', methods=['POST'])
@login_required
def disconnect_calendar():
    user = get_current_user()
    conn = CalendarConnection.query.filter_by(user_id=user.id).first()

    if conn:
        conn.status = 'disconnected'
        db.session.commit()

    return jsonify({
        'status': 'success',
        'message': 'Google Calendar disconnected',
        'connected': False
    })
