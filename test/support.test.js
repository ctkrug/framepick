import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSupport } from "../src/lib/support.js";

test("detectSupport reports all missing in a bare environment", () => {
  const res = detectSupport({});
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing.sort(), ["OffscreenCanvas", "VideoDecoder", "VideoFrame", "Worker"]);
});

test("detectSupport is ok when every capability is present", () => {
  const env = { VideoDecoder: class {}, VideoFrame: class {}, Worker: class {}, OffscreenCanvas: class {} };
  const res = detectSupport(env);
  assert.equal(res.ok, true);
  assert.deepEqual(res.missing, []);
});

test("detectSupport names exactly the missing capability", () => {
  const env = { VideoDecoder: class {}, VideoFrame: class {}, Worker: class {} };
  const res = detectSupport(env);
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing, ["OffscreenCanvas"]);
});
