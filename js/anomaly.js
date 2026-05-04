// Per-week outlier detection on aggregated weekly ratings.
// Anonymous: never references individual raters — only flags (player, week, score).
// Uses median + MAD (robust statistics) so the outlier itself doesn't skew the baseline.

const MIN_WEEKS = 5;
const MOD_Z_THRESHOLD = 3.5;
const MAD_FLOOR = 0.3;
const MAD_CONST = 0.6745;

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return 0;
  return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
}

function mad(arr, med) {
  const dev = arr.map(v => Math.abs(v - med));
  return median(dev);
}

export function detectAnomalies(resultData) {
  if (!resultData || !Array.isArray(resultData.players) || !Array.isArray(resultData.weeks)) return [];
  const out = [];
  resultData.players.forEach(p => {
    const series = Array.isArray(p.weeklyGenels) ? p.weeklyGenels : [];
    const valid = [];
    for (let i = 0; i < series.length; i++) {
      const v = series[i];
      if (v != null && !isNaN(+v)) valid.push({ v: +v, i });
    }
    if (valid.length < MIN_WEEKS) return;
    const vals = valid.map(x => x.v);
    const med = median(vals);
    const m = mad(vals, med);
    if (m < MAD_FLOOR) return;
    valid.forEach(({ v, i }) => {
      const modZ = MAD_CONST * (v - med) / m;
      if (Math.abs(modZ) >= MOD_Z_THRESHOLD) {
        out.push({
          player: p.name,
          week: resultData.weeks[i],
          score: v,
          median: med,
          modZ,
          direction: modZ > 0 ? 'high' : 'low',
        });
      }
    });
  });
  out.sort((a, b) => Math.abs(b.modZ) - Math.abs(a.modZ));
  return out;
}
