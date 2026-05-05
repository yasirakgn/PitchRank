# Cyber Dark Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add animated background orbs, cinematic screen transitions, neon nav glow, and count-up number animation to give PitchRank a futuristic premium feel.

**Architecture:** Four independent CSS/JS additions. Background uses GPU-accelerated `transform` animations on dedicated `.bg-orb` divs (not `filter` or `background` animation on body). Screen transitions upgrade existing `@keyframes`. Nav glow uses CSS `filter: drop-shadow` + `@keyframes navPulse`. Count-up is a plain `requestAnimationFrame` loop exported from `utils.js`.

**Tech Stack:** Vanilla CSS (no `@property` needed — uses `transform` only), Vanilla JS `requestAnimationFrame`.

---

## File Map

| File | Change |
|------|--------|
| `index.html` | Add `.bg-orbs` div as first child of `<body>` |
| `css/base.css` | Add `--glow-*` tokens; simplify `body`/`body.dark` background; add `.bg-orb` styles + `@keyframes orbFloat-*` |
| `css/main.css` | Upgrade `screenLeave`/`screenEnter` keyframes; add `.screen` `will-change`; add nav glow + `@keyframes navPulse` |
| `js/utils.js` | Add and export `countUp(el, target, duration)` |
| `js/main.js` | Import `countUp`; wire to `.fc-rating` in `makeFifaCard` and `.pmo-rating-num` in `openProfile` |

---

## Task 1: Add glow tokens + animated orb background

**Files:**
- Modify: `index.html:107` (add `.bg-orbs` div)
- Modify: `css/base.css:1-71` (tokens + body background + orb styles)

### Steps

- [ ] **Step 1: Add `.bg-orbs` div as first child of `<body>` in `index.html`**

Insert immediately after `<body class="dark">`:

```html
  <div class="bg-orbs" aria-hidden="true">
    <div class="bg-orb bg-orb-a"></div>
    <div class="bg-orb bg-orb-b"></div>
  </div>
```

- [ ] **Step 2: Add `--glow-*` tokens to `:root` in `css/base.css`**

Add inside `:root { }` after `--rs: 12px;`:

```css
  --glow-green:     rgba(16,201,135,0.5);
  --glow-green-dim: rgba(16,201,135,0.18);
  --glow-blue:      rgba(85,120,255,0.4);
  --glow-blue-dim:  rgba(85,120,255,0.15);
  --glow-gold:      rgba(245,188,75,0.5);
```

- [ ] **Step 3: Add `--glow-*` tokens to `.dark` in `css/base.css`**

Add inside `.dark { }` after `--sh-card: ...`:

```css
  --glow-green:     rgba(33,230,154,0.65);
  --glow-green-dim: rgba(33,230,154,0.22);
  --glow-blue:      rgba(108,134,255,0.55);
  --glow-blue-dim:  rgba(108,134,255,0.18);
  --glow-gold:      rgba(247,200,91,0.55);
```

- [ ] **Step 4: Simplify `body` background to base gradient only in `css/base.css`**

Replace current `body { background: radial-gradient(...), radial-gradient(...), linear-gradient(...); }` with:

```css
body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(180deg, var(--bg), #E9EEF8 100%);
  color: var(--text);
  min-height: 100vh;
  transition: background .3s, color .3s;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 5: Simplify `body.dark` background in `css/base.css`**

Replace current `body.dark { background: radial-gradient(...) × 3, linear-gradient(...); }` with:

```css
body.dark {
  background: linear-gradient(180deg, #070A14 0%, #04060D 100%);
}
```

- [ ] **Step 6: Add `.bg-orbs`, `.bg-orb`, and `@keyframes` to end of `css/base.css`**

Append after the last line:

```css
/* ── Animated background orbs ──────────────────────────── */
.bg-orbs {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.bg-orb {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
  filter: blur(80px);
}
.bg-orb-a {
  width: 70vw;
  height: 70vw;
  left: -20vw;
  top: -20vw;
  background: rgba(16,201,135,0.13);
  animation: orbFloat-a 16s ease-in-out infinite alternate;
}
.bg-orb-b {
  width: 60vw;
  height: 60vw;
  right: -15vw;
  top: -8vw;
  background: rgba(85,120,255,0.09);
  animation: orbFloat-b 22s ease-in-out infinite alternate;
}
.dark .bg-orb-a { background: rgba(33,230,154,0.15); }
.dark .bg-orb-b { background: rgba(108,134,255,0.13); }

@keyframes orbFloat-a { to { transform: translate(14vw, 24vh); } }
@keyframes orbFloat-b { to { transform: translate(-16vw, 18vh); } }
```

- [ ] **Step 7: Verify visually in browser**

Open `http://localhost:3000`, switch to dark mode. Two soft glowing orbs should drift slowly in the background — green top-left, blue top-right. They should be subtle, not distracting.

- [ ] **Step 8: Commit**

```
git add index.html css/base.css
git commit -m "feat: animated background orbs + glow CSS tokens"
```

---

## Task 2: Upgrade screen transition animations

**Files:**
- Modify: `css/main.css:137-150` (screen animation rules and keyframes)

### Steps

- [ ] **Step 1: Add `will-change` to `.screen` rule in `css/main.css`**

Change:
```css
.screen { display: none; }
.screen.active { display: block; }
```

To:
```css
.screen { display: none; }
.screen.active { display: block; will-change: opacity, transform, filter; }
```

- [ ] **Step 2: Update `.screen.leaving` and `.screen.is-entering` timing in `css/main.css`**

Change:
```css
.screen.leaving { animation: screenLeave 0.18s ease forwards; pointer-events: none; }
.screen.is-entering { animation: screenEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
#screen-profil.is-entering { animation: screenSlideUp 0.44s cubic-bezier(0.16, 1, 0.3, 1) both; }
```

To:
```css
.screen.leaving { animation: screenLeave 0.2s ease forwards; pointer-events: none; }
.screen.is-entering { animation: screenEnter 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
#screen-profil.is-entering { animation: screenSlideUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) both; }
```

- [ ] **Step 3: Upgrade `screenEnter` and `screenLeave` keyframes in `css/main.css`**

Change:
```css
@keyframes screenEnter  { from { opacity: 0; transform: translateY(22px); }  to { opacity: 1; transform: translateY(0); } }
@keyframes screenLeave  { from { opacity: 1; transform: translateY(0); }      to { opacity: 0; transform: translateY(-8px); } }
```

To:
```css
@keyframes screenEnter { from { opacity: 0; transform: scale(0.97) translateY(14px); filter: blur(3px); } to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); } }
@keyframes screenLeave { from { opacity: 1; transform: scale(1); filter: blur(0px); } to { opacity: 0; transform: scale(0.97); filter: blur(4px); } }
```

- [ ] **Step 4: Verify in browser**

Navigate between tabs. Each screen exit should blur and scale down; each entry should unblur and scale up. Should feel cinematic, not laggy (total cycle < 520ms).

- [ ] **Step 5: Commit**

```
git add css/main.css
git commit -m "feat: cinematic screen transitions — blur+scale enter/leave"
```

---

## Task 3: Bottom nav neon glow

**Files:**
- Modify: `css/main.css` — active nav icon and indicator glow

The existing relevant CSS is at lines ~98–112 and ~1124–1142 (there are two blocks — base styles and enhanced styles). Both need updating.

### Steps

- [ ] **Step 1: Add glow to active icon in both `.bnav-item.active .bnav-icon` rules**

Find the first occurrence (around line 112):
```css
.bnav-item.active .bnav-icon { transform: scale(1.15) translateY(-1px); }
```
Replace with:
```css
.bnav-item.active .bnav-icon { transform: scale(1.15) translateY(-1px); filter: drop-shadow(0 0 6px var(--glow-green)) drop-shadow(0 0 16px var(--glow-green-dim)); transition: filter 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
```

Find the second occurrence (around line 1153 in the enhanced block, same selector):
```css
.bnav-item.active .bnav-icon { ... }
```
Add the same `filter` and `transition` update there too.

- [ ] **Step 2: Add `@keyframes navPulse` to `css/main.css`**

Append after the last `@keyframes` in the file:

```css
@keyframes navPulse {
  0%, 100% { box-shadow: 0 0 8px var(--glow-green-dim), inset 0 0 0 rgba(0,0,0,0); }
  50%       { box-shadow: 0 0 18px var(--glow-green), 0 0 32px var(--glow-green-dim); }
}
```

- [ ] **Step 3: Wire `navPulse` to the active nav indicator in `.dark .bnav-item.active::before`**

Find:
```css
.dark .bnav-item.active::before {
  background: rgba(16,185,129,0.12);
  box-shadow: 0 0 16px rgba(16,185,129,0.1);
}
```
Replace with:
```css
.dark .bnav-item.active::before {
  background: rgba(33,230,154,0.1);
  animation: navPulse 1.8s ease-in-out infinite;
}
```

- [ ] **Step 4: Verify in browser (dark mode)**

Tap each nav item. Active icon should have a soft neon glow halo. The background pill should pulse gently. In light mode it should be subtle but not invisible.

- [ ] **Step 5: Commit**

```
git add css/main.css
git commit -m "feat: neon glow on active bottom nav — drop-shadow + pulse animation"
```

---

## Task 4: Count-up number animation

**Files:**
- Modify: `js/utils.js` (add `countUp`)
- Modify: `js/main.js` (import + wire to FIFA card and profile modal)

### Steps

- [ ] **Step 1: Add `countUp` to `js/utils.js`**

Append after the last export in `utils.js`:

```js
export function countUp(el, target, duration = 550) {
  if (!el || target <= 0) return;
  const start = performance.now();
  const step = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(ease * target);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

- [ ] **Step 2: Add `countUp` to the import in `js/main.js`**

Find (line 4):
```js
import { escHtml, normPos, posLabel, san, getPlayerPhoto, getWeekLabel, getAutoWeekLabel, formatMoney, scoreColor, ratingColor, cardClass, showToast, showConfirm, closeConfirm } from './utils.js';
```

Replace with:
```js
import { escHtml, normPos, posLabel, san, getPlayerPhoto, getWeekLabel, getAutoWeekLabel, formatMoney, scoreColor, ratingColor, cardClass, showToast, showConfirm, closeConfirm, countUp } from './utils.js';
```

- [ ] **Step 3: Wire `countUp` to `.fc-rating` in `makeFifaCard` in `js/main.js`**

Find the last two lines of `makeFifaCard` (currently):
```js
  card.onclick = () => openProfile(p, data);
  return card;
```

Replace with:
```js
  card.onclick = () => openProfile(p, data);
  const ratingEl = card.querySelector('.fc-rating');
  if (ratingEl && rating > 0) {
    ratingEl.textContent = '0';
    requestAnimationFrame(() => countUp(ratingEl, rating));
  }
  return card;
```

- [ ] **Step 4: Wire `countUp` to `.pmo-rating-num` in `openProfile` in `js/main.js`**

Find the last line of `openProfile`:
```js
  modalBg.classList.add('open');
```

Replace with:
```js
  modalBg.classList.add('open');
  requestAnimationFrame(() => {
    const rNum = profileHero.querySelector('.pmo-rating-num');
    if (rNum && rating > 0) { rNum.textContent = '0'; countUp(rNum, rating, 700); }
  });
```

- [ ] **Step 5: Verify in browser**

Open Lig tab — FIFA card ratings should count up from 0 when the ranking loads. Tap a card — the profile modal rating should count up from 0 when it opens.

- [ ] **Step 6: Commit**

```
git add js/utils.js js/main.js
git commit -m "feat: count-up animation on FIFA card and profile modal ratings"
```

---

## Task 5: Final visual check

- [ ] **Step 1: Check all 4 effects together in dark mode**

  - Background orbs drifting: ✓
  - Screen transitions blur+scale: ✓
  - Nav glow pulses on active item: ✓
  - Ratings count up on render: ✓

- [ ] **Step 2: Check light mode**

  Orbs visible but subtle. Nav glow softer. Everything readable.

- [ ] **Step 3: Check performance — no jank**

  Navigate rapidly between tabs. Screen transitions should stay smooth. If orbs cause paint jank, reduce `filter: blur(80px)` to `60px` on `.bg-orb`.
