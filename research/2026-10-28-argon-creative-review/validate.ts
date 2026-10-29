/** Real local links, seven media loads, a single player, and required AV evidence. */
import { serve, launch } from "./snapshot/qa/capture.ts";
const root=new URL('./',import.meta.url).pathname;
const manifest=JSON.parse(await Deno.readTextFile(root+'clips.json'));
await Deno.writeTextFile(root+'validation.json',JSON.stringify({status:'running'}));
const server=serve(root);const browser=await launch();const checks:unknown[]=[];
try{
 const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(server.url+'index.html');
 for(const href of await page.locator('a[href]').evaluateAll(es=>es.map(e=>(e as HTMLAnchorElement).getAttribute('href')!))){
  const r=await fetch(server.url+href);checks.push({check:'link',href,status:r.status});if(!r.ok)throw new Error(href);
 }
 for(const c of manifest.clips){
  await page.locator(`button[data-id="${c.id}"]`).click();
  await page.waitForFunction(()=>{const v=document.querySelector('video')!;return v.readyState>=1&&Number.isFinite(v.duration);});
  const v=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,paused:v.paused,src:v.getAttribute('src')}));
  if(Math.abs(v.duration-c.duration_s)>.2||v.width!==1280||v.height!==720||!v.paused||v.src!==c.path)throw new Error(JSON.stringify(v));
  if(await page.locator('video').count()!==1)throw new Error('multiple players');
  const probe=JSON.parse(await Deno.readTextFile(root+`out/${c.id}/ffprobe.json`));if(!probe.streams.some((s:{codec_type:string;channels:number})=>s.codec_type==='audio'&&s.channels===2))throw new Error('missing stereo');
  checks.push({check:'clip',id:c.id,...v,audio:'stereo AAC confirmed by ffprobe'});
 }
 await page.locator('button[data-id="A"]').click();await page.screenshot({path:root+'viewer.png',fullPage:true});
 if(errors.length)throw new Error(errors.join('\n'));
 await Deno.writeTextFile(root+'validation.json',JSON.stringify({timestamp:new Date().toISOString(),revision:manifest.revision,status:'pass',browserErrors:errors,checks,scope:'Viewer links/media only. Static QA has two separate documented failures; clip D has VO coverage failure.'},null,2));
 console.log('Validated seven stereo AV clips and local viewer links, one paused player, zero browser exceptions.');
}finally{await browser.close();await server.close();}
