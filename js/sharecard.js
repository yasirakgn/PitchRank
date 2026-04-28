import { CRITERIA, TEAM_CONFIG, POS } from './config.js';
import { state } from './state.js';
import { getPlayerPhoto, normPos, showToast } from './utils.js';

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function hexRgb(hex) {
  return {
    rv: parseInt(hex.slice(1, 3), 16),
    gv: parseInt(hex.slice(3, 5), 16),
    bv: parseInt(hex.slice(5, 7), 16),
  };
}

function criteriaAvg(playerData, criterion) {
  if (!playerData || !playerData.weeklyKriterler) return 0;
  const vals = [];
  Object.values(playerData.weeklyKriterler).forEach(wk => {
    if (wk && wk[criterion] != null) vals.push(+wk[criterion]);
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function loadImg(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function hSep(ctx, y, W, rv, gv, bv) {
  const gr = ctx.createLinearGradient(60, 0, W - 60, 0);
  gr.addColorStop(0,   'rgba(255,255,255,0)');
  gr.addColorStop(0.5, `rgba(${rv},${gv},${bv},0.45)`);
  gr.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.strokeStyle = gr;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
}

// ── Kart Üretici ──────────────────────────────────────────────────────────────

async function generateCard(playerName, playerData, pObj, resultData) {
  const DPR = 2;
  const W = 540, H = 960;
  const canvas = document.createElement('canvas');
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const teamId = sessionStorage.getItem('pitchrank_selected_team') || 'haldunalagas';
  const team = TEAM_CONFIG[teamId] || TEAM_CONFIG.haldunalagas;
  const tc = team.color;
  const { rv, gv, bv } = hexRgb(tc);
  const fn = (sz, wt) => `${wt} ${sz}px system-ui,-apple-system,sans-serif`;

  // ── ARKA PLAN ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#07080e';
  ctx.fillRect(0, 0, W, H);

  // Çok ince grid dokusu
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Sağ üst köşe dekoratif çizgi
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = tc;
  ctx.lineWidth = 110;
  ctx.beginPath(); ctx.moveTo(W + 20, -20); ctx.lineTo(W - 190, 190); ctx.stroke();
  ctx.restore();

  // Fotoğraf arkası büyük renk glow
  const grd1 = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 280);
  grd1.addColorStop(0,   `rgba(${rv},${gv},${bv},0.42)`);
  grd1.addColorStop(0.5, `rgba(${rv},${gv},${bv},0.14)`);
  grd1.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grd1;
  ctx.fillRect(0, 0, W, 480);

  // Alt glow
  const grd2 = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 240);
  grd2.addColorStop(0,   `rgba(${rv},${gv},${bv},0.18)`);
  grd2.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grd2;
  ctx.fillRect(0, H - 240, W, 240);

  // Üst kenar accent bar
  ctx.fillStyle = tc;
  ctx.fillRect(0, 0, W, 4);

  // Dış çerçeve
  ctx.strokeStyle = `rgba(${rv},${gv},${bv},0.28)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // ── ÜST ÇUBUK ────────────────────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.fillStyle = tc;
  ctx.font = fn(15, 900);
  ctx.fillText('⚡', 28, 52);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = fn(12, 900);
  ctx.fillText('PITCHRANK', 50, 52);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = fn(12, 700);
  ctx.fillText(`${team.emoji} ${team.name.toUpperCase()}`, W - 28, 52);

  const topSep = ctx.createLinearGradient(28, 0, W - 28, 0);
  topSep.addColorStop(0,   'rgba(255,255,255,0)');
  topSep.addColorStop(0.5, `rgba(${rv},${gv},${bv},0.38)`);
  topSep.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.strokeStyle = topSep;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(28, 66); ctx.lineTo(W - 28, 66); ctx.stroke();

  // ── FOTOĞRAF ─────────────────────────────────────────────────────────────
  const photoSrc = getPlayerPhoto(playerName);
  const [photoImg, fallImg] = await Promise.all([
    loadImg(photoSrc),
    loadImg('assets/images/icon-192.png'),
  ]);
  const img = photoImg || fallImg;

  const CX = W / 2, CY = 204, CR = 92;

  // Glow halkası
  ctx.save();
  ctx.shadowColor = tc;
  ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(CX, CY, CR + 4, 0, Math.PI * 2);
  ctx.strokeStyle = tc;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath(); ctx.arc(CX, CY, CR + 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Fotoğraf clip
  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, CR, 0, Math.PI * 2); ctx.clip();
  if (img) {
    const ar = img.naturalWidth / img.naturalHeight;
    let dw = CR * 2, dh = CR * 2;
    if (ar > 1) dw = dh * ar; else dh = dw / ar;
    ctx.drawImage(img, CX - dw / 2, CY - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = `rgba(${rv},${gv},${bv},0.35)`;
    ctx.fillRect(CX - CR, CY - CR, CR * 2, CR * 2);
  }
  ctx.restore();

  // ── GENEL PUAN ────────────────────────────────────────────────────────────
  const genelOrt = playerData?.genelOrt ?? null;
  const rating = genelOrt !== null ? Math.min(99, Math.round(genelOrt * 10)) : null;

  if (rating !== null) {
    ctx.textAlign = 'center';
    // Glow katmanı
    ctx.save();
    ctx.shadowColor = tc;
    ctx.shadowBlur = 44;
    ctx.fillStyle = tc;
    ctx.font = fn(118, 900);
    ctx.fillText(String(rating), W / 2, 362);
    ctx.restore();
    // Net üst katman
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#ffffff';
    ctx.font = fn(118, 900);
    ctx.fillText(String(rating), W / 2, 362);
    ctx.globalAlpha = 1;

    ctx.fillStyle = `rgba(${rv},${gv},${bv},0.7)`;
    ctx.font = fn(11, 800);
    ctx.fillText('GENEL PUAN', W / 2, 382);
  }

  // ── İSİM ─────────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  let nfs = 38;
  ctx.font = fn(nfs, 900);
  while (ctx.measureText(playerName).width > W - 80 && nfs > 22) {
    nfs -= 2;
    ctx.font = fn(nfs, 900);
  }
  ctx.fillText(playerName, W / 2, 426);

  // ── POZİSYON + HAFTA PILL ────────────────────────────────────────────────
  const posArr  = pObj ? normPos(pObj) : [];
  const posText = posArr.map(k => POS[k] || k).join(' / ');
  const weekArr = resultData?.weeks;
  const weekLbl = Array.isArray(weekArr) && weekArr.length
    ? weekArr[weekArr.length - 1].replace(/\d{4}-/, '')
    : '';
  const pills = [posText, weekLbl].filter(Boolean);

  if (pills.length) {
    ctx.font = fn(11, 700);
    const pillH = 26, gap = 10;
    const pws = pills.map(t => ctx.measureText(t.toUpperCase()).width + 28);
    const totalW = pws.reduce((s, w) => s + w, 0) + gap * (pills.length - 1);
    let px = W / 2 - totalW / 2;
    pills.forEach((txt, i) => {
      const pw = pws[i];
      rrect(ctx, px, 440, pw, pillH, 13);
      ctx.fillStyle = i === 0 ? `rgba(${rv},${gv},${bv},0.22)` : 'rgba(255,255,255,0.07)';
      ctx.fill();
      ctx.strokeStyle = i === 0 ? `rgba(${rv},${gv},${bv},0.55)` : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle   = i === 0 ? tc : 'rgba(255,255,255,0.6)';
      ctx.textAlign   = 'center';
      ctx.font        = fn(11, 700);
      ctx.fillText(txt.toUpperCase(), px + pw / 2, 457);
      px += pw + gap;
    });
  }

  // ── KRİTER BARLARI ───────────────────────────────────────────────────────
  hSep(ctx, 484, W, rv, gv, bv);

  const BX = 44, BW = W - 88, RH = 46, SY = 500;
  const CLBLS = ['Pas', 'Şut', 'Dribling', 'Savunma', 'Hız/Kond.', 'Fizik', 'Takım Oyunu'];

  CRITERIA.forEach((cr, i) => {
    const avg  = criteriaAvg(playerData, cr);
    const pct  = avg > 0 ? Math.min(avg / 10, 1) : 0;
    const y    = SY + i * RH;

    ctx.textAlign = 'left';
    ctx.font      = fn(13, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(CLBLS[i], BX, y + 16);

    ctx.textAlign = 'right';
    ctx.font      = fn(15, 900);
    ctx.fillStyle = avg >= 8 ? tc : avg >= 6 ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.35)';
    ctx.fillText(avg > 0 ? avg.toFixed(1) : '—', BX + BW, y + 16);

    rrect(ctx, BX, y + 22, BW, 5, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();

    if (pct > 0) {
      rrect(ctx, BX, y + 22, BW * pct, 5, 3);
      const bg = ctx.createLinearGradient(BX, 0, BX + BW * pct, 0);
      bg.addColorStop(0, `rgba(${rv},${gv},${bv},0.45)`);
      bg.addColorStop(1, tc);
      ctx.fillStyle = bg;
      ctx.fill();
    }
  });

  // ── SIRALAMA ─────────────────────────────────────────────────────────────
  const FY = SY + CRITERIA.length * RH + 16;
  hSep(ctx, FY, W, rv, gv, bv);

  if (resultData && Array.isArray(resultData.players) && playerData) {
    const sorted = [...resultData.players]
      .filter(p => p.genelOrt != null)
      .sort((a, b) => b.genelOrt - a.genelOrt);
    const rank = sorted.findIndex(p => p.name === playerData.name);
    if (rank !== -1) {
      ctx.textAlign = 'center';
      if (rank === 0) {
        ctx.font      = fn(15, 800);
        ctx.fillStyle = tc;
        ctx.fillText('🏆  SEZONUN LİDERİ', W / 2, FY + 30);
      } else {
        const badgeTxt = `# ${rank + 1}  SIRALAMA`;
        ctx.font = fn(13, 800);
        const bw = ctx.measureText(badgeTxt).width + 32;
        rrect(ctx, W / 2 - bw / 2, FY + 12, bw, 28, 14);
        ctx.fillStyle  = `rgba(${rv},${gv},${bv},0.18)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rv},${gv},${bv},0.45)`;
        ctx.lineWidth   = 1; ctx.stroke();
        ctx.fillStyle   = tc;
        ctx.fillText(badgeTxt, W / 2, FY + 31);
      }
    }
  }

  // ── ALT MARKA ────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.font      = fn(11, 600);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillText('pitchrank.app', W / 2, H - 22);

  return canvas;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function shareProfileCard() {
  const playerName = state.currentRater;
  if (!playerName) { showToast('Önce kimliğini seç'); return; }

  const rd         = state.resultData;
  const playerData = rd && Array.isArray(rd.players)
    ? rd.players.find(p => p.name === playerName)
    : null;
  const pObj = Array.isArray(state.players)
    ? state.players.find(p => p.name === playerName)
    : null;

  showToast('Kart hazırlanıyor...');

  let canvas;
  try {
    canvas = await generateCard(playerName, playerData, pObj, rd);
  } catch (e) {
    showToast('Kart oluşturulamadı', true);
    console.error(e);
    return;
  }

  canvas.toBlob(async (blob) => {
    const file = new File([blob], `pitchrank-${playerName}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${playerName} — PitchRank` });
      } catch (e) {
        if (e.name !== 'AbortError') { downloadBlob(blob, playerName); }
      }
    } else {
      downloadBlob(blob, playerName);
      showToast('Kart indirildi — Story\'ye ekleyebilirsin!');
    }
  }, 'image/png');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = `pitchrank-${name}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
