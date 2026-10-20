# Spec: Task-91 — The special-NPC framework

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data table + Phaser scene wiring + panel module + docs.
- **Role:** Dev.
- **Objective:** after this task a **trainer room may hold at most one special NPC**,
  rolled per room from the run seed with a per-row chance that rises with the floor,
  drawn as an ordinary overworld sprite on a free tile, blocked like an object,
  talked to with the interact key, and shown through **one reusable panel shell**
  (title, one paragraph, a column of choices, a `LEAVE` path). The task ships the
  **framework only**: `NPC_ROWS` is **empty**, because every NPC's own content and
  effect belongs to `[Task-92]`–`[Task-95]` and their entries add their own rows.
  Nothing visible changes in the game until the first row lands.
- **Environment:** worktree `../wt-pkm-91`, branch `task-91`.
- **Dependencies (already merged, read-only):**
  - `[Task-82]` — a regular room's `role: 'trainers' | 'wild'` (`MapRoomRole`,
    `src/engine/maps/plan.ts`) and `TRAINER_ROOMS_PER_MAP` (`src/data/population.ts`).
  - `[Task-90]` — the ten `NPC_SPRITE_KEYS` in `src/data/overworldSprites.ts` and
    their rows in the packed `frlg:overworld` atlas.
  - `[Task-65]` — `partyHasType` in `src/engine/run/party.ts`, the module the other
    party predicates join.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
Deleting a stray `.gitkeep` from a directory this task populates is always allowed.
`.agent_specs/task-91.md` is the spec commit already on the branch: **do not touch it.**

- `src/engine/routes/npcs.ts` (new)
- `src/engine/routes/npcs.test.ts` (new)
- `src/engine/routes/index.ts` (one `export * from './npcs';` line)
- `src/data/npcs.ts` (new)
- `src/data/npcs.test.ts` (new)
- `src/data/README.md` (one row for `npcs.ts`)
- `src/engine/run/party.ts` (`partyHasMove`, `partyHasAbility`)
- `src/engine/run/party.test.ts` (their cases)
- `src/ui/npcPanel.ts` (new)
- `src/ui/npcPanel.test.ts` (new)
- `src/ui/README.md` (one row for `npcPanel.ts`)
- `src/scenes/RouteScene.ts` (the NPC hook, its sprite, its block, its interact)
- `src/i18n/en.ts` and `src/i18n/es.ts` (the one `npc.leave` key)
- `docs/maps-spec.md` §7
- `docs/routes-spec.md` §2
- `docs/design-spec.md` §7

No other task in Batch 37 exists; every one of those paths is yours. Do **not** create
`src/engine/routes/README.md` (that folder has none) and do **not** touch
`package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**` or any generated
asset.

### Inputs (read-only)

Read these before writing; they are the seams you extend.

- `AGENTS.md` (whole file) — stack, purity, determinism, i18n, asset rules.
- `docs/agent-spec-template.md` — only for the shape of what you write in the docs.
- `src/engine/routes/routeMap.ts` — `RouteMap` (`entry`, `exits`, `items`,
  `trainers`, `tiles`), `tileKey`.
- `src/engine/map.ts` — `isWalkable`, `TileMap`.
- `src/engine/rng.ts` — `Rng.next()` ∈ [0,1), `Rng.int(min,max)` **inclusive**,
  `hashSeed`.
- `src/engine/maps/plan.ts` — `MapPlan`, `MapRoom` (`id`, `role`, `special`),
  `MapRoomRole`.
- `src/engine/run/state.ts` — `RunState`, `isItemPicked`, `markItemPicked`.
- `src/engine/run/party.ts` — `partyHasType` (the house shape to mirror).
- `src/data/npcs.ts` — does not exist yet; you create it.
- `src/data/overworldSprites.ts` — `NPC_SPRITE_KEYS`, `overworldSpriteFrame`,
  `OVERWORLD_SPRITE_TEXTURE_KEY`, `OVERWORLD_SPRITE_WIDTH`.
- `src/scenes/RouteScene.ts` — `buildRoom`, `drawTrainers` (4935-4968),
  `tryInteract` (5571-5581), `canMove` (~6931-6948), `drawEntities`, the
  `this.shopCounter` resets, `roomHost`, `openPanel`/`closePanel`.
- `src/scenes/rooms/trade.ts` — the modal-room-panel pattern (rows, highlight,
  `LEAVE`, `handle`, `close`).
- `src/ui/frlg.ts` — `addFrlgWindow`, `FRLG_ACCENT`, `FRLG_MUTED`, `FRLG_ROW_FILL`,
  `FRLG_ROW_STROKE`, `FRLG_SELECTED_FILL`, `FRLG_SELECTED_STROKE`,
  `FRLG_WINDOW_PADDING`.
- `src/ui/frlgFont.ts` — `FRLG_INK`, `addFrlgText`.
- `src/ui/floatingPanel.ts` — `PanelRect`, `PanelViewport`, `clampPanelOrigin`.
- `src/i18n/index.ts` — `t`, `TranslationKey`.
- `src/data/keybinds.ts` — `KeybindAction`.

## 🔒 Contract

Other tasks in later batches are written against these exact names. Implement them
as written. If a signature is wrong, say so in your report — do not rename silently.

### `src/data/npcs.ts` (new)

```ts
import type { TranslationKey } from '../i18n';

/** What a party must carry for an NPC row to be eligible (never the box). */
export type NpcRequirement =
  | Readonly<{ kind: 'type'; types: readonly string[] }>
  | Readonly<{ kind: 'move'; moves: readonly string[] }>
  | Readonly<{ kind: 'ability'; abilities: readonly string[] }>;

/** One choice the panel shell prints; `label` is an i18n key. */
export type NpcChoice = Readonly<{ id: string; label: TranslationKey }>;

/** One special NPC: identity, its art, its per-floor chance and its gate. */
export type NpcRow = Readonly<{
  id: string;
  /** The i18n key of the NPC's name, printed as the panel's title. */
  nameKey: TranslationKey;
  /** The i18n key of the one paragraph the panel opens with. */
  greetingKey: TranslationKey;
  /** A key of `NPC_SPRITE_KEYS` (`src/data/overworldSprites.ts`). */
  spriteKey: string;
  /** Base chance, 0..1, on map 1. */
  chance: number;
  /** Added to `chance` for every floor after the first. */
  floorStep: number;
  /** When present, a party member must satisfy it before the row is eligible. */
  requires?: NpcRequirement;
  /** The rows the panel prints, in order; `LEAVE` is the shell's own last row. */
  choices?: readonly NpcChoice[];
}>;

/**
 * Every special NPC. **Empty on purpose**: `[Task-92]`–`[Task-95]` add their own
 * rows with their own effect, so the framework ships no content and the game is
 * unchanged until the first row lands (`docs/maps-spec.md` §7).
 */
export const NPC_ROWS: readonly NpcRow[] = [];

export function getNpcRow(id: string): NpcRow | undefined;
```

`nameKey` / `greetingKey` / `choice.label` are `TranslationKey`s: this task adds **no**
NPC name or greeting key (there is no row); the only new key is `npc.leave` below.
The file stays pure data: no functions that read a run, no Phaser.

### `src/engine/routes/npcs.ts` (new, pure)

```ts
import type { Tile } from '../grid';
import type { RunState } from '../run/state';
import { NPC_ROWS, type NpcRequirement, type NpcRow } from '../../data/npcs';
import type { RouteMap } from './routeMap';

/** What one room rolled. */
export type NpcPlacement = Readonly<{ row: NpcRow; roomIndex: number }>;

/** `clamp01(row.chance + row.floorStep * (mapIndex - 1))`. */
export function effectiveNpcChance(row: NpcRow, mapIndex: number): number;

/** True when the run satisfies `requirement`; absent means true. Case-insensitive. */
export function npcRequirementMet(run: RunState, requirement: NpcRequirement | undefined): boolean;

/**
 * At most one NPC for `roomIndex`, or null. One `Rng.next()` for presence and, on a
 * hit, one `Rng.int` for the weighted row pick, on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}`))` — its own stream, so no map,
 * encounter, roster or battle draw moves (`D11`).
 */
export function roomNpc(
  seed: string,
  roomIndex: number,
  mapIndex: number,
  rows?: readonly NpcRow[],
): NpcPlacement | null;

/** `npc-<mapIndex>-<roomIndex>-<id>`, the per-floor `pickedItems` use record. */
export function npcUseId(mapIndex: number, roomIndex: number, npcId: string): string;

/**
 * The free tile the NPC stands on, or null. Excludes the entry and its four
 * neighbours, every exit, walls, trainers and visible items; one `Rng.int` on
 * `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:spot`))`.
 */
export function npcSpot(route: RouteMap, roomIndex: number, seed: string, npcId: string): Tile | null;
```

Exact roll semantics, so two implementations cannot disagree:

- `rows` defaults to `NPC_ROWS`. An **empty** array returns `null` **without drawing**.
- `weights[i] = Math.round(effectiveNpcChance(rows[i], mapIndex) * 10_000)`; a row whose
  weight is `0` is never picked but still counts as "present".
- `total = Σ weights`, `present = rng.next() * 10_000 < total` — one `next()`.
  A total of `0` returns `null` after that one draw.
- The pick is **one** `rng.int(0, total - 1)`: walk the rows in table order and take
  the first whose cumulative weight exceeds the ticket, so a higher-chance row is
  likelier and table order breaks ties. No second draw.
- `roomIndex` is the plan room's id (`MapRoom.id`), and the two calls are independent
  per room: adding a room cannot shift another room's NPC.

`npcRequirementMet` mirrors `partyHasType`'s shape (the **party**, never the box; HP
and status are irrelevant): `'type'` → `partyHasType(run, requirement.types)`;
`'move'` → `partyHasMove(run, requirement.moves)`; `'ability'` →
`partyHasAbility(run, requirement.abilities)`; absent → `true`.

`src/engine/routes/index.ts` gains `export * from './npcs';`.

### `src/engine/run/party.ts` (extend)

```ts
/** True when a **party** member has any of `moveIds` equipped. Case-insensitive. */
export function partyHasMove(run: RunState, moveIds: readonly string[]): boolean;

/** True when a **party** member has any of `abilityIds` as its ability. */
export function partyHasAbility(run: RunState, abilityIds: readonly string[]): boolean;
```

Equipped moves are `member.fighter.moves[].moveId` (`FighterSnapshot.moves`); the
ability is `member.fighter.ability`. An empty list is `false`, exactly as
`partyHasType` and a fainted member still counts. Do not change `partyHasType` and do
not touch `src/engine/run/index.ts` (it already exports `* from './party'`).

### `src/ui/npcPanel.ts` (new)

The one shell every later NPC fills. It draws and reports; it owns no rule and no
run state.

```ts
import type Phaser from 'phaser';
import type { KeybindAction } from '../data/keybinds';
import type { PanelRect, PanelViewport } from './floatingPanel';

export const NPC_PANEL_W = 520;
export const NPC_PANEL_H = 360;
export const NPC_PANEL_PAD = 24;
export const NPC_CHOICE_H = 40;
export const NPC_CHOICE_GAP = 6;
/** A column of at most six choices above `LEAVE`; more are clamped. */
export const NPC_MAX_CHOICES = 6;

export type NpcChoiceView = Readonly<{ id: string; label: string }>;

/** What the caller hands in: already-resolved strings (the caller owns `t`). */
export type NpcPanelView = Readonly<{
  title: string;
  paragraph: string;
  choices?: readonly NpcChoiceView[];
}>;

/** Where the card and its rows sit, in screen px. Pure and headless. */
export type NpcPanelLayout = Readonly<{
  x: number;
  y: number;
  w: number;
  h: number;
  choices: readonly PanelRect[];
  leave: PanelRect;
}>;

/** Centred, clamped inside `viewport`; `LEAVE` is always the last row. */
export function npcPanelLayout(viewport: PanelViewport, choiceCount: number): NpcPanelLayout;

export type NpcPanel = Readonly<{
  close(): void;
  handle(action: KeybindAction): void;
}>;

/**
 * Draws the modal card and owns its keyboard until `close()`.
 * `onChoose` fires once per confirm on a choice row, then the card closes;
 * confirming `LEAVE` or `cancel` closes without firing it.
 */
export function openNpcPanel(
  scene: Phaser.Scene,
  view: NpcPanelView,
  onChoose?: (id: string) => void,
): NpcPanel;
```

- **Modal:** `handle` consumes every action it is given (`up`/`down` move the
  highlight over `choices + LEAVE`, `confirm`/`interact` activate, `cancel` closes,
  everything else is a no-op). The scene decides the keyboard slot, not this module.
- Drawn with the shipped chrome only: `addFrlgWindow(scene, x, y, w, h)` for the card,
  `addFrlgText` for the title, the paragraph and every row, the `frlg` accent/selected
  tokens for the highlight, `FRLG_INK` on the light field — no new texture, no new
  asset, no `package.json` change.
- The paragraph is drawn as **wrapped lines** inside the card's content width; the
  rows sit under it, anchored so `LEAVE` is the bottom row of the card.
- `close()` destroys the card's whole container once and is idempotent.
- No `Math.random`, no clock, no storage; the only inputs are the view and the keys.

### `src/i18n/en.ts` / `src/i18n/es.ts`

Add exactly one key, beside the other room labels (the `casino.*` / `trade.*` block):

- `npc.leave` — en `LEAVE`, es `SALIR`.

### `src/scenes/RouteScene.ts` (wire it)

1. **Build.** In `buildRoom`, after the route and its fixtures exist and only when
   `this.room?.special === null` **and** `this.room?.role === 'trainers'` **and**
   `this.generatorStepIndex === null`:
   - `const eligible = NPC_ROWS.filter((row) => npcRequirementMet(this.run, row.requires));`
   - `const placement = roomNpc(this.run.seed, this.room.id, this.room.mapIndex, eligible);`
   - `const tile = placement ? npcSpot(this.route, this.room.id, this.run.seed, placement.row.id) : null;`
   - store `{ row, tile }` in one private field, or null. If `overworldSpriteFrame(row.spriteKey)`
     is `null` (the sheet lacks the key), store null: no art, no block, no interact.
2. **Draw.** In the same place `drawTrainers` draws (and under the same
   `generatorStepIndex` guard), draw **one** `this.add.sprite` with
   `OVERWORLD_SPRITE_TEXTURE_KEY` and `overworldSpriteFrame(row.spriteKey)`,
   `setOrigin(0.5, 1)`, `setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)`,
   `setDepth(actorDepth(footY))`, at `centerX(tile.x)` / `centerY(tile.y) + TILE_SIZE/2`.
   Book it into the scene's entity list and the HUD camera's ignore list exactly as a
   trainer sprite is. **Do not** add it to `trainerSprites` and do not give it a spin.
3. **Block.** A live NPC blocks its tile exactly like a visible item or a trainer: add
   the check to the movement reject list beside `this.shopCounterAt(result.to)`.
4. **Interact.** In `tryInteract`, **after** the room descriptor's own interact and
   **before** the trainer check: if the faced tile is the NPC's tile and no panel is
   open, open the shell with the row's `t(row.nameKey)` and `t(row.greetingKey)`, the
   row's `choices` mapped to `{ id, label: t(choice.label) }`, and an `onChoose` that
   (a) marks `npcUseId(mapIndex, roomId, row.id)` through `markItemPicked` +
   `this.commitRun`, then (b) closes the panel. Consume the key.
   With `this.room` null or no NPC, the key falls through unchanged.
5. **Reset.** Clear the field wherever `this.shopCounter = null` is reset and wherever
   the trainer sprites are cleared, so a room change, a run over and a restart never
   carry an NPC into another room. Keep the whole hook allocation-free per frame: the
   tile is computed once per room build, never in `update`.
6. **No new notice, no new HUD line, no new save field.** A greeting records nothing;
   only a chosen choice marks its use id.

## 🧩 Data and configuration

- `src/data/npcs.ts` — the table above, **empty**. Its row shape is the contract the
  four content tasks fill; a row's `chance` is map 1's base and `floorStep` is added
  per floor after it, so a row's own `chance` is the only place a balance number lives.
- The **ten sprite keys** are `NPC_SPRITE_KEYS` in `src/data/overworldSprites.ts`
  (`merchant`, `chef`, `magician`, `exorcist`, `weather-man`, `sacrifice`, `medic`,
  `iv-judge`, `berry-tree`, `ninja`). A row names one of them; the framework draws
  nothing for any other key.
- Streams (frozen, `D11`): presence+pick `${seed}:npc:<roomIndex>`; spot
  `${seed}:npc:<roomIndex>:<npcId>:spot`. Neither is shared with the map, encounter,
  roster or battle streams.
- The per-floor use record is `pickedItems`'s `npc-<map>-<room>-<id>` — the same
  stable-id shape as `gate-<map>-<room>` and `trade-<map>-<room>`, cleared by
  `advanceMap`. No `SAVE_VERSION` step.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in a fresh worktree.
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-91` audited against **Exclusive paths** above.
  - The one `[live]` criterion below: a browser pass over CDP on the running game,
    plus the same measurement on `origin/main` for the comparison. Stop the server
    afterwards.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass: `src/engine/routes/npcs.test.ts`,
        `src/data/npcs.test.ts`, `src/engine/run/party.test.ts` and
        `src/ui/npcPanel.test.ts`.
  - [ ] `[unit]` `roomNpc` is deterministic and the table is the only input that
        decides a placement: the same `(seed, roomIndex, mapIndex, rows)` returns the
        same row; two rooms on the same seed are independent; an empty table returns
        `null`; a row with `chance: 0, floorStep: 0` is never picked; every picked row
        is one of the eligible rows. Pin at least one fixed-seed placement.
  - [ ] `[unit]` `effectiveNpcChance` is `clamp01(chance + floorStep × (mapIndex − 1))`
        — pinned at `mapIndex` 1, 2 and past the clamp in both directions.
  - [ ] `[unit]` `npcSpot` is deterministic for a fixed seed, never returns the entry,
        an entry neighbour, an exit, a wall, a trainer's tile or a visible item's tile
        (asserted over several fixed seeds/rooms).
  - [ ] `[unit]` `npcRequirementMet` is true for an absent requirement, and mirrors
        `partyHasType`'s rules for each kind (party only, fainted counts,
        case-insensitive, empty list false); `partyHasMove`/`partyHasAbility` are
        tested the same way.
  - [ ] `[unit]` `npcPanelLayout` keeps the card inside a 1280×800 and a 390×844
        viewport, lays `0..NPC_MAX_CHOICES` choices without overlap, always puts
        `LEAVE` last and never overlaps it with a choice.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; no Phaser import,
        no `Math.random`, no `Date.now` and no storage entered `src/engine/`; the
        ATLAS/dex were not hand-edited.
  - [ ] `[unit]` The docs name the framework where the plan says: `docs/maps-spec.md`
        §7 (the per-NPC roll, its stream, its chance rule, the empty table and the
        use record), `docs/routes-spec.md` §2 (the roll is per room build and moves no
        generator stream) and `docs/design-spec.md` §7 (the modal NPC card, its rows
        and its `LEAVE` path); `src/data/README.md` and `src/ui/README.md` each gain
        their file's one line.
  - [ ] `[live]` **The empty table is dormant** — nothing is placed and no card can
        open. Measure over CDP in the running game, and repeat the same reads on
        `origin/main` at the same seed/room:
        1. Serve both trees on their own ports (`npm run dev -- --port <free> --strictPort`;
           the base tree from a second worktree at `origin/main`), and confirm
           `location.href` is still yours before every read.
        2. Resume/start a run at seed **`pkm-91`** (the starter screen's seed prompt,
           `S`, or a save) and reach map 1's **first room whose plan role is
           `trainers`**: its id is printed by
           `node -e "…planMap('pkm-91',1)…"` or read from the debug overlay's
           teleport; name the room id in the report.
        3. Read the live scene: `const s = game.scene.getScene('RouteScene')`, then
           count `s.children.list.filter(o => o.texture && o.texture.key === 'frlg:overworld').length`
           on both trees. **PASS** when the count is equal and equals the room's live
           trainer count; a higher count on `task-91` is a placed NPC and **fails**.
        4. Face each free floor tile in turn and press the interact key
           (`s.tryInteract` is private: send the bound key over CDP, or call the
           private method). After each press, `s.roomPanel` must be **null** and
           `renderer.snapshotArea(380, 220, 520, 360, …)` + `getImageData` must differ
           from the pre-press frame in **0** pixels. Any non-zero diff or non-null
           `roomPanel` **fails**.
        5. Say in the report which method produced each number (object list vs canvas).

## 📣 Coordination

- For the Architect: Batch 37 is a **single-task batch** and the fill search is
  recorded in the cycle report. `NPC_ROWS` shipping empty is deliberate: the ten
  sprite keys exist, the ten rows do not, and each content task adds its own.
- For the next batch (`[Task-92]`, the merchant): its row is
  `{ id, nameKey, greetingKey, spriteKey: 'merchant', chance: 0, floorStep: 0,
  requires?: undefined, choices }` plus the file's guarantee field it introduces; it
  calls `roomNpc(seed, roomIndex, mapIndex, eligibleRows)` — **do not** change that
  signature — and filters `NPC_ROWS` by `npcRequirementMet` before the call. The
  panel shell's `onChoose` is where a row's effect is wired, and the per-floor use
  record is `npcUseId`.
- For `[Task-93]`/`[Task-94]`/`[Task-95]`: `NpcRequirement` covers the three party
  predicates (type / move / ability); the panel shell clamps at six choices and
  always adds `LEAVE`; `partyHasMove`/`partyHasAbility` live in `party.ts` beside
  `partyHasType` — never a second predicate module.

## ⛔ Out of scope

- **Any NPC row and any NPC effect** (`[Task-92]`–`[Task-95]`, `[Task-99]`): no
  merchant, tutor, re-roll, sacrifice, medic, chef, berry tree, exorcist, weather man,
  magician, type gate, secret shop, special trainer or Rocket grunt. No name or
  greeting keys either.
- The shop room's deletion and the merchant's floor guarantee (`[Task-92]`).
- Any new run field, `SAVE_VERSION` step, migration or `pickedItems` clearing rule.
- Any new art, atlas, packer run or generated file; any scene other than
  `RouteScene.ts`; any change to the route generator (`src/engine/routes/sketch.ts`,
  `layout.ts`, `validate.ts`) — the NPC is a per-room **build-time** fixture, not part
  of the generated route.
- The debug overlay, the i18n sweep, the battle, and anything under `src/data/dex/`.
