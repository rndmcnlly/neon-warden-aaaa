# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""Same OpenRouter AV transport as omni-judges/judge.py, open-ended not score-based.

ZDR and data_collection deny are mandatory, never retried with weaker policy.
Raw response preserves actual returned model, provider and usage. No keys saved.
"""
import base64,json,os,pathlib,time,httpx
R=pathlib.Path(__file__).resolve().parent
key=os.environ.get('OPENROUTER_API_KEY') or json.loads((pathlib.Path.home()/'.local/share/opencode/auth.json').read_text())['openrouter']['key']
model='google/gemini-4-argon'
catalog=json.loads((R/'catalog.json').read_text())['data'];assert any(m['id']==model and 'video' in m['architecture']['input_modalities'] for m in catalog)
content=[{'type':'text','text':(R/'prompt.txt').read_text()}]
for n in 'ABCDEFG':
 content.extend([{'type':'text','text':f'CLIP {n}: local clock starts at 0 seconds below.'},{'type':'video_url','video_url':{'url':'data:video/mp4;base64,'+base64.b64encode((R/f'out/{n}/clip.mp4').read_bytes()).decode()}}])
body={'model':model,'provider':{'zdr':True,'data_collection':'deny'},'messages':[{'role':'user','content':content}],'response_format':{'type':'json_object'},'usage':{'include':True},'max_tokens':20000}
# One request only. 20k completion cap plus this compact AV package is well below $1.50 at the saved live catalog price.
assert not (R/'response.json').exists(),'Refuse accidental duplicate paid call'
t=time.time();resp=httpx.post('https://openrouter.ai/api/v1/chat/completions',headers={'Authorization':f'Bearer {key}','X-Title':'Neon Warden open-ended creative review'},json=body,timeout=900)
raw=resp.json();(R/'response.json').write_text(json.dumps(raw,indent=2,ensure_ascii=False))
meta={'requested_model':model,'returned_model':raw.get('model'),'provider':raw.get('provider'),'status':resp.status_code,'wall_s':round(time.time()-t,2),'policy':body['provider'],'usage':raw.get('usage'),'finish_reason':raw.get('choices',[{}])[0].get('finish_reason')}
(R/'request-metadata.json').write_text(json.dumps(meta,indent=2))
cost=(raw.get('usage') or {}).get('cost',0)
with (R.parents[0]/'SPEND.md').open('a') as f:f.write(f'\n| 2026-10-28 | Argon creative review: 7 isolated-build AV clips, single open-ended session | OpenRouter | google/gemini-4-argon (mandatory ZDR, data_collection deny; returned {raw.get("provider")}) | 1 | {cost:.6f} | See reconciliation below |\n')
assert resp.status_code==200,meta
assert cost<=1.50,meta
text=raw['choices'][0]['message']['content'];(R/'response-transcript.txt').write_text(text)
try:
 parsed=json.loads(text);(R/'review.json').write_text(json.dumps(parsed,indent=2,ensure_ascii=False));(R/'DIRECTOR.md').write_text(parsed['creative_notes_markdown'])
except json.JSONDecodeError:
 print('Raw answer retained; run recover_response.py locally, never retry the paid request just for JSON syntax.')
print(json.dumps(meta))
