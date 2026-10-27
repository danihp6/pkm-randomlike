# Spec: Task-184 — A battle plays on a tree without the packed art

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (+ its folder's asset contract). No engine rule, no
  data table, no new dependency.
- **Role:** Dev.
- **Objective:** a wild battle **starts, plays its entry beat and reaches the
  four-command menu on a checkout that has none of the packed art**. Today it
  cannot: `BattleScene.buildMonAnimations` registers one idle animation per
  battle sheet from the **manifest's** frame count, the sheet's texture is not in
  the cache on a pack-less tree, and Phaser's `Animation` therefore builds a
  **frame-less** animation — every `{ key, frame }` whose texture is absent is
  dropped by `Animation.getFrames`, which warns `Texture "%s" not found` and
  `continue`s. `showMon` then calls `sprite.play(anim)`; `AnimationState.load`
  sets `currentFrame = anim.frames[0]` (`undefined`) and `Animation.getFirstTick`
  dereferences it (`state.currentFrame.duration`), so `startEntry` throws inside
  `refreshHud` → `syncMonSprites` → `showMon`, `create()` never returns, the
  scene never reaches `RUNNING`, and the battle sits frozen on the entry frame
  with `mode === 'entry'`, `entryTimer === null` and no scene input. After this
  task the same tree draws `BootScene`'s procedural `battle:mon` sprite, the
  animation is only registered for a texture that is really loaded and never
  longer than that texture's own `frameTotal`, and `sprite.play` is guarded, so
  the beat's timer chain and the command menu survive. `src/assets/README.md`
  states the contract the fix implements. **Round 2 (QA corrective):** the same
  clean checkout also throws `unknown audio cue: cry-pidgey` when the battle
  announces the wild, because the cue table is built from the packed
  `src/assets/audio/*.wav` (gitignored) while `src/data/audio/cries.json` still
  names the cue, so `playCry` → `audioCue` throws and the game loop freezes. A cue
  the checkout never packed is **silence**, not an error: the audio players guard
  the lookup and the battle reaches its menu with no audio pack either.
- **Environment:** worktree `../wt-pkm-184`, branch `task-184`.
- **Dependencies:** none. Nothing in this task reads a file another task of
  Batch 81 produces.

### Exclusive paths (single writer)

- `src/scenes/BattleScene.ts`
- `src/scenes/BattleScene.test.ts` (**new**, co-located test — see Coordination)
- `src/scenes/README.md` (one role line for the new test file — the folder's map)
- `src/assets/README.md`
- `src/audio/cues.ts`, `src/audio/cues.test.ts`, `src/audio/audio.ts`,
  `src/audio/README.md` (round 2: the missing-cue guard)

**Nothing outside this list.** Do not touch `src/scenes/RouteScene.ts`,
`src/scenes/panels/detail.ts` or `src/ui/hud/panels/detail/evolution.ts` (`[Task-185]`),
`docs/design-spec.md`, `docs/tech-decisions.md`, `docs/maps-spec.md`, `package.json`,
`src/main.ts`, `vite.config.ts`, `src/data/dex/**`,
`scripts/assets/build-placeholders.mjs`, `src/assets/placeholders/**`, `.gitignore` or
`public/`.

### Inputs (read-only)

- `src/data/pokemonSprites.ts` — `PokemonSpriteSheet`, `pokemonSprite`,
  `pokemonIdleAnimKey`; the battle sheets are served from `public/anil/` and the
  manifest is `src/data/anil/pokemon-sprites.json`.
- `src/scenes/BootScene.ts` — `BATTLE_MON_TEXTURE_KEY = 'battle:mon'` (the
  procedural 40×44 placeholder mon) and `BATTLE_PLATFORM_TEXTURE_KEY`.
- `src/render/spriteBounds.ts` — `spriteContentBounds`, already called by
  `showMon`; do not change it.
- `src/ui/beats.ts` — `entryBeat`; a wild, non-reduced-flash beat is
  `fade 320 + flash 220 + foe-appear 300 = 840 ms`.
- `src/input/input.ts` — `actionKeys`, and its module-scope loop over
  `Phaser.Input.Keyboard.KeyCodes` (matters for the test's mock).
- `src/dev/env.ts` — `IS_DEVELOP` (the dev server loads `.env.development`,
  `ENVIRONMENT=develop`, so `globalThis.__pkmBattle` exists on `npm run dev`).
- `src/engine/run/battleLink.ts` (`BattleLaunch`), `src/engine/battle/fighter.ts`
  (`createFighter`, `snapshotFighter`) — only for the QA live recipe.
- `scripts/assets/build-placeholders.mjs` (lines 1–18 and 63–105) — the
  placeholder packer's contract: **a blank carries the real file's pixel size**.
- `node_modules/phaser` **3.90.0** — `src/textures/Texture.js` (`frameTotal`),
  `src/textures/TextureManager.js` (`exists`, `get`, `getFrame`),
  `src/animations/Animation.js` (`getFrames`, `getFirstTick`),
  `src/animations/AnimationState.js` (`load`, `startAnimation`),
  `src/animations/AnimationManager.js` (`create`, `exists`).
- `src/i18n/en.ts` lines 361–364 — `battle.command.{fight,bag,switch,run}` are
  `FIGHT` / `BAG` / `SWITCH` / `RUN`.
- `AGENTS.md`, `docs/agent-spec-template.md`.

### What is *not* the bug (read this before you change anything)

The plan entry says the placeholder PNG "holds the frames the pack measured" and
that a shorter texture is what throws. **Neither half holds in this tree**, and a
fix written against that story does not work:

- There is **no** committed placeholder for the battle sheets. `pokemonSprite`
  returns `url: ${BASE_URL}anil/<folder>/<file>` straight out of the gitignored
  `public/anil/`, with no `import.meta.glob` fallback (unlike
  `src/data/itemIcons.ts`). On a clone/worktree without the pack the URL 404s,
  the loader never registers the texture key, and `textures.get(key)` answers
  Phaser's `__MISSING` texture.
- A texture that **exists** but has fewer frames does **not** throw:
  `Texture.get(frame)` falls back to the first frame with a `console.warn`, so
  `anims.create` keeps N frames that all point at frame 0. Only a texture that is
  **absent from the manager** makes `TextureManager.getFrame` return `undefined`
  for *every* frame, and only then is the animation frame-less.
- `this.anims.exists(key)` is `true` for that frame-less animation
  (`AnimationManager.exists` is `anims.has(key)`), so the `anims.exists` guard on
  its own would not prevent the throw. The **load-bearing** rule is: never
  register an animation for a sheet whose texture is not in the cache — which is
  exactly what `monIdleFrames(..., 0) → []` below encodes. The guard is the
  second line of defence the plan asks for, and stays.

## 🔒 Contract

All of it lives in `src/scenes/BattleScene.ts`. **No new production file, no new
export outside this file, no new dependency.**

### 1. The pure helper — module level, exported

Insert **immediately after `const MON_ANIM_FPS = 30;`** (line 334 today), keeping
the file's module-level-helper section together:

```ts
/**
 * The frame indices one sheet's idle loop draws: the manifest row's frames,
 * clamped to the frames the loaded texture actually has. `0` available frames is
 * a texture that never loaded (a tree without the pack), and answers an empty
 * list so no animation is registered for it — a frame-less Phaser animation
 * throws when it is played (`Animation.getFirstTick`).
 */
export function monIdleFrames(
  manifestFrames: number,
  textureFrameTotal: number,
): readonly number[] {
  const wanted = Math.trunc(manifestFrames);
  const available = Math.trunc(textureFrameTotal);
  if (!Number.isFinite(wanted) || !Number.isFinite(available)) return [];
  if (wanted < 1 || available < 1) return [];
  return Array.from({ length: Math.min(wanted, available) }, (_, frame) => frame);
}
```

Frozen semantics — this table is the contract, no case is optional:

| `manifestFrames` | `textureFrameTotal` | returns |
| --- | --- | --- |
| 6 | 6 | `[0, 1, 2, 3, 4, 5]` |
| 6 | 1 | `[0]` (the clamp: indices `≥ frameTotal` are never emitted) |
| 6 | 0 | `[]` (texture absent — the pack-less tree) |
| 4 | 9 | `[0, 1, 2, 3]` (the manifest is the ceiling too, never grows) |
| 0, −3, `NaN`, `Infinity` | anything | `[]` |
| anything | −1, `NaN`, `Infinity` | `[]` |

- Reads **no RNG**, no DOM, no `Phaser` value at call time; pure and total.
- The name, the parameter order (`manifestFrames` first) and the `readonly
  number[]` return are frozen: the test and QA both call it.

### 2. `buildMonAnimations` — target shape

Current (lines 2226–2238):

```ts
  /** One looping idle animation per loaded sheet, off the strip's own frame count. */
  private buildMonAnimations(): void {
    for (const sheet of this.battleSheets()) {
      const key = pokemonIdleAnimKey(sheet);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: Array.from({ length: sheet.frames }, (_, frame) => ({ key: sheet.textureKey, frame })),
        frameRate: MON_ANIM_FPS,
        repeat: -1,
      });
    }
  }
```

Required behaviour after the edit:

1. skip a sheet the anim manager already has (unchanged);
2. **skip a sheet whose texture is not in the texture cache** — compute the
   available frame count as `this.textures.exists(sheet.textureKey) ?
   this.textures.get(sheet.textureKey).frameTotal : 0`;
3. build the frame list with `monIdleFrames(sheet.frames, available)` and
   **skip when it is empty**;
4. `this.anims.create({ key, frames: frames.map((frame) => ({ key: sheet.textureKey, frame })), frameRate: MON_ANIM_FPS, repeat: -1 })`.

Keep the existing doc comment's first line and extend it with the clamp's "why"
(one comment, the repo's convention for a non-obvious rule). The method stays
`private`, keeps its name and its single call site (`create()`, line 850).

### 3. `showMon` — target shape

Current tail (lines 2265–2295):

```ts
  private showMon(side: SideId, fighter: BattleFighter, kind: PokemonSpriteKind, slot: Slot = 0): void {
    const sheet = pokemonSprite(fighter.speciesId, kind, {
      shiny: fighter.shiny,
      female: fighter.gender === 'female',
    });
    if (!sheet) return;
    const sprite = this.monSprite(side, slot);
    const anim = pokemonIdleAnimKey(sheet);
    // … sheetContent / scale / origin …
    sprite.setTexture(sheet.textureKey, 0).setScale(scale);
    sprite.play(anim);
  }
```

Two additions, nothing else moves:

1. **Immediately after `if (!sheet) return;`** add
   `if (!this.textures.exists(sheet.textureKey)) return;`
   — a sheet that never loaded keeps whatever the sprite already draws, which is
   `BootScene`'s procedural `battle:mon` in a fresh battle. It must sit **before**
   `sheetContent`/`setTexture`, so `textures.get()` is never asked to measure the
   `__MISSING` texture and the origin/scale are not recomputed from it.
2. **Replace `sprite.play(anim);`** with

   ```ts
   if (!this.anims.exists(anim)) return;
   sprite.play(anim);
   ```

   i.e. the texture and the scale are set first, then a missing animation simply
   draws a still sprite instead of throwing. Do **not** add `sprite.stop()` or
   any other animation bookkeeping.

Everything else in the file stays byte-identical: `preload`, `releaseMonSprites`,
`sheetContent`, the sprite geometry, the entry beat, the feed, the menus and the
`MON_ANIM_FPS` value. This task changes **no** timing, **no** layout and **no**
battle rule.

### 4. The cue table's missing rows (round 2)

`src/audio/cues.ts` builds `AUDIO_CUES` from the packed `src/assets/audio/*.wav`
(Vite's `import.meta.glob`) plus the six hand rows, so a checkout without the rip has
no `cry-*` or `move-*` row at all — while `src/data/audio/cries.json` and
`moveSounds.json` still name the cue. `audioCue(id)` throws on a missing row and
`playCry` / `playMoveSound` / `playCue` call it unguarded, so `BattleScene`'s
announcement throws inside the scene's own update and freezes the loop (QA measured
`Uncaught Error: unknown audio cue: cry-pidgey`, `game.loop.frame` stuck, `mode`
never leaving `'entry'`).

Add one exported predicate in `src/audio/cues.ts`, beside `audioCue`, and guard the
three players:

```ts
/** True when this checkout packed a row (or a hand row) for `id`. */
export function hasAudioCue(id: AudioCueId): boolean {
  return CUE_BY_ID.has(id);
}
```

- `src/audio/cues.ts`: `hasAudioCue` exactly as above. `audioCue` keeps throwing —
  its own test pins that, and a typo is still a caller bug, not a missing file.
- `src/audio/audio.ts`: `playCue` returns before `audioCue` when
  `!hasAudioCue(cueId)`; `playCry` returns `false` when the resolved id is null **or**
  `!hasAudioCue(cueId)`; `playMoveSound` computes
  `const cueId = moveSoundCueFor(moveId) ?? HIT_CUE_ID;` and returns `false` when
  `!hasAudioCue(cueId)`. Nothing else moves: no new global, no new event, no change
  to `startSound`, to the autoplay gate, to `preloadAudio` or to any id.
- `src/audio/README.md`: one sentence in the paragraph that documents `audioCue(id)`
  throwing (around line 27): a cue this checkout never packed is **silence** —
  `hasAudioCue` gates the three players — while an id with no row still throws for a
  caller.
- Determinism: no RNG, no clock, no DOM; a pure map lookup.

### 5. Determinism

Reads no `Rng` stream and touches no seed. A fixed-seed battle's event log, damage
rolls and order are untouched by this task.

### 6. Data

No key, no table, no default value is introduced, changed or frozen.

## 🧩 Data and configuration

None. The single "configuration" this task freezes is the placeholder rule written
into `src/assets/README.md` (below), which is prose, not data.

### `src/assets/README.md` — the exact documentation change

Append **one** rule, as item **5**, to the existing `## Rules` list (which today
ends at rule 4, "Adding a sheet means adding a registry entry in
`src/data/tilesets/index.ts`"). Wording is the deliverable; keep it as one item:

```md
5. A **battle must play on a tree without the pack**. The battle Pokémon sheets are
   the exception to the row above: they are served straight out of the gitignored
   `public/anil/` (see the paragraph under the table) and have **no** committed
   blank of their own, so a checkout without the pack answers every sheet URL with
   a 404 and the key never reaches the texture cache. `BattleScene` therefore
   keeps the procedural `battle:mon` sprite `BootScene` generates, registers an
   idle animation **only** for a texture that loaded and never longer than that
   texture's own `frameTotal` (`monIdleFrames`), and skips the `play` when the
   animation is absent. A placeholder that does exist (the `placeholders/` row)
   still carries the real file's pixel size — the animation adapts to the frames
   that loaded, never the other way round.
```

No other line of that file changes; the `placeholders/` table row and the Añil
paragraph stay as they are.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the new
    `src/scenes/BattleScene.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npx vitest run src/scenes/BattleScene.test.ts` — the clamp's own file.
  - `git diff --name-only main...task-184` audited against the exclusive paths.
  - The `[live]` pass needs a dev server and Chromium over CDP. **A QA worktree is
    pack-less by construction** (a worktree is a fresh checkout; `public/anil/` and
    `src/assets/audio/` are both gitignored and `npm ci` never creates them), so
    nothing is renamed, hidden or stashed: verify with `test ! -e public/anil`
    (prints nothing), `git check-ignore -q public/anil/` (exit 0) and
    `test ! -e src/assets/audio || [ -z "$(ls -A src/assets/audio)" ]`. Do **not**
    copy the rip or the pack in from `$ASSETS_ROOT` for this pass: the criterion is
    the tree that has neither.

### The test file the dev writes (`src/scenes/BattleScene.test.ts`)

`BattleScene.ts` imports Phaser at line 1, so the test must not load it. These two
hoisted mocks are the **whole** Phaser surface the module graph needs at import
time (verified against the source: `BattleScene` extends `Phaser.Scene`;
`src/input/input.ts` iterates `Phaser.Input.Keyboard.KeyCodes` at module scope;
`new Phaser.Math.Vector2()` is a class *field* and never runs here;
`./BootScene` is imported for two constants):

```ts
import { describe, expect, it, vi } from 'vitest';
import { monIdleFrames } from './BattleScene';

vi.mock('phaser', () => {
  class Scene {}
  return { default: { Scene, Input: { Keyboard: { KeyCodes: {} } } } };
});

vi.mock('./BootScene', () => ({
  BATTLE_MON_TEXTURE_KEY: 'battle:mon',
  BATTLE_PLATFORM_TEXTURE_KEY: 'battle:platform',
}));

describe('monIdleFrames', () => {
  it('keeps the manifest row when the texture is whole', () => {
    expect(monIdleFrames(6, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('clamps to a one-frame texture', () => {
    expect(monIdleFrames(6, 1)).toEqual([0]);
  });

  it('answers nothing for a texture that never loaded', () => {
    expect(monIdleFrames(6, 0)).toEqual([]);
  });

  it('never grows past the manifest row', () => {
    expect(monIdleFrames(4, 9)).toEqual([0, 1, 2, 3]);
  });

  it('answers nothing for a broken input', () => {
    expect(monIdleFrames(0, 3)).toEqual([]);
    expect(monIdleFrames(Number.NaN, 3)).toEqual([]);
    expect(monIdleFrames(6, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});
```

If the import throws on a module **other** than `phaser`/`./BootScene`, mock that
module's export surface the same way (one `vi.mock` line) — never weaken or delete
a case. Report anything you had to mock in your task summary.

### Acceptance criteria

- [ ] `[unit]` `npm run build` (`tsc --noEmit && vite build`) exits 0.
- [ ] `[unit]` `npx vitest run src/scenes/BattleScene.test.ts` passes all five
      cases above, and the full `npm test` is green with the new file included
      (`monIdleFrames(6, 1)` reads `[0]`, `monIdleFrames(6, 0)` reads `[]`).
- [ ] `[unit]` `git diff --name-only main...task-184` lists exactly the four paths
      above **plus** `.agent_specs/task-184.md` (the spec travels in the branch by
      protocol and is dropped at merge) — nothing else, and
      `git diff main...task-184 -- src/scenes/BattleScene.ts` shows no change outside
      `monIdleFrames`, `buildMonAnimations` and the two additions in `showMon`. The
      `src/scenes/README.md` diff is exactly the one added `## Layout` line above
      (2 added lines counting the wrap, 0 removed).
- [ ] `[unit]` **The missing cue table is silence, not a throw (round 2).** In
      `src/audio/cues.test.ts`, `hasAudioCue('faint')` is `true`, and
      `hasAudioCue('cry-not-a-cry' as AudioCueId)` is `false` while
      `audioCue('cry-not-a-cry' as AudioCueId)` still throws. Also assert that every
      id `cries.json` names and this checkout did not pack answers `false` (read
      `src/data/audio/cries.json` through its own accessor and compare with the
      table's ids). `npm test` stays green.
- [ ] `[unit]` **The three players guard.** `git diff main...task-184 -- src/audio/`
      shows `hasAudioCue` in `cues.ts`, and a `!hasAudioCue(...)` guard in
      `playCue`, `playCry` and `playMoveSound` in `audio.ts`; no other line of
      `audio.ts` changes.
- [ ] `[live]` **The command menu is reached on a pack-less tree.** On the QA
      worktree with no `public/anil/`, start `npm run dev -- --port <free>
      --strictPort`, open `/` over CDP, and launch a wild battle directly (this is
      the whole recipe — no route, no starter, no menu walking):

      ```js
      (async () => {
        const main = await import('/src/main.ts');
        const { createFighter, snapshotFighter } = await import('/src/engine/battle/fighter.ts');
        const lead = createFighter({ id: 'p1', speciesId: 'charmander', level: 5, learnsetSeed: 'battle184' });
        main.game.scene.start('Battle', {
          trigger: { kind: 'wild', speciesId: 'pidgey', level: 3, key: 'grass:0' },
          player: [snapshotFighter(lead)],
          bag: [], xp: 0, seed: 1, runSeed: 'battle184', routeIndex: 1,
          canCapture: true, firstCatch: true, aiLevel: 'normal',
        });
        return true;
      })()
      ```

      **Measurement:** poll `({ mode: __pkmBattle.mode, items:
      __pkmBattle.menuItems.map((i) => i.label), enabled: __pkmBattle.menuItems[0]?.enabled })`
      every 100 ms for at most 3 s after `game.scene.isActive('Battle')` is true;
      it must read `mode === 'menu'`, `items` exactly
      `['FIGHT','BAG','SWITCH','RUN']` and `enabled === true`. (Before the fix
      `mode` stays `'entry'` for ever and `menuItems` stays `[]`.) **Also:** attach
      a CDP `Runtime.consoleAPICalled` / `Runtime.exceptionThrown` listener (or read
      `window.onerror`) before launching, and fail if any line contains
      `unknown audio cue` during the whole 3 s — on this tree the rip is absent and
      the cry must be silence; and `game.loop.frame` must advance between two polls
      100 ms apart (the loop is not frozen).
- [ ] `[live]` **The entry beat's timer chain is alive and `E` cuts it short.** In
      the same tab, relaunch with the recipe above and, at the first 25 ms poll
      where `__pkmBattle.mode === 'entry'`, record
      `{ mode, timer: __pkmBattle.entryTimer !== null }`; it must read
      `mode === 'entry'` **and** `timer === true` (a wild entry beat lasts 840 ms;
      before the fix `entryTimer` is `null` while `mode` stays `'entry'`). Then
      dispatch one confirm key over CDP —
      `Input.dispatchKeyEvent { type: 'keyDown', key: 'e', code: 'KeyE',
      windowsVirtualKeyCode: 69, nativeVirtualKeyCode: 69 }` followed by the
      matching `keyUp` (`E` is `DEFAULT_KEYBINDS.confirm`) — and poll every 25 ms:
      `__pkmBattle.mode` must read something other than `'entry'` within 100 ms,
      and the criterion above (menu open, four labels) must still hold afterwards.
- [ ] `[live]` **The missing pack draws the placeholder mon, not a missing
      texture.** In the same battle, once the menu is open, read
      `__pkmBattle.foeSprite.texture.key` and
      `__pkmBattle.playerSprite.texture.key`: both must be `'battle:mon'` — the
      procedural placeholder `BootScene.generateTexture(BATTLE_MON_TEXTURE_KEY,
      40, 44)` builds — and neither may be `'__MISSING'`. (Before the fix
      `showMon` had already pointed both at the unloaded sheet key / `__MISSING`.)
      Say which method produced each piece of evidence.

## 📣 Coordination

- **For the Architect: the plan's claim line is short by two paths.** `[Task-184]`
  claims `src/scenes/BattleScene.ts` and `src/assets/README.md` and simultaneously
  owes a `[unit]` test; `src/scenes/` has no `BattleScene.test.ts` today, so this
  spec adds the co-located **`src/scenes/BattleScene.test.ts`**, and with it the
  `src/scenes/README.md` role line that `AGENTS.md`'s folder map owes for a new file.
  Both are new/unclaimed by every other task of this batch (`[Task-185]` holds
  `panels/detail.ts` + `ui/hud/panels/detail/evolution.ts`, `[Task-186]` holds
  `docs/maps-spec.md` §7; `[Task-181]` is blocked and out of the batch, so
  `RouteScene.ts` is nobody's here but still is not this task's). The README change
  is exactly one line, added to `## Layout` after the `BattleScene.ts` entry:

  ```md
  - `BattleScene.test.ts` — the battle scene's headless test of its sprite-animation
    frame selection.
  ```

  No other line of `src/scenes/README.md` changes.
- **For the Architect: the plan's cause narrative is wrong; the fix shape it asks
  for is right.** The battle sheets have no committed placeholder (`public/anil/`
  is gitignored and holds no fallback), so the clean-clone failure is a
  **frame-less** animation (texture key absent → every frame dropped → 
  `Animation.getFirstTick` on an `undefined` `currentFrame`), not a short
  placeholder PNG; and `anims.exists` is `true` for the frame-less animation, so
  the clamp must be fed `0` for a texture that is not in the cache. Both facts are
  written into the contract above.
- **For [Task-187] (Batch 82, `src/assets/placeholders/**`):** this task adds no
  blank for `public/anil/`, and must not — a real frame-size blank would still
  have to be clamped at play time. Task-187 must not touch
  `src/scenes/BattleScene.ts`; its rule 5 wording lives in `src/assets/README.md`
  and this task writes only that rule's item 5, so a later edit of any other item
  is safe.
- **For QA:** the `[live]` recipe needs no route, no starter and no debug menu:
  `game` is exported from `src/main.ts` and `game.scene.start('Battle', launch)`
  is enough (`ScenePlugin.setVisible` is null-safe when `Route` is not running).
  `__pkmBattle` is set *before* `startEntry` runs, so its presence does **not**
  prove the scene is healthy — read `mode`, `entryTimer` and the sprite texture
  keys.

## ⛔ Out of scope

- No placeholder art for `public/anil/`, no new atlas, no `assets:pack` run, no
  `.gitignore`, `src/assets/placeholders/**` or `scripts/**` change.
- No change to `preload()` (the sheets are still requested and still 404 on a
  pack-less tree; the 404 is Phaser's, not an error this task suppresses), to
  `releaseMonSprites()`, to `sheetContent`/`spriteContentBounds`, to the idle
  `MON_ANIM_FPS`, to the sprite geometry or to the entry beat's durations.
- No guard for the portraits, item icons, move FX, trainer, type/status icons or
  any other atlas: they all resolve to a committed placeholder or to silence
  already, and a missing key for them degrades without throwing.
- No change to any other `sprite.play`/`moveFx` call site, to `RouteScene`, to the
  panels, to the engine, to the i18n tables or to any `docs/` file other than
  `src/assets/README.md`.
- No refactor of `BattleScene.ts` beyond the three hunks above, no new module, no
  new export other than `monIdleFrames`, no new dependency, no test of the scene
  class itself (only of `monIdleFrames`).
