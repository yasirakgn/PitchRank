import { CRITERIA } from './config.js';
import { state } from './state.js';
import { normPos, attendCount } from './utils.js';

const MIN_ATTEND = 3;

function criteriaAvg(p, c) {
  if (!p || !p.weeklyKriterler) return null;
  const vals = [];
  Object.values(p.weeklyKriterler).forEach(wk => {
    if (wk && wk[c] != null) vals.push(+wk[c]);
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function playerVector(p) {
  const vec = CRITERIA.map(c => criteriaAvg(p, c));
  if (vec.some(v => v === null)) return null;
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return (ma && mb) ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
}

// Hybrid: same position first (sorted by similarity), then cross-position.
export function findSimilarPlayers(targetName, resultData, limit = 3) {
  if (!resultData || !Array.isArray(resultData.players)) return [];
  const target = resultData.players.find(p => p.name === targetName);
  if (!target) return [];
  const targetVec = playerVector(target);
  if (!targetVec) return [];
  const targetObj = state.players.find(p => p.name === targetName) || { pos: ['OMO'] };
  const targetPos = normPos(targetObj)[0];

  const candidates = [];
  for (const p of resultData.players) {
    if (p.name === targetName) continue;
    if (attendCount(p) < MIN_ATTEND) continue;
    const vec = playerVector(p);
    if (!vec) continue;
    const obj = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
    const pos = normPos(obj)[0];
    candidates.push({
      name: p.name,
      pos,
      sim: cosineSim(targetVec, vec),
      samePos: pos === targetPos,
    });
  }

  candidates.sort((a, b) => {
    if (a.samePos !== b.samePos) return a.samePos ? -1 : 1;
    return b.sim - a.sim;
  });

  return candidates.slice(0, limit);
}
