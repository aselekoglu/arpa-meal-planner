import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveGeminiConfiguration,withGeminiConfiguration} from './vault.js';
import type {SitesEnv} from './types.js';
test('Gemini key persists only as authenticated ciphertext and hydrates only on the server',async()=>{
 let saved='';const env={GEMINI_VAULT_KEY:btoa('x'.repeat(32)),BUCKET:{put:async(_:string,value:string)=>{saved=value;},get:async()=>({json:async()=>JSON.parse(saved)})}} as unknown as SitesEnv;
 const result=await saveGeminiConfiguration(env,{GEMINI_API_KEY:'TEST_SECRET',AI_GEMINI_TEXT_MODEL:'test-model'});
 assert.deepEqual(result,{configured:true});assert.equal(saved.includes('TEST_SECRET'),false);
 const configured=await withGeminiConfiguration(env);assert.equal(configured.GEMINI_API_KEY,'TEST_SECRET');assert.equal(configured.AI_GEMINI_TEXT_MODEL,'test-model');
 const record=JSON.parse(saved);record.ciphertext='AAAA'+record.ciphertext.slice(4);saved=JSON.stringify(record);
 await assert.rejects(withGeminiConfiguration(env));
});
