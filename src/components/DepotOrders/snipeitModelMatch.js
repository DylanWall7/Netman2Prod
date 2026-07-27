function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function isBoundaryContainment(shorter, longer) {
  const idx = longer.indexOf(shorter);
  if (idx === -1) return false;
  const isBoundary = (ch) => ch === undefined || !/[A-Z0-9]/.test(ch);
  return isBoundary(longer[idx - 1]) && isBoundary(longer[idx + shorter.length]);
}

function scoreCandidate(productCode, model) {
  const code = normalize(productCode);
  const fields = [normalize(model.model_number), normalize(model.name)].filter(Boolean);
  let best = 0;
  for (const field of fields) {
    let score = similarity(code, field);
    const [shorter, longer] = code.length <= field.length ? [code, field] : [field, code];
    // Only treat one as "containing" the other when the extra characters start at a
    // token boundary (e.g. "AP47-US" contains "AP47"). Otherwise a shorter model number
    // that happens to be a raw prefix (e.g. "AP47" inside "AP47D-US") isn't the same
    // device and shouldn't get boosted just for sharing a prefix.
    if (isBoundaryContainment(shorter, longer)) score = Math.max(score, 0.85);
    best = Math.max(best, score);
  }
  return best;
}

export function findExactModelMatch(productCode, models) {
  const code = normalize(productCode);
  if (!code) return null;
  return models.find((m) => normalize(m.model_number) === code || normalize(m.name) === code) || null;
}

export function suggestModelMatches(productCode, models, limit = 5) {
  return models
    .map((model) => ({ model, score: scoreCandidate(productCode, model) }))
    .filter((c) => c.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
