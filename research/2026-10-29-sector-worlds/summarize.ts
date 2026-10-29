import { sectorBlocks, WORLD_BUDGET } from '../../src/world/sectors.ts';
const root=new URL('./',import.meta.url).pathname;
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
const range=(a:number[])=>({mean:mean(a),min:Math.min(...a),max:Math.max(...a)});
const clips=[];
for(const arm of ['baseline','current'])for(const sector of [1,4]){
const r=JSON.parse(await Deno.readTextFile(root+`out/${arm}-s${sector}/result.json`));
const samples=r.samples,first=samples[0],last=samples.at(-1);
clips.push({arm,sector,errors:r.errors,simTicksPerSecond:(last.sim.tick-first.sim.tick)/((last.t-first.t)/1000),worldUpdateMs:arm==='current'?range(samples.map((s:any)=>s.world.updateMs)):null,renderCpuMs:arm==='current'?range(samples.map((s:any)=>s.world.render.renderMs)):null,drawCalls:arm==='current'?range(samples.map((s:any)=>s.world.render.drawCalls)):null,av:r.av.checks});
}
const stills=JSON.parse(await Deno.readTextFile(root+'out/stills.json'));
const result={hardware:'Development MacBook Pro M3 Max, headless Chromium with recording; not Chromebook measurements',budget:WORLD_BUDGET,blocks:[1,2,3,4,5].map(s=>({sector:s,blocks:sectorBlocks(s).length})),clips,stillsVerified:stills.every((s:any)=>s.sector===s.world.sector&&s.errors.length===0),stillsCount:stills.length,lowPortraitCpuMs:range(stills.filter((s:any)=>s.narrow).map((s:any)=>s.world.render.renderMs))};
await Deno.writeTextFile(root+'performance.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
