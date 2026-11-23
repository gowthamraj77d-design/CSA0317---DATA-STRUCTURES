import os
import urllib.parse

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))

# Load .env file from project root or backend directory
for _candidate in [os.path.join(PROJECT_ROOT, '.env'), os.path.join(BASE_DIR, '.env')]:
    if os.path.exists(_candidate):
        with open(_candidate, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, val = line.partition('=')
                    os.environ.setdefault(key.strip(), val.strip().strip('"\''))
        break


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'lifeos$ecret_key_2026_change_in_prod')

    # Database Selection: 'sqlite' (default: database/lifeos.db) or 'mysql'
    DB_TYPE = os.environ.get('DB_TYPE', 'sqlite').strip().lower()

    # SQLite Database Configuration
    SQLITE_PATH = os.environ.get('SQLITE_PATH', os.path.join(PROJECT_ROOT, 'database', 'lifeos.db'))
    os.makedirs(os.path.dirname(os.path.abspath(SQLITE_PATH)), exist_ok=True)

    # MySQL Database Configuration
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = os.environ.get('DB_PORT', '3306')
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_NAME = os.environ.get('DB_NAME', 'productivity_dashboard')

    if DB_TYPE == 'mysql':
        _encoded_pwd = urllib.parse.quote_plus(DB_PASSWORD) if DB_PASSWORD else ''
        _user_auth = f"{DB_USER}:{_encoded_pwd}" if _encoded_pwd else DB_USER
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{_user_auth}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
        )
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_recycle': 280,
            'pool_pre_ping': True,
        }
    else:
        # Default: SQLite lifeos.db
        _sqlite_abs = os.path.abspath(SQLITE_PATH).replace('\\', '/')
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{_sqlite_abs}"
        SQLALCHEMY_ENGINE_OPTIONS = {}

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 86400 * 7   # 7 days
