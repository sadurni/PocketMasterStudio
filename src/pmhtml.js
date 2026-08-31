// pmhtml.js — port of the HTML/README generators (gen_index, gen_tabla, gen_m50_map).
// Pure: give it the in-memory json folder map, get back {relpath: text}.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMHtml = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Python html.escape(s, quote=True)
  function esc(x) {
    return String(x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }

  const DRVMAP = {
    "Scream": "Scream (TS)", "Grey Fuzz": "Grey Fuzz (Muff)", "Red Fuzz": "Red Fuzz (FzFace)",
    "Dark Mouse": "Dark Mouse (Rat)", "JP Dist": "JP Dist", "Shark": "Shark (DS-1)",
    "Butter OD": "Butter OD", "Bass Drive": "Bass Drive",
  };
  const KIND_LABEL = {
    C: "Cln", R: "Rit", D: "Drv", H: "Hvy", L: "Sol", L2: "Sol2", L3: "Sol3",
    La: "SolA", Lb: "SolB", Lc: "SolC", Ld: "SolDt", Lh: "SolCh",
  };
  const LEAD_KINDS = new Set(["L", "L2", "L3", "La", "Lb", "Lc", "Ld", "Lh"]);

  const amp = (p) => { const mm = p.modules; const m = mm.AMP || mm.Clone; return m && m.enabled ? m.effect : "-"; };
  const drive = (p) => {
    const m = p.modules;
    if (m.DRV.enabled) return DRVMAP[m.DRV.effect] || m.DRV.effect;
    if (m.FX1.enabled && m.FX1.effect === "Boost") return "Boost (tr.boost)";
    return "-";
  };
  const song_title = (p) => p.description.split(":")[0];
  const pkind = (p) => {
    if (p.kind) return p.kind;
    const tok = p.presetName.trim().split(/\s+/);
    const last = tok.length ? tok[tok.length - 1] : "";
    return last in KIND_LABEL ? last : "R";
  };
  const klabel = (p) => KIND_LABEL[pkind(p)] || pkind(p);
  const is_lead = (p) => LEAD_KINDS.has(pkind(p));

  function songs_of(d) {
    const groups = [];
    for (const p of d.presets) {
      const key = p.song || song_title(p);
      if (groups.length && groups[groups.length - 1][0] === key) groups[groups.length - 1][1].push(p);
      else groups.push([key, [p]]);
    }
    return groups;
  }

  // Split the top-level folder map into artist packages and collections (mirrors the globbing).
  function classify(folderMap) {
    const artistNames = [], data = {}, colls = [];
    const topKeys = Object.keys(folderMap).filter((k) => !k.includes("/") && k.endsWith(".json")).sort();
    for (const k of topKeys) {
      const b = k.slice(0, -5);
      if (b.startsWith("Compare_")) continue;
      const d = folderMap[k];
      if (d && d.type === "PocketMasterBatch" && "artist" in d && !b.startsWith("Compilation")) {
        artistNames.push(b); data[b] = d;
      } else if (d && d.type === "PocketMasterBatch" && "collection" in d) {
        colls.push(d);
      }
    }
    return { artistNames, data, colls };
  }

  function buildIndex(folderMap) {
    const { artistNames: ORDER, data, colls } = classify(folderMap);
    const songs = {};
    for (const n of ORDER) songs[n] = songs_of(data[n]);
    const AORDER = [...ORDER].sort((a, b) => {
      const x = data[a].artist.toLowerCase(), y = data[b].artist.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
    for (const n of AORDER)
      songs[n] = songs[n].slice().sort((g1, g2) => {
        const x = song_title(g1[1][0]).toLowerCase(), y = song_title(g2[1][0]).toLowerCase();
        return x < y ? -1 : x > y ? 1 : 0;
      });
    const tot_songs = ORDER.reduce((s, n) => s + songs[n].length, 0);
    const tot_pr = Object.values(data).reduce((s, d) => s + d.count, 0);

    // ---- README.md ----
    const L = [
      "# Preset index - PocketMaster Sonicake\n",
      "Presets by **artist/song** to reproduce the guitar style of each track. " +
      "Each song has **the presets it actually needs** (1, 2, 3 or more), " +
      "ordered by tone from **calm to loud** (clean -> soft lead -> heavy rhythm -> loud lead).\n",
      "- **Per-artist package** `Artist.json` (`PocketMasterBatch`): all of the artist's presets with a `slot`, ending at `p50`. Import it with *Import Multiple* (respects the `slot`).",
      "- **Folders** `Artist/`: one JSON per preset **without slot** (`NNx_Song_Take.json`) and a **per-song bundle** `NN_Song_Presets.json` (all presets for that song, **without slot**).",
      "- Takes: **Cln** (clean rhythm), **Rit/Drv/Hvy** (rhythm with drive) and **Sol** (lead). High volume; leads leveled with the rhythm.",
      "- **Drive** column: DRV pedal used; `Boost (tr.boost)` = treble booster in front of the amp; `-` = amp only.\n",
      "## Summary\n",
      "| # | Artist | Songs | Presets | Slots | Package |",
      "|---|---------|:---------:|:-------:|:-----:|---------|",
    ];
    AORDER.forEach((n, idx) => {
      const d = data[n];
      L.push(`| ${idx + 1} | ${d.artist} | ${songs[n].length} | ${d.count} | ${d.slots} | \`${n}.json\` |`);
    });
    L.push(`\n**Total: ${ORDER.length} artists - ${tot_songs} songs - ${tot_pr} presets** (+ ${ORDER.length} packages).\n`);
    L.push("---\n\n## Detail by artist\n");
    AORDER.forEach((n, idx) => {
      const d = data[n];
      L.push(`### ${idx + 1}. ${d.artist}  -  slots \`${d.slots}\`  -  folder \`${n}/\`\n`);
      L.push("| # | Song | Take | Slot | Preset | AMP | Drive |");
      L.push("|---|---------|------|------|--------|-----|-------|");
      songs[n].forEach((g, si0) => {
        const [, ps] = g;
        ps.forEach((p, k) => {
          const cell_song = k === 0 ? song_title(p) : "";
          const cell_num = k === 0 ? String(si0 + 1) : "";
          L.push(`| ${cell_num} | ${cell_song} | ${klabel(p)} | \`p${p.slot}\` | ${p.presetName} | ${amp(p)} | ${drive(p)} |`);
        });
      });
      L.push("");
    });
    const readme = L.join("\n");

    // ---- index.html ----
    const cards = [];
    AORDER.forEach((n, idx) => {
      const d = data[n];
      const rows = [];
      songs[n].forEach((g, si0) => {
        const [, ps] = g;
        const title = song_title(ps[0]);
        const f = (title + " " + ps.map((p) => amp(p) + " " + drive(p)).join(" ")).toLowerCase();
        let prs = "";
        for (const p of ps) {
          const tcls = is_lead(p) ? "tL" : "tR";
          prs += '<div class="pr"><span class="tag ' + tcls + '">' + esc(klabel(p)) + "</span>" +
            '<span class="slot">p' + p.slot + "</span>" +
            '<span class="nm">' + esc(p.presetName) + "</span>" +
            '<span class="amp">' + esc(amp(p)) + "</span>" +
            '<span class="drv">' + esc(drive(p)) + "</span></div>";
        }
        rows.push('<div class="song" data-f="' + esc(f) + '">' +
          '<div class="sn">' + (si0 + 1) + ". " + esc(title) + "</div>" + prs + "</div>");
      });
      cards.push('<details class="art" data-a="' + esc(d.artist.toLowerCase()) + '">' +
        '<summary><span class="anum">' + (idx + 1) + '</span><span class="aname">' + esc(d.artist) + "</span>" +
        '<span class="meta">' + songs[n].length + " songs &middot; " + d.count + " presets &middot; slots " + esc(d.slots) + "</span></summary>" +
        '<div class="songs">' + rows.join("") + "</div></details>");
    });

    const COLL_ORDER = {
      "Interesting Solos": 0, "Classic Rock": 1, "A Bit of Everything": 2,
      "Best 50 (a bit of everything)": 3, "Best 50 v2 (calm/loud cycle by era)": 4,
    };
    const collsSorted = colls.slice().sort((a, b) =>
      (COLL_ORDER[a.collection] ?? 99) - (COLL_ORDER[b.collection] ?? 99));
    const comp_cards = [];
    for (const d of collsSorted) {
      let prs = "";
      const sorted = d.presets.slice().sort((a, b) => (a.slot || 0) - (b.slot || 0));
      for (const p of sorted) {
        const tcls = is_lead(p) ? "tL" : "tR";
        prs += '<div class="pr"><span class="tag ' + tcls + '">' + esc(klabel(p)) + "</span>" +
          '<span class="slot">p' + p.slot + "</span>" +
          '<span class="nm">' + esc(song_title(p)) +
          (p.artist ? " <i>&middot; " + esc(p.artist) + "</i>" : "") + "</span>" +
          '<span class="amp">' + esc(amp(p)) + "</span>" +
          '<span class="drv">' + esc(drive(p)) + "</span></div>";
      }
      const f = (d.collection + " " + d.presets.map((p) =>
        song_title(p) + " " + (p.artist || "") + " " + amp(p) + " " + drive(p)).join(" ")).toLowerCase();
      comp_cards.push('<details class="art comp" data-a="' + esc(d.collection.toLowerCase()) + '">' +
        '<summary><span class="anum">&#9733;</span><span class="aname">' + esc(d.collection) + "</span>" +
        '<span class="meta">' + d.count + " presets &middot; slots " + esc(d.slots || "") + "</span></summary>" +
        '<div class="songs"><div class="song" data-f="' + esc(f) + '">' + prs + "</div></div></details>");
    }

    const CSS = INDEX_CSS;
    const JS = INDEX_JS;
    const doc = '<!doctype html><html lang="en"><head>' +
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>PocketMaster Presets</title><style>" + CSS + "</style></head><body>" +
      '<header><h1>&#127928; PocketMaster Presets</h1>' +
      '<div class="sub">' + ORDER.length + " artists &middot; " + tot_songs + " songs &middot; " + tot_pr +
      " presets &middot; sorted by artist / song / intensity &middot; slots up to p50</div>" +
      '<div class="sub"><b>Takes</b> (letter in the preset name): ' +
      '<b style="color:var(--rit)">C</b>=clean rhythm &middot; ' +
      '<b style="color:var(--rit)">R</b>=rhythm with drive &middot; ' +
      '<b style="color:var(--rit)">D</b>=2nd distortion rhythm &middot; ' +
      '<b style="color:var(--rit)">H</b>=heavy rhythm &middot; ' +
      '<b style="color:var(--sol)">L</b>=lead <span style="opacity:.7">(L2/L3 = extra solos)</span></div>' +
      '<input id="q" placeholder="Search artist, song, amp or drive..." autocomplete="off">' +
      '<div class="tools"><button onclick="allOpen(true)">Expand all</button>' +
      '<button onclick="allOpen(false)">Collapse all</button></div></header>' +
      '<div class="wrap">' + cards.join("\n") +
      '<div class="secdiv">&#9733; Compilations</div>' + comp_cards.join("\n") +
      "</div>" +
      "<footer>Sonicake PocketMaster &middot; generated from the .json packages</footer>" +
      "<script>" + JS + "</script></body></html>";

    return { "README.md": readme, "index.html": doc };
  }

  // CSS/JS verbatim from gen_index.py (note: \\25B8 in Python source => literal \25B8 here).
  const INDEX_CSS = "\n" +
":root{--bg:#f6f7f9;--card:#fff;--ink:#1b1d22;--mut:#616773;--line:#e3e6eb;--acc:#3b6cff;--rit:#0a7d55;--sol:#b4402a;--chip:#eef1f6;}\n" +
"@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#181b21;--ink:#e8eaed;--mut:#9aa1ad;--line:#272c34;--acc:#6f95ff;--rit:#3ecf9a;--sol:#ff8a6a;--chip:#232832;}}\n" +
"*{box-sizing:border-box}\n" +
'body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}\n' +
"header{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 14px 8px;border-bottom:1px solid var(--line)}\n" +
"h1{margin:0 0 1px;font-size:17px}\n" +
".sub{color:var(--mut);font-size:12px;margin-bottom:4px}\n" +
".sub:last-of-type{margin-bottom:0}\n" +
"#q{width:100%;padding:9px 12px;margin-top:7px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-size:15px}\n" +
".wrap{padding:10px 12px 40px;max-width:820px;margin:0 auto}\n" +
".tools{display:flex;gap:6px;margin:7px 0 0}\n" +
".tools button{padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--mut);font-size:12px;cursor:pointer}\n" +
"details.art{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:9px 0;overflow:hidden}\n" +
"summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;gap:9px}\n" +
"summary::-webkit-details-marker{display:none}\n" +
".anum{min-width:26px;height:26px;display:grid;place-items:center;background:var(--chip);border-radius:8px;font-size:12px;color:var(--mut);font-weight:600}\n" +
".aname{font-weight:650;font-size:15.5px;flex:1}\n" +
".meta{color:var(--mut);font-size:11.5px;text-align:right}\n" +
".songs{padding:2px 10px 10px}\n" +
".song{padding:9px 6px;border-top:1px solid var(--line)}\n" +
".sn{font-weight:600;font-size:13.5px;margin-bottom:5px}\n" +
".pr{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:3px 0}\n" +
".tag{min-width:20px;height:20px;display:grid;place-items:center;border-radius:6px;font-size:11px;font-weight:700;color:#fff}\n" +
".tR{background:var(--rit)}.tL{background:var(--sol)}\n" +
".slot{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--mut);background:var(--chip);padding:1px 6px;border-radius:6px}\n" +
".nm{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}\n" +
".amp{font-size:12px;color:var(--acc)}\n" +
".drv{font-size:12px;color:var(--mut)}\n" +
'.amp::before{content:"\\25B8 "}\n' +
'.drv::before{content:"\\00B7 "}\n' +
".hide{display:none!important}\n" +
".secdiv{margin:20px 4px 6px;font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;border-top:1px solid var(--line);padding-top:14px}\n" +
"details.comp .anum{background:var(--sol);color:#fff}\n" +
"footer{color:var(--mut);font-size:11.5px;text-align:center;padding:16px}\n" +
"@media (max-height:520px){header{position:static;padding:6px 14px}h1,.sub{display:none}#q{margin-top:0}.tools{margin-top:6px}}\n";

  const INDEX_JS = "\n" +
"var q=document.getElementById('q'),arts=[].slice.call(document.querySelectorAll('.art'));\n" +
"function allOpen(o){arts.forEach(function(a){if(!a.classList.contains('hide'))a.open=o;});}\n" +
"q.addEventListener('input',function(){\n" +
" var t=q.value.trim().toLowerCase();\n" +
" arts.forEach(function(a){\n" +
"  if(!t){a.classList.remove('hide');a.open=false;a.querySelectorAll('.song').forEach(function(s){s.classList.remove('hide');});return;}\n" +
"  var am=a.dataset.a.indexOf(t)>=0,any=false;\n" +
"  a.querySelectorAll('.song').forEach(function(s){\n" +
"    var m=am||s.dataset.f.indexOf(t)>=0;s.classList.toggle('hide',!m);if(m)any=true;});\n" +
"  a.classList.toggle('hide',!(any||am));a.open=any||am;\n" +
" });\n" +
"});\n";

  return { buildIndex, esc, _helpers: { amp, drive, song_title, pkind, klabel, is_lead, songs_of, classify } };
});
