export const FORECAST_ALPHA = 0.4;
export const FORECAST_BETA  = 0.2;

// Holt-Winters double exponential smoothing — captures level + trend.
// Suited for short, non-seasonal series like weekly player ratings.
export function forecastHoltWinters(series, periods = 3, alpha = FORECAST_ALPHA, beta = FORECAST_BETA) {
  const cleaned = (Array.isArray(series) ? series : [])
    .filter(v => v != null && !isNaN(v))
    .map(v => +v);
  if (cleaned.length < 3) return [];
  let level = cleaned[0];
  let trend = cleaned[1] - cleaned[0];
  for (let i = 1; i < cleaned.length; i++) {
    const prev = level;
    level = alpha * cleaned[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  const out = [];
  for (let k = 1; k <= periods; k++) {
    out.push(level + k * trend);
  }
  return out;
}
