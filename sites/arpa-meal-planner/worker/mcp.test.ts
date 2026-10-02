import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleMcp } from './mcp.js';
import { HttpError } from './store.js';
import type { KitchenStore } from './store.js';
import type { SitesEnv } from './types.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { GEMINI_API_KEY: 'MOCK_KEY', ARPA_OWNER_EMAIL: 'owner@example.com' } as SitesEnv;
const recipe = { name: 'Soup', tag: 'Dinner', servings: 4, instructions: ['Cook'], ingredients: [{ name: 'Carrot', amount: 2, measure: 'Unit', calories: 50, protein: 1, fat: 0, carbs: 10 }] };
function kitchen(overrides: Record<string, unknown> = {}): KitchenStore {
  return { listMeals: async () => [{ id: 1, ...recipe }], listPantry: async () => [{ id: 1, name: 'Carrot', amount: 2, measure: 'Unit' }, { id: 2, name: 'Rice', amount: 0, measure: 'Gram (g)' }], listPlanner: async () => [{ id: 1, date: '2026-10-01', meal_id: 1, meal_name: 'Soup' }], ...overrides } as unknown as KitchenStore;
}
function req(method: string, params?: any, options: { id?: any; owner?: string; httpMethod?: string } = {}) {
  return new Request('https://arpa.example/mcp', { method: options.httpMethod || 'POST', headers: { 'content-type': 'application/json', 'oai-authenticated-user-id': options.owner || 'owner-1' }, ...((options.httpMethod || 'POST') === 'POST' ? { body: JSON.stringify({ jsonrpc: '2.0', ...(options.id === null ? {} : { id: options.id ?? 1 }), method, ...(params === undefined ? {} : { params }) }) } : {}) });
}
async function rpc(method: string, params?: any, store = kitchen()) { const res = await handleMcp(req(method, params), env, store); return await res.json() as any; }
async function call(name: string, args: any = {}, store = kitchen()) { return (await rpc('tools/call', { name, arguments: args }, store)); }
function mockGemini(output: unknown) { globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] }); }

test('stateless initialize advertises tools/resources and GET rejects streaming without session', async () => {
  const response = await handleMcp(req('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }), env, kitchen());
  const body: any = await response.json();
  assert.equal(body.result.protocolVersion, '2025-06-18'); assert.ok(body.result.capabilities.tools); assert.ok(body.result.capabilities.resources); assert.equal(response.headers.get('mcp-session-id'), null);
  assert.equal((await handleMcp(req('noop', undefined, { httpMethod: 'GET' }), env, kitchen())).status, 405);
  assert.equal((await handleMcp(req('notifications/initialized', undefined, { id: null }), env, kitchen())).status, 202);
});

test('tools discovery has strict schemas, accurate annotations and portable widget metadata', async () => {
  const tools = (await rpc('tools/list')).result.tools;
  for (const name of ['list_pantry', 'find_low_stock', 'update_pantry', 'list_meals', 'get_weekly_plan', 'preview_weekly_plan', 'commit_weekly_plan', 'preview_recipe_import', 'save_recipe_import', 'open_meal_planner', 'create_recipe', 'update_recipe', 'delete_recipe', 'schedule_meal', 'move_planned_meal', 'delete_planned_meal']) assert.ok(tools.some((tool: any) => tool.name === name), name);
  for (const tool of tools) { assert.equal(tool.inputSchema.additionalProperties, false); assert.equal(typeof tool.annotations.readOnlyHint, 'boolean'); assert.equal(typeof tool.annotations.destructiveHint, 'boolean'); assert.equal(typeof tool.annotations.openWorldHint, 'boolean'); }
  assert.equal(tools.find((t: any) => t.name === 'list_pantry').annotations.readOnlyHint, true);
  assert.equal(tools.find((t: any) => t.name === 'delete_recipe').annotations.destructiveHint, true);
  assert.equal(tools.find((t: any) => t.name === 'preview_recipe_import').annotations.openWorldHint, true);
  assert.equal(tools.find((t: any) => t.name === 'open_meal_planner')._meta.ui.resourceUri, 'ui://arpa/kitchen-v1.html');
});

test('tool results are object structuredContent with current saved data', async () => {
  const pantry = (await call('list_pantry')).result;
  assert.equal(pantry.structuredContent.items.length, 2); assert.equal(Array.isArray(pantry.structuredContent), false);
  assert.deepEqual((await call('find_low_stock', { threshold: 1 })).result.structuredContent.items.map((item: any) => item.name), ['Rice']);
  const open = (await call('open_meal_planner', { startDate: '2026-10-01' })).result.structuredContent;
  assert.equal(open.meals[0].name, 'Soup'); assert.equal(open.pantry.length, 2); assert.equal(open.plan.length, 1); assert.equal(open.siteUrl, 'https://arpa.example');
});

test('argument schema rejects unknown fields, wrong types, invalid units and missing confirmation before writes', async () => {
  const fake = kitchen({ updatePantry: () => assert.fail('must not write'), deleteMeal: () => assert.fail('must not delete') });
  for (const [name, arguments_] of [['update_pantry', { name: 'Carrot', amount: '2', measure: 'Unit' }], ['update_pantry', { name: 'Carrot', amount: 2, measure: 'fistful' }], ['list_meals', { secret: true }], ['list_meals', JSON.parse('{"constructor":2}')], ['delete_recipe', { mealId: 1 }], ['delete_recipe', { mealId: 1, confirmed: false }]]) {
    const response = await call(name as string, arguments_, fake); assert.equal(response.error.code, -32602);
  }
});

test('weekly planning previews store owner-bound tokens and commit only the confirmed token', async () => {
  mockGemini({ meals: Array.from({ length: 7 }, () => recipe) });
  let preview: any, committed: any;
  const fake = kitchen({ createPreview: async (owner: string, kind: string, data: any) => { preview = { owner, kind, data }; return { previewId: 'token-1', expiresInSeconds: 600, preview: data }; }, commitPlanPreview: async (owner: string, token: string) => { committed = { owner, token }; return { success: true }; }, saveGeneratedPlan: () => assert.fail('preview cannot write plan') });
  const result = (await call('preview_weekly_plan', { startDate: '2026-10-01', constraints: 'Vegetarian', language: 'tr' }, fake)).result;
  assert.equal(preview.owner, 'owner-1'); assert.equal(preview.kind, 'weekly-plan'); assert.equal(preview.data.meals.length, 7); assert.equal(committed, undefined); assert.equal(result.structuredContent.previewId, 'token-1');
  const response = await call('commit_weekly_plan', { previewId: 'token-1', confirmed: true }, fake);
  assert.equal(response.result.structuredContent.success, true); assert.deepEqual(committed, { owner: 'owner-1', token: 'token-1' });
});

test('import preview and save use recipe token instead of trusting caller-provided recipe edits', async () => {
  mockGemini(recipe); let preview: any, saved: any;
  const fake = kitchen({ createPreview: async (owner: string, kind: string, data: any) => { preview = { owner, kind, data }; return { previewId: 'recipe-token', preview: data }; }, saveRecipePreview: async (owner: string, token: string) => { saved = { owner, token }; return { success: true, id: 9 }; } });
  assert.equal((await call('preview_recipe_import', { query: 'Carrot soup' }, fake)).result.structuredContent.previewId, 'recipe-token'); assert.equal(preview.kind, 'recipe-import'); assert.equal(saved, undefined);
  assert.equal((await call('save_recipe_import', { previewId: 'recipe-token', confirmed: true }, fake)).result.structuredContent.id, 9); assert.deepEqual(saved, { owner: 'owner-1', token: 'recipe-token' });
});

test('data calls require trusted owner header while discovery is free of data', async () => {
  const request = new Request('https://arpa.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_meals', arguments: {} } }) });
  const response = await handleMcp(request, env, kitchen({ listMeals: () => assert.fail('must not read data') }));
  assert.equal(response.status, 401);
});

test('store errors become sanitized tool failures, unknown methods/tools are protocol errors', async () => {
  const stale = await call('commit_weekly_plan', { previewId: 'stale-token', confirmed: true }, kitchen({ commitPlanPreview: async () => { throw new HttpError(404, 'Preview not found or expired'); } }));
  assert.equal(stale.result.isError, true); assert.equal(stale.result.structuredContent.error, 'Preview not found or expired');
  const unexpected = await call('list_meals', {}, kitchen({ listMeals: async () => { throw new Error('private sql and key'); } }));
  assert.equal(JSON.stringify(unexpected).includes('private sql'), false);
  assert.equal((await rpc('something/unknown')).error.code, -32601); assert.equal((await call('unknown')).error.code, -32602);
});

test('calendar arguments are validated and weekly range covers exactly seven days', async () => {
  let range: any;
  const fake = kitchen({ listPlanner: async (start: string, end: string) => { range = { start, end }; return []; } });
  await call('get_weekly_plan', { startDate: '2026-12-29' }, fake);
  assert.deepEqual(range, { start: '2026-12-29', end: '2027-01-04' });
  const invalid = await call('get_weekly_plan', { startDate: '2026-02-31' }, fake); assert.equal(invalid.error.code, -32602);
});

test('explicit CRUD tools route validated arguments to exact store methods', async () => {
  let update: any, scheduled: any;
  const fake = kitchen({ updateMeal: async (id: number, body: unknown) => { update = { id, body }; return { success: true }; }, addPlanner: async (body: unknown) => { scheduled = body; return { success: true, id: 7 }; } });
  assert.equal((await call('update_recipe', { mealId: 1, recipe }, fake)).result.structuredContent.success, true); assert.deepEqual(update, { id: 1, body: recipe });
  assert.equal((await call('schedule_meal', { mealId: 1, date: '2026-10-01', servings: 2 }, fake)).result.structuredContent.id, 7); assert.deepEqual(scheduled, { meal_id: 1, date: '2026-10-01', servings_override: 2 });
});

test('widget resource is static, uses safe host messaging and contains no data/network credentials', async () => {
  const resource = (await rpc('resources/read', { uri: 'ui://arpa/kitchen-v1.html' })).result.contents[0];
  assert.equal(resource.mimeType, 'text/html;profile=mcp-app');
  assert.ok(resource.text.includes('textContent')); assert.ok(resource.text.includes('ui/initialize')); assert.ok(resource.text.includes('ui/notifications/tool-result')); assert.ok(resource.text.includes('ui/open-link')); assert.equal(resource.text.includes('MOCK_KEY'), false); assert.equal(resource.text.includes('fetch('), false); assert.equal(resource.text.includes('innerHTML'), false);
  new vm.Script(resource.text.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.equal((await rpc('resources/read', { uri: 'ui://unknown' })).error.code, -32602);
});

test('malformed JSON-RPC and oversized requests are rejected without store calls', async () => {
  const bad = await handleMcp(new Request('https://arpa.example/mcp', { method: 'POST', body: '{' }), env, kitchen()); assert.equal((await bad.json() as any).error.code, -32700);
  const huge = await handleMcp(new Request('https://arpa.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', payload: 'x'.repeat(130000) }) }), env, kitchen()); assert.equal(huge.status, 413);
  const invalid = await handleMcp(new Request('https://arpa.example/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'ping' }) }), env, kitchen()); assert.equal((await invalid.json() as any).error.code, -32600);
});


test('widget renders hostile recipe names as literal text and switches saved-data tabs without network', async () => {
  const resource = (await rpc('resources/read', { uri: 'ui://arpa/kitchen-v1.html' })).result.contents[0];
  class Node {
    children: Node[] = []; textContent = ''; className = ''; disabled = false; value = ''; dataset: Record<string, string> = {}; id = ''; tabIndex = 0; attributes: Record<string, string> = {};
    onclick?: () => void; onkeydown?: (event: any) => void; oninput?: () => void;
    append(...nodes: Node[]) { this.children.push(...nodes); }
    replaceChildren(...nodes: Node[]) { this.children = nodes; }
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    focus() {}
  }
  const nodes = Object.fromEntries(['cards', 'status', 'refresh', 'site', 'search', 'summary', 'panel'].map(name => [name, new Node()]));
  const tabs = ['meals', 'pantry', 'plan'].map(name => { const node = new Node(); node.id = name+'-tab'; node.dataset.tab = name; return node; });
  const sent: any[] = [], parent = { postMessage: (message: any) => sent.push(message) };
  const fakeWindow = { parent, openai: { toolOutput: { meals: [{ ...recipe, name: '<img src=x onerror=attack()>' }], pantry: [{ name: 'Rice', amount: 10, measure: 'Gram (g)' }], plan: [], startDate: '2026-10-01', endDate: '2026-10-07', siteUrl: 'https://arpa.example' } }, addEventListener: () => {} };
  const context = { window: fakeWindow, document: { getElementById: (name: string) => nodes[name], createElement: () => new Node(), querySelectorAll: () => tabs, documentElement: { scrollHeight: 500 } }, setTimeout: () => 1, clearTimeout: () => {}, URL };
  vm.runInNewContext(resource.text.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  assert.equal(nodes.cards.children[0].children[0].textContent, '<img src=x onerror=attack()>');
  tabs[1].onclick!(); assert.equal(nodes.cards.children[0].children[0].textContent, 'Rice'); assert.equal(nodes.panel.attributes['aria-labelledby'], 'pantry-tab');
  assert.ok(sent.some(message => message.method === 'ui/initialize'));
});

test('MCP edits preserve an existing legacy measure through actual store without permitting new legacy units', async () => {
  const { KitchenStore } = await import('./store.js');
  const { testDb } = await import('./test-db.js');
  const { db, sqlite } = testDb();
  try {
    const realStore = new KitchenStore(db), saved = await realStore.createMeal(recipe);
    sqlite.prepare("UPDATE ingredients SET measure='pinch' WHERE meal_id=?").run(saved.id);
    const edit = { ...recipe, name: 'Edited legacy soup', ingredients: [{ ...recipe.ingredients[0], measure: 'pinch' }] };
    const edited = await call('update_recipe', { mealId: saved.id, recipe: edit }, realStore);
    assert.equal(edited.result?.structuredContent.success, true);
    assert.equal((await realStore.getMeal(saved.id)).name, 'Edited legacy soup'); assert.equal((await realStore.getMeal(saved.id)).ingredients[0].measure, 'pinch');
    const newLegacy = await call('create_recipe', { recipe: edit }, realStore);
    assert.equal(newLegacy.error.code, -32602);
    const introduced = await call('update_recipe', { mealId: saved.id, recipe: { ...edit, ingredients: [{ ...edit.ingredients[0], measure: 'dash' }] } }, realStore);
    assert.equal(introduced.result.isError, true); assert.equal(introduced.result.structuredContent.status, 400);
    assert.equal((await realStore.getMeal(saved.id)).ingredients[0].measure, 'pinch'); assert.equal((await realStore.listMeals()).length, 1);
  } finally { sqlite.close(); }
});
