['hs_players','hs_players_cache','hs_mevkiler_cache','hs_today_players_cache',
 'hs_hakem_cache','hs_results_cache','hs_matches_cache','hs_manual_week','hs_players_version']
  .forEach(k => localStorage.removeItem(k));

export const state = {
  players: [],
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
  videosData: null,
  currentVideoWeek: null,
  hakemData: { week: '', hakem: [] },
  selectedHakem: [],
  manualWeek: null,
  lastRefreshTime: null,
};
