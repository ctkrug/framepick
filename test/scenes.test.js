import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjacentDistances,
  detectCuts,
  segmentScenes,
  pickKeyframes,
  dedupeKeyframes,
  extractKeyframes,
} from "../src/lib/scenes.js";

/** Frames where the signature is a single value repeated — easy to reason about distances. */
function frame(index, time, value) {
  return { index, time, signature: new Float32Array([value, value, value, value]) };
}

// Two clear scenes: three dark frames, then three bright frames.
const twoScenes = [
  frame(0, 0.0, 0.1),
  frame(1, 0.5, 0.1),
  frame(2, 1.0, 0.1),
  frame(3, 1.5, 0.9), // <- cut here
  frame(4, 2.0, 0.9),
  frame(5, 2.5, 0.9),
];

test("adjacentDistances length is n-1 and spikes at the cut", () => {
  const d = adjacentDistances(twoScenes);
  assert.equal(d.length, 5);
  assert.ok(Math.abs(d[2] - 0.8) < 1e-6); // frame 2 -> 3
  assert.equal(d[0], 0);
});

test("detectCuts always starts a scene at 0 and finds the spike", () => {
  const cuts = detectCuts(twoScenes, 0.5);
  assert.deepEqual(cuts, [0, 3]);
  assert.deepEqual(detectCuts([], 0.5), []);
});

test("a threshold above every distance yields one scene", () => {
  assert.deepEqual(detectCuts(twoScenes, 0.95), [0]);
});

test("segmentScenes covers all frames with no gaps", () => {
  const segs = segmentScenes([0, 3], 6);
  assert.deepEqual(segs, [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
  ]);
  assert.deepEqual(segmentScenes([], 6), []);
});

test("pickKeyframes returns one establishing frame per scene", () => {
  const kf = pickKeyframes(twoScenes, 0.5);
  assert.equal(kf.length, 2);
  assert.deepEqual(
    kf.map((f) => f.index),
    [0, 3],
  );
});

test("dedupeKeyframes drops frames too close in time", () => {
  const kfs = [frame(0, 0.0, 0.1), frame(3, 0.1, 0.9)]; // big visual change, tiny gap
  const kept = dedupeKeyframes(kfs, { minGapSeconds: 0.5, minDistance: 0.04 });
  assert.equal(kept.length, 1);
});

test("dedupeKeyframes drops frames too visually similar", () => {
  const kfs = [frame(0, 0.0, 0.5), frame(3, 5.0, 0.51)]; // far apart in time, nearly identical
  const kept = dedupeKeyframes(kfs, { minGapSeconds: 0.5, minDistance: 0.04 });
  assert.equal(kept.length, 1);
});

test("dedupeKeyframes keeps distinct, well-spaced frames", () => {
  const kept = dedupeKeyframes(pickKeyframes(twoScenes, 0.5));
  assert.equal(kept.length, 2);
});

test("extractKeyframes runs the whole pipeline", () => {
  const out = extractKeyframes(twoScenes, { threshold: 0.5 });
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((f) => f.time),
    [0.0, 1.5],
  );
});
