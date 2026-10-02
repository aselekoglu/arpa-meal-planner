import type { Meal } from '../types';

/** Passed via react-router `location.state` for AI job restore navigation. */
export type AiJobNavigationState = {
  addMealRestore?: {
    mealId: number | null;
    partial: Partial<Meal>;
    scrollToIngredients?: boolean;
  };
  groceryCategoriesRestore?: { categories: Record<string, string> };
  plannerRefresh?: boolean;
};

export type AiJobRestorePayload = {
  path: string;
  state: AiJobNavigationState;
};

export function isAiJobNavigationState(value: unknown): value is AiJobNavigationState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.addMealRestore !== undefined ||
    v.groceryCategoriesRestore !== undefined ||
    v.plannerRefresh === true
  );
}

/** Merge server/current meal with AI patch for the edit modal. */
export function mergeMealForRestore(
  base: Meal | Partial<Meal> | null,
  partial: Partial<Meal>,
): Partial<Meal> | Meal {
  if (!base) {
    return { ...partial };
  }
  const next: Partial<Meal> & Record<string, unknown> = { ...base, ...partial };
  if (partial.ingredients !== undefined) {
    next.ingredients = partial.ingredients as Meal['ingredients'];
  }
  if (partial.instructions !== undefined) {
    next.instructions = partial.instructions;
  }
  if (partial.image_url !== undefined) {
    next.image_url = partial.image_url;
  }
  if (partial.source_url !== undefined) {
    next.source_url = partial.source_url;
  }
  return next as Meal | Partial<Meal>;
}
