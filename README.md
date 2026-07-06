# Framepick

**Drop in a video, get back its scene-change keyframes — with timestamps, entirely in your
browser.** No upload, no server, no account. The file never leaves your machine: Framepick
decodes it with the [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API),
runs frame-difference scene detection on the raw frames, deduplicates near-identical shots, and
hands you a contact sheet of keyframes you can save as PNGs.

> Think of it as the "cutting-room contact sheet" for any clip: the handful of frames that
> actually represent the video, pulled out automatically.

---

## Why it's interesting

Scene detection and video decoding are things you normally ship to a server (ffmpeg on a box
somewhere). Framepick does the whole pipeline **client-side**:

- **Real decode, not screenshots.** It demuxes the container and feeds encoded chunks to a
  hardware-accelerated `VideoDecoder`, walking actual decoded frames — not `<video>` seeks.
- **Scene detection in the browser.** Each frame is reduced to a downscaled luma+chroma
  signature; large frame-to-frame distances mark cuts. Near-duplicate keyframes are collapsed so
  you get *shots*, not every frame.
- **Zero data exfiltration.** Everything runs in a Web Worker on-device. A 200 MB clip is decoded
  without a single byte crossing the network.

## What you get

- A **dropzone** — drag a video in (or pick one).
- A live **decode + analysis** pass with progress, running off the main thread.
- A **filmstrip contact sheet** of deduplicated keyframes, each tagged with its exact timecode.
- A **sensitivity slider** — trade "every subtle cut" against "only hard scene changes."
- **Export** — download any keyframe as a PNG, or grab them all as a zip.

## Stack

- **Vanilla JavaScript (ES modules)** — no framework, no bundler required to run.
- **[WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)** —
  `VideoDecoder` for hardware-accelerated frame decode.
- **[mp4box.js](https://github.com/gpac/mp4box.js)** — MP4/MOV demuxing to feed the decoder.
- **Web Workers + `OffscreenCanvas`** — analysis stays off the UI thread.
- **[`node --test`](https://nodejs.org/api/test.html)** — pure-logic units (timecode, frame
  distance, scene segmentation, dedup) with no browser needed.

The scene-detection *math* is isolated in framework-free modules under `src/lib/` so it can be
unit-tested in Node; the browser-only glue (WebCodecs, workers, DOM) lives in `src/`.

## Run it locally

It's a static site — no build step.

```bash
git clone https://github.com/ctkrug/framepick.git
cd framepick
python3 -m http.server 8000   # or any static file server
# open http://localhost:8000
```

WebCodecs support is required (Chrome/Edge 94+, recent Safari). Framepick detects unsupported
browsers and says so instead of failing silently.

## Test

```bash
npm test        # runs the pure-logic suite with node --test
```

## Roadmap

See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the epic/story breakdown and
[`docs/VISION.md`](docs/VISION.md) for the design rationale. The visual direction is specified in
[`docs/DESIGN.md`](docs/DESIGN.md).

## License

[MIT](LICENSE) © Charlie Krug
