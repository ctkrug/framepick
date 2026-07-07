// Framepick app entry — wires the dropzone to the WebCodecs decode + analysis pipeline.
//
// The heavy work (demux + decode + signature) runs in a module worker (src/worker/analyze.worker
// .js). This module owns the DOM: the dropzone, live progress, the sensitivity slider (which
// re-segments from cached signatures — no re-decode), the contact-sheet render, stats, and export.

import { detectSupport } from "./lib/support.js";
import { formatTimecode, timecodeSlug } from "./lib/timecode.js";
import { extractKeyframes } from "./lib/scenes.js";
import { computeStats } from "./lib/stats.js";
import { thresholdForSensitivity, DEFAULT_SENSITIVITY } from "./lib/sensitivity.js";
import { zipStore } from "./lib/zip.js";

const els = {
  stage: document.getElementById("stage"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  pickBtn: document.getElementById("pickBtn"),
  fileName: document.getElementById("fileName"),
  controls: document.getElementById("controls"),
  sensitivity: document.getElementById("sensitivity"),
  sensValue: document.getElementById("sensValue"),
  statDuration: document.getElementById("statDuration"),
  statSampled: document.getElementById("statSampled"),
  statScenes: document.getElementById("statScenes"),
  statKept: document.getElementById("statKept"),
  downloadAll: document.getElementById("downloadAll"),
  results: document.getElementById("results"),
  progress: document.getElementById("progress"),
  progressFill: document.getElementById("progressFill"),
  progressPct: document.getElementById("progressPct"),
  progressLabel: document.getElementById("progressLabel"),
  filmstrip: document.getElementById("filmstrip"),
  resultsEmpty: document.getElementById("resultsEmpty"),
  unsupported: document.getElementById("unsupported"),
  error: document.getElementById("error"),
  toast: document.getElementById("toast"),
};

/** Analysis state for the current file. Signatures + bitmaps are cached so the slider is cheap. */
const state = {
  samples: [], // { index, time, signature, bitmap, width, height }
  keyframes: [],
  meta: null, // { durationSeconds, width, height }
  worker: null,
  toastTimer: 0,
  watchdog: 0,
};

/** If the worker goes silent for this long mid-analysis, treat the file as unprocessable. */
const WATCHDOG_MS = 20000;

// ---- Small UI helpers -----------------------------------------------------

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function setProgress(fraction) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  els.progressFill.style.width = `${pct}%`;
  els.progressPct.textContent = `${pct}%`;
}

/** Draw an ImageBitmap onto a fresh canvas sized to the bitmap (crisp, export-quality). */
function bitmapToCanvas(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  return canvas;
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG encode failed"));
        return;
      }
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
    }, "image/png");
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Analysis lifecycle ---------------------------------------------------

function pokeWatchdog() {
  clearTimeout(state.watchdog);
  state.watchdog = setTimeout(() => {
    if (state.samples.length === 0) {
      resetState();
      showError("Decoding stalled — this file may be corrupt, DRM-protected, or an unsupported codec.");
      els.progress.hidden = true;
    }
  }, WATCHDOG_MS);
}

function resetState() {
  clearTimeout(state.watchdog);
  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
  }
  for (const s of state.samples) s.bitmap?.close?.();
  state.samples = [];
  state.keyframes = [];
  state.meta = null;
  els.filmstrip.innerHTML = "";
}

function startAnalysis(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith("video/")) {
    showError(`“${file.name}” isn’t a video file. Drop an MP4/MOV (H.264/HEVC) clip.`);
    return;
  }
  clearError();
  resetState();

  els.fileName.textContent = file.name;
  els.fileName.hidden = false;
  els.stage.classList.add("has-results");
  els.results.hidden = false;
  els.results.setAttribute("aria-busy", "true");
  els.controls.hidden = true;
  els.resultsEmpty.hidden = true;
  els.progress.hidden = false;
  els.progressLabel.textContent = "Decoding on-device…";
  setProgress(0);

  const worker = new Worker(new URL("./worker/analyze.worker.js", import.meta.url), {
    type: "module",
  });
  state.worker = worker;
  worker.onmessage = (e) => onWorkerMessage(e.data);
  worker.onerror = (e) => {
    showError("The analysis worker failed to start. Try a recent Chrome, Edge, or Safari.");
    els.progress.hidden = true;
    e.preventDefault?.();
  };
  worker.postMessage({ type: "analyze", file });
  pokeWatchdog();
}

function onWorkerMessage(msg) {
  pokeWatchdog();
  switch (msg?.type) {
    case "meta":
      state.meta = { durationSeconds: msg.durationSeconds, width: msg.width, height: msg.height };
      els.progressLabel.textContent = "Analyzing frames…";
      break;
    case "progress":
      setProgress(msg.fraction);
      break;
    case "sample":
      state.samples.push({
        index: msg.index,
        time: msg.time,
        signature: msg.signature,
        bitmap: msg.bitmap,
        width: msg.width,
        height: msg.height,
      });
      break;
    case "done":
      finishAnalysis();
      break;
    case "error":
      clearTimeout(state.watchdog);
      els.results.setAttribute("aria-busy", "false");
      showError(msg.message || "Could not decode this file.");
      els.progress.hidden = true;
      break;
    default:
      break;
  }
}

function finishAnalysis() {
  clearTimeout(state.watchdog);
  els.results.setAttribute("aria-busy", "false");
  els.progress.hidden = true;
  if (state.samples.length === 0) {
    showError("No frames could be read from this file. It may be DRM-protected or corrupt.");
    return;
  }
  els.controls.hidden = false;
  resegment();
}

// ---- Segmentation + render (cheap; re-run on slider move, no re-decode) ----

function resegment() {
  const threshold = thresholdForSensitivity(Number(els.sensitivity.value));
  state.keyframes = extractKeyframes(state.samples, { threshold });
  const stats = computeStats(state.samples, {
    threshold,
    durationSeconds: state.meta?.durationSeconds,
  });
  renderStats(stats);
  renderFilmstrip(state.keyframes);
  els.downloadAll.disabled = state.keyframes.length === 0;
  els.resultsEmpty.hidden = state.keyframes.length > 0;
}

function renderStats(stats) {
  els.statDuration.textContent = formatTimecode(stats.durationSeconds);
  els.statSampled.textContent = String(stats.framesSampled);
  els.statScenes.textContent = String(stats.scenesFound);
  els.statKept.textContent = String(stats.keyframesKept);
}

function renderFilmstrip(keyframes) {
  const frag = document.createDocumentFragment();
  for (const kf of keyframes) {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    cell.setAttribute("role", "listitem");

    cell.appendChild(bitmapToCanvas(kf.bitmap));

    const tc = document.createElement("span");
    tc.className = "timecode";
    tc.textContent = formatTimecode(kf.time);
    cell.appendChild(tc);

    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "frame-dl";
    dl.setAttribute("aria-label", `Download keyframe at ${formatTimecode(kf.time)} as PNG`);
    dl.innerHTML = "&darr;";
    dl.addEventListener("click", () => exportOne(kf));
    cell.appendChild(dl);

    frag.appendChild(cell);
  }
  els.filmstrip.replaceChildren(frag);
}

// ---- Export ---------------------------------------------------------------

async function exportOne(kf) {
  const canvas = bitmapToCanvas(kf.bitmap);
  const bytes = await canvasToPngBytes(canvas);
  downloadBlob(new Blob([bytes], { type: "image/png" }), `framepick-${timecodeSlug(kf.time)}.png`);
  showToast("Frame saved");
}

async function exportAll() {
  if (state.keyframes.length === 0) return;
  els.downloadAll.disabled = true;
  els.downloadAll.textContent = "Bundling…";
  try {
    const files = [];
    for (const kf of state.keyframes) {
      const bytes = await canvasToPngBytes(bitmapToCanvas(kf.bitmap));
      files.push({ name: `framepick-${timecodeSlug(kf.time)}.png`, data: bytes });
    }
    downloadBlob(new Blob([zipStore(files)], { type: "application/zip" }), "framepick-keyframes.zip");
    showToast(`Saved ${files.length} keyframes`);
  } catch (err) {
    showError(`Could not build the zip: ${err.message}`);
  } finally {
    els.downloadAll.textContent = "Download all as .zip";
    els.downloadAll.disabled = state.keyframes.length === 0;
  }
}

// ---- Wiring ---------------------------------------------------------------

function initDropzone() {
  const dz = els.dropzone;

  els.pickBtn.addEventListener("click", () => els.fileInput.click());
  els.pickBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  els.fileInput.addEventListener("change", () => startAnalysis(els.fileInput.files[0]));

  // Drop anywhere on the page — a small dropzone is a small target. preventDefault on dragover is
  // required or the browser navigates to the dropped file. The dropzone highlights as the cue.
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragDepth++;
    dz.classList.add("dragover");
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dz.classList.remove("dragover");
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    dz.classList.remove("dragover");
    startAnalysis(e.dataTransfer?.files?.[0]);
  });
}

function initControls() {
  els.sensitivity.value = String(DEFAULT_SENSITIVITY);
  els.sensValue.textContent = String(DEFAULT_SENSITIVITY);
  els.sensitivity.addEventListener("input", () => {
    els.sensValue.textContent = els.sensitivity.value;
    if (state.samples.length > 0) resegment();
  });
  els.downloadAll.addEventListener("click", exportAll);
}

function main() {
  const support = detectSupport();
  if (!support.ok) {
    els.unsupported.hidden = false;
    els.unsupported.textContent =
      `This browser is missing ${support.missing.join(", ")}. ` +
      `Framepick needs the WebCodecs pipeline; try a recent Chrome, Edge, or Safari.`;
    return;
  }
  initDropzone();
  initControls();
}

main();
