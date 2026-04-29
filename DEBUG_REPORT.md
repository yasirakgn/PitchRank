# PitchRank — Debug & Analiz Raporu

> Tarih: 2026-04-29  
> Kapsam: Tüm JS modülleri, component HTML'leri, boot/init akışı  
> Durum: **Tüm sorunlar düzeltildi ✅**

---

## ✅ Düzeltilen Sorunlar

### 1. `checkPin()` — Yanlış nav-item indeksi
**Dosya:** [js/admin.js](js/admin.js#L60) · **Önem:** 🔴 Kritik

PIN doğrulandıktan sonra `.bnav-item[5]` (Profil) yerine `.bnav-item[6]` (Admin) seçiliyordu.  
**Düzeltme:** `[5]` → `[6]`

---

### 2. `loadResults` — Callback iki kez çağrılıyordu
**Dosya:** [js/stats.js](js/stats.js#L107) · **Önem:** 🟠 Önemli

Cache'den bir, GAS'tan bir kez çağrılıyordu → FIFA grid double render.  
**Düzeltme:** Cache'den çağrı sonrası `cb = null` eklendi. `forceRefresh=true` (Verileri Güncelle butonu) durumunda cache atlanıp GAS'tan tek çağrı yapılır.

---

### 3. `getPlayerPhoto` — Browser image cache devre dışıydı
**Dosya:** [js/utils.js](js/utils.js#L30) · **Önem:** 🟠 Önemli

Her çağrıda `Date.now()` benzersiz URL üretiyordu → tüm fotoğraflar her render'da yeniden indiriliyordu.  
**Düzeltme:** `localStorage.getItem('hs_photo_version')` kullanılıyor. Admin paneline **"Fotoğrafları Yenile"** butonu eklendi — tıklanınca version güncellenir ve DOM'daki tüm foto `src`'leri anında yenilenir.

---

### 4. `loadPlayersFromSheets` — Dead code else-if bloğu
**Dosya:** [js/players.js](js/players.js#L105) · **Önem:** 🟠 Önemli

`[]` (boş dizi) truthy olduğu için else-if `data.players.length === 0` bloğu hiç çalışmıyordu.  
**Düzeltme:** `if (data && data.players)` → `if (data && Array.isArray(data.players))` — tek blokta boş ve dolu liste doğru handle ediliyor.

---

### 5. `san()` — Normalleştirme çakışması riski
**Dosya:** [js/utils.js](js/utils.js#L28) · **Önem:** 🟠 Önemli

"Ali Demir" ve "Alide Mir" aynı DOM ID'sine (`alidemir`) dönüşüyordu.  
**Düzeltme:** `san()` artık `toPhotoFilename`'den bağımsız — boşlukları `_` ile değiştirir. "Ali Demir" → `ali_demir`, "Alide Mir" → `alide_mir`. Fotoğraf dosya adları (`toPhotoFilename`) değişmedi.

---

### 6. `boot.js` — `force-cache` Vercel header'larını geçersiz kılıyordu
**Dosya:** [js/boot.js](js/boot.js#L22) · **Önem:** 🟡 Orta

`force-cache` fetch modu sunucunun `no-cache, must-revalidate` header'larını yok sayıyordu. `vercel.json`'da `/components/*` için zaten `no-cache, must-revalidate` tanımlı.  
**Düzeltme:** `'force-cache'` → `'default'` — artık Vercel header'ları geçerli, her deploy sonrası component HTML'leri güncellenir.

---

### 7. `attCount` — İki farklı hesaplama
**Dosya:** [js/sharecard.js](js/sharecard.js#L25) · **Önem:** 🟡 Orta

Paylaşım kartı `weeklyKriterler` key sayısını, profil sayfası `weeklyGenels` null olmayan değerleri sayıyordu → farklı "Maç" rakamları.  
**Düzeltme:** `sharecard.js` `attCount` → `weeklyGenels.filter(v => v != null).length` kullanıyor, `profile.js` ile aynı kaynak.

---

### 8. `closeSuccessPopup` — Hardcoded nav indeksi
**Dosya:** [js/players.js](js/players.js#L411) · **Önem:** 🟡 Orta

`document.querySelectorAll('.bnav-item')[1]` nav sırası değişince kırılırdı.  
**Düzeltme:** `document.querySelector('.bnav-item[onclick*="siralama"]')` — nav sırası bağımsız.

---

### 9. `selectWeekBtn` — Fragile `querySelector('div')`
**Dosya:** [js/stats.js](js/stats.js#L254) · **Önem:** 🟡 Orta

`btn.querySelector('div')` buton içindeki ilk div'i varsayıyordu, DOM yapısı değişince kırılırdı.  
**Düzeltme:** Hafta buton şablonundaki label div'e `wk-btn-label` sınıfı eklendi, `querySelector('.wk-btn-label')` ile seçiliyor.

---

### 10. `getYtEmbedUrl` — ID uzunluk kontrolü gevşekti
**Dosya:** [js/admin.js](js/admin.js#L367) · **Önem:** 🟢 Düşük

`>= 11` embed path'ten 11'den uzun ID'lere izin veriyordu.  
**Düzeltme:** `/embed/` branch'inde `>= 11` → `=== 11`.

---

### 11. ESC keydown listener — `initApp` dışındaydı
**Dosya:** [js/main.js](js/main.js) · **Önem:** 🟢 Düşük

Listener modül yüklenince (takım seçilmeden önce) bağlanıyordu.  
**Düzeltme:** `initApp()` içine taşındı — yalnızca uygulama aktifken çalışır.

---

### 12. `posRating` — `buildTeamsWithData` içinde çift çağrı
**Dosya:** [js/main.js](js/main.js#L501) · **Önem:** 🟢 Düşük

`posRating(pData, pl) != null ? posRating(pData, pl) : ...` aynı hesaplamayı iki kez yapıyordu.  
**Düzeltme:** `const pr = posRating(pData, pl)` ile tek hesaplama.

---

## 📋 Özet

| Önem | Toplam | Düzeltildi |
|------|--------|------------|
| 🔴 Kritik | 1 | ✅ 1 |
| 🟠 Önemli | 4 | ✅ 4 |
| 🟡 Orta | 4 | ✅ 4 |
| 🟢 Düşük | 3 | ✅ 3 |
| **Toplam** | **12** | **✅ 12** |
