import { addDays, startOfWeek } from 'date-fns';

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PlannerMealRequester = (
  url: string,
  options?: RequestInit,
) => Promise<Response>;

export function getPlannerWeek(date: Date, weekStartsOn: WeekStart): Date[] {
  const start = startOfWeek(date, { weekStartsOn });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function clampSelectedDayToWeek(selectedDay: Date, weekDays: Date[]): Date {
  if (weekDays.length === 0) return selectedDay;

  const firstDay = weekDays[0];
  const lastDay = weekDays[weekDays.length - 1];
  if (selectedDay < firstDay) return firstDay;
  if (selectedDay > lastDay) return lastDay;
  return selectedDay;
}

export function shiftSelectedDayByWeek(
  selectedDay: Date,
  weekOffset: number,
  weekStartsOn: WeekStart,
): Date {
  return addDays(selectedDay, weekOffset * 7);
}

export async function requestPlannerMeal(
  request: PlannerMealRequester,
  date: string,
  mealId: number,
  servingsOverride: number | null,
  fallbackError: string,
): Promise<void> {
  const response = await request('/api/planner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, meal_id: mealId, servings_override: servingsOverride }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || fallbackError);
  }
}
