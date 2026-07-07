// WebCodecs decode pipeline — browser-only (not imported by the Node test suite).
//
// Owns the "file in, sampled frames out" stage:
//
//   File --(mp4box.js demux)--> EncodedVideoChunk stream --(WebCodecs VideoDecoder)-->
//     VideoFrame stream --(sampler.shouldSample)--> kept frames -->
//       preview ImageBitmap (for the contact sheet) + 64x64 luma readback -->
//         signature.frameSignature --> SampledFrame
//
// The pure decision/analysis pieces live in src/lib/* and are unit-tested. Everything here needs
// a real browser (mp4box, VideoDecoder, OffscreenCanvas) so it is exercised via the QA design
// self-review, not node --test.

import { MP4Box, DataStream } from "../vendor/mp4box.esm.js";
import { shouldSample } from "./lib/sampler.js";
import { frameSignature } from "./lib/signature.js";

/** Default analysis sample rate (samples per second of video). Bounded so long clips stay light. */
export const DEFAULT_SAMPLE_FPS = 4;

/** Downscale grid used for the signature — small keeps compare + memory cheap. */
export const SIGNATURE_GRID = { cols: 8, rows: 8 };

/** Fixed readback size for signature extraction — resolution-independent and cheap. */
const ANALYZE_EDGE = 64;

/** Longest edge kept for the preview/export bitmap. Bounds memory on high-res clips. */
export const DEFAULT_MAX_EDGE = 1280;

/**
 * @typedef {Object} DecodeCallbacks
 * @property {(sample: {index:number,time:number,signature:Float32Array,bitmap:ImageBitmap,width:number,height:number}) => void} [onSample]
 * @property {(fraction: number) => void} [onProgress]  0..1
 * @property {(info: {durationSeconds:number,width:number,height:number}) => void} [onMeta]
 */

/** Fit (w,h) inside a maxEdge box, preserving aspect ratio; never upscales. */
function fitWithin(w, h, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/**
 * Pull the codec description (avcC/hvcC/vpcC/av1C box, minus its 8-byte header) out of the
 * demuxed track — VideoDecoder needs it to configure an MP4/H.264/HEVC stream.
 * @returns {Uint8Array|undefined}
 */
function trackDescription(file, trackId) {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // drop the box header
    }
  }
  return undefined;
}

/**
 * Decode a video file into analyzed samples. Resolves once the file is fully walked. Preview
 * bitmaps are delivered through `onSample` (transferable); the resolved array carries the
 * lightweight `{index,time,signature}` used for scene detection.
 *
 * @param {File|Blob} file
 * @param {DecodeCallbacks & { sampleFps?: number, maxEdge?: number }} [opts]
 * @returns {Promise<Array<{index:number,time:number,signature:Float32Array}>>}
 */
export async function decodeToSamples(file, opts = {}) {
  const sampleFps = opts.sampleFps ?? DEFAULT_SAMPLE_FPS;
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const { onSample, onProgress, onMeta } = opts;

  if (typeof VideoDecoder === "undefined") {
    throw new Error("This browser has no WebCodecs VideoDecoder.");
  }

  const buffer = await file.arrayBuffer();
  const mp4 = MP4Box.createFile();

  return new Promise((resolve, reject) => {
    const samples = [];
    let index = 0;
    let lastKeptTime = null;
    let durationSeconds = 0;
    let expectedSamples = Infinity;
    let receivedSamples = 0;
    let previewCanvas = null;
    let previewCtx = null;
    let analyzeCanvas = null;
    let analyzeCtx = null;

    const fail = (err) => reject(err instanceof Error ? err : new Error(String(err)));

    const decoder = new VideoDecoder({
      output: (frame) => {
        try {
          handleFrame(frame);
        } catch (err) {
          try {
            frame.close();
          } catch {
            /* already closed */
          }
          fail(err);
        }
      },
      error: (e) => fail(e),
    });

    function handleFrame(frame) {
      const time = frame.timestamp / 1e6; // µs → s
      if (!shouldSample(lastKeptTime, time, sampleFps)) {
        frame.close();
        return;
      }
      lastKeptTime = time;

      const dw = frame.displayWidth || frame.codedWidth;
      const dh = frame.displayHeight || frame.codedHeight;
      const fit = fitWithin(dw, dh, maxEdge);

      if (!previewCanvas || previewCanvas.width !== fit.w || previewCanvas.height !== fit.h) {
        previewCanvas = new OffscreenCanvas(fit.w, fit.h);
        previewCtx = previewCanvas.getContext("2d", { willReadFrequently: false });
        analyzeCanvas = new OffscreenCanvas(ANALYZE_EDGE, ANALYZE_EDGE);
        analyzeCtx = analyzeCanvas.getContext("2d", { willReadFrequently: true });
      }

      // Preview at the display resolution (capped) — transferToImageBitmap is synchronous, so
      // the frame can be closed immediately and there is no race on canvas reuse.
      previewCtx.drawImage(frame, 0, 0, fit.w, fit.h);
      const bitmap = previewCanvas.transferToImageBitmap();

      // Signature from a fixed tiny readback — cheap and resolution-independent.
      analyzeCtx.drawImage(frame, 0, 0, ANALYZE_EDGE, ANALYZE_EDGE);
      const { data } = analyzeCtx.getImageData(0, 0, ANALYZE_EDGE, ANALYZE_EDGE);
      frame.close();

      const signature = frameSignature(data, ANALYZE_EDGE, ANALYZE_EDGE, SIGNATURE_GRID);
      const sample = { index: index++, time, signature };
      samples.push(sample);
      onSample?.({ ...sample, bitmap, width: fit.w, height: fit.h });
      if (durationSeconds > 0) onProgress?.(Math.min(1, time / durationSeconds));
    }

    mp4.onError = (e) => fail(new Error(`Could not demux this file (${e}).`));

    mp4.onReady = (info) => {
      const track = info.videoTracks[0];
      if (!track) {
        fail(new Error("No video track found — is this a video file?"));
        return;
      }
      durationSeconds = info.duration / info.timescale;
      expectedSamples = track.nb_samples;
      onMeta?.({
        durationSeconds,
        width: track.video?.width ?? track.track_width,
        height: track.video?.height ?? track.track_height,
      });

      const config = {
        codec: track.codec,
        codedWidth: track.video?.width ?? track.track_width,
        codedHeight: track.video?.height ?? track.track_height,
        description: trackDescription(mp4, track.id),
      };
      decoder.configure(config);

      mp4.setExtractionOptions(track.id, null, { nbSamples: Infinity });
      mp4.start();
    };

    mp4.onSamples = (_id, _user, mp4Samples) => {
      for (const s of mp4Samples) {
        decoder.decode(
          new EncodedVideoChunk({
            type: s.is_sync ? "key" : "delta",
            timestamp: (s.cts * 1e6) / s.timescale,
            duration: (s.duration * 1e6) / s.timescale,
            data: s.data,
          }),
        );
      }
      receivedSamples += mp4Samples.length;
      if (receivedSamples >= expectedSamples) {
        decoder
          .flush()
          .then(() => {
            onProgress?.(1);
            samples.sort((a, b) => a.time - b.time);
            resolve(samples);
          })
          .catch(fail);
      }
    };

    buffer.fileStart = 0;
    mp4.appendBuffer(buffer);
    mp4.flush();
  });
}

/**
 * Analyze a single already-decoded RGBA frame into a SampledFrame — exported for reuse/tests.
 * @param {{ rgba: Uint8ClampedArray, width: number, height: number, time: number, index: number }} frame
 * @returns {{ index:number, time:number, signature:Float32Array }}
 */
export function analyzeFrame(frame) {
  const signature = frameSignature(frame.rgba, frame.width, frame.height, SIGNATURE_GRID);
  return { index: frame.index, time: frame.time, signature };
}

/**
 * Decide whether the decoder should keep this frame at the configured rate.
 * @param {number|null} lastKeptTime
 * @param {number} time
 * @param {number} [sampleFps]
 * @returns {boolean}
 */
export function keepFrame(lastKeptTime, time, sampleFps = DEFAULT_SAMPLE_FPS) {
  return shouldSample(lastKeptTime, time, sampleFps);
}
