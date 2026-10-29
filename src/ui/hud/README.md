# `src/ui/hud/` — the DOM HUD

The HUD itself: the Preact layer `D49` puts over an otherwise untouched canvas. `src/main.ts`
calls `mountHud` once and **every** boot creates the full-viewport `#hud` root (z-index 1,
`pointer-events: none`) and renders the shell into it, so the world stays clickable; `?hud=dom`
is a no-op alias kept for old links. Nothing here imports Phaser or reads a scene: a scene
pushes a snapshot through `state.ts` and the panels answer with the intents of `commands.ts`,
the same path a key or pad press takes.

The styles are plain CSS on purpose: `styles/root.css` is the only place a colour, radius,
spacing or type size is written, and every value comes from `design/tokens.json`.

## Layout

- `state.ts` — the DOM HUD's one projection: the serialisable snapshot of the run and the battle (party, bag, money, route, battle, notice) and the single emit point a scene notifies.
- `state.test.ts` — the snapshot's shape, its derivation from the run and the battle, and the emit point, headless.
- `commands.ts` — the HUD's command channel: the intents a panel can send and the reducer that maps them onto the action a key or pad press already produces.
- `commands.test.ts` — every command variant, the reducer's mapping and its rejection of malformed input, headless.
- `mount.ts` — the always-true `hudRequested` predicate (the `?hud=dom` alias) and the one-shot mount of the `#hud` root (plus its idempotent `dispose` and the two font faces it preloads).
- `mount.test.ts` — the mount contract (a `#hud` root every boot, one handle, a working dispose), the vendored font files and the layer contract `root.css` pins, headless (the repo has no jsdom).
- `shell.tsx` — the shell component: one `.hud` layer with `data-hud="root"`, no props, no state and no Phaser object.
- `portrait.ts` — the one portrait seam: a species id to its `public/anil/portraits.png` cell and the inline `background-position`/`background-size` bag that draws it in a box, pure and headless.
- `portrait.test.ts` — the cell arithmetic from the atlas manifest, the shiny sheet, the null cases and the scaled style bag, headless.
- `styles/root.css` — the two Silkscreen `@font-face` blocks, the `:root` tokens taken from `design/tokens.json` (panel, row, accent, the six text tones, panel width 374, gutter 8) and the ten board type sizes with their px line heights.
- `panels/` — the board's twenty-one panel migrations, one folder per screen (see `panels/README.md`).
- `kit/` — the shared DOM primitives (panel, row, chip, bar, sheet, button, meta, type badge), their class helpers and the one kit stylesheet every panel composes.
- `fixtures/` — the `design/fixtures/<slug>.json` payloads `?hudFixture=<slug>` feeds the store.

## Rules

1. The shell owns no Phaser object and reads no scene; the canvas is untouched by anything here.
2. `mountHud` is the only place the flag is read and the root is created; a second call returns the same handle.
3. A module that computes ships a co-located `*.test.ts`; a component is covered by the spec check, `node scripts/design/check.mjs`, never by jsdom.
