import assert from 'node:assert/strict';
import test from 'node:test';
import { format } from 'date-fns';
import {
  clampSelectedDayToWeek,
  getPlannerWeek,
  requestPlannerMeal,
  shiftSelectedDayByWeek,
} from './mobile-planner';

const iso = (date: Date) => format(date, 'yyyy-MM-dd');

test('planner week respects Sunday and Monday preferences', () => {
  const selected = new Date(2026, 9, 7, 12); // Wednesday, 7 October
  const sundayWeek = getPlannerWeek(selected, 0);
  const mondayWeek = getPlannerWeek(selected, 1);

  assert.equal(iso(sundayWeek[0]), '2026-10-04');
  assert.equal(iso(sundayWeek[6]), '2026-10-10');
  assert.equal(iso(mondayWeek[0]), '2026-10-05');
  assert.equal(iso(mondayWeek[6]), '2026-10-11');
  assert.equal(iso(clampSelectedDayToWeek(selected, mondayWeek)), '2026-10-07');
});

test('week navigation retains the selected weekday and stays inside the new week', () => {
  const selected = new Date(2026, 9, 7, 12);
  for (const weekStartsOn of [0, 1] as const) {
    for (const offset of [-1, 1]) {
      const shifted = shiftSelectedDayByWeek(selected, offset, weekStartsOn);
      const visibleWeek = getPlannerWeek(shifted, weekStartsOn);
      assert.equal(iso(shifted), iso(new Date(2026, 9, 7 + offset * 7, 12)));
      assert.ok(shifted >= visibleWeek[0] && shifted <= visibleWeek[6]);
    }
  }
});

test('selected day is bounded to visible week after a week-start preference change', () => {
  const mondaySelected = new Date(2026, 9, 5, 12);
  const sundayWeek = getPlannerWeek(mondaySelected, 0);

  assert.equal(iso(clampSelectedDayToWeek(mondaySelected, sundayWeek)), '2026-10-05');
  assert.equal(iso(clampSelectedDayToWeek(new Date(2026, 9, 3, 12), sundayWeek)), '2026-10-04');
  assert.equal(iso(clampSelectedDayToWeek(new Date(2026, 9, 11, 12), sundayWeek)), '2026-10-10');
});

test('planner meal add sends the existing API body and accepts a successful response', async () => {
  let requestUrl = '';
  let requestOptions: RequestInit | undefined;

  await requestPlannerMeal(async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(null, { status: 201 });
  }, '2026-10-07', 42, 6, 'Add failed');

  assert.equal(requestUrl, '/api/planner');
  assert.equal(requestOptions?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requestOptions?.body)), {
    date: '2026-10-07',
    meal_id: 42,
    servings_override: 6,
  });
});

test('planner meal add rejects non-success responses with server or fallback errors', async () => {
  await assert.rejects(
    requestPlannerMeal(
      async () => new Response(JSON.stringify({ error: 'Meal already scheduled' }), { status: 409 }),
      '2026-10-07',
      42,
      null,
      'Add failed',
    ),
    { message: 'Meal already scheduled' },
  );

  await assert.rejects(
    requestPlannerMeal(
      async () => new Response('unavailable', { status: 503 }),
      '2026-10-07',
      42,
      null,
      'Add failed',
    ),
    { message: 'Add failed' },
  );
});

test('planner meal add surfaces network failures to its caller', async () => {
  await assert.rejects(
    requestPlannerMeal(
      async () => { throw new Error('Network unavailable'); },
      '2026-10-07',
      42,
      null,
      'Add failed',
    ),
    { message: 'Network unavailable' },
  );
});
