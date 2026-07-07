import { test } from "node:test";
import assert from "node:assert/strict";
import { luma, frameSignature, signatureDistance } from "../src/lib/signature.js";

/** Build a solid-color RGBA frame. */
function solid(width, height, [r, g, b]) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

test("luma weights green most, blue least", () => {
  assert.ok(luma(0, 255, 0) > luma(255, 0, 0));
  assert.ok(luma(255, 0, 0) > luma(0, 0, 255));
  assert.equal(luma(0, 0, 0), 0);
  assert.equal(Math.round(luma(255, 255, 255)), 255);
});

test("frameSignature of a solid frame is uniform and normalized", () => {
  const sig = frameSignature(solid(16, 16, [255, 255, 255]), 16, 16);
  assert.equal(sig.length, 64);
  for (const v of sig) assert.ok(Math.abs(v - 1) < 1e-6);

  const black = frameSignature(solid(16, 16, [0, 0, 0]), 16, 16);
  for (const v of black) assert.equal(v, 0);
});

test("frameSignature respects a custom grid size", () => {
  const sig = frameSignature(solid(8, 8, [128, 128, 128]), 8, 8, { cols: 4, rows: 4 });
  assert.equal(sig.length, 16);
});

test("frameSignature validates dimensions", () => {
  assert.throws(() => frameSignature(new Uint8ClampedArray(4), 0, 1), RangeError);
  assert.throws(() => frameSignature(new Uint8ClampedArray(4), 4, 4), RangeError);
});

test("signatureDistance is 0 for identical, positive for different", () => {
  const white = frameSignature(solid(8, 8, [255, 255, 255]), 8, 8);
  const black = frameSignature(solid(8, 8, [0, 0, 0]), 8, 8);
  assert.equal(signatureDistance(white, white), 0);
  assert.ok(Math.abs(signatureDistance(white, black) - 1) < 1e-6);
});

test("signatureDistance rejects mismatched lengths", () => {
  assert.throws(() => signatureDistance([1, 2], [1]), RangeError);
});

test("signatureDistance of two empty signatures is 0, not NaN", () => {
  assert.equal(signatureDistance(new Float32Array(0), new Float32Array(0)), 0);
  assert.equal(signatureDistance([], []), 0);
});

test("frameSignature zeroes cells that receive no pixels", () => {
  // A grid finer than the source leaves some cells empty; those must read 0,
  // never NaN from a divide-by-zero. 2x2 source into a 4x4 grid: only the even
  // rows/cols catch a pixel.
  const sig = frameSignature(solid(2, 2, [255, 255, 255]), 2, 2, { cols: 4, rows: 4 });
  assert.equal(sig.length, 16);
  for (const v of sig) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1);
  assert.ok(sig.some((v) => v === 0), "some cells got no pixels and read 0");
  assert.ok(sig.some((v) => Math.abs(v - 1) < 1e-6), "populated cells read white");
});
