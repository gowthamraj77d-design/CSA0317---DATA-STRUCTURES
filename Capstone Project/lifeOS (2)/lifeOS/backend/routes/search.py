"""
LifeOS – routes/search.py
Universal Search using per-user SearchIndex (HashMap).
"""

from flask import Blueprint, jsonify, request
from database import db
from models import RecentSearch
from auth_helpers import get_current_user, login_required
from routes.tasks import get_index

search_bp = Blueprint('search', __name__)


@search_bp.route('/api/search', methods=['GET'])
@login_required
def perform_search():
    user        = get_current_user()
    query       = (request.args.get('q') or '').strip()
    filter_type = (request.args.get('type') or 'ALL').upper()

    if not query:
        return jsonify({'status': 'success', 'query': '', 'count': 0, 'results': []})

    # Upsert recent search for this user
    existing = RecentSearch.query.filter_by(user_id=user.id, keyword=query).first()
    if existing:
        db.session.delete(existing)
    db.session.add(RecentSearch(keyword=query, user_id=user.id))
    db.session.commit()

    # Query user's private HashMap
    results = get_index(user.id).search(query, filter_type=filter_type)

    return jsonify({
        'status':  'success',
        'query':   query,
        'filter':  filter_type,
        'count':   len(results),
        'results': results,
    })


@search_bp.route('/api/search/recent', methods=['GET'])
@login_required
def get_recent_searches():
    user    = get_current_user()
    recents = (RecentSearch.query
               .filter_by(user_id=user.id)
               .order_by(RecentSearch.searched_at.desc())
               .limit(5).all())
    return jsonify({'status': 'success', 'count': len(recents),
                    'searches': [r.keyword for r in recents]})


@search_bp.route('/api/search/recent', methods=['DELETE'])
@login_required
def clear_recent_searches():
    user = get_current_user()
    RecentSearch.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Recent searches cleared'})
