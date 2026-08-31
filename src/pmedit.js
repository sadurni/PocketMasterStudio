// pmedit.js — in-browser "incorporate" engine: merge an AI-pasted artist source into
// data/, and make a pedal-edited preset "definitive" via overrides. Pure functions.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMEdit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Normalize any export shape into a flat list of preset objects.
  function presetsOf(d) {
    if (Array.isArray(d)) return d.filter((p) => p && typeof p === "object");
    if (d && Array.isArray(d.presets)) return d.presets.filter((p) => p && typeof p === "object");
    if (d && d.modules) return [d];
    return [];
  }

  // Guess what a pasted JSON is: 'source' (data/<Artist>.json), 'export' (pedal preset/batch), or 'unknown'.
  function detectFormat(d) {
    if (d && Array.isArray(d.songs) && d.songs[0] && Array.isArray(d.songs[0].variants)) return "source";
    if (presetsOf(d).some((p) => p.modules)) return "export";
    if (d && Array.isArray(d.songs)) return "source";   // songs present but empty variants
    return "unknown";
  }

  // presetName -> [artists], from the built library (library.modeled / .nam).
  function buildNameIndex(library) {
    const idx = {};
    const add = (arr) => {
      for (const a of arr) for (const s of a.songs) for (const p of s.presets) {
        (idx[p.n] || (idx[p.n] = [])).push(a.artist);
      }
    };
    if (library.modeled) add(library.modeled);
    if (library.nam) add(library.nam);
    for (const k of Object.keys(idx)) idx[k] = [...new Set(idx[k])];
    return idx;
  }

  // Make a pedal export "definitive": match each preset by name -> artist, store as an override
  // (Normal -> factory_overrides, Clone -> nam_overrides), keyed "Artist|PresetName".
  // Returns a NEW payload plus a report. Does not regenerate (caller rebuilds + validates).
  function makeDefinitive(payload, exportData, opts) {
    opts = opts || {};
    const p2 = clone(payload);
    p2.factory_overrides = Object.assign({}, payload.factory_overrides || {});
    p2.nam_overrides = Object.assign({}, payload.nam_overrides || {});
    const index = opts.nameIndex || {};
    const applied = [], unmatched = [], ambiguous = [];
    for (const pr of presetsOf(exportData)) {
      if (!pr.modules) continue;
      const name = pr.presetName;
      let art = opts.artist || pr.artist;
      if (!art) {
        const cand = index[name] || [];
        if (cand.length === 0) { unmatched.push(name); continue; }
        if (cand.length > 1) { ambiguous.push({ name, artists: cand }); continue; }
        art = cand[0];
      }
      const key = art + "|" + name;
      const rec = { ampMode: pr.ampMode, presetVolume: pr.presetVolume, modules: pr.modules };
      if ((pr.ampMode || "Normal") === "Clone") p2.nam_overrides[key] = rec;
      else p2.factory_overrides[key] = rec;
      applied.push({ name, artist: art, mode: pr.ampMode || "Normal", key });
    }
    return { payload: p2, applied, unmatched, ambiguous };
  }

  // Remove a stored override (un-freeze a preset) by "Artist|PresetName".
  function removeOverride(payload, key, which) {
    const p2 = clone(payload);
    p2.factory_overrides = Object.assign({}, payload.factory_overrides || {});
    p2.nam_overrides = Object.assign({}, payload.nam_overrides || {});
    if (which === "nam" || which == null) delete p2.nam_overrides[key];
    if (which === "factory" || which == null) delete p2.factory_overrides[key];
    return p2;
  }

  // Merge an AI-pasted artist source ({name, songs:[...]}) into config/data.
  // New artist -> appended to order (or at `position`). Existing -> songs merged by slug
  // (existing slug replaced, with a warning). Returns a NEW payload + report. Caller rebuilds
  // to validate (buildSongs throws on invalid params / >50 presets).
  function addArtistSource(payload, artistObj, opts) {
    opts = opts || {};
    if (!artistObj || !artistObj.name || !Array.isArray(artistObj.songs))
      throw new Error("El JSON de artista debe tener 'name' y 'songs'.");
    const p2 = clone(payload);
    p2.config = clone(payload.config);
    p2.data = Object.assign({}, payload.data);
    const name = artistObj.name;
    const isNew = !p2.config.order.includes(name);
    const warnings = [];
    if (isNew) {
      if (opts.position != null) p2.config.order.splice(opts.position, 0, name);
      else p2.config.order.push(name);
      p2.data[name] = clone(artistObj);
    } else {
      const existing = clone(p2.data[name]);
      const idxBySlug = {};
      existing.songs.forEach((s, i) => { idxBySlug[s.slug] = i; });
      for (const s of artistObj.songs) {
        if (idxBySlug[s.slug] != null) { existing.songs[idxBySlug[s.slug]] = clone(s); warnings.push("Canción '" + s.slug + "' ya existía — reemplazada."); }
        else { existing.songs.push(clone(s)); idxBySlug[s.slug] = existing.songs.length - 1; }
      }
      p2.data[name] = existing;
    }
    return { payload: p2, isNew, warnings, name };
  }

  // Flat catalog of every generated preset, for the searchable picker.
  function presetCatalog(jsonMap) {
    const out = [];
    for (const rel of Object.keys(jsonMap)) {
      if (rel.includes("/") || !rel.endsWith(".json")) continue;
      const d = jsonMap[rel];
      if (!d || d.type !== "PocketMasterBatch" || !d.artist) continue;
      for (const p of d.presets) out.push({ artist: d.artist, slug: p.song, kind: p.kind, name: p.presetName, title: (p.description || "").split(":")[0] });
    }
    return out;
  }

  function _removeArtist(p2, art) {
    delete p2.data[art];
    const i = p2.config.order.indexOf(art);
    if (i >= 0) p2.config.order.splice(i, 1);
  }
  // Delete selected source items. sel: [{artist, slug?, index?}] — {artist} = whole artist,
  // {artist,slug} = whole song, {artist,slug,index} = one variant. Empties are pruned; tone_bc/
  // double_chorus entries pointing at removed songs are cleaned. Returns a NEW payload.
  function deleteSelections(payload, sel) {
    const p2 = clone(payload);
    p2.config = clone(payload.config);
    p2.data = clone(payload.data);
    const byArtist = {};
    for (const s of sel) (byArtist[s.artist] || (byArtist[s.artist] = [])).push(s);
    for (const art of Object.keys(byArtist)) {
      const items = byArtist[art];
      if (items.some((s) => s.slug == null)) { _removeArtist(p2, art); continue; }
      const a = p2.data[art]; if (!a) continue;
      const wholeSongs = new Set(items.filter((s) => s.index == null).map((s) => s.slug));
      const perSong = {};
      items.filter((s) => s.index != null).forEach((s) => { (perSong[s.slug] || (perSong[s.slug] = new Set())).add(s.index); });
      a.songs = a.songs.filter((song) => {
        if (wholeSongs.has(song.slug)) return false;
        if (perSong[song.slug]) song.variants = song.variants.filter((v, i) => !perSong[song.slug].has(i));
        return song.variants.length > 0;
      });
      if (a.songs.length === 0) _removeArtist(p2, art);
    }
    const hasSong = (art, slug) => p2.data[art] && p2.data[art].songs.some((s) => s.slug === slug);
    if (p2.config.tone_bc) p2.config.tone_bc = p2.config.tone_bc.filter((e) => hasSong(e.artist, e.slug));
    if (p2.config.double_chorus) p2.config.double_chorus = p2.config.double_chorus.filter((dc) => hasSong(dc[0], dc[1]));
    return p2;
  }

  // Ensure payload.collections exists (seed from defaults on first edit).
  function ensureCollections(payload, defaultDefs) {
    if (!payload.collections) payload.collections = clone(defaultDefs);
    return payload;
  }
  // Given built files + collection defs, list the gaps (refs that no longer resolve) per collection.
  function collectionGaps(resolver, defs) {
    const gaps = [];
    defs.forEach((d, ci) => {
      d.refs.forEach((ref, ri) => { if (!resolver.exists(ref)) gaps.push({ ci, ri, collection: d.collection, ref }); });
    });
    return gaps;
  }

  const NAM_CAPTURES = new Set(["AC30 May", "JCM800", "Plexi", "TwinCln", "SoloSLO"]);
  // Source presets are Modeled-only (the app auto-generates the NAM/Clone twins). Remove any
  // NAM/Clone variants an AI may have added, and drop the ignored `ampMode` field.
  // Returns { cleaned, removed:[labels] }.
  function cleanArtistSource(artistObj) {
    if (!artistObj || !Array.isArray(artistObj.songs)) return { cleaned: artistObj, removed: [] };
    const removed = [];
    const songs = artistObj.songs.map((s) => {
      const variants = (s.variants || []).filter((v) => {
        const cloneAmp = v.mods && v.mods.AMP && NAM_CAPTURES.has(v.mods.AMP.effect);
        const isClone = v.ampMode === "Clone" || cloneAmp || (v.mods && v.mods.Clone);
        if (isClone) { removed.push((s.short || s.slug || "?") + " " + (v.kind || "")); return false; }
        return true;
      }).map((v) => { const r = Object.assign({}, v); delete r.ampMode; return r; });
      return Object.assign({}, s, { variants });
    }).filter((s) => s.variants.length);
    return { cleaned: Object.assign({}, artistObj, { songs }), removed };
  }

  return { presetsOf, detectFormat, buildNameIndex, makeDefinitive, removeOverride, addArtistSource,
    presetCatalog, deleteSelections, ensureCollections, collectionGaps, cleanArtistSource };
});
