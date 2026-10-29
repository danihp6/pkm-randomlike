# `scripts/design/` — the board, imported

The Figma board is the layout source (`D49`, amended by `D57`); this folder is how it lands in the
repo. Nothing here runs in the game: the output is `design/`, which the panels' fixtures and the
screen specs read.

- `importer.mjs` — the pure extractor: a Figma REST file payload plus `design/import.json` in, one screen spec per mapped desktop frame, the token table, the board index and the problems out; no fetch, no clock, no RNG, so the same two arguments always produce the same bytes.
- `import.mjs` — the command: `FIGMA_TOKEN` and `FIGMA_FILE_KEY` in, the four artifact families under `design/` out; `--check` fetches and computes the same artifacts and compares them byte for byte instead of writing.
- `check.mjs` — the four headless checks on a committed `design/`: colours inside the tokens, every frame's scene and panel component, the snapshot hashes, and the variant report.
- `export.mjs` — walks the frame table and writes `design/frames/<slug>.json`, `design/screens/<slug>.svg` and `design/screens/<slug>.png` through the figma-edit MCP, resolving every node id from `page_info` instead of a hand-typed map; resumable, so an interrupted export costs nothing.
- `frames.mjs` — the frame table: the board's 33 frame names, the Phase 12 task that migrates each one, its panel and its scene.
- `tokens.mjs` — derives `design/tokens.json` from the exported frames: panel and row fills, radii and border, the measured type scale with its boxes, panel width and gutter with the variants the board draws, grid pitch and the palette counts.

The bridge is a single-session lock: `npx -y --package figma-edit-mcp figma-edit-mcp-socket` must be
running on port 3055, the plugin must be joined to the channel, and no other MCP session may hold it
while `export.mjs` runs. `design/README.md` has the full procedure.
