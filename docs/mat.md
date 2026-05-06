# PitchRank — Hesaplama Analizi ve Eksiklik/Çelişki Raporu

> Tarih: 2026-05-05  
> Kapsam: Tüm sekmeler — Lig, Analiz (Hafta · Trend · Karşılaştır · Sezon), Profil, FIFA Kartları

---

## 1. Temel Hesaplama Mantığı

### 1.1 Pozisyon Ağırlıklı Puan — `posRating()` (rating.js:12)

Tek "gerçek" OVR kaynağı budur. Tüm sekmelerde bu değer kullanılır.

```
Adımlar:
1. Oyuncunun her pozisyonu için (çok-pozisyonlu olabilir):
   a. Her kriterin tüm haftalardaki değerlerini al (weeklyKriterler)
   b. Her kriter için ortalama hesapla
   c. POS_WEIGHTS[pos][kriter] ile çarp
   d. Ağırlıklı toplam / ağırlık toplamı = pozisyon skoru (0-10)
2. Tüm pozisyon skorlarının ortalaması = baseScore
3. Standart sapma cezası uygula:
   final = baseScore × max(0.85, 1 - (stdDev / 5) × 0.15)
4. × 10 → 0-99 OVR

Max ceza: %15 (stdDev çok yüksek oyunculara)
```

**Pozisyon Ağırlık Matrisi (POS_WEIGHTS):**

| Kriter            | KL   | DEF  | OMO  | FRV  |
|-------------------|------|------|------|------|
| Pas               | 0.30 | 0.60 | 1.00 | 0.65 |
| Şut               | 0.05 | 0.20 | 0.55 | 1.00 |
| Dribling          | 0.10 | 0.40 | 0.85 | 0.90 |
| Savunma           | 1.00 | 1.00 | 0.50 | 0.10 |
| Hız / Kondisyon   | 0.45 | 0.80 | 0.90 | 1.00 |
| Fizik             | 0.90 | 0.90 | 0.80 | 0.75 |
| Takım Oyunu       | 0.65 | 0.80 | 1.00 | 0.75 |

### 1.2 Market Değeri — `calcMarketValue()` (rating.js:35)

```
base = 1.12^r × 3000       (r = posRating × 10, max 99)
val  = base
     × max(0.4,  1.2 − stdDev / 2.5)   ← tutarsızlık cezası
     × (0.5 + 0.5 × katılımOranı)       ← devam bonusu

Yuvarlama: > 1M → 100k'ya, > 10k → 10k'ya, diğer → 1k'ya
```

### 1.3 Standart Sapma — `calcStdDev()` (rating.js:5)

```
vals = weeklyGenels'in null olmayanları
< 2 değer → 0 döndürür
≥ 2 değer → sqrt( Σ(val − avg)² / n )
```

### 1.4 Hafta Sayısı Eşiği — Vote-Gate (stats.js:52)

```
MIN_WEEK_VOTERS = 5 (backend'den gelen minVoters değeri yoksa)
O haftaya < 5 oy gelirse, o hafta tüm ekranlardan gizlenir
```

---

## 2. Sekme Bazlı Hesaplamalar

### 2.1 Lig Sekmesi (`renderRankTab`)

- Sıralama: `posRating(p, pObj)` × 10 → 0-99 OVR
- Pozisyon filtresi: KL / DEF / OMO / FRV sekmelerinde sadece o pozisyon ağırlıkları kullanılır
- Renk eşikleri: ≥7.0 yeşil, 5.0-7.0 sarı, <5.0 kırmızı (0-10 kriter skoru için)

### 2.2 Analiz → Hafta Detayı (`renderWeek` / `renderHafta`)

- Her oyuncu için o haftanın kriteri alınır, tek hafta için posRating hesaplanır
- Fallback: posRating null → `genelOrt × 10`
- Çubuk genişliği: `((r - minScore) / (maxScore - minScore)) × 100`

### 2.3 Analiz → Trend (`renderTrend`)

- Pencere: son 5 hafta
- `trendChange = son skor - ilk skor` (0-99 ölçeğinde)
- Yön eşiği: `> 0.3 → ↑`, `< -0.3 → ↓`, diğer → `→`
- stdDev: son 5 haftalık skorların standart sapması (0-99 ölçeğinde hesaplanır)
- Performans Puanı: `round((avg - min) / (max - min) × 60 + 40)` → aralık **40-100**
- Kriter trendleri: son 5 hafta verisi, yön eşiği `> ±1` (0-10 ölçeğinde)

### 2.4 Analiz → Karşılaştır (`renderComparison`)

- Radar grafiği: 7 kriter, her biri 7 boyutlu vektörde kriter ortalamaları
- Form trendi: `son > önceki` → "yükselen", değil → "düşen" (sadece son 2 hafta)
- Düello satırları: kriter bazında av vs bv doğrudan karşılaştırma

### 2.5 Analiz → Sezon (`renderSezon`)

- Sıralama: `posRating()` ile, tüm haftalar dahil
- İlerleme: `last3Avg(p) - first3Avg(p)` (son 3 hafta - ilk 3 hafta, posRating × 10 ölçeğinde)
- stdDev (sezon içi): `< 2 hafta → 999` döndürür (özel lokal fonksiyon)
- Sezon ödülleri (10 kategori):

| Ödül              | Kriter                                      |
|-------------------|---------------------------------------------|
| MVP               | En yüksek posRating                         |
| Market Lideri     | En yüksek calcMarketValue                   |
| Tutarlılık        | En düşük stdDev (lokal, 999 ile yeni oyuncu engelli) |
| Demir Adam        | En yüksek katılım sayısı                    |
| Savunma Şampiyonu | En yüksek Savunma kriteri ortalaması        |
| Gol Makinesi      | En yüksek Şut kriteri ortalaması            |
| Maestro           | En yüksek Pas kriteri ortalaması            |
| Hız Şampiyonu     | En yüksek Hız/Kondisyon kriteri ortalaması  |
| Yükselen Yıldız   | En yüksek `last3Avg - first3Avg`            |
| Zirve Oyuncusu    | En yüksek tek hafta skoru                   |

### 2.6 Profil Ekranı (`renderProfile`)

- OVR: `posRating() × 10` → fallback: `genelOrt × 10`
- Form Şeridi: son 5 hafta `weeklyGenels` değerlerini SVG'ye çizer
- Forecast: `forecastHoltWinters(vals, 3, 0.4, 0.2)` — Holt-Winters çift üstel düzleştirme
- Rozetler (12 adet): aşağıdaki tabloda
- Kriter Yayları: `criteriaAvg ≥ 80 → yeşil, ≥ 60 → sarı, < 60 → kırmızı` (0-99 ölçeğinde)
- DNA: cosine similarity ile top-3 benzer oyuncu, aynı pozisyon öncelikli

**Rozet Hesaplama Eşikleri:**

| Rozet         | Koşul                                              |
|---------------|----------------------------------------------------|
| 🎯 Maestro    | Pas ortalaması ≥ 8.0                               |
| 🚀 Füze       | Şut ortalaması ≥ 8.0                               |
| 🪄 Cambaz     | Dribling ortalaması ≥ 8.0                          |
| 🧱 Duvar      | Savunma ortalaması ≥ 8.0                           |
| ⚡ Motor      | Hız/Kondisyon ortalaması ≥ 8.0                     |
| 🦍 Tank       | Fizik ortalaması ≥ 8.0                             |
| 🤝 Joker      | Takım Oyunu ortalaması ≥ 8.0                       |
| 🔥 Ateş       | Son 3 hafta üst üste ilk 3 sıra (`weeklyGenels`)  |
| 📅 Devamlı    | ≥ 5 maça katılım                                   |
| 👑 Lider      | Sezon sıralaması 1. (`posRating`)                  |
| ⚽ Golcü      | ≥ 5 gol bu sezon                                   |
| 🅰️ Asist Kralı | ≥ 5 asist bu sezon                                |

### 2.7 FIFA Kartları

- OVR: `posRating × 10` → fallback: `genelOrt × 10`
- Kart tierleri:

| Tier   | OVR Eşiği | Renk Paleti                          |
|--------|-----------|--------------------------------------|
| EFSANE | ≥ 90      | Turuncu + Mor + Kırmızı              |
| ALTIN  | ≥ 85      | Altın gradyanı                       |
| GÜMÜŞ  | ≥ 75      | Gümüş / Gri gradyanı                 |
| BRONZ  | < 75      | Bronz/Kahverengi gradyanı            |

- Ego başlığı: Sıraya (rank 0-4), sonra en güçlü kriter (≥ 8.5), sonra katılım/rating'e göre 8 kademe
- Kişisel rozetler (max 3): kriter liderliği, katılım bağlılığı, form trendi, kişisel rekor

---

## 3. Çelişkiler

### C-01: Trend Eşiği Tutarsızlığı (kritik)

**Dosya/Satır:** stats.js:381 vs stats.js:437

```javascript
// Haftalık GENEL trend (0-99 ölçeğinde):
trendDir = trendChange > 0.3 ? '↑' : trendChange < -0.3 ? '↓' : '→'

// Haftalık KRİTER trendi (0-10 ölçeğinde):
ctrend = clast > cfirst + 1 ? '↑' : clast < cfirst - 1 ? '↓' : '→'
```

Oransal fark: Genel trend 0.3/99 = **%0.3** değişimde tepki verirken, kriter trendi 1/10 = **%10** değişimde tepki verir. Aynı ekranda gösterilen iki ok tamamen farklı hassasiyetlere sahip. Bir oyuncu genel trendde "yükselen" görünürken kriter trendleri hepsi "stabil" gösterebilir.

### C-02: Üç Farklı "Form Trendi" Tanımı (kritik)

**Dosya/Satır:** stats.js:381, stats.js:684, sharecard.js:167

| Yer                   | Hesaplama                                | Ölçek     |
|-----------------------|------------------------------------------|-----------|
| renderTrend()         | `son - ilk` (5 haftalık pencere)         | 0-99      |
| renderComparison()    | `son > önceki` (son 2 haftayı karşılaştır) | binary  |
| sharecard personalBadges | `son3Ort ≥ toplamOrt × 1.06`          | 0-10 ham  |

Aynı oyuncu üç ekranda üç farklı trend durumu gösterebilir.

### C-03: `stddev < 2` için Farklı Dönen Değer (kritik)

**Dosya/Satır:** rating.js:7 vs stats.js:767

```javascript
// rating.js (calcStdDev):
if (vals.length < 2) return 0;      // Yeni oyuncu = 0 stdDev

// stats.js (sezon içi stddev):
if (vals.length < 2) return 999;    // Yeni oyuncu = 999 stdDev
```

- Market değerinde: `max(0.4, 1.2 - 0/2.5)` = **1.2x çarpan** → yeni oyuncu en yüksek tutarlılık çarpanını alır, oysa mantıksal olarak belirsiz
- Sezon "En Tutarlı" ödülünde: yeni oyuncu 999 ile **asla** seçilemez

İki tamamen zıt davranış, aynı kavramı ifade etmeli.

### C-04: "Ateş" Rozeti `weeklyGenels` Kullanırken "Lider" Rozeti `posRating` Kullanır

**Dosya/Satır:** profile.js:44 vs profile.js:32

```javascript
// hasConsecutiveTop3: ham backend skoru ile sıralar
score: p.weeklyGenels[i]

// isLeader: pozisyon ağırlıklı hesaplama ile sıralar
(posRating(b, bObj) || 0) - (posRating(a, aObj) || 0)
```

Bir oyuncu Lig sekmesinde lider görünürken "Ateş" rozeti almayabilir — ya da tersi. İki rozet birbirinden farklı sıralama mantığı kullanıyor.

### C-05: Sezon Ödülü "En Tutarlı" ≠ Market Değeri "Tutarlılık Cezası"

**Dosya/Satır:** stats.js:791 vs rating.js:46

- Sezon: `stddev(p)` → `genelOrt` ham değerlerine dayalı, yeni oyuncu = 999
- Market: `calcStdDev(p)` → `weeklyGenels` + `<2` için `0`, yeni oyuncu = 0 = maksimum çarpan

Aynı oyuncunun "tutarlılık" yorumu iki hesaplamada tamamen zıt.

### C-06: Ego Başlığı `genelOrt` Kullanırken Kart Tipi `posRating` Kullanır

**Dosya/Satır:** sharecard.js:113 vs sharecard.js:205-207

```javascript
// Ego başlığı (tier kararı):
const r = pd.genelOrt ? Math.round(pd.genelOrt * 10) : 0;
if (r >= 85) return { e: '🔥', t: 'ELİT PERFORMANS' }

// Kart tipi:
const wAvg = posRating(pd, pObj);   // posRating önce denenir
const rating = wAvg !== null ? Math.min(99, Math.round(wAvg * 10)) : ...
```

Kaleci bir oyuncu posRating ile 90 (EFSANE kart) alabilir ama ego başlığı genelOrt ile belirlendiği için "SAVAŞÇI RUHLU" gösterebilir. Kart görseli ve başlık uyumsuz.

### C-07: `criteriaAvg` Fonksiyonu 4 Kez Tekrar Yazılmış

**Dosya/Satır:** rating.js:57-61, profile.js:11-18, sharecard.js:17-23, stats.js:765

Dört farklı implementasyon; biri (`stats.js:766` `attendCount`) `weeklyGenels` undefined olduğunda crash verir:
```javascript
// stats.js:766 — null check YOK:
const attendCount = (p) => p.weeklyGenels.filter(v => v != null).length;

// profile.js:20 — null check VAR:
if (!playerData || !Array.isArray(playerData.weeklyGenels)) return 0;
```

### C-08: Performans Puanı Aralığı Yanlış Etiketlenmiş

**Dosya/Satır:** stats.js:390

```javascript
const perfRating = Math.round(((avg - min) / (max - min || 1) * 60 + 40));
```

- Aralık: **40-100** (0 değil)
- Tamamen tutarlı oyuncu (max == min): `(0/1 × 60 + 40)` = **40** — en düşük skor
- Kullanıcıya 40-100 olduğu gösterilmez, skor belirsiz anlam taşır

### C-09: Form Şeridi `weeklyGenels` Kullanırken OVR `posRating` Kullanır

**Dosya/Satır:** profile.js

- Form şeridindeki noktalar: `weeklyGenels` ham backend değerleri (0-10 ölçeği × 10 = 0-99 gösterim)
- Forecast noktaları: ham değerler üzerine Holt-Winters
- Profil başlığındaki büyük OVR sayısı: `posRating × 10` (pozisyon ağırlıklı, stdDev cezalı)

Grafik "ham" gelişimi gösterirken başlıktaki OVR "ağırlıklı" skoru gösterir. İkisi ayrı skalalar gibi davranıyor.

### C-10: Sezon İlerleme Metriği Sadece 3'er Hafta Alır

**Dosya/Satır:** stats.js:779-780

```javascript
const last3Avg  = (p) => weekRatings(p).slice(-3) ...
const first3Avg = (p) => weekRatings(p).slice(0, 3) ...
```

5 haftalı sezonda ilk 3 ve son 3 hafta **üst üste biner** (3+3 > 5). 4 haftalı sezonda ortadaki hafta hiç kullanılmaz. "Yükselen Yıldız" ödülü kısa sezonlarda anlamsız ya da yanıltıcı olur.

---

## 4. Eksiklikler

### E-01: `genelOrt` Backend Formülü Bilinmiyor

`weeklyGenels[i]` ve `genelOrt` değerleri Google Apps Script tarafından hesaplanıp gönderiliyor. Frontend sadece bu değerleri fallback olarak kullanıyor. Formül dökümanda yok, GAS kodu başka bir sekmede. Frontend'in kendi `posRating()` hesabından farklı bir sonuç üretebilir — ikisi arasındaki fark hiçbir yerde raporlanmıyor.

### E-02: Vote-Gate Profil Ekranında Uygulanıyor mu Belirsiz

`renderTrend`, `renderSezon`, `renderComparison` → `gateCurrentWeek()` çağırıyor.  
`renderProfile()` → `loadResults` çağırıyor ama gate'i nerede uyguladığı kodda takip edilmesi zor.  
Profil, hala oylanmakta olan haftanın verisini gösteriyor olabilir.

### E-03: Holt-Winters Parametreleri Sabit Kodlanmış

**Dosya/Satır:** profile.js (forecast.js çağrısı)

```javascript
forecastHoltWinters(vals, 3, 0.4, 0.2)
// α=0.4 (level), β=0.2 (trend)
```

Bu parametreler hiçbir yerde açıklanmamış, ayarlanamaz. Farklı oyuncu tipleri (çok istikrarsız vs sabit) için aynı parametreler yanlış tahmin üretir.

### E-04: Pozisyon Ağırlıkları Savunma Kriteri KL ve DEF'e Eşit Ağırlık Veriyor

**config.js:34-35:** KL `Savunma = 1.00`, DEF `Savunma = 1.00` — ikisi de maksimum.  
Kalecinin "kaleci spesifik" kriterleri (refleks, pozisyon alma) hiç ölçülmüyor; Savunma kriteri hem KL hem DEF için aynı şeyi ifade edemez. Kaleci puanlaması sistematik olarak bozuk olabilir.

### E-05: DNA Benzerliği Oyuncu Sayısı < 4 Olduğunda Anlamsız

**Dosya/Satır:** dna.js

`MIN_ATTEND = 3` filtresi geçildikten sonra kalan oyuncu sayısı 3'ten azsa top-3 tam dolmaz.  
Daha ciddi: 7 boyutlu vektörün tamamı 0 olan bir oyuncu (hiç kriter girilmemiş) cosine similarity hesabında sıfıra bölme riski taşır.

### E-06: Kart Tipi Eşikleri Motivasyon için Yüksek

Tipik bir halı saha oyuncusu 0-10 skalasında ortalama 5-7 alır → posRating ≈ 55-70 → BRONZ kart.  
GÜMÜŞ için 75 gerekir (7.5/10 ortalama), ALTIN için 85 (8.5/10). Çoğu oyuncu sezon boyunca BRONZ görür; bu motivasyonu düşürür. Dinamik tier (takım içi persentil bazlı) düşünülebilir.

### E-07: Sezon Ortalaması `avgRating` Yanlış Hesaplanabilir

**Dosya/Satır:** stats.js:801

```javascript
const avgRating = (players.reduce((s,p) => {
  return s+(posRating(p,pObj)||0);
},0)/players.length*10).toFixed(1);
```

`posRating` için null yerine `0` kullanılıyor — `genelOrt` olan ama `weeklyKriterler` olmayan oyuncular sıfır katkıda bulunur ve sezon ortalamasını aşağı çeker.

### E-08: Lineup Optimizer'ın Kriter Tablosu `state.players` ile Senkron Değil

**Dosya/Satır:** lineup-optimizer.js

Optimizer `posRating` eşdeğeri bir puan hesaplar ama `state` değiştiğinde (takım değişimi) cache'lenmemiş hesaplama tekrar çalışıp çalışmadığı belirsiz.

### E-09: Anomali Tespiti Sadece `weeklyGenels` Bakıyor

**Dosya/Satır:** anomaly.js

Kriter bazlı anomali yok — "bir oyuncu bu hafta normalden çok daha iyi Şut yaptı" tespit edilemiyor. Sadece genel skor üzerinden medyan + MAD çalışıyor.

### E-10: "Kişisel Rekor" Rozeti Son 3 Hafta İçindeki Zirveyi Kontrol Ediyor ama Eski Rekorları Görmezden Geliyor

**Dosya/Satır:** sharecard.js:175-180

```javascript
const peak = Math.max(...all);
if (all.slice(-3).includes(peak)) result.push({ e: '⭐', t: 'KİŞİSEL REKOR' });
```

Oyuncu 10 hafta önce 9.5 almış, son 3 hafta maks 8 almışsa rozet verilmez. 10 hafta önce 7.0 almış, son hafta 7.5 almışsa rozet verilir. "Kişisel rekor" değil, "yakın dönem zirve" demek daha doğru.

---

## 5. Özet Matris

| Kod  | Tür        | Etki     | Dosya / Satır                       |
|------|------------|----------|-------------------------------------|
| C-01 | Çelişki    | Yüksek   | stats.js:381 vs :437                |
| C-02 | Çelişki    | Yüksek   | stats.js:381 / :684 / sharecard.js:167 |
| C-03 | Çelişki    | Yüksek   | rating.js:7 vs stats.js:767         |
| C-04 | Çelişki    | Orta     | profile.js:44 vs :32               |
| C-05 | Çelişki    | Orta     | stats.js:791 vs rating.js:46        |
| C-06 | Çelişki    | Orta     | sharecard.js:113 vs :205            |
| C-07 | Çelişki    | Düşük    | rating.js / profile.js / sharecard.js / stats.js |
| C-08 | Çelişki    | Düşük    | stats.js:390                        |
| C-09 | Çelişki    | Düşük    | profile.js (form şeridi vs OVR)     |
| C-10 | Çelişki    | Düşük    | stats.js:779-780                    |
| E-01 | Eksiklik   | Yüksek   | GAS / rating.js                     |
| E-02 | Eksiklik   | Yüksek   | profile.js / stats.js               |
| E-03 | Eksiklik   | Orta     | forecast.js çağrısı                 |
| E-04 | Eksiklik   | Orta     | config.js:34-35                     |
| E-05 | Eksiklik   | Orta     | dna.js                              |
| E-06 | Eksiklik   | Düşük    | sharecard.js:66-79                  |
| E-07 | Eksiklik   | Düşük    | stats.js:801                        |
| E-08 | Eksiklik   | Düşük    | lineup-optimizer.js                 |
| E-09 | Eksiklik   | Düşük    | anomaly.js                          |
| E-10 | Eksiklik   | Düşük    | sharecard.js:175-180                |

---

## 6. Önerilen Öncelikli Düzeltmeler

1. **C-01 + C-02:** Tüm trend hesaplamalarını tek `calcTrend(vals)` fonksiyonuna taşı, eşiği config.js'e al.
2. **C-03:** `calcStdDev < 2` için `0` yerine `null` döndür; çağıran kod `null`'ı "yetersiz veri" olarak ele alsın.
3. **C-04:** "Ateş" rozeti `hasConsecutiveTop3` içinde `weeklyGenels` yerine `posRating` kullansın, Lig sıralamasıyla tutarlı olsun.
4. **E-04:** KL pozisyonu için `Savunma` ağırlığını düşür (ör. 0.60), özel bir "Kale" kriteri eklenene kadar `Hız` ve `Fizik` ağırlıklarını artır.
5. **C-07:** `criteriaAvg`, `attendCount`, `stddev` fonksiyonlarını `utils.js` veya `rating.js`'e taşı, tek kaynak yap.
