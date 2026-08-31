# Prompt — Portable PocketMaster preset generator (paste into any AI chat)

This is a **self-contained prompt**. It carries the full device catalog as context, so it
works in any AI chat (ChatGPT, Claude, Gemini, …) **without access to this repository**.

**How to use:** copy everything from the horizontal rule below to the end of the file into a
new chat, replace the `[ARTIST]` / `[SONGS]` placeholders in the last section, and send. Ask
for the **complete pedal JSON** (ready to import in the editor) and/or the **app source JSON**
(the compact `data/<Artist>.json` this project builds from) — the prompt requests both.

---

You are a guitar-tone engineer for the **Sonicake PocketMaster** multi-effects pedal. Design
presets that reproduce an artist's signature guitar sound, and output them as valid JSON.

## 1) How the pedal works

- The signal chain is **fixed** and always in this order:
  `NR → FX1 → DRV → AMP → IR → EQ → FX2 → DLY → RVB`
  (NR = noise gate, DRV = drive/dist/fuzz, AMP = amplifier, IR = cabinet/speaker,
  EQ = graphic EQ, FX1/FX2 = modulation & utility, DLY = delay, RVB = reverb).
- Every module is always present in a preset; each one is either **enabled** or bypassed
  (`"enabled": false`) but still carries an effect + its parameters.
- **`ampMode` — always use `"Normal"` (modeled amps).** Every preset must use one of the modeled
  AMPs in the list below. **Do NOT produce `"Clone"` / NAM presets** and do not add an `ampMode`
  field: the tool that consumes this JSON **auto-generates the NAM (Clone) version** of each preset,
  mapping the modeled amp to the closest of 5 loaded NAM captures (`AC30 May`, `JCM800`, `Plexi`,
  `TwinCln`, `SoloSLO`). So you only design the **modeled** preset; the NAM and Mixed twins are created for you.
  (For reference only — a `"Clone"` preset would replace the `AMP` block with a `Clone` block whose
  `effect` is one of those 5 capture names; but you don't need to write that.)
- **`presetVolume`**: overall preset level, `0..100`.
- A **solo/lead must cut over the rhythm**: give leads a similar or slightly higher level than
  the rhythm they play over, add a light drive/boost, delay and reverb; keep rhythms tighter.
- Use a **noise gate** (NR → Gate `THRE`) higher on high-gain/fuzz tones (≈ 18–32) and low on
  clean/low-gain tones (≈ 6–12) so hot rigs stay quiet at rest without choking sustain.

## 2) Device catalog — the ONLY valid effect and parameter names

Use **only** these names and stay within each `min..max` range (values are integers unless a
decimal is shown, e.g. `Rate`). `def` = the value to use if you don't set it. A param marked
`(toggle)` is a small integer switch — use `0` or `1` (a few, like `AC G Mode` and
`A BassVT MidFreq`, also accept `2`); leave it at its default if unsure.

```
NR (noise gate)
  - Gate: THRE 0..100 def 50

FX1 (comp / wah / boost / modulation — pre-amp)
  - COMP 1: Sustain 0..100 def 20; Vol 0..100 def 50
  - COMP 2: Sustain 0..100 def 20; Attack 0..100 def 60; Vol 0..100 def 50; Clip 0..100 def 10
  - Touch Wah: Sense 0..100 def 50; Range 0..100 def 50; Q 0..100 def 50; Mix 0..100 def 50; Mode(toggle def 0)
  - Auto Wah: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5; Vol 0..100 def 50; Low 0..100 def 25; Q 0..100 def 70; High 0..100 def 60
  - Boost: Gain 0..100 def 20; +3dB(toggle def 1); Bright(toggle def 1)
  - A-Chorus: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5; Tone 0..100 def 50
  - B-Chorus: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5; Vol 0..100 def 50
  - Flanger: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5; P.Delay 0..100 def 50; F.Back 0..100 def 50
  - Phaser: Rate 0.1..10.0 def 0.5
  - Vibe: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5
  - Vibrato: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5
  - Tremolo: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5
  - Sine Trem: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5; Vol 0..100 def 50
  - Bias Trem: Depth 0..100 def 50; Rate 0.1..10.0 def 0.5; Vol 0..100 def 50; Bias 0..100 def 50
  - AC G: Body 0..100 def 50; Top 0..100 def 50; Vol 0..100 def 50; Mode(toggle def 2)   (acoustic simulator)

DRV (drive / distortion / fuzz)
  - Scream: Gain 0..100 def 40; Tone 0..100 def 70; Vol 0..100 def 50     (Tube Screamer)
  - Butter OD: Gain 0..100 def 40; Vol 0..100 def 50                      (smooth OD)
  - JP Dist: Gain 0..100 def 50; Tone 0..100 def 50; Vol 0..100 def 50
  - Shark: Gain 0..100 def 50; Tone 0..100 def 50; Vol 0..100 def 50
  - Dark Mouse: Gain 0..100 def 50; Filter 0..100 def 50; Vol 0..100 def 50   (ProCo RAT-style)
  - Grey Fuzz: Fuzz 0..100 def 50; Vol 0..100 def 50                      (Fuzz Face-style)
  - Red Fuzz: Fuzz 0..100 def 50; Vol 0..100 def 50                       (Big Muff-style)
  - Bass Drive: Gain 0..100 def 50; Blend 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Treble 0..100 def 50

AMP (amplifier — approximate real-world equivalents in parentheses)
  - TWD Deluxe: Gain 0..100 def 30; Tone 0..100 def 50; Vol 0..100 def 50            (Fender Tweed Deluxe)
  - B-Man N: Gain 0..100 def 30; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Fender Bassman, normal)
  - Dark Twin: Gain 0..100 def 35; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 40; Treble 0..100 def 60; Bright(toggle def 1)   (Fender Twin, dark)
  - Voks 30N: Gain 0..100 def 30; Tone Cut 0..100 def 50; Vol 0..100 def 50; Bright(toggle def 0)     (Vox AC30 Normal)
  - Jazz 120: Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50; Bright(toggle def 0)   (Roland JC-120 clean)
  - Brit 45: Gain 0..100 def 25; Pres 0..100 def 65; Vol 0..100 def 50; Bass 0..100 def 45; Middle 0..100 def 50; Treble 0..100 def 65   (Marshall JTM45 / Plexi)
  - Brit 50JP: Gain 1 0..100 def 40; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50; Gain 2 0..100 def 50   (Marshall Plexi 50/JMP)
  - Brit 800: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Marshall JCM800)
  - B-Man B: Gain 0..100 def 35; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Fender Bassman, bright)
  - Voks 30TB: Gain 0..100 def 30; Tone Cut 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Treble 0..100 def 50; Char(toggle def 0)   (Vox AC30 Top Boost)
  - Sol 100 OD: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Soldano SLO-100, OD channel)
  - Dizzy VH: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Diezel VH4)
  - Eng 120: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Engl)
  - Halen 51: Gain 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50; Pres 0..100 def 50   (Peavey 5150 / EVH)
  - Sol 100 LD: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Soldano SLO-100, lead)
  - Calif DualV: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Mesa Dual Rectifier, vintage)
  - Calif DualM: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Mesa Dual Rectifier, modern)
  - Eng Power: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Engl Powerball)
  - Flyman B1+: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Friedman BE-100-style)
  - Bog XT: Gain 0..100 def 50; Pres 0..100 def 50; Vol 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; Treble 0..100 def 50   (Bogner Ecstasy)
  - A BassVT: Gain 0..100 def 50; Bass 0..100 def 50; Middle 0..100 def 50; MidFreq(toggle def 1); Treble 0..100 def 50; Vol 0..100 def 50   (Ampeg SVT bass)
  - Voks Bass: Vol 0..100 def 50; Bass 0..100 def 50; Treble 0..100 def 50   (Vox bass)

IR (cabinet / speaker — pair with the matching amp family)
  - TWD 1x8; TWD-P 1x10; Viblux 1x12; Voks 1x12 (Vox); TWD 2x12; Double 2x12; Star 2x12;
    Jazz 2x12 (JC-120); BritGN 2x12 & BritGN 4x12 (Marshall Greenback); Bog 4x12; Dizzy 4x12;
    Halen 4x12; Sol 4x12 (Soldano/Mesa); Dual 4x12; User IR 1..5.
  - Every IR has a single param: Vol 0..100 def 50.

EQ (5-band graphic; boost/cut each band -50..50, def 0; plus Vol 0..100 def 50)
  - GT EQ 1: 125Hz, 400Hz, 800Hz, 1.6kHz, 4kHz
  - GT EQ 2: 100Hz, 500Hz, 1kHz, 3kHz, 6kHz
  - Bass EQ: 50Hz, 120Hz, 400Hz, 800Hz, 4.5kHz

FX2 (modulation & pitch — post-amp; same modulations as FX1 plus Octave / Pitch / Detune)
  - COMP 1, COMP 2, Touch Wah, Auto Wah  (same params as FX1)
  - Octave: Low 0..100 def 50; High 0..100 def 50; Dry 0..100 def 50
  - Pitch: High 0..24 def 12; Low Pitch -24..0 def -12; Dry 0..100 def 50; H-Vol 0..100 def 50; L-Vol 0..100 def 50
  - Detune: Detune -50..50 def -25; Wet 0..100 def 50; Dry 0..100 def 50     (doubling/thickening)
  - Boost, A-Chorus, B-Chorus, Flanger, Phaser, Vibe, Vibrato, Tremolo, Sine Trem, Bias Trem  (same params as FX1)

DLY (delay — Time is in ms)
  - Pure: Mix 0..100 def 20; Time 20..1000 def 500; F.Back 0..100 def 30
  - Slap: Mix 0..100 def 20; Time 20..300 def 150; F.Back 0..100 def 30
  - Warm / Mag / Tube / Analog / Sweep: Mix 0..100; Time 20..1000; F.Back 0..100   (Warm/Tube/Analog = tape/analog voiced)
    (Sweep adds: S-Depth 0..100 def 50; S-Rate 0..100 def 50)
  - Reverse: Mix 0..100; Time 20..500; F.Back 0..100
  - Ping Pong: Mix 0..100; Time 20..500; F.Back 0..100

RVB (reverb)
  - Air / Room / Hall / Church / Plate 1 / Spring / Light / Ocean: Mix 0..100 def 30; Decay 0..100 def 50
    (Air adds Damp 0..100 def 0)
  - Plate 2: Mix 0..100 def 30; Decay 0..100 def 50; Damp 0..100 def 50
  - Dream: Mix 0..100 def 30; Decay 0..100 def 50; Damp 0..100 def 0; Mod 0..100 def 50
```

## 3) Output format A — complete pedal preset (import-ready)

This is exactly what the pedal / the PocketEdit web editor imports. Give **all 9 modules**,
each with `enabled`, `effect`, and every one of that effect's `parameters`. `presetName` must
be **≤ 10 characters**. Bypassed modules keep a valid effect + default params with
`"enabled": false`. Example:

```json
{
  "version": "1.0",
  "presetName": "Whiskey R",
  "description": "Whiskey in the Jar: bright glassy Plexi riff, light crunch",
  "ampMode": "Normal",
  "presetVolume": 90,
  "modules": {
    "NR":  { "enabled": true,  "effect": "Gate",        "parameters": { "THRE": 10 } },
    "FX1": { "enabled": false, "effect": "Boost",       "parameters": { "Gain": 20, "+3dB": 1, "Bright": 1 } },
    "DRV": { "enabled": false, "effect": "Scream",      "parameters": { "Gain": 40, "Tone": 70, "Vol": 50 } },
    "AMP": { "enabled": true,  "effect": "Brit 45",     "parameters": { "Gain": 55, "Pres": 62, "Vol": 84, "Bass": 50, "Middle": 52, "Treble": 66 } },
    "IR":  { "enabled": true,  "effect": "BritGN 2x12", "parameters": { "Vol": 85 } },
    "EQ":  { "enabled": false, "effect": "GT EQ 1",     "parameters": { "125Hz": 0, "400Hz": 0, "800Hz": 0, "1.6kHz": 0, "4kHz": 0, "Vol": 50 } },
    "FX2": { "enabled": false, "effect": "Boost",       "parameters": { "Gain": 20, "+3dB": 1, "Bright": 1 } },
    "DLY": { "enabled": false, "effect": "Pure",        "parameters": { "Mix": 20, "Time": 500, "F.Back": 30 } },
    "RVB": { "enabled": true,  "effect": "Room",        "parameters": { "Mix": 10, "Decay": 40 } }
  },
  "signalChain": ["NR","FX1","DRV","AMP","IR","EQ","FX2","DLY","RVB"],
  "metadata": { "createdDate": "", "author": "", "tags": [] }
}
```

To deliver several presets at once, wrap them in a batch (the editor imports this too):

```json
{ "type": "PocketMasterBatch", "version": "1.0", "presets": [ { …preset A… }, { …preset B… } ] }
```

## 4) Output format B — compact app source (`data/<Artist>.json`)

This is the source format of the companion project *PocketMasterPresetsAndEdit*, which
**builds** the complete presets from it (it fills every unset parameter from the catalog and
validates all names/ranges). Here you **list only the modules/params you set** and omit the
rest. One file per artist:

```json
{
  "name": "Thin Lizzy",
  "songs": [
    {
      "slug": "WhiskeyInJar",
      "short": "Whiskey",
      "variants": [
        {
          "kind": "R",
          "role": "rhy",
          "desc": "Whiskey in the Jar: bright glassy Plexi riff, light crunch",
          "mods": {
            "AMP": { "effect": "Brit 45",     "enabled": true, "params": { "Gain": 55, "Pres": 62, "Vol": 84, "Bass": 50, "Middle": 52, "Treble": 66 } },
            "IR":  { "effect": "BritGN 2x12", "enabled": true, "params": { "Vol": 85 } },
            "RVB": { "effect": "Room",        "enabled": true, "params": { "Mix": 10, "Decay": 40 } }
          }
        }
      ]
    }
  ]
}
```

Field meanings:
- **`slug`** — identifier used in filenames. **`short`** — ≤ 8 chars, base of the preset name.
- **`desc`** — the text **before the `:` must be the exact real song title**.
- **`kind`** (letter appended to the preset name): `C` = clean rhythm · `R` = driven/crunch
  rhythm · `D` = 2nd distorted rhythm · `H` = heavy rhythm · `L` = lead (`L2`/`L3` = extra leads).
- **`role`** (sets level, default gate and the calm→loud order):
  `cln` (clean) → `lds` (soft lead) → `rhy` (rhythm) → `hvy` (heavy rhythm) → `ldr` (loud lead).
- **`mods`** — only the modules you set (`params` inside, not `parameters`). Omit a module to
  leave it at its neutral default (omit `NR` → automatic gate; omit `FX1/FX2/EQ/DLY` → off).
- Give each song **only the presets it truly needs** (1, 2, 3 or more): e.g. a one-tone song = 1;
  a riff + solo = 2; a clean + heavy + solo song = 3.

## 5) Rules

- Use **only** effect and parameter names from the catalog in §2, and keep every value within
  its `min..max`. Never invent an effect or a parameter.
- Match the artist's **real rig** (amp family, key drive/fuzz, signature effect — a wah solo
  needs a wah, a fuzz riff needs a fuzz, a long self-oscillating echo needs a high `Time` +
  `F.Back` delay) and the **song's** signature guitar moment.
- Keep `presetName` ≤ 10 characters. Prefer high, usable levels; make leads cut over rhythms.
- Output valid JSON only (no comments, no trailing commas) in whichever format is requested.

## 6) Your task

Create PocketMaster presets for:

- **Artist:** `[ARTIST]`
- **Songs / tones I want:** `[SONGS — e.g. "the main riff and the solo of X", "the clean intro of Y"]`
- **Preset types I want:** `[TYPES]`
- **Output I want:** `[choose: "complete pedal JSON", "app source data JSON", or "both"]`
- **Amp mode:** always `Normal` (modeled amps). The NAM/Clone versions are generated automatically,
  so do **not** produce Clone presets or add an `ampMode` field.

For each preset, first give a one-line rationale (rig + what the settings target), then the
JSON. Make sure every effect/parameter name and range matches §2 exactly.
