# Spec: Task-93 — The party-edit NPCs: the move tutor, the three re-rolls, the species swap and the sacrifice's second ability

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rules + data + Phaser scene + docs.
- **Role:** Dev.
- **Objective:** Five special NPCs — a **move tutor**, a **nature re-roll**, an
  **ability re-roll**, an **IV re-roll**, a **species swap** — and the **sacrifice**
  that pays one random bag stack for one of four member edits, each exist as one
  pure run transaction behind the shipped NPC card, and the two member facts they
  need (`taughtMoves`, `secondAbility`) persist in the save as schema **19 → 20**.
  After this task a tutored move survives an unequip, a member can carry a second
  ability that the run's ability readers see, and the sacrifice spawns only on a
  floor the run reached after a `flawless` floor was completed.
- **Environment:** worktree `../wt-pkm-93`, branch `task-93`.
- **Dependencies:** merged already, read their shipped code and do not re-implement.
  - `[Task-91]` — `src/engine/routes/npcs.ts` (`roomNpc`, `npcSpot`,
    `npcRequirementMet`, `npcUseId`), `src/data/npcs.ts` (`NpcRow`,
    `NpcRequirement`), `src/ui/npcPanel.ts` (`openNpcPanel`, `npcPanelLayout`,
    `NPC_MAX_CHOICES`), and `RouteScene`'s `rollRoomNpc` / `openNpcCard` /
    `chooseNpc`.
  - `[Task-98]` — `src/engine/run/missions.ts` (`MissionProgress`),
    `src/data/missions.ts` (`MISSION_TABLE`, `getMission`) and
    `RunState.missionsCompleted`, which is the sacrifice's spawn gate.
  - Also shipped and read, never edited here: `src/engine/run/state.ts`
    (`updatePokemon`, `consumeItem`, `isItemPicked`, `markItemPicked`,
    `nextMemberId`), `src/engine/run/party.ts` (`partyHasType`/`partyHasMove`/
    `partyHasAbility`), `src/engine/battle/randomAbility.ts`, `src/data/dex`
    (`getMove`, `getSpecies`, `allNatures`, `MAX_IV`, `STAT_IDS`, `statAtLevel`).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in this batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/engine/run/progression.ts`
- `src/engine/run/progression.test.ts`
- `src/engine/run/learnset.ts`
- `src/engine/run/learnset.test.ts`
- `src/engine/run/memberEdits.ts` *(new)*
- `src/engine/run/memberEdits.test.ts` *(new)*
- `src/engine/run/party.ts`
- `src/engine/run/party.test.ts`
- `src/engine/run/passives.ts`
- `src/engine/run/passives.test.ts`
- `src/engine/routes/npcs.ts`
- `src/engine/routes/npcs.test.ts`
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/README.md`
- `src/data/npcs.ts`
- `src/data/npcs.test.ts`
- `src/data/README.md`
- `src/scenes/RouteScene.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/maps-spec.md` — **§7's `### The special NPC` block only** (the five new
  rows; `[Task-116]` owns the same file's `### The casino (the slot machine)`
  opening paragraph and nothing else here)
- `docs/design-spec.md` — **§3 only**
- `docs/routes-spec.md` — **§6 only**
- `docs/battle-spec.md` — **§7 only**
- `docs/tech-decisions.md` — the new `D48` section only

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/design-spec.md`, `docs/routes-spec.md`, `docs/battle-spec.md`,
  `docs/tech-decisions.md`
  (`D5`, `D11`, `D17`, `D36`, `D43`, `D47`), `docs/data-spec.md`,
  `docs/agent-spec-template.md`.
- `src/engine/run/state.ts`, `src/engine/run/missions.ts`,
  `src/engine/run/items.ts`, `src/engine/run/heal.ts`, `src/engine/run/pool.ts`,
  `src/engine/battle/fighter.ts`, `src/engine/battle/randomAbility.ts`,
  `src/engine/rng.ts`, `src/engine/maps/plan.ts`.
- `src/data/dex/**` (accessors and their types), `src/data/missions.ts`,
  `src/data/run.ts`, `src/data/overworldSprites.ts`.
- `src/ui/npcPanel.ts`, `src/ui/notice.ts`, `src/ui/shop.ts` (the merchant's
  pattern), `src/scenes/rooms/shop.ts` (`openMart`).
- Any `*.test.ts` you must mirror; do not edit one outside the list above.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript — `src/engine/run/progression.ts`

```ts
export type RunPokemon = Readonly<{
  fighter: FighterSnapshot;
  caughtAt?: CatchLocation;
  /** Moves a tutor taught this member; absent means none (an older save). */
  taughtMoves?: readonly string[];
  /** The second ability a sacrifice granted; absent means none. */
  secondAbility?: string | null;
}>;

/** Every ability a run member carries, primary first, deduplicated. */
export function memberAbilities(member: RunPokemon): readonly string[];

export type RunPokemonEdit = Readonly<{
  level?: number;
  nature?: string;
  ability?: string;
  moves?: readonly string[];
  /** Re-rolled IVs; a missing stat keeps the member's own value. */
  ivs?: Partial<Stats>;
}>;
```

- `memberAbilities(m)` is `[m.fighter.ability]`, plus `m.secondAbility` when it is
  a non-empty string **different** from the primary (case-insensitive compare on
  the two names). It never returns duplicates and never an empty array.
- Both new `RunPokemon` fields are **optional and only written when they carry
  something**: never write `taughtMoves: []`, never write `secondAbility: null`
  (same convention as `nickname`/`caughtAt`; it keeps every existing deep-equality
  test and the save round-trip stable).
- `editRunPokemon` applies `edit.ivs` on top of `fighter.ivs` and re-derives only
  the HP clamp, from `statAtLevel(species, level, nature, <the new ivs>, evs).hp`;
  every other field keeps its shipped behaviour.
- `createRunPokemon` and `runPokemonFromSnapshot` gain **no** new argument and set
  no new field.

### TypeScript — `src/engine/run/learnset.ts`

```ts
export type LearnSourceKind = 'level' | 'tutor' | 'tm';

export function learnsetPool(
  run: RunState,
  member: RunPokemon,
  learnsetSeed?: string,
): LearnEntry[];
```

- `learnsetPool` offers `member.taughtMoves ?? []` as `source: 'tutor'` entries
  (`level: null`, `tmId: null`), through the same `push` guard, so a move already
  equipped, a duplicate id, an id `getMove` cannot resolve and an OHKO move under
  `No Guard` are still dropped.
- Draw order stays **level, then tutor, then tm** (`compareEntries`: a level entry
  beats a tutor one, a tutor one beats a tm one; ties inside a source by name).
- `learnsetPool`, `poolEntry`, `equipMove` and `unequipMove` keep their exact
  signatures: a tutored move becomes equippable from the band and survives an
  unequip for free, because it is now in the pool.

### TypeScript — `src/engine/run/memberEdits.ts` (new, pure)

```ts
import type { RunState } from './state';

/** The room's own stream family: Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:<op>`)). */
export type MemberEditContext = Readonly<{ roomIndex: number; npcId: string }>;

/** What one member row of the sacrifice pays (`SACRIFICE_REWARDS`). */
export type SacrificeReward = 'nature' | 'second-ability' | 'ivs' | 'species';

/** The line the result card prints; the scene resolves it to a key. */
export type MemberEditLine =
  | Readonly<{ kind: 'tutor'; moveId: string }>
  | Readonly<{ kind: 'nature'; nature: string }>
  | Readonly<{ kind: 'ability'; ability: string }>
  | Readonly<{ kind: 'secondAbility'; ability: string }>
  | Readonly<{ kind: 'ivs' }>
  | Readonly<{ kind: 'species'; speciesId: string }>
  | Readonly<{ kind: 'sacrifice'; itemId: string; reward: MemberEditLine }>;

export type MemberEditRefusal =
  | 'no-member'
  | 'no-slots'
  | 'no-bag'
  | 'no-species'
  | 'no-ability'
  | 'not-a-tutor-move';

export type MemberEdit =
  | Readonly<{ ok: true; run: RunState; memberId: string; line: MemberEditLine }>
  | Readonly<{ ok: false; run: RunState; reason: MemberEditRefusal }>;

export function teachMove(
  run: RunState,
  memberId: string,
  moveId: string,
  slot: number | null,
): MemberEdit;
export function rerollNature(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit;
export function rerollAbility(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit;
export function grantSecondAbility(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit;
export function rerollIvs(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit;
export function swapSpecies(run: RunState, memberId: string, ctx: MemberEditContext): MemberEdit;
export function sacrifice(run: RunState, ctx: MemberEditContext): MemberEdit;
```

Rules, all of them mandatory:

- **Membership.** Every `memberId` lookup reads `run.party`, then `run.box`, in
  that order, by `fighter.id`; the write goes through `updatePokemon`. An unknown
  id is `{ ok: false, run, reason: 'no-member' }` with the **same run reference**.
- **`teachMove`** accepts only an id `TUTOR_MOVES` holds (`not-a-tutor-move`
  otherwise) and an id `getMove` resolves. It refuses `no-slots` when `slot` is
  `null` and the member already holds `MAX_MOVES` (4) moves. `slot` in
  `0..MAX_MOVES-1` replaces that slot when it exists and appends when it is past
  the last real slot (the `equipMove` rule); a slot outside `0..3` is `no-slots`.
  The move is written with fresh PP (`{ moveId, pp: move.pp, maxPp: move.pp }`) and
  its id is added to `taughtMoves` (deduped, append order). Refuses `no-member` for
  an unknown member; a member that already **equips** the move is a success with no
  slot written and the id still recorded. Line: `{ kind: 'tutor', moveId }`.
- **`rerollNature`** draws `allNatures()[rng.int(0, n - 1)]` on
  `Rng(hashSeed(`${run.seed}:npc:${ctx.roomIndex}:${ctx.npcId}:nature`))` and writes
  it through `editRunPokemon(member, { nature })` (stats are derived, so nothing
  else is touched). Line: `{ kind: 'nature', nature }`.
- **`rerollAbility`** calls
  `randomAbility(speciesId, `${run.seed}:npc:${ctx.roomIndex}:${ctx.npcId}:ability`, exclude)`
  with `exclude = [member.fighter.ability, ...(holdsOhko ? ['No Guard'] : [])]`,
  where `holdsOhko` is true when any equipped slot's move has `ohko === true`
  (the `D17` guard `resolveAbility`/`learnsetPool` already apply). It writes
  `ability.name` through `editRunPokemon`. `undefined` is `no-ability`, and the run
  comes back by reference. Line: `{ kind: 'ability', ability }`.
- **`grantSecondAbility`** calls `randomAbility` on
  `Rng`-stream `…:second-ability` with `exclude = [member.fighter.ability]` (plus
  `'No Guard'` under the same OHKO guard) and writes `secondAbility`. It **never**
  touches `fighter.ability`. `undefined` is `no-ability`. Line:
  `{ kind: 'secondAbility', ability }`.
- **`rerollIvs`** draws one `rng.int(0, MAX_IV)` per stat, in `STAT_IDS` order, on
  `…:ivs`, and writes `{ ivs }` through `editRunPokemon` (the HP clamp comes from
  the edit). Line: `{ kind: 'ivs' }`.
- **`swapSpecies`** draws the target from
  `speciesPool(bandForMap(run.mapIndex), 'wild')` **filtered to ids other than the
  member's current species**, on `…:species`, then writes
  `{ ...member, fighter: { ...fighter, speciesId: target } }` with the HP clamped
  into the new maximum
  (`statAtLevel(getSpecies(target), level, nature, ivs, evs).hp`). Level, moves,
  PP, `ability`, `secondAbility`, `taughtMoves`, IVs, EVs, held item, status and
  nickname are **kept**; types and stats are derived from the new species. An empty
  pool is `no-species`. Line: `{ kind: 'species', speciesId }`.
- **`sacrifice`** mints **one** stream,
  `Rng(hashSeed(`${run.seed}:npc:${ctx.roomIndex}:${ctx.npcId}:sacrifice`))`, and
  takes exactly three draws **in this order**: (1) `run.bag[rng.int(0, bag.length - 1)]`,
  (2) `run.party[rng.int(0, party.length - 1)]`,
  (3) `SACRIFICE_REWARDS[rng.int(0, SACRIFICE_REWARDS.length - 1)]`. An empty bag
  is `no-bag` **before any draw**. The reward then resolves on its own substream —
  `…:sacrifice:nature`, `…:sacrifice:ivs`, `…:sacrifice:species` — and the
  `second-ability` row on `…:sacrifice:second-ability`, with the rules above; a
  reward that cannot resolve (`no-species`, `no-ability`) returns its reason and
  **the bag stack is not consumed**. On success the **whole stack** leaves the bag
  (`consumeItem(next, itemId, count)`) and the line is
  `{ kind: 'sacrifice', itemId, reward }`, whose inner `reward` is never itself a
  `sacrifice`.
- **Determinism (D11).** Every draw above is minted inside the function from
  `run.seed` and the context, on the `:npc:` family `npcSpot` already uses. No map,
  layout, encounter, roster, passive, casino or battle stream moves, the same
  `(seed, mapIndex, roomIndex, npcId)` always yields the same edit, and no function
  reads a clock, `Math.random()`, the DOM or `localStorage`.
- The module imports no Phaser, no scene and no `src/ui/` module.

### TypeScript — `src/engine/routes/npcs.ts`

```ts
export function npcRequirementMet(
  run: RunState,
  requirement: NpcRequirement | undefined,
): boolean;
```

A new requirement kind is added to `NpcRequirement` in `src/data/npcs.ts`:

```ts
| Readonly<{ kind: 'missionsCompleted'; min: number }>
```

`npcRequirementMet` answers `run.missionsCompleted >= min`. The three existing
cases, the absent case (`true`) and the `roomNpc`/`guaranteedNpc`/`npcSpot`/`npcUseId`
signatures are untouched.

### TypeScript — `src/engine/run/party.ts`, `src/engine/run/passives.ts`

- `partyHasAbility` compares against **every** id `memberAbilities(member)` returns,
  so a member's second ability satisfies a gate. `partyHasType` and `partyHasMove`
  are untouched.
- `runPassives` builds its `held` set from **every** id `memberAbilities(member)`
  resolves through `getAbility`, so a second ability's `MAP_PASSIVES` row pays.
  Everything else (marks, streams, order) is untouched.

### Save — `src/engine/save.ts`

```ts
export const SAVE_VERSION = 20;
```

- `SAVE_MIGRATIONS[19]` exists and bumps `version` to `20`; it changes no field,
  because both new member words are optional and the decoder defaults them (the
  migration-14 precedent, documented in that table's comment block).
- `parsePokemon` reads `taughtMoves` (an array of non-empty strings `getMove`
  resolves, deduped, in order; an absent or malformed value means none) and
  `secondAbility` (a non-empty string; anything else means none). Each key is
  written **only when it carries something**, so a v20 round trip is byte-stable
  and a v19 document decodes to "no taught moves, no second ability".

## 🧩 Data and configuration

`src/data/npcs.ts`:

- `NpcRow` gains `repeatable?: boolean` — when `true` a chosen row writes **no**
  `npcUseId` mark and the card answers again on the same floor (the merchant). The
  field is absent on every other row, which is one-shot.
- `NpcRow.spriteKey`'s doc becomes "a key of `OVERWORLD_SPRITE_KEYS`".
- `export const TUTOR_MOVES: readonly string[] = ['swordsdance', 'earthquake', 'icebeam', 'thunderbolt', 'shadowball', 'roost'];`
  (six rows, `id`-canonical, each resolvable through `getMove`; the tutor's card
  prints them in this order and the array is the whole gate — a move outside it is
  never taught).
- `export const SACRIFICE_REWARDS: readonly SacrificeReward[] = ['nature', 'second-ability', 'ivs', 'species'];`
- Five new rows **after** the merchant, in this order (the table order is the
  roll's tie-break, so it is part of the contract):

| id | nameKey | spriteKey | chance | floorStep | requires | choices |
| --- | --- | --- | --- | --- | --- | --- |
| `tutor` | `npc.tutor.name` | `blackbelt` | 0.02 | 0.005 | — | `[{ id: 'teach', label: 'npc.tutor.teach' }]` |
| `nature` | `npc.nature.name` | `psychic` | 0.02 | 0.005 | — | `[{ id: 'reroll', label: 'npc.nature.reroll' }]` |
| `ability` | `npc.ability.name` | `ace` | 0.02 | 0.005 | — | `[{ id: 'reroll', label: 'npc.ability.reroll' }]` |
| `iv-judge` | `npc.iv.name` | `iv-judge` | 0.02 | 0.005 | — | `[{ id: 'reroll', label: 'npc.iv.reroll' }]` |
| `species` | `npc.species.name` | `camper` | 0.02 | 0.005 | — | `[{ id: 'swap', label: 'npc.species.swap' }]` |
| `sacrifice` | `npc.sacrifice.name` | `sacrifice` | 0.04 | 0.005 | `{ kind: 'missionsCompleted', min: 1 }` | `[{ id: 'offer', label: 'npc.sacrifice.offer' }]` |

  Their greetings are `npc.<group>.greeting`. The table's effective total per
  trainer room is `0.10 + 6 × 0.005 × (map − 1)` once a `flawless` floor has been
  completed (0.08 before, because the sacrifice is filtered out) — ≈ 10 % of
  trainer rooms at map 1 and ≈ 31 % at map 8; the merchant is a **placement**, so
  it is unaffected by the total.
- The four `blackbelt`/`psychic`/`ace`/`camper` rows **borrow** an archetype row of
  the packed overworld atlas: the sheet's ten dedicated NPC rows belong to other
  rows of the report, and re-packing art is not this task's. `iv-judge` and
  `sacrifice` use their own rows. `src/data/README.md`'s `npcs.ts` line says so.
- `src/i18n/en.ts` (authored) and `src/i18n/es.ts` (same keys in the same edit) gain:
  `npc.tutor.name`, `npc.tutor.greeting`, `npc.tutor.teach`,
  `npc.nature.name`, `npc.nature.greeting`, `npc.nature.reroll`,
  `npc.ability.name`, `npc.ability.greeting`, `npc.ability.reroll`,
  `npc.iv.name`, `npc.iv.greeting`, `npc.iv.reroll`,
  `npc.species.name`, `npc.species.greeting`, `npc.species.swap`,
  `npc.sacrifice.name`, `npc.sacrifice.greeting`, `npc.sacrifice.offer`,
  `npc.pickMember`, `npc.pickSlot`, `npc.used`,
  `npc.result.tutor` (`{name}`, `{move}`), `npc.result.nature` (`{name}`, `{nature}`),
  `npc.result.ability` (`{name}`, `{ability}`),
  `npc.result.secondAbility` (`{name}`, `{ability}`), `npc.result.ivs` (`{name}`),
  `npc.result.species` (`{name}`, `{species}`),
  `npc.result.sacrifice` (`{name}`, `{item}`, `{result}`),
  `npc.refused.noSlots`, `npc.refused.noAbility`, `npc.refused.noSpecies`,
  `npc.refused.noBag`, `npc.refused.notTutorMove`, `npc.refused.noMember`,
  `detail.learnTutor`. A move, species, ability, nature or item name is never a key:
  it comes from the dex/catalogue (`D43`).

### Docs (AGENTS.md: a data row ships its doc line in the same task)

- `docs/maps-spec.md` §7, the `### The special NPC` block **only**: the paragraph
  that says `NPC_ROWS` ships one row becomes the six-row statement, and the block
  gains the two things this table now has beyond the party gate — an eligibility
  kind that is **not** a party property (`missionsCompleted`, the sacrifice's gate:
  it appears once a `flawless` floor has been completed) and **`repeatable`** (a row
  that writes no use mark and answers again, the merchant). Leave `### The no-heal
  room`, `### The casino (the slot machine)` and every other block byte-identical:
  `[Task-116]` owns the casino paragraph.
- `docs/design-spec.md` §3: one new bullet, immediately after the party/box bullet
  that ends "the box is never required to be full." and before "- A member can be
  **named**:", listing the five member-edit NPCs and the two persisted words.
- `docs/routes-spec.md` §6: one new bullet after the trade paragraph (the one
  ending "a run cannot hold no party.") and before "The PC box also carries a
  **fixed RIP tab**": a member can be edited by a special NPC, one use per floor,
  and a tutored move lives in the MOVES tab's band tagged `Tutor` until it is
  equipped again.
- `docs/battle-spec.md` §7: one new bullet after the learnset bullet (the one
  ending "A No Guard holder is never offered an OHKO move by the band either
  (D17).") and before "- **Evolution is manual and level-only.**": a tutored move is
  a pool entry like a level-up one, and a member's second ability is what the
  run's ability readers see (`memberAbilities`); the battle's own dispatch keeps the
  primary.
- `docs/tech-decisions.md`: a new `## D48 — <title> *(decided)*` section appended at
  the end (the next free number at `98bd905`), recording that an NPC member edit is
  one pure transaction on the run with per-operation `:npc:` substreams, that the
  two new member words are optional-on-the-wire fields, and that the second ability
  is run-level until a precedence rule exists.

## 🖼️ The scene (`src/scenes/RouteScene.ts`)

Inside `chooseNpc` and two new private helpers; the shipped `openNpcPanel` shell
does the drawing, so no panel module is added.

- **The used check.** `openNpcCard` prints the row's greeting unless the row is not
  `repeatable` **and** `isItemPicked(this.run, npcUseId(mapIndex, roomId, row.id))`;
  then it prints `t('npc.used')` and passes **no choices**, so only `LEAVE` remains.
- **The shell closes itself after `onChoose`.** Every branch below therefore starts
  with `this.closePanel()` (which clears the scene's slot; the shell's own `close()`
  is idempotent) and then opens the next card with
  `this.openPanel(openNpcPanel(this, view, onChoose))`.
- `chooseNpc`'s branches, by `row.id` (`merchant`, `default` unchanged):
  - `tutor` → a **move card**: the row's own name as its title, the row's greeting
    as its paragraph, and `TUTOR_MOVES` as its choices, each labelled
    `getMove(id)?.name ?? id` in table order. Picking one opens the **member card**
    carrying that move.
  - `nature`, `ability`, `iv-judge`, `species` → the **member card** directly.
  - `sacrifice` → `sacrifice(this.run, { roomIndex: room.id, npcId: row.id })`
    immediately (no member card: the member is drawn), then the result card.
  - `default` → the shipped mark-and-close.
- **The member card** is titled with the row's name and its paragraph is
  `t('npc.pickMember')`; it lists `this.run.party` (never the box), one row per
  member, labelled `t('party.rowLabel', { name: this.memberName(member), level:
  member.fighter.level, status: '' })`, capped by `NPC_MAX_CHOICES` (the party is
  at most 6). Choosing one calls the operation; for the tutor it first opens the
  **slot card** (title: the row's name, paragraph `t('npc.pickSlot')`) when the
  member already holds four moves — four rows labelled with the member's move
  names — otherwise `slot = null`.
- **Applying** commits and marks, once:
  `const edit = <op>(this.run, member.id, ctx)`; on `ok` →
  `this.commitRun(markItemPicked(edit.run, npcUseId(mapIndex, room.id, row.id)))`
  (a single commit of the edited run **plus** its use mark); on `!ok` nothing is
  committed, nothing is marked, and the result card prints the refusal. `ctx` is
  `{ roomIndex: room.id, npcId: row.id }`. A `repeatable` row (the merchant) never
  reaches this point.
- **The result card** is one `openNpcPanel` with the row's name as its title, no
  choices, and a paragraph built from `MemberEditLine`:
  `tutor` → `t('npc.result.tutor', { name, move })`;
  `nature` → `t('npc.result.nature', { name, nature: capitalize(nature) })`;
  `ability`/`secondAbility` → `t('npc.result.<kind>', { name, ability })`;
  `ivs` → `t('npc.result.ivs', { name })`;
  `species` → `t('npc.result.species', { name, species: getSpecies(id)?.name ?? id })`;
  `sacrifice` → `t('npc.result.sacrifice', { name, item: getItem(itemId)?.name ?? itemId, result })`,
  where `result` is the inner line resolved by the same mapping.
  A refusal prints `npc.refused.*` by `reason` (all six keys exist) with the row's
  name as the title.
- **The learnset band's tag.** `learnCell` labels a `'tutor'` entry
  `t('detail.learnTutor')`; `'tm'` keeps `detail.learnTm` and `'level'` keeps
  `detail.learnLevel`. Its doc comment says "Lv/Tutor/TM".

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-93` audit against the exclusive paths list.
  - Every criterion is `[unit]`: **no browser pass is owed** — every rule this
    task adds is a pure function with a co-located test, the card is the shipped
    `src/ui/npcPanel.ts` shell, and the new copy is gated by `src/i18n`'s parity,
    glyph and width tests.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test` passes, including `src/engine/run/memberEdits.test.ts`,
    which pins: `teachMove` into a free slot, into a chosen slot and the `no-slots`
    refusal at four moves with `slot: null`; the move recorded in `taughtMoves`
    and offered by `learnsetPool` as `source: 'tutor'` **after** an
    `unequipMove`; `rerollNature`/`rerollAbility`/`grantSecondAbility`/
    `rerollIvs`/`swapSpecies` each writing its own field and leaving the other
    member fields identical (a deep-equality check on the untouched fields);
    `swapSpecies` keeping moves, ability, `secondAbility`, `taughtMoves`, IVs, EVs,
    held item and level while changing `speciesId` and never drawing the current
    species; `sacrifice` removing exactly one whole bag stack, drawing from the
    party, granting one `SACRIFICE_REWARDS` row, `no-bag` with the same run
    reference, and **consuming nothing** when the reward cannot resolve.
  - [ ] `[unit]` A **fixed-seed regression** exists:
    `memberEdits.test.ts` pins the exact results of
    `Rng`-driven edits for one fixed context (seed `pkm-93`, `roomIndex 3`,
    `npcId 'nature'`, `'ability'`, `'ivs'`, `'species'`, `'sacrifice'`) — the
    nature name, the ability name, the six IVs, the species id and the
    sacrifice's `(itemId, reward)` — and asserts that a second identically-seeded
    call returns the same values.
  - [ ] `[unit]` `src/engine/run/learnset.test.ts` pins the `level → tutor → tm`
    order of `learnsetPool`, that a tutored move is offered with
    `source: 'tutor'`, `level: null`, `tmId: null`, and that the No Guard OHKO ban
    still drops an OHKO tutored move.
  - [ ] `[unit]` `src/engine/run/progression.test.ts` pins `memberAbilities`
    (no second ability, a second ability, a duplicate and an empty-string second
    ability) and `editRunPokemon(member, { ivs })` changing the IVs while keeping
    the other stats' inputs.
  - [ ] `[unit]` `src/engine/routes/npcs.test.ts` pins the `'missionsCompleted'`
    requirement (0 vs ≥ `min`) and that `roomNpc` never picks the sacrifice before
    it is met while the other five rows still roll.
  - [ ] `[unit]` `src/engine/run/party.test.ts` and `passives.test.ts` pin that a
    member's **second** ability satisfies `partyHasAbility` and triggers its
    `MAP_PASSIVES` row.
  - [ ] `[unit]` `src/engine/save.test.ts` pins `SAVE_VERSION === 20`, that a v19
    document migrates to v20 with no taught moves and no second ability, and that
    a v20 round trip preserves both words on a party, a box and a rip member while
    a malformed `taughtMoves`/`secondAbility` drops to none.
  - [ ] `[unit]` `src/data/npcs.test.ts` pins the six rows in table order with the
    exact fields above, that every `spriteKey` is a key of
    `OVERWORLD_SPRITE_KEYS`, that every `TUTOR_MOVES` id resolves through
    `getMove`, that `SACRIFICE_REWARDS` is the four expected values, and that the
    merchant is the only `repeatable` row.
  - [ ] `[unit]` `npm test`'s i18n gate is green: every new key exists in `en` and
    `es`, every placeholder matches, and every new line passes the glyph and width
    guards.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; the five claimed
    `docs/*.md` files differ from `main` **only** in the named block
    (`docs/maps-spec.md` §7's `### The special NPC` block,
    `docs/design-spec.md` §3, `docs/routes-spec.md` §6, `docs/battle-spec.md` §7,
    the appended `D48`).

## 📣 Coordination

- For the Architect: the `SAVE_VERSION` step is **19 → 20** and `[Task-94]`'s
  `20 → 21` follows it unchanged. `[Task-96]`, `[Task-97]`, `[Task-99]` and
  `[Task-117]` build on `npcRequirementMet`'s new `missionsCompleted` kind and on
  `NpcRow.repeatable` — both are frozen here.
- For the next batch: `memberEdits.ts` is the only place a member is edited by an
  NPC. `NpcRow.repeatable` is how a row says "answer again" (`[Task-117]`'s rocket
  needs it); a row without it is one-shot and carries `npcUseId` after its first
  successful use. `memberAbilities(member)` is the run's one answer to "which
  abilities does this member have", so a later ability-gated rule asks it, never
  `fighter.ability` directly.
- The docs this task's **own** rows land in: `docs/maps-spec.md` §7's
  `### The special NPC` block (six rows, plus the `missionsCompleted` eligibility
  kind and `repeatable`). `[Task-94]`, `[Task-95]`, `[Task-99]` and `[Task-117]`
  extend the same table and the same block afterwards, so they read the six rows
  and their totals from there, not from this spec.

## ⛔ Out of scope

- The equip drag (`equipMove`), the level-up rule (`[Task-56]`, shipped), the
  evolution graph and the unequip (`[Task-68]`).
- The other NPC groups: `[Task-94]`'s exorcist/weather man/magician/type gate,
  `[Task-95]`'s medic/chef/berry tree/Mega-stone fight, `[Task-99]`'s special
  trainers, `[Task-117]`'s rocket.
- **The battle's ability dispatcher.** A second ability is a **run-level** fact:
  this task makes `partyHasAbility`, `runPassives` and the learnset's No Guard
  guard read it, and the battle keeps fighting with `fighter.ability` alone.
  Teaching `src/engine/battle/effects/registry.ts` to fire two abilities at once
  needs a precedence rule (which ability wins when both want the same hook) that
  is not decided anywhere — it is a later task, not a silent choice here.
- Any new UI module, any per-frame allocation, the box as an edit target, a second
  sacrifice per floor, an NPC row for `docs/maps-spec.md` §7's table (not this
  task's file), and re-packing the overworld atlas.
