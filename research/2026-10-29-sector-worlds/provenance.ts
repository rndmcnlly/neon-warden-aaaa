const root=new URL('./',import.meta.url).pathname;
const paths=['src/render/stage.ts','src/render/backdrop.ts','src/world/environment.ts','src/world/lore.ts','src/world/sectors.ts','music/picks.json','public/music/manifest.json','public/vo/variants/index.json'];
const hashes:Record<string,string>={};
for(const path of paths){const data=await Deno.readFile(root+'current/'+path);hashes[path]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');}
await Deno.writeTextFile(root+'provenance.json',JSON.stringify({capturedAt:new Date().toISOString(),baseline:'f636bb0',current:'56b171d',audioOverlay:'identical music picks, public manifest, public VO variant index in both arms; no vo:sync',viewport:[1366,768],phone:[390,844],hashes},null,2));
