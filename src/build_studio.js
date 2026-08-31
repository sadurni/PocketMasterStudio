// build_studio.js — assemble the self-contained PocketMaster Studio (PocketMasterStudio.html):
// embeds data/ + mld + factory + overrides + portable prompt (one gzip+base64 blob), inlines the
// verified pipeline modules + the Studio controller, runs everything in-browser, saves itself.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
// Self-contained build: source data lives in ../data, build inputs in ./assets, output to ../.
const SRC = __dirname;
const HERE = __dirname;
const ASSETS = path.join(SRC, "assets");
const DATA = path.join(SRC, "..", "data");
const ROOT = path.join(SRC, "..");
const rd = (p) => fs.readFileSync(p, "utf-8");
const rdj = (p) => JSON.parse(rd(p));

const config = rdj(path.join(DATA, "_config.json"));
const data = {};
for (const n of config.order) data[n] = rdj(path.join(DATA, n.replace(/\//g, "-") + ".json"));
const mld = rdj(path.join(ASSETS, "mld.json"));
const factory = rdj(path.join(ASSETS, "pocketmaster_batch_factory_presets_v1_3_3.json"));

// portable AI prompt: the body after the "how to use" header (split on first \n---\n).
const promptMd = rd(path.join(ASSETS, "PROMPT_Portable_Preset_Generator.md")).replace(/\r\n/g, "\n");
const cut = promptMd.indexOf("\n---\n");
const prompt = (cut >= 0 ? promptMd.slice(cut + 5) : promptMd).trim();

let readme = ""; try { readme = rd(path.join(SRC, "README_STUDIO.md")); } catch (e) {}

// Docs (markdown) for the Docs tabs — rendered live with pmmd.
const docs = [
  { id: "readme", label: "README", md: readme },
  { id: "songs", label: "Representative songs", md: rd(path.join(ASSETS, "representative_songs.md")) },
  { id: "prompt-artist", label: "Artist prompt", md: rd(path.join(ASSETS, "PROMPT_Generate_Artist_Presets.md")) },
  { id: "prompt-portable", label: "Portable prompt", md: rd(path.join(ASSETS, "PROMPT_Portable_Preset_Generator.md")) },
];

// Optional pre-applied overrides + custom collections shipped with the project, at the repo root
// next to data/ (overrides default to {}, collections to null = the built-in 5).
const readOv = (f) => { try { return rdj(path.join(ROOT, f)); } catch (e) { return {}; } };
let collections = null; try { collections = rdj(path.join(ROOT, "collections.json")); } catch (e) {}
const payload = { config, data, mld, factory, factory_overrides: readOv("factory_overrides.json"), nam_overrides: readOv("nam_overrides.json"), collections, prompt, readme, docs };
const raw = Buffer.from(JSON.stringify(payload), "utf-8");
const blob = zlib.gzipSync(raw, { level: 9 }).toString("base64");
console.log("payload raw", raw.length, "-> gzip+base64", blob.length);

// Editor (PocketEdit): strip its baked library (we inject a fresh one at runtime), embed as a blob.
let editorHtml = rd(path.join(ASSETS, "PocketEdit_multi_import_export.html"));
editorHtml = editorHtml.replace(/(<script id="pm-library"[^>]*>)[\s\S]*?(<\/script>)/, "$1$2");
// Remove the editor's AI Prompt button (Studio has its own AI Prompt tab).
editorHtml = editorHtml.replace(/\s*<button id="aiPromptBtn"[^>]*>[\s\S]*?<\/button>/, "");
// Repurpose "Export as Override": hand the current preset to the Studio to make it definitive
// (no Python / serve.py). Plain Export / Export Multiple keep downloading a JSON as before.
const NEW_OVERRIDE =
`      async function exportOverride(){
        const e = ed(); if(!e){ alert('Editor not ready.'); return; }
        if(!(window.parent && window.parent!==window)){ e._captureExport=null; e.exportPreset(); return; }
        const preset = await new Promise((resolve)=>{ e._captureExport = resolve; Promise.resolve(e.exportPreset()).catch(()=>resolve(null)); });
        if(!preset || !preset.modules){ alert('Could not read the current preset.'); return; }
        window.parent.postMessage({ type:'pm-override', text: JSON.stringify(preset) }, '*');
        try{ e.log('[OVERRIDE] Sent to Studio — review it in the Paste JSON tab.', 'info'); }catch(_){}
      }`;
editorHtml = editorHtml.replace(
  /\n {6}async function exportOverride\(\)\{[\s\S]*?\n {6}\/\/ ---------- wiring ----------/,
  () => "\n" + NEW_OVERRIDE + "\n\n      // ---------- wiring ----------");
// Browse Library: show the full song TITLE (not the slug) in each category, and search it too.
editorHtml = editorHtml
  .replace("libMatch(q,a.artist,s.song,p.n)", "libMatch(q,a.artist,(s.title||'')+' '+s.song,p.n)")
  .replace("songs.push({song:s.song, presets:ps});", "songs.push({song:s.song, title:s.title, presets:ps});")
  .replace("sname.textContent=s.song;", "sname.textContent=s.title||s.song;");
const editorBlob = zlib.gzipSync(Buffer.from(editorHtml, "utf-8"), { level: 9 }).toString("base64");
console.log("editor stripped/patched -> gzip+base64", editorBlob.length);

const inlineSafe = (js) => js.replace(/<\/(script)/gi, "<\\/$1");
const modules = ["pmbuild.js", "pmhtml.js", "pmtabla.js", "pmmap.js", "pmmd.js", "pmedit.js", "pmzip.js"]
  .map((f) => `<script>\n${inlineSafe(rd(path.join(HERE, f)))}\n</script>`).join("\n");
const appJs = inlineSafe(rd(path.join(HERE, "studio_app.js")));

const CSS = String.raw`
 :root{--bg:#0f1115;--card:#181b21;--card2:#1b2028;--ink:#e8eaed;--mut:#9aa1ad;--line:#272c34;--acc:#6f95ff;--ok:#3ecf9a;--warn:#e6b34d;--err:#ff6f6f}
 @media(prefers-color-scheme:light){:root{--bg:#f6f7f9;--card:#fff;--card2:#f2f4f7;--ink:#1b1d22;--mut:#616773;--line:#e3e6eb}}
 *{box-sizing:border-box} html{-webkit-text-size-adjust:100%}
 body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow-x:hidden;padding-bottom:76px}
 header{padding:12px 16px;border-bottom:1px solid var(--line)}
 h1{margin:0;font-size:18px} .sub{color:var(--mut);font-size:12.5px;margin-top:3px}
 .note{color:var(--mut);font-size:12px;margin-top:6px;line-height:1.4}
 .warn{background:#5a1d1d;color:#ffd9d2;border:1px solid #7a2a2a;border-radius:10px;padding:10px 12px;margin:10px 16px;font-size:13px}
 .tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5;-webkit-overflow-scrolling:touch}
 .tab{flex:0 0 auto;padding:8px 13px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--mut);font-size:13.5px;cursor:pointer;white-space:nowrap;min-height:40px}
 .tab.on{background:var(--acc);color:#fff;border-color:transparent;font-weight:600}
 .wrap{padding:12px 16px;max-width:1000px;margin:0 auto}
 .panel[hidden]{display:none}
 .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:10px 0}
 button{padding:11px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-size:14px;cursor:pointer;min-height:44px}
 button:disabled{opacity:.45;cursor:default} button.primary{background:var(--acc);color:#fff;border-color:transparent;font-weight:600}
 button.attn{background:var(--warn);color:#201800;border-color:transparent;font-weight:700}
 button.mini{min-height:0;padding:2px 8px;font-size:12px;border-radius:6px}
 label{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}
 input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-size:14px;font-family:inherit}
 textarea{min-height:120px;font:12.5px/1.4 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
 #stats{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:6px 0}
 iframe{width:100%;height:60vh;border:1px solid var(--line);border-radius:10px;background:#fff;margin-top:8px}
 .ok{background:var(--card2);border-left:3px solid var(--ok);border-radius:8px;padding:9px 11px;margin:8px 0;font-size:13.5px}
 .err{background:var(--card2);border-left:3px solid var(--err);border-radius:8px;padding:9px 11px;margin:8px 0;font-size:13.5px}
 .warn2{background:var(--card2);border-left:3px solid var(--warn);border-radius:8px;padding:9px 11px;margin:8px 0;font-size:13.5px}
 .ovbox{background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin:8px 0;font-size:13px}
 details.art{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:7px 0;padding:2px 10px}
 details.art summary{cursor:pointer;padding:8px 2px;list-style:none} details.art summary::-webkit-details-marker{display:none}
 .mut{color:var(--mut);font-size:12.5px} code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
 .savebar{position:fixed;left:0;right:0;bottom:0;background:var(--bg);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:10px;align-items:center;z-index:20}
 .savebar .sp{flex:1} #dirtyTag{background:var(--warn);color:#201800;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700}
 #toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#111;color:#fff;padding:9px 16px;border-radius:10px;font-size:13px;z-index:30}
 select[data-amb]{width:auto;display:inline-block;min-height:34px;padding:4px 8px}
 .checks{display:flex;flex-wrap:wrap;gap:8px 14px;margin:2px 0}
 .chk2{display:flex;align-items:center;gap:7px;font-size:13.5px;cursor:pointer} .chk2 input{width:18px;height:18px}
 .chk{display:flex;align-items:center;gap:7px;padding:5px 2px;cursor:pointer;font-size:13.5px}
 .chk.sub{padding-left:22px;font-size:13px} .chk input{width:18px;height:18px;flex:0 0 auto}
 .kd{background:var(--chip,#232832);color:var(--mut);border-radius:5px;padding:0 6px;font-size:11px;font-weight:700}
 .song{border-top:1px solid var(--line);padding:4px 0}
 .songhead{display:flex;align-items:center;gap:6px} .songhead .chk{flex:1}
 .docbar .mini{min-height:34px} .docbar .mini.on{background:var(--acc);color:#fff;border-color:transparent;font-weight:600}
 .mini[disabled]{opacity:.35;cursor:default}
 iframe.hasbar{height:calc(100vh - 165px)}
 @media(max-width:560px){ iframe.hasbar{height:calc(100vh - 158px)} }
 .slotrow{display:flex;align-items:center;gap:8px;padding:6px 2px;border-top:1px solid var(--line);flex-wrap:wrap}
 .slotrow .sl{min-width:26px;text-align:center;background:var(--chip,#232832);color:var(--mut);border-radius:6px;font-size:12px;font-weight:700;padding:2px 0}
 .slotrow .lbl{flex:1;min-width:140px;font-size:13.5px} .slotrow .gap{color:var(--err);font-weight:600}
 .overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:50}
 .overlay[hidden]{display:none}
 .sheet{background:var(--bg);border:1px solid var(--line);border-radius:16px 16px 0 0;width:100%;max-width:640px;max-height:82vh;display:flex;flex-direction:column;padding:12px 14px}
 @media(min-width:560px){.overlay{align-items:center}.sheet{border-radius:16px}}
 .sheethead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
 #pickSearch{margin-bottom:8px}
 .picklist{overflow:auto;flex:1;min-height:0}
 .pick{display:block;text-align:left;width:100%;min-height:0;padding:9px 11px;margin-bottom:4px} .pick .mut{display:block;margin-top:2px}
 .pick.sel{border-color:var(--acc);background:var(--accbg,rgba(80,140,255,.14))}
 .pick .tick{display:none;float:right;font-weight:800;color:var(--acc)} .pick.sel .tick{display:inline}
 .pickfoot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}
 .pickfoot[hidden]{display:none} .pickfootbtns{display:flex;gap:6px} #pickAdd[disabled]{opacity:.5}
 .appbar{position:sticky;top:0;z-index:15;background:var(--bg);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:8px 12px}
 .brand{font-size:15px;white-space:nowrap} .brand b{font-weight:800}
 .maintabs{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex:1}
 .maintab{flex:0 0 auto;display:inline-flex;align-items:center;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--mut);font-size:13px;cursor:pointer;white-space:nowrap;min-height:40px;position:relative}
 .maintab.on{background:var(--acc);color:#fff;border-color:transparent;font-weight:600}
 .ic{margin-right:5px;font-size:14px;line-height:1}
 .maintab.connected::after,.mitem.connected::after{content:"";position:absolute;top:6px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 5px var(--ok)}
 /* mobile menu (hidden on desktop) */
 .menuBtn{display:none;align-items:center;gap:8px;flex:1;justify-content:space-between;padding:9px 13px;border:1px solid var(--line);border-radius:999px;background:var(--acc);color:#fff;font-size:14px;font-weight:600;cursor:pointer;min-height:42px;position:relative}
 .menuBtn .caret{opacity:.85}
 .menuBtn.conn::before{content:"";position:absolute;top:7px;left:9px;width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 5px var(--ok)}
 .menu{display:none;position:absolute;top:calc(100% + 4px);right:8px;left:8px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.35);padding:6px;z-index:40;max-height:78vh;overflow:auto}
 .menu.open{display:block}
 .mgrp{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:8px 10px 3px}
 .mitem{display:flex;align-items:center;width:100%;text-align:left;padding:11px 12px;border:0;background:transparent;color:var(--ink);font-size:14.5px;border-radius:8px;cursor:pointer;min-height:44px;position:relative}
 .mitem.on{background:var(--acc);color:#fff;font-weight:600}
 @media(max-width:720px){ .maintabs{display:none} .menuBtn{display:inline-flex} }
 .view{display:none} .view.active{display:block}
 .view .tabs{position:static}
 .view iframe.full{width:100%;height:calc(100vh - 120px);border:0;border-radius:0;margin:0;background:#fff}
 .docbar{display:flex;gap:8px;padding:10px 12px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap}
 .docbar .seg{display:inline-flex;gap:4px} .docbar .segright{margin-left:auto}
 .loading{padding:20px;color:var(--mut)}
 @media(max-width:560px){ h1{font-size:16px} .brand{font-size:13px} .row button{flex:1 1 100%} iframe{height:68vh} .view iframe.full{height:calc(100vh - 112px)} }
 /* short viewports (landscape phones): shrink the chrome so the listing gets the height */
 @media(max-height:520px){
  .appbar{padding:3px 10px} .brand{font-size:12.5px}
  .maintab{min-height:30px;padding:4px 10px;font-size:12px}
  .tabs{padding:4px 10px} .tab{min-height:30px;padding:5px 11px}
  .docbar{padding:4px 10px} .docbar .mini{min-height:26px}
  .view iframe.full{height:calc(100vh - 86px)} iframe.hasbar{height:calc(100vh - 90px)}
 }
`;

const BODY = String.raw`
<div class="appbar">
 <div class="brand">🎛️ PocketMaster <b>Studio</b></div>
 <div class="maintabs" id="maintabs"></div>
 <button class="menuBtn" id="menuBtn" aria-expanded="false" aria-haspopup="true"><span id="menuBtnLabel"></span><span class="caret">▾</span></button>
 <div class="menu" id="menu"></div>
</div>
<div id="compat" class="warn" hidden></div>
<div id="views">
<section class="view active" id="view-studio">
 <div class="note">⚠️ To connect the pedal (<b>Editor</b> tab) and to save, you need <b>Chrome</b>, <b>Edge</b> or <b>Opera</b> (Chromium with Web Bluetooth), on desktop or Android. Safari/Firefox won't work.</div>
 <div class="tabs">
 <button class="tab on" data-tab="overview">Overview</button>
 <button class="tab" data-tab="prompt">AI Prompt</button>
 <button class="tab" data-tab="paste">Paste JSON</button>
 <button class="tab" data-tab="data">Data</button>
 <button class="tab" data-tab="collections">Collections</button>
</div>
<div class="wrap">
 <section class="panel" id="panel-overview">
  <div id="stats">Loading…</div>
  <div class="row">
   <button id="exportZip">📦 Export ZIP (full structure)</button>
   <button id="importBtn">📥 Import project…</button>
   <button id="dlIndex">⬇️ index.html</button>
   <input id="importFile" type="file" accept=".zip,.json" hidden>
  </div>
  <div class="sub">The ZIP contains <b>data/</b> (source) + <b>json/</b> and <b>json_nam/</b> (generated) + listings + <code>PocketMasterStudio.html</code> + <code>pocketmaster.source.json</code>. Import accepts that ZIP (or its <code>.source.json</code>).</div>
  <div class="sub">Preview of the generated listing:</div>
  <iframe id="preview" title="preview"></iframe>
 </section>

 <section class="panel" id="panel-prompt" hidden>
  <p class="mut">Fill in and generate a prompt to paste into any AI chat (ChatGPT, Claude, Gemini…). Ask it for the <b>source JSON</b> (<code>data/&lt;Artist&gt;.json</code>), then paste the result in the <b>Paste JSON</b> tab.</p>
  <label>Artist</label><input id="pArtist" placeholder="e.g. The Police">
  <label>Preset types (default: all)</label>
  <div class="checks" id="pTypes">
   <label class="chk2"><input type="checkbox" value="soft/clean rhythm" checked> Soft/clean rhythm</label>
   <label class="chk2"><input type="checkbox" value="heavy rhythm" checked> Heavy rhythm</label>
   <label class="chk2"><input type="checkbox" value="soft/melodic solo" checked> Soft solo</label>
   <label class="chk2"><input type="checkbox" value="loud/shred solo" checked> Loud solo</label>
  </div>
  <label>Songs / tones you want, and any extra detail</label><textarea id="pSongs" placeholder='e.g. "the clean riff of Message in a Bottle", "the solo of Walking on the Moon"'></textarea>
  <label>Output format</label>
  <select id="pFmt"><option value="app source data JSON">Source JSON (recommended, to incorporate here)</option><option value="complete pedal JSON">Complete pedal JSON</option><option value="both">Both</option></select>
  <div class="row"><button id="genPrompt" class="primary">Generate prompt</button><button id="copyPrompt" hidden>Copy prompt</button></div>
  <textarea id="promptOut" hidden style="min-height:220px"></textarea>
 </section>

 <section class="panel" id="panel-paste" hidden>
  <p class="mut">Paste the JSON an AI returned (artist source format) <b>or</b> a preset/batch exported from the pedal. It is auto-detected:</p>
  <ul class="mut" style="margin-top:0">
   <li><b>Artist source</b> → creates/updates the artist and its presets.</li>
   <li><b>Pedal export</b> → makes it <b>definitive</b> (override), matched by preset name.</li>
  </ul>
  <textarea id="pasteBox" placeholder="Paste the JSON here…"></textarea>
  <div class="row"><button id="analyzeBtn" class="primary">Analyze</button><button id="applyBtn" class="attn" hidden>Incorporate and regenerate</button></div>
  <div id="pasteResult"></div>
 </section>

 <section class="panel" id="panel-data" hidden>
  <p class="mut">Embedded source (build order). Tick songs or presets and delete them; if any is used in a collection, you'll be asked what to replace it with.</p>
  <div class="row"><button id="delBtn" class="attn">🗑️ Delete selected</button></div>
  <div id="dataList"></div>
 </section>

 <section class="panel" id="panel-collections" hidden>
  <p class="mut">Manage collections: reorder slots (↑/↓), replace or remove them, or add a preset (searchable). If a collection is full, you choose which slot to replace. You can also create new collections or delete one.</p>
  <label>Collection</label><select id="collSel"></select>
  <div class="row"><button id="collAdd" class="primary">➕ Add preset (search)</button><button id="collNew">🆕 New collection</button><button id="collDelete" class="attn">🗑️ Delete collection</button></div>
  <div id="collBody"></div>
 </section>
 </div>
</section>
</div>

<div id="picker" class="overlay" hidden>
 <div class="sheet">
  <div class="sheethead"><b id="pickTitle">Choose preset</b><button id="pickClose" class="mini">✕</button></div>
  <input id="pickSearch" placeholder="Search by name, artist, song…">
  <div id="pickList" class="picklist"></div>
  <div id="pickFoot" class="pickfoot" hidden>
   <span id="pickCount" class="mut"></span>
   <span class="pickfootbtns"><button id="pickCancel" class="mini">Cancel</button><button id="pickAdd" class="mini on">Add</button></span>
  </div>
 </div>
</div>
<div class="savebar">
 <span id="dirtyTag" hidden>unsaved changes</span><span class="sp"></span>
 <button id="saveBtn" class="primary">💾 Save this app (HTML)</button>
</div>
<div id="toast" hidden></div>
`;

const html =
`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PocketMaster Studio</title>
<style>${CSS}</style></head><body>
${BODY}
<script type="text/plain" id="pm-payload">${blob}</script>
<script type="text/plain" id="pm-editor">${editorBlob}</script>
${modules}
<script>${appJs}</script>
</body></html>`;

const OUT = path.join(ROOT, "PocketMasterStudio.html");
fs.writeFileSync(OUT, html, "utf-8");
console.log("wrote", OUT, "(" + (html.length / 1024).toFixed(0) + " KB)");
