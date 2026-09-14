import { normalizeIngredientName } from '../src/lib/units.js';

export interface IngredientMatch {
  canonicalName: string;
  source: 'exact' | 'fuzzy';
  score: number;
}

export function normalizeReceiptKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function normalizeStoreKey(value?: string | null): string | null {
  if (!value) return null;
  const key = normalizeReceiptKey(value);
  return key || null;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

export function ingredientSimilarity(leftRaw: string, rightRaw: string): number {
  const left = normalizeReceiptKey(leftRaw);
  const right = normalizeReceiptKey(rightRaw);
  if (!left || !right) return 0;
  if (left === right) return 1;

  if (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left))) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const maxLength = Math.max(left.length, right.length);
  return 1 - levenshteinDistance(left, right) / maxLength;
}

export function findIngredientMatch(
  candidateRaw: string,
  canonicalNames: string[],
): IngredientMatch | null {
  const candidate = normalizeIngredientName(candidateRaw);
  if (!candidate) return null;

  const exact = canonicalNames.find(
    (name) => normalizeIngredientName(name) === candidate,
  );
  if (exact) {
    return { canonicalName: exact, source: 'exact', score: 1 };
  }

  let best: IngredientMatch | null = null;
  for (const name of canonicalNames) {
    const score = ingredientSimilarity(candidateRaw, name);
    if (!best || score > best.score) {
      best = { canonicalName: name, source: 'fuzzy', score };
    }
  }

  return best && best.score >= 0.82 ? best : null;
}
