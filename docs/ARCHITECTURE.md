# Framepick — Architecture

A static, client-side web app. No server, no build step required to run. Two layers:

1. **Pure logic** (`src/lib/`) — framework-free, browser-agnostic, unit-tested with
   `node --test`. This is where the interesting decisions live.
2. **Browser plumbing** (`src/`) — WebCodecs, Web Workers, OffscreenCanvas, and DOM. Not
   unit-tested in Node (it needs a browser); kept thin and composed from the pure layer.

## Data flow

```
        File (drag/drop or picker)
                 │
                 ▼
   ┌──────────────────────────────┐   Web Worker (src/worker/analyze.worker.js)
   │  decode.decodeToSamples       │   — off the UI thread
   │    mp4box.js demux            │
   │    → EncodedVideoChunk        │
   │    → WebCodecs VideoDecoder   │
   │    → VideoFrame               │
   │    → sampler.shouldSample     │   keep ~4 frames/sec of video
   │    → OffscreenCanvas RGBA     │
   │    → signature.frameSignature │   8×8 luma grid per kept frame
   └──────────────┬───────────────┘
                  │  postMessage: progress / sample / done
                  ▼
        Main thread (src/app.js)
                  │
                  ▼
   ┌──────────────────────────────┐
   │  scenes.extractKeyframes      │   cheap; re-run on slider change
   │    detectCuts (distance>thr)  │   WITHOUT re-decoding
   │    pickKeyframes (per scene)  │
   │    dedupeKeyframes            │
   └──────────────┬───────────────┘
                  ▼
        Filmstrip contact sheet + timecodes + export
```

## Modules

| File | Layer | Responsibility |
|---|---|---|
| `src/lib/timecode.js` | pure | Format frame times; filename-safe slugs. |
| `src/lib/signature.js` | pure | Reduce an RGBA frame to a luma-grid fingerprint; distance. |
| `src/lib/sampler.js` | pure | Which decoded frames to keep for a target sample rate. |
| `src/lib/scenes.js` | pure | Cuts → scenes → one keyframe each → dedup. |
| `src/lib/support.js` | pure | WebCodecs capability detection. |
| `src/decode.js` | browser | mp4box + VideoDecoder → analyzed samples (contract + leaf steps). |
| `src/worker/analyze.worker.js` | browser | Runs decode off the UI thread; streams messages. |
| `src/app.js` | browser | Dropzone, worker orchestration, sensitivity, rendering, export. |

## Why signatures are cached

Decoding is the expensive step. Once a clip is decoded into a list of `{index, time, signature}`
samples, changing the sensitivity slider only re-runs `scenes.extractKeyframes` over that cached
list — no re-decode, no file re-read. That's what makes the sensitivity control feel instant.

## Testing strategy

The pure layer carries the correctness burden and is fully covered by `node --test`
(`test/*.test.js`): timecode formatting/rounding, signature normalization/distance, sampler
cadence, and scene/dedup behavior on synthetic frame streams. The browser layer is intentionally
thin glue over that tested core, exercised manually per the QA design self-review in
`docs/DESIGN.md` (§D3).
