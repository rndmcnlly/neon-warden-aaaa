/** Local-only traversal: generated report controls and actual video playback. */
import { serve, launch } from "./snapshot/qa/capture.ts";
const root=new URL("./",import.meta.url).pathname;
const server=serve(root);
const browser=await launch();
const errors:string[]=[];
const checks:string[]=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(server.url+"index.html");
 await page.waitForFunction(()=>document.querySelector<HTMLVideoElement>("video")!.readyState>=1);
 if(await page.locator("#notes").isVisible())throw new Error("Evidence leaked before reveal");
 checks.push("Evidence initially hidden");
 await page.locator("#reveal").click();
 await page.locator("#evidence button").first().click();
 await page.waitForTimeout(1600);
 const playing=await page.locator("video").evaluate((v:HTMLVideoElement)=>({time:v.currentTime,paused:v.paused,rate:v.playbackRate,width:v.videoWidth,height:v.videoHeight}));
 if(playing.paused||playing.time<=0||playing.rate!==1||playing.width!==1280)throw new Error(JSON.stringify(playing));
 checks.push("Timestamp button plays native 1280×720 source at 1×");
 await page.locator("#sequence").selectOption("C");
 await page.locator("#mode").selectOption("audio");
 await page.waitForFunction(()=>document.querySelector<HTMLVideoElement>("video")!.readyState>=1);
 if(!await page.locator("video").evaluate((v:HTMLVideoElement)=>v.currentSrc.endsWith("C/audio.mp4")))throw new Error("Ablation selection failed");
 checks.push("Audio-only ablation loads separately");
 await page.locator("#sequence").selectOption("H");
 await page.waitForFunction(()=>document.querySelector<HTMLVideoElement>("video")!.videoWidth===390);
 if(await page.locator("#mode").inputValue()!=="clip")throw new Error("Unsupported ablation did not reset");
 await page.locator("#reveal").click();
 checks.push("Narrow source 390×844 retained; unsupported ablation resets");
 await page.screenshot({path:root+"out/report-desktop.png",fullPage:false});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error("Report horizontal overflow");
 await page.screenshot({path:root+"out/report-phone.png",fullPage:false});
 checks.push("Report itself fits 390px viewport without page overflow");
 if(errors.length)throw new Error(errors.join("\n"));
 await Deno.writeTextFile(root+"out/report-traversal.json",JSON.stringify({status:"pass",checks,errors,playing},null,2));
 console.log(checks.join("\n"));
} finally {await browser.close();await server.close();}
