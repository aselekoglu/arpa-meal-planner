import type {SitesEnv} from './types.js';
import {HttpError} from './store.js';
const VAULT_OBJECT='server-secrets/gemini-v1.json';
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function vaultKey(env:SitesEnv){if(!env.GEMINI_VAULT_KEY)throw new HttpError(503,'Gemini secure configuration is unavailable');return crypto.subtle.importKey('raw',decode(env.GEMINI_VAULT_KEY),'AES-GCM',false,['encrypt','decrypt']);}
export async function saveGeminiConfiguration(env:SitesEnv,body:unknown){
 const config=body as Record<string,unknown>;if(!config||typeof config.GEMINI_API_KEY!=='string'||!config.GEMINI_API_KEY.trim()||config.GEMINI_API_KEY.length>500)throw new HttpError(400,'Missing Gemini configuration');
 const values:Record<string,string>={GEMINI_API_KEY:config.GEMINI_API_KEY.trim()};
 for(const name of ['AI_GEMINI_TEXT_MODEL','AI_GEMINI_IMAGE_MODEL'])if(typeof config[name]==='string'&&/^[a-zA-Z0-9._-]{1,100}$/.test(config[name]))values[name]=config[name];
 const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await vaultKey(env),new TextEncoder().encode(JSON.stringify(values))));
 await env.BUCKET.put(VAULT_OBJECT,JSON.stringify({version:1,iv:encode(iv),ciphertext:encode(encrypted)}),{httpMetadata:{contentType:'application/json'}});
 return {configured:true};
}
export async function withGeminiConfiguration(env:SitesEnv):Promise<SitesEnv>{
 if(env.GEMINI_API_KEY)return env;
 if(!env.GEMINI_VAULT_KEY)return env;
 const record=await env.BUCKET.get(VAULT_OBJECT);if(!record)return env;
 const payload=await record.json<{iv:string;ciphertext:string}>();
 const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv)},await vaultKey(env),decode(payload.ciphertext));
 const values=JSON.parse(new TextDecoder().decode(decoded));return {...env,GEMINI_API_KEY:values.GEMINI_API_KEY,AI_GEMINI_TEXT_MODEL:values.AI_GEMINI_TEXT_MODEL??env.AI_GEMINI_TEXT_MODEL,AI_GEMINI_IMAGE_MODEL:values.AI_GEMINI_IMAGE_MODEL??env.AI_GEMINI_IMAGE_MODEL};
}
