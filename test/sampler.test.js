import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleInterval, shouldSample, estimateSampleCount } from "../src/lib/sampler.js";

test("sampleInterval is the reciprocal of the rate", () => {
  assert.equal(sampleInterval(4), 0.25);
  assert.equal(sampleInterval(2), 0.5);
  assert.throws(() => sampleInterval(0), RangeError);
  assert.throws(() => sampleInterval(-1), RangeError);
});

test("shouldSample always keeps the first frame", () => {
  assert.equal(shouldSample(null, 0, 4), true);
  assert.equal(shouldSample(undefined, 12.3, 4), true);
});

test("shouldSample enforces the interval", () => {
  // 4 fps => 0.25s spacing
  assert.equal(shouldSample(0, 0.1, 4), false);
  assert.equal(shouldSample(0, 0.25, 4), true);
  assert.equal(shouldSample(0, 0.24999, 4), false);
});

test("shouldSample tolerates float drift at the boundary", () => {
  assert.equal(shouldSample(0.5, 0.75 - 1e-9, 4), true);
});

test("estimateSampleCount bounds buffer sizing", () => {
  assert.equal(estimateSampleCount(10, 4), 41);
  assert.equal(estimateSampleCount(0, 4), 0);
  assert.equal(estimateSampleCount(-5, 4), 0);
});
