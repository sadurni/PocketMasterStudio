// pmzip.js — tiny self-contained ZIP (create + read), no external libs.
// Uses the browser's deflate-raw (CompressionStream/DecompressionStream). Read supports
// STORE (0) and DEFLATE (8); Create uses DEFLATE.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMZip = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const enc = (s) => new TextEncoder().encode(s);
  const dec = (u8) => new TextDecoder().decode(u8);

  async function deflateRaw(u8) {
    if (typeof CompressionStream === "undefined") return null;
    const s = new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function inflateRaw(u8) {
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  // entries: [{name, data:(string|Uint8Array)}] -> Blob (application/zip)
  async function create(entries) {
    const parts = [], central = [];
    let offset = 0;
    for (const e of entries) {
      const nameB = enc(e.name);
      const data = typeof e.data === "string" ? enc(e.data) : e.data;
      const crc = crc32(data);
      let method = 0, body = data;
      const def = await deflateRaw(data);
      if (def && def.length < data.length) { method = 8; body = def; }
      const lh = new Uint8Array(30 + nameB.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); // UTF-8 flag
      dv.setUint16(8, method, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);       // time/date fixed
      dv.setUint32(14, crc, true); dv.setUint32(18, body.length, true); dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameB.length, true); dv.setUint16(28, 0, true);
      lh.set(nameB, 30);
      parts.push(lh, body);
      const ch = new Uint8Array(46 + nameB.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, method, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, body.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameB.length, true); cv.setUint32(42, offset, true);
      ch.set(nameB, 46);
      central.push(ch);
      offset += lh.length + body.length;
    }
    let cdSize = 0; for (const c of central) cdSize += c.length;
    const cdOffset = offset;
    for (const c of central) parts.push(c);
    const eocd = new Uint8Array(22); const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, cdOffset, true);
    parts.push(eocd);
    return new Blob(parts, { type: "application/zip" });
  }

  // arrayBuffer -> {name: Uint8Array} (decompressed). Reads the central directory.
  async function read(ab) {
    const u8 = new Uint8Array(ab), dv = new DataView(ab);
    // find EOCD (scan back for 0x06054b50)
    let eo = -1;
    for (let i = u8.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; } }
    if (eo < 0) throw new Error("ZIP inválido (sin EOCD).");
    const nEntries = dv.getUint16(eo + 10, true);
    let p = dv.getUint32(eo + 16, true);
    const out = {};
    for (let n = 0; n < nEntries; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec(u8.subarray(p + 46, p + 46 + nameLen));
      // local header to find data start
      const lNameLen = dv.getUint16(lho + 26, true), lExtra = dv.getUint16(lho + 28, true);
      const dataStart = lho + 30 + lNameLen + lExtra;
      const comp = u8.subarray(dataStart, dataStart + compSize);
      out[name] = method === 8 ? await inflateRaw(comp) : comp.slice();
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  return { create, read, crc32, dec };
});
