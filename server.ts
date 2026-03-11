import express from 'express';
import { createServer as createViteServer } from 'vite';
import db from './db.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/meals', (req, res) => {
    const familyId = req.headers['x-family-id'] || 'default';
    const meals = db.prepare('SELECT * FROM meals WHERE family_id = ?').all(familyId);
    const ingredients = db.prepare('SELECT * FROM ingredients').all() as any[];
    
    const mealsWithIngredients = meals.map((meal: any) => {
      let parsedInstructions = null;
      if (meal.instructions) {
        try {
          parsedInstructions = JSON.parse(meal.instructions);
          if (!Array.isArray(parsedInstructions)) {
            parsedInstructions = [meal.instructions];
          }
        } catch (e) {
          parsedInstructions = meal.instructions.split('\n').filter((s: string) => s.trim());
        }
      }
      
      return {
        ...meal,
        instructions: parsedInstructions,
        ingredients: ingredients.filter(ing => ing.meal_id === meal.id)
      };
    });
    
    res.json(mealsWithIngredients);
  });

  app.post('/api/meals', (req, res) => {
    const familyId = req.headers['x-family-id'] || 'default';
    const { name, tag, ingredients, instructions, source_url, image_url } = req.body;
    
    const insertMeal = db.prepare('INSERT INTO meals (family_id, name, tag, instructions, source_url, image_url) VALUES (?, ?, ?, ?, ?, ?)');
    const insertIngredient = db.prepare('INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    const instructionsStr = Array.isArray(instructions) ? JSON.stringify(instructions) : (instructions ? JSON.stringify([instructions]) : null);
    
    const createMeal = db.transaction(() => {
      const result = insertMeal.run(familyId, name, tag || '', instructionsStr, source_url || null, image_url || null);
      const mealId = result.lastInsertRowid;
      
      if (ingredients && Array.isArray(ingredients)) {
        for (const ing of ingredients) {
          insertIngredient.run(mealId, ing.name, ing.amount, ing.measure, ing.calories || 0, ing.protein || 0, ing.fat || 0, ing.carbs || 0);
        }
      }
      return mealId;
    });
    
    try {
      const newMealId = createMeal();
      res.json({ id: newMealId, success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create meal' });
    }
  });

  app.put('/api/meals/:id', (req, res) => {
    const { id } = req.params;
    const { name, tag, ingredients, instructions, source_url, image_url } = req.body;
    
    const updateMeal = db.prepare('UPDATE meals SET name = ?, tag = ?, instructions = ?, source_url = ?, image_url = ? WHERE id = ?');
    const deleteIngredients = db.prepare('DELETE FROM ingredients WHERE meal_id = ?');
    const insertIngredient = db.prepare('INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    const instructionsStr = Array.isArray(instructions) ? JSON.stringify(instructions) : (instructions ? JSON.stringify([instructions]) : null);
    
    const updateTransaction = db.transaction(() => {
      updateMeal.run(name, tag || '', instructionsStr, source_url || null, image_url || null, id);
      deleteIngredients.run(id);
      
      if (ingredients && Array.isArray(ingredients)) {
        for (const ing of ingredients) {
          insertIngredient.run(id, ing.name, ing.amount, ing.measure, ing.calories || 0, ing.protein || 0, ing.fat || 0, ing.carbs || 0);
        }
      }
    });
    
    try {
      updateTransaction();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update meal' });
    }
  });

  app.delete('/api/meals/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM meals WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete meal' });
    }
  });

  app.get('/api/planner', (req, res) => {
    const familyId = req.headers['x-family-id'] || 'default';
    const planner = db.prepare(`
      SELECT p.id, p.date, p.meal_id, m.name as meal_name 
      FROM planner p 
      JOIN meals m ON p.meal_id = m.id
      WHERE p.family_id = ?
    `).all(familyId);
    res.json(planner);
  });

  app.post('/api/planner', (req, res) => {
    const familyId = req.headers['x-family-id'] || 'default';
    const { date, meal_id } = req.body;
    try {
      const result = db.prepare('INSERT INTO planner (family_id, date, meal_id) VALUES (?, ?, ?)').run(familyId, date, meal_id);
      res.json({ id: result.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add to planner' });
    }
  });

  app.delete('/api/planner/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM planner WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove from planner' });
    }
  });

  // Pantry Routes
  app.get('/api/pantry', (req, res) => {
    const familyId = req.headers['x-family-id'] || 'default';
    const pantry = db.prepare('SELECT * FROM pantry WHERE family_id = ?').all(familyId);
    res.json(pantry);
  });

  app.post('/api/pantry', (req, res) => {
    const familyId = req.headers['x-family-id'] || 'default';
    const { name, amount, measure } = req.body;
    try {
      const result = db.prepare('INSERT INTO pantry (family_id, name, amount, measure) VALUES (?, ?, ?, ?)').run(familyId, name, amount || 0, measure || 'Unit');
      res.json({ id: result.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add to pantry' });
    }
  });

  app.delete('/api/pantry/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM pantry WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove from pantry' });
    }
  });

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
