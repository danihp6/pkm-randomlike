# HUD out of Phaser: DOM/React overlay — proposal

Status: **decided as `D49`** (2026-10-21) — see §13 for the part of this proposal that changed.
The document is kept as the reasoning trail; where it disagrees with `D49`, `D49` wins.

## 1. Problem

Every HUD panel in the game is drawn in Phaser (`src/scenes/*.ts` + `src/ui/*.ts`) with hard-coded
pixel geometry. Layout is derived from the viewport at runtime (`hudMetrics(w)`, `COMPACT_SIZE`,
`COMPACT_WIDTH`, `CELL_NARROW`, …) and every new form factor needs code changes plus a visual pass
on a Figma board to check the result.

The prototype board (`C:\Users\Dani\figma-handoff.md`, §11) now has 33 desktop views at 1280×800 and
33 mobile views at 390×844. The mobile column exists because adapting the canvas HUD to a phone is
expensive: paneles que desbordan, safe area, chips below the 44 px touch target, lists that need
scroll, emulated search fields.

Pain, in one line: **layout and typography are the expensive part, and Phaser is a canvas** — no
flex/grid, no text wrapping, no native scroll, no `env(safe-area-inset-*)`, and text blurs when the
stage is scaled.

## 2. Scope

In scope — only overlays that are _not_ the world:

- Main menu (`01`, `01b`), options (`02`), starter (`04`).
- Route panels: bag, PC, party, detail, map, shop, trade, rewards, notices, pause.
- Battle chrome: HP boxes, move menu, bag, switch screen, message box (added by `D49`; §13).
- Run-over (`06`, `07`, `07b`).
- Stats and ranking (`08`, `08b`, `08c`, `09`, `09b`).

Out of scope (stays in Phaser, **untouched**):

- World rendering, camera, movement, collisions, encounters — not one tile, sprite, palette or atlas
  moves.
- Battle _rendering_: the arena background, the combatants, the effects, the shake, the flash, the
  fade. Only the battle _chrome_ migrates.
- Floating damage numbers: anchored to a moving sprite and one beat long; see `D49`.
- The on-screen pad + A/B (`src/ui/touchControls.ts`): see §6 for the input decision.

## 3. Options

|                              | A. Stay in Phaser | B. DOM layer + React         | C. DOM layer + Preact/lit | D. Hybrid per screen |
| ---------------------------- | ----------------- | ---------------------------- | ------------------------- | -------------------- |
| Layout                       | manual pixels     | CSS grid/flex, media queries | same                      | same                 |
| Text                         | bitmap only       | any, wrapping, i18n          | same                      | same                 |
| Iteration speed              | slow              | high                         | high                      | high                 |
| Bundle                       | 0                 | ~45 KB gzip                  | ~3–5 KB gzip              | ~45 KB or 5 KB       |
| Fidelity to FRLG bitmap font | perfect           | needs work (§5)              | same                      | same                 |
| Input layering               | native            | needs care (§6)              | same                      | same                 |
| Risk if it goes wrong        | none              | two worlds to sync           | same                      | contained            |

Repository rule (`AGENTS.md`): _no new deps/addons unless a few lines cannot do it_. React is a
deliberate exception; Preact keeps the spirit. **Decided in `D49`: C — Preact + signals.** React is
rejected outright: nothing in these panels needs it.

## 4. Recommended architecture

```
┌──────────────────────────────┐      ┌───────────────────────────────┐
│ Phaser (canvas, full bleed)  │      │ DOM overlay (#hud)            │
│ world · camera · battle      │      │ React/Preact panels, CSS vars │
└──────────────┬───────────────┘      └───────────────┬───────────────┘
               │  HudState (serializable snapshot)     │
               └──────────────► HudBridge ◄────────────┘
                     HudCommand (openBag, selectMove, …)
```

- **`HudBridge`** — one module, no Phaser objects in `HudState`. Phaser emits `hud:state` on every
  change that the HUD renders; the HUD emits `HudCommand` back into the scene's action handler (the
  same path a key or a touch press takes today, so rebinding keeps working).
- **State is a snapshot, not a live object**: `{ party, bag, money, route, battle, notice }`, plain
  data, cloneable, cheap to diff. What the HUD cannot render without, it must not read directly.
- **CSS variables from the prototype**: `design/tokens.json` → `:root`. Panel fill/border/radius,
  accent, text scale, safe area, panel width 374 / gutter 8.
- **Layer order**: canvas (z=0) → HUD root (z=1) → pad/A-B (z=2, if it stays in DOM). HUD root is
  `pointer-events: none`; each panel re-enables `auto`, so the world stays clickable/tappable
  outside panels.
- **Responsive**: `@media (orientation: portrait)` + `env(safe-area-inset-*)` replace `hudMetrics`
  clamps. Desktop 1280×800 and phone 390×844 become two CSS layouts of the same components.

## 5. Fidelity risk: the bitmap font

The game text is an FRLG bitmap atlas at 16/32 px (`src/ui/frlgFont.ts`, `FRLG_FONT_SIZE = 32`,
only multiples of 16 are pixel-perfect). DOM text cannot reuse that for free.

Options, cheapest first:

1. **Silkscreen webfont** for HUD text. Clean and fast; the look changes (the prototype board is
   already Silkscreen, so the board matches).
2. **`<FrlgText>` component**: render each glyph as a span with `background-image` + `background-
position` from the atlas. Pixel-perfect and keeps the native font, but costs a component and
   careful line-breaking.
3. **Keep canvas text for the world/battle**, DOM for menus. Mixed, but the battle keeps its look.

Do not decide this by taste: the spike (§7) should render the same panel both ways and compare at
100 % on a 390×844 viewport.

**Decided (`D49`): option 1 — Silkscreen, self-hosted as `src/assets/fonts/silkscreen-{400,700}.woff2`
(OFL, no CDN), at the board's own sizes, unsnapped.** The board is Silkscreen, so "identical to the
board" and "same typeface" are the same requirement; the `<FrlgText>` route is rejected because it
would make the HUD match the game and not the board. The FRLG atlas keeps the world and the canvas
labels that survive; the typeface change is visible and accepted.

## 6. Input

- Pad + A/B: **stays in Phaser** for v1. It is the only overlay anchored to the camera HUD and it
  already forwards presses into the shared action handler. Moving it later is mechanical if the
  bridge exists.
- Panels: DOM, `pointer-events: auto`, tap targets ≥44 px, focus ring for keyboard.
- Keyboard: keep Phaser's key handling; when a DOM panel owns typing (bag search, nickname), the
  scene must ignore movement keys (the settings screen already has this problem today).

## 7. Migration plan

**Phase 0 — spike (one screen, behind `?hud=dom`).**
Pick `02 Options` (pure layout, no world, existing mobile prototype with sliders and a toggle).

Acceptance criteria for the spike:

- [ ] Renders at 390×844 and 1280×800 with no horizontal overflow.
- [ ] Matches the prototype board within 2 px on panel edges and rows (measured on the export).
- [ ] Adds ≤ 50 KB gzip to the bundle (React) or ≤ 10 KB (Preact).
- [ ] No input regression outside the panel (world still walks while it is closed).
- [ ] Deleting it leaves the Phaser version untouched (no dead code in scenes).

**Phase 1 — static menus**: main menu, starter, options, run over, stats/ranking.
**Phase 2 — route panels**: bag, pc, party, detail, map, shop, trade, rewards, notices, pause.
**Phase 3 — route HUD**: chips, party HP, badges. Decide on the pad here.
**Phase 4 — battle chrome**: HP boxes, move menu, bag, switch, message box, one task each. The arena,
the combatants and the effects never move (`D49`).

Each phase: one task per screen, spec = the frame JSON + SVG from `design/` (§8), verification =
prototype vs. screenshot at both sizes.

## 8. Prototype as the source of layout

The board must land in the repo in a machine-readable form before Phase 1:

```
design/
  tokens.json      colors, radii, type scale, spacing, safe area
  frames/*.json    node tree: name, type, x/y/w/h, fills, text
  screens/*.svg    1:1 vectors (diffable)
  screens/*.png    @2x, human review only
  README.md        frame → scene map + adaptation rules
```

`tokens.json` is the single source for CSS variables **and** for any Phaser-side constants that
survive (battle, pad), so both worlds stay in sync.

## 9. Risks

| Risk                                                   | Mitigation                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| HUD and canvas drift out of sync                       | single `HudState` snapshot per change; no ad-hoc reads          |
| Font mismatch                                          | spike compares Silkscreen vs `<FrlgText>` (§5)                  |
| Bundle creep                                           | Preact/lit if React is rejected; no component library           |
| Input dead zones (HUD eating taps)                     | `pointer-events` contract per layer, tested in the spike        |
| Two implementations of the same panel during migration | feature flag per screen, delete the Phaser one in the same task |
| Regression in tests                                    | engine tests stay headless; HUD gets DOM tests only             |

## 10. Open decisions

All four were closed by `D49`; they are kept here so the reasoning is not lost.

1. **React vs Preact/lit vs staying in Phaser** → Preact + signals. React rejected (weight, nothing
   needs it); Phaser rejected (it cannot be identical to the board: no wrapping, no native scroll, no
   safe-area insets, text blurred by the stage scale, and every value retyped by hand).
2. **Font strategy (§5)** → Silkscreen, self-hosted, board sizes.
3. **Whether the touch pad migrates in Phase 3** → still open; decided last, after the panels, and it
   is the only overlay whose migration is purely mechanical once the bridge exists.
4. **Whether the battle HUD is permanently exempt** → no. Battle _chrome_ migrates in the last phase;
   battle _rendering_ (arena, combatants, effects) never moves. Floating damage numbers stay in the
   canvas for now.

## 11. Export recipe for `design/` (do this before Phase 1)

Scope, per `D49`: **only the frames a migrated screen needs**, exported by the task that migrates it.
The board has 66 frames; dumping all of them now would leave `design/` stale before Phase 1 ends.

Source of truth: the live Figma file `pkm-randomlike` (page `Page 1`), reached through the
figma-edit MCP bridge (`http://localhost:3055`) and the **Figma Edit MCP** plugin. 66 top-level
frames: 33 desktop at 1280×800 (pitch 1790) and 33 mobile at 390×844 (`desktop x + 1320`).

Per frame, in `design/screens/`:

| File          | How                                                            | Notes                                                                                                                                            |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<slug>.svg`  | `node_export_visual({ nodeId, format: "SVG" })`                | 1:1, diffable, carries exact coordinates and fills — **but no text**: Figma outlines it, so the strings, family, size and box come from the JSON |
| `<slug>.png`  | `node_export_visual({ nodeId, format: "PNG", scale: 2 })`      | the diff's reference, never edited                                                                                                               |
| `<slug>.json` | `node_info({ nodeIds: [id], maxDepth: 3, properties: [...] })` | the machine-readable tree **and the only text source**                                                                                           |

Two things measured on `M 02 Options` (`8:3231`) that the export must not lose: the SVG's
`stroke-width="2"` on a panel is a centred stroke clipped by its own mask, so the CSS border is
**1 px inside**; and the board's text boxes are tight — 18 px in a 23 px box, 10 in 13, 9 in 12 — so
`line-height` is pinned in **px** per size, never a unitless ratio.

`slug` mirrors the frame name, lower-kebab: `03 Route HUD` → `03-route-hud` and the mobile one
`m03-route-hud`; `07b Run over · victory · pokemon` → `07b-run-over-victory-pokemon`.

`properties` for the JSON dump: `x`, `y`, `width`, `height`, `fills`, `strokes`, `cornerRadius`,
`characters`, `fontName`, `fontSize`, `effects`, `opacity`.

`design/tokens.json` is **generated** from the board (`scripts/design/tokens.mjs`), not hand-curated:
`scripts/ui/build-chrome.mjs` already owns the Phaser-side values, and two hand-kept copies of
`#10161f` are two copies that drift. One direction only: board → `tokens.json` → chrome + CSS vars.

The shape the generator must emit (values shown are today's board, not to be hand-edited):

```json
{
  "panel": { "fill": "#10161F", "alpha": 0.92, "border": "rgba(255,255,255,0.16)", "radius": 11 },
  "row": { "fill": "rgba(255,255,255,0.03)", "border": "rgba(255,255,255,0.08)", "radius": 8 },
  "accent": "#7DD3FC",
  "text": { "primary": "#F1F5F9", "secondary": "#CBD5E1", "muted": "#94A3B8", "faint": "#475569" },
  "type": { "meta": 9, "body": 10, "name": 12, "title": 18, "display": 20 },
  "panelWidth": 374,
  "gutter": 8,
  "safeArea": { "top": 47, "bottom": 810 },
  "grid": { "pitchX": 1790, "mobileOffset": 1320 }
}
```

`design/README.md` must hold the frame → scene map, one line per view:

```
m03-route-hud      → src/scenes/RouteScene.ts  (HUD: party + chips + pad)
m03d-route-shop-buy→ src/scenes/rooms/shop.ts  (BUY grid, 4×4)
…
```

and the adaptation rules already agreed: panel 374 at `x=8` centred vertically, chips as 26×26
letter badges, safe area 47/810, pad 156 at (103,741) with A (334,767) r35 and B (235,788) r35.

**Done and in the repo:** the whole board is imported (33 frames, 66 viewports: ≈3.7 MB of JSON,
3.9 MB of SVG, 10.1 MB of PNG) by `scripts/design/export.mjs`; `scripts/design/tokens.mjs` generates
`design/tokens.json` from it and `scripts/hud/diff.mjs` is the gate. The frame → scene map lives in
`design/README.md`, and `scripts/design/frames.mjs` is the one table the exporter reads.

Verification loop for every migrated screen (`D49`): `npm run hud:diff -- <slug>` screenshots the DOM
at 390×844 and 1280×800 with `deviceScaleFactor: 2` and runs `pixelmatch` against `<slug>.png`, with
`?hudFixture=<slug>` feeding the frame's own content. Geometry within 2 px on panel edges, row pitch,
radii and chips; mean ΔE ≤ 2 on flat fills; text measured on its box and colour. The Phaser screenshot
comparison is no longer the bar — it cannot be, since the panel no longer lives in Phaser.

## 12. References

- `docs/tech-decisions.md` `D49` — the decision this proposal became.
- `docs/hud-fidelity.md` — the board measured: type scale, palette, radii, panel geometry and the
  frame → node map every Phase 12 task takes its frames from.
- `C:\Users\Dani\figma-handoff.md` §11 — mobile layout spec: 390×844, pad 156 at (103,741),
  A (334,767) r35, B (235,788) r35, panel 374 at `x=8`, safe area 47/810.
- `src/scenes/RouteScene.ts` — `hudMetrics`, `HUD_PANEL_W`, `HUD_TOP`, panel clamps.
- `src/scenes/BattleScene.ts` — `COMPACT_SIZE`, compact stack.
- `src/ui/touchControls.ts`, `src/ui/touchLayout.ts` — pad geometry and hit rules.
- `src/ui/frlgFont.ts` — bitmap font constraints (multiples of 16 only).
- `src/ui/feed.ts`, `src/ui/beats.ts` — the frame/beat pacing the DOM bridge must keep.
- `scripts/ui/build-chrome.mjs` — the Phaser-side token owner that `design/tokens.json` feeds.

## 13. What changed when it was decided (`D49`)

Three things, and they are the only disagreements between this document and the decision:

1. **Battle chrome is in scope** (it was out). Battle _rendering_ stays untouched: arena, combatants,
   effects, shake, flash, fade. Floating damage numbers stay in the canvas because they are anchored
   to a moving sprite.
2. **Silkscreen replaces the `<FrlgText>` question** (§5). The board is Silkscreen, so "identical to
   the board" forces the typeface; the FRLG atlas keeps the world.
3. **The board is not the source of the code, the diff is.** `tokens.json` is generated, only the
   frames a screen needs are exported, and identity is a `pixelmatch` gate rather than a visual pass.
   A screen that cannot pass keeps its Phaser version.
