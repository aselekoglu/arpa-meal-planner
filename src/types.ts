export interface Ingredient {
  id: number;
  meal_id: number;
  name: string;
  amount: number;
  measure: string;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

export interface Meal {
  id: number;
  name: string;
  tag: string;
  servings: number;
  image_url: string | null;
  instructions: string[] | null;
  source_url: string | null;
  ingredients: Ingredient[];
}

export interface PlannerItem {
  id: number;
  date: string;
  meal_id: number;
  meal_name: string;
  servings_override: number | null;
}

export interface PantryItem {
  id: number;
  name: string;
  amount: number;
  measure: string;
}
