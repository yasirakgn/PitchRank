# PitchRank React + Tailwind Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate PitchRank from vanilla JS PWA to Vite + React 18 + Tailwind CSS + Zustand, preserving all existing features (rating, ranking, stats, profile, admin, lineup optimizer, PWA).

**Architecture:** Big Bang — new React project built at the existing repo root. Pure logic modules copy to `src/lib/` with minimal adaptation; UI rebuilt as React components; Zustand replaces `state.js`; `window.*` exports and `onclick=` attributes removed entirely.

**Tech Stack:** Vite 5, React 18 (JS), Tailwind CSS v3, Zustand 4, vite-plugin-pwa, Vitest (pure function tests)

---

## File Map

### Created
```
src/main.jsx
src/App.jsx
src/store/index.js
src/styles/custom.css
src/lib/config.js        (copy — unchanged)
src/lib/rating.js        (copy — unchanged)
src/lib/forecast.js      (copy — unchanged)
src/lib/anomaly.js       (copy — unchanged)
src/lib/storage.js       (adapted: CURRENT_TEAM becomes getCurrentTeam())
src/lib/utils.js         (adapted: remove DOM showToast/showConfirm; getPlayerPhoto/getWeekLabel accept params)
src/lib/api.js           (adapted: showToast via store.getState)
src/lib/dna.js           (adapted: import path fix)
src/lib/lineup-optimizer.js  (adapted: import path fix)
src/lib/players.js       (adapted: React-safe, no DOM refs)
src/lib/stats.js         (adapted: React-safe, no DOM refs)
src/hooks/usePlayers.js
src/hooks/useResults.js
src/components/ui/Toast.jsx
src/components/ui/BottomNav.jsx
src/components/ui/FifaCard.jsx
src/components/ui/FormStrip.jsx
src/components/ui/BadgeGrid.jsx
src/components/ui/CriteriaArcs.jsx
src/components/ui/DnaMatches.jsx
src/components/screens/HomeScreen.jsx
src/components/screens/PuanlaScreen.jsx
src/components/screens/SiralamaScreen.jsx
src/components/screens/IstatistikScreen.jsx
src/components/screens/TakimScreen.jsx
src/components/screens/ProfilScreen.jsx
src/components/screens/YayinScreen.jsx
src/components/modals/ConfirmModal.jsx
src/components/modals/PinModal.jsx
src/components/modals/SuccessModal.jsx
src/components/modals/TeamConfirmModal.jsx
src/admin/AdminPanel.jsx
src/admin/tabs/BugunTab.jsx
src/admin/tabs/HakemTab.jsx
src/admin/tabs/VideoTab.jsx
src/admin/tabs/WeekTab.jsx
src/admin/tabs/PlayersTab.jsx
vite.config.js
tailwind.config.js
src/test/utils.test.js
src/test/rating.test.js
src/test/forecast.test.js
src/test/anomaly.test.js
```

### Modified
```
package.json   — replace scripts, add all deps
index.html     — Vite entry point
vercel.json    — build output config
```

### Deleted (Task 15)
```
js/           boot.js, main.js, players.js, stats.js, admin.js, profile.js,
              state.js, api.js, config.js, rating.js, utils.js, storage.js,
              forecast.js, anomaly.js, dna.js, lineup-optimizer.js, sharecard.js
components/   app.html, home.html, nav.html, modals.html, toast.html
css/          base.css, main.css
app.html      (old root app.html)
```

---

## Task 1: Project Setup

**Files:**
- Modify: `package.json`
- Create: `vite.config.js`, `tailwind.config.js`, `index.html`
- Create: `src/main.jsx`

- [ ] **Step 1: Install dependencies**

```bash
npm install react react-dom zustand
npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer vite-plugin-pwa vitest @vitest/ui jsdom @testing-library/react
npx tailwindcss init -p
```

- [ ] **Step 2: Update `package.json`**

```json
{
  "name": "pitchrank",
  "version": "4.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```
Keep existing `description`, `keywords`, `author`, `license`. Remove old deps.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['assets/images/**'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 5: Replace `index.html`**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#060914" media="(prefers-color-scheme: dark)" />
  <meta name="theme-color" content="#F1F5FB" />
  <title>PitchRank</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/assets/images/icon-192.png" />
  <link rel="apple-touch-icon" href="/assets/images/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 6: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/custom.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite dev server at `http://localhost:5173` with blank page (no errors in console).

- [ ] **Step 8: Commit**

```bash
git add package.json vite.config.js tailwind.config.js index.html src/main.jsx
git commit -m "feat: vite + react + tailwind project setup"
```

---

## Task 2: CSS Foundation

**Files:**
- Create: `src/styles/custom.css`

- [ ] **Step 1: Create `src/styles/custom.css`**

Copy all of `css/base.css` and `css/main.css` into this file, then add at the top:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

The file should preserve all `:root` variables, `.dark` overrides, `body` background gradient, scrollbar styles, font declarations, and every existing CSS class. No removals at this stage — cleanup happens in Task 15.

- [ ] **Step 2: Verify styles load**

```bash
npm run dev
```
Open `http://localhost:5173`. Background should be the light blue gradient (CSS variables working). Dark mode class test: open DevTools console and run `document.documentElement.classList.add('dark')` — background should switch to dark.

- [ ] **Step 3: Commit**

```bash
git add src/styles/custom.css
git commit -m "feat: migrate css to src/styles/custom.css with tailwind directives"
```

---

## Task 3: Lib Modules

**Files:**
- Create: `src/lib/config.js`, `src/lib/rating.js`, `src/lib/forecast.js`, `src/lib/anomaly.js`, `src/lib/storage.js`, `src/lib/utils.js`, `src/lib/api.js`, `src/lib/dna.js`, `src/lib/lineup-optimizer.js`
- Create: `src/test/utils.test.js`, `src/test/rating.test.js`, `src/test/forecast.test.js`, `src/test/anomaly.test.js`

- [ ] **Step 1: Copy unchanged modules**

Copy `js/config.js` → `src/lib/config.js` (no changes needed).  
Copy `js/rating.js` → `src/lib/rating.js`, update import: `import { CRITERIA, POS_WEIGHTS } from './config.js'`.  
Copy `js/forecast.js` → `src/lib/forecast.js` (no imports to update).  
Copy `js/anomaly.js` → `src/lib/anomaly.js` (no imports to update).

- [ ] **Step 2: Create `src/lib/storage.js`**

Key change: `CURRENT_TEAM` becomes `getCurrentTeam()` — reads from sessionStorage each call so it stays in sync with React state.

```js
import { TEAM_CONFIG } from './config.js'

export function getCurrentTeam() {
  return sessionStorage.getItem('pitchrank_selected_team') || null
}

export function getStorageKey(key) {
  const team = getCurrentTeam()
  return team ? team + '_' + key : key
}

export function lGet(k) { return localStorage.getItem(getStorageKey(k)) }
export function lSet(k, v) { localStorage.setItem(getStorageKey(k), v) }
export function lRem(k) { localStorage.removeItem(getStorageKey(k)) }

export function sGet(k) { return sessionStorage.getItem(getStorageKey(k)) }
export function sSet(k, v) { sessionStorage.setItem(getStorageKey(k), v) }
export function sRem(k) { sessionStorage.removeItem(getStorageKey(k)) }

export function getGS() {
  const team = getCurrentTeam()
  if (!team || !TEAM_CONFIG[team]) return TEAM_CONFIG.haldunalagas.gs
  return TEAM_CONFIG[team].gs
}
```

- [ ] **Step 3: Create `src/lib/utils.js`**

Remove `showToast`, `showConfirm`, `closeConfirm` (they'll use the Zustand store).  
Remove `import { state }` — pass state as params instead.

```js
import { VALID_POS, POS, BASE_URL } from './config.js'

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

export function normPos(p) {
  let arr = Array.isArray(p.pos) ? p.pos : [p.pos || '']
  let valid = arr.filter(k => VALID_POS.includes(k))
  if (valid.length) return [valid[0]]
  const old = arr[0] || ''
  if (['GK','KL','SW'].includes(old)) return ['KL']
  if (['CB','RB','LB','RWB','LWB','STP','SAB','SOB','SABK','SOBK','DEF'].includes(old)) return ['DEF']
  if (['CDM','CM','CAM','RM','LM','DMO','AMO','SAO','SOO','OMO'].includes(old)) return ['OMO']
  if (['ST','CF','RW','LW','SS','SAN','FW','IKF','SKT','SOKT','FRV'].includes(old)) return ['FRV']
  return ['OMO']
}

export function posLabel(p) { return normPos(p).map(k => POS[k] || k).join(' / ') }
export function posShort(p) { return posLabel(p) }

export function toPhotoFilename(name) {
  const map = {'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u'}
  return String(name||'').toLowerCase().split('').map(c=>map[c]!==undefined?map[c]:(c===' '?'':c)).join('')+'.png'
}

export function san(s) {
  const map = {'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u'}
  return String(s||'').toLowerCase().split('').map(c=>map[c]!==undefined?map[c]:(c===' '?'_':c)).join('')
}

// players: pass state.players from component/hook
export function getPlayerPhoto(name, players = []) {
  const p = players.find(x => x.name === name)
  let photo = (p && p.photo) ? String(p.photo).trim() : ''
  if (!photo) photo = toPhotoFilename(name)
  let v = localStorage.getItem('hs_photo_version')
  if (!v) { v = Date.now().toString(); localStorage.setItem('hs_photo_version', v) }
  return photo ? BASE_URL + photo + '?v=' + v : ''
}

// manualWeek: pass state.manualWeek from component/hook
export function getWeekLabel(manualWeek = null) {
  if (manualWeek) return manualWeek
  const now = new Date(), start = new Date(now.getFullYear(), 0, 1)
  return now.getFullYear() + '-H' + String(Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)).padStart(2, '0')
}

export function getAutoWeekLabel() {
  const now = new Date(), start = new Date(now.getFullYear(), 0, 1)
  return now.getFullYear() + '-H' + String(Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)).padStart(2, '0')
}

export function formatMoney(value) {
  if (isNaN(value)) return '€0'
  if (value >= 1000000) return '€' + (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return '€' + Math.round(value / 1000) + 'K'
  return '€' + Math.round(value)
}

export function scoreColor(v) {
  if(v>=9) return '#10b981'; if(v>=7) return '#84cc16'; if(v>=5) return '#eab308'; if(v>=3) return '#f97316'; return '#ef4444'
}

export function ratingColor(r) {
  if (r >= 85) return { text: '#eab308', bar: '#efbc25' }
  if (r >= 75) return { text: '#94a3b8', bar: '#94a3b8' }
  if (r >= 65) return { text: '#d97706', bar: '#d97706' }
  return { text: '#3b82f6', bar: '#3b82f6' }
}

export function cardClass(r) {
  if (r >= 85) return 'fc-gold'; if (r >= 75) return 'fc-silver'
  if (r >= 65) return 'fc-bronze'; return 'fc-normal'
}
```

- [ ] **Step 4: Create `src/lib/api.js`**

Replace `showToast` import with a store reference:

```js
import { getGS, getCurrentTeam } from './storage.js'

export function gs(p) {
  return new Promise((resolve, reject) => {
    const runRequest = (retryCount = 0) => {
      const baseUrl = getGS()
      const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') +
        Object.keys(p).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(p[k])).join('&')
      console.log(`[PitchRank] 📡 ${p.action} isteği gönderiliyor:`, url)
      fetch(url, { method: 'GET', redirect: 'follow' })
        .then(r => { if (!r.ok) throw new Error(`HTTP Error: ${r.status}`); return r.json() })
        .then(data => { console.log(`[PitchRank] ✅ ${p.action} başarılı.`); resolve(data) })
        .catch(err => {
          if (retryCount < 2) {
            console.warn(`[PitchRank] ⏳ ${p.action} başarısız, tekrar deneniyor (${retryCount+1})...`)
            setTimeout(() => runRequest(retryCount + 1), 1500 * (retryCount + 1))
          } else {
            console.error(`[PitchRank] ❌ ${p.action} hatası:`, err)
            if (getCurrentTeam() === 'arion') {
              // Lazy import avoids circular dep — store is created after lib modules load
              import('../store/index.js').then(({ useStore }) => {
                useStore.getState().showToast('Arion FC bağlantı hatası!', true)
              })
            }
            reject(err)
          }
        })
    }
    runRequest()
  })
}
```

- [ ] **Step 5: Copy and fix `src/lib/dna.js`**

Copy `js/dna.js`. Update imports:

```js
import { CRITERIA } from './config.js'
import { normPos } from './utils.js'
```

Remove `import { state }`. Update `findSimilarPlayers` to accept `players` param:

```js
// Before: const targetObj = state.players.find(...)
// After:
export function findSimilarPlayers(targetName, resultData, players = [], limit = 3) {
  // ...
  const targetObj = players.find(p => p.name === targetName) || { pos: ['OMO'] }
  // ...
  const obj = players.find(pl => pl.name === p.name) || { pos: ['OMO'] }
```

- [ ] **Step 6: Copy and fix `src/lib/lineup-optimizer.js`**

Copy `js/lineup-optimizer.js`. Update imports:

```js
import { CRITERIA, POS_WEIGHTS } from './config.js'
import { normPos } from './utils.js'
```

No other changes needed.

- [ ] **Step 7: Write unit tests**

Create `src/test/utils.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { escHtml, normPos, san, getWeekLabel, scoreColor, cardClass } from '../lib/utils.js'

describe('escHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escHtml('<script>&"\'</script>')).toBe('&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;')
  })
})

describe('normPos', () => {
  it('returns KL for goalkeeper aliases', () => {
    expect(normPos({ pos: ['GK'] })).toEqual(['KL'])
    expect(normPos({ pos: ['KL'] })).toEqual(['KL'])
  })
  it('returns OMO as default', () => {
    expect(normPos({ pos: ['UNKNOWN'] })).toEqual(['OMO'])
  })
})

describe('san', () => {
  it('normalizes Turkish chars and spaces to underscores', () => {
    expect(san('Çağrı Öz')).toBe('cagri_oz')
  })
})

describe('getWeekLabel', () => {
  it('returns manualWeek when set', () => {
    expect(getWeekLabel('2026-H15')).toBe('2026-H15')
  })
  it('returns YYYY-HWW format for auto week', () => {
    expect(getWeekLabel()).toMatch(/^\d{4}-H\d{2}$/)
  })
})

describe('scoreColor', () => {
  it('returns green for score >= 9', () => { expect(scoreColor(9)).toBe('#10b981') })
  it('returns red for score < 3',   () => { expect(scoreColor(2)).toBe('#ef4444') })
})

describe('cardClass', () => {
  it('returns fc-gold for rating >= 85', () => { expect(cardClass(85)).toBe('fc-gold') })
  it('returns fc-normal for rating < 65', () => { expect(cardClass(60)).toBe('fc-normal') })
})
```

Create `src/test/forecast.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { forecastHoltWinters } from '../lib/forecast.js'

describe('forecastHoltWinters', () => {
  it('returns empty array for < 3 data points', () => {
    expect(forecastHoltWinters([70, 75])).toEqual([])
  })
  it('returns `periods` forecast values', () => {
    const result = forecastHoltWinters([70, 72, 74, 76, 78], 3)
    expect(result).toHaveLength(3)
    result.forEach(v => expect(v).toBeGreaterThan(0))
  })
  it('projects upward trend', () => {
    const result = forecastHoltWinters([60, 65, 70, 75, 80], 2)
    expect(result[1]).toBeGreaterThan(result[0])
  })
})
```

Create `src/test/anomaly.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { detectAnomalies } from '../lib/anomaly.js'

describe('detectAnomalies', () => {
  it('returns empty for null input', () => {
    expect(detectAnomalies(null)).toEqual([])
  })
  it('returns empty when player has < 5 weeks', () => {
    const data = {
      weeks: ['w1','w2','w3'],
      players: [{ name: 'Test', weeklyGenels: [70,72,74] }]
    }
    expect(detectAnomalies(data)).toEqual([])
  })
  it('detects extreme outlier', () => {
    const genels = [70,71,72,73,74,75,30] // 30 is an outlier
    const data = {
      weeks: genels.map((_, i) => `w${i}`),
      players: [{ name: 'Test', weeklyGenels: genels }]
    }
    const result = detectAnomalies(data)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].direction).toBe('low')
  })
})
```

- [ ] **Step 8: Run tests**

```bash
npm test
```
Expected: All tests pass. If `forecast` or `anomaly` tests fail, check import paths in `src/lib/`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/ src/test/
git commit -m "feat: migrate lib modules to src/lib with React-safe adaptations"
```

---

## Task 4: Zustand Store

**Files:**
- Create: `src/store/index.js`

- [ ] **Step 1: Create `src/store/index.js`**

```js
import { create } from 'zustand'
import { lGet, lSet, sGet, sSet } from '../lib/storage.js'

export const useStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  players: [],
  resultData: null,
  matchesData: null,
  sonucData: null,
  todaySelected: {},
  darkMode: lGet('hs_dark') === '1',
  manualWeek: lGet('hs_manual_week') || null,
  currentRater: sGet('hs_current_rater') || null,
  activeScreen: null,          // null = HomeScreen
  activeStatScreen: 'sonuc',
  pinUnlocked: false,
  currentScores: {},           // { [playerName]: { [criterion]: value } }
  completedCards: {},          // { [playerName]: boolean }
  toast: null,                 // { msg, isError }
  confirmDialog: null,         // { msg, onConfirm }
  successModal: null,          // { msg } | null

  // ── Actions ──────────────────────────────────────────────────────────────
  setPlayers: (players) => set({ players }),
  setResultData: (data) => set({ resultData: data }),
  setMatchesData: (data) => set({ matchesData: data }),
  setSonucData: (data) => set({ sonucData: data }),
  setTodaySelected: (v) => set({ todaySelected: v }),
  setCurrentScores: (v) => set({ currentScores: v }),
  setCompletedCards: (v) => set({ completedCards: v }),
  setPinUnlocked: (v) => set({ pinUnlocked: v }),

  setDarkMode: (v) => {
    lSet('hs_dark', v ? '1' : '0')
    document.documentElement.classList.toggle('dark', v)
    set({ darkMode: v })
  },

  setCurrentRater: (name) => {
    if (name) sSet('hs_current_rater', name)
    set({ currentRater: name })
  },

  setManualWeek: (w) => {
    lSet('hs_manual_week', w || '')
    set({ manualWeek: w || null })
  },

  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setActiveStatScreen: (s) => set({ activeStatScreen: s }),

  showToast: (msg, isError = false) => {
    set({ toast: { msg, isError } })
    setTimeout(() => set({ toast: null }), 3200)
  },

  showConfirm: (msg, onConfirm) => set({ confirmDialog: { msg, onConfirm } }),
  closeConfirm: () => set({ confirmDialog: null }),

  showSuccess: (msg) => {
    set({ successModal: { msg } })
    setTimeout(() => set({ successModal: null }), 2500)
  },
}))
```

- [ ] **Step 2: Verify store imports cleanly**

```bash
npm run dev
```
Open browser console and run:
```js
import('/src/store/index.js').then(m => console.log(m.useStore.getState()))
```
Expected: object with all state fields printed.

- [ ] **Step 3: Commit**

```bash
git add src/store/index.js
git commit -m "feat: zustand store with all state and actions"
```

---

## Task 5: App Shell

**Files:**
- Create: `src/App.jsx`
- Create: `src/components/ui/Toast.jsx`
- Create: `src/components/modals/ConfirmModal.jsx`

- [ ] **Step 1: Create `src/components/ui/Toast.jsx`**

```jsx
import { useStore } from '../../store/index.js'
import { useEffect, useState } from 'react'

export function Toast() {
  const toast = useStore(s => s.toast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (toast) {
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 2800)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!toast) return null

  return (
    <div className={`toast ${toast.isError ? 'error' : ''} ${visible ? 'show' : ''}`}>
      {toast.msg}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/modals/ConfirmModal.jsx`**

```jsx
import { useStore } from '../../store/index.js'

export function ConfirmModal() {
  const { confirmDialog, closeConfirm } = useStore(s => s)
  if (!confirmDialog) return null

  return (
    <div className="mbg open" onClick={e => { if (e.target === e.currentTarget) closeConfirm() }}>
      <div className="modal-card">
        <p className="confirm-msg">{confirmDialog.msg}</p>
        <div className="confirm-btns">
          <button className="btn-secondary" onClick={closeConfirm}>İptal</button>
          <button className="btn-danger" onClick={() => { confirmDialog.onConfirm(); closeConfirm() }}>
            Onayla
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/App.jsx`**

```jsx
import { useEffect, lazy, Suspense } from 'react'
import { useStore } from './store/index.js'
import { Toast } from './components/ui/Toast.jsx'
import { ConfirmModal } from './components/modals/ConfirmModal.jsx'

const HomeScreen      = lazy(() => import('./components/screens/HomeScreen.jsx'))
const BottomNav       = lazy(() => import('./components/ui/BottomNav.jsx'))
const PuanlaScreen    = lazy(() => import('./components/screens/PuanlaScreen.jsx'))
const SiralamaScreen  = lazy(() => import('./components/screens/SiralamaScreen.jsx'))
const IstatistikScreen= lazy(() => import('./components/screens/IstatistikScreen.jsx'))
const TakimScreen     = lazy(() => import('./components/screens/TakimScreen.jsx'))
const ProfilScreen    = lazy(() => import('./components/screens/ProfilScreen.jsx'))
const YayinScreen     = lazy(() => import('./components/screens/YayinScreen.jsx'))
const AdminPanel      = lazy(() => import('./admin/AdminPanel.jsx'))

export default function App() {
  const { activeScreen, darkMode, pinUnlocked } = useStore(s => s)

  // Apply dark mode class on mount and change
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // ESC key closes any open modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      document.querySelectorAll('.mbg.open').forEach(el => el.classList.remove('open'))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Suspense fallback={<div className="loading-spinner" />}>
      {!activeScreen ? (
        <HomeScreen />
      ) : (
        <>
          <BottomNav />
          {activeScreen === 'puanla'      && <PuanlaScreen />}
          {activeScreen === 'siralama'    && <SiralamaScreen />}
          {activeScreen === 'istatistik'  && <IstatistikScreen />}
          {activeScreen === 'takim'       && <TakimScreen />}
          {activeScreen === 'profil'      && <ProfilScreen />}
          {activeScreen === 'yayin'       && <YayinScreen />}
          {pinUnlocked                    && <AdminPanel />}
        </>
      )}
      <ConfirmModal />
      <Toast />
    </Suspense>
  )
}
```

- [ ] **Step 4: Verify app shell renders**

```bash
npm run dev
```
Expected: Page renders without errors. Since `HomeScreen` doesn't exist yet, you'll see the Suspense fallback or an import error. That's fine — proceed to Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/ui/Toast.jsx src/components/modals/ConfirmModal.jsx
git commit -m "feat: app shell with lazy screen routing, toast, confirm modal"
```

---

## Task 6: HomeScreen

**Files:**
- Create: `src/components/screens/HomeScreen.jsx`
- Create: `src/components/modals/TeamConfirmModal.jsx`

- [ ] **Step 1: Create `src/components/modals/TeamConfirmModal.jsx`**

```jsx
import { useStore } from '../../store/index.js'
import { TEAM_CONFIG } from '../../lib/config.js'
import { useState } from 'react'

export function TeamConfirmModal({ teamId, onClose }) {
  const { setActiveScreen } = useStore(s => s)
  const tc = TEAM_CONFIG[teamId]
  if (!tc) return null

  const confirm = () => {
    sessionStorage.setItem('pitchrank_selected_team', teamId)
    setActiveScreen('puanla')
    onClose()
  }

  return (
    <div className="mbg open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card team-confirm-card">
        <img src={tc.logo} alt={tc.name} className="team-confirm-logo" />
        <h2 className="team-confirm-name">{tc.emoji} {tc.name}</h2>
        <p className="team-confirm-desc">Bu takım ile devam etmek istiyor musun?</p>
        <div className="confirm-btns">
          <button className="btn-secondary" onClick={onClose}>İptal</button>
          <button
            className="btn-primary"
            style={{ background: tc.color }}
            onClick={confirm}
          >
            Devam Et
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/screens/HomeScreen.jsx`**

```jsx
import { useState } from 'react'
import { TEAM_CONFIG } from '../../lib/config.js'
import { TeamConfirmModal } from '../modals/TeamConfirmModal.jsx'

export default function HomeScreen() {
  const [pendingTeam, setPendingTeam] = useState(null)

  return (
    <div id="screen-home" className="home-screen">
      <div className="home-hero">
        <h1 className="home-title">PitchRank</h1>
        <p className="home-sub">Takımını seç</p>
      </div>
      <div className="home-teams">
        {Object.values(TEAM_CONFIG).map(tc => (
          <button
            key={tc.id}
            className="team-card"
            style={{ '--tc': tc.color }}
            onClick={() => setPendingTeam(tc.id)}
          >
            <img src={tc.logo} alt={tc.name} className="team-card-logo" />
            <span className="team-card-emoji">{tc.emoji}</span>
            <span className="team-card-name">{tc.name}</span>
          </button>
        ))}
      </div>
      {pendingTeam && (
        <TeamConfirmModal
          teamId={pendingTeam}
          onClose={() => setPendingTeam(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify HomeScreen renders**

```bash
npm run dev
```
Expected: Home screen with team cards visible. Clicking a team opens the TeamConfirmModal. Confirming sets sessionStorage and transitions to `puanla` (which will show Suspense fallback until Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/HomeScreen.jsx src/components/modals/TeamConfirmModal.jsx
git commit -m "feat: home screen and team selection modal"
```

---

## Task 7: BottomNav

**Files:**
- Create: `src/components/ui/BottomNav.jsx`

- [ ] **Step 1: Create `src/components/ui/BottomNav.jsx`**

```jsx
import { useStore } from '../../store/index.js'

const NAV_ITEMS = [
  { key: 'puanla',     icon: '⭐', label: 'Puanla' },
  { key: 'siralama',   icon: '🏆', label: 'Sıralama' },
  { key: 'istatistik', icon: '📊', label: 'İstatistik' },
  { key: 'takim',      icon: '⚽', label: 'Takım' },
  { key: 'yayin',      icon: '📺', label: 'Yayın' },
]

export default function BottomNav() {
  const { activeScreen, setActiveScreen } = useStore(s => s)

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.key}
          className={`nav-btn ${activeScreen === item.key ? 'active' : ''}`}
          onClick={() => setActiveScreen(item.key)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Verify nav renders and switches screens**

```bash
npm run dev
```
Expected: Bottom nav appears after team selection. Clicking nav items switches `activeScreen` in the store.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/BottomNav.jsx
git commit -m "feat: bottom navigation bar"
```

---

## Task 8: PuanlaScreen

**Files:**
- Create: `src/hooks/usePlayers.js`
- Create: `src/lib/players.js`
- Create: `src/components/screens/PuanlaScreen.jsx`

- [ ] **Step 1: Create `src/lib/players.js`**

Copy `js/players.js`. Remove all `document.getElementById`, `document.querySelector` DOM calls. Export only pure data functions:

```js
import { CRITERIA } from './config.js'
import { lGet, lSet, lRem } from './storage.js'
import { gs } from './api.js'
import { PLAYERS_VERSION } from './config.js'

// Draft persistence
export function draftKey(rater, week) { return `hs_draft_${rater}_${week}` }
export function saveDraft(rater, week, scores) {
  if (!rater || !week || !scores || !Object.keys(scores).length) return
  lSet(draftKey(rater, week), JSON.stringify(scores))
}
export function clearDraft(rater, week) { if (rater && week) lRem(draftKey(rater, week)) }
export function getDraft(rater, week) {
  const raw = lGet(draftKey(rater, week))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { clearDraft(rater, week); return null }
}

// Load players from GAS or localStorage cache
export async function loadPlayersFromSheets() {
  const cached = lGet('hs_players')
  const ver = lGet('hs_players_version')
  if (cached && ver === PLAYERS_VERSION) {
    try { return JSON.parse(cached) } catch {}
  }
  const data = await gs({ action: 'getPlayers' })
  const players = Array.isArray(data) ? data : (data.players || [])
  lSet('hs_players', JSON.stringify(players))
  lSet('hs_players_version', PLAYERS_VERSION)
  return players
}

export function savePlayers(players) { lSet('hs_players', JSON.stringify(players)) }

// Submit ratings to GAS
export async function submitRatings({ rater, week, scores }) {
  const payload = {
    action: 'submitRatings',
    rater,
    week,
    scores: JSON.stringify(scores),
  }
  return gs(payload)
}
```

- [ ] **Step 2: Create `src/hooks/usePlayers.js`**

```js
import { useEffect, useCallback, useState } from 'react'
import { useStore } from '../store/index.js'
import { loadPlayersFromSheets } from '../lib/players.js'

export function usePlayers() {
  const { setPlayers, showToast } = useStore(s => s)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const players = await loadPlayersFromSheets()
      setPlayers(players)
    } catch (e) {
      showToast('Oyuncular yüklenemedi', true)
    } finally {
      setLoading(false)
    }
  }, [setPlayers, showToast])

  useEffect(() => { load() }, [load])

  return { loading, reload: load }
}
```

- [ ] **Step 3: Create `src/components/screens/PuanlaScreen.jsx`**

```jsx
import { useState, useCallback } from 'react'
import { useStore } from '../../store/index.js'
import { usePlayers } from '../../hooks/usePlayers.js'
import { CRITERIA, CDISP } from '../../lib/config.js'
import { scoreColor, getWeekLabel, escHtml, getPlayerPhoto, posLabel } from '../../lib/utils.js'
import { getDraft, saveDraft, clearDraft, submitRatings } from '../../lib/players.js'

export default function PuanlaScreen() {
  const { players, currentRater, setCurrentRater, manualWeek, showToast, showConfirm } = useStore(s => s)
  const { loading } = usePlayers()
  const [scores, setScores] = useState({})       // { [name]: { [criterion]: value } }
  const [completed, setCompleted] = useState({}) // { [name]: boolean }
  const [submitting, setSubmitting] = useState(false)
  const week = getWeekLabel(manualWeek)

  const handleSlider = useCallback((playerName, criterion, value) => {
    setScores(prev => {
      const next = { ...prev, [playerName]: { ...(prev[playerName] || {}), [criterion]: +value } }
      saveDraft(currentRater, week, next)
      // Mark as completed if all criteria filled
      const playerScores = next[playerName] || {}
      if (CRITERIA.every(c => playerScores[c] !== undefined)) {
        setCompleted(c => ({ ...c, [playerName]: true }))
      }
      return next
    })
  }, [currentRater, week])

  const completedCount = Object.values(completed).filter(Boolean).length
  const progress = players.length > 0 ? (completedCount / players.length) * 100 : 0

  const handleSubmit = async () => {
    if (completedCount < players.length) {
      showConfirm(
        `${players.length - completedCount} oyuncu eksik. Yine de göndermek istiyor musun?`,
        doSubmit
      )
    } else {
      doSubmit()
    }
  }

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await submitRatings({ rater: currentRater, week, scores })
      clearDraft(currentRater, week)
      setScores({})
      setCompleted({})
      showToast('Puanlar gönderildi! 🎉')
    } catch {
      showToast('Gönderilemedi, tekrar dene', true)
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentRater) {
    return (
      <div id="screen-puanla" className="screen">
        <div className="identity-prompt">
          <p>Önce kimliğini seç</p>
          <div className="identity-list">
            {players.map(p => (
              <button key={p.name} onClick={() => setCurrentRater(p.name)} className="identity-btn">
                <img src={getPlayerPhoto(p.name, players)} alt={p.name}
                     onError={e => { e.target.src = 'assets/images/icon-192.png' }} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id="screen-puanla" className="screen">
      <div className="puanla-header">
        <div className="week-label">{week}</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-text">{completedCount}/{players.length}</span>
      </div>

      <div id="ratingCards" className="rating-cards">
        {loading && <div className="loading-spinner" />}
        {players.map(p => (
          <PlayerCard
            key={p.name}
            player={p}
            players={players}
            scores={scores[p.name] || {}}
            completed={!!completed[p.name]}
            onSlider={(cr, v) => handleSlider(p.name, cr, v)}
          />
        ))}
      </div>

      <button
        className="submit-btn"
        onClick={handleSubmit}
        disabled={submitting || completedCount === 0}
      >
        {submitting ? 'Gönderiliyor…' : `Puanları Gönder (${completedCount}/${players.length})`}
      </button>
    </div>
  )
}

function PlayerCard({ player, players, scores, completed, onSlider }) {
  return (
    <div className={`pcard ${completed ? 'done' : ''}`} data-pname={player.name}>
      <div className="pcard-header">
        <img
          className="pcard-photo"
          src={getPlayerPhoto(player.name, players)}
          alt={player.name}
          onError={e => { e.target.src = 'assets/images/icon-192.png' }}
        />
        <div>
          <div className="pcard-name">{player.name}</div>
          <div className="pcard-pos">{posLabel(player)}</div>
        </div>
      </div>
      <div className="pcard-criteria">
        {CRITERIA.map((cr, i) => {
          const val = scores[cr] ?? 5
          return (
            <div key={cr} className="criterion-row">
              <span className="criterion-label">{CDISP[i]}</span>
              <input
                type="range" min="1" max="10" step="1"
                value={val}
                onChange={e => onSlider(cr, e.target.value)}
                className="criterion-slider"
              />
              <span className="criterion-val" style={{ color: scoreColor(val) }}>{val}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify PuanlaScreen renders**

```bash
npm run dev
```
Navigate to team → Puanla screen. Expected: identity picker shows players list. After selecting identity, rating cards with sliders appear. Slider changes update score display color in real time.

- [ ] **Step 5: Commit**

```bash
git add src/lib/players.js src/hooks/usePlayers.js src/components/screens/PuanlaScreen.jsx
git commit -m "feat: puanla screen with rating sliders, draft, and submit"
```

---

## Task 9: FifaCard & SiralamaScreen

**Files:**
- Create: `src/lib/stats.js`
- Create: `src/hooks/useResults.js`
- Create: `src/components/ui/FifaCard.jsx`
- Create: `src/components/screens/SiralamaScreen.jsx`

- [ ] **Step 1: Create `src/lib/stats.js`**

Copy `js/stats.js`. Remove all `document.*` DOM calls and HTML string rendering. Export only data-fetching functions:

```js
import { gs } from './api.js'
import { lGet, lSet } from './storage.js'

export async function loadResults() {
  const cached = lGet('hs_results_cache')
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  const data = await gs({ action: 'getResults' })
  lSet('hs_results_cache', JSON.stringify(data))
  return data
}

export async function loadMatches() {
  const data = await gs({ action: 'getMatches' })
  return data
}

export function invalidateResultsCache() {
  const { lRem } = require('./storage.js')
  lRem('hs_results_cache')
}
```

Note: Keep all the data-computation helpers (weekly averages, trend computation etc.) from the original `stats.js` — only remove DOM rendering functions like `renderSonucTab`, `renderHaftaTab` etc. Those become React components.

- [ ] **Step 2: Create `src/hooks/useResults.js`**

```js
import { useEffect, useCallback, useState } from 'react'
import { useStore } from '../store/index.js'
import { loadResults, loadMatches } from '../lib/stats.js'

export function useResults() {
  const { setResultData, setMatchesData, showToast } = useStore(s => s)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [results, matches] = await Promise.all([loadResults(), loadMatches()])
      setResultData(results)
      setMatchesData(matches)
    } catch {
      showToast('Sonuçlar yüklenemedi', true)
    } finally {
      setLoading(false)
    }
  }, [setResultData, setMatchesData, showToast])

  useEffect(() => { load() }, [load])

  return { loading, reload: load }
}
```

- [ ] **Step 3: Create `src/components/ui/FifaCard.jsx`**

Migrate the `makeFifaCard` logic from `js/main.js` into a React component:

```jsx
import { useStore } from '../../store/index.js'
import { posRating, calcMarketValue, getPlayStyles } from '../../lib/rating.js'
import { cardClass, ratingColor, normPos, posLabel, getPlayerPhoto, escHtml } from '../../lib/utils.js'
import { CRITERIA_ABBR, MEDALS } from '../../lib/config.js'

export function FifaCard({ pObj, pData, rank, data, overrideScore }) {
  const players = useStore(s => s.players)

  const wAvg = pData ? posRating(pData, pObj) : null
  const score = overrideScore != null ? overrideScore
    : wAvg != null ? Math.min(99, Math.round(wAvg * 10))
    : pData?.genelOrt != null ? Math.min(99, Math.round(pData.genelOrt * 10))
    : null

  if (score == null) return null

  const cls = cardClass(score)
  const { text: ratingTextColor } = ratingColor(score)
  const photo = getPlayerPhoto(pObj?.name || pData?.name, players)
  const pos = pObj ? posLabel(pObj) : ''
  const medal = rank != null && rank < 3 ? MEDALS[rank] : null
  const marketValue = pData ? calcMarketValue(pData, pObj) : null

  // Per-criterion averages for card stats
  const critAvgs = CRITERIA_ABBR.map((abbr, i) => {
    if (!pData?.weeklyKriterler) return { abbr, val: '-' }
    const vals = Object.values(pData.weeklyKriterler)
      .map(wk => wk?.[['Pas','Sut','Dribling','Savunma','Hiz / Kondisyon','Fizik','Takim Oyunu'][i]])
      .filter(v => v != null)
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '-'
    return { abbr, val: avg }
  })

  return (
    <div className={`fc-card ${cls}`} data-name={pObj?.name || pData?.name}>
      {medal && <span className="fc-medal">{medal}</span>}
      <div className="fc-top">
        <div className="fc-score" style={{ color: ratingTextColor }}>{score}</div>
        <div className="fc-pos">{pos}</div>
        <img
          className="fc-photo"
          src={photo}
          alt={pObj?.name || pData?.name}
          onError={e => { e.target.src = 'assets/images/icon-192.png' }}
        />
      </div>
      <div className="fc-name">{pObj?.name || pData?.name}</div>
      <div className="fc-stats">
        {critAvgs.map(c => (
          <div key={c.abbr} className="fc-stat">
            <span className="fc-stat-val">{c.val}</span>
            <span className="fc-stat-lbl">{c.abbr}</span>
          </div>
        ))}
      </div>
      {marketValue && <div className="fc-value">{marketValue}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/screens/SiralamaScreen.jsx`**

```jsx
import { useStore } from '../../store/index.js'
import { useResults } from '../../hooks/useResults.js'
import { FifaCard } from '../ui/FifaCard.jsx'
import { posRating } from '../../lib/rating.js'

export default function SiralamaScreen() {
  const { resultData, players } = useStore(s => s)
  const { loading } = useResults()

  const sorted = (() => {
    if (!resultData?.players) return []
    return [...resultData.players]
      .filter(p => p.genelOrt != null)
      .sort((a, b) => {
        const aObj = players.find(pl => pl.name === a.name) || { pos: ['OMO'] }
        const bObj = players.find(pl => pl.name === b.name) || { pos: ['OMO'] }
        return (posRating(b, bObj) || 0) - (posRating(a, aObj) || 0)
      })
  })()

  return (
    <div id="screen-siralama" className="screen">
      <div className="screen-header">
        <h2 className="stitle">Sıralama</h2>
      </div>
      {loading && <div className="loading-spinner" />}
      <div className="fifa-grid">
        {sorted.map((pData, i) => {
          const pObj = players.find(p => p.name === pData.name) || { name: pData.name, pos: ['OMO'] }
          return (
            <FifaCard
              key={pData.name}
              pObj={pObj}
              pData={pData}
              rank={i}
              data={resultData}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify Siralama renders FIFA cards**

```bash
npm run dev
```
Select a team, navigate to Sıralama. Expected: FIFA cards render in a grid with player scores and photos. If GAS is unreachable in dev, the loading spinner stays — that's expected.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stats.js src/hooks/useResults.js src/components/ui/FifaCard.jsx src/components/screens/SiralamaScreen.jsx
git commit -m "feat: siralama screen with FIFA cards and GAS data loading"
```

---

## Task 10: IstatistikScreen

**Files:**
- Create: `src/components/screens/IstatistikScreen.jsx`

- [ ] **Step 1: Create `src/components/screens/IstatistikScreen.jsx`**

The stats screen has sub-screens: `sonuc`, `hafta`, `trend`, `karsilastirma`, `sezon`, `katilim`. Use `activeStatScreen` from store:

```jsx
import { useStore } from '../../store/index.js'
import { useResults } from '../../hooks/useResults.js'
import { FifaCard } from '../ui/FifaCard.jsx'
import { posRating } from '../../lib/rating.js'
import { forecastHoltWinters } from '../../lib/forecast.js'

const STAT_TABS = [
  { key: 'sonuc',        label: 'Sonuç' },
  { key: 'hafta',        label: 'Hafta' },
  { key: 'trend',        label: 'Trend' },
  { key: 'karsilastirma',label: 'Karş.' },
  { key: 'sezon',        label: 'Sezon' },
  { key: 'katilim',      label: 'Katılım' },
]

export default function IstatistikScreen() {
  const { activeStatScreen, setActiveStatScreen, resultData, players } = useStore(s => s)
  const { loading } = useResults()

  return (
    <div id="screen-istatistik" className="screen">
      <div className="stat-tabs">
        {STAT_TABS.map(t => (
          <button
            key={t.key}
            className={`stat-tab ${activeStatScreen === t.key ? 'active' : ''}`}
            onClick={() => setActiveStatScreen(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="loading-spinner" />}

      {activeStatScreen === 'sonuc'         && <SonucTab resultData={resultData} players={players} />}
      {activeStatScreen === 'hafta'         && <HaftaTab resultData={resultData} players={players} />}
      {activeStatScreen === 'trend'         && <TrendTab resultData={resultData} players={players} />}
      {activeStatScreen === 'karsilastirma' && <KarsilastirmaTab resultData={resultData} players={players} />}
      {activeStatScreen === 'sezon'         && <SezonTab resultData={resultData} players={players} />}
      {activeStatScreen === 'katilim'       && <KatilimTab resultData={resultData} players={players} />}
    </div>
  )
}

function SonucTab({ resultData, players }) {
  const sorted = (() => {
    if (!resultData?.players) return []
    return [...resultData.players]
      .filter(p => p.genelOrt != null)
      .sort((a, b) => {
        const aObj = players.find(pl => pl.name === a.name) || { pos: ['OMO'] }
        const bObj = players.find(pl => pl.name === b.name) || { pos: ['OMO'] }
        return (posRating(b, bObj) || 0) - (posRating(a, aObj) || 0)
      })
  })()

  return (
    <div className="stat-panel">
      <div className="rank-list">
        {sorted.map((pData, i) => {
          const pObj = players.find(p => p.name === pData.name) || { name: pData.name, pos: ['OMO'] }
          const score = Math.min(99, Math.round((posRating(pData, pObj) || 0) * 10))
          return (
            <div key={pData.name} className="rank-row">
              <span className="rank-num">{i + 1}</span>
              <FifaCard pObj={pObj} pData={pData} rank={i} data={resultData} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HaftaTab({ resultData, players }) {
  if (!resultData?.weeks?.length) return <div className="nodata">Veri yok</div>
  const lastWeek = resultData.weeks[resultData.weeks.length - 1]
  const lastIdx  = resultData.weeks.length - 1

  const weekScores = (resultData.players || [])
    .map(p => ({
      name: p.name,
      score: Array.isArray(p.weeklyGenels) ? p.weeklyGenels[lastIdx] : null,
    }))
    .filter(p => p.score != null)
    .sort((a, b) => b.score - a.score)

  return (
    <div className="stat-panel">
      <h3 className="stat-week-title">{lastWeek} Haftası</h3>
      <div className="week-list">
        {weekScores.map((p, i) => (
          <div key={p.name} className="week-row">
            <span className="rank-num">{i + 1}</span>
            <span className="player-name">{p.name}</span>
            <span className="week-score">{p.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendTab({ resultData, players }) {
  if (!resultData?.players?.length) return <div className="nodata">Veri yok</div>

  return (
    <div className="stat-panel">
      {resultData.players.map(p => {
        const series = (p.weeklyGenels || []).filter(v => v != null).map(v => Math.round(v * 10))
        if (series.length < 2) return null
        const forecast = forecastHoltWinters(series, 2)
        const last = series[series.length - 1]
        const prev = series[series.length - 2]
        const dir = last > prev ? '↑' : last < prev ? '↓' : '→'
        return (
          <div key={p.name} className="trend-row">
            <span className="player-name">{p.name}</span>
            <span className="trend-arrow">{dir}</span>
            <span className="trend-score">{last}</span>
            {forecast[0] && <span className="trend-forecast">→ {Math.round(forecast[0])}</span>}
          </div>
        )
      })}
    </div>
  )
}

function KarsilastirmaTab({ resultData, players }) {
  return (
    <div className="stat-panel">
      <p className="nodata">Karşılaştırma görünümü — mevcut stats.js renderComparison mantığı buraya taşınır.</p>
    </div>
  )
}

function SezonTab({ resultData, players }) {
  return (
    <div className="stat-panel">
      <p className="nodata">Sezon özeti — mevcut stats.js renderSezon mantığı buraya taşınır.</p>
    </div>
  )
}

function KatilimTab({ resultData, players }) {
  if (!resultData?.players?.length) return <div className="nodata">Veri yok</div>
  const sorted = [...resultData.players]
    .map(p => ({
      name: p.name,
      count: (p.weeklyGenels || []).filter(v => v != null).length,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="stat-panel">
      <div className="attend-list">
        {sorted.map((p, i) => (
          <div key={p.name} className="attend-row">
            <span className="rank-num">{i + 1}</span>
            <span className="player-name">{p.name}</span>
            <span className="attend-count">{p.count} hafta</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Fill in KarsilastirmaTab and SezonTab**

Open `js/stats.js`. Find `renderComparison` and `renderSezon` functions. Extract their data-computation logic (not DOM strings) and implement as JSX. The pattern is the same: compute arrays of values, render as `<div>` elements instead of innerHTML strings.

- [ ] **Step 3: Verify İstatistik screen and all tabs**

```bash
npm run dev
```
Navigate to İstatistik. Click each tab. Expected: Sonuç, Hafta, Trend, Katılım tabs show data. Karş. and Sezon show placeholder or migrated content.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/IstatistikScreen.jsx
git commit -m "feat: istatistik screen with 6 sub-tabs"
```

---

## Task 11: TakimScreen

**Files:**
- Create: `src/components/screens/TakimScreen.jsx`

- [ ] **Step 1: Create `src/components/screens/TakimScreen.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { useStore } from '../../store/index.js'
import { useResults } from '../../hooks/useResults.js'
import { findOptimalLineup, PRESET_META, PRESET_KEYS } from '../../lib/lineup-optimizer.js'
import { normPos, getPlayerPhoto, posLabel } from '../../lib/utils.js'

export default function TakimScreen() {
  const { players, resultData, todaySelected, setTodaySelected } = useStore(s => s)
  const { loading } = useResults()
  const [preset, setPreset] = useState('dengeli')
  const [showLineup, setShowLineup] = useState(false)

  const togglePlayer = (name) => {
    setTodaySelected(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const selectedNames = Object.keys(todaySelected).filter(k => todaySelected[k])

  const available = useMemo(() => {
    return selectedNames.map(name => {
      const pObj = players.find(p => p.name === name) || { name, pos: ['OMO'] }
      const pData = resultData?.players?.find(p => p.name === name) || null
      return { pObj, pData }
    })
  }, [selectedNames, players, resultData])

  const optimalResult = useMemo(() => {
    if (!showLineup || available.length < 5) return null
    return findOptimalLineup(available, preset)
  }, [showLineup, available, preset])

  return (
    <div id="screen-takim" className="screen">
      <div className="screen-header">
        <h2 className="stitle">Takım Kur</h2>
      </div>

      <div className="preset-tabs">
        {PRESET_KEYS.map(key => {
          const meta = PRESET_META[key]
          return (
            <button
              key={key}
              className={`preset-tab ${preset === key ? 'active' : ''}`}
              onClick={() => setPreset(key)}
            >
              {meta.emoji} {meta.label}
            </button>
          )
        })}
      </div>

      <div className="player-checklist">
        {players.map(p => (
          <label key={p.name} className="player-check-row">
            <input
              type="checkbox"
              checked={!!todaySelected[p.name]}
              onChange={() => togglePlayer(p.name)}
            />
            <img
              src={getPlayerPhoto(p.name, players)}
              alt={p.name}
              className="player-check-photo"
              onError={e => { e.target.src = 'assets/images/icon-192.png' }}
            />
            <span>{p.name}</span>
            <span className="player-check-pos">{posLabel(p)}</span>
          </label>
        ))}
      </div>

      <div className="takim-actions">
        <span className="selected-count">{selectedNames.length} seçildi</span>
        <button
          className="btn-primary"
          disabled={selectedNames.length < 5}
          onClick={() => setShowLineup(true)}
        >
          En İyi 5'i Bul
        </button>
      </div>

      {showLineup && optimalResult && (
        <div className="optimal-lineup">
          <h3>Optimal 5'li — {PRESET_META[preset].label}</h3>
          <div className="lineup-cards">
            {optimalResult.lineup.map(p => (
              <div key={p.name} className="lineup-player">
                <img
                  src={getPlayerPhoto(p.name, players)}
                  alt={p.name}
                  className="lineup-photo"
                  onError={e => { e.target.src = 'assets/images/icon-192.png' }}
                />
                <div className="lineup-name">{p.name}</div>
                <div className="lineup-pos">{p.posKey}</div>
                <div className="lineup-score">{p.score.toFixed(1)}</div>
              </div>
            ))}
          </div>
          <div className="lineup-total">
            Toplam Skor: {optimalResult.totalScore.toFixed(1)}
          </div>
        </div>
      )}
      {showLineup && !optimalResult && (
        <p className="nodata">Pozisyon kuralına uyan 5'li bulunamadı (1 KL + 1-2 DEF + 1-2 OMO + 1 FRV gerekli)</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TakimScreen**

```bash
npm run dev
```
Navigate to Takım. Expected: Player list with checkboxes, preset tabs (Dengeli/Hücum/Savunma/Hızlı), "En İyi 5'i Bul" button activates after 5+ selections. Result shows 5-player lineup with scores.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/TakimScreen.jsx
git commit -m "feat: takim screen with lineup optimizer and preset tabs"
```

---

## Task 12: ProfilScreen

**Files:**
- Create: `src/components/ui/FormStrip.jsx`
- Create: `src/components/ui/BadgeGrid.jsx`
- Create: `src/components/ui/CriteriaArcs.jsx`
- Create: `src/components/ui/DnaMatches.jsx`
- Create: `src/components/screens/ProfilScreen.jsx`

- [ ] **Step 1: Create `src/components/ui/FormStrip.jsx`**

Migrate `renderFormStrip` from `js/profile.js`. Accepts `playerData`, `resultData`, `pObj` as props:

```jsx
import { posRating } from '../../lib/rating.js'
import { forecastHoltWinters } from '../../lib/forecast.js'
import { escHtml } from '../../lib/utils.js'

export function FormStrip({ playerData, resultData, pObj }) {
  if (!playerData?.weeklyGenels || !resultData?.weeks) {
    return (
      <div className="prof-section">
        <div className="prof-section-header"><span className="prof-section-title">Form Şeridi</span></div>
        <div className="prof-nodata">Henüz form verisi yok.</div>
      </div>
    )
  }

  const weeks   = resultData.weeks
  const genels  = playerData.weeklyGenels

  const ratingForWeek = (weekLabel, idx) => {
    const kr = playerData.weeklyKriterler?.[weekLabel] || {}
    const swd = { weeklyKriterler: { [weekLabel]: kr }, weeklyGenels: [genels[idx]] }
    const w = posRating(swd, pObj || { pos: ['OMO'] })
    if (w !== null) return Math.min(99, Math.round(w * 10))
    return genels[idx] != null ? Math.round(genels[idx] * 10) : null
  }

  const allRated = weeks
    .map((w, i) => ({ week: w, score: genels[i], rating: ratingForWeek(w, i) }))
    .filter(e => e.score != null && e.rating != null)

  if (!allRated.length) {
    return (
      <div className="prof-section">
        <div className="prof-section-header"><span className="prof-section-title">Form Şeridi</span></div>
        <div className="prof-nodata">Henüz form verisi yok.</div>
      </div>
    )
  }

  const recent      = allRated.slice(-5)
  const fullSeries  = allRated.map(e => e.rating)
  const forecastPts = forecastHoltWinters(fullSeries, 3).map(v => Math.max(0, Math.min(99, Math.round(v))))

  const W = 300, H = 80, PX = 20, PY = 14
  const actualScores    = recent.map(e => e.rating)
  const allDisplayScores = actualScores.concat(forecastPts)
  const minS  = Math.max(0, Math.min(...allDisplayScores) - 8)
  const maxS  = Math.min(100, Math.max(...allDisplayScores) + 8)
  const range = maxS - minS || 1
  const totalN = recent.length + forecastPts.length
  const innerW = W - PX * 2
  const innerH = H - PY * 2 - 12

  const xAt = i => PX + (totalN > 1 ? (i / (totalN - 1)) * innerW : innerW / 2)
  const yAt = s => PY + (1 - (s - minS) / range) * innerH

  const actualPts = recent.map((e, i) => ({
    x: xAt(i), y: yAt(e.rating), score: e.rating,
    week: e.week.replace(/\d{4}-/, ''),
  }))
  const forecastDisplayPts = forecastPts.map((s, k) => ({
    x: xAt(recent.length + k), y: yAt(s), score: s, label: 'T+' + (k + 1),
  }))

  const lineD  = actualPts.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD  = actualPts.length
    ? `${lineD} L${actualPts.at(-1).x.toFixed(1)} ${H} L${actualPts[0].x.toFixed(1)} ${H} Z` : ''
  let fLineD = ''
  if (forecastDisplayPts.length && actualPts.length) {
    const last = actualPts.at(-1)
    fLineD = `M${last.x.toFixed(1)} ${last.y.toFixed(1)}` +
      forecastDisplayPts.map(p => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')
  }

  const lastScore = actualScores.at(-1)
  const prevScore = actualScores.length > 1 ? actualScores.at(-2) : null
  const delta = prevScore != null ? lastScore - prevScore : 0
  const trend = delta >= 2 ? { icon: '↑', cls: 'up' } : delta <= -2 ? { icon: '↓', cls: 'down' } : { icon: '→', cls: 'flat' }

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <span className="prof-section-title">Form Şeridi</span>
        <span className={`spark-trend ${trend.cls}`}>{trend.icon} {lastScore}</span>
      </div>
      <svg className="spark-svg" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={lineD} className="spark-line" fill="none" />
        {fLineD && <path d={fLineD} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />}
        {actualPts.map(p => (
          <g key={p.week}>
            <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" className="spark-dot" />
            <text x={p.x.toFixed(1)} y={(p.y-7).toFixed(1)} className="spark-lbl" textAnchor="middle">{p.score}</text>
            <text x={p.x.toFixed(1)} y={(H-1).toFixed(1)} className="spark-week" textAnchor="middle">{p.week}</text>
          </g>
        ))}
        {forecastDisplayPts.map(p => (
          <g key={p.label}>
            <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="none" stroke="#94a3b8" strokeWidth="1.5" opacity="0.7" />
            <text x={p.x.toFixed(1)} y={(p.y-7).toFixed(1)} fontSize="9" fontWeight="700" fill="#94a3b8" textAnchor="middle" opacity="0.85">{p.score}</text>
            <text x={p.x.toFixed(1)} y={(H-1).toFixed(1)} fontSize="8" fontWeight="600" fill="#94a3b8" textAnchor="middle" opacity="0.7">{p.label}</text>
          </g>
        ))}
      </svg>
      {forecastPts.length > 0 && (
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <span className="spark-trend flat" style={{ background:'rgba(148,163,184,0.15)',color:'#94a3b8',borderColor:'rgba(148,163,184,0.3)' }}>
            ⌖ Tahmin: {forecastPts.join(' › ')}
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ui/BadgeGrid.jsx`**

Migrate `computeBadges` and `renderBadges` from `js/profile.js`:

```jsx
import { useStore } from '../../store/index.js'
import { posRating } from '../../lib/rating.js'
import { escHtml } from '../../lib/utils.js'

const BADGE_DEFS = [
  { id: 'maestro', icon: '🎯', name: 'Maestro',    desc: 'Pas ortalaması 8.0+',            check: (p)        => criteriaAvg(p,'Pas')>=8.0 },
  { id: 'fuze',    icon: '🚀', name: 'Füze',        desc: 'Şut ortalaması 8.0+',            check: (p)        => criteriaAvg(p,'Sut')>=8.0 },
  { id: 'cambaz',  icon: '🪄', name: 'Cambaz',      desc: 'Dribling ortalaması 8.0+',       check: (p)        => criteriaAvg(p,'Dribling')>=8.0 },
  { id: 'duvar',   icon: '🧱', name: 'Duvar',        desc: 'Savunma ortalaması 8.0+',        check: (p)        => criteriaAvg(p,'Savunma')>=8.0 },
  { id: 'motor',   icon: '⚡', name: 'Motor',        desc: 'Hız/Kondisyon ortalaması 8.0+',  check: (p)        => criteriaAvg(p,'Hiz / Kondisyon')>=8.0 },
  { id: 'tank',    icon: '🦍', name: 'Tank',         desc: 'Fizik ortalaması 8.0+',          check: (p)        => criteriaAvg(p,'Fizik')>=8.0 },
  { id: 'joker',   icon: '🤝', name: 'Joker',        desc: 'Takım Oyunu ortalaması 8.0+',    check: (p)        => criteriaAvg(p,'Takim Oyunu')>=8.0 },
  { id: 'ates',    icon: '🔥', name: 'Ateş',         desc: '3 hafta üst üste ilk 3',         check: (p,rd)     => hasConsecutiveTop3(p,rd,3) },
  { id: 'devamli', icon: '📅', name: 'Devamlı',      desc: '5+ maça katılım',                check: (p)        => attendCount(p)>=5 },
  { id: 'lider',   icon: '👑', name: 'Lider',         desc: 'Sezon genel sıralama 1.',       check: (p,rd,_,pl)=> isLeader(p,rd,pl) },
  { id: 'golcu',   icon: '⚽', name: 'Golcü',         desc: '5+ gol bu sezon',                check: (p,_,md)   => getGoals(p?.name,md)>=5 },
  { id: 'asist',   icon: '🅰️', name: 'Asist Kralı',  desc: '5+ asist bu sezon',              check: (p,_,md)   => getAssists(p?.name,md)>=5 },
]

function criteriaAvg(p, c) {
  if (!p?.weeklyKriterler) return 0
  const vals = Object.values(p.weeklyKriterler).map(wk => wk?.[c]).filter(v => v != null)
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
}
function attendCount(p) {
  return Array.isArray(p?.weeklyGenels) ? p.weeklyGenels.filter(v => v != null).length : 0
}
function isLeader(p, rd, statePlayers) {
  if (!rd?.players || !p) return false
  const sorted = [...rd.players].filter(x=>x.genelOrt!=null).sort((a,b)=>{
    const aO = statePlayers?.find(pl=>pl.name===a.name)||{pos:['OMO']}
    const bO = statePlayers?.find(pl=>pl.name===b.name)||{pos:['OMO']}
    return (posRating(b,bO)||0)-(posRating(a,aO)||0)
  })
  return sorted[0]?.name === p.name
}
function hasConsecutiveTop3(p, rd, count) {
  if (!rd?.weeks || !rd?.players || !p) return false
  if (rd.weeks.length < count) return false
  const startIdx = rd.weeks.length - count
  for (let i = startIdx; i < rd.weeks.length; i++) {
    const scores = rd.players
      .map(x => ({ name: x.name, score: x.weeklyGenels?.[i] }))
      .filter(x => x.score != null).sort((a,b)=>b.score-a.score)
    const rank = scores.findIndex(s => s.name === p.name)
    if (rank === -1 || rank >= 3) return false
  }
  return true
}
function getGoals(name, md) {
  if (!md?.matches) return 0
  return md.matches.reduce((s,m)=>s+(m.goals?.[name]?.g?+m.goals[name].g:0),0)
}
function getAssists(name, md) {
  if (!md?.matches) return 0
  return md.matches.reduce((s,m)=>s+(m.goals?.[name]?.a?+m.goals[name].a:0),0)
}

export function BadgeGrid({ playerData, resultData, matchesData }) {
  const players = useStore(s => s.players)
  const showToast = useStore(s => s.showToast)

  const badges = BADGE_DEFS.map(def => ({
    ...def,
    earned: !!(playerData && def.check(playerData, resultData, matchesData, players)),
  }))

  const earned = badges.filter(b => b.earned)
  const sorted = [...badges.filter(b=>b.earned), ...badges.filter(b=>!b.earned)]

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <span className="prof-section-title">Rozetler</span>
        <span className="prof-section-sub">{earned.length}/{badges.length} kazanıldı</span>
      </div>
      <div className="badge-hex-grid">
        {sorted.map(b => (
          <div
            key={b.id}
            className={`badge-hex-item${b.earned?' earned':''}`}
            onClick={() => showToast(`${b.icon} ${b.name}: ${b.desc}`)}
          >
            <div className={`badge-hex-shape ${b.earned?'earned':'locked'}`}>{b.icon}</div>
            <div className="badge-hex-name">{b.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/ui/CriteriaArcs.jsx`**

Migrate `renderCriteriaBar` from `js/profile.js`:

```jsx
import { CRITERIA, CDISP } from '../../lib/config.js'

function criteriaAvg(playerData, c) {
  if (!playerData?.weeklyKriterler) return 0
  const vals = Object.values(playerData.weeklyKriterler).map(wk=>wk?.[c]).filter(v=>v!=null)
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
}

export function CriteriaArcs({ playerData }) {
  if (!playerData?.weeklyKriterler || !Object.keys(playerData.weeklyKriterler).length) {
    return (
      <div className="prof-section">
        <div className="prof-section-header"><span className="prof-section-title">Kriter Ortalamaları</span></div>
        <div className="prof-nodata">Kriter verisi yok.</div>
      </div>
    )
  }

  const R = 22, CX = 28, CY = 28, CIRC = 2 * Math.PI * R

  const arcs = CRITERIA.map((c, i) => {
    const avg = criteriaAvg(playerData, c)
    if (!avg) return null
    const pct = Math.min(100, Math.round(avg * 10))
    const cls = pct >= 80 ? 'good' : pct >= 60 ? 'mid' : 'low'
    const dash = `${(pct/100*CIRC).toFixed(1)} ${CIRC.toFixed(1)}`
    return (
      <div key={c} className="crit-arc">
        <svg className="crit-arc-svg" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
          <circle cx={CX} cy={CY} r={R} className="crit-arc-track" />
          <circle cx={CX} cy={CY} r={R}
            className={`crit-arc-fill ${cls}`}
            strokeDasharray={dash}
            strokeDashoffset="0"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
          <text x={CX} y={CY} className="crit-arc-val" textAnchor="middle" dominantBaseline="middle">
            {avg.toFixed(1)}
          </text>
        </svg>
        <div className="crit-arc-lbl">{CDISP[i]}</div>
      </div>
    )
  }).filter(Boolean)

  return (
    <div className="prof-section">
      <div className="prof-section-header"><span className="prof-section-title">Kriter Ortalamaları</span></div>
      <div className="crit-arc-grid">{arcs}</div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/ui/DnaMatches.jsx`**

```jsx
import { useStore } from '../../store/index.js'
import { findSimilarPlayers } from '../../lib/dna.js'
import { getPlayerPhoto, escHtml } from '../../lib/utils.js'
import { TEAM_CONFIG } from '../../lib/config.js'
import { getCurrentTeam } from '../../lib/storage.js'

export function DnaMatches({ playerData, resultData }) {
  const players = useStore(s => s.players)

  if (!playerData || !resultData) return null

  const matches = findSimilarPlayers(playerData.name, resultData, players, 3)
  if (!matches.length) return null

  const teamId = getCurrentTeam() || 'haldunalagas'
  const tc = (TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas).color

  return (
    <div className="prof-section">
      <div className="prof-section-header">
        <span className="prof-section-title">🧬 DNA Eşleşmesi</span>
        <span className="prof-section-sub">Oyun stili</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {matches.map(m => {
          const photo = getPlayerPhoto(m.name, players)
          const pct = Math.round(Math.max(0,Math.min(1,m.sim))*100)
          return (
            <div key={m.name} style={{ display:'flex',alignItems:'center',gap:12,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:14,padding:'10px 12px' }}>
              <img src={photo} loading="lazy"
                style={{ width:42,height:42,borderRadius:'50%',objectFit:'cover',flexShrink:0,background:'var(--bg2)' }}
                onError={e=>{e.target.src='assets/images/icon-192.png'}} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:800,color:'var(--text)',letterSpacing:'-0.3px',marginBottom:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{m.name}</div>
                <span style={{ fontSize:9,fontWeight:700,color: m.samePos ? tc : 'var(--text3)',background: m.samePos ? tc+'1a':'var(--bg3)',padding:'2px 7px',borderRadius:10,border:`1px solid ${m.samePos?tc+'33':'var(--border2)'}` }}>
                  {m.samePos ? 'Aynı mevki' : 'Çapraz'}
                </span>
              </div>
              <div style={{ textAlign:'right',flexShrink:0 }}>
                <div style={{ fontSize:18,fontWeight:900,color:tc,lineHeight:1,letterSpacing:'-0.5px' }}>%{pct}</div>
                <div style={{ fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:2 }}>benzerlik</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/screens/ProfilScreen.jsx`**

```jsx
import { useStore } from '../../store/index.js'
import { useResults } from '../../hooks/useResults.js'
import { FormStrip } from '../ui/FormStrip.jsx'
import { BadgeGrid } from '../ui/BadgeGrid.jsx'
import { CriteriaArcs } from '../ui/CriteriaArcs.jsx'
import { DnaMatches } from '../ui/DnaMatches.jsx'
import { posRating } from '../../lib/rating.js'
import { posLabel, getPlayerPhoto } from '../../lib/utils.js'
import { TEAM_CONFIG } from '../../lib/config.js'
import { getCurrentTeam } from '../../lib/storage.js'

export default function ProfilScreen() {
  const { currentRater, players, resultData, matchesData } = useStore(s => s)
  useResults()

  const name       = currentRater
  const playerData = resultData?.players?.find(p => p.name === name) || null
  const pObj       = players.find(p => p.name === name) || null

  const teamId = getCurrentTeam() || 'haldunalagas'
  const tc     = (TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas).color

  if (!name) {
    return (
      <div id="screen-profil" className="screen">
        <div className="prof-section" style={{ padding:32, textAlign:'center' }}>
          <div className="prof-nodata">Önce kimliğini seç.</div>
        </div>
      </div>
    )
  }

  const wAvg   = playerData && pObj ? posRating(playerData, pObj) : null
  const rating = wAvg != null ? Math.min(99, Math.round(wAvg * 10))
    : playerData?.genelOrt != null ? Math.min(99, Math.round(playerData.genelOrt * 10))
    : null

  const r = parseInt(tc.slice(1,3),16)
  const g = parseInt(tc.slice(3,5),16)
  const b = parseInt(tc.slice(5,7),16)
  const glow = `radial-gradient(ellipse at 85% 50%, rgba(${r},${g},${b},0.18) 0%, transparent 65%)`

  return (
    <div id="screen-profil" className="screen">
      {/* Hero */}
      <div id="prof-header">
        <div className="prof-hero">
          <div className="prof-hero-glow" style={{ background: glow }} />
          {rating != null && <div className="prof-watermark">{rating}</div>}
          <div className="prof-hero-body">
            <div className="prof-avatar-wrap" style={{ background:tc, boxShadow:`0 0 0 2px var(--bg),0 0 0 5px ${tc}` }}>
              <img className="prof-avatar"
                src={getPlayerPhoto(name, players)}
                alt={name}
                onError={e=>{e.target.src='assets/images/icon-192.png'}} />
            </div>
            <div className="prof-hero-info">
              <div className="prof-name">{name}</div>
              {pObj && <div className="prof-pos">{posLabel(pObj)}</div>}
              {rating != null && <div className="prof-rating-pill" style={{ background: tc }}>{rating}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Competition rank */}
      {resultData?.players && (
        <CompetitionRank playerData={playerData} resultData={resultData} players={players} tc={tc} />
      )}

      {/* Form sparkline */}
      <div id="prof-form">
        <FormStrip playerData={playerData} resultData={resultData} pObj={pObj} />
      </div>

      {/* Badges */}
      <div id="prof-badges">
        <BadgeGrid playerData={playerData} resultData={resultData} matchesData={matchesData} />
      </div>

      {/* Criteria arcs */}
      <div id="prof-criteria">
        <CriteriaArcs playerData={playerData} />
      </div>

      {/* DNA matches */}
      <div id="prof-dna">
        <DnaMatches playerData={playerData} resultData={resultData} />
      </div>
    </div>
  )
}

function CompetitionRank({ playerData, resultData, players, tc }) {
  const getScore = p => {
    const pObj = players.find(pl => pl.name === p.name) || { pos: ['OMO'] }
    return posRating(p, pObj) || 0
  }
  const sorted = [...resultData.players].filter(p=>p.genelOrt!=null).sort((a,b)=>getScore(b)-getScore(a))
  const rank = sorted.findIndex(p => p.name === playerData?.name)
  if (!playerData || rank === -1) return null

  const myScore  = getScore(playerData)
  const myRating = Math.min(99, Math.round(myScore * 10))

  if (rank === 0) {
    return (
      <div className="prof-rank-card">
        <div className="prof-rank-num prof-rank-leader" style={{ color: tc }}>🏆</div>
        <div className="prof-rank-body">
          <div className="prof-rank-label">Bu sezon takımının liderisin!</div>
          <div className="prof-rank-sub">Genel rating: <strong>{myRating}</strong></div>
        </div>
      </div>
    )
  }

  const above = sorted[rank - 1]
  const diff  = ((getScore(above) - myScore) * 10).toFixed(1)
  return (
    <div className="prof-rank-card">
      <div className="prof-rank-num" style={{ color: tc }}>{rank + 1}</div>
      <div className="prof-rank-body">
        <div className="prof-rank-label">Takımda <strong>{rank + 1}. sıradasın</strong></div>
        <div className="prof-rank-sub">{above.name}'e <strong>{diff} puan</strong> kaldı</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify ProfilScreen**

```bash
npm run dev
```
Navigate to Profil (after selecting a rater in Puanla). Expected: Hero section with photo/name/rating pill, form sparkline with forecast dots, badge grid (earned/locked), criteria arc SVGs, DNA matches. All data comes from Zustand store.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/FormStrip.jsx src/components/ui/BadgeGrid.jsx src/components/ui/CriteriaArcs.jsx src/components/ui/DnaMatches.jsx src/components/screens/ProfilScreen.jsx
git commit -m "feat: profil screen with form strip, badges, criteria arcs, dna matches"
```

---

## Task 13: AdminPanel

**Files:**
- Create: `src/components/modals/PinModal.jsx`
- Create: `src/admin/AdminPanel.jsx`
- Create: `src/admin/tabs/BugunTab.jsx`
- Create: `src/admin/tabs/HakemTab.jsx`
- Create: `src/admin/tabs/VideoTab.jsx`
- Create: `src/admin/tabs/WeekTab.jsx`
- Create: `src/admin/tabs/PlayersTab.jsx`

- [ ] **Step 1: Create `src/components/modals/PinModal.jsx`**

```jsx
import { useState } from 'react'
import { useStore } from '../../store/index.js'
import { lGet } from '../../lib/storage.js'

export function PinModal({ onClose }) {
  const { setPinUnlocked, showToast } = useStore(s => s)
  const [input, setInput] = useState('')

  const submit = () => {
    const storedPin = lGet('hs_admin_pin') || '1234'
    if (input === storedPin) {
      setPinUnlocked(true)
      showToast('Admin paneli açıldı')
      onClose()
    } else {
      showToast('Yanlış PIN', true)
      setInput('')
    }
  }

  return (
    <div className="mbg open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card pin-modal">
        <h3>Admin PIN</h3>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="PIN gir"
          className="pin-input"
          autoFocus
        />
        <div className="confirm-btns">
          <button className="btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit}>Giriş</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/admin/tabs/WeekTab.jsx`**

```jsx
import { useStore } from '../../store/index.js'
import { getAutoWeekLabel } from '../../lib/utils.js'

export function WeekTab() {
  const { manualWeek, setManualWeek, showToast } = useStore(s => s)
  const [input, setInput] = useState(manualWeek || '')
  const { useState } = require('react')

  const save = () => {
    if (!input.match(/^\d{4}-H\d{2}$/)) {
      showToast('Format: YYYY-HWW (örn: 2026-H15)', true)
      return
    }
    setManualWeek(input)
    showToast(`Hafta ${input} olarak ayarlandı`)
  }

  const reset = () => {
    setManualWeek(null)
    setInput('')
    showToast(`Otomatik haftaya döndü: ${getAutoWeekLabel()}`)
  }

  return (
    <div className="admin-tab-panel">
      <h3>Hafta Yönetimi</h3>
      <p>Aktif: <strong>{manualWeek || getAutoWeekLabel()} {manualWeek ? '(manuel)' : '(otomatik)'}</strong></p>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="YYYY-HWW"
        className="admin-input"
      />
      <div className="confirm-btns">
        <button className="btn-secondary" onClick={reset}>Otomatiğe Dön</button>
        <button className="btn-primary" onClick={save}>Kaydet</button>
      </div>
    </div>
  )
}
```

Fix the `require` anti-pattern — move `useState` to top import:
```jsx
import { useState } from 'react'
import { useStore } from '../../store/index.js'
import { getAutoWeekLabel } from '../../lib/utils.js'

export function WeekTab() {
  const { manualWeek, setManualWeek, showToast } = useStore(s => s)
  const [input, setInput] = useState(manualWeek || '')
  // ... rest of component
}
```

- [ ] **Step 3: Create `src/admin/tabs/PlayersTab.jsx`**

Migrate player add/edit/delete from `js/admin.js`:

```jsx
import { useState } from 'react'
import { useStore } from '../../store/index.js'
import { gs } from '../../lib/api.js'
import { savePlayers } from '../../lib/players.js'
import { VALID_POS } from '../../lib/config.js'

export function PlayersTab() {
  const { players, setPlayers, showToast, showConfirm } = useStore(s => s)
  const [newName, setNewName] = useState('')
  const [newPos, setNewPos]   = useState('OMO')

  const addPlayer = async () => {
    if (!newName.trim()) return
    const updated = [...players, { name: newName.trim(), pos: [newPos], photo: '' }]
    try {
      await gs({ action: 'addPlayer', name: newName.trim(), pos: newPos })
      setPlayers(updated)
      savePlayers(updated)
      setNewName('')
      showToast('Oyuncu eklendi')
    } catch {
      showToast('Eklenemedi', true)
    }
  }

  const removePlayer = (name) => {
    showConfirm(`${name} silinsin mi?`, async () => {
      try {
        await gs({ action: 'removePlayer', name })
        const updated = players.filter(p => p.name !== name)
        setPlayers(updated)
        savePlayers(updated)
        showToast('Oyuncu silindi')
      } catch {
        showToast('Silinemedi', true)
      }
    })
  }

  return (
    <div className="admin-tab-panel">
      <h3>Oyuncular</h3>
      <div className="player-add-form">
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="İsim" className="admin-input" />
        <select value={newPos} onChange={e=>setNewPos(e.target.value)} className="admin-select">
          {VALID_POS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn-primary" onClick={addPlayer}>Ekle</button>
      </div>
      <div className="player-list-admin">
        {players.map(p => (
          <div key={p.name} className="player-admin-row">
            <span>{p.name}</span>
            <span className="player-pos-badge">{p.pos?.[0]}</span>
            <button className="btn-danger-sm" onClick={() => removePlayer(p.name)}>Sil</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create remaining admin tabs**

`src/admin/tabs/BugunTab.jsx` — migrate "bugün" attendance tracking from `js/admin.js`.  
`src/admin/tabs/HakemTab.jsx` — migrate referee/score entry from `js/admin.js`.  
`src/admin/tabs/VideoTab.jsx` — migrate video URL management from `js/admin.js`.

Each tab follows the same pattern: read from `useStore`, call `gs()` for GAS actions, update store on success, `showToast` on error.

- [ ] **Step 5: Create `src/admin/AdminPanel.jsx`**

```jsx
import { useState } from 'react'
import { useStore } from '../store/index.js'
import { BugunTab }   from './tabs/BugunTab.jsx'
import { HakemTab }   from './tabs/HakemTab.jsx'
import { VideoTab }   from './tabs/VideoTab.jsx'
import { WeekTab }    from './tabs/WeekTab.jsx'
import { PlayersTab } from './tabs/PlayersTab.jsx'

const ADMIN_TABS = [
  { key: 'bugun',   label: 'Bugün',   Component: BugunTab },
  { key: 'hakem',   label: 'Hakem',   Component: HakemTab },
  { key: 'video',   label: 'Video',   Component: VideoTab },
  { key: 'hafta',   label: 'Hafta',   Component: WeekTab },
  { key: 'oyuncular', label: 'Oyuncular', Component: PlayersTab },
]

export default function AdminPanel() {
  const { setPinUnlocked } = useStore(s => s)
  const [tab, setTab] = useState('bugun')
  const ActiveTab = ADMIN_TABS.find(t => t.key === tab)?.Component

  return (
    <div className="admin-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>Admin</h2>
          <button className="btn-secondary" onClick={() => setPinUnlocked(false)}>Çıkış</button>
        </div>
        <div className="admin-tabs">
          {ADMIN_TABS.map(t => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="admin-content">
          {ActiveTab && <ActiveTab />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire PinModal to BottomNav**

In `src/components/ui/BottomNav.jsx`, add a long-press or double-tap on the nav bar logo to open PinModal:

```jsx
// Add to BottomNav:
import { PinModal } from '../modals/PinModal.jsx'
import { useState } from 'react'

// Inside component:
const [showPin, setShowPin] = useState(false)
// Add long-press handler on a hidden admin trigger button
```

Alternatively, add an admin button visible only in dev or behind a gesture. Follow the same trigger as `js/admin.js` (check what key combination or element triggers the PIN modal in the original code).

- [ ] **Step 7: Verify AdminPanel**

```bash
npm run dev
```
Trigger PIN modal, enter correct PIN (default `1234`). Expected: AdminPanel renders as overlay. All 5 tabs are accessible. WeekTab updates `manualWeek` in store. PlayersTab shows player list with add/delete.

- [ ] **Step 8: Commit**

```bash
git add src/components/modals/PinModal.jsx src/admin/
git commit -m "feat: admin panel with PIN auth and all management tabs"
```

---

## Task 14: YayinScreen & Remaining Modals

**Files:**
- Create: `src/components/screens/YayinScreen.jsx`
- Create: `src/components/modals/SuccessModal.jsx`

- [ ] **Step 1: Create `src/components/modals/SuccessModal.jsx`**

```jsx
import { useStore } from '../../store/index.js'

export function SuccessModal() {
  const successModal = useStore(s => s.successModal)
  if (!successModal) return null

  return (
    <div className="mbg open">
      <div className="modal-card success-modal">
        <div className="success-icon">✅</div>
        <p className="success-msg">{successModal.msg}</p>
      </div>
    </div>
  )
}
```

Add `<SuccessModal />` to `src/App.jsx` next to `<ConfirmModal />`.

- [ ] **Step 2: Create `src/components/screens/YayinScreen.jsx`**

Migrate from `js/stats.js`'s yayin/broadcast rendering. The yayin screen shows match videos and live scores:

```jsx
import { useStore } from '../../store/index.js'
import { useResults } from '../../hooks/useResults.js'

export default function YayinScreen() {
  const { resultData, matchesData } = useStore(s => s)
  useResults()

  const videos = matchesData?.matches?.filter(m => m.videoUrl) || []

  return (
    <div id="screen-yayin" className="screen">
      <div className="screen-header">
        <h2 className="stitle">Yayın</h2>
      </div>
      {videos.length === 0 && (
        <div className="nodata">Henüz video yok.</div>
      )}
      <div className="video-list">
        {videos.map((match, i) => (
          <div key={i} className="video-card">
            <div className="video-week">{match.week}</div>
            <div className="video-embed">
              <iframe
                src={match.videoUrl.replace('watch?v=', 'embed/')}
                title={`Maç ${match.week}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify YayinScreen**

```bash
npm run dev
```
Navigate to Yayın. Expected: Empty state "Henüz video yok" if no matches have videos. If match data has `videoUrl` fields, YouTube embeds render.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/YayinScreen.jsx src/components/modals/SuccessModal.jsx
git commit -m "feat: yayin screen and success modal"
```

---

## Task 15: PWA, Vercel & Cleanup

**Files:**
- Modify: `vercel.json`
- Delete: `js/`, `components/`, `css/`, `app.html`

- [ ] **Step 1: Update `vercel.json` for Vite build**

Replace existing content with:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "trailingSlash": false,
  "cleanUrls": true,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options",        "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy",        "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: `dist/` directory created. No build errors. Check `dist/index.html` references hashed JS/CSS files.

- [ ] **Step 3: Preview production build locally**

```bash
npm run preview
```
Expected: App runs at `http://localhost:4173`. Test all 6 screens, PWA manifest loads (check DevTools → Application → Manifest), service worker registers.

- [ ] **Step 4: Delete old vanilla JS files**

```bash
# Windows PowerShell
Remove-Item -Recurse -Force js/, components/, css/, app.html
```

Verify nothing breaks:
```bash
npm run build
```
Expected: Build still succeeds with no references to deleted files.

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: All Vitest tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: remove vanilla JS source, react migration complete"
```

- [ ] **Step 7: Push and verify Vercel deploy**

```bash
git push origin main
```
Expected: Vercel auto-deploys. Check Vercel dashboard for build logs — build should use `npm run build` and serve `dist/`. Test the live URL: all screens load, GAS API calls succeed, PWA installs correctly on mobile.

---

## Self-Review Notes

- **spec §3 (Zustand):** `showToast`/`showConfirm` actions covered in Task 4.
- **spec §5 (hooks):** `usePlayers` in Task 8, `useResults` in Task 9.
- **spec §6 (CSS):** Custom CSS preserved in Task 2; Tailwind applied via utility classes in all components.
- **spec §7 (FifaCard):** `_makeFifaCard` hack removed; `<FifaCard>` component in Task 9.
- **spec §8 (PWA):** `manifest: false` keeps `manifest.json` as a public asset; `vite-plugin-pwa` workbox in Task 1.
- **spec §9 (cleanup):** `window.*` and `onclick=` removed via React event handlers; old files deleted in Task 15.
- **spec §10 (order):** Tasks 1–15 follow the recommended migration order exactly.
