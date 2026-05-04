import { CRITERIA, POS_WEIGHTS } from './config.js';
import { normPos } from './utils.js';

// Preset criterion multipliers — adjust the implicit weights for the search target.
const PRESETS = {
  dengeli: { Pas: 1.00, Sut: 1.00, Dribling: 1.00, Savunma: 1.00, 'Hiz / Kondisyon': 1.00, Fizik: 1.00, 'Takim Oyunu': 1.00 },
  hucum:   { Pas: 1.00, Sut: 1.50, Dribling: 1.40, Savunma: 0.60, 'Hiz / Kondisyon': 1.20, Fizik: 1.00, 'Takim Oyunu': 1.00 },
  savunma: { Pas: 1.10, Sut: 0.70, Dribling: 0.70, Savunma: 1.50, 'Hiz / Kondisyon': 1.00, Fizik: 1.30, 'Takim Oyunu': 1.10 },
  hizli:   { Pas: 1.00, Sut: 1.00, Dribling: 1.20, Savunma: 0.80, 'Hiz / Kondisyon': 1.60, Fizik: 1.00, 'Takim Oyunu': 0.90 },
};

export const PRESET_META = {
  dengeli: { label: 'Dengeli', emoji: '⚖️' },
  hucum:   { label: 'Hücum',   emoji: '⚔️' },
  savunma: { label: 'Savunma', emoji: '🛡️' },
  hizli:   { label: 'Hızlı',   emoji: '⚡' },
};

export const PRESET_KEYS = ['dengeli', 'hucum', 'savunma', 'hizli'];

function scorePlayer(pData, pObj, preset) {
  const posKey = normPos(pObj)[0] || 'OMO';
  const posWeights = POS_WEIGHTS[posKey] || POS_WEIGHTS.OMO;
  if (!pData || !pData.weeklyKriterler) return 5;
  let total = 0, wSum = 0;
  CRITERIA.forEach((c, ci) => {
    const vals = [];
    Object.values(pData.weeklyKriterler).forEach(wk => {
      if (wk && wk[c] != null) vals.push(+wk[c]);
    });
    if (!vals.length) return;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const w = posWeights[ci] * (preset[c] || 1);
    total += avg * w;
    wSum += w;
  });
  return wSum > 0 ? total / wSum : 5;
}

// Generator over all C(n, k) combinations.
function* combinations(arr, k) {
  const n = arr.length;
  if (k > n || k < 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map(i => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

// Position constraint for 5-aside futsal: 0-1 KL, 1-2 DEF, 1-2 OMO, 1 FRV.
function validLineup(lineup) {
  const c = { KL: 0, DEF: 0, OMO: 0, FRV: 0 };
  for (const p of lineup) c[p.posKey] = (c[p.posKey] || 0) + 1;
  if (c.KL > 1 || c.FRV !== 1) return false;
  if (c.DEF < 1 || c.DEF > 2) return false;
  if (c.OMO < 1 || c.OMO > 2) return false;
  return c.KL + c.DEF + c.OMO + c.FRV === 5;
}

export function findOptimalLineup(available, presetKey = 'dengeli') {
  const preset = PRESETS[presetKey] || PRESETS.dengeli;
  const enriched = available.map(({ pObj, pData }) => ({
    name: pObj.name,
    pObj,
    pData,
    posKey: normPos(pObj)[0] || 'OMO',
    score: scorePlayer(pData, pObj, preset),
  }));
  if (enriched.length < 5) return null;

  let best = null;
  let bestSum = -Infinity;
  for (const combo of combinations(enriched, 5)) {
    if (!validLineup(combo)) continue;
    const sum = combo.reduce((s, p) => s + p.score, 0);
    if (sum > bestSum) {
      bestSum = sum;
      best = combo;
    }
  }
  return best ? { lineup: best, totalScore: bestSum, preset: presetKey } : null;
}
