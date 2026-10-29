"""Trim normal-speed captures at Play; keep original A/V and two final stills."""
import json, pathlib, shutil, subprocess
R=pathlib.Path(__file__).resolve().parent
for label in 'ABCD':
    d=R/'out'/label
    m=json.loads((d/'capture.json').read_text())
    subprocess.run(['ffmpeg','-y','-v','error','-ss',str(m['cutStart']),'-i',str(d/'reel.mp4'),'-t',str(m['duration']+.3),'-c:v','libx264','-crf','24','-pix_fmt','yuv420p','-c:a','aac',str(d/'clip.mp4')],check=True)
shutil.copy2(R/'out/A/traffic.png',R/'memory-traffic.png')
shutil.copy2(R/'out/C/still.png',R/'dart-phone.png')
report={}
for label in 'ABCD':
    m=json.loads((R/f'out/{label}/capture.json').read_text())
    report[label]={k:m[k] for k in ['case','cutStart','duration','pacing','overflow','errors','av']}
(R/'capture-summary.json').write_text(json.dumps(report,indent=2))
print('Final normal-speed clips A–D, two stills and capture-summary.json prepared')
