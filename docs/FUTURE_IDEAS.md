# PitchRank — Futuristik Yol Haritası & Geliştirme Fikirleri

> Tarih: 2026-04-29
> Kapsam: Mimari modernizasyon, AI/ML entegrasyonu, sosyal/gamification katmanı, real-time, AR/VR, performans
> Hedef: Halı saha hobi aracından **Sports Performance OS**'a evrim
> Mevcut sürüm: v3.2 — vanilla JS PWA + Google Apps Script backend

---

## 0. Şu Anki Durum (Hızlı Özet)

**Güçlü yanlar:**
- Strict DAG modül grafı, sıfır build step (deploy hızı muazzam)
- 2 takım çoklu-kiracı (multi-tenant) yapısı (`TEAM_CONFIG`)
- 7 kriter × 4 mevki ağırlıklı skorlama (`POS_WEIGHTS`)
- Cache-first + stale-while-revalidate veri yükleme deseni
- FIFA-style kart canvas render (`sharecard.js`)
- Rozet sistemi, market value, std-dev tabanlı tutarlılık metriği
- PWA-ready (manifest + standalone display)

**Zayıf yanlar / Gap:**
- ❌ **Service Worker yok** → offline çalışmıyor, yükleme her seferinde ağ bekliyor
- ❌ **WebSocket / real-time yok** → "kim oy verdi" canlı görünmüyor, polling/refresh ile çözülmüş
- ❌ **AI/ML yok** → tüm metrikler manuel formül; tahmin (forecast), benzer oyuncu, anomali tespiti yok
- ❌ **Auth zayıf** → kimlik `select` üzerinden, kimsenin başkası adına oy vermesi engellenmiyor
- ❌ **CSP `unsafe-inline + unsafe-eval`** → XSS yüzeyi büyük
- ❌ **Inline `onclick=` 50+ yer** → window pollution, test edilebilirlik düşük
- ❌ **CSS tek dosyada 1943 satır** → component-scoped değil, dark/light tek bir `body.dark` switch
- ❌ **Telemetri/analytics yok** → kullanıcı davranışı hakkında veri yok
- ❌ **i18n yok** → Türkçe hard-coded, İngilizce destek var ama metinler dağınık
- ❌ **GAS bottleneck** → her takımın GS endpointi quota'lı, response time 800–2500ms
- ❌ **Görsel asset yönetimi manuel** → `?v=` query string ile cache busting el ile

---

## 1. 🧠 AI / ML Entegrasyonu

### 1.1 Oyuncu Performans Tahmini (Forecast Engine)
**Ne:** Önümüzdeki 3-5 haftalık rating projeksiyonu — formdaki yükseliş/düşüş öngörüsü.
**Nasıl:**
- Mevcut `weeklyGenels` zaman serisini kullan
- Client-side: **Holt-Winters exponential smoothing** veya basit ARIMA(1,1,0) — saf JS
- Sunucu-side (opsiyonel): Cloudflare Workers AI üstünde küçük bir LSTM, tek API çağrısı
- UI: profil sayfasında "Form Trendi" grafiğinin üzerine kesik çizgili tahmin bandı (üst/alt güven aralığı dahil)

**Faydası:** "Bu hafta kimi kadroya alalım?" sorusu için veri-destekli karar.
**Dosya etkilenir:** `js/rating.js` (yeni `forecastRating(p, weeks)`), `components/app.html` profil grafiği.

```js
// js/forecast.js — yeni modül
export function forecastHoltWinters(series, periods = 4, alpha = 0.4, beta = 0.2) {
  // Çift exponential smoothing — sezonluk değil ama trend yakalar
  // Series: [7.2, 7.5, null, 8.1, 7.9, 8.3, ...]
  const cleaned = series.filter(v => v != null);
  if (cleaned.length < 3) return [];
  let level = cleaned[0], trend = cleaned[1] - cleaned[0];
  for (let i = 1; i < cleaned.length; i++) {
    const prev = level;
    level = alpha * cleaned[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  return Array.from({ length: periods }, (_, k) => level + (k + 1) * trend);
}
```

### 1.2 Benzer Oyuncu (Player DNA / Doppelgänger)
**Ne:** "Bu oyuncuya en çok benzeyen 3 oyuncu" — 7 kriterin vektörü üzerinden cosine similarity.
**Nasıl:** Her oyuncuyu 7 boyutlu vektör olarak (criteria avg) tut, `cos(θ) = A·B / (|A||B|)`.
**Faydası:** Sakatlık/transfer durumunda yedek bulma, oyun stili eşleştirme.
**UI:** Profilde "DNA Eşleşmesi" bölümü — 3 mini kart.

```js
function playerVector(p) {
  return CRITERIA.map(c => criteriaAvg(p, c));
}
function cosineSim(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const ma = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const mb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return ma && mb ? dot / (ma * mb) : 0;
}
```

### 1.3 Anomali Tespiti (Outlier Detector)
**Ne:** "Bu hafta X oyuncusu normalde 7.5 alır, 3.2 verilmiş — yanlış oy mu?"
**Nasıl:** Z-score > 2.5 → flag. Admin ekranında otomatik uyarı listesi.
**Faydası:** Sürtüşme oylarını ve veri girişi hatalarını yakalama.

### 1.4 Doğal Dil Maç Özeti (LLM Match Recap)
**Ne:** Maç bittikten sonra "Bu hafta Ali 2 gol attı, Veli pası ile fark yarattı..." otomatik metin.
**Nasıl:**
- Cloudflare Workers AI / Anthropic Claude Haiku API → `claude-haiku-4-5-20251001`
- Maç verisi (skor, golcüler, en yüksek puan alanlar) → prompt → 3-4 cümle Türkçe özet
- Cache: aynı maç için tekrar çağırma, GAS'a `summary` alanı ekle

```js
// js/ai.js — yeni
export async function generateMatchRecap(matchData, players) {
  const prompt = buildRecapPrompt(matchData, players);
  const r = await fetch('/api/recap', { method: 'POST', body: JSON.stringify({ prompt }) });
  return (await r.json()).text;
}
```

**Endpoint:** Cloudflare Worker veya Vercel Edge Function (GAS yerine — quota daha az kısıtlı).

### 1.5 Akıllı Lineup Optimizer
**Ne:** "Bu hafta gelen 12 kişi içinden en iyi 5'i seç" — kombinatoryel optimizasyon.
**Nasıl:**
- Mevki kısıtları (1 KL, 1-2 DEF, 1-2 OMO, 1 FRV)
- Hedef fonksiyon: toplam `posRating` × takım uyumu (chemistry — birlikte oynadıkça artan bonus)
- Algoritma: 12C5 = 792 kombinasyon → tüm permütasyonları hesapla, brute-force yeterli
- Bonus: alternatif "agresif", "savunmacı", "hızlı" preset'ler

### 1.6 Adversarial Vote Detection
**Ne:** Oyuncuya kasıtlı düşük puan veren rater'ları tespit et.
**Nasıl:** Her rater için "ortalamadan sapma profili" → bazı oyunculara sürekli -2σ veriyorsa flag.
**Faydası:** Adillik. Admin paneline "Şüpheli oy desenleri" raporu.

---

## 2. ⚡ Real-Time Katmanı

### 2.1 Live Voting Pulse (Server-Sent Events)
**Ne:** "Şu anda 7 kişi oy veriyor, 3'ü tamamladı" canlı widget.
**Nasıl:**
- GAS yerine **Cloudflare Workers + Durable Objects** veya **Supabase Realtime**
- SSE/WebSocket: vote event'leri broadcast
- Her client'ta küçük bir "🟢 7 aktif" badge
**Trade-off:** GAS'ı bırakmak veya hibrit (oy yazma GAS'a, presence Cloudflare'e).

### 2.2 Live Match Mode
**Ne:** Maç sırasında telefon ile gerçek zamanlı skor + gol kaydı.
**Nasıl:**
- Yeni `screen-canli` ekranı: büyük skorboard + "+1 gol" butonu
- Gol atan oyuncu seçince herkesin ekranında anında güncellenir
- Maç sonu: skor + gol verileri otomatik `saveMatch` GAS endpoint'ine
**UI:** Tam ekran scoreboard, ses efektleri, vibration API.

### 2.3 Push Notification (Web Push)
**Ne:** "Bu hafta puanlama açıldı", "Sıralamada 1.'liğe yükseldin", "Yeni rozet kazandın".
**Nasıl:**
- Service Worker + `Notification API` + Web Push protokolü
- Backend: Cloudflare Worker `web-push` paketi (VAPID anahtarları)
- Kullanıcı opt-in: ilk PIN doğrulamasından sonra prompt
**Bonus:** Cron job — "haftanın oylama deadline'ı yaklaşıyor".

### 2.4 Collaborative Lineup Drafting
**Ne:** Takım kurarken arkadaşınla aynı anda — bir kişi taşıyor, diğeri görüyor.
**Nasıl:** Yjs CRDT + WebRTC peer-to-peer (sunucusuz!).

---

## 3. 🎮 Gamification 2.0

### 3.1 Sezon Sistemi (Battle Pass Tarzı)
**Ne:** Her 3 ay = 1 "sezon", XP topla, ödüller aç (özel kart çerçeveleri, başlıklar).
**Nasıl:**
- XP kaynakları: oy ver (+10), maç oyna (+50), gol at (+30), rozet kazan (+100)
- Tier'lar: Çıraklık → Profesyonel → Efsane → Olimpos
- Görsel: yatay progress bar + tier icon
**UI:** Yeni `screen-sezon-pass` veya profile entegre et.

### 3.2 Achievement Tree (Skill Tree)
**Ne:** Linear rozetler yerine grafik bir başarı ağacı — "Maestro → Pas Üstadı → Pas Sanatçısı".
**Nasıl:** SVG tree, açılan node'lar parlak, kilitli node'lar gri.
**Mevcut rozet sistemine ekleyerek başla** ([js/profile.js](js/profile.js#L68) `BADGE_DEFS`).

### 3.3 Haftalık Görevler (Daily/Weekly Challenges)
**Ne:** "Bu hafta 3 kişiye 9+ puan ver", "Yeni bir oyuncu ekle", "Bir paylaşım kartı yap".
**Nasıl:**
- `js/quests.js` modülü: `{ id, desc, check(state), reward, expires }`
- localStorage'da progress
- Tamamlanınca toast + XP

### 3.4 Streak / Combo Sistemi
**Ne:** "5 hafta üst üste oy verdin → 🔥 Sadakat Rozet"
**Mevcut:** `📅 Devamlı` rozeti var (5+ maç katılım) — bunu genişlet.

### 3.5 Mini Oyunlar
**Ne:** "Tahmin Modu" — kim 1. olacak? Doğru tahmin → XP.
**Nasıl:** Her hafta gizli bir tahmin bölümü, sonuçlar açıklanınca puan dağıt.

### 3.6 Liderlik Tablosu Sezon Şampiyonu
**Ne:** Sezon sonu 1.'lik için altın kart, profile özel "🏆 2026-Bahar Şampiyonu" rozeti.
**Mevcut:** `lider` rozeti var ama kalıcı değil (her hafta resetleniyor).

---

## 4. 📱 Modern UI/UX Modernizasyonu

### 4.1 View Transitions API
**Ne:** Ekranlar arası geçişlerde native cross-fade/slide animasyonları.
**Nasıl:**
```js
function switchMainScreen(id, btn) {
  if (!document.startViewTransition) return _legacySwitch(id, btn);
  document.startViewTransition(() => _legacySwitch(id, btn));
}
```
**Etki:** [js/main.js:100](js/main.js#L100) `switchMainScreen` — minimum 5 satır eklenir, devasa UX kazancı.

### 4.2 CSS Container Queries
**Ne:** FIFA kart grid'i, profil card'ı parent container'ın genişliğine göre uyum sağlar (viewport değil).
**Nasıl:** `@container (min-width: 600px) { ... }` — `css/main.css`'te `.fg` ve `.pcard`'lara uygula.

### 4.3 Glassmorphism / Neumorphism Toggle
**Ne:** Tema seçenekleri: Klasik / Cam / Yumuşak / Cyber / Stadium-Night.
**Nasıl:** `data-theme="cyber"` body attribute, CSS değişkenleri override.
```css
[data-theme="cyber"] {
  --bg: #0a0014;
  --accent: #ff00ea;
  --glow: 0 0 20px rgba(255,0,234,0.6);
}
```

### 4.4 Haptic Feedback (Mobil)
**Ne:** Buton basışları, slider, "puan gönderildi" → titreşim.
**Nasıl:** `navigator.vibrate([10])` — küçük helper:
```js
export function haptic(pattern = [10]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
```
**Yer:** `submitRatings()`, `onSlider`, kart paylaşma sonrası.

### 4.5 3D FIFA Kart (Tilt + Holographic)
**Ne:** Kart üzerinde fare/parmak hareketine göre 3D tilt + holografik shimmer.
**Nasıl:**
- `transform: perspective(1000px) rotateX() rotateY()`
- `vanilla-tilt.js` (~3kb) veya 50 satır custom
- Conic-gradient + mix-blend-mode → holograf

### 4.6 Skeleton Screens
**Ne:** Loading state'inde sadece spinner yerine FIFA kart şekli, sıralama satırı vs. skeleton göster.
**Mevcut:** `<span class="spin"></span>` her yerde — yetersiz.

### 4.7 Onboarding Tour
**Ne:** İlk girişte 4-5 step'lik interaktif tur ("Burada oyuncuları puanlıyorsun, burada sıralamayı görüyorsun").
**Nasıl:** `intro.js` (3kb) veya custom `<dialog>` + spotlight overlay.

### 4.8 Komut Paleti (Cmd+K)
**Ne:** `Ctrl/Cmd + K` → arama: oyuncu adı, ekran adı, eylem ("Karanlık moda geç", "Oy ver Ali Demir'e").
**Nasıl:** Floating modal + fuzzy search (Fuse.js veya 30 satır custom).

### 4.9 Voice Commands
**Ne:** "PitchRank, Ali Demir'in profili" → ekrana git.
**Nasıl:** Web Speech API (`SpeechRecognition`) — Chrome'da native.

### 4.10 Light Mode Tuned
**Ne:** Şu an dark mode merkezde, light mode 2. sınıf vatandaş. Tasarımı yeniden gözden geçir, daha sıcak palet.

---

## 5. 🏗️ Mimari Modernizasyon

### 5.1 Service Worker + Offline-First
**Ne:** İlk yüklemeden sonra uygulama tamamen offline çalışsın.
**Nasıl:**
- `sw.js`: Cache-first for shell (HTML, CSS, JS, components), Network-first for GAS
- Workbox kullan veya 80 satır manuel
- Background Sync: offline iken oy ver → online olunca otomatik gönder
**Faydası:** Halı saha → wifi yok → yine de oy verebilirsin.

### 5.2 IndexedDB Migration
**Ne:** localStorage 5MB sınırı + senkron API → IndexedDB'ye geç.
**Nasıl:** `idb-keyval` (1kb) ile localStorage tutmaya devam edebilirsin, ama ileride sezon arşivi 5MB'ı geçecek.
**Migration:** lazy — okuma localStorage başarısız olursa IndexedDB'ye fallback.

### 5.3 Web Workers — Ağır Hesaplamalar
**Ne:** `posRating`, `calcMarketValue`, sıralama → UI thread'i bloklamasın.
**Nasıl:**
```js
// rating-worker.js
self.onmessage = (e) => {
  const { players, data } = e.data;
  const ratings = players.map(p => calcPosRating(p, data));
  self.postMessage(ratings);
};
```
**Etki:** 50+ oyuncu olduğunda sıralama ekranı gecikmesini ortadan kaldırır.

### 5.4 Build Step Eklemek (İsteğe Bağlı)
**Ne:** Vite veya esbuild — minify, tree-shake, bundle.
**Trade-off:** "Build yok" felsefesini kırar AMA:
- 50+ window export → otomatik export
- TypeScript opsiyonu açılır
- CSS minification → ~70% boyut düşer
**Öneri:** **Hibrit** — `npm run build` opsiyonel, dev modda hâlâ vanilla, prod'da bundled.

### 5.5 TypeScript Migration (Aşamalı)
**Ne:** Strict types — `state`, `Player`, `MatchData`, `ResultData`.
**Nasıl:**
- `// @ts-check` JSDoc ile başla (build step gerekmez!)
- Sonra `.ts` dönüşümü
**Faydası:** `weeklyGenels[i] ?? null` gibi olası null'ları derleyici yakalar.

### 5.6 GAS → Cloudflare Workers + D1
**Ne:** Backend'i GAS'tan modern bir edge platformuna taşı.
**Nasıl:**
- D1 (SQLite) — players, votes, matches tabloları
- Workers — REST API
- KV — cache layer
- R2 — fotoğraf storage (CDN ile)
**Faydası:**
- 10ms response (GAS'taki 1500ms yerine)
- Quota dert değil
- Real-time için Durable Objects hazır
**Trade-off:** GAS'ın "Google Sheets'te düzenle" rahatlığı gider — admin UI ile telafi et.

### 5.7 Inline `onclick` → Event Delegation
**Ne:** 50+ inline `onclick="fnName(...)"` → tek bir delegated listener.
**Nasıl:**
```js
document.body.addEventListener('click', e => {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const fn = ACTIONS[action.dataset.action];
  if (fn) fn(action.dataset, e);
});
```
**Faydası:**
- CSP'den `unsafe-inline` kaldırılabilir → güvenlik 10x
- Window pollution biter
- Test edilebilir

### 5.8 Component-Scoped CSS
**Ne:** 1943 satırlık `main.css` → 8-10 küçük dosya (`fifa-card.css`, `nav.css`, `profile.css`).
**Nasıl:** Manuel split veya CSS Modules (build step gerek).

### 5.9 Reactive State (Lite)
**Ne:** `state` mutasyonu → otomatik re-render.
**Nasıl:** Proxy ile 30 satır custom store, veya Preact Signals (3kb).
```js
import { signal } from '@preact/signals-core';
const players = signal([]);
players.subscribe(() => renderPlayerList());
```
**Etki:** "Oy verdim ama UI güncellenmedi" sınıfı bug'lar bitiyor.

### 5.10 Module Federation / Plugin Sistem
**Ne:** Yeni takım eklemeyi 3 dosya değişikliğinden tek JSON'a indir.
**Nasıl:** `teams.json` → boot'ta fetch → `TEAM_CONFIG` dinamik build.

---

## 6. 🔐 Güvenlik

### 6.1 CSP'yi Sertleştir
**Mevcut:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — tehlikeli.
**Hedef:** `script-src 'self' 'nonce-XXX'` (5.7 inline kaldırılınca mümkün).

### 6.2 Subresource Integrity (SRI)
**Ne:** Google Fonts, harici resource'lar için hash.
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/..." integrity="sha384-..." crossorigin>
```

### 6.3 Rate Limiting (GAS Tarafı)
**Ne:** Aynı kullanıcıdan 1 dakikada 100 oy → bot şüphesi.
**Nasıl:** GAS `doGet` başında IP/sessionId hash kontrolü.

### 6.4 Anti-XSS Sanitizer
**Mevcut:** `escHtml` var ama sadece string içeriklerde.
**Ek:** Trusted Types API → DOM XSS'i derleme zamanı yakalar.

### 6.5 Admin PIN → MFA
**Ne:** PIN + e-posta OTP veya WebAuthn (parmak izi/Face ID).
**Mevcut:** PIN + 5 deneme lockout var, iyi başlangıç.

### 6.6 E2E Encryption (İsteğe Bağlı)
**Ne:** Hassas notlar (admin yorumları) AES-GCM ile şifrelenmiş.

---

## 7. 📊 Telemetri & Analytics

### 7.1 Privacy-First Analytics
**Ne:** Google Analytics değil — **Plausible / Umami / Pirsch** (cookieless).
**Topla:**
- Hangi ekran en çok kullanılıyor
- Oy verme tamamlama oranı (drop-off)
- En çok bakılan oyuncu profili
- PWA install oranı

### 7.2 Web Vitals Tracker
**Ne:** LCP, FID, CLS, INP — gerçek kullanıcı metriği.
**Nasıl:** `web-vitals` (1kb) → kendi GAS endpoint'ine gönder.

### 7.3 Error Reporting
**Ne:** Window error / unhandledrejection → uzak loglama.
**Nasıl:** Sentry self-hosted veya basit GAS endpoint.

### 7.4 Heatmap (Lite)
**Ne:** Hangi butona en çok basılıyor — ısı haritası.
**Nasıl:** Click event'leri loglayan basit Worker.

---

## 8. 📈 Yeni İstatistik Modülleri

### 8.1 Player Radar Karşılaştırma (Multi-Overlay)
**Ne:** 3 oyuncuyu radar grafiği üzerinde aynı anda karşılaştır.
**Mevcut:** `renderComparison` 2 kişilik — 3-4'e çıkar, transparan üst üste.

### 8.2 Form Curve / Heat Strip
**Ne:** Profile altta yatay 20 hücreli ısı stripi: yeşil-sarı-kırmızı, son 20 maç.
**Github contribution graph estetiği.**

### 8.3 Mevki Bazlı "Pozisyon Haritası"
**Ne:** Saha üstünde her oyuncu için tercih ettiği bölge → mini-heatmap.
**Nasıl:** Maç notlarından çıkar, manual da girilebilir.

### 8.4 Chemistry / Takım Uyumu Skoru
**Ne:** "Ali + Veli birlikte oynayınca takım %20 daha çok kazanıyor."
**Nasıl:** Maç verisi + lineup → korelasyon analizi.

### 8.5 Time-of-Day / Day-of-Week Performans
**Ne:** "Cumartesi sabahları daha kötü oynuyorsun" gibi insight'lar.

### 8.6 Sezon Karşılaştırması
**Ne:** "2025 vs 2026 sezon — gelişim grafiği" sayfası.

### 8.7 Goal Map (Futsal-Style Shot Chart)
**Ne:** Saha çiziminde gol vurduğu noktalar.
**Nasıl:** `saveMatch` ekranına SVG saha → tıkla, gol koordinatı kaydet.

### 8.8 xG (Expected Goals) — Lite
**Ne:** "Bu pozisyondan ortalama %X gol olur" + her oyuncunun "xG vs Gerçek" farkı.
**Aşırı?** Halı saha için fazla — opsiyonel.

### 8.9 MVP Algoritması Otomatik
**Ne:** Maç sonu otomatik MVP seçimi: gol(2) + asist(1) + en yüksek hafta puanı bonus.
**UI:** Maç kartı üstünde 🏆 ikonu.

### 8.10 Power Rankings Geçmişi
**Ne:** Her haftanın 1. 2. 3.'sünü gösteren timeline.

---

## 9. 🌐 Sosyal & Topluluk

### 9.1 Public Player Profili (Paylaş URL)
**Ne:** `/player/ali-demir` → herkes açabilir, paylaşılabilir kart.
**Nasıl:**
- Server-side render (Cloudflare Worker) — OG image dinamik
- Twitter/WhatsApp paylaşımında kart preview
**Mevcut:** `sharecard.js` PNG export var, URL paylaşım yok.

### 9.2 Maç Yorumları (Comments)
**Ne:** Her maç altında oyuncuların yorumu.
**Nasıl:** GAS endpoint + sayfa altında thread.

### 9.3 Reaction (👍 🔥 ⚽)
**Ne:** Sıralama kartlarında reaksiyonlar.

### 9.4 Hikaye Modu (Stories)
**Ne:** 24 saat sonra silinen kısa story'ler — "bu hafta 9.2 aldım, kim daha yüksek?"
**Snapchat/Instagram tarzı** ama küçük topluluk için ideal.

### 9.5 Lig Davet Sistemi
**Ne:** Yeni takım açınca paylaşılır link → arkadaşlar katılır.
**Mevcut:** Takım eklemek için kod düzenlemek gerek.

### 9.6 Maç Daveti
**Ne:** "Cumartesi 18:00 sahaya geliyor musun?" RSVP butonları.
**Mevcut:** "Bugün gelenler" admin tarafında — bunu kullanıcı tarafına taşı.

### 9.7 Mikro-Antrenör Yorumu
**Ne:** Her oyuncu için "Gelişim Önerisi" — AI-generated.
**Örnek:** "Hızın güçlü, savunman zayıf. Bu hafta savunma odaklı oyna."

---

## 10. 🥽 AR / VR / Yeni Donanım

### 10.1 AR FIFA Kartı (WebXR)
**Ne:** Telefonu kamerasıyla tarayınca havada 3D FIFA kart.
**Nasıl:** Three.js + WebXR Hit Test API — model-viewer şart koşmaz.
**Faydası:** "Gerçek hayata bağlı" futuristik dokunuş.

### 10.2 Apple Vision Pro / Meta Quest Görüntüleme
**Ne:** Sıralama tablosu, kartlar — VR'da panel olarak.
**Şu an:** Aşırı erken — ama 2027'de standart olacak.

### 10.3 Wear OS / watchOS Companion
**Ne:** Saatten oy ver, anlık skor bildirimi.
**Nasıl:** PWA Wear OS desteği (basic) veya native companion.

### 10.4 NFC Card (Fiziksel + Dijital)
**Ne:** Plastik FIFA kart üzerine NFC çip → telefonu yaklaştırınca profil açılır.
**Bonus özellik** olarak basabilirsin (deluxe abonelik).

### 10.5 Smart Ball / Sensor Entegrasyonu
**Ne:** Adidas miCoach gibi smart top → otomatik gol/şut tespiti.
**Şu an:** Erken — ama API'leri açık.

### 10.6 Stadium Mode (Live View)
**Ne:** Sahaya geldiğinde otomatik "live mode" — tam ekran, scoreboard, hızlı gol kayıt.
**Tetikleme:** Geofence (NX Permission gerekiyor — opsiyonel) veya manual.

---

## 11. 🎨 Yaratıcı / Eğlenceli

### 11.1 AI Player Avatar
**Ne:** Kullanıcı kendi fotosunu yüklemek istemiyor — AI ile pixel-art / cartoon avatar.
**Nasıl:** Stable Diffusion API → "futsal player, [name], anime style".

### 11.2 Custom Card Frames
**Ne:** XP ile açılan özel kart çerçeveleri (neon, holografik, retro CRT, vs).

### 11.3 Sezon Kapanış Wrap-Up (Spotify Wrapped Tarzı)
**Ne:** Sezon sonu otomatik özet sayfa: "Bu sezon 24 maç, 15 gol, en iyi performansın 9.4..."
**Nasıl:** `js/wrap-up.js` — 5 slide'lık story formatında.

### 11.4 Easter Egg'ler
**Ne:** Konami code → retro 8-bit modu, ESC × 5 → developer mode, vs.

### 11.5 Player Voice Lines
**Ne:** Profil açınca oyuncunun kendi sesinden "Selam, ben Ali" — kullanıcı kaydedebilir.
**Web Audio API** ile.

### 11.6 Anlık Kart Drop'u
**Ne:** Hafta sonu Pazar 23:00'ta yeni "Haftanın Takımı" kartları otomatik gösterilir — countdown ile.

### 11.7 Maç Hype Video
**Ne:** Maçtan önce 10 saniyelik otomatik hype video: takım logoları + müzik.
**Nasıl:** Canvas + ffmpeg.wasm.

### 11.8 Holographic Loading Screen
**Ne:** Boot ekranı: futsal topu döner, etrafında veri parçacıkları.

---

## 12. 🚀 Performans

### 12.1 Image Optimization Pipeline
**Ne:** Player fotoğrafları AVIF + WebP fallback + responsive sizes.
**Nasıl:** Cloudflare Images veya `<picture>` + manuel.
**Mevcut:** PNG, optimizasyon yok.

### 12.2 Resource Hints
**Ekle:**
```html
<link rel="modulepreload" href="js/main.js">
<link rel="prefetch" href="components/app.html">
```

### 12.3 Code Splitting
**Ne:** Admin panel sadece admin login sonrası yüklensin (~563 satır).
**Nasıl:** Dynamic `import('./admin.js')`.

### 12.4 Critical CSS Inline
**Ne:** Above-the-fold CSS `<style>` içine, geri kalan async load.

### 12.5 Font Subset
**Ne:** "Plus Jakarta Sans" sadece Latin Extended (TR karakterler) → font dosyası %60 küçülür.

### 12.6 Lazy Component Load
**Ne:** `data-include` her şeyi paralel fetch — ama profil modal'ı görünene kadar gerek yok.
**Nasıl:** IntersectionObserver tabanlı lazy.

### 12.7 SW Stale-While-Revalidate
**Ne:** Players, results 30sn cache → anında göster, arka planda güncelle.

---

## 13. ♿ Erişilebilirlik (a11y)

### 13.1 Klavye Navigasyonu
**Ne:** Tab order, focus trap modal'larda.

### 13.2 ARIA Live Region
**Ne:** Toast'lar `aria-live="polite"` ile screen reader'a duyurulsun.
**Mevcut:** Yok.

### 13.3 prefers-reduced-motion
**Ne:** `@media (prefers-reduced-motion: reduce)` → animasyonları kapat.

### 13.4 Renk Kontrastı
**Ne:** Bronz rating `#cd7c2f` üstünde beyaz metin → kontrast WCAG-AA mı? Otomatik test.

### 13.5 Screen Reader Etiketleri
**Ne:** Tüm ikonlar `aria-label` veya `<span class="sr-only">`.

---

## 14. 🌍 Uluslararasılaştırma

### 14.1 i18n Sistem
**Ne:** TR / EN / DE / ES.
**Nasıl:**
```js
const T = await fetch(`/i18n/${lang}.json`).then(r => r.json());
// 'app.title' → T['app.title']
```
**Etki:** Component HTML'leri data-i18n attribute ile işaretle.

### 14.2 RTL Desteği
**Ne:** Arapça için `dir="rtl"`.

### 14.3 Currency Localization
**Ne:** Market value €/₺/$ — kullanıcı tercihi.
**Mevcut:** Hard-coded €.

### 14.4 Date/Time Format
**Ne:** Hafta etiketi `2026-H15` → "15. Hafta" / "Week 15" / "Semana 15".

---

## 15. 💼 Monetizasyon (Opsiyonel)

### 15.1 Premium Plan
**Ne:** Ücretsiz: 2 takım, son 4 hafta. Premium: sınırsız + AI önerileri + custom branding.
**Fiyat:** Aylık $3 / yıllık $25.

### 15.2 Takım Sponsorluğu
**Ne:** Yerel halı saha tesisi takımın logosunu satın alır → tüm kartlarda "Powered by X".

### 15.3 NFT FIFA Karları
**Yaklaşım:** Hayır — geçti, hype öldü. Atlayın.

### 15.4 Halısaha Tesisi B2B
**Ne:** Tesis sahibine SaaS olarak sat → günde 6 takım, her birinin kendi PitchRank'i.
**En büyük büyüme fırsatı.**

---

## 16. 🛠️ Geliştirici Deneyimi

### 16.1 Test Suite
**Ne:** Vitest + Playwright — şu an sıfır test var.
**Önemli alanlar:** `posRating`, `calcMarketValue`, `normPos`, vote-gate logic.

### 16.2 Storybook
**Ne:** Her component'i izole gör (FIFA kart, sıralama satırı, profil bölümü).

### 16.3 GitHub Actions CI
**Ne:** Push'ta lint + test + Vercel deploy preview.

### 16.4 Lighthouse CI
**Ne:** Her PR'da performans bütçesi → 90 altı düşerse fail.

### 16.5 Conventional Commits
**Mevcut:** "version v3.2", "update: local changes" — semver/changelog otomasyonu için kötü.
**Hedef:** `feat:`, `fix:`, `chore:` prefix'leri + Release Please.

### 16.6 Dev Container
**Ne:** `.devcontainer/` → tek tıkla VS Code Codespaces ile çalışmaya başla.

---

## 17. 🔮 Daha Uzun Vade

### 17.1 Çoklu Spor Desteği
**Ne:** Halı saha sınırlı kalmasın — basketbol, voleybol, tenis (multi-sport platform).
**Mimari:** Sport adapter pattern — kriterler/mevkiler sport'a göre değişir.

### 17.2 Liga / Turnuva Sistemi
**Ne:** Birden fazla takım arasında resmi liga, fixture, point table.

### 17.3 Hakemlik Modülü
**Ne:** Bağımsız hakem profili, hakemlere yorum, pas işleme analytics.
**Mevcut:** "Hakem" admin tab'i var ama temel.

### 17.4 Sakatlık & Form Takibi
**Ne:** "X hafta sakat" durumu, geri dönüş sonrası form karşılaştırma.

### 17.5 Antrenman Modu
**Ne:** Maç dışı antrenman seansları kaydet, performans korelasyonu.

### 17.6 Fantezi Lig
**Ne:** Kullanıcılar gerçek halı saha verilerine dayanan fantezi takımlar kurar.

---

## 📋 Öncelik Matrisi

| ID | Özellik | Etki | Çaba | Skor |
|---|---|---|---|---|
| 5.1 | Service Worker (offline) | 🔴 Yüksek | 🟢 Düşük | ⭐⭐⭐⭐⭐ |
| 4.1 | View Transitions API | 🟠 Orta | 🟢 Düşük | ⭐⭐⭐⭐⭐ |
| 1.1 | Performans tahmini (forecast) | 🔴 Yüksek | 🟡 Orta | ⭐⭐⭐⭐⭐ |
| 5.7 | Inline onclick → delegation | 🔴 Yüksek (güvenlik) | 🟡 Orta | ⭐⭐⭐⭐⭐ |
| 11.3 | Sezon Wrap-Up | 🟠 Orta | 🟢 Düşük | ⭐⭐⭐⭐ |
| 1.2 | Benzer oyuncu (DNA) | 🟠 Orta | 🟢 Düşük | ⭐⭐⭐⭐ |
| 2.3 | Push notifications | 🔴 Yüksek | 🟡 Orta | ⭐⭐⭐⭐ |
| 4.5 | 3D FIFA kart tilt | 🟠 Orta | 🟢 Düşük | ⭐⭐⭐⭐ |
| 3.1 | Sezon Pass / XP | 🔴 Yüksek | 🔴 Yüksek | ⭐⭐⭐⭐ |
| 5.6 | GAS → Workers + D1 | 🔴 Yüksek | 🔴 Yüksek | ⭐⭐⭐ |
| 1.4 | LLM Maç Özeti | 🟠 Orta | 🟡 Orta | ⭐⭐⭐ |
| 2.1 | Live voting pulse | 🟠 Orta | 🟡 Orta | ⭐⭐⭐ |
| 10.1 | AR kart (WebXR) | 🟢 Düşük | 🔴 Yüksek | ⭐⭐ |
| 15.4 | B2B halı saha SaaS | 🔴 Yüksek (gelir) | 🔴 Yüksek | ⭐⭐⭐⭐⭐ |
| 5.5 | TypeScript migration | 🟠 Orta | 🟡 Orta | ⭐⭐⭐ |

---

## 🎯 30/60/90 Gün Önerilen Plan

### 0–30 gün — "Hızlı Modernizasyon"
1. **Service Worker + PWA install prompt** (5.1) — offline destek
2. **View Transitions API** (4.1) — anında premium hissi
3. **Skeleton screens** (4.6) — algılanan hız +50%
4. **Inline `onclick` → delegation** (5.7) — CSP sertleştirilebilir
5. **Forecast engine (Holt-Winters)** (1.1) — ilk AI feature
6. **Sezon Wrap-Up sayfa şablonu** (11.3) — viral paylaşım potansiyeli

### 30–60 gün — "AI & Gamification"
7. **Player DNA (cosine similarity)** (1.2)
8. **Achievement Tree** (3.2) — mevcut rozetleri grafik dönüştür
9. **Haftalık görevler** (3.3)
10. **Push Notifications** (2.3)
11. **3D FIFA kart tilt** (4.5)
12. **LLM Maç Özeti** (1.4) — opsiyonel API ile

### 60–90 gün — "Backend Yenileme"
13. **Cloudflare Workers + D1 prototipi** (5.6) — Arion FC'yi pilot olarak migrate et
14. **Real-time live voting pulse** (2.1)
15. **Custom theme system** (4.3)
16. **Test suite (Vitest + Playwright)** (16.1)
17. **Lighthouse CI** (16.4)

---

## ⚠️ Anti-Patterns / Yapılmaması Gerekenler

- ❌ React/Vue'ya tüm projeyi migrate etmek — vanilla'nın hızı/sadeliği değerli, signal pattern yeter
- ❌ NFT / Web3 entegrasyonu — hype ölmüş, kitlene uygun değil
- ❌ Aşırı gamification — halı saha hobi, "grindy" hissetmesin
- ❌ Subscription paywall'u erken eklemek — ücretsiz büyüsün önce
- ❌ Build step zorunlu kılmak — "no-build" felsefe değer katıyor, opsiyonel olsun
- ❌ Çok fazla AI önerisi — kullanıcı "spam" hissedebilir, sadece talep üzerine
- ❌ "Modernize" diye fonksiyonel olanı kırmak — incremental migration

---

## 🏁 Sonuç

PitchRank şu anda solid bir v3.2 — vanilla JS / GAS hibrit bir hobi platformundan, **AI-destekli, real-time, gamified bir Sports Performance OS**'a evrim için zemin hazır.

**En yüksek ROI 5 fikir (öneri):**
1. 🥇 **Service Worker + Offline** — 1 günlük iş, devasa UX kazancı
2. 🥈 **Forecast Engine** — ilk AI özelliği, "wow" faktörü yüksek
3. 🥉 **View Transitions** — 5 satır kod, premium hissi
4. **Sezon Wrap-Up** — viral paylaşım, organik büyüme
5. **B2B SaaS — Halı Saha Tesisleri** — gelir kapısı

**Felsefe:** "Sade kalsın ama büyüsün" — her yeni özellik, mevcut DAG yapısını ve "no-build" basitliğini bozmadan eklenmeli.

---

> 📌 Not: Bu doküman canlı bir yol haritasıdır. Yeni fikirler eklendikçe bölümler güncellenmeli, tamamlananlar `DEBUG_REPORT.md` formatında ayrı `CHANGELOG.md`'ye taşınmalı.
