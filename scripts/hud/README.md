# `scripts/hud/` — the prototype gate

`D49` makes identity with the board a test, not a visual pass. This folder is that test.

- `diff.mjs` — boots the built preview, screenshots it at 1280×800 and 390×844 with `deviceScaleFactor: 2` through Chrome's own DevTools protocol (no Playwright dependency), and measures each shot against `design/screens/<slug>.png`: geometry as the position of the strongest edges within 2 px, colour as the mean ΔE on flat fills within 2. Artifacts land in `design/diff/<slug>/` (shot, pixelmatch diff, `report.json`).

`npm run hud:diff -- --slug 02-options` needs a build (`npm run build`) because it serves the preview;
`--url` points it at an already running server and `--dev` at `vite dev` instead. The harness never
edits the reference: a screen that cannot pass keeps its Phaser version and the flag stays on it.
