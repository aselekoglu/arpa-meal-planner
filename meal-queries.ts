import db from './db.js';

function parseInstructions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [String(parsed)];
  } catch {
    return raw.split('\n').filter((s: string) => s.trim());
  }
}

/** Meals for a family with ingredients loaded via join (no global ingredients scan). */
export function getMealsWithIngredients(familyId: string) {
  const meals = db.prepare('SELECT * FROM meals WHERE family_id = ?').all(familyId) as Record<string, unknown>[];
  const ingredients = db
    .prepare(
      `SELECT i.* FROM ingredients i
       INNER JOIN meals m ON m.id = i.meal_id
       WHERE m.family_id = ?`
    )
    .all(familyId) as { meal_id: number }[];

  return meals.map((meal: Record<string, unknown>) => ({
    ...meal,
    instructions: parseInstructions(meal.instructions as string | null),
    ingredients: ingredients.filter((ing) => ing.meal_id === meal.id),
  }));
}
