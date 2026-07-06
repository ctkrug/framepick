# Framepick — Vision

## The problem

You have a video and you want the handful of frames that actually *represent* it: the
scene-change keyframes, one per distinct shot, with the timestamp of each. Today that means one
of two bad options:

1. **Upload it somewhere.** A web tool ingests your file to a server, runs ffmpeg, and hands
   back thumbnails. Your footage — which might be private, unreleased, or just large — leaves
   your machine and sits on someone else's disk.
2. **Run ffmpeg yourself.** `ffmpeg -vf "select='gt(scene,0.4)'"` works but requires installing
   ffmpeg, knowing the scene-filter incantation, and iterating on the threshold by hand.

Both are friction. Neither is something you can send a non-technical collaborator.

## The idea

**Framepick does the whole thing in the browser tab, on-device.** Drop a video on the page and
it:

1. **Demuxes** the container (mp4box.js) and feeds encoded chunks to a hardware-accelerated
   WebCodecs `VideoDecoder`.
2. **Samples** decoded frames at a bounded rate and reduces each to a compact luma-grid
   signature (`src/lib/signature.js`).
3. **Detects cuts** where the frame-to-frame signature distance spikes, picks one establishing
   frame per scene, and **dedupes** near-identical shots (`src/lib/scenes.js`).
4. **Presents** the survivors as a filmstrip contact sheet, each tagged with its exact timecode,
   with per-frame and bulk PNG export.

The file never touches the network. The "server" is the user's own GPU.

## Who it's for

- **Editors & motion designers** pulling reference frames or building a shot list.
- **Developers** who need thumbnail/poster candidates without wiring up a transcode backend.
- **Anyone with private footage** who won't (or can't) upload it to a web service.
- **The curious** — it's a live demonstration that real video decoding now runs in the browser.

## Key design decisions

- **Client-side, always.** WebCodecs + a Web Worker keep decode and analysis off both the
  network and the UI thread. This is the whole point; there is no server tier, ever.
- **Signatures, not pixels.** Comparing downscaled luma grids (not full frames) makes scene
  detection fast and robust to grain/compression noise. The math is isolated in framework-free,
  unit-tested modules so the interesting logic is verifiable without a browser.
- **One knob.** A single sensitivity slider maps to the cut threshold. Users think in "more vs.
  fewer keyframes," not in distance metrics. Sensible defaults; live re-segmentation is cheap
  because signatures are cached — re-running detection doesn't re-decode.
- **Static, hostable anywhere.** No build step required to run; relative asset paths so it works
  under any base path (e.g. `apps.charliekrug.com/framepick`).
- **Graceful degradation.** Unsupported browsers get a clear notice, not a silent failure.
  Decode/demux errors surface as designed error states.

## What "v1 done" looks like

- Drop or pick a video; it decodes on-device with WebCodecs (no upload) and shows live progress.
- A contact sheet of deduplicated scene-change keyframes appears, each with an accurate timecode.
- The sensitivity slider re-segments live (from cached signatures) without re-decoding.
- Each keyframe exports as a PNG; a "download all" produces a zip.
- Unsupported browsers and bad/DRM/undecodable files are handled with designed messaging.
- The page matches `docs/DESIGN.md`: paper contact-sheet direction, filmstrip hero, favicon,
  responsive and composed at 390 / 768 / 1440, all controls themed.
- CI green; the pure-logic suite covers timecode, signatures, and scene/dedup behavior.

## Explicitly out of scope for v1

- Audio analysis, transcription, or motion-vector cut detection.
- Server-side anything, accounts, or persistence beyond localStorage preferences.
- Editing/trimming the video — Framepick extracts, it doesn't edit.
- Exotic containers/codecs beyond what the browser's WebCodecs + mp4box.js can handle (MP4/MOV
  H.264/HEVC/AV1 as the browser allows); WebM support as a stretch.
