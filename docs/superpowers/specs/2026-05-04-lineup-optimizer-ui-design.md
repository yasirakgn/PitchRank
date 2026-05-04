# Lineup Optimizer UI — Design Spec
Date: 2026-05-04

## Problem

`lineup-optimizer.js` (`findOptimalLineup`) is fully implemented but not surfaced anywhere in the UI. Users cannot access optimal lineup suggestions.

## Goal

Add an "Optimal 5'li" section to the Takım screen (`#screen-takim`) that lets users pick a tactical preset and see the best 5-player lineup from today's selected players.

## Scope

- UI only — no changes to `lineup-optimizer.js` algorithm
- Works with existing `state.todaySelected` (players marked present today)
- No new GAS calls, no new state fields

## Design

### 1. HTML (`components/app.html`)

Add a new section at the bottom of `#screen-takim`, after the existing player selection list:

```html
<div id="lineup-optimizer-section">
  <h3 class="section-title">Optimal 5'li</h3>
  <div class="preset-buttons">
    <button class="preset-btn btn btn-secondary" onclick="runLineupOptimizer('dengeli')">Dengeli</button>
    <button class="preset-btn btn btn-secondary" onclick="runLineupOptimizer('hucum')">Hücum</button>
    <button class="preset-btn btn btn-secondary" onclick="runLineupOptimizer('savunma')">Savunma</button>
    <button class="preset-btn btn btn-secondary" onclick="runLineupOptimizer('hizli')">Hızlı</button>
  </div>
  <div id="lineup-result"></div>
</div>
```

Buttons use the existing `.btn` / `.btn-secondary` CSS classes. Active preset button gets an `.active` highlight class toggled on click.

### 2. Logic (`main.js`)

Import `findOptimalLineup` from `lineup-optimizer.js` at the top of `main.js`.

New function `runLineupOptimizer(preset)`:

1. Read `state.todaySelected` — collect player names where value is `true`
2. Cross-reference with `state.players` to get full player objects `{ name, pos }`
3. If fewer than 5 available → `showToast("En az 5 oyuncu seçin")` and return
4. Call `findOptimalLineup(available, preset)`
5. If result is null/empty → `showToast("Uygun kadro bulunamadı")` and return
6. Render result into `#lineup-result`: 5 player cards showing name, position label (`posLabel(pos)`), and overall score from `state.sonucData` if available

Export: `window.runLineupOptimizer = runLineupOptimizer`

### 3. Result Rendering

Each player in the result renders as a small card:

```
[ KL ] Ahmet     88
[ DEF ] Mehmet   82
...
```

Uses `escHtml()` for all player names. Positions use `posLabel()` from `utils.js`. Overall scores pulled from `state.sonucData` — look up by player name (`entry.player === name`), use `entry.score` field (0–99 integer). If `state.sonucData` is null or player not found, omit the score entirely (don't show 0).

### 4. Active Preset Highlight

On each call to `runLineupOptimizer`, remove `.active` from all preset buttons, add `.active` to the clicked one. This is handled inside the function via `document.querySelectorAll('.preset-btn')`.

## Error Handling

| Condition | Behavior |
|-----------|----------|
| < 5 players selected | `showToast("En az 5 oyuncu seçin")` |
| `findOptimalLineup` returns null | `showToast("Uygun kadro bulunamadı")` |
| `state.players` not loaded | `showToast("Önce oyuncuları yükleyin")` |

## Files Changed

| File | Change |
|------|--------|
| `components/app.html` | Add `#lineup-optimizer-section` to `#screen-takim` |
| `js/main.js` | Import `findOptimalLineup`, add + export `runLineupOptimizer` |
| `css/main.css` | Add styles for `#lineup-optimizer-section`, `.preset-btn`, `.preset-btn.active`, `#lineup-result` |

## Out of Scope

- Saving or sharing the lineup result
- Real-time re-optimization as players are toggled
- Preset descriptions/tooltips
