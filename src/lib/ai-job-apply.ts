import type { Ingredient } from '../types';

type EstimatedRow = Record<string, unknown>;

/**
 * Merge AI nutrition rows onto existing ingredient rows (same logic as AddMealModal).
 */
export function applyNutritionEstimatesToIngredients(
  prev: Partial<Ingredient>[],
  estimated: EstimatedRow[],
): Partial<Ingredient>[] {
  const next = [...prev];
  const used = new Set<number>();
  for (let i = 0; i < next.length; i += 1) {
    const baseName = (next[i].name || '').trim().toLowerCase();
    const foundIdx = estimated.findIndex(
      (item, idx) => !used.has(idx) && String(item.name || '').trim().toLowerCase() === baseName,
    );
    const fallbackIdx = foundIdx >= 0 ? foundIdx : estimated.findIndex((_, idx) => !used.has(idx));
    if (fallbackIdx < 0) continue;
    used.add(fallbackIdx);
    const item = estimated[fallbackIdx];
    next[i] = {
      ...next[i],
      calories: Math.max(0, Number(item.calories) || 0),
      protein: Math.max(0, Number(item.protein) || 0),
      fat: Math.max(0, Number(item.fat) || 0),
      carbs: Math.max(0, Number(item.carbs) || 0),
    };
  }
  return next;
}
