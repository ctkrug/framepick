// Framepick app entry — wires the dropzone to the (forthcoming) decode + analysis pipeline.
//
// SCOPE scaffold: this shell feature-detects WebCodecs, accepts a file via drag/drop or the
// picker, and reports what it received. The real decode → signature → scene-detection flow
// (src/lib/*, plus a Web Worker running the WebCodecs VideoDecoder) is built out in the BUILD
// phase against docs/BACKLOG.md.

import { detectSupport } from "./lib/support.js";
import { formatTimecode } from "./lib/timecode.js";

const els = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  pickBtn: document.getElementById("pickBtn"),
  unsupported: document.getElementById("unsupported"),
  status: document.getElementById("status"),
};

function showStatus(message) {
  els.status.hidden = false;
  els.status.textContent = message;
}

/** Placeholder handoff — BUILD replaces this with the worker-driven decode pipeline. */
function handleFile(file) {
  if (!file) return;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  showStatus(
    `Loaded “${file.name}” (${sizeMb} MB, ${file.type || "unknown type"}). ` +
      `Decode pipeline lands in the next build — see docs/BACKLOG.md.`,
  );
  // Prove the pure lib is wired and callable from the shell.
  console.info("[framepick] first frame timecode would render as", formatTimecode(0));
}

function initDropzone() {
  const dz = els.dropzone;

  els.pickBtn.addEventListener("click", () => els.fileInput.click());
  els.pickBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  els.fileInput.addEventListener("change", () => handleFile(els.fileInput.files[0]));

  ["dragenter", "dragover"].forEach((type) =>
    dz.addEventListener(type, (e) => {
      e.preventDefault();
      dz.classList.add("dragover");
    }),
  );
  ["dragleave", "drop"].forEach((type) =>
    dz.addEventListener(type, (e) => {
      e.preventDefault();
      if (type === "dragleave" && dz.contains(e.relatedTarget)) return;
      dz.classList.remove("dragover");
    }),
  );
  dz.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  });
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
}

main();
