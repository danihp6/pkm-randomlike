# `scripts/design/` — the board, imported

The Figma board is the layout source (`D49`, amended by `D57`); this folder is how it lands in the
repo. Nothing here runs in the game: the output is `design/`, which the panels' fixtures and the
screen specs read.

- `importer.mjs` — the pure extractor: a Figma REST file payload plus `design/import.json` in, one screen spec per mapped desktop frame, the token table, the board index and the problems out; no fetch, no clock, no RNG, so the same two arguments always produce the same bytes. `buildFileFromFrames` assembles that same payload from the committed `design/source/*.json` dumps, so the projection runs offline too.
- `import.mjs` — the command, in two modes that share one projection: `FIGMA_TOKEN` and `FIGMA_FILE_KEY` in (REST, how a fresh board arrives), or `--from <sourceDir>` (the committed dumps under `design/source`, no variable and no request); the four artifact families under `design/` out; `--check` computes the same artifacts and compares them byte for byte instead of writing.
- `check.mjs` — the four headless checks on a committed `design/`: colours inside the tokens, every frame's scene and panel component, the snapshot hashes, and the variant report.
- `fixtures/` — what the tests read: the REST payload pieces (`file.json`, `nodes.json`, `images.json`, `map.json`, `exports/<slug>.png`) and, next to them, a `source/` + `exports/` pair, the two-dump snapshot proving the offline import describes the same board as `nodes.json`.

The old `export.mjs` / `frames.mjs` / `tokens.mjs` exporter retired with `[Task-223]`: the board now
arrives through `import.mjs` alone, and the dumps it once wrote live on as the offline input under
`design/source/`. `design/README.md` has the full procedure.
