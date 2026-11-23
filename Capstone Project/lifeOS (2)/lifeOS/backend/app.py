import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, send_from_directory, session
from flask_cors import CORS
from config import Config
from database import db
from models import User, Task, Goal, Note, Activity, RecentSearch

# Route blueprints
from routes.auth       import auth_bp
from routes.tasks      import tasks_bp, sync_task_queue
from routes.goals      import goals_bp, rebuild_goal_tree
from routes.notes      import notes_bp, sync_notes_search_index
from routes.activities import activities_bp, sync_activity_stack
from routes.search     import search_bp
from routes.analytics  import analytics_bp
from routes.weather    import weather_bp
from routes.calendar   import calendar_bp
from routes.insights   import insights_bp

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))


def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
    app.config.from_object(Config)

    # CORS: allow credentials so session cookies are sent
    CORS(app,
         resources={r"/api/*": {"origins": "*"}},
         supports_credentials=True)

    db.init_app(app)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(activities_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(weather_bp)
    app.register_blueprint(calendar_bp)
    app.register_blueprint(insights_bp)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        db_status = 'connected'
        try:
            db.session.execute(db.select(1))
        except Exception as e:
            db_status = f'error: {e}'

        weather_key = os.environ.get('WEATHER_API_KEY', '').strip()
        weather_status = 'Connected' if weather_key else 'Active (Fallback)'

        # Check calendar connection for active session user
        cal_status = 'Not Connected'
        if session.get('user_id'):
            from models import CalendarConnection
            conn = CalendarConnection.query.filter_by(user_id=session['user_id'], status='connected').first()
            if conn:
                cal_status = 'Connected'

        return jsonify({
            'status':         'ok',
            'backend':        'connected',
            'database':       db_status,
            'authentication': 'active',
            'weather_api':    weather_status,
            'google_calendar': cal_status,
            'voice_assistant': 'Available',
            'modules': {
                'queue':   'active',
                'tree':    'active',
                'stack':   'active',
                'hashmap': 'active',
            },
        })

    # Serve auth page
    @app.route('/auth')
    @app.route('/auth.html')
    def serve_auth():
        return send_from_directory(FRONTEND_DIR, 'auth.html')

    # Serve login page first on root URL
    @app.route('/')
    def serve_frontend():
        return send_from_directory(FRONTEND_DIR, 'auth.html')

    @app.route('/dashboard')
    def serve_dashboard():
        if not session.get('user_id'):
            return send_from_directory(FRONTEND_DIR, 'auth.html')
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        full = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(full):
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, 'index.html')

    return app


app = create_app()


def init_db_and_seed():
    """Initialize MySQL tables and sync in-memory data structures without sample data."""
    with app.app_context():
        try:
            db.create_all()
            print('[LifeOS] MySQL database tables verified/created successfully.')
        except Exception as e:
            print(f'\n[LifeOS WARNING] Could not connect to MySQL database: {e}')
            print('[LifeOS TIP] Please ensure MySQL is running and verify DB_PASSWORD in .env matches your MySQL root password.\n')
            raise

        # Ensure demo account exists
        demo_user = User.query.filter_by(email='demo@lifeos.edu').first()
        if not demo_user:
            demo_user = User(name='Demo Student', email='demo@lifeos.edu')
            demo_user.set_password('demo1234')
            db.session.add(demo_user)
            db.session.commit()
            print('[LifeOS] Seeded default demo user (demo@lifeos.edu / demo1234).')

        # Warm up in-memory data structures for all registered users
        sync_task_queue()
        rebuild_goal_tree()
        sync_notes_search_index()
        sync_activity_stack()
        print('[LifeOS] Database ready. Data structures synced.')

# Alias for clean naming
init_db = init_db_and_seed


if __name__ == '__main__':
    init_db_and_seed()
    print('[LifeOS] Server running on http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=False)
