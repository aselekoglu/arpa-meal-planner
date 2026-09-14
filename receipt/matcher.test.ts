import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findIngredientMatch,
  ingredientSimilarity,
  normalizeReceiptKey,
  normalizeStoreKey,
} from './matcher.js';

test('normalizes receipt/store keys for stable aliases', () => {
  assert.equal(normalizeReceiptKey('FB MINI CUC 6-PK'), 'fbminicuc6pk');
  assert.equal(normalizeStoreKey('Farm Boy - Westboro'), 'farmboywestboro');
});

test('prefers exact canonical ingredient match', () => {
  const match = findIngredientMatch('Mini cucumber', [
    'Tomato',
    'Mini cucumber',
    'Cucumber',
  ]);
  assert.deepEqual(match, {
    canonicalName: 'Mini cucumber',
    source: 'exact',
    score: 1,
  });
});

test('accepts a strong fuzzy match and rejects a weak one', () => {
  const strong = findIngredientMatch('tomatos', ['Tomatoes', 'Avocado']);
  assert.ok(strong);
  assert.equal(strong?.canonicalName, 'Tomatoes');
  assert.equal(strong?.source, 'fuzzy');

  assert.equal(findIngredientMatch('xyz123', ['Tomatoes', 'Avocado']), null);
  assert.ok(ingredientSimilarity('chicken breast', 'Chicken breasts') > 0.82);
});
