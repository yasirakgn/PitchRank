// ─── SABITLER ────────────────────────────────────────────────────────────────
const GS = 'https://script.google.com/macros/s/AKfycbxn8T0QYMmZpU0NvVylCQLhIsv_HPPFODAvt3vKJ9EzolwYekv1L3ovyuos2DNCuwy3/exec';
const BASE_URL = 'assets/images/';

// ─── PLAYERS VERSION (cache temizleme) ────────────────────────────────────
const PLAYERS_VERSION = '4';
if (localStorage.getItem('hs_players_version') !== PLAYERS_VERSION) {
  localStorage.removeItem('hs_players');
  localStorage.removeItem('hs_players_cache');
  localStorage.removeItem('hs_mevkiler_cache');
  localStorage.removeItem('hs_today_players_cache');
  localStorage.removeItem('hs_hakem_cache');
  localStorage.setItem('hs_players_version', PLAYERS_VERSION);
}

let PLAYERS = JSON.parse(localStorage.getItem('hs_players')) || [];

const CRITERIA = ['Pas','Sut','Dribling','Savunma','Hiz / Kondisyon','Fizik','Takim Oyunu'];
const CDISP    = ['Pas','Şut','Drib.','Savunma','Hız','Fizik','Takım'];
const POS      = { KL: '🧤 Kaleci', DEF: '🛡️ Defans', OMO: '⚙️ Orta Saha', FRV: '⚡ Forvet' };
const POS_GROUPS = [
  { label: '🧤 Kale', keys: ['KL'] },
  { label: '🛡️ Defans', keys: ['DEF'] },
  { label: '⚙️ Orta Saha', keys: ['OMO'] },
  { label: '⚡ Forvet', keys: ['FRV'] }
];
const VALID_POS = ['KL','DEF','OMO','FRV'];
const POS_WEIGHTS = {
  KL:  [0.30, 0.05, 0.10, 1.00, 0.45, 0.90, 0.65],
  DEF: [0.60, 0.20, 0.40, 1.00, 0.80, 0.90, 0.80],
  OMO: [1.00, 0.55, 0.85, 0.50, 0.90, 0.80, 1.00],
  FRV: [0.65, 1.00, 0.90, 0.10, 1.00, 0.75, 0.75]
};
const MEDALS = ['🥇','🥈','🥉'];

let resultData = null;
let currentScores = {};
let completedCards = {};
let currentRater = '';
let darkMode = localStorage.getItem('hs_dark') === '1';
let _sonucData = null;
let _matchesData = null;
let todaySelected = {};
let _pendingPos = {};
let currentProfileName = '';
let currentRankTab = 'genel';
let _bugunSelected = {};
let _videosData = null;
let _currentVideoWeek = null;
let _hakemData = { week: '', hakem: '' };
let _selectedHakem = '';
let _manualWeek = null;

if (darkMode) document.body.classList.add('dark');

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${isError ? 'error' : ''} show`;
  t.innerHTML = isError ? `⚠️ ${msg}` : `✅ ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}
function showConfirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmBg').classList.add('open');
  document.getElementById('confirmBtn').onclick = () => { closeConfirm(); cb(); };
}
function closeConfirm() { document.getElementById('confirmBg').classList.remove('open'); }
function toggleDark() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  localStorage.setItem('hs_dark', darkMode ? '1' : '0');
  updateDarkBtn();
}
function updateDarkBtn() {
  const b = document.getElementById('darkBtn');
  if (b) b.textContent = darkMode ? '☀️' : '🌙';
}
function sp(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function savePlayers() { sp('hs_players', PLAYERS); }
function san(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }
function gs(p) {
  const url = GS + '?' + Object.keys(p).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(p[k])).join('&');
  return fetch(url).then(r => r.json());
}
function normPos(p) {
  let arr = Array.isArray(p.pos) ? p.pos : [p.pos || ''];
  let valid = arr.filter(k => VALID_POS.includes(k));
  if (valid.length) return [valid[0]];
  let old = arr[0] || '';
  if (['GK','KL','SW'].includes(old)) return ['KL'];
  if (['CB','RB','LB','RWB','LWB','STP','SAB','SOB','SABK','SOBK','DEF'].includes(old)) return ['DEF'];
  if (['CDM','CM','CAM','RM','LM','DMO','AMO','SAO','SOO','OMO'].includes(old)) return ['OMO'];
  if (['ST','CF','RW','LW','SS','SAN','FW','IKF','SKT','SOKT','FRV'].includes(old)) return ['FRV'];
  return ['OMO'];
}
function posLabel(p) { return normPos(p).map(k => POS[k] || k).join(' / '); }
function posShort(p) { return posLabel(p); }
function toPhotoFilename(name) {
  const map = { 'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u' };
  return String(name || '').toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : (c === ' ' ? '' : c)).join('') + '.png';
}
function getPlayerPhoto(name) {
  const p = PLAYERS.find(x => x.name === name);
  let photo = (p && p.photo) ? String(p.photo).trim() : '';
  if (!photo) photo = toPhotoFilename(name);
  return photo ? BASE_URL + photo : '';
}
function getWeekLabel() {
  if (_manualWeek) return _manualWeek;
  const now = new Date(), start = new Date(now.getFullYear(), 0, 1);
  return now.getFullYear() + '-H' + String(Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)).padStart(2, '0');
}
function getAutoWeekLabel() {
  const now = new Date(), start = new Date(now.getFullYear(), 0, 1);
  return now.getFullYear() + '-H' + String(Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)).padStart(2, '0');
}
function formatMoney(value) {
  if (isNaN(value)) return '€0';
  if (value >= 1000000) return '€' + (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return '€' + Math.round(value / 1000) + 'K';
  return '€' + Math.round(value);
}
function scoreColor(v) {
  if(v>=9) return '#10b981'; if(v>=7) return '#84cc16'; if(v>=5) return '#eab308'; if(v>=3) return '#f97316'; return '#ef4444';
}
function ratingColor(r) {
  if (r >= 85) return { text: '#eab308', bar: '#eab308' };
  if (r >= 75) return { text: '#94a3b8', bar: '#94a3b8' };
  if (r >= 65) return { text: '#d97706', bar: '#d97706' };
  return { text: '#3b82f6', bar: '#3b82f6' };
}
function cardClass(r) {
  if (r >= 85) return 'fc-gold'; if (r >= 75) return 'fc-silver';
  if (r >= 65) return 'fc-bronze'; return 'fc-normal';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initApp() {
  const el = (id) => document.getElementById(id);
  const has = (id) => !!el(id);
  updateDarkBtn();
  loadManualWeek(() => {
    if (has('matchWeek')) el('matchWeek').value = getWeekLabel();
    loadPlayersFromSheets(() => {
      loadMevkilerFromSheets(() => {
        if (has('raterSelect') || has('trendSelect') || has('cmpA') || has('cmpB')) initSelects();
        if (has('playerList')) renderPlayerList();
        if (has('goalInputs')) buildGoalInputs();
        if (has('raterSelect')) checkIdentityLock();
        setTimeout(() => {
          if (has('fifaGrid') || has('weekContent') || has('trendContent') || has('cmpContent') || has('homeStatsContent')) loadResults(() => {}, false);
          if (has('matchHistory')) loadMatchHistory();
          if (has('homeStatsContent')) renderHomeStats();
        }, 500);
      });
    });
  });
}
window.initApp = initApp;

// ─── OYUNCU YÜKLEME ──────────────────────────────────────────────────────────
function loadPlayersFromSheets(cb) {
  const cached = localStorage.getItem('hs_players_cache');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && data.players && data.players.length > 0) {
        PLAYERS = [];
        data.players.forEach(sp => {
          if (!PLAYERS.find(p => p.name === sp.name)) {
            PLAYERS.push({ name: sp.name, pos: sp.pos || ['OMO'], photo: sp.photo || '' });
          }
        });
        savePlayers();
      }
    } catch(e) {}
    if (cb) cb(); cb = null;
  }
  gs({action:'getPlayers'}).then(data => {
    if (data && data.players && data.players.length > 0) {
      localStorage.setItem('hs_players_cache', JSON.stringify(data));
      PLAYERS = [];
      data.players.forEach(sp => {
        PLAYERS.push({ name: sp.name, pos: sp.pos || ['OMO'], photo: sp.photo || '' });
      });
      savePlayers();
      if (document.getElementById('raterSelect') || document.getElementById('trendSelect') || document.getElementById('cmpA') || document.getElementById('cmpB')) initSelects();
      if (document.getElementById('playerList')) renderPlayerList();
      if (document.getElementById('goalInputs')) buildGoalInputs();
    }
    if (cb) cb();
  }).catch(() => { if (cb) cb(); });
}

function loadMevkilerFromSheets(cb) {
  const cached = localStorage.getItem('hs_mevkiler_cache');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && data.mevkiler) {
        PLAYERS.forEach(p => { if (data.mevkiler[p.name]) p.pos = data.mevkiler[p.name]; });
      }
    } catch(e) {}
    if (cb) cb(); cb = null;
  }
  gs({action:'getMevkiler'}).then(data => {
    if (data && data.mevkiler) {
      localStorage.setItem('hs_mevkiler_cache', JSON.stringify(data));
      PLAYERS.forEach(p => { if (data.mevkiler[p.name]) p.pos = data.mevkiler[p.name]; });
      savePlayers();
    }
    if (cb) cb();
  }).catch(() => { if (cb) cb(); });
}

function initSelects() {
  const selects = [
    { id: 'raterSelect', label: '— Adınızı Seçin —' },
    { id: 'trendSelect', label: '— Oyuncu Seç —' },
    { id: 'cmpA', label: '— Oyuncu 1 —' },
    { id: 'cmpB', label: '— Oyuncu 2 —' }
  ];
  selects.forEach(({id, label}) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${label}</option>` + PLAYERS.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

// ─── KİMLİK ──────────────────────────────────────────────────────────────────
function checkIdentityLock() {
  const myIdentity = localStorage.getItem('hs_my_identity');
  if (myIdentity) {
    const raterSel = document.getElementById('raterSelect');
    raterSel.value = myIdentity;
    raterSel.disabled = true;
    document.getElementById('changeIdentityBtn').style.display = 'inline-block';
    document.getElementById('identityLockedMsg').style.display = 'block';
    onRaterChange(true);
  }
}
function resetIdentity() {
  showConfirm('Kimliğinizi değiştirmek istediğinize emin misiniz?', () => {
    localStorage.removeItem('hs_my_identity');
    const raterSel = document.getElementById('raterSelect');
    raterSel.disabled = false; raterSel.value = '';
    document.getElementById('changeIdentityBtn').style.display = 'none';
    document.getElementById('identityLockedMsg').style.display = 'none';
    const raterPhotoImg = document.getElementById('raterPhotoImg');
    const raterPhotoDefault = document.getElementById('raterPhotoDefault');
    if (raterPhotoImg) raterPhotoImg.style.display = 'none';
    if (raterPhotoDefault) raterPhotoDefault.style.display = 'block';
    onRaterChange();
  });
}
function onRaterChange(isInit = false) {
  const raterSel = document.getElementById('raterSelect');
  currentRater = raterSel.value;
  currentScores = {}; completedCards = {};
  const wrap = document.getElementById('progressWrap');
  const area = document.getElementById('submitArea');
  const cards = document.getElementById('ratingCards');
  
  const raterPhotoWrap = document.getElementById('raterPhotoWrap');
  const raterPhotoImg = document.getElementById('raterPhotoImg');
  const raterPhotoDefault = document.getElementById('raterPhotoDefault');
  
  if (!currentRater) {
    cards.style.display = 'none'; wrap.style.display = 'none'; area.style.display = 'none'; 
    if (raterPhotoImg) raterPhotoImg.style.display = 'none';
    if (raterPhotoDefault) raterPhotoDefault.style.display = 'block';
    return;
  }
  
  if (raterPhotoImg && raterPhotoDefault) {
    const photoUrl = getPlayerPhoto(currentRater);
    if (photoUrl) {
      raterPhotoImg.src = photoUrl;
      raterPhotoImg.style.display = 'block';
      raterPhotoDefault.style.display = 'none';
    } else {
      raterPhotoImg.style.display = 'none';
      raterPhotoDefault.style.display = 'block';
    }
  }
  
  if (!isInit) {
    localStorage.setItem('hs_my_identity', currentRater);
    raterSel.disabled = true;
    document.getElementById('changeIdentityBtn').style.display = 'inline-block';
    document.getElementById('identityLockedMsg').style.display = 'block';
  }
  wrap.style.display = 'block'; area.style.display = 'block';
  buildCards();
}

// ─── KART OLUŞTURMA (Sheet'ten bugün gelenler) ────────────────────────────────
function buildCards() {
  const c = document.getElementById('ratingCards');
  c.innerHTML = '<div class="no-data"><span class="spin"></span>Bu haftaki aktif oyuncular yükleniyor...</div>';
  c.style.display = 'block';
  currentScores = {}; completedCards = {};

  const week = getWeekLabel();
  const cached = localStorage.getItem('hs_today_players_cache');
  let cachedWeek = null, cachedList = null;
  if (cached) {
    try { const cd = JSON.parse(cached); cachedWeek = cd.week; cachedList = cd.players; } catch(e) {}
  }
  const hakemCached = localStorage.getItem('hs_hakem_cache');
  let cachedHakemWeek = null, cachedHakemName = '';
  if (hakemCached) {
    try { const hd = JSON.parse(hakemCached); cachedHakemWeek = hd.week; cachedHakemName = hd.hakem || ''; } catch(e) {}
  }

  const renderWithData = (activePlayers, hakemName) => {
    const isHakem = (hakemName && currentRater === hakemName);

    // Kullanıcı maça geldi mi kontrol et (hakem ise bypass)
    if (!isHakem && activePlayers && activePlayers.length && !activePlayers.includes(currentRater)) {
      c.innerHTML = `<div class="no-data" style="border-color:#ff3b30;color:#ff3b30;background:rgba(255,59,48,0.05);">
        ⛔ Bu hafta (${week}) maça gelmediğin olarak işaretlendin.<br>
        <span style="font-size:12px;color:var(--text3);display:block;margin-top:8px;">Yönetici ile iletişime geç.</span>
      </div>`;
      document.getElementById('submitArea').style.display = 'none';
      document.getElementById('progressWrap').style.display = 'none';
      return;
    }

    const showVotedBlock = () => {
      c.innerHTML = `<div style="text-align:center;padding:32px 16px;background:var(--bg2);border-radius:var(--r);border:2px solid var(--green);box-shadow:var(--sh-card);">
        <div style="font-size:48px;margin-bottom:16px;">✅</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px;letter-spacing:-0.5px;">Bu Hafta Oyladın!</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.6;">
          <b style="color:var(--green)">${week}</b> haftası için değerlendirmeni zaten tamamladın.<br>
          Sıralama ekranından sonuçlarını görebilirsin.
        </div>
        <div style="font-size:12px;color:var(--text3);background:var(--bg3);padding:10px 14px;border-radius:12px;font-weight:600;">
          ⚠️ Aynı haftada tekrar oy verilemez. Hata olduğunu düşünüyorsan yönetici ile iletişime geç.
        </div>
      </div>`;
      document.getElementById('submitArea').style.display = 'none';
      document.getElementById('progressWrap').style.display = 'none';
    };

    // Her zaman Sheets'ten kontrol et — localStorage sadece UX hızı için, ama Sheets gerçek kaynak
    c.innerHTML = '<div class="no-data"><span class="spin"></span>Oylama durumu kontrol ediliyor...</div>';
    gs({ action: 'checkVoted', week, rater: currentRater }).then(vd => {
      if (vd.voted) {
        showVotedBlock();
        return;
      }
      renderCards(activePlayers, hakemName, isHakem);
    }).catch(() => renderCards(activePlayers, hakemName, isHakem));
  };

  const renderCards = (activePlayers, hakemName, isHakem) => {
    document.getElementById('submitArea').style.display = 'block';
    document.getElementById('progressWrap').style.display = 'block';

    // Hakem bilgi bandı
    let hakemBanner = '';
    if (isHakem) {
      hakemBanner = `<div style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;border-radius:16px;padding:14px 16px;margin-bottom:16px;">
        <span style="font-size:28px;">🟡</span>
        <div><div style="font-size:14px;font-weight:800;color:#92400e;">Bu Hafta Hakemsin!</div><div style="font-size:12px;color:#b45309;margin-top:2px;font-weight:600;">Oy kullanabilirsin ama sana oy verilemez.</div></div>
      </div>`;
    }

    const list = (activePlayers && activePlayers.length)
      ? PLAYERS.filter(p => activePlayers.includes(p.name) && p.name !== currentRater && p.name !== hakemName)
      : PLAYERS.filter(p => p.name !== currentRater && p.name !== hakemName);

    c.innerHTML = hakemBanner;
    list.forEach(p => {
      const pid = san(p.name);
      const card = document.createElement('div');
      card.className = 'pcard';
      card.id = `card-${pid}`;
      const photoUrl = getPlayerPhoto(p.name);
      const avHtml = photoUrl 
        ? `<img src="${photoUrl}" alt="${p.name}" style="width:48px;height:48px;border-radius:18px;object-fit:cover;box-shadow:0 8px 20px rgba(16,185,129,.25);" onerror="this.outerHTML='<div class=\\'av\\'>${p.name.charAt(0)}</div>'">`
        : `<div class="av">${p.name.charAt(0)}</div>`;
      const slidersHtml = CRITERIA.map((cr, ci) => `
        <div class="crit-row">
          <span class="crit-name">${CDISP[ci]}</span>
          <input type="range" min="1" max="10" step="1" value="5" oninput="onSlider('${pid}','${cr}',this.value,'d-${pid}-${san(cr)}','${p.name}')">
          <span class="score-num" id="d-${pid}-${san(cr)}">—</span>
        </div>`).join('');
      card.innerHTML = `
        <div class="pcard-head">
          ${avHtml}
          <span class="pcard-name">${p.name}</span>
          <span class="pos-badge">${posShort(p)}</span>
        </div>
        ${slidersHtml}`;
      c.appendChild(card);
    });
    updateProgress();
  };

  // Önbellek kontrolü: manuel hafta ayarlanmışsa önbelleği KULLANMA, her zaman Sheets'ten çek
  const useCache = !_manualWeek && (cachedWeek === week && cachedList) && (cachedHakemWeek === week);

  if (useCache) {
    renderWithData(cachedList, cachedHakemName);
    // arka planda taze veri çek
    Promise.all([
      gs({ action: 'getTodayPlayers', week }),
      gs({ action: 'getHakem', week })
    ]).then(([tdData, hkData]) => {
      localStorage.setItem('hs_today_players_cache', JSON.stringify({ week, players: tdData.players || [] }));
      localStorage.setItem('hs_hakem_cache', JSON.stringify({ week, hakem: hkData.hakem || '' }));
    }).catch(() => {});
    return;
  }

  Promise.all([
    gs({ action: 'getTodayPlayers', week }),
    gs({ action: 'getHakem', week })
  ]).then(([tdData, hkData]) => {
    const players = tdData.players || [];
    const hakem = hkData.hakem || '';
    localStorage.setItem('hs_today_players_cache', JSON.stringify({ week, players }));
    localStorage.setItem('hs_hakem_cache', JSON.stringify({ week, hakem }));
    renderWithData(players, hakem);
  }).catch(() => renderWithData([], ''));
}

// ─── SLIDER / PUANLAMA ───────────────────────────────────────────────────────
function onSlider(pid, cr, val, did, pname) {
  const d = document.getElementById(did);
  if (d) { d.textContent = val; d.style.color = scoreColor(+val); }
  if (!currentScores[pname]) currentScores[pname] = {};
  currentScores[pname][cr] = +val;
  if (CRITERIA.every(c => currentScores[pname] && currentScores[pname][c] !== undefined)) {
    completedCards[pname] = true;
    const card = document.getElementById(`card-${pid}`);
    if (card) card.className = 'pcard done';
  }
  updateProgress();
}
function updateProgress() {
  const others = Array.from(document.getElementById('ratingCards').querySelectorAll('.pcard'));
  const total = others.length, done = Object.keys(completedCards).length;
  document.getElementById('progCount').textContent = `${done}/${total}`;
  document.getElementById('progFill').style.width = `${total ? (done / total * 100) : 0}%`;
  document.getElementById('submitBtn').disabled = (done < total || total === 0);
}
function submitRatings() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>İşleniyor...';
  const week = getWeekLabel();
  const filtered = {};
  Object.keys(currentScores).forEach(p => { filtered[p] = currentScores[p]; });
  gs({action:'save', rater:currentRater, week, scores:JSON.stringify(filtered)})
    .then(d => {
      if (d.success) {
        btn.textContent = 'Puanları Gönder';
        localStorage.removeItem('hs_results_cache');
        resultData = null;
        loadResults(() => {}, true);
        document.getElementById('successPopup').style.display = 'flex';
      } else if (d.alreadyVoted) {
        showToast('Bu hafta zaten oy kullandınız!', true);
        btn.disabled = false; btn.textContent = 'Puanları Gönder';
        buildCards();
      } else {
        showToast('Bir hata oluştu, lütfen tekrar deneyin.', true);
        btn.disabled = false; btn.textContent = 'Puanları Gönder';
      }
    }).catch(() => {
      showToast('Bağlantı hatası oluştu.', true);
      btn.disabled = false; btn.textContent = 'Puanları Gönder';
    });
}
function closeSuccessPopup() {
  document.getElementById('successPopup').style.display = 'none';
  document.querySelectorAll('.bnav-item')[1].click();
}

// ─── ANASAYFA İSTATİSTİKLERİ ────────────────────────────────────────────
function renderHomeStats() {
  const el = document.getElementById('homeStatsContent');
  if (!el) return;
  
  loadResults(data => {
    if (!data || !data.players) {
      el.innerHTML = '<div class="no-data">Henüz veri yok</div>';
      return;
    }

    const totalPlayers = PLAYERS.length;
    const totalWeeks = data.weeks ? data.weeks.length : 0;
    const lastWeek = data.weeks && data.weeks.length ? data.weeks[data.weeks.length - 1] : '';
    
    let topPlayer = null;
    let topScore = 0;
    data.players.forEach(p => {
      if (p.genelOrt && p.genelOrt > topScore) {
      topScore = p.genelOrt;
      topPlayer = p;
    }
  });

    el.innerHTML = `
    <div class="home-stat-box">
      <div class="home-stat-value">${totalPlayers}</div>
      <div class="home-stat-label">Oyuncu</div>
    </div>
    <div class="home-stat-box">
      <div class="home-stat-value">${totalWeeks}</div>
      <div class="home-stat-label">Hafta</div>
    </div>
    <div class="home-stat-box">
      <div class="home-stat-value">${topPlayer ? Math.round(topScore * 10) : '—'}</div>
      <div class="home-stat-label">En Yüksek Puan</div>
    </div>
    <div class="home-stat-box">
      <div class="home-stat-value">${lastWeek || '—'}</div>
      <div class="home-stat-label">Son Hafta</div>
    </div>
  `;
  });
}

// ─── SCREEN NAVİGASYON ───────────────────────────────────────────────────────
function switchMainScreen(id, btnElement) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
  btnElement.classList.add('active');
  window.scrollTo({top: 0, behavior: 'smooth'});
  if (id === 'anasayfa') renderHomeStats();
  if (id === 'siralama') renderSonuc();
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
  if (id === 'takim') { renderTodayPlayers(); if (!resultData) loadResults(() => {}); }
}
function setStatScreen(id, btnElement) {
  document.querySelectorAll('#screen-istatistik .sub-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#screen-istatistik .sub-nb').forEach(b => b.classList.remove('active'));
  document.getElementById(`stat-${id}`).classList.add('active');
  btnElement.classList.add('active');
  if (id === 'hafta') renderHafta();
  if (id === 'trend' && document.getElementById('trendSelect').value) renderTrend();
  if (id === 'karsi') renderComparison();
  if (id === 'sezon') renderSezon();
  if (id === 'katilim') renderKatilim();
  if (id === 'maclar') loadMatchHistory();
}
function setAdminTab(id, btnElement) {
  document.querySelectorAll('#screen-admin .sub-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#screen-admin .admin-tab-minimal').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'var(--bg2)';
    b.style.color = 'var(--text3)';
    b.style.borderColor = 'var(--border2)';
    b.style.boxShadow = 'none';
  });
  document.getElementById(`admin-${id}`).classList.add('active');
  if (btnElement) {
    btnElement.classList.add('active');
    btnElement.style.background = 'linear-gradient(135deg, #10b981, #0ea5e9)';
    btnElement.style.color = '#fff';
    btnElement.style.borderColor = 'transparent';
    btnElement.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.2)';
  }
  if (id === 'mac') loadMatchHistory();
  if (id === 'ayarlar') renderPlayerList();
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

// ─── BUGÜN GELENLER (ADMİN) ──────────────────────────────────────────────────
function loadBugunTab() {
  const week = getWeekLabel();
  document.getElementById('bugunWeekLabel').textContent = week;
  const el = document.getElementById('bugunPlayerList');
  el.innerHTML = '<span class="spin"></span>';
  gs({ action: 'getTodayPlayers', week }).then(data => {
    const present = new Set(data.players || []);
    _bugunSelected = {};
    PLAYERS.forEach(p => { _bugunSelected[p.name] = present.size ? present.has(p.name) : true; });
    renderBugunList();
  }).catch(() => {
    PLAYERS.forEach(p => { _bugunSelected[p.name] = true; });
    renderBugunList();
  });
}
function renderBugunList() {
  const el = document.getElementById('bugunPlayerList');
  const posEmojis = { KL: '🧤', DEF: '🛡️', OMO: '⚙️', FRV: '⚡' };
  el.innerHTML = PLAYERS.map(p => {
    const on = _bugunSelected[p.name] !== false;
    const pos = normPos(p)[0] || 'OMO';
    return `<button id="bg-${san(p.name)}" onclick="toggleBugun('${p.name}')"
      style="font-size:13px;font-weight:700;padding:10px 16px;border-radius:20px;cursor:pointer;font-family:inherit;transition:all .2s;
             border:2px solid ${on ? 'var(--green)' : 'var(--border)'};
             background:${on ? 'var(--green)' : 'var(--bg2)'};
             color:${on ? '#fff' : 'var(--text2)'};
             box-shadow:${on ? '0 4px 10px rgba(16,185,129,.3)' : 'var(--sh)'}">
      ${posEmojis[pos] || ''} ${p.name}
    </button>`;
  }).join('');
}
function toggleBugun(name) {
  _bugunSelected[name] = !_bugunSelected[name];
  const btn = document.getElementById(`bg-${san(name)}`);
  if (!btn) return;
  const on = _bugunSelected[name];
  btn.style.background = on ? 'var(--green)' : 'var(--bg2)';
  btn.style.color = on ? '#fff' : 'var(--text2)';
  btn.style.borderColor = on ? 'var(--green)' : 'var(--border)';
  btn.style.boxShadow = on ? '0 4px 10px rgba(16,185,129,.3)' : 'var(--sh)';
}
function bugunSelectAll() { PLAYERS.forEach(p => { _bugunSelected[p.name] = true; }); renderBugunList(); }
function bugunClearAll() { PLAYERS.forEach(p => { _bugunSelected[p.name] = false; }); renderBugunList(); }
function saveBugunGelenler() {
  const week = getWeekLabel();
  const presentList = PLAYERS.filter(p => _bugunSelected[p.name]).map(p => p.name);
  const btn = document.getElementById('bugunSaveBtn');
  const msg = document.getElementById('bugunSaveMsg');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  msg.style.display = 'none';
  gs({ action: 'saveTodayPlayers', week, players: JSON.stringify(presentList) }).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      msg.textContent = `✅ ${presentList.length} oyuncu kaydedildi!`;
      msg.style.display = 'block';
      localStorage.removeItem('hs_today_players_cache');
      showToast(`${presentList.length} oyuncu bu hafta için işaretlendi!`);
    }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Kayıt hatası.', true); });
}

// ─── HAKEM (ADMİN) ───────────────────────────────────────────────────────────
function loadHakemTab() {
  const week = getWeekLabel();
  document.getElementById('hakemWeekLabel').textContent = week;
  const el = document.getElementById('hakemPlayerList');
  el.innerHTML = '<span class="spin"></span>';
  _selectedHakem = '';
  gs({ action: 'getHakem', week }).then(data => {
    _selectedHakem = data.hakem || '';
    _hakemData = { week, hakem: _selectedHakem };
    const infoEl = document.getElementById('hakemCurrentInfo');
    if (_selectedHakem) {
      infoEl.style.display = 'block';
      infoEl.textContent = `🟡 Mevcut hakem: ${_selectedHakem}`;
    } else {
      infoEl.style.display = 'none';
    }
    renderHakemPlayerList();
  }).catch(() => { _selectedHakem = ''; renderHakemPlayerList(); });
}
function renderHakemPlayerList() {
  const el = document.getElementById('hakemPlayerList');
  el.innerHTML = PLAYERS.map(p => {
    const on = _selectedHakem === p.name;
    return `<button id="hk-${san(p.name)}" onclick="selectHakem('${p.name}')"
      style="font-size:13px;font-weight:700;padding:10px 16px;border-radius:20px;cursor:pointer;font-family:inherit;transition:all .2s;
             border:2px solid ${on?'#f59e0b':'var(--border)'};
             background:${on?'#fef3c7':'var(--bg2)'};
             color:${on?'#92400e':'var(--text2)'};
             box-shadow:${on?'0 4px 10px rgba(245,158,11,.25)':'var(--sh)'}">
      ${on?'🟡 ':''}${p.name}
    </button>`;
  }).join('');
}
function selectHakem(name) {
  _selectedHakem = (_selectedHakem === name) ? '' : name;
  renderHakemPlayerList();
}
function saveHakemToSheet() {
  const week = getWeekLabel();
  const btn = document.getElementById('hakemSaveBtn');
  const msg = document.getElementById('hakemSaveMsg');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  msg.style.display = 'none';
  gs({ action: 'saveHakem', week, hakem: _selectedHakem }).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      _hakemData = { week, hakem: _selectedHakem };
      localStorage.setItem('hs_hakem_cache', JSON.stringify({ week, hakem: _selectedHakem }));
      const infoEl = document.getElementById('hakemCurrentInfo');
      if (_selectedHakem) {
        infoEl.style.display = 'block';
        infoEl.textContent = `🟡 Mevcut hakem: ${_selectedHakem}`;
        msg.textContent = `✅ ${_selectedHakem} hakem olarak atandı!`;
        showToast(`${_selectedHakem} bu hafta hakem olarak atandı!`);
      } else {
        infoEl.style.display = 'none';
        msg.textContent = `✅ Hakem kaldırıldı.`;
        showToast('Hakem kaldırıldı.');
      }
      msg.style.display = 'block';
    }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Kayıt hatası.', true); });
}
function clearHakem() {
  _selectedHakem = '';
  renderHakemPlayerList();
  saveHakemToSheet();
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
function loadResults(cb, forceRefresh = false) {
  if (resultData && !forceRefresh) { cb(resultData); return; }
  const cached = localStorage.getItem('hs_results_cache');
  if (cached && !resultData) {
    try { resultData = JSON.parse(cached); cb(resultData); } catch(e) {}
  }
  gs({action:'getResults'}).then(d => {
    const newStr = JSON.stringify(d);
    if (cached !== newStr) {
      localStorage.setItem('hs_results_cache', newStr);
      resultData = d; cb(d);
    }
  }).catch(() => { if (!resultData) cb(null); });
}

// ─── HESAPLAMA ────────────────────────────────────────────────────────────────
function calcStdDev(playerData) {
  const vals = playerData.weeklyGenels.filter(v => v != null);
  if (vals.length < 2) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / vals.length);
}
function posRating(playerData, pObj) {
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
function calcMarketValue(p, data) {
  if (!data) return 0;
  const pObj = PLAYERS.find(pl => pl.name === p.name) || { pos: ['OMO'] };
  let r = posRating(p, pObj);
  r = r !== null ? Math.min(99, Math.round(r * 10)) : (p.genelOrt ? Math.round(p.genelOrt * 10) : 50);
  if (isNaN(r) || r < 0) r = 50;
  const stdDev = calcStdDev(p);
  const totalWeeks = data.weeks ? data.weeks.length : 1;
  const attend = p.weeklyGenels.filter(v => v != null).length;
  const attRatio = totalWeeks ? (attend / totalWeeks) : 1;
  let base = Math.pow(1.12, r) * 3000;
  let val = base * Math.max(0.4, 1.2 - (stdDev / 2.5)) * (0.5 + (0.5 * attRatio));
  if (isNaN(val)) return 0;
  if (val > 1000000) val = Math.floor(val / 100000) * 100000;
  else if (val > 10000) val = Math.floor(val / 10000) * 10000;
  else val = Math.floor(val / 1000) * 1000;
  return val;
}
function getPlayStyles(p) {
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

// ─── FIFA KARTLARI ────────────────────────────────────────────────────────────
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
    ? `<img src="${photoUrl}" onerror="this.outerHTML='<div class=\\'fc-photo-ph\\' style=\\'color:${col.text}\\'>${p.name.charAt(0)}</div>'">`
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

// ─── SIRALAMA ─────────────────────────────────────────────────────────────────
function setRankTab(tab, btn) {
  const allowed = { genel: 1, defans: 1, orta: 1, forvet: 1 };
  currentRankTab = allowed[tab] ? tab : 'genel';
  document.querySelectorAll('#screen-siralama .sub-nb').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const grid = document.getElementById('fifaGrid');
  grid.className = 'fg'; grid.style.marginBottom = '12px';
  if (_sonucData) renderRankTab(_sonucData);
}
function renderSonuc() {
  const grid = document.getElementById('fifaGrid'), nd = document.getElementById('noDataSonuc');
  grid.className = 'fg'; grid.style.marginBottom = '12px';
  grid.innerHTML = '<div class="no-data"><span class="spin"></span>İstatistikler çekiliyor...</div>';
  nd.style.display = 'none';
  loadResults(data => {
    _sonucData = data; grid.innerHTML = '';
    if (!data || !data.players) { nd.style.display = 'block'; return; }
    if (data.weeks && data.weeks.length) {
      const totalWeeks = data.weeks.length;
      const lastWeek = data.weeks[totalWeeks - 1];
      document.getElementById('statsInfoBand').style.display = 'block';
      const infoText = totalWeeks === 1
        ? `Son 1 haftanın verilerine göre`
        : `Son ${totalWeeks} haftanın ortalamasına göre`;
      document.getElementById('statsInfoText').textContent = infoText;
      document.getElementById('statsInfoWeekBadge').textContent = `📅 ${lastWeek}`;
    }
    renderRankTab(data);
  });
}
function renderRankTab(data) {
  const grid = document.getElementById('fifaGrid'), nd = document.getElementById('noDataSonuc');
  if (!({ genel: 1, defans: 1, orta: 1, forvet: 1 }[currentRankTab])) currentRankTab = 'genel';
  grid.className = 'fg'; grid.style.marginBottom = '12px';
  grid.innerHTML = ''; nd.style.display = 'none';
  const tabPos = { defans: 'DEF', orta: 'OMO', forvet: 'FRV' }[currentRankTab];
  const players = data.players.filter(p => p.genelOrt !== null);
  const sorted = players.map(p => {
    const pObj = PLAYERS.find(pl => pl.name === p.name) || { pos: ['OMO'] };
    let score = tabPos ? posRating(p, { pos: [tabPos] }) : posRating(p, pObj);
    return { p, pObj, score: score || 0, tabPos };
  }).sort((a, b) => b.score - a.score);
  if (!sorted.length) { nd.style.display = 'block'; return; }
  sorted.forEach((item, i) => {
    const displayObj = item.tabPos ? { pos: [item.tabPos] } : item.pObj;
    grid.appendChild(makeFifaCard(item.p, displayObj, i, data, item.score));
  });
}

// ─── HAFTALIK ─────────────────────────────────────────────────────────────────
function renderHafta() {
  const wrap = document.getElementById('weekSelectorWrap');
  const content = document.getElementById('weekContent');
  const nd = document.getElementById('noDataHafta');
  wrap.innerHTML = ''; content.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  if (nd) nd.style.display = 'none';
  loadResults(data => {
    content.innerHTML = '';
    if (!data || !data.weeks || !data.weeks.length) { if (nd) nd.style.display = 'block'; return; }
    const weeks = data.weeks.slice().reverse();
    // Hafta seçici — yatay scroll, aktif hafta büyük, katılım oranı göster
    wrap.innerHTML = `
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;scrollbar-width:none;" id="weekSelector">
        ${weeks.map((w, i) => {
          const wi = data.weeks.indexOf(w);
          const participants = data.players.filter(p => p.weeklyGenels[wi] != null).length;
          const total = PLAYERS.length;
          return `<button onclick="selectWeekBtn(this,'${w}')" data-week="${w}"
            style="flex-shrink:0;border:none;cursor:pointer;font-family:inherit;transition:all .25s cubic-bezier(0.4,0,0.2,1);
                   padding:${i===0?'12px 18px':'10px 14px'};border-radius:16px;text-align:left;
                   background:${i===0?'var(--text)':'var(--bg2)'};
                   color:${i===0?'var(--bg)':'var(--text2)'};
                   box-shadow:${i===0?'0 4px 12px rgba(0,0,0,0.2)':'var(--sh)'};
                   border:1px solid ${i===0?'transparent':'var(--border)'};">
            <div style="font-size:${i===0?'13':'11'}px;font-weight:800;letter-spacing:-0.3px;white-space:nowrap;">${w}</div>
            <div style="font-size:9px;font-weight:700;margin-top:2px;opacity:${i===0?0.7:0.5};white-space:nowrap;">${participants}/${total} oy</div>
          </button>`;
        }).join('')}
      </div>`;
    renderWeek(weeks[0], data);
  });
}

function selectWeekBtn(btn, week) {
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
  // Seçili haftayı görünür yap
  btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  // Data gerekiyor — loadResults'ten çek
  loadResults(data => renderWeek(week, data));
}

function renderWeek(week, data) {
  const content = document.getElementById('weekContent');
  const wi = data.weeks.indexOf(week);
  const wp = data.players
    .map(p => ({ name: p.name, score: p.weeklyGenels[wi], kr: p.weeklyKriterler[week] || {} }))
    .filter(p => p.score != null)
    .sort((a, b) => b.score - a.score);
  if (!wp.length) { content.innerHTML = '<div class="no-data">Bu hafta veri yok.</div>'; return; }

  const maxScore = Math.max(...wp.map(p => p.score));
  const minScore = Math.min(...wp.map(p => p.score));
  const totalVoters = data.ratersPerWeek ? (data.ratersPerWeek[week] || []).length : '?';

  // Hafta özet header
  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div style="background:var(--bg2);border-radius:14px;padding:12px;text-align:center;box-shadow:var(--sh-card);border:1px solid var(--border2);">
        <div style="font-size:22px;font-weight:900;color:var(--text);letter-spacing:-1px;">${wp.length}</div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Değerlendirilen</div>
      </div>
      <div style="background:var(--bg2);border-radius:14px;padding:12px;text-align:center;box-shadow:var(--sh-card);border:1px solid var(--border2);">
        <div style="font-size:22px;font-weight:900;color:var(--green);letter-spacing:-1px;">${(maxScore * 10).toFixed(0)}</div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">En Yüksek</div>
      </div>
      <div style="background:var(--bg2);border-radius:14px;padding:12px;text-align:center;box-shadow:var(--sh-card);border:1px solid var(--border2);">
        <div style="font-size:22px;font-weight:900;color:var(--text);letter-spacing:-1px;">${totalVoters}</div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Oy Kullanan</div>
      </div>
    </div>`;

  // Oyuncu kartları — kompakt ama detaylı liste
  wp.forEach((p, i) => {
    const r10 = (p.score * 10);
    const pct = ((p.score - minScore) / (maxScore - minScore || 1) * 100).toFixed(0);
    const pObj = PLAYERS.find(pl => pl.name === p.name) || { pos: ['OMO'] };
    const photoUrl = getPlayerPhoto(p.name);
    const posKey = normPos(pObj)[0] || 'OMO';
    const posEmoji = { KL:'🧤', DEF:'🛡️', OMO:'⚙️', FRV:'⚡' }[posKey] || '⚽';
    const rankDisplay = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="font-size:13px;font-weight:900;color:var(--text3);">${i+1}</span>`;
    const rCol = r10 >= 80 ? '#f59e0b' : r10 >= 70 ? 'var(--green)' : r10 >= 55 ? '#60a5fa' : 'var(--text3)';
    const isTop = i < 3;

    // Kriter mini bar satırı
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
          <!-- Rank -->
          <div style="width:28px;text-align:center;flex-shrink:0;font-size:18px;">${rankDisplay}</div>
          <!-- Avatar/foto -->
          <div style="width:40px;height:40px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--bg3);border:1px solid var(--border2);">
            ${photoUrl
              ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:var(--green);">${p.name.charAt(0)}</div>`}
          </div>
          <!-- İsim & mevki -->
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:800;letter-spacing:-0.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
            <div style="font-size:10px;color:var(--text3);font-weight:600;margin-top:1px;">${posEmoji} ${POS[posKey]||posKey}</div>
          </div>
          <!-- Skor -->
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:28px;font-weight:900;color:${rCol};letter-spacing:-1.5px;line-height:1;">${r10.toFixed(1)}</div>
            <div style="font-size:8px;font-weight:700;color:var(--text3);text-align:right;margin-top:1px;">PUAN</div>
          </div>
        </div>
        <!-- Progress bar -->
        <div style="height:3px;background:var(--border2);border-radius:2px;overflow:hidden;margin-bottom:10px;">
          <div style="width:${pct}%;height:100%;background:${rCol};border-radius:2px;transition:width .6s cubic-bezier(0.16,1,0.3,1);"></div>
        </div>
        <!-- Kriter breakdown -->
        <div style="display:flex;gap:4px;">${kritBars}</div>
      </div>`;
  });

  content.innerHTML = html;
}

// ─── TREND ────────────────────────────────────────────────────────────────────
function renderTrend() {
  const pname = document.getElementById('trendSelect').value;
  const el = document.getElementById('trendContent');
  if (!pname) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Grafik oluşturuluyor...</div>';
  loadResults(data => {
    if (!data || !data.players) { el.innerHTML = '<div class="no-data">Veri yok.</div>'; return; }
    const pdata = data.players.find(p => p.name === pname);
    if (!pdata) { el.innerHTML = '<div class="no-data">Oyuncu bulunamadı.</div>'; return; }
    const weeks = data.weeks;
    const last5weeks = weeks.slice(-5);
    const scores = last5weeks.map(w => {
      const wi = weeks.indexOf(w);
      const s = pdata.weeklyGenels[wi];
      return { week: w, score: s != null ? +(s * 10).toFixed(1) : null };
    });
    const valid = scores.filter(s => s.score !== null);
    if (!valid.length) { el.innerHTML = '<div class="no-data">Yeterli veri yok.</div>'; return; }

    // Dinamik ölçek — min/max etrafında padding
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
    const first = validPts[0], last = validPts[validPts.length - 1];
    const trendDir = valid.length > 1 ? (valid[valid.length-1].score > valid[0].score ? '↑' : valid[valid.length-1].score < valid[0].score ? '↓' : '→') : '→';
    const trendColor = trendDir === '↑' ? 'var(--green)' : trendDir === '↓' ? '#f97316' : 'var(--text3)';
    const trendLabel = trendDir === '↑' ? 'Yükseliyor' : trendDir === '↓' ? 'Düşüyor' : 'Stabil';
    const avg = (valid.reduce((a, s) => a + s.score, 0) / valid.length).toFixed(1);

    // Y eksen grid çizgileri
    const gridCount = 4;
    const gridLines = Array.from({length: gridCount + 1}, (_, i) => {
      const v = yMin + (yMax - yMin) * (i / gridCount);
      const y = toY(v).toFixed(1);
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" opacity="0.6"/>
              <text x="${padL - 4}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="8" fill="var(--text3)" font-weight="500">${Math.round(v)}</text>`;
    }).join('');

    // Noktalar ve değer etiketleri — ince ve küçük
    const dotsAndLabels = pts.map(p => {
      if (p.y === null) return `<circle cx="${p.x.toFixed(1)}" cy="${(padT + chartH/2).toFixed(1)}" r="2" fill="var(--border)" opacity="0.4"/>`;
      const labelY = p.y < padT + 14 ? p.y + 14 : p.y - 8;
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--green)" opacity="0.9"/>
              <text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--green)" opacity="0.9">${p.score}</text>`;
    }).join('');

    // Hafta etiketleri
    const weekLabels = pts.map(p => `<text x="${p.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="8.5" fill="var(--text3)" font-weight="600">${p.week.replace(/\d{4}-/, '')}</text>`).join('');

    // Kriter küçük istatistikler — 2 satır x 4 kolon daha temiz
    const kritStats = CRITERIA.map((c, ci) => {
      const vals = last5weeks.map(w => pdata.weeklyKriterler[w] ? pdata.weeklyKriterler[w][c] : null).filter(v => v != null);
      const cavg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      const bar = cavg !== null ? Math.round(cavg / 10 * 100) : 0;
      const col = cavg !== null ? scoreColor(cavg) : 'var(--text3)';
      return `<div style="padding:8px 6px;background:var(--bg3);border-radius:10px;text-align:center;border:1px solid var(--border2);">
        <div style="font-size:13px;font-weight:900;color:${col};letter-spacing:-0.3px;">${cavg !== null ? cavg.toFixed(1) : '—'}</div>
        <div style="font-size:8px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.3px;margin-top:2px;">${CDISP[ci]}</div>
        <div style="height:2px;background:var(--border2);border-radius:1px;margin-top:4px;overflow:hidden;"><div style="width:${bar}%;height:100%;background:${col};border-radius:1px;transition:width .5s;"></div></div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <!-- Üst stat satırı -->
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Son ${n} Hafta Ort.</div>
            <div style="font-size:32px;font-weight:900;color:var(--green);letter-spacing:-1.5px;line-height:1;">${avg}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:900;color:${trendColor};line-height:1;">${trendDir}</div>
            <div style="font-size:11px;font-weight:700;color:${trendColor};margin-top:2px;">${trendLabel}</div>
          </div>
        </div>
        <!-- SVG Grafik -->
        <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">
          <defs>
            <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--green)" stop-opacity="0.12"/>
              <stop offset="100%" stop-color="var(--green)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- Grid -->
          ${gridLines}
          <!-- X ekseni -->
          <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="0.75"/>
          <!-- Alan dolgusu -->
          ${pathD && first && last ? `<path d="${pathD} L${last.x.toFixed(1)} ${(padT+chartH).toFixed(1)} L${first.x.toFixed(1)} ${(padT+chartH).toFixed(1)} Z" fill="url(#tg2)"/>` : ''}
          <!-- Ana çizgi — ince -->
          ${pathD ? `<path d="${pathD}" stroke="var(--green)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>` : ''}
          <!-- Noktalar & değerler -->
          ${dotsAndLabels}
          <!-- Hafta etiketleri -->
          ${weekLabels}
        </svg>
      </div>
      <!-- Kriter breakdown -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px;">
        ${kritStats}
      </div>
    `;
  });
}

// ─── KARŞILAŞTIRMA ────────────────────────────────────────────────────────────
function renderComparison() {
  const a = document.getElementById('cmpA').value, b = document.getElementById('cmpB').value;
  const el = document.getElementById('cmpContent');
  if (!a || !b) { el.innerHTML = ''; return; }
  if (a === b) { showToast('Farklı iki oyuncu seçmelisiniz.', true); el.innerHTML = ''; return; }
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Detaylı analiz hazırlanıyor...</div>';
  loadResults(data => {
    if (!data || !data.players) { el.innerHTML = '<div class="no-data">Veri yok.</div>'; return; }
    const pa = data.players.find(p => p.name === a), pb = data.players.find(p => p.name === b);
    if (!pa || !pb) { el.innerHTML = '<div class="no-data">Yeterli veri yok — iki oyuncunun da puanı olmalı.</div>'; return; }
    const paObj = PLAYERS.find(pl => pl.name === a) || { pos: ['OMO'] };
    const pbObj = PLAYERS.find(pl => pl.name === b) || { pos: ['OMO'] };
    const aRating = Math.min(99, Math.round((posRating(pa, paObj) || 0) * 10));
    const bRating = Math.min(99, Math.round((posRating(pb, pbObj) || 0) * 10));
    const getKrit = (pdata, c) => {
      let vals = [];
      if (pdata.weeklyKriterler) Object.values(pdata.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
      return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    };
    const aVals = CRITERIA.map(c => getKrit(pa, c));
    const bVals = CRITERIA.map(c => getKrit(pb, c));

    // ── Radar SVG — etiketler için geniş viewBox ────────────────────────
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

    // ── Form trend (son 5 hafta) — ince ve düzgün ölçekli ──────────────
    const last5 = data.weeks.slice(-5);
    const TW = 300, TH = 110, tPL = 22, tPR = 12, tPT = 18, tPB = 22;
    const tChartW = TW - tPL - tPR, tChartH = TH - tPT - tPB;

    // Tüm geçerli değerleri topla, dinamik ölçek
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
    // Y eksen grid
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

    // ── Kritere göre duel barları — kompakt ───────────────────────────
    const duelRows = CRITERIA.map((c,ci) => {
      const av = aVals[ci], bv = bVals[ci], maxv = Math.max(av, bv, 0.1);
      const aW = Math.round(av/maxv*44), bW = Math.round(bv/maxv*44);
      const winner = av > bv ? 'a' : bv > av ? 'b' : '';
      return `<div style="display:grid;grid-template-columns:28px 1fr 50px 1fr 28px;align-items:center;gap:5px;margin-bottom:8px;">
        <span style="text-align:right;font-size:${winner==='a'?'13':'11'}px;font-weight:${winner==='a'?900:500};color:${winner==='a'?'var(--green)':'var(--text3)'};">${av.toFixed(1)}</span>
        <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;display:flex;justify-content:flex-end;"><div style="width:${aW}%;background:var(--green);border-radius:3px;opacity:0.9;"></div></div>
        <div style="text-align:center;font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.3px;">${CDISP[ci]}</div>
        <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;"><div style="width:${bW}%;background:#3b82f6;border-radius:3px;opacity:0.9;"></div></div>
        <span style="font-size:${winner==='b'?'13':'11'}px;font-weight:${winner==='b'?900:500};color:${winner==='b'?'#3b82f6':'var(--text3)'};">${bv.toFixed(1)}</span>
      </div>`;
    }).join('');

    // ── Otomatik Yorum ──────────────────────────────────────────────────
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

    const commentary = `<div style="background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px solid var(--border);border-radius:20px;padding:18px;margin-top:4px;">
      <div style="font-size:11px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">🤖 Otomatik Analiz</div>
      <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.7;">
        ${overallWinner
          ? `<b style="color:${overallWinner===a?'var(--green)':'#3b82f6'}">${overallWinner}</b>, <b>${overallWinner===a?bRating-aRating<0?Math.abs(aRating-bRating):aRating-bRating:Math.abs(bRating-aRating)}</b> puanlık farkla genel değerlendirmede öne çıkıyor.`
          : `İki oyuncu da aynı genel puanda! Oldukça dengeli bir duel.`}
        ${a}, <b>${aWins}</b> kriterde; ${b} ise <b>${bWins}</b> kriterde üstün.
      </div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text2);font-weight:600;">
        <div>💚 <b style="color:var(--green)">${a}</b>'nın en güçlü yönü: <b>${critLabels[aBestCrit]}</b> (${Math.max(...aVals).toFixed(1)}) — en çalışması gereken: ${critLabels[aWorstCrit]}</div>
        <div>🔵 <b style="color:#3b82f6">${b}</b>'nın en güçlü yönü: <b>${critLabels[bBestCrit]}</b> (${Math.max(...bVals).toFixed(1)}) — en çalışması gereken: ${critLabels[bWorstCrit]}</div>
        <div>📈 Form: <b style="color:var(--green)">${a}</b> <span style="color:${aFormTrend==='yükselen'?'var(--green)':'#f97316'}">${aFormTrend==='yükselen'?'↑ yükseliyor':'↓ düşüyor'}</span> — <b style="color:#3b82f6">${b}</b> <span style="color:${bFormTrend==='yükselen'?'var(--green)':'#f97316'}">${bFormTrend==='yükselen'?'↑ yükseliyor':'↓ düşüyor'}</span></div>
      </div>
    </div>`;

    // ── Fotoğraflı header ──────────────────────────────────────────────
    const photoA = getPlayerPhoto(a);
    const photoB = getPlayerPhoto(b);
    const avatarA = photoA ? `<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;margin:0 auto 10px;border:3px solid var(--green);box-shadow:0 4px 12px var(--gd);"><img src="${photoA}" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'"></div>` : `<div class="av" style="width:64px;height:64px;font-size:22px;margin:0 auto 10px;border:3px solid var(--green);">${a.charAt(0)}</div>`;
    const avatarB = photoB ? `<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;margin:0 auto 10px;border:3px solid #3b82f6;box-shadow:0 4px 12px rgba(59,130,246,.2);"><img src="${photoB}" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'"></div>` : `<div class="av" style="width:64px;height:64px;font-size:22px;margin:0 auto 10px;border:3px solid #3b82f6;background:#eff6ff;color:#3b82f6;">${b.charAt(0)}</div>`;

    el.innerHTML = `
      <!-- Header -->
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

      <!-- Radar -->
      <div class="card" style="margin-bottom:14px;">
        <div class="slabel" style="margin-bottom:12px;">🕸️ Beceri Radari</div>
        <div style="display:flex;gap:16px;justify-content:center;margin-bottom:12px;">
          <span style="font-size:11px;font-weight:800;color:var(--green);display:flex;align-items:center;gap:5px;"><span style="width:12px;height:3px;background:var(--green);border-radius:2px;display:inline-block;"></span>${a}</span>
          <span style="font-size:11px;font-weight:800;color:#3b82f6;display:flex;align-items:center;gap:5px;"><span style="width:12px;height:3px;background:#3b82f6;border-radius:2px;display:inline-block;"></span>${b}</span>
        </div>
        ${radarSVG}
      </div>

      <!-- Duel Bars -->
      <div class="card" style="margin-bottom:14px;">
        <div class="slabel" style="margin-bottom:16px;">⚔️ Kritere Göre Karşılaştırma</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px;font-weight:800;">
          <span style="color:var(--green);">${a}</span>
          <span style="color:#3b82f6;">${b}</span>
        </div>
        ${duelRows}
      </div>

      <!-- Form Trend -->
      <div class="card" style="margin-bottom:14px;">
        <div class="slabel" style="margin-bottom:4px;">📈 Son 5 Hafta Form Trendi</div>
        <div style="display:flex;gap:16px;margin-bottom:8px;">
          <span style="font-size:11px;font-weight:800;color:var(--green);">— ${a}</span>
          <span style="font-size:11px;font-weight:800;color:#3b82f6;">— ${b}</span>
        </div>
        ${trendSVG}
      </div>

      <!-- AI Yorum -->
      ${commentary}
    `;
  });
}

// ─── SEZON ────────────────────────────────────────────────────────────────────
function renderSezon() {
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

    const sorted = [...players].sort((a, b) => {
      const paObj = PLAYERS.find(pl => pl.name === a.name) || { pos: ['OMO'] };
      const pbObj = PLAYERS.find(pl => pl.name === b.name) || { pos: ['OMO'] };
      return (posRating(b, pbObj) || 0) - (posRating(a, paObj) || 0);
    });

    // Ödül sahipleri
    const mvp = sorted[0];
    const mostValuable = [...players].sort((a,b) => calcMarketValue(b,data) - calcMarketValue(a,data))[0];
    const mostCon = [...players].sort((a,b) => stddev(a) - stddev(b))[0];
    const mostAttend = [...players].sort((a,b) => attendCount(b) - attendCount(a))[0];
    const bestDef = [...players].sort((a,b) => kritAvg(b,'Savunma') - kritAvg(a,'Savunma'))[0];
    const bestFwd = [...players].sort((a,b) => kritAvg(b,'Sut') - kritAvg(a,'Sut'))[0];
    const bestPass = [...players].sort((a,b) => kritAvg(b,'Pas') - kritAvg(a,'Pas'))[0];
    const bestSpeed = [...players].sort((a,b) => kritAvg(b,'Hiz / Kondisyon') - kritAvg(a,'Hiz / Kondisyon'))[0];

    let html = '';

    // ── SEZON BAŞLIĞI ──────────────────────────────────────────────────
    html += `
      <div class="sezon-header-modern" style="border-radius:28px;padding:28px;margin-bottom:18px;text-align:center;position:relative;overflow:hidden;background:linear-gradient(135deg,#050816 0%,#0b1120 40%,#020617 100%);border:1px solid rgba(148,163,184,0.15);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div class="sezon-bg-pattern" style="position:absolute;inset:0;opacity:0.2;pointer-events:none;"></div>
        <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:radial-gradient(circle,rgba(59,130,246,0.3) 0%,transparent 60%);border-radius:50%;filter:blur(20px);"></div>
        <div style="position:absolute;bottom:-60px;left:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(16,185,129,0.25) 0%,transparent 60%);border-radius:50%;filter:blur(30px);"></div>
        <div style="position:relative;z-index:1;">
          <div style="font-size:10px;font-weight:900;color:#60a5fa;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;opacity:0.9;">FIFA STILİ SEZON ÖZETİ</div>
          <div style="font-size:40px;font-weight:900;color:#fff;letter-spacing:-2px;margin-bottom:6px;text-shadow:0 4px 30px rgba(59,130,246,0.3);">${totalWeeks} <span style="color:#10b981;">HAFTA</span></div>
          <div style="font-size:13px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;">${players.length} oyuncu · ${data.weeks[0]} → ${data.weeks[totalWeeks-1]}</div>
        </div>
      </div>`;

    // ── MVP ÖNCELİKLİ (FIFA stili büyük kart) ─────────────────────────
    if (mvp) {
      const mvpObj = PLAYERS.find(pl => pl.name === mvp.name) || { pos: ['OMO'] };
      const mvpRating = Math.min(99, Math.round((posRating(mvp, mvpObj) || 0) * 10));
      const mvpPhoto = getPlayerPhoto(mvp.name);
      
      html += `
        <div class="mvp-card-modern" style="border-radius:28px;padding:24px;margin-bottom:18px;position:relative;overflow:hidden;background:linear-gradient(135deg,#101828 0%,#020617 100%);border:1px solid rgba(251,191,36,0.25);box-shadow:0 24px 60px rgba(251,191,36,0.15);">
          <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(90deg,rgba(251,191,36,0.05),transparent 40%);pointer-events:none;"></div>
          <div style="position:absolute;top:-60px;right:-40px;font-size:160px;opacity:0.1;filter:blur(2px);">👑</div>
          <div style="display:flex;gap:20px;align-items:center;position:relative;z-index:1;">
            <div class="mvp-avatar-wrap" style="width:100px;height:100px;border-radius:26px;overflow:hidden;flex-shrink:0;border:3px solid rgba(251,191,36,0.4);box-shadow:0 12px 32px rgba(251,191,36,0.25);background:#020617;position:relative;">
              ${mvpPhoto 
                ? `<img src="${mvpPhoto}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` 
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;color:#fbbf24;">${mvp.name.charAt(0)}</div>`}
              <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-size:30px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5));">👑</div>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:end;gap:10px;margin-bottom:6px;">
                <div style="font-size:12px;font-weight:900;color:#fbbf24;text-transform:uppercase;letter-spacing:2px;opacity:0.9;">Sezon MVP'si</div>
                <div style="font-size:52px;font-weight:900;color:#fbbf24;line-height:1;letter-spacing:-3px;text-shadow:0 2px 16px rgba(251,191,36,0.4);">${mvpRating}</div>
              </div>
              <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.8px;margin-bottom:4px;">${mvp.name}</div>
              <div style="display:flex;gap:10px;align-items:center;">
                <span style="padding:4px 10px;border-radius:12px;background:rgba(251,191,36,0.12);color:#fbbf24;font-size:11px;font-weight:900;border:1px solid rgba(251,191,36,0.25);">${posLabel(mvpObj)}</span>
                <span style="font-size:12px;color:#64748b;font-weight:700;">En yüksek genel rating</span>
              </div>
            </div>
          </div>
        </div>`;
    }

    // ── PODIUM 2. ve 3. ───────────────────────────────────────────────
    const podium23 = sorted.slice(1, 3);
    if (podium23.length) {
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">`;
      podium23.forEach((p, idx) => {
        const pObj = PLAYERS.find(pl => pl.name === p.name) || { pos: ['OMO'] };
        const r = Math.min(99, Math.round((posRating(p, pObj) || 0) * 10));
        const photo = getPlayerPhoto(p.name);
        const colors = [
          { bg: 'linear-gradient(135deg,#020617,#020617)', border: 'rgba(148,163,184,0.3)', accent: '#94a3b8' },
          { bg: 'linear-gradient(135deg,#020617,#020617)', border: 'rgba(251,191,36,0.15)', accent: '#b45309' }
        ];
        const c = colors[idx];
        const rank = idx + 2;
        const rankEmoji = idx === 0 ? '🥈' : '🥉';

        html += `
          <div style="background:${c.bg};border-radius:22px;padding:18px;border:1px solid ${c.border};position:relative;overflow:hidden;">
            <div style="position:absolute;top:-20px;right:-20px;font-size:60px;opacity:0.12;">${rankEmoji}</div>
            <div style="display:flex;gap:12px;align-items:center;position:relative;z-index:1;">
              <div style="width:52px;height:52px;border-radius:16px;overflow:hidden;flex-shrink:0;background:#020617;border:2px solid ${c.border};box-shadow:0 8px 20px rgba(0,0,0,.4);">
                ${photo 
                  ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` 
                  : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:${c.accent};">${p.name.charAt(0)}</div>`}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:end;justify-content:space-between;">
                  <div>
                    <div style="font-size:10px;font-weight:900;color:${c.accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px;">${rank}. SIRA</div>
                    <div style="font-size:15px;font-weight:900;color:#fff;letter-spacing:-0.5px;">${p.name}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:28px;font-weight:900;color:${c.accent};line-height:1;letter-spacing:-1px;">${r}</div>
                    <div style="font-size:10px;color:#64748b;font-weight:700;">Puan</div>
                  </div>
                </div>
              </div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    // ── ÖDÜLLER (FIFA kartları) ────────────────────────────────────────
    const awards = [
      { icon:'💎', accent:'#38bdf8', title:'En Değerli', sub:'Piyasa Değeri', name:mostValuable.name, val:formatMoney(calcMarketValue(mostValuable,data)) },
      { icon:'🎯', accent:'#a3e635', title:'Demir Gibi', sub:'En Tutarlı', name:mostCon.name, val:'σ='+stddev(mostCon).toFixed(2) },
      { icon:'📅', accent:'#c084fc', title:'Demirbaş', sub:'En Devam Eden', name:mostAttend.name, val:attendCount(mostAttend)+'/'+totalWeeks+' maç' },
      { icon:'🧱', accent:'#f97316', title:'Beton Duvar', sub:'Savunma', name:bestDef.name, val:kritAvg(bestDef,'Savunma').toFixed(1)+' puan' },
      { icon:'🚀', accent:'#fb7185', title:'Gol Makinesi', sub:'Şut', name:bestFwd.name, val:kritAvg(bestFwd,'Sut').toFixed(1)+' puan' },
      { icon:'🎩', accent:'#818cf8', title:'Maestro', sub:'Pas', name:bestPass.name, val:kritAvg(bestPass,'Pas').toFixed(1)+' puan' },
      { icon:'⚡', accent:'#fbbf24', title:'Rüzgar', sub:'Hız', name:bestSpeed.name, val:kritAvg(bestSpeed,'Hiz / Kondisyon').toFixed(1)+' puan' }
    ];

    html += `
      <div style="margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:4px;height:22px;border-radius:4px;background:linear-gradient(180deg,#10b981,#0ea5e9);"></div>
          <div style="font-size:12px;font-weight:900;color:var(--text);text-transform:uppercase;letter-spacing:1.8px;">KATEGORİ ÖDÜLLERİ</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:10px;">
          ${awards.map(a => `
            <div class="award-card-modern" style="background:linear-gradient(135deg,#020617 0%,#020617 100%);border-radius:20px;padding:14px 16px;border:1px solid rgba(148,163,184,0.12);display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;transition:all .25s;cursor:default;"
                 onmouseover="this.style.borderColor='${a.accent}40';this.style.transform='translateX(4px)';"
                 onmouseout="this.style.borderColor='rgba(148,163,184,0.12)';this.style.transform='';">
              <div style="position:absolute;right:-10px;top:-10px;font-size:56px;opacity:0.06;pointer-events:none;">${a.icon}</div>
              <div style="width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;background:${a.accent}15;border:1px solid ${a.accent}30;box-shadow:0 8px 18px ${a.accent}15;">
                ${a.icon}
              </div>
              <div style="flex:1;min-width:0;position:relative;z-index:1;">
                <div style="display:flex;align-items:end;justify-content:space-between;gap:10px;">
                  <div style="min-width:0;">
                    <div style="font-size:10px;font-weight:900;color:${a.accent};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:2px;">${a.title}</div>
                    <div style="font-size:14px;font-weight:900;color:#fff;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.name}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;">
                    <div style="font-size:14px;font-weight:900;color:#94a3b8;line-height:1;">${a.val}</div>
                    <div style="font-size:10px;color:#475569;font-weight:700;margin-top:2px;">${a.sub}</div>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    // ── TÜM OYUNCULAR LİSTESİ ───────────────────────────────────────────
    html += `
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="width:4px;height:22px;border-radius:4px;background:linear-gradient(180deg,#3b82f6,#8b5cf6);"></div>
          <div style="font-size:12px;font-weight:900;color:var(--text);text-transform:uppercase;letter-spacing:1.8px;">TÜM SIRALAMA</div>
        </div>`;

    sorted.forEach((p, i) => {
      const pObjS = PLAYERS.find(pl => pl.name === p.name) || { pos: ['OMO'] };
      const r = Math.min(99, Math.round((posRating(p, pObjS) || 0) * 10));
      const mv = calcMarketValue(p, data);
      const att = attendCount(p);
      const attPct = totalWeeks ? Math.round(att / totalWeeks * 100) : 0;
      const photo = getPlayerPhoto(p.name);
      const rCol = r >= 85 ? '#fbbf24' : r >= 75 ? '#94a3b8' : r >= 65 ? '#d97706' : '#3b82f6';
      const isTop3 = i < 3;
      const rankIcons = ['🥇','🥈','🥉'];

      html += `
        <div class="player-row-modern" style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:10px;background:var(--bg2);border-radius:18px;border:1px solid ${isTop3?'rgba(148,163,184,0.2)':'var(--border2)'};box-shadow:${isTop3?'0 8px 24px rgba(0,0,0,0.25)':'none'};position:relative;overflow:hidden;transition:all .2s;">
          <div style="width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;flex-shrink:0;background:${isTop3?'rgba(148,163,184,0.12)':'var(--bg3)'};font-size:${isTop3?'18':'14'}px;color:${isTop3?'var(--text)':'var(--text3)'};">
            ${rankIcons[i]||(i+1)}
          </div>
          <div style="width:44px;height:44px;border-radius:14px;overflow:hidden;flex-shrink:0;background:var(--bg3);border:1px solid var(--border2);">
            ${photo 
              ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;object-position:top;" onerror="this.style.display='none'">` 
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:${rCol};">${p.name.charAt(0)}</div>`}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:900;color:var(--text);letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
              <span style="font-size:11px;font-weight:800;color:var(--text3);background:var(--gd);padding:3px 8px;border-radius:8px;">${posLabel(pObjS)}</span>
              <span style="font-size:10px;font-weight:800;color:var(--text3);">${formatMoney(mv)}</span>
              <span style="width:2px;height:2px;border-radius:50%;background:var(--text3);opacity:.5;"></span>
              <span style="font-size:10px;font-weight:800;color:var(--text3);">%${attPct} dev.</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:30px;font-weight:900;color:${rCol};line-height:1;letter-spacing:-1.5px;">${r}</div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);margin-top:2px;">${att}/${totalWeeks} maç</div>
          </div>
        </div>`;
    });
    html += `</div>`;

    el.innerHTML = html;
  });
}

// ─── KATILIM ──────────────────────────────────────────────────────────────────
function renderKatilim() {
  const el = document.getElementById('attendContent');
  el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  loadResults(data => {
    if (!data || !data.weeks || !data.weeks.length) { el.innerHTML = '<div class="no-data">Veri yok.</div>'; return; }
    const tw = data.weeks.length;
    const rows = PLAYERS.map(p => {
      const dp = data.players.find(x => x.name === p.name);
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

// ─── MAÇ GEÇMİŞİ ─────────────────────────────────────────────────────────────
function loadMatchHistory() {
  const elAdmin = document.getElementById('matchHistory');
  const elPublic = document.getElementById('publicMatchHistory');
  const render = (data) => {
    let html = '<div class="no-data">Kayıtlı maç bulunamadı.</div>';
    if (data && data.matches && data.matches.length) {
      // İstatistikler özeti
      const totalMatches = data.matches.length;
      const totalGoals = data.matches.reduce((s,m)=> s + (+m.score1||0) + (+m.score2||0), 0);
      const w1 = data.matches.filter(m=>+m.score1>+m.score2).length;
      const w2 = data.matches.filter(m=>+m.score2>+m.score1).length;
      const draws = data.matches.filter(m=>+m.score1===+m.score2).length;
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
        const resultLabel = isDraw ? `<span style="background:#f1f5f9;color:#64748b;font-size:10px;font-weight:800;padding:3px 10px;border-radius:10px;">BERABERLIK</span>` :
          `<span style="background:${win1?'#ecfdf5':'#eff6ff'};color:${win1?'#065f46':'#1e40af'};font-size:10px;font-weight:800;padding:3px 10px;border-radius:10px;">${win1?'⚪ BEYAZ KAZANDI':'🔵 RENKLİ KAZANDI'}</span>`;

        // Golleri takımlara göre ayır (not alanından: "Beyaz: Ahmet,Eren / Renkli: Bugay" formatı yoksa herkesi neutral göster)
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

        // Tüm golleri bir arada göster (takım ayrımı yoksa)
        const allGoalBadges = neutralGoals.length
          ? neutralGoals.map(([n,g])=>goalBadge(n,g,'var(--text)')).join('')
          : [...team1Goals.map(([n,g])=>goalBadge(n,g,'#065f46')), ...team2Goals.map(([n,g])=>goalBadge(n,g,'#1e40af'))].join('');

        return `<div style="background:var(--bg2);border-radius:20px;padding:16px;margin-bottom:14px;box-shadow:var(--sh-card);border:1px solid var(--border);overflow:hidden;position:relative;">
          <!-- Kazanan arkaplan efekti -->
          ${win1?`<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:var(--green);border-radius:4px 0 0 4px;"></div>`:''}
          ${win2?`<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:#3b82f6;border-radius:4px 0 0 4px;"></div>`:''}
          ${isDraw?`<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:#94a3b8;border-radius:4px 0 0 4px;"></div>`:''}

          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-left:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;font-weight:800;color:var(--green);background:var(--gd);padding:4px 10px;border-radius:10px;border:1px solid #10b98130;">${m.week}</span>
              ${resultLabel}
            </div>
            <span style="font-size:10px;color:var(--text3);font-weight:600;">${m.date||''}</span>
          </div>

          <!-- Skor -->
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

          <!-- Alt bilgi: not + goller -->
          ${(m.note || allGoalBadges) ? `
          <div style="background:var(--bg3);border-radius:14px;padding:12px;margin-top:4px;padding-left:8px;">
            ${m.note?`<div style="font-size:12px;color:var(--text2);font-weight:600;margin-bottom:${allGoalBadges?'10':'0'}px;display:flex;align-items:center;gap:6px;">📝 ${m.note}</div>`:''}
            ${allGoalBadges?`<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">⚽ Goller & Asistler</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${allGoalBadges}</div>`:'' }
          </div>` : ''}
        </div>`;
      }).join('');
    }
    if (elAdmin) elAdmin.innerHTML = html;
    if (elPublic) elPublic.innerHTML = html;
  };
  const cached = localStorage.getItem('hs_matches_cache');
  if (cached) { try { _matchesData = JSON.parse(cached); render(_matchesData); } catch(e) {} }
  else {
    if (elAdmin) elAdmin.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
    if (elPublic) elPublic.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  }
  gs({action:'getMatches'}).then(data => {
    const newStr = JSON.stringify(data);
    if (cached !== newStr) { localStorage.setItem('hs_matches_cache', newStr); _matchesData = data; render(data); }
  }).catch(() => {});
}

// ─── GOL INPUT ────────────────────────────────────────────────────────────────
function buildGoalInputs() {
  const c = document.getElementById('goalInputs');
  if (!c) return;
  c.innerHTML = PLAYERS.map(p => {
    const pid = san(p.name);
    return `<div class="goal-row">
      <div class="goal-player"><div class="av" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${p.name.charAt(0)}</div><span class="goal-player-name">${p.name}</span></div>
      <div class="goal-stepper"><button class="step-btn" data-id="gol-${pid}" data-d="-1" onclick="stepGoal(this)">−</button><span class="step-val" id="gol-${pid}">0</span><button class="step-btn" data-id="gol-${pid}" data-d="1" onclick="stepGoal(this)">+</button></div>
      <div class="goal-stepper"><button class="step-btn" data-id="ast-${pid}" data-d="-1" onclick="stepGoal(this)">−</button><span class="step-val" id="ast-${pid}">0</span><button class="step-btn" data-id="ast-${pid}" data-d="1" onclick="stepGoal(this)">+</button></div>
    </div>`;
  }).join('');
}
function stepGoal(btn) {
  const id = btn.dataset.id, delta = parseInt(btn.dataset.d);
  const el = document.getElementById(id);
  if (!el) return;
  const v = Math.max(0, Math.min(20, (parseInt(el.textContent) || 0) + delta));
  el.textContent = v;
  const row = btn.closest('.goal-row');
  if (row) row.classList.toggle('goal-row-active', Array.from(row.querySelectorAll('.step-val')).some(v => parseInt(v.textContent) > 0));
}
function saveMatch() {
  const s1 = document.getElementById('score1').value || '0';
  const s2 = document.getElementById('score2').value || '0';
  const week = document.getElementById('matchWeek').value || getWeekLabel();
  const note = document.getElementById('matchNote').value || '';
  const goals = {};
  PLAYERS.forEach(p => {
    const gEl = document.getElementById(`gol-${san(p.name)}`);
    const aEl = document.getElementById(`ast-${san(p.name)}`);
    const g = gEl ? parseInt(gEl.textContent) || 0 : 0;
    const a = aEl ? parseInt(aEl.textContent) || 0 : 0;
    if (g || a) goals[p.name] = { g, a };
  });
  const btn = event.target;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Kaydediliyor...';
  gs({action:'saveMatch', score1:s1, score2:s2, week, note, goals:JSON.stringify(goals)}).then(d => {
    btn.disabled = false; btn.textContent = 'Veritabanına Kaydet';
    if (d.success) {
      localStorage.removeItem('hs_matches_cache');
      loadMatchHistory();
      document.getElementById('matchNote').value = '';
      PLAYERS.forEach(p => {
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

// ─── TAKTİK ───────────────────────────────────────────────────────────────────
function renderTodayPlayers() {
  const el = document.getElementById('todayPlayers');
  if (!el) return;
  const posEmojis = { KL: '🧤', DEF: '🛡️', OMO: '⚙️', FRV: '⚡' };
  el.innerHTML = PLAYERS.map(p => {
    if (!(p.name in todaySelected)) todaySelected[p.name] = true;
    const on = todaySelected[p.name];
    const pos = normPos(p)[0] || 'OMO';
    return `<button onclick="toggleToday('${p.name}')" id="td-${san(p.name)}"
      style="font-size:14px;font-weight:700;padding:12px 18px;border-radius:24px;cursor:pointer;font-family:inherit;transition:all .2s cubic-bezier(0.4,0,0.2,1);
             border:2px solid ${on?'var(--green)':'var(--border)'};
             background:${on?'var(--green)':'var(--bg2)'};
             color:${on?'#fff':'var(--text2)'};
             box-shadow:${on?'0 8px 16px rgba(16,185,129,.3)':'var(--sh)'}">
      ${posEmojis[pos]||''} ${p.name}
    </button>`;
  }).join('');
}
function toggleToday(name) {
  todaySelected[name] = !todaySelected[name];
  const btn = document.getElementById(`td-${san(name)}`);
  if (!btn) return;
  const on = todaySelected[name];
  btn.style.background = on ? 'var(--green)' : 'var(--bg2)';
  btn.style.color = on ? '#fff' : 'var(--text2)';
  btn.style.borderColor = on ? 'var(--green)' : 'var(--border)';
  btn.style.boxShadow = on ? '0 8px 16px rgba(16,185,129,.3)' : 'var(--sh)';
}
function selectAllPlayers() { PLAYERS.forEach(p => todaySelected[p.name] = true); renderTodayPlayers(); }
function clearAllPlayers() { PLAYERS.forEach(p => todaySelected[p.name] = false); renderTodayPlayers(); }
function buildTeams() {
  document.getElementById('noDataTakim').style.display = 'none';
  document.getElementById('teamResult').innerHTML = '';
  const selected = PLAYERS.filter(p => todaySelected[p.name] !== false);
  if (selected.length < 4) { document.getElementById('noDataTakim').style.display = 'block'; return; }
  if (!resultData) { loadResults(data => { if (data) buildTeamsWithData(selected); else { document.getElementById('noDataTakim').style.display = 'block'; } }); return; }
  buildTeamsWithData(selected);
}
function buildTeamsWithData(selected) {
  const players = selected.map(pl => {
    const pos = normPos(pl)[0] || 'OMO';
    const pData = resultData && resultData.players ? resultData.players.find(x => x.name === pl.name) : null;
    const avg = pData ? posRating(pData, pl) || pData.genelOrt || 5 : 5;
    
    const kritAvg = (c) => {
      if (!pData || !pData.weeklyKriterler) return 0;
      let vals = [];
      Object.values(pData.weeklyKriterler).forEach(wk => {
        if (wk && wk[c] != null) vals.push(+wk[c]);
      });
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    };
    
    return { 
      name: pl.name, 
      avg, 
      pos, 
      pobj: pl,
      savunma: kritAvg('Savunma'),
      sut: kritAvg('Sut'),
      pas: kritAvg('Pas'),
      fizik: kritAvg('Hiz / Kondisyon'),
      topKontrol: kritAvg('Top Kontrolü'),
      zeka: kritAvg('Oyun Zekası')
    };
  });

  const totalPlayers = players.length;
  const attempts = 20000;
  let bestDiff = Infinity;
  let bestT1 = [], bestT2 = [];

  for (let i = 0; i < attempts; i++) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const splitIndex = Math.ceil(totalPlayers / 2);
    const t1 = shuffled.slice(0, splitIndex);
    const t2 = shuffled.slice(splitIndex);

    const score1 = calculateTeamScore(t1);
    const score2 = calculateTeamScore(t2);
    const diff = Math.abs(score1 - score2);

    const posDiff = calculatePositionBalance(t1, t2);
    const totalDiff = diff + (posDiff * 0.5);

    if (totalDiff < bestDiff) {
      bestDiff = totalDiff;
      bestT1 = [...t1];
      bestT2 = [...t2];
    }
  }

  renderTeams(bestT1, bestT2);
}

function calculateTeamScore(team) {
  if (!team.length) return 0;
  
  let totalAvg = 0;
  let totalSavunma = 0;
  let totalSut = 0;
  let totalPas = 0;
  let totalFizik = 0;
  let totalTopKontrol = 0;
  let totalZeka = 0;

  team.forEach(p => {
    totalAvg += p.avg || 5;
    totalSavunma += p.savunma || 5;
    totalSut += p.sut || 5;
    totalPas += p.pas || 5;
    totalFizik += p.fizik || 5;
    totalTopKontrol += p.topKontrol || 5;
    totalZeka += p.zeka || 5;
  });

  const count = team.length;
  return (
    (totalAvg / count * 3) +
    (totalSavunma / count) +
    (totalSut / count) +
    (totalPas / count) +
    (totalFizik / count) +
    (totalTopKontrol / count) +
    (totalZeka / count)
  );
}

function calculatePositionBalance(t1, t2) {
  const countPos = (team, pos) => team.filter(p => p.pos === pos).length;
  
  let diff = 0;
  diff += Math.abs(countPos(t1, 'KL') - countPos(t2, 'KL')) * 3;
  diff += Math.abs(countPos(t1, 'DEF') - countPos(t2, 'DEF')) * 2;
  diff += Math.abs(countPos(t1, 'OMO') - countPos(t2, 'OMO')) * 1.5;
  diff += Math.abs(countPos(t1, 'FRV') - countPos(t2, 'FRV')) * 1.5;
  
  return diff;
}
function shuffleTeams() {
  const selected = PLAYERS.filter(p => todaySelected[p.name] !== false);
  if (selected.length < 4) { document.getElementById('noDataTakim').style.display = 'block'; return; }
  document.getElementById('noDataTakim').style.display = 'none';
  const players = selected.map(pl => {
    const pData = resultData && resultData.players ? resultData.players.find(x => x.name === pl.name) : null;
    return { name: pl.name, avg: pData ? posRating(pData, pl) || pData.genelOrt || 5 : 5, pos: normPos(pl)[0] || 'OMO', pobj: pl };
  });
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  const mid = Math.ceil(players.length / 2);
  renderTeams(players.slice(0, mid), players.slice(mid));
}
function renderTeams(t1, t2) {
  const avg1 = t1.reduce((a, p) => a + p.avg, 0) / t1.length;
  const avg2 = t2.reduce((a, p) => a + p.avg, 0) / t2.length;
  const diff = Math.abs(avg1 - avg2);
  const posLabels = { KL: 'Kaleci', DEF: 'Defans', OMO: 'Orta', FRV: 'Forvet' };
  
  const getRatingColor = (r) => r >= 85 ? '#fbbf24' : r >= 75 ? '#94a3b8' : r >= 65 ? '#d97706' : '#3b82f6';
  
  const sortByRating = (t) => [...t].sort((a, b) => (b.avg || 0) - (a.avg || 0));
  const sortedT1 = sortByRating(t1);
  const sortedT2 = sortByRating(t2);
  
  document.getElementById('balanceInfo').innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <span style="font-size:12px;font-weight:900;padding:8px 14px;background:${diff<0.3?'rgba(16,185,129,0.12)':diff<0.6?'rgba(251,191,36,0.12)':'rgba(239,68,68,0.12)'};border:1px solid ${diff<0.3?'rgba(16,185,129,0.25)':diff<0.6?'rgba(251,191,36,0.25)':'rgba(239,68,68,0.25)'};border-radius:16px;">${diff<0.3?'🟢 Mükemmel':diff<0.6?'🟡 Çok Dengeli':'🔴 Karıştır'} · Fark: ${(diff*10).toFixed(1)}</span>
    </div>`;
  
  const list = (t) => t.map(p => {
    const r = Math.min(99, Math.round((p.avg || 0) * 10));
    const photo = getPlayerPhoto(p.name);
    const rCol = getRatingColor(r);
    return `
      <div class="tplayer-minimal" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:var(--bg3);margin-bottom:8px;">
        <div style="width:34px;height:34px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg2);">
          ${photo 
            ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;object-position:top;">` 
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:${rCol};">${p.name.charAt(0)}</div>`}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:900;color:var(--text);letter-spacing:-0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
          <div style="font-size:10px;font-weight:800;color:var(--text3);opacity:.8;">${posLabels[p.pos] || ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:900;color:${rCol};line-height:1;letter-spacing:-0.5px;">${r}</div>
        </div>
      </div>`;
  }).join('');
  
  document.getElementById('teamResult').innerHTML = `
    <div class="tgrid-minimal" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div class="tbox-minimal" style="border-radius:20px;padding:14px;border:1px solid var(--border2);background:var(--bg2);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">⚪</span>
            <div>
              <div style="font-size:11px;font-weight:900;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Beyaz</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:900;color:#94a3b8;line-height:1;">${(avg1*10).toFixed(0)}</div>
          </div>
        </div>
        ${list(sortedT1)}
      </div>
      <div class="tbox-minimal" style="border-radius:20px;padding:14px;border:1px solid rgba(59,130,246,0.2);background:linear-gradient(180deg,rgba(59,130,246,0.06) 0%,var(--bg2) 100%);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">🔵</span>
            <div>
              <div style="font-size:11px;font-weight:900;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;">Renkli</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:900;color:#3b82f6;line-height:1;">${(avg2*10).toFixed(0)}</div>
          </div>
        </div>
        ${list(sortedT2)}
      </div>
    </div>`;
}

// ─── OYUNCU LİSTESİ (ADMİN) ──────────────────────────────────────────────────
function renderPlayerList() {
  const el = document.getElementById('playerList');
  if (!el) return;
  el.innerHTML = PLAYERS.map((p, i) => {
    const curPos = normPos(p)[0];
    const chip = curPos ? `<span style="font-size:11px;font-weight:800;padding:6px 12px;border-radius:12px;background:var(--text);color:var(--bg);">${POS[curPos]}</span>` : `<span style="font-size:11px;color:var(--text3)">—</span>`;
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
function selectPos(i, key) {
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
function confirmPos(i) {
  const key = _pendingPos[i];
  if (!key) { closePosDropdown(i); return; }
  PLAYERS[i].pos = [key]; savePlayers();
  gs({action:'saveMevki', name:PLAYERS[i].name, mevki:JSON.stringify([key])}).catch(e => console.warn('Mevki kaydedilemedi:', e));
  const chipsEl = document.getElementById(`poschips-${i}`);
  if (chipsEl) chipsEl.innerHTML = `<span style="font-size:11px;font-weight:800;padding:6px 12px;border-radius:12px;background:var(--text);color:var(--bg);">${POS[key]}</span>`;
  delete _pendingPos[i]; closePosDropdown(i); showToast('Mevki güncellendi!');
}
function togglePosDropdown(i) {
  PLAYERS.forEach((_, j) => { if (j !== i) closePosDropdown(j); });
  const d = document.getElementById(`posdrop-${i}`);
  if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
}
function closePosDropdown(i) {
  const d = document.getElementById(`posdrop-${i}`);
  if (d) d.style.display = 'none';
  delete _pendingPos[i];
}
function addPlayer() {
  const name = document.getElementById('newPlayerName').value.trim();
  if (!name) return;
  if (PLAYERS.find(p => p.name.toLowerCase() === name.toLowerCase())) { showToast('Bu oyuncu zaten var!', true); return; }
  PLAYERS.push({name, pos:['OMO'], photo:''});
  savePlayers(); renderPlayerList(); initSelects(); buildGoalInputs();
  document.getElementById('newPlayerName').value = '';
  showToast(`${name} ekleniyor...`);
  gs({action:'savePlayer', name, pos:'["OMO"]'}).then(d => { if(d.success) showToast(`${name} başarıyla eklendi! ✓`); }).catch(() => showToast(`${name} eklendi ama Sheets'e yazılamadı.`, true));
}
function removePlayer(i) {
  showConfirm(`${PLAYERS[i].name} isimli oyuncuyu tamamen silmek istediğinize emin misiniz?`, () => {
    const deletedName = PLAYERS[i].name;
    PLAYERS.splice(i, 1);
    savePlayers(); renderPlayerList(); initSelects(); buildGoalInputs();
    showToast(`${deletedName} siliniyor...`);
    gs({action:'deletePlayer', name:deletedName}).then(d => { if(d.success) showToast(`${deletedName} başarıyla silindi. ✓`); }).catch(() => {});
  });
}

// ─── PROFİL MODAL ────────────────────────────────────────────────────────────
function openProfile(p, data) {
  currentProfileName = p.name;
  const pObjP = PLAYERS.find(pl => pl.name === p.name) || { pos: ['OMO'] };
  const wAvg = posRating(p, pObjP);
  const rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : (p.genelOrt ? Math.round(p.genelOrt * 10) : 0);
  const marketVal = calcMarketValue(p, data);
  const sdev = calcStdDev(p);
  const styles = getPlayStyles(p);
  const posArr = normPos(pObjP);
  const posKey = posArr[0] || 'OMO';
  const cls = cardClass(rating);
  const col = ratingColor(rating);

  // Kriter ortalamalar
  const kOrt = {};
  CRITERIA.forEach(c => {
    let vals = [];
    if (p.weeklyKriterler) Object.values(p.weeklyKriterler).forEach(wk => { if (wk && wk[c] != null) vals.push(+wk[c]); });
    kOrt[c] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  // Hero gradient renkleri
  const heroGrad = {
    'fc-gold': 'linear-gradient(160deg,#1a0a00 0%,#7c3200 30%,#d97706 55%,#7c3200 80%,#1a0a00 100%)',
    'fc-silver': 'linear-gradient(160deg,#0f172a 0%,#334155 30%,#94a3b8 55%,#334155 80%,#0f172a 100%)',
    'fc-bronze': 'linear-gradient(160deg,#1c0700 0%,#6b3300 30%,#b45309 55%,#6b3300 80%,#1c0700 100%)',
    'fc-normal': 'linear-gradient(160deg,#0a1628 0%,#1e3a8a 30%,#2563eb 55%,#1e3a8a 80%,#0a1628 100%)'
  }[cls] || 'linear-gradient(160deg,#0a1628,#1e3a8a)';

  // Form trend mini — son 5 hafta (bar chart)
  const weeks = data && data.weeks ? data.weeks : [];
  const last5 = weeks.slice(-5);
  const formBars = last5.map(w => {
    const wi = weeks.indexOf(w);
    const v = p.weeklyGenels[wi];
    const r10 = v !== null ? Math.min(99, Math.round(v * 10)) : null;
    const h = r10 !== null ? Math.max(8, Math.round(r10 / 99 * 36)) : 4;
    const barCol = r10 !== null ? (r10 >= 80 ? '#f59e0b' : r10 >= 65 ? col.text : '#64748b') : '#374151';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;">
      <div style="font-size:8px;font-weight:700;color:${r10!==null?barCol:'#4b5563'};line-height:1;">${r10 !== null ? r10 : '—'}</div>
      <div style="width:100%;max-width:18px;height:${h}px;background:${barCol};border-radius:2px 2px 0 0;opacity:${r10!==null?0.9:0.3};transition:height .3s;"></div>
      <div style="font-size:7px;color:rgba(255,255,255,0.4);font-weight:600;white-space:nowrap;">${w.replace(/\d{4}-/,'')}</div>
    </div>`;
  }).join('');

  // Fotoğraf
  const photoUrl = getPlayerPhoto(p.name);

  // Katılım sayısı
  const attendCount = p.weeklyGenels.filter(v => v != null).length;
  const totalWeeks = weeks.length;
  const attendPct = totalWeeks ? Math.round(attendCount / totalWeeks * 100) : 0;

  // En iyi/en zayıf kriter
  const validKrits = CRITERIA.filter(c => kOrt[c] !== null);
  const bestCrit = validKrits.length ? validKrits.reduce((a,b)=>kOrt[a]>=kOrt[b]?a:b) : null;
  const worstCrit = validKrits.length ? validKrits.reduce((a,b)=>kOrt[a]<=kOrt[b]?a:b) : null;
  const critLabelMap = {'Pas':'Pas','Sut':'Şut','Dribling':'Dribling','Savunma':'Savunma','Hiz / Kondisyon':'Hız','Fizik':'Fizik','Takim Oyunu':'Takım'};

  // Radar SVG — ince, şık
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

  // HERO HTML
  document.getElementById('profileHero').innerHTML = `
    <div style="background:${heroGrad};position:absolute;inset:0;"></div>
    <!-- Grain texture overlay -->
    <div style="position:absolute;inset:0;opacity:0.04;background-image:url('data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"200\\" height=\\"200\\"><filter id=\\"n\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.9\\" numOctaves=\\"4\\"/></filter><rect width=\\"200\\" height=\\"200\\" filter=\\"url(%23n)\\"/></svg>');"></div>
    <!-- Rating büyük sol üst -->
    <div style="position:absolute;top:18px;left:20px;z-index:5;">
      <div style="font-size:52px;font-weight:900;color:${col.text};line-height:1;letter-spacing:-2px;text-shadow:0 4px 12px rgba(0,0,0,0.5);">${rating}</div>
      <div style="font-size:10px;font-weight:800;color:${col.text};opacity:0.7;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">${POS[posKey]||posKey}</div>
    </div>
    <!-- Fotoğraf sağda — full height -->
    <div style="position:absolute;right:0;bottom:0;height:175px;width:130px;z-index:3;overflow:hidden;">
      ${photoUrl
        ? `<img src="${photoUrl}" style="position:absolute;bottom:0;right:0;height:175px;width:auto;max-width:160px;object-fit:contain;object-position:bottom right;filter:drop-shadow(-6px 0 16px rgba(0,0,0,0.5));" onerror="this.style.display='none'">`
        : `<div style="position:absolute;bottom:20px;right:20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:${col.text};border:2px solid rgba(255,255,255,0.2);">${p.name.charAt(0)}</div>`}
    </div>
    <!-- Alt bilgi bölümü -->
    <div style="position:absolute;bottom:0;left:0;right:0;z-index:4;padding:14px 18px 16px;background:linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 100%);">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.5);">${p.name}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:800;color:${col.text};background:rgba(0,0,0,0.3);padding:3px 10px;border-radius:20px;border:1px solid ${col.text}33;letter-spacing:.5px;">💶 ${formatMoney(marketVal)}</span>
        ${styles.slice(0,3).map(s=>`<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.1);padding:3px 9px;border-radius:20px;border:1px solid rgba(255,255,255,0.15);">${s.icon} ${s.name}</span>`).join('')}
      </div>
    </div>
    <!-- Form bar chart — sağ alt, fotoğrafın üstünde -->
    ${last5.length ? `<div style="position:absolute;left:20px;bottom:62px;display:flex;align-items:flex-end;gap:4px;z-index:5;width:120px;">${formBars}</div>` : ''}
  `;

  // BODY HTML
  document.getElementById('modalBody').innerHTML = `
    <!-- Hızlı stat satırı -->
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

    <!-- Güçlü/zayıf yön -->
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

    <!-- Radar + Kriter barları yan yana -->
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">
      <!-- Radar -->
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
      <!-- Kriter dikey barlar -->
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

    <!-- Haftalık performans mini tablo -->
    ${last5.length ? `<div style="background:var(--bg3);border-radius:16px;padding:12px;border:1px solid var(--border2);">
      <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">📅 Son ${last5.length} Hafta</div>
      <div style="display:flex;gap:6px;">
        ${last5.map(w => {
          const wi = weeks.indexOf(w);
          const v = p.weeklyGenels[wi];
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
  document.getElementById('modalBg').classList.add('open');
}
function shareProfile() {
  const pName = currentProfileName;
  if(!pName) return;
  const pObj = PLAYERS.find(pl => pl.name === pName) || { pos: ['OMO'] };
  let rating = '—';
  const pData = resultData && resultData.players ? resultData.players.find(x => x.name === pName) : null;
  if(pData) { const wAvg = posRating(pData, pObj); rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : (pData.genelOrt ? Math.round(pData.genelOrt * 10) : '—'); }
  const shareText = `⚽ Halı Saha Pro\n\nOyuncu: ${pName}\nMevki: ${posLabel(pObj)}\n⭐ Rating: ${rating}\n\nİstatistiklerine göz at!`;
  if (navigator.share) { navigator.share({title:`${pName} - Oyuncu Profili`, text:shareText, url:window.location.href}).catch(console.error); }
  else { navigator.clipboard.writeText(shareText).then(() => showToast('Profil bilgileri kopyalandı!')); }
}
function closeModal(e, force) {
  if (force || (e && e.target === document.getElementById('modalBg'))) document.getElementById('modalBg').classList.remove('open');
}

// ─── ADMİN GİRİŞ ─────────────────────────────────────────────────────────────
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCKOUT_MS   = 10 * 60 * 1000;
function getAdminLock() { try { return JSON.parse(localStorage.getItem('hs_admin_lock') || '{}'); } catch(e) { return {}; } }
function setAdminLock(data) { localStorage.setItem('hs_admin_lock', JSON.stringify(data)); }
function isAdminLocked() { const lock = getAdminLock(); if (!lock.until) return false; if (Date.now() < lock.until) return true; setAdminLock({}); return false; }
function recordFailedAttempt() { const lock = getAdminLock(); const attempts = (lock.attempts || 0) + 1; if (attempts >= ADMIN_MAX_ATTEMPTS) { setAdminLock({ attempts, until: Date.now() + ADMIN_LOCKOUT_MS }); return attempts; } setAdminLock({ attempts }); return attempts; }
function clearAdminLock() { setAdminLock({}); }
function isAdminLoggedIn() { try { const d = JSON.parse(sessionStorage.getItem('hs_admin_session') || '{}'); if (!d.token || !d.expires) return false; if (Date.now() > d.expires) { sessionStorage.removeItem('hs_admin_session'); return false; } return true; } catch(e) { return false; } }
function setAdminSession() { const token = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('hs_admin_session', JSON.stringify({ token, expires: Date.now() + 2 * 60 * 60 * 1000 })); }
function tryAdmin(btnElement) {
  if (isAdminLoggedIn()) { switchMainScreen('admin', btnElement); setAdminTab('mac', document.querySelector('#screen-admin .sub-nb')); }
  else {
    if (isAdminLocked()) { const lock = getAdminLock(); showToast(`Çok fazla hatalı deneme. ${Math.ceil((lock.until - Date.now()) / 60000)} dakika bekleyin.`, true); return; }
    document.getElementById('adminPinInput').value = '';
    document.getElementById('pinBg').classList.add('open');
    document.getElementById('pinError').textContent = '';
    setTimeout(() => document.getElementById('adminPinInput').focus(), 100);
  }
}
function checkPin() {
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
      switchMainScreen('admin', adminBtn);
      setAdminTab('mac', document.querySelector('#screen-admin .sub-nb'));
    } else {
      const attempts = recordFailedAttempt();
      document.getElementById('adminPinInput').value = '';
      document.getElementById('adminPinInput').focus();
      document.getElementById('pinError').textContent = isAdminLocked() ? `${ADMIN_MAX_ATTEMPTS} hatalı deneme — 10 dakika kilitlendi!` : `Hatalı PIN. (${attempts}/${ADMIN_MAX_ATTEMPTS} deneme)`;
    }
  }).catch(() => { btn.disabled = false; btn.textContent = 'Doğrula'; document.getElementById('pinError').textContent = 'Bağlantı hatası, tekrar deneyin.'; });
}
function logoutAdmin() { sessionStorage.removeItem('hs_admin_session'); showToast('Güvenli çıkış yapıldı.'); document.querySelectorAll('.bnav-item')[0].click(); }

// ─── YAYIN ────────────────────────────────────────────────────────────────────
function getYtEmbedUrl(input) {
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
function loadVideos(forceRefresh) {
  if (_videosData && !forceRefresh) { renderVideos(_videosData); return; }
  const tabs = document.getElementById('vWeekTabs');
  if (tabs) tabs.innerHTML = '<div style="color:var(--text3);font-size:13px;font-weight:600;padding:8px 0;"><span class="spin"></span>Yükleniyor...</div>';
  gs({action:'getVideos'}).then(data => { _videosData = data.videos || []; renderVideos(_videosData); }).catch(() => { _videosData = []; renderVideos([]); });
}
function renderVideos(videos) {
  const tabs = document.getElementById('vWeekTabs'), noData = document.getElementById('vNoData'), allVideos = document.getElementById('vAllVideos');
  if (!videos || !videos.length) { if (tabs) tabs.innerHTML = ''; if (noData) noData.style.display = 'block'; if (allVideos) allVideos.innerHTML = ''; setYtPlayer(null); return; }
  if (noData) noData.style.display = 'none';
  const sorted = [...videos].sort((a, b) => b.week.localeCompare(a.week));
  if (tabs) tabs.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;overflow-x:auto;padding:2px 2px 8px 2px;">
      ${sorted.map((v, i) => `
        <button class="vwtab-minimal ${i===0?'active':''}" 
                onclick="selectVideoWeek('${v.week}',this)" 
                style="flex:0 0 auto;padding:8px 14px;border-radius:14px;border:none;background:var(--bg2);color:var(--text3);font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;transition:all .2s;border:1px solid var(--border2);">
          ${v.week}
        </button>
      `).join('')}
    </div>`;
  if (allVideos) {
    allVideos.innerHTML = sorted.length > 1 ? sorted.map(v => {
      const vid = ytVideoId(v.url);
      const thumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null;
      return `<div onclick="selectVideoWeekByUrl('${v.week}','${v.url}')" 
                   class="video-list-item-minimal"
                   style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg2);border-radius:16px;margin-bottom:8px;cursor:pointer;border:1px solid var(--border2);transition:all .2s;"
                   onmouseover="this.style.borderColor='rgba(59,130,246,0.3)';this.style.transform='translateX(2px)';"
                   onmouseout="this.style.borderColor='var(--border2)';this.style.transform='';">
        ${thumb?`<img src="${thumb}" style="width:72px;height:46px;border-radius:12px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`:
                  `<div style="width:72px;height:46px;border-radius:12px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📺</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:900;margin-bottom:3px;letter-spacing:-0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.title||v.week+' Maç Yayını'}</div>
          <div style="font-size:11px;color:var(--text3);font-weight:800;">${v.week}</div>
        </div>
        <div style="width:28px;height:28px;border-radius:10px;background:var(--gd);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">▶</div>
      </div>`;
    }).join('') : '';
  }
  if (sorted.length) selectVideoWeekByUrl(sorted[0].week, sorted[0].url, sorted[0].title);
}
function selectVideoWeek(week, btn) {
  document.querySelectorAll('.vwtab-minimal').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'var(--bg2)';
    b.style.color = 'var(--text3)';
    b.style.borderColor = 'var(--border2)';
  });
  if (btn) {
    btn.classList.add('active');
    btn.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'transparent';
  }
  if (!_videosData) return;
  const v = _videosData.find(x => x.week === week);
  if (v) setYtPlayer(v.url, v.week, v.title);
}
function selectVideoWeekByUrl(week, url, title) {
  document.querySelectorAll('.vwtab-minimal').forEach(b => { 
    const isActive = b.textContent.trim() === week;
    b.classList.toggle('active', isActive);
    b.style.background = isActive ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'var(--bg2)';
    b.style.color = isActive ? '#fff' : 'var(--text3)';
    b.style.borderColor = isActive ? 'transparent' : 'var(--border2)';
  });
  setYtPlayer(url, week, title);
}
function setYtPlayer(url, week, title) {
  _currentVideoWeek = week;
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
function loadAdminVideos() {
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
function adminSaveVideo() {
  const week = document.getElementById('adminVideoWeek').value.trim();
  const url  = document.getElementById('adminVideoUrl').value.trim();
  const title = document.getElementById('adminVideoTitle').value.trim();
  if (!week || !url) { showToast('Hafta ve URL zorunludur.', true); return; }
  if (!ytVideoId(url)) { showToast('Geçersiz YouTube linki veya embed kodu!', true); return; }
  const btn = document.getElementById('adminSaveVideoBtn');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  gs({action:'saveVideo', week, url, title: title || (week + ' Maç Yayını')}).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) { showToast('Yayın kaydedildi! ✓'); document.getElementById('adminVideoUrl').value = ''; document.getElementById('adminVideoTitle').value = ''; _videosData = null; }
    else { showToast('Kayıt hatası.', true); }
  }).catch(() => { btn.disabled = false; btn.textContent = '💾 Kaydet'; showToast('Bağlantı hatası.', true); });
}

// ─── HAFFA YÖNETİMİ ────────────────────────────────────────────────────────────
function loadManualWeek(cb) {
  const cached = localStorage.getItem('hs_manual_week');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && data.week) {
        _manualWeek = data.week;
      }
    } catch(e) {}
  }
  gs({action:'getManualWeek'}).then(d => {
    if (d && d.week) {
      _manualWeek = d.week;
      localStorage.setItem('hs_manual_week', JSON.stringify({ week: _manualWeek }));
    }
    if (cb) cb();
  }).catch(() => { if (cb) cb(); });
}

function saveCurrentWeek() {
  const newWeek = document.getElementById('newWeekInput').value.trim();
  if (!newWeek) { showToast('Hafta boş olamaz!', true); return; }
  const btn = event.target;
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  gs({action:'saveManualWeek', week: newWeek}).then(d => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    if (d.success) {
      _manualWeek = newWeek;
      localStorage.setItem('hs_manual_week', JSON.stringify({ week: _manualWeek }));
      
      // Tüm ilgili önbellekleri temizle
      localStorage.removeItem('hs_today_players_cache');
      localStorage.removeItem('hs_hakem_cache');
      localStorage.removeItem('hs_results_cache');
      localStorage.removeItem('hs_matches_cache');
      
      document.getElementById('currentWeekDisplay').textContent = _manualWeek;
      document.getElementById('matchWeek').value = _manualWeek;
      showToast('Hafta başarıyla güncellendi! ✓');
    } else {
      showToast('Kaydetme hatası.', true);
    }
  }).catch(() => {
    btn.disabled = false; btn.textContent = '💾 Kaydet';
    showToast('Bağlantı hatası.', true);
  });
}

function resetWeekToAuto() {
  showConfirm('Otomatik haftaya dönmek istediğinize emin misiniz? (Yalnızca bu oturum için)', () => {
    _manualWeek = null;
    
    // Tüm ilgili önbellekleri temizle
    localStorage.removeItem('hs_today_players_cache');
    localStorage.removeItem('hs_hakem_cache');
    localStorage.removeItem('hs_results_cache');
    localStorage.removeItem('hs_matches_cache');
    
    const autoWeek = getAutoWeekLabel();
    document.getElementById('currentWeekDisplay').textContent = autoWeek + ' (Otomatik)';
    document.getElementById('matchWeek').value = autoWeek;
    showToast('Otomatik hafta aktif!');
  });
}

function loadHaftaTab() {
  const displayEl = document.getElementById('currentWeekDisplay');
  const inputEl = document.getElementById('newWeekInput');
  if (displayEl) {
    displayEl.textContent = _manualWeek ? _manualWeek : getAutoWeekLabel() + ' (Otomatik)';
  }
  if (inputEl && !inputEl.value) {
    inputEl.value = _manualWeek || getAutoWeekLabel();
  }
}
