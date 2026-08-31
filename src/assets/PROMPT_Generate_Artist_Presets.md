# Prompt — Generate PocketMaster presets for a new artist

Autonomous instructions to add one artist's presets to this project. The single
source of truth is the **`data/` folder** (one JSON per artist); `scripts/gen_songs.py`
is only the builder and everything under `json/` is generated from `data/`.

## Goal

Create **one `data/<Artist>.json`** file and add the artist to the `order` list in
**`data/_config.json`**, then regenerate. Each song gets **only the presets it truly
needs** (1, 2, 3 or more) — not a fixed count. Capture the genuinely distinct tones of
the artist with representative songs; avoid duplicating near-identical sounds
("moderate" selection).

## Data model

Read **`data/README.md`** for the full format. In short, `data/<Artist>.json` is:

```jsonc
{
  "name": "Artist Name",                 // real display name (may contain "/")
  "songs": [
    {
      "slug": "SongSlug",                // used in filenames
      "short": "short",                  // <= 8 chars, base of the preset name
      "variants": [
        { "kind": "R", "role": "rhy",
          "desc": "Song Title: tone description",   // text before ":" = exact song title
          "mods": { /* only the modules/params you set */ } }
      ]
    }
  ]
}
```

- **`kind`** (letter that ends the `presetName`): `C` clean rhythm · `R` driven/crunch
  rhythm · `D` 2nd distorted rhythm · `H` heavy rhythm · `L` lead (`L2`/`L3` extra leads).
- **`role`** sets level + noise-gate and the calm→loud order: `cln → lds → rhy → hvy → ldr`.
- **`presetName`** is built as `"<short> <kind>"` and must be **≤ 10 chars** (so `short` ≤ 8).

## Building `mods`

The signal chain is fixed: `NR → FX1 → DRV → AMP → IR → EQ → FX2 → DLY → RVB`. Each module
you set is `{ "effect": <name>, "enabled": true, "params": { … } }`.

- **List only the params you want to set**; the builder fills the rest from the device
  catalog and validates every name/range. **Omit a module** to get its default (no `NR`
  → gain-aware gate; no `FX1/FX2/EQ/DLY` → off; default AMP/IR otherwise).
- **Use only real effect + parameter names from `scripts/mld.json`.** That file lists every
  module, its effects, and each effect's parameters with `min`/`max`/`defaultValue`. An
  invalid name or out-of-range value **fails the build** instead of writing a bad preset.
- **Easiest path: copy a similar existing artist.** Open a `data/<Artist>.json` whose rig
  matches (e.g. a Marshall/JCM800 tone, a Fender clean, a fuzz riff), copy a variant's
  `mods`, and adjust gains/tone. The existing files are the best library of known-good values.

## Conventions

- Match the artist's real rig (amp, drive, key effects) and the song's signature trait
  (a wah solo needs a wah, a fuzz riff needs a fuzz, etc.).
- Add the artist's `name` to `order` in `data/_config.json` (controls build/print order).
- Slots are numbered automatically so the artist's last preset lands on slot 50.
- Missing roles get an automatic substitute note pointing at the artist's most
  representative driven-rhythm / lead preset.
- Advanced (optional, rarely needed): a hard-to-dial solo can ship as A/B/C tone voicings
  or a detune/chorus doubling pair — add it to `tone_bc` / `double_chorus` in
  `data/_config.json`. Per-song hand-tuned overrides live in `scripts/factory_overrides.json`
  (modeled amps) / `scripts/nam_overrides.json` (NAM clones).

## Regenerate

From the project root:

```bash
python scripts/gen_songs.py         # writes every JSON (individual, per-song, per-artist)
python scripts/gen_compilations.py  # cross-artist compilation packs
python scripts/gen_index.py         # json/index.html + json/README.md
python scripts/gen_tabla.py         # json/presets_full.html + presets_print.html
python scripts/gen_m50_map.py       # json/map_Best50.html + printable
python scripts/gen_nam_folder.py    # twin json_nam/ folder (NAM clones) + its HTML
```
