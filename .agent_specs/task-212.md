# Spec: Task-212 — A trainer's remaining Pokémon show as balls under its panel

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser-side panel (the DOM HUD's battle HP cards; presentation only).
- **Role:** Dev.
- **Objective:** after this task the foe's HP card carries the trainer's **remaining team as
  Poké Balls** — one per Pokémon the foe fielded, filled while it stands and spent once it
  faints — exactly where the board's `05` draws them: a row under the foe's box, inside the
  HP column, never meeting the player's panel or the battle menu. A **wild** battle draws no
  row at all, because the wild's "party" is the wild itself. Today
  `src/ui/hud/panels/battle-hp/view.ts` returns `boxes` and nothing else, so a player never
  learns how much of the trainer's team is left.
- **Environment:** worktree `../wt-pkm-212`, branch `task-212`.
- **Dependencies:** `[Task-193]` (merged: the compact battle's cell geometry, which is what
  fixes the command card's phone rect this task measures against). The panel's other shipped
  work (`[Task-188]`'s portrait seam, `[Task-189]`'s zones) is on `main` and read only.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/ui/hud/panels/battle-hp/view.ts`
- `src/ui/hud/panels/battle-hp/view.test.ts`
- `src/ui/hud/panels/battle-hp/battleHp.tsx`
- `src/ui/hud/panels/battle-hp/battleHp.css`
- `src/ui/hud/panels/battle-hp/mount.tsx` — **one line only**: its `let view: BattleHpView = { boxes: [] };`
  literal must become `{ boxes: [], foeBalls: [], foeBallsBox: null }`, because the two new
  fields are required. Nothing else in that file changes.
- `src/ui/hud/panels/battle-hp/README.md` (one role line per file if the map needs it)
- `docs/hud-fidelity.md` — **only** two sentences appended to §5's existing
  `**Battle zones.**` block.
- `docs/battle-spec.md` — **only** §7's trainer-roster bullet (the block at 549-551: "Trainer
  rosters are generated at the route's level band … a fixed six (three on map 1)").

`src/ui/hud/state.ts`, `src/ui/hud/panels/battle-moves/**`, `src/ui/hud/kit/**`,
`src/engine/battle/**`, `src/scenes/BattleScene.ts`, `src/i18n/{en,es}.ts`,
`src/data/**` and `package.json` are **not** this task's.

### Inputs (read-only)

- `src/ui/hud/state.ts` — `HudBattle.isWild` and `HudBattleSide.party`, a
  `HudBattleFighter[]` that keeps a fainted member at `hpFraction === 0` (the same array the
  switch screen lists), in party order.
- `src/engine/battle/state.ts` — `BattleSide.party` (the roster the battle fields; a fainted
  fighter stays in it).
- `src/data/itemIcons.ts` — `itemIconFrame('pokeball')` and `ITEM_ICON_ATLAS_URL`, the packed
  Añil atlas the capture throw and the bag already draw from.
- `src/data/anil/item-icons.json` — `{ size: 24, cols }`, the cell size and atlas width.
- `src/ui/hud/panels/battle-bag/battleBagPanel.tsx` (`iconStyle`, the same 24 px cell as a
  background position — read for the arithmetic, not imported).
- `docs/hud-fidelity.md` §5 (`**Battle zones.**`, `**The compact battle has its own cell.**`)
  and `docs/battle-spec.md` §7.
- `src/ui/hud/panels/battle-hp/{README.md,mount.tsx,index.ts}`.

## 🔒 Contract

### TypeScript

`src/ui/hud/panels/battle-hp/view.ts` gains:

```ts
/** The board's ball cell and the row's own spacing, in px. */
export const BATTLE_BALL_SIZE = 16;
export const BATTLE_BALL_GAP = 4;
/** The gap between the foe's box's bottom edge and the row's top edge. */
export const BATTLE_BALL_ROW_GAP = 8;

export type HpBallState = 'filled' | 'spent';

export type HpBallView = Readonly<{
  /** 0-based index in the foe's fielded party, which is the row's left-to-right order. */
  index: number;
  /** `spent` once that member has fainted (`hpFraction <= 0`). */
  state: HpBallState;
  /** Viewport coordinates, the ball's own 16 × 16 cell. */
  box: Rect;
}>;

export type BattleHpView = Readonly<{
  boxes: readonly HpBoxView[];
  /** One ball per member the foe fielded; `[]` in a wild battle or with no battle. */
  foeBalls: readonly HpBallView[];
  /** The row's box (the balls' union), or null when `foeBalls` is empty. */
  foeBallsBox: Rect | null;
}>;

/** The row alone, for a test or a second painter: the balls and their union box. */
export function foeBallRow(
  state: HudState,
  viewport: Viewport,
): Readonly<{ balls: readonly HpBallView[]; box: Rect | null }>;
```

Frozen rules:

- `state.battle === null` ⇒ `{ balls: [], box: null }`; `state.battle.isWild === true` ⇒ the
  same. No row is ever drawn for a wild battle.
- Otherwise one ball per `state.battle.sides.enemy.party` entry, in **party order**, with
  `state: entry.hpFraction <= 0 ? 'spent' : 'filled'`. A fainted member keeps its ball (that
  is the count of the team's size), which is why the row reads "how many it started with".
- Geometry, `lead = battleHpBox(viewport, 'enemy', 0)`:
  `ball(i).box = { x: lead.x + i * (BATTLE_BALL_SIZE + BATTLE_BALL_GAP), y: lead.y + lead.h + BATTLE_BALL_ROW_GAP, w: 16, h: 16 }`;
  `box = { x: lead.x, y: lead.y + lead.h + 8, w: n * 16 + (n - 1) * 4, h: 16 }` for `n > 0`,
  else `null`. The row never goes above the foe's box and never to its right.
- `battleHpView(state, viewport, doubles)` returns `foeBalls`/`foeBallsBox` from
  `foeBallRow`, and its shipped `boxes` are unchanged (order, ids, rects, fields).
- **Determinism:** reads no RNG, no clock and no locale; the same snapshot and viewport ⇒ a
  deep-equal view.

`src/ui/hud/panels/battle-hp/battleHp.tsx`:

- `BattleHp` paints, after the boxes, one row:
  `<div class="battle-hp__balls" data-hud-battle-hp-balls role="img" title="{standing}/{total}" style={rectStyle(view.foeBallsBox)}>`
  when `view.foeBallsBox !== null`, holding one
  `<span class="battle-hp__ball" data-hud-ball="{state}" aria-hidden="true" style={ballStyle(ball)} />`
  per ball, where `ballStyle` positions the ball **inside the row**
  (`left = ball.box.x - row.box.x`, `top = ball.box.y - row.box.y`) and paints the atlas:
  `backgroundImage: url("${ITEM_ICON_ATLAS_URL}")`,
  `backgroundSize: "${itemAtlas.cols * 16}px auto"` scaled so one 24 px cell draws 16 px,
  `backgroundPosition: "-${col * 16}px -${row * 16}px"` with
  `col = frame % itemAtlas.cols`, `row = Math.floor(frame / itemAtlas.cols)` and
  `frame = itemIconFrame('pokeball')`, `backgroundRepeat: 'no-repeat'`.
- `{standing}/{total}` is **digits only** (e.g. `2/3`), so no i18n key is added; the row is the
  accessible carrier of the count (`role="img"` + `title`), and each ball is `aria-hidden`.
- Nothing else in the component changes: the four boxes keep their order, their nodes and
  their data attributes, and the layer keeps taking no pointer event.

`src/ui/hud/panels/battle-hp/battleHp.css` gains three rules only:

```css
.battle-hp__balls { position: absolute; }
.battle-hp__ball { position: absolute; }
.battle-hp__ball[data-hud-ball='spent'] { opacity: 0.35; }
```

### Data

- No JSON, no i18n key, no `src/data/**` entry and no engine rule is added or changed. The
  ball is the packed atlas's own frame, already committed.

## 🧩 Data and configuration

| value | where | meaning |
| --- | --- | --- |
| `BATTLE_BALL_SIZE = 16` | `view.ts` | the drawn ball cell; the atlas' 24 px frame is scaled to it |
| `BATTLE_BALL_GAP = 4` | `view.ts` | between two balls |
| `BATTLE_BALL_ROW_GAP = 8` | `view.ts` | the row's own gutter under the foe's box, the same 8 px `--hud-gutter` the doubles rule uses |
| `'filled'` / `'spent'` | `view.ts` | `hpFraction > 0` / `hpFraction <= 0`; *spent* is drawn at 35 % opacity |
| `{standing}/{total}` | `battleHp.tsx` | the row's accessible name and tooltip, digits only |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-212` — every path must be in the exclusive list above.
  - This task has **two** `[live]` criteria; the rest are `[unit]`.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` is green, and `view.test.ts` asserts, on a **trainer** snapshot at
        1280×800 with three fielded members and the third at `hpFraction: 0`: `foeBalls` has
        length 3, `state`s are `['filled','filled','spent']`, `box`es are
        `{x: 64, y: 156, w: 16, h: 16}`, `{x: 84, y: 156, …}`, `{x: 104, y: 156, …}` and
        `foeBallsBox` is `{x: 64, y: 156, w: 56, h: 16}`.
  - [ ] `[unit]` the same fixture with `isWild: true` returns `foeBalls: []` and
        `foeBallsBox: null`, and a snapshot with `battle: null` returns the same.
  - [ ] `[unit]` at 390×844 (phone column: foe box `{x: 16, y: 16, w: 358, h: 80}`) `foeBallsBox`
        is `{x: 16, y: 104, w: 56, h: 16}`, and at both widths the row intersects **none** of
        `battleHpBox(viewport, 'player', 0)`, the desk command card `{x: 440, y: 582, w: 564, h: 192}`
        or the phone command card `{x: 16, y: 592, w: 358, h: 236}` (rect arithmetic, `<` on the
        separated axes).
  - [ ] `[unit]` a **four-member** party returns `foeBallsBox.w === 76` and a **one-member**
        party returns `w === 16`, i.e. `(n - 1) * 4` is the only spacing spent.
  - [ ] `[unit]` `npm run build` is green and `git diff --name-only main...task-212` lists only
        the paths above; `grep -c "battle-hp__ball" src/ui/hud/panels/battle-hp/battleHp.css`
        prints `3`.
  - [ ] `[live]` **Measured with the browser driver** (Playwright/CDP) at
        `http://localhost:5175/?hud=dom`, viewport **1280×800**, in a **trainer** battle whose
        trainer fields three Pokémon: `document.querySelectorAll('[data-hud-ball]').length === 3`,
        all three carry `data-hud-ball="filled"`, `document.querySelector("[data-hud-battle-hp-balls]").getAttribute('title') === '3/3'`,
        that row's `getBoundingClientRect()` is `{x: 64, y: 156, width: 56, height: 16}`, and it
        does not intersect the `[data-hud-hp="player-0"]` box nor the battle menu card.
        Let one member faint: exactly one ball reads `data-hud-ball="spent"`, the title reads
        `2/3` (or `1/3` if two fell in the same turn — the count is read from the row, not
        assumed), and the spent ball's computed `opacity` is `0.35`.
  - [ ] `[live]` the same URL in a **wild** battle at 1280×800 and at **390×844**: zero
        `[data-hud-ball]` nodes and no `[data-hud-battle-hp-balls]` node; in a phone trainer
        battle the row's rect is `{x: 16, y: 104, width: 56, height: 16}` and no ball overlaps
        either HP card or the menu card.

## 📣 Coordination

- **For the Architect / Integration QA:** this task appends **two sentences** to §5's existing
  `**Battle zones.**` block of `docs/hud-fidelity.md` (the ball row's box, the 16/4/8 numbers
  and the spent ball's 35 %), and **one clause** to `docs/battle-spec.md` §7's roster bullet
  (the row counts the foe's **fielded party**, fainted members included). `[Task-201]` and
  `[Task-207]` write their own new §5 blocks elsewhere in the file; the three hunks are
  disjoint, and Integration QA reads the combined §5 for lost lines.
- **For the next batch:** `[Task-213]` (a stat-change chip grid beside the player's panel)
  owns `battle-hp/**` next and must keep this row: it sits under the **foe's** box and must not
  be moved to make room. `[Task-214]` touches the move card, not this panel. `[Task-200]`
  retires the canvas chrome only.
- **For the Orchestrator:** the row's accessible text is digits only on purpose — a
  `battle.balls*` key would need the i18n pair, which `[Task-210]` holds in this batch. If a
  later task adds that key, it also replaces the `title`.
- **No `SAVE_VERSION` step**, no draw, no save write: the panel reads the battle snapshot.

## ⛔ Out of scope

- The player's own side: no ball row under the player's panel (the run's team is in the party
  card).
- The canvas `BattleScene`'s panels (`drawSidePanel` / `secondPlayerPanel`), the battle log,
  the command window's geometry and the doubles stacking rule.
- A shared kit item-icon component: the 24 → 16 px arithmetic is local to this panel in this
  task (`src/ui/hud/kit/**` belongs to `[Task-214]`'s batch).
- Any change to `HudBattleSide` / `HudBattle` (`src/ui/hud/state.ts`) — the party array and the
  `isWild` flag already carry everything.
- New i18n keys, new files, new dependencies, a repack.
