# Taslak Kaydet + Takım Dengesi Analizi — Tasarım Dokümanı

**Tarih:** 2026-04-28
**Kapsam:** İki bağımsız özellik; aynı plan dosyasında sıralı görevler olarak uygulanır.

---

## Özellik A — Oy Kullanma Taslak Kaydet / Devam Et

### Amaç

Kullanıcı slider'ları ayarlayıp gönderim yapmadan çıkarsa (telefon kapandı, tarayıcı kapandı, pil bitti) girilen puanlar kaybolur. Taslak kayıt bu kaybı önler.

### Veri Modeli

**localStorage anahtarı:** `hs_draft_${raterName}_${weekLabel}`

Değer formatı:
```json
{
  "Mert": { "Pas": 7, "Sut": 8, "Dribling": 6, "Savunma": 5, "Hiz / Kondisyon": 9, "Fizik": 7, "Takim Oyunu": 8 },
  "Ali":  { "Pas": 6, "Sut": 5 }
}
```

`weekLabel` = `getWeekLabel()` sonucu (örn. `"2026-H15"`). Hafta değişince anahtar değişir, eski taslak otomatik geçersiz kalır — silinmez, sadece yüklenmez. Anahtarda `raterName` bulunduğundan farklı kullanıcıların taslakları çakışmaz.

### Akış

```
onSlider(input)
  → state.currentScores güncelle (mevcut davranış)
  → saveDraft(state.currentRater, getWeekLabel(), state.currentScores)

buildCards()
  → kartları render et (mevcut davranış)
  → checkDraft(state.currentRater, getWeekLabel())
      → taslak bulunamazsa: return
      → taslak bulunursa: showDraftBanner()

showDraftBanner()
  → #draft-banner elemanını göster
  → [Devam Et] tıklanınca: restoreDraft()
  → [Sıfırla] tıklanınca: clearDraft(), banner'ı gizle

restoreDraft()
  → JSON.parse ile state.currentScores'a yükle
  → Her slider DOM elemanını data-cr ile eşleştir, value ve fill güncelle
  → completedCards: 7 kriteri dolu olan oyuncuları işaretle
  → updateProgress() çağır
  → banner'ı gizle

submitRatings() — başarı callback'inde
  → clearDraft(state.currentRater, getWeekLabel())

resetIdentity()
  → clearDraft(state.currentRater, getWeekLabel())
```

### Banner Tasarımı

`#draft-banner` — `#screen-puanla` içinde, kimlik kartının hemen altında, kartlar listesinin üstünde sabit bir div. Başlangıçta `display:none`.

```
┌─────────────────────────────────────────────┐
│ ⚡ Geçen sefer kaldığın yer kaydedildi       │
│                [Devam Et]  [Sıfırla]         │
└─────────────────────────────────────────────┘
```

CSS sınıfı: `.draft-banner` — sarı/amber tonu arka plan, `var(--border)` kenarlık.

### Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `js/players.js` | `saveDraft`, `checkDraft`, `clearDraft`, `restoreDraft`, `showDraftBanner` fonksiyonları; `onSlider` ve `buildCards` ve `submitRatings` güncellemesi |
| `components/app.html` | `#draft-banner` div'i `#screen-puanla` içine eklenir |
| `css/main.css` | `.draft-banner` stili |

### Sınır Durumları

| Durum | Davranış |
|-------|----------|
| Taslak anahtarı JSON bozulmuş | `try/catch` ile yakalanır, `clearDraft` çağrılır, banner gösterilmez |
| Oyuncu listesi haftalık değişmiş (yeni oyuncu eklendi) | Taslakta olmayan oyuncular için slider 5'te kalır; taslakta fazladan olan oyuncular yok sayılır |
| Rater kimlik seçilmeden buildCards çağrılırsa | `state.currentRater` boş → `checkDraft` return eder |
| Taslak aynı hafta ama submit edilmiş | `submitRatings` başarıda `clearDraft` çağrıldığı için taslak yoktur |

---

## Özellik B — Takım Dengesi Analizi Alt Sekmesi

### Amaç

Maç geçmişindeki skor verilerinden haftalık takım güç dengesi göstermek. Hangi maçlar çekişmeli geçti, hangileri tek taraflıydı — görsel ve sayısal olarak.

### Güç Metriği

**Skor Farkı** = `score1 − score2` (her maç için)

- Pozitif → Takım 1 kazandı
- Negatif → Takım 2 kazandı
- 0 → Beraberlik

**Denge Etiketi:**

| |score1 − score2|| Etiket | Renk |
|---|---------|------|
| 0 | Çekişmeli | 🟢 |
| 1–2 | Dengeli | 🟡 |
| ≥ 3 | Tek Taraflı | 🔴 |

**Özet İstatistikler:**
- Ortalama mutlak skor farkı (son tüm maçlar)
- Çekişmeli/Dengeli/Tek Taraflı maç sayıları

### Sekme Entegrasyonu

`#screen-istatistik` içinde mevcut sub-sekme butonları: hafta, trend, karsi, sezon, katilim, maclar. Yeni sekme `denge`, `maclar`'dan sonra eklenir.

`setStatScreen('denge', btn)` çağrısında `renderDenge()` tetiklenir. `loadMatchHistory()` ile veri yüklenir (zaten cache'li olabilir), callback'te `renderDenge()` çağrılır.

### Ekran Yapısı

```
┌─ Takım Dengesi ────────────────────────────────────────────┐
│  Özet: Ort. fark 1.4 gol · 8 maçın 3'ü çekişmeli          │
├────────────────────────────────────────────────────────────┤
│  SVG Grafik — Skor Farkı Trendi (son 10 maç)               │
│                                                            │
│   +4 ┤          ██                                         │
│   +2 ┤  ██  ██  ██   ██                                    │
│    0 ┼──────────────────────── (0 çizgisi)                 │
│   -2 ┤                    ██                               │
│   -4 ┤                                                     │
│       H11 H12 H13 H14 H15                                  │
├────────────────────────────────────────────────────────────┤
│  Maç Listesi                                               │
│  H15  3-2  +1  🟡 Dengeli                                  │
│  H14  5-1  +4  🔴 Tek Taraflı                              │
│  H13  2-2   0  🟢 Çekişmeli                                │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

### SVG Grafik Detayı

- `viewBox="0 0 300 120"`
- Tüm maçlar gösterilir (yapay limit yok); 10'dan fazlaysa yatay scroll
- Y ekseni: `−maxDiff` ile `+maxDiff` arasında, sıfır ortada
- X ekseni: eşit aralıklı hafta etiketleri
- Her maç için dikey çubuk: pozitif = `var(--green)`, negatif = `#ef4444`, 0 = `var(--border)`
- 0 referans çizgisi: `stroke: var(--text3)`, stroke-dasharray
- Trend çizgisi (polyline): tüm maçların skor farkı üzerinden geçen çizgi (`stroke: var(--text2)`, opacity 0.5)
- Hafta etiketleri alt kısımda, küçük font

### Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `js/stats.js` | `renderDenge()` fonksiyonu; `setStatScreen` switch'ine `denge` case'i |
| `components/app.html` | `denge` sekme butonu + `#stat-denge` sub-screen div'i |
| `css/main.css` | `.denge-*` CSS sınıfları |

### Sınır Durumları

| Durum | Davranış |
|-------|----------|
| Maç verisi yüklenmemiş | Spinner göster, `loadMatchHistory(renderDenge)` ile yükle |
| Hiç maç yok | "Henüz maç kaydı yok." mesajı |
| Tek maç | Grafik tek çubuk, trend çizgisi yok |
| score1 veya score2 null/undefined | O maç grafik ve listeden atlanır |
| 10'dan az maç | Tüm maçlar gösterilir |

---

## DAG Uyumu

Her iki özellik de mevcut modül bağımlılık grafiğine uygundur:
- `players.js` → `utils.js`, `storage.js`, `state.js` (mevcut bağımlılıklar, yeni import yok)
- `stats.js` → `state.js`, `storage.js`, `api.js` (mevcut bağımlılıklar, yeni import yok)
- `window.*` export gerektiren yeni fonksiyon yok — taslak banner butonları `data-*` + mevcut `window.*` çağrıları kullanır
