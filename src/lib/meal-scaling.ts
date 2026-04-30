import { Ingredient, Meal } from '../types';

export type NutritionTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

function toPositiveInt(value: number | null | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : fallback;
}

export function getMealBaseServings(meal: Pick<Meal, 'servings'>): number {
  return toPositiveInt(meal.servings, 4);
}

export function resolveEffectiveServings(
  meal: Pick<Meal, 'servings'>,
  servingsOverride?: number | null
): number {
  return toPositiveInt(servingsOverride, getMealBaseServings(meal));
}

export function getServingsScaleFactor(
  meal: Pick<Meal, 'servings'>,
  effectiveServings?: number | null
): number {
  const base = getMealBaseServings(meal);
  const target = effectiveServings == null ? base : toPositiveInt(effectiveServings, base);
  return target / base;
}

export function scaleIngredientAmount(
  ingredient: Pick<Ingredient, 'amount'>,
  meal: Pick<Meal, 'servings'>,
  effectiveServings?: number | null
): number {
  return ingredient.amount * getServingsScaleFactor(meal, effectiveServings);
}

export function getScaledIngredients(
  meal: Meal,
  effectiveServings?: number | null
): Array<Ingredient & { scaledAmount: number }> {
  return meal.ingredients.map((ingredient) => ({
    ...ingredient,
    scaledAmount: scaleIngredientAmount(ingredient, meal, effectiveServings),
  }));
}

export function getScaledMealNutritionTotals(
  meal: Meal,
  effectiveServings?: number | null
): NutritionTotals {
  const factor = getServingsScaleFactor(meal, effectiveServings);
  return meal.ingredients.reduce<NutritionTotals>(
    (sum, ingredient) => ({
      calories: sum.calories + (ingredient.calories || 0) * factor,
      protein: sum.protein + (ingredient.protein || 0) * factor,
      fat: sum.fat + (ingredient.fat || 0) * factor,
      carbs: sum.carbs + (ingredient.carbs || 0) * factor,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}
