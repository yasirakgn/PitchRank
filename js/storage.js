import { TEAM_CONFIG } from './config.js';

export const CURRENT_TEAM = sessionStorage.getItem('pitchrank_selected_team') || null;

export function getStorageKey(key) {
  if (!CURRENT_TEAM) return key;
  return CURRENT_TEAM + '_' + key;
}

export function lGet(k) { return localStorage.getItem(getStorageKey(k)); }
export function lSet(k, v) { localStorage.setItem(getStorageKey(k), v); }
export function lRem(k) { localStorage.removeItem(getStorageKey(k)); }

export function sGet(k) { return sessionStorage.getItem(getStorageKey(k)); }
export function sSet(k, v) { sessionStorage.setItem(getStorageKey(k), v); }
export function sRem(k) { sessionStorage.removeItem(getStorageKey(k)); }

export function getGS() {
  if (!CURRENT_TEAM || !TEAM_CONFIG[CURRENT_TEAM]) return TEAM_CONFIG.haldunalagas.gs;
  return TEAM_CONFIG[CURRENT_TEAM].gs;
}
