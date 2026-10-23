# `scripts/design/` — the board, imported

The Figma board is the layout source (`D49`); this folder is how it lands in the repo. Nothing here
runs in the game: the output is `design/`, which the fixtures and `scripts/hud/diff.mjs` read.

- `export.mjs` — walks the frame table and writes `design/frames/<slug>.json`, `design/screens/<slug>.svg` and `design/screens/<slug>.png` through the figma-edit MCP, resolving every node id from `page_info` instead of a hand-typed map; resumable, so an interrupted export costs nothing.
- `frames.mjs` — the frame table: the board's 33 frame names, the Phase 12 task that migrates each one, its panel and its scene.

The bridge is a single-session lock: `npx -y --package figma-edit-mcp figma-edit-mcp-socket` must be
running on port 3055, the plugin must be joined to the channel, and no other MCP session may hold it
while `export.mjs` runs. `design/README.md` has the full procedure.
