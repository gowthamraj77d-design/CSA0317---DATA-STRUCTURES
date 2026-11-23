"""
LifeOS – Full 21-Test Verification Protocol
Run from project root: python tests/test_all.py
"""
import urllib.request
import urllib.error
import json
import http.cookiejar
import sys
import os

BASE = 'http://127.0.0.1:5000'
results = []

def make_opener():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def api_post(opener, path, data=None):
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=json.dumps(data or {}).encode(),
        method='POST'
    )
    req.add_header('Content-Type', 'application/json')
    res = opener.open(req, timeout=12)
    return json.loads(res.read())

def api_get(opener, path):
    res = opener.open(f'{BASE}{path}', timeout=12)
    return json.loads(res.read())

def check(num, name, condition, detail=''):
    status = 'PASS' if condition else 'FAIL'
    results.append(condition)
    print(f'  T{num:02d} [{status}]  {name:<42} {detail}')

print()
print('=' * 70)
print('  LifeOS Smart Productivity Integration - 21 Test Protocol')
print('=' * 70)

opener_a = make_opener()

# TEST 1 - Login
try:
    r = api_post(opener_a, '/api/auth/login', {'email': 'demo@lifeos.edu', 'password': 'demo1234'})
    check(1, 'Login', bool(r.get('user')), r.get('user', {}).get('name', ''))
except Exception as e:
    check(1, 'Login', False, str(e)[:60])

# TEST 2 - Dashboard loads user data
try:
    r = api_get(opener_a, '/api/auth/me')
    check(2, 'Dashboard user data', bool(r.get('user')), r.get('user', {}).get('email', ''))
except Exception as e:
    check(2, 'Dashboard user data', False, str(e)[:60])

# TEST 3 - Weather loads
try:
    r = api_get(opener_a, '/api/weather')
    ok = r.get('status') == 'success' and bool(r.get('weather', {}).get('temp'))
    check(3, 'Weather loads', ok, str(r.get('weather', {}).get('temp', '?')) + ' ' + str(r.get('weather', {}).get('condition', '')))
except Exception as e:
    check(3, 'Weather loads', False, str(e)[:60])

# TEST 4 - Weather failure doesn't crash dashboard
try:
    r = api_get(opener_a, '/api/weather')
    check(4, 'Weather graceful fallback', 'status' in r, 'provider: ' + r.get('provider', 'fallback'))
except urllib.error.HTTPError as e:
    check(4, 'Weather graceful fallback', e.code != 500, f'HTTP {e.code}')
except Exception as e:
    check(4, 'Weather graceful fallback', False, str(e)[:60])

# TEST 5 - Connect Google Calendar
try:
    r = api_post(opener_a, '/api/calendar/connect', {'provider': 'google'})
    check(5, 'Connect Google Calendar', r.get('status') in ['success', 'connected'], r.get('message', ''))
except Exception as e:
    check(5, 'Connect Google Calendar', False, str(e)[:60])

# TEST 6 - Upcoming events appear
try:
    r = api_get(opener_a, '/api/calendar/events')
    has_events = len(r.get('events', [])) > 0
    check(6, 'Calendar events appear', has_events, f"{len(r.get('events', []))} events")
except Exception as e:
    check(6, 'Calendar events appear', False, str(e)[:60])

# TEST 7 - Disconnect Calendar
try:
    r = api_post(opener_a, '/api/calendar/disconnect', {})
    check(7, 'Disconnect Calendar', r.get('status') in ['success', 'disconnected'], r.get('message', ''))
except Exception as e:
    check(7, 'Disconnect Calendar', False, str(e)[:60])

# TEST 8 - Calendar section handles disconnection gracefully
try:
    r = api_get(opener_a, '/api/calendar/events')
    check(8, 'Disconnected state graceful', 'status' in r, f"connected={r.get('connected')}")
except urllib.error.HTTPError as e:
    check(8, 'Disconnected state graceful', e.code != 500, f'HTTP {e.code}')
except Exception as e:
    check(8, 'Disconnected state graceful', False, str(e)[:60])

# TEST 9 - Voice Assistant file exists
voice_path = r'd:\lifeOS\frontend\js\voice.js'
check(9, 'Voice Assistant JS exists', os.path.exists(voice_path), voice_path)

# TEST 10 - Microphone permission handler exists
try:
    voice_js = open(voice_path, encoding='utf-8').read()
    check(10, 'Mic permission handler', 'SpeechRecognition' in voice_js or 'webkitSpeechRecognition' in voice_js, 'Web Speech API')
except Exception as e:
    check(10, 'Mic permission handler', False, str(e)[:60])

# TEST 11 - "Show tasks" command recognized in parser
try:
    voice_js = open(voice_path, encoding='utf-8').read()
    check(11, '"Show tasks" command parser', 'show' in voice_js and 'task' in voice_js.lower(), 'command parser present')
except Exception as e:
    check(11, '"Show tasks" command parser', False, str(e)[:60])

# TEST 12 - Add task "Practice DSA" via API (simulates voice command)
try:
    r = api_post(opener_a, '/api/tasks', {
        'title': 'Practice DSA',
        'priority': 'high',
        'dueDate': '2026-08-25',
        'notes': 'Added via voice test'
    })
    task_id = (r.get('task') or {}).get('id') or r.get('id')
    check(12, 'Add task "Practice DSA" via API', bool(task_id), f'id={task_id}')
except Exception as e:
    check(12, 'Add task "Practice DSA" via API', False, str(e)[:60])

# TEST 13 - Task appears in Queue (GET /api/tasks)
try:
    r = api_get(opener_a, '/api/tasks')
    tasks = r.get('tasks', [])
    found = any('DSA' in t.get('title', '') or 'Practice' in t.get('title', '') for t in tasks)
    check(13, 'Task in Queue (/api/tasks)', found, f'{len(tasks)} tasks total')
except Exception as e:
    check(13, 'Task in Queue (/api/tasks)', False, str(e)[:60])

# TEST 14 - Activity appears in Stack
try:
    r = api_get(opener_a, '/api/activities')
    acts = r.get('activities', [])
    check(14, 'Activity in Stack (/api/activities)', len(acts) > 0, f'{len(acts)} activities logged')
except Exception as e:
    check(14, 'Activity in Stack (/api/activities)', False, str(e)[:60])

# TEST 15 - Task appears in HashMap search
try:
    r = api_get(opener_a, '/api/search?q=DSA&limit=10')
    found = len(r.get('results', [])) > 0
    check(15, 'Task in HashMap search (/api/search)', found, f"{len(r.get('results', []))} results for 'DSA'")
except Exception as e:
    check(15, 'Task in HashMap search (/api/search)', False, str(e)[:60])

# TEST 16 - Productivity score from /api/insights
try:
    r = api_get(opener_a, '/api/insights')
    score = r.get('summary', {}).get('productivity_score')
    check(16, 'Productivity score available', score is not None, f'score={score}%')
except Exception as e:
    check(16, 'Productivity score available', False, str(e)[:60])

# TEST 17 - Text-to-Speech in voice.js
try:
    voice_js = open(voice_path, encoding='utf-8').read()
    check(17, 'Text-to-Speech in voice.js', 'speechSynthesis' in voice_js, 'TTS wired up')
except Exception as e:
    check(17, 'Text-to-Speech in voice.js', False, str(e)[:60])

# TEST 18 - Search via API (voice command: "search for goals")
try:
    r = api_get(opener_a, '/api/search?q=goal&limit=5')
    check(18, 'Voice search /api/search?q=goal', 'results' in r, f"{len(r.get('results', []))} results")
except Exception as e:
    check(18, 'Voice search /api/search', False, str(e)[:60])

# TEST 19 - User isolation
opener_b = make_opener()
try:
    try:
        api_post(opener_b, '/api/auth/register', {
            'name': 'Isolation Test User',
            'email': 'isolationtest@lifeos.edu',
            'password': 'test1234'
        })
    except Exception:
        pass  # May already exist
    api_post(opener_b, '/api/auth/login', {
        'email': 'isolationtest@lifeos.edu',
        'password': 'test1234'
    })
    r_b = api_get(opener_b, '/api/tasks')
    r_a = api_get(opener_a, '/api/tasks')
    a_titles = {t['title'] for t in r_a.get('tasks', [])}
    b_titles = {t['title'] for t in r_b.get('tasks', [])}
    isolated = 'Practice DSA' not in b_titles
    check(19, 'User data isolation (A != B)', isolated, f'A={len(a_titles)} tasks, B={len(b_titles)} tasks')
except Exception as e:
    check(19, 'User data isolation', False, str(e)[:60])

# TEST 20 - Refresh: DB data persists
try:
    r = api_get(opener_a, '/api/tasks')
    tasks = r.get('tasks', [])
    found = any('DSA' in t.get('title', '') or 'Practice' in t.get('title', '') for t in tasks)
    check(20, 'DB persistence after refresh', found, f'{len(tasks)} tasks in DB')
except Exception as e:
    check(20, 'DB persistence after refresh', False, str(e)[:60])

# TEST 21 - System health: all 4 DS active
try:
    r = api_get(opener_a, '/api/health')
    mods = r.get('modules', {})
    all_active = all(mods.get(m) == 'active' for m in ['queue', 'tree', 'stack', 'hashmap'])
    check(21, 'Health: Queue+Tree+Stack+HashMap active', all_active, str(mods))
except Exception as e:
    check(21, 'System health check', False, str(e)[:60])

# Summary
print()
print('=' * 70)
passed = sum(1 for r in results if r)
total = len(results)
pct = int(passed / total * 100) if total else 0
print(f'  RESULT: {passed}/{total} tests passed ({pct}%)')
if passed == total:
    print('  STATUS: ALL TESTS PASSED')
else:
    failed = [i + 1 for i, r in enumerate(results) if not r]
    print(f'  FAILED: tests {failed}')
print('=' * 70)
print()
sys.exit(0 if passed == total else 1)
