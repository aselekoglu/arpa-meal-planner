import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleAi, generatePlan, importRecipe } from './ai.js';
import type { SitesEnv } from './types.js';
import type { KitchenStore } from './store.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { GEMINI_API_KEY: 'TEST_SECRET', BUCKET: {} } as SitesEnv;
const meal = { id: 1, name: 'Soup', tag: 'Dinner', servings: 2, ingredients: [{ name: 'Carrot', amount: 2, measure: 'Unit' }], instructions: ['Cook'], source_url: 'https://example.com', image_url: '' };
function request(route: string, body: unknown) { return new Request(`https://arpa.test/api/ai/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
function store(extra: Record<string, unknown> = {}) { return { listMeals: async () => [meal], getMeal: async () => meal, setMealImage: async () => ({ success: true }), updateMeal: async () => meal, saveGeneratedPlan: async () => ({ success: true }), ...extra } as unknown as KitchenStore; }
function mockText(output: unknown, capture?: (body: any, url: string, init: RequestInit) => void) {
  globalThis.fetch = async (url, init) => { capture?.(JSON.parse(String(init?.body)), String(url), init!); return Response.json({ candidates: [{ content: { parts: [{ text: typeof output === 'string' ? output : JSON.stringify(output) }] } }] }); };
}
const recipe = { name: 'Soup', tag: 'Dinner', servings: 2, instructions: ['Cook'], ingredients: [{ name: 'Carrot', amount: 2, measure: 'Unit', calories: 60, protein: 1, fat: 0, carbs: 14 }] };

test('chat includes saved recipe context, preserves conversation language and hides credentials in URL', async () => {
  mockText('Afiyet olsun', (body, url, init) => { assert.ok(body.systemInstruction.parts[0].text.includes('Soup')); assert.ok(body.systemInstruction.parts[0].text.includes('same language')); assert.equal(url.includes('TEST_SECRET'), false); assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'TEST_SECRET'); });
  const res = await handleAi(request('chat', { message: 'Ne pişirelim?' }), env, store());
  assert.deepEqual(await res!.json(), { text: 'Afiyet olsun' });
});

test('recipe preview uses search without forced JSON mode, locale instruction and does not save', async () => {
  mockText(recipe, body => { assert.deepEqual(body.tools, [{ googleSearch: {} }]); assert.equal(body.generationConfig?.responseMimeType, undefined); assert.ok(body.systemInstruction.parts[0].text.includes('Turkish')); });
  assert.equal((await importRecipe(env, { query: 'Çorba', language: 'tr' })).name, 'Soup');
});

test('nutrition preserves duplicate ingredient identity and clamps invalid estimates', async () => {
  mockText({ ingredients: [{ name: 'Carrot', calories: -2, protein: 1 }, { name: 'Carrot', calories: 9, fat: 2 }] });
  const inputs = [{ name: 'Carrot', amount: 1, measure: 'Unit' }, { name: 'Carrot', amount: 2, measure: 'Gram (g)' }];
  const res = await handleAi(request('estimate-nutrition', { mealName: 'Soup', ingredients: inputs, language: 'tr' }), env, store());
  const data: any = await res!.json();
  assert.equal(data.ingredients[0].calories, 0); assert.equal(data.ingredients[1].calories, 9); assert.equal(data.ingredients[1].amount, 2); assert.equal(data.ingredients[1].measure, 'Gram (g)');
});

test('instruction fetch duplicates explicit locale into prompt for search grounded output', async () => {
  mockText({ instructions: ['  Pişir  '], sourceUrl: 'https://example.com/recipe' }, body => { assert.ok(body.contents[0].parts[0].text.startsWith('JSON OUTPUT')); assert.ok(body.systemInstruction.parts[0].text.includes('Turkish')); });
  const res = await handleAi(request('fetch-instructions', { mealName: 'Soup', language: 'tr' }), env, store());
  assert.deepEqual(await res!.json(), { instructions: ['Pişir'], sourceUrl: 'https://example.com/recipe' });
});

test('plan preview never writes, web route saves validated seven day result', async () => {
  mockText({ meals: Array.from({ length: 7 }, () => recipe) });
  let saved: any;
  const kitchen = store({ saveGeneratedPlan: async (date: string, meals: unknown[]) => { saved = { date, meals }; } });
  assert.equal((await generatePlan(env, kitchen, { diet: 'Vegetarian', startDate: '2026-10-01' })).length, 7);
  assert.equal(saved, undefined);
  const res = await handleAi(request('generate-plan', { diet: 'Vegetarian', startDate: '2026-10-01' }), env, kitchen);
  assert.deepEqual(await res!.json(), { success: true }); assert.equal((saved as any).date, '2026-10-01'); assert.equal((saved as any).meals.length, 7);
});

test('incomplete plans never mutate and impossible calendar dates are rejected', async () => {
  mockText({ meals: [recipe] });
  const res = await handleAi(request('generate-plan', { diet: 'Vegan', startDate: '2026-10-01' }), env, store({ saveGeneratedPlan: () => assert.fail('must not write') }));
  assert.equal(res!.status, 422);
  const invalid = await handleAi(request('generate-plan', { diet: 'Vegan', startDate: '2026-02-31' }), env, store());
  assert.equal(invalid!.status, 400);
});

test('grocery categories preserve input keys and discard unrelated provider fields', async () => {
  mockText({ Carrot: 'Produce', malicious: 'Extra' });
  const res = await handleAi(request('grocery-group', { items: ['Carrot'] }), env, store());
  assert.deepEqual(await res!.json(), { categories: { Carrot: 'Produce' } });
});

test('image output goes to R2 with private URL and updates only image identity', async () => {
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }] } }] });
  let blob: any, updated: any;
  const imageEnv = { ...env, BUCKET: { put: async (key: string, bytes: Uint8Array, options: unknown) => { blob = { key, bytes, options }; }, delete: async () => {} } } as unknown as SitesEnv;
  const res = await handleAi(request('generate-meal-image', { mealId: 1, size: '1K' }), imageEnv, store({ setMealImage: async (id: number, imageUrl: string) => { updated = { id, imageUrl }; return { success: true }; }, updateMeal: () => assert.fail('image must not replace recipe') }));
  const data: any = await res!.json();
  assert.equal(res!.status, 200); assert.ok(data.imageUrl.startsWith('/api/images/')); assert.deepEqual(Array.from(blob.bytes), [1, 2, 3]); assert.deepEqual(updated, { id: 1, imageUrl: data.imageUrl });
});

test('unsupported providers, invalid JSON and oversized requests fail before provider invocation', async () => {
  globalThis.fetch = async () => { assert.fail('must not invoke provider'); };
  assert.equal((await handleAi(request('chat', { message: 'Hi', provider: 'ollama' }), env, store()))!.status, 400);
  assert.equal((await handleAi(new Request('https://arpa.test/api/ai/chat', { method: 'POST', body: '{' }), env, store()))!.status, 400);
  assert.equal((await handleAi(request('chat', { message: 'x'.repeat(140000) }), env, store()))!.status, 413);
});

test('upstream errors and thrown fetch URLs never expose secrets', async () => {
  globalThis.fetch = async () => { throw new Error('https://upstream.test?key=TEST_SECRET'); };
  const res = await handleAi(request('chat', { message: 'Hi' }), env, store());
  assert.equal(res!.status, 502); assert.equal((await res!.text()).includes('TEST_SECRET'), false);
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'TEST_SECRET' } }), { status: 429 });
  const limited = await handleAi(request('chat', { message: 'Hi' }), env, store());
  assert.equal(limited!.status, 429); assert.equal((await limited!.text()).includes('TEST_SECRET'), false);
});


test('recipe previews reject unsupported units and unsafe image URLs are discarded', async () => {
  mockText({ ...recipe, image_url: 'javascript:alert(1)', source_url: 'https://user:password@example.com/recipe' });
  const result = await importRecipe(env, { query: 'Soup' });
  assert.equal(result.image_url, ''); assert.equal(result.source_url, '');
  mockText({ ...recipe, ingredients: [{ ...recipe.ingredients[0], measure: 'fistful' }] });
  await assert.rejects(importRecipe(env, { query: 'Soup' }), /unsupported ingredient unit/);
});

test('env models and request text model are supported while image model stays server controlled', async () => {
  mockText('Hello', (_body, url) => assert.ok(url.includes('/gemini-custom-text:generateContent')));
  await handleAi(request('chat', { message: 'Hi', model: 'gemini-custom-text' }), { ...env, AI_GEMINI_TEXT_MODEL: 'gemini-env-text' }, store());
  mockText('Hello', (_body, url) => assert.ok(url.includes('/gemini-env-text:generateContent')));
  await handleAi(request('chat', { message: 'Hi' }), { ...env, AI_GEMINI_TEXT_MODEL: 'gemini-env-text' }, store());
  assert.equal((await handleAi(request('chat', { message: 'Hi', model: '../unsafe' }), env, store()))!.status, 400);
});

test('missing configuration, blocked text and non-JSON output return actionable sanitized failures', async () => {
  assert.equal((await handleAi(request('chat', { message: 'Hi' }), { ...env, GEMINI_API_KEY: '' }, store()))!.status, 503);
  globalThis.fetch = async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } });
  assert.equal((await handleAi(request('chat', { message: 'Hi' }), env, store()))!.status, 422);
  mockText('No recipe available');
  assert.equal((await handleAi(request('import-recipe', { query: 'Soup' }), env, store()))!.status, 422);
});

test('image-only mutation preserves concurrent name and ingredient edits and cleans blobs on failure', async () => {
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }] } }] });
  let current = structuredClone(meal), deleted = '', reads = 0;
  const concurrentIngredients = [{ name: 'Potato', amount: 3, measure: 'Unit' }];
  const imageEnv = { ...env, BUCKET: { put: async () => { current.name = 'Updated soup'; current.ingredients = concurrentIngredients; }, delete: async (key: string) => { deleted = key; } } } as unknown as SitesEnv;
  const kitchen = store({ getMeal: async () => { reads += 1; return structuredClone(current); }, setMealImage: async (id: number, imageUrl: string) => { assert.equal(id, 1); current.image_url = imageUrl; return { success: true }; }, updateMeal: () => assert.fail('full recipe write would overwrite concurrent fields') });
  const success = await handleAi(request('generate-meal-image', { mealId: 1 }), imageEnv, kitchen);
  assert.equal(success!.status, 200); assert.equal(current.name, 'Updated soup'); assert.deepEqual(current.ingredients, concurrentIngredients); assert.ok(current.image_url.startsWith('/api/images/')); assert.equal(reads, 1); assert.equal(deleted, '');
  const failed = await handleAi(request('generate-meal-image', { mealId: 1 }), imageEnv, store({ setMealImage: async () => { throw new Error('db detail'); }, updateMeal: () => assert.fail('full recipe write is forbidden') }));
  assert.equal(failed!.status, 502); assert.ok(deleted.startsWith('generated/'));
});

test('generated servings outside store range are rejected before planner writes', async () => {
  mockText({ meals: Array.from({ length: 7 }, () => ({ ...recipe, servings: 101 })) });
  const res = await handleAi(request('generate-plan', { startDate: '2026-10-01', diet: 'Vegetarian' }), env, store({ saveGeneratedPlan: () => assert.fail('invalid recipes must never be saved') }));
  assert.equal(res!.status, 422);
});

test('oversized cooking instructions are rejected instead of producing an unsaveable recipe', async () => {
  mockText({ ...recipe, instructions: ['x'.repeat(6000)] });
  const res = await handleAi(request('import-recipe', { query: 'Soup' }), env, store());
  assert.equal(res!.status, 422);
});

test('HTTP and oversized recipe URLs are omitted while HTTPS remains saveable', async () => {
  mockText({ ...recipe, source_url: 'http://example.com/recipe', image_url: 'https://example.com/'+'x'.repeat(2100) });
  const preview = await importRecipe(env, { query: 'Soup' });
  assert.equal(preview.source_url, ''); assert.equal(preview.image_url, '');
});

test('recipe preview boundaries agree with actual store meal validation', async () => {
  const { validateMeal } = await import('./store.js');
  mockText({ ...recipe, servings: 100, tag: 'x'.repeat(400), instructions: ['x'.repeat(5000)], source_url: 'https://example.com/recipe', ingredients: Array.from({ length: 200 }, () => ({ ...recipe.ingredients[0], name: 'x'.repeat(500), measure: 'grams', calories: 1000000 })) });
  const preview = await importRecipe(env, { query: 'Soup' });
  assert.doesNotThrow(() => validateMeal(preview)); assert.equal(preview.tag.length, 200); assert.equal(preview.ingredients.length, 200); assert.equal(preview.ingredients[0].measure, 'Gram (g)');
  mockText({ ...recipe, ingredients: [{ ...recipe.ingredients[0], calories: 1000001 }] });
  await assert.rejects(importRecipe(env, { query: 'Soup' }));
});
