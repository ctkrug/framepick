// Frame sampling policy — pure decision logic shared by the decoder.
//
// Decoding every frame of a long clip would be wasteful and could exhaust memory: adjacent
// frames within a shot are nearly identical, so scene detection gains nothing from them. The
// sampler decides, per decoded frame, whether to KEEP it for analysis based on a target sample
// rate. Keeping this pure means the rate math is unit-tested without a real decoder.

/**
 * Minimum spacing, in seconds, between kept samples for a target rate.
 * @param {number} targetFps desired samples per second of video (must be > 0)
 * @returns {number} seconds between samples
 */
export function sampleInterval(targetFps) {
  if (!Number.isFinite(targetFps) || targetFps <= 0) {
    throw new RangeError("sampleInterval: targetFps must be a positive number");
  }
  return 1 / targetFps;
}

/**
 * Whether a frame at `time` should be kept, given the time of the last kept sample.
 * Always keeps the first frame (`lastKeptTime` null/undefined). Uses a small epsilon so
 * floating-point frame times land on the intended cadence.
 *
 * @param {number|null|undefined} lastKeptTime seconds, or nullish for "nothing kept yet"
 * @param {number} time current frame time in seconds
 * @param {number} targetFps target samples per second
 * @returns {boolean}
 */
export function shouldSample(lastKeptTime, time, targetFps) {
  if (lastKeptTime == null) return true;
  const interval = sampleInterval(targetFps);
  const EPS = 1e-6;
  return time - lastKeptTime >= interval - EPS;
}

/**
 * Upper bound on samples a clip will yield at a target rate — used to pre-size buffers and to
 * warn on pathologically long inputs.
 * @param {number} durationSeconds
 * @param {number} targetFps
 * @returns {number}
 */
export function estimateSampleCount(durationSeconds, targetFps) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  if (!Number.isFinite(targetFps) || targetFps <= 0) return 0;
  return Math.floor(durationSeconds * targetFps) + 1;
}
