import { build as viteBuild } from 'vite';
import { build as esbuild } from 'esbuild';
import { readFileSync,writeFileSync,readdirSync,statSync,mkdirSync,rmSync,copyFileSync } from 'node:fs';
import path from 'node:path';
rmSync('dist',{recursive:true,force:true});
await viteBuild({publicDir:false,build:{outDir:'dist/client'}});
copyFileSync('public/arpa-icon.svg','dist/client/arpa-icon.svg');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const assets={};function walk(dir){for(const name of readdirSync(dir)){const p=path.join(dir,name);if(statSync(p).isDirectory())walk(p);else assets['/'+path.relative('dist/client',p)]={body:readFileSync(p).toString('base64'),type:types[path.extname(p)]??'application/octet-stream'};}}
walk('dist/client');mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
await esbuild({entryPoints:['worker/index.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,define:{__ARPA_ASSETS__:JSON.stringify(assets)}});
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
writeFileSync('dist/server/package.json',JSON.stringify({type:'module'}));
console.log(JSON.stringify({workerBytes:statSync('dist/server/index.js').size,assets:Object.keys(assets).length}));
