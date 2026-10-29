"""Pin committed code and copy only explicitly authorized selection manifests."""
import hashlib, io, json, pathlib, subprocess, tarfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
HERE=pathlib.Path(__file__).resolve().parent
rev=json.loads((HERE/'provenance.json').read_text())['revision'] if (HERE/'provenance.json').exists() else subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
snap=HERE/'snapshot';snap.mkdir(exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',rev],cwd=ROOT))) as t:t.extractall(snap,filter='data')
overlays=[]
for name in ['music/picks.json','public/music/manifest.json','public/vo/variants/index.json']:
    saved=HERE/'selections'/name
    data=(saved if saved.exists() else ROOT/name).read_bytes();(snap/name).write_bytes(data)
    saved.parent.mkdir(parents=True,exist_ok=True);saved.write_bytes(data)
    overlays.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),'provenance':'working selection manifest copied byte-for-byte, not game source'})
assets=[]
for p in sorted((snap/'public').rglob('*')):
    if p.is_file():assets.append({'path':str(p.relative_to(snap)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
(HERE/'provenance.json').write_text(json.dumps({'revision':rev,'method':'git archive, no checkout mutation; direct vite build, no vo sync','overlays':overlays,'assets':assets},indent=2))
print(rev,len(assets),'assets')
