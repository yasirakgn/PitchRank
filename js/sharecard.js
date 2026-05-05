import { CRITERIA, CRITERIA_ABBR, TEAM_CONFIG } from './config.js';
import { state } from './state.js';
import { getPlayerPhoto, posLabel, showToast } from './utils.js';
import { posRating, calcStdDev } from './rating.js';
import { CURRENT_TEAM } from './storage.js';

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function hexRgb(hex) {
  return {
    rv: parseInt(hex.slice(1, 3), 16),
    gv: parseInt(hex.slice(3, 5), 16),
    bv: parseInt(hex.slice(5, 7), 16),
  };
}

function criteriaAvg(pd, cr) {
  if (!pd || !pd.weeklyKriterler) return 0;
  const vals = Object.values(pd.weeklyKriterler)
    .map(wk => (wk && wk[cr] != null ? +wk[cr] : null))
    .filter(v => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function attCount(pd) {
  return Array.isArray(pd?.weeklyGenels) ? pd.weeklyGenels.filter(v => v != null).length : 0;
}

function getSeasonRank(pd, rd) {
  if (!pd || !rd || !Array.isArray(rd.players)) return -1;
  const sorted = [...rd.players]
    .filter(p => p.genelOrt != null)
    .sort((a, b) => {
      const aObj = state.players.find(pl => pl.name === a.name) || { pos: ['OMO'] };
      const bObj = state.players.find(pl => pl.name === b.name) || { pos: ['OMO'] };
      return (posRating(b, bObj) || 0) - (posRating(a, aObj) || 0);
    });
  return sorted.findIndex(p => p.name === pd.name);
}

function loadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,      x + w, y + r,      r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h,  x + w - r, y + h,  r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,      y + h,  x, y + h - r,      r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,      y,       x + r, y,          r);
  ctx.closePath();
}

// ── Kart Tipi ─────────────────────────────────────────────────────────────────

const CARD_TYPES = {
  efsane: { label: 'EFSANE', c1: '#f59e0b', c2: '#9333ea', c3: '#ef4444', bg: '#0d0814' },
  altin:  { label: 'ALTIN',  c1: '#fbbf24', c2: '#d97706', c3: '#fde68a', bg: '#120e00' },
  gumus:  { label: 'GÜMÜŞ',  c1: '#e2e8f0', c2: '#94a3b8', c3: '#cbd5e1', bg: '#0d0f14' },
  bronz:  { label: 'BRONZ',  c1: '#cd7c2f', c2: '#9a5d20', c3: '#e8924a', bg: '#100b06' },
};

function getCardType(rating) {
  if (!rating)      return CARD_TYPES.bronz;
  if (rating >= 90) return CARD_TYPES.efsane;
  if (rating >= 85) return CARD_TYPES.altin;
  if (rating >= 75) return CARD_TYPES.gumus;
  return CARD_TYPES.bronz;
}

// ── Ego Başlığı ───────────────────────────────────────────────────────────────

const STAT_TITLES = [
  { e: '🎯', t: 'OYUNUN MİMARI'   },
  { e: '🚀', t: 'GOL MAKİNESİ'    },
  { e: '🪄', t: 'SAHANIN CAMBAZI' },
  { e: '🧱', t: 'DEMİR DUVAR'     },
  { e: '⚡', t: 'SAHANIN MOTORU'  },
  { e: '🦍', t: 'FİZİK CANAVARI'  },
  { e: '🤝', t: 'TAKIMIN KALBİ'  },
];

function egoTitle(pd, rd, rank) {
  if (rd && Array.isArray(rd.players)) {
    if (rank === 0) return { e: '👑', t: 'SAHANIN KRALİ'      };
    if (rank === 1) return { e: '🌟', t: 'SEZONUN YILDIZI'    };
    if (rank === 2) return { e: '🏅', t: 'ELİT OYUNCU'        };
    if (rank === 3) return { e: '🔥', t: 'SEZONUN SÜRPRİZİ'  };
    if (rank === 4) return { e: '💎', t: 'GİZLİ YETENEK'      };
  }
  if (!pd) return { e: '⭐', t: 'PİTCHRANK OYUNCUSU' };

  const avgs   = CRITERIA.map(cr => criteriaAvg(pd, cr));
  const maxIdx = avgs.indexOf(Math.max(...avgs));
  if (avgs[maxIdx] >= 8.5) return STAT_TITLES[maxIdx];

  if (avgs.filter(a => a >= 7.5).length >= 2) return { e: '💥', t: 'ÇIFT TEHLIKE' };

  const att = attCount(pd);
  if (att >= 12) return { e: '🎖️', t: 'EFSANELER LIGINDEN' };
  if (att >= 8)  return { e: '🏃', t: 'SAHANIN DİNAMOSU'   };

  const r = pd.genelOrt ? Math.round(pd.genelOrt * 10) : 0;
  if (r >= 85) return { e: '🔥', t: 'ELİT PERFORMANS'       };
  if (r >= 78) return { e: '💫', t: 'FORM OYUNCUSU'         };
  if (r >= 72) return { e: '📈', t: 'YÜKSELİŞTEKİ YILDIZ'  };
  if (r >= 65) return { e: '🐺', t: 'SAHADA KURT'           };
  return              { e: '💪', t: 'SAVAŞÇI RUHLU'          };
}

// ── Takım İçi Stat Sıralaması ─────────────────────────────────────────────────

function teamStatRanks(pd, rd) {
  if (!pd || !rd || !Array.isArray(rd.players)) return CRITERIA.map(() => -1);
  return CRITERIA.map(cr => {
    const mine = criteriaAvg(pd, cr);
    if (!mine) return -1;
    return rd.players.filter(p => p.name !== pd.name && criteriaAvg(p, cr) > mine).length;
  });
}

// ── Kişisel Rozetler ──────────────────────────────────────────────────────────

const STAT_BEST_LABELS = [
  { e: '🎯', t: 'PAS KRALI'        },
  { e: '🚀', t: 'ŞUT MAKİNESİ'     },
  { e: '🪄', t: 'DRİBLİNG DEHASI'  },
  { e: '🧱', t: 'SAVUNMA DUVARI'   },
  { e: '⚡', t: 'EN HIZLI OYUNCU' },
  { e: '🦍', t: 'FİZİK CANAVARI'  },
  { e: '🤝', t: 'TAKIM RUHU'       },
];

function personalBadges(pd, rd, statRanks) {
  const result = [];
  if (!pd) return result;

  const bestStatIdx = statRanks.indexOf(0);
  if (bestStatIdx >= 0) result.push(STAT_BEST_LABELS[bestStatIdx]);

  const myAtt = attCount(pd);
  if (rd && Array.isArray(rd.players)) {
    const maxAtt     = Math.max(...rd.players.map(p => attCount(p)));
    const totalWeeks = Array.isArray(rd.weeks) ? rd.weeks.length : 0;
    if (myAtt > 0 && myAtt >= maxAtt && totalWeeks >= 4) {
      result.push({ e: '💯', t: 'EN SADIK OYUNCU' });
    } else if (totalWeeks >= 5 && myAtt === totalWeeks) {
      result.push({ e: '🔥', t: 'TAM DEVAM' });
    }
  }

  if (pd.weeklyGenels && Array.isArray(pd.weeklyGenels)) {
    const all = pd.weeklyGenels.filter(v => v != null);
    if (all.length >= 4) {
      const overall = all.reduce((a, b) => a + b, 0) / all.length;
      const recent  = all.slice(-3).reduce((a, b) => a + b, 0) / 3;
      if (recent >= overall * 1.06) {
        result.push({ e: '📈', t: 'YÜKSELIŞ TRENDİ' });
      } else if (calcStdDev(pd) < 0.38 && all.length >= 5) {
        result.push({ e: '🔒', t: 'İSTİKRAR ABİDESİ' });
      }
    }
  }

  if (!result.find(b => b.t === 'YÜKSELIŞ TRENDİ') && pd.weeklyGenels) {
    const all = pd.weeklyGenels.filter(v => v != null);
    if (all.length >= 3) {
      const peak = Math.max(...all);
      if (all.slice(-3).includes(peak)) result.push({ e: '⭐', t: 'KİŞİSEL REKOR' });
    }
  }

  if (result.length < 2 && myAtt >= 10) result.push({ e: '🎖️', t: 'TECRÜBE ABİDESİ' });
  else if (result.length < 2 && myAtt >= 6) result.push({ e: '💪', t: 'DENEYİMLİ OYUNCU' });

  return result.slice(0, 3);
}

// ── Ana Oluşturucu ────────────────────────────────────────────────────────────

async function generateCard(playerName, pd, pObj, rd) {
  await document.fonts.ready;

  const DPR = 2, W = 540, H = 960;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR; canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const teamId = CURRENT_TEAM || Object.keys(TEAM_CONFIG)[0];
  const team   = TEAM_CONFIG[teamId] || TEAM_CONFIG[Object.keys(TEAM_CONFIG)[0]];
  const tc     = team.color;
  const { rv, gv, bv } = hexRgb(tc);

  const wAvg   = pd && pObj ? posRating(pd, pObj) : null;
  const rawOvr = wAvg !== null ? wAvg : (pd?.genelOrt ?? null);
  const rating = rawOvr !== null ? Math.min(99, Math.round(rawOvr * 10)) : null;
  const ct     = getCardType(rating);
  const ctr    = hexRgb(ct.c1);
  const fn     = (sz, wt) => `${wt} ${sz}px Inter,system-ui,sans-serif`;

  const rank      = getSeasonRank(pd, rd);
  const statRanks = teamStatRanks(pd, rd);
  const badges    = personalBadges(pd, rd, statRanks);

  // ── ARKA PLAN ────────────────────────────────────────────────────────────────
  ctx.fillStyle = ct.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.022)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0);  ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y);  ctx.lineTo(W, y); }
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = ct.c1;
  ctx.lineWidth = 1.5;
  const diam = (cx, cy, s) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy);
    ctx.closePath(); ctx.stroke();
  };
  diam(28, 80, 22); diam(W - 28, 80, 22);
  diam(28, H - 80, 18); diam(W - 28, H - 80, 18);
  ctx.restore();

  for (let i = 0; i < 32; i++) {
    const a  = i * 137.508 * Math.PI / 180;
    const d  = Math.sqrt(i / 32) * 520;
    const px = W / 2 + Math.cos(a) * d, py = H / 2 + Math.sin(a) * d;
    ctx.globalAlpha = 0.08 + (i % 4) * 0.04;
    ctx.beginPath();
    ctx.arc(px, py, i % 6 === 0 ? 2.2 : i % 4 === 0 ? 1.5 : 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const g1 = ctx.createRadialGradient(W / 2, 215, 0, W / 2, 215, 310);
  g1.addColorStop(0,    `rgba(${rv},${gv},${bv},0.52)`);
  g1.addColorStop(0.45, `rgba(${rv},${gv},${bv},0.18)`);
  g1.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, 520);

  const g2 = ctx.createRadialGradient(W / 2, 215, 0, W / 2, 215, 240);
  g2.addColorStop(0, `rgba(${ctr.rv},${ctr.gv},${ctr.bv},0.32)`);
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 520);

  const g3 = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 260);
  g3.addColorStop(0, `rgba(${rv},${gv},${bv},0.20)`);
  g3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g3; ctx.fillRect(0, H - 260, W, 260);

  [
    [0.08, 0.12, 85], [0.90, 0.09, 70], [0.15, 0.72, 78],
    [0.87, 0.65, 72], [0.06, 0.42, 52], [0.92, 0.38, 48],
  ].forEach(([bx, by, br]) => {
    const bg = ctx.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, br);
    bg.addColorStop(0, `rgba(${rv},${gv},${bv},0.10)`);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(bx * W - br, by * H - br, br * 2, br * 2);
  });

  ctx.save();
  ctx.shadowColor = ct.c1; ctx.shadowBlur = 16; ctx.globalAlpha = 0.55;
  ctx.fillStyle = ct.c1;
  [
    [0.10, 0.16], [0.87, 0.21], [0.05, 0.52], [0.93, 0.46],
    [0.22, 0.87], [0.78, 0.83], [0.44, 0.06], [0.67, 0.92],
  ].forEach(([bx, by]) => {
    ctx.beginPath(); ctx.arc(bx * W, by * H, 2.0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.translate(W * 0.80, 0); ctx.rotate(-0.30);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-28, -100, 52, H + 200);
  ctx.fillRect(38,  -100, 26, H + 200);
  ctx.restore();

  // ── ÜST BAR ──────────────────────────────────────────────────────────────────
  const topGrd = ctx.createLinearGradient(0, 0, W, 0);
  topGrd.addColorStop(0,    ct.c1 + '00');
  topGrd.addColorStop(0.25, ct.c1);
  topGrd.addColorStop(0.5,  ct.c3);
  topGrd.addColorStop(0.75, ct.c1);
  topGrd.addColorStop(1,    ct.c1 + '00');
  ctx.fillStyle = topGrd;
  ctx.fillRect(0, 0, W, 5);
  ctx.fillRect(0, H - 5, W, 5);

  ctx.textAlign = 'center';
  ctx.font = fn(12, 900);
  ctx.fillStyle = ct.c1;
  ctx.fillText(ct.label, W / 2, 26);

  ctx.font = fn(10, 700);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ PITCHRANK', 24, 26);
  ctx.textAlign = 'right';
  ctx.fillText(`${team.emoji} ${team.name.toUpperCase()}`, W - 24, 26);

  const topSep = ctx.createLinearGradient(24, 0, W - 24, 0);
  topSep.addColorStop(0,   'rgba(255,255,255,0)');
  topSep.addColorStop(0.5, ct.c1 + '50');
  topSep.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.strokeStyle = topSep; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, 34); ctx.lineTo(W - 24, 34); ctx.stroke();

  // ── FOTOĞRAF ──────────────────────────────────────────────────────────────────
  const [photoImg, fallImg] = await Promise.all([
    loadImg(getPlayerPhoto(playerName)),
    loadImg('assets/images/icon-192.png'),
  ]);
  const img = photoImg || fallImg;
  const CX = W / 2, CY = 218, CR = 108;

  ctx.save();
  ctx.shadowColor = ct.c1; ctx.shadowBlur = 28;
  ctx.strokeStyle = ct.c1; ctx.lineWidth = 2.5;
  [[CR + 22, 0.10], [CR + 12, 0.22], [CR + 5, 0.48]].forEach(([r, a]) => {
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.restore();

  const ringGrd = ctx.createLinearGradient(CX - CR, CY - CR, CX + CR, CY + CR);
  ringGrd.addColorStop(0,   ct.c1);
  ringGrd.addColorStop(0.5, ct.c3);
  ringGrd.addColorStop(1,   ct.c2);
  ctx.beginPath(); ctx.arc(CX, CY, CR + 3, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrd; ctx.lineWidth = 5; ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, CR, 0, Math.PI * 2); ctx.clip();
  if (img) {
    const ar = img.naturalWidth / img.naturalHeight;
    let dw = CR * 2, dh = CR * 2;
    if (ar > 1) dw = dh * ar; else dh = dw / ar;
    ctx.drawImage(img, CX - dw / 2, CY - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = `rgba(${rv},${gv},${bv},0.4)`;
    ctx.fillRect(CX - CR, CY - CR, CR * 2, CR * 2);
  }
  ctx.restore();

  // ── OVR ──────────────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  if (rating !== null) {
    const rStr = String(rating);
    ctx.font = fn(112, 900);
    ctx.save();
    ctx.shadowColor = ct.c1; ctx.shadowBlur = 60;
    ctx.fillStyle = ct.c1;
    ctx.fillText(rStr, W / 2, 374);
    ctx.restore();
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rStr, W / 2, 374);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ct.c1; ctx.font = fn(11, 800);
    ctx.fillText('OVR', W / 2, 393);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = fn(112, 900);
    ctx.fillText('—', W / 2, 374);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = fn(11, 800);
    ctx.fillText('HENÜZ PUAN YOK', W / 2, 393);
  }

  // ── EGO BAŞLIĞI ───────────────────────────────────────────────────────────────
  const ego  = egoTitle(pd, rd, rank);
  const EGO_Y = 422;

  ctx.font = fn(13, 900);
  const egoFull = `${ego.e}  ${ego.t}`;
  const egoW    = ctx.measureText(egoFull).width;
  const lineLen = (W - egoW - 100) / 2;

  const lGrd = ctx.createLinearGradient(40, 0, 40 + lineLen, 0);
  lGrd.addColorStop(0, 'rgba(255,255,255,0)'); lGrd.addColorStop(1, ct.c1 + 'cc');
  ctx.strokeStyle = lGrd; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, EGO_Y - 5); ctx.lineTo(40 + lineLen, EGO_Y - 5); ctx.stroke();

  const rGrd = ctx.createLinearGradient(W - 40 - lineLen, 0, W - 40, 0);
  rGrd.addColorStop(0, ct.c1 + 'cc'); rGrd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = rGrd;
  ctx.beginPath(); ctx.moveTo(W - 40 - lineLen, EGO_Y - 5); ctx.lineTo(W - 40, EGO_Y - 5); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = ct.c1;
  ctx.fillText(egoFull, W / 2, EGO_Y);

  // ── İSİM + POZİSYON ──────────────────────────────────────────────────────────
  const NAME_Y = 458;
  let nfs = 42;
  ctx.font = fn(nfs, 900);
  while (ctx.measureText(playerName.toUpperCase()).width > W - 56 && nfs > 24) {
    nfs -= 2; ctx.font = fn(nfs, 900);
  }
  ctx.save();
  ctx.shadowColor = `rgba(${rv},${gv},${bv},0.8)`; ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(playerName.toUpperCase(), W / 2, NAME_Y);
  ctx.restore();

  const posText = pObj ? posLabel(pObj) : '';
  if (posText) {
    ctx.fillStyle = `rgba(${rv},${gv},${bv},0.9)`;
    ctx.font = fn(12, 700);
    ctx.fillText(posText.toUpperCase(), W / 2, NAME_Y + 22);
  }

  // ── KİŞİSEL ROZET ŞERİDİ ─────────────────────────────────────────────────────
  const yShift = badges.length > 0 ? 40 : 0;
  if (badges.length) {
    ctx.font = fn(9.5, 800);
    const gap = 8, pH = 8, pV = 13;
    const texts  = badges.map(b => `${b.e} ${b.t}`);
    const widths = texts.map(t => ctx.measureText(t).width + pH * 2);
    const totalW = widths.reduce((a, c) => a + c, 0) + gap * (badges.length - 1);
    let bx = (W - totalW) / 2;
    const BY = NAME_Y + 46;
    badges.forEach((badge, i) => {
      const bw = widths[i], bh = pV * 2;
      rrect(ctx, bx, BY - pV, bw, bh, bh / 2);
      ctx.fillStyle = `rgba(${ctr.rv},${ctr.gv},${ctr.bv},0.16)`; ctx.fill();
      ctx.strokeStyle = ct.c1 + '55'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = ct.c1; ctx.textAlign = 'left';
      ctx.fillText(texts[i], bx + pH, BY);
      bx += bw + gap;
    });
    ctx.textAlign = 'center';
  }

  // ── AYIRICI ───────────────────────────────────────────────────────────────────
  const sep = (y) => {
    const sg = ctx.createLinearGradient(60, 0, W - 60, 0);
    sg.addColorStop(0,   'rgba(255,255,255,0)');
    sg.addColorStop(0.5, ct.c1 + '70');
    sg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.strokeStyle = sg; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
  };
  sep(490 + yShift);

  // ── STAT GRID (4 + 3) ─────────────────────────────────────────────────────────
  const avgs = CRITERIA.map(cr => criteriaAvg(pd, cr));
  const vals = avgs.map(a => a > 0 ? Math.min(99, Math.round(a * 10)) : 0);

  const sColor = (v) =>
    v >= 88 ? ct.c1 :
    v >= 78 ? '#f3f4f6' :
    v >= 65 ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.3)';

  const drawStatCell = (i, cx, topY, cellH) => {
    const v     = vals[i];
    const isNo1 = statRanks[i] === 0 && v > 0;

    if (isNo1) {
      rrect(ctx, cx - 30, topY + 6, 60, cellH - 12, 10);
      ctx.fillStyle = `rgba(${ctr.rv},${ctr.gv},${ctr.bv},0.18)`; ctx.fill();
      ctx.strokeStyle = ct.c1 + '50'; ctx.lineWidth = 0.8; ctx.stroke();
    }

    ctx.textAlign = 'center';
    if (isNo1) {
      ctx.font = fn(9, 900); ctx.fillStyle = ct.c1;
      ctx.fillText('# 1', cx, topY + 14);
    }

    ctx.font = fn(44, 900);
    if (v > 0) {
      ctx.save();
      ctx.shadowColor = ct.c1;
      ctx.shadowBlur  = isNo1 ? 28 : v >= 88 ? 18 : 0;
      ctx.fillStyle   = isNo1 ? ct.c1 : sColor(v);
      ctx.fillText(String(v), cx, topY + 50);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('—', cx, topY + 50);
    }

    ctx.font      = fn(10, 800);
    ctx.fillStyle = isNo1 ? ct.c1 : (v >= 88 ? ct.c1 : 'rgba(255,255,255,0.38)');
    ctx.fillText(CRITERIA_ABBR[i], cx, topY + cellH - 8);

    if (v >= 85) {
      ctx.save();
      ctx.shadowColor = ct.c1; ctx.shadowBlur = 10; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(cx, topY + cellH - 20, 3, 0, Math.PI * 2);
      ctx.fillStyle = ct.c1; ctx.fill();
      ctx.restore();
    }
  };

  const CW4 = W / 4, CW3 = W / 3, CELL_H = 92;
  const TOP_SY = 498 + yShift, BOT_SY = TOP_SY + CELL_H + 14;

  for (let i = 0; i < 4; i++) drawStatCell(i, CW4 * i + CW4 / 2, TOP_SY, CELL_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(CW4 * (i + 1), TOP_SY + 10);
    ctx.lineTo(CW4 * (i + 1), TOP_SY + CELL_H - 10);
  }
  ctx.stroke();

  sep(BOT_SY - 6);

  for (let i = 0; i < 3; i++) drawStatCell(4 + i, CW3 * i + CW3 / 2, BOT_SY, CELL_H);
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    ctx.moveTo(CW3 * (i + 1), BOT_SY + 10);
    ctx.lineTo(CW3 * (i + 1), BOT_SY + CELL_H - 10);
  }
  ctx.stroke();

  const AFTER_STATS = BOT_SY + CELL_H + 12;
  sep(AFTER_STATS);

  // ── SIRALAMA ROZETI ───────────────────────────────────────────────────────────
  const RANK_Y = AFTER_STATS + 18;

  if (rank >= 0 && pd) {
    ctx.textAlign = 'center';
    if (rank === 0) {
      ctx.save(); ctx.shadowColor = ct.c1; ctx.shadowBlur = 24;
      ctx.font = fn(17, 900); ctx.fillStyle = ct.c1;
      ctx.fillText('🏆  SEZONUN LİDERİ', W / 2, RANK_Y + 28);
      ctx.restore();
    } else {
      const lbl = `# ${rank + 1}  SIRALAMA`;
      ctx.font = fn(14, 800);
      const bw = ctx.measureText(lbl).width + 36;
      rrect(ctx, W / 2 - bw / 2, RANK_Y + 10, bw, 30, 15);
      ctx.fillStyle = `rgba(${ctr.rv},${ctr.gv},${ctr.bv},0.18)`; ctx.fill();
      ctx.strokeStyle = ct.c1 + '80'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = ct.c1; ctx.fillText(lbl, W / 2, RANK_Y + 30);
    }
  }

  // ── SEZON ÖZETİ ───────────────────────────────────────────────────────────────
  const SUM_Y     = AFTER_STATS + 74;
  const attendance = attCount(pd);
  const weeks = rd && Array.isArray(rd.weeks) ? rd.weeks : [];
  const bestScore = (() => {
    if (!pd || !Array.isArray(pd.weeklyGenels)) return null;
    const scores = pd.weeklyGenels.map((v, i) => {
      if (v == null) return null;
      const week = weeks[i];
      const kr = (week && pd.weeklyKriterler?.[week]) || {};
      const swd = { weeklyKriterler: week ? { [week]: kr } : {}, weeklyGenels: [v] };
      const w = posRating(swd, pObj || { pos: ['OMO'] });
      return w !== null ? Math.min(99, Math.round(w * 10)) : Math.round(v * 10);
    }).filter(v => v !== null);
    return scores.length ? Math.max(...scores) : null;
  })();

  const summaries = [
    { lbl: 'KATILIM',   val: attendance ? `${attendance} MAÇ` : '—' },
    { lbl: 'EN YÜKSEK', val: bestScore  ? String(bestScore)   : '—' },
    { lbl: 'GENEL ORT', val: rating     ? String(rating)      : '—' },
  ];

  const SW = W / 3;
  summaries.forEach(({ lbl, val }, i) => {
    const cx = SW * i + SW / 2;
    ctx.textAlign = 'center';
    ctx.font = fn(22, 900);
    ctx.fillStyle = ct.c1;
    ctx.fillText(val, cx, SUM_Y + 28);
    ctx.font = fn(9, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(lbl, cx, SUM_Y + 44);
    if (i < 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SW * (i + 1), SUM_Y + 4); ctx.lineTo(SW * (i + 1), SUM_Y + 48);
      ctx.stroke();
    }
  });

  sep(SUM_Y + 58);

  // ── ALT MARKA ─────────────────────────────────────────────────────────────────
  const weekLbl = rd?.weeks?.at?.(-1) ?? '';
  ctx.textAlign = 'center';
  ctx.font = fn(10, 600);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  if (weekLbl) ctx.fillText(weekLbl, W / 2, H - 38);
  ctx.fillText('spor.yagserakgun.com', W / 2, H - 22);

  return { canvas, rating };
}

// ── Paylaş ────────────────────────────────────────────────────────────────────

let _pending = null; // { canvas, name, caption } | null

export async function shareProfileCard() {
  const playerName = state.currentRater;
  if (!playerName) { showToast('Önce kimliğini seç'); return; }

  const rd   = state.resultData;
  const pd   = rd && Array.isArray(rd.players)
    ? rd.players.find(p => p.name === playerName) : null;
  const pObj = Array.isArray(state.players)
    ? state.players.find(p => p.name === playerName) : null;

  showToast('Kart oluşturuluyor...');

  let result;
  try { result = await generateCard(playerName, pd, pObj, rd); }
  catch (e) { showToast('Kart oluşturulamadı', true); console.error(e); return; }

  const { canvas, rating: ovr } = result;
  const seasonRank = getSeasonRank(pd, rd);
  const pos        = pObj ? posLabel(pObj) : '';
  const players    = rd && Array.isArray(rd.players) ? rd.players : [];
  const rankIdx    = players.findIndex(p => p.name === playerName);
  const rank       = rankIdx >= 0 ? rankIdx + 1 : null;
  const total      = players.length || null;
  const ego        = egoTitle(pd, rd, seasonRank);
  const appUrl     = window.location.origin;

  const rankLine = rank ? `🏆 ${rank}. sıra${total ? '/' + total : ''}` : '';
  const statLine = [ovr ? `${ovr} OVR` : '', pos, rankLine].filter(Boolean).join(' · ');
  const caption  = [
    `⚽ ${playerName} — PitchRank`,
    `${ego.e} ${ego.t}`,
    statLine ? `📊 ${statLine}` : '',
    '',
    `👇 Kendi kartına bak: ${appUrl}`,
  ].filter(l => l !== undefined).join('\n');

  _pending = { canvas, name: playerName, caption };

  const img = document.getElementById('shareCardPreviewImg');
  if (img) img.src = canvas.toDataURL('image/png');
  document.getElementById('shareCardPreviewBg')?.classList.add('open');
}

export async function doShareCard() {
  if (!_pending) return;
  const { canvas, name, caption } = _pending;
  closeSharePreview();

  canvas.toBlob(async (blob) => {
    const file = new File([blob], `pitchrank-${name}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${name} — PitchRank`, text: caption });
      } catch (e) { if (e.name !== 'AbortError') download(blob, name); }
    } else {
      download(blob, name);
      showToast('Kart indirildi — Story\'ye ekleyebilirsin!');
    }
  }, 'image/png');
}

export function closeSharePreview() {
  document.getElementById('shareCardPreviewBg')?.classList.remove('open');
  const img = document.getElementById('shareCardPreviewImg');
  if (img) img.src = '';
  _pending = null;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = `pitchrank-${name}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
