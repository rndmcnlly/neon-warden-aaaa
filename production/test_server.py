#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Dashboard-only integration checks. No game test results are implied."""
import http.client
import importlib.util
import json
import threading
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('desk', Path(__file__).with_name('server.py'))
desk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(desk)
desk.Handler.log_message = lambda *args: None
server = desk.ThreadingHTTPServer(('127.0.0.1', 0), desk.Handler)
thread = threading.Thread(target=server.serve_forever)
thread.start()
checks = []


def request(path, method='GET', headers=None):
    conn = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=15)
    conn.request(method, path, headers=headers or {})
    response = conn.getresponse()
    data = response.read()
    result = response.status, dict(response.getheaders()), data
    conn.close()
    return result


def check(name, condition):
    checks.append({'name': name, 'status': 'pass' if condition else 'fail'})
    assert condition, name


try:
    code, _, page = request('/')
    check('Dashboard HTML', code == 200 and b'Production desk' in page)
    code, headers, raw = request('/api/status')
    data = json.loads(raw)
    check('Live JSON, git revision and hand-edited tasks', code == 200 and len(data['revision']) == 40 and bool(data['status']['tasks']))
    check('No cross-origin grant', 'Access-Control-Allow-Origin' not in headers)
    check('Known QA summaries found', bool(data['reports']))
    check('Missing revision is stale, never current', all(r['stale'] for r in data['reports'] if r['revision'] == 'not recorded'))
    check('Moments gallery linked', bool(data['gallery']) and request(data['gallery'])[0] == 200)
    check('Ledger linked', request('/artifacts/research/SPEND.md')[0] == 200)
    check('Status source available', request('/artifacts/production/status.json')[0] == 200)
    for path in ['/.git/config', '/artifacts/.git/config', '/artifacts/production/../../.git/config', '/artifacts/research/%2e%2e/%2e%2e/.ssh/id_rsa', '/artifacts/research/.env', '/artifacts/research/credentials.json', '/artifacts/qa/reports/latest/summary.json', '/artifacts/qa/reports/platform-2026-10-29T05-23-53.590Z/profile/Preferences', '/artifacts/production/', '/artifacts/research/missing.mp4']:
        check('Blocked or missing: ' + path, request(path)[0] == 404)
    check('No command route', request('/api/run?command=whoami')[0] == 404)
    check('POST rejected', request('/api/status', method='POST')[0] == 501)
    check('DNS rebinding Host rejected', request('/', headers={'Host': 'attacker.example'})[0] == 403)
    check('HEAD has no body', request('/', method='HEAD')[2] == b'')
    video_count = 0
    for report in data['reports']:
        check('Report JSON link: ' + report['id'], request(report['url'])[0] == 200)
        if report['page']:
            check('Report HTML link: ' + report['id'], request(report['page'])[0] == 200)
        for reel in report['reels']:
            if not reel['video']:
                continue
            code, headers, block = request(reel['video'], headers={'Range': 'bytes=0-63'})
            check('Video range: ' + reel['video'], code == 206 and len(block) == 64 and headers.get('Content-Range', '').startswith('bytes 0-63/'))
            video_count += 1
    check('Actual reel links found', video_count > 0)
    check('Range overflow rejected', request(data['gallery'], headers={'Range': 'bytes=999999999-9999999999'})[0] == 416)
finally:
    server.shutdown()
    server.server_close()
    thread.join()
    out = Path(__file__).parent / 'reports/server-tests.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({'created': datetime.now(timezone.utc).isoformat(), 'scope': 'dashboard server only', 'status': 'pass' if checks and all(c['status'] == 'pass' for c in checks) else 'fail', 'checks': checks}, indent=2) + '\n')
    print(f'{len(checks)} dashboard checks; report: {out}')
