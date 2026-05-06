# PitchRank — mat.md Kalan Düzeltmeler

Date: 2026-05-06
Scope: E-05, E-06, E-08, E-09, E-10, C-09

---

## Değişiklikler

### C-09 — Form Şeridi posRating'e Geçiş (profile.js)

`renderFormStrip` içinde sparkline noktaları şu an `weeklyGenels[i]` (ham 0-10 × 10) kullanıyor.
Değişiklik: her hafta için `weeklyKriterler[week]` ve `pObj` kullanarak `posRating` hesapla;
null döndürürse `weeklyGenels[i] * 10` fallback olarak kullan.
Forecast da aynı dizi üzerinden çalışmaya devam eder.

### E-05 — DNA Sıfır-Vektör Guard (dna.js)

Cosine similarity hesabında payda `‖a‖ × ‖b‖ = 0` olabilir (tüm kriter değerleri 0/null).
Guard: magnitude sıfır olan oyuncuyu benzerlik listesinden çıkar (similarity = 0 ata).

### E-06 — Kart Tier Eşikleri (main.js + sharecard.js)

Mevcut: EFSANE ≥ 90, ALTIN ≥ 85, GÜMÜŞ ≥ 75, BRONZ < 75
Yeni:    EFSANE ≥ 80, ALTIN ≥ 70, GÜMÜŞ ≥ 60, BRONZ < 60
İki dosyada da aynı eşikler güncellenecek.

### E-08 — Lineup Optimizer Cache (lineup-optimizer.js + çağıran kod)

`findOptimalLineup` takım değişiminde stale veri kullanabilir.
Araştır: optimizer'da cache var mı? Varsa, takım değişim olayında (selectTeam / showTeamConfirm akışı) temizle.
Basit fix: `CURRENT_TEAM` değiştiğinde optimizer cache değişkenini null/undefined yap.

### E-09 — Anomali Tespiti posRating'e Geçiş (anomaly.js)

`detectAnomalies(resultData)` şu an `weeklyGenels[i]` kullanıyor.
Değişiklik: `state.players`'dan `pObj` al, her hafta için `posRating` hesapla (fallback: `weeklyGenels[i]`).
`state` import edilmeli; anomaly.js'in mevcut import yapısı kontrol edilecek.

### E-10 — KİŞİSEL REKOR Rozeti (sharecard.js)

Mevcut mantık: tüm zamanların en yüksek skoru son 3 haftada mı?
Yeni mantık: son haftanın skoru, önceki tüm haftaların max'ından kesin olarak yüksekse rekor.
```js
const prev = all.slice(0, -1);
if (prev.length && all[all.length - 1] > Math.max(...prev)) {
  result.push({ e: '⭐', t: 'KİŞİSEL REKOR' });
}
```

---

## Etkilenen Dosyalar

- `js/profile.js` — C-09
- `js/dna.js` — E-05
- `js/main.js` — E-06
- `js/sharecard.js` — E-06, E-10
- `js/lineup-optimizer.js` — E-08
- `js/anomaly.js` — E-09

## Kapsam Dışı

- E-04 (KL ağırlıkları) — skip
- E-01 (GAS formülü) — backend, frontend'de fix edilemez
- E-02 (vote-gate profil) — profile.js:416'da zaten uygulanıyor, dokunma
