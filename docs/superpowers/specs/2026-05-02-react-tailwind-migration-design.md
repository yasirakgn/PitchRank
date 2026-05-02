# PitchRank — React + Tailwind Migration Design

**Tarih:** 2026-05-02  
**Kapsam:** Mevcut vanilla JS PWA'yı Vite + React 18 + Tailwind CSS + Zustand'a taşımak

---

## 1. Tech Stack

| Katman | Seçim | Gerekçe |
|---|---|---|
| Build | Vite + React 18 (JS) | Pure SPA, SSR gerekmez; Next.js overkill |
| State | Zustand | Mevcut `state.js` ile 1:1 API benzerliği |
| CSS | Tailwind v3 + custom CSS hybrid | Karmaşık SVG/FIFA card stilleri custom CSS'de kalır |
| Routing | State-based (`activeScreen`) | Mevcut `switchMainScreen()` davranışı korunur, React Router gerekmez |
| PWA | vite-plugin-pwa | Mevcut manifest ve service worker desteği |
| Deploy | Vercel (değişmez) | Static SPA, `vercel.json` minimal güncelleme |

---

## 2. Proje Yapısı

```
pitchrank-react/          ← yeni repo kökü (Big Bang yaklaşımı)
  src/
    components/
      screens/
        HomeScreen.jsx
        PuanlaScreen.jsx
        SiralamaScreen.jsx
        IstatistikScreen.jsx
        TakimScreen.jsx
        YayinScreen.jsx
        ProfilScreen.jsx
      modals/
        PinModal.jsx
        ConfirmModal.jsx
        TeamConfirmModal.jsx
        SuccessModal.jsx
      ui/
        FifaCard.jsx
        BottomNav.jsx
        Toast.jsx
        BadgeGrid.jsx
        FormStrip.jsx
        CriteriaArcs.jsx
        DnaMatches.jsx
    admin/
      AdminPanel.jsx
      tabs/
        BugunTab.jsx
        HakemTab.jsx
        VideoTab.jsx
        WeekTab.jsx
        PlayersTab.jsx
    hooks/
      usePlayers.js
      useResults.js
      useMatches.js
    lib/                  ← mevcut pure logic modülleri (büyük çoğunluk değişmez)
      api.js              ← değişmez
      config.js           ← değişmez
      rating.js           ← değişmez
      forecast.js         ← değişmez
      anomaly.js          ← değişmez
      dna.js              ← değişmez
      lineup-optimizer.js ← değişmez
      storage.js          ← değişmez (lGet/lSet/sGet/sSet/getGS korunur)
      utils.js            ← showToast/showConfirm DOM fonksiyonları kaldırılır;
                             toast/confirm Zustand store üzerinden tetiklenir
    store/
      index.js            ← Zustand store
    styles/
      custom.css          ← mevcut CSS variables + karmaşık component stilleri
    App.jsx
    main.jsx
  index.html
  vite.config.js
  tailwind.config.js
  vercel.json
  manifest.json
```

---

## 3. State Yönetimi (Zustand)

Mevcut `state.js` objesinin birebir karşılığı:

```js
// src/store/index.js
import { create } from 'zustand'
import { lGet, lSet, sGet, sSet } from '../lib/storage'

export const useStore = create((set, get) => ({
  // State alanları
  players: [],
  resultData: null,
  matchesData: null,
  darkMode: lGet('hs_dark') === '1',
  manualWeek: lGet('hs_manual_week') || null,
  currentRater: sGet('hs_current_rater') || null,
  sonucData: null,
  todaySelected: {},
  activeScreen: null,        // null = home göster
  activeStatScreen: 'sonuc', // istatistik alt ekranı
  pinUnlocked: false,
  toast: null,            // { message, type } — Toast component dinler
  confirmDialog: null,    // { message, onConfirm } — ConfirmModal dinler

  // Actions
  setPlayers: (players) => set({ players }),
  setResultData: (data) => set({ resultData: data }),
  setMatchesData: (data) => set({ matchesData: data }),
  setDarkMode: (v) => {
    lSet('hs_dark', v ? '1' : '0')
    document.documentElement.classList.toggle('dark', v)
    set({ darkMode: v })
  },
  setCurrentRater: (name) => {
    sSet('hs_current_rater', name)
    set({ currentRater: name })
  },
  setManualWeek: (w) => {
    lSet('hs_manual_week', w || '')
    set({ manualWeek: w || null })
  },
  setTodaySelected: (v) => set({ todaySelected: v }),
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setActiveStatScreen: (s) => set({ activeStatScreen: s }),
  setPinUnlocked: (v) => set({ pinUnlocked: v }),
}))
```

**Önemli:** Modüller artık `state.js`'i import etmez — React component'ları `useStore` hook'unu çağırır. Pure lib modülleri (`api.js`, `rating.js` vb.) state'e dokunmaz, sadece veri alır/döndürür.

---

## 4. Routing (State-based)

React Router kurulmaz. Ekran geçişi Zustand `activeScreen` alanıyla yönetilir:

```jsx
// App.jsx
function App() {
  const activeScreen = useStore(s => s.activeScreen)
  const darkMode = useStore(s => s.darkMode)

  // Dark mode class sync
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  if (!activeScreen) return <HomeScreen />

  return (
    <>
      <BottomNav />
      {activeScreen === 'puanla'     && <PuanlaScreen />}
      {activeScreen === 'siralama'   && <SiralamaScreen />}
      {activeScreen === 'istatistik' && <IstatistikScreen />}
      {activeScreen === 'takim'      && <TakimScreen />}
      {activeScreen === 'yayin'      && <YayinScreen />}
      {activeScreen === 'profil'     && <ProfilScreen />}
      <Modals />
      <Toast />
    </>
  )
}
```

---

## 5. Veri Akışı (Custom Hooks)

GAS API çağrıları custom hook'lara taşınır:

```js
// src/hooks/useResults.js
export function useResults() {
  const { setResultData, setMatchesData } = useStore(s => s)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadResults()   // mevcut lib/players.js fonksiyonu
      setResultData(data)
    } catch(e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  return { load, loading, error }
}
```

- `usePlayers` — `loadPlayersFromSheets()` sarar
- `useResults` — `loadResults()` sarar  
- `useMatches` — maç verisi için

Her screen component kendi hook'unu mount'ta çağırır. localStorage cache mantığı `lib/players.js`'de değişmez.

---

## 6. CSS Stratejisi

**Tailwind ile yapılacaklar:**
- Tüm layout (flex, grid, gap, padding, margin)
- Typography (font-size, font-weight, color)
- Butonlar, inputlar, basit kartlar, nav
- Responsive breakpoints
- `dark:` variant ile dark mode utility'leri

**`src/styles/custom.css`'de kalacaklar:**
- CSS değişkenleri: `--bg`, `--bg2`, `--bg3`, `--text`, `--text2`, `--text3`, `--border`, `--border2`, `--accent`
- Takım renk değişkenleri
- FIFA card stilleri (gradient, clip-path, layered design)
- Sparkline SVG class'ları: `.spark-line`, `.spark-dot`, `.spark-lbl`, `.spark-week`
- Badge hexagon: `.badge-hex-item`, `.badge-hex-shape`, `.badge-hex-grid`
- Kriter arc SVG: `.crit-arc`, `.crit-arc-svg`, `.crit-arc-fill.good/mid/low`
- Profil hero section'ları: `.prof-hero`, `.prof-avatar-wrap`, `.prof-watermark`

**Tailwind config:**
```js
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

---

## 7. `makeFifaCard` Refactor

Mevcut `makeFifaCard` fonksiyonu `main.js`'den `stats.js`'e callback olarak geçiriliyordu (circular dep kaçınmak için). React'te bu sorun kalkar:

```jsx
// src/components/ui/FifaCard.jsx
export function FifaCard({ player, pObj, rank, data, overrideScore }) {
  // mevcut makeFifaCard mantığı JSX'e taşınır
}

// SiralamaScreen ve IstatistikScreen doğrudan import eder
import { FifaCard } from '../ui/FifaCard'
```

`_makeFifaCard` cache hack'i tamamen kaldırılır.

---

## 8. PWA Konfigürasyonu

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,      // manifest.json public/'de ayrı dosya olarak kalır
      includeAssets: ['assets/images/**'],
    })
  ]
})
```

Mevcut `manifest.json` ve `assets/images/` ikonlar aynen korunur.

---

## 9. Taşınacak / Kaldırılacak Şeyler

| Mevcut | React'te |
|---|---|
| `js/boot.js` (data-include fetch) | Kaldırılır — JSX component import |
| `window.*` export'ları (~50 adet) | Kaldırılır — React event handler'lar |
| `onclick=` HTML atribütleri | `onClick={}` JSX prop'ları |
| `document.getElementById(...)` | `useRef` veya Zustand state |
| `js/main.js` | `App.jsx` + ayrı screen component'lara bölünür |
| `components/*.html` | JSX component'larına dönüşür |
| `js/profile.js` (render fonksiyonları) | `ProfilScreen.jsx` + sub-component'lara bölünür |

---

## 10. Migration Sırası (Önerilen)

1. Vite + React + Tailwind + Zustand kurulumu, temel `App.jsx`
2. `src/lib/` — pure logic modülleri kopyala, import path'lerini düzelt
3. `src/store/index.js` — Zustand store
4. `HomeScreen` — takım seçimi
5. `BottomNav` + ekran routing
6. `PuanlaScreen` — slider'lar, rating submit
7. `SiralamaScreen` — FIFA card grid
8. `IstatistikScreen` + tüm sub-screen'ler
9. `TakimScreen` + lineup optimizer
10. `ProfilScreen` — form strip, badge, DNA, criteria arcs
11. `AdminPanel` — PIN auth + tüm tab'lar
12. `YayinScreen`
13. Modal'lar + Toast
14. PWA konfigürasyonu
15. Vercel deploy testi
