// export_tree.js — regenerate the full file structure to disk (independent of the single HTML):
//   ../json/ and ../json_nam/  (all presets + index.html, README.md, presets_full/print, map_Best50/print)
// Reads ../data + ./assets (mld, factory). Run: node src/export_tree.js
const fs = require("fs"), path = require("path");
const PMBuild = require("./pmbuild.js"), PMHtml = require("./pmhtml.js"), PMTabla = require("./pmtabla.js"), PMMap = require("./pmmap.js");
const PMChangelog = require("./pmchangelog.js");
const SRC = __dirname, ASSETS = path.join(SRC, "assets"), DATA = path.join(SRC, "..", "data"), ROOT = path.join(SRC, "..");
const rdj = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

const config = rdj(path.join(DATA, "_config.json"));
const mld = rdj(path.join(ASSETS, "mld.json"));
const factory = rdj(path.join(ASSETS, "pocketmaster_batch_factory_presets_v1_3_3.json"));
const data = {};
for (const n of config.order) data[n] = rdj(path.join(DATA, n.replace(/\//g, "-") + ".json"));

const readOv = (f) => { try { return rdj(path.join(ROOT, f)); } catch (e) { return {}; } };
const fov = readOv("factory_overrides.json"), nov = readOv("nam_overrides.json");
let collections = null; try { collections = rdj(path.join(ROOT, "collections.json")); } catch (e) {}

// A full tree regeneration also counts as a complete export: stamp timestamps and record the change
// batch (shared, idempotent — if build_studio.js already recorded these changes there is nothing new).
const sinceArg = ((process.argv.find((a) => a.startsWith("--since=")) || "").split("=")[1] || "").trim() || null;
const cl = PMChangelog.advanceOnDisk({
  root: ROOT, dataDir: DATA, data, fov, nov, collections,
  now: new Date().toISOString(), since: sinceArg, stringify: PMBuild.stringify,
});
console.log("changelog:", cl.changed ? (cl.baseline ? "baseline recorded" : "batch recorded") : "no changes since last export");

const { files } = PMBuild.buildSongs(mld, config, data, fov);
const comps = PMBuild.buildCompilations(files, collections ? { collections, skipMissing: true } : undefined);
const jsonMap = Object.assign({}, files, comps);
const { files: namMap } = PMBuild.buildNam(jsonMap, nov);
const { files: mixedMap } = PMBuild.buildMixed(jsonMap, nov);

function writeFolder(folder, map) {
  const dir = path.join(ROOT, folder);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [rel, obj] of Object.entries(map)) {
    const fp = path.join(dir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, PMBuild.stringify(obj), "utf-8");
  }
  const idx = PMHtml.buildIndex(map);
  fs.writeFileSync(path.join(dir, "index.html"), idx["index.html"], "utf-8");
  fs.writeFileSync(path.join(dir, "README.md"), idx["README.md"], "utf-8");
  const tab = PMTabla.buildTabla(map, factory);
  fs.writeFileSync(path.join(dir, "presets_full.html"), tab["presets_full.html"], "utf-8");
  fs.writeFileSync(path.join(dir, "presets_print.html"), tab["presets_print.html"], "utf-8");
  const mp = PMMap.buildM50(map);
  fs.writeFileSync(path.join(dir, "map_Best50.html"), mp["map_Best50.html"], "utf-8");
  fs.writeFileSync(path.join(dir, "map_Best50_print.html"), mp["map_Best50_print.html"], "utf-8");
  console.log("wrote", folder, "(" + (Object.keys(map).length + 6) + " files)");
}

writeFolder("json", jsonMap);
writeFolder("json_nam", namMap);
writeFolder("json_mixed", mixedMap);
console.log("Done.");
