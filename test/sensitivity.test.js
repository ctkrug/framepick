import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  DEFAULT_SENSITIVITY,
  clampSensitivity,
  thresholdForSensitivity,
} from "../src/lib/sensitivity.js";

test("the track ends map to the threshold bounds", () => {
  assert.ok(Math.abs(thresholdForSensitivity(0) - THRESHOLD_MAX) < 1e-9);
  assert.ok(Math.abs(thresholdForSensitivity(100) - THRESHOLD_MIN) < 1e-9);
});

test("more sensitivity always lowers the threshold (monotonic)", () => {
  let prev = Infinity;
  for (let s = 0; s <= 100; s += 5) {
    const t = thresholdForSensitivity(s);
    assert.ok(t < prev, `threshold should decrease at s=${s}`);
    assert.ok(t >= THRESHOLD_MIN - 1e-9 && t <= THRESHOLD_MAX + 1e-9);
    prev = t;
  }
});

test("out-of-range and non-finite input is clamped", () => {
  assert.equal(clampSensitivity(-40), 0);
  assert.equal(clampSensitivity(140), 100);
  assert.equal(clampSensitivity(Number.NaN), DEFAULT_SENSITIVITY);
  assert.equal(thresholdForSensitivity(-40), THRESHOLD_MAX);
  assert.equal(thresholdForSensitivity(999), THRESHOLD_MIN);
});

test("the default sensitivity sits inside the usable range", () => {
  assert.ok(DEFAULT_SENSITIVITY > 0 && DEFAULT_SENSITIVITY < 100);
  const t = thresholdForSensitivity(DEFAULT_SENSITIVITY);
  assert.ok(t > THRESHOLD_MIN && t < THRESHOLD_MAX);
});
