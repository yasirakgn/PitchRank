import { CRITERIA, CDISP, TEAM_CONFIG } from './config.js';
import { state } from './state.js';
import { escHtml, posLabel, getPlayerPhoto, showToast } from './utils.js';

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
  const startIdx = weeks.length - count;
  for (let i = startIdx; i < weeks.length; i++) {
    const scores = resultData.players
      .map(p => ({ name: p.name, score: Array.isArray(p.weeklyGenels) ? p.weeklyGenels[i] : null }))
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
  { id: 'golcu',    icon: '⚽', name: 'Golcü',          desc: '5+ gol bu sezon',               check: (p, _, md) => getTotalGoals(p?.name, md) >= 5 },
  { id: 'asist',    icon: '🅰️', name: 'Asist Kralı',   desc: '5+ asist bu sezon',             check: (p, _, md) => getTotalAssists(p?.name, md) >= 5 },
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

// ── Render fonksiyonları ──────────────────────────────────────────────────────

function renderHeader(container, playerData, pObj) {
  const name = playerData ? playerData.name : (pObj ? pObj.name : '?');
  const photo = getPlayerPhoto(name);
  const posText = pObj ? posLabel(pObj) : '';
  const genelOrt = playerData && playerData.genelOrt != null ? playerData.genelOrt : null;
  const rating = genelOrt !== null ? Math.min(99, Math.round(genelOrt * 10)) : '—';
  const teamId = sessionStorage.getItem('pitchrank_selected_team') || 'haldunalagas';
  const teamColor = (TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas).color;

  container.innerHTML = `
    <div class="profile-header" style="border-top: 3px solid ${escHtml(teamColor)};">
      <img class="profile-avatar" src="${escHtml(photo)}" alt="${escHtml(name)}"
           onerror="this.src='assets/images/icon-192.png'">
      <div class="profile-header-info">
        <div class="profile-name">${escHtml(name)}</div>
        <div class="profile-pos">${escHtml(posText)}</div>
      </div>
      <div class="profile-rating" style="color:${escHtml(teamColor)};">${escHtml(String(rating))}</div>
    </div>`;
}

function renderFormStrip(container, playerData, resultData) {
  if (!playerData || !Array.isArray(playerData.weeklyGenels) || !Array.isArray(resultData && resultData.weeks)) {
    container.innerHTML = '<div class="profile-nodata">Henüz form verisi yok.</div>';
    return;
  }
  const weeks = resultData.weeks;
  const genels = playerData.weeklyGenels;
  const entries = weeks.map((w, i) => ({ week: w, score: genels[i] }))
    .filter(e => e.score != null)
    .slice(-5);

  if (!entries.length) {
    container.innerHTML = '<div class="profile-nodata">Henüz form verisi yok.</div>';
    return;
  }

  const bubbles = entries.map((e, i) => {
    const score = Math.round(e.score * 10);
    const cls = score >= 75 ? 'good' : score >= 50 ? 'mid' : 'low';
    let arrow = '';
    if (i > 0) {
      const prev = Math.round(entries[i - 1].score * 10);
      const delta = score - prev;
      arrow = delta >= 2 ? '<span class="form-arrow up">↑</span>'
            : delta <= -2 ? '<span class="form-arrow down">↓</span>'
            : '<span class="form-arrow flat">→</span>';
    }
    return `<div class="form-week">${arrow}<div class="form-bubble ${escHtml(cls)}">${score}</div><div class="form-week-lbl">${escHtml(e.week.replace(/\d{4}-/, ''))}</div></div>`;
  }).join('');

  container.innerHTML = `<div class="form-strip">${bubbles}</div>`;
}

function renderBadges(container, badges) {
  const items = badges.map(b => `
    <div class="badge-item ${b.earned ? '' : 'locked'}"
         data-badge-desc="${escHtml(b.icon + ' ' + b.name + ': ' + b.desc)}"
         onclick="window.__showBadgeDesc && window.__showBadgeDesc(this.dataset.badgeDesc)">
      <span class="badge-icon">${b.icon}</span>
      <span class="badge-name">${escHtml(b.name)}</span>
      ${b.earned ? '' : '<span class="badge-lock">🔒</span>'}
    </div>`).join('');
  container.innerHTML = `<div class="badge-grid">${items}</div>`;
}

function renderCompetition(container, playerData, allPlayers) {
  if (!playerData || !Array.isArray(allPlayers)) {
    container.innerHTML = '';
    return;
  }
  const sorted = [...allPlayers]
    .filter(p => p.genelOrt != null)
    .sort((a, b) => b.genelOrt - a.genelOrt);
  const rank = sorted.findIndex(p => p.name === playerData.name);
  if (rank === -1) { container.innerHTML = ''; return; }

  let html;
  if (rank === 0) {
    html = `<div class="comp-line">👑 <strong>Bu sezon takımının liderisin!</strong></div>`;
  } else {
    const above = sorted[rank - 1];
    const diff = (above.genelOrt - playerData.genelOrt).toFixed(1);
    html = `<div class="comp-line">Takımda <strong>${rank + 1}. sıradasın</strong> — ${escHtml(above.name)}'e <strong>${diff} puan</strong> kaldı</div>`;
  }
  container.innerHTML = html;
}

function renderCriteriaBar(container, playerData) {
  if (!playerData || !playerData.weeklyKriterler || !Object.keys(playerData.weeklyKriterler).length) {
    container.innerHTML = '<div class="profile-nodata">Kriter verisi yok.</div>';
    return;
  }
  const rows = CRITERIA.map((c, i) => {
    const avg = criteriaAvg(playerData, c);
    if (!avg) return '';
    const pct = Math.round(avg * 10);
    const cls = pct >= 80 ? 'good' : pct >= 60 ? 'mid' : 'low';
    return `<div class="criteria-bar">
      <span class="criteria-lbl">${escHtml(CDISP[i])}</span>
      <div class="criteria-track"><div class="criteria-fill ${escHtml(cls)}" style="width:${pct}%"></div></div>
      <span class="criteria-val">${avg.toFixed(1)}</span>
    </div>`;
  }).filter(Boolean).join('');
  container.innerHTML = rows || '<div class="profile-nodata">Kriter verisi yok.</div>';
}

export function renderProfile() {
  const name = state.currentRater;
  const el = document.getElementById('screen-profil');
  if (!el) return;

  const headerEl   = el.querySelector('#prof-header');
  const formEl     = el.querySelector('#prof-form');
  const badgesEl   = el.querySelector('#prof-badges');
  const compEl     = el.querySelector('#prof-competition');
  const criteriaEl = el.querySelector('#prof-criteria');

  if (!name) {
    el.innerHTML = '<div class="profile-nodata" style="padding:32px;text-align:center;">Önce kimliğini seç.</div>';
    return;
  }

  const rd = state.resultData;
  const md = state.matchesData;
  const playerData = rd && Array.isArray(rd.players) ? rd.players.find(p => p.name === name) : null;
  const pObj = Array.isArray(state.players) ? state.players.find(p => p.name === name) : null;

  if (headerEl)   renderHeader(headerEl, playerData, pObj);
  if (formEl)     renderFormStrip(formEl, playerData, rd);
  if (badgesEl)   renderBadges(badgesEl, computeBadges(playerData, rd, md));
  if (compEl)     renderCompetition(compEl, playerData, rd && rd.players);
  if (criteriaEl) renderCriteriaBar(criteriaEl, playerData);

  window.__showBadgeDesc = (msg) => showToast(msg);
}
