# Kapsamlı Refactor Görevi (Production-Grade Stabilizasyon)

## Başlık
UI event mimarisi + güvenli render + cache/network dayanıklılığı + akış testleri

## Problem Tanımı
Kod tabanı işlevsel olsa da aşağıdaki yapısal riskleri taşımaktadır:
- Event yönetimi dağınık ve global/inline çağrılara bağlı.
- `innerHTML` yoğun kullanımı güvenlik ve bakım riski oluşturuyor.
- Cache erişimlerinde standardizasyon tam değil; TTL/migration stratejisi uygulama geneline yayılmamış.
- Network retry/timeout temeli mevcut, fakat telemetry ve sınıflandırılmış hata akışı sınırlı.
- Testler helper düzeyinde iyi; kullanıcı akışı entegrasyon testleri eksik.

## Hedef
Uygulamayı production-grade seviyeye taşımak:
1. Daha güvenli render
2. Tek tip event mimarisi
3. Güçlü cache/network davranışı
4. Akış testleri ile regresyon riskini düşürme

## Kapsam (In)
1. **Event Mimarisi**
   - Inline `onclick` kullanımını `data-action` + event delegation modeline taşı.
   - Global fonksiyon bağımlılıklarını merkezi handler katmanına indir.

2. **Render Güvenliği**
   - Kritik `innerHTML` noktalarını güvenli render helper ile dönüştür.
   - Kullanıcı/veri kaynaklı stringlerde sanitize/escape standardını zorunlu kıl.

3. **Cache Standardizasyonu**
   - App genelinde `HSStorage` kullanımını standartlaştır.
   - TTL + versioned migration planı uygula.

4. **Network Dayanıklılığı (v2)**
   - `HSNetwork` üzerine request-id, exponential backoff, hata sınıflandırması ve telemetry hook (`onRequestError`) ekle.

5. **Test Stratejisi Genişletme**
   - Helper testlerine ek olarak kritik kullanıcı akışları için integration/flow testleri ekle.

## Kapsam (Out)
- UI redesign / tema yeniden tasarımı
- Backend API sözleşme değişikliği
- Yeni ürün modülü geliştirme

## Teknik Alt Görevler
1. `ui/events.js`: event map + delegation dispatcher
2. `ui/render.js`: safeText/safeHTML helper ve güvenli render API
3. `HSStorage`: migration helper (`migrateKeys(version)`) ve TTL politika standardı
4. `HSNetwork`: `onRequestError`, `requestId`, `backoffStrategy`
5. `tests/flow/*.test.js`: kimlik/puanlama/submit ve include fallback akışları
6. `README` veya geliştirici notlarına mimari kararlar bölümü

## Kabul Kriterleri (Acceptance Criteria)
- [ ] Inline `onclick` kullanımının büyük kısmı kaldırıldı ve event delegation aktif.
- [ ] Kritik render path’lerinde güvenli render katmanı uygulanmış.
- [ ] Cache erişimleri `HSStorage` standardına taşınmış ve migration dokümante edilmiş.
- [ ] Network helper’da retry/backoff + telemetry hook aktif.
- [ ] En az 3 kritik kullanıcı akışı integration testi eklendi.
- [ ] `npm test` tüm testlerle stabil geçiyor.
- [ ] Dokümantasyon güncellendi.

## DoD (Definition of Done)
- Kod review + test + dokümantasyon tamam.
- Mevcut helper testleri ve yeni flow testleri geçiyor.
- Merge sonrası bilinen kritik issue kalmamış.

## Tahmini Efor
Toplam: 3-5 gün
- Event mimarisi: 1.5 gün
- Render güvenliği: 1 gün
- Cache/network iyileştirme: 1 gün
- Flow test + dokümantasyon: 0.5-1.5 gün
