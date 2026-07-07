// Analysis worker — keeps WebCodecs decode + signature extraction off the UI thread.
//
// Message protocol:
//   main -> worker: { type: "analyze", file, sampleFps }
//   worker -> main: { type: "meta", durationSeconds, width, height }
//                   { type: "progress", fraction }
//                   { type: "sample", index, time, signature, bitmap, width, height }
//                   { type: "done", count }
//                   { type: "error", message }
//
// Preview bitmaps ride on the "sample" messages (transferred, zero-copy). The main thread
// accumulates samples from those messages and owns scene detection/dedup (cheap, re-runnable
// from cached signatures when the sensitivity slider moves) and rendering.

import { decodeToSamples } from "../decode.js";

self.addEventListener("message", async (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "analyze") return;

  try {
    const samples = await decodeToSamples(msg.file, {
      sampleFps: msg.sampleFps,
      onMeta: (meta) => self.postMessage({ type: "meta", ...meta }),
      onProgress: (fraction) => self.postMessage({ type: "progress", fraction }),
      onSample: (sample) =>
        self.postMessage(
          {
            type: "sample",
            index: sample.index,
            time: sample.time,
            signature: sample.signature,
            bitmap: sample.bitmap,
            width: sample.width,
            height: sample.height,
          },
          [sample.bitmap],
        ),
    });
    self.postMessage({ type: "done", count: samples.length });
  } catch (err) {
    self.postMessage({ type: "error", message: err?.message ?? String(err) });
  }
});
