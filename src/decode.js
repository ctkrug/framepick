// WebCodecs decode pipeline — browser-only (not imported by the Node test suite).
//
// This module owns the "file in, sampled frames out" stage. The intended flow, wired up in the
// BUILD phase against docs/BACKLOG.md (Epic 1):
//
//   File --(mp4box.js demux)--> EncodedVideoChunk stream --(WebCodecs VideoDecoder)-->
//     VideoFrame stream --(sampler.shouldSample)--> kept frames -->
//       downscale to RGBA (OffscreenCanvas) --> signature.frameSignature --> SampledFrame
//
// The pure decision/analysis pieces already exist and are unit-tested:
//   - src/lib/sampler.js    which decoded frames to keep
//   - src/lib/signature.js  reduce a frame to a comparable fingerprint
//   - src/lib/scenes.js     turn the signature stream into deduped keyframes
//
// What remains for BUILD is the browser plumbing below (mp4box init, decoder config from the
// track's `avcC`/`hvcC` description, and OffscreenCanvas readback), which cannot run under Node.

import { shouldSample } from "./lib/sampler.js";
import { frameSignature } from "./lib/signature.js";

/** Default analysis sample rate (samples per second of video). Bounded so long clips stay light. */
export const DEFAULT_SAMPLE_FPS = 4;

/** Downscale grid used for both readback and signature — small keeps memory + compute low. */
export const SIGNATURE_GRID = { cols: 8, rows: 8 };

/**
 * @typedef {Object} DecodeCallbacks
 * @property {(sample: {index:number,time:number,signature:Float32Array,bitmap?:ImageBitmap}) => void} [onSample]
 * @property {(fraction: number) => void} [onProgress]  0..1
 * @property {(err: Error) => void} [onError]
 */

/**
 * Decode a video file into analyzed samples. Returns the collected samples once the file is
 * fully walked. Implemented in BUILD; the signature declares the contract the app + worker
 * rely on so the rest of the UI can be built against it.
 *
 * @param {File|Blob} file
 * @param {DecodeCallbacks & { sampleFps?: number }} [opts]
 * @returns {Promise<Array<{index:number,time:number,signature:Float32Array}>>}
 */
export async function decodeToSamples(file, opts = {}) {
  void file;
  void opts;
  // Guard rail so a premature call fails loudly instead of silently returning nothing.
  throw new Error(
    "decodeToSamples is not wired yet — see docs/BACKLOG.md Epic 1 (WebCodecs decode).",
  );
}

/**
 * Analyze a single already-decoded RGBA frame into a SampledFrame — the leaf step the decoder
 * calls per kept frame. Pure enough to reuse and reason about; exported for BUILD + tests.
 *
 * @param {{ rgba: Uint8ClampedArray, width: number, height: number, time: number, index: number }} frame
 * @returns {{ index:number, time:number, signature:Float32Array }}
 */
export function analyzeFrame(frame) {
  const signature = frameSignature(frame.rgba, frame.width, frame.height, SIGNATURE_GRID);
  return { index: frame.index, time: frame.time, signature };
}

/**
 * Convenience: decide whether the decoder should keep this frame at the configured rate.
 * Thin wrapper so the decoder imports one policy surface.
 * @param {number|null} lastKeptTime
 * @param {number} time
 * @param {number} [sampleFps]
 * @returns {boolean}
 */
export function keepFrame(lastKeptTime, time, sampleFps = DEFAULT_SAMPLE_FPS) {
  return shouldSample(lastKeptTime, time, sampleFps);
}
