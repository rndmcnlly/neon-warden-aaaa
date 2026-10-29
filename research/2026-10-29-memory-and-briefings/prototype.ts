/** Standalone proof only. Production must borrow the stage renderer, not this RAF. */
import * as THREE from "three";
import { ModelRegistry } from "../../src/render/models.ts";
import { MemoryScene, MEMORY_READOUT, type MemoryLine } from "../../src/presentation/memoryScene.ts";
import { BriefingGate, EnemyBriefing, ENEMY_INTEL } from "../../src/presentation/enemyBriefing.ts";
const q = new URLSearchParams(location.search);
const lang = (q.get("lang") ?? "en") as "en" | "es" | "zh";
const mode = q.get("mode") ?? "memory";
const options = {reduceMotion:q.has("quiet"),reduceFlashing:true};
const gate = new BriefingGate();
gate.suppressed = localStorage.getItem("nw.prototype.briefingsSuppressed")==="true";
const $ = <T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const registry = new ModelRegistry("/models/");
await registry.preloadAll();
const memory = new MemoryScene(registry);
const briefing = new EnemyBriefing(registry,"dart");
const view = mode === "memory" ? memory : briefing;
const renderer = new THREE.WebGLRenderer({canvas:$("canvas"),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const resize=()=>{renderer.setSize(innerWidth,innerHeight);view.resize(innerWidth,innerHeight)};
addEventListener("resize",resize);resize();
const cues=await(await fetch("/vo/cues.json")).json();
const music=await(await fetch("/music/manifest.json")).json();
const ids:MemoryLine[]=["flash_rec_001","flash_rec_002","flash_rec_003","flash_rec_004","flash_rec_005","flash_rec_006"];
let cursor=0.8;
const schedule=ids.map((id,i)=>{const take=cues.lines[id].langs[lang];const row={id,take,start:cursor};cursor+=take.duration+([0.4,0,0.3,0.9,0,1.5][i]);return row});
const ac = new AudioContext();
const buffers = new Map<string,AudioBuffer>();
for(const row of schedule) buffers.set(row.id,await ac.decodeAudioData(await(await fetch("/vo/"+row.take.file)).arrayBuffer()));
const musicBuffer=await ac.decodeAudioData(await(await fetch("/"+music.cues.flashback.src)).arrayBuffer());
let origin:number|null=null, done=false;
const sources:AudioBufferSourceNode[]=[];
const labels = {en:["Skip","Don’t show again"],es:["Omitir","No volver a mostrar"],zh:["跳过","不再显示"]}[lang];
$("#skip").textContent=labels[0];
$("#suppress").lastChild!.textContent=" "+labels[1];
$("#source").textContent={en:"FLIGHT RECORDER",es:"REGISTRADOR DE VUELO",zh:"飞行记录仪"}[lang];
const suppressInput=$("#suppress input") as HTMLInputElement;
suppressInput.checked=gate.suppressed;
suppressInput.onchange=()=>{gate.suppressed=suppressInput.checked;localStorage.setItem("nw.prototype.briefingsSuppressed",String(gate.suppressed));};
const stop=()=>{done=true;sources.forEach(s=>{try{s.stop()}catch{}});$("#status").textContent="Prototype ended · simulation was never stepped";$("#skip").hidden=true;$("#sub").hidden=true;$("#intel").hidden=true;$("#speaker").hidden=true};
$("#skip").onclick=stop;
$("#start").onclick=async()=>{
 if(mode!=="memory"&&!gate.open(2,true)){stop();$("#status").textContent={en:"Introduction suppressed",es:"Presentación omitida",zh:"已关闭介绍"}[lang];return;}
 await ac.resume();origin=ac.currentTime+0.1;done=false;$("#start").hidden=true;$("#skip").hidden=false;
 if(mode==="memory"){
  const gain=ac.createGain();gain.gain.value=0.7;gain.connect(ac.destination);
  for(const row of schedule){const s=ac.createBufferSource();s.buffer=buffers.get(row.id)!;s.connect(gain);s.start(origin+row.start);sources.push(s)}
  const s=ac.createBufferSource();s.buffer=musicBuffer;s.loop=true;const g=ac.createGain();g.gain.value=0.045;g.connect(ac.destination);s.connect(g);s.start(origin);s.stop(origin+cursor-1.5);sources.push(s);
 }else{ $("#suppress").hidden=false;$("#intel").hidden=false;$("h1").textContent=ENEMY_INTEL.dart[lang][0];$("#intel p").textContent=ENEMY_INTEL.dart[lang][1];$("#source").textContent={en:"SCANNER · NEXT SECTOR: 2",es:"ESCÁNER · PRÓXIMO SECTOR: 2",zh:"扫描仪 · 下一区域：2"}[lang]; }
};
let frames=0, first=0;
function frame(){
 const t=origin===null?0:Math.max(0,ac.currentTime-origin);
 if(origin!==null&&!done){frames++;if(!first)first=performance.now();$("#clock").textContent=t.toFixed(3);
  if(mode==="memory"){
   const row=[...schedule].reverse().find(r=>t>=r.start)??schedule[0];
   memory.update(row.id,Math.max(0,t-row.start),row.take.duration,options);
   $("#readout").textContent=MEMORY_READOUT[lang][memory.shot];
   $("#speaker").hidden=memory.speaker!=="warden";
   $("#speaker").textContent={en:"WARDEN · OPEN CHANNEL",es:"GUARDIÁN · CANAL ABIERTO",zh:"典狱长 · 通信中"}[lang];
   const anchor=new THREE.Vector3(4.5,2,-6).project(memory.camera);
   $("#speaker").style.left=Math.max(16,Math.min(innerWidth-260,(anchor.x+1)*innerWidth/2))+"px";
   $("#speaker").style.top=Math.max(110,Math.min(innerHeight-230,(-anchor.y+1)*innerHeight/2))+"px";
   const speaking=t>=row.start&&t<row.start+row.take.duration;$("#sub").hidden=!speaking;
   if(speaking){const local=t-row.start;const word=row.take.words?.find((w:any)=>local>=w.startS&&local<w.endS);$("#sub").textContent="";if(word){$("#sub").append(row.take.text.slice(0,word.charStart));const span=document.createElement("span");span.id="word";span.textContent=row.take.text.slice(word.charStart,word.charEnd);$("#sub").append(span,row.take.text.slice(word.charEnd))}else $("#sub").textContent=row.take.text;}
   if(t>=cursor)stop();
  }else if(briefing.update(t,options))stop();
 }else if(origin===null){if(mode==="memory")memory.update(ids[0],0,7,options);else briefing.update(0,options)}
 renderer.render(view.scene,view.camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(globalThis as any).__memoryPrototype={ready:true,schedule,duration:mode==="memory"?cursor:6,models:registry.report(),get done(){return done},get pacing(){return {frames,wallS:(performance.now()-first)/1000}},skip:stop};
addEventListener("pagehide",()=>{stop();memory.dispose();briefing.dispose();renderer.dispose();ac.close()},{once:true});
