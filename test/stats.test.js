import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats } from "../src/lib/stats.js";

function frame(index, time, value) {
  return { index, time, signature: new Float32Array([value, value, value, value]) };
}

// Three dark frames then three bright frames — one clean cut.
const twoScenes = [
  frame(0, 0.0, 0.1),
  frame(1, 0.5, 0.1),
  frame(2, 1.0, 0.1),
  frame(3, 1.5, 0.9),
  frame(4, 2.0, 0.9),
  frame(5, 2.5, 0.9),
];

test("counts frames, scenes, and kept keyframes for a two-scene clip", () => {
  const s = computeStats(twoScenes, { threshold: 0.5 });
  assert.equal(s.framesSampled, 6);
  assert.equal(s.scenesFound, 2);
  assert.equal(s.keyframesKept, 2);
  assert.equal(s.durationSeconds, 2.5);
});

test("duration override wins over the last sample time", () => {
  const s = computeStats(twoScenes, { threshold: 0.5, durationSeconds: 9.75 });
  assert.equal(s.durationSeconds, 9.75);
});

test("empty input yields all-zero stats, not a crash", () => {
  const s = computeStats([], { threshold: 0.5 });
  assert.deepEqual(s, {
    durationSeconds: 0,
    framesSampled: 0,
    scenesFound: 0,
    keyframesKept: 0,
  });
});

test("invariant kept <= scenes <= sampled holds across thresholds", () => {
  for (let t = 0.02; t <= 0.5; t += 0.02) {
    const s = computeStats(twoScenes, { threshold: t });
    assert.ok(s.keyframesKept <= s.scenesFound, `kept<=scenes at t=${t}`);
    assert.ok(s.scenesFound <= s.framesSampled, `scenes<=sampled at t=${t}`);
  }
});

test("a threshold above every distance collapses to a single scene", () => {
  const s = computeStats(twoScenes, { threshold: 0.95 });
  assert.equal(s.scenesFound, 1);
  assert.equal(s.keyframesKept, 1);
});
