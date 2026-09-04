// pmstats.js — compute the README headline stats and inject them into the README markdown, so the
// intro sentence always reflects the real generated numbers (artists / songs / presets / per-artist
// range, built-in cross-artist compilations, NAM captures). Shared, unchanged, by the Node build
// (build_studio.js) and the in-browser Studio (rebuild / ZIP export / Save), so every regeneration
// path prints the same live numbers.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMStats = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Derive the headline numbers from a built pipeline result.
  //   built: { summary:[{name,songs,presets,start}], total, artistCount }  (from PMBuild.buildSongs)
  //   opts:  { collections, defaultFiles, namCaptures }
  //     collections  — the current collection defs (null/undefined = the unmodified built-in set)
  //     defaultFiles — file names of the built-in collections (PMBuild.defaultCollectionDefs())
  //     namCaptures  — how many distinct NAM captures (PMBuild.NAM_CAPTURES.length)
  function compute(built, opts) {
    opts = opts || {};
    const summary = built.summary || [];
    let songs = 0, minPer = Infinity, maxPer = 0;
    for (const s of summary) {
      songs += s.songs;
      if (s.presets < minPer) minPer = s.presets;
      if (s.presets > maxPer) maxPer = s.presets;
    }
    if (!isFinite(minPer)) minPer = 0;
    // "built-in" = the default compilations still present; any others the user added are the
    // "(plus any you add)" — so this number stays honest to the sentence's wording.
    const defFiles = new Set(opts.defaultFiles || []);
    const compilations = (opts.collections == null)
      ? defFiles.size
      : opts.collections.filter((c) => defFiles.has(c.file)).length;
    return {
      artists: built.artistCount,
      songs,
      presets: built.total,
      minPer, maxPer,
      compilations,
      namCaptures: opts.namCaptures || 5,
    };
  }

  // The headline bullet, matching the README's original wording and characters (· and – en dash).
  function sentence(s) {
    const range = s.minPer === s.maxPer ? String(s.minPer) : (s.minPer + "–" + s.maxPer);
    return "- **" + s.artists + " artists · " + s.songs + " songs · " + s.presets +
      " presets** (" + range + " per artist) + **" + s.compilations + " built-in cross-artist\n" +
      "  compilations** (plus any you add), in **three amp sets**: **Modeled** (the tuned modeled amps),\n" +
      "  **Clone/NAM** (every preset on one of " + s.namCaptures + " NAM captures) and **Mixed** (the best choice per preset).";
  }

  // Matches the headline bullet whatever numbers it currently carries (across its wrapped lines).
  const RE = /- \*\*\d+ artists[\s\S]*?best choice per preset\)\./;

  // Replace the headline bullet in the README markdown with a freshly computed one. Idempotent;
  // if the headline can't be found the markdown is returned unchanged.
  function apply(md, stats) {
    md = String(md || "");
    return RE.test(md) ? md.replace(RE, sentence(stats)) : md;
  }

  return { compute, sentence, apply, RE };
});
