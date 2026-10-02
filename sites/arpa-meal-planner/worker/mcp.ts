import type { SitesEnv } from './types.js';
import { KitchenStore, HttpError, validDate } from './store.js';
import { generatePlan, importRecipe } from './ai.js';
import { APPROVED_MEASURE_LABELS } from '../src/lib/units.js';

type Schema = { type: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: readonly unknown[]; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; minItems?: number; maxItems?: number; pattern?: string; format?: string };
type Tool = { name: string; title: string; description: string; inputSchema: Schema; annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean; idempotentHint: boolean }; _meta?: Record<string, unknown> };
const UI_URI = 'ui://arpa/kitchen-v1.html';
const UI_MIME = 'text/html;profile=mcp-app';
const MAX_BODY = 128000;
const str = (maxLength = 500): Schema => ({ type: 'string', minLength: 1, maxLength });
const num: Schema = { type: 'number', minimum: 0, maximum: 1000000 };
const id: Schema = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const date: Schema = { ...str(10), pattern: '^\\d{4}-\\d{2}-\\d{2}$', format: 'date' };
const measure: Schema = { type: 'string', enum: APPROVED_MEASURE_LABELS };
const servings: Schema = { type: 'integer', minimum: 1, maximum: 100 };
const language: Schema = { type: 'string', enum: ['auto', 'en', 'tr', 'de', 'es', 'fr', 'it'] };
const confirmed: Schema = { type: 'boolean', enum: [true] };
const previewId = str(100);
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
const ingredient = object({ name: str(), amount: num, measure, calories: num, protein: num, fat: num, carbs: num }, ['name', 'amount', 'measure']);
const recipe = object({ name: str(), tag: { type: 'string', maxLength: 200 }, servings, instructions: { type: 'array', items: str(5000), maxItems: 100 }, source_url: { type: 'string', maxLength: 2000 }, image_url: { type: 'string', maxLength: 2000 }, ingredients: { type: 'array', items: ingredient, minItems: 1, maxItems: 200 } }, ['name', 'ingredients']);
// Only updates may preserve a nonstandard measure already stored on this recipe.
// KitchenStore.updateMeal authorizes those existing labels; new recipes keep the fixed enum.
const editIngredient: Schema = { ...ingredient, properties: { ...ingredient.properties, measure: str(80) } };
const editRecipe: Schema = { ...recipe, properties: { ...recipe.properties, ingredients: { type: 'array', items: editIngredient, minItems: 1, maxItems: 200 } } };
function tool(name: string, title: string, description: string, inputSchema: Schema, flags: Partial<Tool['annotations']> = {}): Tool {
  return { name, title, description, inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true, ...flags } };
}
const write = { readOnlyHint: false, idempotentHint: false };
const destructive = { ...write, destructiveHint: true };
const TOOLS: Tool[] = [
  tool('list_pantry', 'List pantry', 'Read saved pantry quantities and units.', object({})),
  tool('find_low_stock', 'Find low stock', 'Read pantry entries at or below a quantity threshold. Quantities retain their own units; this is a simple user-chosen threshold, not a comparison across unit dimensions.', object({ threshold: num }, ['threshold'])),
  tool('update_pantry', 'Update pantry', 'Set the exact quantity for a pantry entry. With no id, update a matching name and unit or create it. Use only when the user asks to change stock.', object({ id, name: str(200), amount: num, measure }, ['name', 'amount', 'measure']), { ...write, idempotentHint: true }),
  tool('delete_pantry', 'Delete pantry entry', 'Remove a saved pantry entry only after explicit user confirmation; confirmed must be true.', object({ pantryId: id, confirmed }, ['pantryId', 'confirmed']), destructive),
  tool('list_meals', 'List recipes', 'Read saved recipes with ingredients, servings, instructions and nutritional estimates.', object({})),
  tool('get_recipe', 'Get recipe', 'Read one saved recipe by meal id.', object({ mealId: id }, ['mealId'])),
  tool('create_recipe', 'Create recipe', 'Save a recipe and its ingredients when the user asks to save it. Measures use the approved fixed labels. Nutrition values are totals for ingredient quantities.', object({ recipe }, ['recipe']), write),
  tool('update_recipe', 'Update recipe', 'Replace a complete saved recipe including its ingredient list when the user asks to edit it. Preserve unchanged fields by reading get_recipe first. Legacy measure labels may only be retained when already saved on that recipe.', object({ mealId: id, recipe: editRecipe }, ['mealId', 'recipe']), { ...write, idempotentHint: true }),
  tool('delete_recipe', 'Delete recipe', 'Delete a saved recipe; associated planner rows may also be removed. Requires explicit user confirmation and confirmed true.', object({ mealId: id, confirmed }, ['mealId', 'confirmed']), destructive),
  tool('get_weekly_plan', 'Get weekly plan', 'Read scheduled meals for seven calendar days starting at startDate, inclusive.', object({ startDate: date }, ['startDate'])),
  tool('schedule_meal', 'Schedule meal', 'Add a saved recipe to a calendar day when the user asks to schedule it. Optional servings override applies only to this calendar entry.', object({ mealId: id, date, servings }, ['mealId', 'date']), write),
  tool('move_planned_meal', 'Move scheduled meal', 'Change the calendar date of one planner entry when requested by the user.', object({ plannerId: id, date }, ['plannerId', 'date']), { ...write, idempotentHint: true }),
  tool('set_planned_servings', 'Set scheduled servings', 'Set a servings override for a calendar entry. Omit servings to restore the recipe default.', object({ plannerId: id, servings }, ['plannerId']), { ...write, idempotentHint: true }),
  tool('delete_planned_meal', 'Delete scheduled meal', 'Remove one calendar entry after explicit user confirmation. Its recipe remains saved.', object({ plannerId: id, confirmed }, ['plannerId', 'confirmed']), destructive),
  tool('preview_weekly_plan', 'Preview weekly meal plan', 'Generate a seven-day dinner plan with Gemini using dietary constraints. Store a private owner-bound preview valid for 10 minutes; no recipe or calendar writes occur. Show the full proposal and ask for confirmation before commit_weekly_plan.', object({ startDate: date, constraints: str(2000), language }, ['startDate', 'constraints']), { ...write, openWorldHint: true }),
  tool('commit_weekly_plan', 'Save confirmed weekly plan', 'After the user explicitly approves the shown preview, save its seven recipes and calendar entries atomically. Use the returned previewId and confirmed true. A preview can be consumed only once, within 10 minutes, by its owner.', object({ previewId, confirmed }, ['previewId', 'confirmed']), write),
  tool('preview_recipe_import', 'Preview recipe import', 'Search with Gemini for a recipe name or URL and estimate nutrition. Store a private preview valid for 10 minutes without saving a recipe. Show the proposed recipe and ask for confirmation before save_recipe_import.', object({ query: str(4000), language }, ['query']), { ...write, openWorldHint: true }),
  tool('save_recipe_import', 'Save confirmed recipe import', 'After the user explicitly approves the shown recipe preview, save the owner-bound preview atomically. Use the returned previewId and confirmed true. Do not supply a replacement recipe payload.', object({ previewId, confirmed }, ['previewId', 'confirmed']), write),
  tool('get_kitchen_snapshot', 'Read kitchen snapshot', 'Read saved recipes, pantry and the seven-day calendar. Also used by the interactive planner to refresh its saved data.', object({ startDate: date })),
  { ...tool('open_meal_planner', 'Open Arpa Meal Planner', 'Show the interactive recipe, pantry and weekly calendar view from current saved data. Includes a link to the full private site.', object({ startDate: date })), _meta: { ui: { resourceUri: UI_URI, visibility: ['model', 'app'] }, 'openai/outputTemplate': UI_URI, 'openai/toolInvocation/invoking': 'Opening your kitchen…', 'openai/toolInvocation/invoked': 'Kitchen ready.' } },
];
class ProtocolError extends Error { constructor(readonly code: number, message: string, readonly status = 200) { super(message); } }
function isObject(value: unknown): value is Record<string, any> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function validate(schema: Schema, value: unknown, path = 'arguments'): void {
  const invalid = (reason: string): never => { throw new ProtocolError(-32602, `${path}: ${reason}`); };
  if (schema.enum && !schema.enum.includes(value)) invalid('value is not allowed');
  if (schema.type === 'object') {
    if (!isObject(value)) invalid('expected object');
    const row = value as Record<string, unknown>;
    for (const required of schema.required || []) if (!Object.hasOwn(row, required)) invalid(`missing ${required}`);
    for (const [key, child] of Object.entries(row)) { const field = schema.properties && Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined; if (!field) invalid(`unknown field ${key}`); validate(field!, child, `${path}.${key}`); }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) invalid('expected array');
    const rows = value as unknown[];
    if (rows.length < (schema.minItems || 0) || rows.length > (schema.maxItems ?? Infinity)) invalid('invalid array length');
    rows.forEach((row, index) => validate(schema.items!, row, `${path}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') invalid('expected string');
    const s = value as string;
    if (s.trim().length < (schema.minLength || 0) || s.length > (schema.maxLength ?? Infinity)) invalid('invalid text length');
    if (schema.pattern && !new RegExp(schema.pattern).test(s)) invalid('invalid format');
    if (schema.format === 'date') { try { validDate(s); } catch { invalid('invalid calendar date'); } }
  } else if (schema.type === 'boolean') { if (typeof value !== 'boolean') invalid('expected boolean'); }
  else { if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isSafeInteger(value)) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) invalid('invalid number'); }
}
function weekRange(startDate: string) { const end = new Date(`${startDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6); return { startDate, endDate: end.toISOString().slice(0, 10) }; }
async function snapshot(request: Request, store: KitchenStore, args: Record<string, any>) {
  const start = args.startDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), range = weekRange(start);
  const [meals, pantry, plan] = await Promise.all([store.listMeals(), store.listPantry(), store.listPlanner(range.startDate, range.endDate)]);
  return { meals, pantry, plan, ...range, siteUrl: new URL(request.url).origin };
}
async function execute(name: string, args: Record<string, any>, request: Request, env: SitesEnv, store: KitchenStore): Promise<Record<string, any>> {
  const owner = request.headers.get('oai-authenticated-user-id')?.trim();
  if (!owner || owner.length > 200) throw new ProtocolError(-32001, 'Authenticated user identity is required', 401);
  switch (name) {
    case 'list_pantry': return { items: await store.listPantry() };
    case 'find_low_stock': return { items: (await store.listPantry()).filter(item => Number(item.amount) <= args.threshold), threshold: args.threshold };
    case 'update_pantry': return store.updatePantry(args);
    case 'delete_pantry': return store.deletePantry(args.pantryId);
    case 'list_meals': return { meals: await store.listMeals() };
    case 'get_recipe': { const meal = await store.getMeal(args.mealId); if (!meal) throw new HttpError(404, 'Meal not found'); return { meal }; }
    case 'create_recipe': return store.createMeal(args.recipe);
    case 'update_recipe': return store.updateMeal(args.mealId, args.recipe);
    case 'delete_recipe': return store.deleteMeal(args.mealId);
    case 'get_weekly_plan': { const range = weekRange(args.startDate); return { ...range, entries: await store.listPlanner(range.startDate, range.endDate) }; }
    case 'schedule_meal': return store.addPlanner({ meal_id: args.mealId, date: args.date, ...(args.servings !== undefined ? { servings_override: args.servings } : {}) });
    case 'move_planned_meal': return store.movePlanner(args.plannerId, args.date);
    case 'set_planned_servings': return store.setPlannerServings(args.plannerId, args.servings ?? null);
    case 'delete_planned_meal': return store.deletePlanner(args.plannerId);
    case 'preview_weekly_plan': { const meals = await generatePlan(env, store, { startDate: args.startDate, diet: args.constraints, language: args.language }); return store.createPreview(owner, 'weekly-plan', { startDate: args.startDate, meals }); }
    case 'commit_weekly_plan': return store.commitPlanPreview(owner, args.previewId);
    case 'preview_recipe_import': return store.createPreview(owner, 'recipe-import', await importRecipe(env, args));
    case 'save_recipe_import': return store.saveRecipePreview(owner, args.previewId);
    case 'open_meal_planner':
    case 'get_kitchen_snapshot': return snapshot(request, store, args);
    default: throw new ProtocolError(-32602, 'Unknown tool');
  }
}
function result(data: Record<string, any>, name: string) { return { structuredContent: data, content: [{ type: 'text', text: name === 'open_meal_planner' ? `Your kitchen: ${data.meals.length} recipes, ${data.pantry.length} pantry entries, ${data.plan.length} scheduled meals. Full site: ${data.siteUrl}` : JSON.stringify(data) }] }; }
async function readMessage(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new ProtocolError(-32600, 'Request too large', 413);
  if (!request.body) throw new ProtocolError(-32700, 'JSON body is required', 400);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_BODY) { await reader.cancel(); throw new ProtocolError(-32600, 'Request too large', 413); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ProtocolError(-32700, 'Invalid JSON', 400); }
}
export async function handleMcp(request: Request, env: SitesEnv, store: KitchenStore): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  let messageId: unknown = null;
  try {
    const message = await readMessage(request);
    if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (message.id !== undefined && typeof message.id !== 'string' && typeof message.id !== 'number')) throw new ProtocolError(-32600, 'Invalid JSON-RPC request', 400);
    messageId = message.id ?? null;
    if (message.id === undefined) return new Response(null, { status: 202 });
    const params = message.params === undefined ? {} : message.params;
    if (!isObject(params)) throw new ProtocolError(-32602, 'params must be an object');
    let output: unknown;
    switch (message.method) {
      case 'initialize': {
        if (typeof params.protocolVersion !== 'string') throw new ProtocolError(-32602, 'protocolVersion is required');
        const supported = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
        output = { protocolVersion: supported.includes(params.protocolVersion) ? params.protocolVersion : '2025-11-25', serverInfo: { name: 'arpa-meal-planner', version: '1.0.0' }, capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } }, instructions: 'Arpa is a private kitchen. Meal-planning and recipe imports must be previewed and shown to the user before confirmation and commit. Pantry and calendar writes require user intent. Nutrition estimates are approximate.' };
        break;
      }
      case 'ping': output = {}; break;
      case 'tools/list': output = { tools: TOOLS }; break;
      case 'resources/list': output = { resources: [{ uri: UI_URI, name: 'arpa-kitchen', title: 'Arpa Meal Planner', description: 'Interactive saved recipes, pantry and weekly calendar view', mimeType: UI_MIME }] }; break;
      case 'resources/read': {
        if (params.uri !== UI_URI) throw new ProtocolError(-32602, 'Unknown resource');
        output = { contents: [{ uri: UI_URI, mimeType: UI_MIME, text: WIDGET_HTML, _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } }, 'openai/widgetDescription': 'Arpa saved recipes, pantry quantities and seven-day calendar with a link to the private full site.' } }] };
        break;
      }
      case 'tools/call': {
        const definition = TOOLS.find(tool => tool.name === params.name);
        if (!definition) throw new ProtocolError(-32602, 'Unknown tool');
        const args = params.arguments === undefined ? {} : params.arguments;
        validate(definition.inputSchema, args);
        try { output = result(await execute(definition.name, args, request, env, store), definition.name); }
        catch (error) {
          if (error instanceof ProtocolError) throw error;
          const message = error instanceof HttpError ? error.message : 'Could not complete this action. Please try again.';
          output = { isError: true, structuredContent: { error: message, ...(error instanceof HttpError ? { status: error.status } : {}) }, content: [{ type: 'text', text: message }] };
        }
        break;
      }
      default: throw new ProtocolError(-32601, 'Method not found');
    }
    return Response.json({ jsonrpc: '2.0', id: messageId, result: output });
  } catch (error) {
    const failure = error instanceof ProtocolError ? error : new ProtocolError(-32603, 'Internal error', 500);
    return Response.json({ jsonrpc: '2.0', id: messageId, error: { code: failure.code, message: failure.message } }, { status: failure.status });
  }
}

const WIDGET_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arpa Kitchen</title>
<style>
:root{font-family:system-ui,sans-serif;color:#18392c;background:#fafcf8;color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:20px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:24px;margin:0}p{line-height:1.5}button,input{font:inherit}button{border:1px solid #c9dace;border-radius:10px;padding:9px 14px;background:#fff;color:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}button[aria-selected="true"]{background:#245b40;color:#fff;border-color:#245b40}nav{display:flex;gap:8px;margin:20px 0;flex-wrap:wrap}.actions{display:flex;gap:8px}.search{width:100%;padding:10px 12px;border:1px solid #c9dace;border-radius:10px;background:transparent;color:inherit;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.card{border:1px solid #dce7db;border-radius:14px;background:#fff;padding:16px}.card h2{font-size:17px;margin:0 0 6px}.muted{font-size:13px;color:#5d7265}ul,ol{padding-left:20px;line-height:1.6}details{margin-top:10px}summary{cursor:pointer}#status{margin:10px 0;min-height:20px}.empty{padding:24px;border:1px dashed #c9dace;border-radius:14px}footer{margin-top:16px;color:#5d7265;font-size:12px}@media(max-width:480px){body{padding:14px}.grid{grid-template-columns:1fr}header{align-items:flex-start}.actions{width:100%}}@media(prefers-color-scheme:dark){:root{background:#14241b;color:#edf6eb}.card,button{background:#1f3327;border-color:#42604b}.muted,footer{color:#b8cbbd}.search{border-color:#42604b}}
</style></head><body><header><div><h1>Arpa Kitchen</h1><p id="summary" class="muted">Your saved recipes, pantry and weekly plan.</p></div><div class="actions"><button id="refresh" type="button">Refresh</button><button id="site" type="button" disabled>Open full app</button></div></header>
<nav role="tablist" aria-label="Kitchen views"><button role="tab" id="meals-tab" data-tab="meals" aria-controls="panel" aria-selected="true">Recipes</button><button role="tab" id="pantry-tab" data-tab="pantry" aria-controls="panel" aria-selected="false" tabindex="-1">Pantry</button><button role="tab" id="plan-tab" data-tab="plan" aria-controls="panel" aria-selected="false" tabindex="-1">Weekly plan</button></nav>
<label><span class="muted">Filter this view</span><input class="search" id="search" type="search" placeholder="Search recipes or ingredients"></label><p id="status" class="muted" role="status" aria-live="polite">Waiting for your kitchen data…</p><main id="panel" role="tabpanel" aria-labelledby="meals-tab"><div id="cards" class="grid"></div></main><footer>Ask in chat to add, edit, import or plan meals. Review generated recipes before saving. Nutrition values are estimates.</footer>
<script>
(() => {
  let state = null, active = 'meals', nextId = 1;
  const pending = new Map();
  const cards = document.getElementById('cards'), status = document.getElementById('status'), refresh = document.getElementById('refresh'), site = document.getElementById('site'), search = document.getElementById('search');
  function element(tag, value, className) { const node = document.createElement(tag); if(value !== undefined) node.textContent = String(value); if(className) node.className = className; return node; }
  function request(method, params) { const id = nextId++; return new Promise((resolve,reject) => { const timer = setTimeout(() => { pending.delete(id); reject(new Error('The host did not respond.')); },15000); pending.set(id,{resolve,reject,timer}); window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*'); }); }
  function notify(method, params) { window.parent.postMessage({jsonrpc:'2.0',method,params},'*'); }
  function apply(data) { if(!data || typeof data !== 'object' || !Array.isArray(data.meals) || !Array.isArray(data.pantry) || !Array.isArray(data.plan)) return; state=data; site.disabled=!/^https?:\\/\\//.test(String(data.siteUrl||'')); document.getElementById('summary').textContent=data.meals.length+' recipes · '+data.pantry.length+' pantry entries · '+data.plan.length+' scheduled meals'; status.textContent='Saved data for '+String(data.startDate||'')+' to '+String(data.endDate||''); render(); }
  function list(rows, ordered) { const node=element(ordered?'ol':'ul'); rows.forEach(value => node.append(element('li',value))); return node; }
  function render() {
    cards.replaceChildren(); if(!state) return;
    const query=search.value.trim().toLowerCase();
    const rows=(state[active]||[]).filter(row => row && typeof row==='object' && JSON.stringify(row).toLowerCase().includes(query));
    if(!rows.length){ cards.append(element('p',query?'No matches in this view.':active==='plan'?'No meals scheduled for this week. Ask in chat to create a plan.':'No saved entries yet. Ask in chat to add one.','empty')); return; }
    rows.forEach(row => {
      const card=element('article',undefined,'card');
      if(active==='pantry'){ card.append(element('h2',row.name),element('p',String(row.amount)+' '+String(row.measure),'muted')); }
      else if(active==='plan'){ card.append(element('h2',row.meal_name||'Saved meal'),element('p',row.date,'muted')); if(row.servings_override) card.append(element('p',row.servings_override+' servings')); }
      else {
        card.append(element('h2',row.name),element('p',(row.tag||'Recipe')+' · '+String(row.servings||4)+' servings','muted'));
        if(Array.isArray(row.ingredients)){ const details=element('details'); details.append(element('summary',row.ingredients.length+' ingredients'),list(row.ingredients.map(i => String(i.amount)+' '+String(i.measure)+' '+String(i.name)),false)); card.append(details); }
        if(Array.isArray(row.instructions)&&row.instructions.length){ const details=element('details'); details.append(element('summary','Cooking steps'),list(row.instructions,true)); card.append(details); }
      }
      cards.append(card);
    });
    notify('ui/notifications/size-changed',{height:document.documentElement.scrollHeight});
  }
  function select(button){ active=button.dataset.tab; document.querySelectorAll('[role="tab"]').forEach(tab => {tab.setAttribute('aria-selected',String(tab===button));tab.tabIndex=tab===button?0:-1;}); document.getElementById('panel').setAttribute('aria-labelledby',button.id);render(); }
  document.querySelectorAll('[role="tab"]').forEach((button,index) => { button.onclick=() => select(button);button.onkeydown=event => {if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const tabs=Array.from(document.querySelectorAll('[role="tab"]'));const next=tabs[(index+(event.key==='ArrowRight'?1:2))%tabs.length];select(next);next.focus();}; });
  search.oninput=render;
  window.addEventListener('message',event => {
    if(event.source!==window.parent)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;
    if(message.id!==undefined&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);clearTimeout(task.timer);message.error?task.reject(new Error(message.error.message||'Host request failed')):task.resolve(message.result);return;}
    if(message.method==='ui/notifications/tool-result')apply(message.params&&message.params.structuredContent);
  });
  window.addEventListener('openai:set_globals',event => apply(event.detail&&event.detail.globals&&event.detail.globals.toolOutput));
  refresh.onclick=async () => {refresh.disabled=true;status.textContent='Refreshing saved data…';try{const args=state&&state.startDate?{startDate:state.startDate}:{};const output=window.openai&&window.openai.callTool?await window.openai.callTool('get_kitchen_snapshot',args):await request('tools/call',{name:'get_kitchen_snapshot',arguments:args});if(output&&output.isError)throw new Error('Could not refresh.');apply(output&&output.structuredContent?output.structuredContent:output);}catch(error){status.textContent=error.message||'Could not refresh your kitchen.';}finally{refresh.disabled=false;}};
  site.onclick=async () => {if(!state||site.disabled)return;try{const url=new URL(String(state.siteUrl));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return;if(window.openai&&window.openai.openExternal){window.openai.openExternal({href:url.href});}else{const output=await request('ui/open-link',{url:url.href});if(output&&output.isError)throw new Error('The host could not open this link.');}}catch(error){status.textContent=error.message||'Could not open the full app.';}};
  if(window.openai&&window.openai.toolOutput)apply(window.openai.toolOutput);
  request('ui/initialize',{protocolVersion:'2026-01-26',appInfo:{name:'Arpa Kitchen',version:'1.0.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']}}).then(() => notify('ui/notifications/initialized',{})).catch(() => {if(!state)status.textContent='Ask ChatGPT to open Arpa Meal Planner to load your kitchen.';});
})();
</script></body></html>`;
