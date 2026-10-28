# Spec: Task-213 — A stat change is a chip in a grid beside the HP panel

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM HUD panel (Preact) + the shared HUD snapshot + the i18n pair +
  docs. No engine rule, no RNG, no data table.
- **Role:** Dev.
- **Objective:** the battle's HP layer shows the **player's lead active's** stat
  changes as a grid of 34×34 chips — `+2 ATK`, `-1 SPE`, … — drawn above the player's
  HP column, green for a raised stat and red for a lowered one, in the stage order
  the board's `05` frame uses, and **no grid at all** when every stage is zero. The
  snapshot (`HudState`) carries the stages the battle engine already keeps on the
  fighter, so the panel never reads the battle itself.
- **Environment:** worktree `../wt-pkm-213`, branch `task-213`.
- **Dependencies (all merged on `main`, verified 2026-10-28):**
  - `[Task-193]` (Batch 85, merged) — the compact HP column and the panel's own view
    model.
  - `[Task-212]` (Batch 88, merged) — `foeBallRow` and the "a row sits under a box and
    meets nothing" precedent this grid follows (`src/ui/hud/panels/battle-hp/view.ts`
    158-190).
  - The engine side already ships: `BattleFighter.boosts: Boosts`
    (`src/engine/battle/fighter.ts` 20-24, 241) with `BOOST_IDS =
    ['atk','def','spa','spd','spe','accuracy','evasion']` (line 22) and `clampBoost`
    (−6…+6). **Read-only.**

### Exclusive paths (single writer)

Create or modify **nothing** outside this list.

- `src/ui/hud/state.ts`
- `src/ui/hud/state.test.ts`
- `src/ui/hud/panels/battle-hp/view.ts`
- `src/ui/hud/panels/battle-hp/view.test.ts`
- `src/ui/hud/panels/battle-hp/battleHp.tsx`
- `src/ui/hud/panels/battle-hp/battleHp.css`
- `src/ui/hud/panels/battle-hp/mount.tsx` — **one declaration only (line 27)**: the
  initial `BattleHpView` literal gains `stageChips: []` and `stageBox: null`, because
  the widened `BattleHpView` makes both fields required. Nothing else in the file
  moves.
- `src/ui/hud/panels/battle-hp/README.md` (only the role lines this task changes)
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/hud-fidelity.md` — **§5 only, one inserted block**: a new
  **`**The stage grid.**`** block inserted **after the `**The route header's
  readouts.**` block (ends line 174) and before `## 6. Frame → node map` (line 176)** —
  i.e. at the very end of §5. Nothing else in the file (`[Task-205]`,
  `[Task-211]` and `[Task-214]` own other blocks of the same document).
- `docs/battle-spec.md` — **§3 only, one new bullet**: appended to §3 `Damage and
  stats`'s opening bullet list, **after the `Type effectiveness comes from the
  generated 18x18 chart` bullet (line 88) and before `### 3.1` (line 90)**. Nothing
  else in the file.

You are **the only task in this batch** holding `src/ui/hud/state.ts` and the **i18n
pair** (`src/i18n/{en,es}.ts`) — `[Task-211]` released it (its RANKING row reuses
`'stats.actionRanking'`).

### Inputs (read-only)

- `docs/hud-fidelity.md` §5 (the `**Battle zones.**` and `**The compact battle has its
  own cell.**` blocks), `docs/battle-spec.md` §3, `docs/tech-decisions.md` (D43, D45).
- `src/engine/battle/fighter.ts` — `BoostId`, `BOOST_IDS`, `Boosts`, `clampBoost`.
- `src/engine/battle/state.ts` — `BattleState`, `liveSlots`, `slotActiveIndex`,
  `activeFighter` (all already imported by `state.ts`).
- `src/ui/hud/panels/battle-hp/index.ts` and
  `src/ui/hud/panels/battle-hp/README.md`; `src/ui/hud/panels/battle-moves/view.ts`
  (`battleMovesBox`, for the tests' clearance assertions — **read-only**).
  `src/ui/hud/panels/battle-hp/mount.tsx` is **not** read-only: it is the panel file
  this task edits on one line (the initial literal, exclusive list above), and the
  rest of it is read as-is.
- `src/scenes/BattleScene.ts` — **read-only**: `mountBattleHp` builds its own view
  through `battleHpView`, so a wider `BattleHpView` needs no scene change — the only
  mount-side edit this task makes is `mount.tsx`'s initial literal.
- `design/frames/05-battle-hud.json` — read only, never edit (a Figma export).

## 🔒 Contract

Everything below is frozen.

### `src/ui/hud/state.ts` — the snapshot carries the stages

Today `HudBattleActive` (`HudBattleFighter & { slot; moves }`, lines 98-100) has no
stage field at all, and `hudSide` (263-280) builds it from `fighter`, `slot` and
`hudMoves`.

```ts
import { BOOST_IDS, type BoostId } from '../../engine/battle/fighter';

/** One non-zero stat stage of an active, as the HUD prints it. */
export type HudStatStage = Readonly<{
  stat: BoostId;
  /** The chip's label: `t('battle.stage.<stat>')` — `ATK`, `SPA`, `ACC`, … */
  label: string;
  /** −6…+6, never 0 (a zero stage is not carried). */
  stage: number;
}>;

export type HudBattleActive = Readonly<
  HudBattleFighter & { slot: Slot; moves: readonly HudBattleMove[]; stages: readonly HudStatStage[] }
>;
```

- `stages` is **only the non-zero boosts**, in `BOOST_IDS` order — which is the
  board's own order: `atk, def, spa, spd, spe, accuracy, evasion`. Empty `[]` when
  every stage is zero.
- `label` is `t('battle.stage.' + stat)`; the projection is the only place the string
  is resolved (`D43`), and `projectHud` stays pure: same input plus locale ⇒
  deep-equal output.
- `HudBattleFighter`, `HudBattleSide`, `HudBattle`, `HudState` keep their shapes.
  Nothing else in `state.ts` changes, and **no other field is added**.
- The engine is read, never written: `hudStages(fighter)` maps `fighter.boosts` and
  drops the zeroes. Reads no RNG.

### `src/ui/hud/panels/battle-hp/view.ts` — the grid

```ts
/** The board's chip: a 34 px square, 6 px apart, three to a row. */
export const STAGE_CHIP = 34;
export const STAGE_GAP = 6;
export const STAGE_COLS = 3;
/** The clearance the grid keeps above the player's box. */
export const STAGE_CLEARANCE = 8;

export type HpStageTone = 'up' | 'down';

export type HpStageChipView = Readonly<{
  stat: BoostId;
  label: string;
  /** `+2` / `-1` — the digit string painted above the label. */
  sign: string;
  /** −6…+6, never 0. */
  stage: number;
  /** `'up'` for a positive stage, `'down'` for a negative one. */
  tone: HpStageTone;
  /** Viewport coordinates: the chip's own 34 × 34 cell. */
  box: Rect;
}>;

export type BattleHpView = Readonly<{
  boxes: readonly HpBoxView[];
  foeBalls: readonly HpBallView[];
  foeBallsBox: Rect | null;
  /** The player's lead's non-zero stages, board order; `[]` with no battle or all zero. */
  stageChips: readonly HpStageChipView[];
  /** The chips' union box (viewport coordinates), or null when there is no chip. */
  stageBox: Rect | null;
}>;

/** The chips and their grid box for a snapshot, at this viewport and doubling. */
export function battleHpStages(
  state: HudState,
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): Readonly<{ chips: readonly HpStageChipView[]; box: Rect | null }>;
```

**Placement rule (frozen, and it is *not* the frame's).** The board draws its chips
at `(448, 673)` — inside the gap its 576 px menu leaves between the HP column
(ending at 432) and the card (starting at 664). The shipped battle menu card starts
at **440** (`battleMovesBox`, `src/ui/hud/panels/battle-moves/view.ts` 131-151), so
the board's origin is **inside the moves grid** here. The grid is therefore anchored
to the player's HP column instead:

- `column = battleHpBox(viewport, 'player', 0)`;
- `top = min(column.y, doubles.player ? battleHpBox(viewport, 'player', 1).y : column.y)`;
- `cols = min(STAGE_COLS, count)`, `rows = ceil(count / STAGE_COLS)`;
- `w = cols * STAGE_CHIP + (cols - 1) * STAGE_GAP`,
  `h = rows * STAGE_CHIP + (rows - 1) * STAGE_GAP`;
- the box is `{ x: column.x + column.w - w, y: top - STAGE_CLEARANCE - h, w, h }` —
  right-aligned to the HP column's own right edge, 8 px above its topmost box;
- chip `i` sits at `{ x: box.x + (i % 3) * (STAGE_CHIP + STAGE_GAP),
  y: box.y + floor(i / 3) * (STAGE_CHIP + STAGE_GAP), w: 34, h: 34 }`.

Consequences, all of which the tests pin:

- At **1280×800** the column is `{64, 660, 368, 100}`, so `x` right-aligns to **432**:
  one chip `{398, 618, 34, 34}`, two chips `{358, 618, 74, 34}`, six chips
  `{318, 578, 114, 74}`, seven chips `{318, 538, 114, 114}` (three rows). The grid's
  right edge (432) never reaches the menu card (x 440), and its bottom never reaches
  the player's box (top 660).
- At **390×844** the column is `{16, 504, 358, 80}`, so `x` right-aligns to **374**:
  one chip `{340, 462, 34, 34}`, six chips `{260, 422, 114, 74}`.
- The grid shows the **player's lead** (`battle.sides.player.actives` whose `slot` is
  `0`); in a double the partner's chips are not drawn, but the grid is anchored above
  the partner so it can never be painted over it.

`battleHpView(state, viewport, doubles)` fills `stageChips` and `stageBox` from
`battleHpStages`; every existing field keeps its value and its order
(boxes → `foeBalls` → `foeBallsBox` → `stageChips` → `stageBox`), so
`view.test.ts`'s `toStrictEqual` on the no-battle view is updated, not reshaped.

### `battleHp.tsx` — the paint

- A new layer child inside the existing root (`data-hud-battle-hp`):
  `<div class="battle-hp__stages" data-hud-battle-stages style={rectStyle(view.stageBox)}>`,
  rendered **only** when `view.stageBox !== null`.
- One chip per `view.stageChips` entry:
  `<span class="battle-hp__stage" data-hud-stage={chip.stat} data-stage={String(chip.stage)}
  data-tone={chip.tone} role="img" aria-label={`${chip.label} ${chip.sign}`}
  style={rectStyle(chip.box)}>`
  with two children, both `aria-hidden="true"`:
  `<span class="battle-hp__stage-sign">{chip.sign}</span>` and
  `<span class="battle-hp__stage-label">{chip.label}</span>`.
- The layer keeps taking no pointer event (the battle is driven by keys and the pad);
  the chips are inert spans, never buttons.

### `mount.tsx` — the initial literal, and nothing else

Line 27 today is:

```ts
let view: BattleHpView = { boxes: [], foeBalls: [], foeBallsBox: null };
```

`stageChips` and `stageBox` are **required** on the widened `BattleHpView` (no `?`,
no default), so that literal no longer typechecks and becomes:

```ts
let view: BattleHpView = { boxes: [], foeBalls: [], foeBallsBox: null, stageChips: [], stageBox: null };
```

- This is the **only** change this task makes in the file — the same declaration,
  with the two fields appended in either order. `paint`, `update`, `dispose`, the
  `BattleHpController` type and `mountBattleHp`'s three-parameter signature are
  untouched, and `battleHpView(state, viewport, doubles)` stays the only writer of
  `view` after the first paint.
- **No behaviour change:** `[]` / `null` are exactly what "no chip yet" means, so
  the DOM painted before the first snapshot is identical to today's.
- Nothing else in `src/ui/hud/panels/battle-hp/mount.tsx` is edited, and no other
  mount or barrel file is touched.
- **Prettier splits that literal, and the split is the same declaration.**
  `.prettierrc.json` sets `printWidth: 105`, and the one-line literal is wider than
  that, so `npx prettier --write` (and the check `npm run lint` runs) puts one
  property per line: the object opens on `let view: BattleHpView = {`, lists
  `boxes`, `foeBalls`, `foeBallsBox`, `stageChips`, `stageBox` one per line, and
  closes on `};` — seven lines where one stood. That form is this task's whole
  change: do not fight the formatter to keep the literal on one line.

### `battleHp.css` — the board's colours

- `.battle-hp__stage { position: fixed; border-radius: 8px; text-align: center;
  font-weight: 700; }` — `fixed`, not `absolute`: that is the shipped value, measured
  with `getComputedStyle` on `[data-hud-stage]` while the chip's own box is the pinned
  `{398,618,34,34}` at 1280×800 and `{340,462,34,34}` at 390×844, and the chip is its
  own positioning context for the sign and the label under it.
- `.battle-hp__stage[data-tone='up'] { background: rgb(74 222 128 / 14%);
  box-shadow: inset 0 0 0 1px rgb(74 222 128 / 60%); color: rgb(74 222 128); }`
- `.battle-hp__stage[data-tone='down'] { background: rgb(248 113 113 / 14%);
  box-shadow: inset 0 0 0 1px rgb(248 113 113 / 60%); color: rgb(248 113 113); }`
  
  These are the frame's own numbers (`05-battle-hud.json`: the `stage *` rectangles
  are 34×34, r8, `#4ADE80` at 14 % fill / 60 % stroke for a raise and `#F87171` at the
  same alphas for a drop).
- `.battle-hp__stage-sign { position: absolute; inset: 2px 0 auto 0; height: 15px;
  font-size: 13px; line-height: 15px; }`
- `.battle-hp__stage-label { position: absolute; inset: 19px 0 auto 0; height: 11px;
  font-size: 7px; line-height: 11px; letter-spacing: 0.5px; }` — the frame's 13 px
  sign and 7 px label; the sign is what carries the direction, so colour is never the
  only carrier (`D45`).

### `src/i18n/en.ts` and `src/i18n/es.ts` — seven keys

Added next to the existing `battle.info.stat.*` block (`en.ts` 418-424):

| key | en | es |
| --- | --- | --- |
| `battle.stage.atk` | `ATK` | `ATA` |
| `battle.stage.def` | `DEF` | `DEF` |
| `battle.stage.spa` | `SPA` | `AT.E` |
| `battle.stage.spd` | `SPD` | `DF.E` |
| `battle.stage.spe` | `SPE` | `VEL` |
| `battle.stage.accuracy` | `ACC` | `PRE` |
| `battle.stage.evasion` | `EVA` | `EVAS` |

The abbreviations are the same three-to-four glyphs the board prints (English) and
the official Spanish ones; a 34 px chip at 7 px holds all seven. No other key is
added, renamed or removed, and the two files keep their key order grouped as they are
today.

### Determinism and rules

- `projectHud` reads `fighter.boosts` only. **No RNG is drawn anywhere**, so no
  fixed-seed battle moves; `src/engine/**` is untouched.
- No Phaser import in `state.ts` or in `battle-hp/**` (both are DOM/pure).
- No new dependency, no new file (so no folder `README.md` line is owed beyond the
  role-line wording this task changes), no `SAVE_VERSION` step, no `src/data/**`.

## 🧩 Data and configuration

Nothing new: no JSON, no balancing value. The seven `battle.stage.*` strings are the
only configuration, and they live in the i18n pair, not in `src/data/`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — full Vitest run, headless; targeted first:
    `npx vitest run src/ui/hud/state.test.ts src/ui/hud/panels/battle-hp`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run lint`.
  - `git diff --name-only main...task-213` — every path must be in the exclusive list,
    which now includes `src/ui/hud/panels/battle-hp/mount.tsx`. That file's diff must
    be **one hunk around one declaration** (line 27's initial `BattleHpView` literal),
    checked with
    `git diff --numstat main...task-213 -- src/ui/hud/panels/battle-hp/mount.tsx`
    (expect `7  1`: `.prettierrc.json`'s `printWidth: 105` is narrower than the
    one-line literal, so Prettier splits it to one property per line — one line
    removed, seven added, one declaration either way; the invariant is **one hunk,
    one declaration, nothing else in the file**) and read in full at
    `git diff main...task-213 -- src/ui/hud/panels/battle-hp/mount.tsx`.
  - **This task owes a browser pass**: three `[live]` criteria below.
    `npm run dev` (the dev menu exists only in a dev build — `.env.development`), open
    `http://localhost:5173/?hud=dom`, continue a run, press `F` for the debug menu,
    give the lead the move `swords-dance` in the party-member editor, launch a wild
    battle (`poochyena`, level 8), press FIGHT and use Swords Dance. Read every box
    with `getBoundingClientRect()` and every colour with `getComputedStyle`.
- **Acceptance criteria:**
  - **The snapshot and the view (tests this task owes).**
    - [ ] `[unit]` `projectHud` on a battle whose player lead has
      `boosts = { atk: 2, spe: -1, …rest 0 }` returns
      `actives[0].stages` = `[{stat:'atk', label:'ATK', stage:2}, {stat:'spe', label:'SPE', stage:-1}]`
      in `BOOST_IDS` order — and `[]` for an all-zero lead; every other active and the
      foe's side carry their own list.
    - [ ] `[unit]` `battleHpStages` at 1280×800 gives `stageBox` `{398,618,34,34}` for
      one chip, `{358,618,74,34}` for two, `{318,578,114,74}` for six and
      `{318,538,114,114}` for seven; at 390×844 `{340,462,34,34}` for one and
      `{260,422,114,74}` for six; the chips' own boxes are 34×34, 40 px apart on both
      axes, three to a row.
    - [ ] `[unit]` `battleHpStages` returns `{chips: [], box: null}` for no battle, for
      an all-zero lead, and for a battle whose only non-zero stages are the foe's.
    - [ ] `[unit]` Each chip's `tone` is `'up'` for a positive stage and `'down'` for a
      negative one, and `sign` is `'+2'` / `'-1'` (ASCII `+` and `-`).
    - [ ] `[unit]` **No overlap**: at both viewports, with six chips, `stageBox` does
      not intersect `battleHpBox(viewport,'player',0)`, `battleHpBox(viewport,'player',1)`,
      `battleHpBox(viewport,'enemy',0)` or `battleMovesBox(viewport)`; the same holds
      for seven chips, and at 390×844 for six.
    - [ ] `[unit]` The rendered layer carries `[data-hud-battle-stages]` with one
      `[data-hud-stage]` per chip, `data-tone` / `data-stage` set, and **no**
      `[data-hud-battle-stages]` node when `stageBox` is null.
    - [ ] `[unit]` It typechecks and builds clean.
    - [ ] `[unit]` `mount.tsx` carries **only** the literal change: its whole diff is
      one hunk on line 27's declaration, gaining `stageChips: []` and `stageBox: null`
      in the shape Prettier gives them at `printWidth: 105` (the object opened on its
      own line, one property per line, closed on its own line), with `paint`, `update`
      and `dispose` byte-identical to `main` — `git diff --numstat
      main...task-213 -- src/ui/hud/panels/battle-hp/mount.tsx` prints `7  1`, and no
      other hunk appears in that file's diff.
    - [ ] `[unit]` Nothing outside the exclusive paths was touched — in particular
      `src/engine/**`, `src/scenes/**`, `src/ui/hud/panels/battle-moves/**` and
      `design/frames/**` are byte-identical to `main`, and no other file of
      `src/ui/hud/panels/battle-hp/**` changes besides the six this task owns.
  - **Live.**
    - [ ] `[live]` At **1280×800**, after the lead's Swords Dance
      (`[data-hud-hp="player-0"]` is `{64,660,368,100}`): `[data-hud-battle-stages]`
      exists with `getBoundingClientRect()` `{x:398, y:618, width:34, height:34}` ±1;
      its chip's `data-hud-stage` is `atk`, its text is `+2` over `ATK`, its computed
      `background-color` is `rgba(74, 222, 128, 0.14)` and its `color`
      `rgb(74, 222, 128)`; the grid's box intersects none of
      `[data-hud-hp="player-0"]`, `[data-hud-hp="enemy-0"]` or
      `[data-hud-panel="battle-moves"]` (compare `getBoundingClientRect()` rectangles
      pairwise).
    - [ ] `[live]` At **390×844**, after the same move: the grid is
      `{x:340, y:462, width:34, height:34}` ±1, the chip reads `+2` / `ATK` in the same
      green, and the box intersects neither `[data-hud-hp="player-0"]`
      (`{16,504,358,80}`) nor `[data-hud-panel="battle-moves"]` (`{16,592,358,236}`).
    - [ ] `[live]` A negative stage paints red: let the foe lower the lead's Speed (or
      take a Speed drop from any room/move), and the chip's `data-tone` is `down`, its
      `sign` starts with `-`, its computed `color` is `rgb(248, 113, 113)` — and
      switching the lead out for another party member removes
      `[data-hud-battle-stages]` from the DOM entirely (every stage of the incoming
      member is zero).

## 📣 Coordination

- **For the Architect / Orchestrator:** the entry's claims line names `src/ui/hud/state.ts`
  as the shared file; no batch-mate needs it — `[Task-214]` reads the move cells out of
  `HudBattleActive.moves` and adds nothing to the snapshot. This spec **takes the i18n
  pair**, which `[Task-211]` released (its RANKING row reuses `stats.actionRanking`),
  and it adds the panel's `README.md` role lines, which the one-folder claim covers.
- **The entry's live criterion is wrong on one point and this spec corrects it:** the
  grid shows the **player's** lead, so a foe's Growl is not what makes a chip appear —
  the lead's own Swords Dance (or a speed drop on the lead) is. A Growl that lowers the
  *foe's* Attack changes nothing on this grid.
- **The board's own chip origin (448, 673) is not reachable in the shipped layout:**
  the battle menu card starts at 440 here (`battleMovesBox`), while the board's frame
  puts it at 664. The grid is right-aligned to the HP column instead, which is the
  nearest box that meets neither the card nor an HP panel; `docs/hud-fidelity.md` §5's
  new **The stage grid.** block records that deviation and its numbers.
- **For `[Task-214]` (same batch):** you own the moves card and `battleMovesBox`'s
  consumers; this task adds `battleMovesBox` as a **read-only** import in tests only.
  Do not move the card's left edge (440) — the grid's clearance depends on it.
- **For `[Task-200]` (Batch 90):** the canvas battle still draws its own HP kits; the
  DOM layer is the one that gained the chips, so the canvas needs nothing when the DOM
  becomes the only HUD.

## ⛔ Out of scope

- The **foe's** stages, and any second grid: one grid, one side, the player's lead.
- The battle INFO window (`05e`), the battle log and the ASCII `↑` / `↓` marks a move
  cell prints (`battle-moves` is `[Task-214]`'s).
- Making a chip interactive (a press, a tooltip, a focus ring): the chips are paint.
- `src/scenes/BattleScene.ts` in any form, the canvas HP kits, the ball row
  (`[Task-212]`, merged), **anything in `src/ui/hud/panels/battle-hp/mount.tsx`
  beyond line 27's two new literal fields** (its `battleHpView(state, viewport,
  doubles)` call already returns the new fields, so the call, the controller and the
  `paint`/`update`/`dispose` bodies need no change),
  `design/frames/**`, `src/engine/**`, `src/data/**`, `package.json`,
  `vite.config.ts`, `src/main.ts`, any `SAVE_VERSION` step.
