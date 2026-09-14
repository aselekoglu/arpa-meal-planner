import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText, sanitizeReceiptOcrText } from './text-parser.js';

test('parses common priced grocery lines and filters totals', () => {
  const result = parseReceiptText(`
FARM BOY
AVOCADO 1.99
FB MINI CUC 6PK 4.99
SUBTOTAL 6.98
HST 0.00
TOTAL 6.98
VISA 6.98
`);

  assert.equal(result.merchant, 'FARM BOY');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].proposedName, 'AVOCADO');
  assert.equal(result.items[0].totalPrice, 1.99);
  assert.equal(result.items[1].proposedName, 'FB MINI CUC');
  assert.equal(result.items[1].amount, 6);
  assert.equal(result.items[1].measure, 'Unit');
  assert.equal(result.rawText?.includes('VISA'), false);
});

test('extracts weighed produce amount', () => {
  const result = parseReceiptText('FARM BOY\nBANANAS 0.734 kg @ 1.99 1.46');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amount, 0.734);
  assert.equal(result.items[0].measure, 'Kilogram (kg)');
  assert.equal(result.items[0].totalPrice, 1.46);
});

test('extracts multiplier quantity', () => {
  const result = parseReceiptText('2 @ 1.99 AVOCADO 3.98');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amount, 2);
  assert.equal(result.items[0].measure, 'Unit');
  assert.equal(result.items[0].proposedName, 'AVOCADO');
});

test('sanitizes payment and long account identifiers before AI enhancement', () => {
  const text = sanitizeReceiptOcrText(`
FARM BOY
AVOCADO 1.99
VISA 4111 1111 1111 1111
AUTH 123456
123 MAIN STREET
TOTAL 1.99
`);

  assert.match(text, /AVOCADO 1\.99/);
  assert.doesNotMatch(text, /4111/);
  assert.doesNotMatch(text, /AUTH/);
  assert.doesNotMatch(text, /STREET/);
  assert.doesNotMatch(text, /TOTAL/);
});
