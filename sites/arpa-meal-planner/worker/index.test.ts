import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import type {SitesEnv} from './types.js';

test('private APIs deny missing user and wrong owner before database access',async()=>{
 const env={ARPA_OWNER_EMAIL:'owner@example.com'} as SitesEnv;
 assert.equal((await worker.fetch(new Request('https://arpa.test/api/meals'),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://arpa.test/api/meals',{headers:{'oai-authenticated-user-id':'user','oai-authenticated-user-email':'other@example.com'}}),env)).status,403);
});
test('service credential cannot manufacture user identity for MCP calls',async()=>{
 const env={ARPA_OWNER_EMAIL:'owner@example.com',MIGRATION_TOKEN:'test'} as SitesEnv;
 const r=await worker.fetch(new Request('https://arpa.test/mcp',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call'})}),env);
 assert.equal(r.status,401);
});
test('migration endpoints require explicit temporary token, and writes reject cross-origin requests',async()=>{
 const env={ARPA_OWNER_EMAIL:'owner@example.com'} as SitesEnv;
 assert.equal((await worker.fetch(new Request('https://arpa.test/api/migration/verify'),env)).status,404);
 const headers={'oai-authenticated-user-id':'user','oai-authenticated-user-email':'owner@example.com',origin:'https://evil.test','content-type':'application/json'};
 assert.equal((await worker.fetch(new Request('https://arpa.test/api/pantry',{method:'POST',headers,body:'{}'}),env)).status,403);
});
test('completed migration stays closed even when an old token survives in the runtime',async()=>{
 const env={ARPA_OWNER_EMAIL:'owner@example.com',MIGRATION_TOKEN:'old-token'} as SitesEnv;
 const r=await worker.fetch(new Request('https://arpa.test/api/migration/verify',{headers:{authorization:'Bearer old-token'}}),env);
 assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:'Not found'});
});
