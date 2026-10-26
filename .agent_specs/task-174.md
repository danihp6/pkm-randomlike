# Spec: Task-174 — The room's Endure spares a hit only at full HP, and breaks when it does

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (+ two doc blocks).
- **Role:** Dev.
- **Objective:** the **room field** `endure` (`RoomFieldEffects.endure`,
  `src/engine/battle/state.ts`, seeded from `src/data/battlefields.ts` row `endure`
  and from `BOSS_OPENINGS[0]`) currently spares a lethal hit whenever the target is
  above 1 HP, for the whole battle, on every hit. After this task it spares **one**
  lethal hit, and only when the target **entered that hit at full HP**; that fighter
  is then spent, a second lethal hit KOs it. The move `Endure` (`volatiles.endure`)
  and the Sturdy ability line are untouched.
- **Environment:** worktree `../wt-pkm-174`, branch `task-174`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/engine/battle/turn.ts`
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/fighter.ts`
- `src/engine/battle/fighter.test.ts`
- `docs/battle-spec.md` — **§4 only, and inside it only the
  `- **Endure**: …` bullet** (the sixth bullet of the room-field list, currently
  "a lethal hit leaves the target at exactly 1 HP, for the whole battle, on both
  sides."). `§4` is shared with another task in this batch that owns the
  **`- **Item-driven retypes**`** bullet: do not touch that one, do not reflow the
  file, and do not edit any other section.
- `docs/maps-spec.md` — **§7's `### A room's battle condition` only, and inside it
  only the bullet that begins "The six whole-field rows (radiant, Dark Aura, Fairy
  Aura, all-types, Endure and the crit stage)". `§7` is shared with another task that
  owns the **`### The economy (Poké Dollars)` Mart-stock** bullets: do not touch
  those.

Nothing else. No `src/data/` file, no scene, no `package.json`, no generated file.

### Inputs (read-only)

- `AGENTS.md`, `docs/battle-spec.md`, `docs/maps-spec.md`, `docs/tech-decisions.md`.
- `src/engine/battle/state.ts` (`RoomFieldEffects`, `roomField`), `damage.ts`,
  `status.ts`, `effects/items.ts` (the `survive` held-item twin), `src/data/items.ts`
  (the `survive` row, Focus Band / Focus Sash), `src/data/battlefields.ts`,
  `src/data/bosses.ts`, `src/engine/battle/helpers` used by `turn.test.ts`.

## 🔒 Contract

### TypeScript

`src/engine/battle/fighter.ts` — one new volatile, added to `Volatiles` beside the
other battle-long flags, with the same shape as its neighbours:

```ts
/** The room's `endure` field has already spared this fighter since it entered the field. */
roomEndureUsed: boolean;
```

`emptyVolatiles()` (`src/engine/battle/fighter.ts`) sets it to `false`, so
`clearVolatiles()` — which every switch-out already calls — re-arms the field for a
fighter that leaves and comes back. That is the whole rule: **one spare per stay on
the field, per fighter**.

`src/engine/battle/turn.ts` — the clamp inside the per-hit loop (currently
`const roomEndure = state.roomField.endure && hitTarget.hp > 1;`) becomes:

```ts
const roomEndure =
  state.roomField.endure && hitTarget.hp === hitTarget.maxHp && !hitTarget.volatiles.roomEndureUsed;
```

and when the clamp fires **because of the field** it spends it:

```ts
if ((moveEndure || roomEndure) && damage >= hitTarget.hp) {
  damage = Math.max(0, hitTarget.hp - 1);
  if (roomEndure) hitTarget.volatiles.roomEndureUsed = true;
  pushText(state, 'battle.log.enduredHit', { name: hitTarget.name });
}
```

- `hitTarget.hp` is the pre-hit HP at that point, so `hp === maxHp` means "entered
  the hit at full HP".
- The move's `Endure` keeps its shipped rule (it spares **every** hit of the turn it
  was used, `volatiles.endure` is consumed by the turn, not by this task).
- **Determinism:** the rule adds **no RNG draw** and no new stream. The same seed
  produces the same battle byte for byte apart from the spared damage itself.
- No Phaser import, no DOM, no allocation in the loop beyond the boolean write.

### Data

No new keys and no balance value. The `endure` row of `ROOM_BATTLEFIELDS`, its tint
and its alpha stay exactly as they are, and `BOSS_OPENINGS` is not touched.

## 🧩 Data and configuration

Nothing new. The rule reads `state.roomField.endure` (already merged in
`createBattle`) and the fighter's own volatile.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-174` against the exclusive paths above.
  - One browser pass for the single `[live]` criterion (dev server + CDP).
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `turn.test.ts`: with `roomField { endure: true }`, a fighter at
        **full HP** that takes a lethal hit ends at exactly **1 HP** and the log
        carries `battle.log.enduredHit`; the **next** lethal hit on that same fighter
        in the same stay on the field **faints** it (hp 0) and pushes **no** second
        `enduredHit` line.
  - [ ] `[unit]` `turn.test.ts`: with the same field, a fighter at **70 % max HP**
        (or any HP below `maxHp`) is KO'd by the **first** lethal hit and no
        `enduredHit` line is pushed.
  - [ ] `[unit]` `turn.test.ts`: a fixed seed pins the surviving HP (exactly `1`) and
        the order of the two text lines of the turn (the `enduredHit` line of the
        surviving hit precedes the faint line of the second), so the rule is
        reproducible from the seed alone.
  - [ ] `[unit]` `turn.test.ts`: the move `Endure` still spares every hit of its own
        turn (the shipped test stays green) and the **room** field does not extend it.
  - [ ] `[unit]` `fighter.test.ts`: `emptyVolatiles().roomEndureUsed === false`, and
        `clearVolatiles` resets a fighter whose flag was `true`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, and the two doc
        edits are limited to the named bullets.
  - [ ] `[live]` **The boss arena breaks once per Pokémon.** Measurement: run
        `npm run dev`, open the game with `?hud=dom`, enter a boss room (the debug
        overlay's route tab teleports; the boss room's opening is `endure` or `crit`
        — for the `crit` seed use a room whose battlefield rolled `endure`, or
        teleport to the next floor and try its boss room), launch a battle there
        with the overlay's **wild battle** button at **level 100** against the fresh
        party, and play: after the first lethal enemy hit on the full-HP lead, read
        `[data-hud-battle-log-line]` — it names the lead and `endured`; keep using
        moves until the enemy lands a **second** lethal hit on that same fighter —
        its HP reads `0` and the forced-switch prompt opens, with **no** second
        `endured` line in the log. Evidence: the two log strings and the party
        panel's HP for that member, read over CDP. Canvas cross-check: the same two
        moments read from `renderer.snapshotArea` + `getImageData` on the HP bar's
        fill. State which method produced each reading.

## 📣 Coordination

- For the Architect: the rule is now "full HP once, per stay on the field"; a battle
  where a fighter switches out and back re-arms it, which the docs must say.
- For the next batch: nothing new to build against; `Volatiles` gained one field and
  every fixture that spreads `emptyVolatiles()` keeps working.

## ⛔ Out of scope

- The move `Endure`, the Sturdy ability line, Focus Band/Sash (`survive`).
- Any re-balance of `ROOM_BATTLEFIELDS`, `BOSS_OPENINGS` or the room-condition chance.
- Any UI, i18n key or notice.
