# Taslak Kaydet + Takım Dengesi Analizi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two features: (A) auto-save slider scores as localStorage draft with a restore-on-return confirmation banner; (B) a new "Denge" sub-tab in İstatistik showing an SVG score-differential chart and match balance table.

**Architecture:** Feature A hooks into `onSlider`/`buildCards`/`submitRatings` in `players.js`, persisting `state.currentScores` keyed by rater+week. Feature B adds `renderDenge()` to `stats.js`, self-contained data loading (cache → GAS), wired into `setStatScreen` in `main.js`.

**Tech Stack:** Vanilla JS ES modules, `lGet`/`lSet`/`lRem` from `storage.js`, inline SVG for the bar/trend chart. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `components/app.html` | Add `#draft-banner` div (between `#progressWrap` and `#ratingCards`); add `denge` sub-nav button + `#stat-denge` sub-screen |
| `js/players.js` | Add `draftKey`, `saveDraft`, `clearDraft`, `getDraft`, `checkDraftBanner`, `restoreDraft` (export), `dismissDraft` (export); modify `onSlider`, inner `renderCards`, `submitRatings`, `resetIdentity` |
| `js/stats.js` | Add `renderDenge` export |
| `js/main.js` | Add `restoreDraft`/`dismissDraft` to players.js import; add `renderDenge` to stats.js import; `window.restoreDraft`, `window.dismissDraft`; `denge` case in `setStatScreen` and `refreshData` |
| `css/main.css` | Append `.draft-banner` styles; append `.denge-*` styles |

---

### Task 1: Draft Banner HTML + CSS

**Files:**
- Modify: `components/app.html`
- Modify: `css/main.css`

- [ ] **Step 1: Add banner div to app.html**

In `components/app.html`, find:
```html
    <div id="ratingCards" style="display:none;"></div>
```
Replace with:
```html
    <div id="draft-banner" class="draft-banner" style="display:none;">
      <div class="draft-banner-body">
        <span class="draft-banner-icon">⚡</span>
        <span class="draft-banner-text">Geçen sefer kaldığın yer kaydedildi</span>
      </div>
      <div class="draft-banner-actions">
        <button onclick="restoreDraft()" type="button" class="draft-btn-continue">Devam Et</button>
        <button onclick="dismissDraft()" type="button" class="draft-btn-reset">Sıfırla</button>
      </div>
    </div>

    <div id="ratingCards" style="display:none;"></div>
```

- [ ] **Step 2: Append banner CSS to css/main.css**

Append to the end of `css/main.css`:
```css
/* ── Taslak Banner ──────────────────────────────────────────────────────────── */
.draft-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  background: #fefce8; border: 1.5px solid #f59e0b;
  border-radius: var(--r); padding: 12px 16px; margin-bottom: 12px;
}
body.dark .draft-banner { background: #1c1400; border-color: #d97706; }
.draft-banner-body { display: flex; align-items: center; gap: 8px; }
.draft-banner-icon { font-size: 18px; flex-shrink: 0; }
.draft-banner-text { font-size: 13px; font-weight: 700; color: #92400e; }
body.dark .draft-banner-text { color: #fcd34d; }
.draft-banner-actions { display: flex; gap: 8px; }
.draft-btn-continue {
  background: #f59e0b; color: #fff; border: none;
  border-radius: 10px; padding: 7px 14px;
  font-size: 12px; font-weight: 800; cursor: pointer; font-family: inherit;
}
.draft-btn-continue:active { opacity: 0.85; }
.draft-btn-reset {
  background: var(--bg3); color: var(--text2); border: 1px solid var(--border);
  border-radius: 10px; padding: 7px 12px;
  font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
}
.draft-btn-reset:active { opacity: 0.8; }
```

- [ ] **Step 3: Smoke-test banner renders**

Run `npx serve .` from the project root, open `http://localhost:3000`. In DevTools console:
```js
document.getElementById('draft-banner').style.display = 'flex';
```
Expected: amber banner with ⚡ icon and two buttons appears below the progress bar, above the empty cards area.

- [ ] **Step 4: Commit**
```bash
git add components/app.html css/main.css
git commit -m "feat: add draft banner HTML and CSS"
```

---

### Task 2: Draft Functions in players.js

**Files:**
- Modify: `js/players.js`

- [ ] **Step 1: Add seven draft functions after the byId helper**

In `js/players.js`, find:
```js
function byId(id) {
  return document.getElementById(id);
}
```
Add immediately after the closing `}`:
```js

// ── Taslak yardımcıları ───────────────────────────────────────────────────────
function draftKey(rater, week) {
  return `hs_draft_${rater}_${week}`;
}

function saveDraft(rater, week, scores) {
  if (!rater || !week || !scores || !Object.keys(scores).length) return;
  lSet(draftKey(rater, week), JSON.stringify(scores));
}

function clearDraft(rater, week) {
  if (!rater || !week) return;
  lRem(draftKey(rater, week));
}

function getDraft(rater, week) {
  const raw = lGet(draftKey(rater, week));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { clearDraft(rater, week); return null; }
}

function checkDraftBanner() {
  const draft = getDraft(state.currentRater, getWeekLabel());
  const banner = byId('draft-banner');
  if (banner) banner.style.display = (draft && Object.keys(draft).length) ? 'flex' : 'none';
}

export function restoreDraft() {
  const draft = getDraft(state.currentRater, getWeekLabel());
  if (!draft) return;
  document.querySelectorAll('#ratingCards .pcard').forEach(card => {
    const pname = card.dataset.pname;
    const scores = draft[pname];
    if (!scores) return;
    if (!state.currentScores[pname]) state.currentScores[pname] = {};
    CRITERIA.forEach(cr => {
      if (scores[cr] == null) return;
      const val = +scores[cr];
      state.currentScores[pname][cr] = val;
      const slider = card.querySelector(`input[data-cr="${cr}"]`);
      if (!slider) return;
      slider.value = val;
      const display = document.getElementById(slider.dataset.did);
      if (display) { display.textContent = val; display.style.color = scoreColor(val); }
    });
    if (CRITERIA.every(c => state.currentScores[pname]?.[c] !== undefined)) {
      state.completedCards[pname] = true;
      card.className = 'pcard done';
    }
  });
  updateProgress();
  const banner = byId('draft-banner');
  if (banner) banner.style.display = 'none';
}

export function dismissDraft() {
  clearDraft(state.currentRater, getWeekLabel());
  const banner = byId('draft-banner');
  if (banner) banner.style.display = 'none';
}
```

- [ ] **Step 2: Verify module loads without errors**

Open `http://localhost:3000` → DevTools Console. Expected: no import errors. The banner buttons still error on click (not yet wired to window) — that's expected.

- [ ] **Step 3: Commit**
```bash
git add js/players.js
git commit -m "feat: add draft save/restore functions to players.js"
```

---

### Task 3: Wire Draft Into Existing Flow + main.js Exports

**Files:**
- Modify: `js/players.js` (4 targeted edits)
- Modify: `js/main.js` (import line + window exports + refreshData denge stub)

- [ ] **Step 1: Wire saveDraft into onSlider**

In `js/players.js`, find the end of `onSlider` (the only export function ending with `updateProgress();` followed by `}` then `export function updateProgress`):
```js
  updateProgress();
}

export function updateProgress() {
```
Replace with:
```js
  updateProgress();
  saveDraft(state.currentRater, getWeekLabel(), state.currentScores);
}

export function updateProgress() {
```

- [ ] **Step 2: Wire checkDraftBanner into renderCards**

In `js/players.js`, find the very end of the `renderCards` arrow function (the `updateProgress()` call that is indented 4 spaces and followed by `  };`):
```js
    updateProgress();
  };
```
Replace with:
```js
    updateProgress();
    checkDraftBanner();
  };
```

- [ ] **Step 3: Wire clearDraft into submitRatings success path**

In `js/players.js`, find:
```js
      if (d.success) {
        btn.textContent = 'Puanları Gönder';
        lRem('hs_results_cache');
```
Replace with:
```js
      if (d.success) {
        btn.textContent = 'Puanları Gönder';
        clearDraft(state.currentRater, getWeekLabel());
        lRem('hs_results_cache');
```

- [ ] **Step 4: Wire clearDraft into resetIdentity confirm callback**

In `js/players.js`, find:
```js
  showConfirm('Kimliğinizi değiştirmek istediğinize emin misiniz?', () => {
    lRem('hs_my_identity');
```
Replace with:
```js
  showConfirm('Kimliğinizi değiştirmek istediğinize emin misiniz?', () => {
    clearDraft(state.currentRater, getWeekLabel());
    lRem('hs_my_identity');
```

- [ ] **Step 5: Add restoreDraft and dismissDraft to players.js import in main.js**

In `js/main.js`, find:
```js
import { savePlayers, loadPlayersFromSheets, loadMevkilerFromSheets, initSelects, checkIdentityLock, resetIdentity, onRaterChange, buildCards, onSlider, updateProgress, submitRatings, closeSuccessPopup, buildGoalInputs, stepGoal } from './players.js';
```
Replace with:
```js
import { savePlayers, loadPlayersFromSheets, loadMevkilerFromSheets, initSelects, checkIdentityLock, resetIdentity, onRaterChange, buildCards, onSlider, updateProgress, submitRatings, closeSuccessPopup, buildGoalInputs, stepGoal, restoreDraft, dismissDraft } from './players.js';
```

- [ ] **Step 6: Add window exports in main.js**

In `js/main.js`, find:
```js
window.toggleDark = toggleDark;
window.refreshData = refreshData;
```
Replace with:
```js
window.toggleDark = toggleDark;
window.refreshData = refreshData;
window.restoreDraft = restoreDraft;
window.dismissDraft = dismissDraft;
```

- [ ] **Step 7: End-to-end draft verification**

1. Open `http://localhost:3000`, select a player identity
2. Move any slider — check DevTools → Application → Local Storage for a key like `hs_draft_ADIM_2026-H17`
3. Hard-refresh the page (Ctrl+Shift+R) — identity should still be locked (from `hs_my_identity`)
4. Expected: amber ⚡ banner appears above the rating cards
5. Click "Devam Et" — sliders restore to saved values, banner disappears
6. Submit ratings → check that the `hs_draft_*` key is gone from Local Storage

- [ ] **Step 8: Commit**
```bash
git add js/players.js js/main.js
git commit -m "feat: wire draft save/restore/clear into onSlider, renderCards, submitRatings, resetIdentity"
```

---

### Task 4: Denge Tab Shell

**Files:**
- Modify: `components/app.html`
- Modify: `js/stats.js` (stub only)
- Modify: `js/main.js` (import + setStatScreen + refreshData)

- [ ] **Step 1: Add Denge button to sub-nav in app.html**

In `components/app.html`, find:
```html
      <button class="sub-nb" onclick="setStatScreen('maclar',this)" type="button">Maçlar</button>
    </div>
```
Replace with:
```html
      <button class="sub-nb" onclick="setStatScreen('maclar',this)" type="button">Maçlar</button>
      <button class="sub-nb" onclick="setStatScreen('denge',this)" type="button">Denge</button>
    </div>
```

- [ ] **Step 2: Add stat-denge sub-screen div in app.html**

In `components/app.html`, find:
```html
    <div id="stat-maclar" class="sub-screen">
      <div id="publicMatchHistory"><div class="no-data"><span class="spin"></span>Yükleniyor...</div></div>
    </div>
```
Replace with:
```html
    <div id="stat-maclar" class="sub-screen">
      <div id="publicMatchHistory"><div class="no-data"><span class="spin"></span>Yükleniyor...</div></div>
    </div>
    <div id="stat-denge" class="sub-screen">
      <div id="dengeContent"><div class="no-data"><span class="spin"></span>Yükleniyor...</div></div>
    </div>
```

- [ ] **Step 3: Add renderDenge stub to stats.js**

At the very end of `js/stats.js` (after the closing `}` of `loadMatchHistory` and before the final blank line), add:
```js

export function renderDenge() {
  const el = document.getElementById('dengeContent');
  if (el) el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
}
```

- [ ] **Step 4: Add renderDenge to stats.js import in main.js**

In `js/main.js`, find:
```js
import { loadResults, loadManualWeek, setRankTab, renderSonuc, renderHafta, selectWeekBtn, renderTrend, renderComparison, renderSezon, renderKatilim, loadMatchHistory } from './stats.js';
```
Replace with:
```js
import { loadResults, loadManualWeek, setRankTab, renderSonuc, renderHafta, selectWeekBtn, renderTrend, renderComparison, renderSezon, renderKatilim, loadMatchHistory, renderDenge } from './stats.js';
```

- [ ] **Step 5: Add denge case to setStatScreen in main.js**

In `js/main.js`, find:
```js
  if (id === 'maclar') loadMatchHistory();
}
```
Replace with:
```js
  if (id === 'maclar') loadMatchHistory();
  if (id === 'denge') renderDenge();
}
```

- [ ] **Step 6: Add denge case to refreshData in main.js**

In `js/main.js`, inside `refreshData`, find:
```js
      else if (ssid === 'maclar') loadMatchHistory();
```
Replace with:
```js
      else if (ssid === 'maclar') loadMatchHistory();
      else if (ssid === 'denge') renderDenge();
```

- [ ] **Step 7: Verify tab shell works**

Open `http://localhost:3000` → İstatistik → click "Denge". Expected: tab activates, spinner shown (from stub), no console errors.

- [ ] **Step 8: Commit**
```bash
git add components/app.html js/stats.js js/main.js
git commit -m "feat: add Denge sub-tab shell (HTML + routing)"
```

---

### Task 5: renderDenge() Full Implementation

**Files:**
- Modify: `js/stats.js` (replace stub with full implementation)

- [ ] **Step 1: Replace renderDenge stub**

In `js/stats.js`, find:
```js
export function renderDenge() {
  const el = document.getElementById('dengeContent');
  if (el) el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
}
```
Replace with:
```js
export function renderDenge() {
  const el = document.getElementById('dengeContent');
  if (!el) return;

  const renderContent = (data) => {
    if (!data || !data.matches || !data.matches.length) {
      el.innerHTML = '<div class="no-data">Henüz maç kaydı yok.</div>';
      return;
    }
    const matches = data.matches.filter(m => m.score1 != null && m.score2 != null && m.score1 !== '' && m.score2 !== '');
    if (!matches.length) {
      el.innerHTML = '<div class="no-data">Skor verisi olan maç bulunamadı.</div>';
      return;
    }

    const diffs = matches.map(m => +m.score1 - +m.score2);
    const absDiffs = diffs.map(d => Math.abs(d));
    const avgDiff = (absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length).toFixed(1);
    const cekismeli = diffs.filter(d => d === 0).length;
    const dengeli = diffs.filter(d => Math.abs(d) >= 1 && Math.abs(d) <= 2).length;
    const tekTarafli = diffs.filter(d => Math.abs(d) >= 3).length;

    const W = 300, H = 110, PX = 24, PY = 14;
    const maxAbs = Math.max(...absDiffs, 1);
    const n = matches.length;
    const slotW = (W - PX * 2) / Math.max(n, 1);
    const barW = Math.max(4, Math.min(18, slotW * 0.6));
    const zeroY = PY + (H - PY * 2) / 2;
    const scale = (H - PY * 2) / 2 / maxAbs;

    const bars = matches.map((m, i) => {
      const diff = +m.score1 - +m.score2;
      const cx = PX + i * slotW + slotW / 2;
      const absH = Math.max(Math.abs(diff) * scale, diff !== 0 ? 3 : 1);
      const y = diff >= 0 ? zeroY - absH : zeroY;
      const fill = diff > 0 ? 'var(--green)' : diff < 0 ? '#ef4444' : 'var(--text3)';
      return `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${absH.toFixed(1)}" rx="2" fill="${fill}" opacity="0.82"/>`;
    }).join('');

    const trendPts = matches.map((m, i) => {
      const cx = PX + i * slotW + slotW / 2;
      const y = zeroY - (+m.score1 - +m.score2) * scale;
      return `${cx.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const labels = matches.map((m, i) => {
      const cx = PX + i * slotW + slotW / 2;
      const lbl = (m.week || '').replace(/\d{4}-/, '');
      return `<text x="${cx.toFixed(1)}" y="${H - 1}" class="denge-chart-lbl" text-anchor="middle">${escHtml(lbl)}</text>`;
    }).join('');

    const listRows = matches.slice().reverse().map(m => {
      const diff = +m.score1 - +m.score2;
      const abs = Math.abs(diff);
      const [emoji, label, cls] = abs === 0
        ? ['🟢', 'Çekişmeli', 'cekismeli']
        : abs <= 2
        ? ['🟡', 'Dengeli', 'dengeli']
        : ['🔴', 'Tek Taraflı', 'tektarafli'];
      const wk = (m.week || '').replace(/\d{4}-/, '');
      return `<div class="denge-row">
        <span class="denge-week">${escHtml(wk)}</span>
        <span class="denge-score">${escHtml(String(+m.score1))}–${escHtml(String(+m.score2))}</span>
        <span class="denge-diff ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'zero'}">${diff > 0 ? '+' : ''}${diff}</span>
        <span class="denge-badge ${cls}">${emoji} ${escHtml(label)}</span>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div class="denge-summary">
        <div class="denge-stat"><span class="denge-stat-val">${avgDiff}</span><span class="denge-stat-lbl">ort. fark</span></div>
        <div class="denge-stat"><span class="denge-stat-val" style="color:var(--green)">${cekismeli}</span><span class="denge-stat-lbl">🟢 çekişmeli</span></div>
        <div class="denge-stat"><span class="denge-stat-val" style="color:#eab308">${dengeli}</span><span class="denge-stat-lbl">🟡 dengeli</span></div>
        <div class="denge-stat"><span class="denge-stat-val" style="color:#ef4444">${tekTarafli}</span><span class="denge-stat-lbl">🔴 tek taraflı</span></div>
      </div>
      <svg class="denge-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <line x1="${PX}" y1="${zeroY.toFixed(1)}" x2="${W - PX}" y2="${zeroY.toFixed(1)}" class="denge-zero-line"/>
        ${bars}
        ${n > 1 ? `<polyline points="${trendPts}" class="denge-trend-line" fill="none"/>` : ''}
        ${labels}
      </svg>
      <div class="denge-list">${listRows}</div>`;
  };

  if (state.matchesData) { renderContent(state.matchesData); return; }

  el.innerHTML = '<div class="no-data"><span class="spin"></span>Yükleniyor...</div>';
  const cached = lGet('hs_matches_cache');
  if (cached) {
    try { state.matchesData = normalizeMatchesData(JSON.parse(cached)); renderContent(state.matchesData); } catch (e) {}
  }
  gs({ action: 'getMatches' }).then(data => {
    const normalized = normalizeMatchesData(data);
    lSet('hs_matches_cache', JSON.stringify(normalized));
    state.matchesData = normalized;
    renderContent(normalized);
  }).catch(() => {
    if (!state.matchesData) el.innerHTML = '<div class="no-data">Veri yüklenemedi.</div>';
  });
}
```

- [ ] **Step 2: Verify denge tab renders with real data**

Navigate to İstatistik → Denge. Expected:
- 4-column summary row: ort. fark, çekişmeli count, dengeli count, tek taraflı count
- SVG bar chart: positive bars green (team 1 wins), negative bars red (team 2 wins), dashed zero line
- Match list in reverse chronological order, each row showing week / score / diff / badge
- Trend polyline visible when >1 match

If no match data in the GAS sheet yet: "Henüz maç kaydı yok." message.

- [ ] **Step 3: Commit**
```bash
git add js/stats.js
git commit -m "feat: implement renderDenge with SVG chart and match balance table"
```

---

### Task 6: Denge CSS

**Files:**
- Modify: `css/main.css`

- [ ] **Step 1: Append Denge styles to css/main.css**

Append to the end of `css/main.css`:
```css
/* ── Denge Ekranı ───────────────────────────────────────────────────────────── */
.denge-summary {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 8px; margin-bottom: 16px;
}
.denge-stat {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: var(--bg2); border-radius: var(--rs);
  padding: 12px 6px; border: 1px solid var(--border); box-shadow: var(--sh-card);
}
.denge-stat-val { font-size: 22px; font-weight: 900; color: var(--text); letter-spacing: -0.5px; line-height: 1; }
.denge-stat-lbl { font-size: 9px; font-weight: 800; color: var(--text3); text-transform: uppercase; letter-spacing: 0.3px; text-align: center; }
.denge-chart { width: 100%; display: block; margin-bottom: 16px; overflow: visible; }
.denge-zero-line { stroke: var(--text3); stroke-width: 1; stroke-dasharray: 3 3; }
.denge-trend-line { stroke: var(--text2); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; opacity: 0.45; }
.denge-chart-lbl { font-size: 8px; font-weight: 700; fill: var(--text3); }
.denge-list { display: flex; flex-direction: column; gap: 8px; }
.denge-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg2); border-radius: var(--rs);
  padding: 10px 14px; border: 1px solid var(--border); box-shadow: var(--sh);
}
.denge-week { font-size: 11px; font-weight: 800; color: var(--green); background: var(--gd); padding: 3px 8px; border-radius: 8px; flex-shrink: 0; border: 1px solid #10b98130; }
.denge-score { font-size: 16px; font-weight: 900; color: var(--text); letter-spacing: -0.5px; flex: 1; text-align: center; }
.denge-diff { font-size: 13px; font-weight: 800; width: 32px; text-align: center; flex-shrink: 0; }
.denge-diff.pos { color: var(--green); }
.denge-diff.neg { color: #ef4444; }
.denge-diff.zero { color: var(--text3); }
.denge-badge { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 10px; flex-shrink: 0; white-space: nowrap; }
.denge-badge.cekismeli { background: var(--gl); color: var(--green); }
.denge-badge.dengeli { background: #fefce8; color: #713f12; }
.denge-badge.tektarafli { background: #fff1f2; color: #9f1239; }
body.dark .denge-badge.dengeli { background: #1c1400; color: #fde68a; }
body.dark .denge-badge.tektarafli { background: #1f0a0a; color: #fca5a5; }
```

- [ ] **Step 2: Final verification checklist**

- [ ] Denge tab: summary stats, SVG chart, match list all styled correctly in light mode
- [ ] Dark mode toggle: all denge colors adapt correctly
- [ ] Draft banner: amber in light, dark-amber in dark mode; buttons styled
- [ ] Move sliders → refresh page → amber banner appears → Devam Et restores values
- [ ] Move sliders → submit → `hs_draft_*` key is gone from localStorage
- [ ] Reset identity → `hs_draft_*` key is gone from localStorage
- [ ] No console errors on any tab

- [ ] **Step 3: Commit**
```bash
git add css/main.css
git commit -m "feat: add Denge tab and draft banner CSS"
```
