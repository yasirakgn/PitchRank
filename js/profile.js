import { CRITERIA, CDISP, TEAM_CONFIG } from './config.js';
import { state } from './state.js';
import { escHtml, posLabel, getPlayerPhoto, scoreColor, showToast } from './utils.js';
import { posRating } from './rating.js';

// ── Yardımcı hesaplama fonksiyonları ─────────────────────────────────────────

function criteriaAvg(playerData, criterion) {
  if (!playerData || !playerData.weeklyKriterler) return 0;
  const vals = [];
  Object.values(playerData.weeklyKriterler).forEach(wk => {
    if (wk && wk[criterion] != null) vals.push(+wk[criterion]);
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function attendanceCount(playerData) {
  if (!playerData || !Array.isArray(playerData.weeklyGenels)) return 0;
  return playerData.weeklyGenels.filter(v => v != null).length;
}

function isLeader(playerData, resultData) {
  if (!resultData || !Array.isArray(resultData.players) || !playerData) return false;
  const sorted = [...resultData.players]
    .filter(p => p.genelOrt != null)
    .sort((a, b) => b.genelOrt - a.genelOrt);
  return sorted.length > 0 && sorted[0].name === playerData.name;
}

function hasConsecutiveTop3(playerData, resultData, count) {
  if (!resultData || !Array.isArray(resultData.weeks) || !Array.isArray(resultData.players) || !playerData) return false;
  const weeks = resultData.weeks;
  if (weeks.length < count) return false;
  const lastN = weeks.slice(-count);
  for (const week of lastN) {
    const weekIdx = weeks.indexOf(week);
    const scores = resultData.players
      .map(p => ({ name: p.name, score: Array.isArray(p.weeklyGenels) ? p.weeklyGenels[weekIdx] : null }))
      .filter(p => p.score != null)
      .sort((a, b) => b.score - a.score);
    const rank = scores.findIndex(s => s.name === playerData.name);
    if (rank === -1 || rank >= 3) return false;
  }
  return true;
}

function getTotalGoals(name, matchesData) {
  if (!matchesData || !Array.isArray(matchesData.matches)) return 0;
  return matchesData.matches.reduce((sum, m) => {
    const entry = m.goals && m.goals[name];
    return sum + (entry && entry.g ? +entry.g : 0);
  }, 0);
}

function getTotalAssists(name, matchesData) {
  if (!matchesData || !Array.isArray(matchesData.matches)) return 0;
  return matchesData.matches.reduce((sum, m) => {
    const entry = m.goals && m.goals[name];
    return sum + (entry && entry.a ? +entry.a : 0);
  }, 0);
}

// ── Rozet Tanımları ve Hesaplama ─────────────────────────────────────────────

const BADGE_DEFS = [
  { id: 'maestro',  icon: '🎯', name: 'Maestro',     desc: 'Pas ortalaması 8.0+',           check: (p)        => criteriaAvg(p, 'Pas') >= 8.0 },
  { id: 'fuze',     icon: '🚀', name: 'Füze',         desc: 'Şut ortalaması 8.0+',           check: (p)        => criteriaAvg(p, 'Sut') >= 8.0 },
  { id: 'cambaz',   icon: '🪄', name: 'Cambaz',       desc: 'Dribling ortalaması 8.0+',      check: (p)        => criteriaAvg(p, 'Dribling') >= 8.0 },
  { id: 'duvar',    icon: '🧱', name: 'Duvar',         desc: 'Savunma ortalaması 8.0+',       check: (p)        => criteriaAvg(p, 'Savunma') >= 8.0 },
  { id: 'motor',    icon: '⚡', name: 'Motor',         desc: 'Hız/Kondisyon ortalaması 8.0+', check: (p)        => criteriaAvg(p, 'Hiz / Kondisyon') >= 8.0 },
  { id: 'tank',     icon: '🦍', name: 'Tank',          desc: 'Fizik ortalaması 8.0+',         check: (p)        => criteriaAvg(p, 'Fizik') >= 8.0 },
  { id: 'joker',    icon: '🤝', name: 'Joker',         desc: 'Takım Oyunu ortalaması 8.0+',   check: (p)        => criteriaAvg(p, 'Takim Oyunu') >= 8.0 },
  { id: 'ates',     icon: '🔥', name: 'Ateş',          desc: '3 hafta üst üste ilk 3 sıra',  check: (p, rd)    => hasConsecutiveTop3(p, rd, 3) },
  { id: 'devamli',  icon: '📅', name: 'Devamlı',       desc: '5+ maça katılım',               check: (p)        => attendanceCount(p) >= 5 },
  { id: 'lider',    icon: '👑', name: 'Lider',          desc: 'Sezon genel sıralaması 1.',    check: (p, rd)    => isLeader(p, rd) },
  { id: 'golcu',    icon: '⚽', name: 'Golcü',          desc: '5+ gol bu sezon',               check: (p, _, md) => getTotalGoals(p && p.name, md) >= 5 },
  { id: 'asist',    icon: '🅰️', name: 'Asist Kralı',   desc: '5+ asist bu sezon',             check: (p, _, md) => getTotalAssists(p && p.name, md) >= 5 },
];

export function computeBadges(playerData, resultData, matchesData) {
  return BADGE_DEFS.map(def => ({
    id: def.id,
    icon: def.icon,
    name: def.name,
    desc: def.desc,
    earned: !!(playerData && def.check(playerData, resultData, matchesData)),
  }));
}
