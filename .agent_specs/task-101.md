# Spec: Task-101 — The room that bans the squad's most-used species

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + Phaser scene (the special-room layer) + docs.
- **Role:** Dev.
- **Objective:** the run learns **which member has fought most** — a per-member
  `battlesUsed` counter the post-battle fold bumps for every member that actually
  took the field — and a new **special room** (`'banned'`) whose every battle bars
  the **species** of the party's most-used member from being sent out: the battle
  starts on the first living unbarred member, a switch or forced replacement of that
  species is refused with `That Pokémon is barred in this room.`, and the rule ends
  with the battle. The run's party, box and RIP are never touched, and nothing about
  the ban survives the room. The step takes the run's next `SAVE_VERSION`, **21 → 22**.
- **Environment:** worktree `../wt-pkm-101`, branch `task-101`.
- **Dependencies:** **none** — the fold (`src/engine/run/resolve.ts`), the launch
  (`src/engine/run/battleLink.ts`), the special-room layer
  (`src/scenes/rooms/types.ts` + `registry.ts`) and the plan's special pass
  (`src/engine/maps/plan.ts`) are all shipped on this commit.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
Deleting a stray `.gitkeep` from a directory this task populates is always allowed.

- `src/engine/run/progression.ts` — `RunPokemon.battlesUsed?`
- `src/engine/run/resolve.ts` — the fold's bump
- `src/engine/run/resolve.test.ts`
- `src/engine/run/battleLink.ts` — `BattleLaunch.bannedSpecies`, `BattleReturn.used`
- `src/engine/run/curve.test.ts` — **re-pin only** (see *Re-pin protocol*)
- `src/engine/save.ts` — `SAVE_VERSION` 21 → 22, migration `21`, `parsePokemon`
- `src/engine/save.test.ts`
- `src/engine/battle/state.ts` — `BattleSetup.bannedSpecies`, `BattleState.bannedSpecies`
  and `.usedFighterIds`, lead selection, the rule's feed line
- `src/engine/battle/commands.ts` — `switchablePartyIndices`, the `validateSwitch` clause
- `src/engine/battle/turn.ts` — `performSwitch` records the send-out
- `src/engine/battle/banned.test.ts` *(new)*
- `src/engine/maps/plan.ts` — the `'banned'` kind and its own minted draw
- `src/engine/maps/plan.test.ts`
- `src/engine/maps/progress.ts` — `bannedTrainerId`
- `src/engine/maps/progress.test.ts`
- `src/engine/routes/bannedRoom.ts` *(new)*
- `src/engine/routes/bannedRoom.test.ts` *(new)*
- `src/engine/routes/index.ts` — the barrel line
- `src/engine/routes/battlefield.test.ts` — **re-pin only** (`BOSS_PINS`, see below)
- `src/data/bannedRoom.ts` *(new)*
- `src/data/bannedRoom.test.ts` *(new)*
- `src/data/run.ts` — **only** if a floor leaves the curve window (see *Re-pin protocol*)
- `src/scenes/rooms/banned.ts` *(new)*
- `src/scenes/rooms/banned.test.ts` *(new)*
- `src/scenes/rooms/registry.test.ts` — `SHIPPED_KINDS` gains `'banned'`
- `src/scenes/RouteScene.ts` — one property on the launch in `startBattle`
- `src/scenes/BattleScene.ts` — the setup, the party rows, the returned `used`
- `src/ui/notice.ts` + `src/ui/notice.test.ts` — `bannedRoomNotice`
- `src/i18n/en.ts` + `src/i18n/es.ts` — `notice.bannedRoom`
- `src/scenes/rooms/README.md`, `src/engine/README.md`, `src/data/README.md`
- `docs/battle-spec.md` §2 — one new paragraph
- `docs/maps-spec.md` §7 — **one table row and one new `###` subsection only**
- `docs/balance/route-curve.md` — the re-walk paragraph, if a pin moved

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/agent-spec-template.md`, `docs/design-spec.md` §7,
  `docs/maps-spec.md` §1/§6/§7/§9, `docs/battle-spec.md` §2/§7/§12,
  `docs/data-spec.md`, `docs/balance/route-curve.md`, `TODO.md`'s `[Task-101]` entry
- `src/engine/battle/fighter.ts`, `src/engine/battle/turn.ts`,
  `src/engine/battle/ai.ts`, `src/engine/battle/runAway.ts`
- `src/engine/maps/plan.ts`, `src/engine/maps/progress.ts`
- `src/engine/routes/bossRoom.ts` + test, `src/engine/routes/battlefield.ts`,
  `src/engine/routes/index.ts`
- `src/engine/run/state.ts`, `src/engine/run/progression.ts`,
  `src/engine/run/resolve.ts`, `src/engine/run/battleLink.ts`,
  `src/engine/run/heal.ts`, `src/engine/run/floors.ts`
- `src/data/noHeal.ts` (the room that is this one's template),
  `src/data/staticSpecies.ts`, `src/data/trainers.ts`, `src/data/battlefields.ts`
- `src/scenes/rooms/types.ts`, `src/scenes/rooms/registry.ts`,
  `src/scenes/rooms/noHeal.ts` + test, `src/scenes/rooms/miniBoss.ts`
- `src/scenes/RouteScene.ts`, `src/scenes/BattleScene.ts`
- `src/ui/notice.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/index.ts`

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion.

### TypeScript

```ts
// src/engine/run/progression.ts
export type RunPokemon = Readonly<{
  fighter: FighterSnapshot;
  caughtAt?: CatchLocation;
  taughtMoves?: readonly string[];
  secondAbility?: string | null;
  /**
   * How many resolved battles this member took the field in (Task-101): the
   * run's per-member usage counter. Absent means 0, which is what every save
   * written before Task-101 and every member that has never been sent out
   * carries.
   */
  battlesUsed?: number;
}>;
```

```ts
// src/engine/battle/state.ts
export type BattleState = {
  // … every shipped field unchanged …
  /** The species the room bars the player from sending out, or null (Task-101). */
  bannedSpecies: string | null;
  /**
   * The player's fighter ids that took the field this battle, in the order they
   * appeared and deduped: the live slots at battle start, then every switch-in.
   * The post-battle fold reads it (Task-101); it draws no RNG.
   */
  usedFighterIds: string[];
};

export type BattleSetup = Readonly<{
  // … every shipped field unchanged …
  /** The room bars this species from being sent out. Default `null`. */
  bannedSpecies?: string | null;
}>;
```

```ts
// src/engine/battle/commands.ts
/**
 * The party indices the side may send out right now: not an active slot, a live
 * fighter, and — for the player in a room that bars a species — not that
 * species. When the barred species is the **only** living off-field member the
 * ban bends and it is listed, because a battle must always have a legal
 * send-out. The enemy side is never filtered.
 */
export function switchablePartyIndices(state: BattleState, side: SideId): readonly number[];
```

```ts
// src/engine/run/battleLink.ts
export type BattleLaunch = Readonly<{
  // … every shipped field unchanged …
  /** The run's most-used species the room bars, or null/absent (Task-101). */
  bannedSpecies?: string | null;
}>;

export type BattleReturn = Readonly<{
  // … every shipped field unchanged …
  /**
   * The ids the battle fielded for the player (`BattleState.usedFighterIds`).
   * Absent means the battle did not report them and the fold counts every
   * member the returned party carries.
   */
  used?: readonly string[];
}>;
```

```ts
// src/engine/routes/bannedRoom.ts
import type { RunState } from '../run/state';

/**
 * The species the banned room bars: the species of the **party** member with the
 * highest `battlesUsed`, ties broken by party order (lowest index wins). The box
 * is never read — only a party member can be sent out, so a boxed veteran must
 * not name the ban. Null only when the party is empty, which `RunState` never
 * allows.
 */
export function bannedSpeciesOf(run: RunState): string | null;
```

```ts
// src/engine/maps/progress.ts
/** The banned room's stable trainer id, distinct from a regular one. */
export function bannedTrainerId(mapIndex: number): string; // `banned-<mapIndex>`
```

```ts
// src/ui/notice.ts
/** The banned room's own notice: `name` is the barred species' display name. */
export function bannedRoomNotice(name: string): Notice; // t('notice.bannedRoom', { name })
```

- **Ordering inside `createBattle`.** Before the state literal is built, resolve
  `bannedSpecies = setup.bannedSpecies ?? null` and the player's two active indices;
  the literal then carries every shipped field unchanged plus that `bannedSpecies`
  and `usedFighterIds: []`. The indices:
  - with `bannedSpecies === null`, the shipped `activeIndex: 0` /
    `secondActiveIndex: double && party.length > 1 ? 1 : -1` stand **exactly** as
    today;
  - with a ban, build the order `[...legal, ...rest]` where `legal` holds every index
    whose `hp > 0` and whose `speciesId !== bannedSpecies` (ascending) and `rest`
    every remaining index (ascending), then `activeIndex = order[0] ?? 0` and
    `secondActiveIndex = double && order.length > 1 ? order[1] : (double && party.length > 1 ? 1 : -1)`.

  After the literal, in this order:
  1. `setup.enemyBoosts` applies, as today;
  2. the shipped `noHeal` line is pushed when `state.noHeal`;
  3. **then** the ban's line is pushed when `state.bannedSpecies !== null`:
     `` `${getSpecies(state.bannedSpecies)?.name ?? state.bannedSpecies} is barred in this room!` ``;
  4. every live player slot's `activeFighter(...).id` is pushed into
     `usedFighterIds` (slot order, deduped) **before** the `runStart`/`runSwitchIn`
     hooks run.
- **`performSwitch`** (`src/engine/battle/turn.ts`) appends the incoming fighter's
  id to `state.usedFighterIds` when `side === 'player'` and it is not already there,
  right after `const incoming = activeFighter(state, side, slot);`. Nothing else in
  `turn.ts` changes.
- **`validateSwitch`** keeps its four shipped clauses in order and gains one last
  clause: when `side === 'player'`, `state.bannedSpecies !== null`, the named party
  member's `speciesId === state.bannedSpecies` and
  `switchablePartyIndices(state, side)` does **not** contain `command.partyIndex`,
  it returns `'That Pokémon is barred in this room.'`. The enemy side and every
  other refusal message are untouched.
- **`resolveBattle`** bumps usage immediately after
  `next = { ...next, bag: [...result.bag] };` and **before** `releaseFainted`, over
  `run.party` only (never the box):
  - ids = `result.used` when present, else every `next.party` member's id
    (the safe degradation: a hand-built `BattleReturn` counts the party it
    returned);
  - every member whose id is in the set comes back as
    `{ ...member, battlesUsed: (member.battlesUsed ?? 0) + 1 }`; every other member
    is returned **as the same object**.
  Every resolved battle counts, whatever the outcome (win, loss, capture, run
  away): the member was on the field.
- **`bannedSpeciesOf`** reads `run.party` only; `battlesUsed ?? 0`; the first
  member with the maximum (so ties resolve to the lowest party index); returns its
  `fighter.speciesId` unchanged (already canonical).
- **Scene wiring.** `RouteScene.startBattle` adds one property to the launch:
  `bannedSpecies: this.room?.special === 'banned' ? bannedSpeciesOf(this.run) : null`
  (placed next to the shipped `noHeal` property). `BattleScene.create` passes
  `bannedSpecies: launch.bannedSpecies ?? null` to `createBattle`;
  `BattleScene.returnToRoute` adds `used: [...this.state.usedFighterIds]` to the
  `BattleReturn`; `BattleScene.hasBench()` becomes
  `switchablePartyIndices(this.state, 'player').length > 0`; and
  `BattleScene.openParty`'s row `enabled` becomes
  `switchablePartyIndices(this.state, 'player').includes(index)` in place of
  `index !== side.activeIndex && fighter.hp > 0`. Nothing else in either scene
  changes: an unrecognised command must never reach `takeTurn`, which **throws**.
- **Determinism (D11).** The rule draws **no RNG at all** — the ban is a data read
  over the run's own counters, the gate rejects before any roll, and no battle
  stream, encounter, roster or loot draw moves. The plan's one new draw is on its
  **own minted stream** (`${seed}:map:<floor>:banned-room`), appended last, so every
  shipped fixed seed's plan keeps its rooms, ids, sizes, roles, links and specials.
  The two changes that do move a fixed seed are mechanical and listed in
  *Re-pin protocol*.
- Rules: no Phaser import in `src/engine/`, no DOM, no allocation in a hot path
  (the per-turn code reads no new structure; `usedFighterIds` grows once per
  switch-in, never per frame).

### Data

- `RunPokemon.battlesUsed?: number` — non-negative integer, absent = 0. Written by
  the fold, persisted by `parsePokemon` **only when greater than 0**, so a save
  round trip stays byte-stable.
- `SAVE_VERSION` becomes **22**; `SAVE_MIGRATIONS[21]` is
  `(document) => ({ ...document, version: 22 })` — the counter is optional and the
  decoder defaults it, so the step writes no field (the `14` and `19` precedent).
  The migration-path doc comment gains its `21` sentence.
- `BattleState.bannedSpecies: string | null` — default `null`.
- `BattleState.usedFighterIds: string[]` — default `[]`.
- `MapRoomSpecial` gains `'banned'`: **the ninth special kind**, the room this spec
  documents in `docs/maps-spec.md` §7.

## 🧩 Data and configuration

`src/data/bannedRoom.ts` (new, pure, no imports):

```ts
export type BannedRoomConfig = Readonly<{
  /** The first map whose floor may hang the leaf. */
  fromMap: number;
  /** Chance the floor hangs it, drawn on the leaf's own minted stream. */
  chance: number;
  /** The room trainer's archetype id (`src/data/trainers.ts`). */
  archetypeId: string;
}>;

export const BANNED_ROOM: BannedRoomConfig = {
  fromMap: 3,
  chance: 0.2,
  archetypeId: 'blackbelt',
};
```

- `fromMap: 3` matches every other from-map-3 leaf (mega-stone, gated, trade,
  no-heal, static, secret-shop): by map 3 a party has fought enough battles for
  `battlesUsed` to name somebody.
- `chance: 0.2` is the same magnitude as the no-heal, gated, trade and secret-shop
  leaves, and keeps the floor's trainer budget green (`docs/balance/route-curve.md`).
- `archetypeId: 'blackbelt'` is an **ordinary** `TRAINER_ARCHETYPES` row, not a
  `SPECIAL_ARCHETYPES` set piece, and carries no Mega: the room already takes the
  player's best member away, so its trainer must not also spike the fight.
- The plan draws it **last of all**, on `new Rng(hashSeed(`${seed}:map:${index}:banned-room`))`,
  with the shipped two-int size draw taken from that same stream
  (`addSpecial('banned', parent, bannedRng)`), exactly as the static and
  secret-shop leaves do. Nothing before it may move.
- i18n key: `'notice.bannedRoom'` — en `'This room bars {name}!'`,
  es `'¡Esta sala bloquea a {name}!'`. One `{name}` token, declared by both tables
  (`src/i18n/index.test.ts` compares them).
- Engine literals (**not** keys — the battle log becomes data in a later task, per
  `D43`'s recorded cut): the feed line
  `` `${speciesName} is barred in this room!` `` and the refusal
  `'That Pokémon is barred in this room.'`.

**Folder READMEs** (one role line per file, no exported names): `src/data/README.md`
gains its `bannedRoom.ts` bullet right after the `noHeal.ts` one;
`src/scenes/rooms/README.md` gains `banned.ts` and `banned.test.ts` right after the
`noHeal.ts` / `noHeal.test.ts` pair; `src/engine/README.md`'s `routes/` bullet gains
the `routes/bannedRoom.ts` clause after the `routes/bossRoom.ts` one.

`src/scenes/rooms/banned.ts` (new): `kind: 'banned'`, `marker: 'banned'`, and a
fixture that mirrors `src/scenes/rooms/noHeal.ts` line for line:
`bannedRoomNotice(getSpecies(banned)?.name ?? banned)` as the `notice`; nothing else
when `isTrainerDefeated(host.run, bannedTrainerId(host.view.mapIndex))` or when
`host.farthestRoomTile()` is null; otherwise one `RouteTrainer`
`{ id: bannedTrainerId(view.mapIndex), position, facing: host.facingFromTo(position, host.entryTile()), sight: DEFAULT_TRAINER_SIGHT, archetypeId: BANNED_ROOM.archetypeId }`.
`drawMarker` paints the glyph that is not the no-heal room's: a red disc
(`fillStyle(0xef4444, 1)`, `fillCircle(cx, cy, radius * 0.8)`) crossed in
`0x10161f` by a horizontal bar (`fillRect(cx - radius * 0.75, cy - radius * 0.18, radius * 1.5, radius * 0.36)`)
**and** a vertical one (`fillRect(cx - radius * 0.18, cy - radius * 0.75, radius * 0.36, radius * 1.5)`).

### Re-pin protocol (the moves a new leaf causes, and nothing else)

A floor that hangs the leaf holds **one room more**, and `routeIndexForRoom`
(`src/engine/run/floors.ts`) sums the previous floors' room counts, so every floor
**after** the first one that hangs a leaf builds its rooms from a shifted route
index. This is the exact move `Task-96` and `Task-97` recorded. Handle it by these
three rules and no others:

1. `src/engine/run/curve.test.ts` — re-measure the eight rows of `MEASURED_FILL`
   and record them in the header comment as a **fourth** re-pin paragraph ("Re-walked
   by Task-101 with the banned room"), naming the column. If a floor's fill leaves
   the `MIN_FILL = 1.05` – `1.5` window, re-solve **that floor only** with
   `factor' = round2(factor × 1.25 / fill)`, write it in `src/data/run.ts`'s
   `TRAINER_XP_PER_MAP` and record the recipe in `docs/balance/route-curve.md` as
   Task-97 did. Never move a factor that still sits inside the window.
2. `src/engine/routes/battlefield.test.ts` — `BOSS_PINS` is read through
   `routeIndexForRoom`, so a boss opening on **map 4 or later** may change. Re-pin
   the moved rows and add one sentence to the pin's comment naming the cause.
3. Any **other** fixed-seed expectation that moves must be derived from
   `routeIndexForRoom`/`floorForRoute` on a floor of **map 4 or later**. If one is
   not, it is a defect: stop and report it in the commit message instead of
   re-pinning. Every re-pinned literal carries a comment with its pre-change value.

No `plan.test.ts` pin of a room **id** may move: the leaf appends after everything
that exists and draws on its own stream. If one moves, the draw is in the wrong
place.

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; must be green, including the tests this task adds.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-101` audited against the exclusive paths list.
- Browser pass **is** required (three `[live]` criteria below).

### Acceptance criteria

- [ ] `[unit]` It typechecks and builds clean: `npm run build`.
- [ ] `[unit]` The whole suite is green: `npm test`.
- [ ] `[unit]` Nothing outside the exclusive paths was touched:
  `git diff --name-only main...task-101`.
- [ ] `[unit]` The four new test files exist and pass:
  `npx vitest run src/engine/battle/banned.test.ts src/engine/routes/bannedRoom.test.ts src/data/bannedRoom.test.ts src/scenes/rooms/banned.test.ts`.
- [ ] `[unit]` The version step is exactly 21 → 22: `grep -n "SAVE_VERSION = " src/engine/save.ts`
  reads 22, and `npx vitest run src/engine/save.test.ts` passes with
  `SAVE_MIGRATIONS`' keys ending at `'21'`; a v21 document decodes with
  `decoded.version === 22` and a member that carries no `battlesUsed`.
- [ ] `[unit]` A `battlesUsed: 3` member survives `encodeSave`/`decodeSave`
  byte-stably, and a member with none re-encodes without the field
  (`npx vitest run src/engine/save.test.ts`).
- [ ] `[unit]` The fold counts only the members that took the field:
  `npx vitest run src/engine/run/resolve.test.ts` — a `used: ['a']` battle leaves
  `b`'s counter untouched, an absent `used` counts every returned party member, the
  box is never counted, and a member object that is not counted keeps its identity.
- [ ] `[unit]` The ban names the most-used **party** species:
  `npx vitest run src/engine/routes/bannedRoom.test.ts` covers the highest counter,
  the tie (lowest index), a boxed 99-count member that must not win, an absent
  counter as 0, and a one-member party.
- [ ] `[unit]` The battle rule is exactly as frozen:
  `npx vitest run src/engine/battle/banned.test.ts` covers (a) a banned lead
  replaced by the first living unbarred member, (b) no change when
  `bannedSpecies` is null, (c) the feed line's text and its place after the no-heal
  line, (d) `usedFighterIds` holding the lead and then the switch-in,
  (e) `switchablePartyIndices` omitting the barred member, (f)
  `validateCommand(..., { type: 'switch', partyIndex: <barred> })` returning
  `'That Pokémon is barred in this room.'`, (g) the barred member being switchable
  when it is the only living off-field member, and (h) the enemy side unfiltered.
- [ ] `[unit]` The plan hangs the leaf by the frozen rules:
  `npx vitest run src/engine/maps/plan.test.ts` — never on maps 1–2, at most one per
  floor, `dead-end`, `wild`, not the entry, not the boss, never farther than the
  boss, listed in `plan.specials`; a new `BAN_LEAVES` pin (8 seeds × maps 1–8)
  records the room ids; **every pre-existing pin (`STATIC_LEAVES`,
  `SECRET_SHOP_LEAVES`, `TRADE_LEAVES`, the boss/portal and trainer-role pins) is
  unchanged**.
- [ ] `[unit]` `bannedTrainerId(3)` is `'banned-3'`, stable, and distinct from
  `bossTrainerId`, `miniBossTrainerId` and `noHealTrainerId`:
  `npx vitest run src/engine/maps/progress.test.ts`.
- [ ] `[unit]` The data row is the frozen one and its archetype resolves:
  `npx vitest run src/data/bannedRoom.test.ts` asserts `BANNED_ROOM` equals
  `{ fromMap: 3, chance: 0.2, archetypeId: 'blackbelt' }` and that
  `getTrainerArchetype('blackbelt')` is defined and carries no `carriesMega`.
- [ ] `[unit]` The descriptor places its `blackbelt` trainer on the farthest tile
  with the stable id, stays beaten on a revisit, offers no trainer when the room has
  no free tile, and draws the crossed marker:
  `npx vitest run src/scenes/rooms/banned.test.ts`.
- [ ] `[unit]` The registry collects the new kind:
  `npx vitest run src/scenes/rooms/registry.test.ts` (its `SHIPPED_KINDS` list now
  contains `'banned'` and every kind resolves a descriptor).
- [ ] `[unit]` The notice reads the key and passes the name through:
  `npx vitest run src/ui/notice.test.ts src/i18n/index.test.ts` (the two tables carry
  `notice.bannedRoom` with exactly one `{name}` token; no em dash in the Spanish).
- [ ] `[unit]` The curve is re-walked and recorded: `npx vitest run src/engine/run/curve.test.ts`
  passes with the new `MEASURED_FILL` column; every floor sits inside
  `1.05 – 1.5`; `docs/balance/route-curve.md` carries the new paragraph and, if a
  factor moved, names it and the recipe.
- [ ] `[unit]` The boss pins are re-recorded if they moved:
  `npx vitest run src/engine/routes/battlefield.test.ts` — and the diff of that file
  touches **only** `BOSS_PINS` rows whose map is 4 or later.
- [ ] `[live]` Entering the room floats its notice **and** paints its marker.
  Measurement: start a dev run (`npm run dev`) with the seed of the first non-`-`
  cell of the new `BAN_LEAVES` pin, open the debug menu (`F`), set that cell's floor
  and room id, press Go; the notice strip at the top of the screen shows
  `This room bars <species name>!` (or the Spanish line with the language set to
  `es`) and holds it for **2600 ms**; the minimap cell of the room draws the red
  crossed disc rather than the purple bar.
- [ ] `[live]` The room's trainer battle opens without the barred species and says
  why. Measurement: in that same room, walk into the trainer's line of sight; the
  battle feed's first lines show `<species> is barred in this room!`, the leading
  Pokémon is **not** that species (unless the party's only living member is), and
  opening the party window lists the barred member's row as **not selectable** (the
  cursor skips it — `n` rows selectable out of `n+1`).
- [ ] `[live]` The ban ends with the battle and never touches the run.
  Measurement: finish or flee that battle and open the party panel; the barred
  member is still in the party at exactly the HP/PP it had when the battle started
  (it is never sent out), and in the next battle it may be sent out normally — the
  party window's cursor reaches it again. Nothing about the ban is written to the
  run: reload the page on the same run (DevTools → Application → localStorage) and
  the saved run entry carries no barred-member field, while the next battle stays
  legal. The notice is a **room-entry cue**, not ban state: exactly like the no-heal
  room's notice it floats every time the room is built, so a revisit floats it
  again — that repetition is expected and is never evidence of a persisted ban.

## 📣 Coordination

- **For the Architect:** `[Task-101]`'s one-line batch record (`RouteScene.ts`,
  `save.ts`, `commands.ts`) is narrower than this task's real union — the rule needs
  `state.ts`, `turn.ts`, `battleLink.ts`, `BattleScene.ts`, the plan and its own
  room layer — the way Batches 41, 42 and 43's records predated theirs. Batch 46
  still has exactly one task and every extra path is free in it. The `SAVE_VERSION`
  chain is now **21 → 22 (101) → 23 (103)**.
- **For `[Task-103]` (Batch 47):** `SAVE_VERSION` reads **22** after this task; its
  step is **22 → 23**, and `SAVE_MIGRATIONS`' keys run to `'21'`.
- **For `[Task-114]` (Batch 53):** the two new battle lines (the feed's
  `<species> is barred in this room!` and the refusal
  `That Pokémon is barred in this room.`) are engine **literals**, like every other
  log line, and are part of what its key sweep has to convert.
  `validateCommand`'s return value is a string the scene prints; do not move it.
- **For `[Task-117]` (Batch 56):** this task writes **its own** `docs/maps-spec.md`
  §7 table row (after `secret-shop`) and **its own** `### The banned-species room`
  subsection (between `### The no-heal room` and `### The casino (the slot
  machine)`). The rates paragraph, the table's casino row, the NPC table and the
  casino subsection stay 117's; 117 must keep this row and this subsection.
- **For the next batch:** `RunPokemon.battlesUsed` and
  `BattleState.usedFighterIds` exist and are the only usage facts a room may read.
  Any later room that wants "who fought most" reads `bannedSpeciesOf`-style code,
  never a second counter.
- **For QA:** `openParty`'s row `enabled` is now the shared
  `switchablePartyIndices`, so in a **double** battle a row for the second active is
  drawn disabled (it already refused with `'That Pokémon is already out.'`). That is
  the one behaviour alignment this task makes outside the ban; audit it, do not
  revert it.

## ⛔ Out of scope

- The roster, the wild table, the party/PC panel and anything the panel shows: the
  counter is engine state, never a UI row (the entry's own out-of-scope line).
- Keying the battle log (`src/i18n`, `src/ui/feed.ts`) — `[Task-114]`'s seam.
- A second room condition, a battlefield row or a `src/data/battlefields.ts` change:
  the banned leaf is `quiet` and rolls no condition.
- The boss room, the puzzles, the trade leaf, the casino and the merchant NPC.
- Re-solving the eight per-floor XP factors beyond the floors the re-pin protocol
  forces, and any balance change beyond the recipe written there.
- Any new dependency, any `package.json`/`vite.config.ts`/`src/main.ts` change, and
  any regeneration of `src/data/dex/**`.
