import { PLAYERS_VERSION } from './config.js';
import { lGet, lRem, lSet } from './storage.js';

if (lGet('hs_players_version') !== PLAYERS_VERSION) {
  lRem('hs_players');
  lRem('hs_players_cache');
  lRem('hs_mevkiler_cache');
  lRem('hs_today_players_cache');
  lRem('hs_hakem_cache');
  lSet('hs_players_version', PLAYERS_VERSION);
}

export const state = {
  players: JSON.parse(lGet('hs_players')) || [],
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
};
