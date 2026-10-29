"""Keep continuous normal-speed excerpts, native picture and actual captured sound."""
import json,pathlib,subprocess,statistics
R=pathlib.Path(__file__).resolve().parent;out=R/'out';clips=[]
cuts={'A':(0,20),'B':(0,12),'C':(18,24),'D':(0,8),'E':(0,10),'F':(38,27),'G':(0,24)}
labels={'A':'Opening identities, title and main menu','B':'Hangar (redesign pending), sensor selection','C':'Tutorial: left, right and vertical interaction','D':'Quiet sector 1, Writ disarm then flashback intrusion','E':'Denser sector 4, graze and scan, then flashback intrusion','F':'Boss: Writ pod breaks and core reveal','G':'SPOILERS: lethal ending excerpt'}
for n,(offset,duration) in cuts.items():
 d=out/n;g=json.loads((d/'ground-truth.json').read_text());start=g['cutStart']+offset
 subprocess.run(['ffmpeg','-y','-v','error','-ss',str(start),'-i',str(d/'reel.mp4'),'-t',str(duration),'-c:v','libx264','-preset','veryfast','-crf','25','-c:a','aac','-b:a','128k','-movflags','+faststart',str(d/'clip.mp4')],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(d/'clip.mp4')]))
 loud=subprocess.run(['ffmpeg','-hide_banner','-i',str(d/'clip.mp4'),'-af','ebur128=peak=true','-vn','-f','null','-'],capture_output=True,text=True,check=True).stderr
 (d/'audio-verification.txt').write_text(loud[loud.rfind('Summary:'):]);(d/'ffprobe.json').write_text(json.dumps(probe,indent=2))
 assert any(s['codec_type']=='audio' for s in probe['streams']);assert 'I:         -inf' not in loud[loud.rfind('Summary:'):]
 ss=[s for s in g['samples'] if start<=s['t']<=start+duration]
 events=[{'at_s':round(s['t']-start,3),'sampling_error_s':.22,'event':e} for s in ss for e in s['events'] if e.get('tick',0)>=ss[0]['sim']['tick']] if ss and ss[0].get('sim') else []
 rates=[(b['sim']['tick']-a['sim']['tick'])/(b['t']-a['t']) for a,b in zip(ss,ss[1:]) if a.get('sim') and b.get('sim') and b['sim']['tick']>a['sim']['tick'] and not a['sim']['frozen']]
 sources=json.loads((d/'audio-sources.json').read_text());played=[{'at_s':round((s['epoch']-sources['videoEpoch'])/1000-start,3),'duration_s':s['dur'],'url':s['url']} for s in sources['sources'] if '/vo/' in s['url'] and -12<(s['epoch']-sources['videoEpoch'])/1000-start<duration]
 clips.append({'id':n,'title':labels[n],'path':f'out/{n}/clip.mp4','duration_s':duration,'source_start_s':start,'active_ticks_per_wall_second_median':round(statistics.median(rates),2) if rates else None,'events':events,'played_voice':played,'inputs':[dict(i,at_s=round(i['t']-start,3)) for i in g['inputs'] if start<=i['t']<=start+duration],'errors':g['errors'],'checks':g['av']['checks']})
 subprocess.run(['ffmpeg','-y','-v','error','-ss',str(duration/2),'-i',str(d/'clip.mp4'),'-frames:v','1',str(d/'frame.jpg')],check=True)
(R/'clips.json').write_text(json.dumps({'revision':json.loads((R/'provenance.json').read_text())['revision'],'clips':clips},indent=2));print('Validated',len(clips),'continuous AV excerpts')
