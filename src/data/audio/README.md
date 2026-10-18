# `src/data/audio/` — the generated cue mappings

Two **generated, committed, never hand-edited** tables (the `src/data/dex/**`
rule), each written by `node scripts/frlg/render-frlg-audio.mjs` from the
decompilation, sorted ascending by key and reproducible byte for byte. They are
views over the cue vocabulary in `src/audio/cues.ts`: a row names a cue id, and
the cue id is what a scene plays.

| File              | What it holds                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `cries.json`      | species id → the cry cue of the sample the decompilation carries (`"pikachu": "cry-pikachu"`), 455 rows   |
| `moveSounds.json` | move id → the cue of the sound that move's own animation plays (`"tackle": "move-comet-punch"`), 295 rows |
| `index.ts`        | the typed accessors `cryCueFor` / `moveSoundCueFor` (null when there is no row) and the two row counts    |
| `index.test.ts`   | the tables measured against the dex and the cue vocabulary that ship                                      |

The cry table is keyed by **name**, not by `cry_tables.inc`'s row order: that
table is indexed by the game's internal species number, which is not our national
`num`. A row exists for every species with `num` 1..386; a species above it has
no sample and `cryCueFor` answers null, so the battle plays nothing for it. A
move with no row gets the shared `hit` cue.

Regenerate both with:

```sh
node scripts/frlg/render-frlg-audio.mjs --source <decomp> --out <rip dir> --renderer <poryaaaa>
node scripts/frlg/build-audio.mjs --rendered <rip dir>
```

The type import from `src/audio/cues.ts` is type-only, so the cue table and this
folder have no runtime cycle between them.
