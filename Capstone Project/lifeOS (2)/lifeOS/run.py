"""
LifeOS Full-Stack Application Launcher
Run this script to start the Flask REST API backend server & serve the frontend dashboard.

Usage:
    python run.py
"""

import sys
import os

# Force UTF-8 stdout encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend directory is in Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import app, init_db_and_seed

if __name__ == '__main__':
    print("==================================================")
    print(" LifeOS Smart Personal Productivity Dashboard ")
    print(" Full-Stack Flask Backend + MySQL Database + REST API")
    print(" Data Structures: Queue, Tree, Stack, HashMap")
    print("==================================================")

    init_db_and_seed()
    print("\nAccess LifeOS Dashboard at: http://127.0.0.1:5000\n")

    app.run(host='127.0.0.1', port=5000, debug=False)
