import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groceryChecksStorageKey,
  readGroceryChecks,
  toggleGroceryCheck,
  writeGroceryChecks,
} from './grocery-checks';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test('grocery checks survive a reload and stay scoped to household and week', () => {
  const storage = createStorage();
  const currentWeekKey = groceryChecksStorageKey('family-a', '2026-09-28');
  const nextWeekKey = groceryChecksStorageKey('family-a', '2026-10-05');
  const otherFamilyKey = groceryChecksStorageKey('family-b', '2026-09-28');
  const checked = toggleGroceryCheck({}, 'tomato');

  writeGroceryChecks(storage, currentWeekKey, checked);

  assert.deepEqual(readGroceryChecks(storage, currentWeekKey), { tomato: true });
  assert.deepEqual(readGroceryChecks(storage, nextWeekKey), {});
  assert.deepEqual(readGroceryChecks(storage, otherFamilyKey), {});
});

test('grocery check storage ignores invalid or malformed values', () => {
  const storage = createStorage();
  const key = groceryChecksStorageKey('default', '2026-09-28');
  storage.setItem(key, JSON.stringify({ tomato: true, flour: 'yes', oil: false }));

  assert.deepEqual(readGroceryChecks(storage, key), { tomato: true, oil: false });

  storage.setItem(key, '{invalid');
  assert.deepEqual(readGroceryChecks(storage, key), {});
});
