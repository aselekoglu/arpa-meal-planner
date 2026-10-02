export type GroceryChecks = Record<string, boolean>;
export type GroceryChecksStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function groceryChecksStorageKey(familyId: string, weekStart: string): string {
  return `groceryChecks:${encodeURIComponent(familyId)}:${weekStart}`;
}

export function readGroceryChecks(storage: GroceryChecksStorage, key: string): GroceryChecks {
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
  } catch {
    return {};
  }
}

export function writeGroceryChecks(
  storage: GroceryChecksStorage,
  key: string,
  checks: GroceryChecks,
): void {
  try {
    storage.setItem(key, JSON.stringify(checks));
  } catch {
    // Keep grocery interaction available when browser storage is unavailable.
  }
}

export function toggleGroceryCheck(checks: GroceryChecks, itemKey: string): GroceryChecks {
  return { ...checks, [itemKey]: !checks[itemKey] };
}
