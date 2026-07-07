// Analysis stats — the four numbers the readout shows: duration, frames sampled, scenes found,
// keyframes kept. Pure and derived from the cached sample stream so it recomputes instantly when
// the sensitivity slider moves (same reason scene detection is cheap: no re-decode).

import { detectCuts, segmentScenes, pickKeyframes, dedupeKeyframes } from "./scenes.js";

/**
 * @typedef {Object} Stats
 * @property {number} durationSeconds  clip length (last sample time, or an override)
 * @property {number} framesSampled    total analyzed frames
 * @property {number} scenesFound      segments at the current threshold
 * @property {number} keyframesKept    survivors after per-scene pick + dedup
 */

/**
 * Compute the stats readout from the cached samples at a given threshold.
 * Guarantees the display invariant `keyframesKept <= scenesFound <= framesSampled`.
 *
 * @param {import("./scenes.js").SampledFrame[]} samples in time order
 * @param {{ threshold?: number, minDistance?: number, minGapSeconds?: number, durationSeconds?: number }} [opts]
 * @returns {Stats}
 */
export function computeStats(samples, opts = {}) {
  const { threshold = 0.12, minDistance, minGapSeconds, durationSeconds } = opts;
  const framesSampled = samples.length;
  const scenesFound = segmentScenes(detectCuts(samples, threshold), framesSampled).length;
  const picked = pickKeyframes(samples, threshold);
  const keyframesKept = dedupeKeyframes(picked, { minDistance, minGapSeconds }).length;
  const duration =
    durationSeconds ?? (framesSampled > 0 ? samples[framesSampled - 1].time : 0);
  return { durationSeconds: duration, framesSampled, scenesFound, keyframesKept };
}
