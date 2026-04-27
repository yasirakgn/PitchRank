# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

```bash
# Local dev server (http://localhost:3000)
npx serve .

# Deploy: push to Vercel — no build step, pure static files
```

There is no build, transpile, or bundle step. All files are served as-is.

## Architecture

**PitchRank** is a vanilla JS single-page PWA for halı saha / futsal player rating and statistics. It supports two teams (Haldunalagaş and Arion FC), each backed by a separate Google Apps Script deployment.

### Boot flow

1. `index.html` loads a single `<script type="module" src="js/boot.js?v=3.0">`
2. `boot.js` fetches every `[data-include]` element's HTML file and injects it into the DOM
3. After all components are injected, `boot.js` calls `initApp()` (imported directly from `main.js`)
4. `initApp()` reads `localStorage` for `pitchrank_selected_team`:
   - **null** → shows `#screen-home` (team selection), hides app and nav
   - **set** → hides home, shows `#app` and `.bottom-nav`, runs the full app

### Module structure

```
js/
  boot.js      ← ES module entry point; fetches data-include components, calls initApp()
  main.js      ← initApp, makeFifaCard, openProfile, screen nav, tactics, all window.* exports
  config.js    ← pure constants: TEAM_CONFIG, CRITERIA, POS_WEIGHTS, etc.
  storage.js   ← CURRENT_TEAM, lGet/lSet/lRem, sGet/sSet/sRem, getGS
  state.js     ← shared mutable state object + PLAYERS_VERSION cache invalidation
  utils.js     ← escHtml, normPos, posLabel, san, getWeekLabel, showToast, showConfirm, etc.
  api.js       ← gs(params) — GET requests to GAS with 2 retries
  rating.js    ← calcStdDev, posRating, calcMarketValue, getPlayStyles
  players.js   ← loadPlayersFromSheets, buildCards, onSlider, submitRatings, etc.
  stats.js     ← loadResults, renderSonuc/RankTab/Hafta/Trend/Comparison/Sezon/Katilim
  admin.js     ← PIN auth, player management, bugün/hakem/video/week admin tabs
components/
  home.html    ← team picker
  app.html     ← main app screens (puanla, siralama, istatistik, takim, yayin)
  nav.html     ← bottom navigation bar
  modals.html  ← all modal dialogs (profile, pin, confirm, teamConfirm, success)
  toast.html   ← toast notification container
css/
  base.css     ← CSS variables, reset, shared primitives
  main.css     ← component styles
app gs.txt     ← Google Apps Script source (copy into GAS editor to deploy)
```

### Module dependency graph (strict DAG, no cycles)

```
config ← storage ← state ← utils ← api ← rating
                                              ↓
                              stats ←──── players
                                ↓
                              admin → main → boot
```

Each module only imports from modules to its left/above. `admin.js` avoids a circular dep with `main.js` by calling `window.switchMainScreen(...)` at runtime instead of importing it.

### Shared state

All mutable app state lives in the exported `state` object (`js/state.js`). Modules mutate it directly — no setters. Key fields:

```js
state.players          // array of { name, pos, photo }
state.resultData       // cached GAS getResults response
state.darkMode         // boolean, persisted to localStorage
state.manualWeek       // null or 'YYYY-HWW' override
state.currentRater     // selected player identity
state.sonucData        // last loaded ranking data
state.todaySelected    // { [playerName]: boolean } for team builder
```

Storage keys are always prefixed with the active team ID via `getStorageKey(key)` in `storage.js`, e.g. `"haldunalagas_hs_players"`. `PLAYERS_VERSION` (currently `'6'`) in `config.js` triggers a full cache wipe when bumped — increment it whenever the player data schema changes.

### Window exports

All `~50` functions called from HTML `onclick=` attributes are assigned to `window` at the bottom of `main.js`. When adding a new HTML-callable function to any module, import it in `main.js` and add `window.fnName = fnName` there.

### Adding a new team

1. Create a new Google Sheet and deploy a copy of `app gs.txt` as a Web App
2. Add an entry to `TEAM_CONFIG` in `js/config.js` with `id`, `name`, `emoji`, `color`, `logo`, `gs`
3. Add a button to `components/home.html` calling `showTeamConfirm('newTeamId')`

### Google Apps Script (backend)

`gs(params)` in `js/api.js` sends GET requests to the active team's GAS endpoint. The GAS `doGet(e)` router dispatches on `e.parameter.action`.

Key rules for the GAS file (`app gs.txt`):
- `SHEET_ID` must be just the spreadsheet ID, not the full URL
- `e.parameter` values are already URL-decoded — never double-decode with `decodeURIComponent()`
- Deploy with "Execute as: Me" and "Who has access: Anyone"

### XSS and event handlers

All player names rendered into `innerHTML` must go through `escHtml(s)`. For `onclick` attributes, prefer `data-*` attributes read in the handler (`this.dataset.name`) over interpolating values directly into the attribute string.

### Screens and navigation

The main app has 5 screens switched via `switchMainScreen(name, btn)`: `puanla`, `siralama`, `istatistik`, `takim`, `yayin`. Each maps to a `#screen-{name}` element inside `app.html`. When switching to `siralama`, `switchMainScreen` calls `renderSonuc(makeFifaCard)` — always pass the callback to avoid breaking the FIFA card grid. Statistics sub-screens use `setStatScreen()`.

### FIFA card rendering

`makeFifaCard(p, pObj, rank, data, overrideScore)` is defined in `main.js` and passed as a callback into `renderSonuc`/`renderRankTab` (in `stats.js`) to avoid a circular dependency. `stats.js` caches the last received callback in `_makeFifaCard` so `setRankTab` can re-render without needing a new reference.

### Modals

All modal overlays use `.mbg` + `.mbg.open` CSS classes. ESC key closes any open `.mbg` modal (global listener in `main.js`). Clicking the overlay backdrop closes it via `onclick="if(event.target===this)this.classList.remove('open')"`.

### Week format

Weeks are formatted as `YYYY-HWW` (e.g. `2026-H15`). Manual week override is stored in `state.manualWeek` (persisted to localStorage via `hs_manual_week`). `getWeekLabel()` in `utils.js` returns the manual week if set, otherwise computes the auto week. Reset with `resetWeekToAuto()` in `admin.js`.

### Rating system

Seven criteria: `Pas, Sut, Dribling, Savunma, Hiz / Kondisyon, Fizik, Takim Oyunu`. Position weights (`POS_WEIGHTS` in `config.js`) scale each criterion differently per position (KL, DEF, OMO, FRV). Scores are 1–10 sliders; overall rating is a weighted average scaled to 0–99.

### Deployment

`vercel.json` routes all paths to `index.html` (SPA fallback). Asset cache strategy: `assets/` → immutable (1 year), `css/` and `js/` → stale-while-revalidate (1 day fresh, 7 day stale). Bump `?v=X` query strings on CSS/JS links in `index.html` when deploying breaking changes.
