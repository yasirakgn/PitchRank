import { CRITERIA, CDISP, POS } from './config.js';
import { lGet, lSet } from './storage.js';
import { state } from './state.js';
import { escHtml, normPos, posLabel, getWeekLabel, getPlayerPhoto, scoreColor, formatMoney, showToast } from './utils.js';
import { gs } from './api.js';
import { posRating, calcMarketValue } from './rating.js';

let _makeFifaCard = null;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePlayer(player, weekCount) {
  const weeklyGenels = asArray(player && player.weeklyGenels);
  return {
    ...player,
    name: player && player.name ? player.name : '',
    genelOrt: player && player.genelOrt != null ? player.genelOrt : null,
    weeklyGenels: Array.from({ length: weekCount }, (_, i) => weeklyGenels[i] ?? null),
    weeklyKriterler: player && player.weeklyKriterler && typeof player.weeklyKriterler === 'object' ? player.weeklyKriterler : {},
  };
}

function normalizeResultsData(data) {
  const weeks = asArray(data && data.weeks);
  return {
    ...data,
    weeks,
    players: asArray(data && data.players).map(player => normalizePlayer(player, weeks.length)),
    ratersPerWeek: data && data.ratersPerWeek && typeof data.ratersPerWeek === 'object' ? data.ratersPerWeek : {},
    results: asArray(data && data.results),
  };
}

function normalizeMatchesData(data) {
  return {
    ...data,
    matches: asArray(data && data.matches).map(match => ({
      ...match,
      goals: match && match.goals && typeof match.goals === 'object' ? match.goals : {},
      note: match && match.note ? match.note : '',
      week: match && match.week ? match.week : '',
      date: match && match.date ? match.date : '',
      score1: match && match.score1 != null ? match.score1 : 0,
      score2: match && match.score2 != null ? match.score2 : 0,
    })),
  };
}

// ── Vote-gate ──────────────────────────────────────────────────────────────────
const MIN_WEEK_VOTERS = 5;

export function weekGate(data) {
  const cw = getWeekLabel();
  const threshold = (data && data.minVoters > 0) ? data.minVoters : MIN_WEEK_VOTERS;
  if (!data || !cw) return { currentWeek: cw, count: 0, visible: true, remaining: 0, threshold };
  const raters = Array.isArray(data.ratersPerWeek && data.ratersPerWeek[cw]) ? data.ratersPerWeek[cw] : [];
  const count = raters.length;
  const inData = Array.isArray(data.weeks) && data.weeks.includes(cw);
  if (!inData) return { currentWeek: cw, count, visible: true, remaining: threshold - count, threshold };
  return { currentWeek: cw, count, visible: count >= threshold, remaining: Math.max(0, threshold - count), threshold };
}

function gateCurrentWeek(data, gate) {
  if (gate.visible) return data;
  const weekIdx = Array.isArray(data.weeks) ? data.weeks.indexOf(gate.currentWeek) : -1;
  if (weekIdx === -1) return data;
  const newWeeks = data.weeks.filter((_, i) => i !== weekIdx);
  const newPlayers = data.players.map(p => {
    const newGenels = p.weeklyGenels.filter((_, i) => i !== weekIdx);
    const newKrit = Object.fromEntries(Object.entries(p.weeklyKriterler || {}).filter(([k]) => k !== gate.currentWeek));
    const gv = newGenels.filter(v => v != null);
    return { ...p, weeklyGenels: newGenels, weeklyKriterler: newKrit, genelOrt: gv.length ? gv.reduce((a,b)=>a+b,0)/gv.length : null };
  });
  return { ...data, weeks: newWeeks, players: newPlayers };
}

function pendingVotesHTML(gate) {
  const pct = Math.min(100, Math.round(gate.count / gate.threshold * 100));
  return `<div class="vote-gate-card">
    <div class="vgc-icon">🗳️</div>
    <div class="vgc-title">Oylama Devam Ediyor</div>
    <div class="vgc-week">${escHtml(gate.currentWeek)}</div>
    <div class="vgc-bar-wrap"><div class="vgc-bar" style="width:${pct}%"></div></div>
    <div class="vgc-count"><strong>${gate.count}</strong> / ${gate.threshold} oy kullanıldı</div>
    <div class="vgc-desc">Sonuçlar ${gate.remaining > 0 ? `<strong>${gate.remaining} kişi daha</strong> oy kullandığında` : 'yeterli oy tamamlandığında'} görünür olacak</div>
  </div>`;
}

function rankGateBanner(gate) {
  const pct = Math.min(100, Math.round(gate.count / gate.threshold * 100));
  return `<div class="rank-gate-banner">
    <div class="rgb-left">
      <span class="rgb-emoji">🗳️</span>
      <div>
        <div class="rgb-title">${escHtml(gate.currentWeek)} — Oylama devam ediyor</div>
        <div class="rgb-sub">Sıralama önceki haftaya göre gösteriliyor · ${gate.count}/${gate.threshold} oy</div>
      </div>
    </div>
    <div class="rgb-progress-wrap">
      <div class="rgb-bar" style="width:${pct}%"></div>
    </div>
  </div>`;
}

export function loadResults(cb, forceRefresh = false) {
  if (state.resultData && !forceRefresh) { cb(state.resultData); return; }
  const cached = lGet('hs_results_cache');
  if (cached && !state.resultData) {
    try {
      state.resultData = normalizeResultsData(JSON.parse(cached));
      if (cb) cb(state.resultData);
    } catch(e) {}
  }
  gs({action:'getResults'}).then(d => {
    const normalized = normalizeResultsData(d || { results: [] });
    if (!d || !normalized.players.length) {
      lSet('hs_results_cache', JSON.stringify(normalized));
      state.resultData = normalized;
      if (cb) cb(state.resultData);
      return;
    }
    const newStr = JSON.stringify(normalized);
    if (cached !== newStr || forceRefresh) {
      lSet('hs_results_cache', newStr);
      state.resultData = normalized;
      if (cb) cb(normalized);
    } else if (cb) {
      cb(state.resultData);
    }
  }).catch(() => { if (!state.resultData && cb) cb(null); });
}

export function loadManualWeek(cb) {
  const cached = lGet('hs_manual_week');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && data.week) state.manualWeek = data.week;
    } catch(e) {}
    if (cb) cb(); cb = null;
  }
  gs({action:'getManualWeek'}).then(d => {
    if (d && d.week) {
      state.manualWeek = d.week;
      lSet('hs_manual_week', JSON.stringify({ week: state.manualWeek }));
    }
    if (cb) cb();
  }).catch(() => { if (cb) cb(); });
}

export function setRankTab(tab, btn) {
  const allowed = { genel: 1, defans: 1, orta: 1, forvet: 1 };
  state.currentRankTab = allowed[tab] ? tab : 'genel';
  document.querySelectorAll('#screen-siralama .sub-nb').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const grid = document.getElementById('fifaGrid');
  grid.className = 'fg'; grid.style.marginBottom = '12px';
  if (state.sonucData) renderRankTab(state.sonucData, _makeFifaCard);
}

export function renderSonuc(makeFifaCard) {
  if (makeFifaCard) _makeFifaCard = makeFifaCard;
  const grid = document.getElementById('fifaGrid'), nd = document.getElementById('noDataSonuc');
  const infoBand = document.getElementById('statsInfoBand');
  const infoTextEl = document.getElementById('statsInfoText');
  const infoWeekBadgeEl = document.getElementById('statsInfoWeekBadge');
  const bannerEl = document.getElementById('siralama-gate-banner');
  grid.className = 'fg'; grid.style.marginBottom = '12px';
  grid.innerHTML = '<div class="no-data"><span class="spin"></span>İstatistikler çekiliyor...</div>';
  nd.style.display = 'none';
  if (bannerEl) bannerEl.innerHTML = '';
  loadResults(data => {
    const gate = weekGate(data);
    const visibleData = gateCurrentWeek(data, gate);
    state.sonucData = visibleData;
    grid.innerHTML = '';
    if (!data || !data.players) { nd.style.display = 'block'; return; }
    if (!gate.visible && bannerEl) bannerEl.innerHTML = rankGateBanner(gate);
    if (visibleData.weeks && visibleData.weeks.length) {
      const totalWeeks = visibleData.weeks.length;
      const lastWeek = visibleData.weeks[totalWeeks - 1];
      if (infoBand) infoBand.style.display = 'block';
      const infoText = totalWeeks === 1 ? `Son 1 haftanın verilerine göre` : `Son ${totalWeeks} haftanın ortalamasına göre`;
      if (infoTextEl) infoTextEl.textContent = infoText;
      if (infoWeekBadgeEl) infoWeekBadgeEl.textContent = `📅 ${lastWeek}`;
    }
    renderRankTab(visibleData, makeFifaCard);
  });
}

export function renderRankTab(data, makeFifaCard) {
  const fn = makeFifaCard || _makeFifaCard;
  const grid = document.getElementById('fifaGrid'), nd = document.getElementById('noDataSonuc');
  if (!({ genel: 1, defans: 1, orta: 1, forvet: 1 }[state.currentRankTab])) state.currentRankTab = 'genel';
  grid.className = 'fg'; grid.style.marginBottom = '12px';
  grid.innerHTML = ''; nd.style.display = 'none';
  const tabPos = { defans: 'DEF', orta: 'OMO', forvet: 'FRV' }[state.currentRankTab];
  const players = asArray(data && data.players).filter(p => p.genelOrt !== null);
  const sorted = players.map(p => {
    const pObj = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
    let score = tabPos ? posRating(p, { pos: [tabPos] }) : posRating(p, pObj);
    return { p, pObj, score: score || 0, tabPos };
  }).sort((a, b) => b.score - a.score);
  if (!sorted.length) { nd.style.display = 'block'; return; }
  sorted.forEach((item, i) => {
    const displayObj = item.tabPos ? { pos: [item.tabPos] } : item.pObj;
    if (fn) grid.appendChild(fn(item.p, displayObj, i, data, item.score));
  });
}

export function renderHafta() {
  const wrap = document.getElementById('weekSelectorWrap');
  const content = document.getElementById('weekContent');
  const nd = document.getElementById('noDataHafta');
  wrap.innerHTML = ''; content.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  if (nd) nd.style.display = 'none';
  loadResults(data => {
    content.innerHTML = '';
    if (!data || !data.weeks || !data.weeks.length) { if (nd) nd.style.display = 'block'; return; }
    const gate = weekGate(data);
    const weeks = data.weeks.slice().reverse();
    wrap.innerHTML = `
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;scrollbar-width:none;" id="weekSelector">
        ${weeks.map((w, i) => {
          const wi = data.weeks.indexOf(w);
          const isGated = !gate.visible && w === gate.currentWeek;
          const participants = isGated ? gate.count : data.players.filter(p => p.weeklyGenels[wi] != null).length;
          const total = isGated ? MIN_WEEK_VOTERS : state.players.length;
          const sublabel = isGated ? `🔒 ${participants}/${total} oy` : `${participants}/${total} oy`;
          return `<button onclick="selectWeekBtn(this,'${w}')" data-week="${w}"
            style="flex-shrink:0;border:none;cursor:pointer;font-family:inherit;transition:all .25s cubic-bezier(0.4,0,0.2,1);
                   padding:${i===0?'12px 18px':'10px 14px'};border-radius:16px;text-align:left;
                   background:${i===0?'var(--text)':'var(--bg2)'};
                   color:${i===0?'var(--bg)':'var(--text2)'};
                   box-shadow:${i===0?'0 4px 12px rgba(0,0,0,0.2)':'var(--sh)'};
                   border:1px solid ${i===0?'transparent':'var(--border)'};">
            <div style="font-size:${i===0?'13':'11'}px;font-weight:800;letter-spacing:-0.3px;white-space:nowrap;">${w}</div>
            <div style="font-size:9px;font-weight:700;margin-top:2px;opacity:${i===0?0.7:0.5};white-space:nowrap;">${sublabel}</div>
          </button>`;
        }).join('')}
      </div>`;
    renderWeek(weeks[0], data);
  });
}

export function selectWeekBtn(btn, week) {
  document.querySelectorAll('#weekSelector button').forEach(b => {
    b.style.background = 'var(--bg2)';
    b.style.color = 'var(--text2)';
    b.style.boxShadow = 'var(--sh)';
    b.style.borderColor = 'var(--border)';
    b.style.padding = '10px 14px';
    b.querySelector('div').style.fontSize = '11px';
  });
  btn.style.background = 'var(--text)';
  btn.style.color = 'var(--bg)';
  btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  btn.style.borderColor = 'transparent';
  btn.style.padding = '12px 18px';
  btn.querySelector('div').style.fontSize = '13px';
  btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  loadResults(data => renderWeek(week, data));
}

export function renderWeek(week, data) {
  const content = document.getElementById('weekContent');
  const gate = weekGate(data);
  if (week === gate.currentWeek && !gate.visible) {
    content.innerHTML = pendingVotesHTML(gate);
    return;
  }
  const wi = data.weeks.indexOf(week);
  if (wi < 0) { content.innerHTML = '<div class="no-data">Bu hafta veri yok.</div>'; return; }
  const wp = data.players
    .map(p => {
      const score = p.weeklyGenels[wi];
      const kr = (p.weeklyKriterler && p.weeklyKriterler[week]) || {};
      const pObj = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
      const singleWeekData = { weeklyKriterler: { [week]: kr }, weeklyGenels: [score] };
      const weighted = posRating(singleWeekData, pObj);
      const r10 = weighted !== null ? Math.min(99, weighted * 10) : (score != null ? score * 10 : null);
      return { name: p.name, score, kr, pObj, r10 };
    })
    .filter(p => p.score != null)
    .sort((a, b) => b.r10 - a.r10);
  if (!wp.length) { content.innerHTML = '<div class="no-data">Bu hafta veri yok.</div>'; return; }

  const maxScore = Math.max(...wp.map(p => p.r10));
  const minScore = Math.min(...wp.map(p => p.r10));
  const totalVoters = data.ratersPerWeek ? (data.ratersPerWeek[week] || []).length : '?';

  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div style="background:var(--bg2);border-radius:14px;padding:12px;text-align:center;box-shadow:var(--sh-card);border:1px solid var(--border2);">
        <div style="font-size:22px;font-weight:900;color:var(--text);letter-spacing:-1px;">${wp.length}</div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Değerlendirilen</div>
      </div>
      <div style="background:var(--bg2);border-radius:14px;padding:12px;text-align:center;box-shadow:var(--sh-card);border:1px solid var(--border2);">
        <div style="font-size:22px;font-weight:900;color:var(--green);letter-spacing:-1px;">${maxScore.toFixed(0)}</div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">En Yüksek</div>
      </div>
      <div style="background:var(--bg2);border-radius:14px;padding:12px;text-align:center;box-shadow:var(--sh-card);border:1px solid var(--border2);">
        <div style="font-size:22px;font-weight:900;color:var(--text);letter-spacing:-1px;">${totalVoters}</div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Oy Kullanan</div>
      </div>
    </div>`;

  wp.forEach((p, i) => {
    const r10 = p.r10;
    const pct = ((p.r10 - minScore) / (maxScore - minScore || 1) * 100).toFixed(0);
    const pObj = p.pObj;
    const photoUrl = getPlayerPhoto(p.name);
    const posKey = normPos(pObj)[0] || 'OMO';
    const posEmoji = { KL:'🧤', DEF:'🛡️', OMO:'⚙️', FRV:'⚡' }[posKey] || '⚽';
    const rankDisplay = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="font-size:13px;font-weight:900;color:var(--text3);">${i+1}</span>`;
    const rCol = r10 >= 80 ? '#f59e0b' : r10 >= 70 ? 'var(--green)' : r10 >= 55 ? '#60a5fa' : 'var(--text3)';
    const isTop = i < 3;

    const kritBars = CRITERIA.map((c, ci) => {
      const v = p.kr[c];
      const vn = v != null ? +v : null;
      const barW = vn !== null ? Math.round(vn / 10 * 100) : 0;
      const barCol = vn !== null ? (vn >= 8 ? '#4ade80' : vn >= 6 ? '#fbbf24' : '#f87171') : 'var(--border)';
      return `<div style="flex:1;min-width:0;">
        <div style="font-size:7px;font-weight:700;color:var(--text3);text-align:center;margin-bottom:2px;letter-spacing:.2px;">${CDISP[ci]}</div>
        <div style="height:3px;background:var(--border2);border-radius:2px;overflow:hidden;">
          <div style="width:${barW}%;height:100%;background:${barCol};border-radius:2px;"></div>
        </div>
        <div style="font-size:7px;font-weight:800;color:${barCol};text-align:center;margin-top:2px;">${vn!==null?vn.toFixed(1):'—'}</div>
      </div>`;
    }).join('');

    html += `
      <div style="background:var(--bg2);border-radius:18px;padding:14px;margin-bottom:10px;
                  box-shadow:${isTop?'0 4px 16px rgba(0,0,0,0.1)':'var(--sh-card)'};
                  border:1px solid ${isTop?'var(--border)':'var(--border2)'};
                  position:relative;overflow:hidden;transition:transform .2s;"
           onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        ${isTop ? `<div style="position:absolute;top:0;left:0;right:0;height:2px;background:${i===0?'linear-gradient(90deg,#f59e0b,#d97706)':i===1?'linear-gradient(90deg,#94a3b8,#cbd5e1)':'linear-gradient(90deg,#b45309,#d97706)'};"></div>` : ''}
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:28px;text-align:center;flex-shrink:0;font-size:18px;">${rankDisplay}</div>
          <div style="width:40px;height:40px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--bg3);border:1px solid var(--border2);">
            ${photoUrl
              ? `<img src="${photoUrl}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:var(--green);">${p.name.charAt(0)}</div>`}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:800;letter-spacing:-0.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
            <div style="font-size:10px;color:var(--text3);font-weight:600;margin-top:1px;">${posEmoji} ${POS[posKey]||posKey}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:28px;font-weight:900;color:${rCol};letter-spacing:-1.5px;line-height:1;">${r10.toFixed(1)}</div>
            <div style="font-size:8px;font-weight:700;color:var(--text3);text-align:right;margin-top:1px;">PUAN</div>
          </div>
        </div>
        <div style="height:3px;background:var(--border2);border-radius:2px;overflow:hidden;margin-bottom:10px;">
          <div style="width:${pct}%;height:100%;background:${rCol};border-radius:2px;transition:width .6s cubic-bezier(0.16,1,0.3,1);"></div>
        </div>
        <div style="display:flex;gap:4px;">${kritBars}</div>
      </div>`;
  });

  content.innerHTML = html;
}

export function renderTrend() {
  const pname = document.getElementById('trendSelect').value;
  const el = document.getElementById('trendContent');
  if (!pname) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Grafik oluşturuluyor...</div>';
  loadResults(rawData => {
    const data = gateCurrentWeek(rawData, weekGate(rawData));
    if (!data || !data.players || !data.weeks || !data.weeks.length) { el.innerHTML = '<div class="no-data">Veri yok.</div>'; return; }
    const pdata = data.players.find(p => p.name === pname);
    if (!pdata) { el.innerHTML = '<div class="no-data">Oyuncu bulunamadı.</div>'; return; }
    const weeks = asArray(data.weeks);
    if (!weeks.length) { el.innerHTML = '<div class="no-data">Yeterli veri yok.</div>'; return; }
    const last5weeks = weeks.slice(-5);
    const scores = last5weeks.map(w => {
      const wi = weeks.indexOf(w);
      const s = pdata.weeklyGenels[wi];
      return { week: w, score: s != null ? +(s * 10).toFixed(1) : null };
    });
    const valid = scores.filter(s => s.score !== null);
    if (!valid.length) { el.innerHTML = '<div class="no-data">Yeterli veri yok.</div>'; return; }

    // Detaylı metrikler
    const current = valid[valid.length - 1].score;
    const first = valid[0].score;
    const avg = +(valid.reduce((a, s) => a + s.score, 0) / valid.length).toFixed(1);
    const max = Math.max(...valid.map(s => s.score));
    const min = Math.min(...valid.map(s => s.score));
    const trendChange = +(current - first).toFixed(1);
    const trendPercent = +((trendChange / first) * 100).toFixed(1);
    const trendDir = trendChange > 0.3 ? '↑' : trendChange < -0.3 ? '↓' : '→';
    const trendColor = trendDir === '↑' ? 'var(--green)' : trendDir === '↓' ? '#f97316' : 'var(--text3)';
    const trendLabel = trendDir === '↑' ? 'Yükseliyor' : trendDir === '↓' ? 'Düşüyor' : 'Stabil';
    
    // Standart sapma
    const variance = valid.reduce((a, s) => a + Math.pow(s.score - avg, 2), 0) / valid.length;
    const stdDev = Math.sqrt(variance).toFixed(1);
    
    // Performance rating (0-100)
    const perfRating = Math.round(((avg - min) / (max - min || 1) * 60 + 40));

    const maxS = Math.max(...valid.map(s => s.score));
    const minS = Math.min(...valid.map(s => s.score));
    const pad = Math.max((maxS - minS) * 0.25, 4);
    const yMax = Math.min(99, maxS + pad);
    const yMin = Math.max(0, minS - pad);

    const W = 340, H = 160, padL = 28, padR = 16, padT = 22, padB = 28;
    const chartW = W - padL - padR, chartH = H - padT - padB;
    const n = last5weeks.length;

    const toX = (i) => padL + (i / Math.max(n - 1, 1)) * chartW;
    const toY = (v) => padT + chartH - ((v - yMin) / (yMax - yMin || 1)) * chartH;

    const pts = scores.map((s, i) => ({
      x: toX(i), y: s.score !== null ? toY(s.score) : null,
      score: s.score, week: s.week
    }));
    const validPts = pts.filter(p => p.y !== null);
    const pathD = validPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const firstPt = validPts[0], lastPt = validPts[validPts.length - 1];

    const gridCount = 4;
    const gridLines = Array.from({length: gridCount + 1}, (_, i) => {
      const v = yMin + (yMax - yMin) * (i / gridCount);
      const y = toY(v).toFixed(1);
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" opacity="0.6"/>
              <text x="${padL - 4}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="8" fill="var(--text3)" font-weight="500">${Math.round(v)}</text>`;
    }).join('');

    const dotsAndLabels = pts.map(p => {
      if (p.y === null) return `<circle cx="${p.x.toFixed(1)}" cy="${(padT + chartH/2).toFixed(1)}" r="2" fill="var(--border)" opacity="0.4"/>`;
      const labelY = p.y < padT + 14 ? p.y + 14 : p.y - 8;
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--green)" opacity="0.95" stroke="var(--bg)" stroke-width="1.5"/>
              <text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="var(--green)">${p.score}</text>`;
    }).join('');

    const weekLabels = pts.map(p => `<text x="${p.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="8.5" fill="var(--text3)" font-weight="600">${p.week.replace(/\d{4}-/, '')}</text>`).join('');

    // Kriter trend
    const kritStats = CRITERIA.map((c, ci) => {
      const vals = last5weeks.map(w => pdata.weeklyKriterler && pdata.weeklyKriterler[w] ? pdata.weeklyKriterler[w][c] : null).filter(v => v != null);
      if (!vals.length) return '';
      const cavg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const cfirst = vals[0];
      const clast = vals[vals.length - 1];
      const ctrend = clast > cfirst + 1 ? '↑' : clast < cfirst - 1 ? '↓' : '→';
      const ctrendColor = ctrend === '↑' ? 'var(--green)' : ctrend === '↓' ? '#f97316' : 'var(--text3)';
      const bar = Math.round(cavg / 10 * 100);
      const col = scoreColor(cavg);
      return `<div style="padding:10px 8px;background:var(--bg3);border-radius:12px;text-align:center;border:1px solid var(--border);transition:all .3s;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-size:12px;font-weight:800;color:${col};">${cavg.toFixed(1)}</div>
          <div style="font-size:11px;font-weight:700;color:${ctrendColor};">${ctrend}</div>
        </div>
        <div style="font-size:7px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${CDISP[ci]}</div>
        <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;"><div style="width:${bar}%;height:100%;background:${col};border-radius:2px;transition:width .5s;"></div></div>
      </div>`;
    }).filter(x => x).join('');

    // Haftalık breakdown
    const weekBreakdown = scores.map((s, i) => {
      const comp = i === 0 ? 'ilk' : scores[i-1].score !== null ? (s.score > scores[i-1].score ? '+' : s.score < scores[i-1].score ? '' : '=') + (s.score - scores[i-1].score).toFixed(1) : '—';
      const compColor = comp.includes('+') ? 'var(--green)' : comp.includes('-') ? '#f97316' : 'var(--text3)';
      return `<div style="padding:10px;background:var(--bg2);border-radius:10px;border:1px solid var(--border);text-align:center;">
        <div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:4px;">${s.week.replace(/\d{4}-/, '')}</div>
        <div style="font-size:14px;font-weight:800;color:${s.score ? scoreColor(s.score) : 'var(--text3)'};">${s.score ? s.score : '—'}</div>
        ${s.score ? `<div style="font-size:10px;font-weight:700;color:${compColor};margin-top:4px;">${comp}</div>` : ''}
      </div>`;
    }).join('');

    const photoUrl = getPlayerPhoto(pname);
    const photoHTML = photoUrl 
      ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display='none'">`
      : `<div style="width:100%;height:100%;border-radius:12px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:var(--text3);">${pname.charAt(0).toUpperCase()}</div>`;
    const posEmoji = { 'KL': '🥅', 'DEF': '🛡️', 'OMO': '⚡', 'FRV': '⚽' };
    const playerPos = pdata.pos && pdata.pos[0] ? pdata.pos[0] : 'OMO';
    const posLabel = { 'KL': 'Kaleci', 'DEF': 'Defans', 'OMO': 'Orta Oyun', 'FRV': 'Forvet' }[playerPos] || playerPos;

    el.innerHTML = `
      <!-- Player Header -->
      <div class="card" style="margin-bottom:12px;background:linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border);padding:16px;">
        <div style="display:grid;grid-template-columns:80px 1fr;gap:14px;align-items:center;">
          <div style="width:80px;height:100px;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:2px solid var(--border);">
            ${photoHTML}
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px;">${posEmoji[playerPos]} ${posLabel}</div>
            <div style="font-size:18px;font-weight:900;color:var(--text);line-height:1;margin-bottom:6px;">${escHtml(pname)}</div>
            <div style="font-size:12px;color:var(--text3);font-weight:600;">Trend Analizi</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
          <!-- Stat Cards -->
          <div style="padding:12px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px;">Güncel</div>
            <div style="font-size:20px;font-weight:900;color:var(--green);line-height:1;">${current}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px;">Ortalama</div>
            <div style="font-size:20px;font-weight:900;color:${scoreColor(avg)};line-height:1;">${avg}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px;">Max / Min</div>
            <div style="font-size:14px;font-weight:800;line-height:1.2;">
              <span style="color:var(--green);">${max}</span> <span style="color:var(--text3);font-weight:600;font-size:11px;">/ ${min}</span>
            </div>
          </div>
          <div style="padding:12px;background:${perfRating >= 70 ? 'rgba(34, 197, 94, 0.1)' : perfRating >= 50 ? 'rgba(251, 146, 60, 0.1)' : 'rgba(239, 68, 68, 0.1)'};border-radius:12px;border:1px solid ${perfRating >= 70 ? 'rgba(34, 197, 94, 0.3)' : perfRating >= 50 ? 'rgba(251, 146, 60, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px;">Performans</div>
            <div style="font-size:20px;font-weight:900;color:${perfRating >= 70 ? 'var(--green)' : perfRating >= 50 ? '#f97316' : '#ef4444'};line-height:1;">${perfRating}</div>
          </div>
        </div>
        
        <!-- Trend Info -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding:14px;background:var(--bg2);border-radius:12px;border:1px solid var(--border);">
          <div>
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;">Trend Analizi</div>
            <div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:2px;">${trendLabel} <span style="color:${trendColor};font-weight:800;">${trendChange > 0 ? '+' : ''}${trendChange}</span></div>
            <div style="font-size:11px;color:var(--text3);font-weight:500;">%${Math.abs(trendPercent)} ${trendPercent > 0 ? 'artış' : trendPercent < 0 ? 'düşüş' : 'değişim yok'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px;font-weight:900;color:${trendColor};line-height:1;">${trendDir}</div>
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-top:4px;text-transform:uppercase;">Std Dev: ${stdDev}</div>
          </div>
        </div>

        <!-- Grafik -->
        <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;margin-bottom:14px;">
          <defs>
            <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--green)" stop-opacity="0.15"/>
              <stop offset="100%" stop-color="var(--green)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="0.75"/>
          ${pathD && firstPt && lastPt ? `<path d="${pathD} L${lastPt.x.toFixed(1)} ${(padT+chartH).toFixed(1)} L${firstPt.x.toFixed(1)} ${(padT+chartH).toFixed(1)} Z" fill="url(#tg2)"/>` : ''}
          ${pathD ? `<path d="${pathD}" stroke="var(--green)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>` : ''}
          ${dotsAndLabels}
          ${weekLabels}
        </svg>
      </div>

      <!-- Kriterler Grid -->
      <div class="card" style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.3px;margin-bottom:10px;">Kriter Ortalamaları (Son ${n} Hafta)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:6px;">
          ${kritStats}
        </div>
      </div>

      <!-- Haftalık Breakdown -->
      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.3px;margin-bottom:10px;">Haftalık Detay</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">
          ${weekBreakdown}
        </div>
      </div>
    `;
  });
}

export function renderComparison() {
  const a = document.getElementById('cmpA').value, b = document.getElementById('cmpB').value;
  const el = document.getElementById('cmpContent');
  if (!a || !b) { el.innerHTML = ''; return; }
  if (a === b) { showToast('Farklı iki oyuncu seçmelisiniz.', true); el.innerHTML = ''; return; }
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Detaylı analiz hazırlanıyor...</div>';
  loadResults(rawData => {
    const data = gateCurrentWeek(rawData, weekGate(rawData));
    if (!data || !data.players) { el.innerHTML = '<div class="no-data">Veri yok.</div>'; return; }
    const pa = data.players.find(p => p.name === a), pb = data.players.find(p => p.name === b);
    if (!pa || !pb) { el.innerHTML = '<div class="no-data">Yeterli veri yok — iki oyuncunun da puanı olmalı.</div>'; return; }
    const paObj = state.players.find(pl => pl.name === a) || { pos: ['OMO'] };
    const pbObj = state.players.find(pl => pl.name === b) || { pos: ['OMO'] };
    const aRating = Math.min(99, Math.round((posRating(pa, paObj) || 0) * 10));
    const bRating = Math.min(99, Math.round((posRating(pb, pbObj) || 0) * 10));
    const getKrit = (pdata, c) => {
      let vals = [];
      if (pdata.weeklyKriterler) Object.values(pdata.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
      return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    };
    const aVals = CRITERIA.map(c => getKrit(pa, c));
    const bVals = CRITERIA.map(c => getKrit(pb, c));

    const cx = 125, cy = 125, r = 72, n = CRITERIA.length;
    const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;
    const pt = (val, i) => ({ x: cx + r * (val/10) * Math.cos(angle(i)), y: cy + r * (val/10) * Math.sin(angle(i)) });
    const polyA = aVals.map((v,i) => pt(v,i)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const polyB = bVals.map((v,i) => pt(v,i)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const gridLines = [0.25,0.5,0.75,1].map(f => {
      const gpts = Array.from({length:n},(_,i)=>`${(cx+r*f*Math.cos(angle(i))).toFixed(1)},${(cy+r*f*Math.sin(angle(i))).toFixed(1)}`).join(' ');
      return `<polygon points="${gpts}" fill="none" stroke="var(--border)" stroke-width="0.75" opacity="0.7"/>`;
    }).join('');
    const axes = Array.from({length:n},(_,i)=>`<line x1="${cx}" y1="${cy}" x2="${(cx+r*Math.cos(angle(i))).toFixed(1)}" y2="${(cy+r*Math.sin(angle(i))).toFixed(1)}" stroke="var(--border)" stroke-width="0.75" opacity="0.6"/>`).join('');
    const labels = CRITERIA.map((c,i)=>{
      const lx = cx + (r+26)*Math.cos(angle(i)), ly = cy + (r+26)*Math.sin(angle(i));
      const anchor = lx < cx-3 ? 'end' : lx > cx+3 ? 'start' : 'middle';
      const base = ly < cy-3 ? 'auto' : ly > cy+3 ? 'hanging' : 'middle';
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="${base}" font-size="9" font-weight="700" fill="var(--text2)" opacity="0.9">${CDISP[i]}</text>`;
    }).join('');
    const dotsA = aVals.map((v,i)=>{ const p=pt(v,i); return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="var(--green)" opacity="0.9"/>`; }).join('');
    const dotsB = bVals.map((v,i)=>{ const p=pt(v,i); return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#3b82f6" opacity="0.9"/>`; }).join('');
    const radarSVG = `<svg viewBox="0 0 250 250" width="100%" style="max-width:260px;display:block;margin:0 auto;overflow:visible;">
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--green)" stop-opacity=".25"/><stop offset="100%" stop-color="var(--green)" stop-opacity=".08"/></linearGradient>
        <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity=".25"/><stop offset="100%" stop-color="#3b82f6" stop-opacity=".08"/></linearGradient>
      </defs>
      ${gridLines}${axes}
      <polygon points="${polyA}" fill="url(#ga)" stroke="var(--green)" stroke-width="1.5" stroke-linejoin="round" opacity="0.9"/>
      <polygon points="${polyB}" fill="url(#gb)" stroke="#3b82f6" stroke-width="1.5" stroke-linejoin="round" opacity="0.9"/>
      ${dotsA}${dotsB}${labels}
    </svg>`;

    const last5 = data.weeks.slice(-5);
    const TW = 300, TH = 110, tPL = 22, tPR = 12, tPT = 18, tPB = 22;
    const tChartW = TW - tPL - tPR, tChartH = TH - tPT - tPB;
    const allTrendVals = [];
    [pa, pb].forEach(pd => last5.forEach(w => {
      const wi = data.weeks.indexOf(w);
      const v = pd.weeklyGenels[wi];
      if (v != null) allTrendVals.push(v * 10);
    }));
    const tMax = allTrendVals.length ? Math.min(99, Math.max(...allTrendVals) + 5) : 99;
    const tMin = allTrendVals.length ? Math.max(0, Math.min(...allTrendVals) - 5) : 0;
    const tToX = (i) => tPL + (i / Math.max(last5.length - 1, 1)) * tChartW;
    const tToY = (v) => tPT + tChartH - ((v - tMin) / (tMax - tMin || 1)) * tChartH;
    const trendLine = (pdata, color) => {
      const pts = last5.map((w,i) => {
        const wi = data.weeks.indexOf(w);
        const v = pdata.weeklyGenels[wi];
        return { x: tToX(i), y: v !== null ? tToY(v * 10) : null, v: v !== null ? +(v * 10).toFixed(1) : null };
      });
      const valid = pts.filter(p=>p.y!==null);
      if (!valid.length) return '';
      const path = valid.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const dots = pts.map(p=>p.y!==null ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}" opacity="0.9"/>` : '').join('');
      const vals = pts.map(p=>p.y!==null ? `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="${color}" opacity="0.9">${p.v}</text>` : '').join('');
      return `<path d="${path}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>${dots}${vals}`;
    };
    const tWeekLabels = last5.map((w,i)=>`<text x="${tToX(i).toFixed(1)}" y="${TH - 3}" text-anchor="middle" font-size="7.5" fill="var(--text3)" font-weight="600">${w.replace(/\d{4}-/,'')}</text>`).join('');
    const tGridLines = [0, 0.5, 1].map(f => {
      const v = (tMin + (tMax - tMin) * f).toFixed(0);
      const y = tToY(tMin + (tMax - tMin) * f).toFixed(1);
      return `<line x1="${tPL}" y1="${y}" x2="${TW - tPR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" opacity="0.5"/>
              <text x="${tPL - 3}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="7" fill="var(--text3)">${v}</text>`;
    }).join('');
    const trendSVG = `<svg viewBox="0 0 ${TW} ${TH}" width="100%" style="display:block;overflow:visible;">
      ${tGridLines}
      <line x1="${tPL}" y1="${tPT + tChartH}" x2="${TW - tPR}" y2="${tPT + tChartH}" stroke="var(--border)" stroke-width="0.75"/>
      ${trendLine(pa, 'var(--green)')}${trendLine(pb, '#3b82f6')}
      ${tWeekLabels}
    </svg>`;

    const duelRows = CRITERIA.map((c,ci) => {
      const av = aVals[ci], bv = bVals[ci], maxv = Math.max(av, bv, 0.1);
      const aW = Math.round(av/maxv*44), bW = Math.round(bv/maxv*44);
      const winner = av > bv ? 'a' : bv > av ? 'b' : '';
      return `<div style="display:grid;grid-template-columns:28px 1fr 50px 1fr 28px;align-items:center;gap:5px;margin-bottom:8px;">
        <span style="text-align:right;font-size:${winner==='a'?'13':'11'}px;font-weight:${winner==='a'?900:500};color:${winner==='a'?'var(--green)':'var(--text3)'};">${av.toFixed(1)}</span>
        <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;display:flex;justify-content:flex-end;"><div style="width:${aW}%;background:var(--green);border-radius:3px;opacity:0.9;"></div></div>
        <div style="text-align:center;font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.3px;">${CDISP[ci]}</div>
        <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;"><div style="width:${bW}%;height:100%;background:#3b82f6;border-radius:3px;opacity:0.9;"></div></div>
        <span style="font-size:${winner==='b'?'13':'11'}px;font-weight:${winner==='b'?900:500};color:${winner==='b'?'#3b82f6':'var(--text3)'};">${bv.toFixed(1)}</span>
      </div>`;
    }).join('');

    const aWins = aVals.filter((v,i)=>v>bVals[i]).length;
    const bWins = bVals.filter((v,i)=>v>aVals[i]).length;
    const aBestCrit = CRITERIA[aVals.indexOf(Math.max(...aVals))];
    const bBestCrit = CRITERIA[bVals.indexOf(Math.max(...bVals))];
    const aWorstCrit = CRITERIA[aVals.indexOf(Math.min(...aVals))];
    const bWorstCrit = CRITERIA[bVals.indexOf(Math.min(...bVals))];
    const aFormTrend = (() => { const v = pa.weeklyGenels.filter(x=>x!=null); if (v.length<2) return 'stabil'; return v[v.length-1]>v[v.length-2]?'yükselen':'düşen'; })();
    const bFormTrend = (() => { const v = pb.weeklyGenels.filter(x=>x!=null); if (v.length<2) return 'stabil'; return v[v.length-1]>v[v.length-2]?'yükselen':'düşen'; })();
    const overallWinner = aRating > bRating ? a : bRating > aRating ? b : null;
    const critLabels = { 'Pas':'Pas', 'Sut':'Şut', 'Dribling':'Dribling', 'Savunma':'Savunma', 'Hiz / Kondisyon':'Hız/Kondisyon', 'Fizik':'Fizik', 'Takim Oyunu':'Takım Oyunu' };

    const photoA = getPlayerPhoto(a), photoB = getPlayerPhoto(b);
    const avatarA = photoA ? `<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;margin:0 auto 10px;border:3px solid var(--green);box-shadow:0 4px 12px var(--gd);"><img src="${photoA}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'"></div>` : `<div class="av" style="width:64px;height:64px;font-size:22px;margin:0 auto 10px;border:3px solid var(--green);">${a.charAt(0)}</div>`;
    const avatarB = photoB ? `<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;margin:0 auto 10px;border:3px solid #3b82f6;box-shadow:0 4px 12px rgba(59,130,246,.2);"><img src="${photoB}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'"></div>` : `<div class="av" style="width:64px;height:64px;font-size:22px;margin:0 auto 10px;border:3px solid #3b82f6;background:#eff6ff;color:#3b82f6;">${b.charAt(0)}</div>`;

    const commentary = `<div style="background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px solid var(--border);border-radius:20px;padding:18px;margin-top:4px;">
      <div style="font-size:11px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">🤖 Otomatik Analiz</div>
      <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.7;">
        ${overallWinner
          ? `<b style="color:${overallWinner===a?'var(--green)':'#3b82f6'}">${overallWinner}</b>, <b>${Math.abs(aRating-bRating)}</b> puanlık farkla genel değerlendirmede öne çıkıyor.`
          : `İki oyuncu da aynı genel puanda! Oldukça dengeli bir duel.`}
        ${a}, <b>${aWins}</b> kriterde; ${b} ise <b>${bWins}</b> kriterde üstün.
      </div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text2);font-weight:600;">
        <div>💚 <b style="color:var(--green)">${a}</b>'nın en güçlü yönü: <b>${critLabels[aBestCrit]}</b> (${Math.max(...aVals).toFixed(1)}) — en çalışması gereken: ${critLabels[aWorstCrit]}</div>
        <div>🔵 <b style="color:#3b82f6">${b}</b>'nın en güçlü yönü: <b>${critLabels[bBestCrit]}</b> (${Math.max(...bVals).toFixed(1)}) — en çalışması gereken: ${critLabels[bWorstCrit]}</div>
        <div>📈 Form: <b style="color:var(--green)">${a}</b> <span style="color:${aFormTrend==='yükselen'?'var(--green)':'#f97316'}">${aFormTrend==='yükselen'?'↑ yükseliyor':'↓ düşüyor'}</span> — <b style="color:#3b82f6">${b}</b> <span style="color:${bFormTrend==='yükselen'?'var(--green)':'#f97316'}">${bFormTrend==='yükselen'?'↑ yükseliyor':'↓ düşüyor'}</span></div>
      </div>
    </div>`;

    el.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:grid;grid-template-columns:1fr 56px 1fr;align-items:center;gap:8px;">
          <div style="text-align:center;">${avatarA}
            <div style="font-weight:900;font-size:15px;margin-bottom:4px;">${a}</div>
            <div style="font-size:11px;color:var(--text3);font-weight:700;margin-bottom:8px;">${posLabel(paObj)}</div>
            <div style="font-size:36px;font-weight:900;color:var(--green);letter-spacing:-1px;line-height:1;">${aRating}</div>
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-top:2px;">PUAN</div>
          </div>
          <div style="text-align:center;font-size:13px;font-weight:900;color:var(--text3);background:var(--bg3);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 auto;">VS</div>
          <div style="text-align:center;">${avatarB}
            <div style="font-weight:900;font-size:15px;margin-bottom:4px;">${b}</div>
            <div style="font-size:11px;color:var(--text3);font-weight:700;margin-bottom:8px;">${posLabel(pbObj)}</div>
            <div style="font-size:36px;font-weight:900;color:#3b82f6;letter-spacing:-1px;line-height:1;">${bRating}</div>
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-top:2px;">PUAN</div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-bottom:14px;">
        <div class="slabel" style="margin-bottom:12px;">🕸️ Beceri Radari</div>
        <div style="display:flex;gap:16px;justify-content:center;margin-bottom:12px;">
          <span style="font-size:11px;font-weight:800;color:var(--green);display:flex;align-items:center;gap:5px;"><span style="width:12px;height:3px;background:var(--green);border-radius:2px;display:inline-block;"></span>${a}</span>
          <span style="font-size:11px;font-weight:800;color:#3b82f6;display:flex;align-items:center;gap:5px;"><span style="width:12px;height:3px;background:#3b82f6;border-radius:2px;display:inline-block;"></span>${b}</span>
        </div>
        ${radarSVG}
      </div>
      <div class="card" style="margin-bottom:14px;">
        <div class="slabel" style="margin-bottom:16px;">⚔️ Kritere Göre Karşılaştırma</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px;font-weight:800;">
          <span style="color:var(--green);">${a}</span>
          <span style="color:#3b82f6;">${b}</span>
        </div>
        ${duelRows}
      </div>
      <div class="card" style="margin-bottom:14px;">
        <div class="slabel" style="margin-bottom:4px;">📈 Son 5 Hafta Form Trendi</div>
        <div style="display:flex;gap:16px;margin-bottom:8px;">
          <span style="font-size:11px;font-weight:800;color:var(--green);">— ${a}</span>
          <span style="font-size:11px;font-weight:800;color:#3b82f6;">— ${b}</span>
        </div>
        ${trendSVG}
      </div>
      ${commentary}
    `;
  });
}

export function renderSezon() {
  const el = document.getElementById('sezonContent');
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  loadResults(data => {
    if (!data || !data.players || !data.weeks || !data.weeks.length) { el.innerHTML = '<div class="no-data">Henüz yeterli veri yok.</div>'; return; }
    const players = data.players.filter(p => p.genelOrt !== null);
    if (!players.length) { el.innerHTML = '<div class="no-data">Henüz puan girilmedi.</div>'; return; }

    const totalWeeks = data.weeks.length;
    const kritAvg = (p, c) => { let vals = []; if (p.weeklyKriterler) Object.values(p.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); }); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0; };
    const attendCount = (p) => p.weeklyGenels.filter(v => v != null).length;
    const stddev = (p) => { const vals = p.weeklyGenels.filter(v => v != null); if (vals.length < 2) return 999; const avg = vals.reduce((a,b)=>a+b,0)/vals.length; return Math.sqrt(vals.reduce((a,v)=>a+Math.pow(v-avg,2),0)/vals.length); };
    const last3Avg = (p) => { const vals = p.weeklyGenels.filter(v => v != null).slice(-3); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0; };
    const first3Avg = (p) => { const vals = p.weeklyGenels.filter(v => v != null).slice(0,3); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0; };
    const peakScore = (p) => Math.max(...p.weeklyGenels.filter(v => v != null), 0);

    const sorted = [...players].sort((a, b) => {
      const paObj = state.players.find(pl => pl.name === a.name) || { pos: ['OMO'] };
      const pbObj = state.players.find(pl => pl.name === b.name) || { pos: ['OMO'] };
      return (posRating(b, pbObj) || 0) - (posRating(a, paObj) || 0);
    });

    const mvp = sorted[0];
    const mostValuable = [...players].sort((a,b) => calcMarketValue(b,data) - calcMarketValue(a,data))[0];
    const mostCon = [...players].sort((a,b) => stddev(a) - stddev(b))[0];
    const mostAttend = [...players].sort((a,b) => attendCount(b) - attendCount(a))[0];
    const bestDef = [...players].sort((a,b) => kritAvg(b,'Savunma') - kritAvg(a,'Savunma'))[0];
    const bestFwd = [...players].sort((a,b) => kritAvg(b,'Sut') - kritAvg(a,'Sut'))[0];
    const bestPass = [...players].sort((a,b) => kritAvg(b,'Pas') - kritAvg(a,'Pas'))[0];
    const bestSpeed = [...players].sort((a,b) => kritAvg(b,'Hiz / Kondisyon') - kritAvg(a,'Hiz / Kondisyon'))[0];
    const bestProgress = [...players].sort((a,b) => (last3Avg(b) - first3Avg(b)) - (last3Avg(a) - first3Avg(a)))[0];
    const peakPlayer = [...players].sort((a,b) => peakScore(b) - peakScore(a))[0];

    const podium = sorted.slice(0, 3);
    const avgRating = (players.reduce((s,p) => { const pObj = state.players.find(pl=>pl.name===p.name)||{pos:['OMO']}; return s+(posRating(p,pObj)||0); },0)/players.length*10).toFixed(1);

    // ── SEASON BANNER ──────────────────────────────────────────
    let html = `
      <div class="sz-banner">
        <div class="sz-banner-noise"></div>
        <div class="sz-banner-inner">
          <div class="sz-banner-eyebrow">🏆 Sezon ${data.weeks[0].split('-')[0]}</div>
          <div class="sz-banner-headline">${totalWeeks} Hafta Serüveni</div>
          <div class="sz-banner-stats">
            <div class="sz-bstat">
              <span class="sz-bstat-val">${players.length}</span>
              <span class="sz-bstat-lbl">Oyuncu</span>
            </div>
            <div class="sz-bstat-div"></div>
            <div class="sz-bstat">
              <span class="sz-bstat-val">${players.reduce((s,p)=>s+attendCount(p),0)}</span>
              <span class="sz-bstat-lbl">Katılım</span>
            </div>
            <div class="sz-bstat-div"></div>
            <div class="sz-bstat">
              <span class="sz-bstat-val sz-gold">${avgRating}</span>
              <span class="sz-bstat-lbl">Ort. Rating</span>
            </div>
          </div>
        </div>
      </div>`;

    // ── PODIUM ─────────────────────────────────────────────────
    if (podium.length >= 1) {
      // visual order: 2nd · 1st · 3rd
      const podiumOrder = [1, 0, 2];
      const podiumMeta = [
        { col:'#94a3b8', platH:'90px',  photoSz:'60px', rankEmoji:'🥈', rankTxt:'2.' },
        { col:'#f59e0b', platH:'130px', photoSz:'80px', rankEmoji:'🥇', rankTxt:'1.' },
        { col:'#cd7f32', platH:'68px',  photoSz:'54px', rankEmoji:'🥉', rankTxt:'3.' },
      ];

      html += `<div class="sz-sec-hdr"><span>🥇 🥈 🥉 SEZON ŞAMPİYONLARI</span></div>
        <div class="sz-podium">` +
        podiumOrder.map((pi, slot) => {
          const p = podium[pi]; if (!p) return '';
          const meta = podiumMeta[slot];
          const pObjS = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
          const r = Math.min(99, Math.round((posRating(p, pObjS) || 0) * 10));
          const photo = getPlayerPhoto(p.name);
          const prog = ((last3Avg(p) - first3Avg(p)) * 10).toFixed(1);
          return `<div class="sz-pod-col" style="--pc:${meta.col};animation-delay:${slot*0.12}s">
            <div class="sz-pod-crown">${meta.rankEmoji}</div>
            <div class="sz-pod-photo" style="width:${meta.photoSz};height:${meta.photoSz};border-color:${meta.col};box-shadow:0 6px 20px ${meta.col}55">
              ${photo
                ? `<img src="${photo}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'">`
                : `<div class="sz-pod-initial" style="color:${meta.col}">${escHtml(p.name.charAt(0))}</div>`}
            </div>
            <div class="sz-pod-name">${escHtml(p.name)}</div>
            <div class="sz-pod-att">${attendCount(p)}/${totalWeeks} maç</div>
            <div class="sz-pod-plat" style="height:${meta.platH};background:linear-gradient(to top,${meta.col}40,${meta.col}12);border-color:${meta.col}88">
              <div class="sz-pod-score" style="color:${meta.col}">${r}</div>
              <div class="sz-pod-rank" style="color:${meta.col}">${meta.rankTxt} Sıra</div>
              ${+prog > 0 ? `<div class="sz-pod-prog">📈 +${prog}</div>` : ''}
            </div>
          </div>`;
        }).join('') +
        `</div>`;
    }

    // ── RANKING LIST ───────────────────────────────────────────
    html += `<div class="sz-sec-hdr"><span>📊 LİG SIRALAMASI</span></div><div class="sz-rank-list">`;
    sorted.forEach((p, i) => {
      const pObjS = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
      const r = Math.min(99, Math.round((posRating(p, pObjS) || 0) * 10));
      const mv = calcMarketValue(p, data);
      const att = attendCount(p);
      const photo = getPlayerPhoto(p.name);
      const trend = ((last3Avg(p) - first3Avg(p)) * 10);
      const trendDir = trend > 1 ? '↑' : trend < -1 ? '↓' : '→';
      const trendCol = trend > 1 ? 'var(--green)' : trend < -1 ? '#f97316' : 'var(--text3)';
      const rankIcons = ['🥇','🥈','🥉'];
      const isTop3 = i < 3;
      const nextR = i < sorted.length - 1
        ? Math.min(99, Math.round((posRating(sorted[i+1], state.players.find(pl=>pl.name===sorted[i+1].name)||{pos:['OMO']})||0)*10))
        : null;
      const gap = isTop3 && nextR !== null ? r - nextR : null;
      const attPct = totalWeeks ? Math.round(att / totalWeeks * 100) : 0;

      html += `
        <div class="sz-rank-row${isTop3?' sz-rank-top':''}">
          ${isTop3 ? '<div class="sz-rank-accent"></div>' : ''}
          <div class="sz-rank-num">${rankIcons[i] || `<span class="sz-rank-num-plain">${i+1}</span>`}</div>
          <div class="sz-rank-avatar">
            ${photo
              ? `<img src="${photo}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'">`
              : `<div class="sz-rank-initial">${escHtml(p.name.charAt(0))}</div>`}
          </div>
          <div class="sz-rank-info">
            <div class="sz-rank-name">${escHtml(p.name)}</div>
            <div class="sz-rank-meta">
              <span class="sz-chip">💪 ${att}/${totalWeeks}</span>
              <span class="sz-chip">${formatMoney(mv)}</span>
              <span class="sz-chip sz-chip-bar" style="--pct:${attPct}%">${attPct}%</span>
              ${gap !== null ? `<span class="sz-chip sz-chip-lead">+${gap} önde</span>` : ''}
            </div>
          </div>
          <div class="sz-rank-right">
            <div class="sz-rank-score" style="color:${scoreColor(r)}">${r}</div>
            <div class="sz-rank-trend" style="color:${trendCol}">${trendDir} ${Math.abs(trend).toFixed(1)}</div>
          </div>
        </div>`;
    });
    html += `</div>`;

    // ── AWARDS ─────────────────────────────────────────────────
    const awards = [
      { icon:'👑', bg:'linear-gradient(145deg,#92400e,#f59e0b)', title:'MVP',           sub:'En Yüksek Rating',   name:mvp.name,          val:Math.min(99,Math.round((posRating(mvp,state.players.find(pl=>pl.name===mvp.name)||{pos:['OMO']})||0)*10))+' puan' },
      { icon:'💎', bg:'linear-gradient(145deg,#1e3a8a,#38bdf8)', title:'PİYASA LİDERİ', sub:'Piyasa Değeri',      name:mostValuable.name,  val:formatMoney(calcMarketValue(mostValuable,data)) },
      { icon:'🎯', bg:'linear-gradient(145deg,#064e3b,#34d399)', title:'EN TUTARLI',    sub:'En Düşük Varyans',   name:mostCon.name,       val:'σ = '+stddev(mostCon).toFixed(2) },
      { icon:'🏃', bg:'linear-gradient(145deg,#4c1d95,#a78bfa)', title:'DEMİR ADAM',    sub:'En Çok Katılım',     name:mostAttend.name,    val:attendCount(mostAttend)+'/'+totalWeeks+' maç' },
      { icon:'🧱', bg:'linear-gradient(145deg,#1f2937,#6b7280)', title:'BETON DUVAR',   sub:'Savunma Şampiyonu',  name:bestDef.name,       val:kritAvg(bestDef,'Savunma').toFixed(1)+'/10' },
      { icon:'⚽', bg:'linear-gradient(145deg,#7f1d1d,#f87171)', title:'GOL MAKİNESİ', sub:'Şut Şampiyonu',      name:bestFwd.name,       val:kritAvg(bestFwd,'Sut').toFixed(1)+'/10' },
      { icon:'🎩', bg:'linear-gradient(145deg,#312e81,#818cf8)', title:'MAESTRİO',      sub:'Pas Şampiyonu',      name:bestPass.name,      val:kritAvg(bestPass,'Pas').toFixed(1)+'/10' },
      { icon:'⚡', bg:'linear-gradient(145deg,#78350f,#fbbf24)', title:'RÜZGAR',        sub:'Hız Şampiyonu',      name:bestSpeed.name,     val:kritAvg(bestSpeed,'Hiz / Kondisyon').toFixed(1)+'/10' },
      { icon:'📈', bg:'linear-gradient(145deg,#022c22,#6ee7b7)', title:'YILDIZ DOĞUŞU', sub:'En Çok İlerleme',   name:bestProgress.name,  val:'+'+((last3Avg(bestProgress)-first3Avg(bestProgress))*10).toFixed(1) },
      { icon:'🔥', bg:'linear-gradient(145deg,#450a0a,#ef4444)', title:'ZİRVECİ',       sub:'Tarihi En Yüksek',  name:peakPlayer.name,    val:Math.round(peakScore(peakPlayer)*10)+' puan' },
    ];

    html += `<div class="sz-sec-hdr"><span>🏅 ÖZEL ÖDÜLLER</span></div>
      <div class="sz-awards-grid">
        ${awards.map(a => `
          <div class="sz-award" style="background:${a.bg}">
            <div class="sz-award-bg-icon">${a.icon}</div>
            <div class="sz-award-icon">${a.icon}</div>
            <div class="sz-award-title">${a.title}</div>
            <div class="sz-award-name">${escHtml(a.name)}</div>
            <div class="sz-award-sub">${a.sub}</div>
            <div class="sz-award-val">${a.val}</div>
          </div>`).join('')}
      </div>`;

    const CSS = `<style>
      /* ── sezon tab ──────────────────────────────────── */
      #sezonContent { padding-bottom: 12px; }

      /* banner */
      .sz-banner { background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#0f172a 100%);border-radius:18px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.35); }
      .sz-banner-noise { position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 22px,rgba(255,255,255,0.022) 22px,rgba(255,255,255,0.022) 23px);pointer-events:none; }
      .sz-banner-inner { position:relative;z-index:1; }
      .sz-banner-eyebrow { font-size:10px;font-weight:900;color:rgba(147,197,253,.8);letter-spacing:3px;text-transform:uppercase;margin-bottom:4px; }
      .sz-banner-headline { font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;margin-bottom:16px; }
      .sz-banner-stats { display:flex;align-items:center;gap:0;background:rgba(255,255,255,.08);border-radius:14px;overflow:hidden; }
      .sz-bstat { flex:1;text-align:center;padding:10px 6px;display:flex;flex-direction:column;gap:3px; }
      .sz-bstat-val { font-size:20px;font-weight:900;color:#fff;line-height:1; }
      .sz-bstat-lbl { font-size:9px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px; }
      .sz-bstat-div { width:1px;background:rgba(255,255,255,.15);align-self:stretch;margin:8px 0; }
      .sz-gold { color:#fbbf24 !important; }

      /* section header */
      .sz-sec-hdr { display:flex;align-items:center;gap:10px;margin:22px 0 12px;font-size:10px;font-weight:900;color:var(--text3);text-transform:uppercase;letter-spacing:2px; }
      .sz-sec-hdr::before,.sz-sec-hdr::after { content:'';flex:1;height:1px;background:var(--border); }

      /* podium */
      .sz-podium { display:flex;align-items:flex-end;justify-content:center;gap:6px;margin-bottom:4px; }
      .sz-pod-col { flex:1;max-width:128px;display:flex;flex-direction:column;align-items:center;animation:szPodIn .5s ease-out both; }
      .sz-pod-crown { font-size:20px;margin-bottom:5px; }
      .sz-pod-photo { border-radius:50%;overflow:hidden;border:3px solid;background:var(--bg3);flex-shrink:0;margin-bottom:7px; }
      .sz-pod-initial { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900; }
      .sz-pod-name { font-size:12px;font-weight:900;color:var(--text);text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;margin-bottom:2px; }
      .sz-pod-att { font-size:10px;color:var(--text3);font-weight:700;margin-bottom:7px; }
      .sz-pod-plat { width:100%;border:2px solid;border-bottom:none;border-radius:8px 8px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 4px 8px;gap:2px; }
      .sz-pod-score { font-size:26px;font-weight:900;line-height:1; }
      .sz-pod-rank { font-size:9px;font-weight:800;opacity:.7;text-transform:uppercase;letter-spacing:1px; }
      .sz-pod-prog { font-size:10px;font-weight:800;color:#4ade80;margin-top:4px; }

      /* ranking list */
      .sz-rank-list { display:flex;flex-direction:column;gap:8px;margin-bottom:4px; }
      .sz-rank-row { display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--bg2);border-radius:14px;border:1.5px solid var(--border2);position:relative;overflow:hidden; }
      .sz-rank-top { border-color:var(--border);box-shadow:var(--sh-card); }
      .sz-rank-accent { position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(to bottom,var(--green),var(--green-dark));border-radius:2px 0 0 2px; }
      .sz-rank-num { width:28px;text-align:center;flex-shrink:0;font-size:18px;line-height:1; }
      .sz-rank-num-plain { font-size:13px;font-weight:900;color:var(--text3); }
      .sz-rank-avatar { width:42px;height:42px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg3);border:1.5px solid var(--border); }
      .sz-rank-initial { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:var(--green); }
      .sz-rank-info { flex:1;min-width:0; }
      .sz-rank-name { font-size:13px;font-weight:800;letter-spacing:-.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:5px; }
      .sz-rank-meta { display:flex;align-items:center;gap:4px;flex-wrap:wrap; }
      .sz-chip { display:inline-block;background:var(--bg3);padding:3px 7px;border-radius:6px;font-size:10px;font-weight:700;color:var(--text3);white-space:nowrap; }
      .sz-chip-lead { background:rgba(16,185,129,.13);color:var(--green); }
      .sz-chip-bar { position:relative;overflow:hidden; }
      .sz-chip-bar::before { content:'';position:absolute;left:0;top:0;bottom:0;width:var(--pct);background:rgba(16,185,129,.18);border-radius:6px; }
      .sz-rank-right { text-align:right;flex-shrink:0;min-width:44px; }
      .sz-rank-score { font-size:26px;font-weight:900;letter-spacing:-1px;line-height:1; }
      .sz-rank-trend { font-size:10px;font-weight:700;margin-top:3px; }

      /* awards */
      .sz-awards-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px; }
      .sz-award { border-radius:16px;padding:14px 12px;position:relative;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.28); }
      .sz-award-bg-icon { position:absolute;top:-8px;right:-8px;font-size:54px;opacity:.1;pointer-events:none;line-height:1; }
      .sz-award-icon { font-size:22px;margin-bottom:6px;position:relative;z-index:1;line-height:1; }
      .sz-award-title { font-size:8px;font-weight:900;color:rgba(255,255,255,.65);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;position:relative;z-index:1; }
      .sz-award-name { font-size:13px;font-weight:900;color:#fff;letter-spacing:-.3px;margin-bottom:3px;position:relative;z-index:1;word-break:break-word;line-height:1.25;hyphens:auto; }
      .sz-award-sub { font-size:10px;font-weight:600;color:rgba(255,255,255,.6);position:relative;z-index:1;margin-bottom:8px;line-height:1.3; }
      .sz-award-val { font-size:12px;font-weight:900;color:#fff;padding-top:8px;border-top:1px solid rgba(255,255,255,.18);position:relative;z-index:1; }

      @keyframes szPodIn { from { opacity:0;transform:translateY(20px); } to { opacity:1;transform:translateY(0); } }
    </style>`;

    el.innerHTML = CSS + html;
  });
}

export function renderKatilim() {
  const el = document.getElementById('attendContent');
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  loadResults(data => {
    if (!data || !data.weeks || !data.weeks.length) { el.innerHTML = '<div class="no-data">Veri yok.</div>'; return; }
    const tw = data.weeks.length;
    const rows = state.players.map(p => {
      const dp = asArray(data.players).find(x => x.name === p.name);
      const count = dp ? dp.weeklyGenels.filter(v => v != null).length : 0;
      return { name: p.name, pos: p.pos, count, pct: tw ? Math.round(count / tw * 100) : 0 };
    }).sort((a, b) => b.count - a.count);
    let html = '<table class="rtbl"><thead><tr><th>Oyuncu</th><th>Katılım</th><th>Oran</th></tr></thead><tbody>';
    rows.forEach(r => {
      html += `<tr><td><div style="font-weight:800;font-size:15px;margin-bottom:4px;">${r.name}</div><div style="font-size:11px;color:var(--text3);font-weight:700">${posLabel({pos:r.pos})}</div></td><td style="color:var(--text);font-weight:900;font-size:18px;">${r.count}<span style="font-size:12px;color:var(--text3)">/${tw}</span></td><td><div style="display:flex;align-items:center;gap:12px"><div class="mbar" style="min-width:60px;"><div class="mfill" style="width:${r.pct}%"></div></div><span style="font-size:14px;font-weight:900;color:var(--green);">%${r.pct}</span></div></td></tr>`;
    });
    el.innerHTML = html + '</tbody></table>';
  });
}

export function loadMatchHistory() {
  const elAdmin = document.getElementById('matchHistory');
  const elPublic = document.getElementById('publicMatchHistory');
  const render = (data) => {
    let html = '<div class="no-data">Kayıtlı maç bulunamadı.</div>';
    if (data && data.matches && data.matches.length) {
      const totalMatches = data.matches.length;
      const totalGoals = data.matches.reduce((s,m)=> s + (+m.score1||0) + (+m.score2||0), 0);
      const w1 = data.matches.filter(m=>+m.score1>+m.score2).length;
      const w2 = data.matches.filter(m=>+m.score2>+m.score1).length;
      html = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
        ${[['🏟️','Maç',totalMatches],['⚽','Gol',totalGoals],['⚪','Beyaz',w1],['🔵','Renkli',w2]].map(([ic,lb,vl])=>
          `<div style="text-align:center;padding:12px 6px;background:var(--bg2);border-radius:14px;box-shadow:var(--sh-card);border:1px solid var(--border);">
            <div style="font-size:18px;margin-bottom:4px;">${ic}</div>
            <div style="font-size:20px;font-weight:900;color:var(--text);letter-spacing:-0.5px;">${vl}</div>
            <div style="font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">${lb}</div>
          </div>`).join('')}
      </div>`;
      html += data.matches.slice().reverse().map(m => {
        const s1 = +m.score1, s2 = +m.score2;
        const win1 = s1 > s2, win2 = s2 > s1, isDraw = s1 === s2;
        const resultLabel = isDraw
          ? `<span style="background:#f1f5f9;color:#64748b;font-size:10px;font-weight:800;padding:3px 10px;border-radius:10px;">BERABERLIK</span>`
          : `<span style="background:${win1?'#ecfdf5':'#eff6ff'};color:${win1?'#065f46':'#1e40af'};font-size:10px;font-weight:800;padding:3px 10px;border-radius:10px;">${win1?'⚪ BEYAZ KAZANDI':'🔵 RENKLİ KAZANDI'}</span>`;
        const goalEntries = m.goals ? Object.entries(m.goals) : [];
        const team1Goals = goalEntries.filter(([,g])=>g.t===1||g.t==='1'||g.team===1||g.team==='1');
        const team2Goals = goalEntries.filter(([,g])=>g.t===2||g.t==='2'||g.team===2||g.team==='2');
        const neutralGoals = goalEntries.filter(([,g])=>!g.t&&!g.team);
        const goalBadge = (name, g, color) => {
          let parts = [];
          if (g.g) parts.push(`⚽×${g.g}`);
          if (g.a) parts.push(`🅰×${g.a}`);
          return `<span style="font-size:11px;font-weight:700;color:${color};background:var(--bg2);padding:5px 10px;border-radius:10px;box-shadow:var(--sh);display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);">${name} <span style="opacity:.7">${parts.join(' ')}</span></span>`;
        };
        const allGoalBadges = neutralGoals.length
          ? neutralGoals.map(([n,g])=>goalBadge(n,g,'var(--text)')).join('')
          : [...team1Goals.map(([n,g])=>goalBadge(n,g,'#065f46')), ...team2Goals.map(([n,g])=>goalBadge(n,g,'#1e40af'))].join('');
        return `<div style="background:var(--bg2);border-radius:20px;padding:16px;margin-bottom:14px;box-shadow:var(--sh-card);border:1px solid var(--border);overflow:hidden;position:relative;">
          ${win1?`<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:var(--green);border-radius:4px 0 0 4px;"></div>`:''}
          ${win2?`<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:#3b82f6;border-radius:4px 0 0 4px;"></div>`:''}
          ${isDraw?`<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:#94a3b8;border-radius:4px 0 0 4px;"></div>`:''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-left:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;font-weight:800;color:var(--green);background:var(--gd);padding:4px 10px;border-radius:10px;border:1px solid #10b98130;">${m.week}</span>
              ${resultLabel}
            </div>
            <span style="font-size:10px;color:var(--text3);font-weight:600;">${m.date||''}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:0 8px;">
            <div style="flex:1;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;">⚪ Beyaz Takım</div>
              <div style="font-size:44px;font-weight:900;line-height:1;letter-spacing:-2px;color:${win1?'var(--green)':'var(--text)'};">${m.score1}</div>
              ${win1?`<div style="font-size:10px;font-weight:800;color:var(--green);margin-top:4px;">KAZANAN</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 16px;">
              <div style="font-size:22px;color:var(--text3);font-weight:900;">—</div>
            </div>
            <div style="flex:1;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;">🔵 Renkli Takım</div>
              <div style="font-size:44px;font-weight:900;line-height:1;letter-spacing:-2px;color:${win2?'#3b82f6':'var(--text)'};">${m.score2}</div>
              ${win2?`<div style="font-size:10px;font-weight:800;color:#3b82f6;margin-top:4px;">KAZANAN</div>`:''}
            </div>
          </div>
          ${(m.note || allGoalBadges) ? `
          <div style="background:var(--bg3);border-radius:14px;padding:12px;margin-top:4px;padding-left:8px;">
            ${m.note?`<div style="font-size:12px;color:var(--text2);font-weight:600;margin-bottom:${allGoalBadges?'10':'0'}px;display:flex;align-items:center;gap:6px;">📝 ${m.note}</div>`:''}
            ${allGoalBadges?`<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">⚽ Goller & Asistler</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${allGoalBadges}</div>`:''}
          </div>` : ''}
        </div>`;
      }).join('');
    }
    if (elAdmin) elAdmin.innerHTML = html;
    if (elPublic) elPublic.innerHTML = html;
  };
  const cached = lGet('hs_matches_cache');
  if (cached) { try { state.matchesData = normalizeMatchesData(JSON.parse(cached)); render(state.matchesData); } catch(e) {} }
  else {
    if (elAdmin) elAdmin.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
    if (elPublic) elPublic.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  }
  gs({action:'getMatches'}).then(data => {
    const normalized = normalizeMatchesData(data);
    const newStr = JSON.stringify(normalized);
    if (cached !== newStr) { lSet('hs_matches_cache', newStr); state.matchesData = normalized; render(normalized); }
  }).catch(() => {});
}

