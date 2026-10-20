# Spec: Task-94 — The run-modifier NPCs: the exorcist, the weather man, the magician and the type gate

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + one Phaser scene.
- **Role:** Dev.
- **Objective:** four special NPCs write a fact that outlives the room. The run gains one
  typed `modifiers` record (`curse`, `forcedField`, `nextWildType`) saved with the run
  (`SAVE_VERSION` **20 → 21**); the exorcist sets the curse, the weather man pins a
  `ROOM_BATTLEFIELDS` row over the next floors, the magician narrows the next wild roll to
  one type, and the type gate hands an item to a party that holds a Bug. All four appear
  through the shipped special-NPC roll (`roomNpc` / `guaranteedNpc`), open the shipped
  `npcPanel` card and record their one use per floor in `pickedItems`.
- **Environment:** worktree `../wt-pkm-94`, branch `task-94`.
- **Dependencies (already merged on `main`):**
  - **The special-NPC framework** (`[Task-91]`) — `src/data/npcs.ts` (`NpcRow`,
    `NPC_ROWS`, `getNpcRow`), `src/engine/routes/npcs.ts` (`roomNpc`, `guaranteedNpc`,
    `npcUseId`, `npcSpot`), `src/ui/npcPanel.ts` (`openNpcPanel`, `NPC_MAX_CHOICES = 6`).
    The scene's `openNpcCardView` / `chooseNpc` / `showNpcResult` are its seam.
  - **The floor missions** (`[Task-98]`) — `RunState.mission`, `missionsCompleted`,
    `hpLost`, `floorCasualties` and `advanceMap`'s judgement; `SAVE_VERSION` is **20**.
  - **The room battlefields** (`[Task-62]`) — `src/data/battlefields.ts`
    (`ROOM_BATTLEFIELDS`, `RoomBattlefield`, `RoomConditionId`, `battlefieldSeeds`) and
    `RoomBattlefield` as `BattleLaunch.battlefield`.
  - **The wild level rule** (`[Task-79]`) — `wildLevel` / `rollWildLevel` and
    `encounterTableFor` as the scene's `applyRoute` builds it.
  - **The party predicates** (`[Task-65]`/`[Task-91]`) — `partyHasType`
    (`src/engine/run/party.ts`).
  - **The item catalogue** — `getItem('silverpowder')` (a `held` item, not consumed).

### Exclusive paths (single writer)

Nothing outside this list.

- `src/engine/run/modifiers.ts` **(new)** and `src/engine/run/modifiers.test.ts` **(new)**
- `src/engine/run/state.ts` and `src/engine/run/state.test.ts`
- `src/engine/save.ts` and `src/engine/save.test.ts`
- `src/engine/run/battleLink.ts`
- `src/engine/battle/state.ts`
- `src/engine/routes/npcs.ts` and `src/engine/routes/npcs.test.ts`
- `src/engine/routes/encounters.ts` and `src/engine/routes/encounters.test.ts`
- `src/data/npcs.ts` and `src/data/npcs.test.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/BattleScene.ts`
- `src/i18n/en.ts` and `src/i18n/es.ts`
- `docs/maps-spec.md` **§7 only** (the special-NPC table)
- `docs/battle-spec.md` **§4 only**
- `docs/routes-spec.md` **§3 only**
- `src/engine/README.md` and `src/data/README.md` (one line each, below)

### Inputs (read-only)

- `AGENTS.md`
- `docs/agent-spec-template.md`
- `docs/maps-spec.md` §7, `docs/battle-spec.md` §4, `docs/routes-spec.md` §3
- `src/engine/run/missions.ts`, `src/engine/run/party.ts`, `src/data/missions.ts`
- `src/data/battlefields.ts`, `src/data/items.ts`, `src/data/dex/types.ts`,
  `src/data/overworldSprites.ts`, `src/data/frlg/overworld.json`
- `src/engine/rng.ts`, `src/data/README.md`, `src/engine/README.md`
- `src/ui/npcPanel.ts`, `src/ui/frlg.ts`
- The rest of `src/scenes/RouteScene.ts` and `src/scenes/BattleScene.ts` as context (they
  are yours to change, at the two seams named below only).

## 🔒 Contract

### TypeScript — the run's modifiers

```ts
// src/engine/run/modifiers.ts  — pure, imports nothing from ./state (no cycle)
export type RunModifiers = Readonly<{
  /** The exorcist's hex: the next enemy battle starts with the lead one stage down. */
  curse: boolean;
  /** The weather man's sky: a `ROOM_BATTLEFIELDS` id and the floors it still covers. */
  forcedField: Readonly<{ id: string; floorsLeft: number }> | null;
  /** The magician's type: the next wild roll is narrowed to it, then it is consumed. */
  nextWildType: string | null;
}>;

/** How many floors a forced sky covers when the weather man sets it. */
export const FORCED_FIELD_FLOORS = 3;
export function emptyModifiers(): RunModifiers;
export function withCurse(mods: RunModifiers): RunModifiers;
export function withoutCurse(mods: RunModifiers): RunModifiers;
export function withForcedField(mods: RunModifiers, id: string): RunModifiers;export function withNextWildType(mods: RunModifiers, typeId: string): RunModifiers;
export function withoutNextWildType(mods: RunModifiers): RunModifiers;
/** `floorsLeft - 1`, and `null` at zero. Every other field is untouched. */
export function decayModifiers(mods: RunModifiers): RunModifiers;
/** `mods.forcedField`'s id while it still has floors, else null. */
export function forcedFieldId(mods: RunModifiers): string | null;
```

- `withCurse` sets `curse: true`; `withoutCurse` sets `false`; both keep every other field.
- `withForcedField` replaces any field with `{ id, floorsLeft: FORCED_FIELD_FLOORS }`.
- `withNextWildType` stores the id as given (callers pass a normalized id, see
  `MAGICIAN_TYPES`); `withoutNextWildType` sets `null`.
- `decayModifiers` leaves `curse` and `nextWildType` alone.
- No function mutates its argument, throws, reads RNG, a clock or storage.

### TypeScript — the run state and the save

```ts
// src/engine/run/state.ts
export type RunState = Readonly<{
  // …every shipped field unchanged…
  modifiers: RunModifiers;
}>;
```

- `createRun` sets `modifiers: emptyModifiers()`. `advanceRoute` carries it untouched.
- `advanceMap` sets `modifiers: decayModifiers(run.modifiers)` (the floor being left
  spends one floor of the forced sky), beside the mission judgement it already does.
- `SAVE_VERSION` becomes **21**.
- `src/engine/save.ts` gains the `20` migration:
  `run: isRecord(document.run) ? { ...document.run, modifiers: emptyModifiers() } : document.run`
  and `parseRun` reads `modifiers: parseModifiers(value.modifiers)` through a new private
  `parseModifiers`: `curse` only when `=== true`; `forcedField` only from a record with a
  non-empty string `id` and an integer `floorsLeft >= 1`; `nextWildType` only from a
  non-empty string; anything else is `emptyModifiers()`. `encodeSave` needs no change.

### TypeScript — the battle start

```ts
// src/engine/battle/state.ts
export type BattleSetup = Readonly<{
  // …every shipped field unchanged…
  /** Stat stages the enemy's lead starts with (the exorcist's curse). */
  enemyBoosts?: Partial<Record<BoostId, number>>;
}>;
```

`createBattle` applies `setup.enemyBoosts` to the **enemy's first party member only**
(`state.sides.enemy.party[0]`) through the shipped `applyBoosts`
(`src/engine/battle/fighter.ts`), after the state and its fighters exist; the player's
side and the enemy's other members keep their empty boosts. No event is logged for it.

```ts
// src/engine/run/battleLink.ts
export type BattleLaunch = Readonly<{
  // …every shipped field unchanged…
  /** The exorcist's curse: the enemy lead starts one Attack stage down. */
  enemyBoosts?: Partial<Record<BoostId, number>>;
}>;
```

`BattleScene.create` forwards it: `...(launch.enemyBoosts ? { enemyBoosts: launch.enemyBoosts } : {})`.

### TypeScript — the encounter table narrows by type

```ts
// src/engine/routes/encounters.ts
export function encounterTableFor(
  band: LevelBand,
  excluded?: ReadonlySet<string>,
  typeId?: string | null,
): EncounterTable;

export class RouteEncounters {
  /** Replaces the live type filter: draws nothing, leaves `steps` and the stream. */
  setTypeFilter(typeId: string | null): void;
}
```

- A non-empty `typeId` keeps only the species whose `getSpecies(id)?.types` contains a
  type whose `normalizeId` equals it (both from `src/data/dex`). Exclusions apply first,
  then the type.
- A filter that would empty the table is ignored (`typeId` treated as absent, exclusions
  still applied, then the shipped empty fallback), so the table is never empty.
- `RouteEncounters.currentTable()` applies the live exclusions and the live type filter,
  with the same two fallbacks. `setTypeFilter` is what the scene calls; the constructor
  takes the same filter as an optional **last** parameter.

### TypeScript — the two draws the NPCs make

```ts
// src/engine/routes/npcs.ts
/** One `Rng.int` on `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:field`)). */
export function npcForcedField(
  seed: string,
  roomIndex: number,
  npcId: string,
): RoomBattlefield;
/** One `Rng.int` on `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:type`)). */
export function npcWildType(seed: string, roomIndex: number, npcId: string): string;
```

- `npcForcedField` picks one `ROOM_BATTLEFIELDS` row in table order.
- `npcWildType` picks one id of `MAGICIAN_TYPES` (`src/data/npcs.ts`) in table order.
- Both are pure and seeded only by their arguments; they draw from their own streams, so
  no map, encounter, roster or battle draw moves (`D11`).

### Data — `src/data/npcs.ts`

```ts
export type NpcGrant = Readonly<{ types: readonly string[]; itemId: string }>;
export type NpcRow = Readonly<{
  // …every shipped field unchanged…
  /** A row that pays an item to a party holding one of these types (the type gate). */
  grant?: NpcGrant;
}>;

/** The 18 battle type ids the magician draws from, in the dex's own order. */
export const MAGICIAN_TYPES: readonly string[];   // TYPE_NAMES.map(normalizeId)
/** What the curse does to the enemy's lead (data, not code). */
export const CURSE_ENEMY_BOOST: Readonly<{ atk: number }>;  // { atk: -1 }
```

`NPC_ROWS` gains **four rows after `sacrifice`, in this order and with these fields**:

| id | spriteKey | chance | floorStep | choice id / label key | extra |
| --- | --- | --- | --- | --- | --- |
| `exorcist` | `exorcist` | 0.02 | 0.005 | `hex` / `npc.exorcist.cast` | — |
| `weather-man` | `weather-man` | 0.02 | 0.005 | `sky` / `npc.weather.cast` | — |
| `magician` | `magician` | 0.02 | 0.005 | `type` / `npc.magician.cast` | — |
| `type-gate` | `bugcatcher` | 0.02 | 0.005 | `claim` / `npc.gate.claim` | `grant: { types: ['bug'], itemId: 'silverpowder' }` |

Name/greeting keys: `npc.exorcist.{name,greeting}`, `npc.weather.{name,greeting}`,
`npc.magician.{name,greeting}`, `npc.gate.{name,greeting}`. `MAGICIAN_TYPES` and
`CURSE_ENEMY_BOOST` are data: `silverpowder` must resolve through `getItem` and stay a
`held`, non-consumed row.

### i18n keys (both tables, authored in `en` and overlaid in `es`)

`npc.exorcist.name`, `npc.exorcist.greeting`, `npc.exorcist.cast`, `npc.exorcist.done`,
`npc.weather.name`, `npc.weather.greeting`, `npc.weather.cast`, `npc.weather.done`,
`npc.magician.name`, `npc.magician.greeting`, `npc.magician.cast`, `npc.magician.done`,
`npc.gate.name`, `npc.gate.greeting`, `npc.gate.claim`, `npc.gate.refused`,
`npc.gate.granted`.

- `npc.weather.done` carries `{floors}`; `npc.magician.done` carries `{type}` (the dex's
  English type name); `npc.gate.granted` carries `{item}` (the item's catalogue name).
- Every Spanish line must be drawable by the FRLG font: **no em dash**, no character
  outside the shipped table, and the key parity test must stay green.

### Scene seams (`src/scenes/RouteScene.ts`)

- `applyRoute` passes `this.run.modifiers.nextWildType` to the new
  `RouteEncounters` (last constructor argument) and the room's `step()` path is unchanged.
- `onTileEntered`: when a grass step **rolls an encounter** and
  `run.modifiers.nextWildType !== null`, consume it (`withoutNextWildType`),
  call `this.encounters.setTypeFilter(null)` and `persistRun()` before `startBattle`.
  A grass step that rolls nothing consumes nothing.
- `startBattle` adds to the launch:
  `...(this.run.modifiers.curse ? { enemyBoosts: CURSE_ENEMY_BOOST } : {})`,
  `battlefield: this.forcedBattlefield() ?? this.battlefield`, and then **consumes the
  curse** in the run it persists for this battle (`withoutCurse`). A private
  `forcedBattlefield(): RoomBattlefield | null` resolves the modifier's id through
  `ROOM_BATTLEFIELDS` and returns null for an unknown id.
- `chooseNpc` gains four branches, each of which commits one run write that also marks
  `npcUseId(mapIndex, roomId, row.id)` in `pickedItems` (the shipped per-floor record), then
  prints its result card through `showNpcResult`:
  - `exorcist` → `withCurse`.
  - `weather-man` → `npcForcedField(...)` → `withForcedField`.
  - `magician` → `npcWildType(...)` → `withNextWildType`, and `setTypeFilter(typeId)` so the
    room on screen already obeys it.
  - `type-gate` → `partyHasType(this.run, row.grant.types)`; **no type** prints
    `npc.gate.refused` and marks nothing; a match does `addItem(run, itemId, 1)` plus the
    mark and prints `npc.gate.granted`.
- The four rows are **one-shot per floor** like the shipped member rows; `advanceMap` is
  what forgets them.

## 🧩 Data and configuration

- `RunModifiers` is the only new run fact; it is saved inside the run (step 20 → 21).
- `FORCED_FIELD_FLOORS = 3`, `CURSE_ENEMY_BOOST = { atk: -1 }`, `MAGICIAN_TYPES` (18) and
  the type gate's `{ types: ['bug'], itemId: 'silverpowder' }` are data with these meanings;
  rebalancing them must never need an engine edit.
- **Docs to write, one paragraph or row each:** `docs/maps-spec.md` §7's NPC table gains
  the four rows (chance, floor step, what each writes, the gate's type and item);
  `docs/battle-spec.md` §4 gains "a force field the run carries replaces the room's rolled
  condition and spends one floor per `advanceMap`; the curse is one Attack stage down on
  the enemy's lead and is spent by the battle it starts"; `docs/routes-spec.md` §3 gains
  "the magician's type narrows the band's table before the draw and is consumed by the
  next wild encounter that actually rolls".
- **Folder READMEs:** `src/engine/README.md` gains `run/modifiers.ts`'s role line beside
  `run/missions.ts`, and `src/data/README.md`'s `npcs.ts` line records the `grant` field
  and the four rows.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-94` audited against the exclusive paths.
  - The one `[live]` criterion is measured on the running game (below).
- **Acceptance criteria:**
  - [ ] `[unit]` `RunModifiers`: `emptyModifiers()` is curse-free; each `with*` sets only
        its field and leaves the others; `decayModifiers` drops the field one floor and
        turns it into `null` at zero; `createRun` starts empty; `advanceRoute` keeps it;
        `advanceMap` decays it. `src/engine/run/modifiers.test.ts` and
        `state.test.ts` pin these.
  - [ ] `[unit]` `SAVE_VERSION === 21`; a v20 document migrates to a run whose
        `modifiers` is empty; a v19 document migrates through both steps;
        `encodeSave`/`decodeSave` round-trip a run carrying
        `{ curse: true, forcedField: { id: 'rain', floorsLeft: 2 }, nextWildType: 'bug' }`;
        an unknown field id, a zero `floorsLeft` and a non-string type fall back to the
        empty record. `save.test.ts` pins all of it.
  - [ ] `[unit]` The four rows are in `NPC_ROWS` after `sacrifice` in table order; each
        `spriteKey` is in `OVERWORLD_SPRITE_KEYS`; every name, greeting and choice key
        exists in **both** locale tables; the gate's `silverpowder` resolves through
        `getItem`, is `kind: 'held'` and `consumed !== true`; `MAGICIAN_TYPES` has 18
        unique non-empty ids and `CURSE_ENEMY_BOOST.atk === -1`. `npcs.test.ts` pins it.
  - [ ] `[unit]` `npcForcedField` and `npcWildType` are stable for a fixed
        `(seed, roomIndex, npcId)`, change with the room index, and resolve into
        `ROOM_BATTLEFIELDS` / `MAGICIAN_TYPES` respectively. `npcs.test.ts` pins it.
  - [ ] `[unit]` `encounterTableFor(band, none, 'bug')` is non-empty and every entry's
        species carries Bug; a type no species of the band carries falls back to the
        unfiltered table; a `RouteEncounters` whose filter is set via `setTypeFilter` rolls
        only matching species while `steps` and the seed's first roll are unchanged by the
        setter. `encounters.test.ts` pins it.
  - [ ] `[unit]` `createBattle` with `enemyBoosts: { atk: -1 }` leaves the enemy's first
        member at `boosts.atk === -1`, every other enemy member and the player's party at
        `0`, and logs no event for it. A battle without it keeps every boost at 0.
  - [ ] `[unit]` The four scene branches write exactly one run fact each: curse set,
        forced field set to `FORCED_FIELD_FLOORS`, next wild type set and the live filter
        changed, and the gate granting once and refusing (no mark, no item) without the
        type. The pure helpers cover what can be headless; `npm run build` proves the
        scene compiles.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, `src/engine/` imports no
        Phaser and no DOM, no `Math.random()` / `Date.now()` entered it, and
        `src/data/dex/` was not edited.
  - [ ] `[live]` With `npm run dev` and a browser driven over CDP, a saved run
        (`localStorage['pokerandomlike.save']`) whose `modifiers` is
        `{ curse: true, forcedField: { id: 'rain', floorsLeft: 3 }, nextWildType: 'bug' }`
        starts a wild battle through the debug overlay's *Wild battle* row, and the live
        `Battle` scene's state reads **`weather === 'rain'`**,
        **`sides.enemy.party[0].boosts.atk === -1`** and
        **`sides.enemy.party[1]?.boosts.atk === 0`**; back on the route,
        `game.scene.getScene('Route').run.modifiers` reads
        **`curse === false`**, **`forcedField.floorsLeft === 3`** and
        **`nextWildType === 'bug'`** (a battle is not a wild roll); measured by reading
        those live values and one `renderer.snapshotArea` of the battle's top strip to
        confirm the battle scene is on screen. The value of `state.weather` proves the
        forced field; nothing here is judged by eye.

## 📣 Coordination

- For the Architect: this is Batch 40, cut alone — every other open task claims
  `src/scenes/RouteScene.ts` or `src/engine/save.ts` (this task holds both), the i18n key
  table (this task's four rows need 17 new keys) or an unmerged dependency.
- For the next batch: `RunState.modifiers` and `SAVE_VERSION` 21 are the base
  `[Task-101]`'s 21 → 22 steps from; the forced field's row lookup is
  `ROOM_BATTLEFIELDS`, so `[Task-106]`'s second half extends that table, not this record.

## ⛔ Out of scope

- The conditions themselves (`[Task-62]`, `[Task-106]`), the wild exclusion
  (`[Task-52]`), the level rule (`[Task-79]`) and the room a condition belongs to.
- The other NPC rows (`[Task-95]`'s four item/battle rows) and the missions' own rewards.
- A second NPC panel, a scrollable type picker, any `SAVE_VERSION` step beyond 21, and any
  change to `roomNpc`'s roll, `effectiveNpcChance`, `npcSpot` or the panel's geometry.
- Any repack of an atlas: the four sprite keys already ship in
  `src/data/frlg/overworld.json`.
