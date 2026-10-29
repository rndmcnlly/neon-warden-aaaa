# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""Native-resolution AV adaptation of omni-judges/judge.py. ZDR mandatory.

First-pass requests include only neutral clip labels, the role and task. No
script, probe, ground truth, production notes or mechanic names are supplied.
"""
import base64, json, pathlib, os, sys, time
import httpx

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"
MODEL = "google/gemini-4-argon"  # Must occur in saved live catalog before use.
ROLES = {
 "novice": "You are a novice player trying to survive and understand the next action.",
 "information": "You are an information-design and accessibility critic studying divided attention, not visual beauty.",
 "causality": "You are an audiovisual causality critic: distinguish observable causes from plausible guesses.",
 "audio": "You are a first-time listener. These are audio-only ablations with a blank picture. Do not infer unseen UI or action.",
 "picture": "You are a first-time viewer. These are picture-only ablations with no audio. Do not invent speech or sound.",
}

def main():
 role = sys.argv[1]
 catalog = json.loads((OUT / "catalog.json").read_text())
 assert any(m["id"] == MODEL for m in catalog), "Model must be live"
 zdr = (OUT / "zdr-catalog.json").read_text()
 assert MODEL in zdr, "No catalog evidence for ZDR endpoint"
 previous = list((OUT / "judgments").glob("*.json")) if (OUT / "judgments").exists() else []
 spent = sum((json.loads(p.read_text()).get("usage") or {}).get("cost", 0) or 0 for p in previous if not p.name.endswith("-account.json"))
 assert spent < 1.30, "Reserve $0.70 for one request; $2 total ceiling"
 key = os.environ.get("OPENROUTER_API_KEY") or json.loads((pathlib.Path.home()/".local/share/opencode/auth.json").read_text())["openrouter"]["key"]
 rubric = """Watch at native frame dimensions and normal playback speed, one first pass per sequence. No replay or slow motion. This is an intelligibility study, not a beauty or polish score. You have no controller input log. Do not assume a specific game mechanic.
Return JSON {role, clips:[{id, ordered_observations:[{start_s,end_s,account,threat_origin,action_response,goal_resource_change,uncertainty}], heard:[{at_s,words,source,confidence}], readable_text:[{at_s,text}], simultaneous_information:[{at_s,channels,competition,consequence}], ratings:{detection,cause_attribution,text_legibility,audio_source_identification,recoverability}, rating_evidence, uncertainties, minimal_fix}], cross_clip_summary}.
Ratings are 1 (cannot reliably identify) to 5 (clear on first encounter), null if not applicable. Audit voices, HUD animations, projectiles, subtitles, radio, banners and toasts only if actually present. Name competing channels and timestamps, not arbitrary highlight percentages. Words in 'heard' must be actually audible, NOT copied from readable subtitles. Put uncertain fragments in uncertainties. Do not fill inaudible speech by reading. Say when the source of a sound or the cause of a response cannot be determined. Separate text actually readable at presentation scale from text guessed from context. Identify what changed, where threats came from, and whether a mistake could be recovered from. Do not pretend you were interacting. Limit output to about 6000 tokens, with explicit evidence rather than generic advice."""
 content = [{"type":"text", "text":ROLES[role]+"\n"+rubric}]
 names = list("ABCDEFGH") if role not in ("audio", "picture") else ["C", "G"]
 for n in names:
  path = OUT/n/(f"{role}.mp4" if role in ("audio", "picture") else "clip.mp4")
  content += [{"type":"text", "text":f"Sequence {n}. Timestamps restart at zero."}, {"type":"video_url", "video_url":{"url":"data:video/mp4;base64,"+base64.b64encode(path.read_bytes()).decode()}}]
 content[0]["text"] += "\nIMPORTANT LENGTH BOUND: Cover ALL supplied sequences. Per sequence give at most 2 ordered observations, 3 heard fragments, 3 readable text samples and 2 simultaneous-information entries. At most 300 words per sequence. Keep rating_evidence to 2 sentences."
 body = {"model":MODEL,"provider":{"zdr":True,"data_collection":"deny"},"messages":[{"role":"user","content":content}],"response_format":{"type":"json_object"},"max_tokens":18000,"usage":{"include":True},"temperature":0.2}
 folder = OUT/"judgments"; folder.mkdir(exist_ok=True)
 if (folder/f"{role}.json").exists():
  (folder/f"{role}.json").rename(folder/f"{role}-truncated.json")
 (folder/f"{role}-prompt.txt").write_text(content[0]["text"])
 t=time.time()
 response=httpx.post("https://openrouter.ai/api/v1/chat/completions",headers={"Authorization":"Bearer "+key,"X-Title":"neon-warden blind intelligibility study"},json=body,timeout=600)
 result=response.json()
 result["wall_s"]=round(time.time()-t,2)
 (folder/f"{role}.json").write_text(json.dumps(result,indent=2))
 cost=(result.get("usage") or {}).get("cost")
 # Append immediately, including failures with a zero/unknown distinction.
 with (ROOT.parent/"SPEND.md").open("a") as ledger:
  ledger.write(f"\n| 2026-10-28 | Q intelligibility {role} | OpenRouter {MODEL}, ZDR/data_collection deny, native-resolution blind pass | ${cost if cost is not None else 'unknown (API error or unreported)'} | research/2026-10-28-intelligibility/out/judgments/{role}.json |\n")
 print(json.dumps({"role":role,"status":response.status_code,"provider":result.get("provider"),"usage":result.get("usage"),"error":result.get("error"),"wall_s":result["wall_s"]}))
 if response.status_code!=200 or "choices" not in result: sys.exit(1)
 text=result["choices"][0]["message"].get("content") or ""
 (folder/f"{role}-account.json").write_text(json.dumps(json.loads(text),indent=2,ensure_ascii=False))

if __name__=="__main__": main()
