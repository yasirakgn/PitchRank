# mat.md Kalan Düzeltmeler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E-06 kart tier eşiklerini düşür, E-09 anomali tespitini posRating'e geçir, E-10 KİŞİSEL REKOR rozetini gerçek rekora çevir.

**Architecture:** E-09 için anomaly.js saf (pure) kalacak — opsiyonel `scorer` callback eklenir; caller (admin.js) posRating hesabını yapıp scorer olarak geçer. E-06 ve E-10 tek-dosya, satır-düzeyinde değişiklikler.

**Tech Stack:** Vanilla JS ES modules

**Not — zaten çözülmüş:**
- C-09: `renderFormStrip` zaten `ratingForWeek` → `posRating` kullanıyor
- E-05: `cosineSim` zaten `(ma && mb)` guard'ına sahip; `playerVector` null dönüyor
- E-08: `selectTeam` → `location.reload()` ile tüm state sıfırlanıyor, gerçek sorun yok

---

### Task 1: E-06 — Kart Tier Eşiklerini Güncelle

**Files:**
- Modify: `js/sharecard.js:64-66`

- [ ] **Step 1: sharecard.js'te eşikleri güncelle**

`js/sharecard.js` satır 64-66'yı bul:
```js
  if (rating >= 90) return CARD_TYPES.efsane;
  if (rating >= 85) return CARD_TYPES.altin;
  if (rating >= 75) return CARD_TYPES.gumus;
```
Şu hale getir:
```js
  if (rating >= 80) return CARD_TYPES.efsane;
  if (rating >= 70) return CARD_TYPES.altin;
  if (rating >= 60) return CARD_TYPES.gumus;
```

- [ ] **Step 2: Commit**

```bash
git add js/sharecard.js
git commit -m "fix(E-06): lower card tier thresholds to 80/70/60 for better motivation"
```

---

### Task 2: E-10 — KİŞİSEL REKOR Rozetini Düzelt

**Files:**
- Modify: `js/sharecard.js:167-168`

- [ ] **Step 1: Mevcut kodu bul**

`js/sharecard.js` satır 167-168:
```js
      const peak = Math.max(...all);
      if (all.slice(-3).includes(peak)) result.push({ e: '⭐', t: 'KİŞİSEL REKOR' });
```

- [ ] **Step 2: Gerçek rekor mantığına çevir**

Şu hale getir:
```js
      const prev = all.slice(0, -1);
      if (prev.length && all[all.length - 1] > Math.max(...prev)) {
        result.push({ e: '⭐', t: 'KİŞİSEL REKOR' });
      }
```

Mantık: son hafta skoru önceki tüm haftalardaki en yüksek skordan büyükse gerçek kişisel rekor.

- [ ] **Step 3: Commit**

```bash
git add js/sharecard.js
git commit -m "fix(E-10): personal record badge now requires last score > all previous weeks peak"
```

---

### Task 3: E-09 — Anomali Tespitini posRating'e Geçir

**Files:**
- Modify: `js/anomaly.js` — opsiyonel `scorer` parametresi ekle
- Modify: `js/admin.js` — posRating scorer oluştur ve geçir

- [ ] **Step 1: anomaly.js'e scorer parametresi ekle**

`detectAnomalies(resultData)` imzasını değiştir:
```js
export function detectAnomalies(resultData, scorer = null) {
```

İç döngüdeki değer okuma satırını bul:
```js
      if (v != null && !isNaN(+v)) valid.push({ v: +v, i });
```

Şu hale getir (scorer varsa onu çağır, yoksa eski davranış):
```js
      const raw = scorer ? scorer(p, i) : v;
      if (raw != null && !isNaN(+raw)) valid.push({ v: +raw, i });
```

Not: `v` tanımı değişmez (`const v = series[i];`), sadece `valid.push` satırı değişir.

- [ ] **Step 2: admin.js'e posRating importu ekle**

`js/admin.js` dosyasının import bölümüne ekle:
```js
import { posRating } from './rating.js';
```

- [ ] **Step 3: admin.js'te detectAnomalies çağrısını güncelle**

`js/admin.js` satır 531'deki `detectAnomalies(state.resultData)` satırını bul ve şu hale getir:
```js
    const scorer = (p, idx) => {
      const pObj = state.players.find(pl => pl.name === p.name) || { pos: ['OMO'] };
      const w = state.resultData.weeks[idx];
      const kr = p.weeklyKriterler?.[w] || {};
      const swd = { weeklyKriterler: { [w]: kr }, weeklyGenels: [p.weeklyGenels?.[idx]] };
      const r = posRating(swd, pObj);
      return r !== null ? r : p.weeklyGenels?.[idx];
    };
    const flags = detectAnomalies(state.resultData, scorer);
```

- [ ] **Step 4: Commit**

```bash
git add js/anomaly.js js/admin.js
git commit -m "fix(E-09): anomaly detection uses posRating via scorer callback, keeping anomaly.js pure"
```
