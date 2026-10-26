# Spec: Task-164 — A level-up that crossed no move shows no panel at all

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + UI helper + i18n.
- **Role:** Dev.
- **Objective:** the human rejects the transient **"X grew to Lv N!"** panel: the only
  panel a level-up may raise is the **"X learned Y!"** modal, and only when the level-up
  actually crossed a move. `playLevelUp` already gates the learn modal
  (`showLearnPopup` returns when no beat carries a learned id), but its tween completion
  raises a `levelUpNotice` for **every** beat — that is the panel the report names. The
  notice is `[Task-50]`'s line and its own comment says so ("Every level-up says so, not
  only the ones that crossed a move"), so this task **reverses a decision**: delete the
  notice loop, retire the factory and its i18n key, and keep everything else the beat
  does (the level-counter tween, the portrait flash, the learn modal, the evolution
  popup).
- **Environment:** worktree `../wt-pkm-164`, branch `task-164`, base `origin/main`
  @ `e241f9f`.
- **Dependencies:** none.

### Exclusive paths (single writer)

**Nothing outside this list.** `src/scenes/RouteScene.ts` is claimed by **Task-164
alone in this batch**; `src/scenes/panels/detail.ts` is **not** yours (read only).

- `src/scenes/RouteScene.ts`
- `src/ui/notice.ts`
- `src/ui/notice.test.ts`
- `src/ui/beats.test.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/design-spec.md` — **§3 only**

### Inputs (read-only)

- `AGENTS.md`
- `src/scenes/panels/detail.ts` (`showLearnPopup`: the modal and its early return)
- `src/ui/beats.ts` (`LevelUpBeat`, `learned`, `fromLevel`, `toLevel`)
- `src/ui/notice.ts` (the `Notice` type and the other factories)
- `src/ui/hud/state.ts` (the `notice` field the retired factory fed)
- `docs/design-spec.md` §3

## 🔒 Contract

### TypeScript

- **Remove** `levelUpNotice(name: string, level: number): Notice` from
  `src/ui/notice.ts`, together with its doc comment. No re-export, no alias.
- **Remove** the `levelUpNotice` import and its call site in `RouteScene.ts`. The tween
 's `onComplete` keeps `clearPartyPortraitTints()`, `this.refreshHud()` and
  `showLearnPopup(this.panelHost, beats)` **in that order**; nothing raises a notice.
- The `Notice` type, `showNotice`, every other factory and the HUD's `notice` field stay
  exactly as they are (other producers still use them).
- **Remove** the `'notice.levelUp'` key from **both** `src/i18n/en.ts` and
  `src/i18n/es.ts`. No other key moves; the two files keep their key order.
- `src/ui/beats.test.ts` keeps pinning `learned: []` for a move-less level-up and gains
  the assertion that such a beat still reports `fromLevel`/`toLevel` (the counter still
  animates).
- `src/ui/notice.test.ts` drops every `levelUpNotice` case and every use of it as a
  generic notice sample: substitute another shipped factory (`itemUsedNotice`,
  `eggHatchNotice`, …) wherever a `Notice` instance is needed as a fixture. The suite
  must keep testing the notice pipeline with the same coverage.

### Data

- `docs/design-spec.md` §3: the "Every level-up also says so in a transient notice …
  holding 2.6 s" sentence goes; the modal's sentence stays and reads as the **only**
  panel a level-up raises.

## 🧩 Data and configuration

- i18n: one key retired from each locale. No new key. No `SAVE_VERSION` step.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task edits.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-164` audited against the exclusive paths.
  - One `[live]` criterion, so one browser pass; the rest are commands.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[unit]` `grep -rn "levelUpNotice" src/` returns no hit, and
    `grep -rn "notice.levelUp" src/` returns no hit.
  - [ ] `[unit]` `npm test -- notice i18n beats` passes: the i18n parity suite is green
    (both locales lost the key), `notice.test.ts` has no `levelUpNotice` reference, and
    `beats.test.ts` pins `learned: []` with `fromLevel`/`toLevel` for a move-less
    level-up.
  - [ ] `[unit]` `RouteScene.ts`'s `playLevelUp` has no `showNotice` call and still
    calls `showLearnPopup` after `refreshHud`.
  - [ ] `[live]` In the running dev build (`?hud=dom`), win a battle that levels the
    squad **without** crossing a move: for 3 s after the win, no element anywhere in
    `#hud`/`document.body` shows text matching `/grew to Lv/`, and no learn modal is
    present (the modal's title text is absent). Then win a level-up that **does** cross
    a move: the modal's text is present and the `/grew to Lv/` pattern is still absent
    at every sampled moment. Report the two sampled text readings and the method (CDP
    `Runtime.evaluate` reading `document.body.innerText` at ≥3 samples per win, plus
    the canvas frame count unchanged as a sanity read).

## 📣 Coordination

- For the Architect: `[Task-50]`'s "every level-up says so" line is reversed by this
  task; the CHANGELOG entry must say **reversal**, not new feature.
- For the next batch: the `Notice` seam keeps its other producers; a future panel that
  wants the level-up back would add a new factory, not resurrect this one.

## ⛔ Out of scope

- The learn modal (`showLearnPopup`, `panels/detail.ts`), the evolution popup, the
  counter tween, the portrait flash or the HUD renderer.
- Any other notice factory, the HUD's `notice` field, or `docs/routes-spec.md` §6.
- A new "level up" key or a renamed one.
