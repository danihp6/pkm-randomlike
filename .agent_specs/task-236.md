# Spec: Task-236 — The four folder READMEs that still describe the retired `?hud=dom` canvas path stop describing it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** docs (four folder maps and one comment line), no code change.
- **Role:** Dev.
- **Objective:** four `README.md` files under `src/ui/hud/panels/` still say that a
  canvas path exists and is switched by a `?hud=dom` flag — "with the flag off nothing
  here mounts and the canvas draws it exactly as before" — and two of them name
  canvas functions the tree no longer holds (`renderCommandMenu`, `messagePanel`,
  `messageText`). That path does not exist: the DOM layer **is** the HUD and it mounts
  on every boot. The task rewrites one paragraph per file so each folder's map
  describes only code that ships, and corrects the one comment line in
  `battle-command/view.ts` that names the same dead function. Each rule list keeps its
  numbering, its other sentences and its measured constants; the dead clauses are
  **deleted, never annotated**.
- **Environment:** worktree `../wt-pkm-236`, branch `task-236`.
- **Dependencies:** none. (Task-230 in the same batch holds `src/scenes/BattleScene.ts`,
  `src/scenes/BattleScene.test.ts` and two `docs/` files; this task shares no path with
  it.)

### Exclusive paths (single writer)

Nothing outside this list may be created or modified.

- `src/ui/hud/panels/party/README.md`
- `src/ui/hud/panels/map/README.md`
- `src/ui/hud/panels/battle-log/README.md`
- `src/ui/hud/panels/battle-command/README.md`
- `src/ui/hud/panels/battle-command/view.ts` — **its header comment only** (the
  `battleCommandView` doc block, line 68 today). Not one line of code, type or export.

No file is added or deleted, so no other folder `README.md` changes.

### Inputs (read-only)

- `src/ui/hud/mount.ts` (9-11 `hudRequested`, 24-44 `mountHud`), `src/main.ts` 38-45
  (the layer mounts on every boot, `?hud=dom` is only an alias).
- `src/ui/hud/panels/battle-command/view.ts` (`battleCommandView`, the grid's own
  arithmetic) and `src/ui/hud/panels/battle-moves/view.ts` (`battleMovesBox`).
- `src/scenes/BattleScene.ts` — read only, to name what ships now (the command card's
  model and the `confirmMenu` cursor; `src/scenes/BattleScene.test.ts` 106-110 already
  asserts the scene's source contains no `renderCommandMenu`).
- `src/ui/hud/panels/battle-log/view.ts` (`battleLogLayout`).

No `design/screens/<slug>.json` / `design/exports/<slug>.png` input applies: no rect,
panel, layout or visible string changes, so there is no board frame to read (`D57`).

## 🔒 Contract

- **No TypeScript surface changes.** No export is added, renamed or removed; the only
  edit to a `.ts` file is inside one comment block.
- **Each README's first paragraph** states the shipped fact in this shape (your own
  wording is fine, the facts and their absence are not):
  - the card **is** the panel and the canvas draws none of it;
  - `?hud=dom` is an inert alias kept only so old links still boot, and the layer
    mounts on every boot (`mountHud` is called unconditionally from `src/main.ts`);
  - the dead canvas names become the code that ships now — `battleCommandView`'s grid
    with `confirmMenu`'s cursor for the command window, `battleLogLayout`'s rect for
    the message box.
- **What must be gone from the tree afterwards** (these are the `[unit]` criteria):
  - no sentence conditioned on "the flag" (`with the flag off`, `while the flag is on`)
    anywhere under `src`;
  - no `renderCommandMenu` and no `messageText` under `src/ui/hud/`.
- **What must survive:** every rule list's numbering and its other sentences, every
  measured constant (the 250×72 / 147×94 cells, the 8 px gap, `--hud-row-radius`'s
  8 px, the 90 % glass, the 0.4 dim, the panel's fixed positioning), the `## Layout`
  file lists (each file's one-line role), and each file's `#` title line.
- The paragraphs get **shorter**, not longer: a clause that conditions on a path which
  does not exist is removed.
- **Determinism:** this task reads no RNG and touches no game rule.

### Data

None. No JSON key, no generated file, no asset.

## 🧩 Data and configuration

None.

## 🧪 Test and Validation Plan (for QA)

- **Method:** QA builds a per-task integration worktree (`qa-236`: `origin/task-236`
  merged onto the batch base), runs `npm ci --prefer-offline --no-audit --no-fund`
  once, then:
  - `grep -rn "with the flag off\|while the flag is on" src` — must print **nothing**.
  - `grep -rn "renderCommandMenu\|messageText" src/ui/hud` — must print **nothing**.
  - `npm test` — Vitest, headless; must be green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-236` against the exclusive paths above.
- **Acceptance criteria:**
  - [ ] `[unit]` The two greps above print nothing.
  - [ ] `[unit]` `npm test` and `npm run build` are green (a prose diff must not move
        either gate), and `git diff` shows **no** change under `src/ui/hud/` outside
        the four READMEs and the one comment block of
        `src/ui/hud/panels/battle-command/view.ts` (a `git diff -U0` on that file must
        show every changed line starting with ` *` or `/**`/` */`).
  - [ ] `[unit]` Nothing outside the exclusive paths list was touched by
        `git diff --name-only origin/main...task-236` (the `.agent_specs/task-236.md`
        commit is expected and excluded, as are `TODO.md`/`CHANGELOG.md`).
  - [ ] `[unit]` Each of the four READMEs keeps its `#` title, its `## Layout` list
        with every file it listed before, and its rule numbering; only the paragraph
        that named the flag and the dead canvas functions changed.
  - [ ] `[live]` **Both query strings boot the same HUD.** Measured at 1280×800 over
        CDP against `npm run dev`, reading DOM rects (`getBoundingClientRect`) — no
        screenshot:
        1. Load `/?hud=dom`, wait for the main menu and record
           `[data-hud-panel="main-menu"]`'s `getBoundingClientRect()`.
        2. Load `/?hud=phaser`, record the same rect.
        3. On **each** load: start a run through the starter pick, record
           `[data-hud-panel="party"]`'s rect, then start a wild battle through the
           shipped dev seam
           (`game.scene.getScene('Route').startDebugWildBattle('charmander', 5)` with
           `game` from `await import('/src/main.ts')`), record
           `[data-hud-panel="battle-command"]`'s rect, then press the command card's
           FIGHT row (`document.querySelector('[data-hud-command="fight"]').click()`)
           and record `[data-hud-panel="battle-moves"]`'s rect.
        **PASS** when every one of those three panels exists on **both** query strings
        and its rect is identical across them (x, y, width and height equal within
        0 px). Report the three rects per query string and the element counts.
- **Browser budget:** exactly one `[live]` criterion; everything else is a grep, a
  gate or a diff read.

## 📣 Coordination

- For the next batch: this task writes prose only. The four READMEs are the folders'
  own maps (`AGENTS.md`'s README rule), so a later task that adds or deletes a file in
  one of those four folders keeps them current.
- For the board: nothing here is a fidelity claim — it only removes sentences that
  described a path the tree retired.

## ⛔ Out of scope

- Do **not** edit `src/ui/hud/mount.ts`, `src/main.ts`, `src/ui/hud/README.md`,
  `docs/hud-fidelity.md` or any other file: the sentences are the whole task.
- Do **not** change `hudRequested`'s signature or "clean up" its unused argument.
- Do **not** reflow or reformat the READMEs, rename their headings, or touch a
  measured constant. No Prettier pass over prose.
- Do **not** add a new README elsewhere, and do not touch `src/scenes/BattleScene.ts`
  (its own test already forbids `renderCommandMenu`).
