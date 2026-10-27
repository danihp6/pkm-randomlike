# `scripts/hud/` — the prototype gate

`D49` makes identity with the board a test, not a visual pass. This folder is that test.

- `diff.mjs` — boots the app (the built preview, `vite dev` with `--dev`, or `--url`), screenshots it at
  1280×800 and 390×844 with `deviceScaleFactor: 2` through Chrome's own DevTools protocol (no Playwright
  dependency), and measures each shot against `design/screens/<slug>.png`: geometry as the position of the
  strongest edges within 2 px, colour as the mean ΔE on flat fills within 2. It finds the machine's own
  Chromium, polls the page's own readiness instead of trusting a load event, and names the screen each
  frame declares (`design/fixtures/<slug>.json`'s `screen`) so a frame it cannot frame is `unavailable`
  with the screen it needs rather than a false FAIL. Artifacts land in `design/diff/<slug>/` (shot,
  pixelmatch diff, `report.json`).
- `diff.test.mjs` — the gate's own rules, headless: the Chromium candidate order, the frame list against
  `design/fixtures/` (every desk frame has a fixture or a reasoned allow-list entry), the `screen` reader
  and the measured-screen classification, and that importing the module starts nothing.

`npm run hud:diff -- --slug 02-options` needs a build (`npm run build`) because it serves the preview;
`--url` points it at an already running server and `--dev` at `vite dev` instead. The harness never
edits the reference: a screen that cannot pass keeps its Phaser version and the flag stays on it.
