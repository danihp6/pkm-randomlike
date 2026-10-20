# Spec: Task-116 — The casino window is the slot machine, and its three item reels spin

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + a new pure UI model + docs.
- **Role:** Dev.
- **Objective:** The casino room's window stops being a list ("title, money, two
  rows, one message line") and becomes the **machine itself**: a cabinet with
  **three reels** in the `src/ui/frlg.ts` style, every face a **drawn item**
  (`itemIconFrame`) or the **Team Rocket icon** (`overworldSpriteFrame('rocket')`)
  when the outcome is the grunt fight. `SPIN` and `LEAVE` stay the two actions, now
  **clickable**; the money readout stays. One new pure module,
  `src/ui/casinoReels.ts`, owns the geometry, the faces and the schedule, so the
  scene keeps no arithmetic and the reels are unit-tested headless. The booked
  outcome is revealed, never re-rolled: `casinoSpin` runs and `host.commitRun` is
  called **before the first frame**, so a reload mid-spin can neither re-roll nor
  refund.
- **Environment:** worktree `../wt-pkm-116`, branch `task-116`.
- **Dependencies:** merged already, read their shipped code and do not re-implement.
  - `[Task-115]` — `src/data/casino.ts` (`CASINO`, `CasinoPrize` with the grouped
    `'held'` kind, `EGG_ITEM_ID`) and `src/ui/casino.ts` (`casinoSpin`,
    `CasinoOutcome`, `casinoHeldPool`, `casinoGruntTrainerId`).
  - `[Task-111]`/`[Task-64]` — the room descriptor layer (`D47`):
    `src/scenes/rooms/types.ts` (`RoomDescriptor`, `RoomHost`, `RoomPanel`) and the
    shipped `src/scenes/rooms/casino.ts` this task rewrites.
  - Also shipped and read, never edited here: `src/data/itemIcons.ts`
    (`ITEM_ICON_TEXTURE_KEY`, `ITEM_ICON_SIZE`, `itemIconFrame`),
    `src/data/overworldSprites.ts` (`OVERWORLD_SPRITE_TEXTURE_KEY`,
    `OVERWORLD_SPRITE_WIDTH/HEIGHT`, `overworldSpriteFrame`),
    `src/ui/frlg.ts` (the chrome tokens and `addFrlgWindow`), `src/ui/frlgFont.ts`
    (`FRLG_INK`, `addFrlgText`), `src/data/keybinds.ts`, `src/settings.ts`,
    `src/i18n`.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in this batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/ui/casinoReels.ts` *(new)*
- `src/ui/casinoReels.test.ts` *(new)*
- `src/scenes/rooms/casino.ts`
- `src/scenes/rooms/casino.test.ts`
- `src/scenes/rooms/README.md`
- `src/ui/README.md`
- `docs/maps-spec.md` — **§7's `### The casino (the slot machine)` opening paragraph only**
- `docs/design-spec.md` — **§7's casino bullet only**

It claims **no** `src/scenes/RouteScene.ts`, **no** `src/engine/**`, **no**
`src/data/**`, **no** `src/i18n/**`, **no** `src/ui/casino.ts`, **no**
`src/main.ts`, **no** `package.json` and **no** `vite.config.ts`. Every string it
needs (`casino.*`, `notice.itemObtained`) already exists in `src/i18n/en.ts` and
`src/i18n/es.ts`.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/maps-spec.md` (§7), `docs/design-spec.md` (§7), `docs/tech-decisions.md`
  (`D33`, `D43`, `D47`), `docs/balance/economy.md` (`## The casino's spin`),
  `docs/agent-spec-template.md`, `docs/agent-ci.md` (the `[live]` protocol).
- `src/ui/casino.ts`, `src/ui/frlg.ts`, `src/ui/frlgFont.ts`, `src/data/casino.ts`,
  `src/data/itemIcons.ts`, `src/data/overworldSprites.ts`, `src/data/items.ts`,
  `src/data/keybinds.ts`, `src/data/ui/chrome.json`, `src/settings.ts`,
  `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/index.ts`.
- `src/scenes/rooms/types.ts`, `src/scenes/rooms/shop.ts` (the shipped window
  pattern), `src/scenes/rooms/registry.ts`, `src/scenes/BootScene.ts` (the texture
  keys it loads), `src/engine/**` for types only.
- Any `*.test.ts` you must mirror; do not edit one outside the list above.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript — `src/ui/casinoReels.ts` (new, pure: no Phaser, no DOM, no clock, no RNG)

```ts
import type { BandId } from '../data/run';
import type { CasinoOutcome } from './casino';

/** The card the machine draws in, and the band the three windows sit in. */
export const CASINO_CARD_W = 460;
export const CASINO_CARD_H = 300;
export const REEL_BAND_LEFT = 146;
export const REEL_BAND_TOP = 72;

/** The three windows: 48 px square, 12 px apart (3 × 48 + 2 × 12 = 168, centred in 460). */
export const REEL_COUNT = 3;
export const REEL_W = 48;
export const REEL_H = 48;
export const REEL_GAP = 12;

/** The reveal: an 800 ms spin, a 160 ms left-to-right stagger, a 100 ms face step. */
export const REEL_SPIN_MS = 800;
export const REEL_STOP_STAGGER_MS = 160;
export const REEL_TICK_MS = 100;

/** The passing faces each strip carries before the outcome face. */
export const REEL_DECOY_COUNT = 5;

export type ReelFace =
  | Readonly<{ kind: 'item'; itemId: string }>
  | Readonly<{ kind: 'rocket' }>;

export type ReelRect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The face a booked outcome lands on. */
export function reelFace(outcome: CasinoOutcome): ReelFace;
/** Every face the machine can pay at `band`, in table order, deduplicated. */
export function bandFaces(band: BandId): readonly ReelFace[];
/** The face a reel shows at rest, before any spin. */
export function reelRestFace(band: BandId, reel: number): ReelFace;
/** The three strips: each is `REEL_DECOY_COUNT` passing faces then the outcome face. */
export function reelStrips(band: BandId, outcome: CasinoOutcome): readonly (readonly ReelFace[])[];
/** When reel `reel` stops: 800, 960, 1 120 ms. */
export function reelStopAt(reel: number): number;
/** The strip index reel `reel` shows `elapsedMs` after the spin started. */
export function reelFaceIndex(reel: number, elapsedMs: number): number;
/** The three reel windows in screen px, for a card whose top-left is `(cardX, cardY)`. */
export function reelRects(cardX: number, cardY: number): readonly ReelRect[];
```

Rules, all of them mandatory:

- **`reelFace(outcome)`**: `{ kind: 'item', itemId }` for `kind: 'item'`;
  `{ kind: 'item', itemId: EGG_ITEM_ID }` for `kind: 'egg'`; `{ kind: 'rocket' }`
  for `kind: 'battle'`. The Rocket face is therefore **only** reachable from a
  fight.
- **`bandFaces(band)`**: walk `CASINO.prizes[band]` **in table order**; a
  `kind: 'item'` row contributes its `itemId` (skip an empty one), a `kind: 'egg'`
  row contributes `EGG_ITEM_ID`, a `kind: 'held'` row contributes **nothing** (it
  names no id). Then append `casinoHeldPool(band)` in its own order. Deduplicate,
  keeping the first occurrence, and map every id to
  `{ kind: 'item', itemId }`. The function therefore never invents a face the
  machine cannot pay and never returns the Rocket face. At `98bd905`,
  `bandFaces('early')` is
  `[potion, pokeball, oranberry, egg, charcoal, mysticwater, widelens, muscleband, wiseglasses, ironball, laggingtail]`.
- **`reelRestFace(band, reel)`**: `bandFaces(band)[reel % length]`, with `reel`
  clamped into `0..REEL_COUNT - 1`; a band whose faces are empty is not a shipped
  table (the test pins every band non-empty).
- **`reelStrips(band, outcome)`**: `strips.length === REEL_COUNT`; each strip is
  `[...Array.from({ length: REEL_DECOY_COUNT }, (_, k) =>
  faces[(reel * REEL_DECOY_COUNT + k) % faces.length]), reelFace(outcome)]`, so
  every strip is `REEL_DECOY_COUNT + 1` long, its last face is the outcome and its
  decoys are `bandFaces(band)`'s own faces.
- **`reelStopAt(reel)`**: `REEL_SPIN_MS + clampedReel * REEL_STOP_STAGGER_MS`, with
  `clampedReel = Math.max(0, Math.min(REEL_COUNT - 1, Math.floor(reel)))` —
  `800`, `960`, `1120`.
- **`reelFaceIndex(reel, elapsedMs)`**:
  `Math.min(L - 1, Math.floor(Math.max(0, elapsedMs) * (L - 1) / reelStopAt(reel)))`
  with `L = REEL_DECOY_COUNT + 1`; `0` at `elapsedMs <= 0`, `L - 1` (the outcome)
  at and after `reelStopAt(reel)`, monotonic in between. It reads no clock: the
  caller passes the elapsed milliseconds.
- **`reelRects(cardX, cardY)`**: `[{ x: cardX + 146 + reel * (48 + 12), y: cardY + 72, w: 48, h: 48 }]`
  for `reel` in `0..2` — `(556, 322)`, `(616, 322)`, `(676, 322)` for a card at
  `(410, 250)`, which is where a `460 × 300` card centres on the 1280 × 800 canvas.
- **Determinism.** The module reads **no RNG**, no clock and no run state: the
  outcome is handed in, the elapsed time is an argument, and the passing faces are
  a function of `band` alone. `casinoSpin`, its stream
  (`Rng(hashSeed(`${seed}:casino:${mapIndex}:${index}`))`), its three mark families
  and the extra grouped-row draw are untouched, so **no fixed-seed pin in
  `src/ui/casino.test.ts` or `src/data/casino.test.ts` moves**.

### The window — `src/scenes/rooms/casino.ts`

The descriptor's export stays exactly as today (`descriptor` with `kind`,
`marker`, `fixture`, `interact`, `drawFixture`, `drawMarker`), the cabinet texture
(`CASINO_MACHINE_TEXTURE_KEY`), the grunt beside it and the red-tint fallback stay,
and `gruntFor(host, machine)` keeps its exact shape
(`{ id: casinoGruntTrainerId(view.mapIndex), position, facing, sight:
DEFAULT_TRAINER_SIGHT, archetypeId: 'rocket' }`). What changes is the panel:

- **Geometry.** The card is `CASINO_CARD_W × CASINO_CARD_H` (460 × 300), centred at
  `((1280 - 460) / 2, (800 - 300) / 2) = (410, 250)`, one `addFrlgWindow`, drawn
  inside a container at depth `500` that `cameras.main.ignore` skips (as today).
  Title `t('casino.title')` at `(cardX + 24, cardY + 16)`; money readout
  `t('casino.money', { amount: host.run.money })` right-aligned at
  `(cardX + 436, cardY + 20)`; controls line at `(cardX + 436, cardY + 262)` with
  `t('casino.controls', { confirm, cancel })` from `keyLabel(loadSettings().keybinds…)`;
  message line at `(cardX + 24, cardY + 232)`.
- **The cabinet.** Behind the three reels, one recessed field from
  `(cardX + REEL_BAND_LEFT - 8, cardY + REEL_BAND_TOP - 8)` of size
  `(168 + 16) × (48 + 16)`, filled with `FRLG_TRACK` and stroked 1 px with
  `FRLG_ROW_STROKE`. Each reel window is a `rectangle` at its `reelRects` entry with
  `FRLG_ROW_FILL` and a 1 px `FRLG_ROW_STROKE` border. Only chrome tones from
  `src/ui/frlg.ts` — no literal colour in the scene (`src/ui/README.md` rule 3).
- **The faces.** One `image` per reel, `setOrigin(0, 0)` at its rect, carrying an
  **item face** as `ITEM_ICON_TEXTURE_KEY` + `itemIconFrame(itemId)` at
  `setScale(REEL_W / ITEM_ICON_SIZE)` (= 2, exactly filling the window), or a
  **Rocket face** as `OVERWORLD_SPRITE_TEXTURE_KEY` + the `rocket` frame,
  `overworldSpriteFrame('rocket')` when it is not `null` — else the shipped
  `TRAINER_TEXTURE_KEY` with the existing red tint — at
  `setScale(REEL_H / OVERWORLD_SPRITE_HEIGHT)` (= 1.5). Every reel image is clipped
  to its own rect by a **geometry mask** (`scene.make.graphics()` →
  `fillRect(rect)` → `createGeometryMask()`), so a face never paints outside its
  window.
- **At rest** (no spin yet) the three reels show `reelRestFace(band, reel)`.
- **One spin**, in this exact order:
  1. `const spin = casinoSpin(host.run)`; a refusal — or an `ok` spin that carries
     no `outcome`, which the model never produces — sets the message
     (`casino.locked` / `casino.noMoney`), repaints and returns: no timer, no
     `commitRun`.
  2. `host.commitRun(spin.run)` — **the outcome is booked before the first frame**.
  3. `casinoMessage = ''`, the money readout repaints, the two rows repaint
     **disabled** (`FRLG_MUTED`), the strips are `reelStrips(bandForMap(host.run.mapIndex).id, spin.outcome)`
     and `casinoIndex` stays on `SPIN`.
  4. Three `scene.time.delayedCall(reelStopAt(reel), …)` and **one** looping
     `scene.time.addEvent({ delay: REEL_TICK_MS, loop: true, … })` that, on each
     tick, sets each unstoppered reel to
     `strip[reelFaceIndex(reel, scene.time.now - startedAt)]` (keeping the last
     index per reel so a face is only re-set when it changes).
  5. A reel's `delayedCall` freezes it on the strip's **last** face; the last
     reel's `delayedCall` (1 120 ms) ends the reveal.
- **Ending the reveal.** An `item`/`egg` outcome sets
  `casinoMessage = t('notice.itemObtained', { name: getItem(itemId)?.name ?? itemId })`
  (`itemId` = the outcome's own, or `EGG_ITEM_ID`), re-enables the rows and
  repaints; a `battle` outcome sets `casinoMessage = t('casino.locked')`, calls
  `host.closePanel()` **then** `host.startTrainerBattle(gruntFor(host, machine))`,
  so the fight, its id and its lock do not move.
- **Input.** `handle(action)` keeps the shipped keys (`up`/`down` move,
  `confirm`/`interact` take the row, `cancel` closes) **except** while spinning:
  then `up`, `down`, `cancel` and the `LEAVE` row are ignored and
  `confirm`/`interact`/any pointer press on the card **skips** — it freezes every
  reel on its outcome face and ends the reveal at once. `SPIN` cannot be pressed
  twice: the second press is a skip, never a second `casinoSpin`. The two rows are
  **clickable** (`scene.add.zone(...).setInteractive({ useHandCursor: true })`,
  the `src/ui/npcPanel.ts` pattern): `pointerover` selects the row, `pointerdown`
  activates it — or, while spinning, skips.
- **Teardown.** `close()` removes every timer it created (`TimerEvent.remove()` /
  the `delayedCall` handle), destroys the root and the masks, and clears the module
  state, so nothing paints after the window is gone and a reload mid-reveal leaves
  the run exactly as the spin booked it.

## 🧩 Data and configuration

None. This task adds **no** data row, **no** JSON key, **no** setting and **no**
run field: `CASINO`, `SHOP_ROTATION`, the item catalogue, the atlas manifests and
the existing `casino.*` / `notice.itemObtained` strings are read as they are.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds and re-pins.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-116` audit against the exclusive paths list.
  - `[live]` runs use a dev server on a runner's headless Chromium over CDP
    (`docs/agent-ci.md`), reading the live canvas with
    `renderer.snapshotArea(...)` + `getImageData`, never a screenshot. Start it
    with `npm run dev -- --port 5173` (the dev overlay only exists in a
    `develop` build, which `.env.development` provides) and open
    `http://localhost:5173/`.
- **The `[unit]` harness.** `src/scenes/rooms/casino.test.ts`'s fake scene gains
  `time: { now, addEvent, delayedCall }` (recording each callback and its delay,
  and returning `{ remove() }`) and `make: { graphics: () => fakeObject() }`, and
  its recorder also records `setFrame`/`setTexture` per reel image, so the reveal
  is driven by calling the recorded callbacks with a chosen `time.now`. Everything
  stays headless: the fake scene needs no browser.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `src/ui/casinoReels.test.ts` pins the eight constants
    (`REEL_COUNT = 3`, `REEL_SPIN_MS = 800`, `REEL_STOP_STAGGER_MS = 160`,
    `REEL_TICK_MS = 100`, `REEL_DECOY_COUNT = 5`, `REEL_W = 48`, `REEL_H = 48`,
    `REEL_GAP = 12`), `reelStopAt(0|1|2) === [800, 960, 1120]`, and
    `reelRects(410, 250)` equal to `[{x:556,y:322,w:48,h:48},{x:616,y:322,w:48,h:48},{x:676,y:322,w:48,h:48}]`.
  - [ ] `[unit]` `casinoReels.test.ts` pins `reelFace` for the three outcome kinds
    (item → that id, egg → `EGG_ITEM_ID`, battle → `{ kind: 'rocket' }`), and pins
    `bandFaces` **exactly** for all six bands (table order, the Egg where its row
    sits, then the band's `casinoHeldPool` ids), `bandFaces('early')` being the
    eleven ids in this spec. It also asserts, for every band, that every `item`
    face's id has `itemIconFrame(id) !== null` and `getItem(id) !== undefined`, and
    that no band's faces are empty.
  - [ ] `[unit]` `casinoReels.test.ts` pins `reelStrips`: three strips, each
    `REEL_DECOY_COUNT + 1` long, the last face equal to `reelFace(outcome)`, every
    other face a member of `bandFaces(band)`, and the Rocket face reachable **only**
    as the last face of a `battle` outcome; and `reelFaceIndex`: `0` at `0 ms`, the
    last index at and after `reelStopAt(reel)` (800/960/1120), strictly
    non-decreasing across `0, 100, …, 1 200 ms` for each reel, and never above
    `REEL_DECOY_COUNT`.
  - [ ] `[unit]` `casino.test.ts` proves the rule that must not move: `commitRun` is
    recorded **before** any timer callback runs, exactly one `commitRun` happens per
    press, and a second `confirm` while spinning calls neither `casinoSpin` nor
    `commitRun` again (the committed money drops once, and the run's
    `pickedItems` holds one `casinoSpinId`).
  - [ ] `[unit]` `casino.test.ts` proves the reveal: at the open, `TEXTS` holds the
    money, `SPIN  ¥<price>`, `LEAVE` and an empty message line, and each reel image
    carries `reelRestFace`'s frame; after firing the loop at `time.now = 400` the
    three reels carry the frames of `strip[reelFaceIndex(reel, 400)]`; after firing
    the three `delayedCall`s (800, 960, 1 120) the reels carry the outcome face and
    the message is `t('notice.itemObtained', { name })` for an item/egg outcome.
  - [ ] `[unit]` `casino.test.ts` proves the grunt path: with the seed whose first
    spin is the battle (`casino-a` in the shipped test) the window is **still open**
    and `startTrainerBattle` **not** called before 1 120 ms, and after the last stop
    the calls are `releaseHudKeyboard → openPanel → commitRun → closePanel →
    startTrainerBattle` with the shipped `gruntFor` trainer object; a skip at
    400 ms produces the same call sequence at once.
  - [ ] `[unit]` `casino.test.ts` proves the input lock and the pointer: while
    spinning, `up`/`down`/`cancel` change nothing and the `LEAVE` row closes
    nothing, while one press on a row's zone (the `pointerdown` handler the fake
    scene records) skips to the end state; when idle, a `pointerdown` on the `SPIN`
    row's zone spins and one on `LEAVE` closes; a refusal (no money, locked machine)
    starts no timer and commits nothing; and `close()` removes every recorded timer,
    so firing them afterwards changes nothing.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched;
    `docs/maps-spec.md` differs only in `### The casino (the slot machine)`'s
    opening paragraph and `docs/design-spec.md` only in §7's casino bullet (the
    `One **spin**:` bullets, the pure-function paragraph, the Egg paragraph and
    every other §7 line are byte-identical).
  - [ ] `[live]` **The cabinet holds three reels.** Open the casino room's window
    (recipe below) and, before pressing any row, snapshot the reel band
    `renderer.snapshotArea(556, 322, 168, 48)` and read row `y = 24` of the image
    with `getImageData`. Classify a pixel as **cell ink** when its summed
    `|ΔR| + |ΔG| + |ΔB|` against the pixel at local `x = 140` (the gap between the
    second and third windows, which is the card surface) is `≥ 24`. Bound: the row
    holds **exactly three** runs of **≥ 20** consecutive ink pixels separated by
    **≥ 8** non-ink pixels, and the first ink pixel of the first run sits at
    `x = 0..4` of the band. (A wheel or a list fails this; three 48 px windows with
    12 px gaps pass it.)
  - [ ] `[live]` **The rows are clickable.** With the same window open on a run
    that cannot afford the band's price, snapshot the message band
    `renderer.snapshotArea(434, 482, 412, 16)` (card-relative `y + 232`), dispatch a
    CDP mouse press at `(640, 408)` — the `SPIN` row's centre — wait 200 ms, snapshot
    the same rect again. Bound: **≥ 20** pixels differ between the two snapshots by
    a summed `|ΔRGB| ≥ 24`, and the money band
    `renderer.snapshotArea(640, 270, 206, 16)` is identical within `± 2` per
    channel per pixel (no money was spent). This proves the pointer reaches the row
    and that the window answers in the message line.
- **The `[live]` recipe (both criteria).** On `http://localhost:5173/`: start a run
  (`new run`, any seed, any starter). Press `F` (the dev overlay). In its teleport
  block set the floor to `2` and press GO; then set the room field to `0` and step
  it upward with GO until the minimap cell reads the casino's three-reel glyph
  (three teal discs inside a teal square outline; `src/scenes/rooms/casino.ts`'s
  `drawMarker`). The overlay's `map/room` line names the room. Then set the tile
  field to a walkable tile **adjacent to the room's farthest walkable tile** (the
  cabinet: the machine texture with the Rocket grunt beside it) and press GO; hold
  the direction toward the cabinet and press the interact key (`E`) facing it. The
  window is what both criteria snapshot; a run with no money is the intended state
  for the second one.

## 📣 Coordination

- For the Architect: this task holds `src/scenes/rooms/casino.ts` and
  `src/ui/casinoReels.ts`; it holds **no** `RouteScene`, no engine file and no i18n
  table, which is why it shares a batch with an engine-and-scene task.
  `docs/maps-spec.md` is shared by **block**: this task owns only
  `### The casino (the slot machine)`'s opening paragraph, while the batch-mate
  owns the same file's `### The special NPC` block — every other line of §7 is
  nobody's this batch.
  `[Task-117]` moves this window file to `src/ui/rocketPanel.ts` with a `git mv`
  and keeps the machine, the reels and the reveal exactly as specified here, so the
  module boundary (`casinoReels.ts` = model, `casino.ts` = the drawn window) is
  what makes that move cheap.
- For the next batch: `reelStrips`/`reelFaceIndex` are the only source of faces;
  `[Task-117]` must not re-derive them and must not change `casinoSpin`,
  `casinoHeldPool` or the mark families. The reels are a **reveal of a booked
  outcome**: a panel that spins must keep the `commitRun`-before-the-first-frame
  order, or a reload becomes a re-roll.

## ⛔ Out of scope

- The table, the grouped `'held'` row, the price and the economy (`[Task-115]`,
  shipped), the rocket's **placement** as an NPC and the casino room's retirement
  (`[Task-117]`), the grunt's roster and archetype.
- A reduced-motion / animation-speed **setting**: `src/settings.ts` has none and
  this task adds none; the skip is the accessibility path.
- Any new player-facing string (`casino.*` and `notice.itemObtained` already carry
  the window's copy), any change to `src/i18n/`, any new data row, any run field,
  any `SAVE_VERSION` step, any new RNG draw, and the minimap glyph (it already
  draws three reels).
- Re-packing art, new atlas frames, sound cues for the spin, and the room's
  `drawFixture`/grunt drawing beyond what the rewrite touches.
