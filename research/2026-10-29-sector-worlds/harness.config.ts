export default { root: new URL('./',import.meta.url).pathname, build: {outDir:'out/harness',rollupOptions:{input:new URL('./world-harness.html',import.meta.url).pathname}},publicDir:false };
