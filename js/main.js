import { TEAM_CONFIG, CRITERIA, CDISP, POS, POS_EMOJIS } from './config.js';
import { CURRENT_TEAM, lGet, lSet, lRem } from './storage.js';
import { state } from './state.js';
import { escHtml, normPos, posLabel, san, getPlayerPhoto, getWeekLabel, getAutoWeekLabel, formatMoney, scoreColor, ratingColor, cardClass, showToast, showConfirm, closeConfirm, countUp } from './utils.js';
import { calcStdDev, posRating, calcMarketValue, getPlayStyles } from './rating.js';
import { findOptimalLineup, PRESET_META } from './lineup-optimizer.js';
import { loadPlayersFromSheets, loadMevkilerFromSheets, initSelects, checkIdentityLock, resetIdentity, onRaterChange, buildCards, onSlider, updateProgress, submitRatings, closeSuccessPopup, buildGoalInputs, stepGoal, restoreDraft, dismissDraft } from './players.js';
import { loadResults, loadManualWeek, setRankTab, renderSonuc, renderHafta, selectWeekBtn, renderTrend, renderComparison, renderSezon, renderKatilim, loadMatchHistory, renderDenge } from './stats.js';
import { renderProfile } from './profile.js';
import { shareProfileCard, doShareCard, closeSharePreview, copyShareCaption } from './sharecard.js';
import { tryAdmin, checkPin, logoutAdmin, setAdminTab, loadBugunTab, toggleBugun, bugunSelectAll, bugunClearAll, saveBugunGelenler, loadHakemTab, selectHakem, saveHakemToSheet, clearHakem, renderPlayerList, selectPos, confirmPos, togglePosDropdown, closePosDropdown, addPlayer, removePlayer, saveMatch, loadVideos, loadAdminVideos, selectVideoWeek, selectVideoWeekByUrl, adminSaveVideo, saveCurrentWeek, resetWeekToAuto, loadVoteSetting, saveVoteSetting, refreshPhotos, renderAnomalies } from './admin.js';

if (state.darkMode) document.body.classList.add('dark');

function arr(value) {
  return Array.isArray(value) ? value : [];
}

// ─── TEAM UI ─────────────────────────────────────────────────────────────────
function updateTeamUI() {
  const config = TEAM_CONFIG[CURRENT_TEAM] || TEAM_CONFIG.haldunalagas;
  const logoEl = document.getElementById('teamLogo');
  const nameEl = document.getElementById('teamName');
  const bgNameEl = document.getElementById('bgTeamName');
  const teamBadgeEl = document.getElementById('teamBadge');
  if (logoEl) logoEl.src = config.logo;
  if (nameEl) nameEl.innerText = config.name;
  if (bgNameEl) bgNameEl.innerText = config.name;
  if (teamBadgeEl) {
    teamBadgeEl.textContent = config.emoji + ' ' + config.name;
    teamBadgeEl.style.background = config.color + '22';
    teamBadgeEl.style.color = config.color;
    teamBadgeEl.style.borderColor = config.color + '44';
  }
}

function updateDarkBtn() {
  const btn = document.getElementById('darkBtn');
  if (btn) btn.innerText = state.darkMode ? '☀️' : '🌙';
}

function toggleDark() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('hs_dark', state.darkMode ? '1' : '0');
  document.body.classList.toggle('dark', state.darkMode);
  updateDarkBtn();
}

// ─── TEAM SELECTION ──────────────────────────────────────────────────────────
function showTeamConfirm(teamId) {
  const config = TEAM_CONFIG[teamId];
  if (!config) return;
  const bg = document.getElementById('teamConfirmBg');
  if (!bg) { selectTeam(teamId); return; }
  const header = document.getElementById('teamConfirmHeader');
  const logoEl = document.getElementById('teamConfirmLogo');
  const nameEl = document.getElementById('teamConfirmName');
  const okBtn = document.getElementById('teamConfirmOkBtn');
  if (header) {
    header.style.background = config.color + '18';
    header.style.borderBottom = `1px solid ${config.color}33`;
  }
  if (logoEl) { logoEl.src = config.logo; logoEl.alt = config.name; }
  if (nameEl) { nameEl.textContent = config.name; nameEl.style.color = config.color; }
  if (okBtn) {
    okBtn.style.background = config.color;
    okBtn.onclick = () => { bg.classList.remove('open'); selectTeam(teamId); };
  }
  bg.classList.add('open');
}

function selectTeam(teamId) {
  sessionStorage.setItem('pitchrank_selected_team', teamId);
  location.reload();
}

function resetTeam() {
  showConfirm('Takım seçim ekranına dönmek istediğinize emin misiniz?', () => {
    if (CURRENT_TEAM) localStorage.setItem('pitchrank_last_team', CURRENT_TEAM);
    sessionStorage.removeItem('pitchrank_selected_team');
    location.reload();
  });
}

function markLastTeam() {
  const lastTeam = localStorage.getItem('pitchrank_last_team');
  if (!lastTeam || !TEAM_CONFIG[lastTeam]) return;
  const config = TEAM_CONFIG[lastTeam];
  const btn = document.getElementById('teamBtn-' + lastTeam);
  if (!btn) return;
  btn.style.border = `1.5px solid ${config.color}`;
  btn.style.boxShadow = `0 0 0 4px ${config.color}22`;
  const badge = document.createElement('span');
  badge.textContent = 'Son Seçim';
  badge.style.cssText = `position:absolute;top:-10px;right:16px;background:${config.color};color:#fff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;`;
  btn.style.position = 'relative';
  btn.appendChild(badge);
}

// ─── SCREEN NAVIGASYON ───────────────────────────────────────────────────────
function switchMainScreen(id, btnElement) {
  if (id === 'profil' && !state.currentRater) {
    showToast('Önce kimliğini seç');
    switchMainScreen('puanla', document.querySelector('.bnav-item[onclick*="puanla"]'));
    return;
  }

  const current = document.querySelector('.screen.active:not(.leaving)');
  const next = document.getElementById(`screen-${id}`);
  if (!next || next === current) return;

  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const doEnter = () => {
    document.querySelectorAll('.screen:not(.leaving)').forEach(s => s.classList.remove('active', 'is-entering'));
    next.classList.add('active', 'is-entering');
    setTimeout(() => next.classList.remove('is-entering'), 440);
    window.scrollTo({ top: 0 });
    if (id === 'siralama') renderSonuc(makeFifaCard);
    if (id === 'istatistik') {
      const activeSub = document.querySelector('#screen-istatistik .sub-screen.active');
      if (activeSub) {
        const sid = activeSub.id.replace('stat-', '');
        if (sid === 'hafta') renderHafta();
        else if (sid === 'trend' && document.getElementById('trendSelect').value) renderTrend();
        else if (sid === 'karsi') renderComparison();
        else if (sid === 'sezon') renderSezon();
        else if (sid === 'katilim') renderKatilim();
        else if (sid === 'maclar') loadMatchHistory();
        else if (sid === 'denge') renderDenge();
      }
    }
    if (id === 'takim') { renderTodayPlayers(); if (!state.resultData) loadResults(() => {}); }
    if (id === 'profil') {
      if (!state.resultData) { loadResults(() => { renderProfile(); }); } else { renderProfile(); }
    }
  };

  if (current) {
    current.classList.add('leaving');
    setTimeout(() => {
      current.classList.remove('active', 'leaving');
      doEnter();
    }, 160);
  } else {
    doEnter();
  }
}

function updateRefreshTime() {
  const timeEl = document.getElementById('refreshTime');
  if (!timeEl) return;
  if (!state.lastRefreshTime) { timeEl.textContent = ''; return; }
  const mins = Math.floor((Date.now() - state.lastRefreshTime) / 60000);
  if (mins < 1) timeEl.textContent = 'az önce';
  else if (mins < 60) timeEl.textContent = `${mins} dk`;
  else timeEl.textContent = `${Math.floor(mins / 60)} sa`;
}

function refreshData() {
  const btn = document.getElementById('refreshBtn');
  const icon = btn?.querySelector('.refresh-icon');
  if (btn?.disabled) return;
  if (btn) btn.disabled = true;
  if (icon) icon.classList.add('spinning');

  state.matchesData = null;
  loadResults(() => {
    state.lastRefreshTime = Date.now();
    updateRefreshTime();
    if (icon) icon.classList.remove('spinning');
    if (btn) btn.disabled = false;

    const active = document.querySelector('.screen.active');
    const sid = active?.id?.replace('screen-', '');
    if (sid === 'siralama') renderSonuc(makeFifaCard);
    else if (sid === 'profil' && state.currentRater) renderProfile();
    else if (sid === 'istatistik') {
      const sub = document.querySelector('#screen-istatistik .sub-screen.active');
      const ssid = sub?.id?.replace('stat-', '');
      if (ssid === 'hafta') renderHafta();
      else if (ssid === 'trend' && document.getElementById('trendSelect')?.value) renderTrend();
      else if (ssid === 'karsi') renderComparison();
      else if (ssid === 'sezon') renderSezon();
      else if (ssid === 'katilim') renderKatilim();
      else if (ssid === 'maclar') loadMatchHistory();
      else if (ssid === 'denge') renderDenge();
    }
    showToast('Veriler güncellendi');
  }, true);
}

function setStatScreen(id, btnElement) {
  const next = document.getElementById(`stat-${id}`);
  if (!next) return;
  document.querySelectorAll('#screen-istatistik .sub-screen').forEach(s => s.classList.remove('active', 'is-entering'));
  document.querySelectorAll('#screen-istatistik .sub-nb').forEach(b => b.classList.remove('active'));
  next.classList.add('active', 'is-entering');
  setTimeout(() => next.classList.remove('is-entering'), 300);
  if (btnElement) btnElement.classList.add('active');
  if (id === 'hafta') renderHafta();
  if (id === 'trend' && document.getElementById('trendSelect').value) renderTrend();
  if (id === 'karsi') renderComparison();
  if (id === 'sezon') renderSezon();
  if (id === 'katilim') renderKatilim();
  if (id === 'maclar') loadMatchHistory();
  if (id === 'denge') renderDenge();
}

// ─── FIFA KART ────────────────────────────────────────────────────────────────
function makeFifaCard(p, pObj, rank, data, overrideScore) {
  const wAvg = overrideScore !== undefined ? overrideScore : posRating(p, pObj);
  const rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : Math.min(99, Math.round((p.genelOrt || 0) * 10));
  const posArr = normPos(pObj);
  const posKey = posArr[0] || 'OMO';
  const posName = POS[posKey] || posKey;
  const col = ratingColor(rating);
  const cls = cardClass(rating);
  const rankBadge = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '';
  const photoUrl = getPlayerPhoto(p.name);
  const marketVal = calcMarketValue(p, data);
  const moneyStr = formatMoney(marketVal);
  const styles = getPlayStyles(p);
  const topStyles = styles.slice(0, 2).map(s => `<span style="font-size:12px;margin-bottom:2px;" title="${s.name}">${s.icon}</span>`).join('');
  const statKeys = ['Pas','Sut','Dribling','Savunma','Hiz / Kondisyon','Fizik'];
  const statLabels = ['PAS','ŞUT','DRB','SAV','HIZ','FIZ'];
  const statVals = statKeys.map(c => {
    let vals = [];
    if (p.weeklyKriterler) Object.values(p.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) : 0;
  });
  const statRow = (ci) => `<div class="fc-stat"><span class="fc-stat-val" style="color:${col.text}">${statVals[ci]}</span><span class="fc-stat-lbl" style="color:${col.text}bb">${statLabels[ci]}</span></div>`;
  const photoHTML = photoUrl
    ? `<img src="${escHtml(photoUrl)}" loading="lazy" onerror="this.outerHTML='<div class=\\'fc-photo-ph\\' style=\\'color:${col.text}\\'>${escHtml(p.name.charAt(0))}</div>'">`
    : `<div class="fc-photo-ph" style="color:${col.text}">${escHtml(p.name.charAt(0))}</div>`;
  const card = document.createElement('div');
  card.className = `fc ${cls}`;
  card.innerHTML = `
    <div class="fc-bg"></div>
    ${rankBadge ? `<div class="fc-badge">${rankBadge}</div>` : ''}
    <div class="fc-top">
      <div>
        <div class="fc-rating" style="color:${col.text}">${rating}</div>
        <div class="fc-pos-tag" style="color:${col.text}cc">${posKey}</div>
      </div>
      <div class="fc-icons" style="color:${col.text}">${topStyles}</div>
    </div>
    <div class="fc-photo">${photoHTML}</div>
    <div class="fc-bottom">
      <div class="fc-name" style="color:${col.text}">${escHtml(p.name.toUpperCase())}</div>
      <div style="text-align:center;font-size:9px;font-weight:900;color:${col.text};opacity:.85;margin-top:-4px;margin-bottom:4px;letter-spacing:1px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));">💶 ${moneyStr}</div>
      <div class="fc-sep" style="background:${col.text}"></div>
      <div class="fc-stats" style="color:${col.text}">
        <div class="fc-stats-col">${statRow(0)}${statRow(1)}${statRow(2)}</div>
        <div class="fc-stats-div" style="background:${col.text}"></div>
        <div class="fc-stats-col">${statRow(3)}${statRow(4)}${statRow(5)}</div>
      </div>
    </div>`;
  card.onclick = () => openProfile(p, data);
  return card;
}

// ─── PROFIL MODAL ────────────────────────────────────────────────────────────
function openProfile(p, data) {
  state.currentProfileName = p.name;
  const pObjP = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
  const wAvg = posRating(p, pObjP);
  const rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : (p.genelOrt ? Math.min(99, Math.round(p.genelOrt * 10)) : 0);
  const marketVal = calcMarketValue(p, data);
  const sdev = calcStdDev(p);
  const styles = getPlayStyles(p);
  const posArr = normPos(pObjP);
  const posKey = posArr[0] || 'OMO';
  const cls = cardClass(rating);
  const col = ratingColor(rating);

  const kOrt = {};
  CRITERIA.forEach(c => {
    let vals = [];
    if (p.weeklyKriterler) Object.values(p.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
    kOrt[c] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  const heroGrad = {
    'fc-gold': 'linear-gradient(160deg,#2a1e00 0%,#9e7b00 30%,#fde047 50%,#9e7b00 70%,#2a1e00 100%)',
    'fc-silver': 'linear-gradient(160deg,#0f172a 0%,#334155 30%,#94a3b8 55%,#334155 80%,#0f172a 100%)',
    'fc-bronze': 'linear-gradient(160deg,#1c0700 0%,#6b3300 30%,#b45309 55%,#6b3300 80%,#1c0700 100%)',
    'fc-normal': 'linear-gradient(160deg,#0a1628 0%,#1e3a8a 30%,#2563eb 55%,#1e3a8a 80%,#0a1628 100%)'
  }[cls] || 'linear-gradient(160deg,#0a1628,#1e3a8a)';

  const weeks = arr(data && data.weeks);
  const weeklyGenels = arr(p && p.weeklyGenels);
  const last5 = weeks.slice(-5);
  const formBars = last5.map(w => {
    const wi = weeks.indexOf(w);
    const v = weeklyGenels[wi] ?? null;
    let r10 = null;
    if (v !== null) {
      const kr = p.weeklyKriterler?.[w] || {};
      const swd = { weeklyKriterler: { [w]: kr }, weeklyGenels: [v] };
      const wr = posRating(swd, pObjP);
      r10 = wr !== null ? Math.min(99, Math.round(wr * 10)) : Math.min(99, Math.round(v * 10));
    }
    const h = r10 !== null ? Math.max(8, Math.round(r10 / 99 * 36)) : 4;
    const barCol = r10 !== null ? (r10 >= 80 ? '#f59e0b' : r10 >= 65 ? col.text : '#64748b') : '#374151';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;">
      <div style="font-size:8px;font-weight:700;color:${r10!==null?barCol:'#4b5563'};line-height:1;">${r10 !== null ? r10 : '—'}</div>
      <div style="width:100%;max-width:18px;height:${h}px;background:${barCol};border-radius:2px 2px 0 0;opacity:${r10!==null?0.9:0.3};transition:height .3s;"></div>
      <div style="font-size:7px;color:rgba(255,255,255,0.4);font-weight:600;white-space:nowrap;">${w.replace(/\d{4}-/,'')}</div>
    </div>`;
  }).join('');

  const photoUrl = getPlayerPhoto(p.name);
  const attendCount = weeklyGenels.filter(v => v != null).length;
  const totalWeeks = weeks.length;
  const attendPct = totalWeeks ? Math.round(attendCount / totalWeeks * 100) : 0;

  const validKrits = CRITERIA.filter(c => kOrt[c] !== null);
  const bestCrit = validKrits.length ? validKrits.reduce((a,b)=>kOrt[a]>=kOrt[b]?a:b) : null;
  const worstCrit = validKrits.length ? validKrits.reduce((a,b)=>kOrt[a]<=kOrt[b]?a:b) : null;
  const critLabelMap = {'Pas':'Pas','Sut':'Şut','Dribling':'Dribling','Savunma':'Savunma','Hiz / Kondisyon':'Hız','Fizik':'Fizik','Takim Oyunu':'Takım'};

  const rcx = 90, rcy = 90, rr = 62, rn = CRITERIA.length;
  const rang = (i) => (i/rn)*2*Math.PI - Math.PI/2;
  const rpt = (v,i) => ({ x: rcx + rr*(v/10)*Math.cos(rang(i)), y: rcy + rr*(v/10)*Math.sin(rang(i)) });
  const rpoly = CRITERIA.map((c,i)=>{ const vv=kOrt[c]||0; const pp=rpt(vv,i); return `${pp.x.toFixed(1)},${pp.y.toFixed(1)}`; }).join(' ');
  const rgrid = [0.3,0.6,1].map(f=>{
    const gg=Array.from({length:rn},(_,i)=>`${(rcx+rr*f*Math.cos(rang(i))).toFixed(1)},${(rcy+rr*f*Math.sin(rang(i))).toFixed(1)}`).join(' ');
    return `<polygon points="${gg}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.75"/>`;
  }).join('');
  const raxes = Array.from({length:rn},(_,i)=>`<line x1="${rcx}" y1="${rcy}" x2="${(rcx+rr*Math.cos(rang(i))).toFixed(1)}" y2="${(rcy+rr*Math.sin(rang(i))).toFixed(1)}" stroke="rgba(255,255,255,0.1)" stroke-width="0.75"/>`).join('');
  const rlbls = CRITERIA.map((c,i)=>{
    const lx=rcx+(rr+20)*Math.cos(rang(i)), ly=rcy+(rr+20)*Math.sin(rang(i));
    const anchor = lx<rcx-4?'end':lx>rcx+4?'start':'middle';
    const base = ly<rcy-4?'auto':ly>rcy+4?'hanging':'middle';
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="${base}" font-size="8" font-weight="700" fill="rgba(255,255,255,0.55)">${CDISP[i]}</text>`;
  }).join('');
  const rdots = CRITERIA.map((c,i)=>{ const vv=kOrt[c]||0; const pp=rpt(vv,i); return `<circle cx="${pp.x.toFixed(1)}" cy="${pp.y.toFixed(1)}" r="2.5" fill="${col.text}" opacity="0.95"/>`; }).join('');

  const profileHero = document.getElementById('profileHero');
  const modalBody = document.getElementById('modalBody');
  const modalBg = document.getElementById('modalBg');
  if (!profileHero || !modalBody || !modalBg) return;

  profileHero.className = `pmo-hero pmo-${cls}`;
  modalBody.className = 'pmo-body';
  profileHero.innerHTML = `
    <div class="pmo-hero-bg"></div>
    <div class="pmo-wm" style="color:${col.text}">${rating}</div>
    <div class="pmo-hero-gradient"></div>
    <div class="pmo-photo-wrap">
      ${photoUrl
        ? `<img src="${escHtml(photoUrl)}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="pmo-photo-init" style="color:${col.text}">${escHtml(p.name.charAt(0))}</div>`}
    </div>
    <div class="pmo-hero-inner">
      <div class="pmo-hero-top">
        <div class="pmo-rating-num" style="color:${col.text}">${rating}</div>
        <span class="pmo-pos-badge" style="color:${col.text};border-color:${col.text}40;background:${col.text}18">${posKey}</span>
      </div>
      <div>
        <div class="pmo-hero-name">${escHtml(p.name)}</div>
        <div class="pmo-hero-tags">
          <span class="pmo-tag-val" style="color:${col.text};border-color:${col.text}33">💶 ${formatMoney(marketVal)}</span>
          ${styles.slice(0, 2).map(s => `<span class="pmo-tag-style">${escHtml(s.icon)} ${escHtml(s.name)}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  modalBody.innerHTML = `
    <div class="pmo-chips-row">
      ${[
        ['📅', attendCount + (totalWeeks ? '/' + totalWeeks : ''), 'Maç'],
        ['🎯', sdev < 0.5 ? 'A+' : sdev < 1.5 ? 'B' : 'C', 'Form'],
        ['%', attendPct, 'Devm.'],
        ['📊', validKrits.length, 'Kriter']
      ].map(([ic, vl, lb]) => `<div class="pmo-stat-chip">
        <span class="pmo-chip-icon">${ic}</span>
        <span class="pmo-chip-val">${vl}</span>
        <span class="pmo-chip-lbl">${lb}</span>
      </div>`).join('')}
    </div>
    ${bestCrit ? `<div class="pmo-bw-row">
      <div class="pmo-bw-card pmo-bw-best">
        <span class="pmo-bw-icon">💪</span>
        <div>
          <div class="pmo-bw-label">Güçlü Yön</div>
          <div class="pmo-bw-crit">${critLabelMap[bestCrit]}</div>
          <div class="pmo-bw-score" style="color:var(--green)">${kOrt[bestCrit].toFixed(1)}</div>
        </div>
      </div>
      <div class="pmo-bw-card pmo-bw-weak">
        <span class="pmo-bw-icon">📈</span>
        <div>
          <div class="pmo-bw-label">Gelişmeli</div>
          <div class="pmo-bw-crit">${critLabelMap[worstCrit]}</div>
          <div class="pmo-bw-score" style="color:var(--text3)">${kOrt[worstCrit].toFixed(1)}</div>
        </div>
      </div>
    </div>` : ''}
    <div class="pmo-attrs-section">
      <div class="pmo-section-hdr">Kriter Ortalamaları</div>
      ${CRITERIA.map((c, ci) => {
        const v = kOrt[c];
        const pct = v !== null ? Math.round(v / 10 * 100) : 0;
        const barC = v !== null ? scoreColor(v) : 'var(--text3)';
        return `<div class="pmo-attr">
          <div class="pmo-attr-top">
            <span class="pmo-attr-name">${CDISP[ci]}</span>
            <span class="pmo-attr-score" style="color:${barC}">${v !== null ? v.toFixed(1) : '—'}</span>
          </div>
          <div class="pmo-attr-track">
            <div class="pmo-attr-fill" style="width:${pct}%;background:${barC}"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${last5.length ? `<div class="pmo-form-section">
      <div class="pmo-section-hdr">📅 Son ${last5.length} Hafta</div>
      <div class="pmo-form-row">
        ${last5.map(w => {
          const wi = weeks.indexOf(w);
          const v = weeklyGenels[wi] ?? null;
          const r10 = v !== null ? Math.min(99, Math.round(v * 10)) : null;
          const cc = r10 !== null ? ratingColor(r10).text : 'var(--text3)';
          return `<div class="pmo-form-cell">
            <div class="pmo-form-score" style="color:${cc}">${r10 !== null ? r10 : '—'}</div>
            <div class="pmo-form-week">${w.replace(/\d{4}-/, '')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;
  modalBg.classList.add('open');
  requestAnimationFrame(() => {
    const rNum = profileHero.querySelector('.pmo-rating-num');
    if (rNum && rating > 0) { rNum.textContent = '0'; countUp(rNum, rating, 700); }
  });
}

function shareProfile() {
  const pName = state.currentProfileName;
  if (!pName) return;
  const pObj = state.players.find(pl => pl.name === pName) || { pos: ['OMO'] };
  let rating = '—';
  const pData = state.resultData && state.resultData.players ? state.resultData.players.find(x => x.name === pName) : null;
  if (pData) { const wAvg = posRating(pData, pObj); rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : (pData.genelOrt ? Math.round(pData.genelOrt * 10) : '—'); }
  const shareText = `⚽ PitchRank\n\nOyuncu: ${pName}\nMevki: ${posLabel(pObj)}\n⭐ Rating: ${rating}\n\nIstatistiklerine göz at!`;
  if (navigator.share) { navigator.share({title:`${pName} - Oyuncu Profili`, text:shareText, url:window.location.href}).catch(console.error); }
  else { navigator.clipboard.writeText(shareText).then(() => showToast('Profil bilgileri kopyalandı!')); }
}

function closeModal(e, force) {
  if (force || (e && e.target === document.getElementById('modalBg'))) document.getElementById('modalBg').classList.remove('open');
}

// ─── TAKTIK ───────────────────────────────────────────────────────────────────
let _teamA = [], _teamB = [];

function renderTodayPlayers() {
  const el = document.getElementById('todayPlayers');
  if (!el) return;
  el.innerHTML = state.players.map(p => {
    if (!(p.name in state.todaySelected)) state.todaySelected[p.name] = true;
    const on = state.todaySelected[p.name];
    const pos = normPos(p)[0] || 'OMO';
    return `<button data-name="${escHtml(p.name)}" onclick="toggleToday(this.dataset.name)" id="td-${san(p.name)}" class="tk-chip${on?' tk-chip-on':''}">
      ${POS_EMOJIS[pos]||''} ${escHtml(p.name)}
    </button>`;
  }).join('');
}

function toggleToday(name) {
  state.todaySelected[name] = !state.todaySelected[name];
  const btn = document.getElementById(`td-${san(name)}`);
  if (!btn) return;
  btn.classList.toggle('tk-chip-on', state.todaySelected[name]);
}

function selectAllPlayers() { state.players.forEach(p => state.todaySelected[p.name] = true); renderTodayPlayers(); }
function clearAllPlayers() { state.players.forEach(p => state.todaySelected[p.name] = false); renderTodayPlayers(); }

function buildTeams() {
  const noDataEl = document.getElementById('noDataTakim');
  const teamResultEl = document.getElementById('teamResult');
  if (!noDataEl || !teamResultEl) return;
  noDataEl.style.display = 'none';
  teamResultEl.innerHTML = '';
  const selected = state.players.filter(p => state.todaySelected[p.name] !== false);
  if (selected.length < 4) { noDataEl.style.display = 'block'; return; }
  if (!state.resultData) {
    teamResultEl.innerHTML = '<div class="no-data"><span class="spin"></span>Veriler yükleniyor…</div>';
    loadResults(data => { if (data) buildTeamsWithData(selected); else { noDataEl.style.display = 'block'; teamResultEl.innerHTML = ''; } });
    return;
  }
  buildTeamsWithData(selected);
}

function buildTeamsWithData(selected) {
  const kritAvg = (pData, c) => {
    if (!pData || !pData.weeklyKriterler) return 5;
    const vals = Object.values(pData.weeklyKriterler).map(wk => wk && wk[c] != null ? +wk[c] : null).filter(v => v !== null);
    return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 5;
  };
  const players = selected.map(pl => {
    const pos = normPos(pl)[0] || 'OMO';
    const pData = state.resultData && state.resultData.players ? state.resultData.players.find(x => x.name === pl.name) : null;
    const pr = pData ? posRating(pData, pl) : null;
    const avg = pr != null ? pr : (pData?.genelOrt || 5);
    return {
      name: pl.name, pos, pobj: pl, avg,
      pas:   kritAvg(pData, 'Pas'),
      sut:   kritAvg(pData, 'Sut'),
      sav:   kritAvg(pData, 'Savunma'),
      takim: kritAvg(pData, 'Takim Oyunu'),
      hiz:   kritAvg(pData, 'Hiz / Kondisyon'),
    };
  }).sort((a, b) => b.avg - a.avg);

  // Separate GKs, snake-draft field players by posRating
  const kls = players.filter(p => p.pos === 'KL');
  const field = players.filter(p => p.pos !== 'KL');
  const t1 = [], t2 = [];
  field.forEach((p, i) => (i % 2 === 0 ? t1 : t2).push(p));
  if (kls.length >= 2) { t1.push(kls[0]); t2.push(kls[1]); }
  else if (kls.length === 1) { t1.push(kls[0]); }

  // Multi-metric swap optimization (field players only)
  const fieldMetrics = (t) => {
    const f = t.filter(p => p.pos !== 'KL');
    if (!f.length) return { avg:5, pas:5, sut:5, sav:5, takim:5, hiz:5 };
    const n = f.length;
    return {
      avg:   f.reduce((s,p) => s+p.avg,   0) / n,
      pas:   f.reduce((s,p) => s+p.pas,   0) / n,
      sut:   f.reduce((s,p) => s+p.sut,   0) / n,
      sav:   f.reduce((s,p) => s+p.sav,   0) / n,
      takim: f.reduce((s,p) => s+p.takim, 0) / n,
      hiz:   f.reduce((s,p) => s+p.hiz,   0) / n,
    };
  };
  const imbalance = (m1, m2) =>
    Math.abs(m1.avg   - m2.avg)   * 5
    + Math.abs(m1.pas   - m2.pas)
    + Math.abs(m1.sut   - m2.sut)
    + Math.abs(m1.sav   - m2.sav)
    + Math.abs(m1.takim - m2.takim)
    + Math.abs(m1.hiz   - m2.hiz) * 0.5;

  let improved = true, iters = 0;
  while (improved && iters++ < 120) {
    improved = false;
    const f1 = t1.filter(p => p.pos !== 'KL');
    const f2 = t2.filter(p => p.pos !== 'KL');
    const cur = imbalance(fieldMetrics(t1), fieldMetrics(t2));
    outer:
    for (let i = 0; i < f1.length; i++) {
      for (let j = 0; j < f2.length; j++) {
        const i1 = t1.indexOf(f1[i]), i2 = t2.indexOf(f2[j]);
        [t1[i1], t2[i2]] = [t2[i2], t1[i1]];
        if (imbalance(fieldMetrics(t1), fieldMetrics(t2)) < cur - 0.001) { improved = true; break outer; }
        [t1[i1], t2[i2]] = [t2[i2], t1[i1]];
      }
    }
  }

  _teamA = t1;
  _teamB = t2;
  renderTeams();
}

function buildOptimalLineup(presetKey = 'dengeli') {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.preset-btn[data-preset="${presetKey}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  const noDataEl = document.getElementById('noDataTakim');
  const teamResultEl = document.getElementById('teamResult');
  if (!noDataEl || !teamResultEl) return;
  noDataEl.style.display = 'none';
  teamResultEl.innerHTML = '';

  const selected = state.players.filter(p => state.todaySelected[p.name] !== false);
  if (selected.length < 5) { noDataEl.style.display = 'block'; teamResultEl.innerHTML = '<div class="no-data">Optimal kadro için en az 5 oyuncu seçilmeli.</div>'; return; }

  const runOptimizer = () => {
    const available = selected.map(pObj => {
      const pData = state.resultData && state.resultData.players ? state.resultData.players.find(x => x.name === pObj.name) : null;
      return { pObj, pData };
    });
    const result = findOptimalLineup(available, presetKey);
    if (!result) {
      teamResultEl.innerHTML = '<div class="no-data">Geçerli bir 5\'li bulunamadı (1 KL, 1-2 DEF, 1-2 OMO, 1 FRV gerekir).</div>';
      return;
    }
    renderOptimalLineup(result);
  };

  if (!state.resultData) {
    teamResultEl.innerHTML = '<div class="no-data"><span class="spin"></span>Veriler yükleniyor…</div>';
    loadResults(data => { if (data) runOptimizer(); else { noDataEl.style.display = 'block'; teamResultEl.innerHTML = ''; } });
    return;
  }
  runOptimizer();
}

function renderOptimalLineup(result) {
  const teamResult = document.getElementById('teamResult');
  if (!teamResult) return;
  const meta = PRESET_META[result.preset] || PRESET_META.dengeli;
  const order = { KL: 0, DEF: 1, OMO: 2, FRV: 3 };
  const sorted = [...result.lineup].sort((a, b) => (order[a.posKey] - order[b.posKey]) || (b.score - a.score));
  const avgScore = result.totalScore / result.lineup.length;
  const avgRating = Math.min(99, Math.round(avgScore * 10));

  const rows = sorted.map(p => {
    const r = Math.min(99, Math.round((p.score || 0) * 10));
    return `<div class="tk-player-row">
      <span class="tk-p-pos">${POS_EMOJIS[p.posKey] || '⚽'}</span>
      <span class="tk-p-name">${escHtml(p.name)}</span>
      <span class="tk-p-score" style="color:${ratingColor(r).text}">${r}</span>
    </div>`;
  }).join('');

  teamResult.innerHTML = `
    <div class="tk-balance-bar">
      <span class="tk-bal-label" style="color:var(--green)">${meta.emoji} ${escHtml(meta.label)} — Optimal 5'li</span>
      <span class="tk-bal-diff">Ortalama: ${avgRating}</span>
    </div>
    <div class="tk-team-card" style="margin-top:10px;">
      <div class="tk-team-hdr tk-hdr-white">
        <span>🪄 Önerilen Kadro</span>
        <span class="tk-hdr-avg">${avgRating}</span>
      </div>
      ${rows}
    </div>`;
}

function shuffleTeams() {
  const selected = state.players.filter(p => state.todaySelected[p.name] !== false);
  const noDataEl = document.getElementById('noDataTakim');
  if (!noDataEl) return;
  if (selected.length < 4) { noDataEl.style.display = 'block'; return; }
  noDataEl.style.display = 'none';
  const players = selected.map(pl => {
    const pData = state.resultData && state.resultData.players ? state.resultData.players.find(x => x.name === pl.name) : null;
    return { name: pl.name, avg: pData ? posRating(pData, pl) ?? pData.genelOrt ?? 5 : 5, pos: normPos(pl)[0] || 'OMO', pobj: pl, pas:5, sut:5, sav:5, takim:5, hiz:5 };
  });
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  const mid = Math.ceil(players.length / 2);
  _teamA = players.slice(0, mid);
  _teamB = players.slice(mid);
  renderTeams();
}

function swapPlayer(name) {
  const idxA = _teamA.findIndex(p => p.name === name);
  if (idxA !== -1) { _teamB.push(_teamA.splice(idxA, 1)[0]); }
  else { const idxB = _teamB.findIndex(p => p.name === name); if (idxB !== -1) _teamA.push(_teamB.splice(idxB, 1)[0]); }
  renderTeams();
}

function renderTeams() {
  const teamResult = document.getElementById('teamResult');
  if (!teamResult || !_teamA.length || !_teamB.length) return;
  const fieldAvg = (t) => { const f = t.filter(p => p.pos !== 'KL'); return f.length ? f.reduce((s,p) => s+(p.avg||0), 0) / f.length : 0; };
  const avg1 = fieldAvg(_teamA), avg2 = fieldAvg(_teamB);
  const diff = Math.abs(avg1 - avg2);
  const balLabel = diff < 0.3 ? '✅ Dengeli' : diff < 0.6 ? '⚠️ Yakın' : '⛔ Dengesiz';
  const balColor = diff < 0.3 ? 'var(--green)' : diff < 0.6 ? '#eab308' : '#ef4444';

  const playerRow = (p, arrow) => {
    const r = Math.min(99, Math.round((p.avg || 0) * 10));
    return `<div class="tk-player-row">
      <span class="tk-p-pos">${POS_EMOJIS[p.pos]||'⚽'}</span>
      <span class="tk-p-name">${escHtml(p.name)}</span>
      <span class="tk-p-score" style="color:${ratingColor(r).text}">${r}</span>
      <button class="tk-swap-btn" onclick="swapPlayer('${escHtml(p.name)}')" title="Diğer takıma taşı">${arrow}</button>
    </div>`;
  };

  teamResult.innerHTML = `
    <div class="tk-balance-bar">
      <span class="tk-bal-label" style="color:${balColor}">${balLabel}</span>
      <span class="tk-bal-diff">Fark: ${(diff*10).toFixed(1)} puan</span>
    </div>
    <div class="tk-teams-grid">
      <div class="tk-team-card">
        <div class="tk-team-hdr tk-hdr-white">
          <span>⚪ Beyaz</span>
          <span class="tk-hdr-avg">${Math.round(avg1*10)}</span>
        </div>
        ${_teamA.map(p => playerRow(p, '→')).join('')}
      </div>
      <div class="tk-team-card">
        <div class="tk-team-hdr tk-hdr-blue">
          <span>🔵 Renkli</span>
          <span class="tk-hdr-avg">${Math.round(avg2*10)}</span>
        </div>
        ${_teamB.map(p => playerRow(p, '←')).join('')}
      </div>
    </div>`;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initApp() {
  const el = (id) => document.getElementById(id);
  const has = (id) => !!el(id);

  const homeScreen = el('screen-home');
  const appScreen = el('app');
  const navBar = document.querySelector('.bottom-nav');

  if (!CURRENT_TEAM) {
    if (homeScreen) homeScreen.style.display = 'flex';
    if (appScreen) appScreen.style.display = 'none';
    if (navBar) navBar.style.display = 'none';
    document.body.classList.add('home-active');
    markLastTeam();
    return;
  }

  if (homeScreen) homeScreen.style.display = 'none';
  if (appScreen) appScreen.style.display = 'block';
  if (navBar) navBar.style.display = 'flex';
  document.body.classList.remove('home-active');

  updateTeamUI();
  updateDarkBtn();
  if (!window._refreshInterval) window._refreshInterval = setInterval(updateRefreshTime, 60000);

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('shareCardPreviewBg')?.classList.contains('open')) {
      closeSharePreview();
      return;
    }
    document.querySelectorAll('.mbg.open').forEach(function(m) { m.classList.remove('open'); });
  });
  const raterSel = el('raterSelect');
  if (raterSel) {
    raterSel.disabled = true;
    raterSel.innerHTML = '<option>⏳ Oyuncular yükleniyor...</option>';
  }

  loadManualWeek(() => {
    if (has('matchWeek')) el('matchWeek').value = getWeekLabel();
    loadPlayersFromSheets(() => {
      loadMevkilerFromSheets(() => {
        if (raterSel) raterSel.disabled = false;
        const loadBanner = el('appLoadingBanner');
        if (loadBanner) loadBanner.style.display = 'none';
        if (has('raterSelect') || has('trendSelect') || has('cmpA') || has('cmpB')) initSelects();
        if (has('playerList')) renderPlayerList();
        if (has('goalInputs')) buildGoalInputs();
        if (has('raterSelect')) checkIdentityLock();
        setTimeout(() => {
          if (has('fifaGrid') || has('weekContent') || has('trendContent') || has('cmpContent')) {
            loadResults(() => { state.lastRefreshTime = Date.now(); updateRefreshTime(); }, false);
          }
          if (has('matchHistory')) loadMatchHistory();
        }, 500);
      });
    });
  });
}

// ─── WINDOW EXPORTS ──────────────────────────────────────────────────────────
// main.js functions
window.initApp = initApp;
window.switchMainScreen = switchMainScreen;
window.renderProfile = renderProfile;
window.setStatScreen = setStatScreen;
window.makeFifaCard = makeFifaCard;
window.openProfile = openProfile;
window.shareProfile = shareProfile;
window.closeModal = closeModal;
window.updateTeamUI = updateTeamUI;
window.updateDarkBtn = updateDarkBtn;
window.toggleDark = toggleDark;
window.refreshData = refreshData;
window.restoreDraft = restoreDraft;
window.dismissDraft = dismissDraft;
window.shareProfileCard  = shareProfileCard;
window.doShareCard       = doShareCard;
window.closeSharePreview = closeSharePreview;
window.copyShareCaption  = copyShareCaption;
window.showTeamConfirm = showTeamConfirm;
window.selectTeam = selectTeam;
window.resetTeam = resetTeam;
window.markLastTeam = markLastTeam;
window.renderTodayPlayers = renderTodayPlayers;
window.toggleToday = toggleToday;
window.selectAllPlayers = selectAllPlayers;
window.clearAllPlayers = clearAllPlayers;
window.buildTeams = buildTeams;
window.shuffleTeams = shuffleTeams;
window.swapPlayer = swapPlayer;
window.buildOptimalLineup = buildOptimalLineup;

// players.js functions
window.onRaterChange = onRaterChange;
window.resetIdentity = resetIdentity;
window.onSlider = onSlider;
window.submitRatings = submitRatings;
window.closeSuccessPopup = closeSuccessPopup;
window.stepGoal = stepGoal;

// stats.js functions
window.setRankTab = setRankTab;
window.selectWeekBtn = selectWeekBtn;
window.renderTrend = renderTrend;
window.renderComparison = renderComparison;
window.renderSezon = renderSezon;
window.renderKatilim = renderKatilim;

// admin.js functions
window.tryAdmin = tryAdmin;
window.checkPin = checkPin;
window.logoutAdmin = logoutAdmin;
window.setAdminTab = setAdminTab;
window.loadBugunTab = loadBugunTab;
window.toggleBugun = toggleBugun;
window.bugunSelectAll = bugunSelectAll;
window.bugunClearAll = bugunClearAll;
window.saveBugunGelenler = saveBugunGelenler;
window.selectHakem = selectHakem;
window.saveHakemToSheet = saveHakemToSheet;
window.clearHakem = clearHakem;
window.renderPlayerList = renderPlayerList;
window.selectPos = selectPos;
window.confirmPos = confirmPos;
window.togglePosDropdown = togglePosDropdown;
window.closePosDropdown = closePosDropdown;
window.addPlayer = addPlayer;
window.removePlayer = removePlayer;
window.saveMatch = saveMatch;
window.loadVideos = loadVideos;
window.loadAdminVideos = loadAdminVideos;
window.selectVideoWeek = selectVideoWeek;
window.selectVideoWeekByUrl = selectVideoWeekByUrl;
window.adminSaveVideo = adminSaveVideo;
window.saveCurrentWeek = saveCurrentWeek;
window.resetWeekToAuto = resetWeekToAuto;
window.loadVoteSetting = loadVoteSetting;
window.saveVoteSetting = saveVoteSetting;
window.refreshPhotos = refreshPhotos;
window.renderAnomalies = renderAnomalies;

// utils.js functions
window.showToast = showToast;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;
