# Kod İncelemesi Sonrası Önerilen Görevler

## 1) Yazım hatası düzeltme görevi
- **Başlık:** `CRITERIA` etiketlerindeki Türkçe karakter ve yazım tutarlılığını düzelt
- **Bulgu:** `js/app.js` içinde `CRITERIA` dizisinde `Sut`, `Dribling`, `Hiz / Kondisyon`, `Takim Oyunu` yazıyor. Aynı dosyadaki gösterim dizisinde (`CDISP`) ise `Şut`, `Drib.`, `Hız`, `Takım` kullanılmış.
- **Önerilen görev kapsamı:** Değerlendirme kriteri metinlerini tek bir normalize edilmiş sözlükten üretilecek şekilde düzenlemek ve tüm UI/rapor çıktılarında aynı imlayı kullanmak.
- **Beklenen çıktı:** Kullanıcıya görünen tüm kriter adları Türkçe karakterlerle ve tek biçimde görünür.

## 2) Hata düzeltme görevi
- **Başlık:** `san()` yardımcı fonksiyonunda Türkçe karakter kaynaklı anahtar çakışmalarını önle
- **Bulgu:** `san(s)` fonksiyonu (`js/app.js`) harf dışı karakterleri `_` yapıyor ama Türkçe karakterleri (`ş, ı, ç` vb.) translitere etmiyor. Bu durum aynı ismin farklı yazımları için beklenmedik anahtar üretimine ve veri eşleştirme hatalarına neden olabilir.
- **Önerilen görev kapsamı:** `san()` için deterministik transliterasyon (örn. `toPhotoFilename` yaklaşımına benzer) eklemek; gerekiyorsa mevcut localStorage anahtarları için bir migration adımı tanımlamak.
- **Beklenen çıktı:** İsim/anahtar üretimi locale bağımsız ve öngörülebilir olur.

## 3) Kod yorumu / dokümantasyon tutarlılığı görevi
- **Başlık:** `PLAYERS_VERSION` yorumunu davranışla uyumlu hale getir
- **Bulgu:** `// PLAYERS VERSION (cache temizleme)` yorumu yalnızca oyuncu önbelleğini çağrıştırıyor; fakat aynı blok `hs_mevkiler_cache`, `hs_today_players_cache` ve `hs_hakem_cache` anahtarlarını da siliyor.
- **Önerilen görev kapsamı:** Yorumu, temizlenen tüm cache kapsamını net ifade edecek şekilde güncellemek; mümkünse sürümleme stratejisini kısa bir geliştirici notu olarak dokümante etmek.
- **Beklenen çıktı:** Kod yorumu gerçek davranışı tam olarak açıklar, bakım maliyeti düşer.

## 4) Test iyileştirme görevi
- **Başlık:** Saf yardımcı fonksiyonlar için birim test altyapısı kur
- **Bulgu:** `package.json` içinde test script’i yok ve repoda test dosyası bulunmuyor.
- **Önerilen görev kapsamı:** Vitest/Jest ile minimum test iskeleti kurup şu fonksiyonlara test eklemek: `normPos`, `formatMoney`, `ratingColor`, `toPhotoFilename`.
- **Beklenen çıktı:** Kritik dönüşüm fonksiyonlarında regresyon riski düşer; yeni değişiklikler daha güvenli yapılır.
