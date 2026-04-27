import { CRITERIA, CDISP } from './config.js';
import { lGet, lSet, lRem } from './storage.js';
import { state } from './state.js';
import { escHtml, san, posShort, scoreColor, showToast, showConfirm, getWeekLabel, normPos } from './utils.js';
import { gs } from './api.js';
import { loadResults } from './stats.js';

function byId(id) {
  return document.getElementById(id);
}

export function savePlayers() {
  lSet('hs_players', JSON.stringify(state.players));
}

export function loadPlayersFromSheets(cb, onRefresh) {
  const cached = lGet('hs_players_cache');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && data.players) {
        state.players = [];
        data.players.forEach(sp => {
          if (!state.players.find(p => p.name === sp.name)) {
            state.players.push({ name: sp.name, pos: sp.pos || ['OMO'], photo: sp.photo || '' });
          }
        });
        savePlayers();
      }
    } catch(e) {}
    if (cb) {
      const currentCb = cb;
      cb = null;
      currentCb();
    }
  }

  gs({action:'getPlayers'}).then(data => {
    if (data && data.players) {
      lSet('hs_players_cache', JSON.stringify(data));
      state.players = [];
      data.players.forEach(sp => {
        state.players.push({ name: sp.name, pos: sp.pos || ['OMO'], photo: sp.photo || '' });
      });
      savePlayers();
      if (onRefresh) onRefresh();
    } else if (data && Array.isArray(data.players) && data.players.length === 0) {
      lSet('hs_players_cache', JSON.stringify({players: []}));
      state.players = [];
      savePlayers();
      if (onRefresh) onRefresh();
    }
    if (cb) cb();
  }).catch(() => { if (cb) cb(); });
}

export function loadMevkilerFromSheets(cb) {
  const cached = lGet('hs_mevkiler_cache');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data && data.mevkiler) {
        state.players.forEach(p => { if (data.mevkiler[p.name]) p.pos = data.mevkiler[p.name]; });
      }
    } catch(e) {}
    if (cb) {
      const currentCb = cb;
      cb = null;
      currentCb();
    }
  }
  gs({action:'getMevkiler'}).then(data => {
    if (data && data.mevkiler) {
      lSet('hs_mevkiler_cache', JSON.stringify(data));
      state.players.forEach(p => { if (data.mevkiler[p.name]) p.pos = data.mevkiler[p.name]; });
      savePlayers();
    }
    if (cb) cb();
  }).catch(() => { if (cb) cb(); });
}

export function initSelects() {
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
    sel.innerHTML = `<option value="">${label}</option>` + state.players.map(p => `<option value="${escHtml(p.name)}">${escHtml(p.name)}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

export function checkIdentityLock() {
  const myIdentity = lGet('hs_my_identity');
  if (myIdentity) {
    const raterSel = byId('raterSelect');
    const changeBtn = byId('changeIdentityBtn');
    const lockedMsg = byId('identityLockedMsg');
    if (!raterSel) return;
    raterSel.value = myIdentity;
    raterSel.disabled = true;
    if (changeBtn) changeBtn.style.display = 'inline-block';
    if (lockedMsg) lockedMsg.style.display = 'block';
    onRaterChange(true);
  }
}

export function resetIdentity() {
  showConfirm('Kimliğinizi değiştirmek istediğinize emin misiniz?', () => {
    lRem('hs_my_identity');
    const raterSel = byId('raterSelect');
    const changeBtn = byId('changeIdentityBtn');
    const lockedMsg = byId('identityLockedMsg');
    if (!raterSel) return;
    raterSel.disabled = false; raterSel.value = '';
    if (changeBtn) changeBtn.style.display = 'none';
    if (lockedMsg) lockedMsg.style.display = 'none';
    onRaterChange();
  });
}

export function onRaterChange(isInit = false) {
  const raterSel = byId('raterSelect');
  const wrap = byId('progressWrap');
  const area = byId('submitArea');
  const cards = byId('ratingCards');
  const changeBtn = byId('changeIdentityBtn');
  const lockedMsg = byId('identityLockedMsg');
  if (!raterSel || !wrap || !area || !cards) return;
  state.currentRater = raterSel.value;
  state.currentScores = {}; state.completedCards = {};
  if (!state.currentRater) {
    cards.style.display = 'none'; wrap.style.display = 'none'; area.style.display = 'none'; return;
  }
  if (!isInit) {
    lSet('hs_my_identity', state.currentRater);
    raterSel.disabled = true;
    if (changeBtn) changeBtn.style.display = 'inline-block';
    if (lockedMsg) lockedMsg.style.display = 'block';
  }
  wrap.style.display = 'block'; area.style.display = 'block';
  buildCards();
}

export function buildCards() {
  const c = byId('ratingCards');
  if (!c) return;
  c.innerHTML = '<div class="no-data"><span class="spin"></span>Bu haftaki aktif oyuncular yükleniyor...</div>';
  c.style.display = 'block';
  state.currentScores = {}; state.completedCards = {};

  const week = getWeekLabel();
  const cached = lGet('hs_today_players_cache');
  let cachedWeek = null, cachedList = null;
  if (cached) {
    try { const cd = JSON.parse(cached); cachedWeek = cd.week; cachedList = cd.players; } catch(e) {}
  }
  const hakemCached = lGet('hs_hakem_cache');
  let cachedHakemWeek = null, cachedHakemName = '';
  if (hakemCached) {
    try { const hd = JSON.parse(hakemCached); cachedHakemWeek = hd.week; cachedHakemName = hd.hakem || ''; } catch(e) {}
  }

  const renderWithData = (activePlayers, hakemName) => {
    const isHakem = (hakemName && state.currentRater === hakemName);

    if (!isHakem && activePlayers && activePlayers.length && !activePlayers.includes(state.currentRater)) {
      c.innerHTML = `<div class="no-data" style="border-color:#ff3b30;color:#ff3b30;background:rgba(255,59,48,0.05);">
        ⛔ Bu hafta (${week}) maça gelmediğin olarak işaretlendin.<br>
        <span style="font-size:12px;color:var(--text3);display:block;margin-top:8px;">Yönetici ile iletişime geç.</span>
      </div>`;
      const submitArea = byId('submitArea');
      const progressWrap = byId('progressWrap');
      if (submitArea) submitArea.style.display = 'none';
      if (progressWrap) progressWrap.style.display = 'none';
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
      const submitArea = byId('submitArea');
      const progressWrap = byId('progressWrap');
      if (submitArea) submitArea.style.display = 'none';
      if (progressWrap) progressWrap.style.display = 'none';
    };

    c.innerHTML = '<div class="no-data"><span class="spin"></span>Oylama durumu kontrol ediliyor...</div>';
    gs({ action: 'checkVoted', week, rater: state.currentRater }).then(vd => {
      if (vd.voted) { showVotedBlock(); return; }
      renderCards(activePlayers, hakemName, isHakem);
    }).catch(() => renderCards(activePlayers, hakemName, isHakem));
  };

  const renderCards = (activePlayers, hakemName, isHakem) => {
    const submitArea = byId('submitArea');
    const progressWrap = byId('progressWrap');
    if (submitArea) submitArea.style.display = 'block';
    if (progressWrap) progressWrap.style.display = 'block';

    let hakemBanner = '';
    if (isHakem) {
      hakemBanner = `<div style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;border-radius:16px;padding:14px 16px;margin-bottom:16px;">
        <span style="font-size:28px;">🟡</span>
        <div><div style="font-size:14px;font-weight:800;color:#92400e;">Bu Hafta Hakemsin!</div><div style="font-size:12px;color:#b45309;margin-top:2px;font-weight:600;">Oy kullanabilirsin ama sana oy verilemez.</div></div>
      </div>`;
    }

    const list = (activePlayers && activePlayers.length)
      ? state.players.filter(p => activePlayers.includes(p.name) && p.name !== state.currentRater && p.name !== hakemName)
      : state.players.filter(p => p.name !== state.currentRater && p.name !== hakemName);

    c.innerHTML = hakemBanner;
    list.forEach(p => {
      const pid = san(p.name);
      const card = document.createElement('div');
      card.className = 'pcard';
      card.id = `card-${pid}`;
      card.dataset.pname = p.name;
      const slidersHtml = CRITERIA.map((cr, ci) => `
        <div class="crit-row">
          <span class="crit-name">${CDISP[ci]}</span>
          <input type="range" min="1" max="10" step="1" value="5" data-cr="${escHtml(cr)}" data-did="d-${pid}-${san(cr)}" oninput="onSlider(this)">
          <span class="score-num" id="d-${pid}-${san(cr)}">—</span>
        </div>`).join('');
      card.innerHTML = `
        <div class="pcard-head">
          <div class="av">${escHtml(p.name.charAt(0))}</div>
          <span class="pcard-name">${escHtml(p.name)}</span>
          <span class="pos-badge">${posShort(p)}</span>
          <span class="done-badge">✓ Tamam</span>
        </div>
        ${slidersHtml}`;
      c.appendChild(card);
    });
    updateProgress();
  };

  const useCache = !state.manualWeek && (cachedWeek === week && cachedList) && (cachedHakemWeek === week);

  if (useCache) {
    renderWithData(cachedList, cachedHakemName);
    Promise.all([
      gs({ action: 'getTodayPlayers', week }),
      gs({ action: 'getHakem', week })
    ]).then(([tdData, hkData]) => {
      lSet('hs_today_players_cache', JSON.stringify({ week, players: tdData.players || [] }));
      lSet('hs_hakem_cache', JSON.stringify({ week, hakem: hkData.hakem || '' }));
    }).catch(() => {});
    return;
  }

  Promise.all([
    gs({ action: 'getTodayPlayers', week }),
    gs({ action: 'getHakem', week })
  ]).then(([tdData, hkData]) => {
    const players = tdData.players || [];
    const hakem = hkData.hakem || '';
    lSet('hs_today_players_cache', JSON.stringify({ week, players }));
    lSet('hs_hakem_cache', JSON.stringify({ week, hakem }));
    renderWithData(players, hakem);
  }).catch(() => renderWithData([], ''));
}

export function onSlider(el) {
  const cr = el.dataset.cr;
  const did = el.dataset.did;
  const val = el.value;
  const card = el.closest('.pcard');
  const pname = card ? card.dataset.pname : '';
  const d = document.getElementById(did);
  if (d) { d.textContent = val; d.style.color = scoreColor(+val); }
  if (!state.currentScores[pname]) state.currentScores[pname] = {};
  state.currentScores[pname][cr] = +val;
  if (CRITERIA.every(c => state.currentScores[pname] && state.currentScores[pname][c] !== undefined)) {
    state.completedCards[pname] = true;
    if (card) card.className = 'pcard done';
  }
  updateProgress();
}

export function updateProgress() {
  const ratingCards = byId('ratingCards');
  const progCount = byId('progCount');
  const progFill = byId('progFill');
  const submitBtn = byId('submitBtn');
  if (!ratingCards || !progCount || !progFill || !submitBtn) return;
  const others = Array.from(ratingCards.querySelectorAll('.pcard'));
  const total = others.length, done = Object.keys(state.completedCards).length;
  progCount.textContent = `${done}/${total}`;
  progFill.style.width = `${total ? (done / total * 100) : 0}%`;
  submitBtn.disabled = (done < total || total === 0);
}

export function submitRatings() {
  const btn = byId('submitBtn');
  const successPopup = byId('successPopup');
  if (!btn) return;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Isleniyor...';
  const week = getWeekLabel();
  const filtered = {};
  Object.keys(state.currentScores).forEach(p => { filtered[p] = state.currentScores[p]; });
  gs({action:'save', rater:state.currentRater, week, scores:JSON.stringify(filtered)})
    .then(d => {
      if (d.success) {
        btn.textContent = 'Puanları Gönder';
        lRem('hs_results_cache');
        state.resultData = null;
        loadResults(() => {}, true);
        if (successPopup) successPopup.style.display = 'flex';
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

export function closeSuccessPopup() {
  const popup = byId('successPopup');
  const rankBtn = document.querySelectorAll('.bnav-item')[1];
  if (popup) popup.style.display = 'none';
  if (rankBtn) rankBtn.click();
}

export function buildGoalInputs() {
  const c = document.getElementById('goalInputs');
  if (!c) return;
  c.innerHTML = state.players.map(p => {
    const pid = san(p.name);
    return `<div class="goal-row">
      <div class="goal-player"><div class="av" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${p.name.charAt(0)}</div><span class="goal-player-name">${p.name}</span></div>
      <div class="goal-stepper"><button class="step-btn" data-id="gol-${pid}" data-d="-1" onclick="stepGoal(this)">−</button><span class="step-val" id="gol-${pid}">0</span><button class="step-btn" data-id="gol-${pid}" data-d="1" onclick="stepGoal(this)">+</button></div>
      <div class="goal-stepper"><button class="step-btn" data-id="ast-${pid}" data-d="-1" onclick="stepGoal(this)">−</button><span class="step-val" id="ast-${pid}">0</span><button class="step-btn" data-id="ast-${pid}" data-d="1" onclick="stepGoal(this)">+</button></div>
    </div>`;
  }).join('');
}

export function stepGoal(btn) {
  const id = btn.dataset.id, delta = parseInt(btn.dataset.d);
  const el = document.getElementById(id);
  if (!el) return;
  const v = Math.max(0, Math.min(20, (parseInt(el.textContent) || 0) + delta));
  el.textContent = v;
  const row = btn.closest('.goal-row');
  if (row) row.classList.toggle('goal-row-active', Array.from(row.querySelectorAll('.step-val')).some(v => parseInt(v.textContent) > 0));
}
