#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Read-only, loopback production desk. Run: uv run --script production/server.py."""
import argparse
import json
import mimetypes
import re
import subprocess
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, quote

ROOT = Path(__file__).resolve().parent.parent
EXTENSIONS = {'.html', '.css', '.js', '.json', '.md', '.txt', '.mp4', '.webm', '.ogg', '.wav', '.mp3', '.png', '.jpg', '.jpeg', '.webp', '.vtt'}
ROOTS = {'production', 'research', 'qa', 'public'}


def artifact(name):
    """Positive root/type allowlist, no hidden/secret components or symlinks."""
    parts = Path(name).parts
    if not parts or parts[0] not in ROOTS or any(
        p.startswith('.') or p in {'..', 'profile', 'node_modules'} or
        re.search(r'credential|secret|token|password|private.key|\.pem$|\.key$', p, re.I)
        for p in parts
    ):
        return None
    candidate = ROOT.joinpath(*parts)
    if any(p.is_symlink() for p in [candidate, *candidate.parents] if p != ROOT.parent):
        return None
    if not candidate.resolve().is_relative_to(ROOT) or candidate.suffix.lower() not in EXTENSIONS:
        return None
    if parts[0] == 'qa' and (len(parts) < 3 or parts[1] != 'reports'):
        return None
    return candidate if candidate.is_file() else None


def read_json(path):
    if not artifact(str(path.relative_to(ROOT))) or path.stat().st_size > 2_000_000:
        raise ValueError('Missing or oversized JSON')
    return json.loads(path.read_text())


def stamp(path):
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()


def git(*args):
    return subprocess.run(['git', '--no-optional-locks', *args], cwd=ROOT,
                          capture_output=True, text=True, timeout=4, check=True).stdout.strip()


def href(path):
    return '/artifacts/' + quote(str(path.relative_to(ROOT)))


def snapshot():
    now = datetime.now(timezone.utc).isoformat()
    try:
        status = read_json(ROOT / 'production/status.json')
        status_error = None
    except (OSError, ValueError) as error:
        status, status_error = {}, str(error)
    try:
        revision = git('rev-parse', 'HEAD')
        commits = [dict(zip(('revision', 'date', 'subject'), line.split('\t', 2)))
                   for line in git('log', '-8', '--format=%h%x09%cI%x09%s').splitlines()]
        dirty = len(git('status', '--porcelain', '--untracked-files=normal').splitlines())
        head_time = int(git('show', '-s', '--format=%ct', 'HEAD'))
        git_error = None
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        revision, commits, dirty, head_time, git_error = 'unknown', [], None, 0, str(error)
    reports = []
    report_root = ROOT / 'qa/reports'
    if report_root.is_dir():
        # Only shallow known summary files, never logs, profiles or arbitrary JSON.
        dirs = sorted((p for p in report_root.iterdir() if p.is_dir() and not p.is_symlink()),
                      key=lambda p: p.stat().st_mtime, reverse=True)[:24]
        for directory in dirs:
            files = [directory / n for n in ('summary.json', 'result.json', 'capture.json', 'coverage.json', 'assets.json')]
            for path in files:
                if not path.is_file():
                    continue
                try:
                    data = read_json(path)
                    checks = data.get('checks', [])
                    counts = data.get('counts') or {s: sum(isinstance(c, dict) and c.get('status') == s for c in checks) for s in ('pass', 'warn', 'fail')}
                    if checks and all(isinstance(c, str) for c in checks):
                        counts = {'recorded checks': len(checks)}
                    if data.get('results'):
                        counts = {s: sum(r.get('status') == s for r in data['results'] if isinstance(r, dict)) for s in ('pass', 'warn', 'fail')}
                    result = data.get('overall', data.get('status')) or ('fail' if counts.get('fail') else 'warn' if counts.get('warn') else 'pass' if counts.get('pass') else 'unknown')
                    source_rev = data.get('revision', data.get('gitRevision', data.get('commit')))
                    # Missing provenance is NEVER treated as a current-build pass.
                    stale = not source_rev or not revision.startswith(str(source_rev)) or bool(dirty)
                    reels = []
                    for reel in data.get('reels', data.get('results', [])):
                        if not isinstance(reel, dict):
                            continue
                        video = directory / str(reel.get('video') or f"reels/{reel.get('id', '')}/reel.mp4")
                        reels.append({'title': reel.get('title', reel.get('id', 'Reel')), 'status': reel.get('status', 'unknown'),
                                      'video': href(video) if artifact(str(video.relative_to(ROOT))) else None})
                    for video in sorted(directory.glob('video/*.webm'))[:4]:
                        if artifact(str(video.relative_to(ROOT))):
                            reels.append({'title': video.stem, 'status': 'unknown', 'video': href(video)})
                    reports.append({'id': directory.name + '/' + path.name, 'status': result, 'counts': counts,
                                    'timestamp': data.get('created', stamp(path)), 'revision': source_rev or 'not recorded',
                                    'stale': stale, 'freshness': 'provenance missing' if not source_rev else 'checkout changed' if stale else 'revision matches',
                                    'predatesHead': path.stat().st_mtime < head_time,
                                    'url': href(path), 'page': href(directory / 'index.html') if artifact(str((directory / 'index.html').relative_to(ROOT))) else None,
                                    'problems': [c for c in checks if isinstance(c, dict) and c.get('status') in ('fail', 'warn')][:6], 'reels': reels})
                except (OSError, ValueError, TypeError):
                    continue
    ledger = ROOT / 'research/SPEND.md'
    ledger_text = ledger.read_text()[:30_000] if artifact('research/SPEND.md') and ledger.stat().st_size < 200_000 else 'Ledger missing or too large: open the source file.'
    gallery = artifact('research/2026-10-28-moments/index.html')
    return {'refreshed': now, 'status': status, 'statusError': status_error,
            'revision': revision, 'dirtyFiles': dirty, 'commits': commits, 'gitError': git_error,
            'reports': reports[:35], 'ledger': ledger_text, 'ledgerTimestamp': stamp(ledger) if ledger.exists() else None,
            'gallery': href(gallery) if gallery else None}


PAGE = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neon Warden | Production</title>
<style>
:root{color-scheme:dark;--bg:#0c1119;--panel:#151e2a;--muted:#a7b5c6;--cyan:#78e5e4;--line:#2b3a4c}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#eaf1f8;font:15px/1.5 system-ui,sans-serif}main{max-width:1220px;margin:auto;padding:28px 22px}h1{font-size:2rem;margin:0}h2{font-size:1.1rem;margin:0 0 14px}h3{font-size:1rem;margin:0}p{margin:6px 0}a{color:var(--cyan);text-underline-offset:3px}a:hover{color:white}.muted,small{color:var(--muted)}header{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:22px}.eyebrow{color:var(--cyan);text-transform:uppercase;letter-spacing:.15em;font-size:.72rem}.grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px}section,.launch{background:var(--panel);border-radius:10px;padding:20px;min-width:0}.wide{grid-column:1/-1}.links{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.button{background:#233a49;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block}.primary{background:var(--cyan);color:#092426;font-weight:750}.item{padding:12px 0;border-top:1px solid var(--line)}.item:first-child{border-top:0;padding-top:0}.badge{display:inline-block;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;border-radius:4px;padding:2px 6px;background:#29384c;color:#d1dce9;margin-right:5px}.pass,.done{background:#183e35;color:#91edc0}.warn,.unverified,.stale{background:#48391e;color:#ffd184}.fail,.blocked{background:#482830;color:#ffb4b4}.active{background:#193c51;color:#9cdcff}.reports{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.report{background:#101923;border-radius:7px;padding:15px;overflow-wrap:anywhere}.report p{font-size:.86rem}details{margin-top:10px}summary{cursor:pointer;color:var(--cyan)}video{width:100%;max-height:260px;margin:8px 0;background:#080b10}pre{white-space:pre-wrap;overflow-wrap:anywhere;font: .8rem/1.6 ui-monospace,monospace;max-height:420px;overflow:auto}code{font-size:.85em}footer{padding:20px 0;color:var(--muted);font-size:.8rem}#error{color:#ffb4b4}#refresh{font-size:.8rem;text-align:right}ul{padding-left:20px}@media(max-width:700px){main{padding:18px 12px}.grid{grid-template-columns:1fr}header{align-items:start;flex-direction:column}#refresh{text-align:left}section,.launch{padding:16px}h1{font-size:1.65rem}}a:focus-visible,summary:focus-visible{outline:3px solid var(--cyan);outline-offset:4px}
.reports{max-height:640px;overflow:auto;align-items:start;padding-right:6px;scrollbar-color:#426174 #101923}
</style><main><header><div><div class="eyebrow">adamsmith.systems / CM121 f26</div><h1>Neon Warden</h1><p class="muted">Production desk · local, read-only</p></div><div id="refresh">Connecting…</div></header><p id="error" role="status"></p>
<div class="grid"><section class="wide"><h2>Latest play build</h2><div class="links"><a class="button primary" href="http://127.0.0.1:4321" target="_blank" rel="noopener">Play local build ↗</a><a class="button" href="http://127.0.0.1:8121" target="_blank" rel="noopener">UI / gameplay audition ↗</a><a class="button" href="http://127.0.0.1:8122" target="_blank" rel="noopener">Tutorial voice audition ↗</a><a class="button" href="#moments">30 moments ↓</a></div><p id="build" class="muted"></p><small>Links open independent local servers. Availability is not a test result. Voice default: original; a_captain remains an alternative for A/B with music.</small></section>
<section><h2>Current work</h2><div id="tasks"></div></section><section><h2>Blockers & decisions</h2><h3>Open issues</h3><div id="blockers"></div><h3>Decision log</h3><div id="decisions"></div></section>
<section class="wide"><h2>Latest QA artifacts</h2><p class="muted">Recorded outcomes, not fresh test runs. Missing revision provenance or a dirty checkout marks a result stale / unverified. Open a reel to review without interruption from refresh.</p><div id="qa" class="reports"></div></section>
<section id="moments"><h2>Moments gallery</h2><div id="gallery"></div><p class="muted">30 short clips · captured at 81c684f. Findings are stale against newer game code.</p><p><a href="/artifacts/research/2026-10-28-moments/README.md">Capture notes</a></p></section>
<section><h2>Recent commits</h2><div id="commits"></div></section><section class="wide"><h2>Budget ledger</h2><p><a href="/artifacts/research/SPEND.md">Open research/SPEND.md</a> · <small id="ledger-time"></small></p><details><summary>Read ledger (source text, bounded)</summary><pre id="ledger"></pre></details></section></div><footer>Credits: Adam Smith, and his coupled agents<br>Hand-edit production/status.json. Refresh every 10 seconds; no commands or writes are exposed.</footer></main>
<script>
const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=s=>`<span class="badge ${['pass','warn','fail','done','active','blocked','unverified','stale'].includes(s)?s:''}">${esc(s)}</span>`;
const time=s=>s?new Date(s).toLocaleString():'not recorded';
const cache=new Map();function update(id,html){if(cache.get(id)!==html){$(id).innerHTML=html;cache.set(id,html)}}
function rows(items){return (items||[]).map(x=>`<div class="item">${badge(x.status||'note')}<strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p><small>${esc(x.owner||'')} ${esc(x.revision||'')} · ${esc(x.updated||'date not recorded')}</small></div>`).join('')||'<p class="muted">No entries recorded.</p>'}
function renderReports(reports){
 const parent=$('qa'); const live=new Set();
 for(const r of reports){live.add(r.id);let el=[...parent.children].find(e=>e.dataset.id===r.id);if(!el){el=document.createElement('article');el.className='report';el.dataset.id=r.id;parent.appendChild(el)}
 const html=`<div>${badge(r.status)}${r.stale?badge('stale'):''}</div><h3>${esc(r.id)}</h3><p>${esc(time(r.timestamp))}<br>Revision: <code>${esc(r.revision)}</code><br>${esc(r.freshness)}${r.predatesHead?' · predates HEAD':''}</p><p>${Object.entries(r.counts).map(([s,n])=>`${esc(n)} ${esc(s)}`).join(' · ')}</p><p><a href="${esc(r.page||r.url)}" target="_blank" rel="noopener">Open report ↗</a> · <a href="${esc(r.url)}">JSON</a></p>${r.problems.map(p=>`<p>${badge(p.status)}${esc(p.detail)}</p>`).join('')}`;
 let info=el.querySelector('.info');if(!info){info=document.createElement('div');info.className='info';el.appendChild(info)}if(info.innerHTML!==html)info.innerHTML=html;
 // Reconcile video nodes separately. Never replace an existing playing video.
 for(const reel of r.reels){if(!reel.video)continue;if([...el.querySelectorAll('video')].some(v=>v.getAttribute('src')===reel.video))continue;const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=`${reel.title} (${reel.status})`;details.appendChild(summary);const v=document.createElement('video');v.controls=true;v.preload='none';v.src=reel.video;details.appendChild(v);el.appendChild(details)}
 }
 for(const el of [...parent.children])if(!live.has(el.dataset.id)&&![...el.querySelectorAll('video')].some(v=>!v.paused))el.remove();
 if(!reports.length)parent.textContent='No summary JSON available yet. No passes claimed.';
}
let refreshing=false;async function refresh(){if(refreshing)return;refreshing=true;try{const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);const d=await response.json();$('refresh').textContent=`Last refreshed ${time(d.refreshed)} · every 10 s`;$('error').textContent=[d.statusError,d.gitError].filter(Boolean).join(' · ');$('build').textContent=`Checkout ${d.revision.slice(0,12)} · ${d.dirtyFiles??'?'} changed / untracked files. Link serves the working tree, not an immutable release.`;update('tasks',rows(d.status.tasks));update('blockers',rows(d.status.blockers));update('decisions',rows(d.status.decisions));renderReports(d.reports);update('gallery',d.gallery?`<a class="button" href="${esc(d.gallery)}" target="_blank" rel="noopener">Open 30-clip gallery ↗</a>`:'<p>Gallery not available yet.</p>');update('commits',d.commits.map(c=>`<div class="item"><code>${esc(c.revision)}</code> ${esc(c.subject)}<br><small>${esc(time(c.date))}</small></div>`).join(''));$('ledger').textContent=d.ledger;$('ledger-time').textContent=`Updated ${time(d.ledgerTimestamp)}`;}catch(e){$('error').textContent=`Refresh failed: ${e.message}. Previous data retained; last-refreshed time unchanged.`}finally{refreshing=false}}
refresh();setInterval(refresh,10000);
</script></html>'''


class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.do_GET(head=True)

    def do_GET(self, head=False):
        # Host allowlist also blocks browser DNS-rebinding access.
        if self.headers.get('Host') not in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}:
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/':
            self.reply(PAGE.encode(), 'text/html; charset=utf-8', head)
        elif path == '/api/status':
            self.reply(json.dumps(snapshot()).encode(), 'application/json', head)
        elif path.startswith('/artifacts/'):
            file = artifact(path.removeprefix('/artifacts/'))
            if file:
                self.serve_file(file, head)
            else:
                self.send_error(404, 'Artifact missing or not permitted')
        else:
            self.send_error(404)

    def headers_response(self, kind, length, code=200):
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(length))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')

    def reply(self, data, kind, head):
        self.headers_response(kind, len(data))
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def serve_file(self, file, head):
        # Byte ranges make longer videos seekable without loading them into RAM.
        size = file.stat().st_size
        start, end, code = 0, size - 1, 200
        requested = self.headers.get('Range')
        if requested:
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
            if not match or not any(match.groups()):
                self.send_error(416)
                return
            a, b = match.groups()
            start, end = (int(a), min(int(b) if b else size - 1, size - 1)) if a else (max(0, size - int(b)), size - 1)
            if start > end or start >= size:
                self.send_error(416)
                return
            code = 206
        self.headers_out(file, size, start, end, code)
        if not head:
            try:
                with file.open('rb') as stream:
                    stream.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        block = stream.read(min(65536, remaining))
                        if not block:
                            break
                        self.wfile.write(block)
                        remaining -= len(block)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def headers_out(self, file, size, start, end, code):
        self.headers_response(mimetypes.guess_type(file.name)[0] or 'application/octet-stream', max(0, end-start+1), code)
        self.send_header('Accept-Ranges', 'bytes')
        if code == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8123)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Production desk: http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
