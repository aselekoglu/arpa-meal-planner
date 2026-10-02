import {KitchenStore,HttpError} from './store.js';
import {handleAi} from './ai.js';
import {handleMcp} from './mcp.js';
import {assetResponse} from './assets.js';
import type {SitesEnv} from './types.js';
import {withGeminiConfiguration} from './vault.js';

const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
function requireUser(request:Request,env:SitesEnv){
 if(!request.headers.get('oai-authenticated-user-id'))throw new HttpError(401,'Sign in with ChatGPT to access your kitchen.');
 const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(!env.ARPA_OWNER_EMAIL||email!==env.ARPA_OWNER_EMAIL.toLowerCase())throw new HttpError(403,'This kitchen is private.');
}
async function body(request:Request){if(!(request.headers.get('content-type')??'').includes('application/json'))throw new HttpError(415,'Expected application/json');const raw=await request.text();if(raw.length>1_000_000)throw new HttpError(413,'Request too large');try{return JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON');}}
async function api(request:Request,env:SitesEnv,store:KitchenStore){
 const {pathname:path}=new URL(request.url);const method=request.method;let match;
 if(path.startsWith('/api/ai/'))return await handleAi(request,await withGeminiConfiguration(env),store)??json({error:'Not found'},404);
 if(path==='/api/session')return json({userId:request.headers.get('oai-authenticated-user-id'),email:request.headers.get('oai-authenticated-user-email')});
 if(path.startsWith('/api/images/')&&(method==='GET'||method==='HEAD')){
  const key=decodeURIComponent(path.slice('/api/images/'.length));if(!/^(generated|migrated)\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(key))throw new HttpError(400,'Invalid image path');
  const image=await env.BUCKET.get(key);if(!image)throw new HttpError(404,'Image not found');return new Response(method==='HEAD'?null:image.body,{headers:{'content-type':image.httpMetadata?.contentType??'image/png','cache-control':'private,max-age=86400','etag':image.httpEtag,'x-content-type-options':'nosniff'}});
 }
 if(path==='/api/meals'){if(method==='GET')return json(await store.listMeals());if(method==='POST')return json(await store.createMeal(await body(request)));}
 if((match=path.match(/^\/api\/meals\/(\d+)$/))){const id=Number(match[1]);if(method==='PUT')return json(await store.updateMeal(id,await body(request)));if(method==='DELETE')return json(await store.deleteMeal(id));}
 if(path==='/api/planner'){if(method==='GET')return json(await store.listPlanner());if(method==='POST')return json(await store.addPlanner(await body(request)));}
 if((match=path.match(/^\/api\/planner\/(\d+)(?:\/(date|servings))?$/))){const id=Number(match[1]);if(method==='DELETE'&&!match[2])return json(await store.deletePlanner(id));if(method==='PATCH'&&match[2]){const b=await body(request);return json(await(match[2]==='date'?store.movePlanner(id,b.date):store.setPlannerServings(id,b.servings_override)));}}
 if(path==='/api/pantry'){if(method==='GET')return json(await store.listPantry());if(method==='POST')return json(await store.addPantry(await body(request)));}
 if((match=path.match(/^\/api\/pantry\/(\d+)$/))&&method==='DELETE')return json(await store.deletePantry(Number(match[1])));
 if(path==='/api/ingredients/merge-names'&&method==='POST')return json(await store.mergeIngredientNames(await body(request)));
 return json({error:'Not found'},404);
}
export default {async fetch(request:Request,env:SitesEnv):Promise<Response>{
 try{
  const url=new URL(request.url);const path=url.pathname;
  if(path==='/healthz')return json({ok:true,service:'arpa-meal-planner',version:'1.0.0'});
  // Snapshot transfer is complete. Keep this closed even if an old deployment
  // secret survives a hosting environment update.
  if(path.startsWith('/api/migration/'))throw new HttpError(404,'Not found');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)throw new HttpError(403,'Cross-origin write denied');
  }
  if(path==='/mcp'){
   let method:string|undefined;try{method=(await request.clone().json() as any).method;}catch{}
   if(method==='tools/call')requireUser(request,env);
   return await handleMcp(request,method==='tools/call'?await withGeminiConfiguration(env):env,new KitchenStore(env.DB));
  }
  if(path.startsWith('/api/')){requireUser(request,env);return await api(request,env,new KitchenStore(env.DB));}
  if(request.method==='GET'||request.method==='HEAD')return assetResponse(request)??json({error:'Not found'},404);
  return json({error:'Method not allowed'},405);
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Arpa request failed',{path:new URL(request.url).pathname,errorType:error instanceof Error?error.name:'unknown'});return json({error:'The kitchen is temporarily unavailable. Please try again.'},500);}
}};
