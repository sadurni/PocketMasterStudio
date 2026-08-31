// pmtabla.js — port of gen_tabla.py (presets_full.html + presets_print.html).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMTabla = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ORDER = ["NR", "FX1", "DRV", "AMP", "IR", "EQ", "FX2", "DLY", "RVB"];
  const MODNAME = {
    NR: "Noise Gate", FX1: "FX pre (comp/wah/mod)", DRV: "Drive/Dist/Fuzz",
    AMP: "Amplifier", IR: "Cabinet (cab/IR)", EQ: "Equalizer",
    FX2: "Modulation", DLY: "Delay", RVB: "Reverb",
  };
  const FACTORY_DEDUCE = {
    1: ["Modern high-gain (Bogner XTC)", "PocketMaster signature/demo patch. Modern saturated lead.", "Steve Vai / factory demo"],
    2: ["Blues OD (Tweed)", "Sweet overdrive over a Fender Tweed Deluxe.", "SRV / John Mayer"],
    3: ["Clean funk/pop (Fender Twin)", "Compressed clean with spring reverb.", "John Mayer / clean pop"],
    4: ["Neo-soul", "Clean JC-120, comp + modulated delay.", "Tom Misch / Mateus Asato"],
    5: ["British metal (JCM800)", "Marshall + Screamer, tight.", "Iron Maiden / Judas Priest"],
    6: ["Twangy blues (Tweed)", "Boost + slapback, punchy sound.", "B.B. King / SRV"],
    7: ["Arena rock (JCM800)", "Stadium rhythm with chorus.", "Def Leppard / Bon Jovi"],
    8: ["British Invasion (Vox AC30)", "60s Top Boost jangle.", "The Beatles / The Kinks / The Who"],
    9: ["Gilmour-style lead (Twin)", "Clean Fender + Screamer + tube delay.", "David Gilmour / Pink Floyd"],
    10: ["Soldano lead solo", "SLO-100 high gain + delay.", "Joe Satriani / Michael Landau"],
    11: ["Clean jazz", "JC-120, low volume, spring reverb.", "Wes Montgomery / Pat Metheny"],
    12: ["Clean chorus 80s", "JC-120 + chorus.", "The Police / Andy Summers"],
    13: ["Psychedelic funk", "Touch wah + flanger.", "Hendrix / funk"],
    14: ["Tremolo vintage", "Clean Vox + sweet tremolo.", "Chris Isaak / surf"],
    15: ["Clean blues", "JC-120 + gentle Butter OD.", "Robben Ford"],
    16: ["Lead with stereo delay", "Ping-Pong over overdrive.", "U2 / The Edge"],
    17: ["Fuzz rock", "Engl + Big Muff.", "Smashing Pumpkins / Muse / QOTSA"],
    18: ["Modern hard rock (Friedman)", "JP Dist over a Friedman BE.", "Slash / modern hard rock"],
    19: ["Modern metal (Diezel VH4)", "Tight high gain.", "Meshuggah / death metal"],
    20: ["Brown sound (phaser)", "Friedman + phaser = EVH brown.", "Van Halen"],
    21: ["Vox driven jangle", "Pushed AC30 + delay.", "U2 / 60s British rock"],
    22: ["Djent", "Very tight JCM800 + Screamer.", "Periphery / Meshuggah"],
    23: ["Metalcore (5150)", "EVH 5150 with double boost, max volume.", "Metallica / metalcore"],
    24: ["Fusion lead", "Soldano + delay, max volume.", "Scott Henderson / Frank Gambale"],
    25: ["Funky clean", "Compressed Fender Twin.", "Nile Rodgers / clean RHCP"],
    26: ["Warm jazz", "Tweed + comp, archtop.", "Grant Green"],
    27: ["Uni-Vibe drive", "Vibe + Screamer over a Tweed.", "Hendrix / SRV"],
    28: ["Ambient/post-rock", "Chorus + ping-pong + Dream reverb.", "Sigur Ros / The Edge"],
    29: ["Alt-rock drive", "JP Dist + chorus.", "Nirvana / grunge"],
    30: ["Octave fuzz", "Big Muff + octave pitch.", "Hendrix (Octavia) / White Stripes"],
    31: ["Rock'n'roll vintage", "Vox + vibrato + slapback.", "Chuck Berry / oldies"],
    32: ["Psych/experimental", "Reverse delay + comp.", "experimental post-rock"],
    33: ["Synth/sequence", "Bias trem + Sweep delay + Church.", "electronica/experimental"],
    34: ["Emo tapping", "Clean Vox, tapping.", "American Football / math-rock"],
    35: ["Emo/post-hardcore", "Gentle RAT + boost.", "post-hardcore"],
    36: ["Dream pop/shoegaze", "Vibrato + chorus + reverse.", "Cocteau Twins / Beach House"],
    37: ["80s ballad", "JCM800 + chorus + hall.", "power ballad"],
    38: ["Shoegaze (wall of noise)", "Big Muff + wah + tremolo + Dream.", "My Bloody Valentine"],
    39: ["Pink Floyd 'High Hopes'", "AC30 + chorus + delay.", "David Gilmour / Pink Floyd"],
    40: ["Bright indie", "Tremolo + pitch + ping-pong.", "indie/experimental"],
    41: ["Modern indie", "Vibe + detune, clean.", "indie"],
    42: ["Spacey/psych", "Chorus + flanger + Ocean reverb.", "ambient/psych"],
    43: ["Funk auto-wah", "Envelope filter + tremolo.", "funk"],
    44: ["Clean indie", "Chorus + gentle tremolo.", "clean indie"],
    45: ["Hard rock", "Friedman + JP Dist, dry.", "hard rock"],
    46: ["Clean DI bass", "Bassman Normal + comp.", "bass (fingers)"],
    47: ["Bass with pick", "Bassman Bright + comp.", "bass (pick)"],
    48: ["Slap bass", "JC-120 + boost.", "slap bass / Flea"],
    49: ["Bass with drive", "Bassman + RAT.", "rock overdrive bass"],
    50: ["Bass with envelope", "Bassman + RAT, Q-type.", "funk bass"],
  };

  const esc = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  function loadFactory(factoryData) {
    if (!factoryData) return null;
    const presets = factoryData.presets.map((p, i) => ({ ...p, slot: i + 1 }));
    return { name: "Factory", tag: "factory", count: presets.length, slots: "1-50", presets,
      desc: "50 factory presets (Sonicake PocketMaster) + style/artist deduction" };
  }
  function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function stableSort(arr, keyFn) {
    return arr.map((v, i) => [v, i]).sort((A, B) => {
      const ka = keyFn(A[0]), kb = keyFn(B[0]);
      const c = (typeof ka === "number") ? ka - kb : cmpStr(ka, kb);
      return c !== 0 ? c : A[1] - B[1];
    }).map((x) => x[0]);
  }
  function loadArtists(folderMap) {
    const groups = [];
    const keys = Object.keys(folderMap).filter((k) => !k.includes("/") && k.endsWith(".json")).sort();
    for (const k of keys) {
      const d = folderMap[k];
      if (!d || d.type !== "PocketMasterBatch" || !("artist" in d)) continue;
      let presets = stableSort(d.presets, (x) => x.slot || 0);   // slot order
      // Group by song SLUG (first appearance = slot order), then order the groups by the first
      // preset's display TITLE — identical to the Listing's artist→song ordering. Within a song,
      // slot order (calm→loud) is kept. This keeps all listings consistent.
      const bySlug = {}, slugOrder = [];
      for (const p of presets) {
        const s = p.song != null ? p.song : (p.description || "").split(":")[0];
        if (!(s in bySlug)) { bySlug[s] = { key: (p.description || "").split(":")[0].toLowerCase(), items: [] }; slugOrder.push(s); }
        bySlug[s].items.push(p);
      }
      presets = [].concat(...stableSort(slugOrder, (s) => bySlug[s].key).map((s) => bySlug[s].items));
      groups.push({ name: d.artist, tag: "artist", count: d.count != null ? d.count : presets.length,
        slots: d.slots || "", presets, desc: "" });
    }
    return stableSort(groups, (g) => g.name.toLowerCase());
  }
  const COLL_ORDER = {
    "Interesting Solos": 0, "Classic Rock": 1, "A Bit of Everything": 2,
    "Best 50 (a bit of everything)": 3, "Best 50 v2 (calm/loud cycle by era)": 4,
  };
  function loadCollections(folderMap) {
    const groups = [];
    const keys = Object.keys(folderMap).filter((k) => !k.includes("/") && k.endsWith(".json")).sort();
    for (const k of keys) {
      if (k.startsWith("Compare_")) continue;
      const d = folderMap[k];
      if (!d || d.type !== "PocketMasterBatch" || !("collection" in d)) continue;
      const presets = stableSort(d.presets, (x) => x.slot || 0);
      groups.push({ name: d.collection, tag: "collection", count: d.count != null ? d.count : presets.length,
        slots: d.slots || "", presets, desc: "" });
    }
    return stableSort(groups, (g) => (COLL_ORDER[g.name] != null ? COLL_ORDER[g.name] : 99));
  }

  function fmt_params(params) {
    if (!params || !Object.keys(params).length) return "";
    const parts = [];
    for (const [k, v] of Object.entries(params)) parts.push(`${esc(k)}<b>${esc(v)}</b>`);
    return parts.join(" · ");
  }
  function chain_html(mods) {
    const cells = [];
    for (const k of ORDER) {
      const mod = mods[k] || {};
      const on = mod.enabled || false;
      const eff = mod.effect || "";
      const params = mod.parameters || {};
      let title = `${k} — ${MODNAME[k]}\n${on ? "ON" : "OFF"} · ${eff}`;
      if (Object.keys(params).length)
        title += "\n" + Object.entries(params).map(([kk, vv]) => `${kk}=${vv}`).join(", ");
      const cls = "mod m-" + k.toLowerCase() + (on ? " on" : " off");
      cells.push(`<div class="${cls}" title="${esc(title)}">` +
        `<span class="dot"></span>` +
        `<span class="mc">${k}</span>` +
        `<span class="me">${eff ? esc(eff) : "—"}</span>` +
        `</div>`);
    }
    return '<div class="chain">' + cells.join("") + "</div>";
  }
  function params_table(mods) {
    const rows = [];
    for (const k of ORDER) {
      const mod = mods[k] || {};
      const on = mod.enabled || false;
      const eff = mod.effect || "";
      const p = fmt_params(mod.parameters || {});
      const st = on ? '<span class="on-t">ON</span>' : '<span class="off-t">off</span>';
      rows.push(`<tr class="${on ? "row-on" : "row-off"}"><td class="pk">${k}</td><td>${st}</td>` +
        `<td class="pe">${esc(eff)}</td><td class="pp">${p}</td></tr>`);
    }
    return '<table class="pt"><thead><tr><th>Mod</th><th></th><th>Effect</th><th>Parameters</th></tr></thead>' +
      "<tbody>" + rows.join("") + "</tbody></table>";
  }
  const dtag_amp = (amp) => amp ? `<span class="amp">${esc(amp)}</span>` : "";

  const KTAG = {
    C: ["tg-r", "CLN"], R: ["tg-r", "RIT"], D: ["tg-r", "DRV"], H: ["tg-r", "HVY"],
    L: ["tg-l", "SOLO"], L2: ["tg-l", "SOLO2"], L3: ["tg-l", "SOLO3"],
    La: ["tg-l", "SOL A"], Lb: ["tg-l", "SOL B"], Lc: ["tg-l", "SOL C"],
    Ld: ["tg-l", "SOL dt"], Lh: ["tg-l", "SOL ch"],
  };
  function preset_card(p, group_tag) {
    const mods = p.modules || {};
    if (!("AMP" in mods) && "Clone" in mods) mods["AMP"] = mods["Clone"];
    const name = p.presetName || "";
    const slot = p.slot != null ? p.slot : "";
    const vol = p.presetVolume != null ? p.presetVolume : "";
    const desc = p.description || "";
    let art = p.artist || "";
    const amp = (mods.AMP || {}).effect || "";
    let kind = p.kind;
    if (!kind) {
      const tok = name.trim().split(/\s+/);
      kind = tok.length && KTAG[tok[tok.length - 1]] ? tok[tok.length - 1] : "";
    }
    const [rlcls, rltxt] = KTAG[kind] || ["", ""];
    let deduce = "";
    if (group_tag === "factory" && FACTORY_DEDUCE[slot]) {
      const [est, note, dart] = FACTORY_DEDUCE[slot];
      art = dart;                                   // Python reassigns `art` (used by fstr + pdesc)
      deduce = `<div class="deduce"><span class="dl">Deduction:</span> ` +
        `<b>${esc(est)}</b> — ${esc(note)} ` +
        `<span class="art">≈ ${esc(art)}</span></div>`;
    }
    const fstr = [name, desc, art, amp, rltxt].concat(Object.values(mods).map((m) => m.effect || "")).join(" ").toLowerCase();
    const dtag = rltxt ? `<span class="tag ${rlcls}">${rltxt}</span>` : "";
    return `<div class="card" data-f="${esc(fstr)}">` +
      `<div class="chead">` +
      `<span class="slot">p${esc(slot)}</span>` +
      `<span class="pname">${esc(name)}</span>${dtag_amp(amp)}${dtag}` +
      `<span class="vol" title="Preset volume">vol ${esc(vol)}</span>` +
      `</div>` +
      ((desc || art) ? `<div class="pdesc">` + (art ? `<b>${esc(art)}</b> &mdash; ` : "") + `${esc(desc)}</div>` : "") +
      deduce +
      chain_html(mods) +
      `<details class="more"><summary>Show all parameters</summary>${params_table(mods)}</details>` +
      `</div>`;
  }
  function group_html(g, idx) {
    const cards = g.presets.map((p) => preset_card(p, g.tag)).join("");
    const meta = `${g.count} presets` + (g.slots ? ` · slots ${g.slots}` : "");
    const open_attr = g.tag === "factory" ? " open" : "";
    const gnum = { factory: "F", collection: "★" }[g.tag] || String(idx);
    const descline = g.desc ? `<div class="gdesc">${esc(g.desc)}</div>` : "";
    const cat = { factory: "factory", collection: "collection" }[g.tag] || "personal";
    return `<details class="art" data-cat="${cat}" data-name="${esc(g.name.toLowerCase())}"${open_attr}>` +
      `<summary><span class="anum">${gnum}</span>` +
      `<span class="aname">${esc(g.name)}</span>` +
      `<span class="meta">${esc(meta)}</span></summary>` +
      `<div class="cards">${descline}${cards}</div>` +
      `</details>`;
  }

  // ---- printable ----
  const eff_or_dash = (mod) => mod.enabled ? `<span>${esc(mod.effect || "")}</span>` : '<span class="off">—</span>';
  function print_chainstrip(mods) {
    const cells = [];
    for (const k of ORDER) { const on = (mods[k] || {}).enabled || false; cells.push(`<i class="${on ? "on" : "off"}">${k}</i>`); }
    return '<span class="strip">' + cells.join("") + "</span>";
  }
  function print_row(p, tag) {
    const mods = p.modules || {};
    if (!("AMP" in mods) && "Clone" in mods) mods["AMP"] = mods["Clone"];
    const name = p.presetName || "", slot = p.slot != null ? p.slot : "", vol = p.presetVolume != null ? p.presetVolume : "";
    const amp = mods.AMP || {}, drv = mods.DRV || {}, fx1 = mods.FX1 || {}, fx2 = mods.FX2 || {}, dly = mods.DLY || {}, rvb = mods.RVB || {};
    const fx = [];
    if (fx1.enabled) fx.push(esc(fx1.effect || ""));
    if (fx2.enabled) fx.push(esc(fx2.effect || ""));
    const fxtxt = fx.length ? fx.join(" · ") : '<span class="off">—</span>';
    let nota;
    if (tag === "factory" && FACTORY_DEDUCE[slot]) {
      const [est, , dart] = FACTORY_DEDUCE[slot];
      nota = `<b>${esc(est)}</b> · ${esc(dart)}`;
    } else {
      const d = esc(p.description || "");
      const art = p.artist || "";
      nota = art ? `<b>${esc(art)}</b> &middot; ${d}` : d;
    }
    const ampcell = amp.enabled ? `${esc(amp.effect || "")}` : `<span class="off">${esc(amp.effect || "")}</span>`;
    return `<tr>` +
      `<td class="sl">p${esc(slot)}</td>` +
      `<td class="nm">${esc(name)}</td>` +
      `<td class="ch">${print_chainstrip(mods)}</td>` +
      `<td>${ampcell}</td>` +
      `<td>${eff_or_dash(drv)}</td>` +
      `<td>${fxtxt}</td>` +
      `<td>${eff_or_dash(dly)}</td>` +
      `<td>${eff_or_dash(rvb)}</td>` +
      `<td class="vl">${esc(vol)}</td>` +
      `<td class="nt">${nota}</td>` +
      `</tr>`;
  }
  function print_group(g, idx) {
    const gnum = { factory: "F", collection: "★" }[g.tag] || String(idx);
    const meta = `${g.count} presets` + (g.slots ? ` · slots ${g.slots}` : "");
    const rows = g.presets.map((p) => print_row(p, g.tag)).join("");
    return `<tbody class="grp">` +
      `<tr class="gh"><td class="gn">${gnum}</td><td class="ga" colspan="9">` +
      `${esc(g.name)} <span>· ${esc(meta)}</span></td></tr>` +
      `${rows}</tbody>`;
  }

  function buildTabla(folderMap, factoryData) {
    const factory = loadFactory(factoryData);
    const artists = loadArtists(folderMap);
    const collections = loadCollections(folderMap);
    const n_fac = factory ? factory.presets.length : 0;
    const n_pers = artists.reduce((s, a) => s + a.presets.length, 0);
    const n_coll = collections.reduce((s, c) => s + c.presets.length, 0);
    const total = n_fac + n_pers + n_coll;

    let groups_html = factory ? group_html(factory, 0) : "";
    artists.forEach((a, i) => { groups_html += group_html(a, i + 1); });
    collections.forEach((c, i) => { groups_html += group_html(c, i + 1); });

    const legend_cells = ORDER.map((k) =>
      `<div class="mod m-${k.toLowerCase()} on"><span class="dot"></span><span class="mc">${k}</span>` +
      `<span class="me">${esc(MODNAME[k].split(" (")[0])}</span></div>`).join("");

    const full = TEMPLATE.replace("__GROUPS__", groups_html)
      .replace("__LEGEND__", legend_cells)
      .replace("__NART__", String(artists.length))
      .replace("__NPRE__", String(total))
      .replace("Factory <span>(50)</span>", `Factory <span>(${n_fac})</span>`)
      .replace("Custom <span>(1030)</span>", `Custom <span>(${n_pers})</span>`)
      .replace("__NCOLL__", String(n_coll));

    let body = factory ? print_group(factory, 0) : "";
    artists.forEach((a, i) => { body += print_group(a, i + 1); });
    collections.forEach((c, i) => { body += print_group(c, i + 1); });
    const print = PRINT_TEMPLATE.replace("__ROWS__", body)
      .replace("__NART__", String(artists.length))
      .replace("__NPRE__", String(total));

    return { "presets_full.html": full, "presets_print.html": print };
  }

  // NOTE: normal template literal (not String.raw) so the inline </script> below survives the
  // build's inlineSafe escaping (<\/script> -> </script>). Templates contain no ${ or backslashes.
  const TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preset table · PocketMaster</title>
<style>
:root{
 --bg:#0f1115;--card:#161a20;--card2:#1b2028;--ink:#e8eaed;--mut:#98a0ad;--line:#272c34;
 --acc:#ff6b35;--r:#3ecf9a;--l:#ff8a6a;--chip:#222834;
 --c-nr:#8892a6;--c-fx1:#b07bff;--c-drv:#ff5a52;--c-amp:#4a9dff;--c-ir:#26c6a8;
 --c-eq:#7bd84a;--c-fx2:#c77bff;--c-dly:#22c3e6;--c-rvb:#6f8bff;
}
@media (prefers-color-scheme:light){:root{
 --bg:#f5f6f8;--card:#fff;--card2:#f2f4f7;--ink:#1b1d22;--mut:#616773;
 --line:#e3e6eb;--chip:#eef1f6;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
header{position:sticky;top:0;z-index:10;background:var(--bg);padding:10px 14px 8px;border-bottom:1px solid var(--line)}
h1{margin:0;font-size:17px;display:flex;align-items:center;gap:8px}
h1 .badge{font-size:11px;background:var(--acc);color:#fff;padding:2px 7px;border-radius:999px;font-weight:700}
.sub{color:var(--mut);font-size:12px;margin:2px 0 7px}
#q{width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-size:15px}
.controls{display:flex;gap:8px 10px;flex-wrap:wrap;align-items:center;margin-top:7px}
.tools{display:inline-flex;gap:6px}
.tools button{padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--mut);font-size:12px;cursor:pointer}
.tools button:active{transform:scale(.98)}
.filters{display:inline-flex;gap:6px;flex-wrap:wrap;margin-left:auto}
.filters .ck{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);font-size:12.5px;cursor:pointer;user-select:none}
.filters .ck input{accent-color:var(--acc);width:15px;height:15px;margin:0}
.filters .ck span{color:var(--mut);font-size:11px}
.wrap{padding:10px 12px 60px;max-width:900px;margin:0 auto}
.legend{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;margin:10px 0}
.legend h3{margin:0 0 7px;font-size:12px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.legend .chain{overflow:visible;flex-wrap:wrap}
.legend .me{max-width:none}
.hint{color:var(--mut);font-size:11.5px;margin-top:6px}
details.art{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:9px 0;overflow:hidden}
summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;gap:9px}
summary::-webkit-details-marker{display:none}
.anum{min-width:28px;height:28px;padding:0 6px;display:grid;place-items:center;background:var(--chip);border-radius:8px;font-size:12px;color:var(--mut);font-weight:700}
.aname{font-weight:650;font-size:15.5px;flex:1}
.meta{color:var(--mut);font-size:11.5px;text-align:right;white-space:nowrap}
.cards{padding:2px 10px 12px}
.gdesc{color:var(--mut);font-size:12px;padding:4px 4px 8px}
.card{padding:11px 8px;border-top:1px solid var(--line)}
.card:first-child{border-top:none}
.chead{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.slot{font-size:11px;font-weight:700;color:var(--acc);background:color-mix(in srgb,var(--acc) 15%,transparent);
 border:1px solid color-mix(in srgb,var(--acc) 35%,transparent);padding:1px 6px;border-radius:6px;min-width:34px;text-align:center}
.pname{font-weight:650;font-size:14.5px}
.amp{font-size:11px;color:var(--mut);background:var(--chip);padding:1px 7px;border-radius:6px}
.tag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;letter-spacing:.03em}
.tg-r{color:#fff;background:var(--r)}
.tg-l{color:#fff;background:var(--l)}
.vol{margin-left:auto;font-size:11px;color:var(--mut)}
.pdesc{color:var(--mut);font-size:12.5px;margin:5px 2px 2px}
.deduce{font-size:12px;margin:6px 2px 2px;padding:6px 8px;background:var(--card2);border-radius:8px;border-left:3px solid var(--acc)}
.deduce .dl{color:var(--acc);font-weight:700;font-size:11px}
.deduce .art{color:var(--mut)}
/* signal chain */
.chain{display:flex;gap:0;align-items:stretch;margin:9px 0 2px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}
.chain::-webkit-scrollbar{height:5px}
.chain::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
.mod{position:relative;flex:0 0 auto;min-width:62px;margin-right:14px;padding:6px 7px 6px 8px;border-radius:9px;
 background:var(--card2);border:1px solid var(--line);display:flex;flex-direction:column;gap:2px}
.mod:last-child{margin-right:2px}
.mod::after{content:"";position:absolute;right:-14px;top:50%;width:14px;height:2px;background:var(--line)}
.mod:last-child::after{display:none}
.mod .dot{position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:#4a4f59}
.mod .mc{font-size:10px;font-weight:800;letter-spacing:.04em;color:var(--mut)}
.mod .me{font-size:11px;font-weight:600;color:var(--ink);white-space:nowrap;max-width:96px;overflow:hidden;text-overflow:ellipsis}
.mod.off{opacity:.4;border-style:dashed}
.mod.off .me{color:var(--mut);font-weight:500}
.mod.on{border-width:1.5px}
.mod.on .dot{background:var(--r);box-shadow:0 0 5px var(--r)}
.m-nr.on{border-color:var(--c-nr)} .m-nr.on .mc{color:var(--c-nr)}
.m-fx1.on{border-color:var(--c-fx1)} .m-fx1.on .mc{color:var(--c-fx1)}
.m-drv.on{border-color:var(--c-drv)} .m-drv.on .mc{color:var(--c-drv)}
.m-amp.on{border-color:var(--c-amp)} .m-amp.on .mc{color:var(--c-amp)}
.m-ir.on{border-color:var(--c-ir)} .m-ir.on .mc{color:var(--c-ir)}
.m-eq.on{border-color:var(--c-eq)} .m-eq.on .mc{color:var(--c-eq)}
.m-fx2.on{border-color:var(--c-fx2)} .m-fx2.on .mc{color:var(--c-fx2)}
.m-dly.on{border-color:var(--c-dly)} .m-dly.on .mc{color:var(--c-dly)}
.m-rvb.on{border-color:var(--c-rvb)} .m-rvb.on .mc{color:var(--c-rvb)}
/* params */
details.more{margin-top:7px}
details.more>summary{padding:5px 2px;font-size:12px;color:var(--acc);display:inline-flex}
.pt{width:100%;border-collapse:collapse;margin-top:5px;font-size:12px}
.pt th{text-align:left;color:var(--mut);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;padding:3px 6px;border-bottom:1px solid var(--line)}
.pt td{padding:4px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.pt .pk{font-weight:800;color:var(--mut);width:38px}
.pt .pe{font-weight:600;white-space:nowrap}
.pt .pp{color:var(--mut)}
.pt .pp b{color:var(--ink);font-weight:700}
.row-off{opacity:.5}
.on-t{color:var(--r);font-weight:700;font-size:10.5px}
.off-t{color:var(--mut);font-size:10.5px}
.empty{color:var(--mut);text-align:center;padding:30px}
footer{color:var(--mut);font-size:11px;text-align:center;padding:16px}
@media (max-height:520px){
 header{position:static;padding:6px 12px}
 h1,.sub{display:none}
 #q{padding:7px 10px}
 .controls{margin-top:6px}
 .legend{display:none}
}
</style></head><body>
<header>
 <h1>PocketMaster Presets <span class="badge">__NPRE__</span></h1>
 <div class="sub">Factory (50) + __NART__ artists · chain NR→FX1→DRV→AMP→IR→EQ→FX2→DLY→RVB</div>
 <input id="q" type="search" placeholder="Search preset, song, amp, effect…" autocomplete="off">
 <div class="controls">
  <div class="tools">
   <button data-a="open">Expand all</button>
   <button data-a="close">Collapse all</button>
  </div>
  <div class="filters">
   <label class="ck"><input type="checkbox" class="catck" value="factory" checked> Factory <span>(50)</span></label>
   <label class="ck"><input type="checkbox" class="catck" value="personal" checked> Custom <span>(1030)</span></label>
   <label class="ck"><input type="checkbox" class="catck" value="collection" checked> Collections <span>(__NCOLL__)</span></label>
  </div>
 </div>
</header>
<div class="wrap">
 <div class="legend">
  <h3>Legend · chain mini-diagram (lit block = active module)</h3>
  <div class="chain">__LEGEND__</div>
  <div class="hint" style="margin-bottom:6px"><b>Each preset's tag</b> (letter in the name):
   <span class="tag tg-r">CLN</span> C = clean rhythm &middot;
   <span class="tag tg-r">RIT</span> R = rhythm with drive &middot;
   <span class="tag tg-r">DRV</span> D = 2nd distortion rhythm &middot;
   <span class="tag tg-r">HVY</span> H = heavy rhythm &middot;
   <span class="tag tg-l">SOLO</span> L = lead (L2/L3 = extra solos)</div>
  <div class="hint">Each card shows the 9 modules in order. On = color + green LED; off = dimmed and striped. Hover over a block to see its parameters, or open "Show all parameters".</div>
 </div>
 __GROUPS__
 <div class="empty" id="empty" style="display:none">No results.</div>
</div>
<footer>Generated from the preset JSON files · PocketMaster Sonicake · PocketEdit</footer>
<script>
const q=document.getElementById('q'), arts=[...document.querySelectorAll('details.art')],
      empty=document.getElementById('empty'), cks=[...document.querySelectorAll('.catck')];
function allowedCats(){
 const all=['factory','personal','collection'];
 const on=cks.filter(c=>c.checked).map(c=>c.value);
 // show the checked ones; if none, show all
 return on.length ? on : all;
}
function applyFilter(){
 const t=q.value.trim().toLowerCase(), cats=allowedCats(); let any=false;
 arts.forEach(a=>{
  if(!cats.includes(a.dataset.cat)){ a.style.display='none'; return; }
  const cards=[...a.querySelectorAll('.card')]; let vis=0;
  cards.forEach(c=>{ const m=!t||c.dataset.f.includes(t)||a.dataset.name.includes(t); c.style.display=m?'':'none'; if(m)vis++; });
  a.style.display=vis?'':'none'; if(vis)any=true; if(t&&vis)a.open=true;
 });
 empty.style.display=any?'none':'';
}
q.addEventListener('input',applyFilter);
cks.forEach(c=>c.addEventListener('change',applyFilter));
document.querySelector('.tools').addEventListener('click',e=>{
 const a=e.target.dataset.a; if(!a)return;
 const vis=arts.filter(x=>x.style.display!=='none');
 if(a==='open')vis.forEach(x=>x.open=true);
 if(a==='close')vis.forEach(x=>x.open=false);
});
</script>
</body></html>`;

  const PRINT_TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PocketMaster Presets — printable</title>
<style>
@page{size:A4 portrait;margin:8mm}
*{box-sizing:border-box}
body{margin:0;background:#eceef1;color:#111;
 font:11px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.page{max-width:194mm;margin:0 auto;background:#fff;padding:12px 14px 30px}
.top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}
h1{margin:0;font-size:17px}
.top .s{color:#555;font-size:12px}
.top .np{margin-left:auto;font-weight:700}
.bar{margin:8px 0 10px}
.bar button{padding:8px 14px;border:1px solid #111;background:#111;color:#fff;border-radius:7px;font-size:13px;cursor:pointer}
.bar .note{color:#555;font-size:11.5px;margin-left:8px}
.leg{font-size:11px;color:#444;margin:4px 0 10px}
.leg i{font-style:normal;font-weight:700;padding:1px 4px;border-radius:3px;margin:0 1px}
.leg i.on{background:#111;color:#fff}
.leg i.off{background:#e6e8ec;color:#9aa0aa}
table{width:100%;border-collapse:collapse;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
thead.head th{position:sticky;top:0;background:#f2f4f7;text-align:left;font-size:9px;text-transform:uppercase;
 letter-spacing:.02em;color:#444;padding:4px 5px;border-bottom:1.5px solid #111}
tbody.grp{break-inside:auto}
tr.gh td{background:#111;color:#fff;padding:5px 8px;font-weight:700;font-size:12px;break-after:avoid}
tr.gh .gn{text-align:center;background:#000;border-right:1px solid #333}
tr.gh .ga span{font-weight:400;color:#bbb;font-size:10.5px}
tbody.grp td{padding:3px 5px;border-bottom:.5px solid #dfe2e7;vertical-align:top}
tbody.grp tr:nth-child(even of :not(.gh)){background:#fafbfc}
td.sl{font-weight:700;color:#b4402a;white-space:nowrap}
td.nm{font-weight:600}
td.ch{white-space:normal}
td.vl{text-align:center;color:#555}
td.nt{color:#333;font-size:10.5px}
.off{color:#b3b8c0}
.strip i{font-style:normal;font-weight:700;font-size:8px;padding:1px 2px;border-radius:3px;margin:0 .5px .5px;display:inline-block}
.strip i.on{background:#111;color:#fff}
.strip i.off{background:#eceef1;color:#b3b8c0;font-weight:500}
@media print{
 body{background:#fff;font-size:9px}
 .page{max-width:none;padding:0}
 .bar{display:none}
 tr.gh td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .strip i.on,.leg i.on{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 tbody.grp tr{break-inside:avoid}
 thead.head th{position:static}
}
</style></head><body>
<div class="page">
 <div class="top">
  <h1>PocketMaster Sonicake Presets</h1>
  <span class="s">Factory (50) + __NART__ artists · chain NR→FX1→DRV→AMP→IR→EQ→FX2→DLY→RVB</span>
  <span class="np">__NPRE__ presets</span>
 </div>
 <div class="bar">
  <button onclick="window.print()">Print / Save PDF</button>
  <span class="note">Prints in portrait (A4), fit to width. Each preset: one row.</span>
 </div>
 <div class="leg">Chain: <i class="on">NR</i><i class="on">FX1</i>… <b>active</b> module = dark fill; <i class="off">FX1</i> dimmed = disabled.
  The DRV/Effects/DLY/RVB columns show the model only if the module is active.</div>
 <table>
  <colgroup>
   <col style="width:5%"><col style="width:11%"><col style="width:12%"><col style="width:12%"><col style="width:10%">
   <col style="width:13%"><col style="width:8%"><col style="width:8%"><col style="width:5%"><col style="width:16%">
  </colgroup>
  <thead class="head"><tr>
   <th>Slot</th><th>Preset</th><th>Chain</th><th>AMP</th><th>DRV</th>
   <th>Effects (FX1/FX2)</th><th>Delay</th><th>Reverb</th><th>Vol</th><th>Description / Deduction</th>
  </tr></thead>
  __ROWS__
 </table>
</div>
</body></html>`;

  return { buildTabla };
});
