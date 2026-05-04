# PitchRank Güvenlik ve Kalite Düzeltmeleri - Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** analiz.md'deki 8 maddeyi sırasıyla uygulayarak güvenlik, kararlılık ve bakım kalitesini artırmak.

**Architecture:** Google Apps Script backend'e server-side token auth eklenecek, GET mutation'lar POST'a taşınacak, encoding normalize edilecek, XSS yüzeyi daraltılacak, PWA/route tek noktaya indirilecek.

**Tech Stack:** Vanilla JS (ES modules), Google Apps Script (GAS), Vercel static hosting, PWA manifest

---

## Madde 1 — Backend yetkilendirme (server-side token)

**Dosyalar:**
- Değiştir: `app gs.txt`
- Değiştir: `js/admin.js`
- Değiştir: `js/api.js`

**Yaklaşım:**
- `verifyPin` başarılı olunca GAS'ta rastgele token üretilir, `CacheService` ile 2 saat saklanır, client'a döndürülür.
- `requireAdmin(params)` yardımcısı: `params.adminToken` cache'te yoksa hata döner.
- Tüm admin yazma action'ları bu kontrolü çağırır.
- `setAdminSession()` tokeni sessionStorage'a yazar.
- `gs()` fonksiyonu her istekte sessionStorage'daki tokeni otomatik ekler.

**Admin yazma action'ları (token gerektirir):**
`saveMatch`, `saveMevki`, `savePlayer`, `deletePlayer`, `saveVideo`,
`saveTodayPlayers`, `saveHakem`, `saveManualWeek`, `saveSetting`, `saveAttendance`

**Token gerektirmeyen action'lar (okuma / kullanıcı işlemleri):**
`save` (puanlama), `getResults`, `getMatches`, `getMevkiler`, `getGoals`,
`getAttendance`, `getPlayers`, `getVideos`, `getTodayPlayers`, `getHakem`,
`checkVoted`, `getManualWeek`, `verifyPin`

### Adım 1.1 — GAS: `verifyPin` token üretsin

`verifyPin` başarılı dalında şu bloğu ekle (`return json({ success: true });` yerine):
```javascript
var token = Utilities.getUuid();
CacheService.getScriptCache().put('ADMIN_' + token, '1', 7200);
return json({ success: true, token: token });
```

### Adım 1.2 — GAS: `requireAdmin` yardımcısı ekle

`verifyPin` fonksiyonundan hemen önce:
```javascript
function requireAdmin(params) {
  var token = String(params.adminToken || '').trim();
  if (!token) return json({ success: false, error: 'Yetkisiz: token eksik.' });
  var cached = CacheService.getScriptCache().get('ADMIN_' + token);
  if (cached !== '1') return json({ success: false, error: 'Yetkisiz: token gecersiz veya suresi dolmus.' });
  return null;
}
```

### Adım 1.3 — GAS: Yazma action'larına kontrol ekle

Her yazma fonksiyonunun başına şunu ekle (örnek `saveMatch`):
```javascript
function saveMatch(params) {
  var authErr = requireAdmin(params);
  if (authErr) return authErr;
  // ... mevcut kod devam eder
```
Bunu `saveMatch`, `saveMevki`, `savePlayer`, `deletePlayer`, `saveVideo`,
`saveTodayPlayers`, `saveHakem`, `saveManualWeek`, `saveSetting`, `saveAttendance`
için tekrarla.

### Adım 1.4 — `js/admin.js`: Token'ı sessionStorage'a kaydet

`setAdminSession(token)` fonksiyonunu token alacak şekilde güncelle:
```javascript
function setAdminSession(token) {
  sSet('hs_admin_session', JSON.stringify({
    token: token || Math.random().toString(36).slice(2) + Date.now().toString(36),
    adminToken: token || '',
    expires: Date.now() + 2 * 60 * 60 * 1000
  }));
}
```

`checkPin()` içinde `setAdminSession()` çağrısını `setAdminSession(d.token)` olarak güncelle:
```javascript
if (d.success) {
  clearAdminLock(); setAdminSession(d.token);
  // ...
```

### Adım 1.5 — `js/api.js`: Her istekte adminToken'ı otomatik ekle

`gs()` içinde URL oluştururken token'ı params'a ekle:
```javascript
export function gs(p) {
  return new Promise((resolve, reject) => {
    const runRequest = (retryCount = 0) => {
      const baseUrl = getGS();
      const allParams = { ...p };
      try {
        const sess = JSON.parse(sGet('hs_admin_session') || '{}');
        if (sess.adminToken) allParams.adminToken = sess.adminToken;
      } catch (_) {}
      const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') +
        Object.keys(allParams).map(k =>
          encodeURIComponent(k) + '=' + encodeURIComponent(allParams[k])
        ).join('&');
      // ... mevcut fetch kodu devam eder
```

`sGet` importunu `api.js`'e ekle:
```javascript
import { getGS, CURRENT_TEAM, sGet } from './storage.js';
```

### Adım 1.6 — Manuel test

1. Tarayıcı DevTools → Network sekmesini aç.
2. PIN ile admin girişi yap → `verifyPin` response'ında `token` alanı görünmeli.
3. Herhangi bir admin yazma işlemi yap (örn. maç kaydet) → request URL'de `adminToken=...` parametresi olmalı.
4. Yeni sekme aç, `verifyPin` olmadan DevTools Console'dan `fetch(gasUrl + '?action=saveManualWeek&week=2026-H01')` çağır → `{success:false, error:'Yetkisiz...'}` dönmeli.
5. Her şey çalışıyorsa commit at.

### Adım 1.7 — Commit

```
git add app\ gs.txt js/admin.js js/api.js
git commit -m "security: add server-side admin token auth to GAS write endpoints"
```

---

## Madde 2 — GET yazma işlemlerini POST'a taşı

**Dosyalar:**
- Değiştir: `app gs.txt` (doPost ekle)
- Değiştir: `js/api.js` (yazma action'ları için POST kullan)

**Yaklaşım:**
GAS'a `doPost(e)` ekle, JSON body parse et. `js/api.js`'de yazma action listesi tut; bu action'lar için `fetch` POST ile body göndersin. Okuma action'ları GET olarak kalsın. Token artık query string değil POST body'de gider.

**Yazma action listesi:**
`save`, `saveMatch`, `saveMevki`, `savePlayer`, `deletePlayer`, `saveVideo`,
`saveTodayPlayers`, `saveHakem`, `saveManualWeek`, `saveSetting`, `saveAttendance`, `verifyPin`

### Adım 2.1 — GAS: `doPost` ekle

`doGet` fonksiyonundan önce:
```javascript
function doPost(e) {
  var params = {};
  try { params = JSON.parse(e.postData.contents || '{}'); } catch(_) {}
  var action = params.action;
  if (action === 'save')             return saveRating(params);
  if (action === 'saveMatch')        return saveMatch(params);
  if (action === 'saveMevki')        return saveMevki(params);
  if (action === 'savePlayer')       return savePlayer(params);
  if (action === 'deletePlayer')     return deletePlayer(params);
  if (action === 'saveVideo')        return saveVideo(params);
  if (action === 'verifyPin')        return verifyPin(params);
  if (action === 'saveTodayPlayers') return saveTodayPlayers(params);
  if (action === 'saveHakem')        return saveHakem(params);
  if (action === 'saveAttendance')   return saveAttendance(params);
  if (action === 'saveManualWeek')   return saveManualWeek(params);
  if (action === 'saveSetting')      return saveSetting(params);
  return json({ error: 'Bilinmeyen action' });
}
```

### Adım 2.2 — `js/api.js`: Yazma action'larını POST ile gönder

```javascript
import { getGS, CURRENT_TEAM, sGet } from './storage.js';
import { showToast } from './utils.js';

const WRITE_ACTIONS = new Set([
  'save','saveMatch','saveMevki','savePlayer','deletePlayer','saveVideo',
  'verifyPin','saveTodayPlayers','saveHakem','saveAttendance',
  'saveManualWeek','saveSetting'
]);

export function gs(p) {
  return new Promise((resolve, reject) => {
    const runRequest = (retryCount = 0) => {
      const baseUrl = getGS();
      const isWrite = WRITE_ACTIONS.has(p.action);
      const allParams = { ...p };
      if (isWrite) {
        try {
          const sess = JSON.parse(sGet('hs_admin_session') || '{}');
          if (sess.adminToken) allParams.adminToken = sess.adminToken;
        } catch (_) {}
      }

      const fetchOpts = isWrite
        ? { method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allParams) }
        : { method: 'GET', redirect: 'follow' };

      const url = isWrite
        ? baseUrl
        : baseUrl + (baseUrl.includes('?') ? '&' : '?') +
          Object.keys(allParams).map(k =>
            encodeURIComponent(k) + '=' + encodeURIComponent(allParams[k])
          ).join('&');

      console.log(`[PitchRank] ${isWrite ? 'POST' : 'GET'} ${p.action}`);

      fetch(url, fetchOpts)
        .then(r => { if (!r.ok) throw new Error(`HTTP Error: ${r.status}`); return r.json(); })
        .then(data => { resolve(data); })
        .catch(err => {
          if (retryCount < 2) {
            setTimeout(() => runRequest(retryCount + 1), 1500 * (retryCount + 1));
          } else {
            console.error(`[PitchRank] ❌ ${p.action} hatası:`, err);
            if (CURRENT_TEAM === 'arion') {
              showToast('Arion FC bağlantı hatası!', true);
            }
            reject(err);
          }
        });
    };
    runRequest();
  });
}
```

### Adım 2.3 — Manuel test

1. Admin olarak giriş yap → `verifyPin` artık POST olmalı (Network'te görebilirsin).
2. Maç kaydet, oyuncu ekle — action'lar POST ile gitmeli.
3. Puan verme akışı (POST) çalışmalı.
4. Sonuç/sıralama ekranları (GET) çalışmalı.

### Adım 2.4 — Commit

```
git add app\ gs.txt js/api.js
git commit -m "security: move write actions to POST body; GET retained for reads"
```

---

## Madde 3 — `saveRating` için atomik double-vote koruması (LockService)

**Dosyalar:**
- Değiştir: `app gs.txt` (`saveRating` fonksiyonu)

### Adım 3.1 — GAS: `saveRating`'e LockService ekle

```javascript
function saveRating(params) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Puanlar');
    if (!sheet) { /* ... mevcut sheet oluşturma */ }
    var scores = JSON.parse(params.scores);
    var week = params.week, rater = params.rater, now = new Date().toLocaleString('tr-TR');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === week && String(data[i][2]) === rater) {
        return json({ success: false, alreadyVoted: true, error: 'Bu hafta zaten oy kullandınız.' });
      }
    }
    Object.keys(scores).forEach(function(player) {
      var k = scores[player];
      sheet.appendRow([now, week, rater, player, k['Pas']||'', k['Sut']||'', k['Dribling']||'', k['Savunma']||'', k['Hiz / Kondisyon']||'', k['Fizik']||'', k['Takim Oyunu']||'']);
    });
    var katSheet = getOrCreateKatilimSheet(ss);
    setAttendance(katSheet, now, week, rater, 1);
    return json({ success: true });
  } finally {
    lock.releaseLock();
  }
}
```

### Adım 3.2 — Manuel test

GAS editor'ünden `saveRating` fonksiyonunu iki paralel execution ile test etmek mümkün değil; bu değişiklik için kodu inceleme ve deploy yeterli. Gerçek double-vote testi için aynı kullanıcıyla iki sekme açıp aynı anda submit etmeyi dene — ikinci istek reddedilmeli.

### Adım 3.3 — Commit

```
git add app\ gs.txt
git commit -m "fix: wrap saveRating in LockService for atomic double-vote protection"
```

---

## Madde 4 — Encoding temizliği (UTF-8 normalize)

**Dosyalar:**
- Değiştir: `index.html`, `components/app.html`, `components/modals.html`, `components/home.html`, `components/nav.html`, `components/toast.html`
- Değiştir: `js/config.js`, `js/utils.js`
- Değiştir: `manifest.json`

**Yaklaşım:** Dosyaları UTF-8 olarak yeniden kaydet, bozuk karakter sekanslarını (`Ä`, `Å`, `ğŸ`, `â` vb.) doğru UTF-8 karakterlerle değiştir. `js/utils.js` içindeki Türkçe karakter map'ini de kontrol et.

Encoding sorunlarını tespit et:
```bash
node -e "const fs=require('fs'); const t=fs.readFileSync('index.html','utf8'); console.log([...t].filter(c=>c.charCodeAt(0)>127).slice(0,30).join(''));"
```

Her dosyayı aç, bozuk sekansları bul ve düzelt. Sonra her dosyayı UTF-8 olarak kaydet.

### Adım 4.1 — Commit

```
git add index.html components/ js/config.js js/utils.js manifest.json
git commit -m "fix: normalize all files to UTF-8, fix broken Turkish character sequences"
```

---

## Madde 5 — HTML enjeksiyonu / XSS escape eksiklerini kapat

**Dosyalar:**
- Değiştir: `js/main.js` (satır ~234-250)
- Değiştir: `js/admin.js` (satır ~391, ~434)
- Değiştir: `js/stats.js` (satır ~1023, ~1061-1094)

**Eklenecek yardımcı** (`js/utils.js` içine, mevcut `escHtml` yanına):
```javascript
export function escAttr(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
```

Ardından tüm enjeksiyon noktalarında:
- `innerHTML` string'lerine giren kullanıcı verisi → `escHtml()`
- `onclick="fn('${val}')"` gibi attribute içi değerler → `escJsSingle()` (admin.js'de zaten var)
- `title="${val}"` gibi attribute'lar → `escAttr()`

### Adım 5.1 — Commit

```
git add js/main.js js/admin.js js/stats.js js/utils.js
git commit -m "security: escape user data in innerHTML and attribute contexts to close XSS surface"
```

---

## Madde 6 — PWA/route/boot sürümü tek giriş noktası

**Dosyalar:**
- Değiştir: `manifest.json` (`start_url`)
- Değiştir: `vercel.json` (fallback hedefi)
- Değiştir: `app.html` (boot sürümünü index.html ile eşitle)

**Yaklaşım:**
- `manifest.json` → `"start_url": "/"` yap
- `vercel.json` fallback → `/index.html` olsun
- `app.html`'deki `boot.js?v=3.1` → `boot.js?v=3.2` yap (index.html ile eşitle)
- `app.html`'deki `noindex,nofollow` değerini gözden geçir

### Adım 6.1 — Commit

```
git add manifest.json vercel.json components/app.html
git commit -m "fix: unify PWA start_url, Vercel fallback, and boot version to single entry point"
```

---

## Madde 7 — Inline handler/style azaltma refaktoru

**Dosyalar:**
- Değiştir: `components/app.html`, `js/stats.js`, `js/admin.js`, `js/main.js`
- Değiştir: `css/main.css` (yeni ortak sınıflar)

**Yaklaşım:** En çok tekrar eden inline style kalıplarını (`display:flex`, `margin`, `padding` bloklarını) CSS sınıflarına taşı. `onclick="..."` attribute'larından delegated listener'lara geç — özellikle liste render eden döngülerde.

Bu madde kapsamlı refaktordur; kritik olmayan değişiklikler ufak PR'larla yapılmalı.

### Adım 7.1 — Commit

```
git add components/ js/ css/
git commit -m "refactor: extract common inline styles to CSS classes, begin event delegation migration"
```

---

## Madde 8 — Saf fonksiyon testleri

**Dosyalar:**
- Oluştur: `tests/forecast.test.js`
- Oluştur: `tests/anomaly.test.js`
- Oluştur: `tests/lineup.test.js`
- Oluştur: `tests/utils.test.js`
- Değiştir: `package.json` (test script ekle)

**Yaklaşım:** Node.js built-in `node:test` + `assert` modülleri ile, dış bağımlılık gerektirmeyen saf fonksiyonları test et.

**Test edilecek fonksiyonlar:**
- `forecastHoltWinters` (js/forecast.js)
- `detectAnomalies` (js/anomaly.js)
- `findOptimalLineup` (js/lineup-optimizer.js)
- `normPos`, `escHtml` (js/utils.js)

`package.json` test script:
```json
"test": "node --test tests/*.test.js"
```

### Adım 8.1 — Commit

```
git add tests/ package.json
git commit -m "test: add node:test unit tests for pure functions (forecast, anomaly, lineup, utils)"
```

---

## Özet

| # | Madde | Ana Dosyalar | Risk |
|---|-------|-------------|------|
| 1 | Backend token auth | `app gs.txt`, `admin.js`, `api.js` | Kritik |
| 2 | GET→POST | `app gs.txt`, `api.js` | Kritik |
| 3 | LockService | `app gs.txt` | Yüksek |
| 4 | Encoding | Tüm HTML/JS | Yüksek |
| 5 | XSS escape | `main.js`, `admin.js`, `stats.js` | Yüksek |
| 6 | PWA/route | `manifest.json`, `vercel.json` | Orta |
| 7 | Inline refaktor | `app.html`, CSS | Düşük |
| 8 | Testler | `tests/` | Düşük |
