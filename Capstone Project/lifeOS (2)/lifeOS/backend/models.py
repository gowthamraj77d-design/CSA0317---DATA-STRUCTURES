from datetime import datetime
from database import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = 'users'

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False, default='')
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks      = db.relationship('Task',         backref='user', lazy=True, cascade='all, delete-orphan')
    goals      = db.relationship('Goal',         backref='user', lazy=True, cascade='all, delete-orphan')
    notes      = db.relationship('Note',         backref='user', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('Activity',     backref='user', lazy=True, cascade='all, delete-orphan')
    searches   = db.relationship('RecentSearch', backref='user', lazy=True, cascade='all, delete-orphan')
    calendar_connections = db.relationship('CalendarConnection', backref='user', lazy=True, cascade='all, delete-orphan')
    calendar_events      = db.relationship('CalendarEvent',      backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id':         self.id,
            'name':       self.name,
            'email':      self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Goal(db.Model):
    __tablename__ = 'goals'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text,        nullable=True,  default='')
    parent_id   = db.Column(db.Integer,     db.ForeignKey('goals.id'), nullable=True)
    status      = db.Column(db.String(50),  nullable=False, default='Active')
    progress    = db.Column(db.Float,       nullable=False, default=0.0)
    deadline    = db.Column(db.String(50),  nullable=True,  default='')
    user_id     = db.Column(db.Integer,     db.ForeignKey('users.id'), nullable=False, index=True)
    created_at  = db.Column(db.DateTime,    default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    subgoals = db.relationship(
        'Goal',
        backref=db.backref('parent', remote_side=[id]),
        lazy=True,
        cascade='all, delete-orphan'
    )
    tasks = db.relationship('Task', backref='goal', lazy=True)

    def to_dict(self, include_children=True):
        data = {
            'id':          self.id,
            'title':       self.title,
            'description': self.description or '',
            'parent_id':   self.parent_id,
            'status':      self.status,
            'progress':    round(self.progress or 0.0, 1),
            'completed':   self.status == 'Completed' or (self.progress or 0.0) >= 100.0,
            'deadline':    self.deadline or '',
            'created_at':  self.created_at.isoformat() if self.created_at else None,
            'updated_at':  self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            data['subgoals'] = [c.to_dict(include_children=True) for c in self.subgoals]
        return data


class Task(db.Model):
    __tablename__ = 'tasks'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text,        nullable=True,  default='')
    priority    = db.Column(db.String(20),  nullable=False, default='medium')
    due_date    = db.Column(db.String(50),  nullable=True,  default='')
    status      = db.Column(db.String(50),  nullable=False, default='Pending')
    goal_id     = db.Column(db.Integer,     db.ForeignKey('goals.id'),  nullable=True)
    user_id     = db.Column(db.Integer,     db.ForeignKey('users.id'),  nullable=False, index=True)
    created_at  = db.Column(db.DateTime,    default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'title':       self.title,
            'description': self.description or '',
            'notes':       self.description or '',
            'priority':    (self.priority or 'medium').lower(),
            'due_date':    self.due_date or '',
            'dueDate':     self.due_date or '',
            'status':      self.status,
            'completed':   self.status == 'Completed',
            'goal_id':     self.goal_id,
            'goalId':      self.goal_id,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
            'updated_at':  self.updated_at.isoformat() if self.updated_at else None,
        }


class Note(db.Model):
    __tablename__ = 'notes'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title       = db.Column(db.String(255), nullable=False)
    content     = db.Column(db.Text,        nullable=True,  default='')
    category    = db.Column(db.String(50),  nullable=False, default='General')
    user_id     = db.Column(db.Integer,     db.ForeignKey('users.id'), nullable=False, index=True)
    created_at  = db.Column(db.DateTime,    default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'title':      self.title,
            'content':    self.content or '',
            'category':   self.category or 'General',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updatedAt':  self.updated_at.isoformat() if self.updated_at else None,
        }


class Activity(db.Model):
    __tablename__ = 'activities'

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    action        = db.Column(db.String(100), nullable=False)
    description   = db.Column(db.Text,        nullable=True,  default='')
    activity_type = db.Column(db.String(50),  nullable=False)
    icon          = db.Column(db.String(10),  nullable=False, default='📌')
    user_id       = db.Column(db.Integer,     db.ForeignKey('users.id'), nullable=False, index=True)
    created_at    = db.Column(db.DateTime,    default=datetime.utcnow)

    def to_dict(self):
        dt = self.created_at or datetime.utcnow()
        return {
            'id':            self.id,
            'action':        self.action,
            'type':          self.activity_type,
            'activity_type': self.activity_type,
            'description':   self.description or '',
            'message':       self.description or '',
            'icon':          self.icon or '📌',
            'timestamp':     dt.isoformat(),
            'date':          dt.strftime('%d %b %Y'),
            'time':          dt.strftime('%I:%M %p'),
        }


class RecentSearch(db.Model):
    __tablename__ = 'recent_searches'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    keyword     = db.Column(db.String(255), nullable=False)
    user_id     = db.Column(db.Integer,     db.ForeignKey('users.id'), nullable=False, index=True)
    searched_at = db.Column(db.DateTime,    default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'keyword':     self.keyword,
            'searched_at': self.searched_at.isoformat() if self.searched_at else None,
        }


class CalendarConnection(db.Model):
    __tablename__ = 'calendar_connections'

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    provider      = db.Column(db.String(50), nullable=False, default='google')
    access_token  = db.Column(db.Text, nullable=True, default='')
    refresh_token = db.Column(db.Text, nullable=True, default='')
    status        = db.Column(db.String(50), nullable=False, default='connected') # connected | disconnected
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'provider':   self.provider,
            'status':     self.status,
            'connected':  self.status == 'connected',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class CalendarEvent(db.Model):
    __tablename__ = 'calendar_events'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True, default='')
    location    = db.Column(db.String(255), nullable=True, default='')
    start_time  = db.Column(db.String(50), nullable=False) # ISO format or string time
    end_time    = db.Column(db.String(50), nullable=True, default='')
    time_display= db.Column(db.String(20), nullable=True, default='') # e.g. "09:00 AM"
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'title':        self.title,
            'description':  self.description or '',
            'location':     self.location or '',
            'start':        self.start_time,
            'end':          self.end_time or '',
            'time_display': self.time_display or self.start_time,
            'type':         'calendar',
        }

