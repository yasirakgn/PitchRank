import { getGS, CURRENT_TEAM } from './storage.js';
import { showToast } from './utils.js';

export function gs(p) {
  return new Promise((resolve, reject) => {
    const runRequest = (retryCount = 0) => {
      const baseUrl = getGS();
      const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + Object.keys(p).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(p[k])).join('&');

      console.log(`[PitchRank] 📡 ${p.action} isteği gönderiliyor:`, url);

      fetch(url, { method: 'GET', redirect: 'follow' })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP Error: ${r.status}`);
          return r.json();
        })
        .then(data => {
          console.log(`[PitchRank] ✅ ${p.action} başarılı.`);
          resolve(data);
        })
        .catch(err => {
          if (retryCount < 2) {
            console.warn(`[PitchRank] ⏳ ${p.action} başarısız, tekrar deneniyor (${retryCount + 1})...`);
            setTimeout(() => runRequest(retryCount + 1), 1500 * (retryCount + 1));
          } else {
            console.error(`[PitchRank] ❌ ${p.action} hatası:`, err);
            if (CURRENT_TEAM === 'arion') {
              showToast('Arion FC bağlantı hatası! Lütfen Apps Script ayarlarını kontrol edin.', true);
              console.warn('[PitchRank] Arion için Apps Script Dağıtım ayarlarında "Erişimi Olanlar" kısmının "Herkes (Anyone)" olduğundan emin olun.');
            }
            reject(err);
          }
        });
    };
    runRequest();
  });
}
