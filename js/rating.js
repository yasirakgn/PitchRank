import { CRITERIA, POS_WEIGHTS } from './config.js';
import { state } from './state.js';
import { normPos } from './utils.js';

export function calcStdDev(playerData) {
  const vals = Array.isArray(playerData && playerData.weeklyGenels) ? playerData.weeklyGenels.filter(v => v != null) : [];
  if (vals.length < 2) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / vals.length);
}

export function posRating(playerData, pObj) {
  const posArr = normPos(pObj);
  const posScores = posArr.map(pos => {
    const weights = POS_WEIGHTS[pos] || POS_WEIGHTS['OMO'];
    let total = 0, wSum = 0;
    CRITERIA.forEach((c, ci) => {
      let vals = [];
      if (playerData.weeklyKriterler) {
        Object.values(playerData.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
      }
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        total += avg * weights[ci]; wSum += weights[ci];
      }
    });
    return wSum > 0 ? total / wSum : null;
  }).filter(v => v !== null);
  if (!posScores.length) return null;
  const baseScore = posScores.reduce((a, b) => a + b, 0) / posScores.length;
  const stdDev = calcStdDev(playerData);
  return baseScore * Math.max(0.85, 1 - (stdDev / 5) * 0.15);
}

export function calcMarketValue(p, data) {
  if (!data) return 0;
  const pObj = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
  let r = posRating(p, pObj);
  r = r !== null ? Math.min(99, Math.round(r * 10)) : (p.genelOrt ? Math.round(p.genelOrt * 10) : 50);
  if (isNaN(r) || r < 0) r = 50;
  const stdDev = calcStdDev(p);
  const totalWeeks = Array.isArray(data.weeks) ? data.weeks.length : 1;
  const attend = Array.isArray(p && p.weeklyGenels) ? p.weeklyGenels.filter(v => v != null).length : 0;
  const attRatio = totalWeeks ? (attend / totalWeeks) : 1;
  let base = Math.pow(1.12, r) * 3000;
  let val = base * Math.max(0.4, 1.2 - (stdDev / 2.5)) * (0.5 + (0.5 * attRatio));
  if (isNaN(val)) return 0;
  if (val > 1000000) val = Math.floor(val / 100000) * 100000;
  else if (val > 10000) val = Math.floor(val / 10000) * 10000;
  else val = Math.floor(val / 1000) * 1000;
  return val;
}

export function getPlayStyles(p) {
  const styles = [];
  if (!p.weeklyKriterler) return styles;
  const getAvg = (c) => {
    let vals = [];
    Object.values(p.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  if (getAvg('Hiz / Kondisyon') >= 8.0) styles.push({ icon: '⚡', name: 'Motor' });
  if (getAvg('Fizik') >= 8.0) styles.push({ icon: '🦍', name: 'Tank' });
  if (getAvg('Pas') >= 8.0) styles.push({ icon: '🎯', name: 'Maestro' });
  if (getAvg('Dribling') >= 8.0) styles.push({ icon: '🪄', name: 'Cambaz' });
  if (getAvg('Sut') >= 8.0) styles.push({ icon: '🚀', name: 'Füze' });
  if (getAvg('Savunma') >= 8.0) styles.push({ icon: '🧱', name: 'Duvar' });
  if (getAvg('Takim Oyunu') >= 8.0) styles.push({ icon: '🤝', name: 'Joker' });
  return styles;
}
