(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.HSUtils = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const VALID_POS = ['KL', 'DEF', 'OMO', 'FRV'];
  const CRITERIA_LABELS = {
    Pas: 'Pas',
    Sut: 'Şut',
    Dribling: 'Dribbling',
    Savunma: 'Savunma',
    'Hiz / Kondisyon': 'Hız / Kondisyon',
    Fizik: 'Fizik',
    'Takim Oyunu': 'Takım Oyunu'
  };
  const CRITERIA_SHORT_LABELS = {
    Pas: 'Pas',
    Sut: 'Şut',
    Dribling: 'Drib.',
    Savunma: 'Savunma',
    'Hiz / Kondisyon': 'Hız',
    Fizik: 'Fizik',
    'Takim Oyunu': 'Takım'
  };
  const TR_CHAR_MAP = {
    ç: 'c', Ç: 'c',
    ğ: 'g', Ğ: 'g',
    ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o',
    ş: 's', Ş: 's',
    ü: 'u', Ü: 'u'
  };

  function normalizeTr(text) {
    return String(text || '').split('').map((c) => TR_CHAR_MAP[c] !== undefined ? TR_CHAR_MAP[c] : c).join('');
  }

  function sanitizeKey(value) {
    return normalizeTr(value).replace(/[^a-zA-Z0-9]/g, '_');
  }

  function criterionLabel(key) {
    return CRITERIA_LABELS[key] || key;
  }

  function criterionShortLabel(key) {
    return CRITERIA_SHORT_LABELS[key] || criterionLabel(key);
  }

  function toPhotoFilename(name) {
    return normalizeTr(name).toLowerCase().split('').map((c) => c === ' ' ? '' : c).join('') + '.png';
  }

  function normPos(p) {
    const arr = Array.isArray(p.pos) ? p.pos : [p.pos || ''];
    const valid = arr.filter((k) => VALID_POS.includes(k));
    if (valid.length) return [valid[0]];
    const old = arr[0] || '';
    if (['GK', 'KL', 'SW'].includes(old)) return ['KL'];
    if (['CB', 'RB', 'LB', 'RWB', 'LWB', 'STP', 'SAB', 'SOB', 'SABK', 'SOBK', 'DEF'].includes(old)) return ['DEF'];
    if (['CDM', 'CM', 'CAM', 'RM', 'LM', 'DMO', 'AMO', 'SAO', 'SOO', 'OMO'].includes(old)) return ['OMO'];
    if (['ST', 'CF', 'RW', 'LW', 'SS', 'SAN', 'FW', 'IKF', 'SKT', 'SOKT', 'FRV'].includes(old)) return ['FRV'];
    return ['OMO'];
  }

  function formatMoney(value) {
    if (isNaN(value)) return '€0';
    if (value >= 1000000) return '€' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '€' + Math.round(value / 1000) + 'K';
    return '€' + Math.round(value);
  }

  function ratingColor(rating) {
    if (rating >= 85) return { text: '#eab308', bar: '#eab308' };
    if (rating >= 75) return { text: '#94a3b8', bar: '#94a3b8' };
    if (rating >= 65) return { text: '#d97706', bar: '#d97706' };
    return { text: '#3b82f6', bar: '#3b82f6' };
  }

  return {
    CRITERIA_LABELS,
    VALID_POS,
    sanitizeKey,
    criterionLabel,
    criterionShortLabel,
    toPhotoFilename,
    normPos,
    formatMoney,
    ratingColor
  };
});
