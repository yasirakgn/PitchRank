const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../js/utils.js');

test('criterion labels use Turkish-correct display values', () => {
  assert.equal(utils.criterionLabel('Sut'), 'Şut');
  assert.equal(utils.criterionLabel('Takim Oyunu'), 'Takım Oyunu');
  assert.equal(utils.criterionShortLabel('Dribling'), 'Drib.');
});

test('sanitizeKey transliterates Turkish characters before sanitizing', () => {
  assert.equal(utils.sanitizeKey('Çağrı Şen'), 'cagri_sen');
  assert.equal(utils.sanitizeKey('Hız / Kondisyon'), 'Hiz___Kondisyon');
});

test('toPhotoFilename normalizes Turkish characters and strips spaces', () => {
  assert.equal(utils.toPhotoFilename('Çağrı Şen'), 'cagrisen.png');
});

test('normPos maps aliases to canonical positions', () => {
  assert.deepEqual(utils.normPos({ pos: 'GK' }), ['KL']);
  assert.deepEqual(utils.normPos({ pos: 'ST' }), ['FRV']);
  assert.deepEqual(utils.normPos({ pos: 'UNKNOWN' }), ['OMO']);
});

test('formatMoney and ratingColor produce expected buckets', () => {
  assert.equal(utils.formatMoney(1500000), '€1.5M');
  assert.equal(utils.formatMoney(2800), '€3K');
  assert.equal(utils.formatMoney('x'), '€0');
  assert.deepEqual(utils.ratingColor(86), { text: '#eab308', bar: '#eab308' });
  assert.deepEqual(utils.ratingColor(60), { text: '#3b82f6', bar: '#3b82f6' });
});

test('computeWeekLabel handles manual override and deterministic dates', () => {
  assert.equal(utils.computeWeekLabel(new Date('2026-01-01T12:00:00Z')), '2026-H01');
  assert.equal(utils.computeWeekLabel(new Date('2026-12-31T12:00:00Z')), '2026-H53');
  assert.equal(utils.computeWeekLabel(new Date('2026-06-01T12:00:00Z'), '2026-H21'), '2026-H21');
});
