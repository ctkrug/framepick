// Timecode formatting — pure, browser- and Node-safe (no DOM, no WebCodecs).
//
// Framepick tags every keyframe with a human-readable timecode. Video times arrive as
// floating-point seconds (WebCodecs reports frame timestamps in microseconds, which the
// decoder layer converts to seconds before it reaches here).

/**
 * Clamp a time to a non-negative, finite value. Guards against NaN/Infinity leaking in
 * from a malformed decode.
 * @param {number} seconds
 * @returns {number}
 */
export function clampTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return seconds;
}

/**
 * Format seconds as a timecode string. Drops the hours field when the clip is under an hour
 * so short clips read cleanly (e.g. "01:23.400" rather than "00:01:23.400").
 * @param {number} seconds
 * @param {{ millis?: boolean }} [opts] include the fractional millisecond field (default true)
 * @returns {string}
 */
export function formatTimecode(seconds, opts = {}) {
  const { millis = true } = opts;
  const t = clampTime(seconds);
  const whole = Math.floor(t);
  const ms = Math.round((t - whole) * 1000);
  // Rounding can push ms to 1000; carry it into the seconds.
  const carry = ms === 1000 ? 1 : 0;
  const totalSeconds = whole + carry;
  const msFinal = carry ? 0 : ms;

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const pad = (n, width = 2) => String(n).padStart(width, "0");
  const head = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return millis ? `${head}.${pad(msFinal, 3)}` : head;
}

/**
 * Convert a time in seconds to a frame index at a given frame rate.
 * @param {number} seconds
 * @param {number} fps
 * @returns {number} zero-based frame index (0 if fps is invalid)
 */
export function timeToFrame(seconds, fps) {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return Math.round(clampTime(seconds) * fps);
}

/**
 * A filename-safe timecode slug for exported keyframes, e.g. 83.4s -> "01m23s400".
 * @param {number} seconds
 * @returns {string}
 */
export function timecodeSlug(seconds) {
  const t = clampTime(seconds);
  const whole = Math.floor(t);
  const rawMs = Math.round((t - whole) * 1000);
  // Rounding can push ms to 1000; carry it into the seconds so the field stays 3 digits.
  const carry = rawMs === 1000 ? 1 : 0;
  const totalSeconds = whole + carry;
  const ms = carry ? 0 : rawMs;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(m)}m${pad(s)}s${pad(ms, 3)}`;
}
