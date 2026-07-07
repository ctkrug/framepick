import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeFrame,
  keepFrame,
  fitWithin,
  SIGNATURE_GRID,
  DEFAULT_SAMPLE_FPS,
  DEFAULT_MAX_EDGE,
} from "../src/decode.js";
import { frameSignature } from "../src/lib/signature.js";

// decode.js is browser-only (mp4box + WebCodecs), but its pure decision/analysis seams —
// analyzeFrame and keepFrame — are stdlib-safe and carry the contract the worker relies on.

function solidFrame(width, height, value) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(value);
  // keep alpha opaque so the readback matches a real decoded frame
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return rgba;
}

test("analyzeFrame returns an 8x8 signature with the frame's time and index", () => {
  const rgba = solidFrame(16, 16, 128);
  const s = analyzeFrame({ rgba, width: 16, height: 16, time: 2.5, index: 7 });
  assert.equal(s.index, 7);
  assert.equal(s.time, 2.5);
  assert.equal(s.signature.length, SIGNATURE_GRID.cols * SIGNATURE_GRID.rows);
});

test("analyzeFrame matches frameSignature on the same grid", () => {
  const rgba = solidFrame(16, 16, 200);
  const s = analyzeFrame({ rgba, width: 16, height: 16, time: 0, index: 0 });
  const direct = frameSignature(rgba, 16, 16, SIGNATURE_GRID);
  assert.deepEqual(Array.from(s.signature), Array.from(direct));
});

test("analyzeFrame signature of a pure-white frame is all ones", () => {
  const rgba = solidFrame(8, 8, 255);
  const s = analyzeFrame({ rgba, width: 8, height: 8, time: 0, index: 0 });
  for (const v of s.signature) assert.ok(Math.abs(v - 1) < 1e-6);
});

test("keepFrame always keeps the first frame", () => {
  assert.equal(keepFrame(null, 0), true);
  assert.equal(keepFrame(undefined, 123.4), true);
});

test("keepFrame enforces the sample cadence at the default rate", () => {
  // Default 4 fps → one sample per 0.25s.
  assert.equal(keepFrame(0, 0.1, DEFAULT_SAMPLE_FPS), false);
  assert.equal(keepFrame(0, 0.25, DEFAULT_SAMPLE_FPS), true);
  assert.equal(keepFrame(1.0, 1.24, DEFAULT_SAMPLE_FPS), false);
  assert.equal(keepFrame(1.0, 1.25, DEFAULT_SAMPLE_FPS), true);
});

test("keepFrame defaults to the module sample rate when omitted", () => {
  assert.equal(keepFrame(0, 0.25), true);
  assert.equal(keepFrame(0, 0.24), false);
});

test("fitWithin downscales the longest edge to fit the box, keeping aspect", () => {
  // Landscape 1920x1080 into a 1280 box → longest edge becomes 1280.
  assert.deepEqual(fitWithin(1920, 1080, 1280), { w: 1280, h: 720 });
  // Portrait clamps the height instead.
  assert.deepEqual(fitWithin(1080, 1920, 1280), { w: 720, h: 1280 });
  // Square.
  assert.deepEqual(fitWithin(1000, 1000, 500), { w: 500, h: 500 });
});

test("fitWithin never upscales a frame smaller than the box", () => {
  assert.deepEqual(fitWithin(320, 240, 1280), { w: 320, h: 240 });
  assert.deepEqual(fitWithin(1, 1, 1280), { w: 1, h: 1 });
});

test("fitWithin never rounds a dimension below 1px", () => {
  // An extreme aspect ratio must not collapse the short side to 0.
  const fit = fitWithin(2000, 3, 100);
  assert.equal(fit.w, 100);
  assert.ok(fit.h >= 1, `short side floored to ${fit.h}`);
});

test("decode constants stay within sane bounds", () => {
  assert.ok(DEFAULT_SAMPLE_FPS > 0 && Number.isFinite(DEFAULT_SAMPLE_FPS));
  assert.ok(DEFAULT_MAX_EDGE >= 256);
  assert.equal(SIGNATURE_GRID.cols, 8);
  assert.equal(SIGNATURE_GRID.rows, 8);
});
