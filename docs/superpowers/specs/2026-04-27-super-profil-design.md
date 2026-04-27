# Süper Profil Ekranı — Tasarım Dokümanı

**Tarih:** 2026-04-27  
**Hedef:** Kullanıcıların siteye her gün geri döneceği, kendine ait bir profil ekranı eklemek.

---

## Amaç

PitchRank'te kullanıcılar şu an sadece oylama günü aktif. "Her gün bakma" davranışı yaratmak için rekabet, koleksiyon (rozet) ve kişisel ilerleme bilgilerini tek bir sahiplenilen sayfada toplamak.

---

## Mimari

### Yeni dosyalar

| Dosya | İçerik |
|-------|--------|
| `js/profile.js` | Rozet hesaplama, form şeridi render, rekabet verisi |

### Değiştirilen dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `components/app.html` | `#screen-profil` section eklenir |
| `components/nav.html` | 6. buton: 👤 Profil |
| `js/main.js` | `import { renderProfile } from './profile.js'` + `window.renderProfile = renderProfile` |

### Bağımlılık zinciri

```
config ← storage ← state ← utils ← api ← rating
                                              ↓
                              stats ←──── players
                              profile ←── rating
                                ↓
                              admin → main → boot
```

`profile.js` yalnızca `config`, `state`, `utils`, `rating` modüllerinden import alır. `main.js` veya `stats.js`'e bağımlılık yoktur — döngü oluşmaz.

### GAS değişikliği

**Yok.** Tüm hesaplamalar mevcut `state.resultData` ve `state.players` üzerinden client-side yapılır.

---

## Ekran Yapısı

Profil ekranı (`#screen-profil`) dört dikey bölümden oluşur.

### ① Oyuncu Başlığı

- Oyuncunun fotoğrafı, adı, pozisyonu, genel ortalaması (0–99 formatında)
- Takım rengi (`TEAM_CONFIG[id].color`) ile vurgulu arka plan şeridi
- Mevcut `makeFifaCard` çıktısıyla aynı veri kaynağından beslenir

### ② Form Şeridi — Son 5 Hafta

`state.resultData.players[i].weeklyGenels` dizisinden son 5 eleman alınır.

Her hafta için:
- Yuvarlak skor balonu: **yeşil** (75+) / **sarı** (50–74) / **kırmızı** (altı)
- Ok göstergesi: önceki haftaya göre delta ≥ 2 → ↑, ≤ −2 → ↓, aralık → →
- Hafta etiketi (`YYYY-HWW` formatında) küçük font

Sadece 1 haftası olan oyuncular için ok gösterilmez.

### ③ Rozet Rafı

Rozetler `profile.js` içinde `computeBadges(playerData, matchesData)` fonksiyonuyla hesaplanır. Kazanılmış rozetler renkli, kilitliler gri + 🔒 ikonu. Rozete tıklayınca kısaca açıklama gösterilir (toast).

| Rozet | Koşul | Veri kaynağı |
|-------|-------|-------------|
| 🎯 Maestro | Pas ort. ≥ 8.0 | `weeklyKriterler` |
| 🚀 Füze | Şut ort. ≥ 8.0 | `weeklyKriterler` |
| 🪄 Cambaz | Dribling ort. ≥ 8.0 | `weeklyKriterler` |
| 🧱 Duvar | Savunma ort. ≥ 8.0 | `weeklyKriterler` |
| ⚡ Motor | Hız/Kondisyon ort. ≥ 8.0 | `weeklyKriterler` |
| 🦍 Tank | Fizik ort. ≥ 8.0 | `weeklyKriterler` |
| 🤝 Joker | Takım Oyunu ort. ≥ 8.0 | `weeklyKriterler` |
| 🔥 Ateş | 3 hafta üst üste ilk 3 sıra | `weeklyGenels` sıralaması |
| 📅 Devamlı | 5+ maç katılım (null olmayan weeklyGenels) | `weeklyGenels` |
| 👑 Lider | Sezon genel sıralamasında 1. | `genelOrt` karşılaştırması |
| ⚽ Golcü | Toplam 5+ gol | `resultData.results[].goals` |
| 🅰️ Asist Kralı | Toplam 5+ asist | `resultData.results[].goals` |

Kriter rozet eşiği (8.0) ve katılım eşiği (5 maç) `profile.js` sabit olarak tutulur, `config.js`'e taşınmaz (profil-özgü sabitler).

### ④ Rekabet & Kriter Özeti

**Rekabet satırı:**
- Oyuncunun `genelOrt`'u tüm oyuncularla karşılaştırılarak sıra bulunur
- "Takımda **3. sıradasın** — 2. sıraya **1.8 puan** kaldı" formatında gösterilir
- 1. sıradaysa: "👑 Bu sezon takımın liderisin!"

**Kriter barları:**
- 7 kriter için tek satırda: ikon + isim + ince dolgu çubuğu + sayısal ortalama
- Renk eşiği: ≥ 8.0 yeşil, 6.0–7.9 sarı, altı kırmızı
- Verisi olmayan kriterler gösterilmez

---

## Navigasyon

- `components/nav.html`'e 6. buton eklenir: `onclick="switchMainScreen('profil', this)"`
- `switchMainScreen('profil', ...)` çağrısında `renderProfile()` tetiklenir (main.js'deki switch bloğuna eklenir)
- `state.currentRater` null ise: profil ekranı yerine `showToast('Önce kimliğini seç')` ve Puanla ekranına yönlendirilir
- Profil butonu her zaman görünür; sadece tıklanınca kimlik kontrolü yapılır

---

## Veri Akışı

```
switchMainScreen('profil')
  → state.currentRater null?  → toast + return
  → renderProfile(state.currentRater, state.resultData, state.players)
      → playerData = resultData.players.find(p => p.name === currentRater)
      → pObj       = state.players.find(p => p.name === currentRater)
      → renderHeader(playerData, pObj)
      → renderFormStrip(playerData)
      → renderBadges(computeBadges(playerData, resultData))
      → renderCompetition(playerData, resultData.players)
      → renderCriteriaBar(playerData)
```

`renderProfile` her ekrana gelindiğinde yeniden çağrılır (cache yok — veri zaten bellekte, maliyet ihmal edilebilir).

---

## Sınır Durumları

| Durum | Davranış |
|-------|----------|
| Hiç puanı olmayan oyuncu | Form şeridi ve kriter barları "Henüz veri yok" mesajı |
| 1 haftalık veri | Ok gösterilmez, form balonları tek eleman |
| Oyuncu resultData'da yok | Rozet ve rekabet bölümü gizlenir, başlık yine de gösterilir |
| resultData yüklenmemiş | `switchMainScreen('profil')` içinde (main.js) önce `loadResults()` çağrılır, ardından `renderProfile` callback olarak verilir. `profile.js` hiçbir zaman `loadResults` import etmez — DAG ihlali olur. |

---

## CSS

Yeni sınıflar `css/main.css`'e eklenir:
- `.profile-header` — başlık kapsayıcı
- `.form-strip` — yatay kaydırma kapsayıcı
- `.form-bubble` — haftalık skor balonu (`.up` / `.down` / `.flat` modifier'ları)
- `.badge-grid` — rozet ızgarası (4 sütun, wrap)
- `.badge-item` — tek rozet (`.locked` modifier'ı)
- `.criteria-bar` — kriter satırı
- `.criteria-fill` — dolgu çubuğu (`.good` / `.mid` / `.low` modifier'ları)

Mevcut CSS değişkenleri (`--green`, `--bg2`, `--border` vb.) kullanılır; yeni değişken eklenmez.
