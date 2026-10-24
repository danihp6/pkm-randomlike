# Spec: Task-139 — The route HUD strip is the HUD's, and the pad's fate is decided here

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel (`D49`) + docs.
- **Role:** Dev.
- **Objective:** the route HUD stops painting its own strip in the canvas under
  `?hud=dom`, and the one piece of route chrome that a collapsed DOM card loses —
  the **edge chips** (the 26×26 letter badges `M` map, `C` pc, `P` party, `I` bag)
  — moves into `src/ui/hud/panels/hud/`, laid out by a pure module and rendered as
  Preact over the `#hud` layer at the board's own measured phone slots. The party
  header (shared level line, XP bar, Pokevial meter) is no longer built in Phaser
  while the flag is on, because `src/ui/hud/panels/party/` already paints it. The
  touch pad is decided in this task and written into `docs/tech-decisions.md` as an
  addendum to `D49`: it **stays in Phaser**, because it is an input surface whose
  pressed keybind action and whose geometry are already the board's.
- **Environment:** worktree `../wt-pkm-139`, branch `task-139`. Work only inside
  it. No merge, no push to `main`. The runner is Linux and headless: `npm test` is
  Vitest with no browser, and the asset store lives **outside** the checkout under
  `$ASSETS_ROOT` (never junctioned or symlinked into a worktree); a clean checkout
  builds off `src/assets/placeholders/`, so nothing here needs the rip.
- **Dependencies (all merged, read each one's file):**
  - **`[Task-127]`** — the spike and the gate: `src/ui/hud/panels/options/` is the
    shape a new panel folder follows, and `?hud=dom` works at 390×844.
  - **`[Task-128]`** — the panel layer: `src/scenes/panels/hud.ts` (the file this
    task edits) and `src/scenes/panels/{map,party}.ts` (the flag-gated pattern to
    copy, both already merged and read-only here).
  - **`[Task-124]`** — the shell: `#hud` from `src/main.ts`, `src/ui/hud/mount.ts`,
    `src/ui/hud/styles/root.css` (the tokens this strip uses).
  - **`[Task-125]`** — the kit: `src/ui/hud/kit/` (`Chip`, `chipClass`, `kit.css`).
  - Also **already shipped and read-only here**: `[Task-129]` `panels/bag/` (the
    money footer), `[Task-131]` `panels/party/` (the level line, XP bar, Pokevial
    meter and the party HP rows), `[Task-126]` `src/ui/hud/fixtures/` (fixture
    registry), `[Task-122]` `scripts/hud/diff.mjs` and `design/` (`frames/`,
    `screens/`).

### Exclusive paths (single writer)

Nothing outside this list. No other file may be created, edited, renamed or
deleted, and no other path is claimed from another task.

- `src/scenes/panels/hud.ts` — the whole file.
- `src/ui/hud/panels/hud/**` — the new folder: `view.ts`, `view.test.ts`,
  `strip.tsx`, `strip.css`, `mount.tsx`, `index.ts`, `fixture.test.ts`, `README.md`.
- `design/fixtures/03-route-hud.json` — new.
- `docs/tech-decisions.md` — **section claim:** the single new block
  `### D49 addendum — the touch pad stays in Phaser`, inserted after the last line
  of `D49` and before `## D50`. **No other decision, paragraph or heading in that
  file may change** (`D49`'s own body included).
- `src/scenes/panels/README.md` — **section claim:** only the `hud.ts` role line
  (currently `- \`hud.ts\` — the frame machinery: … the party header's shared level,
  XP and Pokevial bar.`). Task-138 edits the `pause.ts` line of the same file;
  touch nothing else in it.

### Inputs (read-only)

Beyond `AGENTS.md` itself, only these:

- `docs/tech-decisions.md` (`D49`, `D50`), `docs/hud-fidelity.md` §5,
  `docs/hud-dom-proposal.md` §6/§10, `docs/agent-spec-template.md`.
- `src/scenes/panels/hud.ts` (yours to edit), `types.ts`, `registry.ts`,
  `registry.test.ts`, `map.ts`, `party.ts`, `bag.ts`, `pc.ts`.
- `src/ui/hud/`: `mount.ts`, `shell.tsx`, `state.ts`, `commands.ts`,
  `styles/root.css`, `fixtures/index.ts`, `fixtures/registry.ts`,
  `kit/` (`index.ts`, `chip.tsx`, `classes.ts`, `kit.css`),
  `panels/README.md`, `panels/party/**`, `panels/bag/**`, `panels/map/**`,
  `panels/options/**`, `panels/battle-hp/**`.
- `src/data/hudLayout.ts`, `src/data/keybinds.ts`, `src/data/biomes.ts`.
- `src/i18n/en.ts` (read only — **no new key is added**), `src/i18n/index.ts`.
- `src/input/device.ts`, `src/ui/touchLayout.ts`, `src/ui/touchControls.ts`,
  `src/ui/frlg.ts`, `src/ui/frlgFont.ts`, `src/scenes/BootScene.ts` (the
  `PANEL_ICON_SIZE` constant only).
- `scripts/hud/diff.mjs`, `design/README.md`, `design/frames/03-route-hud.json`,
  `design/frames/m03-route-hud.json`, `design/tokens.json`,
  `design/screens/03-route-hud.png`, `design/screens/m03-route-hud.png`,
  `design/fixtures/03o-panels-map-routes.json`.

## 🔒 Contract

Frozen. Anything another task or QA writes against is here and spelled out.

### TypeScript — `src/ui/hud/panels/hud/view.ts`

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The four panels that carry a quick key (`PANEL_KEY_ACTIONS`), in rail order. */
export const STRIP_CHIP_ORDER = ['header', 'box', 'party', 'bag'] as const;
export type StripChipId = (typeof STRIP_CHIP_ORDER)[number];

/** The board's 26×26 badge (`docs/hud-fidelity.md` §5, `m03` chips). */
export const STRIP_CHIP_SIZE = 26;
/** At or above this width the hard-coded phone slots give way to the panels' own docks. */
export const STRIP_NARROW = 600;

/** One chip per panel: the letter is the panel's initial, never the bound key's. */
export const STRIP_CHIP_LETTERS: Readonly<Record<StripChipId, string>>;
// = { header: 'M', box: 'C', party: 'P', bag: 'I' }

/** The action whose key the chip's accessible label names (the `PANEL_KEY_ACTIONS` map). */
export const STRIP_CHIP_ACTIONS: Readonly<Record<StripChipId, KeybindAction>>;
// = { header: 'map', box: 'box', party: 'party', bag: 'bag' }

/**
 * The phone slots, top-left corner per chip, measured from `design/frames/m03-route-hud.json`:
 * `m chip MAP` (8,55), `m chip BOX` (8,119), `m chip BAG` (38,551). `party` has no collapsed
 * form on the board and takes the bag's column x at the first rail row: (38,55).
 */
export const STRIP_PHONE_SLOTS: Readonly<Record<StripChipId, Readonly<{ x: number; y: number }>>>;
// = { header: { x: 8, y: 55 }, box: { x: 8, y: 119 }, party: { x: 38, y: 55 }, bag: { x: 38, y: 551 } }

/** One panel record as the scene knows it: its dock after the saved drag offset. */
export type StripSlot = Readonly<{
  id: HudPanelId; // 'header' | 'party' | 'bag' | 'box' | 'detail'
  x: number;
  y: number;
  collapsed: boolean;
}>;

export type StripInput = Readonly<{
  /** False while the route is paused under a battle or the Settings screen. */
  open: boolean;
  slots: readonly StripSlot[];
  /** The live bindings, so the accessible label tracks a rebind. */
  keybinds: Keybinds;
}>;

export type StripChip = Readonly<{
  id: StripChipId;
  letter: string;
  /** `t('keybind.<action>') + ' (' + keyLabel(keybinds[action]) + ')'`, e.g. `PC box panel (O)`. */
  label: string;
  box: Rect;
}>;

export type StripView = Readonly<{
  open: boolean;
  viewport: Viewport;
  /** In `STRIP_CHIP_ORDER`, only panels that are collapsed; `[]` when `open` is false. */
  chips: readonly StripChip[];
}>;

export function stripView(input: StripInput, viewport: Viewport): StripView;
```

Rules the implementation must satisfy (each is a test):

1. **Only collapsed panels get a chip.** A panel absent from `slots` gets none. A
   panel that is open is drawn by its own card's chip (`panels/party/party.css`),
   never twice.
2. **`open: false` ⇒ `chips: []`.**
3. **Geometry.** `viewport.width < STRIP_NARROW` (390×844): the chip's `box` is
   `{ x, y, w: 26, h: 26 }` from `STRIP_PHONE_SLOTS`. Otherwise (1280×800) the box
   is `{ x: slot.x, y: slot.y, w: 26, h: 26 }` — the panel's own dock, i.e. exactly
   where the Phaser collapse icon was.
4. **Order** is `STRIP_CHIP_ORDER` filtered to the ids that pass (1).
5. **Pure:** no Phaser, no DOM, no `window`, no RNG. Same input ⇒ deep-equal output.
   Reads no engine state at all.

### TypeScript — `src/ui/hud/panels/hud/strip.tsx`

```ts
export type HudStripProps = Readonly<{
  view: StripView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

export function HudStrip(props: HudStripProps): JSX.Element;
```

DOM contract (QA reads these attributes verbatim):

- Root: `<div class="hud-strip" data-hud-strip hidden={!view.open}>`, `aria-hidden`
  not set; `pointer-events: none`.
- Chip: `<button type="button" class="hud-strip__chip" data-hud-strip-chip={chip.id}
  aria-label={chip.label} style={{ left, top, width, height }}><span
  class="hud-strip__letter" data-hud-strip-letter>{chip.letter}</span></button>`,
  absolutely positioned, `box-sizing: border-box`, `pointer-events: auto`, a 44 px
  `::after` hit overlay. Press ⇒ `onCommand?.({ type: 'panel', panel: chip.id })`.
- The letter span is centred by `display: grid; place-items: center` on the chip.
- Paint, all as CSS custom properties declared once on `.hud-strip`:
  `--strip-chip-fill: rgb(16 22 31 / 90%)`, `--strip-chip-border:
  rgb(255 255 255 / 22%)`, `--strip-chip-radius: 6px`; the letter uses
  `var(--hud-type-chip-size)` / `var(--hud-type-chip-line)` / `font-weight: 700`
  / `var(--hud-text-ink)` (11 px / 15 px / 700 / `#f8fafc`). The border is a real
  `1px solid` with `box-sizing: border-box` (the board's stroke is 1 px **inside**,
  `docs/hud-fidelity.md` §3). No shadow, no transition.
- `strip.tsx` imports `./strip.css`; the component composes no kit primitive it
  would have to re-style (the kit's `Chip` is the accent-edged in-card variant,
  `panels/party/party.css`; the edge chip is this panel's own class).

### TypeScript — `src/ui/hud/panels/hud/mount.tsx`

```ts
export function mountHudStrip(
  host: Element,
  view: Signal<StripView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void;
```

Renders into a `div.hud-strip-mount` appended to `host`, repaints on
`view.subscribe`, and the returned disposer unsubscribes, `render(null, …)` and
removes the container (the `mountPartyPanel` shape). `index.ts` is the barrel:
`HudStrip`, `HudStripProps`, `mountHudStrip`, `stripView`, `STRIP_CHIP_SIZE`,
`STRIP_NARROW`, `STRIP_CHIP_ORDER`, `STRIP_CHIP_LETTERS`, `STRIP_CHIP_ACTIONS`,
`STRIP_PHONE_SLOTS` and the types `StripChipId`, `StripSlot`, `StripInput`,
`StripChip`, `StripView`, `Rect`, `Viewport`.

### TypeScript — `src/scenes/panels/hud.ts` (the file you edit)

Keep everything that ships today for the flag-off path: the frame machinery
(`makeHudPanel`, the drag/collapse/persist rules, `applyHudBackground`,
`refreshPanelKeyLabels`, `toggleHudPanel`, `hudMetrics`, `hudColumnLeft`), the
party header (`buildPartyHeader`, `refreshHudPanel`) and `pointerAt`. Add, and only
add:

```ts
/** The route strip's own display objects in Phaser: 0 under `?hud=dom`. */
export function hudDrawnObjectCount(): number;
/** The canvas builder reports what it added; 0 under the flag. */
export function noteHudDrawnObjects(count: number): void;
/** The seven objects the party header adds (vial bg/fill/label, level, XP bg/fill/text). */
export const HUD_HEADER_OBJECTS = 7;

export const descriptor: RoutePanelDescriptor; // stays `{ id: 'hud', order: 30 }`
```

Behaviour:

1. `const DOM_HUD = typeof window === 'undefined' ? false :
   parseHudFlags(window.location.search).dom;` (the `map.ts` line, same import path
   `'../../ui/hud/fixtures'`).
2. `build(host)`: reset the three module flags as today. Then
   **`if (DOM_HUD) { mountStrip(host); noteHudDrawnObjects(0); return; }`** — under
   the flag it builds **no** Phaser object. Otherwise call `buildPartyHeader(host)`
   and `noteHudDrawnObjects(HUD_HEADER_OBJECTS)`.
3. `refresh(host)`: under the flag, repaint the strip signal and return; else
   `refreshHudPanel(host)` as today.
4. `pointer(host, pointer)`: under the flag `return false` — the DOM owns every
   press (`vialButtonAt` and the panel drag must not fire from an invisible canvas
   spot). Otherwise `pointerAt(host, pointer)`.
5. `close(host)`: dispose the mount (the mount's own listeners included).
6. `makeHudPanel` additionally does `if (DOM_HUD) icon.setVisible(false);` so the
   Phaser chips are provably unpainted from one place; keep building the `icon`
   (the `HudPanel` record's type is frozen in `types.ts` and every un-migrated path
   still needs it). `PANEL_ICON_KEYS` / `PANEL_KEY_ACTIONS` stay exported and
   unchanged.
7. The strip's view: `stripView({ open: !routePaused, slots, keybinds:
   host.settings().keybinds }, { width: host.scene.scale.width, height:
   host.scene.scale.height })`, where `slots` is `host.panels().map((panel) => ({
   id: panel.id, x: panel.x + panel.dx, y: panel.y + panel.dy, collapsed:
   !panel.expanded }))`. It is recomputed on every `refresh`, so a collapse, a drag,
   `applyStoredHudLayout` and a resize are all picked up without a new hook.
8. Mount into `document.getElementById('hud')`; a missing layer mounts nothing and
   must not throw. Listen to `'pause'`/`'resume'` (the `map.ts` `SCENE_PAUSE` /
   `SCENE_RESUME` pattern) so a battle or the Settings screen hides the chips and
   `RESUME` brings them back. A press while paused is ignored.
9. A chip's command is `{ type: 'panel', panel }`; the handler is
   `toggleHudPanel(host, command.panel)` and nothing else (`HudCommand` is frozen in
   `src/ui/hud/commands.ts`; do not add a variant).
10. `mountStrip` must survive being called with only the `map`/`party` records built
    (`hud` builds at order 30, `bag`/`pc` at 40/50): the mount paints whatever slots
    exist and the first `refreshHud()` after the build walk completes the rail.

### Data

- No `src/data/` entry, no `src/engine/` field, **no `SAVE_VERSION` change**, no new
  RNG stream, no i18n key (the strip's only strings are the existing
  `t('keybind.<action>')` and `keyLabel`).
- `design/fixtures/03-route-hud.json` — frozen shape (see §Data and configuration).
- DOM attributes: `data-hud-strip`, `data-hud-strip-chip` (values: the four panel ids)
  and `data-hud-strip-letter`. These are the only new public names on the document.

## 🧩 Data and configuration

`design/fixtures/03-route-hud.json`, exactly this shape (values below are the
frozen content; the `state` block is the frame's numbers and must pass
`isHudState`):

```json
{
  "slug": "03-route-hud",
  "state": {
    "party": [
      { "id": "f-charmander", "speciesId": "charmander", "name": "Charmander", "level": 12, "hp": 32, "maxHp": 39, "status": null, "statusLabel": null, "heldItem": "charcoal", "heldItemName": "Charcoal", "shiny": false, "hpFraction": 0.82 },
      { "id": "f-pidgey", "speciesId": "pidgey", "name": "Pidgey", "level": 11, "hp": 28, "maxHp": 33, "status": null, "statusLabel": null, "heldItem": null, "heldItemName": null, "shiny": false, "hpFraction": 0.85 },
      { "id": "f-bulbasaur", "speciesId": "bulbasaur", "name": "Bulbasaur", "level": 12, "hp": 30, "maxHp": 41, "status": "par", "statusLabel": "PAR", "heldItem": "miracle_seed", "heldItemName": "Miracle Seed", "shiny": false, "hpFraction": 0.73 },
      { "id": "f-gastly", "speciesId": "gastly", "name": "Gastly", "level": 11, "hp": 21, "maxHp": 30, "status": null, "statusLabel": null, "heldItem": null, "heldItemName": null, "shiny": false, "hpFraction": 0.7 }
    ],
    "bag": [],
    "money": 2480,
    "route": {
      "mode": "finite", "mapIndex": 1, "routeInMap": 2, "routeIndex": 2,
      "biomeId": "forest", "biomeName": "Deep Forest", "levelCap": 14,
      "squadLevel": 12, "xp": 1820, "xpFraction": 0.61,
      "pokevialCharges": 2, "pokevialMax": 3,
      "bossDefeated": false, "entryDeparted": true,
      "discoveredRooms": [0, 1, 2],
      "mission": null, "missionsCompleted": 0,
      "stats": { "catches": 3, "casualties": 1 }
    },
    "battle": null,
    "notice": null
  },
  "strip": {
    "frame": "design/frames/m03-route-hud.json",
    "nodes": { "header": "m chip MAP", "box": "m chip BOX", "bag": "m chip BAG" },
    "narrow": {
      "viewport": { "width": 390, "height": 844 },
      "chips": [
        { "id": "header", "letter": "M", "box": { "x": 8, "y": 55, "w": 26, "h": 26 } },
        { "id": "box", "letter": "C", "box": { "x": 8, "y": 119, "w": 26, "h": 26 } },
        { "id": "bag", "letter": "I", "box": { "x": 38, "y": 551, "w": 26, "h": 26 } }
      ]
    },
    "wide": { "viewport": { "width": 1280, "height": 800 }, "chips": [] },
    "paint": {
      "fill": "rgb(16 22 31 / 90%)",
      "border": "rgb(255 255 255 / 22%)",
      "radius": 6,
      "letterSize": 11,
      "letterLine": 15,
      "letterWeight": 700,
      "letterColour": "#f8fafc"
    }
  }
}
```

- The three `narrow.chips` boxes are the frame's own nodes, byte for byte:
  `m chip MAP` `8:3369` at (8,55,26,26), `m chip BOX` `8:3371` at (8,119,26,26),
  `m chip BAG` `8:3373` at (38,551,26,26). `fixture.test.ts` reads
  `design/frames/m03-route-hud.json` and asserts the equality, so the fixture can
  never drift from the board.
- `wide.chips: []` is the desktop frame's truth: at 1280×800 the board draws every
  badge **inside** an open panel, so the strip contributes none. (`party` is the
  only panel the default layout opens, so the live desktop rail shows the three
  collapsed panels' chips at their docks — the state, not the board's open-panel
  illustration.)
- The fixture's `state` is not consumed by the route scene (only `02-options` has a
  standalone preview); it exists so the diff's screen and the panel views read the
  frame's numbers and so `isHudState` guards the file. Do **not** add a preview
  module.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless, no browser; must be green including the new
    tests under `src/ui/hud/panels/hud/` and the existing
    `src/scenes/panels/registry.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-139` audit against the exclusive path list
    above.
  - The `[live]` pass uses `npm run dev`; the harness is
    `node scripts/hud/diff.mjs --slug 03-route-hud --dev` (it screenshots
    **1280×800 and 390×844** at `deviceScaleFactor: 2` and writes
    `design/diff/03-route-hud/report.json`; a missing Chrome is `CHROME_PATH`). It is
    named as the harness, and its `geometry.max` / `colour.flat` figures are recorded
    per viewport; the gate itself is the measurements below, because the reference
    raster carries the board's own route screenshot (`D50`) and the world is not part
    of this task.

- **Acceptance criteria:**

  - [ ] `[unit]` `npm run build` is clean (`tsc --noEmit` reports no error, `vite build` finishes).
  - [ ] `[unit]` `npm test` is green, and it runs the new tests in `src/ui/hud/panels/hud/` (`view.test.ts`, `fixture.test.ts` and the flag-contract test — `grep -rn "hudDrawnObjectCount" src/ui/hud/panels/hud/*.test.ts` finds it).
  - [ ] `[unit]` `view.test.ts` pins: `STRIP_CHIP_SIZE === 26`, `STRIP_NARROW === 600`, `STRIP_CHIP_ORDER` `['header','box','party','bag']`, `STRIP_CHIP_LETTERS` `{header:'M', box:'C', party:'P', bag:'I'}`, `STRIP_CHIP_ACTIONS` `{header:'map', box:'box', party:'party', bag:'bag'}` and `STRIP_PHONE_SLOTS` `{header:{8,55}, box:{8,119}, party:{38,55}, bag:{38,551}}`; the phone rail for the **default layout** (`header`/`box`/`bag` collapsed, `party` open) is exactly `[{id:'header',box:{x:8,y:55,w:26,h:26}}, {id:'box',box:{x:8,y:119,w:26,h:26}}, {id:'bag',box:{x:38,y:551,w:26,h:26}}]`; the wide rail places each chip at its slot's `x`/`y`; `open:false` ⇒ `chips: []`; all-open ⇒ `[]`; all-collapsed ⇒ 4 chips in rail order; the label is `t('keybind.box') + ' (O)'` for a default box binding and `' (P)'` after `keybinds.box = 'P'` while the letter stays `'C'`; and `stripView` is pure (the same input yields a deep-equal value, and neither `input.slots` nor `input.keybinds` is mutated).
  - [ ] `[unit]` `fixture.test.ts` asserts `fixture.slug === '03-route-hud'`, `isHudState(fixture.state) === true`, every `strip.narrow.chips[i].box` deep-equals the matching node's `{x, y, width, height}` read from `design/frames/m03-route-hud.json` (nodes named in `strip.nodes`), and that `stripView(default input, 390×844).chips.map(({ id, letter, box }) => ({ id, letter, box }))` deep-equals `strip.narrow.chips` — where the *default input* is `open: true`, `keybinds: DEFAULT_KEYBINDS` and the slots `header {x:8,y:8,collapsed:true}`, `party {x:38,y:8,collapsed:false}`, `bag {x:38,y:422,collapsed:true}`, `box {x:576,y:72,collapsed:true}`, `detail {x:8,y:8,collapsed:true}`.
  - [ ] `[unit]` The flag contract: with `window` unstubbed, `import('../../../../scenes/panels/hud')` then `noteHudDrawnObjects(9)` ⇒ `hudDrawnObjectCount() === 9`; with `vi.stubGlobal('window', { location: { search: '?hud=dom' } })` and `vi.resetModules()`, `noteHudDrawnObjects(9)` ⇒ `hudDrawnObjectCount() === 0`; `HUD_HEADER_OBJECTS === 7`. (`vi.mock('../../../../scenes/BootScene', () => ({ PANEL_ICON_SIZE: 24 }))` is required; copy the `rewards/view.test.ts` flag-contract block.)
  - [ ] `[unit]` `npm test` keeps `src/scenes/panels/registry.test.ts` green: it pins `hud` at `order` 30 with `id === 'hud'` and exactly one `export const descriptor` in the file.
  - [ ] `[unit]` `git diff main...task-139 -- src/scenes/panels/hud.ts` shows `buildPartyHeader(host)` reachable **only** after the `DOM_HUD` early return, and shows `icon.setVisible(false)` behind `DOM_HUD` inside `makeHudPanel`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-only main...task-139` lists only `src/scenes/panels/hud.ts`, `src/scenes/panels/README.md`, `docs/tech-decisions.md`, `design/fixtures/03-route-hud.json` and files under `src/ui/hud/panels/hud/`. In particular `git diff --name-only main...task-139 -- src/engine package.json src/main.ts vite.config.ts src/data src/i18n src/scenes/RouteScene.ts src/scenes/panels/party.ts src/scenes/panels/bag.ts src/scenes/BootScene.ts src/ui/hud/panels/README.md src/ui/hud/panels/party src/ui/hud/panels/bag src/ui/hud/panels/pc src/ui/hud/panels/map src/ui/hud/panels/options src/ui/hud/state.ts src/ui/hud/commands.ts src/ui/hud/mount.ts src/ui/hud/styles` is empty.
  - [ ] `[unit]` `docs/tech-decisions.md` gains exactly one block: `grep -c '^### D49 addendum' docs/tech-decisions.md` is `1`, the block contains the sentence **`The touch pad stays in Phaser`**, `git diff -U0 main...task-139 -- docs/tech-decisions.md` shows added lines only (no `-` line), and no `## D` heading changed (`git diff main...task-139 -- docs/tech-decisions.md | grep '^-' ` shows only the `---` header).
  - [ ] `[unit]` `src/scenes/panels/README.md` changed on exactly one line: `git diff --numstat main...task-139 -- src/scenes/panels/README.md` shows `1 1`, and the new line names `hud.ts` and the strip.
  - [ ] `[live]` **390×844 — the chips are the board's.** `npm run dev`, open `http://localhost:5173/?hud=dom&hudFixture=03-route-hud`, set the viewport to 390×844 (device pixel ratio 2), wait for the route, then run in the console
    ```js
    [...document.querySelectorAll('[data-hud-strip] [data-hud-strip-chip]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-hud-strip-chip'), x: r.x, y: r.y, w: r.width, h: r.height };
    })
    ```
    Expected, order included: `[{id:'header',x:8,y:55,w:26,h:26}, {id:'box',x:8,y:119,w:26,h:26}, {id:'bag',x:38,y:551,w:26,h:26}]` (`party` absent: its card is open). **Every x, y and w/h is within 2 px** of that list, which is `design/frames/m03-route-hud.json`'s `m chip MAP` / `m chip BOX` / `m chip BAG`.
  - [ ] `[live]` **390×844 — the chips' paint is the board's.** On the same page, for each chip: `const s = getComputedStyle(el); [s.backgroundColor, s.borderTopWidth, s.borderTopColor, s.borderRadius, s.pointerEvents]` must be `['rgba(16, 22, 31, 0.9)', '1px', 'rgba(255, 255, 255, 0.22)', '6px', 'auto']`, and for its `[data-hud-strip-letter]` span `[fontSize, lineHeight, fontWeight, color]` must be `['11px', '15px', '700', 'rgb(248, 250, 252)']`. This is the ΔE ≤ 2 colour gate **exactly** (the board's `#10161F` at 90 % and white 22 %, `m03`'s `m chip` nodes) rather than approximated from a raster whose world differs. The letter span's centre must sit within 2 px of the chip's centre (`|(letter.left+letter.width/2) − (chip.x+13)| ≤ 2` and the same on y).
  - [ ] `[live]` **1280×800 — the rail is at the docks, with nothing extra.** Same URL at 1280×800: the snippet above returns exactly the three ids `header`, `box`, `bag` in that order, each 26×26. `header` is at `(8, 8)` ± 2 px (`HUD_MAP_X`, `HUD_TOP`). `box` is at `(576, 72)` ± 2 px — the shipped PC-box dock `max(8, hudColumnLeft − panelW − 8)` with `hudColumnLeft = 1280 − 344 − 8 = 928` and `panelW = 344`, `y = HUD_TOP + 64`. `bag` is at `(928, partyCard.bottom + 8)` ± 2 px, with `document.querySelector('[data-hud-panel="party"]').getBoundingClientRect()` read live (the open party card sits at x 928, y 8, 250×406). `document.querySelectorAll('[data-hud-strip-chip="party"]').length === 0`.
  - [ ] `[live]` **No canvas strip behind the flag.** With `?hud=dom` on the route, `(await import('/src/scenes/panels/hud.ts')).hudDrawnObjectCount()` is `0`, and the party card's header is the only level/XP/Pokevial readout on screen (one `[data-hud-party="level"]`, one `[data-hud-party="xp"]`, one `[data-hud-party="vial"]`). Load the same route **without** `hud=dom` and the same probe returns `7` — the canvas paints the strip only with the flag off.
  - [ ] `[live]` **The money row is the bag's, exactly once.** After opening the bag (press `I`), `document.querySelectorAll('[data-hud-bag="footer"]').length === 1`, its rect lies inside `document.querySelector('[data-hud-panel="bag"]')`'s rect (each edge inside by ≥ 0 px), its value text matches `/^\d+$/` and equals the run's purse, and `document.querySelectorAll('[data-hud-strip] [data-hud-strip-money]').length === 0` — the strip draws no purse of its own. Collapse the bag again and no money text remains in the canvas either (`(await import('/src/scenes/panels/bag.ts')).bagDrawnObjectCount() === 0`).
  - [ ] `[live]` **A chip opens and closes its panel.** At 390×844: tap the `bag` chip ⇒ `[data-hud-panel="bag"]` is visible (not `hidden`) and the `bag` chip is gone from the strip; press the bag card's own accent chip ⇒ the card hides and the strip's `bag` chip is back at (38,551) ± 2 px. Same for `header` and `box`.
  - [ ] `[live]` **The pad did not move.** With touch emulation on (390×844, device toolbar / `pointer: coarse`) the pad and its A/B discs are drawn with and without `?hud=dom`, and the pad region of the two screenshots is pixel-identical (the strip never covers it: no `[data-hud-strip-chip]` rect intersects the pad's 156×156 box at (25,663)). A press on the pad's right arm walks the player one tile with the flag on.
  - [ ] `[live]` **The harness runs both viewports.** `node scripts/hud/diff.mjs --slug 03-route-hud --dev` completes and `design/diff/03-route-hud/report.json` names both `1280x800` and `390x844`; QA records each viewport's `geometry.max` and `colour.flat` in the task report (the numbers are evidence; the gates above are the chips' boxes and their exact paint).

## 📣 Coordination

- **The pad decision (final, and it is this task's alone):** `The touch pad stays in
  Phaser.` The addendum's reason, one paragraph: the pad is an **input surface, not
  chrome** — it draws three transparent outlines and two letters and every press is
  already the `KeybindAction` a key produces (`createTouchControls({ onAction })` in
  `src/ui/touchControls.ts` hands the pad's direction, `confirm` and `cancel` to the
  same handler the keyboard drives), so a DOM pad would re-implement pointer capture,
  the pad's owning pointer id, held-direction polling and the battle's camera offset
  for zero fidelity; and its geometry is already the board's to the pixel —
  `touchControlsLayout(390, 844)` yields the 156 px pad at (103,741) and A/B at
  r35 (334,767)/(235,788), exactly `docs/hud-fidelity.md` §5 — so there is nothing
  for the diff to improve. `src/ui/touchLayout.ts` stays the one model; if it ever
  moves it moves as its own task with that model and a pointer-events contract.
- **Why the strip is the chips:** a collapsed DOM card hides its whole root, its own
  accent chip included, so under `?hud=dom` a touch player loses every way back to a
  collapsed bag/box/map. The chip rail restores exactly that, at the board's own
  edge-chip slots, and it is the only route chrome with no DOM home. The party HP
  rows and the money row are **already** the HUD's (`panels/party/`, `panels/bag/`,
  Tasks 131/129) — this task must not redraw them, and QA checks they appear once.
- **Four chips, not five:** `S stats` has no quick key (`PANEL_KEY_ACTIONS` lists
  `header`, `party`, `bag`, `box` only) and no i18n key; a fifth chip would need
  `src/data/keybinds.ts` and `src/i18n/{en,es}.ts`, neither claimed by this task.
  Out of scope, and it must not be faked with a hard-coded string.
- **Letters are initials, keys live in the label:** the board draws `M`/`C`/`P`/`I`;
  the default `box` binding is `O`, so the letter stays `C` while the accessible
  label carries `keyLabel(settings.keybinds.box)` — a rebind is still discoverable
  and the board is still the board.
- **For the next batch — the Pokevial is read-only under the flag:** the DOM party
  card draws the meter as a `role="progressbar"` with no command, and the DOM layer
  swallows the canvas click that `vialButtonAt` used to catch, so a full vial cannot
  be drunk under `?hud=dom`. That is true **before** this task too (the card covers
  the spot), so nothing regresses here; a `{ type: 'vial' }` command or a pressable
  meter on the party card is a follow-up that needs `panels/party/**` and
  `commands.ts`, neither of which this task owns.
- **For the next batch — the canvas drag path is ungated:** under `?hud=dom` no
  descriptor stops the scene's `pressHudDrags` from finding a panel record at its
  dock, so a canvas press there can start an invisible drag and persist a layout.
  Not fixed here (`src/scenes/RouteScene.ts` is not claimed); a later task should
  gate the scene's HUD pointer path on the same flag.
- **For the Architect:** `src/ui/hud/panels/README.md`'s `hud/` line (Task-124, not
  editable here) promises "biome, level cap, money, the shared XP bar and the
  Pokevial meter"; three of those live in `panels/party/` (level/XP/vial) and
  `panels/bag/` (money footer) and `03-route-hud` carries no biome or level-cap node
  outside a panel, so this folder ships the edge chips. Amending that line is a
  docs-only follow-up for a batch that owns it.
- **For QA:** the fixture's `state` is validated and pinned but the route scene does
  not consume it (only `02-options` mounts a fixture preview); judge the strip by its
  own DOM nodes and the live run, never by the fixture's party names.

## ⛔ Out of scope

- Any engine, save, RNG, item, i18n or dex change; any `SAVE_VERSION` step.
- `src/scenes/RouteScene.ts`, `src/main.ts`, `package.json`, `vite.config.ts`, any
  other `src/scenes/panels/*.ts`, `src/ui/hud/panels/**` other than `hud/`,
  `src/ui/hud/{mount.ts,shell.tsx,state.ts,commands.ts,styles/root.css,kit/**}`,
  `src/ui/hud/panels/README.md`, `src/ui/touchControls.ts`, `src/ui/touchLayout.ts`.
- Moving the touch pad, or drawing a DOM pad, pad mirror or pad hit overlay.
- A biome/level-cap/purse line, a party HP strip, an `S` chip, a `vial` command, or
  any other new route chrome: three of those exist in panels and the board has no
  node for the rest.
- A standalone fixture preview module, a new `HudCommand`, a new i18n key, or a
  per-pixel whole-screen pass of `scripts/hud/diff.mjs`.
- Re-tuning any other screen, the panels' geometry, or the party card's own chip.

## Exit

`npm test` and `npm run build` green, the audit clean → commit the work on
`task-139`, push it, then `git commit --allow-empty -m "dev: done task-139"` and
push again. Do not merge, do not rebase `main`, do not touch another branch.
