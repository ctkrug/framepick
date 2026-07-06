// Capability detection for the WebCodecs pipeline. Pure: takes the environment object so it
// can be exercised under node --test with a stub rather than a real browser global.

/**
 * @typedef {Object} Support
 * @property {boolean} ok            true only if every required capability is present
 * @property {string[]} missing      names of the missing capabilities
 */

const REQUIRED = ["VideoDecoder", "VideoFrame", "Worker", "OffscreenCanvas"];

/**
 * Report whether the given environment can run Framepick's decode pipeline.
 * @param {Record<string, unknown>} [env] defaults to globalThis
 * @returns {Support}
 */
export function detectSupport(env = globalThis) {
  const missing = REQUIRED.filter((name) => typeof env[name] === "undefined");
  return { ok: missing.length === 0, missing };
}
