<div align="center">

# ⚽ PitchRank

### *Professional Player Rating & Statistics Platform for Futsal & Turf Football*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-spor.yagserakgun.com-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://spor.yagserakgun.com)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-6366f1?style=for-the-badge&logo=pwa&logoColor=white)](#)
[![Vanilla JS](https://img.shields.io/badge/Built%20With-Vanilla%20JS-f59e0b?style=for-the-badge&logo=javascript&logoColor=black)](#)
[![Google Sheets](https://img.shields.io/badge/Backend-Google%20Sheets-34a853?style=for-the-badge&logo=google-sheets&logoColor=white)](#)

<br/>

> **Rate your teammates. Track your progress. Dominate the leaderboard.**

<br/>

</div>

---

## 🌐 Live Preview

**[→ spor.yagserakgun.com](https://spor.yagserakgun.com)**

Install as a PWA on your phone — works fully offline after first load.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 **Player Rating** | Rate teammates across 7 weighted criteria per match week |
| 🃏 **FIFA-Style Cards** | Gold / Silver / Bronze / Normal card tiers with gloss effects |
| 📊 **Analytics** | Weekly rankings, performance trends, radar charts, comparison |
| 🏆 **Season Awards** | MVP, Market Leader, Iron Man, Top Scorer and 7 more trophies |
| 🤝 **Team Builder** | Smart balanced team generator with multi-metric swap optimization |
| 📺 **Match Broadcasts** | Embedded YouTube archive per match week |
| 🛡️ **Admin Panel** | PIN-protected panel for match scores, squad management, weekly settings |
| 🔒 **Vote Gate** | Results hidden until configurable voter threshold is reached |
| 🌙 **Dark / Light Mode** | System-aware, persisted globally across sessions |
| 📱 **PWA** | Installable on iOS & Android, offline capable |

---

## 🏗️ Architecture

PitchRank is a **zero-build vanilla JS SPA** — no bundler, no framework, no compile step. Every file is served as-is.

```
index.html          ← Single entry point
js/
  boot.js           ← Module entry; injects HTML components, calls initApp()
  main.js           ← App init, FIFA card, profile modal, team builder, navigation
  config.js         ← Team config, rating criteria, position weights
  storage.js        ← Session-scoped team selection, localStorage helpers
  state.js          ← Global mutable app state
  utils.js          ← Helpers: escHtml, toast, confirm, week label, etc.
  api.js            ← GAS fetch wrapper with retry
  rating.js         ← Weighted rating engine, market value, play styles
  players.js        ← Rating cards, sliders, submission
  stats.js          ← All analytics screens (weekly, trend, comparison, season)
  admin.js          ← Admin panel: scores, roster, hakem, video, settings
css/
  base.css          ← CSS variables, dark/light themes, reset
  main.css          ← All component styles
components/
  home.html         ← Team selection screen
  app.html          ← All main screens
  nav.html          ← Bottom navigation (SVG icons)
  modals.html       ← Profile, PIN, confirm dialogs
  toast.html        ← Toast notification container
app gs.txt          ← Google Apps Script source (deploy to GAS)
```

**Module dependency graph (strict DAG — no circular imports):**
```
config ← storage ← state ← utils ← api ← rating ← players ← stats ← admin → main → boot
```

---

## 🚀 Getting Started

### Local Development

```bash
# Serve locally (requires Node.js)
npx serve .

# Open in browser
http://localhost:3000
```

No build step. No `npm install`. Just serve and go.

### Deploying to Vercel

Push to GitHub → Vercel auto-deploys. Zero configuration needed.

```bash
git push origin main
```

The `vercel.json` handles SPA routing and cache headers automatically.

---

## 🔧 Adding a New Team

1. Create a new Google Sheet
2. Open **Extensions → Apps Script**, paste the contents of `app gs.txt`
3. Deploy as Web App (**Execute as: Me**, **Access: Anyone**)
4. Copy the deployment URL
5. Add an entry to `TEAM_CONFIG` in `js/config.js`:

```js
myteam: {
  id: 'myteam',
  name: 'My Team FC',
  emoji: '🦅',
  color: '#f59e0b',
  logo: 'assets/images/icon-192.png',
  gs: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_URL/exec'
}
```

6. Add a button in `components/home.html`

---

## 🎯 Rating System

Seven criteria, position-weighted per role:

| Criteria | KL | DEF | OMO | FRV |
|---|---|---|---|---|
| Pas | 0.30 | 0.60 | **1.00** | 0.65 |
| Sut | 0.05 | 0.20 | 0.55 | **1.00** |
| Dribling | 0.10 | 0.40 | 0.85 | **0.90** |
| Savunma | **1.00** | **1.00** | 0.50 | 0.10 |
| Hız / Kondisyon | 0.45 | 0.80 | 0.90 | **1.00** |
| Fizik | **0.90** | **0.90** | 0.80 | 0.75 |
| Takım Oyunu | 0.65 | 0.80 | **1.00** | 0.75 |

Scores range 1–10 per criterion. Final rating is a weighted average scaled to **0–99**.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JS (ES Modules), HTML5, CSS3
- **Backend:** Google Apps Script (deployed as Web App)
- **Database:** Google Sheets
- **Hosting:** Vercel
- **PWA:** Web App Manifest + service-worker-ready cache headers

---

## 📁 Google Apps Script

The file `app gs.txt` contains the complete GAS backend. Key rules when editing:

- `SHEET_ID` = spreadsheet ID only (not the full URL)
- `e.parameter` values are already URL-decoded — never double-decode
- Deploy with **"Execute as: Me"** and **"Who has access: Anyone"**
- The `Ayarlar` sheet stores runtime config (e.g. `oy_gizleme_siniri` = vote threshold)

---

## ⚙️ Cache & Deployment

```json
// vercel.json — key rules
"assets/**"  → immutable, 1 year
"css/**, js/**" → no-cache, must-revalidate (validates on every request)
"components/**" → no-cache, must-revalidate
```

When making breaking CSS/JS changes, bump the `?v=X` query string on stylesheet/script tags in `index.html`.

---

## 📜 License & Copyright

```
Copyright © 2024–2025 Yagser Akgun
All rights reserved.

This software and its source code are the exclusive property of Yagser Akgun.
Unauthorized copying, distribution, or modification of any part of this
project, via any medium, is strictly prohibited without prior written
permission from the author.
```

---

<div align="center">

**Built with ❤️ by [Yagser Akgun](https://spor.yagserakgun.com)**

*PitchRank — Take your weekend football seriously.*

</div>
