import { CRITERIA, CDISP, TEAM_CONFIG } from './config.js';
import { state } from './state.js';
import { escHtml, posLabel, getPlayerPhoto, showToast } from './utils.js';
import { posRating } from './rating.js';
import { forecastHoltWinters } from './forecast.js';
import { findSimilarPlayers } from './dna.js';
import { loadResults, weekGate, gateCurrentWeek } from './stats.js';

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
    .sort((a, b) => {
      const aObj = state.players.find(pl => pl.name === a.name) || { pos: ['OMO'] };
      const bObj = state.players.find(pl => pl.name === b.name) || { pos: ['OMO'] };
      return (posRating(b, bObj) || 0) - (posRating(a, aObj) || 0);
    });
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
  let rating = null;
  if (playerData) {
    const wAvg = pObj ? posRating(playerData, pObj) : null;
    if (wAvg !== null) rating = Math.min(99, Math.round(wAvg * 10));
    else if (playerData.genelOrt != null) rating = Math.min(99, Math.round(playerData.genelOrt * 10));
  }
  const teamId = sessionStorage.getItem('pitchrank_selected_team') || 'haldunalagas';
  const tc = (TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas).color;
  const r = parseInt(tc.slice(1, 3), 16);
  const g = parseInt(tc.slice(3, 5), 16);
  const b = parseInt(tc.slice(5, 7), 16);
  const glow = `radial-gradient(ellipse at 85% 50%, rgba(${r},${g},${b},0.18) 0%, transparent 65%)`;

  container.innerHTML = `
    <div class="prof-hero">
      <div class="prof-hero-glow" style="background:${glow};"></div>
      ${rating !== null ? `<div class="prof-watermark">${rating}</div>` : ''}
      <div class="prof-hero-body">
        <div class="prof-avatar-wrap" style="background:${escHtml(tc)};box-shadow:0 0 0 2px var(--bg),0 0 0 5px ${escHtml(tc)};">
          <img class="prof-avatar" src="${escHtml(photo)}" alt="${escHtml(name)}"
               onerror="this.src='assets/images/icon-192.png'">
        </div>
        <div class="prof-hero-info">
          <div class="prof-name">${escHtml(name)}</div>
          ${posText ? `<div class="prof-pos">${escHtml(posText)}</div>` : ''}
          ${rating !== null ? `<div class="prof-rating-pill" style="background:${escHtml(tc)};">${rating}</div>` : ''}
        </div>
      </div>
      <button class="prof-share-btn" onclick="shareProfileCard()" type="button"
              style="--share-tc:${escHtml(tc)};--share-tc-r:${r};--share-tc-g:${g};--share-tc-b:${b};">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Kartını Paylaş
      </button>
    </div>`;
}

function renderFormStrip(container, playerData, resultData, pObj) {
  const noData = '<div class="prof-section"><div class="prof-section-header"><span class="prof-section-title">Form Şeridi</span></div><div class="prof-nodata">Henüz form verisi yok.</div></div>';
  if (!playerData || !Array.isArray(playerData.weeklyGenels) || !Array.isArray(resultData && resultData.weeks)) {
    container.innerHTML = noData;
    return;
  }
  const weeks = resultData.weeks;
  const genels = playerData.weeklyGenels;

  const ratingForWeek = (weekLabel, idx) => {
    const kr = playerData.weeklyKriterler?.[weekLabel] || {};
    const swd = { weeklyKriterler: { [weekLabel]: kr }, weeklyGenels: [genels[idx]] };
    const w = posRating(swd, pObj || { pos: ['OMO'] });
    if (w !== null) return Math.min(99, Math.round(w * 10));
    return genels[idx] != null ? Math.round(genels[idx] * 10) : null;
  };

  const allRated = weeks
    .map((w, i) => ({ week: w, score: genels[i], rating: ratingForWeek(w, i) }))
    .filter(e => e.score != null && e.rating != null);

  if (!allRated.length) { container.innerHTML = noData; return; }

  const recent = allRated.slice(-5);

  const fullSeries = allRated.map(e => e.rating);
  const forecastVals = forecastHoltWinters(fullSeries, 3);
  const forecastPts = forecastVals.map(v => Math.max(0, Math.min(99, Math.round(v))));

  const W = 300, H = 80, PX = 20, PY = 14;
  const actualScores = recent.map(e => e.rating);
  const allDisplayScores = actualScores.concat(forecastPts);
  const minS = Math.max(0, Math.min(...allDisplayScores) - 8);
  const maxS = Math.min(100, Math.max(...allDisplayScores) + 8);
  const range = maxS - minS || 1;
  const totalN = recent.length + forecastPts.length;
  const innerW = W - PX * 2;
  const innerH = H - PY * 2 - 12;

  const xAt = (i) => PX + (totalN > 1 ? (i / (totalN - 1)) * innerW : innerW / 2);
  const yAt = (s) => PY + (1 - (s - minS) / range) * innerH;

  const actualPts = recent.map((e, i) => ({
    x: xAt(i),
    y: yAt(e.rating),
    score: e.rating,
    week: e.week.replace(/\d{4}-/, ''),
  }));

  const forecastDisplayPts = forecastPts.map((s, k) => ({
    x: xAt(recent.length + k),
    y: yAt(s),
    score: s,
    label: 'T+' + (k + 1),
  }));

  const actualLineD = actualPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = actualPts.length
    ? `${actualLineD} L${actualPts[actualPts.length - 1].x.toFixed(1)} ${H} L${actualPts[0].x.toFixed(1)} ${H} Z`
    : '';

  let forecastLineD = '';
  if (forecastDisplayPts.length && actualPts.length) {
    const last = actualPts[actualPts.length - 1];
    forecastLineD = `M${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    forecastDisplayPts.forEach(p => {
      forecastLineD += ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    });
  }

  const lastScore = actualScores[actualScores.length - 1];
  const prevScore = actualScores.length > 1 ? actualScores[actualScores.length - 2] : null;
  const delta = prevScore !== null ? lastScore - prevScore : 0;
  const trend = delta >= 2 ? { icon: '↑', cls: 'up' } : delta <= -2 ? { icon: '↓', cls: 'down' } : { icon: '→', cls: 'flat' };

  const actualDotsHtml = actualPts.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" class="spark-dot"/>
    <text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" class="spark-lbl" text-anchor="middle">${p.score}</text>
    <text x="${p.x.toFixed(1)}" y="${(H - 1).toFixed(1)}" class="spark-week" text-anchor="middle">${escHtml(p.week)}</text>
  `).join('');

  const forecastDotsHtml = forecastDisplayPts.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.7"/>
    <text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" font-size="9" font-weight="700" fill="#94a3b8" text-anchor="middle" opacity="0.85">${p.score}</text>
    <text x="${p.x.toFixed(1)}" y="${(H - 1).toFixed(1)}" font-size="8" font-weight="600" fill="#94a3b8" text-anchor="middle" opacity="0.7">${p.label}</text>
  `).join('');

  const forecastLineSvg = forecastLineD
    ? `<path d="${forecastLineD}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7"/>`
    : '';

  const forecastBadge = forecastPts.length
    ? `<span class="spark-trend flat" style="background:rgba(148,163,184,0.15);color:#94a3b8;border-color:rgba(148,163,184,0.3);">⌖ Tahmin: ${forecastPts.join(' › ')}</span>`
    : '';

  container.innerHTML = `
    <div class="prof-section">
      <div class="prof-section-header">
        <span class="prof-section-title">Form Şeridi</span>
        <span class="spark-trend ${escHtml(trend.cls)}">${escHtml(trend.icon)} ${lastScore}</span>
      </div>
      <svg class="spark-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#059669" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#059669" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#sparkGrad)"/>
        <path d="${actualLineD}" class="spark-line" fill="none"/>
        ${forecastLineSvg}
        ${actualDotsHtml}
        ${forecastDotsHtml}
      </svg>
      ${forecastBadge ? `<div style="text-align:right;margin-top:4px;">${forecastBadge}</div>` : ''}
    </div>`;
}

function renderBadges(container, badges) {
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);
  const sorted = [...earned, ...locked];

  const items = sorted.map(b => `
    <div class="badge-hex-item${b.earned ? ' earned' : ''}"
         data-badge-desc="${escHtml(b.icon + ' ' + b.name + ': ' + b.desc)}"
         onclick="window.__showBadgeDesc && window.__showBadgeDesc(this.dataset.badgeDesc)">
      <div class="badge-hex-shape ${b.earned ? 'earned' : 'locked'}">${b.icon}</div>
      <div class="badge-hex-name">${escHtml(b.name)}</div>
    </div>`).join('');

  container.innerHTML = `
    <div class="prof-section">
      <div class="prof-section-header">
        <span class="prof-section-title">Rozetler</span>
        <span class="prof-section-sub">${earned.length}/${badges.length} kazanıldı</span>
      </div>
      <div class="badge-hex-grid">${items}</div>
    </div>`;
}

function renderCompetition(container, playerData, allPlayers) {
  if (!playerData || !Array.isArray(allPlayers)) { container.innerHTML = ''; return; }
  const getScore = (p) => {
    const pObj = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
    return posRating(p, pObj) || 0;
  };
  const sorted = [...allPlayers]
    .filter(p => p.genelOrt != null)
    .sort((a, b) => getScore(b) - getScore(a));
  const rank = sorted.findIndex(p => p.name === playerData.name);
  if (rank === -1) { container.innerHTML = ''; return; }

  const teamId = sessionStorage.getItem('pitchrank_selected_team') || 'haldunalagas';
  const tc = (TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas).color;
  const myScore = getScore(playerData);
  const myRating = Math.min(99, Math.round(myScore * 10));

  let numHtml, labelHtml, subHtml;
  if (rank === 0) {
    numHtml = `<div class="prof-rank-num prof-rank-leader" style="color:${escHtml(tc)};">🏆</div>`;
    labelHtml = 'Bu sezon takımının liderisin!';
    subHtml = `Genel rating: <strong>${myRating}</strong>`;
  } else {
    const above = sorted[rank - 1];
    const diff = ((getScore(above) - myScore) * 10).toFixed(1);
    numHtml = `<div class="prof-rank-num" style="color:${escHtml(tc)};">${rank + 1}</div>`;
    labelHtml = `Takımda <strong>${rank + 1}. sıradasın</strong>`;
    subHtml = `${escHtml(above.name)}'e <strong>${diff} puan</strong> kaldı`;
  }

  container.innerHTML = `
    <div class="prof-rank-card">
      ${numHtml}
      <div class="prof-rank-body">
        <div class="prof-rank-label">${labelHtml}</div>
        <div class="prof-rank-sub">${subHtml}</div>
      </div>
    </div>`;
}

function renderDNA(container, playerData, resultData) {
  if (!container) return;
  if (!playerData || !resultData) { container.innerHTML = ''; return; }
  const matches = findSimilarPlayers(playerData.name, resultData, 3);
  if (!matches.length) { container.innerHTML = ''; return; }

  const teamId = sessionStorage.getItem('pitchrank_selected_team') || 'haldunalagas';
  const tc = (TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas).color;

  const cards = matches.map(m => {
    const photo = getPlayerPhoto(m.name);
    const pct = Math.round(Math.max(0, Math.min(1, m.sim)) * 100);
    const sameBadge = m.samePos
      ? `<span style="font-size:9px;font-weight:700;color:${escHtml(tc)};background:${escHtml(tc)}1a;padding:2px 7px;border-radius:10px;border:1px solid ${escHtml(tc)}33;">Aynı mevki</span>`
      : `<span style="font-size:9px;font-weight:700;color:var(--text3);background:var(--bg3);padding:2px 7px;border-radius:10px;border:1px solid var(--border2);">Çapraz</span>`;
    return `
      <div style="display:flex;align-items:center;gap:12px;background:var(--bg3);border:1px solid var(--border2);border-radius:14px;padding:10px 12px;">
        <img src="${escHtml(photo)}" loading="lazy" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--bg2);" onerror="this.src='assets/images/icon-192.png'">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:800;color:var(--text);letter-spacing:-0.3px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(m.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${sameBadge}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:18px;font-weight:900;color:${escHtml(tc)};line-height:1;letter-spacing:-0.5px;">%${pct}</div>
          <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">benzerlik</div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="prof-section">
      <div class="prof-section-header">
        <span class="prof-section-title">🧬 DNA Eşleşmesi</span>
        <span class="prof-section-sub">Oyun stili</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">${cards}</div>
    </div>`;
}

function renderCriteriaBar(container, playerData) {
  if (!playerData || !playerData.weeklyKriterler || !Object.keys(playerData.weeklyKriterler).length) {
    container.innerHTML = '<div class="prof-section"><div class="prof-section-header"><span class="prof-section-title">Kriter Ortalamaları</span></div><div class="prof-nodata">Kriter verisi yok.</div></div>';
    return;
  }

  const R = 22, CX = 28, CY = 28, CIRC = 2 * Math.PI * R;

  const arcs = CRITERIA.map((c, i) => {
    const avg = criteriaAvg(playerData, c);
    if (!avg) return null;
    const pct = Math.min(100, Math.round(avg * 10));
    const cls = avg >= 7 ? 'good' : avg >= 5 ? 'mid' : 'low';
    const dash = `${(pct / 100 * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
    return `
      <div class="crit-arc">
        <svg class="crit-arc-svg" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${CX}" cy="${CY}" r="${R}" class="crit-arc-track"/>
          <circle cx="${CX}" cy="${CY}" r="${R}" class="crit-arc-fill ${cls}"
                  stroke-dasharray="${dash}"
                  stroke-dashoffset="0"
                  transform="rotate(-90 ${CX} ${CY})"/>
          <text x="${CX}" y="${CY}" class="crit-arc-val" text-anchor="middle" dominant-baseline="middle">${avg.toFixed(1)}</text>
        </svg>
        <div class="crit-arc-lbl">${escHtml(CDISP[i])}</div>
      </div>`;
  }).filter(Boolean).join('');

  container.innerHTML = arcs
    ? `<div class="prof-section"><div class="prof-section-header"><span class="prof-section-title">Kriter Ortalamaları</span></div><div class="crit-arc-grid">${arcs}</div></div>`
    : '<div class="prof-section"><div class="prof-section-header"><span class="prof-section-title">Kriter Ortalamaları</span></div><div class="prof-nodata">Kriter verisi yok.</div></div>';
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
  const dnaEl      = el.querySelector('#prof-dna');

  if (!name) {
    const noIdentityHTML = '<div class="prof-section" style="padding:32px;text-align:center;"><div class="prof-nodata">Önce kimliğini seç.</div></div>';
    if (headerEl) headerEl.innerHTML = noIdentityHTML;
    if (compEl) compEl.innerHTML = '';
    if (formEl) formEl.innerHTML = '';
    if (badgesEl) badgesEl.innerHTML = '';
    if (criteriaEl) criteriaEl.innerHTML = '';
    if (dnaEl) dnaEl.innerHTML = '';
    return;
  }

  window.__showBadgeDesc = (msg) => showToast(msg);

  loadResults(rawData => {
    const rd = gateCurrentWeek(rawData, weekGate(rawData));
    const md = state.matchesData;
    const playerData = rd && Array.isArray(rd.players) ? rd.players.find(p => p.name === name) : null;
    const pObj = Array.isArray(state.players) ? state.players.find(p => p.name === name) : null;

    if (headerEl)   renderHeader(headerEl, playerData, pObj);
    if (compEl)     renderCompetition(compEl, playerData, rd && rd.players);
    if (formEl)     renderFormStrip(formEl, playerData, rd, pObj);
    if (badgesEl)   renderBadges(badgesEl, computeBadges(playerData, rd, md));
    if (criteriaEl) renderCriteriaBar(criteriaEl, playerData);
    if (dnaEl)      renderDNA(dnaEl, playerData, rd);
  });
}
