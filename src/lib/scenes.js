// Scene segmentation + keyframe dedup — the decision layer on top of frame signatures.
//
// The decoder produces a stream of sampled frames, each with a time and a signature. This
// module answers two questions with pure functions (so they can be unit-tested without a
// browser):
//   1. Where are the cuts?      -> detectCuts / segmentScenes
//   2. Which frames represent   -> pickKeyframes / dedupeKeyframes
//      the video, without dupes?

import { signatureDistance } from "./signature.js";

/**
 * @typedef {Object} SampledFrame
 * @property {number} index    sampling index (0-based, monotonic)
 * @property {number} time     seconds
 * @property {Float32Array|number[]} signature
 */

/**
 * Adjacent-frame signature distances for a sequence of sampled frames.
 * Result length is `frames.length - 1`; entry i is dist(frame[i], frame[i+1]).
 * @param {SampledFrame[]} frames
 * @returns {number[]}
 */
export function adjacentDistances(frames) {
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    out.push(signatureDistance(frames[i - 1].signature, frames[i].signature));
  }
  return out;
}

/**
 * Indices (into `frames`) where a cut begins — i.e. the first frame of each new scene after
 * a spike in adjacent distance above `threshold`. Frame 0 always starts the first scene.
 *
 * @param {SampledFrame[]} frames
 * @param {number} threshold distance in [0,1]; higher = fewer, harder cuts
 * @returns {number[]} sorted scene-start indices, always beginning with 0
 */
export function detectCuts(frames, threshold) {
  if (frames.length === 0) return [];
  const cuts = [0];
  const dists = adjacentDistances(frames);
  for (let i = 0; i < dists.length; i++) {
    if (dists[i] >= threshold) cuts.push(i + 1);
  }
  return cuts;
}

/**
 * Turn scene-start indices into [start, end) segments spanning all frames.
 * @param {number[]} cuts sorted scene-start indices (as from detectCuts)
 * @param {number} frameCount total number of frames
 * @returns {{start:number,end:number}[]}
 */
export function segmentScenes(cuts, frameCount) {
  if (frameCount <= 0 || cuts.length === 0) return [];
  const segments = [];
  for (let i = 0; i < cuts.length; i++) {
    const start = cuts[i];
    const end = i + 1 < cuts.length ? cuts[i + 1] : frameCount;
    if (end > start) segments.push({ start, end });
  }
  return segments;
}

/**
 * Pick one representative keyframe per scene. Strategy: the frame nearest the *start* of the
 * scene (the shot's establishing frame), which is the most intuitive contact-sheet choice.
 *
 * @param {SampledFrame[]} frames
 * @param {number} threshold cut sensitivity in [0,1]
 * @returns {SampledFrame[]} keyframes in time order (one per detected scene)
 */
export function pickKeyframes(frames, threshold) {
  const cuts = detectCuts(frames, threshold);
  return segmentScenes(cuts, frames.length).map((seg) => frames[seg.start]);
}

/**
 * Collapse keyframes that are near-duplicates: too visually similar to a kept frame, or too
 * close in time to it. Greedy — walks in time order and keeps a frame only if it clears both
 * gaps against the most recently kept frame.
 *
 * @param {SampledFrame[]} keyframes in time order
 * @param {{ minDistance?: number, minGapSeconds?: number }} [opts]
 * @returns {SampledFrame[]}
 */
export function dedupeKeyframes(keyframes, opts = {}) {
  const { minDistance = 0.04, minGapSeconds = 0.5 } = opts;
  const kept = [];
  for (const kf of keyframes) {
    const last = kept[kept.length - 1];
    if (!last) {
      kept.push(kf);
      continue;
    }
    const farEnough = signatureDistance(last.signature, kf.signature) >= minDistance;
    const lateEnough = kf.time - last.time >= minGapSeconds;
    if (farEnough && lateEnough) kept.push(kf);
  }
  return kept;
}

/**
 * Full pipeline: detect scenes, pick one keyframe each, then dedup.
 * @param {SampledFrame[]} frames
 * @param {{ threshold?: number, minDistance?: number, minGapSeconds?: number }} [opts]
 * @returns {SampledFrame[]}
 */
export function extractKeyframes(frames, opts = {}) {
  const { threshold = 0.12, ...dedupeOpts } = opts;
  const picked = pickKeyframes(frames, threshold);
  return dedupeKeyframes(picked, dedupeOpts);
}
