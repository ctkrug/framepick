// Analysis worker — keeps WebCodecs decode + signature extraction off the UI thread.
//
// Message protocol (BUILD implements the body against docs/BACKLOG.md Epic 1.2):
//   main -> worker: { type: "analyze", file, sampleFps }
//   worker -> main: { type: "progress", fraction }
//                   { type: "sample", index, time, signature, bitmap }
//                   { type: "done", samples }
//                   { type: "error", message }
//
// The worker owns decode.decodeToSamples; the main thread owns scene detection/dedup (cheap,
// re-runnable from cached signatures when the sensitivity slider moves) and rendering.

import { decodeToSamples } from "../decode.js";

self.addEventListener("message", async (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "analyze") return;

  try {
    const samples = await decodeToSamples(msg.file, {
      sampleFps: msg.sampleFps,
      onProgress: (fraction) => self.postMessage({ type: "progress", fraction }),
      onSample: (sample) =>
        self.postMessage({
          type: "sample",
          index: sample.index,
          time: sample.time,
          signature: sample.signature,
          bitmap: sample.bitmap,
        }),
    });
    self.postMessage({ type: "done", samples });
  } catch (err) {
    self.postMessage({ type: "error", message: err?.message ?? String(err) });
  }
});
