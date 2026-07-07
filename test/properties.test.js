import { test } from "node:test";
import assert from "node:assert/strict";
import { frameSignature, signatureDistance } from "../src/lib/signature.js";
import {
  thresholdForSensitivity,
  clampSensitivity,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
} from "../src/lib/sensitivity.js";
import { computeStats } from "../src/lib/stats.js";
import { formatTimecode, timecodeSlug } from "../src/lib/timecode.js";

// Property-based tests: instead of a handful of hand-picked examples, hammer each pure function
// with many deterministic pseudo-random inputs and assert the invariants that must always hold.
// A seeded generator keeps failures reproducible (no Math.random flakiness).

/** mulberry32 — tiny deterministic PRNG so a failing case is always reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUNS = 500;

function randomSignature(rand, n = 64) {
  const sig = new Float32Array(n);
  for (let i = 0; i < n; i++) sig[i] = rand();
  return sig;
}

test("signatureDistance is symmetric, self-zero, and bounded in [0,1]", () => {
  const rand = rng(1);
  for (let k = 0; k < RUNS; k++) {
    const a = randomSignature(rand);
    const b = randomSignature(rand);
    const dab = signatureDistance(a, b);
    const dba = signatureDistance(b, a);
    assert.ok(Math.abs(dab - dba) < 1e-12, "symmetry");
    assert.ok(dab >= 0 && dab <= 1, `bounded: ${dab}`);
    assert.equal(signatureDistance(a, a), 0, "self distance is zero");
  }
});

test("signatureDistance obeys the triangle inequality", () => {
  const rand = rng(7);
  for (let k = 0; k < RUNS; k++) {
    const a = randomSignature(rand);
    const b = randomSignature(rand);
    const c = randomSignature(rand);
    const ab = signatureDistance(a, b);
    const bc = signatureDistance(b, c);
    const ac = signatureDistance(a, c);
    assert.ok(ac <= ab + bc + 1e-9, `triangle: ${ac} > ${ab}+${bc}`);
  }
});

test("frameSignature always yields cols*rows values within [0,1]", () => {
  const rand = rng(3);
  for (let k = 0; k < 200; k++) {
    const w = 1 + Math.floor(rand() * 40);
    const h = 1 + Math.floor(rand() * 40);
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = Math.floor(rand() * 256);
    const sig = frameSignature(rgba, w, h, { cols: 8, rows: 8 });
    assert.equal(sig.length, 64);
    for (const v of sig) assert.ok(v >= 0 && v <= 1, `cell ${v} out of range for ${w}x${h}`);
  }
});

test("thresholdForSensitivity is monotonic non-increasing and always in [MIN,MAX]", () => {
  let prev = Infinity;
  for (let s = 0; s <= 100; s++) {
    const t = thresholdForSensitivity(s);
    assert.ok(t >= THRESHOLD_MIN - 1e-9 && t <= THRESHOLD_MAX + 1e-9, `in range: ${t}`);
    assert.ok(t <= prev + 1e-9, `non-increasing at ${s}: ${t} > ${prev}`);
    prev = t;
  }
  // Fractional and out-of-range inputs clamp into the same band.
  const rand = rng(11);
  for (let k = 0; k < RUNS; k++) {
    const raw = rand() * 400 - 150; // -150..250
    const t = thresholdForSensitivity(raw);
    assert.ok(t >= THRESHOLD_MIN - 1e-9 && t <= THRESHOLD_MAX + 1e-9, `clamped: ${t}`);
  }
});

test("clampSensitivity output always lands on the 0..100 track", () => {
  const rand = rng(13);
  for (let k = 0; k < RUNS; k++) {
    const raw = rand() * 1000 - 500;
    const c = clampSensitivity(raw);
    assert.ok(c >= 0 && c <= 100, `clamped ${c}`);
  }
});

test("computeStats keeps keyframesKept <= scenesFound <= framesSampled", () => {
  const rand = rng(17);
  for (let k = 0; k < 300; k++) {
    const n = Math.floor(rand() * 30); // 0..29 frames
    const samples = [];
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += rand() * 0.5;
      samples.push({ index: i, time: t, signature: randomSignature(rand) });
    }
    const threshold = rand(); // 0..1
    const stats = computeStats(samples, { threshold });
    assert.ok(stats.framesSampled === n);
    assert.ok(stats.scenesFound <= stats.framesSampled, "scenes <= sampled");
    assert.ok(stats.keyframesKept <= stats.scenesFound, "kept <= scenes");
    assert.ok(stats.keyframesKept >= 0 && Number.isInteger(stats.keyframesKept));
  }
});

test("formatTimecode never emits NaN, negative, or malformed output", () => {
  const rand = rng(19);
  for (let k = 0; k < RUNS; k++) {
    const secs = rand() * 500000 - 1000; // includes negatives
    const out = formatTimecode(secs);
    assert.doesNotMatch(out, /NaN|-|undefined/, `bad output: ${out}`);
    assert.match(out, /^\d{2,}:\d{2}(:\d{2})?\.\d{3}$/, `shape: ${out}`);
  }
});

test("timecodeSlug is always filename-safe with a three-digit ms field", () => {
  const rand = rng(23);
  for (let k = 0; k < RUNS; k++) {
    const secs = rand() * 100000 - 500; // includes negatives (clamped to 0)
    const slug = timecodeSlug(secs);
    assert.match(slug, /^\d+m\d\ds\d{3}$/, `unsafe slug: ${slug}`);
  }
});
