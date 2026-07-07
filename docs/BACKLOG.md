# Framepick — Backlog

Epic/story breakdown for the build. Stories are `[ ]` until their acceptance criteria all pass;
QA attacks the criteria. **Epic 1, Story 1 is the wow moment** — the end-to-end on-device demo
lands before anything optional.

> **BUILD status (v1 core complete):** the full pipeline is implemented and verified end-to-end
> in headless Chromium against a generated 4-scene MP4 — decode → contact sheet with timecodes,
> live slider re-segmentation (no re-decode), stats, per-frame PNG + download-all zip, inline
> non-video rejection — with zero console errors and no horizontal overflow at 390/768/1440.

Sensitivity is a single 0–100 slider that maps to the cut threshold in `src/lib/scenes.js`.
Signatures are cached per decode so re-segmentation never re-decodes.

---

## Epic 1 — On-device decode → keyframes (the wow)

Get from a dropped file to a contact sheet of scene keyframes, entirely client-side.

- [x] **1.1 — WOW: drop a video, get its scene keyframes on-device.** Dropping (or picking) a
  video decodes it with WebCodecs and renders a filmstrip contact sheet of deduplicated
  scene-change keyframes, each with a timecode — with no network request for the media.
  - AC1: Loading a short sample H.264 MP4 produces ≥ 2 keyframe cells, each showing a rendered
    frame image and a timecode in `MM:SS.mmm` form.
  - AC2: With DevTools Network throttled to offline *after* page load, the full decode→contact-
    sheet flow still completes (the media never leaves the browser).
  - AC3: The first keyframe's timecode is `00:00.000` (or within one sample interval of the
    clip start).

- [x] **1.2 — WebCodecs decode in a Web Worker.** Demux (mp4box.js) and `VideoDecoder` run in a
  worker; sampled frames are reduced to signatures off the main thread.
  - AC1: Decoding a ~30s clip keeps the main thread responsive (the page scrolls / the slider
    drags without visible jank during analysis).
  - AC2: Frames are sampled at a bounded rate (target ≤ ~4 samples/sec of video) so a long clip
    doesn't exhaust memory; the sample rate is documented in code.

- [x] **1.3 — Live progress + scan-line feedback.** Decode/analysis shows real progress and the
  DESIGN.md scan-line animation over the preview.
  - AC1: A determinate progress indicator advances from 0 to 100% and disappears on completion.
  - AC2: The animated scan line runs during analysis and respects `prefers-reduced-motion`
    (no animation when reduced motion is set).

- [x] **1.4 — Design polish (contact sheet as hero).** The filmstrip contact sheet is the hero
  per docs/DESIGN.md: sprocket rails, timecode chips, hover lift.
  - AC1: At 1440px the results stage occupies ≥ 60% of the viewport width; at 390px the layout
    is a single column with no horizontal scroll.
  - AC2: Each keyframe cell has themed hover and focus-visible states; sprocket-hole rails are
    present on the strip.

---

## Epic 2 — Tuning & interaction

Make the result controllable and the empty/error states designed.

- [x] **2.1 — Sensitivity slider re-segments live.** A themed range slider changes the cut
  threshold and re-runs detection from cached signatures without re-decoding.
  - AC1: Dragging the slider changes the number of keyframes shown within ~150ms and issues no
    new decode (verifiable: no new worker decode message / no file re-read).
  - AC2: The slider is fully themed (no naked native track/thumb) with hover/focus/active states
    and a ≥ 44px touch target.

- [x] **2.2 — Stats readout.** Show duration, frames sampled, scenes found, and keyframes kept.
  - AC1: The four stats render with tabular-numeric alignment and update when sensitivity changes.
  - AC2: Keyframes-kept never exceeds scenes-found, which never exceeds frames-sampled.

- [x] **2.3 — Designed empty & loading states.** Before a file and during decode the stage is
  composed, not blank.
  - AC1: The initial dropzone fills ≥ 46vh and reads as the hero (wordmark + prompt + button),
    with no tiny widget adrift in empty paper.
  - AC2: A loading state (skeleton or scan line + progress) is shown during analysis.

---

## Epic 3 — Export

Get keyframes out.

- [x] **3.1 — Per-frame PNG export.** Each keyframe cell exports its full-resolution frame as a
  PNG named with its timecode slug.
  - AC1: Clicking a cell's download control saves a PNG whose filename contains the timecode slug
    (e.g. `framepick-01m23s400.png`).
  - AC2: The exported PNG is the decoded frame at full sampled resolution, not the thumbnail.

- [x] **3.2 — Download-all as a zip.** A single action bundles all kept keyframes into one zip.
  - AC1: "Download all" produces a `.zip` containing one PNG per kept keyframe.
  - AC2: The zip is generated client-side (no upload) and the control is disabled with a designed
    state when there are zero keyframes.

- [x] **3.3 — Design polish (export controls & success).** Export controls match the theme and a
  success pulse confirms completion.
  - AC1: Export buttons carry the vermilion/support theming with hover/active/disabled states.
  - AC2: A brief, non-blocking success confirmation appears after an export (respecting reduced
    motion).

---

## Epic 4 — Robustness & ship

Make it trustworthy and hostable.

- [x] **4.1 — Error & unsupported handling.** Bad, DRM'd, or undecodable files and unsupported
  browsers surface designed messaging, never a crash or silent hang.
  - AC1: Dropping a non-video (e.g. a PNG or text file) shows an inline error, not a crash.
  - AC2: A browser without `VideoDecoder` shows the unsupported notice and never spins forever.

- [x] **4.2 — Responsive + a11y pass.** The page is composed and accessible at 390 / 768 / 1440.
  - AC1: No horizontal scroll or overlap at 390, 768, and 1440px widths.
  - AC2: Keyboard: focus is visible on every control, icon-only buttons have `aria-label`, and
    status updates use a live region.

- [x] **4.3 — Static hosting & relative paths.** The app builds to a self-contained directory and
  works under a subpath.
  - AC1: All asset references are relative (no leading `/`); serving the directory under a base
    path (e.g. `/framepick/`) loads styles, scripts, and fonts without 404s.
  - AC2: `npm test` is green in CI and the README documents how to run and host it.
