const test = require('node:test');
const assert = require('node:assert/strict');
const network = require('../js/network.js');
const storage = require('../js/storage.js');

test('toQuery encodes values deterministically', () => {
  const q = network.toQuery({ a: '1 2', b: 'x&y' });
  assert.equal(q, 'a=1%202&b=x%26y');
});

test('safeParse returns fallback on invalid JSON', () => {
  assert.deepEqual(storage.safeParse('{broken', { ok: false }), { ok: false });
  assert.deepEqual(storage.safeParse('{"ok":true}', { ok: false }), { ok: true });
});
