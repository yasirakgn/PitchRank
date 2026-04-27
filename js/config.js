export const TEAM_CONFIG = {
  haldunalagas: {
    id: 'haldunalagas',
    name: 'Haldunalagaş',
    emoji: '🦅',
    color: '#f59e0b',
    logo: 'assets/images/icon-192.png',
    gs: 'https://script.google.com/macros/s/AKfycbxn8T0QYMmZpU0NvVylCQLhIsv_HPPFODAvt3vKJ9EzolwYekv1L3ovyuos2DNCuwy3/exec'
  },
  arion: {
    id: 'arion',
    name: 'Arion FC',
    emoji: '🐴',
    color: '#6366f1',
    logo: 'assets/images/icon-192.png',
    gs: 'https://script.google.com/macros/s/AKfycbxDVAjBLnynV1osvQ181glA2oO2MK1hy8Ab40FWHjlQHHtXKU-z4Jt3Ex6fOjQPUT7jTA/exec'
  }
};

export const BASE_URL = 'assets/images/';
export const PLAYERS_VERSION = '6';
export const CRITERIA = ['Pas','Sut','Dribling','Savunma','Hiz / Kondisyon','Fizik','Takim Oyunu'];
export const CDISP    = ['Pas','Şut','Drib.','Savunma','Hız','Fizik','Takım'];
export const POS      = { KL: 'Kaleci', DEF: 'Defans', OMO: 'Orta Saha', FRV: 'Forvet' };
export const POS_GROUPS = [
  { label: 'Kale', keys: ['KL'] },
  { label: 'Defans', keys: ['DEF'] },
  { label: 'Orta Saha', keys: ['OMO'] },
  { label: 'Forvet', keys: ['FRV'] }
];
export const VALID_POS = ['KL','DEF','OMO','FRV'];
export const POS_WEIGHTS = {
  KL:  [0.30, 0.05, 0.10, 1.00, 0.45, 0.90, 0.65],
  DEF: [0.60, 0.20, 0.40, 1.00, 0.80, 0.90, 0.80],
  OMO: [1.00, 0.55, 0.85, 0.50, 0.90, 0.80, 1.00],
  FRV: [0.65, 1.00, 0.90, 0.10, 1.00, 0.75, 0.75]
};
export const MEDALS = ['🥇','🥈','🥉'];
