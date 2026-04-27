import { POS, POS_GROUPS } from './config.js';
import { lGet, lSet, lRem, sGet, sSet, sRem } from './storage.js';
import { state } from './state.js';
import { escHtml, normPos, san, getWeekLabel, getAutoWeekLabel, showToast, showConfirm } from './utils.js';
import { gs } from './api.js';
import { savePlayers, initSelects, buildGoalInputs } from './players.js';
import { loadMatchHistory } from './stats.js';

let _pendingPos = {};
let _bugunSelected = {};

// ─── ADMİN GİRİŞ ─────────────────────────────────────────────────────────────
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCKOUT_MS   = 10 * 60 * 1000;

function getAdminLock() { try { return JSON.parse(lGet('hs_admin_lock') || '{}'); } catch(e) { return {}; } }
function setAdminLock(data) { lSet('hs_admin_lock', JSON.stringify(data)); }
function isAdminLocked() { const lock = getAdminLock(); if (!lock.until) return false; if (Date.now() < lock.until) return true; setAdminLock({}); return false; }
function recordFailedAttempt() { const lock = getAdminLock(); const attempts = (lock.attempts || 0) + 1; if (attempts >= ADMIN_MAX_ATTEMPTS) { setAdminLock({ attempts, until: Date.now() + ADMIN_LOCKOUT_MS }); return attempts; } setAdminLock({ attempts }); return attempts; }
function clearAdminLock() { setAdminLock({}); }
function isAdminLoggedIn() { try { const d = JSON.parse(sGet('hs_admin_session') || '{}'); if (!d.token || !d.expires) return false; if (Date.now() > d.expires) { sRem('hs_admin_session'); return false; } return true; } catch(e) { return false; } }
function setAdminSession() { const token = Math.random().toString(36).slice(2) + Date.now().toString(36); sSet('hs_admin_session', JSON.stringify({ token, expires: Date.now() + 2 * 60 * 60 * 1000 })); }

export function tryAdmin(btnElement) {
  if (isAdminLoggedIn()) {
    window.switchMainScreen('admin', btnElement);
    setAdminTab('mac', document.querySelector('#screen-admin .sub-nb'));
  } else {
    if (isAdminLocked()) { const lock = getAdminLock(); showToast(`Çok fazla hatalı deneme. ${Math.ceil((lock.until - Date.now()) / 60000)} dakika bekleyin.`, true); return; }
    document.getElementById('adminPinInput').value = '';
    document.getElementById('pinBg').classList.add('open');
    document.getElementById('pinError').textContent = '';
    setTimeout(() => document.getElementById('adminPinInput').focus(), 100);
  }
}

export function checkPin() {
  if (isAdminLocked()) { const lock = getAdminLock(); document.getElementById('pinError').textContent = `Hesap kilitlendi. ${Math.ceil((lock.until - Date.now()) / 60000)} dk bekleyin.`; return; }
  const pin = document.getElementById('adminPinInput').value.trim();
  if (!pin) { document.getElementById('pinError').textContent = 'PIN boş olamaz.'; return; }
  const btn = document.querySelector('#pinBg .abtn.pri');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Doğrulanıyor...';
  document.getElementById('pinError').textContent = '';
  gs({action:'verifyPin', pin}).then(d => {
    btn.disabled = false; btn.textContent = 'Doğrula';
    if (d.success) {
      clearAdminLock(); setAdminSession();
      document.getElementById('pinBg').classList.remove('open');
      showToast('✅ Yönetici girişi başarılı.');
      const adminBtn = document.querySelectorAll('.bnav-item')[5];
      window.switchMainScreen('admin', adminBtn);
      setAdminTab('mac', document.querySelector('#screen-admin .sub-nb'));
    } else {
      const attempts = recordFailedAttempt();
      document.getElementById('adminPinInput').value = '';
      document.getElementById('adminPinInput').focus();
      document.getElementById('pinError').textContent = isAdminLocked()
        ? `${ADMIN_MAX_ATTEMPTS} hatalı deneme — 10 dakika kilitlendi!`
        : `Hatalı PIN. (${attempts}/${ADMIN_MAX_ATTEMPTS} deneme)`;
    }
  }).catch(() => { btn.disabled = false; btn.textContent = 'Doğrula'; document.getElementById('pinError').textContent = 'Bağlantı hatası, tekrar deneyin.'; });
}

export function logoutAdmin() { sRem('hs_admin_session'); showToast('Güvenli çıkış yapıldı.'); document.querySelectorAll('.bnav-item')[0].click(); }

// ─── ADMİN TAB ────────────────────────────────────────────────────────────────
export function setAdminTab(id, btnElement) {
  document.querySelectorAll('#screen-admin .sub-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#screen-admin .sub-nb').forEach(b => b.classList.remove('active'));
  document.getElementById(`admin-${id}`).classList.add('active');
  if (btnElement) btnElement.classList.add('active');
  if (id === 'mac') loadMatchHistory();
  if (id === 'ayarlar') { renderPlayerList(); loadVoteSetting(); }
  if (id === 'bugun') loadBugunTab();
  if (id === 'hakem') loadHakemTab();
  if (id === 'yayin') {
    const hint = document.getElementById('adminVideoWeekHint');
    if (hint) hint.textContent = getWeekLabel();
    const wInput = document.getElementById('adminVideoWeek');
    if (wInput && !wInput.value) wInput.value = getWeekLabel();
    loadAdminVideos();
  }
  if (id === 'hafta') loadHaftaTab();
}

// ─── BUGÜN GELENLER ──────────────────────────────────────────────────────────
export function loadBugunTab() {
  const week = getWeekLabel();
  document.getElementById('bugunWeekLabel').textContent = week;
  const el = document.getElementById('bugunPlayerList');
  el.innerHTML = '<span class="spin"></span>';
  gs({ action: 'getTodayPlayers', week }).then(data => {
    const present = new Set(data.players || []);
    _bugunSelected = {};
    state.players.forEach(p => { _bugunSelected[p.name] = present.size ? present.has(p.name) : true; });
    renderBugunList();
  }).catch(() => {
    state.players.forEach(p => { _bugunSelected[p.name] = true; });
    renderBugunList();
  });
}

function renderBugunList() {
  const el = document.getElementById('bugunPlayerList');
  const posEmojis = { KL: '🧤', DEF: '🛡️', OMO: '⚙️', FRV: '⚡' };
  el.innerHTML = state.players.map(p => {
    const on = _bugunSelected[p.name] !== false;
    const pos = normPos(p)[0] || 'OMO';
    return `<button id="bg-${san(p.name)}" data-name="${escHtml(p.name)}" onclick="toggleBugun(this.dataset.name)"
      style="font-size:13px;font-weight:700;padding:10px 16px;border-radius:20px;cursor:pointer;font-family:inherit;transition:all .2s;
             border:2px solid ${on ? 'var(--green)' : 'var(--border)'};
             background:${on ? 'var(--green)' : 'var(--bg2)'};
             color:${on ? '#fff' : 'var(--text2)'};
             box-shadow:${on ? '0 4px 10px rgba(16,185,129,.3)' : 'var(--sh)'}">
      ${posEmojis[pos] || ''} ${escHtml(p.name)}
    </button>`;
  }).join('');
}

export function toggleBugun(name) {
  _bugunSelected[name] = !_bugunSelected[name];
  const btn = document.getElementById(`bg-${san(name)}`);
  if (!btn) return;
  const on = _bugunSelected[name];
  btn.style.background = on ? 'var(--green)' : 'var(--bg2)';
  btn.style.color = on ? '#fff' : 'var(--text2)';
  btn.style.borderColor = on ? 'var(--green)' : 'var(--border)';
  btn.style.boxShadow = on ? '0 4px 10px rgba(16,185,129,.3)' : 'var(--sh)';
}

export function bugunSelectAll() { state.players.forEach(p => { _bugunSelected[p.name] = true; }); renderBugunList(); }
export function bugunClearAll() { state.players.forEach(p => { _bugunSelected[p.name] = false; }); renderBugunList(); }

export function saveBugunGelenler() {
  const week = getWeekLabel();
  const presentList = state.players.filter(p => _bugunSelected[p.name]).map(p => p.name);
  const btn = document.getElementById('bugunSaveBtn');
  const msg = document.getElementById('bugunSaveMsg');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  msg.style.display = 'none';
  gs({ action: 'saveTodayPlayers', week, players: JSON.stringify(presentList) }).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      msg.textContent = `✅ ${presentList.length} oyuncu kaydedildi!`;
      msg.style.display = 'block';
      lRem('hs_today_players_cache');
      showToast(`${presentList.length} oyuncu bu hafta için işaretlendi!`);
    }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Kayıt hatası.', true); });
}

// ─── HAKEM ───────────────────────────────────────────────────────────────────
export function loadHakemTab() {
  const week = getWeekLabel();
  document.getElementById('hakemWeekLabel').textContent = week;
  const el = document.getElementById('hakemPlayerList');
  el.innerHTML = '<span class="spin"></span>';
  state.selectedHakem = '';
  gs({ action: 'getHakem', week }).then(data => {
    state.selectedHakem = data.hakem || '';
    state.hakemData = { week, hakem: state.selectedHakem };
    const infoEl = document.getElementById('hakemCurrentInfo');
    if (state.selectedHakem) {
      infoEl.style.display = 'block';
      infoEl.textContent = `🟡 Mevcut hakem: ${state.selectedHakem}`;
    } else {
      infoEl.style.display = 'none';
    }
    renderHakemPlayerList();
  }).catch(() => { state.selectedHakem = ''; renderHakemPlayerList(); });
}

function renderHakemPlayerList() {
  const el = document.getElementById('hakemPlayerList');
  el.innerHTML = state.players.map(p => {
    const on = state.selectedHakem === p.name;
    return `<button id="hk-${san(p.name)}" data-name="${escHtml(p.name)}" onclick="selectHakem(this.dataset.name)"
      style="font-size:13px;font-weight:700;padding:10px 16px;border-radius:20px;cursor:pointer;font-family:inherit;transition:all .2s;
             border:2px solid ${on?'#f59e0b':'var(--border)'};
             background:${on?'#fef3c7':'var(--bg2)'};
             color:${on?'#92400e':'var(--text2)'};
             box-shadow:${on?'0 4px 10px rgba(245,158,11,.25)':'var(--sh)'}">
      ${on?'🟡 ':''}${escHtml(p.name)}
    </button>`;
  }).join('');
}

export function selectHakem(name) {
  state.selectedHakem = (state.selectedHakem === name) ? '' : name;
  renderHakemPlayerList();
}

export function saveHakemToSheet() {
  const week = getWeekLabel();
  const btn = document.getElementById('hakemSaveBtn');
  const msg = document.getElementById('hakemSaveMsg');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  msg.style.display = 'none';
  gs({ action: 'saveHakem', week, hakem: state.selectedHakem }).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      state.hakemData = { week, hakem: state.selectedHakem };
      lSet('hs_hakem_cache', JSON.stringify({ week, hakem: state.selectedHakem }));
      const infoEl = document.getElementById('hakemCurrentInfo');
      if (state.selectedHakem) {
        infoEl.style.display = 'block';
        infoEl.textContent = `🟡 Mevcut hakem: ${state.selectedHakem}`;
        msg.textContent = `✅ ${state.selectedHakem} hakem olarak atandı!`;
        showToast(`${state.selectedHakem} bu hafta hakem olarak atandı!`);
      } else {
        infoEl.style.display = 'none';
        msg.textContent = `✅ Hakem kaldırıldı.`;
        showToast('Hakem kaldırıldı.');
      }
      msg.style.display = 'block';
    }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Kayıt hatası.', true); });
}

export function clearHakem() {
  state.selectedHakem = '';
  renderHakemPlayerList();
  saveHakemToSheet();
}

// ─── OYUNCU LİSTESİ ──────────────────────────────────────────────────────────
export function renderPlayerList() {
  const el = document.getElementById('playerList');
  if (!el) return;
  el.innerHTML = state.players.map((p, i) => {
    const curPos = normPos(p)[0];
    const chip = curPos
      ? `<span style="font-size:11px;font-weight:800;padding:6px 12px;border-radius:12px;background:var(--text);color:var(--bg);">${POS[curPos]}</span>`
      : `<span style="font-size:11px;color:var(--text3)">—</span>`;
    const dropItems = POS_GROUPS.map(g => `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--text3);font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">${g.label}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${g.keys.map(k => {
            const on = k === curPos;
            return `<button onclick="selectPos(${i},'${k}')" id="posbtn-${i}-${k}" style="font-size:14px;font-weight:700;padding:10px 16px;border-radius:12px;border:2px solid ${on?'var(--green)':'var(--border)'};background:${on?'var(--green)':'var(--bg3)'};color:${on?'#fff':'var(--text2)'};cursor:pointer;font-family:inherit;transition:all 0.2s;">${POS[k]}</button>`;
          }).join('')}
        </div>
      </div>`).join('');
    return `<div class="player-row" style="position:relative;display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--border2);">
      <div class="av" style="width:44px;height:44px;font-size:16px;">${p.name.charAt(0)}</div>
      <span style="flex:1;font-size:16px;font-weight:800;letter-spacing:-0.5px;">${p.name}</span>
      <div id="poschips-${i}" style="display:flex;gap:6px;flex-wrap:wrap">${chip}</div>
      <button onclick="togglePosDropdown(${i})" style="font-size:18px;padding:8px 14px;border:1px solid var(--border);border-radius:12px;background:var(--bg3);color:var(--text2);cursor:pointer;font-family:inherit;transition:all 0.2s;box-shadow:var(--sh);">✏️</button>
      <button class="xcls" style="color:#ef4444;background:#fef2f2;border:1px solid #fecaca;width:42px;height:42px;font-size:24px;flex-shrink:0;border-radius:12px;" onclick="removePlayer(${i})">×</button>
      <div id="posdrop-${i}" style="display:none;position:absolute;right:0;top:calc(100% + 8px);z-index:50;background:var(--bg2);border:1px solid var(--border);border-radius:24px;box-shadow:var(--sh2);padding:24px;min-width:300px;transform-origin:top right;animation:popIn 0.2s ease;">
        ${dropItems}
        <button onclick="confirmPos(${i})" style="width:100%;margin-top:16px;padding:16px;border:none;border-radius:16px;background:var(--text);color:var(--bg);font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;">Kaydet ✓</button>
      </div>
    </div>`;
  }).join('');
}

export function selectPos(i, key) {
  _pendingPos[i] = key;
  POS_GROUPS.forEach(g => g.keys.forEach(k => {
    const btn = document.getElementById(`posbtn-${i}-${k}`);
    if (!btn) return;
    const on = k === key;
    btn.style.background = on ? 'var(--green)' : 'var(--bg3)';
    btn.style.color = on ? '#fff' : 'var(--text2)';
    btn.style.borderColor = on ? 'var(--green)' : 'var(--border)';
  }));
}

export function confirmPos(i) {
  const key = _pendingPos[i];
  if (!key) { closePosDropdown(i); return; }
  state.players[i].pos = [key]; savePlayers();
  gs({action:'saveMevki', name:state.players[i].name, mevki:JSON.stringify([key])}).catch(e => console.warn('Mevki kaydedilemedi:', e));
  const chipsEl = document.getElementById(`poschips-${i}`);
  if (chipsEl) chipsEl.innerHTML = `<span style="font-size:11px;font-weight:800;padding:6px 12px;border-radius:12px;background:var(--text);color:var(--bg);">${POS[key]}</span>`;
  delete _pendingPos[i]; closePosDropdown(i); showToast('Mevki güncellendi!');
}

export function togglePosDropdown(i) {
  state.players.forEach((_, j) => { if (j !== i) closePosDropdown(j); });
  const d = document.getElementById(`posdrop-${i}`);
  if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
}

export function closePosDropdown(i) {
  const d = document.getElementById(`posdrop-${i}`);
  if (d) d.style.display = 'none';
  delete _pendingPos[i];
}

export function addPlayer() {
  const name = document.getElementById('newPlayerName').value.trim();
  if (!name) return;
  if (state.players.find(p => p.name.toLowerCase() === name.toLowerCase())) { showToast('Bu oyuncu zaten var!', true); return; }
  state.players.push({name, pos:['OMO'], photo:''});
  savePlayers(); renderPlayerList(); initSelects(); buildGoalInputs();
  document.getElementById('newPlayerName').value = '';
  showToast(`${name} ekleniyor...`);
  gs({action:'savePlayer', name, pos:'["OMO"]'}).then(d => { if(d.success) showToast(`${name} başarıyla eklendi! ✓`); }).catch(() => showToast(`${name} eklendi ama Sheets'e yazılamadı.`, true));
}

export function removePlayer(i) {
  showConfirm(`${state.players[i].name} isimli oyuncuyu tamamen silmek istediğinize emin misiniz?`, () => {
    const deletedName = state.players[i].name;
    state.players.splice(i, 1);
    savePlayers(); renderPlayerList(); initSelects(); buildGoalInputs();
    showToast(`${deletedName} siliniyor...`);
    gs({action:'deletePlayer', name:deletedName}).then(d => { if(d.success) showToast(`${deletedName} başarıyla silindi. ✓`); }).catch(() => {});
  });
}

// ─── MAÇ KAYDET ───────────────────────────────────────────────────────────────
export function saveMatch() {
  const s1 = document.getElementById('score1').value || '0';
  const s2 = document.getElementById('score2').value || '0';
  const week = document.getElementById('matchWeek').value || getWeekLabel();
  const note = document.getElementById('matchNote').value || '';
  const goals = {};
  state.players.forEach(p => {
    const gEl = document.getElementById(`gol-${san(p.name)}`);
    const aEl = document.getElementById(`ast-${san(p.name)}`);
    const g = gEl ? parseInt(gEl.textContent) || 0 : 0;
    const a = aEl ? parseInt(aEl.textContent) || 0 : 0;
    if (g || a) goals[p.name] = { g, a };
  });
  const btn = document.querySelector('#admin-mac .sub-btn[onclick="saveMatch()"]');
  if (!btn) return;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Kaydediliyor...';
  gs({action:'saveMatch', score1:s1, score2:s2, week, note, goals:JSON.stringify(goals)}).then(d => {
    btn.disabled = false; btn.textContent = 'Veritabanına Kaydet';
    if (d.success) {
      lRem('hs_matches_cache');
      loadMatchHistory();
      document.getElementById('matchNote').value = '';
      state.players.forEach(p => {
        const gi = document.getElementById(`gol-${san(p.name)}`);
        const ai = document.getElementById(`ast-${san(p.name)}`);
        if (gi) gi.textContent = '0'; if (ai) ai.textContent = '0';
        const row = gi ? gi.closest('.goal-row') : null;
        if (row) row.classList.remove('goal-row-active');
      });
      showToast('Maç sonucu başarıyla kaydedildi!');
    } else { showToast('Kaydetme hatası.', true); }
  }).catch(() => { btn.disabled = false; btn.textContent = 'Veritabanına Kaydet'; showToast('Bağlantı hatası.', true); });
}

// ─── YAYIN ───────────────────────────────────────────────────────────────────
export function getYtEmbedUrl(input) {
  if (!input || !input.trim()) return null;
  input = input.trim();
  const srcMatch = input.match(/src=["']([^"']+)["']/);
  if (srcMatch) input = srcMatch[1];
  if (input.includes('/embed/')) { const part = input.split('/embed/')[1]; const videoId = part.split('?')[0].split('&')[0].split('/')[0].trim(); if (videoId.length >= 11) return 'https://www.youtube.com/embed/' + videoId; }
  if (input.includes('v=')) { const videoId = input.split('v=')[1].split('&')[0].split('?')[0].trim(); if (videoId.length >= 11) return 'https://www.youtube.com/embed/' + videoId.substring(0,11); }
  if (input.includes('youtu.be/')) { const videoId = input.split('youtu.be/')[1].split('?')[0].split('/')[0].trim(); if (videoId.length >= 11) return 'https://www.youtube.com/embed/' + videoId.substring(0,11); }
  const liveMatch = input.match(/\/(live|shorts)\/([A-Za-z0-9_-]{11})/);
  if (liveMatch) return 'https://www.youtube.com/embed/' + liveMatch[2];
  return null;
}

function ytVideoId(input) { const e = getYtEmbedUrl(input); if (!e) return null; const parts = e.split('/embed/'); return parts[1] ? parts[1].split('?')[0].split('/')[0] : null; }

export function loadVideos(forceRefresh) {
  if (state.videosData && !forceRefresh) { renderVideos(state.videosData); return; }
  const tabs = document.getElementById('vWeekTabs');
  if (tabs) tabs.innerHTML = '<div style="color:var(--text3);font-size:13px;font-weight:600;padding:8px 0;"><span class="spin"></span>Yükleniyor...</div>';
  gs({action:'getVideos'}).then(data => { state.videosData = data.videos || []; renderVideos(state.videosData); }).catch(() => { state.videosData = []; renderVideos([]); });
}

function renderVideos(videos) {
  const tabs = document.getElementById('vWeekTabs'), noData = document.getElementById('vNoData'), allVideos = document.getElementById('vAllVideos');
  if (!videos || !videos.length) { if (tabs) tabs.innerHTML = ''; if (noData) noData.style.display = 'block'; if (allVideos) allVideos.innerHTML = ''; setYtPlayer(null); return; }
  if (noData) noData.style.display = 'none';
  const sorted = [...videos].sort((a, b) => b.week.localeCompare(a.week));
  if (tabs) tabs.innerHTML = sorted.map((v, i) => `<button class="vwtab ${i===0?'active':''}" onclick="selectVideoWeek('${v.week}',this)">${v.week}</button>`).join('');
  if (allVideos) {
    allVideos.innerHTML = sorted.length > 1
      ? `<div class="sec-title" style="margin-top:8px">Tüm Yayınlar</div>` + sorted.map(v => {
          const vid = ytVideoId(v.url);
          const thumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null;
          return `<div onclick="selectVideoWeekByUrl('${v.week}','${v.url}')" style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg2);border-radius:16px;margin-bottom:8px;cursor:pointer;box-shadow:var(--sh);border:1px solid var(--border);">
            ${thumb?`<img src="${thumb}" loading="lazy" style="width:80px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`:`<div style="width:80px;height:52px;border-radius:10px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">📺</div>`}
            <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:800;margin-bottom:4px;">${v.title||v.week+' Maç Yayını'}</div><div style="font-size:11px;color:var(--green);font-weight:700;">${v.week}</div></div>
            <div style="font-size:20px;color:var(--text3);">▶</div>
          </div>`;
        }).join('')
      : '';
  }
  if (sorted.length) selectVideoWeekByUrl(sorted[0].week, sorted[0].url, sorted[0].title);
}

export function selectVideoWeek(week, btn) {
  document.querySelectorAll('.vwtab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (!state.videosData) return;
  const v = state.videosData.find(x => x.week === week);
  if (v) setYtPlayer(v.url, v.week, v.title);
}

export function selectVideoWeekByUrl(week, url, title) {
  document.querySelectorAll('.vwtab').forEach(b => { b.classList.toggle('active', b.textContent.trim() === week); });
  setYtPlayer(url, week, title);
}

export function setYtPlayer(url, week, title) {
  state.currentVideoWeek = week;
  const wrap = document.getElementById('ytWrap'), meta = document.getElementById('vVideoMeta');
  const titleEl = document.getElementById('vVideoTitle'), weekEl = document.getElementById('vVideoWeek');
  if (!wrap) return;
  const vid = ytVideoId(url);
  const dispTitle = title || ((week||'') + ' Maç Yayını');
  if (!vid) { wrap.innerHTML = '<div class="yt-placeholder"><div class="yt-placeholder-icon">📺</div><div>Bu hafta için yayın bulunamadı</div></div>'; if (meta) meta.style.display = 'none'; return; }
  wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:16px;" title="${dispTitle}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share" allowfullscreen></iframe>`;
  if (meta) meta.style.display = 'block';
  if (titleEl) titleEl.textContent = dispTitle;
  if (weekEl) weekEl.textContent = '📅 ' + week;
}

export function loadAdminVideos() {
  const el = document.getElementById('adminVideoList');
  if (!el) return;
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  gs({action:'getVideos'}).then(data => {
    const videos = (data.videos || []).sort((a,b) => b.week.localeCompare(a.week));
    if (!videos.length) { el.innerHTML = '<div class="no-data">Henüz yayın eklenmedi.</div>'; return; }
    el.innerHTML = videos.map(v => `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg3);border-radius:14px;margin-bottom:8px;">
      <div style="font-size:20px;">📺</div>
      <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:800;">${v.title||v.week}</div><div style="font-size:11px;color:var(--green);font-weight:700;margin-top:2px;">${v.week}</div><div style="font-size:10px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v.url}</div></div>
      <button onclick="document.getElementById('adminVideoWeek').value='${v.week}';document.getElementById('adminVideoUrl').value='${v.url}';document.getElementById('adminVideoTitle').value='${v.title||''}'" style="font-size:11px;padding:6px 10px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);color:var(--text2);cursor:pointer;font-family:inherit;font-weight:700;">✏️</button>
    </div>`).join('');
  }).catch(() => { el.innerHTML = '<div class="no-data">Yüklenemedi.</div>'; });
}

export function adminSaveVideo() {
  const week = document.getElementById('adminVideoWeek').value.trim();
  const url  = document.getElementById('adminVideoUrl').value.trim();
  const title = document.getElementById('adminVideoTitle').value.trim();
  if (!week || !url) { showToast('Hafta ve URL zorunludur.', true); return; }
  if (!ytVideoId(url)) { showToast('Geçersiz YouTube linki veya embed kodu!', true); return; }
  const btn = document.getElementById('adminSaveVideoBtn');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  gs({action:'saveVideo', week, url, title: title || (week + ' Maç Yayını')}).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) { showToast('Yayın kaydedildi! ✓'); document.getElementById('adminVideoUrl').value = ''; document.getElementById('adminVideoTitle').value = ''; state.videosData = null; }
    else { showToast('Kayıt hatası.', true); }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Bağlantı hatası.', true); });
}

// ─── HAFTA YÖNETİMİ ──────────────────────────────────────────────────────────
export function saveCurrentWeek() {
  const newWeek = document.getElementById('newWeekInput').value.trim();
  if (!newWeek) { showToast('Hafta boş olamaz!', true); return; }
  const btn = document.querySelector('#admin-hafta .sub-btn[onclick="saveCurrentWeek()"]');
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  gs({action:'saveManualWeek', week: newWeek}).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      state.manualWeek = newWeek;
      lSet('hs_manual_week', JSON.stringify({ week: state.manualWeek }));
      lRem('hs_today_players_cache');
      lRem('hs_hakem_cache');
      lRem('hs_results_cache');
      lRem('hs_matches_cache');
      document.getElementById('currentWeekDisplay').textContent = state.manualWeek;
      document.getElementById('matchWeek').value = state.manualWeek;
      showToast('Hafta başarıyla güncellendi! ✓');
    } else {
      showToast('Kaydetme hatası.', true);
    }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Bağlantı hatası.', true); });
}

export function resetWeekToAuto() {
  showConfirm('Otomatik haftaya dönmek istediğinize emin misiniz? (Yalnızca bu oturum için)', () => {
    state.manualWeek = null;
    lRem('hs_today_players_cache');
    lRem('hs_hakem_cache');
    lRem('hs_results_cache');
    lRem('hs_matches_cache');
    const autoWeek = getAutoWeekLabel();
    document.getElementById('currentWeekDisplay').textContent = autoWeek + ' (Otomatik)';
    document.getElementById('matchWeek').value = autoWeek;
    showToast('Otomatik hafta aktif!');
  });
}

export function loadHaftaTab() {
  const displayEl = document.getElementById('currentWeekDisplay');
  const inputEl = document.getElementById('newWeekInput');
  if (displayEl) displayEl.textContent = state.manualWeek ? state.manualWeek : getAutoWeekLabel() + ' (Otomatik)';
  if (inputEl && !inputEl.value) inputEl.value = state.manualWeek || getAutoWeekLabel();
}

// ─── OY GİZLEME SINIRI ───────────────────────────────────────────────────────
export function loadVoteSetting() {
  const el = document.getElementById('voteThresholdInput');
  if (!el) return;
  el.disabled = true;
  gs({ action: 'getResults' }).then(d => {
    el.disabled = false;
    el.value = (d && d.minVoters > 0) ? d.minVoters : 5;
  }).catch(() => { el.disabled = false; el.value = 5; });
}

export function saveVoteSetting() {
  const el = document.getElementById('voteThresholdInput');
  const btn = document.getElementById('voteThresholdSaveBtn');
  const msg = document.getElementById('voteThresholdMsg');
  if (!el || !btn) return;
  const val = parseInt(el.value);
  if (isNaN(val) || val < 1 || val > 100) { showToast('Geçerli bir sayı girin (1-100).', true); return; }
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  if (msg) msg.style.display = 'none';
  gs({ action: 'saveSetting', key: 'oy_gizleme_siniri', value: String(val) }).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      state.resultData = null;
      lRem('hs_results_cache');
      if (msg) { msg.textContent = `✅ Eşik ${val} olarak kaydedildi.`; msg.style.display = 'block'; }
      showToast(`Oy gizleme sınırı ${val} olarak güncellendi!`);
    } else {
      showToast('Kayıt hatası.', true);
    }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Bağlantı hatası.', true); });
}
