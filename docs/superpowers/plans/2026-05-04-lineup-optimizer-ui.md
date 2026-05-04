# Lineup Optimizer UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `<select>` dropdown + button UI in `#screen-takim` with 4 preset buttons (Dengeli/Hücum/Savunma/Hızlı) that each directly trigger the optimal lineup.

**Architecture:** `buildOptimalLineup()` in `main.js` already contains the full logic and is exported to `window`. The only changes are: (1) HTML — swap dropdown+button for 4 preset buttons; (2) JS — update `buildOptimalLineup` to accept a `presetKey` string arg and toggle `.active` on the clicked button; (3) CSS — add `.preset-btn` and `.preset-btn.active` styles.

**Tech Stack:** Vanilla JS, HTML, CSS — no new libraries, no new modules.

---

## File Map

| File | Change |
|------|--------|
| `components/app.html` | Replace `<select id="lineupPreset">` + `<button onclick="buildOptimalLineup()">` with 4 `.preset-btn` buttons |
| `js/main.js` | Update `buildOptimalLineup(presetKey)` signature; remove `lineupPreset` select reference; add active button toggle |
| `css/main.css` | Add `.preset-btn` base style + `.preset-btn.active` highlight |

---

## Task 1: Update `buildOptimalLineup` in `main.js`

**Files:**
- Modify: `js/main.js:566-597`

Current signature reads `document.getElementById('lineupPreset').value`. Change it to accept `presetKey` directly and highlight the active button.

- [ ] **Step 1: Open `js/main.js` and replace `buildOptimalLineup` function (lines 566–597)**

Replace:
```js
function buildOptimalLineup() {
  const selectEl = document.getElementById('lineupPreset');
  const presetKey = (selectEl && selectEl.value) || 'dengeli';
```

With:
```js
function buildOptimalLineup(presetKey = 'dengeli') {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.preset-btn[data-preset="${presetKey}"]`);
  if (activeBtn) activeBtn.classList.add('active');
```

- [ ] **Step 2: Verify the rest of the function is unchanged**

Lines after the replaced block (577–597) remain identical — no further edits needed in this function.

- [ ] **Step 3: Commit**

```
git add js/main.js
git commit -m "feat: buildOptimalLineup accepts preset arg, toggles active button"
```

---

## Task 2: Replace dropdown with 4 preset buttons in `app.html`

**Files:**
- Modify: `components/app.html:145-153`

- [ ] **Step 1: Open `components/app.html` and replace lines 145–153**

Replace the entire `<div class="tk-action-row" style="margin-top:10px;align-items:center;">` block (the one containing `<select id="lineupPreset">` and the `buildOptimalLineup` button) with:

```html
    <div class="tk-preset-row">
      <button class="preset-btn" data-preset="dengeli" onclick="buildOptimalLineup('dengeli')" type="button">⚖️ Dengeli</button>
      <button class="preset-btn" data-preset="hucum" onclick="buildOptimalLineup('hucum')" type="button">⚔️ Hücum</button>
      <button class="preset-btn" data-preset="savunma" onclick="buildOptimalLineup('savunma')" type="button">🛡️ Savunma</button>
      <button class="preset-btn" data-preset="hizli" onclick="buildOptimalLineup('hizli')" type="button">⚡ Hızlı</button>
    </div>
```

- [ ] **Step 2: Commit**

```
git add components/app.html
git commit -m "feat: replace lineup preset dropdown with 4 direct preset buttons"
```

---

## Task 3: Add CSS for preset buttons

**Files:**
- Modify: `css/main.css` (append to end)

- [ ] **Step 1: Append styles to `css/main.css`**

```css
/* Lineup optimizer preset buttons */
.tk-preset-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.preset-btn {
  flex: 1;
  padding: 11px 6px;
  border-radius: 14px;
  border: 1.5px solid var(--border);
  background: var(--bg2);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.preset-btn:hover {
  background: var(--bg3);
}
.preset-btn.active {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
```

- [ ] **Step 2: Commit**

```
git add css/main.css
git commit -m "feat: add preset-btn styles for lineup optimizer"
```

---

## Task 4: Manual verification

No automated tests exist in this project — verify in browser.

- [ ] **Step 1: Start dev server**

```
npx serve .
```

Open `http://localhost:3000`, select a team.

- [ ] **Step 2: Go to Takım screen**

Confirm the old dropdown + "Optimal 5'li" button is gone. Four new buttons (⚖️ Dengeli, ⚔️ Hücum, 🛡️ Savunma, ⚡ Hızlı) appear in a row.

- [ ] **Step 3: Test happy path**

Select 5+ players (with at least 1 KL, 1 FRV). Click each preset button. Verify:
- Clicked button gets highlighted (`.active`)
- Result card appears below showing 5 players with position + score
- Switching presets updates both the highlight and the result

- [ ] **Step 4: Test error path**

Select fewer than 5 players, click a preset button. Verify the "En az 4 oyuncu seçin" message appears (existing `#noDataTakim` behavior).

- [ ] **Step 5: Test dark mode**

Toggle dark mode. Verify preset buttons and result card look correct.
