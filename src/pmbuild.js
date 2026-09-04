// pmbuild.js — in-browser/Node port of the PocketMaster generator pipeline.
// Pure logic (no fs): give it parsed inputs, get back an in-memory file map.
// Phase 1: gen_songs.py port (buildSongs).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMBuild = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CHAIN = ["NR", "FX1", "DRV", "AMP", "IR", "EQ", "FX2", "DLY", "RVB"];
  const TODAY = "2026-08-18";        // gen_songs.py TODAY
  const COMP_TODAY = "2026-08-19";   // gen_compilations.py TODAY

  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Serialize like Python json.dumps(indent=2, ensure_ascii=False). The device
  // catalog's only float-typed parameter is "Rate" (every Rate literal, in the
  // catalog defaults and in data/, is a float), so a whole-number Rate must keep
  // its ".0" to match Python's float formatting. JS has no int/float split, so we
  // tag whole Rate values and restore the decimal after stringify.
  function stringify(obj, indent = 2) {
    const s = JSON.stringify(obj, (k, v) =>
      (k === "Rate" && typeof v === "number" && Number.isInteger(v)) ? `__RATEFLOAT__${v}__` : v, indent);
    return s.replace(/"__RATEFLOAT__(-?\d+)__"/g, "$1.0");
  }
  // Compact form, matching Python json.dumps(separators=(",",":")).
  const compactStringify = (obj) => stringify(obj, 0);

  function makeCatalog(mld) {
    const LIB = mld.effectLibrary;
    const MODULES = {};
    for (const m of mld.modules) MODULES[m.name] = m;
    return { LIB, MODULES };
  }

  function find(cat, module, effname) {
    for (const eid of cat.MODULES[module].effects) {
      const e = cat.LIB[String(eid)];
      if (e.name === effname) return [eid, e];
    }
    throw new Error(`Effect '${effname}' not in module ${module}`);
  }

  const P = (effect, enabled = true, params = {}) => ({ effect, enabled, params });

  function build_module(cat, module, spec) {
    const [, e] = find(cat, module, spec.effect);
    const valid = {};
    for (const a of e.alg) valid[a.name] = a;
    const out = {};
    for (const a of e.alg) out[a.name] = "defaultValue" in a ? a.defaultValue : null;
    for (const [k, v] of Object.entries(spec.params || {})) {
      if (!(k in valid))
        throw new Error(`Param '${k}' invalid for ${module}/${spec.effect}. Valid: ${Object.keys(valid)}`);
      const lo = valid[k].min, hi = valid[k].max;
      if (lo != null && hi != null && !(lo <= v && v <= hi))
        throw new Error(`Param ${module}/${spec.effect}/${k}=${v} out of [${lo},${hi}]`);
      out[k] = v;
    }
    return { enabled: spec.enabled, effect: spec.effect, parameters: out };
  }

  const DEF = {
    NR: P("Gate", true, { THRE: 6 }),
    FX1: P("Boost", false),
    DRV: P("Scream", false),
    AMP: P("Brit 800", true),
    IR: P("BritGN 4x12", true),
    EQ: P("GT EQ 1", false),
    FX2: P("Boost", false),
    DLY: P("Pure", false),
    RVB: P("Room", false),
  };

  // role -> [presetVolume, default noise-gate threshold]  (the effective ROLE table)
  const ROLE = { cln: [30, 6], rhy: [30, 10], hvy: [30, 20], lds: [30, 8], ldr: [30, 13] };
  const ROLE_RANK = { cln: 0, lds: 1, rhy: 2, hvy: 3, ldr: 4 };
  const LEAD_ROLES = new Set(["lds", "ldr"]);
  const LEAD_AMP_TRIM = 2;
  const LEAD_GAIN_CAP = 76;
  const FUZZ_EFFECTS = new Set(["Grey Fuzz", "Red Fuzz"]);
  const FUZZ_GATE_FLOOR = 32;
  const FUZZ_GATE_FLOOR_RHY = 28;
  const FUZZ_CAP = 56;

  const gate = (t) => P("Gate", true, { THRE: t });
  const bcho = (dep = 35, r = 0.5, v = 55) => P("B-Chorus", true, { Depth: dep, Rate: r, Vol: v });

  function lead_gate(g) {
    if (g == null) return 12;
    if (g < 50) return 10;
    if (g < 62) return 13;
    if (g < 72) return 16;
    if (g < 78) return 19;
    return 22;
  }

  const KINDFILE = {
    C: "Clean", R: "Rit", D: "Drive", H: "Heavy",
    L: "Sol", L2: "Sol2", L3: "Sol3",
    La: "SolA", Lb: "SolB", Lc: "SolC",
    Ld: "SolDt", Lh: "SolCh",
  };

  function build_preset(cat, pname, role, desc, mods, overrides, artistName, slug) {
    if (pname.length > 10) throw new Error(`presetName too long (${pname.length}): ${pname}`);
    const [vol, gthre] = ROLE[role];
    const full = {};
    for (const mod of CHAIN) {
      let spec;
      if (mod in mods) spec = mods[mod];
      else if (mod === "NR") spec = gate(gthre);
      else spec = DEF[mod];
      full[mod] = build_module(cat, mod, spec);
    }
    // ---- lead level + gate compensation ----
    if (LEAD_ROLES.has(role)) {
      const amp = full["AMP"];
      const p = amp.parameters;
      if (amp.enabled && "Vol" in p) p["Vol"] = Math.max(0, p["Vol"] - LEAD_AMP_TRIM);
      const fx1 = full["FX1"];
      if (fx1.enabled && fx1.effect === "Boost" && "+3dB" in fx1.parameters) fx1.parameters["+3dB"] = 0;
      const gkey = "Gain" in p ? "Gain" : "Gain 1" in p ? "Gain 1" : null;
      const orig_gain = gkey ? p[gkey] : null;
      if (!("NR" in mods)) full["NR"].parameters["THRE"] = lead_gate(orig_gain);
      if (gkey && orig_gain != null && orig_gain > LEAD_GAIN_CAP) p[gkey] = LEAD_GAIN_CAP;
    }
    // ---- fuzz (rhythm OR solo) ----
    const drv = full["DRV"];
    if (drv.enabled && FUZZ_EFFECTS.has(drv.effect)) {
      const fp = drv.parameters;
      if ("Fuzz" in fp && fp["Fuzz"] > FUZZ_CAP) fp["Fuzz"] = FUZZ_CAP;
      if (!("NR" in mods)) {
        const nr = full["NR"].parameters;
        const floor = LEAD_ROLES.has(role) ? FUZZ_GATE_FLOOR : FUZZ_GATE_FLOOR_RHY;
        nr["THRE"] = Math.max(nr["THRE"], floor);
      }
    }
    const preset = {
      version: "1.0",
      presetName: pname,
      description: desc,
      ampMode: "Normal",
      presetVolume: vol,
      modules: full,
      signalChain: CHAIN,
      metadata: { createdDate: TODAY, author: "PocketEdit", tags: [] },
    };
    const ov = overrides[`${artistName}|${pname}`] || overrides[`${artistName}|${slug}`];
    if (ov) {
      preset.ampMode = "ampMode" in ov ? ov.ampMode : preset.ampMode;
      preset.presetVolume = "presetVolume" in ov ? ov.presetVolume : preset.presetVolume;
      preset.modules = clone(ov.modules);
    }
    return preset;
  }

  const DRIVEN_PREF = ["hvy", "rhy"];
  const LEAD_PREF = ["ldr", "lds"];
  const _title = (desc) => desc.split(":")[0].trim();

  function substitute_notes(songs) {
    const rep = (prefs) => {
      for (const pref of prefs)
        for (const s of songs)
          for (const v of s.variants)
            if (v.role === pref) return [_title(v.desc), s.slug];
      return null;
    };
    const sub_r = rep(DRIVEN_PREF), sub_l = rep(LEAD_PREF);
    const notes = {};
    songs.forEach((s, i) => {
      const roles = new Set(s.variants.map((v) => v.role));
      const parts = [];
      if (!(roles.has("rhy") || roles.has("hvy")) && sub_r && sub_r[1] !== s.slug)
        parts.push(`heavy rhythm -> ${sub_r[0]}`);
      if (!(roles.has("lds") || roles.has("ldr")) && sub_l && sub_l[1] !== s.slug)
        parts.push(`solo -> ${sub_l[0]}`);
      notes[i] = parts.length ? "  [Sub.: " + parts.join(" ; ") + "]" : "";
    });
    return notes;
  }

  function expand_tones(TONE_BC, DOUBLE_CHORUS, artist, slug, variants) {
    const key = `${artist}|${slug}`;
    if (DOUBLE_CHORUS.has(key)) {
      const out = [];
      for (const v of variants) {
        if (LEAD_ROLES.has(v.role) && ["L", "L2", "L3"].includes(v.kind)) {
          const { role, desc } = v;
          out.push({ ...v, kind: "Ld", tag: "dt", desc: desc + "  [detune]" });
          out.push({ kind: "Lh", tag: "ch", role, desc: desc + "  [chorus]", mods: { ...v.mods, FX2: bcho(30, 0.45, 55) } });
        } else out.push(v);
      }
      return out;
    }
    if (!TONE_BC.has(key)) return variants;
    const [bmods, cmods] = TONE_BC.get(key);
    const out = [];
    for (const v of variants) {
      if (LEAD_ROLES.has(v.role) && ["L", "L2", "L3"].includes(v.kind)) {
        const { role, desc } = v;
        out.push({ ...v, kind: "La", tag: "A", desc: desc + "  [A strident]" });
        out.push({ kind: "Lb", tag: "B", role, desc: desc + "  [B mid]", mods: bmods });
        out.push({ kind: "Lc", tag: "C", role, desc: desc + "  [C muted]", mods: cmods });
      } else out.push(v);
    }
    return out;
  }

  // Load artists + config into the ARTISTS structure. dataFiles: {name: parsedArtistJson}, config: parsed _config.json
  function loadData(config, dataFiles) {
    const ARTISTS = [];
    for (const name of config.order) {
      const art = dataFiles[name];
      const songs = art.songs.map((s) => {
        if (s.short.length > 8) throw new Error(`short too long (${s.short.length}): ${s.short}`);
        if (!s.variants.length) throw new Error(`song ${s.slug} has no presets`);
        return {
          slug: s.slug, short: s.short,
          variants: s.variants.map((v) => ({ kind: v.kind, role: v.role, desc: v.desc, mods: v.mods })),
        };
      });
      ARTISTS.push([art.name, songs]);
    }
    const TONE_BC = new Map();
    for (const e of config.tone_bc) TONE_BC.set(`${e.artist}|${e.slug}`, [e.b, e.c]);
    const DOUBLE_CHORUS = new Set();
    for (const [a, s] of config.double_chorus) DOUBLE_CHORUS.add(`${a}|${s}`);
    return { ARTISTS, TONE_BC, DOUBLE_CHORUS };
  }

  // Main builder. Returns { files: {relpath: object}, summary: [...] }.
  function buildSongs(mld, config, dataFiles, overrides = {}) {
    const cat = makeCatalog(mld);
    const { ARTISTS, TONE_BC, DOUBLE_CHORUS } = loadData(config, dataFiles);
    const files = {};
    const summary = [];
    let total = 0;
    for (const [name, songs] of ARTISTS) {
      const fsname = name.replace(/\//g, "-");
      const exp = songs.map((s) =>
        expand_tones(TONE_BC, DOUBLE_CHORUS, name, s.slug,
          [...s.variants].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])));
      const total_p = exp.reduce((n, v) => n + v.length, 0);
      if (total_p > 50) throw new Error(`${name}: ${total_p} presets > 50 slots`);
      let slot = 51 - total_p;
      const start = slot;
      const notes = substitute_notes(songs);
      const artist_batch = [];
      songs.forEach((s, i) => {
        const { slug, short } = s;
        const variants = exp[i];
        const song_presets = [];
        variants.forEach((v, j) => {
          const kind = v.kind;
          const tag = v.tag;
          const pname = tag ? `${short}${tag}` : `${short} ${kind}`;
          const preset = build_preset(cat, pname, v.role, v.desc + notes[i], v.mods, overrides, name, slug);
          const letter = "abcdefghij"[j];
          const fpath = `${fsname}/${String(i + 1).padStart(2, "0")}${letter}_${slug}_${KINDFILE[kind]}.json`;
          files[fpath] = preset;
          song_presets.push(preset);
          const bp = clone(preset);
          bp.slot = slot; bp.song = slug; bp.kind = kind;
          slot += 1;
          artist_batch.push(bp); total += 1;
        });
        files[`${fsname}/${String(i + 1).padStart(2, "0")}_${slug}_Presets.json`] = {
          type: "PocketMasterBatch", version: "1.0", exported: TODAY,
          artist: name, song: slug, count: song_presets.length, presets: song_presets,
        };
      });
      files[`${fsname}.json`] = {
        type: "PocketMasterBatch", version: "1.0", exported: TODAY, artist: name,
        count: artist_batch.length, slots: `${start}-50`, presets: artist_batch,
      };
      summary.push({ name, songs: songs.length, presets: artist_batch.length, start });
    }
    return { files, summary, total, artistCount: ARTISTS.length };
  }

  // ===================== gen_compilations.py port =====================
  const SOLOS = [
    ["Pink Floyd", "ComfortablyNumb", "L"], ["Pink Floyd", "WishYouWere", "L"], ["Led Zeppelin", "Stairway", "L"],
    ["Led Zeppelin", "Heartbreaker", "L"], ["Led Zeppelin", "AchillesLast", "L"], ["Queen", "BohemianRhap", "L"],
    ["Queen", "WhoWantsLive", "L"], ["AC/DC", "BackInBlack", "L"], ["Van Halen", "Eruption", "L"],
    ["Joe Satriani", "Surfing", "L"], ["Joe Satriani", "SatchBoogie", "L"], ["Joe Satriani", "TheExtremist", "L"],
    ["Steve Vai", "ForTheLoveGod", "L"], ["Steve Vai", "TenderSurrender", "L"], ["Eagles", "HotelCalifornia", "L"],
    ["Dire Straits", "SultansOfSwing", "L"], ["Dire Straits", "BrothersInArms", "L"], ["Jimi Hendrix", "VoodooChild", "L"],
    ["Thin Lizzy", "WhiskeyInJar", "L"], ["Jimi Hendrix", "LittleWing", "L"], ["Metallica", "MasterOfPuppets", "L"],
    ["Iron Maiden", "Hallowed", "L"], ["Scorpions", "SailsOfCharon", "L"], ["Pearl Jam", "Alive", "L"],
    ["Pearl Jam", "EvenFlow", "L"], ["Funkadelic", "MaggotBrain", "C"], ["Funkadelic", "MaggotBrain", "L"],
    ["Neil Young", "CortezKiller", "L"], ["The Black Crowes", "ThornInPride", "L"], ["Radiohead", "ParanoidAndroid", "L"],
    ["Muse", "KnightsCydonia", "L"], ["Mike Oldfield", "Muse", "L"], ["Heroes del Silencio", "EntreDosTierras", "L"],
    ["Soundgarden", "BlackHoleSun", "L"], ["Alice in Chains", "Rooster", "L"], ["Fleetwood Mac", "ImSoAfraid", "L"],
    ["Carlos Santana", "Europa", "L"], ["Guns N' Roses", "SweetChild", "L"], ["George Harrison", "MarwaBlues", "L"],
    ["Red Hot Chili Peppers", "Californication", "L"],
  ];
  const ROCK = [
    ["AC/DC", "BackInBlack", "R"], ["AC/DC", "BackInBlack", "L"], ["AC/DC", "HighwayToHell", "R"],
    ["AC/DC", "HighwayToHell", "L"], ["Led Zeppelin", "WholeLottaLove", "R"], ["Led Zeppelin", "WholeLottaLove", "L"],
    ["Led Zeppelin", "Kashmir", "R"], ["Led Zeppelin", "Stairway", "C"], ["Queen", "BohemianRhap", "H"],
    ["Queen", "IWantItAll", "R"], ["Queen", "IWantItAll", "L"], ["Van Halen", "RunninDevil", "R"],
    ["Van Halen", "AintTalkinLove", "R"], ["Van Halen", "Eruption", "L"], ["The Rolling Stones", "Satisfaction", "R"],
    ["The Rolling Stones", "BrownSugar", "R"], ["The Rolling Stones", "BrownSugar", "L"], ["The Rolling Stones", "GimmeShelter", "C"],
    ["Jimi Hendrix", "PurpleHaze", "R"], ["Jimi Hendrix", "PurpleHaze", "L"], ["Jimi Hendrix", "VoodooChild", "R"],
    ["Black Sabbath", "Paranoid", "H"], ["Black Sabbath", "IronMan", "R"], ["Scorpions", "Hurricane", "R"],
    ["Scorpions", "Hurricane", "L"], ["Neil Young", "CinnamonGirl", "R"], ["Neil Young", "RockinFreeWorld", "R"],
    ["Creedence Clearwater Revival", "FortunateSon", "R"], ["Creedence Clearwater Revival", "FortunateSon", "L"],
    ["Eagles", "HotelCalifornia", "C"], ["Eagles", "LifeInFastLane", "R"], ["The Doors", "RoadhouseBlues", "R"],
    ["The Doors", "BreakOnThrough", "R"], ["Faces", "StayWithMe", "R"], ["Faces", "StayWithMe", "L"],
    ["Bruce Springsteen", "BornToRun", "R"], ["Lenny Kravitz", "GoMyWay", "R"], ["Lenny Kravitz", "AmericanWoman", "R"],
    ["George Harrison", "WhatIsLife", "R"], ["Iron Maiden", "RunToTheHills", "R"],
  ];
  const ASSORTED = [
    ["Queen", "BohemianRhap", "L"], ["AC/DC", "BackInBlack", "R"], ["Led Zeppelin", "WholeLottaLove", "R"],
    ["Pink Floyd", "ComfortablyNumb", "L"], ["Dire Straits", "SultansOfSwing", "C"], ["Metallica", "MasterOfPuppets", "R"],
    ["Iron Maiden", "NumberOfBeast", "H"], ["Black Sabbath", "Paranoid", "H"], ["Nirvana", "SmellsTeenSpir", "L"],
    ["Pearl Jam", "Alive", "L"], ["Soundgarden", "BlackHoleSun", "C"], ["Alice in Chains", "Would", "R"],
    ["Red Hot Chili Peppers", "Californication", "C"], ["Radiohead", "Creep", "L"], ["Muse", "PlugInBaby", "R"],
    ["The Cure", "JustLikeHeaven", "C"], ["U2", "StreetsNoName", "C"], ["The Smashing Pumpkins", "CherubRock", "R"],
    ["Queens of the Stone Age", "NoOneKnows", "R"], ["Kyuss", "GreenMachine", "H"], ["Deafheaven", "Sunbather", "H"],
    ["Fear Factory", "Demanufacture", "H"], ["Sigur Ros", "Hoppipolla", "C"], ["The Alan Parsons Project", "EyeInTheSky", "C"],
    ["Mike Oldfield", "Muse", "L"], ["Neil Young", "CinnamonGirl", "R"], ["Jimi Hendrix", "LittleWing", "L"],
    ["George Harrison", "MarwaBlues", "L"], ["Robert Plant", "BigLog", "C"], ["Lenny Kravitz", "GoMyWay", "R"],
    ["Led Zeppelin", "Kashmir", "R"], ["Chris Isaak", "WickedGame", "C"], ["The Doors", "LightMyFire", "L"],
    ["Jeff Buckley", "Grace", "C"], ["Fleetwood Mac", "GoYourOwnWay", "R"], ["Cake", "TheDistance", "C"],
    ["Heroes del Silencio", "EntreDosTierras", "L"], ["Kino", "ZvezdaSolntse", "R"], ["The Rolling Stones", "GimmeShelter", "C"],
    ["Steve Vai", "ForTheLoveGod", "L"],
  ];
  const BEST50 = [
    ["Dire Straits", "SultansOfSwing", "C"], ["U2", "StreetsNoName", "C"], ["The Cure", "JustLikeHeaven", "C"],
    ["Eagles", "HotelCalifornia", "C"], ["Eagles", "HotelCalifornia", "L"], ["Metallica", "NothingElse", "C"],
    ["Led Zeppelin", "Stairway", "C"], ["Chris Isaak", "WickedGame", "C"], ["Red Hot Chili Peppers", "Californication", "C"],
    ["The Alan Parsons Project", "EyeInTheSky", "C"], ["Sigur Ros", "Hoppipolla", "C"], ["Pink Floyd", "WishYouWere", "C"],
    ["Van Halen", "DanceNightAway", "C"],
    ["AC/DC", "BackInBlack", "R"], ["The Rolling Stones", "Satisfaction", "R"], ["Led Zeppelin", "WholeLottaLove", "R"],
    ["Van Halen", "AintTalkinLove", "R"], ["Guns N' Roses", "ParadiseCity", "R"], ["Black Sabbath", "IronMan", "R"],
    ["Scorpions", "Blackout", "H"], ["Metallica", "MasterOfPuppets", "R"], ["Iron Maiden", "NumberOfBeast", "H"],
    ["Muse", "PlugInBaby", "R"], ["Kyuss", "GreenMachine", "H"],
    ["Dire Straits", "BrothersInArms", "L"], ["Pink Floyd", "ComfortablyNumb", "L"], ["Carlos Santana", "Europa", "L"],
    ["Jimi Hendrix", "LittleWing", "L"], ["George Harrison", "MarwaBlues", "L"], ["Joe Satriani", "AlwaysWithMe", "L"],
    ["Mike Oldfield", "Muse", "L"], ["Jeff Buckley", "Grace", "L"], ["The Doors", "LightMyFire", "L"],
    ["Neil Young", "CortezKiller", "L"], ["Alice in Chains", "Nutshell", "L"], ["Faces", "Debris", "L"],
    ["Funkadelic", "MaggotBrain", "C"], ["Funkadelic", "MaggotBrain", "L"],
    ["Van Halen", "Eruption", "L"], ["AC/DC", "BackInBlack", "L"], ["Queen", "BohemianRhap", "L"],
    ["Led Zeppelin", "Heartbreaker", "L"], ["Black Sabbath", "Paranoid", "L"], ["Scorpions", "SailsOfCharon", "L"],
    ["Iron Maiden", "Hallowed", "L"], ["Metallica", "MasterOfPuppets", "L"], ["Joe Satriani", "SatchBoogie", "L"],
    ["Steve Vai", "ForTheLoveGod", "L"], ["Guns N' Roses", "SweetChild", "L"], ["Jimi Hendrix", "VoodooChild", "L"],
  ];
  const _CR = [
    ["Led Zeppelin", "Stairway", "C"], ["Pink Floyd", "WishYouWere", "C"], ["Eagles", "HotelCalifornia", "C"],
    ["Dire Straits", "SultansOfSwing", "C"], ["Van Halen", "DanceNightAway", "C"], ["The Alan Parsons Project", "EyeInTheSky", "C"],
    ["The Cure", "JustLikeHeaven", "C"], ["U2", "StreetsNoName", "C"], ["Chris Isaak", "WickedGame", "C"],
    ["Metallica", "NothingElse", "C"], ["Red Hot Chili Peppers", "Californication", "C"], ["Sigur Ros", "Hoppipolla", "C"],
  ];
  const _CS = [
    ["Jimi Hendrix", "LittleWing", "L"], ["The Doors", "LightMyFire", "L"], ["Eagles", "HotelCalifornia", "L"],
    ["Faces", "Debris", "L"], ["Mike Oldfield", "Muse", "L"], ["Neil Young", "CortezKiller", "L"],
    ["Carlos Santana", "Europa", "L"], ["Pink Floyd", "ComfortablyNumb", "L"], ["Dire Straits", "BrothersInArms", "L"],
    ["Joe Satriani", "AlwaysWithMe", "L"], ["Jeff Buckley", "Grace", "L"], ["Alice in Chains", "Nutshell", "L"],
  ];
  const _HR = [
    ["The Rolling Stones", "Satisfaction", "R"], ["Led Zeppelin", "WholeLottaLove", "R"], ["Black Sabbath", "IronMan", "R"],
    ["Van Halen", "AintTalkinLove", "R"], ["AC/DC", "BackInBlack", "R"], ["Scorpions", "Blackout", "H"],
    ["Iron Maiden", "NumberOfBeast", "H"], ["Metallica", "MasterOfPuppets", "R"], ["Guns N' Roses", "ParadiseCity", "R"],
    ["Kyuss", "GreenMachine", "H"], ["Muse", "PlugInBaby", "R"], ["George Harrison", "MarwaBlues", "L"],
    ["Funkadelic", "MaggotBrain", "C"],
  ];
  const _FS = [
    ["Jimi Hendrix", "VoodooChild", "L"], ["Led Zeppelin", "Heartbreaker", "L"], ["Black Sabbath", "Paranoid", "L"],
    ["Queen", "BohemianRhap", "L"], ["AC/DC", "BackInBlack", "L"], ["Scorpions", "SailsOfCharon", "L"],
    ["Van Halen", "Eruption", "L"], ["Metallica", "MasterOfPuppets", "L"], ["Iron Maiden", "Hallowed", "L"],
    ["Guns N' Roses", "SweetChild", "L"], ["Joe Satriani", "SatchBoogie", "L"], ["Steve Vai", "ForTheLoveGod", "L"],
    ["Funkadelic", "MaggotBrain", "L"],
  ];

  // Build the (artist, song, kind) lookup from the in-memory artist bundles.
  function compLookup(files) {
    const LOOKUP = {};
    for (const [rel, d] of Object.entries(files)) {
      if (rel.includes("/")) continue;                 // top-level <Artist>.json only
      if (d.type !== "PocketMasterBatch" || !("artist" in d)) continue;
      for (const p of d.presets) LOOKUP[`${d.artist} ${p.song} ${p.kind}`] = p;
    }
    return LOOKUP;
  }
  function compPick(LOOKUP, ref) {
    const k = (a, s, ki) => `${a} ${s} ${ki}`;
    let p = LOOKUP[k(ref[0], ref[1], ref[2])];
    if (p == null && ref[2] === "L") {
      for (const alt of ["Lb", "Ld"]) { p = LOOKUP[k(ref[0], ref[1], alt)]; if (p != null) break; }
    }
    if (p == null) throw new Error(`preset not found: ${ref}`);
    const q = clone(p);
    delete q.slot;
    q.artist = ref[0];
    return q;
  }
  function compBuild(LOOKUP, collection, refs, n) {
    if (refs.length !== n) throw new Error(`${collection}: expected ${n}, got ${refs.length}`);
    const presets = refs.map((ref, i) => { const q = compPick(LOOKUP, ref); q.slot = i + 1; return q; });
    return {
      type: "PocketMasterBatch", version: "1.0", exported: COMP_TODAY,
      collection, count: presets.length, slots: `1-${presets.length}`, presets,
    };
  }
  function best50v2Refs() {
    const v = [];
    for (let i = 0; i < 12; i++) v.push(_CR[i], _CS[i], _HR[i], _FS[i]);
    v.push(_HR[12], _FS[12]);
    return v;
  }
  // The 5 collections as editable definitions. The Studio embeds/edits a copy of this;
  // the default (unedited) path reproduces Python byte-for-byte.
  function defaultCollectionDefs() {
    return [
      { file: "Compilation_Solos.json", collection: "Interesting Solos", n: 40, refs: SOLOS.map((r) => r.slice()) },
      { file: "Compilation_ClassicRock.json", collection: "Classic Rock", n: 40, refs: ROCK.map((r) => r.slice()) },
      { file: "Compilation_Assorted.json", collection: "A Bit of Everything", n: 40, refs: ASSORTED.map((r) => r.slice()) },
      { file: "Compilation_Best50.json", collection: "Best 50 (a bit of everything)", n: 50, refs: BEST50.map((r) => r.slice()) },
      { file: "Compilation_Best50_v2.json", collection: "Best 50 v2 (calm/loud cycle by era)", n: 50, refs: best50v2Refs().map((r) => r.slice()) },
    ];
  }
  // opts.collections: custom defs (same shape as defaultCollectionDefs()). opts.skipMissing:
  // drop refs whose preset no longer exists (after deletions) instead of throwing. Both default OFF.
  function buildCompilations(files, opts) {
    opts = opts || {};
    const LOOKUP = compLookup(files);
    const present = (ref) => { try { compPick(LOOKUP, ref); return true; } catch (e) { return false; } };
    const defs = opts.collections || defaultCollectionDefs();
    if (!opts.collections && !opts.skipMissing) {
      const srt = (a) => a.map((t) => t.join(" ")).sort();
      if (JSON.stringify(srt(best50v2Refs())) !== JSON.stringify(srt(BEST50)))
        throw new Error("BEST50_V2 must be a pure reordering of BEST50");
    }
    const out = {};
    for (const d of defs) {
      const refs = opts.skipMissing ? d.refs.filter(present) : d.refs;
      out[d.file] = compBuild(LOOKUP, d.collection, refs, opts.skipMissing ? refs.length : d.n);
    }
    return out;
  }

  // ===================== gen_nam_folder.py port =====================
  const AMP_TO_NAM = {
    "Voks 30TB": "AC30 May", "Voks 30N": "AC30 May",
    "Dark Twin": "TwinCln", "TWD Deluxe": "TwinCln", "Jazz 120": "TwinCln",
    "B-Man N": "TwinCln", "B-Man B": "TwinCln",
    "Brit 45": "Plexi", "Brit 50JP": "Plexi",
    "Brit 800": "JCM800", "A BassVT": "JCM800",
    "Sol 100 LD": "SoloSLO", "Sol 100 OD": "SoloSLO",
    "Calif DualM": "SoloSLO", "Calif DualV": "SoloSLO",
    "Halen 51": "SoloSLO", "Dizzy VH": "SoloSLO",
    "Eng 120": "SoloSLO", "Eng Power": "SoloSLO",
    "Bog XT": "SoloSLO", "Flyman B1+": "SoloSLO",
  };
  const NAM_FULLRIG = new Set(["AC30 May", "JCM800"]);
  // The distinct NAM captures every Clone/NAM preset is mapped onto (for the README headline).
  const NAM_CAPTURES = [...new Set(Object.values(AMP_TO_NAM))];

  // ===================== Mixed set =====================
  // For the "Mixed" variant we keep the modeled amp UNLESS the modeled amp is the same
  // as (or the same voice/lineage as) one of the 5 NAM captures, in which case we use the
  // clone. These are the modeled amps that map "directly / very-equivalently" to a capture
  // (→ Clone); every other amp is only a plausible stand-in (→ keep Modeled). Amps not in
  // AMP_TO_NAM are unknown → also kept Modeled.
  const MIXED_CLONE = new Set([
    "Voks 30TB", "Voks 30N",   // Vox AC30 (top boost / normal) → AC30 May
    "Dark Twin",               // Fender Twin → TwinCln
    "Brit 50JP",               // Marshall Plexi 50 → Plexi
    "Brit 800",                // Marshall JCM800 → JCM800
    "Sol 100 LD", "Sol 100 OD",// Soldano SLO (lead / od) → SoloSLO
  ]);
  const mixedUsesClone = (effect) => MIXED_CLONE.has(effect);

  // pred (optional): given the modeled amp's effect name, return true to convert to a clone,
  // false to keep the preset modeled as-is (used by the Mixed set). Omitted → always convert.
  function convert_preset(p, overrides, unknown, artist, song, pred) {
    if (pred) {
      const m0 = p.modules;
      if (m0 && m0.AMP && !pred(m0.AMP.effect)) return; // keep modeled
    }
    const art = p.artist || artist;
    const sng = p.song || song;
    const pn = p.presetName;
    const ov = overrides[`${art}|${pn}`] || overrides[`${art}|${sng}`];
    if (ov) {
      p.ampMode = "ampMode" in ov ? ov.ampMode : "Clone";
      p.presetVolume = "presetVolume" in ov ? ov.presetVolume : 100;
      p.modules = clone(ov.modules);
      return;
    }
    const m = p.modules;
    if (!m || !("AMP" in m)) return;
    const amp = m["AMP"]; delete m["AMP"];
    let nam = AMP_TO_NAM[amp.effect];
    if (nam == null) { unknown.add(amp.effect); nam = "JCM800"; }
    m["Clone"] = { enabled: true, effect: nam,
      parameters: { Gain: 50, Vol: 100, Bass: 50, Middle: 50, Treble: 50 } };
    p.ampMode = "Clone";
    p.presetVolume = 100;
    const ir = m["IR"];
    if (ir) {
      if (NAM_FULLRIG.has(nam)) ir.enabled = false;
      else { ir.enabled = true; (ir.parameters || (ir.parameters = {}))["Vol"] = 100; }
    }
    const eq = m["EQ"];
    if (eq && eq.enabled) eq.parameters["Vol"] = 100;
    else m["EQ"] = { enabled: true, effect: "GT EQ 1",
      parameters: { "125Hz": 0, "400Hz": 0, "800Hz": 0, "1.6kHz": 0, "4kHz": 0, Vol: 100 } };
  }

  function convert_file(data, overrides, unknown, ctxArtist, ctxSlug, pred) {
    if (Array.isArray(data.presets)) {
      const art = data.artist || ctxArtist;
      for (const p of data.presets) convert_preset(p, overrides, unknown, art, ctxSlug, pred);
    } else if ("modules" in data) {
      convert_preset(data, overrides, unknown, ctxArtist, ctxSlug, pred);
    }
    return data;
  }

  // files: the full json/ map (song files + compilation files). Returns a converted map.
  // pred (optional): per-preset "convert to clone?" predicate; omitted → convert everything (NAM).
  function convertFolder(files, overrides = {}, pred) {
    const out = {};
    const unknown = new Set();
    for (const [rel, obj] of Object.entries(files)) {
      const parts = rel.split("/");
      let ctxArtist = null, ctxSlug = null;
      if (parts.length > 1) {
        ctxArtist = parts[0];
        const bits = parts[parts.length - 1].replace(/\.json$/, "").split("_");
        if (bits.length > 1) ctxSlug = bits[1];
      }
      out[rel] = convert_file(clone(obj), overrides, unknown, ctxArtist, ctxSlug, pred);
    }
    return { files: out, unknown: [...unknown] };
  }
  // The full NAM set (every preset → clone).
  const buildNam = (files, overrides = {}) => convertFolder(files, overrides, null);
  // The Mixed set (clone only where the modeled amp matches a capture; else keep modeled).
  const buildMixed = (files, overrides = {}) => convertFolder(files, overrides, mixedUsesClone);

  // ===================== gen_editor_library.py port (the library object) =====================
  // Build [{artist, songs:[{song, presets:[{n:name, p:cleanPreset}]}]}] for a folder map.
  function libBuild(folderMap) {
    const out = [];
    const keys = Object.keys(folderMap).filter((k) => !k.includes("/") && k.endsWith(".json")).sort();
    for (const k of keys) {
      const b = k.slice(0, -5);
      if (b.startsWith("Compilation_") || b.startsWith("Compare_")) continue;
      const d = folderMap[k];
      if (!d || !d.artist || !Array.isArray(d.presets)) continue;
      const songs = {}, titles = {}, order = [];
      for (const p of d.presets) {
        const song = p.song != null ? p.song : "?";
        if (!(song in songs)) { songs[song] = []; order.push(song); titles[song] = (p.description || "").split(":")[0]; }
        const clean = {};
        for (const [kk, vv] of Object.entries(p)) if (kk !== "slot" && kk !== "song" && kk !== "kind") clean[kk] = vv;
        songs[song].push({ n: p.presetName, p: clean });
      }
      out.push({ artist: d.artist, songs: order.map((s) => ({ song: s, title: titles[s], presets: songs[s] })) });
    }
    return out;
  }
  // Build [{collection, items:[{a,n,s}]}] — an index of references (not copies).
  function libBuildCols(folderMap) {
    const out = [];
    const keys = Object.keys(folderMap).filter((k) => !k.includes("/") && /^Compilation_/.test(k)).sort();
    for (const k of keys) {
      const d = folderMap[k];
      const name = d.collection || k.replace(/\.json$/, "");
      const items = (d.presets || []).map((p) => ({ a: p.artist, n: p.presetName, s: p.song }));
      out.push({ collection: name, items });
    }
    return out;
  }
  function buildLibrary(jsonMap, namMap, mixedMap) {
    const lib = {
      modeled: libBuild(jsonMap), nam: libBuild(namMap),
      collections: { modeled: libBuildCols(jsonMap), nam: libBuildCols(namMap) },
    };
    if (mixedMap) { lib.mixed = libBuild(mixedMap); lib.collections.mixed = libBuildCols(mixedMap); }
    return lib;
  }

  // Resolver for collection refs against a built json map (same matching as compPick,
  // incl. the "L" -> Lb/Ld fallback). Build once, query many.
  function makeRefResolver(files) {
    const L = compLookup(files);
    return {
      exists: (ref) => { try { compPick(L, ref); return true; } catch (e) { return false; } },
      pick: (ref) => { try { return compPick(L, ref); } catch (e) { return null; } },
    };
  }

  return { buildSongs, buildCompilations, buildNam, buildMixed, buildLibrary, defaultCollectionDefs, makeRefResolver, makeCatalog, stringify, compactStringify, TODAY, CHAIN, NAM_CAPTURES };
});
