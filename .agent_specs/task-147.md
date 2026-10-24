# Spec: Task-147 — The starter picker is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM/Preact UI panel (no engine change).
- **Role:** Dev.
- **Objective:** Under `?hud=dom`, `src/scenes/StarterScene.ts` draws no Phaser
  object and the starter pick — the title, the three cards with their names and
  types, the share line and the footer hint — becomes a Preact panel in
  `src/ui/hud/panels/starter/`, at frame `04`'s own boxes on 1280×800 and 390×844.
  The scene keeps the rule: it rolls the pool from the seed, holds the cursor,
  opens the seed prompt and starts the run. With the flag off nothing changes.
- **Environment:** worktree `../wt-pkm-147`, branch `task-147`, base `origin/main`
  `4cdd1da` (Batch 65). Install once with
  `npm ci --prefer-offline --no-audit --no-fund`.
- **Dependencies (already merged on `main`, read them, do not edit them):**
  - `Task-145` — `src/ui/hud/panels/main-menu/`: the full-screen panel pattern
    (`view.ts` live/fixture builders, `preview.ts` installed at module import,
    fixture test against `design/frames/`, `.css` with the board's rects).
  - `Task-124`/`Task-125`/`Task-127` — the shell, the kit (`Panel`, `Row`,
    `TypeBadge`, `PrimaryButton`, `Meta`) and the fixture store.
  - `Task-139` — the route HUD, for the `TypeBadge` use in DOM.

### Exclusive paths (single writer)

Nothing outside this list. Do **not** edit `src/i18n/**` (Task-148 holds the i18n
table in this batch), `src/engine/**`, `src/ui/hud/panels/README.md` (it already
lists `starter/`), `TODO.md`, `CHANGELOG.md` or `.agent_specs/`.

- `src/scenes/StarterScene.ts` (modify)
- `src/ui/hud/panels/starter/**` (new folder: the files below + README)
- `design/fixtures/04-starter-pick.json` (new)

### Inputs (read-only)

- `design/frames/04-starter-pick.json` and `design/frames/m04-starter-pick.json` —
  boxes and copy (the `text` tree carries the strings, `geometry` the boxes).
- `design/tokens.json`, `src/ui/hud/styles/root.css`, `src/ui/hud/kit/**`,
  `src/ui/hud/fixtures/**`, `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`,
  `docs/tech-decisions.md` `D49`.
- `src/ui/hud/panels/main-menu/**` (the reference migration), `src/ui/partyScreen.ts`
  (row shapes; the panel only needs names/types for starters),
  `src/data/dex/**` accessors (`getSpecies`), `src/engine/run/starters.ts` (`rollStarterPool`),
  `src/engine/run/share.ts` (`encodeRunShare`), `src/i18n/index.ts` (`t`).
- `src/scenes/StarterScene.ts` (the code you are changing) and `AGENTS.md`.

## 🔒 Contract

Exports of `src/ui/hud/panels/starter/` (the barrel re-exports all):

```ts
export const STARTER_SLUG: '04-starter-pick';
export const STARTER_SLUGS: readonly ['04-starter-pick', 'm04-starter-pick'];

export type StarterCardView = Readonly<{
  speciesId: string;
  num: number;
  name: string;
  types: readonly string[];
}>;
export type StarterView = Readonly<{
  title: string;
  cards: readonly StarterCardView[]; // exactly the pool's order
  selected: number;                  // clamped into cards
  share: string;                     // the frame's "SHARE: …" line, already localised
  hint: string;                      // the footer line, already localised
}>;

/** Live: the pool's species, the cursor, the share string and the footer copy. */
export function liveStarterView(
  pool: readonly string[],
  selected: number,
  seed: string,
  mode: RunMode,
  hint: string,
): StarterView;
/** The frame's own payload, or null when it is not one this panel can draw. */
export function fixtureStarterView(payload: unknown): StarterView | null;

/** Both boards' measured rects, for the fixture test and the diff. */
export function starterBoard(viewport: 'desktop' | 'narrow'): Readonly<{
  title: Readonly<{ x: number; y: number; w: number; h: number }>;
  card: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  name: Readonly<{ dx: number; dy: number; w: number; h: number }>;
  badge: Readonly<{ dx: number; dy: number; size: number; gap: number }>;
  share: Readonly<{ x: number; y: number; w: number; h: number }>;
  hint: Readonly<{ x: number; y: number; w: number; h: number }>;
}>;

export type StarterIntent =
  | Readonly<{ type: 'select'; index: number }>
  | Readonly<{ type: 'choose'; index: number }>
  | Readonly<{ type: 'seed-prompt' }>
  | Readonly<{ type: 'cancel' }>
  | Readonly<{ type: 'settings' }>;

export type StarterHandle = Readonly<{
  update(view: StarterView): void; // one render per changed view
  dispose(): void;
}>;
export function mountStarter(
  host: Element,
  view: StarterView,
  onIntent?: ((intent: StarterIntent) => void) | undefined,
): StarterHandle;

export function starterPreviewRequested(search: string): boolean;
export function installStarterPreview(search: string): (() => void) | null;
```

`mountStarter` writes `[data-hud-starter]`, `[data-hud-starter-title]`,
`[data-hud-starter-card="<speciesId>"]` (one per card, `data-selected="true"` on the
cursor's), `[data-hud-starter-share]` and `[data-hud-starter-hint]`. Cards are
buttons: hover/focus emits `select`, click/Enter emits `choose`. No i18n, no scene,
no run, no clock inside the panel: every string arrives already localised.

### Scene contract (`src/scenes/StarterScene.ts`)

1. Read the flag once at module scope (`DOM_HUD`, like `MainMenuScene`), and call
   `installStarterPreview(window.location.search)` at module scope so
   `?hud=dom&hudFixture=04-starter-pick` paints the frame without walking the game.
2. Under the flag `create()` must build **no Phaser display object** (no background
   rectangle, title, blurb, cards, portraits, cursor, share text, controls text) and
   mount the panel with `mountStarter`; the scene still rolls `rollStarterPool` from
   its seed, keeps `index`, subscribes the keybinds, keeps the fixed `S` seed prompt
   and disposes the panel on `SHUTDOWN`.
3. Intents: `select` sets `index` and repaints; `choose` sets `index` **and** calls
   the existing `confirm()` (a canvas card click does exactly this today — the same
   one-click pick); `seed-prompt` calls `promptForSeed()`; `cancel` returns to
   `MainMenu`; `settings` calls `openSettings()`.
4. `render()` under the flag calls `controller.update(liveStarterView(...))`; the
   `hint` it passes is the existing controls copy — `starter.controlsCompact` in the
   narrow layout, `starter.controls` otherwise, with `keyLabel` params as today. No
   new key: the frame's "HOLD R FOR NEW SEED" is fixture copy only, because the
   shipped action is the fixed `S` prompt.
5. Export `export function starterDrawnObjectCount(scene: Phaser.Scene): number`
   returning `scene.children.length` (0 under the flag), as `MainMenuScene` does.
6. Flag off: the canvas path must be unchanged (same layout, bob, keyboard, pointer
   and seed prompt).

## 🧩 Data and configuration

`design/fixtures/04-starter-pick.json`:

```json
{
  "slug": "04-starter-pick",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": {}, "notice": null },
  "starter": {
    "title": "CHOOSE YOUR STARTER",
    "cards": [
      { "speciesId": "bulbasaur", "num": 1, "name": "BULBASAUR", "types": ["grass", "poison"] },
      { "speciesId": "charmander", "num": 4, "name": "CHARMANDER", "types": ["fire"] },
      { "speciesId": "squirtle", "num": 7, "name": "SQUIRTLE", "types": ["water"] }
    ],
    "selected": 0,
    "share": "SHARE: PKRL-1-f-1a2b3c",
    "hint": "HOLD R FOR NEW SEED"
  }
}
```

`state` must pass `isHudState` (all six keys). `fixtureStarterView` rejects a
payload with a missing/typed-wrong field, a card whose `types` is not a string
array, or `selected` outside the cards, returning `null`; never throws.

Board measurements (desktop `04` / mobile `m04`), which the CSS and the tests pin:

- desktop: cards `218,176`, `510,176`, `802,176`, each `260×320` r11; title
  `240,26 800×40`; names `238,375` / `530,375` / `822,375`, `220×30`; type badges
  `24×24` at `318,422`, `354,422` (card 1), `628,422` (card 2), `920,422` (card 3);
  share `240,688 800×18`; hint `480,716 320×12`.
- mobile: cards `25,243`, `25,359`, `25,475`, each `340×104` r11; title `55,58`;
  names at `141,267` / `141,383` / `141,499`, `93–107×15`; type badges `24×24` at
  `141,307` / `141,423` / `141,539`; share `117,740`; hint `138,788`.

Cards use the kit `Panel` skin (the measured node is the wrapper, exactly as
`main-menu` does) and `TypeBadge` for the types. A card's portrait is a **placeholder
cell** in the card's portrait box (the board's sprite pixels belong to the canvas and
the panel reads no atlas), the rule `main-menu`'s README states.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-147` against the exclusive list; nothing else.
  - Live readings over CDP against `npm run dev -- --port <free> --strictPort` on
    `/usr/bin/chromium`; use `getBoundingClientRect()`/computed styles and
    `localStorage`/scene reads, not screenshots. Name the method in the report.
  - `npm run hud:diff -- 04-starter-pick` is evidence if it runs here; not a gate.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `npm test` green; new tests cover `liveStarterView` (three cards in
    pool order, names/types from the dex, clamped cursor, the share line, the hint)
    and `fixtureStarterView` (good payload + four rejection cases) and both boards'
    rects, headless.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; `src/i18n/**`,
    `src/engine/**` and the other panels are unchanged.
  - [ ] `[live]` With `?hud=dom&hudFixture=04-starter-pick` at 1280×800, the three
    `[data-hud-starter-card]` rects are `218,176 260×320`, `510,176 260×320` and
    `802,176 260×320` ±2; the title is `240,26 800×40` ±2; the names' tops are 375 ±2;
    the type badges are `24×24` at `x = 318/354/628/920, y = 422` ±2; the share line's
    top is 688 ±2 and the hint's 716 ±2; the three type badges carry the palette's fill
    for grass/poison/fire.
  - [ ] `[live]` The same URL at 390×844 puts the cards at `25,243`, `25,359`,
    `25,475` (`340×104`, ±2), the title at `55,58` ±2, the names at
    `141,267/383/499`, the badges at `141,307/423/539`, the share at `117,740` and
    the hint at `138,788`; `document.documentElement.scrollWidth === 390` (no
    horizontal overflow).
  - [ ] `[live]` With `?hud=dom` and no fixture, entering the starter screen paints
    **0** Phaser display objects (`starterDrawnObjectCount(game.scene.getScene('Starter')) === 0`)
    where the flag-off screen paints > 20; `[data-hud-starter]` is present.
  - [ ] `[live]` In that flag-on screen, clicking `[data-hud-starter-card]` number 2
    (Charmander's card) starts the route: `game.scene.isActive('Route')` is true and
    `game.scene.getScene('Route').debugParty()[0].speciesId` is that card's
    `speciesId`; pressing the cancel keybind from a fresh starter screen returns to
    the main menu; the fixed `S` key opens the seed prompt field.
  - [ ] `[live]` Arrow keys still move the DOM cursor: pressing the right keybind
    moves `data-selected="true"` from the first card to the second within one frame.

## 📣 Coordination

- For the next batch: the starter is the first **full screen** migrated after the
  main menu, so its `view.ts` is the close model for `run-over`; `StarterScene.ts`
  keeps every rule and only loses its drawing.
- For QA: the live footer hint is the shipped controls line (existing keys), not the
  frame's "HOLD R FOR NEW SEED"; the frame's copy is what the fixture draws, and
  there is no R action in the game.
- No i18n change: the batch's key-table holder is Task-148.

## ⛔ Out of scope

- New copy or keys, a new seed action, changes to `openSeedPrompt` or to the run's
  starter rule.
- Portrait atlases in DOM (placeholder cells), the portrait bob, the card scale
  maths of the canvas layout.
- Any change to `src/engine/**`, the save format or the dex.
