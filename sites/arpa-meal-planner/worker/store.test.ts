import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KitchenStore } from './store.js';
import { testDb } from './test-db.js';

const meal = { name: 'Soup', servings: 2, ingredients: [{ name: 'Carrot', amount: 2, measure: 'Unit' }] };
test('recipe create/edit/delete and planner preserve complete data and cascade', async () => {
  const { db } = testDb(); const s = new KitchenStore(db);
  const r = await s.createMeal(meal); await s.addPlanner({ meal_id: r.id, date: '2026-10-01', servings_override: 3 });
  await s.updateMeal(r.id, { ...meal, name: 'New Soup', instructions: ['Cook'] });
  assert.equal((await s.getMeal(r.id))!.ingredients.length, 1);
  assert.deepEqual((await s.getMeal(r.id))!.instructions, ['Cook']);
  assert.equal((await s.listPlanner())[0].servings_override, 3);
  await s.deleteMeal(r.id); assert.equal((await s.listPlanner()).length, 0);
});
test('invalid generated plan has zero writes, and valid seven-day plan is atomic', async () => {
  const { db } = testDb(); const s = new KitchenStore(db);
  await assert.rejects(s.saveGeneratedPlan('2026-10-01', [...Array(6).fill(meal), { ...meal, ingredients: [] }]));
  assert.equal((await s.listMeals()).length, 0);
  await s.saveGeneratedPlan('2026-10-01', Array(7).fill(meal));
  assert.equal((await s.listPlanner()).length, 7);
});
test('preview commits require owner/kind/live expiry and are consumed once', async () => {
  const { db, sqlite } = testDb(); const s = new KitchenStore(db);
  const p = await s.createPreview('owner', 'weekly-plan', { startDate: '2026-10-01', meals: Array(7).fill(meal) });
  await assert.rejects(s.commitPlanPreview('other', p.previewId));
  await s.commitPlanPreview('owner', p.previewId);
  await assert.rejects(s.commitPlanPreview('owner', p.previewId));
  assert.equal((await s.listMeals()).length, 7);
  const expired = await s.createPreview('owner', 'recipe-import', meal);
  sqlite.prepare('UPDATE mcp_previews SET expires_at=0 WHERE id=?').run(expired.previewId);
  await assert.rejects(s.saveRecipePreview('owner', expired.previewId));
  assert.equal((await s.listMeals()).length, 7);
});
test('existing legacy units survive edits but cannot be introduced by new recipe writes',async()=>{
 const {db,sqlite}=testDb();const s=new KitchenStore(db);const r=await s.createMeal(meal);
 sqlite.prepare("UPDATE ingredients SET measure='pinch' WHERE meal_id=?").run(r.id);
 const legacy=await s.getMeal(r.id);await s.updateMeal(r.id,{...legacy,name:'Edited'});
 assert.equal((await s.getMeal(r.id))!.ingredients[0].measure,'pinch');
 await assert.rejects(s.createMeal({...meal,ingredients:[{name:'Salt',amount:1,measure:'pinch'}]}));
});
test('pantry merge sums current amounts inside its batch and preserves intervening edits',async()=>{
 const {db,sqlite}=testDb();const s=new KitchenStore(db);
 const a=await s.addPantry({name:'Salt a',amount:2,measure:'Gram (g)'});
 await s.addPantry({name:'Salt b',amount:3,measure:'Gram (g)'});
 const batch=db.batch.bind(db);db.batch=async(statements:any)=>{sqlite.prepare('UPDATE pantry SET amount=20 WHERE id=?').run(a.id);return batch(statements);};
 const r=await s.mergeIngredientNames({sourceNames:['Salt a','Salt b'],targetName:'Salt'});
 const rows=await s.listPantry();assert.equal(rows.length,1);assert.equal(rows[0].amount,23);assert.equal(r.consolidatedPantryRows,1);
});
test('image-only update preserves current recipe name and ingredients',async()=>{
 const {db}=testDb();const s=new KitchenStore(db);const a=await s.createMeal(meal);
 await s.updateMeal(a.id,{...meal,name:'Latest edit'});await s.setMealImage(a.id,'/api/images/generated/test.png');
 const current=await s.getMeal(a.id);assert.equal(current.name,'Latest edit');assert.equal(current.ingredients.length,1);
});
