// studio_app.js — PocketMaster Studio controller (UI + flows).
// Depends on PMBuild, PMHtml, PMTabla, PMMap, PMMd, PMEdit (inlined before this).
(function () {
  "use strict";
  const PRISTINE = "<!doctype html>\n" + document.documentElement.outerHTML;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, attrs, html) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
  const escH = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const S = { payload: null, built: null, nameIndex: {}, dirty: false, origBlob: null };

  // ---- gzip/base64 helpers ----
  async function inflateText(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  async function inflate(b64) { return JSON.parse(await inflateText(b64)); }
  async function gzipB64(str) {
    const bytes = new TextEncoder().encode(str);
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = ""; const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return btoa(bin);
  }

  // ---- pipeline ----
  function regen(pl) {
    const { files, total, artistCount } = PMBuild.buildSongs(pl.mld, pl.config, pl.data, pl.factory_overrides || {});
    // skipMissing:true so user deletions never crash the build (identical output when nothing is missing).
    const comps = PMBuild.buildCompilations(files, { collections: pl.collections || undefined, skipMissing: true });
    const jsonMap = Object.assign({}, files, comps);
    const { files: namMap } = PMBuild.buildNam(jsonMap, pl.nam_overrides || {});
    const { files: mixedMap } = PMBuild.buildMixed(jsonMap, pl.nam_overrides || {});
    const library = PMBuild.buildLibrary(jsonMap, namMap, mixedMap);
    return { files, jsonMap, namMap, mixedMap, comps, library, total, artistCount };
  }
  function rebuild() {
    const t0 = performance.now();
    S.built = regen(S.payload);
    S.nameIndex = PMEdit.buildNameIndex(S.built.library);
    const dt = (performance.now() - t0).toFixed(0);
    const b = S.built;
    const nOv = Object.keys(S.payload.factory_overrides || {}).length + Object.keys(S.payload.nam_overrides || {}).length;
    $("#stats").innerHTML = "<b>" + b.artistCount + "</b> artists · <b>" + b.total +
      "</b> presets · <b>" + Object.keys(b.jsonMap).length + "</b> json · <b>" + Object.keys(b.namMap).length +
      "</b> NAM · <b>" + nOv + "</b> overrides · <b>" + dt + " ms</b>";
    const idx = PMHtml.buildIndex(b.jsonMap);
    $("#preview").srcdoc = idx["index.html"];
    renderData();
    renderCollections();
    refreshMountedViews();
    markDirty(S.dirty);
  }
  function markDirty(d) {
    S.dirty = d;
    const btn = $("#saveBtn");
    btn.textContent = d ? "💾 Save changes (HTML)" : "💾 Save this app (HTML)";
    btn.classList.toggle("attn", d);
    $("#dirtyTag").hidden = !d;
  }

  // ---- tabs ----
  function showTab(id) {
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === id));
    $$(".panel").forEach((p) => { p.hidden = p.id !== "panel-" + id; });
  }

  // ---- PROMPT generation ----
  function buildPrompt() {
    const artist = $("#pArtist").value.trim();
    const songs = $("#pSongs").value.trim();
    const fmt = $("#pFmt").value;
    if (!artist) { alert("Enter the artist name."); return; }
    const types = $$("#pTypes input:checked").map((c) => c.value);
    const typesText = (types.length === 0 || types.length === 4)
      ? "all types (soft/clean rhythm, heavy rhythm, soft/melodic solo, loud/shred solo) — include the ones each song actually needs"
      : "only these types: " + types.join(", ");
    let body = S.payload.prompt || "";
    body = body.replace("[ARTIST]", artist)
      .replace('[SONGS — e.g. "the main riff and the solo of X", "the clean intro of Y"]', songs || "the representative songs/tones")
      .replace("[TYPES]", typesText)
      .replace('[choose: "complete pedal JSON", "app source data JSON", or "both"]', fmt);
    $("#promptOut").value = body;
    $("#promptOut").hidden = false;
    $("#copyPrompt").hidden = false;
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText($("#promptOut").value); $("#copyPrompt").textContent = "✓ Copied"; setTimeout(() => $("#copyPrompt").textContent = "Copy prompt", 1500); }
    catch (e) { $("#promptOut").select(); document.execCommand("copy"); }
  }

  // ---- PASTE / incorporate ----
  let PENDING = null;   // {kind, payload, report}
  function analyze() {
    const raw = $("#pasteBox").value.trim();
    const out = $("#pasteResult"); out.innerHTML = ""; PENDING = null; $("#applyBtn").hidden = true;
    if (!raw) return;
    let json; try { json = JSON.parse(raw); } catch (e) { out.innerHTML = '<div class="err">Invalid JSON: ' + escH(e.message) + "</div>"; return; }
    const fmt = PMEdit.detectFormat(json);
    if (fmt === "source") {
      // Source presets are Modeled-only; strip any NAM/Clone variants (their versions are auto-generated).
      const cl = PMEdit.cleanArtistSource(json);
      const cleaned = cl.cleaned;
      if (!cleaned.songs || !cleaned.songs.length) {
        out.innerHTML = '<div class="err">No Modeled presets found. Source presets must use a modeled amp — the NAM/Clone versions are generated automatically, so don\'t include Clone presets.</div>'; return;
      }
      let r; try { r = PMEdit.addArtistSource(S.payload, cleaned); } catch (e) { out.innerHTML = '<div class="err">' + escH(e.message) + "</div>"; return; }
      // validate by tentatively rebuilding
      try { regen(r.payload); } catch (e) { out.innerHTML = '<div class="err">Invalid against the device catalog:<br>' + escH(e.message) + "</div>"; return; }
      const nSongs = cleaned.songs.length, nPre = cleaned.songs.reduce((s, so) => s + (so.variants ? so.variants.length : 0), 0);
      const skipped = cl.removed.length ? "<br>⚠️ Skipped " + cl.removed.length + " NAM/Clone preset(s) — source presets are Modeled-only; the NAM versions are generated automatically." : "";
      out.innerHTML = '<div class="ok"><b>Artist source</b> detected.<br>' +
        (r.isNew ? "Will <b>create</b> the artist " : "Will <b>update</b> the artist ") + "<b>" + escH(r.name) + "</b> — " +
        nSongs + " song(s), " + nPre + " preset(s)." + skipped +
        (r.warnings.length ? "<br>⚠️ " + r.warnings.map(escH).join("<br>⚠️ ") : "") + "</div>";
      PENDING = { kind: "source", payload: r.payload };
      $("#applyBtn").hidden = false;
    } else if (fmt === "export") {
      const r = PMEdit.makeDefinitive(S.payload, json, { nameIndex: S.nameIndex });
      let html = '<div class="ok"><b>Pedal export</b> detected.</div>';
      if (r.applied.length) html += '<div class="ok">Will make <b>definitive</b> (override) ' + r.applied.length + ' preset(s):<br>' +
        r.applied.map((a) => "• " + escH(a.name) + " → " + escH(a.artist) + " (" + a.mode + ")").join("<br>") + "</div>";
      if (r.ambiguous.length) {
        html += '<div class="warn2">Names found in several artists — choose which:<br>' +
          r.ambiguous.map((a, i) => escH(a.name) + ' <select data-amb="' + i + '">' +
            a.artists.map((x) => '<option value="' + escH(x) + '">' + escH(x) + "</option>").join("") + "</select>").join("<br>") + "</div>";
      }
      if (r.unmatched.length) html += '<div class="warn2">No match (that presetName does not exist in the project): ' +
        r.unmatched.map(escH).join(", ") + "</div>";
      if (!r.applied.length && !r.ambiguous.length) { out.innerHTML = html; return; }
      out.innerHTML = html;
      PENDING = { kind: "export", raw: json };
      $("#applyBtn").hidden = false;
    } else {
      out.innerHTML = '<div class="err">Unrecognized format. It must be an artist source (<code>{name, songs:[…]}</code>) or a pedal preset export (with <code>modules</code>).</div>';
    }
  }
  function applyPending() {
    if (!PENDING) return;
    if (PENDING.kind === "source") { S.payload = PENDING.payload; }
    else if (PENDING.kind === "export") {
      // resolve ambiguous selects
      const chosen = {}; $$("#pasteResult select[data-amb]").forEach((sel, i) => { chosen[i] = sel.value; });
      // re-run makeDefinitive, forcing artist for ambiguous by re-detecting; simplest: apply per preset with chosen artists
      let pl = S.payload;
      const presets = PMEdit.presetsOf(PENDING.raw);
      const ambNames = {}; // name -> chosen artist
      const amb = PMEdit.makeDefinitive(pl, PENDING.raw, { nameIndex: S.nameIndex });
      amb.ambiguous.forEach((a, i) => { if (chosen[i]) ambNames[a.name] = chosen[i]; });
      // apply unambiguous first
      pl = amb.payload;
      // then ambiguous with forced artist
      for (const pr of presets) {
        if (ambNames[pr.presetName]) {
          const one = PMEdit.makeDefinitive(pl, { presets: [pr] }, { artist: ambNames[pr.presetName] });
          pl = one.payload;
        }
      }
      try { regen(pl); } catch (e) { alert("Invalid: " + e.message); return; }
      S.payload = pl;
    }
    markDirty(true); rebuild();
    $("#pasteBox").value = ""; $("#pasteResult").innerHTML = '<div class="ok">✓ Incorporated and regenerated. Don\'t forget to <b>Save</b>.</div>';
    $("#applyBtn").hidden = true; PENDING = null;
    showTab("overview");
  }

  // ---- searchable preset picker (shared) ----
  // Single mode: pickPreset(title, onPick) — click a row → onPick(ref), closes.
  // Multi mode:  pickPreset(title, onPickMany, {multi:true, max:N}) — tick up to N rows,
  //   press Add → onPickMany([ref,ref,…]). Selecting past N is blocked with a hint.
  function pickPreset(title, onPick, opts) {
    opts = opts || {};
    const multi = !!opts.multi, max = multi ? Math.max(1, opts.max | 0) : 1;
    // Sorted like the listings: artist (alphabetical) → song (by display title, grouped by slug) →
    // intensity (kept via the catalog's original calm→loud order — a stable sort preserves it).
    const cat = PMEdit.presetCatalog(S.built.jsonMap).slice().sort((a, b) => {
      const A = a.artist.toLowerCase(), B = b.artist.toLowerCase(); if (A !== B) return A < B ? -1 : 1;
      const ta = (a.title || a.slug || "").toLowerCase(), tb = (b.title || b.slug || "").toLowerCase(); if (ta !== tb) return ta < tb ? -1 : 1;
      const sa = (a.slug || "").toLowerCase(), sb = (b.slug || "").toLowerCase(); return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    const ov = $("#picker"); $("#pickTitle").textContent = title || "Choose preset";
    const inp = $("#pickSearch"), list = $("#pickList"), foot = $("#pickFoot");
    const sel = new Map(); // key "a|s|k" -> ref
    const key = (a, s, k) => a + "|" + s + "|" + k;
    function updateFoot() {
      if (!multi) return;
      $("#pickCount").textContent = sel.size + " / " + max + " selected";
      $("#pickAdd").disabled = sel.size === 0;
    }
    function render() {
      const t = inp.value.trim().toLowerCase();
      const rows = cat.filter((p) => !t || (p.name + " " + p.artist + " " + p.slug + " " + (p.title || "") + " " + p.kind).toLowerCase().includes(t));
      list.innerHTML = rows.map((p) => {
        const on = multi && sel.has(key(p.artist, p.slug, p.kind));
        return '<button class="pick' + (on ? " sel" : "") + '" data-a="' + escH(p.artist) + '" data-s="' + escH(p.slug) + '" data-k="' + escH(p.kind) + '">' +
          (multi ? '<span class="tick">✓</span>' : "") +
          "<b>" + escH(p.name) + "</b> <span class=\"mut\">" + escH(p.artist) + " · " + escH(p.title || p.slug) + " · " + escH(p.kind) + "</span></button>";
      }).join("") || '<div class="mut" style="padding:10px">No results.</div>';
    }
    inp.value = ""; sel.clear();
    foot.hidden = !multi; render(); updateFoot();
    ov.hidden = false; setTimeout(() => inp.focus(), 30);
    inp.oninput = render;
    const close = () => { ov.hidden = true; };
    list.onclick = (e) => {
      const b = e.target.closest(".pick"); if (!b) return;
      const ref = [b.dataset.a, b.dataset.s, b.dataset.k];
      if (!multi) { close(); onPick(ref); return; }
      const k = key(ref[0], ref[1], ref[2]);
      if (sel.has(k)) { sel.delete(k); b.classList.remove("sel"); }
      else {
        if (sel.size >= max) { toast("You can select up to " + max + " (free slots)."); return; }
        sel.set(k, ref); b.classList.add("sel");
      }
      updateFoot();
    };
    if (multi) {
      $("#pickAdd").onclick = () => { if (!sel.size) return; close(); onPick([...sel.values()]); };
      $("#pickCancel").onclick = close;
    }
    $("#pickClose").onclick = close;
  }

  // ---- DATA browse + delete ----
  function renderData() {
    const wrap = $("#dataList"); if (!wrap) return;
    const fov = S.payload.factory_overrides || {}, nov = S.payload.nam_overrides || {};
    const ovKeys = [...Object.keys(fov).map((k) => [k, "factory"]), ...Object.keys(nov).map((k) => [k, "nam"])];
    let html = "";
    if (ovKeys.length) {
      html += '<div class="ovbox"><b>Active overrides (definitive):</b><br>' +
        ovKeys.map(([k, w]) => '• <code>' + escH(k) + "</code> <span class=\"mut\">(" + w + ")</span> " +
          '<button class="mini" data-ov="' + escH(k) + '" data-ovw="' + w + '">remove</button>').join("<br>") + "</div>";
    }
    // source view: artist -> song -> variants (artists shown alphabetically, like the listings;
    // song reorder below operates on the actual data, independent of this display order).
    const artistsAlpha = [...S.payload.config.order].sort((a, b) => {
      const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0;
    });
    html += artistsAlpha.map((name) => {
      const a = S.payload.data[name]; if (!a) return "";
      const songs = a.songs.map((s, si) =>
        '<div class="song"><div class="songhead"><label class="chk"><input type="checkbox" data-del=\'' + escH(JSON.stringify({ artist: name, slug: s.slug })) + "'> <b>" + escH(s.short || s.slug) + '</b> <span class="mut">' + escH(s.slug) + "</span></label>" +
        '<button class="mini" data-sup=\'' + escH(JSON.stringify({ artist: name, index: si })) + "'" + (si === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="mini" data-sdown=\'' + escH(JSON.stringify({ artist: name, index: si })) + "'" + (si === a.songs.length - 1 ? " disabled" : "") + ">↓</button></div>" +
        s.variants.map((v, i) =>
          '<label class="chk sub"><input type="checkbox" data-del=\'' + escH(JSON.stringify({ artist: name, slug: s.slug, index: i })) + "'> " +
          '<span class="kd">' + escH(v.kind) + "</span> <span class=\"mut\">" + escH((v.desc || "").split(":")[0]) + "</span></label>").join("")
        + "</div>").join("");
      return '<details class="art"><summary><label class="chk"><input type="checkbox" data-del=\'' + escH(JSON.stringify({ artist: name })) + "'> <b>" + escH(name) + "</b></label> <span class=\"mut\">" + a.songs.length + " songs</span></summary>" +
        '<div style="padding:4px 2px">' + songs + "</div></details>";
    }).join("");
    wrap.innerHTML = html;
  }
  function selectedDeletions() {
    return $$("#dataList input[data-del]:checked").map((c) => JSON.parse(c.getAttribute("data-del")));
  }
  function doDelete() {
    const sel = selectedDeletions();
    if (!sel.length) { toast("Nothing selected."); return; }
    const p2 = PMEdit.deleteSelections(S.payload, sel);
    let built; try { built = regen(p2); } catch (e) { alert("Cannot: " + e.message); return; }
    // detect collection gaps
    PMEdit.ensureCollections(p2, PMBuild.defaultCollectionDefs());
    const gaps = PMEdit.collectionGaps(PMBuild.makeRefResolver(built.jsonMap), p2.collections);
    if (!gaps.length) { S.payload = p2; markDirty(true); rebuild(); toast("Deleted."); return; }
    // prompt to substitute each gap
    let idx = 0;
    const resolveNext = () => {
      if (idx >= gaps.length) { S.payload = p2; markDirty(true); rebuild(); toast("Deleted; collections updated."); return; }
      const g = gaps[idx];
      pickPreset("Gap in “" + g.collection + "” (slot " + (g.ri + 1) + ") — choose a replacement (or close to leave it empty)", (ref) => {
        p2.collections[g.ci].refs[g.ri] = ref; idx++; resolveNext();
      });
      // if user closes the picker, treat remaining as "leave gap" (skipMissing drops them)
      $("#pickClose").onclick = () => { $("#picker").hidden = true; S.payload = p2; markDirty(true); rebuild(); toast("Deleted; remaining gaps were removed from the collections."); };
    };
    if (confirm(sel.length + " selection(s) affect " + gaps.length + " collection ref(s). Substitute the gaps now?")) resolveNext();
    else { S.payload = p2; markDirty(true); rebuild(); toast("Deleted; gaps removed from the collections."); }
  }

  // Move a song up/down within its artist (reorders the artist bundle's slot order;
  // within a song, presets stay auto-ordered calm→loud).
  function moveSong(dataStr, dir) {
    const { artist, index } = JSON.parse(dataStr);
    const songs = S.payload.data[artist] && S.payload.data[artist].songs; if (!songs) return;
    const j = index + dir; if (j < 0 || j >= songs.length) return;
    const t = songs[index]; songs[index] = songs[j]; songs[j] = t;
    markDirty(true); rebuild();
  }

  // ---- COLLECTIONS manager ----
  function renderCollections() {
    const sel = $("#collSel"); if (!sel) return;
    PMEdit.ensureCollections(S.payload, PMBuild.defaultCollectionDefs());
    const cur = sel.value;
    sel.innerHTML = S.payload.collections.map((c, i) => '<option value="' + i + '">' + escH(c.collection) + "</option>").join("");
    if (cur !== "" && +cur < S.payload.collections.length) sel.value = cur;
    const ci = +sel.value || 0;
    const def = S.payload.collections[ci];
    if (!def) { $("#collBody").innerHTML = ""; return; }
    const resolver = PMBuild.makeRefResolver(S.built.jsonMap);
    const rows = def.refs.map((ref, ri) => {
      const p = resolver.pick(ref);
      const label = p ? escH(p.presetName) + ' <span class="mut">' + escH(p.artist) + " · " + escH((p.description || "").split(":")[0]) + "</span>" : '<span class="gap">⚠ gap: ' + escH(ref.join(" / ")) + "</span>";
      return '<div class="slotrow"><span class="sl">' + (ri + 1) + "</span><span class=\"lbl\">" + label + "</span>" +
        '<button class="mini" data-cup="' + ri + '"' + (ri === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="mini" data-cdown="' + ri + '"' + (ri === def.refs.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<button class="mini" data-crep="' + ri + '">Replace</button><button class="mini" data-crem="' + ri + '">Remove</button></div>';
    }).join("");
    $("#collBody").innerHTML = '<div class="mut">' + def.refs.length + " / " + def.n + " slots" +
      (def.refs.length >= def.n ? " (full)" : "") + "</div>" + rows;
  }
  function collNew() {
    const name = prompt("New collection name:"); if (!name || !name.trim()) return;
    const nm = name.trim();
    PMEdit.ensureCollections(S.payload, PMBuild.defaultCollectionDefs());
    let slug = nm.replace(/[^A-Za-z0-9]+/g, "") || ("Col" + (S.payload.collections.length + 1));
    let file = "Compilation_" + slug + ".json", i = 2;
    while (S.payload.collections.some((c) => c.file === file)) { file = "Compilation_" + slug + i + ".json"; i++; }
    const cap = parseInt(prompt("Max slots (cap)?", "50"), 10);
    S.payload.collections.push({ file, collection: nm, n: cap >= 1 ? cap : 50, refs: [] });
    markDirty(true); rebuild();
    $("#collSel").value = String(S.payload.collections.length - 1); renderCollections();
    toast("Collection created.");
  }
  function collDelete() {
    PMEdit.ensureCollections(S.payload, PMBuild.defaultCollectionDefs());
    const ci = +$("#collSel").value || 0;
    const def = S.payload.collections[ci]; if (!def) return;
    if (!confirm('Delete the collection “' + def.collection + '”?')) return;
    S.payload.collections.splice(ci, 1);
    $("#collSel").value = "0";
    markDirty(true); rebuild(); toast("Collection deleted.");
  }
  function collAdd() {
    const ci = +$("#collSel").value || 0;
    const def = S.payload.collections[ci];
    const free = def.n - def.refs.length;
    if (free > 0) {
      // free slots -> multi-select, capped at the number of free slots
      pickPreset("Add to “" + def.collection + "” (" + free + " free slot" + (free === 1 ? "" : "s") + ")",
        (refs) => { def.refs.push(...refs); markDirty(true); rebuild(); renderCollections(); toast("Added " + refs.length + "."); },
        { multi: true, max: free });
    } else {
      // full -> single pick, then ask which slot to replace (current behaviour)
      pickPreset("Replace a slot in “" + def.collection + "” (full)", (ref) => {
        const which = prompt("The collection is full (" + def.n + "). Which slot (1-" + def.n + ") do you replace?");
        const n = parseInt(which, 10);
        if (n >= 1 && n <= def.refs.length) { def.refs[n - 1] = ref; markDirty(true); rebuild(); renderCollections(); toast("Slot " + n + " replaced."); }
      });
    }
  }

  // ---- SAVE / EXPORT / IMPORT ----
  function serializeApp(blob) {
    return PRISTINE.replace(/(<script[^>]*id="pm-payload"[^>]*>)[\s\S]*?(<\/script>)/,
      (m, open, close) => open + blob + close);
  }
  // The full embedded source (everything the app needs to regenerate). Used by save + export.
  function sourcePayload() {
    return {
      config: S.payload.config, data: S.payload.data, mld: S.payload.mld, factory: S.payload.factory,
      factory_overrides: S.payload.factory_overrides || {}, nam_overrides: S.payload.nam_overrides || {},
      collections: S.payload.collections || null, prompt: S.payload.prompt || "", readme: S.payload.readme || "",
      docs: S.payload.docs || [],
    };
  }
  function download(fn, text, mime) {
    const b = (text instanceof Blob) ? text : new Blob([text], { type: mime || "text/plain" });
    const u = URL.createObjectURL(b);
    const a = el("a"); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  async function saveApp() {
    const blob = await gzipB64(JSON.stringify(sourcePayload()));
    const html = serializeApp(blob);
    const fn = "PocketMasterStudio.html";
    if (window.showSaveFilePicker) {
      try { const h = await window.showSaveFilePicker({ suggestedName: fn, types: [{ description: "HTML", accept: { "text/html": [".html"] } }] });
        const w = await h.createWritable(); await w.write(html); await w.close(); markDirty(false); toast("Saved."); return;
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    download(fn, html, "text/html"); markDirty(false); toast("Downloaded " + fn + ".");
  }
  // Export the full extracted file tree (source + generated json/json_nam + listings + app + lossless source.json) as a ZIP.
  async function exportZip() {
    toast("Generating ZIP…");
    const b = S.built, files = [];
    files.push({ name: "data/_config.json", data: PMBuild.stringify(S.payload.config) });
    for (const name of Object.keys(S.payload.data)) files.push({ name: "data/" + name.replace(/\//g, "-") + ".json", data: PMBuild.stringify(S.payload.data[name]) });
    // overrides + custom collections (loaded by the Node build from the repo root)
    files.push({ name: "factory_overrides.json", data: PMBuild.stringify(S.payload.factory_overrides || {}) });
    files.push({ name: "nam_overrides.json", data: PMBuild.stringify(S.payload.nam_overrides || {}) });
    if (S.payload.collections) files.push({ name: "collections.json", data: PMBuild.stringify(S.payload.collections) });
    const emit = (folder, map) => {
      for (const rel of Object.keys(map)) files.push({ name: folder + "/" + rel, data: PMBuild.stringify(map[rel]) });
      const idx = PMHtml.buildIndex(map); files.push({ name: folder + "/index.html", data: idx["index.html"] }); files.push({ name: folder + "/README.md", data: idx["README.md"] });
      const tab = PMTabla.buildTabla(map, S.payload.factory); files.push({ name: folder + "/presets_full.html", data: tab["presets_full.html"] }); files.push({ name: folder + "/presets_print.html", data: tab["presets_print.html"] });
      const mp = PMMap.buildM50(map); files.push({ name: folder + "/map_Best50.html", data: mp["map_Best50.html"] }); files.push({ name: folder + "/map_Best50_print.html", data: mp["map_Best50_print.html"] });
    };
    emit("json", b.jsonMap); emit("json_nam", b.namMap); emit("json_mixed", b.mixedMap);
    files.push({ name: "pocketmaster.source.json", data: JSON.stringify(sourcePayload(), null, 1) });
    if (S.payload.readme) files.push({ name: "README.md", data: S.payload.readme });
    const appBlob = await gzipB64(JSON.stringify(sourcePayload()));
    files.push({ name: "PocketMasterStudio.html", data: serializeApp(appBlob) });
    const zip = await PMZip.create(files);
    download("PocketMasterStudio-project.zip", zip);
    toast("ZIP downloaded (" + files.length + " files).");
  }
  async function importProject(file) {
    try {
      const ab = await file.arrayBuffer();
      let src = null;
      if (/\.json$/i.test(file.name)) { src = JSON.parse(new TextDecoder().decode(new Uint8Array(ab))); }
      else {
        const map = await PMZip.read(ab);
        if (map["pocketmaster.source.json"]) src = JSON.parse(PMZip.dec(map["pocketmaster.source.json"]));
        else {
          const cfgF = map["data/_config.json"]; if (!cfgF) throw new Error("The ZIP has neither pocketmaster.source.json nor data/_config.json.");
          const config = JSON.parse(PMZip.dec(cfgF)); const data = {};
          for (const name of Object.keys(map)) { const m = name.match(/^data\/(.+)\.json$/); if (m && name !== "data/_config.json") { const art = JSON.parse(PMZip.dec(map[name])); data[art.name] = art; } }
          src = { config, data };
        }
      }
      src.mld = src.mld || S.payload.mld; src.factory = src.factory || S.payload.factory; src.prompt = src.prompt || S.payload.prompt;
      src.readme = src.readme || S.payload.readme; src.docs = (src.docs && src.docs.length) ? src.docs : S.payload.docs; src.factory_overrides = src.factory_overrides || {}; src.nam_overrides = src.nam_overrides || {};
      src.collections = src.collections || null;
      if (!src.config || !src.data) throw new Error("Incomplete project (missing config or data).");
      S.payload = src; markDirty(true); rebuild(); toast("Project imported."); showTab("overview");
    } catch (e) { alert("Could not import: " + e.message); }
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; setTimeout(() => t.hidden = true, 2500); }

  // ---- main views (Studio + embedded editor + live listings + docs) ----
  const MAIN = [
    { id: "studio", label: "Studio", icon: "🎛️", group: "" },
    { id: "editor", label: "Editor", icon: "🎸", group: "", allow: "bluetooth *; usb *; midi *; serial *; hid *" },
    { id: "index", label: "Listing", icon: "📋", group: "", variants: true, gen: (map) => PMHtml.buildIndex(map)["index.html"] },
    { id: "full", label: "Table", icon: "🗂️", group: "", variants: true, gen: (map) => PMTabla.buildTabla(map, S.payload.factory)["presets_full.html"], printGen: (map) => PMTabla.buildTabla(map, S.payload.factory)["presets_print.html"] },
    { id: "map", label: "Map", icon: "🗺️", group: "", variants: true, gen: (map) => PMMap.buildM50(map)["map_Best50.html"], printGen: (map) => PMMap.buildM50(map)["map_Best50_print.html"] },
    { id: "docs", label: "Docs", icon: "📖", group: "" },
  ];
  // amp-set variants shown as a radio-style selector on each listing view.
  const VARIANTS = [["modeled", "Modeled"], ["clone", "Clone/NAM"], ["mixed", "Mixed"]];
  const mapFor = (v) => v === "clone" ? S.built.namMap : v === "mixed" ? S.built.mixedMap : S.built.jsonMap;
  const DEFAULT_VARIANT = "mixed";
  // Capture/restore a listing iframe's UI state (search text, open <details>, scroll) so switching
  // amp-set variant keeps the same view — the generated DOM is structurally identical across variants,
  // so open <details> are matched by their ordinal index.
  function captureListState(doc) {
    if (!doc) return null;
    const q = doc.querySelector("#q");
    const open = []; doc.querySelectorAll("details").forEach((d, i) => { if (d.open) open.push(i); });
    const se = doc.scrollingElement || doc.documentElement;
    return { q: q ? q.value : "", open, scroll: se ? se.scrollTop : 0 };
  }
  function restoreListState(doc, st) {
    if (!doc || !st) return;
    const q = doc.querySelector("#q");
    if (q && st.q) { q.value = st.q; q.dispatchEvent(new (doc.defaultView || window).Event("input", { bubbles: true })); }
    const openSet = new Set(st.open);
    doc.querySelectorAll("details").forEach((d, i) => { d.open = openSet.has(i); });
    const se = doc.scrollingElement || doc.documentElement;
    if (se) { se.scrollTop = st.scroll; requestAnimationFrame(() => { try { se.scrollTop = st.scroll; } catch (e) {} }); }
  }
  const mounted = { studio: true };
  let activeMain = "studio";
  const tabHtml = (t) => '<span class="ic">' + t.icon + "</span>" + escH(t.label);
  function buildAppbar() {
    const bar = $("#maintabs");
    bar.innerHTML = MAIN.map((t) => '<button class="maintab" data-main="' + t.id + '">' + tabHtml(t) + "</button>").join("");
    // mobile dropdown menu (grouped), marks the current tab
    let menuHtml = "", lastG = null;
    for (const t of MAIN) {
      if (t.group && t.group !== lastG) menuHtml += '<div class="mgrp">' + escH(t.group) + "</div>";
      lastG = t.group || null;
      menuHtml += '<button class="mitem" data-main="' + t.id + '">' + tabHtml(t) + "</button>";
    }
    $("#menu").innerHTML = menuHtml;
    $$("[data-main]").forEach((b) => b.addEventListener("click", () => { activate(b.dataset.main); closeMenu(); }));
    $("#menuBtn").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
    $("#menu").addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);
    activate("studio");
  }
  const openMenu = () => { $("#menu").classList.add("open"); $("#menuBtn").setAttribute("aria-expanded", "true"); };
  function closeMenu() { $("#menu").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); }
  const toggleMenu = () => ($("#menu").classList.contains("open") ? closeMenu() : openMenu());
  function setEditorConnected(c) {
    $$('[data-main="editor"]').forEach((el) => el.classList.toggle("connected", c));
    $("#menuBtn").classList.toggle("conn", c);
  }
  function activate(id) {
    activeMain = id;
    const t = MAIN.find((x) => x.id === id) || MAIN[0];
    $$(".maintab, .mitem").forEach((b) => b.classList.toggle("on", b.dataset.main === id));
    $("#menuBtnLabel").innerHTML = tabHtml(t);
    if (!mounted[id]) mount(id);
    $$("#views .view").forEach((v) => v.classList.toggle("active", v.id === "view-" + id));
  }
  function mount(id) {
    mounted[id] = true;
    const t = MAIN.find((x) => x.id === id);
    const view = el("section", { class: "view", id: "view-" + id });
    $("#views").appendChild(view);
    if (id === "editor") return mountEditor(view, t);
    if (id === "docs") return mountDocs(view);
    const f = el("iframe", { class: "full", title: t.label });
    f.dataset.mode = "interactive";
    t._variant = t._variant || DEFAULT_VARIANT;
    const render = () => {
      const map = t.variants ? mapFor(t._variant) : S.built.jsonMap;
      f.srcdoc = (f.dataset.mode === "print" && t.printGen) ? t.printGen(map) : t.gen(map);
    };
    t._render = render;
    // Re-render carrying over the current view (search/expanded/scroll); used on variant switch.
    const renderKeepState = () => {
      let st = null;
      if (f.dataset.mode !== "print") { try { st = captureListState(f.contentDocument); } catch (e) {} }
      if (st) f.addEventListener("load", () => { try { restoreListState(f.contentDocument, st); } catch (e) {} }, { once: true });
      render();
    };
    if (t.variants || t.printGen) {
      const bar = el("div", { class: "docbar" });
      if (t.variants) {
        const grp = el("div", { class: "seg" });
        VARIANTS.forEach(([v, lbl]) => {
          const b = el("button", { class: "mini" + (t._variant === v ? " on" : "") }, lbl);
          b.onclick = () => { if (t._variant === v) return; t._variant = v; $$("button", grp).forEach((x) => x.classList.remove("on")); b.classList.add("on"); renderKeepState(); };
          grp.appendChild(b);
        });
        bar.appendChild(grp);
      }
      if (t.printGen) {
        const grp2 = el("div", { class: "seg segright" });
        const b1 = el("button", { class: "mini on" }, "Interactive");
        const b2 = el("button", { class: "mini" }, "🖨 Print (A4)");
        b1.onclick = () => { f.dataset.mode = "interactive"; b1.classList.add("on"); b2.classList.remove("on"); render(); };
        b2.onclick = () => { f.dataset.mode = "print"; b2.classList.add("on"); b1.classList.remove("on"); render(); };
        grp2.appendChild(b1); grp2.appendChild(b2); bar.appendChild(grp2);
      }
      view.appendChild(bar);
      f.classList.add("hasbar");
    }
    render(); view.appendChild(f); t._f = f;
  }
  async function mountEditor(view, t) {
    const load = el("div", { class: "loading" }, "Loading editor…"); view.appendChild(load);
    try {
      let html = await inflateText($("#pm-editor").textContent.trim());
      // inject a fresh Browse Library from current data (editor's loadLibrary accepts plain JSON).
      // Escape </ so a stray sequence in the data can't close the editor's <script> when it parses.
      const lib = PMBuild.compactStringify(PMBuild.buildLibrary(S.built.jsonMap, S.built.namMap, S.built.mixedMap)).replace(/<\//g, "<\\/");
      html = html.replace(/(<script id="pm-library"[^>]*>)[\s\S]*?(<\/script>)/, (m, o, c) => o + lib + c);
      const f = el("iframe", { class: "full", title: "Editor", referrerpolicy: "no-referrer" });
      if (t.allow) f.setAttribute("allow", t.allow);
      f.addEventListener("load", () => load.remove());
      f.src = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      view.appendChild(f); t._f = f;
    } catch (e) { load.textContent = "Error loading the editor: " + (e && e.message || e); }
  }
  function mountDocs(view) {
    const docs = S.payload.docs || [];
    const bar = el("div", { class: "docbar" });
    const sel = el("select"); sel.style.width = "auto";
    sel.innerHTML = docs.map((d, i) => '<option value="' + i + '">' + escH(d.label) + "</option>").join("");
    bar.appendChild(sel); view.appendChild(bar);
    const f = el("iframe", { class: "full", title: "Docs" }); view.appendChild(f);
    const show = () => { const d = docs[+sel.value || 0]; if (d) f.srcdoc = PMMd.to_document(d.md, d.label); };
    sel.addEventListener("change", show); show();
  }
  function refreshMountedViews() {
    for (const t of MAIN) if (t._render && t._f && mounted[t.id]) {
      try { t._render(); } catch (e) {}
    }
  }
  // Editor <-> Studio bridge.
  //  pm-connection : reflect the pedal connection on the Editor tab (green dot).
  //  pm-download   : plain Export / Export Multiple -> just save the JSON to disk.
  //  pm-override   : "Export as Override" -> route the preset into Paste JSON (make it definitive).
  function editorBridge(d) {
    if (d.type === "pm-connection") {
      setEditorConnected(!!d.connected);
    } else if (d.type === "pm-download" && typeof d.text === "string") {
      download(d.filename || "download.json", d.text, d.mime);
    } else if (d.type === "pm-override" && typeof d.text === "string") {
      $("#pasteBox").value = d.text; activate("studio"); showTab("paste"); analyze();
      toast("Preset sent from the editor — review in “Paste JSON” and click Incorporate.");
    }
  }

  // ---- init ----
  function compat() {
    const miss = [];
    if (typeof DecompressionStream === "undefined") miss.push("DecompressionStream");
    if (typeof CompressionStream === "undefined") miss.push("CompressionStream (saving)");
    if (!("bluetooth" in navigator)) miss.push("Web Bluetooth (pedal)");
    if (miss.length) { const e = $("#compat"); e.hidden = false; e.innerHTML = "Your browser does not support: <b>" + miss.join("</b>, <b>") + "</b>. Use <b>Chrome</b>, <b>Edge</b> or <b>Opera</b>."; }
  }

  async function boot() {
    compat();
    buildAppbar();
    window.addEventListener("message", (ev) => { if (ev.data) editorBridge(ev.data); });
    $$(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
    $("#genPrompt").addEventListener("click", buildPrompt);
    $("#copyPrompt").addEventListener("click", copyPrompt);
    $("#analyzeBtn").addEventListener("click", analyze);
    $("#applyBtn").addEventListener("click", applyPending);
    $("#saveBtn").addEventListener("click", saveApp);
    $("#dlIndex").addEventListener("click", () => S.built && download("index.html", PMHtml.buildIndex(S.built.jsonMap)["index.html"], "text/html"));
    $("#delBtn").addEventListener("click", doDelete);
    $("#collSel").addEventListener("change", renderCollections);
    $("#collAdd").addEventListener("click", collAdd);
    $("#collNew").addEventListener("click", collNew);
    $("#collDelete").addEventListener("click", collDelete);
    $("#exportZip").addEventListener("click", () => exportZip().catch((e) => alert("ZIP error: " + e.message)));
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importProject(f); e.target.value = ""; });
    document.addEventListener("click", (e) => {
      const ov = e.target.closest("button[data-ov]");
      if (ov) { S.payload = PMEdit.removeOverride(S.payload, ov.dataset.ov, ov.dataset.ovw); markDirty(true); rebuild(); return; }
      const rep = e.target.closest("button[data-crep]");
      if (rep) { const ci = +$("#collSel").value || 0; const ri = +rep.dataset.crep;
        pickPreset("Replace slot " + (ri + 1), (ref) => { S.payload.collections[ci].refs[ri] = ref; markDirty(true); rebuild(); }); return; }
      const rem = e.target.closest("button[data-crem]");
      if (rem) { const ci = +$("#collSel").value || 0; const ri = +rem.dataset.crem;
        if (confirm("Remove this slot from the collection? (you can substitute it instead with Replace)")) {
          S.payload.collections[ci].refs.splice(ri, 1); markDirty(true); rebuild();
        } return; }
      const cup = e.target.closest("button[data-cup]");
      if (cup) { const ci = +$("#collSel").value || 0, ri = +cup.dataset.cup, r = S.payload.collections[ci].refs;
        if (ri > 0) { const t = r[ri - 1]; r[ri - 1] = r[ri]; r[ri] = t; markDirty(true); rebuild(); } return; }
      const cdn = e.target.closest("button[data-cdown]");
      if (cdn) { const ci = +$("#collSel").value || 0, ri = +cdn.dataset.cdown, r = S.payload.collections[ci].refs;
        if (ri < r.length - 1) { const t = r[ri + 1]; r[ri + 1] = r[ri]; r[ri] = t; markDirty(true); rebuild(); } return; }
      const sup = e.target.closest("button[data-sup]"); if (sup) { moveSong(sup.dataset.sup, -1); return; }
      const sdn = e.target.closest("button[data-sdown]"); if (sdn) { moveSong(sdn.dataset.sdown, 1); return; }
    });
    try {
      S.origBlob = $("#pm-payload").textContent.trim();
      S.payload = await inflate(S.origBlob);
      if (!S.payload.factory_overrides) S.payload.factory_overrides = {};
      if (!S.payload.nam_overrides) S.payload.nam_overrides = {};
      rebuild();
    } catch (e) { $("#stats").innerHTML = '<span class="err">ERROR: ' + escH(e.message) + "</span>"; }
    window.PMStudio = { S, rebuild, gzipB64, inflate, serializeApp, exportZip, importProject, sourcePayload };
  }
  window.addEventListener("DOMContentLoaded", boot);
})();
