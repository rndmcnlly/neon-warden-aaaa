# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""One blind action-reconstruction pass. Mandatory ZDR, cap $0.35, no retry."""
import base64, json, os, pathlib, time
import httpx
R=pathlib.Path(__file__).resolve().parent
model='google/gemini-4-argon'
assert not (R/'judge-response.json').exists(), 'Never pay twice for parse repair'
key=os.environ.get('OPENROUTER_API_KEY') or json.loads((pathlib.Path.home()/'.local/share/opencode/auth.json').read_text())['openrouter']['key']
catalog=httpx.get('https://openrouter.ai/api/v1/models',timeout=60).json()
entry=next(m for m in catalog['data'] if m['id']==model)
assert 'video' in entry['architecture']['input_modalities']
endpoints=httpx.get(f'https://openrouter.ai/api/v1/models/{model}/endpoints',timeout=60).json()
(R/'judge-catalog.json').write_text(json.dumps({'checked_at':time.time(),'model':entry,'endpoints':endpoints},indent=2))
prompt='''View the neutral clips A and B. You have not been given the intended story. Reconstruct what actually happened in time order, with approximate clip-local timestamps. Who moved, stopped, acted or responded? What changed by the end? Distinguish what pictures alone establish from what speech/readouts establish, and state uncertainty rather than guessing. Does any visible action contradict the heard recording? For B, identify the introduced object, demonstrated behavior and useful instruction; note if audio is absent. Do not score beauty or propose a different plot. Return JSON with clips (A and B: ordered_events, visible_only_account, heard_account, uncertainty) and comprehension_limits.'''
content=[{'type':'text','text':prompt}]
for label in ['A','B']:
    content += [{'type':'text','text':f'Clip {label}, clock starts at zero.'},{'type':'video_url','video_url':{'url':'data:video/mp4;base64,'+base64.b64encode((R/f'out/{label}/clip.mp4').read_bytes()).decode()}}]
body={'model':model,'provider':{'zdr':True,'data_collection':'deny'},'messages':[{'role':'user','content':content}],'response_format':{'type':'json_object'},'max_tokens':4000,'usage':{'include':True}}
# Conservative upper bound: 30k media input tokens, 4k output tokens. Stop before call.
pricing=entry['pricing']
estimate=30000*float(pricing['prompt'])+4000*float(pricing['completion'])
assert estimate <= .35, f'Upper estimate {estimate} exceeds authorized cap'
start=time.time()
response=httpx.post('https://openrouter.ai/api/v1/chat/completions',headers={'Authorization':f'Bearer {key}','X-Title':'Neon Warden blind memory action reconstruction'},json=body,timeout=600)
raw=response.json()
(R/'judge-response.json').write_text(json.dumps(raw,indent=2))
cost=(raw.get('usage') or {}).get('cost',0)
meta={'requested_model':model,'returned_model':raw.get('model'),'provider':raw.get('provider'),'policy':body['provider'],'estimate_upper_usd':estimate,'cost_usd':cost,'status':response.status_code,'wall_s':time.time()-start}
(R/'judge-meta.json').write_text(json.dumps(meta,indent=2))
with (R.parents[0]/'SPEND.md').open('a') as f:
    f.write(f'\n| 2026-10-29 | Memory/briefing blind action reconstruction, 2 clips | OpenRouter | {model} (mandatory ZDR/data_collection deny; returned {raw.get("provider")}) | 1 | {cost:.6f} | Previous displayed total + {cost:.6f}; see judge-meta.json |\n')
assert response.status_code==200,meta
assert cost<=.35,meta
text=raw['choices'][0]['message']['content']
(R/'judge-text.txt').write_text(text)
try: (R/'judge.json').write_text(json.dumps(json.loads(text),indent=2,ensure_ascii=False))
except json.JSONDecodeError: print('Raw answer retained, no paid parse retry')
print(json.dumps(meta))
