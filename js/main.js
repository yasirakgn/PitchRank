import { TEAM_CONFIG, CRITERIA, CDISP, POS } from './config.js';
import { CURRENT_TEAM, lGet, lSet, lRem } from './storage.js';
import { state } from './state.js';
import { escHtml, normPos, posLabel, san, getPlayerPhoto, getWeekLabel, getAutoWeekLabel, formatMoney, scoreColor, ratingColor, cardClass, showToast, showConfirm, closeConfirm } from './utils.js';
import { calcStdDev, posRating, calcMarketValue, getPlayStyles } from './rating.js';
import { savePlayers, loadPlayersFromSheets, loadMevkilerFromSheets, initSelects, checkIdentityLock, resetIdentity, onRaterChange, buildCards, onSlider, updateProgress, submitRatings, closeSuccessPopup, buildGoalInputs, stepGoal } from './players.js';
import { loadResults, loadManualWeek, setRankTab, renderSonuc, renderHafta, selectWeekBtn, renderTrend, renderComparison, renderSezon, renderKatilim, loadMatchHistory } from './stats.js';
import { tryAdmin, checkPin, logoutAdmin, setAdminTab, loadBugunTab, toggleBugun, bugunSelectAll, bugunClearAll, saveBugunGelenler, loadHakemTab, selectHakem, saveHakemToSheet, clearHakem, renderPlayerList, selectPos, confirmPos, togglePosDropdown, closePosDropdown, addPlayer, removePlayer, saveMatch, loadVideos, selectVideoWeek, selectVideoWeekByUrl, adminSaveVideo, saveCurrentWeek, resetWeekToAuto, loadVoteSetting, saveVoteSetting } from './admin.js';

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
  lSet('hs_dark', state.darkMode ? '1' : '0');
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
  const emojiEl = document.getElementById('teamConfirmEmoji');
  const nameEl = document.getElementById('teamConfirmName');
  const okBtn = document.getElementById('teamConfirmOkBtn');
  if (header) {
    header.style.background = config.color + '18';
    header.style.borderBottom = `1px solid ${config.color}33`;
  }
  if (emojiEl) emojiEl.textContent = config.emoji;
  if (nameEl) { nameEl.textContent = config.name; nameEl.style.color = config.color; }
  if (okBtn) {
    okBtn.style.background = config.color;
    okBtn.onclick = () => { bg.classList.remove('open'); selectTeam(teamId); };
  }
  bg.classList.add('open');
}

function selectTeam(teamId) {
  localStorage.setItem('pitchrank_selected_team', teamId);
  location.reload();
}

function resetTeam() {
  showConfirm('Takım seçim ekranına dönmek istediğinize emin misiniz?', () => {
    if (CURRENT_TEAM) localStorage.setItem('pitchrank_last_team', CURRENT_TEAM);
    localStorage.removeItem('pitchrank_selected_team');
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

// ─── SCREEN NAVİGASYON ───────────────────────────────────────────────────────
function switchMainScreen(id, btnElement) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  const screen = document.getElementById(`screen-${id}`);
  if (!screen) return;
  screen.classList.add('active');
  if (btnElement) btnElement.classList.add('active');
  window.scrollTo({top: 0, behavior: 'smooth'});
  if (id === 'siralama') renderSonuc(makeFifaCard);
  if (id === 'istatistik') {
    const activeSub = document.querySelector('#screen-istatistik .sub-screen.active');
    if (activeSub) {
      const sid = activeSub.id.replace('stat-','');
      if (sid === 'hafta') renderHafta();
      else if (sid === 'trend' && document.getElementById('trendSelect').value) renderTrend();
      else if (sid === 'karsi') renderComparison();
      else if (sid === 'sezon') renderSezon();
      else if (sid === 'katilim') renderKatilim();
      else if (sid === 'maclar') loadMatchHistory();
    }
  }
  if (id === 'takim') { renderTodayPlayers(); if (!state.resultData) loadResults(() => {}); }
}

function setStatScreen(id, btnElement) {
  document.querySelectorAll('#screen-istatistik .sub-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#screen-istatistik .sub-nb').forEach(b => b.classList.remove('active'));
  const screen = document.getElementById(`stat-${id}`);
  if (!screen) return;
  screen.classList.add('active');
  if (btnElement) btnElement.classList.add('active');
  if (id === 'hafta') renderHafta();
  if (id === 'trend' && document.getElementById('trendSelect').value) renderTrend();
  if (id === 'karsi') renderComparison();
  if (id === 'sezon') renderSezon();
  if (id === 'katilim') renderKatilim();
  if (id === 'maclar') loadMatchHistory();
}

// ─── FIFA KART ────────────────────────────────────────────────────────────────
function makeFifaCard(p, pObj, rank, data, overrideScore) {
  const wAvg = overrideScore !== undefined ? overrideScore : posRating(p, pObj);
  const rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : Math.round((p.genelOrt || 0) * 10);
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
  const statLabels = ['PAS','ŞUT','DRB','SAV','HIZ','FİZ'];
  const statVals = statKeys.map(c => {
    let vals = [];
    if (p.weeklyKriterler) Object.values(p.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) : 0;
  });
  const statRow = (ci) => `<div class="fc-stat"><span class="fc-stat-val" style="color:${col.text}">${statVals[ci]}</span><span class="fc-stat-lbl" style="color:${col.text}bb">${statLabels[ci]}</span></div>`;
  const photoHTML = photoUrl
    ? `<img src="${photoUrl}" loading="lazy" onerror="this.outerHTML='<div class=\\'fc-photo-ph\\' style=\\'color:${col.text}\\'>${p.name.charAt(0)}</div>'">`
    : `<div class="fc-photo-ph" style="color:${col.text}">${p.name.charAt(0)}</div>`;
  const card = document.createElement('div');
  card.className = `fc ${cls}`;
  card.innerHTML = `
    <div class="fc-bg"></div>
    ${rankBadge ? `<div class="fc-badge">${rankBadge}</div>` : ''}
    <div class="fc-top">
      <div>
        <div class="fc-rating" style="color:${col.text}">${rating}</div>
        <div class="fc-pos-tag" style="color:${col.text}cc">${posName}</div>
      </div>
      <div class="fc-icons" style="color:${col.text}">${topStyles}</div>
    </div>
    <div class="fc-photo">${photoHTML}</div>
    <div class="fc-bottom">
      <div class="fc-name" style="color:${col.text}">${p.name.toUpperCase()}</div>
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

// ─── PROFİL MODAL ────────────────────────────────────────────────────────────
function openProfile(p, data) {
  state.currentProfileName = p.name;
  const pObjP = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
  const wAvg = posRating(p, pObjP);
  const rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : (p.genelOrt ? Math.round(p.genelOrt * 10) : 0);
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
    const r10 = v !== null ? Math.min(99, Math.round(v * 10)) : null;
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

  profileHero.innerHTML = `
    <div style="background:${heroGrad};position:absolute;inset:0;"></div>
    <div style="position:absolute;inset:0;opacity:0.04;background-image:url('data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"200\\" height=\\"200\\"><filter id=\\"n\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.9\\" numOctaves=\\"4\\"/></filter><rect width=\\"200\\" height=\\"200\\" filter=\\"url(%23n)\\"/></svg>');"></div>
    <div style="position:absolute;top:18px;left:20px;z-index:5;">
      <div style="font-size:52px;font-weight:900;color:${col.text};line-height:1;letter-spacing:-2px;text-shadow:0 4px 12px rgba(0,0,0,0.5);">${rating}</div>
      <div style="font-size:10px;font-weight:800;color:${col.text};opacity:0.7;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">${POS[posKey]||posKey}</div>
    </div>
    <div style="position:absolute;right:0;bottom:0;height:175px;width:130px;z-index:3;overflow:hidden;">
      ${photoUrl
        ? `<img src="${photoUrl}" loading="lazy" style="position:absolute;bottom:0;right:0;height:175px;width:auto;max-width:160px;object-fit:contain;object-position:bottom right;filter:drop-shadow(-6px 0 16px rgba(0,0,0,0.5));" onerror="this.style.display='none'">`
        : `<div style="position:absolute;bottom:20px;right:20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:${col.text};border:2px solid rgba(255,255,255,0.2);">${p.name.charAt(0)}</div>`}
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;z-index:4;padding:14px 18px 16px;background:linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 100%);">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.5);">${p.name}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:800;color:${col.text};background:rgba(0,0,0,0.3);padding:3px 10px;border-radius:20px;border:1px solid ${col.text}33;letter-spacing:.5px;">💶 ${formatMoney(marketVal)}</span>
        ${styles.slice(0,3).map(s=>`<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.1);padding:3px 9px;border-radius:20px;border:1px solid rgba(255,255,255,0.15);">${s.icon} ${s.name}</span>`).join('')}
      </div>
    </div>
    ${last5.length ? `<div style="position:absolute;left:20px;bottom:62px;display:flex;align-items:flex-end;gap:4px;z-index:5;width:120px;">${formBars}</div>` : ''}
  `;

  modalBody.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0;">
      ${[
        ['📅', attendCount + (totalWeeks?'/'+totalWeeks:''), 'Maç'],
        ['🎯', sdev < 0.5 ? 'A+' : sdev < 1.5 ? 'B' : 'C', 'Form'],
        ['%', attendPct, 'Devm.'],
        ['📊', validKrits.length, 'Kriter']
      ].map(([ic,vl,lb])=>`<div style="text-align:center;background:var(--bg3);border-radius:14px;padding:10px 6px;border:1px solid var(--border2);">
        <div style="font-size:16px;margin-bottom:2px;">${ic}</div>
        <div style="font-size:16px;font-weight:900;color:var(--text);letter-spacing:-0.5px;line-height:1;">${vl}</div>
        <div style="font-size:8px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${lb}</div>
      </div>`).join('')}
    </div>
    ${bestCrit ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="background:var(--gl);border:1px solid #10b98130;border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:20px;">💪</span>
        <div><div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.5px;">Güçlü Yön</div><div style="font-size:13px;font-weight:800;color:var(--text);margin-top:1px;">${critLabelMap[bestCrit]}</div><div style="font-size:11px;color:var(--green);font-weight:700;">${kOrt[bestCrit].toFixed(1)}</div></div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:20px;">📈</span>
        <div><div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">Gelişmeli</div><div style="font-size:13px;font-weight:800;color:var(--text);margin-top:1px;">${critLabelMap[worstCrit]}</div><div style="font-size:11px;color:var(--text3);font-weight:700;">${kOrt[worstCrit].toFixed(1)}</div></div>
      </div>
    </div>` : ''}
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">
      <div style="flex-shrink:0;background:var(--bg3);border-radius:16px;padding:10px;border:1px solid var(--border2);">
        <svg viewBox="0 0 180 180" width="150" height="150" style="display:block;overflow:visible;">
          <defs>
            <linearGradient id="prf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${col.text}" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="${col.text}" stop-opacity="0.05"/>
            </linearGradient>
          </defs>
          ${rgrid}${raxes}
          <polygon points="${rpoly}" fill="url(#prf)" stroke="${col.text}" stroke-width="1.5" stroke-linejoin="round" opacity="0.95"/>
          ${rdots}${rlbls}
        </svg>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px;padding-top:4px;">
        ${CRITERIA.map((c,ci) => {
          const v = kOrt[c];
          const pct = v !== null ? Math.round(v/10*100) : 0;
          const barC = v !== null ? scoreColor(v) : 'var(--text3)';
          return `<div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
              <span style="font-size:9px;font-weight:700;color:var(--text2);">${CDISP[ci]}</span>
              <span style="font-size:10px;font-weight:900;color:${barC};">${v!==null?v.toFixed(1):'—'}</span>
            </div>
            <div style="height:4px;background:var(--border2);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${barC};border-radius:2px;transition:width .5s;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ${last5.length ? `<div style="background:var(--bg3);border-radius:16px;padding:12px;border:1px solid var(--border2);">
      <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">📅 Son ${last5.length} Hafta</div>
      <div style="display:flex;gap:6px;">
        ${last5.map(w => {
          const wi = weeks.indexOf(w);
          const v = weeklyGenels[wi] ?? null;
          const r10 = v !== null ? Math.min(99, Math.round(v*10)) : null;
          const cc = r10!==null ? ratingColor(r10).text : 'var(--text3)';
          return `<div style="flex:1;text-align:center;background:var(--bg2);border-radius:10px;padding:6px 4px;border:1px solid var(--border2);">
            <div style="font-size:14px;font-weight:900;color:${cc};line-height:1;">${r10!==null?r10:'—'}</div>
            <div style="font-size:7px;font-weight:700;color:var(--text3);margin-top:2px;">${w.replace(/\d{4}-/,'')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;
  modalBg.classList.add('open');
}

function shareProfile() {
  const pName = state.currentProfileName;
  if (!pName) return;
  const pObj = state.players.find(pl => pl.name === pName) || { pos: ['OMO'] };
  let rating = '—';
  const pData = state.resultData && state.resultData.players ? state.resultData.players.find(x => x.name === pName) : null;
  if (pData) { const wAvg = posRating(pData, pObj); rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : (pData.genelOrt ? Math.round(pData.genelOrt * 10) : '—'); }
  const shareText = `⚽ PitchRank\n\nOyuncu: ${pName}\nMevki: ${posLabel(pObj)}\n⭐ Rating: ${rating}\n\nİstatistiklerine göz at!`;
  if (navigator.share) { navigator.share({title:`${pName} - Oyuncu Profili`, text:shareText, url:window.location.href}).catch(console.error); }
  else { navigator.clipboard.writeText(shareText).then(() => showToast('Profil bilgileri kopyalandı!')); }
}

function closeModal(e, force) {
  if (force || (e && e.target === document.getElementById('modalBg'))) document.getElementById('modalBg').classList.remove('open');
}

// ─── TAKTİK ───────────────────────────────────────────────────────────────────
let _teamA = [], _teamB = [];

function renderTodayPlayers() {
  const el = document.getElementById('todayPlayers');
  if (!el) return;
  const posEmojis = { KL: '🧤', DEF: '🛡️', OMO: '⚙️', FRV: '⚡' };
  el.innerHTML = state.players.map(p => {
    if (!(p.name in state.todaySelected)) state.todaySelected[p.name] = true;
    const on = state.todaySelected[p.name];
    const pos = normPos(p)[0] || 'OMO';
    return `<button onclick="toggleToday('${escHtml(p.name)}')" id="td-${san(p.name)}" class="tk-chip${on?' tk-chip-on':''}">
      ${posEmojis[pos]||''} ${escHtml(p.name)}
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
    const avg = pData ? (posRating(pData, pl) != null ? posRating(pData, pl) : pData.genelOrt || 5) : 5;
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
  const posEmojis = { KL: '🧤', DEF: '🛡️', OMO: '⚙️', FRV: '⚡' };
  const fieldAvg = (t) => { const f = t.filter(p => p.pos !== 'KL'); return f.length ? f.reduce((s,p) => s+(p.avg||0), 0) / f.length : 0; };
  const avg1 = fieldAvg(_teamA), avg2 = fieldAvg(_teamB);
  const diff = Math.abs(avg1 - avg2);
  const balLabel = diff < 0.3 ? '✅ Dengeli' : diff < 0.6 ? '⚠️ Yakın' : '⛔ Dengesiz';
  const balColor = diff < 0.3 ? 'var(--green)' : diff < 0.6 ? '#eab308' : '#ef4444';

  const playerRow = (p, arrow) => {
    const r = Math.min(99, Math.round((p.avg || 0) * 10));
    return `<div class="tk-player-row">
      <span class="tk-p-pos">${posEmojis[p.pos]||'⚽'}</span>
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
  console.log('[PitchRank] App Initializing. Current Team:', CURRENT_TEAM);
  const el = (id) => document.getElementById(id);
  const has = (id) => !!el(id);

  const homeScreen = el('screen-home');
  const appScreen = el('app');
  const navBar = document.querySelector('.bottom-nav');

  if (!CURRENT_TEAM) {
    console.log('[PitchRank] No team selected, showing home screen.');
    if (homeScreen) homeScreen.style.display = 'flex';
    if (appScreen) appScreen.style.display = 'none';
    if (navBar) navBar.style.display = 'none';
    document.body.classList.add('home-active');
    markLastTeam();
    return;
  }

  console.log('[PitchRank] Team selected:', CURRENT_TEAM);
  if (homeScreen) homeScreen.style.display = 'none';
  if (appScreen) appScreen.style.display = 'block';
  if (navBar) navBar.style.display = 'flex';
  document.body.classList.remove('home-active');

  updateTeamUI();
  updateDarkBtn();
  loadManualWeek(() => {
    console.log('[PitchRank] Week loaded:', getWeekLabel());
    if (has('matchWeek')) el('matchWeek').value = getWeekLabel();
    loadPlayersFromSheets(() => {
      console.log('[PitchRank] Players loaded:', state.players.length);
      loadMevkilerFromSheets(() => {
        if (has('raterSelect') || has('trendSelect') || has('cmpA') || has('cmpB')) initSelects();
        if (has('playerList')) renderPlayerList();
        if (has('goalInputs')) buildGoalInputs();
        if (has('raterSelect')) checkIdentityLock();
        setTimeout(() => {
          if (has('fifaGrid') || has('weekContent') || has('trendContent') || has('cmpContent')) {
            console.log('[PitchRank] Loading results...');
            loadResults(() => { console.log('[PitchRank] Results loaded.'); }, false);
          }
          if (has('matchHistory')) loadMatchHistory();
        }, 500);
      });
    }, () => {
      if (has('raterSelect') || has('trendSelect') || has('cmpA') || has('cmpB')) initSelects();
      if (has('playerList')) renderPlayerList();
      if (has('goalInputs')) buildGoalInputs();
    });
  });
}

// ─── ESC KEY ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.mbg.open').forEach(function(m) { m.classList.remove('open'); });
});

// ─── WINDOW EXPORTS ──────────────────────────────────────────────────────────
// main.js functions
window.initApp = initApp;
window.switchMainScreen = switchMainScreen;
window.setStatScreen = setStatScreen;
window.makeFifaCard = makeFifaCard;
window.openProfile = openProfile;
window.shareProfile = shareProfile;
window.closeModal = closeModal;
window.updateTeamUI = updateTeamUI;
window.updateDarkBtn = updateDarkBtn;
window.toggleDark = toggleDark;
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

// players.js functions
window.savePlayers = savePlayers;
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
window.selectVideoWeek = selectVideoWeek;
window.selectVideoWeekByUrl = selectVideoWeekByUrl;
window.adminSaveVideo = adminSaveVideo;
window.saveCurrentWeek = saveCurrentWeek;
window.resetWeekToAuto = resetWeekToAuto;
window.loadVoteSetting = loadVoteSetting;
window.saveVoteSetting = saveVoteSetting;

// utils.js functions
window.showToast = showToast;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;
