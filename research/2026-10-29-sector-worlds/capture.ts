/** Isolated actual-game AV, no state injection. Run from repository root. */
import { serve, launch } from "../../qa/capture.ts";
import { installAv, flushAv, finishAv } from "../../qa/av.ts";
const root = new URL("./", import.meta.url).pathname;
const browser = await launch();
const arms = Deno.args.length ? Deno.args : ["baseline", "current"];
try { for (const arm of arms) {
  const server = serve(root + arm + "/out/build");
  try { for (const sector of Deno.env.get("STILLS_ONLY") ? [] : [1, 4]) {
    const dir = `${root}out/${arm}-s${sector}`;
    await Deno.mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport: {width:1366,height:768}, recordVideo: {dir: dir+"/raw",size:{width:1366,height:768}} });
    await context.addInitScript(() => {
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 17) as unknown as number;
      globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
    });
    const av = await installAv(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    av.videoEpoch = Date.now();
    await page.goto(`${server.url}?skipto=sector${sector}&autoplay=pacifist&speed=1&seed=121&qa=1&v.music.gameplay=cand1`, {waitUntil:"networkidle"});
    const samples: unknown[] = [];
    for (let i = 0; i < 40; i++) {
      samples.push(await page.evaluate(() => {
        const w = globalThis as any;
        return { t: performance.now(), sim: w.__nwqa?.sim(), world: w.__nwWorld?.stats(), scene: w.__nwqa?.scene() };
      }));
      if (i === 4 || i === 24) await page.screenshot({path:`${dir}/${i===4?"quiet":"dense"}.jpg`,quality:75});
      await page.waitForTimeout(300);
    }
    // Let the last actually started voice finish before flushing the tap.
    for(let tail=0;tail<20;tail++) {
      const lastEnd=Math.max(0,...av.sources.filter(s=>s.url.includes('/vo/')).map(s=>s.epoch+s.dur*1000));
      if(Date.now()>lastEnd+250)break;
      await page.waitForTimeout(500);
    }
    await flushAv(page);
    const duration = (Date.now()-av.videoEpoch)/1000;
    const video = page.video()!;
    await context.close();
    const result = await finishAv(av, dir, await video.path(), duration, {});
    await Deno.writeTextFile(dir+"/result.json",JSON.stringify({arm,sector,viewport:[1366,768],samples,errors,av:result,sources:av.sources},null,2));
    console.log(arm,sector,errors,result.checks);
  }
  if (arm === "current") {
    const results = [];
    for (const lang of ["es", "zh"]) for (const narrow of [false, true]) for (let sector=1;sector<=5;sector++) {
      const context = await browser.newContext({viewport:narrow?{width:390,height:844}:{width:1366,height:768}});
      await context.addInitScript(({lang,narrow}) => localStorage.setItem("neon-warden.settings",JSON.stringify({version:1,settings:{textLang:lang,display:{preset:narrow?"low":"high"},accessibility:{reduceMotion:narrow}}})),{lang,narrow});
      const page = await context.newPage();
      const errors:string[]=[];page.on("pageerror",e=>errors.push(String(e)));
      await page.goto(`${server.url}?skipto=sector${sector}&autoplay=pacifist&speed=1&seed=121&qa=1`,{waitUntil:"networkidle"});
      await page.waitForTimeout(1600);
      await page.screenshot({path:`${root}out/s${sector}-${lang}-${narrow?"portrait-low-reduced":"desktop"}.jpg`,quality:70});
      const world = await page.evaluate(()=> (globalThis as any).__nwWorld?.stats());
      results.push({lang,narrow,sector,world,errors});
      await context.close();
    }
    await Deno.writeTextFile(root+"out/stills.json",JSON.stringify(results,null,2));
  }
  } finally { await server.close(); }
} } finally { await browser.close(); }
