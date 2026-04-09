import type { Express, Request, Response } from 'express';
import { addDays, format, parseISO } from 'date-fns';
import { GoogleGenAI, Type } from '@google/genai';
import db from './db.js';
import { getMealsWithIngredients } from './meal-queries.js';

function geminiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k?.trim()) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }
  return k.trim();
}

function aiError(res: Response, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
  return res.status(status).json({ error: message });
}

export function registerAiRoutes(app: Express) {
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const familyId = String(req.headers['x-family-id'] || 'default').trim() || 'default';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    try {
      const meals = getMealsWithIngredients(familyId);
      const contextString =
        meals.length > 0
          ? `\n\nHere is the user's current meal database:\n${JSON.stringify(
              meals.map((m: Record<string, unknown>) => {
                const ings = Array.isArray(m.ingredients)
                  ? (m.ingredients as { amount: number; measure: string; name: string }[])
                  : [];
                return {
                  name: m.name,
                  tag: m.tag,
                  ingredients: ings.map((i) => `${i.amount} ${i.measure} ${i.name}`),
                };
              }),
              null,
              2
            )}`
          : '\n\nThe user currently has no saved meals.';

      const ai = new GoogleGenAI({ apiKey: geminiKey() });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `You are a helpful meal planning assistant. You can help users come up with recipes, meal plans, and answer questions about cooking. Use the user's meal database to suggest meals they already know how to make, or build meal plans based on their saved recipes.${contextString}`,
        },
      });

      const response = await chat.sendMessage({ message });
      return res.json({ text: response.text || '' });
    } catch (err) {
      return aiError(res, err, 'Chat failed');
    }
  });

  app.post('/api/ai/import-recipe', async (req: Request, res: Response) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey() });
      const prompt = `Search for a recipe for "${query}". 
      Extract the recipe name, a suitable category/tag (e.g., Italian, Dessert, Breakfast), the list of ingredients, and step-by-step instructions.
      If the query is a URL, extract the information from that specific URL and include it as the source_url.
      If you can find a high-quality image URL for the recipe, include it as image_url.
      For each ingredient, estimate the nutritional information (calories, protein, fat, carbs) based on standard nutritional databases.
      Return the result as a JSON object matching the provided schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              tag: { type: Type.STRING },
              instructions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Step-by-step instructions',
              },
              source_url: { type: Type.STRING },
              image_url: { type: Type.STRING },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    measure: { type: Type.STRING },
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                  },
                  required: ['name', 'amount', 'measure', 'calories', 'protein', 'fat', 'carbs'],
                },
              },
            },
            required: ['name', 'tag', 'ingredients'],
          },
        },
      });

      const data = JSON.parse(response.text || '{}');
      if (!data.name || !data.ingredients) {
        return res.status(422).json({ error: 'Failed to parse recipe data. Please try another query.' });
      }
      return res.json(data);
    } catch (err) {
      return aiError(res, err, 'Import failed');
    }
  });

  app.post('/api/ai/generate-plan', async (req: Request, res: Response) => {
    const familyId = String(req.headers['x-family-id'] || 'default').trim() || 'default';
    const diet = typeof req.body?.diet === 'string' ? req.body.diet.trim() : '';
    const startDateRaw = typeof req.body?.startDate === 'string' ? req.body.startDate.trim() : '';
    if (!diet || !startDateRaw) {
      return res.status(400).json({ error: 'startDate and diet are required' });
    }
    let start: Date;
    try {
      start = parseISO(startDateRaw);
      if (Number.isNaN(start.getTime())) throw new Error('bad date');
    } catch {
      return res.status(400).json({ error: 'Invalid startDate' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey() });
      const prompt = `Generate a 7-day dinner meal plan for a ${diet} diet.
      Return a JSON object with a 'meals' array containing exactly 7 meals (one for each day of the week).
      Each meal must have:
      - 'name': The name of the meal
      - 'tag': A short category tag (e.g., '${diet}', 'Dinner')
      - 'ingredients': An array of ingredients required for the meal.
      For each ingredient, provide:
      - 'name': Ingredient name
      - 'amount': Quantity (number)
      - 'measure': Unit of measurement (e.g., 'Gram (g)', 'Unit', 'Cup (c)', 'Tablespoon (Tbsp)')
      - 'calories': Estimated calories (number)
      - 'protein': Estimated protein in grams (number)
      - 'fat': Estimated fat in grams (number)
      - 'carbs': Estimated carbs in grams (number)
      Make sure the nutritional values are realistic and appropriate for the selected diet.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    tag: { type: Type.STRING },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          amount: { type: Type.NUMBER },
                          measure: { type: Type.STRING },
                          calories: { type: Type.NUMBER },
                          protein: { type: Type.NUMBER },
                          fat: { type: Type.NUMBER },
                          carbs: { type: Type.NUMBER },
                        },
                        required: ['name', 'amount', 'measure', 'calories', 'protein', 'fat', 'carbs'],
                      },
                    },
                  },
                  required: ['name', 'tag', 'ingredients'],
                },
              },
            },
            required: ['meals'],
          },
        },
      });

      const data = JSON.parse(response.text || '{}');
      if (!data.meals || !Array.isArray(data.meals) || data.meals.length !== 7) {
        return res.status(422).json({ error: 'Failed to generate a complete 7-day meal plan. Please try again.' });
      }

      const insertMeal = db.prepare(
        'INSERT INTO meals (family_id, name, tag, instructions, source_url, image_url) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const insertIngredient = db.prepare(
        'INSERT INTO ingredients (meal_id, name, amount, measure, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertPlanner = db.prepare('INSERT INTO planner (family_id, date, meal_id) VALUES (?, ?, ?)');

      const run = db.transaction(() => {
        for (let i = 0; i < 7; i++) {
          const meal = data.meals[i];
          const dateStr = format(addDays(start, i), 'yyyy-MM-dd');
          const instructionsStr = null;
          const mealResult = insertMeal.run(
            familyId,
            meal.name,
            meal.tag || '',
            instructionsStr,
            null,
            null
          );
          const mealId = mealResult.lastInsertRowid as number;
          for (const ing of meal.ingredients || []) {
            insertIngredient.run(
              mealId,
              ing.name,
              ing.amount,
              ing.measure,
              ing.calories || 0,
              ing.protein || 0,
              ing.fat || 0,
              ing.carbs || 0
            );
          }
          insertPlanner.run(familyId, dateStr, mealId);
        }
      });

      run();
      return res.json({ success: true });
    } catch (err) {
      return aiError(res, err, 'Generate plan failed');
    }
  });

  app.post('/api/ai/grocery-group', async (req: Request, res: Response) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }
    const names = items.map((x) => String(x).trim()).filter(Boolean);
    if (names.length === 0) {
      return res.status(400).json({ error: 'No valid item names' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey() });
      const prompt = `Categorize these grocery items into standard supermarket aisles (e.g., Produce, Dairy, Meat, Pantry, Bakery, Frozen, Household). Return a JSON object mapping each item name to its category. Items: ${names.join(', ')}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            description: 'Map of item name to category',
            additionalProperties: { type: Type.STRING },
          },
        },
      });

      const categories = JSON.parse(response.text || '{}') as Record<string, string>;
      return res.json({ categories });
    } catch (err) {
      return aiError(res, err, 'Grouping failed');
    }
  });

  app.post('/api/ai/generate-meal-image', async (req: Request, res: Response) => {
    const familyId = String(req.headers['x-family-id'] || 'default').trim() || 'default';
    const mealId = Number(req.body?.mealId);
    const size = typeof req.body?.size === 'string' ? req.body.size : '1K';
    if (!Number.isInteger(mealId) || mealId < 1) {
      return res.status(400).json({ error: 'mealId is required' });
    }

    const meal = db
      .prepare(
        `SELECT m.* FROM meals m
         WHERE m.id = ? AND m.family_id = ?`
      )
      .get(mealId, familyId) as Record<string, unknown> | undefined;
    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    const ingredients = db
      .prepare('SELECT name FROM ingredients WHERE meal_id = ? ORDER BY id')
      .all(mealId) as { name: string }[];

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey() });
      const prompt = `A high-quality, appetizing food photography shot of ${meal.name}, which is a ${meal.tag} dish. Ingredients include: ${ingredients.map((i) => i.name).join(', ')}. Professional lighting, shallow depth of field, delicious looking.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: size || '1K',
          },
        },
      });

      let imageUrl: string | null = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
          break;
        }
      }

      if (!imageUrl) {
        return res.status(422).json({ error: 'Failed to generate image' });
      }

      if (imageUrl.length > 2_000_000) {
        return res.status(413).json({ error: 'Generated image too large to store' });
      }

      const updated = db
        .prepare('UPDATE meals SET image_url = ? WHERE id = ? AND family_id = ?')
        .run(imageUrl, mealId, familyId);
      if (updated.changes === 0) {
        return res.status(404).json({ error: 'Meal not found' });
      }

      return res.json({ imageUrl });
    } catch (err) {
      return aiError(res, err, 'Image generation failed');
    }
  });
}
