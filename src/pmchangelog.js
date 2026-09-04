// pmchangelog.js — timestamps + change history for the PocketMaster project. Shared, unchanged, by
// the Node build (build_studio.js / export_tree.js) and the in-browser Studio (Export ZIP). It:
//   • stamps `created` / `modified` (full ISO-8601 UTC datetime) on each artist file, song, preset,
//     override entry and collection;
//   • keeps a content-hash SNAPSHOT + a dated BATCH history in changelog.json, so it can detect what
//     changed since the last full export (additions, modifications AND removals) down to the preset;
//   • renders the README "Recent changes" section (no dates, only the relevant batch/period) and the
//     full CHANGELOG.md history (with dates).
// The boundary only advances on a full export / regeneration — never on a plain HTML Save.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMChangelog = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- hashing (FNV-1a 32-bit over a key-order-independent stringification) ----
  function stableStr(x) {
    if (x === null || typeof x !== "object") return JSON.stringify(x === undefined ? null : x);
    if (Array.isArray(x)) return "[" + x.map(stableStr).join(",") + "]";
    return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + stableStr(x[k])).join(",") + "}";
  }
  function hash(str) {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, "0");
  }

  // ---- content projections (exclude created/modified so stamping never re-flags an item) ----
  const presetContent = (v) => ({ kind: v.kind, role: v.role, desc: v.desc, mods: v.mods });
  const songContent = (s) => ({ slug: s.slug, short: s.short });
  const artistContent = (a) => ({ name: a.name });
  const overrideContent = (o) => { const r = {}; for (const k in o) if (k !== "created" && k !== "modified") r[k] = o[k]; return r; };
  const collectionContent = (c) => ({ file: c.file, collection: c.collection, n: c.n, refs: c.refs });

  // preset key within a song = variant kind, disambiguated (#2, #3…) when a kind repeats.
  function presetIndex(variants) {
    const idx = {}, seen = {};
    for (const v of variants) {
      let k = v.kind;
      if (seen[v.kind] != null) { seen[v.kind]++; k = v.kind + "#" + seen[v.kind]; } else seen[v.kind] = 1;
      idx[k] = v;
    }
    return idx;
  }
  const _kindOf = (k) => String(k).split("#")[0];
  const _artistPresetCount = (a) => (a && a.songs || []).reduce((n, s) => n + (s.variants || []).length, 0);
  const _songMap = (a) => { const m = {}; for (const s of (a && a.songs) || []) m[s.slug] = s; return m; };

  // ---- snapshot of the whole project ----
  function snapshot(data, fov, nov, collections) {
    const artists = {};
    for (const name of Object.keys(data || {})) {
      const a = data[name]; const songs = {};
      for (const s of a.songs || []) {
        const presets = {}, seen = {};
        for (const v of s.variants || []) {
          let k = v.kind;
          if (seen[v.kind] != null) { seen[v.kind]++; k = v.kind + "#" + seen[v.kind]; } else seen[v.kind] = 1;
          presets[k] = hash(stableStr(presetContent(v)));
        }
        songs[s.slug] = { h: hash(stableStr(songContent(s))), presets };
      }
      artists[name] = { h: hash(stableStr(artistContent(a))), songs };
    }
    const overrides = {};
    const addOv = (obj, ns) => { for (const k of Object.keys(obj || {})) overrides[ns + "|" + k] = hash(stableStr(overrideContent(obj[k]))); };
    addOv(fov, "factory"); addOv(nov, "nam");
    const cols = {};
    for (const c of collections || []) cols[c.file || c.collection] = hash(stableStr(collectionContent(c)));
    return { artists, overrides, collections: cols };
  }

  // ---- diff two snapshots ----
  function emptyChanges() {
    return {
      artists: { added: [], removed: [], modified: {} },
      overrides: { added: [], removed: [], modified: [] },
      collections: { added: [], removed: [], modified: [] },
    };
  }
  function diff(prev, cur) {
    prev = prev || { artists: {}, overrides: {}, collections: {} };
    const ch = emptyChanges();
    for (const name of Object.keys(cur.artists)) {
      if (!(name in prev.artists)) { ch.artists.added.push(name); continue; }
      const pa = prev.artists[name], ca = cur.artists[name];
      const m = { songsAdded: [], songsRemoved: [], songsModified: {}, meta: pa.h !== ca.h };
      for (const slug of Object.keys(ca.songs)) {
        if (!(slug in pa.songs)) { m.songsAdded.push(slug); continue; }
        const ps = pa.songs[slug], cs = ca.songs[slug];
        const sm = { presetsAdded: [], presetsRemoved: [], presetsModified: [], meta: ps.h !== cs.h };
        for (const k of Object.keys(cs.presets)) {
          if (!(k in ps.presets)) sm.presetsAdded.push(k);
          else if (ps.presets[k] !== cs.presets[k]) sm.presetsModified.push(k);
        }
        for (const k of Object.keys(ps.presets)) if (!(k in cs.presets)) sm.presetsRemoved.push(k);
        if (sm.meta || sm.presetsAdded.length || sm.presetsRemoved.length || sm.presetsModified.length) m.songsModified[slug] = sm;
      }
      for (const slug of Object.keys(pa.songs)) if (!(slug in ca.songs)) m.songsRemoved.push(slug);
      if (m.meta || m.songsAdded.length || m.songsRemoved.length || Object.keys(m.songsModified).length) ch.artists.modified[name] = m;
    }
    for (const name of Object.keys(prev.artists)) if (!(name in cur.artists)) ch.artists.removed.push(name);
    const kd = (p, c, out) => {
      for (const k of Object.keys(c)) { if (!(k in p)) out.added.push(k); else if (p[k] !== c[k]) out.modified.push(k); }
      for (const k of Object.keys(p)) if (!(k in c)) out.removed.push(k);
    };
    kd(prev.overrides, cur.overrides, ch.overrides);
    kd(prev.collections, cur.collections, ch.collections);
    return ch;
  }
  function isEmpty(ch) {
    return !ch.artists.added.length && !ch.artists.removed.length && !Object.keys(ch.artists.modified).length &&
      !ch.overrides.added.length && !ch.overrides.removed.length && !ch.overrides.modified.length &&
      !ch.collections.added.length && !ch.collections.removed.length && !ch.collections.modified.length;
  }

  // ---- stamping (mutates the source objects in place) ----
  const _added = (o, now) => { if (o) { o.created = now; o.modified = now; } };
  const _mod = (o, now) => { if (o) { if (!o.created) o.created = now; o.modified = now; } };
  function _orderKeys(o, first) { const out = {}; for (const k of first) if (k in o) out[k] = o[k]; for (const k of Object.keys(o)) if (!(k in out)) out[k] = o[k]; return out; }
  function _orderSong(s) {
    const variants = (s.variants || []).map((v) => _orderKeys(v, ["kind", "role", "created", "modified", "desc", "mods"]));
    const o = _orderKeys(s, ["slug", "short", "created", "modified"]); o.variants = variants; return o;
  }
  function _orderArtist(a) {
    const songs = (a.songs || []).map(_orderSong);
    const o = _orderKeys(a, ["name", "created", "modified"]); o.songs = songs; return o;
  }
  function stampAll(data, fov, nov, collections, now) {
    for (const name of Object.keys(data || {})) {
      const a = data[name]; _added(a, now);
      for (const s of a.songs || []) { _added(s, now); for (const v of s.variants || []) _added(v, now); }
      data[name] = _orderArtist(a);
    }
    for (const k of Object.keys(fov || {})) _added(fov[k], now);
    for (const k of Object.keys(nov || {})) _added(nov[k], now);
    for (const c of collections || []) _added(c, now);
  }
  function stampChanges(data, fov, nov, collections, ch, now, touched) {
    const touchedSet = new Set();
    for (const name of ch.artists.added) {
      const a = data[name]; if (!a) continue;
      _added(a, now);
      for (const s of a.songs || []) { _added(s, now); for (const v of s.variants || []) _added(v, now); }
      data[name] = _orderArtist(a); touchedSet.add(name);
    }
    for (const name of Object.keys(ch.artists.modified)) {
      const a = data[name]; if (!a) continue;
      _mod(a, now); const m = ch.artists.modified[name]; const sm = _songMap(a);
      for (const slug of m.songsAdded) { const s = sm[slug]; if (s) { _added(s, now); for (const v of s.variants || []) _added(v, now); } }
      for (const slug of Object.keys(m.songsModified)) {
        const s = sm[slug]; if (!s) continue; _mod(s, now);
        const idx = presetIndex(s.variants || []); const d = m.songsModified[slug];
        for (const k of d.presetsAdded) _added(idx[k], now);
        for (const k of d.presetsModified) _mod(idx[k], now);
      }
      data[name] = _orderArtist(a); touchedSet.add(name);
    }
    touched.artists = [...touchedSet];
    const stampOv = (key, isAdd) => {
      const i = key.indexOf("|"); const ns = key.slice(0, i), k = key.slice(i + 1);
      const obj = ns === "factory" ? fov : nov;
      if (obj && obj[k]) { isAdd ? _added(obj[k], now) : _mod(obj[k], now); }
      touched.overrides = true;
    };
    for (const key of ch.overrides.added) stampOv(key, true);
    for (const key of ch.overrides.modified) stampOv(key, false);
    if (ch.overrides.removed.length) touched.overrides = true;
    const cby = {}; for (const c of collections || []) cby[c.file || c.collection] = c;
    for (const k of ch.collections.added) { _added(cby[k], now); touched.collections = true; }
    for (const k of ch.collections.modified) { _mod(cby[k], now); touched.collections = true; }
    if (ch.collections.removed.length) touched.collections = true;
  }

  // ---- advance the state at a full export/regeneration ----
  // Returns { state, batch, changed, baseline, touched }. Mutates data/fov/nov/collections (stamps).
  function advance(state, data, fov, nov, collections, now, opts) {
    state = state && typeof state === "object" ? state : {};
    if (!Array.isArray(state.batches)) state.batches = [];
    const prev = state.snapshot;
    const baseline = !prev || !prev.artists || !Object.keys(prev.artists).length;
    const touched = { artists: [], overrides: false, collections: false };
    if (baseline) {
      stampAll(data, fov, nov, collections, now);
      let songs = 0, presets = 0; const names = Object.keys(data || {});
      for (const name of names) { const a = data[name]; songs += (a.songs || []).length; presets += _artistPresetCount(a); }
      const batch = { at: now, baseline: true, totals: { artists: names.length, songs, presets } };
      state.snapshot = snapshot(data, fov, nov, collections);
      state.lastExport = now; state.batches.push(batch);
      touched.artists = names;
      touched.overrides = !!(fov && Object.keys(fov).length) || !!(nov && Object.keys(nov).length);
      touched.collections = !!(collections && collections.length);
      return { state, batch, changed: true, baseline: true, touched };
    }
    const cur = snapshot(data, fov, nov, collections);
    const ch = diff(prev, cur);
    if (isEmpty(ch)) return { state, batch: null, changed: false, baseline: false, touched };
    stampChanges(data, fov, nov, collections, ch, now, touched);
    const batch = { at: now, changes: ch };
    state.snapshot = snapshot(data, fov, nov, collections); // == cur (created/modified excluded from hashes)
    state.lastExport = now; state.batches.push(batch);
    return { state, batch, changed: true, baseline: false, touched };
  }

  // ---- rendering ----
  function _uniq(a) { return [...new Set(a)]; }
  function mergeChanges(list) {
    const out = emptyChanges();
    for (const ch of list) {
      out.artists.added.push(...ch.artists.added); out.artists.removed.push(...ch.artists.removed);
      for (const name of Object.keys(ch.artists.modified)) {
        const src = ch.artists.modified[name];
        const dst = out.artists.modified[name] || (out.artists.modified[name] = { songsAdded: [], songsRemoved: [], songsModified: {}, meta: false });
        dst.songsAdded.push(...src.songsAdded); dst.songsRemoved.push(...src.songsRemoved); dst.meta = dst.meta || src.meta;
        for (const slug of Object.keys(src.songsModified)) {
          const s = src.songsModified[slug];
          const d = dst.songsModified[slug] || (dst.songsModified[slug] = { presetsAdded: [], presetsRemoved: [], presetsModified: [], meta: false });
          d.presetsAdded.push(...s.presetsAdded); d.presetsModified.push(...s.presetsModified); d.presetsRemoved.push(...s.presetsRemoved); d.meta = d.meta || s.meta;
        }
      }
      for (const kind of ["added", "modified", "removed"]) { out.overrides[kind].push(...ch.overrides[kind]); out.collections[kind].push(...ch.collections[kind]); }
    }
    out.artists.added = _uniq(out.artists.added); out.artists.removed = _uniq(out.artists.removed);
    for (const name of Object.keys(out.artists.modified)) {
      const m = out.artists.modified[name]; m.songsAdded = _uniq(m.songsAdded); m.songsRemoved = _uniq(m.songsRemoved);
      for (const slug of Object.keys(m.songsModified)) { const d = m.songsModified[slug]; d.presetsAdded = _uniq(d.presetsAdded); d.presetsModified = _uniq(d.presetsModified); d.presetsRemoved = _uniq(d.presetsRemoved); }
    }
    for (const kind of ["added", "modified", "removed"]) { out.overrides[kind] = _uniq(out.overrides[kind]); out.collections[kind] = _uniq(out.collections[kind]); }
    return out;
  }
  function renderChanges(ch, ctx) {
    ctx = ctx || {};
    const data = ctx.data || {};
    const colName = {}; for (const c of ctx.collections || []) colName[c.file || c.collection] = c.collection || c.file;
    const nm = (key) => colName[key] || String(key).replace(/^Compilation_|\.json$/g, "");
    const L = [];
    for (const name of ch.artists.added.slice().sort()) {
      const a = data[name]; const ns = a ? (a.songs || []).length : 0; const np = a ? _artistPresetCount(a) : 0;
      L.push("- ➕ **" + name + "** — new artist (" + ns + " song" + (ns === 1 ? "" : "s") + ", " + np + " preset" + (np === 1 ? "" : "s") + ")");
    }
    for (const name of Object.keys(ch.artists.modified).sort()) {
      const m = ch.artists.modified[name]; const sm = _songMap(data[name]); const parts = [];
      for (const slug of m.songsAdded.slice().sort()) { const s = sm[slug]; const np = s ? (s.variants || []).length : 0; parts.push("+ new song “" + (s ? (s.short || slug) : slug) + "” (" + np + " preset" + (np === 1 ? "" : "s") + ")"); }
      for (const slug of Object.keys(m.songsModified).sort()) {
        const d = m.songsModified[slug]; const s = sm[slug]; const label = s ? (s.short || slug) : slug; const sub = [];
        if (d.presetsAdded.length) sub.push(d.presetsAdded.length + " added (" + d.presetsAdded.map(_kindOf).join(", ") + ")");
        if (d.presetsModified.length) sub.push(d.presetsModified.length + " changed (" + d.presetsModified.map(_kindOf).join(", ") + ")");
        if (d.presetsRemoved.length) sub.push(d.presetsRemoved.length + " removed (" + d.presetsRemoved.map(_kindOf).join(", ") + ")");
        parts.push("“" + label + "”: " + (sub.length ? sub.join(", ") : "updated"));
      }
      for (const slug of m.songsRemoved.slice().sort()) parts.push("− removed song “" + slug + "”");
      if (!parts.length && m.meta) parts.push("metadata updated");
      if (parts.length) L.push("- ✏️ **" + name + "** — " + parts.join("; "));
    }
    for (const name of ch.artists.removed.slice().sort()) L.push("- ➖ **" + name + "** — removed");
    const cp = [];
    if (ch.collections.added.length) cp.push("added " + ch.collections.added.map(nm).join(", "));
    if (ch.collections.modified.length) cp.push("updated " + ch.collections.modified.map(nm).join(", "));
    if (ch.collections.removed.length) cp.push("removed " + ch.collections.removed.map(nm).join(", "));
    if (cp.length) L.push("- 🎚️ **Collections** — " + cp.join("; "));
    const op = []; const o = ch.overrides;
    if (o.added.length) op.push(o.added.length + " added");
    if (o.modified.length) op.push(o.modified.length + " changed");
    if (o.removed.length) op.push(o.removed.length + " removed");
    if (op.length) L.push("- 🎯 **Overrides** — " + op.join(", "));
    return L.join("\n");
  }
  // The README section body (no dates): the last batch, or — when `since` is given — everything from
  // `since` onward (ISO string, compared lexicographically against each batch's timestamp).
  function renderRecent(state, ctx, since) {
    state = state || { batches: [] }; const batches = state.batches || [];
    if (!batches.length) return "_No changes recorded yet._";
    let picked;
    if (since) { picked = batches.filter((b) => String(b.at) >= String(since)); if (!picked.length) return "_No changes in the selected period._"; }
    else picked = [batches[batches.length - 1]];
    const nonBaseline = picked.filter((b) => !b.baseline);
    const baseline = picked.find((b) => b.baseline);
    if (baseline && !nonBaseline.length) {
      const t = baseline.totals || {};
      return "_Baseline established: " + t.artists + " artists, " + t.songs + " songs, " + t.presets + " presets._";
    }
    const body = renderChanges(mergeChanges(nonBaseline.map((b) => b.changes).filter(Boolean)), ctx) || "_No changes since the last full export._";
    return (baseline ? "_(includes the initial baseline)_\n\n" : "") + body;
  }
  function fmtDate(iso) {
    try {
      const d = new Date(iso); const p = (n) => String(n).padStart(2, "0");
      return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + " UTC";
    } catch (e) { return String(iso); }
  }
  function renderChangelogMd(state, ctx) {
    state = state || { batches: [] };
    const out = ["# Changelog", "", "_Full history of every change recorded at each complete export/regeneration (newest first). The README shows only the latest; this file keeps them all._", ""];
    const bs = (state.batches || []).slice().reverse();
    if (!bs.length) { out.push("_No changes recorded yet._"); return out.join("\n") + "\n"; }
    for (const b of bs) {
      out.push("## " + fmtDate(b.at) + (b.baseline ? " — baseline" : ""));
      out.push("");
      if (b.baseline) { const t = b.totals || {}; out.push("- Baseline established: " + t.artists + " artists, " + t.songs + " songs, " + t.presets + " presets"); }
      else out.push(renderChanges(b.changes, ctx) || "- (no changes)");
      out.push("");
    }
    return out.join("\n");
  }

  // ---- README section splice (heading-delimited; safe for the pmmd renderer, no HTML comments) ----
  const RECENT_HEADING = "## 🕘 Recent changes";
  function applyRecent(md, sectionBody, subtitle) {
    md = String(md || "");
    const block = RECENT_HEADING + "\n\n" + (subtitle ? "_" + subtitle + "_\n\n" : "") + String(sectionBody || "").trim() + "\n";
    const re = /\n## 🕘 Recent changes[\s\S]*?(?=\n## )/;
    if (re.test(md)) return md.replace(re, "\n" + block);
    const m = md.match(/\n## /);
    if (m) return md.slice(0, m.index) + "\n" + block + md.slice(m.index);
    return md.replace(/\s*$/, "") + "\n\n" + block;
  }

  // ---- Node-only: read changelog.json, advance, write back data/overrides/collections + changelog ----
  function advanceOnDisk(io) {
    const fs = require("fs"), path = require("path");
    const stringify = io.stringify || ((o) => JSON.stringify(o, null, 2));
    const clogPath = path.join(io.root, "changelog.json");
    let state = null; try { state = JSON.parse(fs.readFileSync(clogPath, "utf-8")); } catch (e) {}
    const res = advance(state, io.data, io.fov, io.nov, io.collections, io.now, {});
    if (res.changed) {
      for (const name of res.touched.artists) if (io.data[name]) fs.writeFileSync(path.join(io.dataDir, name.replace(/\//g, "-") + ".json"), stringify(io.data[name]), "utf-8");
      if (res.touched.overrides) {
        fs.writeFileSync(path.join(io.root, "factory_overrides.json"), stringify(io.fov || {}), "utf-8");
        fs.writeFileSync(path.join(io.root, "nam_overrides.json"), stringify(io.nov || {}), "utf-8");
      }
      if (res.touched.collections && io.collections) fs.writeFileSync(path.join(io.root, "collections.json"), stringify(io.collections), "utf-8");
      fs.writeFileSync(clogPath, JSON.stringify(res.state, null, 1), "utf-8");
      fs.writeFileSync(path.join(io.root, "CHANGELOG.md"), renderChangelogMd(res.state, { data: io.data, collections: io.collections }), "utf-8");
    }
    const ctx = { data: io.data, collections: io.collections };
    return { state: res.state, changed: res.changed, baseline: res.baseline, changelogMd: renderChangelogMd(res.state, ctx), recent: renderRecent(res.state, ctx, io.since || null) };
  }

  return {
    snapshot, diff, isEmpty, advance, advanceOnDisk,
    renderChanges, renderRecent, renderChangelogMd, applyRecent, mergeChanges,
    RECENT_HEADING, fmtDate, hash,
  };
});
