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

test("formatTimecode handles multi-hour and multi-digit-hour clips", () => {
  assert.equal(formatTimecode(3600), "01:00:00.000");
  // Past 100 hours the hours field just widens; it never truncates or overflows.
  assert.equal(formatTimecode(360000), "100:00:00.000");
});

test("formatTimecode floors sub-millisecond noise to zero", () => {
  assert.equal(formatTimecode(0.0004), "00:00.000");
  assert.equal(formatTimecode(12.3456), "00:12.346"); // rounds to nearest ms
});

test("formatTimecode never emits NaN or negatives for bad input", () => {
  assert.equal(formatTimecode(NaN), "00:00.000");
  assert.equal(formatTimecode(-42), "00:00.000");
  assert.equal(formatTimecode(Infinity), "00:00.000");
});

test("timecodeSlug stays filename-safe past an hour", () => {
  // Minutes accumulate rather than rolling into an hours field; still safe chars.
  assert.equal(timecodeSlug(3661.25), "61m01s250");
  assert.match(timecodeSlug(7325.9), /^\d+m\d\ds\d{3}$/);
});

test("timecodeSlug carries a rounded-up millisecond into the seconds", () => {
  // 59.9996s rounds to 1000ms; it must carry into the seconds, not emit "s1000".
  assert.equal(timecodeSlug(59.9996), "01m00s000");
  assert.equal(timecodeSlug(3599.9996), "60m00s000");
  assert.match(timecodeSlug(59.9996), /s\d{3}$/); // exactly three ms digits
});
