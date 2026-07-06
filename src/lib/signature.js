// Frame signatures — the compact fingerprint Framepick compares to find scene changes.
//
// Comparing full frames pixel-by-pixel is both slow and too sensitive (camera noise, grain,
// and compression artifacts would register as "change"). Instead every decoded frame is
// reduced to a small grid of average luma values — a signature that is cheap to compare and
// robust to fine detail while still capturing composition and brightness. A hard cut moves
// most cells at once; a static shot barely moves them.
//
// Pure module: input is a flat RGBA byte array (as produced by canvas getImageData /
// VideoFrame copyTo), so it runs identically in the browser worker and under node --test.

/**
 * Rec. 601 luma from 8-bit RGB. Kept as a named helper so tests can pin the weighting.
 * @param {number} r @param {number} g @param {number} b
 * @returns {number} 0..255
 */
export function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Reduce an RGBA frame to a `cols x rows` grid of average luma, normalized to 0..1.
 * Uses box averaging over each cell so downscaling is stable regardless of source size.
 *
 * @param {Uint8ClampedArray|Uint8Array|number[]} rgba length must be width*height*4
 * @param {number} width
 * @param {number} height
 * @param {{ cols?: number, rows?: number }} [grid]
 * @returns {Float32Array} length cols*rows, row-major, values in [0,1]
 */
export function frameSignature(rgba, width, height, grid = {}) {
  const cols = grid.cols ?? 8;
  const rows = grid.rows ?? 8;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError("frameSignature: width and height must be positive integers");
  }
  if (rgba.length < width * height * 4) {
    throw new RangeError("frameSignature: rgba shorter than width*height*4");
  }

  const sig = new Float32Array(cols * rows);
  const counts = new Uint32Array(cols * rows);

  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor((y / height) * rows));
    for (let x = 0; x < width; x++) {
      const cx = Math.min(cols - 1, Math.floor((x / width) * cols));
      const p = (y * width + x) * 4;
      const cell = cy * cols + cx;
      sig[cell] += luma(rgba[p], rgba[p + 1], rgba[p + 2]);
      counts[cell]++;
    }
  }

  for (let i = 0; i < sig.length; i++) {
    sig[i] = counts[i] > 0 ? sig[i] / counts[i] / 255 : 0;
  }
  return sig;
}

/**
 * Mean absolute difference between two equal-length signatures, in [0,1].
 * 0 means identical composition/brightness; larger means a bigger visual change.
 *
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number}
 */
export function signatureDistance(a, b) {
  if (a.length !== b.length) {
    throw new RangeError("signatureDistance: signatures must be the same length");
  }
  if (a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}
