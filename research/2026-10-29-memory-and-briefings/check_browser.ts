import { launch } from "../../qa/capture.ts";
const browser=await launch();
const root=new URL('./',import.meta.url).pathname;
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
const checks:Record<string,boolean>={};
const base='http://127.0.0.1:5192/research/2026-10-29-memory-and-briefings/prototype.html';
try{
 await page.goto(base+'?mode=briefing&lang=es');
 await page.waitForFunction(()=>(globalThis as any).__memoryPrototype?.ready);
 await page.locator('#start').click();
 await page.locator('#suppress input').check();
 await page.locator('#skip').click();
 checks.skipEnds=await page.evaluate(()=>(globalThis as any).__memoryPrototype.done);
 await page.reload();await page.waitForFunction(()=>(globalThis as any).__memoryPrototype?.ready);
 checks.preferencePersisted=await page.locator('#suppress input').isChecked();
 await page.locator('#start').click();
 checks.suppressionBlocksRepeat=(await page.locator('#status').innerText())==='Presentación omitida';
 await page.goto(base+'?mode=memory&lang=zh&quiet=1');
 await page.waitForFunction(()=>(globalThis as any).__memoryPrototype?.ready);
 await page.locator('#start').click();await page.waitForTimeout(900);await page.locator('#skip').click();
 checks.memorySkipEnds=await page.evaluate(()=>(globalThis as any).__memoryPrototype.done);
 checks.noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 checks.noPageErrors=errors.length===0;
 await Deno.writeTextFile(root+'browser-checks.json',JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({checks,errors}));
 if(!Object.values(checks).every(Boolean))Deno.exitCode=1;
}finally{await context.close();await browser.close();}
