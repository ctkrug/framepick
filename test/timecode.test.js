import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampTime,
  formatTimecode,
  timeToFrame,
  timecodeSlug,
} from "../src/lib/timecode.js";

test("clampTime rejects NaN, Infinity, and negatives", () => {
  assert.equal(clampTime(NaN), 0);
  assert.equal(clampTime(Infinity), 0);
  assert.equal(clampTime(-5), 0);
  assert.equal(clampTime(12.5), 12.5);
});

test("formatTimecode drops hours under an hour", () => {
  assert.equal(formatTimecode(0), "00:00.000");
  assert.equal(formatTimecode(83.4), "01:23.400");
  assert.equal(formatTimecode(59.9997), "01:00.000"); // ms rounds up and carries
});

test("formatTimecode shows hours past an hour", () => {
  assert.equal(formatTimecode(3661.25), "01:01:01.250");
});

test("formatTimecode can omit millis", () => {
  assert.equal(formatTimecode(83.4, { millis: false }), "01:23");
});

test("timeToFrame rounds to nearest frame and guards bad fps", () => {
  assert.equal(timeToFrame(1, 30), 30);
  assert.equal(timeToFrame(1.017, 30), 31); // 30.51 -> 31
  assert.equal(timeToFrame(1, 0), 0);
  assert.equal(timeToFrame(1, NaN), 0);
});

test("timecodeSlug is filename-safe", () => {
  assert.equal(timecodeSlug(83.4), "01m23s400");
  assert.equal(timecodeSlug(0), "00m00s000");
  assert.match(timecodeSlug(125.5), /^\d\dm\d\ds\d{3}$/);
});
