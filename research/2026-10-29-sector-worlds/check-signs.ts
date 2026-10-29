import { serve, launch } from '../../qa/capture.ts';
const root=new URL('./',import.meta.url).pathname;
const server=serve(root+'out/harness'),browser=await launch();
const results=[];
try {for(const lang of ['en','es','zh'])for(const narrow of [false,true])for(let sector=1;sector<=5;sector++){
const page=await browser.newPage({viewport:narrow?{width:390,height:844}:{width:1366,height:768}});
await page.goto(server.url+`world-harness.html?lang=${lang}&sector=${sector}`,{waitUntil:'networkidle'});
const result=await page.evaluate(()=> (window as any).result);
if(result.signVisible===narrow)throw Error('sign visibility regression '+JSON.stringify(result));
results.push({lang,narrow,sector,...result});
await page.screenshot({path:root+`out/sign-s${sector}-${lang}-${narrow?'portrait':'desktop'}.jpg`,quality:75});
await page.close();
}
for(const flash of [0,1]){
const page=await browser.newPage({viewport:{width:1366,height:768}});
await page.goto(server.url+`world-harness.html?lang=en&sector=3&flash=${flash}`,{waitUntil:'networkidle'});
await page.screenshot({path:root+`out/pbr-spill-${flash}.png`});await page.close();
}
}finally{await browser.close();await server.close();}
await Deno.writeTextFile(root+'out/sign-checks.json',JSON.stringify(results,null,2));
