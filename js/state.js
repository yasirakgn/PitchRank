import { PLAYERS_VERSION } from './config.js';
import { lGet, lRem, lSet } from './storage.js';

function readPlayers() {
  const raw = lGet('hs_players');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    lRem('hs_players');
    return [];
  }
}

if (lGet('hs_players_version') !== PLAYERS_VERSION) {
  lRem('hs_players');
  lRem('hs_players_cache');
  lRem('hs_mevkiler_cache');
  lRem('hs_today_players_cache');
  lRem('hs_hakem_cache');
  lSet('hs_players_version', PLAYERS_VERSION);
}

export const state = {
  players: readPlayers(),
  darkMode: localStorage.getItem('hs_dark') === '1',
  resultData: null,
  currentScores: {},
  completedCards: {},
  currentRater: '',
  sonucData: null,
  matchesData: null,
  todaySelected: {},
  pendingPos: {},
  currentProfileName: '',
  currentRankTab: 'genel',
  bugunSelected: {},
  videosData: null,
  currentVideoWeek: null,
  hakemData: { week: '', hakem: '' },
  selectedHakem: '',
  manualWeek: null,
  lastRefreshTime: null,
};
