# Cyber Dark Foundation — Design Spec
Date: 2026-05-05
Faz: 1 / 3

## Goal

Transform PitchRank's visual foundation from a competent utility app into a premium, futuristic sports experience — "Cyber Dark" aesthetic. Four targeted improvements with high visual impact and zero functional regression.

## Aesthetic Direction

**Cyber Dark:** Dark-first. Electric green (`#21E69A`) as the primary glow color, electric blue (`#6C86FF`) as secondary. Moving energy in the background. Neon halo on active UI. Numbers that feel alive.

---

## Section 1: Animated Background

**What:** Replace the static `radial-gradient` body background with 3 independently drifting radial gradients animated via `@keyframes`. Each orb moves on its own path and timeline (12s / 17s / 22s), creating a slow "energy field" effect. Opacity kept low (0.18–0.22) so it never distracts from content.

**Files:** `css/base.css`

**Dark mode orbs:**
- Orb A: green (`#21E69A`) — drifts top-left ↔ center-left
- Orb B: blue (`#6C86FF`) — drifts top-right ↔ top-center
- Orb C: green tint — anchored bottom-center, subtle pulse

**Light mode:** Same structure but orbs use very soft pastel tones (opacity 0.10–0.14) — barely visible, not distracting.

**Implementation:** CSS `@property` (Houdini) to register custom properties for each orb's X/Y position, then animate those properties with `@keyframes`. `radial-gradient(circle at var(--orb-a-x) var(--orb-a-y), ...)` in body `background`. No JS, no canvas, no extra DOM elements. Browser support: Chrome 85+, Firefox 128+, Safari 16.4+ — covers all modern mobile browsers.

---

## Section 2: Screen Transition Upgrade

**What:** Current transitions exist (`screenLeave`/`screenEnter` keyframes) but are plain opacity+Y. Upgrade to feel more cinematic: outgoing screen blurs slightly and fades, incoming screen comes from a slight scale(0.97)→scale(1) with opacity.

**Files:** `css/main.css` (update existing keyframes and `.screen.leaving`, `.screen.is-entering`)

**New keyframes:**
```
screenLeave:  opacity 1 + blur(0) + scale(1) → opacity 0 + blur(4px) + scale(0.97), 200ms
screenEnter:  opacity 0 + scale(0.97) → opacity 1 + scale(1), 300ms ease-out
```

**Timing:** Leave 200ms (up from 180ms), Enter 300ms (down from 400ms) — snappier overall.

**Note:** `backdrop-filter` blur on a full screen is GPU-heavy on low-end phones. Use `filter: blur()` on the screen element instead (cheaper). Keep `will-change: opacity, transform` on `.screen`.

---

## Section 3: Bottom Nav Neon Glow

**What:** Active nav item gets a neon glow aura. Three additions:

1. **Active icon glow:** `filter: drop-shadow(0 0 8px var(--glow-green)) drop-shadow(0 0 18px var(--glow-green-dim))` on `.bnav-item.active .bnav-icon`
2. **Active indicator:** The existing `::before` dot gets `box-shadow: 0 0 6px 2px var(--glow-green)` + a slow `@keyframes navPulse` (1.8s infinite, glow intensity oscillates)
3. **Active label:** `color: var(--green)` already exists — add `text-shadow: 0 0 8px var(--glow-green-dim)`

**New CSS tokens (added to `:root` and `.dark` in `base.css`):**
```css
--glow-green:     rgba(33,230,154,0.7);
--glow-green-dim: rgba(33,230,154,0.25);
--glow-blue:      rgba(108,134,255,0.6);
--glow-blue-dim:  rgba(108,134,255,0.2);
--glow-gold:      rgba(247,200,91,0.6);
```

**Light mode:** Glow effects use 40% of dark-mode intensity — visible but not garish.

---

## Section 4: Count-Up Number Animation

**What:** Rating numbers, scores, and stat values "count up" from 0 to their target value on first render. Creates a satisfying "scanning" feel — like a sports HUD locking onto data.

**Files:** `js/utils.js` (add `countUp`), call sites in `js/main.js` (FIFA cards, profile modal rating)

**Function signature:**
```js
export function countUp(el, target, duration = 550)
```

**Behavior:**
- Uses `requestAnimationFrame`
- Easing: `easeOutExpo` — fast at start, decelerates at end
- `target` is always an integer (0–99 for ratings)
- Sets `el.textContent = Math.round(current)` each frame
- Cancels if element is removed from DOM (safety check)
- Only fires if `target > 0` and element is visible

**Call sites:**
- `makeFifaCard` in `main.js`: after card is appended to DOM, run `countUp` on `.fc-rating` element
- `openProfile` in `main.js`: run `countUp` on `.pmo-rating-num` element after modal opens

**Why only these two:** The most impactful and most visible numbers. Expanding to all stat bars is Faz 3.

---

## Files Changed

| File | Change |
|------|--------|
| `css/base.css` | Animated background orbs, new `--glow-*` CSS tokens |
| `css/main.css` | Upgraded screen transition keyframes, nav glow styles, `@keyframes navPulse` |
| `js/utils.js` | Add and export `countUp(el, target, duration)` |
| `js/main.js` | Call `countUp` on FIFA card rating and profile modal rating |

## Out of Scope (Faz 2+)

- Skeleton loading screens
- Chart animations
- Count-up on all stat numbers
- Screen-specific entry animations (not just generic)
- PWA install prompt redesign
