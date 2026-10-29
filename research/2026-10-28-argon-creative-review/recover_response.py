"""Recover one malformed JSON string without rewriting or re-generating model prose."""
import json,pathlib,re
R=pathlib.Path(__file__).resolve().parent
raw=(R/'response-transcript.txt').read_text();marker='"creative_notes_markdown": '
prefix,tail=raw.split(marker,1)
assert tail.startswith('"') and tail.rstrip().endswith('"\n}')
body=tail.rstrip()[1:-3]
# Model emitted literal double quotes inside this one JSON string. Escape
# only quotes preceded by an even number of backslashes, preserving all prose.
fixed=re.sub(r'(\\*)"',lambda m:m.group(1)+('\\' if len(m.group(1))%2==0 else '')+'"',body)
memo=json.loads('"'+fixed+'"')
data=json.loads(prefix+marker+'""\n}');data['creative_notes_markdown']=memo
(R/'review.json').write_text(json.dumps(data,indent=2,ensure_ascii=False))
(R/'DIRECTOR.md').write_text(memo)
(R/'parse-recovery.json').write_text(json.dumps({'raw_json_valid':False,'method':'escape only unescaped quote characters within final creative_notes_markdown JSON string; json.loads decodes original JSON escapes','second_model_call':False,'raw_retained':'response-transcript.txt','recovered_memo_characters':len(memo)},indent=2))
print('Recovered',len(memo),'characters; inventory parsed without repairs')
