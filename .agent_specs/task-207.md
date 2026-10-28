# Spec: Task-207 — The route header's EXP stops being a string, and its three readouts are pinned

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser-side panel (the DOM HUD's party card; presentation only).
- **Role:** Dev.
- **Objective:** after this task the route header prints the **board's** three readouts and
  nothing else: the squad's level line, the shared **XP bar with no digits painted**, and the
  **Pokevial's charges** as a meter whose fill step is the model's. Today
  `src/ui/hud/panels/party/view.ts` returns `xp: { text, fraction, box }` and
  `partyPanel.tsx` paints `text` in a `.party__xp-text` span beside the bar — the board draws
  the bar alone ("string exp fuera", the human's words) — and the vial's fill step is derived
  inside the component (`vialStep`, a local helper with a 1-charge floor) instead of coming
  from the view, so the paint and the model can drift.
  **Read this before you start:** the level line and the Pokevial **already ship** in this
  panel (`partyPanelView` returns `level`, `xp` and `vial`; `PartyCard` paints
  `data-hud-party="level" / "xp" / "vial"`). The report that opened this task looked for them
  in `src/ui/hud/panels/hud/**`, which is only the collapsed-panel chip rail. Your diff is the
  EXP string's retirement, the step moving into the view, and the guards below that keep the
  two readouts the report asked for from ever regressing.
- **Environment:** worktree `../wt-pkm-207`, branch `task-207`.
- **Dependencies:** none — every seam this task edits is on `main` (`[Task-202]` shipped the
  portrait/reorder/HP-bar work in the same files and `[Task-193]` the panel's own compact
  rules; neither is a prerequisite).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/ui/hud/panels/party/view.ts`
- `src/ui/hud/panels/party/view.test.ts`
- `src/ui/hud/panels/party/partyPanel.tsx`
- `src/ui/hud/panels/party/partyPanel.test.ts`
- `src/ui/hud/panels/party/party.css`
- `src/ui/hud/panels/party/README.md` — **only** if a role line about the XP readout or the
  vial's step is now wrong (one line, no rewrite).
- `docs/hud-fidelity.md` — **only** §5's new `**The route header's readouts.**` block (the last
  block of §5, after `**The target step's prompt.**`).

`src/ui/hud/panels/hud/**` is **not** this task's: `stripView` there is the collapsed-panel
chip rail and carries no level, no XP and no vial. `src/ui/hud/state.ts`,
`src/scenes/RouteScene.ts`, `src/scenes/panels/party.ts`, `src/i18n/{en,es}.ts`,
`src/data/**` and `docs/design-spec.md` are not this task's either.

### Inputs (read-only)

- `src/ui/hud/state.ts` — `HudRoute` carries `squadLevel`, `xp`, `xpFraction`,
  `pokevialCharges`, `pokevialMax` (the panel's only input, already projected).
- `src/engine/run/heal.ts` — `POKEVIAL_MAX_CHARGES` (3) and the vial's own rule.
- `src/i18n/en.ts` — the keys `hud.level`, `hud.xp` and `hud.vial` already exist; you add no
  key and change no string.
- `src/ui/hud/panels/party/{mount.tsx,index.ts,partyPanel.test.ts,README.md}`.
- `docs/hud-fidelity.md` §5 (`**Chips.**`, `**Battle zones.**`) and `docs/design-spec.md` §3
  (the party window's own paragraph, read only — `[Task-202]` wrote it).
- `src/ui/hud/panels/battle-moves/battleMoves.test.ts` — the `nodesWithClass` vnode-walking
  pattern, which is how a headless test reads a Preact tree in this repo.

## 🔒 Contract

### TypeScript

`src/ui/hud/panels/party/view.ts` — the `PartyPanelView` header fields change shape, and one
function is exported:

```ts
/** The Pokevial's one fill step per charge, the shipped `HUD_VIAL_FILL_COLORS`. */
export const VIAL_STEPS = 3;

/**
 * The fill step the meter paints: the charge count clamped to `0…min(VIAL_STEPS, max)`.
 * `0` means "no fill" (a spent or absent vial), never "one step".
 */
export function vialStep(charges: number, max: number): number;

export type PartyPanelView = Readonly<{
  // … the shipped fields (open, box, highlight, chip, level, rows)
  /** `label` is the accessible string only: the board paints a bar and no digits. */
  xp: Readonly<{ label: string; fraction: number; box: Rect }>;
  vial: Readonly<{
    text: string;
    charges: number;
    max: number;
    fill: number;
    /** `vialStep(charges, max)` — the model's, never the component's. */
    step: number;
    box: Rect;
  }>;
}>;
```

Frozen rules:

- `xp.label` is **exactly** `t('hud.xp', { xp: route.xp })`, and `''` when `state.route` is
  null. `xp.fraction`, `xp.box` are unchanged (`0…1`, `{ x: 32, y: 38, w: 186, h: 8 }`).
- `vial.text` stays `t('hud.vial')`; `vial.charges` / `vial.max` stay
  `route.pokevialCharges` / `route.pokevialMax` (`0` for a null route); `vial.fill` stays
  `max > 0 ? clampFraction(charges / max) : 0`; `vial.box` stays `{ x: 75, y: 54, w: 100, h: 20 }`.
- `vial.step === vialStep(charges, max)` and `vialStep(c, m) = min(max(trunc(c), 0), min(VIAL_STEPS, max))`
  for finite `c`, `m`; `0` for anything unreadable (`NaN`, `Infinity`, `null` route ⇒ `max === 0`).
- **The `text` field of `xp` is retired.** Nothing else in `PartyPanelView` is renamed.

`src/ui/hud/panels/party/partyPanel.tsx`:

- The `<span class="party__xp-text">{view.xp.text}</span>` node is **deleted**.
- `[data-hud-party="xp"]` keeps `role="progressbar"`, `aria-valuemin`, `aria-valuemax`,
  `aria-valuenow` and gains `aria-label={view.xp.label}` (it already carried the label from
  `view.xp.text`; it now reads the renamed field, so a screen reader still gets the number —
  `D45`/§10.1: a fill is never the only carrier).
- The vial's fill uses `data-step={view.vial.step}` and keeps
  `width: ${view.vial.fill * view.vial.box.w}px`.
- The local `vialStep` helper and the local `VIAL_STEPS` constant are deleted from this file;
  the view's exports are the only source.

`src/ui/hud/panels/party/party.css`:

- The `.party__xp-text` rule is deleted. No other selector, token or custom property moves.

- **Determinism:** reads no RNG and no clock; the same `HudState` + `PartyPanelUi` + viewport
  ⇒ deep-equal `PartyPanelView`. No new allocation per frame beyond the string `label` the
  view already built.

### Data

- No JSON, no i18n key, no `src/data/**` entry and no engine rule is added or changed. The
  three keys the readouts use (`hud.level`, `hud.xp`, `hud.vial`) already ship in both locales.

## 🧩 Data and configuration

| value | where | meaning |
| --- | --- | --- |
| `VIAL_STEPS = 3` | `view.ts` | one fill step per Pokevial charge; matches `POKEVIAL_MAX_CHARGES` and the three `--party-vial-fill-*` colours |
| `vialStep(0, 3) → 0` | `view.ts` | a spent vial paints no fill (the shipped component's `charges <= 0 ? 0` guard, moved into the model) |
| `vialStep(2, 3) → 2` | `view.ts` | two charges ⇒ the second colour step and a 66.67 px fill of the 100 px track |
| `xp.box` | `view.ts` | `{ x: 32, y: 38, w: 186, h: 8 }`, unchanged: the bar is the only XP paint |
| `vial.box` | `view.ts` | `{ x: 75, y: 54, w: 100, h: 20 }`, unchanged |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task changes.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-207` — every path must be in the exclusive list above.
  - This task has **one** `[live]` criterion; the rest are `[unit]`.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` is green, and `view.test.ts` asserts: `view.xp.label` equals
        `t('hud.xp', { xp: 480 })`, `expect(view.xp).not.toHaveProperty('text')`,
        `view.vial.step` is `0` for `pokevialCharges: 0`, `2` for `2` and `3` for `3` (the
        fixture `ROUTE` carries `2`), `vialStep(5, 3) === 3`, `vialStep(-1, 3) === 0` and
        `vialStep(2, 0) === 0`, and `view.vial.fill` is still `2 / 3` to six places.
  - [ ] `[unit]` `partyPanel.test.ts` walks the card's vnode tree (the `nodesWithClass`
        pattern `battleMoves.test.ts` uses, `vi.mock('preact/hooks')` where a hook is read)
        and asserts **no** node carries the class `party__xp-text`, **one** node carries
        `data-hud-party === 'vial'` with `data-step === String(view.vial.step)`, and the
        `data-hud-party === 'xp'` node's `aria-label` equals `view.xp.label`.
  - [ ] `[unit]` `grep -c "party__xp-text" src/ui/hud/panels/party/party.css` prints `0`, and
        `grep -rn "party__xp-text" src/` lists nothing at all.
  - [ ] `[unit]` `npm run build` is green and `git diff --name-only main...task-207` lists
        only the paths above.
  - [ ] `[live]` **Measured with the browser driver** (Playwright/CDP) on a route with a
        two-member party and `pokevialCharges: 2` of `3`, at `http://localhost:5175/?hud=dom`,
        viewport **1280×800**: `document.querySelector("[data-hud-party='vial']")` exists with
        `aria-valuenow="2"`, `aria-valuemax="3"` and `getBoundingClientRect().width === 100`,
        and its `.party__vial-fill` has `data-step="2"` and a rendered width of
        **66.66–66.68 px**; `document.querySelector('.party__xp-text')` is **null**;
        `document.querySelector("[data-hud-party='xp']")` exists, is 186 px wide and carries an
        `aria-label` that contains the run's XP number; and the level line
        (`[data-hud-party='level']`) still paints `Lv12` for a level-12 squad (the `hud.level`
        string is `Lv{level}`). Repeat at **390×844**: the same five reads hold.

## 📣 Coordination

- **For the Architect / Integration QA:** this task writes **only** §5's new
  `**The route header's readouts.**` block of `docs/hud-fidelity.md`, inserted after the
  `**The target step's prompt.**` block and before `## 6`. `[Task-201]` inserts
  `**The main menu's glow.**` between `**Chips.**` and `**The pad**`, and `[Task-212]`
  appends to `**Battle zones.**`; the hunks are disjoint, and Integration QA reads the
  combined §5 for lost lines. **No `docs/design-spec.md` line is taken** — the entry's old
  sentence named that file against a claim this task no longer edits (§3 already describes
  the party window as `[Task-202]` shipped it).
- **For the next batch:** `[Task-208]` (the panel shell: chip, drag, saved slot) mounts every
  panel through one shell and must keep these three readouts in the header it wraps; the
  model's `vial.step` is what a shell re-render reads, so it must not recompute it.
  `[Task-200]` retires the canvas chrome only; this card is DOM.
- **For the Orchestrator:** the panel this task edits is the one `[Task-202]` shipped; the
  claim over `party/**` is whole, so no other task of this batch may touch it.
- **No `SAVE_VERSION` step**, no draw, no save write: the panel only reads `HudRoute`.

## ⛔ Out of scope

- Re-laying out the header, moving the level/XP/vial boxes, or matching any new board
  measurement beyond the numbers frozen here.
- The Pokevial's **button** behaviour (`vialButtonAt`, `RouteScene.drinkPokevial`), the party
  rows, the portraits, the drag/reorder and the HP bar (`[Task-202]`).
- `src/ui/hud/panels/hud/**` (the collapsed-panel chip rail) and any chip.
- `docs/design-spec.md`, `src/i18n/**`, `src/ui/hud/state.ts`.
- New files, new keys, new dependencies.
