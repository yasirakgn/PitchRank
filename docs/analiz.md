# PitchRank Proje Analizi - Guncel Kontrol

Tarih: 2026-05-04

Bu dosya onceki analiz maddeleri uzerinden yapilan ikinci kontrolun guncel sonucudur. Kod tabani tekrar incelendi; backend Apps Script taslagi (`app gs.txt`), aktif JS modulleri, PWA/Vercel ayarlari, yeni test dosyalari ve escape/encoding riskleri kontrol edildi.

## Kisa Durum

Onemli bir ilerleme var: admin yazma fonksiyonlarinin buyuk kismi artik server-side `requireAdmin` kontrolunden geciyor, `saveRating` icin `LockService` eklenmis ve yeni saf fonksiyon testleri yazilmis. Buna ragmen tum maddeler kapanmis degil.

Hala kesin duzeltilmesi gereken ana konular:

1. Yazma istekleri hala `GET` ve query string ile gidiyor; `adminToken` URL'ye ekleniyor.
2. UI admin oturumu sadece local session kontroluyle acilabiliyor.
3. Encoding/mojibake problemi repo genelinde devam ediyor.
4. PWA route/fallback/boot versiyonu tutarsizligi devam ediyor.
5. XSS/HTML injection yuzeyi kismen azalmis ama tamamen kapanmamis.
6. Eski `js/app.js.bak` dosyasi hala repoda duruyor.

## Duzelen Maddeler

### 1. Backend admin yetkilendirme buyuk olcude eklendi

Durum: Duzeldi / buyuk oranda kapandi.

Onceki analizde en kritik risk, Apps Script tarafinda admin yazma endpointlerinin server-side kontrol olmadan calismasiydi. Guncel kontrolde `requireAdmin(params)` eklenmis ve admin token `CacheService` uzerinden dogrulaniyor.

Ornek kapatilan fonksiyonlar:

- `app gs.txt:315-316` `saveMevki`
- `app gs.txt:449-450` `saveAttendance`
- `app gs.txt:531-532` `saveVideo`
- `app gs.txt:572-573` `saveManualWeek`
- `app gs.txt:604-605` `saveSetting`

Not:

Bu guzel bir duzeltme. Ancak tokenin tasinma sekli hala sorunlu; `adminToken` URL query string icinde gidiyor. Bu nedenle yetkilendirme mantigi eklenmis olsa da API tasima katmani hala guvensiz.

### 2. Admin PIN dogrulama backend token uretiyor

Durum: Duzeldi / kismen kapandi.

`verifyPin` artik basarili giriste token uretiyor ve `CacheService` icine 7200 saniyelik kayit koyuyor.

Kaynaklar:

- `app gs.txt:67-74` `requireAdmin`
- `app gs.txt:76-108` `verifyPin`

Eksik kalan taraf:

Client tokeni query string ile gonderiyor. Token header/body icinde POST ile tasinmali.

### 3. Double vote / yarismali oy yazma riski azaldi

Durum: Duzeldi.

`saveRating` icinde `LockService.getScriptLock()` kullaniliyor. Oy kontrolu ve append islemi ayni lock kapsaminda yapildigi icin ayni anda iki istekle cift oy yazma riski ciddi sekilde azaltilmis.

Kaynak:

- `app gs.txt:213-245`

### 4. Bazi XSS noktalarinda escape eklenmis

Durum: Kismen duzeldi.

Ornek olarak:

- `js/main.js:234-250` futbol karti tarafinda `photoUrl` ve `p.name` icin `escHtml` kullanimi eklenmis.
- `js/stats.js:1023` katilim tablosunda oyuncu adi ve pozisyon escape ediliyor.
- `js/stats.js:1061-1094` mac gecmisi alanlarinda escape kullanimi artmis.
- `js/admin.js:391` video hafta degeri `escJsSingle` ile inline JS argumanina hazirlaniyor.
- `js/admin.js:434` iframe title icin `escHtml` kullaniliyor.

Eksik kalan taraf:

Tum yuzey kapanmadi. Ozellikle profil modal renderinda ve bazi inline handlerlarda hala dogrudan template string icine veri basiliyor.

### 5. Yeni testler eklenmis

Durum: Duzeldi / olumlu.

`package.json` icine test scripti eklenmis:

- `package.json` `test`: `node --test tests/*.test.js`

Yeni test dosyalari:

- `tests/forecast.test.js`
- `tests/anomaly.test.js`

Direkt calistirma sonucu:

- `node tests/forecast.test.js`: 7 test basarili.
- `node tests/anomaly.test.js`: 7 test basarili.

Not:

`npm test` PowerShell execution policy nedeniyle bu ortamda calismadi. `node --test tests/*.test.js` de sandbox icinde `spawn EPERM` verdi. Ancak test dosyalari tek tek `node tests/...` ile calistirildiginda basarili.

## Eksik Kalan ve Kesin Duzeltilmesi Gereken Maddeler

### 1. API mutationlari hala GET ile yapiliyor

Oncelik: Kritik

Durum: Eksik / kesin duzeltilmeli.

Kaynaklar:

- `js/api.js:13` tum parametreler URL query string'e ekleniyor.
- `js/api.js:17` `fetch(url, { method: 'GET' })` kullaniyor.
- `app gs.txt:6` sadece `doGet(e)` var.
- `app gs.txt` icinde `doPost(e)` bulunmuyor.

Etki:

Skor, oyuncu, ayar, video, admin token ve benzeri veriler URL uzerinden tasiniyor. Bu veriler browser history, proxy loglari, Apps Script loglari, hata raporlari veya referrer zincirlerinde gorulebilir. Ayrica state-changing islemlerin GET ile yapilmasi CSRF/link tetikleme riskini artirir.

Kesin cozum:

- Okuma aksiyonlari GET kalabilir.
- Yazma aksiyonlari POST'a alinmali.
- Apps Script tarafina `doPost(e)` eklenmeli.
- JSON body parse edilmeli.
- `adminToken` query string yerine body veya header icinde tasinmali.
- Client tarafinda action bazli olarak read/write ayrimi yapilmali.

### 2. Admin UI session kontrolu eksik

Oncelik: Yuksek

Durum: Eksik / duzeltilmeli.

Kaynaklar:

- `js/admin.js:32` `isAdminLoggedIn()` sadece local `token` ve `expires` kontrol ediyor.
- `js/admin.js:33` `setAdminSession(adminToken)` hem local `token` hem `adminToken` yaziyor ama login kontrolu `adminToken` varligini aramiyor.

Etki:

Kullanici DevTools ile `hs_admin_session` icine sahte `token` ve `expires` yazarsa admin ekranini UI olarak acabilir. Backend yazma istekleri `adminToken` olmadigi icin reddedilir, bu yuzden ana veri guvenligi artik daha iyi. Ancak admin panelinin gorunebilmesi ve hatali istekler tetiklenebilmesi hala dogru degil.

Kesin cozum:

`isAdminLoggedIn()` su kosullari birlikte kontrol etmeli:

- `d.token` var.
- `d.adminToken` var.
- `d.expires` var ve gecmemis.

Ek olarak admin ekranina girerken server token gecerliligi kisa bir `verifySession` aksiyonu ile dogrulanabilir.

### 3. Encoding/mojibake sorunu devam ediyor

Oncelik: Yuksek

Durum: Eksik / kesin duzeltilmeli.

Ornek kaynaklar:

- `js/admin.js:23` bozuk yorum/metinler: `ADMÄ°N GÄ°RÄ°Å`
- `js/admin.js:53` `DoÄŸrulanÄ±yor`
- `js/admin.js:60` `YÃ¶netici giriÅŸi baÅŸarÄ±lÄ±`
- `js/api.js:15` `isteÄŸi gÃ¶nderiliyor`
- `manifest.json:5` `HalÄ± saha ... deÄŸerlendirme`

Etki:

Kullanici arayuzunde bozuk Turkce karakterler ve bozuk emojiler gorunur. Manifest, SEO, toast mesajlari, admin metinleri ve konsol loglari profesyonel gorunmez. Ayrica dosya adi/isim normalize eden yardimci fonksiyonlar gercek UTF-8 veride yanlis davranabilir.

Kesin cozum:

- Tum HTML/JS/CSS/JSON dosyalari gercek UTF-8 olarak normalize edilmeli.
- Bozulmus metinler kaynak metinden tek tek duzeltilmeli.
- `toPhotoFilename`, `san`, arama/normalize fonksiyonlari gercek Turkce karakterleri desteklemeli.
- Bu islemden sonra tekrar `rg "Ã|Ä|Å|ğŸ|â|Â|�"` kontrolu yapilmali.

### 4. PWA route ve boot stratejisi hala tutarsiz

Oncelik: Yuksek

Durum: Eksik / kesin duzeltilmeli.

Kaynaklar:

- `manifest.json:7` `start_url`: `/app`
- `vercel.json:13-15` tum bilinmeyen route'lar `/app.html` dosyasina gidiyor.
- `app.html:8` `noindex,nofollow`
- `index.html:126` `js/boot.js?v=3.2`
- `app.html:58` `js/boot.js?v=3.1`

Etki:

PWA ana ekrandan acilinca `/app` route'u `/app.html` uzerinden calisabilir. Bu, `index.html` ile farkli HTML/meta/boot versiyonu anlamina geliyor. Cache busting, SEO ve uygulama baslangic davranisi tutarsizlasir.

Kesin cozum:

Tek giris noktasi secilmeli:

- Secenek A: `index.html` tek ana uygulama olsun, Vercel fallback `/index.html` olsun, manifest `start_url` `/` olsun.
- Secenek B: `app.html` tek uygulama kaynagi olsun, `index.html` landing/redirect olarak net ayrilsin.

Hangi yol secilirse:

- `manifest.start_url`
- canonical
- robots
- Vercel fallback
- boot query versiyonu

birbiriyle ayni stratejiye gore eslenmeli.

### 5. XSS/HTML injection yuzeyi kismen acik

Oncelik: Yuksek

Durum: Kismen duzeldi / eksik devam ediyor.

Kalan ornekler:

- `js/main.js:348` `photoUrl` profil modalinda dogrudan `src` attribute icine basiliyor.
- `js/main.js:349` fallback icinde `p.name.charAt(0)` escape edilmeden basiliyor.
- `js/main.js:352` `p.name` dogrudan HTML icine basiliyor.
- `js/main.js:355` `styles.slice(...).map(...)` icinde `s.icon` ve `s.name` dogrudan HTML icine basiliyor.
- `js/main.js:461` `toggleToday('${escHtml(p.name)}')` HTML escape'i JS string argumani icin kullaniliyor; bu is icin ayri `escJsSingle` veya data attribute gerekir.

Etki:

Spreadsheet veya oyuncu verisine beklenmedik karakter girerse HTML kirilabilir. Kotu niyetli veri sheet'e yazilabilirse XSS mumkun olabilir. CSP hala `unsafe-inline` kullandigi icin XSS etkisi buyur.

Kesin cozum:

- HTML text icin `escHtml`.
- Attribute icin `escAttr` veya guvenli `setAttribute`.
- Inline JS argumani icin `escJsSingle`.
- Daha iyi cozum: inline `onclick` yerine `data-*` attribute + event delegation.
- Profil modal renderi DOM API veya tam escape ile yeniden ele alinmali.

### 6. Eski `js/app.js.bak` dosyasi hala repoda

Oncelik: Orta

Durum: Eksik.

Kaynak:

- `js/app.js.bak`

Etki:

Aktif olarak yuklenmiyor olabilir, ancak icinde eski GET API kullanimi ve eski unescaped HTML renderlari duruyor. Arama, review ve bakim sirasinda kafa karistirir. Yanlislikla include edilirse eski riskler geri gelebilir.

Kesin cozum:

Gercekten gerekmiyorsa silinmeli. Arsiv olarak tutulacaksa `docs/archive` altina tasinip "aktif degildir" notu eklenmeli.

### 7. CSP hala zayif

Oncelik: Orta / Yuksek

Durum: Eksik.

Kaynak:

- `vercel.json:23-24` `script-src` icinde `unsafe-inline` ve `unsafe-eval` var.
- `style-src` icinde `unsafe-inline` var.

Etki:

XSS yuzeyi kapatilsa bile CSP su an koruyucu bir son bariyer olarak zayif. Inline handler ve inline style yogunlugu nedeniyle CSP sertlestirilemiyor.

Kesin cozum:

- Inline `onclick`leri event delegation'a tasi.
- `unsafe-eval` ihtiyacini kaldir.
- Inline stylelari CSS classlara indir.
- Son hedef: `script-src 'self' ...` seviyesine yaklasmak.

## Teknik Kontrol Sonuclari

Yapilan kontroller:

- `node --check js/api.js`: basarili.
- `Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }`: basarili.
- `css/main.css` brace dengesi: 570 acilis, 570 kapanis.
- `node tests/forecast.test.js`: 7/7 basarili.
- `node tests/anomaly.test.js`: 7/7 basarili.

Bu ortamda sorunlu olan komutlar:

- `npm test`: PowerShell execution policy nedeniyle calismadi.
- `node --test tests/*.test.js`: sandbox icinde `spawn EPERM` verdi.

Not:

Test dosyalari tek tek calistirildiginda basarili oldugu icin testlerin icerigi calisiyor. Sorun daha cok ortam/shell calistirma sekliyle ilgili.

## Guncel Oncelik Sirasi

### Kesin once yapilmasi gerekenler

1. Yazma API'lerini GET query string'den POST JSON body'ye tasima.
2. `adminToken`i URL'den kaldirma.
3. `doPost(e)` ekleme ve Apps Script tarafinda read/write ayrimi yapma.
4. `isAdminLoggedIn()` icinde `adminToken` varligini da kontrol etme.
5. Encoding/mojibake temizligi yapma.
6. PWA route/fallback/boot versiyonu stratejisini tek hale getirme.
7. Profil modal ve kalan inline JS argumanlarindaki XSS/HTML injection risklerini kapatma.

### Sonra yapilmasi gerekenler

1. `js/app.js.bak` dosyasini silme veya arsive tasima.
2. CSP'yi adim adim sertlestirme.
3. Inline `onclick` ve inline style yogunlugunu azaltma.
4. Optimizer, oyuncu isim normalize, hafta gate ve vote flow icin ek testler yazma.
5. Browser smoke/E2E testi ekleme.

## Sonuc

Proje onceki analize gore daha iyi durumda. En kritik backend yetkilendirme problemi buyuk oranda ele alinmis, double vote riski azaltmis, test altyapisi baslamis. Fakat guvenlik acisindan proje hala "tam kapandi" durumunda degil; GET ile mutation ve tokenin URL'de tasinmasi kesinlikle duzeltilmeli. Encoding ve PWA tutarsizliklari da kullanici deneyimi ve yayina hazirlik acisindan mutlaka temizlenmeli.
