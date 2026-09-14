import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReceiptAnalysis,
  validateReceiptImportRequest,
} from './validators.js';

test('receipt analysis keeps unknown nullable numbers undefined', () => {
  const result = validateReceiptAnalysis({
    merchant: 'Farm Boy',
    items: [
      {
        id: '1',
        rawName: 'FB MINI CUC',
        proposedName: 'Mini cucumber',
        quantity: null,
        amount: null,
        unitPrice: null,
        totalPrice: null,
        status: 'unresolved',
      },
    ],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amount, undefined);
  assert.equal(result.items[0].quantity, undefined);
  assert.equal(result.items[0].unitPrice, undefined);
  assert.equal(result.items[0].totalPrice, undefined);
});

test('receipt import accepts OpenAI as a scanner engine', () => {
  const result = validateReceiptImportRequest({
    scannerEngine: 'openai',
    merchant: 'Farm Boy',
    items: [
      {
        rawName: 'FB MINI CUC',
        canonicalName: 'Mini cucumber',
        amount: 6,
        measure: 'Unit',
        rememberAlias: true,
      },
    ],
  });

  assert.equal(result.scannerEngine, 'openai');
  assert.equal(result.items[0].rememberAlias, true);
});

test('receipt analysis rejects empty item lists', () => {
  assert.throws(
    () => validateReceiptAnalysis({ items: [] }),
    /No purchasable receipt items were detected/,
  );
});
