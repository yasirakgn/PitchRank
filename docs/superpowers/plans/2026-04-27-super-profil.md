# Süper Profil Ekranı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oyuncunun kendi rozet, form ve rekabet verilerini görebileceği kalıcı bir profil ekranı eklemek.

**Architecture:** `js/profile.js` modülü tüm hesaplama ve render mantığını barındırır; yalnızca `config`, `state`, `utils`, `rating` modüllerinden import alır (DAG ihlali yok). Ekran `components/app.html`'e `#screen-profil` olarak eklenir, alt nav'a Yönetici butonundan önce yerleştirilir. Tüm veri client-side; GAS'a dokunulmaz.

**Tech Stack:** Vanilla ES modules, inline HTML string rendering, CSS custom properties

---

## Dosya Haritası

| Dosya | İşlem | Sorumluluk |
|-------|--------|-----------|
| `js/profile.js` | Oluştur | Hesaplama + render fonksiyonları |
| `components/app.html` | Değiştir | `#screen-profil` section eklenir |
| `components/nav.html` | Değiştir | 👤 Profil butonu eklenir |
| `js/main.js` | Değiştir | import, window export, switchMainScreen entegrasyonu |
| `css/main.css` | Değiştir | Profil ekranı CSS sınıfları |

---

## Task 1: `js/profile.js` — Hesaplama Fonksiyonları

**Files:**
- Create: `js/profile.js`

- [ ] **Adım 1: Dosyayı oluştur — yardımcı fonksiyonlar ve rozet tanımları**

`js/profile.js` dosyasını aşağıdaki içerikle oluştur:

```js
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
```

- [ ] **Adım 2: `computeBadges` fonksiyonunu ekle — aynı dosyanın devamı**

```js
const BADGE_DEFS = [
  { id: 'maestro',  icon: '🎯', name: 'Maestro',     desc: 'Pas ortalaması 8.0+',           check: (p)       => criteriaAvg(p, 'Pas') >= 8.0 },
  { id: 'fuze',     icon: '🚀', name: 'Füze',         desc: 'Şut ortalaması 8.0+',           check: (p)       => criteriaAvg(p, 'Sut') >= 8.0 },
  { id: 'cambaz',   icon: '🪄', name: 'Cambaz',       desc: 'Dribling ortalaması 8.0+',      check: (p)       => criteriaAvg(p, 'Dribling') >= 8.0 },
  { id: 'duvar',    icon: '🧱', name: 'Duvar',         desc: 'Savunma ortalaması 8.0+',       check: (p)       => criteriaAvg(p, 'Savunma') >= 8.0 },
  { id: 'motor',    icon: '⚡', name: 'Motor',         desc: 'Hız/Kondisyon ortalaması 8.0+', check: (p)       => criteriaAvg(p, 'Hiz / Kondisyon') >= 8.0 },
  { id: 'tank',     icon: '🦍', name: 'Tank',          desc: 'Fizik ortalaması 8.0+',         check: (p)       => criteriaAvg(p, 'Fizik') >= 8.0 },
  { id: 'joker',    icon: '🤝', name: 'Joker',         desc: 'Takım Oyunu ortalaması 8.0+',   check: (p)       => criteriaAvg(p, 'Takim Oyunu') >= 8.0 },
  { id: 'ates',     icon: '🔥', name: 'Ateş',          desc: '3 hafta üst üste ilk 3 sıra',  check: (p, rd)   => hasConsecutiveTop3(p, rd, 3) },
  { id: 'devamli',  icon: '📅', name: 'Devamlı',       desc: '5+ maça katılım',               check: (p)       => attendanceCount(p) >= 5 },
  { id: 'lider',    icon: '👑', name: 'Lider',          desc: 'Sezon genel sıralaması 1.',    check: (p, rd)   => isLeader(p, rd) },
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
```

- [ ] **Adım 3: Browser konsolunda hesaplama fonksiyonlarını doğrula**

Siteyi `npx serve .` ile başlat, herhangi bir takım seç, konsola yaz:

```js
import('./js/profile.js').then(m => {
  const p = window.__state?.resultData?.players?.[0];
  const rd = window.__state?.resultData;
  const md = window.__state?.matchesData;
  console.log(m.computeBadges(p, rd, md));
});
```

Beklenen: 12 elemanlı dizi, her birinde `{ id, icon, name, desc, earned: true/false }`.  
`window.__state` yoksa `state` modülünü import eden herhangi bir fonksiyon çağrıldıktan sonra konsola `state` yazmak yerine `import('./js/state.js').then(m => console.log(m.state))` kullan.

- [ ] **Adım 4: Commit**

```bash
git add js/profile.js
git commit -m "feat: profile.js hesaplama fonksiyonları (computeBadges)"
```

---

## Task 2: `js/profile.js` — Render Fonksiyonları

**Files:**
- Modify: `js/profile.js` (devam)

- [ ] **Adım 1: `renderHeader` fonksiyonunu ekle**

`js/profile.js` dosyasının sonuna ekle:

```js
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
```

- [ ] **Adım 2: `renderFormStrip` fonksiyonunu ekle**

```js
function renderFormStrip(container, playerData, resultData) {
  if (!playerData || !Array.isArray(playerData.weeklyGenels) || !Array.isArray(resultData && resultData.weeks)) {
    container.innerHTML = '<div class="profile-nodata">Henüz form verisi yok.</div>';
    return;
  }
  const weeks = resultData.weeks;
  const genels = playerData.weeklyGenels;
  // Son 5 haftayı al (null olmayanlar dahil, sıralı)
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
```

- [ ] **Adım 3: `renderBadges` fonksiyonunu ekle**

```js
function renderBadges(container, badges) {
  const items = badges.map(b => `
    <div class="badge-item ${b.earned ? '' : 'locked'}"
         onclick="window.__showBadgeDesc && window.__showBadgeDesc('${escHtml(b.icon + ' ' + b.name + ': ' + b.desc)}')">
      <span class="badge-icon">${b.icon}</span>
      <span class="badge-name">${escHtml(b.name)}</span>
      ${b.earned ? '' : '<span class="badge-lock">🔒</span>'}
    </div>`).join('');
  container.innerHTML = `<div class="badge-grid">${items}</div>`;
}
```

- [ ] **Adım 4: `renderCompetition` ve `renderCriteriaBar` fonksiyonlarını ekle**

```js
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
```

- [ ] **Adım 5: Ana `renderProfile` export fonksiyonunu ekle**

```js
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

  renderHeader(headerEl, playerData, pObj);
  renderFormStrip(formEl, playerData, rd);
  renderBadges(badgesEl, computeBadges(playerData, rd, md));
  renderCompetition(compEl, playerData, rd && rd.players);
  renderCriteriaBar(criteriaEl, playerData);

  window.__showBadgeDesc = (msg) => showToast(msg);
}
```

- [ ] **Adım 6: Commit**

```bash
git add js/profile.js
git commit -m "feat: profile.js render fonksiyonları (renderProfile)"
```

---

## Task 3: `components/app.html` — Profil Section

**Files:**
- Modify: `components/app.html`

- [ ] **Adım 1: `#screen-profil` section'ı ekle**

`components/app.html` dosyasında `</main>` satırından hemen önce şunu ekle:

```html
  <section id="screen-profil" class="screen" aria-label="Profilim">
    <div class="card" style="margin-bottom:12px;">
      <div class="slabel">Kişisel</div>
      <div class="stitle" style="margin-bottom:4px;">👤 Profilim</div>
      <div style="font-size:13px;color:var(--text3);font-weight:500;">Rozet, form ve rekabet durumun</div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">
      <div id="prof-header"></div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div class="slabel">Son 5 Hafta</div>
      <div class="stitle" style="margin-bottom:12px;font-size:15px;">Form Şeridi</div>
      <div id="prof-form"></div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div class="slabel">Koleksiyon</div>
      <div class="stitle" style="margin-bottom:12px;font-size:15px;">Rozetler</div>
      <div id="prof-badges"></div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div class="slabel">Rekabet</div>
      <div id="prof-competition" style="font-size:14px;font-weight:600;color:var(--text2);padding:4px 0;"></div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="slabel">Kriter Gelişimi</div>
      <div class="stitle" style="margin-bottom:12px;font-size:15px;">Sezon Ortalamaları</div>
      <div id="prof-criteria"></div>
    </div>
  </section>
```

- [ ] **Adım 2: Sayfayı tarayıcıda aç, #screen-profil elementinin var olduğunu doğrula**

```js
document.getElementById('screen-profil')
// Beklenen: <section> elementi, null değil
```

- [ ] **Adım 3: Commit**

```bash
git add components/app.html
git commit -m "feat: #screen-profil section eklendi"
```

---

## Task 4: `css/main.css` — Profil CSS

**Files:**
- Modify: `css/main.css`

- [ ] **Adım 1: Profil CSS sınıflarını dosyanın sonuna ekle**

`css/main.css` dosyasının en sonuna ekle:

```css
/* ── Profil Ekranı ──────────────────────────────────────────────────────────── */
.profile-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg2);
}
.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  flex-shrink: 0;
}
.profile-header-info { flex: 1; min-width: 0; }
.profile-name { font-size: 18px; font-weight: 900; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.profile-pos  { font-size: 12px; font-weight: 700; color: var(--text3); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
.profile-rating { font-size: 44px; font-weight: 900; line-height: 1; flex-shrink: 0; }

/* Form Şeridi */
.form-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.form-week  { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 48px; }
.form-bubble {
  width: 44px; height: 44px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900;
  border: 2px solid transparent;
}
.form-bubble.good { background: #ecfdf5; color: #065f46; border-color: #10b98140; }
.form-bubble.mid  { background: #fefce8; color: #713f12; border-color: #eab30840; }
.form-bubble.low  { background: #fff1f2; color: #9f1239; border-color: #f4375040; }
.form-week-lbl { font-size: 9px; font-weight: 700; color: var(--text3); text-align: center; }
.form-arrow { font-size: 14px; font-weight: 900; line-height: 1; }
.form-arrow.up   { color: #10b981; }
.form-arrow.down { color: #ef4444; }
.form-arrow.flat { color: var(--text3); }

/* Rozet Rafı */
.badge-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.badge-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; border-radius: 14px; border: 1px solid var(--border);
  background: var(--bg2); cursor: pointer; position: relative;
  transition: transform 0.15s;
}
.badge-item:active { transform: scale(0.95); }
.badge-item.locked { opacity: 0.35; }
.badge-icon { font-size: 24px; line-height: 1; }
.badge-name { font-size: 9px; font-weight: 800; color: var(--text2); text-align: center; text-transform: uppercase; letter-spacing: 0.3px; }
.badge-lock { position: absolute; top: 4px; right: 4px; font-size: 10px; }

/* Rekabet */
.comp-line { font-size: 14px; font-weight: 600; color: var(--text2); line-height: 1.5; }
.comp-line strong { color: var(--text); }

/* Kriter Barları */
.criteria-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.criteria-lbl { font-size: 11px; font-weight: 800; color: var(--text3); width: 38px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.3px; }
.criteria-track { flex: 1; height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
.criteria-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.criteria-fill.good { background: #10b981; }
.criteria-fill.mid  { background: #eab308; }
.criteria-fill.low  { background: #ef4444; }
.criteria-val { font-size: 12px; font-weight: 800; color: var(--text2); width: 28px; text-align: right; flex-shrink: 0; }

/* Genel */
.profile-nodata { font-size: 13px; color: var(--text3); font-weight: 500; padding: 8px 0; }

@media (prefers-color-scheme: dark) {
  .form-bubble.good { background: #052e16; color: #6ee7b7; }
  .form-bubble.mid  { background: #1c1400; color: #fde68a; }
  .form-bubble.low  { background: #1f0a0a; color: #fca5a5; }
}
```

- [ ] **Adım 2: CSS `dark` sınıfı kontrolü**

PitchRank dark mode için `body.dark` sınıfını kullanır (`prefers-color-scheme` değil). Yukarıdaki `@media` bloğunu sil ve yerine şunu ekle (Task 4 Adım 1'deki CSS'in içine):

```css
body.dark .form-bubble.good { background: #052e16; color: #6ee7b7; }
body.dark .form-bubble.mid  { background: #1c1400; color: #fde68a; }
body.dark .form-bubble.low  { background: #1f0a0a; color: #fca5a5; }
```

- [ ] **Adım 3: Commit**

```bash
git add css/main.css
git commit -m "feat: profil ekranı CSS sınıfları"
```

---

## Task 5: Navigasyon — `nav.html` + `main.js`

**Files:**
- Modify: `components/nav.html`
- Modify: `js/main.js`

- [ ] **Adım 1: `components/nav.html`'e Profil butonu ekle**

`components/nav.html` dosyasında `<button class="bnav-item" onclick="tryAdmin(this)"` satırından hemen önce şunu ekle:

```html
  <button class="bnav-item" onclick="switchMainScreen('profil',this)" type="button">
    <span class="bnav-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </span>
    <span>Profil</span>
  </button>

```

- [ ] **Adım 2: `js/main.js`'e import ekle**

`js/main.js` dosyasında şu satırı bul:

```js
import { tryAdmin, checkPin, logoutAdmin, setAdminTab,
```

Bu import bloğundan önce yeni satır ekle:

```js
import { renderProfile } from './profile.js';
```

- [ ] **Adım 3: `switchMainScreen` fonksiyonuna profil case'ini ekle**

`js/main.js` dosyasında `switchMainScreen` fonksiyonunu bul. İçinde şu satır var:

```js
  if (id === 'takim') { renderTodayPlayers(); if (!state.resultData) loadResults(() => {}); }
```

Bu satırın hemen **altına** ekle:

```js
  if (id === 'profil') {
    if (!state.currentRater) { showToast('Önce kimliğini seç'); switchMainScreen('puanla', document.querySelector('.bnav-item')); return; }
    if (!state.resultData) { loadResults(data => { state.resultData = data; renderProfile(); }); } else { renderProfile(); }
  }
```

- [ ] **Adım 4: `window.renderProfile` export ekle**

`js/main.js` dosyasında `window.switchMainScreen = switchMainScreen;` satırını bul. Hemen altına ekle:

```js
window.renderProfile = renderProfile;
```

- [ ] **Adım 5: Alt nav buton sayısını CSS'de ayarla**

Alt nav 7 butona çıkacak. `css/main.css` dosyasında `.bottom-nav` veya `.bnav-item` için genişlik ayarı varsa kontrol et. 7 butona sığması için font-size küçültme gerekebilir. Şu satırı `css/main.css` sonuna ekle:

```css
/* 7 nav item için kompakt mod */
@media (max-width: 480px) {
  .bnav-item span:not(.bnav-icon) { font-size: 8px; }
  .bnav-icon svg { width: 18px; height: 18px; }
}
```

- [ ] **Adım 6: Commit**

```bash
git add components/nav.html js/main.js css/main.css
git commit -m "feat: profil nav butonu ve switchMainScreen entegrasyonu"
```

---

## Task 6: Manuel Doğrulama

**Files:** Yok (tarayıcı testi)

- [ ] **Adım 1: Sunucuyu başlat**

```bash
npx serve .
```

Tarayıcıda `http://localhost:3000` aç.

- [ ] **Adım 2: Temel akış testi**

1. Takım seç (Haldunalagaş veya Arion)
2. Alt nav'da 👤 Profil butonunu tıkla
3. Beklenen: "Önce kimliğini seç" toast'ı gösterilir, Puanla ekranına döner
4. Puanla ekranında bir isim seç, "Kimliğiniz cihaza kilitlendi" mesajını gör
5. Tekrar Profil butonuna tıkla
6. Beklenen: Profil ekranı açılır, oyuncunun başlığı görünür

- [ ] **Adım 3: Bölüm bazlı kontroller**

| Bölüm | Kontrol |
|-------|---------|
| Başlık | İsim, pozisyon, puan (0–99) görünüyor |
| Form Şeridi | En az 1 balon var (veri varsa), renk doğru (yeşil/sarı/kırmızı) |
| Rozetler | 12 rozet kutusu var, kazanılmamışlar gri+kilit |
| Rekabet | "X. sıradasın" veya "Liderisin" metni görünüyor |
| Kriter | 7 satırdan dolusu görünüyor, dolgu çubukları var |

- [ ] **Adım 4: Karanlık mod testi**

☀️/🌙 butonuyla dark mode'u aç/kapa. Form balonları rengi değişmeli (dark: koyu arka plan, açık metin).

- [ ] **Adım 5: Commit**

```bash
git add .
git commit -m "feat: süper profil ekranı tamamlandı"
```

---

## Sınır Durumu Notları

- `state.matchesData` null ise Golcü ve Asist Kralı rozetleri `earned: false` döner — hata fırlatmaz
- Oyuncu `resultData.players`'da yoksa (yeni oyuncu) tüm render fonksiyonları "veri yok" mesajı gösterir
- `showToast` `utils.js`'den import edilmez — `main.js` aracılığıyla `window.__utils` yerine doğrudan `main.js`'deki `showToast`'ı kullanmak için `switchMainScreen` içinde çağrı yapılır; `profile.js` `showToast`'a ihtiyaç duymaz
