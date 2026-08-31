# PocketMaster Studio — source & build

This folder rebuilds the self-contained app. Requires **Node.js ≥ 17** (no npm install — no
external dependencies).

## Rebuild the app

```bash
node src/build_studio.js
```

Reads `../data/` (the source of truth) + `src/assets/` (device catalog, factory presets, the
PocketEdit editor, the docs) + `src/README_STUDIO.md`, and writes **`../PocketMasterStudio.html`**.

## Regenerate the loose file tree (optional)

```bash
node src/export_tree.js
```

Writes `../json/` and `../json_nam/` (all preset JSONs + the HTML listings/tables/maps). These are
optional — the app doesn't need them; they exist so the repo shows the full structure and so single
presets can be imported into the standalone editor.

## Layout

```
src/
├── build_studio.js     assembles PocketMasterStudio.html
├── export_tree.js      writes ../json + ../json_nam to disk
├── pmbuild.js          core builder (roles, gates, caps, voicings, compilations, NAM, library)
├── pmhtml.js           index.html + README.md
├── pmtabla.js          presets_full.html + presets_print.html
├── pmmap.js            map_Best50.html + printable
├── pmmd.js             Markdown → HTML (docs)
├── pmedit.js           in-app editing engine (add/definitive/delete/collections)
├── pmzip.js            self-contained ZIP create/read
├── studio_app.js       the UI controller
├── README_STUDIO.md    embedded as the app's README
└── assets/
    ├── mld.json                                   device catalog
    ├── pocketmaster_batch_factory_presets_v1_3_3.json   50 factory presets (reference)
    ├── PocketEdit_multi_import_export.html        the editor embedded in the app
    ├── representative_songs.md
    ├── PROMPT_Generate_Artist_Presets.md
    └── PROMPT_Portable_Preset_Generator.md

../data/                the source of truth (one <Artist>.json per artist + _config.json)
```

To edit the app: change a module here and re-run `build_studio.js`. To add/edit an artist: edit
`../data/<Artist>.json` (or do it in the app and Save), then rebuild.
