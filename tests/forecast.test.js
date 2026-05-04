import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastHoltWinters } from '../js/forecast.js';

test('3 veya daha az değer varsa boş dizi döner', () => {
  assert.deepEqual(forecastHoltWinters([5, 6]), []);
  assert.deepEqual(forecastHoltWinters([]), []);
});

test('varsayılan olarak 3 tahmin periyodu döner', () => {
  const result = forecastHoltWinters([5, 6, 7, 8]);
  assert.equal(result.length, 3);
});

test('özel periods parametresi', () => {
  const result = forecastHoltWinters([5, 6, 7], 5);
  assert.equal(result.length, 5);
});

test('null değerleri filtreler, geri kalanlarla tahmin üretir', () => {
  const result = forecastHoltWinters([5, null, 6, 7, 8]);
  assert.equal(result.length, 3);
});

test('yükselen seride yukarı trend yansıtır', () => {
  const result = forecastHoltWinters([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(result[0] > 10, 'ilk tahmin son değerden büyük olmalı');
  assert.ok(result[1] > result[0], 'trend devam etmeli');
});

test('düşen seride aşağı trend yansıtır', () => {
  const result = forecastHoltWinters([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.ok(result[0] < 1, 'ilk tahmin son değerden küçük olmalı');
});

test('sabit seride trend sıfıra yakın', () => {
  const result = forecastHoltWinters([5, 5, 5, 5, 5]);
  assert.ok(Math.abs(result[0] - 5) < 0.5, 'sabit seriden sapma küçük olmalı');
});
