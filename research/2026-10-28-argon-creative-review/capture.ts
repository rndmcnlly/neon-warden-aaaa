/** AV tap and unaccelerated, isolated capture. No game writes or state injection. */
import { serve, launch } from "./snapshot/qa/capture.ts";
import { installAv, flushAv, finishAv } from "./snapshot/qa/av.ts";
const root = new URL("./", import.meta.url).pathname;
const server = serve(root + "out/build");
const browser = await launch();
const cases = [
 {id:"A",query:"?qa=1",seconds:20,mode:"opening"},
 {id:"B",query:"?qa=1",seconds:12,mode:"hangar"},
 {id:"C",query:"?skipto=tutorial",seconds:48,mode:"tutorial"},
 {id:"D",query:"?skipto=sector1&autoplay=fight",seconds:13,mode:"fight"},
 {id:"E",query:"?skipto=sector4&autoplay=fight",seconds:15,mode:"fight"},
 {id:"F",query:"?skipto=boss&autoplay=fight",seconds:75,mode:"fight"},
 {id:"G",query:"?skipto=ending-kill",seconds:24,mode:"ending"},
];
try {for (const c of cases.filter(c=>!Deno.args.length||Deno.args.includes(c.id))) {
 const dir=root+"out/"+c.id;await Deno.mkdir(dir,{recursive:true});
 const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:dir+"/raw",size:{width:1280,height:720}}});
 if(c.query.includes("autoplay=")) await context.addInitScript(()=>{
  globalThis.requestAnimationFrame=(cb:FrameRequestCallback)=>setTimeout(()=>cb(performance.now()),17) as unknown as number;
  globalThis.cancelAnimationFrame=(id:number)=>clearTimeout(id);
 });
 const av=await installAv(context);const page=await context.newPage();av.videoEpoch=Date.now();
 const errors:string[]=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(server.url+c.query+"&seed=121&qa=1&speed=1",{waitUntil:"networkidle"});
 await page.waitForTimeout(700);
 if(c.mode==="hangar"){
  for(let i=0;i<20;i++) {if(await page.locator('[data-key="hangar"]').isVisible().catch(()=>false)) break;await page.keyboard.press("Enter");await page.waitForTimeout(350);}
  await page.locator('[data-key="hangar"]').click();await page.waitForTimeout(500);
 }
 const cutStart=(Date.now()-av.videoEpoch)/1000;const start=Date.now();const samples:unknown[]=[];const inputs:unknown[]=[];
 await page.evaluate(()=>{(globalThis as any).__creativeSeen=new WeakSet();});
 let gate=false,notice=false,title=false,sensor=false,lastInput=0;
 while(Date.now()-start<c.seconds*1000){
  const t=(Date.now()-av.videoEpoch)/1000;const elapsed=(Date.now()-start)/1000;
  const sample=await page.evaluate(()=>{const p=(globalThis as any).__nwqa;const seen=(globalThis as any).__creativeSeen;const events=(p?.events??[]).filter((e:any)=>!seen.has(e));events.forEach((e:any)=>seen.add(e));return {sim:p?.sim(),flags:p?.flags(),scene:p?.scene(),log:p?.log,events,text:document.body.innerText};});
  samples.push({...sample,t});
  const press=async(key:string,ms=220)=>{inputs.push({t,key,ms});await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);};
  if(c.mode==="opening"){
   if(!gate&&await page.locator('.nw-screen-gate').isVisible()){await press("Enter");gate=true;}
   else if(!notice&&await page.locator('.nw-screen-notice').isVisible()){await page.waitForTimeout(800);await press("Enter");notice=true;}
   else if(!title&&await page.locator('.nw-screen-title').isVisible()){await page.waitForTimeout(1600);await press("Enter");title=true;}
  }
  if(c.mode==="tutorial"){
   const f=sample.flags??{},log=sample.log??[];
   if(elapsed>25&&elapsed-lastInput>3){
    if(log.includes("line:tut_move_002"))await press("ArrowUp",500);
    else if(log.includes("line:tut_move_001"))await press("ArrowRight",500);
    else if(log.includes("line:tut_move_000"))await press("ArrowLeft",500);
    lastInput=elapsed;
   }
  }
  if(c.mode==="hangar"&&elapsed>6&&!sensor){await page.locator('[data-key="hangar-sensor"]').click({timeout:1000}).catch(()=>{});sensor=true;}
  await page.waitForTimeout(150);
 }
 await page.screenshot({path:dir+"/last.png"});await flushAv(page);const duration=(Date.now()-av.videoEpoch)/1000;const video=page.video()!;
 await context.close();const file=await video.path();const result=await finishAv(av,dir,file,duration,{});
 await Deno.writeTextFile(dir+"/ground-truth.json",JSON.stringify({revision:"ad320434d09a05f7c347311cae8aad385fbf9c82",case:c,cutStart,duration,samples,inputs,errors,av:result},null,2));
 await Deno.writeTextFile(dir+"/audio-sources.json",JSON.stringify({videoEpoch:av.videoEpoch,sources:av.sources,subs:av.subs},null,2));
 console.log(JSON.stringify({id:c.id,cutStart,duration,inputs,errors,checks:result.checks}));
}}finally{await browser.close();await server.close();}
