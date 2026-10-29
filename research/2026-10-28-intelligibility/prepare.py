"""Generate short native-resolution, normal-speed study clips and manifests."""
import json, pathlib, subprocess, statistics
ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/"out"
def ff(*args): subprocess.run(["ffmpeg","-y","-v","error",*map(str,args)],check=True)
manifest=[]
for n in "ABCDEFGH":
 d=OUT/n; g=json.loads((d/"ground-truth.json").read_text())
 offset,duration={"D":(40,27),"E":(0,9),"G":(20,58)}.get(n,(0,g["case"]["seconds"]))
 start=g["cutStart"]+offset
 ff("-ss",start,"-i",d/"reel.mp4","-t",duration,"-c:v","libx264","-crf","25","-preset","veryfast","-c:a","aac",d/"clip.mp4")
 probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(d/"clip.mp4")]))
 (d/"ffprobe.json").write_text(json.dumps(probe,indent=2))
 audible=subprocess.run(["ffmpeg","-hide_banner","-i",str(d/"clip.mp4"),"-af","volumedetect","-vn","-f","null","-"],capture_output=True,text=True,check=True).stderr
 (d/"audio-verification.txt").write_text(audible)
 assert any(s["codec_type"]=="audio" for s in probe["streams"])
 assert "mean_volume: -inf" not in audible
 ff("-ss",duration/2,"-i",d/"clip.mp4","-frames:v",1,d/"frame.jpg")
 ss=[s for s in g["samples"] if start<=s["t"]<=start+duration]
 rates=[(b["sim"]["tick"]-a["sim"]["tick"])/(b["t"]-a["t"]) for a,b in zip(ss,ss[1:]) if b["sim"]["tick"]>a["sim"]["tick"] and not a["sim"]["frozen"]]
 events=[{"at_s":round(s["t"]-start,3),"sampling_error_s":0.22,"event":e} for s in ss for e in s["events"] if e.get("tick",0)>=ss[0]["sim"]["tick"]]
 manifest.append({"id":n,"width":g["case"]["w"],"height":g["case"]["h"],"duration_s":duration,"source_start_s":start,"capture_offset_s":offset,"active_tick_rate_median":round(statistics.median(rates),2) if rates else None,"events":events,"errors":g["errors"],"checks":g["av"]["checks"]})
 if n in "CG":
  # Same sample, no captions or added annotations. Black picture is not a storyboard.
  ff("-f","lavfi","-i",f"color=c=black:s={g['case']['w']}x{g['case']['h']}:r=25","-i",d/"clip.mp4","-map","0:v","-map","1:a","-t",duration,"-c:v","libx264","-preset","veryfast","-crf","28","-c:a","copy",d/"audio.mp4")
  ff("-i",d/"clip.mp4","-an","-c:v","copy",d/"picture.mp4")
(OUT/"manifest.json").write_text(json.dumps({"revision":"85ee1114a2177cdf20faf85edeefc7821b3d6bee","clips":manifest},indent=2))
print("Validated 8 native-resolution AV clips; audio present and non-silent; 4 ablations generated.")
