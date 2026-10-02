import {HttpError} from './store.js';
import type {SitesEnv} from './types.js';
import {saveGeminiConfiguration} from './vault.js';
export const COLUMNS:Record<string,string[]>={
 meals:['id','family_id','name','tag','image_url','instructions','source_url','servings'],
 ingredients:['id','meal_id','name','amount','measure','calories','protein','fat','carbs'],
 planner:['id','family_id','date','meal_id','servings_override'],
 pantry:['id','family_id','name','amount','measure'],
};
const json=(body:unknown)=>Response.json(body,{headers:{'cache-control':'no-store'}});
async function digest(bytes:BufferSource){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function handleMigration(request:Request,env:SitesEnv):Promise<Response>{
 if(!env.MIGRATION_TOKEN)throw new HttpError(404,'Not found');
 if(request.headers.get('authorization')!=='Bearer '+env.MIGRATION_TOKEN)throw new HttpError(403,'Migration access denied');
 const url=new URL(request.url);
 if(url.pathname==='/api/migration/gemini'&&request.method==='POST')return json(await saveGeminiConfiguration(env,await request.json()));
 if(url.pathname==='/api/migration/images'){
  const key=url.searchParams.get('key')??'';if(!/^migrated\/\d+-[a-f0-9]{16}\.(png|jpg|webp)$/.test(key))throw new HttpError(400,'Invalid image key');
  if(request.method==='PUT'){
   const type=request.headers.get('content-type')??'';if(!['image/png','image/jpeg','image/webp'].includes(type))throw new HttpError(400,'Invalid image type');
   const bytes=await request.arrayBuffer();if(bytes.byteLength>5_000_000)throw new HttpError(413,'Image too large');
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});return json({key,bytes:bytes.byteLength,sha256:await digest(bytes)});
  }
  if(request.method==='GET'){const image=await env.BUCKET.get(key);if(!image)throw new HttpError(404,'Image not found');return json({key,bytes:image.size,sha256:await digest(await image.arrayBuffer())});}
 }
 if(url.pathname==='/api/migration/import'&&request.method==='POST'){
  const body=await request.json() as any;const cols=COLUMNS[body.table];if(!cols||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>100)throw new HttpError(400,'Invalid import chunk');
  const statements=body.rows.map((r:any)=>{if(!r||!Number.isSafeInteger(r.id)||r.id<1||('family_id' in r&&r.family_id!=='default'))throw new HttpError(400,'Invalid row');return env.DB.prepare(`INSERT OR IGNORE INTO ${body.table}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).bind(...cols.map(c=>r[c]??null));});
  const results=await env.DB.batch(statements);return json({table:body.table,received:body.rows.length,inserted:results.reduce((n,r)=>n+r.meta.changes,0)});
 }
 if(url.pathname==='/api/migration/verify'&&request.method==='GET'){
  const tables:Record<string,unknown>={};for(const [name,cols]of Object.entries(COLUMNS)){
   const {results}=await env.DB.prepare(`SELECT ${cols.join(',')} FROM ${name} ORDER BY id`).all();
   tables[name]={count:results.length,sha256:await digest(new TextEncoder().encode(JSON.stringify(results)))};
  }
  const foreignKeys=await env.DB.prepare('PRAGMA foreign_key_check').all();return json({tables,foreignKeyViolations:foreignKeys.results.length});
 }
 throw new HttpError(404,'Not found');
}
