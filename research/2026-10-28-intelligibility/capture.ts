/** Read-only capture against a git-archive snapshot. No simulation acceleration. */
import { serve, launch } from "./snapshot/qa/capture.ts";
import { installAv, flushAv, finishAv } from "./snapshot/qa/av.ts";
const root = new URL("./", import.meta.url).pathname;
const server = serve(root + "out/build");
const browser = await launch();
const cases = [
 {id:"A", query:"?skipto=sector1&autoplay=fight", w:1280,h:720,seconds:24, mode:"quiet"},
 {id:"B", query:"?skipto=sector4&autoplay=fight", w:1366,h:768,seconds:34, mode:"dense"},
 {id:"C", query:"?skipto=sector2&autoplay=fight", w:1280,h:720,seconds:32, mode:"scan"},
 {id:"D", query:"?skipto=boss&autoplay=pacifist", w:1366,h:768,seconds:90, mode:"pods"},
 {id:"E", query:"?skipto=sector3", w:1280,h:720,seconds:38, mode:"hit"},
 {id:"F", query:"?qa=1", w:1280,h:720,seconds:18, mode:"hangar"},
 {id:"G", query:"?skipto=tutorial", w:1366,h:768,seconds:110, mode:"tutorial"},
 {id:"H", query:"?qa=1", w:390,h:844,seconds:16, mode:"hangar"},
];
try {for (const c of cases.filter(c => !Deno.args.length || Deno.args.includes(c.id))) {
 const dir = root+"out/"+c.id; await Deno.mkdir(dir,{recursive:true});
 const context = await browser.newContext({viewport:{width:c.w,height:c.h},recordVideo:{dir,size:{width:c.w,height:c.h}}});
 // Auto-play steps once per rendered frame, unlike the human pilot's dt
 // accumulator. Pace it to 60 Hz rather than the host's uncapped Metal rate.
 if(c.query.includes("autoplay=")) await context.addInitScript(()=>{
   globalThis.requestAnimationFrame=(callback:FrameRequestCallback)=>setTimeout(()=>{
     callback(performance.now());
   },17) as unknown as number;
   globalThis.cancelAnimationFrame=(id:number)=>clearTimeout(id);
 });
 const av = await installAv(context);
 const page = await context.newPage(); av.videoEpoch = Date.now();
 const errors:string[]=[]; page.on("pageerror", e => errors.push(String(e)));
 await page.goto(server.url+c.query+(c.query.includes("qa=")?"&":"&qa=1&")+"seed=121&speed=1",{waitUntil:"networkidle"});
 await page.waitForTimeout(1200);
 if(errors.length) throw new Error(errors.join("\n"));
 if(c.mode==="hangar") {
   for(let i=0;i<18;i++) { if(await page.locator('[data-key="hangar"]').isVisible().catch(()=>false)) break; await page.keyboard.press("Enter"); await page.waitForTimeout(400); }
   await page.locator('[data-key="hangar"]').click({timeout:5000}).catch(()=>{});
   await page.waitForTimeout(1000);
 }
 const cutStart=(Date.now()-av.videoEpoch)/1000;
 const start=Date.now(); const samples:unknown[]=[]; const inputs:unknown[]=[]; let tutorialStep=0; let lastInput=0;let heldFocus=false;let releaseFocusAt=Infinity;
 await page.evaluate(()=>{(globalThis as any).__studySeen=new WeakSet();});
 while(Date.now()-start < c.seconds*1000) {
  const t=(Date.now()-av.videoEpoch)/1000;
  const sample=await page.evaluate(()=>{ const p=(globalThis as any).__nwqa; const seen=(globalThis as any).__studySeen; const events=(p?.events??[]).filter((e:any)=>!seen.has(e)); events.forEach((e:any)=>seen.add(e));
   return {epoch:Date.now(),sim:p?.sim(),flags:p?.flags(),scene:p?.scene(),log:p?.log,events,text:document.body.innerText,
    textBoxes:[...document.querySelectorAll(".nw-hud,.nw-intel-tag,.nw-subtitle,.nw-radio,.nw-toast,.nw-banner")].filter((e:any)=>e.getBoundingClientRect().width).map((e:any)=>({class:e.className,text:e.innerText,rect:e.getBoundingClientRect().toJSON(),font:getComputedStyle(e).fontSize}))}; });
  samples.push({...sample,t});
  if(c.mode==="tutorial") {
    const flags=(sample as any).flags??{}; const log=(sample as any).log??[];
    const press=async(key:string,ms=200)=>{inputs.push({t,key,ms});await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);lastInput=Date.now();};
    if(log.includes("line:tut_hitbox_001") && !heldFocus && !log.includes("line:tut_focus_001")) {await page.keyboard.down("ShiftLeft");inputs.push({t,key:"ShiftLeft down before focus lesson"});heldFocus=true;}
    if(log.includes("line:tut_focus_001") && releaseFocusAt===Infinity) releaseFocusAt=Date.now()+12000;
    if(heldFocus && Date.now()>releaseFocusAt) {await page.keyboard.up("ShiftLeft");inputs.push({t,key:"ShiftLeft up"});heldFocus=false;lastInput=Date.now();releaseFocusAt=Infinity;}
    if(log.includes("line:tut_move_000") && !flags["tut.movedLeft"] && Date.now()-start>24000 && Date.now()-lastInput>2600) {
      if(tutorialStep===0){await press("ArrowRight");tutorialStep=1;} else {await press("ArrowLeft");tutorialStep=2;}
    } else if(log.includes("line:tut_move_001") && !flags["tut.movedRight"] && Date.now()-lastInput>1800) await press("ArrowRight");
    else if(log.includes("line:tut_move_002") && !flags["tut.movedVertical"] && Date.now()-lastInput>1800) await press("ArrowUp");
    else if(log.includes("line:tut_focus_001") && !flags["tut.focused"] && !heldFocus && Date.now()-lastInput>1800) await press("ShiftLeft",700);
  }
  if(c.mode==="hangar" && Date.now()-start>8500 && Date.now()-start<9000) await page.locator('[data-key="hangar-sensor"]').click({timeout:500}).catch(()=>{});
  await page.waitForTimeout(180);
 }
 await page.screenshot({path:dir+"/last.png"});
 await flushAv(page); const duration=(Date.now()-av.videoEpoch)/1000; const video=page.video()!;
 await context.close(); const file=await video.path();
 const result=await finishAv(av,dir,file,duration,{});
 await Deno.writeTextFile(dir+"/ground-truth.json",JSON.stringify({revision:"85ee1114a2177cdf20faf85edeefc7821b3d6bee",case:c,cutStart,duration,samples,inputs,errors,av:result},null,2));
 await Deno.writeTextFile(dir+"/audio-sources.json",JSON.stringify({videoEpoch:av.videoEpoch,sources:av.sources,subs:av.subs},null,2));
 const trim=await new Deno.Command("ffmpeg",{args:["-y","-v","error","-ss",String(cutStart),"-i",dir+"/reel.mp4","-t",String(c.seconds),"-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac",dir+"/clip.mp4"]}).output();
 if(!trim.success) throw new Error(new TextDecoder().decode(trim.stderr));
 console.log(JSON.stringify({id:c.id,duration,cutStart,checks:result.checks,errors}));
}} finally {await browser.close();await server.close();}
