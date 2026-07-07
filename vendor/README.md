# Vendored dependencies

Third-party code bundled so Framepick stays a static, build-free, offline-capable site that
works under any base path (no CDN fetch at runtime, no `node_modules`).

## `mp4box.esm.js`

[MP4Box.js](https://github.com/gpac/mp4box.js) — the MP4/MOV demuxer that turns a container into
the `EncodedVideoChunk`s the WebCodecs `VideoDecoder` consumes.

- Source: `mp4box.all.min.js` from mp4box@0.5.2 (build dated 19-03-2022).
- License: BSD-3-Clause (© Telecom ParisTech / GPAC contributors).
- Local modification: a small ESM footer re-exporting the top-level `MP4Box` and `DataStream`
  vars (`export { MP4Box, DataStream }`) so the module worker can `import` it directly. No other
  changes to the library source.
