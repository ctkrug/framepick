// Sensitivity → cut-threshold mapping.
//
// Users think in "more vs. fewer keyframes", not in luma-distance metrics. The UI exposes a
// single 0–100 slider; this pure module maps that to the distance threshold `scenes.detectCuts`
// compares against. Higher sensitivity = a LOWER threshold = more cuts survive = more keyframes.
//
// The mapping is linear and clamped so the ends of the track are meaningful:
//   sensitivity 0   → THRESHOLD_MAX (only the hardest cuts)
//   sensitivity 100 → THRESHOLD_MIN (almost every visible change)

/** Threshold at sensitivity 0 — only large, unambiguous scene changes register. */
export const THRESHOLD_MAX = 0.3;
/** Threshold at sensitivity 100 — subtle changes register as cuts too. */
export const THRESHOLD_MIN = 0.03;
/** Default slider position — a balanced middle that favours clean, distinct shots. */
export const DEFAULT_SENSITIVITY = 55;

/**
 * Clamp a slider value to the 0–100 track.
 * @param {number} sensitivity
 * @returns {number}
 */
export function clampSensitivity(sensitivity) {
  if (!Number.isFinite(sensitivity)) return DEFAULT_SENSITIVITY;
  return Math.min(100, Math.max(0, sensitivity));
}

/**
 * Map a 0–100 sensitivity to a cut threshold in [THRESHOLD_MIN, THRESHOLD_MAX].
 * Monotonically decreasing: more sensitivity yields a smaller threshold (more keyframes).
 * @param {number} sensitivity 0..100 (clamped)
 * @returns {number} threshold for scenes.detectCuts
 */
export function thresholdForSensitivity(sensitivity) {
  const s = clampSensitivity(sensitivity);
  return THRESHOLD_MAX + (THRESHOLD_MIN - THRESHOLD_MAX) * (s / 100);
}
