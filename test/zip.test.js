import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, zipStore } from "../src/lib/zip.js";

const bytes = (str) => new TextEncoder().encode(str);

/** Minimal reader: walk the central directory and pull each STORE entry back out. */
function readZip(archive) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  // End of central directory is the last 22 bytes (no comment).
  const eocd = archive.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "EOCD signature");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true); // central dir offset
  const entries = [];
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(p, true), 0x02014b50, "central signature");
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(archive.subarray(p + 46, p + 46 + nameLen));
    // Jump to the local header to read the stored bytes.
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = archive.subarray(dataStart, dataStart + size);
    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

test("crc32 matches known vectors", () => {
  assert.equal(crc32(bytes("")), 0);
  assert.equal(crc32(bytes("123456789")), 0xcbf43926);
  assert.equal(crc32(bytes("The quick brown fox jumps over the lazy dog")), 0x414fa339);
});

test("a single-file archive round-trips name and bytes", () => {
  const data = bytes("hello framepick");
  const zip = zipStore([{ name: "a.txt", data }]);
  assert.equal(zip[0], 0x50); // 'P'
  assert.equal(zip[1], 0x4b); // 'K'
  const out = readZip(zip);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "a.txt");
  assert.deepEqual([...out[0].data], [...data]);
});

test("multiple files all round-trip in order", () => {
  const files = [
    { name: "framepick-00m00s000.png", data: bytes("one") },
    { name: "framepick-00m01s500.png", data: bytes("two-two") },
    { name: "framepick-00m03s000.png", data: new Uint8Array([0, 255, 128, 7]) },
  ];
  const out = readZip(zipStore(files));
  assert.deepEqual(
    out.map((e) => e.name),
    files.map((f) => f.name),
  );
  out.forEach((e, i) => assert.deepEqual([...e.data], [...files[i].data]));
});

test("stored CRC in the local header matches crc32 of the data", () => {
  const data = bytes("checksum me");
  const zip = zipStore([{ name: "x", data }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(14, true), crc32(data));
});

test("an empty file list produces a valid empty archive", () => {
  const zip = zipStore([]);
  assert.equal(zip.length, 22); // EOCD only
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x06054b50);
  assert.equal(view.getUint16(10, true), 0); // zero entries
});
