---
title: "Extracting scene keyframes from video in the browser, no server"
published: false
tags: webdev, javascript, webcodecs, video
---

I kept hitting the same small annoyance: I have a clip and I want the handful of frames that
actually represent it. One frame per shot, with the timecode, so I can pick a thumbnail or sketch
a shot list. The options were scrubbing the timeline by hand, uploading the file to some site that
runs ffmpeg on a server, or remembering `ffmpeg -vf "select='gt(scene,0.4)'"` and guessing at the
threshold.

So I built [Framepick](https://apps.charliekrug.com/framepick/): drop a video on the page and it
hands back one keyframe per scene, entirely client-side. The file never leaves the machine. Here
are the two decisions that made it interesting to write.

## Decoding real frames with WebCodecs

The naive way to grab frames in a browser is to seek a hidden `<video>` element and paint each
position to a canvas. It is slow and imprecise. WebCodecs gives you the actual decode pipeline
instead.

The catch is that `VideoDecoder` wants encoded chunks, and a `.mp4` is a container it does not
parse. So the flow is: demux the container with [mp4box.js](https://github.com/gpac/mp4box.js) to
get raw samples, wrap each in an `EncodedVideoChunk`, and feed the decoder. The one fiddly part is
that the decoder needs the codec description (the `avcC`/`hvcC` box for H.264/HEVC) to configure
itself, and you have to pull it out of the track and strip the 8-byte box header:

```js
const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
box.write(stream);
return new Uint8Array(stream.buffer, 8); // drop the box header
```

Decoded `VideoFrame`s arrive on an `output` callback. I sample about four per second (adjacent
frames in a shot are nearly identical, so decoding every one buys nothing), draw each to an
`OffscreenCanvas`, and read it back. All of it runs in a Web Worker so the UI thread never stalls.

## Cheap, steady scene detection

Comparing full frames pixel-by-pixel is both slow and too twitchy. Camera grain and compression
artifacts register as "change" even when nothing moved. So every sampled frame gets reduced to an
8x8 grid of average brightness, a 64-number fingerprint. A hard cut moves most cells at once; a
static shot barely moves them. The distance between two fingerprints is just the mean absolute
difference, and a spike above a threshold marks a cut.

The part I like: decode and segmentation are separate stages. The signatures are cached, so the
sensitivity slider re-runs only the cheap segmentation step. You drag it and the contact sheet
updates instantly, with no second decode.

I also wrote the ZIP export by hand rather than pull a dependency. For store-only (no compression)
archives the format is small: a local header per file, the raw bytes, and a central directory.
That did earn one real bug. Non-ASCII filenames came out garbled until I set general-purpose bit
11 in the flags to declare the names are UTF-8. Now there is a test that fails without that flag.

## What I would change

The brightness-only signature has a blind spot I found while testing: two solid color fields with
similar brightness (a flat red cut to a flat green) read as almost no change, because luma throws
away the color. Real footage has texture, so obvious cuts still light up, but a chroma-aware
signature would catch the pathological case. That is the first thing I would add.

Framepick is MIT licensed and has no build step to run. Code and notes are on
[GitHub](https://github.com/ctkrug/framepick); the live version is at
[apps.charliekrug.com/framepick](https://apps.charliekrug.com/framepick/). If you try it on a clip
that trips it up, I would genuinely like to know what.
