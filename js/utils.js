import { VALID_POS, POS, BASE_URL } from './config.js';
import { state } from './state.js';

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function normPos(p) {
  let arr = Array.isArray(p.pos) ? p.pos : [p.pos || ''];
  let valid = arr.filter(k => VALID_POS.includes(k));
  if (valid.length) return [valid[0]];
  let old = arr[0] || '';
  if (['GK','KL','SW'].includes(old)) return ['KL'];
  if (['CB','RB','LB','RWB','LWB','STP','SAB','SOB','SABK','SOBK','DEF'].includes(old)) return ['DEF'];
  if (['CDM','CM','CAM','RM','LM','DMO','AMO','SAO','SOO','OMO'].includes(old)) return ['OMO'];
  if (['ST','CF','RW','LW','SS','SAN','FW','IKF','SKT','SOKT','FRV'].includes(old)) return ['FRV'];
  return ['OMO'];
}

export function posLabel(p) { return normPos(p).map(k => POS[k] || k).join(' / '); }
export function posShort(p) { return posLabel(p); }

export function toPhotoFilename(name) {
  const map = { 'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u' };
  return String(name || '').toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : (c === ' ' ? '' : c)).join('') + '.png';
}

export function san(s) { return toPhotoFilename(s).replace('.png', ''); }

export function getPlayerPhoto(name) {
  const p = state.players.find(x => x.name === name);
  let photo = (p && p.photo) ? String(p.photo).trim() : '';
  if (!photo) photo = toPhotoFilename(name);
  // Cache-buster: her seferinde güncel fotoğraf yüklenir
  return photo ? BASE_URL + photo + '?v=' + Date.now() : '';
}

export function getWeekLabel() {
  if (state.manualWeek) return state.manualWeek;
  const now = new Date(), start = new Date(now.getFullYear(), 0, 1);
  return now.getFullYear() + '-H' + String(Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)).padStart(2, '0');
}

export function getAutoWeekLabel() {
  const now = new Date(), start = new Date(now.getFullYear(), 0, 1);
  return now.getFullYear() + '-H' + String(Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)).padStart(2, '0');
}

export function formatMoney(value) {
  if (isNaN(value)) return '€0';
  if (value >= 1000000) return '€' + (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return '€' + Math.round(value / 1000) + 'K';
  return '€' + Math.round(value);
}

export function scoreColor(v) {
  if(v>=9) return '#10b981'; if(v>=7) return '#84cc16'; if(v>=5) return '#eab308'; if(v>=3) return '#f97316'; return '#ef4444';
}

export function ratingColor(r) {
  if (r >= 85) return { text: '#eab308', bar: '#efbc25' };
  if (r >= 75) return { text: '#94a3b8', bar: '#94a3b8' };
  if (r >= 65) return { text: '#d97706', bar: '#d97706' };
  return { text: '#3b82f6', bar: '#3b82f6' };
}

export function cardClass(r) {
  if (r >= 85) return 'fc-gold'; if (r >= 75) return 'fc-silver';
  if (r >= 65) return 'fc-bronze'; return 'fc-normal';
}

export function showToast(msg, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function showConfirm(msg, onConfirm) {
  const bg = document.getElementById('confirmBg');
  const msgEl = document.getElementById('confirmMsg');
  const btn = document.getElementById('confirmBtn');
  if (!bg || !msgEl || !btn) {
    if (confirm(msg)) onConfirm();
    return;
  }
  msgEl.innerText = msg;
  btn.onclick = () => { onConfirm(); closeConfirm(); };
  bg.classList.add('open');
}

export function closeConfirm() {
  const bg = document.getElementById('confirmBg');
  if (bg) bg.classList.remove('open');
}
