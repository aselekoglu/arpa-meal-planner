import assert from 'node:assert/strict';
import test from 'node:test';
import { geminiImageDataUri, geminiJsonGenerationConfig } from './gemini-provider.js';

test('Gemini JSON generation keeps Search enabled without forcing JSON response mode', () => {
  const config = geminiJsonGenerationConfig({ useWebSearch: true });

  assert.deepEqual(config.tools, [{ googleSearch: {} }]);
  assert.equal(config.responseMimeType, undefined);
});

test('Gemini JSON generation uses JSON response mode when Search is disabled', () => {
  const config = geminiJsonGenerationConfig({ useWebSearch: false });

  assert.equal(config.tools, undefined);
  assert.equal(config.responseMimeType, 'application/json');
});

test('Gemini image data URI preserves the provider image MIME type', () => {
  assert.equal(geminiImageDataUri('image/jpeg', 'ZmFrZQ=='), 'data:image/jpeg;base64,ZmFrZQ==');
  assert.equal(geminiImageDataUri(undefined, 'ZmFrZQ=='), 'data:image/png;base64,ZmFrZQ==');
});
