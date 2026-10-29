"""Freeze code and only the actual selected public media, with SHA256 provenance."""
import hashlib, json, pathlib, shutil, subprocess
R = pathlib.Path(__file__).resolve().parent
repo = R.parents[1]
S = R / 'snapshot'
assert not S.exists(), 'Freeze once; rename a prior snapshot before a revision'
S.mkdir()
shutil.copytree(repo/'src', S/'src')
for name in ['deno.json','deno.lock']:
    shutil.copy2(repo/name,S/name)
(S/'node_modules').symlink_to(repo/'node_modules', target_is_directory=True)
shutil.copy2(R/'prototype.vite.ts',S/'vite.config.ts')
dest=S/'research'/R.name
dest.mkdir(parents=True)
for name in ['prototype.html','prototype.ts']:
    shutil.copy2(R/name,dest/name)
shutil.copytree(repo/'public/models',S/'public/models')
cues=json.loads((repo/'public/vo/cues.json').read_text())
(S/'public/vo').mkdir()
shutil.copy2(repo/'public/vo/cues.json', S/'public/vo/cues.json')
for id, line in cues['lines'].items():
    if id.startswith('flash_rec_'):
        for take in line['langs'].values():
            p=pathlib.Path('public/vo')/take['file']
            (S/p).parent.mkdir(exist_ok=True)
            shutil.copy2(repo/p,S/p)
music=json.loads((repo/'public/music/manifest.json').read_text())
(S/'public/music').mkdir()
shutil.copy2(repo/'public/music/manifest.json',S/'public/music/manifest.json')
p=pathlib.Path('public')/music['cues']['flashback']['src']
(S/p).parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(repo/p,S/p)
files={str(p.relative_to(S)):hashlib.sha256(p.read_bytes()).hexdigest() for p in S.rglob('*') if p.is_file() and 'node_modules' not in p.parts}
(R/'provenance.json').write_text(json.dumps({'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'dirty':subprocess.check_output(['git','status','--short'],cwd=repo,text=True),'files':files},indent=2))
print(f'Frozen {len(files)} files under {S}')
