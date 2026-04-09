import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import db from './db.js';
import { getMealsWithIngredients } from './meal-queries.js';
import { registerAiRoutes } from './ai-routes.js';

const MAX_NAME_LEN = 500;
const MAX_TAG_LEN = 200;
const MAX_INGREDIENTS = 200;
const MAX_IMAGE_URL_LEN = 2_000_000;
const MAX_SOURCE_URL_LEN = 2000;

function parseFamilyId(req: express.Request): string {
  const v = req.headers['x-family-id'];
  const s = typeof v === 'string' ? v.trim() : Array.isArray(v) ? v[0]?.trim() ?? '' : '';
  return s || 'default';
}

function parseIdParam(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

type SanitizedIngredient = {
  name: string;
  amount: number;
  measure: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type SanitizedMeal = {
  name: string;
  tag: string;
  source_url: string | null;
  image_url: string | null;
  instructionsStr: string | null;
  ingredients: SanitizedIngredient[];
};

function validateMealBody(body: unknown): { ok: true; data: SanitizedMeal } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body' };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > MAX_NAME_LEN) {
    return { ok: false, error: 'name is required' };
  }

  const tag = typeof b.tag === 'string' ? b.tag.trim().slice(0, MAX_TAG_LEN) : '';

  let source_url: string | null = null;
  if (b.source_url != null) {
    if (typeof b.source_url !== 'string') {
      return { ok: false, error: 'Invalid source_url' };
    }
    if (b.source_url.length > MAX_SOURCE_URL_LEN) {
      return { ok: false, error: 'source_url too long' };
    }
    source_url = b.source_url.trim() || null;
  }

  let image_url: string | null = null;
  if (b.image_url != null) {
    if (typeof b.image_url !== 'string') {
      return { ok: false, error: 'Invalid image_url' };
    }
    if (b.image_url.length > MAX_IMAGE_URL_LEN) {
      return { ok: false, error: 'image_url too large' };
    }
    image_url = b.image_url;
  }

  let instructionsStr: string | null = null;
  if (b.instructions !== undefined && b.instructions !== null) {
    if (Array.isArray(b.instructions)) {
      const steps = b.instructions.map((s) => String(s).trim()).filter(Boolean);
      instructionsStr = steps.length ? JSON.stringify(steps) : null;
    } else if (typeof b.instructions === 'string' && b.instructions.trim()) {
      instructionsStr = JSON.stringify([b.instructions.trim()]);
    } else {
      return { ok: false, error: 'Invalid instructions' };
    }
  }

  const ingredients: SanitizedIngredient[] = [];
  if (b.ingredients !== undefined && b.ingredients !== null) {
    if (!Array.isArray(b.ingredients)) {
      return { ok: false, error: 'ingredients must be an array' };
    }
    if (b.ingredients.length > MAX_INGREDIENTS) {
      return { ok: false, error: 'Too many ingredients' };
    }
    for (const raw of b.ingredients) {
      if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'Invalid ingredient' };
      }
      const ing = raw as Record<string, unknown>;
      const inName = typeof ing.name === 'string' ? ing.name.trim() : '';
      if (!inName || inName.length > 200) {
        return { ok: false, error: 'Each ingredient needs a valid name' };
      }
      const amount = Number(ing.amount);
      const measure = typeof ing.measure === 'string' ? ing.measure.trim() : '';
      if (!Number.isFinite(amount) || !measure || measure.length > 100) {
        return { ok: false, error: 'Invalid ingredient amount or measure' };
      }
      ingredients.push({
        name: inName,
        amount,
        measure,
        calories: Math.max(0, Number(ing.calories) || 0),
        protein: Math.max(0, Number(ing.protein) || 0),
        fat: Math.max(0, Number(ing.fat) || 0),
        carbs: Math.max(0, Number(ing.carbs) || 0),
      });
    }
  }

  return {
    ok: true,
    data: {
      name,
      tag,
      source_url,
      image_url,
      instructionsStr,
      ingredients,
    },
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.BIND_HOST ?? '127.0.0.1';

  app.use(express.json({ limit: '12mb' }));

  // API Routes
  app.get('/api/meals', (req, res) => {
    const familyId = parseFamilyId(req);
    res.json(getMealsWithIngredients(familyId));
  });

  app.post('/api/meals', (req, res) => {
    const familyId = parseFamilyId(req);
    const parsed = validateMealBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { name, tag, source_url, image_url, instructionsStr, ingredients } = parsed.data;

    const insertMeal = db.prepare(
      'INSERT INTO meals (family_id, name, tag, instructions, source_url, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertIngredient = db.prepare(
      'INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const createMeal = db.transaction(() => {
      const result = insertMeal.run(familyId, name, tag, instructionsStr, source_url, image_url);
      const mealId = result.lastInsertRowid;
      for (const ing of ingredients) {
        insertIngredient.run(
          mealId,
          ing.name,
          ing.amount,
          ing.measure,
          ing.calories,
          ing.protein,
          ing.fat,
          ing.carbs
        );
      }
      return mealId;
    });

    try {
      const newMealId = createMeal();
      res.json({ id: newMealId, success: true });
    } catch {
      res.status(500).json({ error: 'Failed to create meal' });
    }
  });

  app.put('/api/meals/:id', (req, res) => {
    const familyId = parseFamilyId(req);
    const id = parseIdParam(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const parsed = validateMealBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { name, tag, source_url, image_url, instructionsStr, ingredients } = parsed.data;

    const updateMeal = db.prepare(
      'UPDATE meals SET name = ?, tag = ?, instructions = ?, source_url = ?, image_url = ? WHERE id = ? AND family_id = ?'
    );
    const deleteIngredients = db.prepare('DELETE FROM ingredients WHERE meal_id = ?');
    const insertIngredient = db.prepare(
      'INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const updateTransaction = db.transaction(() => {
      const result = updateMeal.run(name, tag, instructionsStr, source_url, image_url, id, familyId);
      if (result.changes === 0) {
        throw new Error('NOT_FOUND');
      }
      deleteIngredients.run(id);
      for (const ing of ingredients) {
        insertIngredient.run(
          id,
          ing.name,
          ing.amount,
          ing.measure,
          ing.calories,
          ing.protein,
          ing.fat,
          ing.carbs
        );
      }
    });

    try {
      updateTransaction();
      res.json({ success: true });
    } catch (e) {
      if (e instanceof Error && e.message === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Meal not found' });
      }
      res.status(500).json({ error: 'Failed to update meal' });
    }
  });

  app.delete('/api/meals/:id', (req, res) => {
    const familyId = parseFamilyId(req);
    const id = parseIdParam(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    try {
      const result = db.prepare('DELETE FROM meals WHERE id = ? AND family_id = ?').run(id, familyId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Meal not found' });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete meal' });
    }
  });

  app.get('/api/planner', (req, res) => {
    const familyId = parseFamilyId(req);
    const planner = db
      .prepare(
        `
      SELECT p.id, p.date, p.meal_id, m.name as meal_name 
      FROM planner p 
      JOIN meals m ON p.meal_id = m.id
      WHERE p.family_id = ?
    `
      )
      .all(familyId);
    res.json(planner);
  });

  app.post('/api/planner', (req, res) => {
    const familyId = parseFamilyId(req);
    const { date, meal_id } = req.body || {};
    const dateStr = typeof date === 'string' ? date.trim() : '';
    const mealIdNum = Number(meal_id);
    if (!dateStr || !Number.isInteger(mealIdNum) || mealIdNum < 1) {
      return res.status(400).json({ error: 'date and meal_id are required' });
    }
    const meal = db
      .prepare('SELECT id FROM meals WHERE id = ? AND family_id = ?')
      .get(mealIdNum, familyId) as { id: number } | undefined;
    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }
    try {
      const result = db
        .prepare('INSERT INTO planner (family_id, date, meal_id) VALUES (?, ?, ?)')
        .run(familyId, dateStr, mealIdNum);
      res.json({ id: result.lastInsertRowid, success: true });
    } catch {
      res.status(500).json({ error: 'Failed to add to planner' });
    }
  });

  app.delete('/api/planner/:id', (req, res) => {
    const familyId = parseFamilyId(req);
    const id = parseIdParam(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    try {
      const result = db.prepare('DELETE FROM planner WHERE id = ? AND family_id = ?').run(id, familyId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Planner entry not found' });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to remove from planner' });
    }
  });

  // Pantry Routes
  app.get('/api/pantry', (req, res) => {
    const familyId = parseFamilyId(req);
    const pantry = db.prepare('SELECT * FROM pantry WHERE family_id = ?').all(familyId);
    res.json(pantry);
  });

  app.post('/api/pantry', (req, res) => {
    const familyId = parseFamilyId(req);
    const { name, amount, measure } = req.body || {};
    const pantryName = typeof name === 'string' ? name.trim() : '';
    if (!pantryName || pantryName.length > 200) {
      return res.status(400).json({ error: 'name is required' });
    }
    const amt = Number(amount);
    const meas = typeof measure === 'string' && measure.trim() ? measure.trim().slice(0, 100) : 'Unit';
    if (!Number.isFinite(amt)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    try {
      const result = db
        .prepare('INSERT INTO pantry (family_id, name, amount, measure) VALUES (?, ?, ?, ?)')
        .run(familyId, pantryName, amt, meas);
      res.json({ id: result.lastInsertRowid, success: true });
    } catch {
      res.status(500).json({ error: 'Failed to add to pantry' });
    }
  });

  app.delete('/api/pantry/:id', (req, res) => {
    const familyId = parseFamilyId(req);
    const id = parseIdParam(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    try {
      const result = db.prepare('DELETE FROM pantry WHERE id = ? AND family_id = ?').run(id, familyId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Pantry item not found' });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to remove from pantry' });
    }
  });

  registerAiRoutes(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
