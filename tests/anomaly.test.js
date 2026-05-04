import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalies } from '../js/anomaly.js';

const makeData = (weeklyGenels) => ({
  weeks: weeklyGenels.map((_, i) => `2026-H${String(i + 1).padStart(2, '0')}`),
  players: [{ name: 'Ahmet', weeklyGenels }],
});

test('null girdi için boş dizi döner', () => {
  assert.deepEqual(detectAnomalies(null), []);
});

test('MIN_WEEKS (5) altında veri varsa boş dizi döner', () => {
  assert.deepEqual(detectAnomalies(makeData([5, 6, 7, 8])), []);
});

test('yüksek anomali tespit eder', () => {
  // MAD >= 0.3 olması için hafif varyasyon gerekli: [5,6,5,6,5,9.5]
  const result = detectAnomalies(makeData([5, 6, 5, 6, 5, 9.5]));
  assert.equal(result.length, 1);
  assert.equal(result[0].direction, 'high');
  assert.equal(result[0].player, 'Ahmet');
});

test('düşük anomali tespit eder', () => {
  const result = detectAnomalies(makeData([7, 8, 7, 8, 7, 1]));
  assert.equal(result.length, 1);
  assert.equal(result[0].direction, 'low');
});

test('tekdüze seride anomali yok (MAD sıfır, MAD_FLOOR eşiği geçilemiyor)', () => {
  const result = detectAnomalies(makeData([5, 5, 5, 5, 5, 5]));
  assert.deepEqual(result, []);
});

test('sonuçlar mutlak modZ değerine göre azalan sıralanır', () => {
  const data = {
    weeks: ['H01', 'H02', 'H03', 'H04', 'H05', 'H06'],
    players: [
      { name: 'A', weeklyGenels: [5, 6, 5, 6, 5, 9.5] },
      { name: 'B', weeklyGenels: [5, 6, 5, 6, 5, 9.9] },
    ],
  };
  const result = detectAnomalies(data);
  assert.ok(result.length >= 2);
  assert.ok(Math.abs(result[0].modZ) >= Math.abs(result[1].modZ));
});

test('anomali objesinde beklenen alanlar var', () => {
  const result = detectAnomalies(makeData([5, 6, 5, 6, 5, 9.5]));
  assert.equal(result.length, 1);
  const r = result[0];
  assert.ok('player' in r);
  assert.ok('week' in r);
  assert.ok('score' in r);
  assert.ok('median' in r);
  assert.ok('modZ' in r);
  assert.ok('direction' in r);
});
