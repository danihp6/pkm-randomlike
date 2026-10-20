# Spec: Task-96 — The static-species room, and the legendary room behind a flawless floor

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data table + Phaser room descriptor + docs.
- **Role:** Dev.
- **Objective:** A new special leaf — `static` — exists on a floor's plan; its route
  carves the shipped one-tile **vault** behind one obstacle; the interact key opens
  that seal when the **party** holds the property the obstacle's data row names (a
  **type** through `partyHasType`, or a **feature** — an ability — through
  `partyHasAbility`); the far side holds **one static species**, blocked on its tile,
  that starts a **normal wild battle** at the squad's level through the scene's own
  wild path, so a catch spends the room's capture exactly like tall grass. The same
  room kind, on a floor whose own mission is `flawless` and while the run's
  `missionsCompleted` reads exactly `1` and the floor is map 4 or later, holds a
  **legendary** instead of the ordinary species. After this task a fixed seed
  reproduces the leaf, its seal, its species and its variant, no shipped floor's
  topology, specials, room ids, sizes, trainer composition or wild sequence moves,
  and the save format is untouched.
- **Environment:** worktree `../wt-pkm-96`, branch `task-96`.
- **Dependencies** (all merged, each named with the file this task reads):
  - **`[Task-65]`** — `src/engine/routes/gate.ts` (`carveGatedVault`, `gateKindFor`,
    `gateId`) and `src/data/gates.ts` (`GATES`, `GateKind`, the tile each seal is
    stamped as), plus `src/scenes/rooms/gate.ts` as the descriptor precedent. This
    task **reuses the carve unchanged** (no edit to either file).
  - **`[Task-91]`** — `src/engine/run/party.ts` (`partyHasType`, `partyHasAbility`,
    `partyHasMove`). Reuse; never a second predicate module.
  - **`[Task-98]`** — `src/engine/run/state.ts` (`RunState.mission`,
    `RunState.missionsCompleted`, `advanceMap`), `src/engine/run/missions.ts` and
    `src/data/missions.ts`. This task **reads** the record and adds no field.
  - `[Task-92]`'s room layer, already shipped: `src/scenes/rooms/registry.ts`,
    `src/scenes/rooms/types.ts` and `RouteScene`'s `specialDescriptor()`. That is why
    this room is a descriptor file and the scene is barely touched.

### Exclusive paths (single writer)

Create:

- `src/data/staticSpecies.ts`
- `src/data/staticSpecies.test.ts`
- `src/engine/routes/staticSpecies.ts`
- `src/engine/routes/staticSpecies.test.ts`
- `src/scenes/rooms/staticSpecies.ts`
- `src/scenes/rooms/staticSpecies.test.ts`

Modify:

- `src/engine/maps/plan.ts` — the `MapRoomSpecial` value and the leaf's own roll.
- `src/engine/maps/plan.test.ts` — the shipped-kind filters, the possible re-pin of
  `SHIPPED_FLOORS`, and the new fixed-seed tests.
- `src/engine/routes/index.ts` — one barrel line.
- `src/scenes/rooms/types.ts` — `RoomWildBattle` and the optional host hook.
- `src/scenes/rooms/registry.test.ts` — `SHIPPED_KINDS` and the kind count.
- `src/scenes/RouteScene.ts` — the `static` seal record and the wild-battle host hook.
- `src/ui/notice.ts` — two notice builders.
- `src/ui/notice.test.ts` — their cases.
- `src/engine/run/curve.test.ts` — **the deliberate re-pin** `MEASURED_FILL` a floor
  gaining a room forces: `routeIndexForRoom` (`src/engine/run/floors.ts` 65-70) sums
  the **previous floors' room counts**, so the floor that hangs the new leaf makes every
  later floor's rooms build from a shifted route index and place a trainer more or less.
  Precedent: the commit that retired the shop room re-pinned this same table. Record the
  walk as it stands; **do not** re-solve the eight factors (that is a balance task, and
  `src/data/run.ts` is not in this task's paths).
- `docs/balance/route-curve.md` — **one new paragraph only**, headed
  `**Re-walked again (Task-96).**`, appended after the Task-92 paragraph: the walk moved
  because a floor gained a room, the eight measured fills now read the values
  `curve.test.ts`'s `MEASURED_FILL` pins, every one still sits inside the rule's
  `1.05 – 1.5` window, the analytic table's `fill` column is unchanged (it is
  `0.75 × T̄ × A / needed`, which the shift does not touch) and the sheet's older
  "within a hundredth of 1.25" claim describes the **walk before** this task. The band
  table, the per-map analytic table and the eight factors are **not** edited, and no
  balancing value is re-solved.
- `src/i18n/en.ts` — two keys (source table).
- `src/i18n/es.ts` — the same two keys.
- `src/engine/README.md` — the new module's line.
- `src/data/README.md` — the new table's line.
- `src/scenes/rooms/README.md` — the new descriptor's and test's lines.
- `docs/maps-spec.md` — **§7 only** (the table row, the chance/roll-order paragraph,
  one new subsection).
- `docs/routes-spec.md` — **§3 only** (one bullet at the end of "Wild encounters")
  and **§6 only** (one sentence in the transient-notice bullet).
- `docs/design-spec.md` — **§7 only** (one bullet).

Do **not** touch, and say so in the commit body: `src/engine/save.ts` and its test,
`src/engine/run/state.ts`, `src/engine/run/pool.ts`, `src/engine/routes/gate.ts`,
`src/data/gates.ts`, `src/ui/mapView.ts` and its test, `src/scenes/rooms/gate.ts`,
`src/data/dex/**`, `package.json`, `src/main.ts`, `vite.config.ts`.

### Inputs (read-only)

- `docs/maps-spec.md` §7, `docs/routes-spec.md` §3/§6, `docs/design-spec.md` §7,
  `docs/agent-spec-template.md`, `AGENTS.md`.
- `src/engine/maps/plan.ts`, `src/engine/maps/progress.ts`, `src/engine/maps/route.ts`,
  `src/engine/routes/gate.ts`, `src/engine/routes/sketch.ts` (`RouteRequest.gate`),
  `src/engine/routes/routeMap.ts` (`RouteGate`), `src/engine/routes/validate.ts`.
- `src/engine/run/state.ts`, `src/engine/run/party.ts`, `src/engine/run/missions.ts`,
  `src/engine/battle/fighter.ts`, `src/engine/rng.ts`, `src/engine/tileset.ts`
  (`TILE_SIZE`).
- `src/data/gates.ts`, `src/data/missions.ts`, `src/data/noHeal.ts` (the data-row
  convention), `src/data/dex/species.ts`, `src/data/dex/abilities.ts`,
  `src/data/dex/types.ts`.
- `src/scenes/rooms/types.ts`, `src/scenes/rooms/registry.ts`,
  `src/scenes/rooms/gate.ts`, `src/scenes/rooms/noHeal.ts`,
  `src/scenes/rooms/trade.ts` (the `drawFixture` precedent), `src/scenes/RouteScene.ts`.
- `src/ui/notice.ts`, `src/ui/typeColors.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`,
  `src/i18n/index.test.ts`.

## 🔒 Contract

### TypeScript — `src/data/staticSpecies.ts` (new)

```ts
import type { GateKind } from './gates';

/** What opens a static leaf's seal: a party **type** or a party **feature** (an ability). */
export type StaticGateKind = 'type' | 'feature';

/**
 * One row of the gate table: the property, and the ids one party member may carry to
 * satisfy it (a **list**, so "Bug or Grass" is data, never a branch).
 */
export type StaticGate = Readonly<{ kind: StaticGateKind; values: readonly string[] }>;

/** The first floor that may hang the leaf, and the chance it does. */
export type StaticRoomConfig = Readonly<{ fromMap: number; chance: number }>;

export const STATIC_ROOM: StaticRoomConfig;
export const LEGENDARY_ROOM: StaticRoomConfig;
export const STATIC_GATES: Readonly<Record<GateKind, StaticGate>>;
export const STATIC_SPECIES: readonly string[];
export const LEGENDARY_SPECIES: readonly string[];
```

- `STATIC_ROOM` is the **leaf**'s roll (`fromMap: 3`, `chance: 0.25`).
- `LEGENDARY_ROOM` is the **variant**'s conditional roll (`fromMap: 4`, `chance: 0.25`).
- `STATIC_GATES` is keyed by `GateKind` because the seal's kind is chosen by the
  shipped carve (`gateKindFor`), so the room reads its own seal's row.
- **Determinism:** pure data, reads no RNG, no clock, no DOM.

### TypeScript — `src/engine/routes/staticSpecies.ts` (new)

```ts
import type { GateKind } from '../../data/gates';
import type { StaticGate } from '../../data/staticSpecies';
import type { RunState } from '../run/state';

/** Which content a floor's static leaf holds. */
export type StaticRoomVariant = 'ordinary' | 'legendary';

/** What the room places behind its seal, and the property that opens it. */
export type StaticRoomContent = Readonly<{
  variant: StaticRoomVariant;
  /** The species the room fields, at the squad's current level. */
  speciesId: string;
  /** `squadLevel(run)` when the room was built. */
  level: number;
  /** The gate row the obstacle reads. */
  gate: StaticGate;
}>;

/** The seal's stable opening mark in `pickedItems`: `static-<mapIndex>-<roomId>`. */
export function staticGateId(mapIndex: number, roomId: number): string;

/** The static species' own mark in `pickedItems`: `static-mon-<mapIndex>-<roomId>`. */
export function staticSpeciesId(mapIndex: number, roomId: number): string;

/** True when the party holds the gate's property (a type list, or an ability list). */
export function staticGateOpen(run: RunState, gate: StaticGate): boolean;

/** The content this floor's static leaf holds, from the run and the leaf's own streams. */
export function staticRoomContent(
  run: RunState,
  mapIndex: number,
  roomId: number,
  obstacle: GateKind,
): StaticRoomContent;
```

Frozen behaviour, exactly:

- `staticGateId` returns `` `static-${mapIndex}-${roomId}` `` and `staticSpeciesId`
  returns `` `static-mon-${mapIndex}-${roomId}` `` (both `mapIndex`/`roomId` used as
  given; no clamping, no padding).
- `staticGateOpen` is `partyHasType(run, gate.values)` when `gate.kind === 'type'` and
  `partyHasAbility(run, gate.values)` when `gate.kind === 'feature'`. Nothing else:
  the box is never asked, a member at 0 HP still counts (that is the shipped
  predicates' own rule).
- `staticRoomContent` clamps the floor with `Math.max(1, Math.floor(mapIndex))` and then:
  1. `eligible` = `floor >= LEGENDARY_ROOM.fromMap && run.missionsCompleted === 1 &&
     run.mission?.id === 'flawless'`. **This reads only fields `advanceMap` writes**
     (`missionsCompleted`, `mission.id`) — never `missionMet`, never `hpLost` — so a
     mid-floor HP loss, a casualty or a `rebuildRoom()` can never flip a room that has
     already been seen.
  2. `legendary` = `eligible && new Rng(hashSeed(`${run.seed}:map:${floor}:static-variant:${roomId}`)).next() < LEGENDARY_ROOM.chance`.
     When `eligible` is false the stream is **not** read at all.
  3. `list` = `legendary ? LEGENDARY_SPECIES : STATIC_SPECIES`;
     `speciesId` = `list[new Rng(hashSeed(`${run.seed}:map:${floor}:static-species:${roomId}`)).int(0, list.length - 1)]`.
  4. `level` = `squadLevel(run)`; `gate` = `STATIC_GATES[obstacle]`;
     `variant` = `legendary ? 'legendary' : 'ordinary'`.
- **Determinism:** two minted streams from `run.seed` only, both fresh per call, so no
  shipped stream moves and the same `(run facts, mapIndex, roomId, obstacle)` always
  returns the same content. No `Math.random()`, no `Date.now()`, no Phaser.
- The gate `kind` vs `feature` split is data (`STATIC_GATES`), not an engine branch.

### TypeScript — `src/scenes/rooms/types.ts` (modify)

Add one exported type and one **optional** host member (optional so every existing
headless `RoomHost` stub keeps compiling untouched):

```ts
/** One wild battle a room starts through the scene's own wild path. */
export type RoomWildBattle = Readonly<{
  speciesId: string;
  level: number;
  /** The battle's own entity key; the scene appends its own counter. */
  key: string;
}>;
```

and, inside `RoomHost`:

```ts
  /** Opens a menu battle against one wild Pokémon through the scene's wild path. */
  startWildBattle?: (encounter: RoomWildBattle) => void;
```

### TypeScript — `src/scenes/rooms/staticSpecies.ts` (new)

```ts
export const descriptor: RoomDescriptor; // kind: 'static', marker: 'static'
```

Frozen behaviour:

- `fixture(host)` returns `null` when `host.route().gate` is `undefined` or when
  `isItemPicked(host.run, staticSpeciesId(host.view.mapIndex, host.view.roomId))` is
  true (the species has been fought). Otherwise it returns
  `{ counter: gate.pocket, notice? }`, where `notice` is `staticLegendaryNotice()`
  only when the content's variant is `'legendary'`.
- `interact(host, tile)` answers `true` (consumed) only for two tiles, in this order:
  1. the **seal** (`gate.tile`) while `isItemPicked(host.run, staticGateId(...))` is
     false: if `staticGateOpen(host.run, content.gate)` is false it calls
     `host.showNotice(staticSealLockedNotice(gate.kind))` and changes nothing; else it
     `host.commitRun(markItemPicked(host.run, staticGateId(...)))`, then
     `host.rebuildRoom()`, then `host.showNotice(gateOpenedNotice())`.
  2. the **species** (`gate.pocket`) while `isItemPicked(host.run, staticSpeciesId(...))`
     is false **and** `host.startWildBattle` is defined: it
     `host.commitRun(markItemPicked(host.run, staticSpeciesId(...)))`, then
     `host.rebuildRoom()` (the record is read now, so the glyph and the blocking
     counter go before the battle starts), then
     `host.startWildBattle({ speciesId: content.speciesId, level: content.level, key: `static:${view.mapIndex}:${view.roomId}` })`.
  Anything else returns `false`, so the key falls through to the shipped paths.
- `drawFixture(host)` draws nothing when `host.generatorStepActive()`, when
  `host.route().gate` is undefined, or when the species' mark is already set. Otherwise
  it draws the species' silhouette on `gate.pocket`: one `host.scene.add.circle` of
  radius `TILE_SIZE * 0.3` in `typeColor(getSpecies(speciesId)?.types[0] ?? '')` and one
  of radius `TILE_SIZE * 0.12` in `0xffffff`, alpha `0.7`, offset
  `(-TILE_SIZE * 0.08, -TILE_SIZE * 0.1)`, both `setDepth(5)` and both at the tile's
  centre (`x * TILE_SIZE + TILE_SIZE / 2`, the `centerX`/`centerY` helpers `trade.ts`
  uses).
- `drawMarker(graphics, cx, cy, radius)` draws the minimap glyph: a filled
  `0xf2c94c` circle at `radius * 0.85`, then a filled `0x10161f` circle at
  `radius * 0.34` (a gold ring, distinct from the gated leaf's brown stem).
- The descriptor never touches scene internals: `host.scene`, `host.commitRun`,
  `host.showNotice`, `host.rebuildRoom`, `host.startWildBattle`. Its imports are
  `staticGateId`, `staticGateOpen`, `staticRoomContent`, `staticSpeciesId`
  (`../../engine/routes`), `isItemPicked`, `markItemPicked` (`../../engine/run`),
  `gateOpenedNotice`, `staticLegendaryNotice`, `staticSealLockedNotice`
  (`../../ui/notice`), `getSpecies` (`../../data/dex/species`), `typeColor`
  (`../../ui/typeColors`), `TILE_SIZE` (`../../engine/tileset`) and
  `RoomDescriptor`/`RoomHost` (`./types`).

### TypeScript — `src/ui/notice.ts` (modify)

```ts
/** The static leaf's refusal: a type obstacle keeps the shipped line, the feature seal its own. */
export function staticSealLockedNotice(kind: GateKind): Notice;

/** The static leaf holds the legendary variant: a hint, never the species' name. */
export function staticLegendaryNotice(): Notice;
```

- `staticSealLockedNotice('bush')` → `t('gate.locked.bush')` (reuse),
  `('rock')` → `t('gate.locked.rock')` (reuse), `('water')` → `t('static.locked.water')`.
- `staticLegendaryNotice()` → `t('notice.staticLegendary')`. It takes **no parameter**:
  the line names no species on purpose (a hint, not a spoiler) and a key cannot print a
  token it does not declare (`src/i18n/index.test.ts` enforces the token set).
- Both return `{ text, holdMs: NOTICE_HOLD_MS }`, like every builder there.

### Data

- **New JSON-free tables** (above) — no JSON, no `src/data/dex/**` edit.
- **`pickedItems` records this task freezes** (per floor, cleared by `advanceMap`):

| Record | Written by | Means |
| --- | --- | --- |
| `static-<mapIndex>-<roomId>` | the seal's successful opening | the vault stays open for the floor |
| `static-mon-<mapIndex>-<roomId>` | the species' interact, before the battle | the species is gone for the floor |

- **i18n keys this task adds** (authored in `src/i18n/en.ts`, overlaid in
  `src/i18n/es.ts`, identical token sets, no em dash in Spanish):

| Key | en | es |
| --- | --- | --- |
| `static.locked.water` | `Deep water. Only the right ability could part it.` | `Agua profunda. Solo la habilidad adecuada podría abrirla.` |
| `notice.staticLegendary` | `A legendary presence waits behind the seal.` | `Una presencia legendaria aguarda tras el sello.` |

  Species names stay English in both locales (`D43`): nothing here names a species.

## 🧩 Data and configuration

`src/data/staticSpecies.ts` ships exactly:

```ts
export const STATIC_ROOM: StaticRoomConfig = { fromMap: 3, chance: 0.25 };
export const LEGENDARY_ROOM: StaticRoomConfig = { fromMap: 4, chance: 0.25 };

export const STATIC_GATES: Readonly<Record<GateKind, StaticGate>> = {
  bush: { kind: 'type', values: ['Bug', 'Grass'] },
  rock: { kind: 'type', values: ['Rock', 'Fighting'] },
  water: { kind: 'feature', values: ['Water Absorb', 'Swift Swim', 'Storm Drain'] },
};

export const STATIC_SPECIES: readonly string[] = [
  'dratini',
  'larvitar',
  'bagon',
  'gible',
  'deino',
  'goomy',
  'dreepy',
  'frigibax',
];

export const LEGENDARY_SPECIES: readonly string[] = ['articuno', 'zapdos', 'moltres', 'mewtwo'];
```

- Type gate rows reuse the ships-the-art pairing of `GATES` (a bush yields to Bug or
  Grass, a boulder to Rock or Fighting); the **pond** is the **feature** row, opened by
  an ability, because the goal asked for "a type or a feature".
- `STATIC_SPECIES` is the first stage of each pseudo-legendary line: a real
  long-term investment caught at the squad's level.
- `LEGENDARY_SPECIES` is an **explicit data list**, never `speciesPool`: this is the
  documented bypass of `WILD_BANNED_TAGS` (`src/engine/run/pool.ts`) and it must not
  widen the ordinary wild pool by one species.
- **No balancing number lives in engine code.** The two chances and the two
  `fromMap`s reach `plan.ts` and `staticSpecies.ts` from this table; a retune is an
  edit here.

`src/engine/maps/plan.ts` (modify, in this order):

1. `MapRoomSpecial` gains `'static'`:
   `export type MapRoomSpecial = 'mini-boss' | 'mega-stone' | 'casino' | 'gated' | 'trade' | 'no-heal' | 'static';`
   and the doc block above it names the new leaf ("a **static** leaf behind a party
   gate from map 3 on").
2. After the no-heal roll, the **last** statement of the special pass:

```ts
  // The static-species leaf rolls on its **own** minted stream, after every shipped
  // draw, so no floor's topology, specials, room ids, sizes or trainer roles move
  // (`docs/maps-spec.md` §7).
  const staticRng = new Rng(hashSeed(`${seed}:map:${index}:static-room`));
  if (index >= STATIC_ROOM.fromMap && staticRng.next() < STATIC_ROOM.chance) {
    const parents = freeParents();
    if (parents.length > 0) addSpecial('static', parents[staticRng.int(0, parents.length - 1)]);
  }
```

   The leaf's **size** draws must come from that same `staticRng`, not the `map`
   stream: give `addSpecial` an optional third parameter
   `rng: Rng = mapStreamRng` and pass `staticRng` for this leaf, so
   `addSpecial`'s two `rng.int(tuning.size.min, tuning.size.max)` calls draw from the
   static stream for this kind only. (Those values are overwritten with
   `MAP_MIN_ROOM_SIZE` for quiet leaves afterwards, exactly as today; they are kept
   because the existing leaves' draw counts must not move.)
   Imports gain `hashSeed` and the `Rng` class (`src/engine/rng.ts`) and
   `STATIC_ROOM` (`src/data/staticSpecies.ts`).

Why its own stream and not the `map` stream: the role pass (`trainerRoomsForMap`
shuffle) runs **after** the special pass on the `map` stream, so one extra `rng.next()`
there would move every floor's trainer composition from map 3 on. Minting the leaf's
stream keeps every shipped draw byte-identical — the plan's own stream-field comment
(`src/engine/maps/streams.ts`) already anticipates a later pass joining without moving
an existing draw.

**The room count does move one thing, and the spec owns it.** A floor that hangs the
leaf holds one room more, and `routeIndexForRoom` sums the previous floors' room counts,
so every **later** floor's rooms build from a shifted route index and place a trainer
more or less: `src/engine/run/curve.test.ts`'s `MEASURED_FILL` is re-pinned to the walk
as it now stands, and `docs/balance/route-curve.md` gains the one `Re-walked again
(Task-96).` paragraph that records it. Every fill must still sit inside the rule's
`1.05 – 1.5` window and the eight factors are **not** re-solved here.

`src/scenes/RouteScene.ts` (modify, exactly two changes):

1. `buildRoute`'s gate request (`~line 1472`) also covers the static leaf, each kind
   reading **its own** record:

```ts
      ...(params.room?.special === 'gated' || params.room?.special === 'static'
        ? {
            gate: isItemPicked(
              this.run,
              params.room.special === 'gated'
                ? gateId(params.room.mapIndex, params.room.roomId)
                : staticGateId(params.room.mapIndex, params.room.roomId),
            )
              ? 'open'
              : 'sealed',
          }
        : {}),
```

2. a private wild-battle path plus its port:

```ts
  /** Opens a room's own wild battle through the shipped wild path (`startBattle`). */
  private startRoomWildBattle(encounter: RoomWildBattle): void {
    this.startBattle({
      kind: 'wild',
      speciesId: encounter.speciesId,
      level: encounter.level,
      key: encounter.key,
    });
  }
```

   and in `roomHost()` (beside `startTrainerBattle`):
   `startWildBattle: (encounter) => scene.startRoomWildBattle(encounter),`.

Nothing else in the scene changes: the registry already collects the descriptor, the
minimap already reads `plan.specials`, `quiet` already covers "any special leaf", and
`startBattle` already spends the room's capture and carries the ability/moveset roll
(`learnsetSeed: launch.runSeed`) for every wild trigger.

### Docs to write (exactly these blocks, nothing outside them)

- `docs/maps-spec.md` **§7**: (a) one new row in the "Room / Per floor / Placement /
  Content" table, right after the **no-heal** row, titled **static**: 25 % chance from
  map 3 on, a leaf anywhere, one **vault** behind a bush, a rock or a pond that opens
  when any party member holds the seal's property (Bug or Grass, Rock or Fighting, or
  the pond's ability) and holds one **static species** at the squad's level, fought and
  caught like a wild; (b) the chance paragraph under the table gains the static leaf's
  25 % from map 3 on and says its `…:static-room` stream is **the last** draw of the
  special pass, after the no-heal leaf's; (c) one new subsection after the trade block
  and before `### The special NPC`, headed `### The static-species leaf`, covering the
  carve, the two gate kinds (type through `partyHasType`, feature through
  `partyHasAbility`), the two `pickedItems` records, the wild battle at `squadLevel`,
  and then the **legendary** variant: the same kind, from map 4 on, 25 % on its own
  stream, only while `missionsCompleted === 1` and the floor's mission is `flawless`,
  and why that reads as once per run with no new field.
- `docs/routes-spec.md` **§3**: one bullet appended after the capture bullet — the
  static species is fought through the wild path and is **not** drawn from the wild
  table, so `WILD_BANNED_TAGS` is unchanged and the room's capture rule is the shipped
  one.
- `docs/routes-spec.md` **§6**: one sentence on the transient-notice bullet (the one
  that carries the HUD's mission line) — the static leaf floats its refusal line when
  its seal does not yield, and a legendary leaf floats one more line on entry.
- `docs/design-spec.md` **§7**: one bullet after the **gated** bullet, in player terms:
  the static-species room and its legendary variant.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-96` audit against the exclusive paths list.
  - This task has `[live]` criteria, so **one** browser pass against `npm run dev`
    (headless Chromium/Playwright) is owed. The dev build installs the DOM debug
    overlay and exposes the live instance with
    `page.evaluate(async () => { const { game } = await import('/src/main.ts'); return game.scene.getScene('Route'); })`.

Tests the dev owes (all in files already listed above):

- `src/data/staticSpecies.test.ts`: both config rows pinned; `STATIC_GATES` is total
  over `GATE_KINDS` with at least one `type` row and one `feature` row; every `type`
  value passes `isTypeName` and every `feature` value resolves through `getAbility`;
  both species lists are non-empty, duplicate-free, resolve through `getSpecies`, and
  carry no `battleOnly`; **no** id of `LEGENDARY_SPECIES` appears in
  `speciesPool(band, 'wild')` for any level band (the bypass stays a bypass).
- `src/engine/routes/staticSpecies.test.ts`: the two ids' exact strings and that they
  differ from `gateId`/`gateRewardId`; `staticGateOpen` true/false for a type gate
  (party holds it, party does not, empty party) and for a feature gate (ability held as
  primary, as a `secondAbility`, and not held); `staticRoomContent` — ordinary by
  default, **the same content when `hpLost`/`stats.casualties` change** (the no-flip
  invariant), legendary only with `missionsCompleted === 1` + `mission.id === 'flawless'`
  + `floor >= 4`, never with `missionsCompleted` 0 or 2, never on floor 3, `level ===
  squadLevel(run)`, `speciesId` always a member of the right list, and a fixed-seed
  expectation table (seed, floor, room) → `variant`/`speciesId` pinned verbatim.
- `src/engine/maps/plan.test.ts`: `assertPlan` extended (`'static'` at most once, none
  before map 3, a dead-end leaf below the boss, `role === 'wild'`); a
  "hangs a static leaf about a quarter of the time from map 3 on" odds test over the
  existing `SEEDS` × maps 1-8 (none on maps 1-2); a "pins where the static leaf hangs,
  seed by seed" table; and the two shipped-kind lists (`SHIPPED_SPECIALS`,
  `assertPlan`'s per-kind "at most one" checks, plus its map-gated absences)
  extended with `'static'`.
- `src/scenes/rooms/staticSpecies.test.ts`: the harness copies `gate.test.ts`'s; the
  seal's refusal (no record, no rebuild, the kind's notice), the seal's opening
  (record + `rebuildRoom` + `gateOpenedNotice`), the species' interact (record +
  `rebuildRoom` + `startWildBattle` with `{speciesId, level, key}`), the `false` paths
  (no gate, tile elsewhere, both records already set, no `startWildBattle`), the
  fixture's `counter`/`notice` and its `null` after the record, and the marker.
- `src/scenes/rooms/registry.test.ts`: `SHIPPED_KINDS` gains `'static'`.
- `src/ui/notice.test.ts`: one case per builder (the three kinds' lines, the legendary
  line with no interpolation, Spanish overlay, the shared hold).

- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0.
  - [ ] `[unit]` The declared tests exist and pass:
    `npx vitest run src/data/staticSpecies.test.ts src/engine/routes/staticSpecies.test.ts src/engine/maps/plan.test.ts src/scenes/rooms/staticSpecies.test.ts src/scenes/rooms/registry.test.ts src/ui/notice.test.ts src/i18n/index.test.ts` is green, and the full `npm test` is green.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
    `git diff --name-only main...task-96` lists only paths from the exclusive list.
  - [ ] `[unit]` The save format did not move: `git diff main...task-96 -- src/engine/save.ts src/engine/save.test.ts src/engine/run/state.ts` prints nothing, `grep -n 'SAVE_VERSION = ' src/engine/save.ts` still reads `21`, and `npx vitest run src/engine/save.test.ts` is green.
  - [ ] `[unit]` The wild pool did not widen: `git diff main...task-96 -- src/engine/run/pool.ts` prints nothing, `npx vitest run src/engine/run/pool.test.ts` is green, and the new data test asserts every `LEGENDARY_SPECIES` id is absent from `speciesPool(band, 'wild')` for every band.
  - [ ] `[unit]` No shipped floor moved: `git diff main...task-96 -- src/engine/maps/plan.test.ts` changes only (a) the shipped-kind filters that now list `'static'`, (b) `SHIPPED_FLOORS` entries whose floor now hangs a `static` leaf, and (c) added `static` tests; the pinned tables `SHIPPED_SPECIALS` (its per-key values), `PLAN_PINS`, `TRADE_LEAVES` and `NO_HEAL_LEAVES` are byte-identical to `main`. Check with `git diff main...task-96 -- src/engine/maps/plan.test.ts`.
  - [ ] `[unit]` The capture and permadeath rules are untouched: `git diff main...task-96 -- src/engine/battle/capture.ts src/engine/run/resolve.ts src/engine/run/perms.ts src/ui/permadeath.ts` prints nothing and `npx vitest run src/engine/battle/capture.test.ts src/engine/run/resolve.test.ts` is green.
  - [ ] `[unit]` The curve walk is recorded, not invented: `npx vitest run src/engine/run/curve.test.ts` is green with `MEASURED_FILL` pinned to the walk this plan change produces, every floor's fill is inside `1.05 – 1.5`, `src/data/run.ts` and `src/data/maps.ts` are **byte-identical** to `main` (`git diff main...task-96 -- src/data/run.ts src/data/maps.ts` prints nothing), and `docs/balance/route-curve.md`'s new `Re-walked again (Task-96).` paragraph names those same eight fills verbatim while the band table, the analytic table and the eight factors are unchanged.
  - [ ] `[live]` **The leaf, its seal and its prize exist in the running game.** With `npm run dev` and a live run (start any run from the menu, so `game.scene.getScene('Route')` is not null), run this in the page:

    ```js
    const { planMap } = await import('/src/engine/maps/plan.ts');
    const { routeIndexForRoom } = await import('/src/engine/run/floors.ts');
    const { gateKindFor } = await import('/src/engine/routes/gate.ts');
    let pick = null;
    for (let i = 0; i < 500 && pick === null; i++) {
      const seed = `static-96-${i}`;
      const plan = planMap(seed, 4);
      const room = plan.rooms.find((r) => r.special === 'static');
      if (!room) continue;
      const kind = gateKindFor(seed, routeIndexForRoom(plan, room.id));
      if (kind === 'water') continue; // the pond is the ability gate; the live pass uses a type seal
      pick = { seed, floor: 4, roomId: room.id, kind };
    }
    const scene = game.scene.getScene('Route');
    scene.run = { ...scene.run, seed: pick.seed };
    scene.commitRun(scene.run);
    scene.teleportToFloor(pick.floor);
    scene.teleportToRoom(pick.roomId);
    const { GATES } = await import('/src/data/gates.ts');
    const gate = scene.route.gate;
    return {
      pick,
      special: scene.room.special,
      sealKind: gate.kind,
      sealedValue: scene.map[gate.tile.y][gate.tile.x],
      expectedSealed: GATES[gate.kind].tile,
      counter: scene.shopCounter,
      pocket: gate.pocket,
    };
    ```

    Passes when `special === 'static'`, `sealKind === pick.kind`, `sealedValue ===
    expectedSealed`, and `counter` deep-equals `pocket` (the species blocks its tile).
  - [ ] `[live]` **The party property opens the seal, and only it.** In the same room, with
    `seal = scene.route.gate.tile`, `pocket = scene.route.gate.pocket`, `mouth` the first
    walkable neighbour of `seal` that is not `pocket`
    (`[[0,-1],[1,0],[0,1],[-1,0]]` over `isWalkable(scene.moveMap, tile)`), and
    `face(from, to)` returning `'right'`/`'left'`/`'down'`/`'up'`: teleport to `mouth`
    with `scene.teleportToTile(mouth.x, mouth.y)`, set `scene.facingDir = face(mouth, seal)`,
    then call `scene.tryInteract()` (the interact key's own path). Measurements:
    (a) if `partyHasType(scene.run, STATIC_GATES[sealKind].values)` was **false** before the
    call, `scene.run.pickedItems` must not contain `static-<floor>-<roomId>` and
    `isWalkable(scene.moveMap, seal)` must still be `false`; (b) after
    `scene.addDebugPokemon(sealKind === 'bush' ? 'bulbasaur' : 'geodude', 5)` and a second
    `tryInteract()` from the same tile, `scene.run.pickedItems` contains
    `static-<pick.floor>-<pick.roomId>` and `isWalkable(scene.moveMap, seal)` is `true`.
    Report which branch (a) took.
  - [ ] `[live]` **The static battle fields the data species at the squad's level.** Then
    `scene.teleportToTile(seal.x, seal.y)`, `scene.facingDir = face(seal, pocket)`,
    `scene.tryInteract()`, wait `400 ms`, and read
    `scene.pendingBattle.trigger`, `game.scene.getScene('Battle').enemyFighters[0]` and
    `scene.run.capturedRooms`. Passes when the trigger is `kind: 'wild'`, the foe's
    `speciesId` equals `staticRoomContent(scene.run, pick.floor, pick.roomId,
    scene.route.gate.kind).speciesId`, the foe's `level` equals
    `squadLevel(scene.run)` (`/src/engine/run/state.ts`), `foe.moves.length >= 1`,
    `foe.ability !== ''`, the species is a member of `STATIC_SPECIES`, and
    `scene.run.capturedRooms` contains `pick.roomId` (the room's capture is spent).
  - [ ] `[live]` **The legendary variant follows the run's own recorded facts.** On a
    fresh page, set `scene.run = { ...scene.run, missionsCompleted: 1 }` and
    `scene.commitRun(scene.run)` (the floor's `mission.id` is `flawless` by
    construction), then scan with
    `staticRoomContent(scene.run, floor, roomId, 'bush')` for a `(seed, floor >= 4,
    roomId)` whose floor hangs a `static` leaf **and** returns `variant: 'legendary'`
    (same 500-seed loop, floors 3-8); teleport there as above, open the seal with a
    matching party, start the species' battle and read the foe's `speciesId`. Passes when
    that id is a member of `LEGENDARY_SPECIES` and not of `STATIC_SPECIES` — and, on the
    control run with `missionsCompleted: 0`, a leaf on the same floor fields an id from
    `STATIC_SPECIES`.
  - [ ] `agent-review` **Visual residue (not a gate):** the minimap glyph reads as a
    distinct gold ring beside the gated leaf's brown stem, the species' drawn silhouette
    sits on its vault tile and disappears once it is fought, and the legendary line reads
    as a hint rather than a spoiler. Recorded as a note by QA, never a failing criterion.

## 📣 Coordination

- **For the Orchestrator:** the batch record's `src/ui/mapView.ts` is **not** touched —
  `MapRoomMarker` is aliased to `MapRoomSpecial` (`src/ui/mapView.ts` line 26), so the
  new plan value reaches the minimap by type. The task's real hot files are
  `src/engine/maps/plan.ts` and `src/scenes/RouteScene.ts`; no other task in Batch 43.
- **For the Architect (what changed in the plan):** the leaf's draws are minted, not
  taken from the `map` stream, so the special pass can grow again without moving a
  shipped floor's trainer roles. A later room task appends its own
  `${seed}:map:${index}:<name>` stream after `static` and nothing else. No
  `SAVE_VERSION` step: the chain stays `14 → 15 → 16 → 17 → 18 → 19 → 20 → 21`, with
  `[Task-101]` taking `21 → 22` and nothing in this task writing the version.
- **For the next batch (`[Task-97]`, the secret shop):** reuse
  `carveGatedVault` + `RouteRequest.gate` + a `pickedItems` seal record exactly like
  this room (`staticGateId` is the naming template), keep its gate row in its **own**
  data file (`src/data/secretShop.ts`) rather than extending `STATIC_GATES`, and
  append its plan roll after `static` with its own minted stream. `plan.ts`,
  `src/scenes/rooms/types.ts`, `src/scenes/RouteScene.ts` and (if it adds an engine
  module) `src/engine/routes/index.ts` are its collisions with this task; this task
  leaves them compiling with the optional `startWildBattle` hook, which the shop does
  not need.
- **For `[Task-100]`/`[Task-102]`/`[Task-108]`/`[Task-109]`/`[Task-110]`:** the registry
  test's `SHIPPED_KINDS` and `plan.test.ts`'s two shipped-kind filters are the only
  lists a new special kind must extend; both live in this task's wake.
- **Frozen names other tasks may rely on:** `MapRoomSpecial` gains exactly `'static'`;
  `staticRoomContent(run, mapIndex, roomId, obstacle)` is the one content resolver;
  `staticGateId`/`staticSpeciesId` own the two records; `RoomHost.startWildBattle` is
  the one way a room starts a wild battle.

## ⛔ Out of scope

- The catch's rules: no change to `capture.ts`, `canCapture`/`useCapture`, the
  first-catch guarantee, the capture screen or `caughtSpecies` — the room rides the
  shipped wild path and inherits them.
- `WILD_BANNED_TAGS` and `speciesPool`: the legendary is a data list, the ordinary wild
  pool is **not** widened, and `[Task-52]`'s exclusion rule is untouched.
- The obstacle art `[Task-65]` ships (`GATES`' tiles and frames): the pond's seal is the
  shipped water tile, no new sprite, atlas cell or packed sheet.
- `[Task-97]`'s secret shop, `[Task-100]`'s boss-room rules and `[Task-102]`'s puzzles.
- The boss room, the portal and the mini-boss reward.
- A distinct minimap glyph or a louder reveal for the legendary variant; a special
  battle theme, cry or cut-in; a level bump for the legendary.
- Any new `RunState` field, any `SAVE_VERSION` step, any migration, any new dependency,
  any `Math.random()`/`Date.now()`, any Phaser import under `src/engine/`.
- Rebalancing the shipped rooms' chances (`GATED_CHANCE`, `TRADE_CHANCE`,
  `NO_HEAL_ROOM.chance`, …).
