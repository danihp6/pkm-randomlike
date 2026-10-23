# Spec: Task-114 — The battle's action log speaks the locale

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + i18n data (no Phaser, no scene).
- **Role:** Dev.
- **Objective:** the battle engine stops composing English sentences. Its text
  events carry a **key and its params** (`{ kind: 'text'; key: BattleTextKey;
  params?: BattleTextParams }`) instead of a rendered line, and
  `src/ui/feed.ts` resolves that key through `t()` when it builds the frame the
  battle scene prints — so a Spanish run draws its action log in Spanish while
  every fixed-seed artifact stays headless and language-free. The English table
  gains a `battle.log.*` family (one key per message rule) and `es.ts` overlays
  all of it. Not one RNG draw, turn order, damage number or event order changes:
  the same seed produces the same battle, logged as keys.
- **Environment:** worktree `../wt-pkm-114`, branch `task-114`.
- **Dependencies:** none — every module this reads is merged on `main` at
  `b1786b8`. It reads, and must not change: `src/i18n/index.ts` (`t`,
  `TranslationKey`), `src/i18n/content.ts` (`moveName`, `abilityNameFromEnglish`,
  both shipped by the content-localisation task), `src/data/items.ts`
  (`getItem(id)?.name`), `src/data/dex` (`Move.id`, `ItemDef.id`),
  `src/scenes/BattleScene.ts` (it reads `FeedFrame.message` and must stay
  untouched), `docs/tech-decisions.md` `D43`/`D46`, `docs/agent-spec-template.md`.

### The gap, re-measured on `b1786b8` (the label's numbers are stale)

The backlog entry was written before the move audit merged. These are the real
numbers of the tree this task starts from; **do not plan against the entry's
194/55/41/19 figures.**

- `pushText(` call sites: **226** in **twelve** files —
  `effects/abilities.ts` 68, `effects/moves.ts` 65, `turn.ts` 63,
  `effects/items.ts` 10, `effects/apply.ts` 4, `commands.ts` 4,
  `effects/conditions.ts` 4, `state.ts` 2, `effects/weather.ts` 2,
  `effects/terrain.ts` 2, `mega.ts` 1, `gmax.ts` 1.
- Message **tables** those sites read, which must be keyed too: `VOLATILE_MESSAGES`
  (26 entries, `turn.ts` 262-288), `CHARGE_VERBS` (`turn.ts`, one verb per move id,
  plus the `'is charging up!'` default at 672-674), `START_MESSAGES` (weather 4,
  terrain 4), `SIDE_START` (7) / `SIDE_END` (7) / `FIELD_START` (7) / `FIELD_END`
  (7) in `effects/conditions.ts`, and the per-site `message:` overrides passed to
  `applyBoostEffect` (30 call sites across `abilities.ts`, `moves.ts`, `turn.ts`).
- `event.text` **readers**: **25** in 8 test files —
  `effects/moves.test.ts` 7 (50, 110, 170, 193, 476, 593, 1063),
  `effects/abilities.test.ts` 5 (737, 749, 1490, 1558, 1849),
  `effects/items.test.ts` 4 (225, 420, 517, 655),
  `turn.test.ts` 3 (312, 421, 478) + 4 more of the same shape at 508, 524, 534,
  566, 577,
  `effects/weather.test.ts` 2, `effects/conditions.test.ts` 1,
  `banned.test.ts` 2 (21, 37), `moveAudit.test.ts` 1 (252 — the `texts()` helper
  every count in that file goes through). The three "helper" readers
  (`banned.test.ts` 37, `moveAudit.test.ts` 252, `moves.test.ts` 593) are the
  single place each file reads the text; converting the helper converts the file.
- Non-test readers that must keep working untouched: `src/ui/feed.ts` 24-25 and
  `src/scenes/BattleScene.ts` 1576-1594 (`battleFrames(...)` then
  `frame.message`). `FeedFrame.message` therefore **stays** `string | null`.
- `src/i18n/en.ts` carries **54** `battle.*` keys and **none** of them is a log
  line: they are chrome (`battle.command.*`, `battle.info.*`, `battle.outcome*`,
  `battle.panelName`, `battle.xp`, `battle.promptAction`, `battle.noItems`,
  `battle.mega*`, `battle.gmax*`). The log is new surface, not these keys.

**This is a wide task.** 226 sites plus ~64 table entries plus 30 override sites
plus ~200 keys is the honest size. Work family by family (the order in
"Key families" below is a dependency-safe order), commit nothing outside the
paths listed here, and never leave a `pushText` call on a non-`battle.log.` key.

### Exclusive paths (single writer)

Every one of these is written only by this task. Nothing outside this list.

- `src/engine/battle/state.ts`
- `src/engine/battle/turn.ts`
- `src/engine/battle/commands.ts`
- `src/engine/battle/mega.ts`
- `src/engine/battle/gmax.ts`
- `src/engine/battle/harness.ts`
- `src/engine/battle/effects/apply.ts`
- `src/engine/battle/effects/abilities.ts`
- `src/engine/battle/effects/items.ts`
- `src/engine/battle/effects/moves.ts`
- `src/engine/battle/effects/weather.ts`
- `src/engine/battle/effects/terrain.ts`
- `src/engine/battle/effects/conditions.ts`
- `src/engine/battle/golden.test.ts`
- `src/engine/battle/harness.test.ts`
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/banned.test.ts`
- `src/engine/battle/moveAudit.test.ts`
- `src/engine/battle/effects/abilities.test.ts`
- `src/engine/battle/effects/items.test.ts`
- `src/engine/battle/effects/moves.test.ts`
- `src/engine/battle/effects/weather.test.ts`
- `src/engine/battle/effects/terrain.test.ts`
- `src/engine/battle/effects/conditions.test.ts`
- `src/ui/feed.ts`
- `src/ui/feed.test.ts`
- `src/ui/README.md` (one role line, `feed.ts`, nothing else)
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/i18n/index.test.ts`
- `docs/battle-spec.md` — **§1 only** (`## 1. Shape of a turn`)
- `docs/design-spec.md` — **§4 only** (`## 4. The battle`)
- `docs/tech-decisions.md` — **`D43`'s "The boundary." paragraph only**

`src/scenes/BattleScene.ts`, `src/i18n/index.ts`, `src/i18n/content.ts`,
`src/data/**`, `package.json`, `src/main.ts` and `vite.config.ts` are **not**
yours and must not change. No file is added, renamed or deleted, so no folder
`README.md` is owed except the one `feed.ts` role line above.

### Inputs (read-only)

- `docs/tech-decisions.md` `D43` (the source-table rule and the boundary this task
  retires) and `D46` (the battle seed and turn sequence the golden log pins).
- `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/content.ts`,
  `src/i18n/index.test.ts` (the guards the new Spanish lines must clear).
- `src/data/items.ts` (`ItemDef`, `getItem`), `src/data/dex` (`Move`, `getMove`).
- `src/scenes/BattleScene.ts` (only to confirm it needs no change).
- `docs/battle-spec.md`, `docs/design-spec.md`.

## 🔒 Contract

### TypeScript — `src/engine/battle/state.ts`

```ts
import type { TranslationKey } from '../../i18n/en';

/** Every key the battle log may name: the `battle.log.` family of the source table. */
export type BattleTextKey = Extract<TranslationKey, `battle.log.${string}`>;

/** The values a log line interpolates. Ids, never rendered words, where a table owns them. */
export type BattleTextParams = Readonly<Record<string, string | number>>;

/** One log line as the engine emits it: a key plus its params, never a sentence. */
export type BattleText = Readonly<{ key: BattleTextKey; params?: BattleTextParams }>;
```

The `import type` above is **type-only** on purpose: with
`verbatimModuleSyntax: true` it is erased, the engine gains no runtime
dependency on `src/i18n`, and the battle stays headless. Do not import
`t`, `src/i18n/index.ts` or `src/i18n/content.ts` anywhere under
`src/engine/`.

The text variant of `BattleEvent` (currently `{ kind: 'text'; text: string }`)
becomes, exactly:

```ts
| Readonly<{ kind: 'text'; key: BattleTextKey; params?: BattleTextParams }>
```

and `pushText` becomes:

```ts
export function pushText(state: BattleState, key: BattleTextKey, params?: BattleTextParams): void;
```

`pushText` pushes `{ kind: 'text', key }` when `params` is `undefined` and
`{ kind: 'text', key, params }` otherwise. **Do not** push
`{ kind: 'text', key, params: undefined }`: `exactOptionalPropertyTypes` is on and
the golden log's bare-key form depends on the property being absent.

### TypeScript — the seam inside `src/engine/battle/`

Every function that today returns or accepts a sentence returns or accepts a
`BattleText` instead. Exact names and shapes:

```ts
// effects/apply.ts
export type BoostOptions = Readonly<{ self?: boolean; message?: BattleText }>;
export function applyBoostEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  boosts: Partial<Record<BoostId, number>>,
  options?: BoostOptions,
): void;
export function applyStatusEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  status: string | undefined,
  message?: BattleText,
): void;
// delete `statLabel`: its two readers become whole keys and it has no caller left.

// effects/terrain.ts — was `(state, fighter, status) => string | null`
export function terrainBlocksStatus(
  state: BattleState,
  fighter: BattleFighter,
  status: string,
): BattleText | null;           // argument order and guards unchanged

// turn.ts (all module-private today, keep them private)
function blockedMessage(fighter: BattleFighter, reason: 'slp' | 'frz' | 'par'): BattleText;
function damageMessage(move: Move, result: DamageResult, defender: BattleFighter): BattleText;
function chargeVerb(moveId: string): BattleText;

// commands.ts (private today)
function captureMessage(name: string, shakes: number, success: boolean): BattleText;
```

`setWeather`, `clearWeather`, `setTerrain`, `clearTerrain`, `setSideCondition`,
`setFieldCondition`, `tickConditions`, `tickWeather`, `tickTerrain`,
`useBagItem` and every command signature keep their names and parameters; only
the strings they push change. `weatherLabel` and `statusName` lose their last
log reader (`statLabel` is deleted); if a reader remains outside the log, keep
the function, else delete it — either way no log line may interpolate a label.

### TypeScript — `src/ui/feed.ts`

```ts
import { t } from '../i18n';
import { abilityNameFromEnglish, moveName } from '../i18n/content';
import { getItem } from '../data/items';

/** One log line as the player reads it: the key resolved in the current locale. */
export function battleMessage(text: BattleText): string;

export type FeedFrame = Readonly<{ message: string | null; events: readonly BattleEvent[] }>;
export function battleFrames(events: readonly BattleEvent[]): FeedFrame[];
export function frameMessage(frame: FeedFrame): string | null;
```

- `battleFrames` builds `message` with `battleMessage(event)` at the moment the
  frame is built (never a stored string, never at module load), so a locale
  change between two turns reads the new locale.
- `battleMessage(text)` = `t(text.key, params)` where `params` maps every entry
  through the **reserved-param** table below and leaves the rest verbatim.
- `FeedFrame` and `frameMessage` keep their exact types: `BattleScene.ts` reads
  them and must not be touched.
- Phaser-free, DOM-free: `feed.ts` may import `src/i18n` and `src/data/items`
  and nothing else new.

### The reserved-param rule (frozen)

A `battle.log.*` key's params are a closed vocabulary. Exactly three names are
**ids resolved by the feed**; every other name is a value inserted verbatim:

| param | who owns it | the feed resolves it with |
| --- | --- | --- |
| `move` | the move table | `moveName(String(value))` from `src/i18n/content.ts` |
| `ability` | the ability table | `abilityNameFromEnglish(String(value))` — the param is the **English display name the fighter holds** (`ctx.owner.ability`), because `BattleFighter.ability` is a name, not an id, and `abilityNameFromEnglish` is the accessor `Task-112` shipped for exactly that shape |
| `item` | the item table | `getItem(String(value))?.name ?? String(value)` from `src/data/items.ts` (English, per `D43`) |

Everything else — `name` (a Pokémon's display name: nickname or species name,
already English per `D43`), `target` (a second Pokémon's display name), `type`
(the English type name, exactly as `RouteScene.typeName` already interpolates it
into Spanish chrome), `hp`, `pp`, `stage`, `count`, `volatile` — is inserted
verbatim as `String(value)`. A key that declares any other token is a spec
violation and the inventory test in `src/i18n/index.test.ts` fails.

`name` params are always composed **in the engine** from
`fighter.name` / `state.sides[side].name`. The engine never looks up a name it
does not already hold.

### Data — the key families (frozen names and params)

All keys live in `en.ts` under one new comment block
`// battleLog — the action log the engine keys (D43, amended)` placed **after**
the `battleInfo` block, and are overlaid by `es.ts` in the same comment block
position. Segments are camelCase; the family is the second dotted segment.
The English value of every key is **the exact sentence that site composes
today** — this task localises the log, it does not rewrite it. Where a rule
repeats, one key serves every site.

**1. The damage line — six whole keys** (chosen from `DamageResult`, never one
sentence with optional halves). Params `{ move, name }` (`move` = the move id,
`name` = the defender's display name):

| key | English value |
| --- | --- |
| `battle.log.hit` | `{move} hit {name}!` |
| `battle.log.hitCrit` | `{move} hit {name}! A critical hit!` |
| `battle.log.hitSuper` | `{move} hit {name}! It's super effective!` |
| `battle.log.hitCritSuper` | `{move} hit {name}! A critical hit! It's super effective!` |
| `battle.log.hitWeak` | `{move} hit {name}! It's not very effective...` |
| `battle.log.hitCritWeak` | `{move} hit {name}! A critical hit! It's not very effective...` |

Selection: `crit` picks the `Crit` variant, `effectiveness > 1` the `Super` one,
`< 1` the `Weak` one, `1` the plain one; crit + effectiveness combine into the
two `CritSuper`/`CritWeak` keys. Head first, suffix second, exactly today's order.

**2. Base actions (one key per rule; params as shown):**

| key | English value | params |
| --- | --- | --- |
| `battle.log.roomNoHeal` | `No items or healing moves can be used in this room!` | — |
| `battle.log.roomBanned` | `{name} is barred in this room!` | `name` (species name) |
| `battle.log.sendOut` | `{name} sent out {target}!` | `name`, `target` |
| `battle.log.runAway` | `Got away safely!` | — |
| `battle.log.runFailed` | `{name} couldn't get away!` | `name` |
| `battle.log.used` | `{name} used {move}!` | `name`, `move` |
| `battle.log.usedItem` | `{name} used {item}.` | `name`, `item` |
| `battle.log.fainted` | `{name} fainted!` | `name` |
| `battle.log.faintedPerish` | `{name} fainted from the perish count!` | `name` |
| `battle.log.fail` | `But it failed!` | — |
| `battle.log.protectedItself` | `{name} protected itself!` | `name` |
| `battle.log.protectionFailed` | `{name}'s protection failed!` | `name` |
| `battle.log.brokeProtection` | `{name} broke through the protection!` | `name` |
| `battle.log.hurtByProtection` | `{name} was hurt by the protection!` | `name` |
| `battle.log.missed` | `{name}'s attack missed!` | `name` |
| `battle.log.noEffect` | `It doesn't affect {name}...` | `name` |
| `battle.log.enduredHit` | `{name} endured the hit!` | `name` |
| `battle.log.hitSubstitute` | `It hit {name}'s substitute!` | `name` |
| `battle.log.substituteFaded` | `{name}'s substitute faded!` | `name` |
| `battle.log.substitutePlaced` | `{name} put in a substitute!` | `name` |
| `battle.log.downWithIt` | `{name} took its attacker down with it!` | `name` |
| `battle.log.grudgePp` | `{name}'s {move} lost all its PP due to the grudge!` | `name`, `move` |
| `battle.log.followedInstruction` | `{name} followed the instruction!` | `name` |
| `battle.log.danceJoined` | `{name} joined in the dance with Dancer!` | `name` |
| `battle.log.grassyHeal` | `{name} is restored by the grassy terrain!` | `name` |
| `battle.log.wishCameTrue` | `{name}'s wish came true!` | `name` |
| `battle.log.leechSeed` | `{name}'s health is sapped by Leech Seed!` | `name` |
| `battle.log.nightmare` | `{name} is locked in a nightmare!` | `name` |
| `battle.log.curse` | `{name} is afflicted by the curse!` | `name` |
| `battle.log.liquidOoze` | `{name} sucked up the liquid ooze!` | `name` |
| `battle.log.energyDrained` | `{name} had its energy drained!` | `name` |
| `battle.log.recoil` | `{name} is damaged by recoil!` | `name` |
| `battle.log.regainedHealth` | `{name} regained health!` | `name` |
| `battle.log.madeWish` | `{name} made a wish!` | `name` |
| `battle.log.magicCoat` | `{name} shrouded itself with Magic Coat!` | `name` |
| `battle.log.magicBounce` | `{name}'s Magic Bounce reflected the move!` | `name` |
| `battle.log.snatched` | `{name} snatched the move!` | `name` |
| `battle.log.loafing` | `{name} is loafing around!` | `name` |
| `battle.log.taunted` | `{name} can't use status moves while taunted!` | `name` |
| `battle.log.encoreLocked` | `{name} can't use the same move twice in a row!` | `name` |
| `battle.log.flinched` | `{name} flinched and couldn't move!` | `name` |
| `battle.log.infatuated` | `{name} is infatuated and can't bring itself to attack!` | `name` |
| `battle.log.confusedHurtSelf` | `{name} is confused. It hurt itself in its confusion!` | `name` |
| `battle.log.snappedOut` | `{name} snapped out of its confusion!` | `name` |
| `battle.log.sealed` | `{name} can't use the sealed {move}!` | `name`, `move` |
| `battle.log.typeChanged` | `{name} transformed into the {type} type!` | `name`, `type` |
| `battle.log.typeAdded` | `{name} became the {type} type too!` | `name`, `type` |
| `battle.log.cured` | `{name} was cured of its status.` | `name` |
| `battle.log.recoveredHp` | `{name} recovered {hp} HP.` | `name`, `hp` |
| `battle.log.megaEvolved` | `{name} Mega Evolved!` | `name` |
| `battle.log.gigantamaxed` | `{name} Gigantamaxed!` | `name` |

`blockedMessage` becomes three keys (the reason is a closed union, so the
sentence is whole): `battle.log.blockedSlp` (`{name} is fast asleep.`),
`battle.log.blockedFrz` (`{name} is frozen solid!`),
`battle.log.blockedPar` (`{name} is paralyzed! It can't move!`).

**3. Stat stages — 14 whole keys**, `battle.log.boostRose.<stat>` and
`battle.log.boostFell.<stat>` for
`atk | def | spa | spd | spe | accuracy | evasion`, English value today's
`{name}'s <statLabel> rose!` / `... fell!` (label spelled exactly as
`statLabel` spells it today: `Attack`, `Defense`, `Sp. Atk`, `Sp. Def`, `Speed`,
`accuracy`, `evasiveness`). Param `{name}` only. A caller-supplied
`applyBoostEffect` message is one of these keys **or** its own rule key; the
generic line is these 14.

**4. Statuses — whole keys per status id** (`brn | psn | tox | par | slp | frz`),
English value today's sentence each:
`battle.log.statusAfflicted.<id>` (`{name} was afflicted by <statusName>!`),
`battle.log.statusResidual.<id>` (`{name} is hurt by its <statusName>!`),
`battle.log.statusShifted.<id>` (`{name} shifted its <statusName> to {target}!`),
params `{name}` / `{name, target}`;
`battle.log.itemInflicted.<id>` (`{name}'s {item} inflicted <statusName>!`,
params `{name, item}`) — 6 keys per family, 24 keys total.

**5. Abilities and items that trigger on their own** — one key per rule, named
`battle.log.ability.<ability>` (camelCase of the ability's display name, e.g.
`battle.log.ability.sturdy`, `battle.log.ability.innerFocus`) plus a rule segment
only when that ability states more than one sentence
(`battle.log.ability.thermalExchange.absorbed`, `.preventsBurns`). Ability
statements that interpolate the holder's own ability name use `{ability}`.
Item-triggered lines use `battle.log.item.<rule>` with `battle.log.item.held`
for the family, e.g. `battle.log.item.usedUp`
(`{name} used up its {item}!`, params `{name, item}`), `battle.log.item.hungOn`,
`battle.log.item.lostHp`, `battle.log.item.restoredHp`,
`battle.log.item.curedStatus`, `battle.log.item.unnerve`,
`battle.log.item.cheekPouch`, and the seven
`battle.log.item.raised.<stat>` keys for
`{name}'s {item} raised its <statLabel>!`. An ability line that names an item
passes it as an `item` id. The English value is the exact sentence the site
composes today; identical sentences share one key (the suites below will catch a
duplicate that was given two).

**6. Moves that state their own sentence** — `battle.log.move.<moveId>`
(e.g. `battle.log.move.substitute`), one key per rule, deduplicated the same way.
The generic rules a move reuses (`used`, `fail`, `protectedItself`,
`typeChanged`, the six damage keys, the stat keys) are the family keys above and
must not be duplicated per move.

**7. Weather — 9 keys:** `battle.log.weather.start.<sun|rain|sand|snow>`
(`The sunlight turned harsh!` / `It started to rain!` / `A sandstorm kicked up!` /
`It started to snow!`), `battle.log.weather.end`
(`The weather returned to normal.`), and
`battle.log.weather.buffeted.<sun|rain|sand|snow>`
(`{name} is buffeted by the <weatherLabel>!`, param `{name}`).

**8. Terrain — 7 keys:** `battle.log.terrain.start.<electric|grassy|misty|psychic>`,
`battle.log.terrain.end` (`The terrain returned to normal.`),
`battle.log.terrain.mistProtected` (`{name} is protected by the mist!`, `{name}`),
`battle.log.terrain.electricSleep`
(`{name} can't fall asleep on Electric Terrain!`, `{name}`). The grassy healing
line reuses `battle.log.grassyHeal` (rule 2) — do **not** declare a terrain key
for it.

**9. Side and field conditions — 14 + 14 keys:**
`battle.log.side.start.<reflect|lightscreen|auroraveil|tailwind|luckychant|mist|safeguard>`
(param `{name}` where today's sentence names the side),
`battle.log.side.end.<same ids>`, `battle.log.field.start.<trickroom|gravity|magicroom|wonderroom|fairylock|mudsport|watersport>`,
`battle.log.field.end.<same ids>`. English values are `SIDE_START`/`SIDE_END`/
`FIELD_START`/`FIELD_END` verbatim; where two ids share one sentence
(`magicroom`/`wonderroom` "The bizarre area vanished!") each id keeps its own
key — the tables are indexed by id.

**10. Volatiles and charge moves:** `battle.log.volatile.<volatileId>` for each of
the 26 entries of `VOLATILE_MESSAGES` (param `{name}`), plus
`battle.log.volatile.default` (`{name} was affected by {volatile}!`, params
`{name, volatile}` — the id is a pre-existing leak of that fallback, kept as is),
plus `battle.log.volatile.drowsy` (`{name} grew drowsy!`), plus one
`battle.log.charge.<moveId>` per `CHARGE_VERBS` entry and
`battle.log.charge.default` (`{name} is charging up!`). 27 + 1 + n keys.

**11. Capture — 5 keys:** `battle.log.caught` (`Gotcha! {name} was caught!`),
`battle.log.capture.shakes0` (`Oh no! {name} broke free!`),
`battle.log.capture.shakes1` (`Aww! {name} appeared to be caught!`),
`battle.log.capture.shakes2` (`Aargh! {name} almost had it!`),
`battle.log.capture.shakes3` (`Gah! {name} was so close, too!`). Param `{name}`.

The `es` value of every key is the official-Spanish-style line in the house
voice (compare `es.ts`'s existing battle lines): `move` and `ability` params read
in Spanish because the feed resolves them through `src/i18n/content.ts`
(`ember` → `Lanzallamas`), species, item and type params stay English, no em dash
(`U+2014`), every character drawable by the FRLG font (`src/data/ui/font.json`).

### `formatBattleLog` — `src/engine/battle/harness.ts`

The golden snapshot stops pinning sentences and pins **keys**:

```ts
case 'text':
  return formatText(event);   // `event.key`, or `event.key(a=1, b=x)`
```

`formatText` prints the bare key when no params are present, otherwise
`key(name=value, ...)` with the params **sorted by name** (so the snapshot does
not depend on literal key order), `, ` between them and `=` inside a pair.
Values are the raw param values (`String(value)`), never resolved — the harness
is headless and locale-free. Keep the existing two-space indents of every other
event kind exactly as they are.

The golden snapshot therefore re-pins to, in this exact order and spelling:

```
# turn 1
  > player ember
battle.log.used(move=ember, name=Charmander)
  = enemy -26 (23/49 x2)
battle.log.hitSuper(move=ember, name=Bulbasaur)
  > enemy vinewhip
battle.log.used(move=vinewhip, name=Bulbasaur)
  = player -6 (45/51 x0.5)
battle.log.hitWeak(move=vinewhip, name=Charmander)
# turn 2
  > player ember
battle.log.used(move=ember, name=Charmander)
  = enemy -23 (0/49 x2)
battle.log.hitSuper(move=ember, name=Bulbasaur)
  = enemy fainted
battle.log.fainted(name=Bulbasaur)
# end player
```

The seed, the teams, the turn sequence, every `move`/`damage`/`faint`/`end` line
and `state.winner` are **unchanged** — only the `text` lines change shape. Update
the test's doc comment ("the log below must stay byte-identical") to say it pins
the battle's **keys**, byte for byte.

### Determinism

- **Reads no RNG.** No stream is added, moved or consumed; `D46`'s per-turn draw
  and `D11`'s seed are untouched.
- **Adds no run field and no save field**, so **no `SAVE_VERSION` step** (the
  version stays where it is).
- The golden seed 2026 and its turn sequence reproduce exactly; the only diff in
  the snapshot is the text-line shape.

## 🧩 Data and configuration

No JSON, no balancing value, no new dependency. The data this task adds is the
`battle.log.*` block of `src/i18n/en.ts` (source of truth) and its `es.ts`
overlay, under the frozen naming above. Balancing is not involved.

## 🧪 Test and Validation Plan (for QA)

This task has one `[live]` criterion (the log in a running battle). Everything
else is headless.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds and the re-pinned ones.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-114` — audit against the exclusive paths.
  - `git diff main...task-114 -- 'src/**/*.test.ts'` — read it: every change in a
    test must be a re-pin to the key form, never a relaxed or deleted assertion.
  - Browser pass only for the one `[live]` criterion.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build`.
  - [ ] `[unit]` `npm test` is green, and the golden test's inline snapshot is
        exactly the block printed in `formatBattleLog` above — same keys, same
        param names, same order, sorted params. `npm test -- golden` passes and
        `git diff main...task-114 -- src/engine/battle/golden.test.ts` shows only
        that block plus the comment.
  - [ ] `[unit]` The conversion is total and the old event shape is gone: the
        build is the proof (a `string` where a `BattleTextKey` is expected is a
        `tsc` error), and as a cross-check
        `grep -rn '\.text\b' src/engine/battle src/ui/feed.ts src/ui/feed.test.ts`
        returns nothing, while `grep -rn "pushText(" src/engine/battle` still
        finds the definition plus **226** calls distributed exactly as the
        baseline above (`abilities.ts` 68, `moves.ts` 65, `turn.ts` 63,
        `items.ts` 10, `apply.ts` 4, `commands.ts` 4, `conditions.ts` 4,
        `state.ts` 2, `weather.ts` 2, `terrain.ts` 2, `mega.ts` 1, `gmax.ts` 1) —
        a call is reflowed, never added or dropped. `grep -rn "pushText("
        src/engine/battle | grep -v "battle.log\." | grep -v "export function"`
        shows only the calls that pass a table entry or a `BattleText` local,
        each of which itself names a `battle.log.` key.
  - [ ] `[unit]` The twelve engine files import no i18n runtime:
        `grep -rn "from '.*i18n" src/engine/battle` returns only
        `import type ... from '../../i18n/en'` in `state.ts`, and
        `grep -rn "\bt(" src/engine/battle` returns nothing.
  - [ ] `[unit]` The gates render in both locales: `src/ui/feed.test.ts` walks
        the golden battle through `battleFrames` with `setLocale('en')` and
        `setLocale('es')`, asserts each frame's `message` is a non-null, non-empty
        string with no `{` or `}` in it, and asserts the `es` run's `used` frame
        equals `t('battle.log.used', { name: 'Charmander', move: moveName('ember') })`
        (i.e. contains `Lanzallamas`, never `Ember`). `npm test -- feed` passes,
        and `afterEach` restores `setLocale('en')`.
  - [ ] `[unit]` The families are complete: the new
        `describe('the battle log')` block in `src/i18n/index.test.ts` pins
        `battle.log.hit*` at 6 keys, `battle.log.boostRose.*` at 7,
        `battle.log.boostFell.*` at 7, `battle.log.statusAfflicted.*` at 6,
        `battle.log.statusResidual.*` at 6, `battle.log.statusShifted.*` at 6,
        `battle.log.itemInflicted.*` at 6, `battle.log.weather.*` at 9,
        `battle.log.terrain.*` at 7, `battle.log.side.*` at 14,
        `battle.log.field.*` at 14, `battle.log.capture.*` at 5,
        `battle.log.volatile.*` at 28, and asserts every declared token of every
        `battle.log.*` key is one of
        `name target move ability item type hp pp stage count volatile`.
  - [ ] `[unit]` The two shipped guards cover the new Spanish lines without being
        edited: `npm test -- i18n` is green, which means every `es` character is
        in `src/data/ui/font.json` and no `es` value contains `U+2014`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
        `git diff --name-only main...task-114` lists only files from the list
        above, and `git diff main...task-114 -- src/scenes src/i18n/index.ts
        src/i18n/content.ts src/data package.json` is empty.
  - [ ] `[unit]` The English log is unchanged where it was already correct:
        running the golden battle's `en` frames through `battleFrames` yields the
        same sentences the old log printed (`Charmander used Ember!`,
        `Ember hit Bulbasaur! It's super effective!`, `Bulbasaur fainted!`).
  - [ ] `[live]` **The log speaks the locale in a real battle.** On the dev build
        (`npm run dev`), set **Options → Idioma → Español**, walk into tall grass
        on route 1 until a wild battle opens, and read the message box on the
        first damaging turn. Measurement: that one line, read at 1280×800 (and
        once at 390×844 to prove it fits the box without wrapping into the
        name row), must equal the `es` value of the matching key with its
        params substituted, read off `src/i18n/es.ts`: for an `ember` hit that is
        super effective, `t('battle.log.hitSuper', { name: '<species>', move:
        moveName('ember') })` — i.e. the box shows `Lanzallamas` and never
        `Ember`, and the sentence is Spanish while the species name stays
        English. Then repeat with **English** and read the same line: it must
        equal the `en` value of the same key (`Ember hit <species>! It's super
        effective!`). Five line kinds must be seen across the two runs — a used
        move (`battle.log.used`), a super-effective hit (`battle.log.hitSuper`),
        a stat drop (`battle.log.boostFell.*` or a move's own rule key), an
        ability trigger (`battle.log.ability.*`) and a faint
        (`battle.log.fainted`) — each matching its own key's table value in the
        active locale, character for character.

## 📣 Coordination

- **For the Architect:** the entry's measured baseline is stale and this spec
  carries the re-read one (226 sites / 12 files, 25 `event.text` readers, 54
  chrome keys none of which is a log line). The task is roughly 1.6× the entry's
  size; it is one atomic change because `pushText`'s signature change type-errors
  every site at once, so it cannot be split across parallel worktrees.
- **For the next batch:** `FeedFrame.message` stays `string | null`; the key
  surface is `BattleTextKey` / `BattleTextParams` / `BattleText` in
  `src/engine/battle/state.ts` and `battleMessage()` in `src/ui/feed.ts`. A later
  surface that draws the log itself (the DOM message box task) calls
  `battleMessage(event)` and must not re-implement the reserved-param rule.
  `formatBattleLog` now prints keys, so any consumer that wanted English text
  must go through `battleMessage`.
- **Deviations the human should confirm:** (1) the `ability` param carries the
  ability's **English display name**, resolved by `abilityNameFromEnglish`, not
  an id as the entry's prose says — `BattleFighter.ability` is a name and the
  id-from-name accessor lives in `content.ts`, which the engine must not import;
  (2) `item` params carry item **ids** and the feed resolves the English name, so
  the event stays language-free; (3) `type` params stay the English type name,
  exactly as the route's chrome already interpolates them, so types are not
  localised by this task.

## ⛔ Out of scope

- `validateCommand`'s refusals (`src/engine/battle/commands.ts` 192-226): they are
  **thrown** and never drawn (`turn.ts` 1494-1501 is the only reader, and it
  throws). They stay English exceptions.
- Species, item and type names (`D43` keeps them English, and the type name is
  the pre-existing carry-over the route chrome already shows).
- The 54 `battle.*` chrome keys and every other existing key — do not rename,
  reword or move them.
- `src/scenes/BattleScene.ts`, the message box's layout, typewriter speed and
  pacing.
- Localising `src/data/**` or adding a content table; no new `D` number; no edit
  to `D43` beyond the "The boundary." paragraph, which is **amended, not
  extended**: the dex's names stay English, the engine's log is keyed too, the
  "half Spanish / half English — the intended cut" sentence is retired, and "the
  strings `golden.test.ts` pins byte for byte" reads "the keys it pins".
- No new dependency, no `package.json` change, no RNG or save change.
