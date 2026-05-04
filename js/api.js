import { getGS, CURRENT_TEAM, sGet } from './storage.js';
import { showToast } from './utils.js';

const WRITE_ACTIONS = new Set([
  'save', 'saveMatch', 'saveMevki', 'savePlayer', 'deletePlayer', 'saveVideo',
  'verifyPin', 'saveTodayPlayers', 'saveHakem', 'saveAttendance',
  'saveManualWeek', 'saveSetting'
]);

export function gs(p) {
  return new Promise((resolve, reject) => {
    const runRequest = (retryCount = 0) => {
      const baseUrl = getGS();
      const isWrite = WRITE_ACTIONS.has(p.action);
      const allParams = { ...p };

      if (isWrite) {
        try {
          const sess = JSON.parse(sGet('hs_admin_session') || '{}');
          if (sess.adminToken) allParams.adminToken = sess.adminToken;
        } catch (_) {}
      }

      const fetchOpts = isWrite
        ? { method: 'POST', redirect: 'follow', body: JSON.stringify(allParams) }
        : { method: 'GET', redirect: 'follow' };

      const url = isWrite
        ? baseUrl
        : baseUrl + (baseUrl.includes('?') ? '&' : '?') +
          Object.keys(allParams).map(k =>
            encodeURIComponent(k) + '=' + encodeURIComponent(allParams[k])
          ).join('&');

      console.log(`[PitchRank] ${isWrite ? '📤 POST' : '📡 GET'} ${p.action}`);

      fetch(url, fetchOpts)
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
