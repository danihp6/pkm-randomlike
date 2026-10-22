# PokeRandomLike — Changelog

Completed backlog items, kept out of `TODO.md` so the daily backlog stays small.
This file is *what shipped*, grouped by the roadmap phase it belonged to; the
rationale behind each rule (`D##` decisions) lives in
`docs/tech-decisions.md`. The commits carry the moment-by-moment history; this
file is the human-readable summary.

## Unreleased

- [x] **Team Rocket is a special NPC who carries the slot machine, and the casino room retires.**
      `[Task-117]`'s move, the merchant's shape: `'casino'` leaves `MapRoomSpecial`, `planMap` loses
      `CASINO_CHANCE`/`CASINO_FROM_MAP` and the special pass runs shop → mini-boss → mega-stone →
      gated → trade → no-heal (the leaves drawn after its slot consume the draws it used to take, so
      they are re-read and re-pinned; the shop, the mini-boss, the mega-stone and **every regular
      room, id and size** stay byte-identical). The window is **moved**, not rewritten:
      `src/scenes/rooms/casino.ts` becomes `src/ui/rocketPanel.ts` through a `git mv`, dropping only
      the descriptor and reading the NPC's own tile instead of the room's counter; the cabinet
      texture retires with the room. The grunt is a `rocket` row of `NPC_ROWS` —
      `chance: 0, floorStep: 0.03, repeatable: true`, so it is 0 % on map 1, 3 % a trainer room on
      map 2 and 21 % on map 8 (measured **2.9 %** of floors at map 2 rising to **51.1 %** at map 8,
      ≈1.9 floors a run against the retired leaf's ≈2.1) — found by the shipped per-NPC roll in a
      trainer room, drawn from the packed overworld atlas's `rocket` frame, and the interact key
      opens the machine **directly**, with no NPC card in between. `casinoSpin`, its three mark
      families, the floor lock, the Egg's hatch and the price table are untouched; no i18n key, no
      run field and no `SAVE_VERSION` step.
      **QA:** Task QA green on every `[unit]` criterion (3467 tests, build clean, the six forced
      fixture re-pins independently re-derived against `main`, `src/ui/casino.test.ts` untouched) and
      on the `[live]` one, measured over CDP on the live canvas (`renderer.snapshotArea` +
      `getImageData`, 1280×800, seed `rocket`, map 8, room 3): the sprite cell differs from an
      NPC-less trainer room in **89.7 %** of its pixels, **one** press opens the **460×300** machine
      with no 520×360 card anywhere, and no casino marker can be drawn. Integration QA green on the
      combined tree (3564 tests, build clean, empty path intersection, one holder per hot file, merge
      rehearsal yielding the same tree).

- [x] **The status half of the move audit: the moves that write a status, a stage, a volatile, a
      screen, a field, a heal or a protection now write it.** The `[Task-120]` half of the report's
      «parecen no hacer nada» is closed on the machinery that already shipped: `MOVE_EFFECTS` gains a
      handler per move for the infatuation and move-locking family (`Attract`, `Disable`, `Torment`,
      `Encore`, `Imprison`), the residual volatiles (`Nightmare`, `Curse`, `Octolock`, `Aqua Ring`),
      trapping and grounding (`Spider Web`, `Telekinesis`, `Smack Down`'s grounded write), the
      accuracy locks (`Lock-On`, `Mind Reader`), the type and identity writes (`Soak`, `Reflect Type`,
      `Magic Powder`, `Forest's Curse`, `Trick-or-Treat`, `Camouflage`), the ability writes
      (`Simple Beam`, `Worry Seed`, `Gastro Acid`, `Entrainment`, `Skill Swap`, `Role Play`), the stat
      and speed exchanges (`Heart Swap`, `Power Swap`, `Guard Swap`, `Speed Swap`, `Power Split`,
      `Guard Split`, `Psych Up`), the foe-aimed heals (`Heal Pulse`, `Floral Healing`, `Purify`,
      `Strength Sap`), `Psycho Shift`, the turn and priority control (`Instruct`, `Quash`,
      `Electrify`), the item moves (`Trick`, `Switcheroo`, `Embargo`, `Recycle`), `Mimic` and `Spite`
      — plus the charging moves the `charging` volatile never set (`Charge`, `Skull Bash`,
      `Meteor Beam`, `Electro Shot`, `Clangorous Soul`, `No Retreat`, `Fillet Away`, `Howl`, …) — and
      `applyVolatileEffect` widens to the cases each needs. `Spotlight`'s redirect is `excluded` with
      its reason instead of a dead handler. The instrument closes the half: the audit's `knownGap`
      count falls to **1** (`finalgambit`, `[Task-121]`'s), and the regenerated ledger reports
      **835 moves (753 port, 33 no-op, 49 excluded)** — 43 rows left `no-op`, and
      `npm run docs:coverage` stays byte-idempotent. The golden battle is byte-identical. No run
      field, no `SAVE_VERSION`, no new draw beyond `Disable`'s own pick.
      **QA:** Task QA green on all `[unit]` criteria (3562 tests, build clean, `knownGap` 1, 43 rows
      closed, diff inside the exclusive paths) and on the `[live]` one, measured over CDP on the live
      canvas (`renderer.snapshotArea` + `getImageData`, 1280×800): after `Soak` the foe's first badge
      slot reads the Water frame's own mean **exactly** while the party's own band differs by **0**
      pixels. Integration QA green on the combined tree (3564 tests, build clean, no shared path, no
      hot file, merge rehearsal yielding the same tree).

- [x] **An area-entry panel: every room greets the player with a boxed banner.** `[Task-109]` adds
      `areaEntryNotice(area)` and `AREA_PANEL_HOLD_MS = 3000` to the run's notice module and one
      private card to `RouteScene`: the `'window'` skin with the **accent** hairline (`#7dd3fc`),
      360×64 at y=116, below the notice strip and the mission line. It is raised on **every** room
      entry — `applyRoute` outside a room build (so the dev frame-map import still greets),
      `transitionTo` only when the room actually changed (the boss-fall rebuild raises none) and the
      portal, which enters through the same path — and dismisses itself with no key. The copy is one
      i18n key (`notice.areaEntry`) and a biome name stays English (`D43`). No run field, no
      `SAVE_VERSION`, no RNG.
      **QA:** Task QA green on all `[unit]` and all `[live]` criteria (four room entries = four
      banners, 1 on the floor advance and 0 on the boss rebuild; accent pixel at y=116; a forced
      notice does not cancel the banner; the Spanish locale keeps `Deep Forest`), and Integration QA
      green on the combined tree.

- [x] **The move audit, and a coverage ledger that counts evidence instead of a flag.** The
      `[Task-119]` instrument lands: `src/engine/battle/moveAudit.ts` runs **one** move against a
      clean level-50 board and snapshots what actually changed, with `MOVE_AUDIT_ROWS` at **478**
      rows (one per `port` move whose note is not `data: basePower`) and one test per row, so the
      20 moves the engine still cannot honour are green `it.fails` gaps instead of invisible ones.
      `portedMoveNote` loses the `flags.protect` fallback and stops calling `move.damage`,
      `ohko`, `sideCondition`, `pseudoWeather` and `forceSwitch` ported without a handler;
      `MOVE_VOLATILES` is parsed from `applyVolatileEffect`'s own cases. The generator is made
      CRLF-safe (`\r?\n` and a `lineEnd` helper) and the doc comment that leaked a bogus
      `| <name> | port |` item row is reworded; the regenerated ledger reports **835 moves
      (710 port, 76 no-op, 49 excluded)** — the 76 real gaps the report named — and
      `npm run docs:coverage` is byte-idempotent. No battle rule changed, no run field and no
      `SAVE_VERSION` step.
      **QA:** Task QA green on every `[unit]` and both `[live]` criteria (the develop build logs
      `[coverage]` once per move; `Attract` leaves the live battle state unchanged), and Integration
      QA green on the combined tree (179 files / 3378 passed, build clean, regenerated pair
      byte-identical, no shared path, no hot file, merge rehearsal yielding the same tree).

- [x] **The wait for the Always Free instance moved to a scheduled workflow, and the
      repository is public again.** Oracle's Madrid region answers `OUT_OF_HOST_CAPACITY`
      for every shape — including the AMD micro — so the launch is a lottery, and the
      laptop loop only runs while the laptop is on (it made 17 attempts in a day and then
      slept 19 hours). `oci / retry` runs one attempt per scheduled run, rotating
      4/24 → 2/12 → 1/6 with the minute, parks itself by finding the instance already
      `RUNNING`, and opens an `oci-ready` issue with the shape and the public IP. It
      authenticates as a dedicated `pkm-ci` user with a launch-only policy, so the key in
      `OCI_CLI_KEY_CONTENT` cannot touch the rest of the tenancy; `Out of host capacity`,
      `429` and `5xx` exit `0` on purpose, so a waiting loop does not paint the runs list
      red. Going public also lifted the Actions billing block that parked the autopilot
      overnight — the 23:02 cycle shipped task-97 first, so nothing was left in flight
      and `resume.md` reads `branches alive: 0`.
      **QA:** CI green on the PR (rerun after the visibility flip), and a live
      `workflow_dispatch` attempt logged `attempting 1 OCPU / 6 GB … Out of host
      capacity … exit 0`; the three sizes were measured against the capacity report
      before writing the rotation.

- [x] **The 2vs2 boss battle, the screen: two actives on each side.** The engine half
      (`[Task-107]`) now has a face. `BattleLaunch.double` rides the launch (set only for the boss
      room through `bossIsDouble('boss')`), `BattleScene` draws a second foe sprite, a second foe
      window and a second player window, and the command flow gains two modes: a **partner** prompt
      that runs slot 1 first with FIGHT and SWITCH only (no bag, no run) and a **target** step where
      a single-target move marks one foe with a cursor and a spread move skips it. `takeDoubleTurn`
      resolves both commands in one turn, the entry beat drops a second send-out
      (`entryBeat(kind, reduced, double)` appends one `sendout`), the party window marks the two
      actives with `partyGridFieldRows`, and HP/status events are attributed per slot. A one-member
      party keeps the single layout, and no single battle changes. No engine rule, no i18n key, no
      new file; the only engine file is `battleLink.ts`. Docs: `docs/battle-spec.md` §12,
      `docs/design-spec.md` §4.
      **QA:** unit pass green — 2564 tests / 67 skipped in 2631, `npm run build` clean, the engine
      diff limited to `battleLink.ts`, no key or README touched. The four `[live]` criteria were
      **not run** (degraded, same browser-session failure as Tasks 102 and 103): the on-screen double
      layout, the partner/target steps, the two-ball beat and the single-battle regression are
      unverified.

- [x] **The item catalogue's fourth wave: the Tera Crystal, infinite held items, the coloured candy
      and the three route bottles.** Four wishes on one seam. The **Tera Crystal** is a `held` row
      carrying a `teraType` (18 of them); one `onStart` handler in `effects/items.ts` replaces the
      holder's types at battle start and again on switch-in, and the party detail reads the same
      override, so panel and battle agree. **Infinite held items**: the battle's `spend` still fires
      a berry once per battle, but `resolve.ts` keeps the run member's `heldItem` instead of taking
      the snapshot's `null`, so it is back next battle. The **coloured candy** rolls which stat each
      colour raises from a per-run seeded table (`Rng(seed:candy:<colour>)`) and the run keeps the
      colours **discovered**; the effect is a permanent ±1 read by `statAtLevel` from the new
      `statTreats` on the fighter and its snapshot, kept through level-ups, adoption, evolution, the
      nature re-roll, a Mega and the debug editor. The three **one-route consumables** are the
      exorcist's curse, the weather man's field and the medic's heal in a bottle: they write
      `[Task-94]`'s modifiers and call `[Task-95]`'s heal, never a second implementation, and the
      battle's bag refuses them. `SAVE_VERSION` steps **22 → 23** carrying the treats and the
      discovered set (an old run migrates with no treats and an empty set). Docs: `docs/data-spec.md`
      §3, `docs/battle-spec.md` §2/§3/§5/§9, and the regenerated `docs/balance/effect-coverage.md`.
      **QA:** unit pass green — 2612 tests / 67 skipped in 2679, `npm run build` clean, the coverage
      pair idempotent, the diff inside the spec's exclusive paths. The `[live]` criteria were **not
      run** (degraded, same browser-session failure as Task-102): the crystal's badge and battle
      types, the candy across a reload, the returning berry and the three bottles are unverified on
      screen.

- [x] **The puzzle room: a switch sequence that pays an item.** A new `puzzle` special leaf
      (20 % from map 2 on, on its own `${seed}:map:<n>:puzzle-room` stream, last statement of the
      special pass) carves a switch sequence into a dead-end wild room, and the **room itself**
      places and reads it: `puzzleLayout(seed, mapIndex, roomId)` returns the switch tiles and the
      reward tile, `puzzlePress` advances the sequence or resets it by data, `puzzleIsSolved` closes
      it with `puzzleId`/`puzzleRewardId`, and the descriptor draws the discs **under** the player,
      floats the reset and solved notices and pays the row's `valuable` item through the shipped
      ground-item path. The solve is a per-floor `pickedItems` mark, so a revisit shows no switches
      and no item and a new floor may hang its own room. No run field, no new tile value, no
      `RouteScene` edit and no `SAVE_VERSION` step (still 22). Docs: `docs/maps-spec.md` §7,
      `docs/routes-spec.md` §2. One more room on the floors that hang it re-pinned the walk
      (`MEASURED_FILL`, maps 5/7/8's factors and `docs/balance/route-curve.md`; `BOSS_PINS` on
      `dev-seed` map 6).
      **QA:** unit pass green — 2616 tests / 49 skipped in 2665, `npm run build` clean, the diff
      inside the spec's exclusive paths, `SAVE_VERSION` still 22. The two `[live]` criteria were
      **not run** (degraded): the three browser QA sessions hung for hours and were killed, so the
      drawn switches and the single paid reward are unverified on screen.

- [x] **The banned-species room: the run's most-used species sits the fight out.** The run now
      keeps **which member has fought most**, and a new **`banned`** special leaf (20 % from map 3
      on, on its own minted `${seed}:map:<n>:banned-room` stream, as the **last** statement of the
      special pass, so no floor's topology, specials, room ids, sizes, roles or earlier leaf
      moves) makes that fact hurt. A member carries `battlesUsed`, bumped by the post-battle fold
      for the fighters the battle **actually fielded** — `BattleState.usedFighterIds`, booked at
      battle start and on every switch-in — and never for the bench or the box. The room resolves
      its ban once (`bannedSpeciesOf`, `src/engine/routes/bannedRoom.ts`) as the species of the
      **party** member with the highest counter (ties to the lowest party index, absent as 0, the
      box never read: a boxed veteran must not name the ban) and rides it on `BattleLaunch` →
      `BattleSetup` → `BattleState`. `createBattle` opens the battle on the first living member
      the ban does not name, a switch or forced replacement into it is refused with
      `That Pokémon is barred in this room.`, `switchablePartyIndices` omits it and the party
      window's row is drawn disabled; the ban bends when the barred species is the only living
      off-field member (a battle must always have a legal send-out) and the enemy side is never
      filtered. The rule ends with the battle, draws no RNG, and writes nothing to the run; the
      room itself is one ordinary `blackbelt` trainer (no Mega) on the room's farthest tile under
      the floor's stable `banned-<mapIndex>` id, its notice naming the barred species and its
      minimap marker a red crossed disc. `RunPokemon.battlesUsed` is the plan's **21 → 22** step,
      and the shared `switchablePartyIndices` also aligns the party window's rows with the shipped
      double-battle refusal. Docs: `docs/battle-spec.md` §2 and `docs/maps-spec.md` §7's own row
      and subsection. A new leaf is one more room on the floor that hangs it, so the walk was
      re-pinned: `MEASURED_FILL` now reads 1.25/1.25/1.16/1.25/1.25/1.19/1.18/1.18 and map 5's
      factor moved **0.94 → 1.15** with the recipe (`docs/balance/route-curve.md`), and
      `BOSS_PINS` moved only on maps 4+.
      **QA:** one pass for a one-task batch — `task-101@4436b0b` — gates green (`npm test` 2555
      passed in 175 files, `npm run build` clean), the diff inside the spec's exclusive list, and
      the three `[live]` criteria measured in a browser: the notice and the crossed marker, the
      trainer battle opening with **terapagos** barred (`usedFighterIds` never lists it, its row
      disabled), and the ban vanishing with the battle (HP/PP untouched, sendable again next
      battle, no barred-member field in `localStorage` after a reload). One spec correction came
      out of QA: the notice is a **room-entry cue** that floats again on a revisit, exactly like
      the no-heal room's, and only the ban is stateless.
- [x] **The boss room's own rules: a forced opening, a sealed door and a free heal.** The boss
      room stops being a quiet leaf that *may* roll a condition. Every map's boss battle now
      **always** begins under one row of the new two-sided `BOSS_OPENINGS` table in
      `src/data/bosses.ts` — `run` = the `endure` arena with the boss's lead at Speed −1, `boss`
      = the `crit` arena with its lead at Defence +1 — drawn by `bossOpeningRoll(seed,
      roomIndex)` on the room's own `${seed}:battlefield:<roomIndex>` stream (one
      `rng.int(0, 1)`, no `next()`), so `BOSS_BATTLEFIELD_CHANCE` (30 %) is retired and
      `ROOM_BATTLEFIELD_CHANCE` (15 %) keeps governing regular rooms. The arena row is
      symmetric by the engine's own rules (Endure and the crit stage apply to both sides) and
      the **side** is the stat stage, the only one-sided channel `createBattle` already had:
      `BattleSetup.enemyBoosts` carries it, merged in `startBattle` with the exorcist's curse
      (`atk`) and the berry tree's row without arithmetic, so no key collides. The same module
      (`src/engine/routes/bossRoom.ts`) holds the other two rules: `bossRoomSealed(boss,
      bossDefeated)` is read by `tryLeaveRoom` before the portal branch, so the room's own door
      refuses the step until the boss falls (`D31`'s key reopens it, no new run field), and
      `bossRoomHeal(run, mapIndex)` runs **once per floor** when the room is built — `healParty`
      across party and box, HP/PP only, never a resurrection (`D5`) — recorded as
      `boss-heal-<mapIndex>` in `pickedItems`, which `advanceMap` clears. Docs:
      `docs/maps-spec.md` §6 whole and §7's first battle-condition bullet (the boss clause only;
      the bullet's `casino` parenthetical is the room-retirement task's), and
      `docs/battle-spec.md` §4. No run field and no `SAVE_VERSION` step (**21**).
      **QA:** one pass for a one-task batch — `qa-100` (`main@a98ce90` + `task-100@d0e58f2`,
      integration `d31b641`) — gates green (`npm test` **2584** passed in 180 files,
      `npm run build` clean), the diff exactly the spec's 14 paths plus the spec commit the merge
      drops, `src/engine/maps/`, `src/engine/run/` and `src/i18n/` untouched, and the trainer pins
      of `battlefield.test.ts` independently replayed from `main`'s formula. The four `[live]`
      criteria were measured over CDP on seed `1b10di0`, map 1 room 5 (the plan's boss room):
      arriving there writes **one** `boss-heal-1` mark and restores a 1-HP/0-PP party to full HP
      and PP (and a reload restores nothing twice, and a 0-HP member stays at 0); the room's own
      condition reads `crit` and paints (`visible: true`, canvas patch measurably redder than the
      same floor's other rooms) and survives a reload; walking into the door back keeps
      `roomInMap` at 5 while the boss stands and moves it to 4 once `bossDefeated` is set; and the
      boss battle's INFO window reads **`DEFENSA +1`** on the enemy lead at turn 1, exactly the
      `boss` row's `def: 1`, with the three Poké Balls of map 1's boss behind it. One residue the
      spec's live plan named is a knob, not a defect: the debug overlay has no `Route` battlefield
      readout, so the live pass read `debugBattlefieldOverlay()` instead.
- [x] **The secret shop: four held items and two TMs behind a type-gated vault.**
      A new **`secret-shop`** special leaf (20 % from map 3 on, on its own minted
      `${seed}:map:<n>:secret-shop-room` stream, as the **last** statement of the
      special pass and after the static leaf, so no shipped floor's topology, specs,
      room ids, sizes, trainer roles or static leaf moved) is a quiet dead-end whose
      route carves the shipped one-tile vault behind a bush, a rock or a pond. The
      seal opens when **any party member holds one of the obstacle's own types**
      (`partyHasType` over `GATES[kind].types`: Bug or Grass / Rock or Fighting /
      Water), recorded as `secret-shop-<map>-<room>` in `pickedItems`, so the opening
      lasts the floor and a revisit or a reload draws what the run opened. Behind it
      stands a counter — the vault's own pocket — whose interact key opens the shipped
      Mart card (`src/scenes/rooms/shop.ts`'s `openMart`, extended with an optional
      `MartStock` so a second counter reuses the same card, its SELL tab, its drag and
      its ✕) stocked from the new `SECRET_SHOP` table in `src/data/shop.ts`:
      `leftovers`, `lifeorb`, `choiceband`, `focussash` and TMs 88 and 114, all at
      catalogue price (4000 and 3000), drawn from no RNG at all. `MapRoomSpecial`
      gains `'secret-shop'` (the minimap marker follows through the existing
      `MapRoomMarker` alias and paints its own teal ring), the room descriptor is
      `src/scenes/rooms/secretShop.ts`, the pure rules and the seal's id are
      `src/engine/routes/secretShop.ts`, and one i18n key (`mart.secretTitle`) ships in
      both locales. No run field and no `SAVE_VERSION` step (**21**). A floor that
      hangs the leaf holds one room more and `routeIndexForRoom` sums the previous
      floors' room counts, so `curve.test.ts`'s walk was re-walked — fills **1.25, 1.25,
      1.25, 1.25, 1.25, 1.13, 1.24 and 1.32**, every one inside the rule's `1.05 – 1.5`
      window — and map 5, the only floor the shift pushed out of it (1.67), had its
      `TRAINER_XP_PER_MAP` row re-solved with the documented recipe
      (`1.25 → 0.94`); the other seven factors are untouched and
      `docs/balance/route-curve.md` records the walk. Docs: `docs/maps-spec.md` §7 and
      `docs/design-spec.md` §7.
      **QA:** one pass for a one-task batch — `qa-97` (`main@0828cb6` +
      `task-97@ea081b4`, integration `52bf135`) — gates green (`npm test` **2499**
      passed / 67 skipped in 179 files, `npm run build` clean), the diff exactly the
      spec's 23 paths plus the spec commit the merge drops, and `src/data/dex/`
      untouched. The three `[live]` criteria were measured over CDP on seed
      `secret-shop-qa-3`, map 3 room 10, mouth `(10,13)`, rock seal `(10,14)`, pocket
      `(10,15)`: the seal holds (the tile text stays `(10,13)`) through two steps and
      an `E` with no qualifying member, and after `addDebugPokemon('geodude', 5)` the
      same `E` opens it for the rest of the floor (one step lands on `(10,14)`, and
      leaving the room and coming back keeps it open); the counter then opens the card
      and its header patch `(620..660, 132..142)` reads **`(31.25, 37.4, 48.4)`**
      against the blend the shipped chrome predicts — `0.72×(16,22,31) +
      0.28×(61.1,69.5,85.9) = (28.63, 35.30, 46.37)`, error ≤ 2.7 per channel, the ✕
      restoring the closed reading exactly; and the BUY tab paints its **six** rows
      (4000/4000/4000/4000/3000/3000) with the seventh row's band left as the list's
      own field. The card's open-patch bound was corrected from an earlier "+40 rise"
      wording, whose "light field" premise the shipped `window.png` (#10161f at
      `FRLG_WINDOW_ALPHA` 0.72) contradicts.
- [x] **The static-species room, and the legendary variant behind a flawless floor.**
      A new **`static`** special leaf (25 % from map 3 on, drawn from its own
      `${seed}:map:<n>:static-room` stream as the **last** statement of the special
      pass, so no shipped floor's topology, ids, sizes or trainer roles moved) carves
      the shipped one-tile vault and holds **one static species** at `squadLevel`,
      fought through the ordinary wild path — the room's capture, the catch rules and
      permadeath are the shipped ones. Its seal reads the obstacle's own row in
      `src/data/staticSpecies.ts`: a **type** gate through `partyHasType` (bush:
      Bug/Grass, rock: Rock/Fighting) or a **feature** gate through
      `partyHasAbility` (pond: Water Absorb, Swift Swim, Storm Drain), with two
      `pickedItems` records (`static-<map>-<room>` for the opening,
      `static-mon-<map>-<room>` for the species) and
      `src/scenes/rooms/staticSpecies.ts` as the room descriptor. The **legendary**
      variant is that same leaf: from map 4 on, 25 % on its own
      `${seed}:map:<n>:static-variant:<room>` stream, only while `missionsCompleted`
      reads **1** and the floor's mission is `flawless`, and its species come from the
      explicit `LEGENDARY_SPECIES` list — never `speciesPool` — so `WILD_BANNED_TAGS`
      is untouched and the ordinary pool is not widened by one species.
      `MapRoomSpecial` gains `'static'` (the minimap marker follows through the
      existing `MapRoomMarker` alias), the room layer gains an optional
      `RoomHost.startWildBattle` (optional so every headless stub still compiles) and
      two i18n keys (`static.locked.water`, `notice.staticLegendary`) ship in both
      locales. No run field and no `SAVE_VERSION` step (**21**). A floor that hangs
      the leaf holds one room more and `routeIndexForRoom` sums the previous floors'
      room counts, so `curve.test.ts`'s walk was re-pinned — fills **1.25, 1.25, 1.25,
      1.33, 1.35, 1.13, 1.18 and 1.25**, every one inside the rule's `1.05 – 1.5`
      window — and `docs/balance/route-curve.md` records that walk; the eight factors
      are **not** re-solved. Docs: `docs/maps-spec.md` §7, `docs/routes-spec.md` §3/§6,
      `docs/design-spec.md` §7.
      **QA:** one pass for a one-task batch — `qa-96` (`main@bd9ab7a` +
      `task-96@9cb766e`, integration `38d0b61`) — gates green (`npm test` **2520**
      passed / 13 skipped in 177 files, `npm run build` clean), the diff exactly the
      spec's 24 paths plus the spec commit that the merge drops,
      `src/engine/save.ts`, `src/engine/run/state.ts` and `src/engine/run/pool.ts`
      untouched and `SAVE_VERSION` still 21. The four `[live]` criteria were measured
      over CDP: on seed `static-96-1`, map 4 room 8, the room reads `static`, its rock
      seal carries the shipped `GATES.rock` tile and the counter **is** the vault
      pocket; the seal refuses a party with no Rock/Fighting member and opens after
      `addDebugPokemon('geodude', 5)` (`static-4-8` written, the seal walkable); the
      battle fields **frigibax** at level **5** with its ability and moves and spends
      the room's capture; and with `missionsCompleted: 1` the same floor fields
      **moltres**, where the `0` control fields `goomy`.

- [x] **The special trainers: an invisible ninja, an all-Impostor trainer and a gated secret battle.**
      A `trainers` room's **first** trainer can now wear a special archetype instead of an
      ordinary class — an archetype override, never an extra body (`id`, tile, facing, `sight`
      and spin are kept, so the population's pose and reachability rules are untouched). Three
      rows join `SPECIAL_ARCHETYPES` and the new `SPECIAL_TRAINER_ROWS` prices them: **ninja**
      0.1, **impostor** 0.08, **secret** 0.2 gated on `RunState.missionsCompleted >= 1`. The
      roll is pure in `src/engine/routes/trainers.ts` — `specialTrainerFor` (presence then a
      weighted pick on its own `Rng(hashSeed(seed:special-trainer:roomIndex))`, unknown rows
      dropped), `trainerHidden` (`invisible` hides the route sprite only beyond one Manhattan
      tile; `INVISIBLE_REVEAL_DISTANCE = 1`; sight untouched) and `withForcedAbility` — with
      `TrainerArchetype.sightMode / forcedAbility / reward`, `TrainerRosterEntry.ability` and
      `BattleReward.item`; the Impostor's roster starts on `Imposter` (bypassing the
      `randomAbility` roll, which is a per-species hash, so nothing else shifts) and its first
      win pays one Ability Shield through the fold's own `firstWin`, and the scene re-paints
      trainer sprites after every step, room rebuild and teleport. No layout, terrain,
      populate, item, validation, encounter or roster draw moved, so no fixed-seed re-pin; no
      run field and no `SAVE_VERSION` step (**21**). Docs: `docs/routes-spec.md` §2/§5,
      `docs/battle-spec.md` §9, `docs/design-spec.md` §7.
      **QA:** one pass for a one-task batch — `qa-99` (`main@38552c1` + `task-99@bf5c797`,
      integration `dd226ff`) — gates green (`npm test` **2395** passed / 67 skipped in 163
      files, `npm run build` clean), the diff exactly the spec's 11 paths (the spec commit
      dropped at the merge), forbidden paths (`save.ts`, `main.ts`, `package.json`,
      `data/dex`, `i18n`, `BattleScene.ts`) empty and `SAVE_VERSION` still 21. The three
      `[live]` criteria were measured over CDP, twice and independently: on map 1's first
      trainer room the ninja at Manhattan distance **43** reports `visible === false`, the
      control `psychic` at the same distance **43** reports `true`, and after
      `teleportToTile` onto its facing tile the same trainer reports distance **1**,
      `visible === true` with `Battle` inactive.

- [x] **The item-and-battle NPCs: a medic, a chef, a berry tree and a Mega Stone keeper.**
      Four rows are appended to `NPC_ROWS` (1 % a floor, +0.25 pt, so an eligible floor puts
      an NPC in a trainer room ≈26 % early and ≈68 % by map 8) on the shipped special-NPC
      framework. The **medic** runs `healParty` over the party *and* the box once per floor,
      its `npc-<map>-<room>-medic` mark in `pickedItems` the whole record; the **chef** trades
      `CHEF_BERRY_COUNT` (**3**) berries of `BERRY_IDS` (14, table order) for one `chefstew`
      equipped on the chosen member; the **berry tree** draws `BERRY_TREE_MIN`-`BERRY_TREE_CAP`
      (**1-4**) berries off `${seed}:npc:<room>:<id>:berries` and fields the room's own wild
      table off `…:wild`, buffed by `BERRY_TREE_ENEMY_BOOSTS` and carrying a new `noFlee`
      (`BattleLaunch` → `BattleSetup` → `BattleState`) that `canRun`/`rollRun` honour, whose
      only two grants are the shipped `onTryEscape` hooks — the Run Away ability and a new
      `flee` held item, the **Smoke Ball**; the **stone keeper** fields an `ace` trainer under
      `npc-trainer-<map>-<room>-mega-stone` and pays one id of `MEGA_STONE_IDS` through
      `addItem` on a win, drawn on `…:prize`. No new run field, no new battle module and no
      `SAVE_VERSION` step (**21**); the generated `docs/balance/effect-coverage.md` is
      regenerated, which also deletes the three X-item rows `main` still listed after
      `72e06a7` removed them (Items **290** total, **138** port).
      **QA:** one pass for a one-task batch — `qa-95` (`main@d0fffb8` + `task-95@ff0f937`,
      integration `a5b43af`) — gates green (`npm test` **2371** passed / 67 skipped in 163
      files, `npm run build` clean), 24 diff paths (the spec's 22 plus the two authorised
      `src/data/itemIcons.*` paths its `iconFallback` needed; the spec commit dropped at the
      merge), `SAVE_VERSION` 21, the three new streams pinned by fixed seed and the shipped
      `:field`/`:type` pins unmoved. The spec's coverage literal (**293**/**141**) was the
      one red criterion: `main`'s committed table was stale — regenerating `main` yields
      **288**/**136**, so the two new rows make **290**/**138** — and the expectation was
      amended on the measurement rather than hand-editing the generated table. No `[live]`
      criterion was owed: every rule is pure and the dev overlay cannot force an NPC
      placement, so the scene wiring is covered by the typecheck and the grep audit.

- [x] **Four NPCs write a fact the run keeps: a curse, a forced sky, the next wild's type and
      a type gate's item.** The run gains one typed `modifiers` record — `curse`,
      `forcedField` (a `ROOM_BATTLEFIELDS` id plus the floors it still covers, **3** when set)
      and `nextWildType` — owned by the new pure `src/engine/run/modifiers.ts`, carried by
      `RunState`, decayed one floor by `advanceMap`, and saved by `SAVE_VERSION` **20 → 21**
      (an older run starts with an empty record, and a document with an unknown field id, a
      zero `floorsLeft` or a non-string type reads as empty). The **exorcist** sets the curse,
      which `startBattle` turns into one **Attack stage down** on the enemy's lead through a
      new `BattleSetup.enemyBoosts` (data: `CURSE_ENEMY_BOOST`) and spends in the run it
      persists for that battle; the **weather man** draws one `ROOM_BATTLEFIELDS` row on its
      own `:npc:` stream and pins it over the room's rolled condition and every battle of the
      next three floors; the **magician** draws one of `MAGICIAN_TYPES` (the 18 dex type ids)
      and narrows the band's encounter table to it before the draw — the live
      `RouteEncounters` filter changes with no draw spent, and the first wild that actually
      rolls consumes it; the **type gate** (`bugcatcher`) hands one `silverpowder` to a party
      holding a **Bug** through `partyHasType` + `addItem`, refuses without one and marks
      nothing. All four ride the shipped `npcPanel` card, are one-shot per floor through
      `npcUseId`, and add 17 keys to both locale tables. No new generated file, no RNG stream
      moved, no atlas repacked.
      **QA:** one pass for a one-task batch — `qa-94` (`main@6f08530` + `task-94@683d862`,
      integration `f03e10d`) — 9/9 criteria green, `npm test` **2338** passed / 67 skipped,
      `npm run build` clean, 24 diff paths (the 23 exclusive ones + the spec commit, dropped at
      the merge); its `[live]` criterion was measured over CDP on the live `Battle` scene
      (`weather === 'rain'`, the enemy lead at `boosts.atk === -1`, one enemy fielded) and on
      the route after it (`curse === false`, `forcedField.floorsLeft === 3`,
      `nextWildType === 'bug'`), with the battle's top strip read by
      `renderer.snapshotArea` + `getImageData` (**68.5 %** of it the battle's own `#203048`).

- [x] **The casino window is a slot machine with three item reels.**
      `src/ui/casinoReels.ts` (pure) owns the geometry and the schedule —
      `REEL_COUNT = 3`, `REEL_SPIN_MS = 800`, `REEL_STOP_STAGGER_MS = 160` (the last
      reel stops at **1 120 ms**), `reelFace` / `reelStrips` / `reelFaceIndex` — and
      `src/scenes/rooms/casino.ts` only draws it: three 48 px windows at
      556/616/676, the paid item (or the Egg, or the Team Rocket icon on all three
      reels for the grunt) as the final face, the band's own rows as decoys, `SPIN` and
      `LEAVE` clickable while idle, input locked during the reveal and a click or `E`
      skipping it. `casinoSpin` still books the outcome before the first frame, so a
      reload cannot re-roll or refund. No new string, no setting, no RNG draw.
      **QA:** Task QA `qa-116` (`main@98bd905` + `task-116@c1fae70`, integration
      `73db413`): 10 of 11 criteria green, `npm test` **2246** passed / 67 skipped, and
      the three-reel `[live]` re-measured on the combined tree `7e250be` with the
      spec's corrected reference (band row `y = 2`, gap at local `x = 114`): three ink
      runs of **48/49/49 px** with **11/11 px** gaps; the click `[live]` changed **671**
      message-band pixels, the money band byte-identical and the run's money still 0.

- [x] **The party-edit NPCs edit one member through one pure transaction.**
      `src/engine/run/memberEdits.ts` joins the special-NPC panel with five rows — the
      move tutor (`TUTOR_MOVES`, a free slot or the chosen one), the nature, ability and
      IV re-rolls and the species swap — plus the sacrifice a completed `flawless`
      floor unlocks (one whole bag stack for one random row, its second-ability row
      writing `secondAbility` instead of re-rolling the first). A tutored move is a
      `taughtMoves` pool entry (`source: 'tutor'`, ranked level → tutor → TM), so it
      survives an unequip; every draw is minted inside the function on the room's own
      `:npc:` substreams, and `NpcRow.repeatable` plus the
      `{ kind: 'missionsCompleted' }` requirement keep the merchant revisitable and the
      sacrifice gated. `SAVE_VERSION` goes **19 → 20**, both member words optional on
      the wire. The second ability feeds the run's ability readers (`memberAbilities`,
      `partyHasAbility`, `runPassives`, the No Guard guard); the battle's own dispatch
      keeps the primary, recorded as `D48` and parked for review as its own decision.
      **QA:** Task QA `qa-93` (`main@98bd905` + `task-93@4f5480e`, integration
      `b7e2cbb`): every `[unit]` criterion green, `npm test` **2269** passed / 67
      skipped, `npm run build` clean over 26 diff paths, `memberEdits.test.ts`'s 21
      cases including the `pkm-93` fixed-seed pins.

- [x] **The slot machine's equipable prize is one grouped row off the Mart's own shelf.**
      `CasinoPrize` gains `kind: 'held'` (a row that names no `itemId`, like the Egg) and
      every band's fixed equipable becomes that one row at weight 1, so a newly banded
      equipable reaches the machine the day `SHOP_ROTATION` bands it — no second balance
      table and no edit to `CASINO`. `casinoHeldPool(band)` (new, `src/ui/casino.ts`) is
      that band's `SHOP_ROTATION` filtered to non-consumed, modelled ids in table order,
      with `early` and `low` falling back to the first band above that has one (`mid`), so
      a Life Orb never surfaces on map 1; the pick is the spin stream's **last**
      `rng.int`, taken only when the weighted pick lands on the grouped row, and the row
      resolves to `{ kind: 'item', itemId }` before the spin returns, so every reader sees
      one paid id. The table keeps its measured shape — the grouped row is 7.1 % of spins
      at `early`, 6.5 % at `low`, 9.4 % at `mid`, 12.1 % at `high`, 10.6 % at `late` and
      `end`, and `low` / `mid` are diluted (13 and 9 weight) back under break-even (≈ 90 %,
      ≈ 91 % recovery). `src/ui/casino.test.ts` re-pins `pkm-64` map 5's fourth spin from
      the fixed Life Orb to the grouped draw (spins 1-3, the Egg and the reload rule do not
      move) and `src/data/casino.test.ts` re-pins the per-band counts. No run field, no
      `SAVE_VERSION` step, no RNG draw outside the spin's own stream. **QA:** Task QA
      `qa-115` (`main@773624e` + `task-115@bef584f`, integration `25174a7`): 7/7 `[unit]`
      criteria green, `npm test` **2219** passed / 67 skipped and `npm run build` clean
      over 8 diff paths, `src/ui/casino.ts` still Phaser-free; the batch's Integration QA
      re-ran both gates on the combined tree (`4dafdee`): **2225** passed / 67 skipped.

- [x] **The merchant replaces the shop room, and the Mart survives behind its `TRADE` row.**
      The `'shop'` leaf is gone: `MapRoomSpecial` no longer carries it, `planMap` drops the
      guaranteed leaf (`SHOP_FROM_MAP` / `hangsShop` retire), the minimap marker set loses
      the glyph and `src/scenes/rooms/shop.ts` stops being a descriptor — it keeps the
      whole floating Mart and exports `openMart(host)` instead. The run still gets exactly
      **one merchant per floor from map 2 on**: `NpcRow.guaranteedFromMap` (the row is
      `chance: 0`, so the roll can never pick it), `firstTrainerRoom(plan)` in
      `src/engine/maps/plan.ts` and `guaranteedNpc(plan, roomIndex, mapIndex)` in
      `src/engine/routes/npcs.ts` place it in the floor's lowest-id `trainers` room, and the
      per-NPC roll (now skipping zero-chance rows) serves only the rooms after it. Choosing
      its `TRADE` row opens the Mart and writes no use mark, so the merchant is revisitable
      for the rest of the floor; map 1 stays merchant-free. `NPC_ROWS` carries its first row
      and `src/i18n/{en,es}.ts` its three keys. The shop leaf's two size draws moving the
      special stream re-pinned `plan.test.ts`'s `SHIPPED_FLOORS` / `ALPHA_MAP_8` /
      `SHIPPED_SPECIALS` / `TRADE_LEAVES` / `NO_HEAL_LEAVES` and, because the trainer rooms
      a seed draws move with it, re-solved `TRAINER_XP_PER_MAP` by the curve sheet's own
      `1.25 / fill` recipe and re-pinned `curve.test.ts`'s measured column — the 1.05-1.5
      window is untouched. No run field, no `SAVE_VERSION` step. **QA:** Task QA `qa-92`
      (`main@773624e` + `task-92@02d13f9`, integration `2d2d6e2`): 9/9 criteria green,
      `npm test` **2213** passed / 67 skipped and `npm run build` clean; the `[live]`
      criterion was measured over CDP — map 2's first `trainers` room is room 2, it holds
      the merchant at (9,8) on a walkable, blocking tile, the registry has no `'shop'` kind,
      and E opens the `MERCHANT` card, E again the `MART` with its five `¥` rows and
      `pickedItems` still empty.

- [x] **A trainer room can hold one special NPC, rolled per room on its own stream.**
      The framework the special-NPC wave writes against: `src/engine/routes/npcs.ts`
      decides **at most one** NPC per room (`roomNpc(seed, roomIndex, mapIndex)`), with
      one `Rng.next()` for presence against the rows' summed chance and, on a hit, one
      `Rng.int` for the weighted pick, both on `Rng(hashSeed('${seed}:npc:<room>'))` — its
      own stream, so no map, encounter, roster or battle draw moves and a revisit shows
      the same NPC. `effectiveNpcChance` is `clamp01(chance + floorStep × (map - 1))`, so
      a row's chance is data and rises with the floor; `npcRequirementMet` gates a row on
      the party through `partyHasType` and the two predicates that join it
      (`partyHasMove`, `partyHasAbility`, never a second module, the box never asked);
      `npcSpot` picks the free tile (never the entry or its neighbours, an exit, a wall, a
      trainer or a visible item) on its own `:spot` stream; and `npcUseId` is the
      per-floor `pickedItems` record, `npc-<map>-<room>-<id>`, the shape the gate and
      trade rooms already use. `src/ui/npcPanel.ts` is the one modal card every NPC fills
      (title, paragraph, a column of up to six choices, `LEAVE`), drawn with the shipped
      chrome, its layout a pure `npcPanelLayout` under the viewport clamp; the scene draws
      the row's `NPC_SPRITE_KEYS` sprite like a trainer's, blocks its tile and opens the
      card from the interact key. **`NPC_ROWS` ships empty on purpose**: each content task
      adds its own row with its own effect, so the framework is dormant and the game is
      unchanged until the merchant lands. No run field, no `SAVE_VERSION` step (the chain
      stays **14 → 19**). **QA:** one single-task pass from `qa-91` (`main@c9a19db` +
      `task-91@c6f7860`, integration `1c5ea5d`): 10/10 criteria green, `npm test` **2207**
      passed / 67 skipped and `npm run build` clean over 18 diff paths (the 17 exclusive
      ones + the spec), `src/engine/` pure; the one `[live]` criterion was **measured**
      over CDP on both trees at seed `pkm-91`, map 1, room 1 — **1** `frlg:overworld`
      sprite on each (equal to the live trainers), and **278** interact presses with **0**
      panels and **0** differing pixels in the 520×360 centre rect.

- [x] **A floor has an objective: its mission, and `flawless` is the first one.**
      The human wants floor missions whose completion pays a **fixed** reward («cumplirlas
      da recompensa (fija: no perder vida → aparece una sala especial)»), and a floor had no
      objective at all. `src/engine/run/missions.ts` chooses one mission per floor from the
      seed alone (`missionForMap`, one draw from `Rng(hashSeed('${seed}:map:${mapIndex}:mission'))`
      — its own stream, so no layout, encounter, roster or battle draw moves and a revisit or
      a reload picks the same row), `src/data/missions.ts` holds `MISSION_TABLE` with the one
      row that ships, **`flawless`** (end the floor without losing HP and without a casualty),
      and its fixed reward — `{ kind: 'room' }`, the row the special-room tasks will read.
      The run carries `mission`, `missionsCompleted` (run-long),
      `hpLost` and `floorCasualties` (both per floor), so the schema steps **18 → 19**; an old
      save starts with no mission and a zero counter. `advanceMap` evaluates the floor being
      left **before** it heals, bumps the counter and hands the next floor its mission; the HP
      a battle spent is a **pure helper in `missions.ts`** (`battleHpLoss`, matched by member
      id, a faint counting its whole remaining bar) that the scene calls before the fold — the
      rule is not in `resolve.ts`, which a batch-mate owned. The route HUD shows the mission
      as one line on its own card under the transient-notice strip and meeting one raises
      `missionCompleteNotice` through `src/ui/notice.ts`, with `hud.mission`,
      `mission.flawless` and `notice.missionComplete` in both locales. **QA:** one Task QA
      from its own integration tree (`main@4b28f8a` + `task-98@07aae73`, integration
      `eee6d2e`): 10/10 `[unit]` criteria, `npm test` **2148** passed / 67 skipped and `npm
      run build` green, 19 diff paths (18 exclusive + the spec), with `src/engine/run/resolve.ts`
      and `docs/battle-spec.md` correctly absent; the one `[live]` criterion was **measured**
      over CDP on the live canvas (`renderer.snapshotArea` + `getImageData` at 1280×800, seed
      `pkm-111`, map 1, room 0) — the mission card's rect `(460, 76, 360, 32)` differed from
      `origin/main` in **11 420 of 11 520** pixels while the minimap control rect `(8, 8, 216,
      250)` differed in **0**.

- [x] **The trainer XP award is solved per floor, and no floor pays outside the rule's window.**
      The rule is that **75 % of a floor's trainers pays that floor's cap**, and one
      multiplier per level band could not hold it: maps 6-8 share the `end` band and their
      caps demand `needed(8)/needed(6) = 1.6887`, so Batch 35 pinned floor 8 at a 0.96 fill
      with a documented exception. `src/data/run.ts` now carries
      **`TRAINER_XP_PER_MAP`** — eight two-decimal factors, `1, 1, 1, 1, 1, 0.84, 0.87, 1.31`
      — and `trainerXpMultiplierForMap(mapIndex)`, which clamps at both ends and repeats its
      last row past the last finite map (infinite mode walks the `end` band upwards). The
      factor rides `experienceAward` as a **fourth, defaulted** parameter, so every existing
      call site is inert and a **wild** award ignores it entirely, and `resolveBattle`
      passes the floor the battle was fought on. A seventh band was rejected: it still leaves
      floors 7-8 sharing one multiplier and `BandId` is the key of the loot, shop, casino and
      trainer-money tables. `curve.test.ts` deletes `SHARED_BAND_MIN_FILL`, returns floor 8
      to `MIN_FILL = 1.05`, and re-pins `MEASURED_FILL` mid-window: the three fixed seeds
      measure **1.2493 / 1.2496 / 1.2493 / 1.2499 / 1.2496 / 1.2510 / 1.2527 / 1.2518**.
      `docs/balance/route-curve.md` was **one batch stale against the code** — its band
      table still carried the pre-Task-82 multipliers — so the sheet was re-written from the
      walk: the shipped `trainerXp` column (6.07/16.18/8.59/12.70/10.86/7.96), the new
      `Factor` column, `A(m)`, the budget product and the fill column, and `docs/battle-spec.md`
      §7's rule now names the floor factor. **QA:** one Task QA from its own integration tree
      (`main@4b28f8a` + `task-83@8a19872`, integration `68230b4`): 8/8 `[unit]` criteria, `npm
      test` **2112** passed / 67 skipped and `npm run build` green; 10 diff paths (the nine
      exclusive ones plus the spec commit); and an independent re-walk, built outside the
      pinned test, reproduced every cell of the sheet plus the boss and mini-boss award
      figures.
- [x] **The autopilot moved off the runner and onto an always-on VM.** GitHub's cron
      fired three times in six hours, a job dies at six hours, the runner is 2 cores and
      7 GB for a batch that wants four devs plus a headless Chromium, and a private
      repository is back to 2,000 shared minutes a month — none of which a $0 Ampere
      instance has. The cycle is now a script, not a workflow: `run-cycle.sh` does the
      same ritual (fetch, reset, assets, recon, `opencode run --agent orchestrator
      --auto`, post-merge gate, verdict), `run-driver.sh` is the loop the systemd unit
      starts, and the brake is a file (`brake.sh on|off|window <h>|status|reset`) instead
      of a repository variable. Two decisions came out of the port and are pure,
      unit-tested functions: `gate.mjs` (brake, then window, then backlog, then the red
      streak, then the cap — the order is load-bearing) and `verdict.mjs` (a red gate
      fails, a moved `main` or an opened issue is green even when the stream died). The
      Orchestrator's prompt moved to `scripts/agent/vm/prompt.md` and `agent-cycle.yml`
      now reads it, so the manual fallback cannot drift from the loop that runs nightly.
      **QA:** `npm test` **2186** (13 new cases in `gate.test.mjs` + `verdict.test.mjs`),
      `npm run build` and `bash -n` over the five scripts, all green.

- [x] **The ripped art left the tree, and a clone without the private store still builds.**
      `src/assets/**` and `public/anil/` carried 213 MB of Nintendo/GameFreak/Chunsoft rips
      that `docs/art-direction.md` says must never be redistributed. Every packed atlas and
      cue is now gitignored and rebuilt by `npm run assets:pack` from the private
      `pkrl-assets` store (`ASSETS_ROOT`, or `sprite-sources/`), through
      `scripts/assets/pack.mjs`; the packers resolve the store with
      `scripts/assets/root.mjs` instead of defaulting to a path inside the checkout, so the
      trainer, battle-UI, font, category-icon, field-item and audio packers run in CI too.
      Every module that imports a ripped atlas resolves it through `import.meta.glob` with a
      committed blank of the same pixel size (`src/assets/placeholders/`, generated by
      `scripts/assets/build-placeholders.mjs`), and the suites that measure art skip
      themselves through `hasArt`. `ci.yml` mounts the store with the deploy key and packs
      before the gate, so a same-repo run measures real art; a fork PR builds against the
      blanks. The store gained the nine overworld strips and the 525 cues the packers read
      (its `frlg-audio` only carried the six music beds). **QA:** `npm test` **2173** and
      `npm run build` green with the art; **2106 passed / 67 skipped** and a green build
      without it, which is the public-clone shape; CI green on the PR against the store at
      `eb9593a`.

- [x] **A cycle is resumable per task, and a bad socket no longer counts as a red cycle.**
      The runner is ephemeral and the model stream drops — measured on 2026-10-19: two
      transport drops in nine cycles (`Transport: The socket connection was closed
      unexpectedly` and `OpenAI Chat stream ended without finish_reason`); one lost a spec
      and a dev worktree, the other shipped batch 23 and was marked red anyway. The unit of
      durability is now the task: `agent-cycle.yml` commits the spec as the `task-<ID>`
      branch's first commit and pushes it, the dev ends with an empty `dev: done task-<ID>`
      commit, and QA's verdict is an empty `qa: pass task-<ID>` commit carrying
      `Verified-At`, `Tip`, `Gates` and `Report`. The branch tip is a turnstile, so a
      partial branch is deleted and redone, never trusted. A deterministic
      `scripts/agent/recon.mjs` reads the refs and writes `.agent_specs/resume.md` (9 unit
      cases in `recon.test.mjs`), and the Orchestrator adopts those tasks instead of cutting
      the batch again. Each task ships atomically — merge `--no-ff`, the spec dropped from
      the index, the `TODO.md` tick and the `CHANGELOG.md` entry in the same commit, one
      `git push` — so `main` is consistent at every boundary. The run's conclusion is the
      outcome, not `opencode`'s exit code: a green gate plus a moved `main` (or a new issue)
      is green, and a transport drop that shipped nothing is retried once inside the job
      after a fresh Recon. `AGENTS.md`, the three role files and `docs/agent-ci.md` carry
      the protocol. **QA:** `npm test` **2173** (from 2164) and `npm run build` green; the
      kill-and-resume measurement is the first live cycle after this merge, not a claim
      made here.

- [x] **`MAP_TUNING` keeps only the cap, and a floor's level window is derived from adjacent
      caps.** The player-relative level model left a floor with one anchor: `MapTuning` is now
      `{ mapIndex, cap, routes, size }` with the eight caps **9 / 16 / 23 / 30 / 37 / 43 / 49 / 55**
      (`MAP_TUNING_STEP.levelStep` still grows an out-of-table map, saturating at
      `MAP_MAX_LEVEL`: map 9 reads 63, map 10 71, maps 14+ 100); `levelRangeForMap` and the type
      `MapLevelRange` are gone. `src/engine/run/floors.ts` gains
      `levelWindowForMap(m) = { minLevel: m <= 1 ? LEVEL_BANDS[0].minLevel : levelCapForMap(m-1),
      maxLevel: levelCapForMap(m) }`, so `floorForRoute`, `bandForMap` and `runBand` return
      **byte-identical** windows and bands for every index (`{2,9} … {49,55}`, deep maps included)
      and `src/scenes/RouteScene.ts` — which reads the trainer cap and the boss pin off
      `band.maxLevel` — needed no edit. The three dead per-room "working level" helpers
      (`roomLevelForFloor`, `runRoomLevel`, `roomLevelForMap`) are deleted; `levelCap.ts`,
      `save.ts` and the roster keep working untouched. `docs/maps-spec.md` §1/§4/§5,
      `docs/routes-spec.md` §5's first bullet, `docs/balance/route-curve.md`'s cap section and a
      `D29` addendum record it. No run field and **no `SAVE_VERSION`** step. **QA:** Task QA on
      `qa-80` (`main@363d3f21` + `task-80@cfcf63dd`): `npm test` **2158** tests (from 2156) and
      `npm run build` green, the 9-path diff inside the spec's exclusive list, and
      `curve.test.ts`, `levelCap.test.ts`, `roster.test.ts`, `progression.test.ts`,
      `src/engine/maps/*.test.ts`, `mapView.test.ts` and `save.test.ts` passing **undiffed** — the
      proof the game reads the same numbers; Integration QA re-ran both gates on the combined tree
      and the cross-task audit clean. All criteria `[unit]`; no browser pass owed.

- [x] **A floor holds a fixed number of trainer rooms, and each regular room carries a population
      role.** `MapRoom`/`RoomView` gain `role: 'trainers' | 'wild'`, tagged by `planMap` from the
      new `TRAINER_ROOMS_PER_MAP` = **2, 2, 3, 3, 3, 4, 4, 4** (plus `TRAINER_ROOMS_MAX` 6 for
      infinite mode) in `src/data/population.ts`; the role draws are **appended after the last
      special draw**, so no fixed seed's biome, room count, topology, ids, sizes or specials move
      (pinned by a three-literal plan digest in `plan.test.ts`). `RouteRequest.population` is
      replaced by `role?: MapRoomRole` (absent = `'trainers'`, the compatibility default) and the
      pass now places the spine guard, then **1-2 trainers** (`TRAINERS_PER_ROOM`) in a
      `'trainers'` room and **none** in a `'wild'` one; `POPULATION`, its thinning table, the
      map-size trainer bonus and `guardChance` leave the pass, while `wantsTrainers` gates §3.4's
      lane guard on `role !== 'wild'`. The room's own fixed shape/size no longer changes its
      trainer count. `src/scenes/RouteScene.ts` makes exactly two edits (drop the `POPULATION`
      import; pass `params.room.role`). Because the floor budget collapses, `LEVEL_BANDS[*].trainerXp`
      is **re-solved by measurement** (`early 6.07, low 16.18, mid 8.59, high 12.70, late 10.86,
      end 7.96`) to keep the curve gate green: the measured fill column is
      1.25/1.25/1.25/1.25/1.25/1.49/1.44/**0.96**, and maps 6-8 sharing the single `end` band make
      the last floor's 0.96 the arithmetic limit (`needed(8)/needed(6) = 1.6887`; the legal band is
      `[0.95, 0.9623]`). The test states that arithmetic instead of hiding it, and `[Task-83]` owns
      the per-floor-factor fix. Docs: `docs/maps-spec.md` §2/§3/§7, `docs/routes-spec.md` §2 step 4
      and §5 bullets 4/6, `docs/route-generator.md` §2/§3.4, `docs/design-spec.md`'s on-ramp
      sentence, a `D30` addendum and `src/data/README.md`; `docs/balance/route-curve.md` is
      deliberately left to Task-83. No run field and **no `SAVE_VERSION`** step. **QA:** Task QA on
      `qa-82` (`main@363d3f21` + `task-82@771168e4`): `npm test` **2162** tests and build green, the
      18-path diff inside the exclusive list (no `mapView.ts`, `validate.ts`, `src/data/maps.ts`,
      `floors.ts` or the balance sheet), hot file `RouteScene.ts` its alone; the `[live]` criterion
      was measured **twice independently** over CDP `Runtime.evaluate` (QA seed `1cdmbj`, Orchestrator
      seed `69vldj`): floors 1/4/8 read **2 / 3 / 4** `role === 'trainers'` rooms, every such room
      fielded **1-2** `trainer-…` trainers and every `'wild'` room **0**. Integration QA re-ran the
      gates (**2164** tests on the combined tree) and cleared the cross-task audit and the merge
      rehearsal.

- [x] **A wild encounter's level is a fraction of the live squad level, and its species table
      follows the squad's own band.** `src/data/wildLevels.ts` holds `WILD_LEVEL_FRACTION`
      (`{ min: 0.6, max: 0.75 }`) and the pure `wildLevel(fraction, squadLevel, cap)` =
      `clamp(floor(squadLevel × fraction), 1, cap)`; `src/engine/routes/encounters.ts` gains
      `EncounterLevelRoll` and `rollWildLevel(rng, squadLevel, cap)` (one draw on the room's
      `encounters` stream, in the slot the old `rng.int(minLevel, maxLevel)` occupied), and
      `rollEncounter` / `RouteEncounters` take that `levelFor` closure instead of a level pair,
      calling it **live on every `step()`** so a level-up inside a room moves the next wild
      without rebuilding the room. `RouteScene.applyRoute` builds the stream with
      `encounterTableFor(bandForLevel(squadLevel(run)))` — resolved once per room build — and the
      closure over the live run, and a dev-only `debugRollWildEncounters(count = 1)` exposes the
      rolls to the measurement harness (not wired into `src/dev/debugMenu.ts`). `docs/routes-spec.md`
      §3/§5, the wild-level clause of `docs/maps-spec.md` §5 and two new
      `docs/tech-decisions.md` addenda (`D11` "the seed fixes the wild level's draw, not the
      level", `D17` "a wild level is a fraction of the squad level") record it, and
      `src/data/README.md` gains the file's role line. Removing the level draw's no-op slot means
      a successful encounter now spends **one extra draw**, so a fixed seed's drawn **species**
      sequence moves from the first encounter on — deliberate, and `encounters.test.ts` re-pins it
      by measurement (rolling control replays), never by hand-editing a number. No run field, no
      i18n key, **no `SAVE_VERSION`** step and no dex regeneration. **QA:** one single pass (a
      one-task batch) on `qa-79` = `main@fcc82121` + `task-79@62adc349` (`243b57c7`): `npm test`
      (163 files / **2156** tests, from 2144) and `npm run build` green, the 9-path diff inside the
      spec's exclusive list, purity and hot-file audit clean, and the merge rehearsal producing
      the integration tree exactly; the three `[live]` criteria were measured twice independently
      over CDP `Runtime.evaluate` on two dev servers (`:5181` and `:5239`, headless Chromium
      `:9331`/`:93xx`): on floor 4 the squad-20 rolls read levels `12..14` while the same room's
      squad-30 rolls read `18..22` (`min(b) > max(a)`), the squad-5 (`early`) and squad-30
      (`late`) species windows shared **zero** ids, and the forced wild battle's
      `Battle.launch.trigger` read `kind: 'wild'` with the exact level the roll produced
      (`servine`, level 14 in QA's run; `wormadamtrash`, level 13 in the Orchestrator's).

- [x] **A regular trainer's level is a percentage of the live squad level, by its party size.**
      `src/data/trainerLevels.ts` holds `TRAINER_LEVEL_PERCENT` (`1 → 1`, `2 → 0.9`, `3 → 0.8`,
      `4 → 0.7`), `trainerLevelPercent(size)` (a size outside 1..4 clamps to the nearest row) and
      the pure `trainerLevel(squadLevel, size, cap)` =
      `clamp(floor(squadLevel × percent[size]), 1, cap)`; `RosterOptions` gains one optional
      `levelFor?: (size: number) => number`, which replaces the band's
      `rng.int(band.minLevel, band.maxLevel)` level draw when a caller resolves the level from the
      live run, and `RouteScene.startTrainerBattle` passes it for a **regular** trainer only, with
      `cap = band.maxLevel`. The **boss** and the **mini-boss** pass nothing and keep the draws they
      shipped with (the boss's band is pinned to the floor's cap; the mini-boss keeps its band draw —
      the plan's line said both sat at the cap, and only the boss ever did). A catch is still
      rebuilt at the squad level, and a `levelFor` roster spends one draw fewer per member, so the
      following draws of that stream (the Mega Stone pick) move while the species picks before them
      stay put; `roster.test.ts` pins both directions (a literal `levelFor` roster, and the shipped
      control replay untouched). `docs/maps-spec.md` §5, `docs/routes-spec.md` §5,
      `src/data/README.md` and the two addenda in `docs/tech-decisions.md` (`D11` "the seed fixes
      the draw, not the level", `D17` "the squad level may set a level") record the
      player-relative model. No run field and **no `SAVE_VERSION`** step — the level is computed at
      battle start from the live run. **QA:** one single pass (a one-task batch) on `qa-78` =
      `main@69ffceeb` + `task-78@5be1429c` (`c16b6b82`): `npm test` (162 files / **2144** tests,
      from 2131) and `npm run build` green, the 9-path diff inside the spec's exclusive list, and
      the `[live]` criterion measured over CDP on that tree's own dev server (`:5201`, headless
      Chromium `:9341`), twice independently: after `teleportToFloor(4)` and `setDebugSquadLevel(20)`
      the first regular trainer's roster on map 4 reads `[18, 18]` from
      `game.scene.getScene('Battle').launch.trigger.roster`, i.e. exactly
      `trainerLevel(20, 2, 30) = 18`, while map 4's boss still fields `[30,30,30,30,30,30]` — the
      pinned cap draw the change leaves alone.

- [x] **A hidden ground item is the biome's own floor frame, not a floating sparkle.** `TilesetConfig`
      gains `hiddenItemFrame?: number` and `src/engine/tileFrames.ts` a pure
      `hiddenItemFrame(tileset)` fallback (`hiddenItemFrame ?? frames[FLOOR] ?? 0`); the FRLG
      fields declare frame **41** (`FRAME_FLOOR_ALT_3`, atlas cell `5,34`) and the forest's
      natural mix loses it, so `FOREST_FLOOR_VARIANTS` is now `0:8, 1:5, 2:4, 42:1` and every
      `resolveGroundFrame` on a floor stays inside those four frames. `RouteScene.drawItems`
      draws a hidden item as that frame of the route's biome atlas, at the ground's own scale,
      origin and depth (no tint, no alpha, no tween) and keeps `setVisible(!taken)`, walkability
      and the interaction path untouched; the procedural `SPARKLE_TEXTURE_KEY` texture and its
      `BootScene` builder are deleted, and the reduce-flashing preference keeps only its battle
      flash and reset-scrim surfaces (`D45`, `docs/tileset-spec.md` §2/§6,
      `docs/design-spec.md` §5/§10). **QA:** Task QA on `main + task-85` and the shared batch
      integration tree — `npm test` (160 files / **2114** tests, from 2108 on `main`) and
      `npm run build` green, the 10-path diff inside the spec's exclusive list, and the `[live]`
      criterion measured over CDP on a forest route (seed `qa85-a`, regular room 4): the hidden
      item's sprite is `tiles:forest` frame 41 at scale 1.5, alpha 1, no tween,
      `textures.exists('route:sparkle') === false`, and the 24×24 canvas tile (camera zoom 1,
      `renderer.snapshotArea`) has **no transparent pixel** and **all 576 pixels in frame 41's own
      three-colour palette** (`88,160,128` ×503, `48,136,104` ×46, `104,168,144` ×27 — the atlas
      cell's 492/57/27 with the nearest-neighbour sampling phase), the same art the engine's ground
      pass draws; a naive PNG upscale differs on 15.1 % of the pixels only at the 1.5× texel
      boundaries, and QA's same-phase ground reference matched 576/576. No run field, no
      `SAVE_VERSION` step, no RNG draw.

- [x] **The double battle's engine rules: two active slots per side, targets and a partner AI.**
      `BattleState` gains `double` (default `false`), `Slot` 0/1 and `secondActiveIndex`, and the
      accessors widen without moving the single path (`activeFighter(state, side, slot?)`,
      `liveSlots`, `opposingSlots`, `performSwitch(..., slot?)`); `FightCommand` carries a `slot`
      and a `target: { side, slot }`, spread moves (`allAdjacentFoes`/`allAdjacent`) hit every
      live foe slot once per use while spending PP once, `orderActions` sorts four entries by
      priority, fractional and per-slot Speed, and `takeDoubleTurn` is the two-active entry point
      (`takeTurn` delegates to it with slot 0, so every existing test and the golden log are
      byte-identical). A faint flags `awaitingReplacement` only when a reserve exists and
      `autoReplace` fills only the emptied slot; a side fights while either slot lives.
      `chooseAiCommand(..., { slot })` scores (move, target) pairs for the partner slot and never
      aims at a dead slot. `src/data/bosses.ts` adds `BOSS_PARTY.<kind>.double` (`boss` true,
      `miniboss` false) and `DOUBLE_ACTIVES = 2`, with no scene wiring; `docs/battle-spec.md`
      gains §12. **QA:** Task QA on `main + task-107` and the shared batch integration tree —
      `npm test` (**2131** tests) and `npm run build` green, the 11-path diff inside the exclusive
      list, `golden.test.ts`/`harness.ts` untouched, the new fixed-seed `double.test.ts`
      (two actives, four-way order, targeted vs. default damage, spread PP, slot-only replacement,
      double faint, partner targeting, seeded log equality), the `bosses` pins and the engine
      purity grep. No `[live]` criterion (pure engine) and no browser pass owed. No run field,
      no `SAVE_VERSION` step and no RNG draw change.

- [x] **The Mart and the mini-boss reward are floating, pointer-driven cards.** Both modal,
      keyboard-driven windows are gone: `src/ui/floatingPanel.ts` draws one glass card with a
      44 px header that is its own drag handle, a drawn ✕ close control and the pure
      `clampPanelOrigin` that keeps it on screen; it takes no key, pauses nothing, persists no
      position and draws no scrim, so the route keeps walking behind it (`D45`). The Mart
      (`src/scenes/rooms/shop.ts`) drops its `handleShopAction`, keeps its BUY/SELL tabs and the
      shipped `seed:map` stock, sells a SELL row with one click, and buys a BUY row only by
      dragging it onto the bag panel or a living party/box member: the units enter the bag once,
      then a member drop spends a `heal`/`status` item through `useItemOn` or equips a `held`
      one, and an item that does not apply stays in the bag; a row the run cannot afford is not a
      drag source (no hand cursor, no ghost), so the drag itself is the price gate. The reward
      (`src/scenes/RouteScene.ts` + `src/ui/rewards.ts`) builds its six rows from the new
      `rewardRows`, drops item rows on the bag or a member and its anonymous Pokémon rows on the
      party (a full party goes to the box), closes with the same `onDone` exactly once, and also
      closes on a room change. **QA:** one pass (a one-task batch) on `main + task-89` —
      `npm test` (160 files / **2108** tests) and `npm run build` green, the 18-path diff inside
      the spec's exclusive list, the merge rehearsal reproducing the tree, and every `[unit]` and
      `[live]` criterion green (Task QA measured the live ones, and the Orchestrator re-measured
      them on its own server and browser). The live measurements: a 10× Poké Ball row at ¥1000
      took money 3000 → 2000 → 1000 and the bag 10 → 20; an unaffordable row left the canvas
      cursor `default`, started no drag and bought nothing; an item row and an anonymous Pokémon
      row landed (the bag grew, the party 2 → 3 and `stats.catches` unchanged); with either card
      open `ArrowRight` still walked the player while `E` and the arrows bought nothing; and a
      header drag by `(+120,+80)` moved the card exactly (the ✕ answered at the new origin and
      not at the old one). No run field, no `SAVE_VERSION` step and no new RNG draw;
      `docs/maps-spec.md` §7 and `docs/design-spec.md` §3/§10.3 record the rule. Two residual
      readings are parked in an `agent-review` issue: the HUD's hit test still sees a panel that
      a floating card covers where they overlap, and a Pokémon reward row dropped on a filled
      member row resolves as a member target rather than the party panel (empty party space and
      the panel's own background take it).

- [x] **A room's size follows its shape.** `planMap` no longer rolls every regular room's width and
      height independently: the frozen `ROOM_SHAPE_SIZES` table (`src/data/maps.ts`) gives a `cross`
      and a `straight` 40×40, a `tee` 40×48, a `bend` 44×44, a `corridor` 52×30 — 30×52 when its two
      opposite openings are north/south — and a `dead-end` 30×30, and `roomSizeForShape(shape,
      mapIndex, longAxis)` scales that map-8 table by the map's own `size.max / MAP_MAX_ROOM_SIZE`,
      rounds and clamps it to `[30, 56]`. `MAP_MAX_ROOM_SIZE` and the map-8 `size.max` rise from 48
      to **56**, the entry, boss and every special leaf stay pinned at 30×30, and the plan's size
      invariant (`min ≤ side ≤ the map's size.max`) still holds. The size is derived after the
      opening set is known, so a corridor follows its axis; the old two-draw size roll stays in place
      (its values now feed nothing) so a seed's rooms, cells, links, specials and boss do not move,
      and the floor curve is unchanged: every fill stays inside `[1, 1.5]` and maps 1–2 inside
      `[1.2, 1.35]` (`m1 1.249, m2 1.250, m3 1.155, m4 1.439, m5 1.357, m6 1.058, m7 1.109, m8
      1.316`). `docs/maps-spec.md` §1/§3/§4 rewrite the generator's size step and
      `docs/balance/route-curve.md` records the rule and the re-measured table. A fixed-seed `bend`
      room's band pin moved with its new 30×30 size (`doors.test.ts`). No scene, no packed asset, no
      run field, no `SAVE_VERSION` step and no RNG draw changed. **QA:** `npm test` (158 files /
      **2079** tests), `npm run build`, the seven-path diff audit, the pinned table and scale numbers,
      the plan's shape→size invariant, and the cross-task integration gate on the combined batch
      (159 files / **2099** tests); this task's criteria are all `[unit]` and owed no browser pass.

- [x] **A consumable is spent on a party member from the route HUD, and only when it does
      something.** `src/engine/run/items.ts` adds the pure gate — `itemAppliesTo(member, item)` is
      true for a `heal` item below `maxHp` or with a status it cures, and for a `status` item only
      with a matching status; a fainted member never applies — and `useItemOn(run, memberId,
      itemId)` consumes one stack and writes the HP and/or status back, returning the same run
      reference (no consumption) for every no-op. A bag stack dragged onto a party or PC-box member
      now spends a `heal`/`status` item through it and raises the new `itemUsedNotice` (`notice.itemUsed`,
      both locales), while `equipHeldItem` refuses every item whose `kind` is not `held` — fixing the
      defect where a Potion dropped on a member was equipped as its held item. The three X-items are
      removed from the game: the catalogue rows, the four loot rows, the `'boost'` member of
      `ItemKind`, the bag's case and the battle Bag's `case 'boost'`, and the icon map; the FRLG
      packer now takes its source directory through argv or the environment (`AGENTS.md`'s Asset-trees
      rule) and was rerun from `$ASSETS_ROOT`, leaving `src/assets/frlg/item-icons.png` +
      `src/data/frlg/item-icons.json` byte-identical on a second run (192×96, 31 icons / 37 items).
      The battle's own `boost` **event** and `ItemDef.boosts` stay for the pinch berries. No run field
      and no `SAVE_VERSION` step. **QA:** `npm test` (159 files / **2091** tests), `npm run build`,
      the 26-path diff audit and the packer-twice check, plus the `[live]` criterion measured over
      CDP with real pointer events by Task QA and again by the Orchestrator: a Potion dragged onto a
      10/21-HP lead took it to 21 (gain 11 = `min(20, 21 − 10)`), the stack went 1 → 0 and
      `Used Potion.` showed; on a full-HP lead the same drag changed nothing, kept the Potion and
      raised no notice.

- [x] **The movement keys never browse a HUD pane.** Opening a route HUD panel no longer takes
      the keyboard: the `party` / `bag` / `map` / `box` quick keys are plain toggles again (a press
      opens or collapses the panel exactly as its icon click does) and the arrows keep moving the
      character from the first frame, even with the party, box, bag or detail panel expanded. The
      whole pane-keyboard layer is deleted from `src/scenes/RouteScene.ts` — `focusHudPane`,
      `handleHudKeyboard` with its member / bag / detail reducers, `stepMemberCursor`,
      `releaseHudKeyboard`'s focus half, the `hudKeyboardPane` and `hudPartyHeaderFocus` fields, the
      cursor highlights keyed on them and the raw `[` / `]` pocket keys, about **560 lines** — with
      the walker's `update()` gate no longer settling on a pane; every operation the panes offered
      from the keyboard stays reachable by pointer (row → detail, grab / reorder / deposit / withdraw,
      the Pokevial header, box cells and pages, bag stacks and pockets, the detail tabs, nickname,
      ability ⓘ, evolution rows, search, move slots' ⓘ and the learnset band's drag). The Mart, the
      mini-boss reward, the pause menu, the release beats and the nickname / search text fields keep
      their own paths unchanged. `docs/design-spec.md` §10.3 rewrites the rule (route HUD
      pointer-first, the pause menu the one keyboard surface kept, the exceptions named) and
      `docs/tech-decisions.md` **`D45`** carries the same amendment; their battle halves are
      untouched. No new file, no keybind change, no run field, no `SAVE_VERSION` step and no RNG
      draw. **QA:** `npm test` (158 files / **2071** tests), `npm run build`, the three-path diff
      audit and a single pass covering both QA scopes (one-task batch), with the merge rehearsal
      reproducing the integration tree exactly. The `[live]` criterion was measured over CDP with
      real key events, twice: with the party panel **expanded**, a held `ArrowRight` walked the
      player from `(15, 15)` to `(17, 15)` (+2 tiles) and `ArrowDown` ×3 reached `(17, 18)` (+3),
      `hudUi.index` stayed `0` throughout and `hudKeyboardPane` no longer exists on the scene.

- [x] **The route HUD's MOVES tab deletes an equipped move.** A slotted move released over the
      learnset band is unequipped: `unequipMove(run, memberId, slot)` sits beside `equipMove` in
      `src/engine/run/learnset.ts` and drops the slot, returning the run **by reference** for an
      unknown member, an out-of-range or non-integer slot, or a member holding a single move — so a
      one-move member is refused and the save decoder, `validateCommand` and the FIGHT menu keep
      their non-empty invariant. The freed slot stays a drawn empty container (Task-55) and the move
      returns to the derived band by itself — `Lv##` when it is a level-up move, `TM###` while the
      machine is in the bag — and dragging it back re-equips it with fresh PP. The gesture is the
      inverse of the equip drag: `handleHudPointerMove` stops reordering while the held move is over
      the band and `handleHudPointerUp` folds the release through `unequipMove`, with no
      confirmation because teaching is free and the delete is reversible. `docs/design-spec.md` §3
      and `docs/tech-decisions.md` **D36** gained the inverse sentence; `src/scenes/BattleScene.ts`,
      `src/ui/moveGrid.ts` and `src/engine/save.ts` were not touched, and there is no run field, no
      `SAVE_VERSION` step and no RNG draw. **QA:** `npm test` (158 files / **2053** tests),
      `npm run build`, the five-path diff audit, and both `[live]` criteria measured over CDP with
      real pointer events: a three-move member (`punishment, nuzzle, ember`) drops `ember` onto the
      band (`[false,false,false,true]` → `[false,false,true,true]`, the emptied cell's canvas pixel
      changes from `[18,29,22]` to `[37,59,44]`, the band offers `ember` again as `Lv`), dragging it
      back restores `pp = maxPp = 25`, and the battle's FIGHT menu then lists exactly `Punishment`
      and `Nuzzle`. The batch's combined gate measured **158 files / 2071 tests**.

- [x] **The room-effect table's second half: the radiant zone, the two auras, the all-types
      change, Endure and +50 crit.** `ROOM_BATTLEFIELDS` grows from eleven rows to **seventeen**,
      the six new rows appended after `trickroom` so the shipped eleven keep their index space, and
      each seeds the new `BattleState.roomField` (`RoomFieldEffects`, defaulted by
      `emptyRoomField()`, merged by `createBattle`, produced by `battlefieldSeeds`): `abilitiesOff`
      makes the dispatcher skip every ability (`abilityActive`), `darkAura`/`fairyAura` multiply
      Dark/Fairy damage by **1.33×** on both sides in `computeDamage`, `overrideType` replaces both
      fighters' types for STAB and the chart (`turn.ts` reads it for the effect and the damage), a
      lethal hit under `endure` is clamped to exactly **1 HP**, and `critStage` (**+1**) lifts the
      crit ratio before the roll. The all-types row's one type is frozen as data
      (`ALL_TYPES_OVERRIDE = 'Normal'`) and the crit row as `ROOM_CRIT_STAGE = 1`; the AI's
      `estimateDamage` preview keeps ignoring room conditions, as it already ignores weather. The
      route's existing overlay paints each row's tint generically, so no scene, art or i18n line
      moved, the six rules draw no RNG, and `docs/maps-spec.md` §7 and `docs/battle-spec.md` §4
      record them. **QA:** `npm test` (158 files / **2065** tests), `npm run build`, the thirteen-path
      diff audit, and the live criterion measured for all six rows: one seed/room per id,
      `debugBattlefieldOverlay()` equal to its table row in all six, the overlay's visible-vs-hidden
      canvas pixel equal to the tint composite with **0** per-channel error (tolerance 3), and the
      radiant/all-types battles' live `roomField` deep-equal to the merged seed
      (`abilitiesOff: true`, `overrideType: 'Normal'`). The combined batch gate measured **158 files
      / 2071 tests**.

- [x] **The no-heal room: a leaf whose battles refuse the player's Bag and healing moves.**
      The special-room layer's seventh kind, `no-heal`, hangs a `dead-end` leaf with a **20 %**
      chance **from map 3 on**, drawn **last** in `planMap`'s special pass (after the trade leaf),
      so every shipped floor's rooms, sizes and specials stayed identical — the existing
      `SHIPPED_SPECIALS`/`PLAN_PINS`/`TRADE_LEAVES` pins were untouched and a new per-seed pin
      freezes where the leaf hangs. Its **`psychic`** trainer stands on the room's farthest tile
      under the stable id `noheal-<mapIndex>`, so a beaten room stays beaten on a revisit; entering
      the leaf floats `notice.noHealRoom` through `src/ui/notice.ts` (the new optional
      `RoomFixture.notice`, shown by `RouteScene` once the fixture is applied). Every battle started
      there carries `BattleLaunch.noHeal` → `BattleState.noHeal`: the battle feed's first line
      announces the rule, the BAG row is drawn disabled, and the **24** ids of
      `src/data/noHeal.ts` (six self-heals, eight effect-handled heals, ten draining attacks) are
      drawn disabled in the MOVES grid and refused by `validateCommand`; a fighter whose only
      PP-legal move is barred resolves as **Struggle**, the "No PP" fallback. The rule is the
      **player's alone** — the enemy's side, abilities, held items, residual heals, the Pokevial and
      the PC are untouched — and a loss in the room is a normal loss (D5). `docs/maps-spec.md` §7
      and `docs/battle-spec.md` §2 record it, `src/data/README.md` and `src/scenes/rooms/README.md`
      carry their lines, and it adds no run field and **no `SAVE_VERSION`** step (the chain stays
      14 → 15 → 16 → 17 → 18). **QA:** `npm test` (**158 files / 2047 tests**), `npm run build`,
      all 25 paths, and both `[live]` criteria measured on a dev server over CDP (QA and then the
      Orchestrator independently): seed `live-0`, map 8, room 12 — the HUD strip's text equals
      `t('notice.noHealRoom')` and a 720×44 `renderer.snapshotArea` before/after differs in
      **21 537** pixels (QA: 31 475/31 680), the BAG row reads `enabled: false`, the battle log's
      first line is the room's, and in the live MOVES grid `Synthesis` reads `enabled: false` while
      `Tackle` reads `true`.

- [x] **The trade room: give one Pokémon, receive a random one.** The special-room layer's
      sixth kind, `trade`, hangs a `dead-end` leaf at **20 % from map 3 on**, drawn **last** in
      `planMap`'s special pass so every shipped floor's specials, links and sizes stay identical.
      The room is a descriptor module (`src/scenes/rooms/trade.ts`) with the Mart's counter and a
      640×540 window listing the **party** plus `LEAVE`; `RouteScene.ts` needed **no edit** (the
      `D47` port already carries `fixture`, `interact`, `counterTile`, `commitRun` and
      `releaseHudKeyboard`). The rule is pure (`src/engine/run/trade.ts`): `tradeId(map, room)` is
      the per-floor mark `trade-<map>-<room>` in `pickedItems`, `canTrade` refuses a single-member
      party, `removeMember` drops exactly one member without touching
      `stats.casualties`/`rip`/`caughtSpecies` (the deliberate removal beside `releaseFainted`),
      and `tradePokemon` rolls **on acceptance** from a minted
      `${seed}:trade:${mapIndex}:${roomId}` stream — two draws, species from
      `speciesPool(band, 'wild')` and a nature — then places the received member at `squadLevel`
      through `adoptAtLevel`/`addPokemon`, with **no catch** counted. One trade per room, optional
      (`Q`/cancel grants nothing), **no run field** and **no `SAVE_VERSION`** step; eight
      `trade.*` keys in both locales and the `docs/maps-spec.md` §7 / `docs/routes-spec.md` §6
      rows. **QA:** `npm test` twice (**154 files / 1985 tests**), `npm run build`, 14/14 paths,
      `RouteScene.ts` and `mapView.ts` byte-identical, the eight floor fills in their windows
      (1.2490 / 1.2503 / 1.1552 / 1.3631 / 1.3567 / 1.3020 / 1.2740 / 1.2110) with
      `TRADE_CHANCE = 0.2`, 78/400 trade leaves at map 5 and 0/200 on maps 1-2, and the five
      `[live]` criteria measured on canvas (counter sprite 0/380 differing pixels, the refusal,
      one rolled trade at `squadLevel` with full HP, the floor-scoped mark and the minimap glyph).
      The plan's seed `pkm-111` hangs no trade leaf; the live pass used `qa-trade-5` (map 3,
      room 8) and recorded the deviation.

- [x] **The FRLG NPC overworld sprite set: ten special-NPC rows and the Rocket grunt.**
      `scripts/frlg/build-overworld-sprites.mjs` now packs the decomp's NPC classes as rows of
      the same nine 16×32 poses, taking its source directory only as an **absolute argv/env**
      path (`PKM_FRLG_OVERWORLD_DIR`) and refusing a relative path, a path inside the worktree or
      a missing directory (the Asset-trees rule). The atlas grows from 144×320 to **144×672**
      (21 rows × 9 poses = 189 frames, every frame with art), the manifest
      `src/data/frlg/overworld.json` gains `sprites` (trainer rows at 0…81, `rocket` 90, the ten
      NPC keys 99…180), `sources` and six documented `fallbacks`, and
      `src/data/overworldSprites.ts` exports `OVERWORLD_SPRITE_KEYS`, `NPC_SPRITE_KEYS`,
      `OVERWORLD_SPRITE_FALLBACKS` and `overworldHasSprite`. The ten keys are `merchant`,
      `chef`, `magician`, `exorcist`, `weather-man`, `sacrifice`, `medic`, `iv-judge`,
      `berry-tree` and `ninja`; `rocket` is the casino's real grunt art and its placeholder is
      gone. The ten trainer rows are **pixel-identical** to the shipped atlas.
      `src/assets/README.md`, `docs/art-direction.md` and the `D24` addendum in
      `docs/tech-decisions.md` carry the provenance. **QA:** 14/14 criteria, `npm test`
      (**1939 tests**) and `npm run build`, ten paths, a byte-stable double repack, the four
      Asset-trees refusals, and both `[live]` criteria on canvas (casino grunt `frame 92`,
      `cutY = 320`, tint white; a trainer row `frame 65`, `cutY = 224 = floor(65/9)*32`).

- [x] **The out-of-battle abilities: a room's ability pays an item.** The pure
      `src/engine/run/passives.ts` reads the party's abilities on room entry and on a win against
      the new `MAP_PASSIVES` table (`src/data/passives.ts`): `pickup` (room) and `honeygather`
      (win), each a chance and an item list, on the minted
      `${seed}:passive:${mapIndex}:${roomId}:${ability}` stream (at most two draws, no shipped
      stream moves). A payout marks `passive-<ability>-<trigger>-<map>-<room>` in `pickedItems`,
      so it is **once per floor**, and a room that does not pay returns the same run reference:
      **no run field** and **no `SAVE_VERSION`** step. The scene seam is **+27 lines** in
      `RouteScene.ts` (`applyMapPassives`/`showPassivePickups` on `transitionTo`, and the win
      pair before `persistRun`), reusing the shipped `itemPickupNotice` with **no new i18n key**.
      The two abilities were unreachable — the random-ability pool is derived from the effect
      registry — so the task registers their empty battle handlers, removes their coverage
      exclusion and regenerates `docs/balance/effect-coverage.md` (263 port / 36 excluded); new
      members' random abilities re-roll once. **QA:** `npm test` twice (**154 files / 1955
      tests**), `npm run build`, 14/14 paths, the `PASSIVE_PINS` fixed-seed regression and all
      three `[live]` criteria (Pickup on room entry, Honey Gather on a win once per room, and the
      trigger being the live ability), with the pre-existing Windows CRLF drift in
      `scripts/effect-coverage.mjs` recorded rather than hand-fixed.

- [x] **Batch 26 integration.** The three tasks merge in ID order onto `main` with the batch
      gates after each merge (**1985 → 1988 → 2007 tests**, `npm run build` green). The combined
      tree has 36 paths, two of them shared docs: `src/engine/README.md` (the only merge
      conflict, resolved keeping both `run/trade.ts` and `run/passives.ts`) and
      `docs/routes-spec.md` (§6 trade + §2 passives, 28 insertions, 0 deletions). No code, data
      or asset path overlaps; `src/scenes/RouteScene.ts` is byte-identical for Task-66 and
      carries only Task-105's +27-line seam.

- [x] **The gated reward room: a vault behind a bush, a rock or a pond that only a party type
      opens.** The room layer's second descriptor, `src/scenes/rooms/gate.ts`, so the scene gained
      only the port's two new hooks — `RoomHost.route()` reads the seal and its pocket,
      `RoomHost.rebuildRoom()` redraws the room in place while keeping the live `RouteEncounters` —
      plus `buildRoom`'s gate flag, the reward's placement and the interact route. The **generator**
      owns the vault: `carveGatedVault` (`src/engine/routes/gate.ts`) runs inside `attemptRoute` and
      returns the route's `RouteGate` (`kind`, `tile`, `pocket`); the vault is deliberately not in
      `route.pockets`, and a build that asks for a gate and cannot carve one fails
      `validateRoute`'s new `missingGate`, so the room never ships without its seal. The opening is
      an **input to the build**, `RouteRequest.gate: 'sealed' | 'open'` read from
      `isItemPicked(run, gateId(...))`, so a revisit and a reload draw the same room and the scene
      keeps no state. `BUSH = 10` and `ROCK = 11` join `SOLID` (the water seal reuses the shipped
      `WATER`), and frames **49** and **50** are the only free atlas cells: `build-tilesets.mjs`
      stamps them into all three FRLG atlases and the test that pinned them blank now pins them
      drawn. `partyHasType` / `memberTypes` (`src/engine/run/party.ts`) read the party's **species**
      types and no HP/status filter — any member counts, the box does not — over the three rows of
      `src/data/gates.ts`: bush Bug/Grass, rock Rock/Fighting, water Water. The reward is an
      ordinary ground item off `gate-loot-<map>-<room>` and the opening is `gate-<map>-<room>` in
      `pickedItems`, cleared by `advanceMap`: **no run field**, **no `SAVE_VERSION`** step. The kind
      hangs **20 % from map 3 on**, drawn last in `planMap`'s special pass off two minted streams, so
      every shipped floor's specials, links and sizes stay identical. `docs/route-generator.md`
      §7's **O-R5** is **reworded, not closed** — a type gate is not a Cut/Rock Smash field-move
      gate — and `docs/balance/route-curve.md`'s rows for maps 3-8 were re-measured (no tuning number
      moved) because the leaf's extra door shifts trainers ±15-20 % on its floor. **QA** was a
      single pass (one-task batch): `npm test` green twice (**152 files / 1936 tests**), `npm run
      build` green, 40/41 paths inside the amended exclusive list (the one extra is the casino
      stub's two `RoomHost` members, a gap in the spec's list rather than a scope breach),
      `src/engine/` pure, `src/data/dex/**` untouched, the eight floor fills in their windows
      (1.2490 / 1.2503 / 1.1552 / 1.3631 / 1.3567 / 1.3290 / 1.0382 / 1.1693), the shipped routes
      byte-identical across 10 seeds × 8 maps and the three atlases byte-identical after a
      re-pack. **The five `[live]` criteria are unverified**: the QA session had no browser, so the
      canvas measurement, the two notices, the keeps-open walk and the minimap glyph are recorded as
      **not run**, with their mechanics covered headlessly on seed `pkm-111`.

- [x] **The casino room: a Team Rocket grunt, a slot machine and the Egg.** The room layer's first
      new kind since `D47` is a **descriptor module**, `src/scenes/rooms/casino.ts`, so the scene
      gained only what the port was missing — `RoomHost.startTrainerBattle` (the hook `D47` itself
      names) and `RoomHost.showNotice` — and the registry did not change. `MapRoomSpecial` gained
      `'casino'`, hung **last** in `planMap`'s special pass (`CASINO_CHANCE = 0.3`, from map 2, at
      `dead-end` only), so every already-shipped special keeps its id, tile and size, and the
      minimap glyph comes from the descriptor's own `drawMarker` (`src/ui/mapView.ts` needed no
      edit, because `MapRoomMarker` **is** `MapRoomSpecial`). The machine is a texture drawn in
      `BootScene.ts` beside the grunt, and the grunt is a **set-piece archetype**: a new
      `SPECIAL_ARCHETYPES` table (`rocket`, `Team Rocket`, the `psychic` money and AI flags) merged
      only into `getTrainerArchetype`'s index, so `TRAINER_ARCHETYPES`,
      `TRAINER_ARCHETYPE_IDS`, `TRAINER_WALK_ANIMS` and the four shipped atlas/animation invariants
      did not move and **no packer ran**. The machine's model is the pure `casinoSpin(run)`
      (`src/ui/casino.ts` + test) over its own stream `${seed}:casino:${mapIndex}:${spins}`, where
      `spins` is read off the run's own per-floor `pickedItems` marks (`casino-spin-<map>-<n>`) so
      a reload continues the sequence; the battle prize locks the machine (`casino-lock-<map>`),
      the price steps per band (300 / 700 / 1000 / 1500 / 2000 / 2500) and the prize weights live
      in the new `src/data/casino.ts`. The **Egg** is an ordinary bag item (`valuable`, `price: 0`,
      never sellable — the catalogue's never-sold sweep learned its id — and it borrows the
      `luckyegg` icon frame), and `hatchEgg(run)` turns it into a member of the **new** floor's
      `speciesPool(band, 'wild')` at `squadLevel` through the shipped `createRunPokemon` →
      `adoptAtLevel` → `addPokemon` path, fired by the portal step (`advanceMap`) and announced by
      the new `eggHatchNotice`. Eight i18n keys in `en` and `es`, the
      `docs/maps-spec.md` §7 and `docs/design-spec.md` §7 rows, and both folder READMEs. The room adds **no run field**
      (the lock and the spin counter ride `pickedItems`, the Egg is a bag item), so **no
      `SAVE_VERSION`** step. **QA** was a single pass (one-task batch): the gates green on `main` +
      `task-64` (148 files / **1869 tests** twice, `npm run build`), the diff's 27/27 paths inside
      the spec's exclusive list, the folder's tests green, and the pure model replayable from the
      marks. **Measured, not assumed:** a 12-seed × 8-map sweep found at most one casino per floor,
      never on map 1, always a `dead-end`, never entry or boss, and never farther than the boss; a
      diff against a **pre-change** `planMap` module (8 seeds × 8 maps) shows the three older
      specials' `specials`, `links`, `entryRoom`/`bossRoom` and every `size` **identical**; and a
      live CDP run at 1280×800 on seed `pkm-111` measured the room (cabinet `#4c2a6b` 1215 px,
      reels `#f2c14e` 126, lever `#e11d48` 91, window `#111827` 384, grunt placeholder `#c0392b`
      273), the panel in both locales (`SLOT MACHINE`/`TRAGAPERRAS`, `SPIN ¥2000`/`GIRAR ¥2000`),
      three paid spins (30000 → 24000, `Obtained Ultra Ball!` / `Full Restore!` / `Egg!`), a battle
      spin (window closed, `casino-grunt-5` = Team Rocket, Dhelmise 35 / Mr. Mime 32 / Roserade 32),
      the lock (`The machine is out of order.`, money still 28000) and the next floor spinning
      again, and the Egg hatching into `Tangrowth L5` on the portal with `stats.catches`,
      `caughtSpecies`, `capturedRooms` and `pcCatch` untouched. Two things it carries rather than
      hides: the **`rocket` sprite row has no art** — no Rocket strip exists in the checked sources,
      so both surfaces use the shipped placeholder and the repack belongs to `[Task-90]`'s cut —
      and the panel is keyboard-only, unlike the Mart's clickable rows (a later task's parity, not
      this one's).

- [x] **The special-room layer leaves `RouteScene.ts`, and a new room is a new file.** Every special
      room kind is now a descriptor module under `src/scenes/rooms/`: `types.ts` freezes the
      `RoomDescriptor` contract (`kind`, `marker`, `fixture`, `interact`, `drawFixture`, `drawMarker`)
      beside the `RoomHost` port a room reads the scene through and the `RoomPanel` a room opens,
      `registry.ts` is the pure `collectDescriptors(modules)` collector (indexed by `kind` and by
      `marker`, a duplicate kind throwing with both module paths, a module without a `descriptor`
      export skipped silently), and `shop.ts`, `miniBoss.ts` and `megaStone.ts` are the three shipped
      rooms moved **verbatim** — the Mart panel, its tabs, its cursor and its keys; the mini-boss
      trainer off `miniBossTrainerId`; the mega-stone item off `megaStoneItemId` and the same
      `${seed}:mega:${mapIndex}` stream. `RouteScene.ts` keeps one auto-discovered registry built with
      `import.meta.glob(['./rooms/*.ts', '!./rooms/*.test.ts'], { eager: true })` (the negative
      pattern is deliberate: a bare glob would pull the folder's tests into the browser bundle), the
      scene still owns *who holds the keyboard* (`roomPanel`) and *where the counter is*
      (`shopCounter`), the marker chain in `drawMapMarker` is one registry lookup, and the room owns
      what its panel looks like. The layering is **D47** and the route HUD's bullet in
      `docs/design-spec.md` §3 gained its one line; both folder READMEs gained their map. It is a
      pure refactor: no tile, marker, price, key, text, RNG draw or run field moved, so **no
      `SAVE_VERSION`** step and no fixed-seed re-pin. **QA** was a single pass (a batch of exactly one
      task, so the per-task tree *is* the combined tree): the batch gates green on `main` +
      `task-111` (145 files / **1829 tests**, `npm run build`), the diff's 12/12 paths inside the
      spec's exclusive list, `src/engine/`, `src/data/` and `src/main.ts` untouched, the folder's 18
      new tests green, and the seed-`pkm-111` mega-stone literal pinned off the **pre-change** build
      as the stream-moved regression. **Measured, not assumed:** QA drove its own dev server and
      browser over CDP and read the live canvas (`renderer.snapshotArea` + `getImageData`) on both
      trees at 1280x800 on the same seed: the minimap rect (`8,8,216,250`, sha `0f37b968…`) and the
      open Mart rect (`320,130,640,540`, sha `f56f0ca5…`) are **0 differing pixels**, the ten rooms of
      map 5 dump identical fixtures (shop counter `(14,24)`, `miniboss-5` at `(23,27)` facing `W`
      with `sight 5` and `ace`, `mega-5` → `dragoninite` at `(6,16)`, `hidden:false`), and the Mart
      still answers `E`/`Q`, `←`/`→` and `↑`/`↓` with the buy and sell deltas exact
      (`Has vendido Poke Ball por ¥100.`, `Has comprado Charti Berry por ¥200.`). Two notes the batch
      carries rather than hides: the pixel run used **map 5** instead of the spec's map 3, because
      seed `pkm-111`'s map 3 hangs only the shop and the mini-boss leaf (mega-stone lands on maps 5
      and 8); and `npm run lint` is **red on `main` already** — `src/i18n/content.ts`,
      `src/ui/partyDetail.ts` and `src/ui/evolutionGraph.test.ts`, three files outside this task's
      diff (four before the merge, since this task leaves `RouteScene.ts`'s Task-112 hunk
      prettier-clean) — so the spec's lint criterion is reported as a **pre-existing** failure that
      owes a one-line chore, not this batch.

- [x] **The moves and the abilities speak Spanish, with the official names and descriptions.**
      `src/data/i18n/es/moves.json` and `abilities.json` (generated by
      `node scripts/build-i18n-content.mjs --source <PokeAPI csv dir>` from PokeAPI's `es`
      `names` and `flavor_text_entries`) carry the official Spanish name of **all 835 moves**
      and **all 311 abilities**, and the official description of **817 moves** and **268
      abilities** (the base Scarlet/Violet dump fills the Gen 9 rows PokeAPI lacks). `src/i18n/content.ts` exposes `moveName`, `moveDescription`,
      `moveShortDescription`, `abilityName` and `abilityDescription`, with
      `abilityNameFromEnglish`/`abilityDescriptionFromEnglish` for a fighter's stored English
      ability name, and the route detail, the battle MOVES grid, the learnset band, the
      level-up notice and the ability popup read them. The names are the **official Spanish
      names**, not translations (`Tackle` → `Placaje`, `Ember` → `Ascuas`, `Growl` → `Gruñido`,
      `Blaze` → `Mar Llamas`, `Torrent` → `Torrente`, `Overgrow` → `Espesura`); the English
      table and the dex keep the English strings unchanged, no rule, RNG draw or run field
      moved, so **no `SAVE_VERSION`** step. The 18 moves and 43 abilities whose base-game dump
      has no Spanish text (the DLC rows) are listed in `MISSING_ES` and fall back to English
      until `Task-113` fills them. `npm test` 143 files / 1811 tests and `npm run build` green.

- [x] **A beaten mini-boss also offers three unidentifiable Pokémon beside its item rows.**
      The mini-boss reward is now **one window with two row kinds**: the three item rows it
      shipped (`rewardChoices`, untouched, off its own `${seed}:reward:${mapIndex}` stream) and
      **three Pokémon rows** drawn by a new pure chooser, `pokemonRewardChoices`, off a **sibling**
      stream `${seed}:reward:${mapIndex}:pokemon`, so a fixed seed's item rows do not move (a
      regression pins it). Each option is `{ speciesId, level, nature, topStat, ability, moves }`,
      built from the shipped primitives — `speciesPool(band, 'wild')`, one `rng.int` per species
      (distinct) plus one per nature and **no other draw**, and one `createFighter({ level,
      nature, learnsetSeed: run.seed })` so the revealed ability and moveset are the member's own
      (D17) — and the row prints **only** its highest stat and its nature (`DEFENSE · Lonely`),
      composed from the existing `detail.stat.*` keys and the dex's English nature names, so the
      window adds **no** i18n key. `topStat` is the argmax of `atk/def/spa/spd/spe` in that fixed
      order and **never HP** (HP's flat `+level+10` would win every level and the reveal would
      carry no information); the level is clamped exactly as `adoptAtLevel` clamps it. Taking a
      row lands the member through the shipped placement — `createRunPokemon` → `adoptAtLevel` at
      the **squad's** level → `addPokemon`, so a full party sends it to the box — and it is **not
      a catch**: no room capture is spent, `stats.catches` does not move, no `pcCatch` is
      recorded. The cursor, the `E`/`Q` keys and the leave path stay one control across both
      kinds, and the window is six rows tall (`REWARD_H` 420 → 660). `src/ui/rewards.ts` +
      `rewards.test.ts` (14 cases), `src/scenes/RouteScene.ts`, `docs/maps-spec.md` §7 and
      `docs/design-spec.md` §7. Adds no run field, so **no `SAVE_VERSION` step**. **Measured,
      not assumed:** Task QA and the Orchestrator each drove their own headless Chromium over CDP
      on a clean tree (`renderer.snapshotArea` + `getImageData`, 1280×800, `run.seed ===
      'dev-seed'`): six rows of kinds `item,item,item,pokemon,pokemon,pokemon`, the three Pokémon
      rows **deep-equal** to a live recomputation of `pokemonRewardChoices(...)` on the same
      stream with **no** icon and **no** description, their labels equal to
      `pokemonRewardRowLabel(option)` (`DEFENSE · Lonely`, `SP. ATK · Modest`, `SP. ATK · Hardy`)
      and free of every species name, ability id and move id, the item rows unchanged
      (`potion`/`antidote`/`pokeball` = a live `rewardChoices` recomputation), the label band of
      each Pokémon row carrying **374 / 306 / 281** pixels of the exact `FRLG_INK` (248, 250, 252)
      against **0** in the band where an item row prints its name (and 130 on item row 0), and the
      key path placing one member whose species, level, nature and ability match the option while
      `stats.catches`, `caughtSpecies` and `pcCatch` stay put and `onDone` fires once.

- [x] **Gigantamax needs a stone, named `<Base>ite G`.** Gigantamax is now **stone-gated** the
      way Mega Evolution is (D44 rewritten): `scripts/build-dex.mjs` mints one stone per G-Max
      forme into the regenerated `src/data/dex/gmaxes.json` (`stoneId` / `stoneName` beside
      `baseSpeciesId`, 34 rows, `meta.json` unchanged and `megas.json` byte-identical — the
      shipped `megaStoneName` is untouched, so only Eevee, Butterfree and Alcremie, the three
      bases ending in a vowel run, read the derived `Eeveite G`, `Butterfreite G` and
      `Alcremiite G`, with the entry's own `Venusaurite G` as the worked example), the catalogue
      gains `GMAX_STONES` / `GMAX_STONE_IDS` beside `MEGA_STONES` (`kind: 'held'`, price 8000,
      resale 4000, never spent on use), `src/data/dex/gmaxes.ts` gains the `gmaxFormForItem` /
      `gmaxMatchesSpecies` pair mirroring `megas.ts`, and `canGigantamax` now requires the
      **holder's own stone** — so the battle's G-MAX cell, the AI that arms `gmax` and
      `validateCommand`'s refusal all move together with no scene edit. The STATS graph's row
      prints the stone (`detail.gmaxEvolvesWith`, both tables, `detail.gmaxNoStone` gone) and the
      stones are **reachable** by the shipped precedents: a fixed **sixth Mart row** at `late`
      and `end` drawn like the machine row, and ground treasure at `late` (4 ids) and `end`
      (6 ids) at weight 1, leaving the four early bands byte-identical. 29 paths including the
      item-icon and item-effect seams (a stone takes the Hard Stone icon and registers with no
      handlers, like a Mega Stone), `src/engine/battle/harness.ts` (`HarnessFighterSpec.heldItem`
      for the fixed-seed regression), the two i18n tables and `docs/tech-decisions.md`,
      `docs/battle-spec.md` §9/§10, `docs/data-spec.md` §1 and `docs/balance/economy.md`. The
      golden logs do not move and it adds no run field, so **no `SAVE_VERSION` step** — the chain
      stays **14 → 15 → 16 → 17 → 18**. **Measured, not assumed:** QA extracted `megaStoneName`
      from both trees (963 identical bytes), regenerated the dex twice (byte-identical, only
      `gmaxes.json` moved), pinned the stone matrix (with the right stone true; without, with the
      Mega stone, with another forme's stone, fainted, already Mega'd and already Gigantamaxed
      false), and both Task QA and the Orchestrator read the **live** battle over CDP: a Gengar
      lead with **no** stone reports `gmaxAvailable() === false` with the cell, its glyph and its
      zone hidden and a click leaving the intent false, while the same lead holding `gengariteg`
      reports `true` with the cell painted at `FRLG_ROW_FILL` and, after the click, the intent and
      the selection set with the fill at `FRLG_SELECTED_FILL` — a `snapshotArea` + `getImageData`
      diff of the cell's own 62×152 rect changing **9424 of 9424** pixels. **One follow-up is
      open** (an `agent-review` issue, not this batch): the longer row copy overruns the STATS
      band's row box on five of the 34 rows.

- [x] **A room's battles begin under a weather, a terrain or a room condition, and the route
      paints it.** A plan room can now own a battle-start condition — `sun`, `rain`, `sand`,
      `snow`, `electric`, `grassy`, `misty`, `psychic`, `fog`, `gravity` or `trickroom` —
      rolled once from the run seed on the room's **stable** index (`routeIndexForRoom`, the
      key the room's geometry, its trainers and its loot already use) and on a stream of its
      own, `Rng(hashSeed(`${seed}:battlefield:${roomIndex}`))`, drawing exactly one
      `rng.next()` for the chance plus one `rng.int` over the table — so no existing
      `layout`/`map`/`encounters`/roster stream moves, a fresh seed's run is unchanged and a
      revisited room shows the same condition. A room that fields regular trainers rolls at
      **15 %** and the boss room at its own **30 %** (`src/data/battlefields.ts`); the entry
      room and every special leaf are quiet and roll nothing (`roomKindOf`). The roll, the
      seed mapper and the room kind are pure engine (`src/engine/routes/battlefield.ts`) and
      the row shape is data, never code: each row carries the filter's `tint` and `alpha`, so
      a rebalance is a table edit. The route paints one static tinted rectangle over the room
      (`BATTLEFIELD_DEPTH = 25`, above the tiles and the actors and below the dev marker and
      the HUD, allocating nothing per frame), rebuilt and destroyed with the room. The
      condition reaches the battle through the launch seam the scene already had —
      `BattleLaunch.battlefield` → `battlefieldSeeds` → `createBattle`'s new optional
      `weather`/`terrain`/`field`/`fog`, all defaulting to today's `null`/`0`/`0`/
      `emptyFieldConditions()`/`false`, so every existing call site and the whole existing
      suite are unchanged — and it seeds **every** battle that starts in that room, wilds
      included. **Dense fog is the one new rule**, added exactly as the decision requires: a
      **field condition** (`BattleState.fog`, never a `WeatherId`, never entering
      `weatherModifier`/`weatherChip`), it drops every move's own accuracy by
      `FOG_ACCURACY_PENALTY = 20` **before** the stage multiplier with the result clamped at
      **0**, and a move that cannot miss is **unaffected**; `hitChance` and `movePreview` pass
      the flag, so the moves menu and the engine read one rule. It adds no run field, so **no
      `SAVE_VERSION` step** — the chain stays **14 → 15 → 16 → 17 → 18**. **Measured, not
      assumed:** on the combined commit `aac7adb3` QA drove its own headless Chromium over CDP
      (`renderer.snapshotArea` + `getImageData`, on the Canvas renderer — the container
      exposes no GL driver) against `npm run dev`, and on the demo run's `dev-seed` floor 1 the
      roll puts `gravity` in room 3: the live overlay's own `fillColor`/`fillAlpha` equal the
      table's `0x5a4a8a`/`0.24`, and toggling its visibility moves the mean RGB of a 24×24
      snapshot at the player's tile by **14.47** (bound ≥ 5) while restoring it returns the
      sample to **0** apart (bound ≤ 2); room 0 reads
      `debugBattlefieldOverlay() === null`, a revisit reproduces the identical row, and a
      battle started there (`startDebugWildBattle`) opens with `state.field.gravity === 5`,
      `field.trickroom === 0`, `weather`/`terrain` null and `fog` false; independently, 1000
      room indices at `dev-seed` count **145** trainer rolls (bound `[120, 180]`) and **302**
      boss rolls (bound `[260, 340]`). One spec number was corrected on the way, and QA
      re-measured both sides of the corrected equality: the fog criterion's "≈ 0.6" under a
      `+1` accuracy stage contradicted the Contract's own body, because
      `accuracyStageMultiplier(1)` is **4/3** and not 3/2, so 60-with-fog is **0.53333** =
      `accuracyChance(40, …)` at the same stage.
- [x] **A map boss's fall no longer warps the player to the room's door.** Beating the boss
      rebuilt the room through the **room-change** path (`transitionTo`), which ends by
      respawning the player on the room's entry tile — right for a door or a portal step,
      wrong for a boss the player met at the room's farthest tile. `transitionTo` now takes
      an optional `TransitionOptions { keepPosition?: boolean }` and the boss-win branch of
      `applyBattleResult` is the **only** one of its five call sites that passes it, so the
      room is still rebuilt — the portal's art changes, which is why the rebuild exists — and
      the tile the fight was triggered from is restored instead of the door, while doors,
      portal steps and both dev teleports keep today's respawn byte for byte. It reads no
      RNG, adds no run field and changes no rule (the portal still opens when the boss falls,
      D31), so **no `SAVE_VERSION` step** — the chain stays **14 → 15 → 16 → 17 → 18**.
      **Measured, not assumed:** on the combined commit `390818e8` the Orchestrator drove a
      Vite dev server and the runner's headless Chromium over CDP and read the **live scene
      state** — the player stood on tile (15, 4) with the room's entry at (0, 10) before the
      fatal blow and on (15, 4) after the rebuild (`sameTile` true), `bossDefeated` and
      `portalOpen` true, the sprite re-placed exactly at `(372, 120)` = (15·24 + 12, 4·24 +
      24), and both `teleportToRoom` and `teleportToFloor` still landing the player on the
      new room's entry tile. Task QA reproduced the same readings independently and added the
      two controls the recipe needs: the rebuild is real and not a no-op — six tiles on the
      portal edge flip from wall to walkable and not one more — and the sprite is on screen
      after it (a canvas differential of 755 changed pixels against a 737-pixel control, with
      the camera at zoom 1.5).
- [x] **The twelve forme-changing abilities are deleted; their formes arrive as data.**
      `Battle Bond`, `Disguise`, `Flower Gift`, `Forecast`, `Hunger Switch`, `Schooling`,
      `Shields Down`, `Stance Change`, `Tera Shift`, `Zen Mode`, `Zen Mode (Galar)` and
      `Zero to Hero` leave the engine registry — handlers, registry rows and the helpers only
      they used (`changeForm`, `revertForm`, `formReady`, `thresholdForm`, `FORM_MIN_LEVEL`)
      with them, and the `randomAbility` pool loses exactly those twelve. **`Ice Face` stays**
      (in this tree it only sets a shield volatile and never reaches Eiscue-Noice), and so do
      `changeBattleForm`/`restoreBattleForm`, which Mega Evolution and Gigantamax still call;
      `BattleScene`'s Zero-to-Hero sprite special case goes. Every forme they used to reach is
      reachable in a run instead: the hand-authored `FORM_EVOLUTIONS` override gains
      **eighteen rows** — Palafin-Hero (48), Wishiwashi's School (20), Cherrim's Sunshine (40),
      Castform's Sun/Rain/Snow (40, branched, Eevee-style), Cramorant's Gulping/Gorging (40),
      Aegislash's Blade (55), Darumaka's and Darumaka-Galar's Zen splits (35 and 20),
      Ogerpon's three masks (40), and the two sequential lines Zygarde 10% → 50% → Complete
      (50, 60) and Terapagos → Terastal → Stellar (50, 60), each stage `+10` and each one-way.
      Mimikyu keeps only its standing form; Meloetta and the Ogerpon `-Tera` formes are out of
      scope by the decision. **Castform's and Cherrim's promoted formes were stat-identical to
      their base**, so the build now authors a real upgrade — Castform **`+60`** Sp. Atk
      (BST 480), Cherrim **`+30`/`+30`** (BST 510) — and Greninja-Ash is not a branch at all:
      it joins the Mega table as Greninja's **second** Mega with its own stone
      `Greninjite Ash`, so `MEGA_STONES` and the STATS graph take it with no new code
      (megas 88 → **89**). The Eiscue/Morpeko/Minior half of the decision needed a seam that
      did not exist — nothing read `isCosmeticForme` — so this task adds one: the
      hand-authored `VARIANT_FORMES` table, `variantSpecies(speciesId, rng)` (one draw per
      appearance for a variant species, none otherwise) and `Rng.split(salt)`, a **sibling**
      stream that reads the parent's position and never advances it, drawn at the two real
      generation sites (`rollEncounter`'s wild table and `trainerRoster`). The three species
      stay **one pool entry** each with their alternate forme rolled per individual; the
      starter half of "every appearance" is vacuous by construction, because
      `starterCandidates()` cannot offer them. **No existing stream moves:** the fixed-seed
      regressions drive a hand-built `Rng` in today's draw order — the chance `next()`, the
      `pickWeighted` `next()`, the level `int()`, and the roster's shrinking-pool pick plus
      its level — and reproduce every level and species exactly. The dex regenerates to
      `species 1281`, `megas 89`, `learnsets 1280`, the coverage table gains a fourth status
      and reads `## Abilities — 311 total (261 port, 0 no-op, 38 excluded, 12 removed)`, and
      **`D41` is reversed** in `docs/tech-decisions.md`. Every criterion of this task is
      `[unit]`, so it owes no browser pass: `npm test` (140 files, **1751** tests) and
      `npm run build` are green on the merge commit, and Task QA and Integration QA proved the
      generators idempotent (`npm run data:dex`, `npm run docs:coverage` and the art index,
      each run twice, leave the tree clean with byte-identical output). It adds no run field,
      so the version chain stays **14 → 15 → 16 → 17 → 18**. Four things the cut's own wording
      got wrong are recorded rather than hidden: the spec's exclusive-path list was incomplete
      (`src/data/dex/learnsets.json` is forced because `build-dex.mjs` iterates the
      **playable** set, and `src/assets/pokemon/index.json` because `index.test.ts` pins
      `files ∪ missing === playableSpecies()` — both are their own generator's output, both
      reproduced byte for byte); the third Terapagos stage's real id is `terapagosstellar`,
      not the `terapagostellar` the entry froze; `scripts/effect-coverage.mjs` had drifted
      (two regexes made five real multi-line ability rows read `no-op` and `King's Rock` read
      `excluded`, against a committed table that read them correctly) and was repaired inside
      the task's paths, with QA reconstructing both classifications to prove no row moved
      silently; and Terapagos now **enters `starterCandidates()`**, because the authored
      two-stage line gives it `evolutionDepth` 2 — a real player-facing consequence the spec
      did not name.
- [x] **Every panel is one dark glass card: the `t-glass` direction the human picked, with
      its own contrast pass.** The drawn chrome was light plates inked with deep black; it
      is now one **dark, translucent** card — a `#10161f` surface at **0.72** alpha, a **1px
      hairline** `rgba(255,255,255,0.16)` at the card's own edge with an inset top highlight
      `rgba(255,255,255,0.14)` and a 1px shadow ring, an **11px** corner on both skins, the
      accent `#7dd3fc` **only** where something is selected or is a control, `#f8fafc` body
      ink and `#94a3b8` for every secondary line, ordinary rows at `rgba(255,255,255,0.06)`
      over a `1px rgba(255,255,255,0.10)` border, a selected row, cell or tab at the accent's
      `0.16` fill **plus** its 1px accent outline, and `rgba(255,255,255,0.12)` tracks with
      the HP fill's green kept. **What shipped, and what the sweep had to get right.** The
      packer (`scripts/ui/build-chrome.mjs`) now draws the tokens instead of sampling the
      FRLG sheet's dominant tone, writes the whole **`tokens` block into
      `src/data/ui/chrome.json`**, and moves `window.corner` **20 → 11** and `textbox.corner`
      **24 → 11** — the packed corner *is* the runtime radius, because `addFrlgWindow` hands
      it straight to `setSlices` and the atlas is drawn 1:1 — with `window.alpha` **0.88 →
      0.72** and `textbox.alpha` **0.94 → 0.8**; the two content insets (20/16/8 and
      36/28/28) stay **frozen**, so no panel rect, row or layout number moved. The font
      atlas keeps its glyphs and metrics and its shadow pixels become black at alpha 128, the
      half-alpha halo that makes light ink read over a busy route. `src/ui/frlg.ts` exports
      the tokens (`FRLG_SURFACE`, `FRLG_ACCENT`, `FRLG_MUTED`, `FRLG_BADGE_INK`,
      `FRLG_POSITIVE`, `FRLG_NEGATIVE`, `FRLG_HAIRLINE`, `FRLG_HIGHLIGHT`, `FRLG_SHADOW`,
      `FRLG_ROW_FILL`, `FRLG_ROW_STROKE`, `FRLG_SELECTED_FILL`, `FRLG_SELECTED_STROKE`,
      `FRLG_TRACK`) and `FRLG_INK` is now the **light** body ink read from the manifest, so
      every existing `tint: FRLG_INK` draw site flipped with one constant and the ad-hoc
      greys the scenes passed (`0x6b6887`, `0x3a3956`, `0x94a3b8`, `0x2f2c4d`, `0xe6e3f2`,
      `0xcfcce2`, `0xb9b4d0` and the rest) collapsed into the one muted tone. The transient
      notice strip, the release overlay and `RunOverScene` draw the **card** skin and the
      battle's **message box is the only `'textbox'` call site left**, at the 0.80 the entry
      froze for it; the moves window's MEGA and G-MAX controls are **icon-only** (both the
      shipped Hard Stone frame — no atlas carries a Mega glyph, which the spec froze and
      flagged); the type badges are full colour with the dark badge ink. **No real blur
      ships**: Phaser has no `backdrop-filter`, the panels repaint every feed frame, and a
      per-panel blur is a task of its own — the glass reads from the alpha, the hairline and
      the highlight, and a shadow that reaches outside the panel's rect is out of scope
      because a nine-slice cannot paint beyond its own rect. **The contrast pass, which this
      task owes because `[Task-08]`'s audit is not re-run** (the entry's *Decision*): the new
      `src/ui/frlg.test.ts` pins the tokens and computes WCAG relative-luminance ratios from
      them over the composite of the surface at each skin's alpha over the repo's own forest
      ground tones — body ink **11.17-14.31 ≥ 7**, the muted tone **4.56-5.84 ≥ 4.5**, the
      muted tone over a row **3.80-4.88 ≥ 3**, ink at a dimmed 0.4 **3.18-3.53 ≥ 3**, the
      accent over a selected cell **4.90-6.16 ≥ 4.5**, the selected fill's blue **19.20**
      above an ordinary row's, the HP/XP track **+26/+23/+24** over the field it lies on, and
      the semantic pair **5.88/4.90** and **4.23/3.52** — with `frlgFont.test.ts` gaining the
      light ink and the packed halo. **Measured, not assumed:** the packer is byte-identical
      across two runs and equal to the committed set, and the Orchestrator re-measured every
      `[live]` criterion on the integration commit `88947465` with a Vite dev server and the
      runner's headless Chromium over CDP (`renderer.snapshotArea` + `getImageData`): the HUD
      panel's body is the surface at 0.72 over the ground behind it (Δ 0/0/0), the card's edge
      ring is darker than its body by 5 and its hairline lighter by 45 per channel on the
      sampled row, a panel title's glyph core reads **248,250,252** against the glass at a
      ratio of **15.72**, a selected tab's edge is exactly `125,211,252`, and the battle
      message box at 0.80 composites within 4/3/4 with its ink at **15.25**. One thing the
      cut's own wording left open is recorded rather than hidden: the spec's `composite`
      formula carried a typo (`fg + alpha·(fg − bg)`), so the shipped test uses the standard
      `alpha·fg + (1 − alpha)·bg`, which reproduces every value the spec measured. It adds no
      run field, changes no rule and adds no dependency, so **no `SAVE_VERSION` step** — the
      chain stays **14 → 15 → 16 → 17 → 18** — and the residual subjective judgement (the
      semantic red at 4.23, the darkest canon type colours under the badge ink at 2.75-3.20,
      and the one glyph the two G-Max controls share) went to an `agent-review` issue instead
      of blocking the merge. `docs/art-direction.md`'s palette paragraph and
      `docs/design-spec.md` §3/§4 describe the glass tones, and `src/ui/README.md` plus
      `src/assets/README.md` carry the new roles.

- [x] **The autopilot's brake has a timed window: a range is armed from the workflows, and the loop turns
      itself off when the range ends.** `AUTOPILOT` was manual — two clicks in the settings, and the loop
      ran until somebody remembered to click them back — which is fine for an afternoon and wrong for an
      unattended night. **What shipped.** `agent / autopilot window`
      (`.github/workflows/agent-autopilot-window.yml`) is dispatched with `hours` and, if the range should
      start later, its UTC `HH:MM`; it writes the range into the repository variables `AUTOPILOT_FROM` /
      `AUTOPILOT_UNTIL` as **absolute UTC instants** rather than a recurring `HH:MM` — so a pass never has to
      ask whether that `02:00` was today's or tomorrow's — turns `AUTOPILOT` on, and asks the driver for a
      cycle right away, so a range starts when it is dispatched and not when the cron next feels like
      firing. Its **hourly pass** is the other edge: it arms the brake when the range opens (and starts the
      chain itself, because a range that opens with the loop parked has no cycle in flight to hand the
      baton) and, when the range closes, turns it off **and clears the range** — the driver parks whenever
      `AUTOPILOT_UNTIL` is set, so a range left behind in the past would have kept a human's own `on`
      parked forever. One invariant covers it: **with a range set, the brake mirrors the range**, on either
      edge — `hours: 0` is a stop (brake off, range cleared, and the settings own the brake again), and
      with no range set the pass skips itself entirely and the brake is the manual one it always was. The
      driver reads the same range as a **belt**: a late cron or a stale `on` cannot start a cycle outside
      it (three new `go false` branches, so the summary now answers "why has nothing run?" with the window
      in view and carries the range and the current UTC time as rows). It costs one new secret, because
      **writing a repository variable is not in `GITHUB_TOKEN`'s permission set** (`actions/variables`
      answers 403, "Resource not accessible by integration"): `AUTOPILOT_TOKEN`, a classic PAT with the
      `repo` scope or a fine-grained one with `Variables: read and write`. It reaches this one workflow,
      which runs no agent, and a missing secret fails with a step that names what to create instead of a
      403 out of `gh`. `docs/agent-ci.md` gains the window's own section (the range, the invariant and
      both costs, budget line included), `.github/workflows/README.md` the file's line, and
      `agent-autopilot.yml`'s header the belt's paragraph. **What was measured, and what was not:** every
      branch of both shell snippets — the arm's four states, the hourly pass's five, and the gate's five —
      was driven against a stubbed `gh` in Git Bash over the strings pulled from the YAML itself, and two
      real defects fell out of it: an arm that flipped the brake `off` for a pending range but never `on`
      for an open one, and a spent range that was never cleared. Both were fixed before commit. The first
      live run then caught a third: the PAT sat in the `GH_TOKEN` of every step, so the driver dispatch
      went out as the PAT and came back **403 "Resource not accessible by personal access token"** — the
      PAT now reaches only the two steps that touch a variable, and the dispatch carries the workflow's own
      `GITHUB_TOKEN` with `actions: write`. No game code, no data table and no run field: the chain stays
      **14 → 15 → 16 → 17 → 18**.

- [x] **A move crossed on a level-up waits in the learnset and is never equipped for you.** Reported in
      play ("al subir nivel y aprender ataque no se debe equipar en los 4 actuales debe quedarse en
      learnset y si quiere jugador se lo pone"): a level-up used to push the new move straight into the
      four slots and, when they were full, forget the oldest.
      **What shipped.** `levelUpPokemon` keeps the `level` event and reports one `learn` event per
      crossed move, and it no longer writes a member's `moves` at all — no `moves.push`, no
      `moves.shift`, no `MAX_MOVES` comparison — so the four slots come back untouched and a `forget`
      event can never be emitted again (the variant stays declared; the `moveSlot` helper is gone). The
      learnset band is now the only way into a slot, so the **OHKO / No Guard** guard moves there:
      `learnsetPool` never offers an OHKO move to a No Guard holder, which closes the pairing the engine
      forbids to the drag as well as to the old level-up (and `equipMove` already refuses it for free
      through `poolEntry`). The `learn` variant of `ProgressionEvent` gains a required `memberId`, the
      one contract addition beyond the backlog's fix shape: a flat event list cannot be attributed to a
      member otherwise, and `levelUpBeats` now needs that attribution. `levelUpBeats(before, after,
      events)` takes the resolution's events as a required third argument and fills `learned` from the
      `learn` events of the member that levelled, in event order, instead of diffing the slots — so the
      key-dismissed `LEVEL UP` modal and `[Task-50]`'s transient notice keep announcing the move while
      the slots stay as they were. `LevelUpBeat.forgotten` keeps its place in the frozen shape and is
      always `[]` (an always-empty array pinned by a test states "a level-up never forgets" more
      loudly than deleting the field would), and `RouteScene.applyBattleResult` threads the fold's
      `events` (discarded until now) into its two `playLevelUp` call sites, the mini-boss branch
      included. `docs/battle-spec.md` §7 gains the sentence that a crossed move waits in the band and
      that nothing is ever forgotten; `docs/design-spec.md` §5 already described the band as the equip
      path and is left alone. No engine RNG was touched (no stream is created, drawn or reordered, so
      no seed re-pin), the dex and every data table are untouched, and no run field was added, so
      **no `SAVE_VERSION`** step — the chain stays **14 → 15 → 16 → 17 → 18**; an existing save's
      members keep the moves they hold and simply stop receiving new ones for free. The suite went
      **1710 → 1716 tests across the same 139 files**, with `npm test` and `npm run build` green, and
      the diff audit is exactly the task's eight paths (`RouteScene.ts`, `progression.ts` + test,
      `learnset.ts` + test, `beats.ts` + test and `docs/battle-spec.md`); the OHKO test's premise
      (`diglett` learns `fissure` at 44, `getMove('fissure').ohko`) is asserted inside the case so a
      data move fails it loudly instead of passing vacuously, with a `Sand Veil` control that *is*
      offered the move. **Both `[live]` criteria were measured** on the integration commit `9684136`
      with a Vite dev server (`:5391`) driving the live scene and reading the live canvas over CDP: a
      level-up raises the modal and the transient notice in the same beat, every modal line reads
      `<Name> learned <Move>!`, the four slotted moves read the same four names in the same order
      before and after, and each move the modal named appears in the learnset band below with its
      `Lv##` tag; the modal still closes on one keypress. The task's ID is retired: it keeps its place
      in the sequence and is never reused.

- [x] **The MOVES panel always draws four slots, and a learnset cell dropped on an empty one teaches
      the move there.** Reported in play ("en moves añadir los 4 contenedores aunque no tenga 4 moves
      porque se debe poder aprender un move de mt teniendo 3 moves actualmente si arrastras al hueco lo
      debe aprender"): a member with three moves hid the fourth container, so the drop hit nothing even
      though `equipMove` had already shipped its append past the end of a short moveset.
      **The Decision applied:** both surfaces — the shared `MoveGrid` gains one empty-slot marker and
      both scenes draw the four containers, the battle's empty ones disabled.
      **What shipped.** `src/ui/moveGrid.ts` gains `MoveGridEmptyCell` (`{ empty: true }`),
      `MoveGridSlot = MoveGridCell | MoveGridEmptyCell`, a `cells: readonly MoveGridSlot[]` option and a
      public `MoveGridRect`, plus five exported pure helpers the new test pins without a Phaser scene
      (`isEmptySlot`, `padMoveGridCells`, `moveGridCellRects`, `moveGridIndexAt`, `moveGridInfoAt`) and
      `isEmpty(index)` on the class. `layout` now takes its `cellRects` from `moveGridCellRects`, so a
      drawn cell and its hit rect can never diverge, and the module's private `Rect` type is gone (one
      rect type, the exported one). The empty container is that slot's rectangle plus its stroke and
      **nothing else** — fill `0xe6e3f2` (the grid's own untinted cell colour, so no new colour), the
      existing selected/default stroke pair, and the name, type badge, category badge, PP/PWR/ACC, ⓘ and
      index label all hidden — with `indexAt` and `cellRect` answering for it (it is a drop target) and
      `infoAt` always `false` (a press there is never a ⓘ and no description floats). `RouteScene`'s
      MOVES tab pads `detail.moves` with `padMoveGridCells(moveCells, MAX_MOVES)`, except that a member
      with **zero** moves keeps the shipped `no moves` text and draws no containers at all; a press on
      an empty container is swallowed before `grabMove`, `confirmDetailSlot` no-ops on it, and
      `hudDetailStops` exposes `slots: MAX_MOVES` to the keyboard stops, so both the learnset drag and a
      keyboard confirm land on slot 3 and reach the shipped `equipMove`, which appends there.
      `BattleScene`'s `renderMoveMenu` pads its cells the same way while `count` stays the real move
      count, so `menuZones` keeps one zone per **real** move: the battle's spare containers are drawn,
      `item -1`, disabled, never under the ▶ cursor and never submit a turn. `docs/design-spec.md` §3's
      MOVES bullet now reads that the panel always draws its four slots and that an **empty** slot takes
      a dragged move (a member with no moves still reads `no moves`), and §4's moves-menu sentence gains
      the empty-container clause; the backlog's own "§5" pointer for both was stale — the sentences live
      in §3 — and `src/ui/README.md` gained the new test's one role line. No engine rule, no RNG draw,
      no run field and no new constant (the four slots are the shipped `MAX_MOVES`), so **no
      `SAVE_VERSION`** step — the chain stays **14 → 15 → 16 → 17 → 18**. The suite went **1700 → 1710
      tests across 138 → 139 files** (+9 cases in the new `src/ui/moveGrid.test.ts`), with `npm test`,
      `npm run build` and `npm run lint` green; the diff audit is exactly the task's six paths and
      nothing under `src/engine/**`, `src/data/**`, `src/i18n/**` or the root config moved.
      **Every `[live]` criterion was measured** on the combined commit `d1b44b9` with a Vite dev server
      (`:5273`) driving the live scene and reading the live canvas: the HUD draws four 202×70 containers
      at (128,188) (338,188) (128,266) (338,266) with the fourth's fill `0xe6e3f2` untinted, no name, no
      badge, no PP/PWR/ACC and no ⓘ (hovering its corner leaves the popup hidden while a real move's
      floats one); a dragged `TM012 Low Kick` fills it while the first three keep their own names and PP
      and the bag's MT/MO pocket reads the same five rows with the same counts before and after; a
      second pass with `TM005` repeats it and the persisted v18 save holds four moves; the battle draws
      four 304×72 cells with zones `0, 1, -1, -1` (`input.enabled` true, true, false, false) where a
      click on the third or fourth sends no turn and the arrows cycle only the two real moves; the
      keyboard's fourth stop wears the 3 px `0x2f2c4d` stroke and confirms a band move into it (three
      moves become four, the pool loses the move, the bag is untouched); and no padding leaked — a
      one-entry learnset band draws **one** cell and the SWITCH window lists **two** move rows for a
      two-move member. The task's ID is retired: it keeps its place in the sequence and is never reused.

- [x] **The wild table never rolls a species the run has already caught, nor its evolutions nor its
      formes.** Reported in play ("para los pokemon salvaje no deberia aparecer un poke ya capturado
      aunque haya muerto, ninguna de sus evoluciones ni formas tampoco regionales"): the tall grass
      could offer a line the run had already collected, including one whose member had since died.
      **The Decision applied, all three defaults:** the **starter is not tracked** (the grass may still
      roll its line), the rule binds the **wild table only** (`speciesPool(band, 'trainer')` and every
      roster stay exactly as they are), and a table the exclusions would empty **falls back to the
      unfiltered band**. **What shipped.** `RunState.caughtSpecies: readonly string[]` is a run-long
      fact — catch order, deduped, never cleared by `advanceRoute` or `advanceMap`, unlike the four
      per-floor lists — written by `recordCatch(run, speciesId)` (its second argument is new) at the
      one place a catch is folded back into the run, the `result.captured` branch of `resolveBattle`,
      so the record and `RunStats.catches` can never disagree and a failed ball, a run away or a lost
      battle still record nothing. At pool-build time each recorded id expands deterministically to its
      line through the shipped `evolutionFamily` **plus its formes** through the new hand-authored
      `formeFamily(speciesId)` (`src/data/dex/evolutions.ts`, every entry sharing that national dex
      number in `playableSpecies()` order — the alternate and cosmetic formes the build carries as
      species of their own; Mega and G-Max formes live in their own generated files and are not part of
      it; `evolutionFamily` itself does not change and nothing under `src/data/dex/*.json` is touched).
      The round's own helper is `wildExclusions(run)` in `src/engine/run/pool.ts`, beside
      `WILD_BANNED_TAGS`; `encounterTableFor(band, excluded?)` gains the optional set (a one-argument
      call returns today's table byte for byte, so the shipped `pool.test.ts` case stays green
      unmodified) together with `NO_EXCLUSIONS`, and `RouteEncounters` takes the live set as its
      **7th** constructor argument and owns the narrowing (`currentTable()`, `setExclusions()`), so the
      fallback is always "the unfiltered band". **The exclusion is applied before the roll and draws
      nothing** (`pickWeighted` and `rollEncounter` are untouched: one draw for the chance, one for the
      pick, one for the level, one on the shiny stream), which is why a fixed seed's walk is unchanged
      for a run that has caught nothing and why the new 300-step fixed-seed regression (`4242`) holds
      the property the task promises. `RouteScene` passes the **unfiltered** `encounterTableFor(band)`
      plus `wildExclusions(this.run)` and refreshes the live set in `applyBattleResult` immediately
      after `useCapture` **without rebuilding the room** (a rebuild through `applyRoute` would restart
      the room's encounter stream), so the room the player stands in narrows the moment the catch
      lands. The save takes the plan's next step, **`SAVE_VERSION` 17 → 18**, with the usual shape: the
      `17` migration and `parseRun` default an older run's record to `[]` (the lines it caught before
      are not reconstructed) and dedupe it on read; the chain is **14 → 15 → 16 → 17 → 18**. It adds one
      docs clause to `docs/routes-spec.md` §3 and no i18n key, no `src/data/` table and no packed
      asset; the diff audit is exactly its 14 paths and the suite went **1664 → 1687 tests across 137
      files** (+23 cases in the five test files it extends; the only shipped expectations that moved
      are the `SAVE_VERSION` / migration pins in `save.test.ts` and `recordCatch`'s call in
      `state.test.ts`), with `npm run build` and `npm run lint` green. **Every `[live]` criterion was
      measured** on the combined batch commit `3ca74bb3` with a Vite dev server (`:5180`) and a
      headless Chromium over CDP reading the live scene: a capture folded through the live scene's own
      `applyBattleResult` writes `caughtSpecies ['caterpie']` with `stats.catches === 1`, the persisted
      run reads `version 18` with the same list, the room's roller is the **same object**
      (`sameRoller: true` — not rebuilt), its table drops **206 → 204** and the caught species is gone
      from it at once; and a planted v17 document is migrated by the browser's own decoder to `version
      18` with `caughtSpecies []` and the party intact (3 = 3), the live scene writing the slot back as
      v18 with the empty record. The task's ID is retired: it keeps its place in the sequence and is
      never reused.

- [x] **A battle ⓘ opens a window with the battle's own state.** Reported in play ("añade tarea añadir
      un boton info en el combate que abre un panel de informacion con info del estado del combate
      como climas, los cambios de estadisticas en pokemons activos, terrenos, cosas como reflejo,
      pantalla luz y otros ataques que causan contextos"): the battle carried all of it — weather and
      terrain with their turns, seven per-side conditions, seven whole-field conditions, each active's
      stat stages and status — and drew none of it. **The Decision applied:** a **fifth control
      reserved at the right edge of the command window** — the column `MOVE_MEGA_COL` already reserves
      for MEGA, 62 px — labelled `INFO`, so the FIGHT / BAG / SWITCH / RUN **2x2 keeps its geometry**
      and the arrows step onto the control from the grid's edge exactly as they reach MEGA and G-MAX in
      the moves menu (with an empty bag, whose BAG cell is disabled and skipped, one `right` from FIGHT
      lands on it); a confirm or a click opens the list as a `mode` of its own (`'info'`) drawn in the
      shipped menu window, scrolled with the arrows, closed by any confirm or back press or a click,
      and it **never spends a turn**. The list's every line comes from **one new pure module**,
      `src/ui/battleInfo.ts` (`battleInfoRows(state)` / `battleInfoLines(groups)`, with
      `FIELD_CONDITION_IDS` and `SIDE_CONDITION_IDS` as the frozen order): the **weather** and its
      count, the **terrain** and its count, each live **field condition** with its count, each side's
      live **side conditions** with their counts, each side's active **stat stages** in `BOOST_IDS`'
      own order (non-zero only, `+6`/`-6` literal) and each active's **non-volatile status** — and
      **not** the volatiles and **not** the entry hazards the engine does not model (Stealth Rock,
      Spikes, Toxic Spikes, Sticky Web; `src/engine/battle/effects/moves.ts` says so in the tree), as
      the *Decision* froze. Every label is a new player-facing literal created **after** Batch 10's i18n
      sweep, so it arrives as **37 new keys** (`battle.infoControl`, `battle.info.*`, one per condition,
      with the `{turns}` token) authored in English and overlaid by Spanish, held as keys and resolved
      at render time (never at module scope), with the shipped parity/call-site gate green **unedited**.
      It owes the `src/ui/README.md` role line for the new file and one clause plus the window list in
      `docs/design-spec.md` §4, and it claims **no** `src/engine/**`, no `src/data/**`, no i18n key
      table outside `en.ts`/`es.ts`, no `SAVE_VERSION` step (the chain stays 14 → 15 → 16 → 17 → 18) and
      no RNG draw. Its diff audit is exactly its 7 paths, and the suite went **1687 → 1700 tests across
      138 files** (13 new cases in `battleInfo.test.ts`), with `npm run build` and `npm run lint` green.
      **Every `[live]` criterion was measured** on the combined batch commit `3ca74bb3` with a Vite dev
      server (`:5180`) and a headless Chromium over CDP: the control is `62` px wide at `infoX 331`
      against a grid whose right edge is `331`, so it sits **outside** the four cells (`twoByTwo: true`,
      label `INFO`), and the live canvas read through `renderer.snapshotArea` + `getImageData` shows
      **80 ink pixels of 784** sampled around its label over the cell's own `230,227,242` fill; and in
      `'info'` the four lines the scene drew (`FIELD`, `WEATHER  Sun · 5`, `TERRAIN  Grassy · 3`,
      `Trick Room · 2  2` for a live state carrying sun/5, grassy/3, Trick Room/2, Reflect/4 and a +2
      Attack) are **deep-equal** to `battleInfoLines(battleInfoRows(state)).slice(0, 4)` of that same
      `BattleState` — the repository function is the reference, so a hard-coded window fails — with
      **2660 ink pixels of 14400** in the window's body, the control hidden while it is open, and
      `turn` unchanged at `0` both inside the window and after closing (mode back to `menu`). The
      task's ID is retired: it keeps its place in the sequence and is never reused.

- [x] **A level-up raises a temporary popup.** Reported in play ("popup temporal subida de nivel"): a
      level-up said nothing unless it crossed a move, because the only announcement was the
      key-dismissed `LEVEL UP` modal and `showLearnPopup` returns hidden when nothing was learned, so
      the counter tween in the party header was the whole feedback. **The Decision applied:** the
      notice fires on **every** level-up beat — a level that crosses nothing is no longer silent — and
      the modal **stays** for the move names. **One module, N strings, no third window:**
      `src/ui/notice.ts` gains `levelUpNotice(name, level)` beside `catchToPcNotice` and
      `itemPickupNotice`, on the same `Notice` shape and the same `NOTICE_HOLD_MS` (2600), and
      `playLevelUp`'s `onComplete` raises one per beat — before `refreshHud()` resyncs the rows and
      before `showLearnPopup(beats)` — through the route HUD's existing strip. The scene diff is two
      hunks (the `../ui/notice` import and that loop); nothing else moves: no new container, timer,
      input handler, key binding or camera, and the modal's copy, scrim, depth and 250 ms click guard
      are untouched. The multi-beat rule follows `showNotice`'s shipped contract rather than adding
      machinery: a second notice **replaces** the first and restarts its hold, so two members levelling
      together leave the **last beat's** line up for a full hold (measured, below) and the first is
      never shown — no queue, no stagger, no second strip, no `\n`-joined list. The string was created
      **after** Batch 10's i18n sweep, so it goes through the shipped module as the new key
      `notice.levelUp`, authored in English (`'{name} grew to Lv {level}!'`) and overlaid by Spanish
      (`'¡{name} ha subido al nivel {level}!'`), with the parity/call-site test green **unedited**. The
      docs edit landed where the sentence actually is: the plan's pointer to §5 was stale, so the
      frozen clause went into §3's detail-panel bullet, beside the modal it qualifies. **Two files of
      code, one module, one key** (`src/ui/notice.ts`, `src/scenes/RouteScene.ts`, `src/i18n/en.ts`,
      `src/i18n/es.ts`, `src/ui/notice.test.ts`, `docs/design-spec.md`): the suite went **1661 → 1664
      tests across 137 files** (three new cases in `notice.test.ts`), `npm run build` and `npm run lint`
      green on the merge commit `1e87ee7c`, and the diff audit is exactly those six paths. No run field,
      so **no `SAVE_VERSION`** step — the chain stays **14 → 15 → 16 → 17 → 18** — and no RNG is drawn.
      **Every `[live]` criterion was measured** on the integration commit `52d041db` with a Vite dev
      server (`:5199`) and a headless Chromium over CDP, reading the live scene and the live canvas
      (`renderer.snapshotArea` + `getImageData`) rather than a screenshot, with the strip's own rect
      `(280, 24, 720, 44)` on the 1280×800 desktop stage: the notice reads
      `Charmander grew to Lv 6!`, equal to both `levelUpNotice('Charmander', 6).text` and
      `t('notice.levelUp', …)`, on a no-move beat; the strip-up vs strip-down canvas diff is **31 052**
      of the rect's 31 680 px (**98.0 %**), while both in-state controls (`up1`/`up2`, `down1`/`down2`)
      are **0 px** apart; two beats leave the **same** container up (two children) reading the reserve's
      line and never the first member's; a crossed move raises the notice **and** the `LEVEL UP` modal
      in the same beat (`Charmander learned Ember!`); and the strip holds **0** interactive children,
      with the scene active, unpaused and the player unmoved. The self-dismiss measured **2600 ms on
      the game's own clock** (2633 ms observed, one frame at the headless ~11 fps) with no key or click
      sent anywhere. One spec defect was found and corrected rather than hidden: that criterion's
      wall-clock probe (`upAt + 3000`) was defeated by the headless frame rate — Phaser clamps the
      frame delta, so the game clock ran at ~0.97 of wall clock and the strip was still up at
      +3032 ms — so the Orchestrator re-measured it on `noticeTimer.delay === 2600` plus a `+4200` wall
      margin (visible at **+2152**, hidden at **+4267**), which is the criterion's intent. The task's ID
      is retired: it keeps its place in the sequence and is never reused.

- [x] **The battle's player HP panel loses its XP bar.** Reported in play ("quita la barra de xp
      del contenedor de combate"), and the row was exactly where the report pointed: the player
      branch at the end of `drawSidePanel` drew a second, smaller bar 36 px under the HP bar
      (`drawGauge(this.hud, barX, barY + 36, FRLG_HPBAR.width, 8, experienceFraction(this.xp,
      fighter.level), 0x60a5fa)`) plus an `XP n` label 10 px under it, and everything it read was the
      scene's own — `private xp`, assigned once from `launch.xp`, and `xpText`, built once in
      `buildScene`. **The row and everything that existed only for it are gone:** the branch and the
      foe branch's now-pointless `xpText.setVisible(false)`, both fields with their `init` and
      `buildScene` lines, and the two imports that had this call site as their only consumer
      (`experienceFraction` and `drawGauge`). `PLAYER_PANEL_H` goes **184 → 150**, so the frame hugs
      its content exactly as the foe's `FOE_PANEL.h` does instead of holding a ~38 px empty band —
      the Decision applied, "hugs the content as the foe's panel does; no clearance invariant moves".
      **What deliberately did not move:** `BattleLaunch.xp` (its producer in `RouteScene` is
      untouched), `experienceFraction`, `D35`'s rule and the bar it means, which is the **route HUD**'s
      own, `PLAYER_PANEL_W`, `FOE_PANEL`, `FOE_PLATFORM_CLEAR`, the battler size caps, the type badge
      row and the foe's ball row, and `drawGauge`/`GAUGE_TRACK` in `src/ui/panel.ts` (the shared
      chrome-helper file; a dead-code sweep of it is not this task, so `src/ui/README.md` stays).
      `docs/design-spec.md` §4's one-XP-bar bullet gained a single clause saying **where** that one bar
      is drawn — the route HUD — with `D35` and the level-cap sentence byte-identical, and
      `docs/battle-spec.md` §7 never claimed the battle draws it, so it does not move. **Two paths**
      (`src/scenes/BattleScene.ts`, `docs/design-spec.md`), **no test added** — a scene's drawing, with
      no engine rule, no RNG draw and no run field — and the suite stayed at **1658 tests across 137
      files** with `tsc --noEmit` + `vite build` green on the merge commit, the green build being the
      proof that no import was left stale. `battle.xp` stays in both locale tables: removing the label
      leaves it without a runtime call site, and the key is not this task's to delete (the i18n files
      are `[Task-49]`'s in the same batch), with `src/i18n/index.test.ts` still pinning it. No run
      field, so **no `SAVE_VERSION`** step: the chain stays **14 → 15 → 16 → 17 → 18**. The two
      `[live]` criteria were **measured** on the integration commit with a Vite dev server and a
      headless Chromium over CDP, reading the live scene rather than a screenshot: on a 807×807
      desktop stage (camera at x 237) and a 657×657 compact one (x 312), in a **wild** and a
      **trainer** battle alike, `playerPanel.height === foePanel.height === 150` and a
      `renderer.snapshotArea` + `getImageData` scan of the whole panel rect found **0 px** within
      ±12 per channel of the gauge blue `0x60a5fa` and **0 px** of the label blue `0x3b82f6`, while
      the HP bar's own green counted **2292 px** (the scan is neither empty nor misplaced); a
      detector control painted a 60×8 gauge-blue bar inside that same rect and counted exactly
      **480 px** (0 after destroying it), so the zeroes are real absences and not a broken reader.
      The anchor did not shift: the compact rect's `y` is exactly `round(stage × 0.46)` (**302** at a
      657 stage) and on the desktop the panel's **bottom** sits at **565**, the base revision's own
      number (`381 + 184`), with only its top 34 px lower. Its ID is retired: it keeps its place in
      the sequence and is never reused.

- [x] **Obtaining an item raises the run's transient notice.** Reported in play ("popup temporal
      cuando se obtiene un objeto"), and two of the three paths that put an item in the bag said
      nothing at all: `collectItemAt` folded the ground item in silently and
      `chooseMiniBossReward` closed the picker over the name of what was taken, while the Mart
      already printed its own `Bought <name> for ¥<n>.` line. **The Decision applied:** the popup
      fires on the two otherwise-silent pickups only, the Mart keeps its in-window line, and the
      string names the item only. **One module, N strings, no second window:** `src/ui/notice.ts`
      gains `itemPickupNotice(name)` beside `catchToPcNotice`, on the same `Notice` shape and the
      same `NOTICE_HOLD_MS` (2600), and the route HUD's existing strip draws it through the same
      `showNotice`/`hideNotice` pair — one notice at a time, a second pickup replacing the first,
      no key, no input mode, no timer of its own. `RouteScene` raises it in `collectItemAt` (after
      `markItemPicked(addItem(...))` and `persistRun()`, before the ground sprite is hidden, so the
      pickup and the message are one beat) and in `chooseMiniBossReward` (inside its `if (itemId)`
      branch, before the reward window closes); the name is resolved by the caller through the
      shipped `getItem(id)?.name ?? id`, so the module reads no dex and stays a pure leaf. The new
      key `notice.itemObtained` is authored in the English source table and overlaid by Spanish
      (`Obtained {name}!` / `¡Has obtenido {name}!`), added *through* the shipped i18n module
      because this task lands after the sweep; `src/ui/notice.test.ts` gains three cases (the exact
      sentence, the shared hold and the name passed through untouched) and `src/i18n/index.test.ts`
      pins the key **both** ways, the way it pins `notice.catchToPc`. `docs/routes-spec.md` §2's
      ground-item paragraph now says the pickup is no longer silent. **Seven paths** — notice and
      its test, `RouteScene`, the two locales, the i18n test and the one doc bullet — the suite
      **1658 → 1661 tests across 137 files**, no run field and **no `SAVE_VERSION`** step (the chain
      stays **14 → 15 → 16 → 17 → 18**). The two `[live]` criteria were **measured** on the
      integration commit with a Vite dev server and a headless Chromium over CDP: the **real
      interact key** (`E`, dispatched as a DOM key event) on the tile beside a real ground `potion`
      of seed `orch-b15-live` put `noticeRoot.visible` at `true` with `noticeText.text === 'Obtained
      Potion!'`, depth 440, `noticeTimer.delay` 2600, the bag 1 → 2 and `pickedItems` 0 → 1; the
      strip's own 720×44 rect differed from the same rect captured with the notice down in **30 369
      of 31 680 px (95.9 %)**, read with `renderer.snapshotArea` + `getImageData`; a page-side
      sampler of the game's own state caught the player stepping (11,16) → (11,17) with the notice
      still **visible**, so walking is unaffected; and it cleared itself with no input after **≈2 981
      ms of the scene's own clock** against its declared 2600 (the surplus is one frame of a ~4 fps
      software renderer — a bare `delayedCall(2600)` with no task code drifts the same way). The
      mini-boss path raised `Obtained Antidote!` for the row that was taken, with the reward window
      closed behind it. Its ID is retired: it keeps its place in the sequence and is never reused.

- [x] **The run's first wild Pokémon is caught for certain.** Reported in play ("el primer
      pokemon salvaje debe ser mucho mas facil de atrapar ignorar su dificultad segun el poke
      solo para esta primera captura"), and the catch was species-based and nothing else:
      `attemptCapture` (`src/engine/battle/capture.ts`) always read the target's own
      `catchRateOf`, while the battle is pure and knows nothing about the run. **What ships:**
      `BattleState.firstCatch` (required on the state, defaulted `false` by `createBattle` from
      an optional `BattleSetup.firstCatch`, so every existing caller and test reads `false`
      unchanged), the run fact carried on the launch seam that already moves run facts
      (`BattleLaunch.firstCatch`, set by `RouteScene.startBattle` from
      `this.run.stats.catches === 0` beside `canCapture`, forwarded by `BattleScene.create`),
      and the new pure `catchValueFor(fighter, ballBonus, firstCatch)` with
      `FIRST_CATCH_VALUE = 255`: while the flag is on, the roll's **catch value** is the flat 255
      `attemptCapture` already treats as an outright success — whatever the species, the
      target's HP, the ball and its status — and `attemptCapture` reads it off the state it
      already receives, so its signature, its `!isWild` and `value <= 0` refusals, its
      `value >= 255` early return, its shake loop and its one `rng.int(0, 65535)` per shake are
      untouched and `src/engine/battle/commands.ts`'s ball branch does not change at all. With
      the flag off the helper returns the shipped formula byte for byte. The boost is live while
      the run has caught **nothing** — a failed throw and a party wipe do not spend it, because
      `stats.catches === 0` is exactly that fact — and the very next wild after the first
      successful catch is back to its species' own rate. **The decision's number, applied and
      recorded:** the item asked for a "flat 255" and its own open question reads "`catchValue`
      255 returns success outright, whatever the HP and the ball", so the spec froze the
      **value** and not the rate, which is the one reading under which the item's own sentences
      ("ignores the species", "cannot fail") both hold: a flat **rate** of 255 leaves a full-HP
      target at `255 × 1 / 3 = 85`, under the 255 threshold, where the shake loop then fails
      roughly two thirds of the time. One `agent-review` issue asks the human to confirm that
      reading. **Evidence:** `src/engine/battle/capture.test.ts` gains six cases — the certain
      255 at full HP with a plain ball (`ballBonus: 1`), the shipped formula identically on the
      other branch (`charmander`, rate 45 → 15; and `sentret` at 1 HP with a ×2 ball), the
      `createBattle` default and the carried flag, the fixed-seed regression AGENTS.md requires
      (**seed 42**: caught with the flag on, and the identical battle with the same seed and the
      flag off missing at `value: 15`), and the wild-only refusal kept with the flag on. The
      suite is **1658 tests across 137 files** with `tsc --noEmit && vite build` green on the
      merge commit. The `[live]` criterion was **measured twice**, by QA on its own dev server
      and by the Orchestrator on the integration commit, both with a Vite dev server plus a
      headless Chromium over CDP and `Runtime.evaluate` against the live scene state rather
      than a screenshot: a fresh run (`stats.catches 0`) hands the battle
      `launch.firstCatch true` / `state.firstCatch true`, and
      `attemptCapture(liveState, 'enemy', 1)` on a **full-HP** wild `charmander` (30/30) returns
      `{success: true, shakes: 4, value: 255}`; after one `recordCatch` the same battle reads
      `false` and the same call returns `{success: false, value: 15}`. Eight paths moved — the
      four engine/scene files named above, `docs/battle-spec.md` §6 and one bullet under
      `docs/routes-spec.md` §3 — with no `package.json`, `src/main.ts`, `vite.config.ts`,
      `src/data/**`, `src/engine/save.ts`, packed asset or `D##`, and no run field, so
      **no `SAVE_VERSION`** step: the chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired:
      it keeps its place in the sequence and is never reused.

- [x] **The PC box gains a fixed RIP tab, listing the dead.** Reported in play ("en pc un
      tab fijo de rip donde aparecen los pokes muertos sin poder meterlos en el party ni
      dejar pokes en rip"), and the run had nowhere to keep them: `releaseFainted`
      (`src/engine/run/perms.ts`) filtered every 0-HP member out of `party` and `box` and
      bumped a count, `RunState` had no field that remembered them, and the panel was a
      two-pane model (`PaneId = 'party' | 'box'`). **What ships:** `RunState.rip`, the run's
      record of the fallen in **party-then-box order**, appended at the one place a member
      is lost — beside `stats.casualties`, so the list and the count can never disagree —
      and never cleared by `advanceRoute`/`advanceMap`, so it is a run-long fact like
      nothing else the run keeps. `SAVE_VERSION` **16 → 17** with the `SAVE_MIGRATIONS[16]`
      step that defaults an old run's list to empty (an old save's dead were never stored,
      the `[Task-13]` shape) and `parseRun`'s `rip: parseMembers(value.rip)`, which drops a
      malformed entry instead of failing the run. `PaneId` gains `'rip'` with the exported
      `PANE_CYCLE` / `cyclePane(pane, delta)` / `ripRows(run)`, and the model refuses every
      write on it: a grab in RIP is a no-op, a deposit into RIP is refused, a reorder inside
      RIP returns the run unchanged, and `left`/`right` with nothing grabbed now walk three
      panes. `RouteScene` draws the tab as a **fixed control** at the right end of the box's
      page-tab strip, under the very veil a locked box cell wears (`HUD_BOX_LOCK_FILL` /
      `HUD_BOX_LOCK_ALPHA`, now one source of truth for both) — `HUD_BOX_MAX_PAGES` 8 → 7
      makes room for it, a strip change that only bites a box past 112 members, which a
      finite run's one-catch-per-route can never reach — and a dead cell opens the usual
      member detail **read-only**: the dead keep their stats and their moves, while the
      rename field, the evolution branches, the move reorder and the learnset pool are
      hidden, and `memberById` searches `rip` so that panel resolves. `docs/routes-spec.md`
      §6 records the rule. Tests: 11 new cases across `perms.test.ts`, `state.test.ts`,
      `partyScreen.test.ts` and `save.test.ts` (a fainted member recorded **once** in
      party-then-box order with the healthy untouched and a second `releaseFainted`
      returning the *same* run object; a floor change, a full vial and a level-up leaving
      `rip` reference-identical; the three reducer refusals; the v16 → v17 round trip), and
      the batch's live pass measured the tab's geometry (32×26 at `boxX + panelW - 20 - 32`,
      14 px clear of the last page tab), its veil (`0xcfcce2` under `0x1b1830` at 0.55 =
      **108/105/128**, and `207/204/226` with the veil hidden — 99/channel), the pane switch
      and the read-only detail on a seeded run. It adds one run field, so it takes the
      chain's **16 → 17** step; the chain is **14 → 15 → 16 → 17 → 18**, and the task drew
      no RNG. Its ID is retired: it keeps its place in the sequence and is never reused.
- [x] **Each of the battle SWITCH window's move rows gets the HUD's ⓘ, on hover and on
      click.** The window listed a member's four moves as bare `name` / `PP n/m` cells with
      no way to explain themselves, while the route HUD's detail panel had floated a move's
      description from an ⓘ since Phase 6 — and the one ⓘ the window did have (the ability
      row's) is **hover-only** on purpose, because the party cells under it own the presses.
      **What ships:** the ⓘ on every move row, on **a hit zone of its own sized to the
      button** — the tree's only hover that cannot miss, the shape the batch's decision
      freezes — which floats the move's own description on `pointerover` and **pins** it on
      a `pointerdown`; the press is swallowed by that zone, so the member the window
      describes is never switched by it (a press anywhere else on the window keeps its
      shipped meaning), a second press toggles the pin off, and a repaint for another member
      drops it. The ability row's ⓘ keeps its hover-only rule unchanged, and the one
      sentence `docs/design-spec.md` §4 gains says exactly where the new press goes. So the
      grid and the window can never drift, `MoveGrid`'s private popup body is lifted into
      the exported pure **`moveInfoContent(cell: MoveGridCell): InfoPopupContent`** (the
      type badge, the status badge and the move's text through `InfoPopup`), and the switch
      window builds one `MoveGridCell` per drawn row and calls it. No new file, no i18n key
      (the popup carries the move's own text), no `src/ui/README.md` line, no engine or data
      change, no new identifier classifier — `insideInfoButton`/`infoRect` stay deleted and
      the MOVES window's own path is untouched. The four ⓘ sit at `cell.x + cell.width - 19`
      / `cell.y + 17` with a 22×22 zone at `cell.x + cell.width - 30` / `cell.y + 6`, the
      move name's `maxWidth` narrows to `cellW - 42` to clear the button, and the shared
      popup rides above or below its own row so it never covers the ⓘ it came from. Its
      `[live]` pass measured, on the combined tree: the four controls' offsets and zones
      (`dx`/`dy` 0 against the frozen arithmetic, `getData('move') === i`), a hover floating
      the exact `desc` with the active fill `247/224/166`, a press pinning that description
      while `mode` stayed `'party'` and the described member (index, name) did not move, the
      pin surviving the pointer leaving, the second press closing it, and the ability zone's
      hover-only rule intact. It adds no run field and changes no rule, so **no
      `SAVE_VERSION`** step — the chain stays **14 → 15 → 16 → 17 → 18**. Its ID is retired:
      it keeps its place in the sequence and is never reused.

- [x] **A hit plays the move's own sound, and an encounter plays the appearing
      Pokémon's cry.** The cue table had deliberately dropped both moments rather than
      fake them with one shared sound — the original varies a hit by the move (`SE_M_*`,
      one per move, in `sound/songs/midi/se_m_*.mid`) and an encounter is the species'
      own cry — so this task grows the vocabulary from **six cues to 525** and wires the
      two seams, exactly as the item's frozen decision says (raw `cries/<species>.wav`
      samples, one `SE_M_*` per move, one cue id per species/move, **one** shared hit
      cue, no `PokemonCrySong` replay and no effectiveness variants). **What ships:**
      **519 new** `src/assets/audio/*.wav` — 13.1 MiB, taking the committed audio tree to
      20.1 MiB — one file per cue: the six cues that already shipped (byte-identical,
      SHA-256 pinned by a test), the shared **`hit`** (sourced from
      `se_m_comet_punch.mid`, the impact the cartridge itself gives `TACKLE` and `SLAM`),
      **130** `move-*` cues (one per `SE_M_*` MIDI in the decompilation, `se_m_absorb_2`
      → `move-absorb-2`) and **388** `cry-*` cues (one per cry sample). All 130 ship even
      though a move id currently maps to only 100 of them: the vocabulary is the family
      and the table is a view over it. **Two generated, committed tables** drive the
      runtime, produced by the rip step and never hand-edited: `src/data/audio/cries.json`
      (**455** rows — every dex species with `num ≤ 386`, all of which resolve) and
      `src/data/audio/moveSounds.json` (**295** rows), with `src/data/audio/index.ts` as
      the typed accessor (`cryCueFor`, `moveSoundCueFor`, the two row counts). The cry
      lookup is **by name** (`Mr. Mime` → `Cry_MrMime` → `cry-mr-mime`, a forme through
      its `baseSpecies`, so `Raichu-Alola` gets `cry-raichu`), **not** through
      `cry_tables.inc`'s row order: that table is indexed by the game's *internal* species
      number (Jirachi `409`, Deoxys `410`, Chimecho `411`), which is not our national
      `num`, so a row-index mapping would be wrong for every Gen 3 species. The move
      lookup parses `data/battle_anim_scripts.s`, whose per-move animation block names the
      cartridge's own sound; 297 blocks name one, and the cartridge's three renames
      (`VICE_GRIP` → `visegrip`, `FAINT_ATTACK` → `feintattack`, `HI_JUMP_KICK` →
      `highjumpkick`) are a hand-written alias table in the script. A move with no row
      falls back to `hit`; a species with no cry (Gen 4 and on) is **silent** — a stand-in
      would be a lie about an id the decompilation never carried. `src/audio/cues.ts`
      becomes a 525-row table whose non-hand rows come from `import.meta.glob` over the
      committed asset folder (Vite's own mechanism for "every file here"; 519 written
      imports are not a table), with `AudioCueId` keeping its literal union via the
      `move-${string}` / `cry-${string}` template types plus the exported `hit` id, the
      six hand rows first and unchanged (`0.5/0.5/0.5/0.8/0.8/0.9`), `hit` and the move
      family at **0.85** and the cries at **0.8**. The two helpers are
      `playCry(scene, speciesId)` and `playMoveSound(scene, moveId)` in
      `src/audio/audio.ts`, both through the shipped `audioCue` + `startSound` path so no
      second route to `Phaser.Sound` exists, and **the scene has two call sites**:
      `BattleScene`'s turn feed plays the move sound on every `move` event (`moveId` is on
      the event, either side), and its entry beat plays the enemy's cry **once** per
      battle, at whichever appearance step runs — a wild's `foe-appear`, a trainer's
      `sendout` — for the wild's rolled species or the trainer's lead. **The batch's own
      cut was wrong twice and the spec was corrected before the pass, with measurements:**
      the block's sound is its first `playse`-family command at the start of a line,
      `waitplaysewithpan` **included** (only then do 297 blocks and 295 rows fall out;
      `HORN_DRILL` and `SKULL_BASH` are *not* skipped, their first such command is
      `SE_M_HEADBUTT`/`SE_M_TAKE_DOWN`), and **27 of the 130** `se_m_*` lines *do* carry a
      `-V` in `midi.cfg`, so those render at it while the other 103 use 100. The per-family
      gain lives in the **packer**, not the renderer: the cry intermediates are the
      decompilation's verbatim 8-bit samples and the move ones are 22050 Hz stereo, so only
      a gain over packed mono PCM lands each family's loudest cue on `0.85 × 32767`
      (measured: both families peak at 27852). One shipped cue is digital silence —
      `move-dizzy-punch`, whose own MIDI mixes to zero at the voicegroup `midi.cfg`
      declares for it, audible under 127/129 — and `cues.test.ts` names it in a one-entry
      exception list instead of loosening the check for the other 524, since no table row
      references it. The render script and the packer now take their source, renderer and
      intermediate directories as **absolute** paths through argv/env (the Asset-trees
      rule; the defaults still work locally), a missing intermediate is a hard error for
      the new families (never a silent placeholder) and both steps are byte-reproducible —
      re-running them leaves the tree clean. **Validated:** QA ran the task's whole plan on
      its own integration tree and the merge rehearsal on a second one — 137 test files /
      **1639** tests green and `npm run build` green on both, `519 A / 0 M / 0 D` under
      `src/assets/audio`, the six pre-existing cues byte-identical, the two scripts
      re-run byte-identical (525/525 intermediates and assets), and all three `[live]`
      criteria attempted on a dev server over CDP with the live module read from the page:
      the boot preloads **525** distinct keys against 525 table ids with **0** failed files
      (9.2-9.6 s on this cold headless container — the cost of the new set, recorded
      rather than hidden), a debug wild encounter records `cry-pikachu` **exactly once**,
      and a resolved turn records the move's own cue or `hit` as the table says. The third
      `[live]` criterion — whether the cry and the hit *sound* right, a listening
      judgement — is an `agent-review` issue and did not block the merge. It adds no run
      field, changes no rule and draws no RNG, so **no `SAVE_VERSION`** step: the chain
      stays **14 → 15 → 16 → 17 → 18**.

- [x] **`npm run lint` is `prettier --check .` with no per-file escape hatch left under
      `src/**`.** Task-01 shipped the format gate over a ledger instead of reformatting a file
      a batch-mate owned, so `.prettierignore` carried an `src/**` block of **104 individual
      files** (the backlog's own prose said 105; the measured number is 104) plus five
      generated-data globs. This task pays that debt off: each of the 104 is formatted with the
      shipped `.prettierrc.json` (`npx prettier --write <file>` — never a retune of the options)
      and its line deleted, so the ledger goes **132 → 29 entries** (51 lines). **103 of the
      104 actually rewrote**; `src/data/shop.ts` was already Prettier-clean under those options,
      so its line is deleted like the rest and its file stays byte-identical — which is why the
      audited diff is **104 paths** (103 reformats plus `.prettierignore`), one path fewer than
      the exclusive list it is audited against. What stays is exactly what has a reason to stay:
      the generated/binary globs, `package-lock.json`, the `scripts/**` packers, the regenerated
      `docs/balance/effect-coverage.md`, the five generated `src/**` globs (`src/assets/**`,
      `src/data/dex/**`, `src/data/frlg/**`, `src/data/anil/**`, `src/data/ui/**`) and the
      prose/process documents — and each surviving block now says what it holds and why, in
      place of the obsolete "Prettier 3.9 rewrites 157 tracked files" comment, which is gone.
      **One new entry:** `docs/agent-ci.md`, a tracked process doc the CI work added which
      `prettier --check .` flagged and the ledger had never listed; it is **not** reformatted but
      joins the prose block (Prettier's markdown printer would only realign its tables, and it is
      the CI/Orchestrator's own document, not a lint target), and that entry is what makes
      `npm run lint` exit **0** on the tree as it stands. The reflow of 4 144/1 644 lines is
      proved mechanical rather than read: for every one of the 103 changed files, feeding its
      base revision through Prettier 3.9.10 reproduces the task's file **byte for byte**
      (103/103), `npm run build` (`tsc --noEmit && vite build`) is green, the suite is **1627
      tests** across 136 files with the same counts as the batch base (which QA re-ran for
      comparison), and the one test that reads these sources as text — `src/i18n/index.test.ts`'s
      call-site scanner — sees exactly what it saw before the reflow (170 files, **279** call
      sites, the same `(file, key, params)` multiset, its 25 assertions green in isolation). No
      symbol, signature, string, number, table or rule moved; `.prettierrc.json` and
      `package.json` are untouched; no file was added, renamed or deleted, so no folder
      `README.md` changed. QA validated it in the single pass a one-task batch collapses to —
      the task's plan, both gates, the cross-task audit and the merge rehearsal on one tree —
      with all eight `[unit]` criteria green and **zero** browser budget, because the task
      declares no `[live]` criterion; one criterion was amended by the Orchestrator before that
      pass (the ledger check anchors at `^docs/agent-ci\.md$`, since the byte-frozen prose block
      names that file in its own comment). From here on a new file conforms, a task that edits a
      formatted file keeps it conforming, and no task adds a ledger line.
- [x] **Every player-facing string is a key in one English table, and Spanish overlays it.**
      The new pure module `src/i18n/` holds the source table (`en.ts`, 293 keys), the Spanish
      overlay (`es.ts`, the same keys, `Readonly<Record<TranslationKey, string>>` so a missing
      one is a type error) and the surface the whole tree now imports: `Locale`,
      `TranslationKey`, `LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `detectLocale`,
      `getLocale`, `setLocale`, `translationParams` and `t(key, params?)`, which interpolates
      `{token}`s from the caller's params and **throws** `i18n: missing param "{token}" for
      key "{key}"` rather than drawing a brace. The module imports no Phaser, no DOM and no
      storage — the browser's tag is an argument to the pure `detectLocale` (primary subtag,
      exact: `es`/`es-*` is Spanish, everything else the source table) — so the tables are
      testable headless. `Settings` gains `language` beside `alwaysRun`, read per field in
      `parseSettings` (`isLocale(...) ? ... : 'en'`), so a document written before this task
      reads the default: **`SAVE_VERSION` stays 16 and no migration step is added** (the
      `D22`/`D45`/`D46` precedent). The one field defaulted from the browser lives in the
      browser-facing shim: `src/settings.ts`'s new `browserLanguageTag()` (guarded so a
      headless run has none) feeds `detectLocale` when the slot carries no language, and
      `loadSettings` **stores** what it detected so the first run write cannot freeze the
      source default; `loadSettings`/`saveSettings` apply the locale, which is why **no scene
      needed a boot hook and `src/main.ts` is untouched**. `src/ui/settingsScreen.ts` gains the
      `language` row as the last step row (index 6, after `aiLevel`, so no shipped index
      moves), naming each locale in its own language (`English` / `Español`) and switchable in
      place with no restart because the scene re-resolves its strings from `t(...)` in
      `render()`. **The sweep** then moved every literal authored under `src/scenes/**`,
      `src/ui/**` and `src/dev/**` behind a key — the six scenes, the HUD's party/bag/PC/
      detail/pause/capture/Mart/reward panels, the battle's own chrome and prompts, the seed
      prompt and the whole dev DOM panel — converting the module-level label tables
      (`MENU_LABELS`, `PAUSE_MENU_LABELS`, `SHOP_MODE_LABELS`, `BAG_CATEGORY_LABELS`,
      `STAT_LABELS`, `STATUS_ABBREVIATIONS`, the settings rows) to hold **keys** resolved by a
      function, so nothing freezes the locale at import. The key table's widths are pinned to
      the shipped geometry (`status.*` exactly 3 characters in both locales, `bag.*` ≤ 6,
      `detail.stat.*` ≤ 7, `battle.command.*` ≤ 7) and every `es` character is checked against
      the packed FRLG font's glyph set, which carries Latin-1, `·`, `…` and the arrows and
      **no em dash** — so Spanish uses `·`/`:` and the shipped English keeps its own. The
      task's scope call: the dex's own names (Pokémon, moves, abilities, items, biomes, trainer
      classes) and `src/data/**` stay English in every locale, and so does the **battle
      engine's message log** — its strings are what `golden.test.ts` pins byte for byte, so
      only the battle scene's chrome is keyed (a battle therefore reads half Spanish after
      this task, by design). `D43` records the decision in `docs/tech-decisions.md`, the knob
      is written into `docs/design-spec.md` **§8 (Settings)** — the backlog says §7, but §7 is
      "Special rooms & money" — `AGENTS.md`'s convention became "English is the source table, a
      locale overlays by key, and the dex's own names stay English", and `src/i18n/README.md`
      maps the new folder. QA's first pass was red on two call-site defects its own gates could
      not see: `release.controls` was called with `{ key }` where the key declares `{ confirm }`
      (a runtime throw the first time a party member fell) and `dev.move`'s English value had
      no `{ n }` while the call passed the index (the panel lost its number). Both were fixed
      and the class is now gated: `src/i18n/index.test.ts` scans every `t('<key>', { … })` in
      `src/**` against `translationParams(en[key])` in both directions (279 sites, 0 findings)
      and pins both interpolated results in both locales. The suite went **1582 → 1627** tests,
      the three `[live]` criteria were **measured on this runner** (dev server + CDP over the
      image's headless Chromium, object reads over `Runtime.evaluate` on the live scenes plus a
      `Page.captureScreenshot` pixel diff: the main menu's drawn rows read
      `['Nueva partida','Ajustes']` = the table's own values and the two renders differ by
      2375 of 340 860 px; a real **ArrowLeft**/**ArrowRight** on the options screen turned the
      title `AJUSTES`→`SETTINGS`→`AJUSTES`, every row label and the stored slot with it, on one
      screen with no reload; a live run read `hudTitle === 'Mapa 1 · Deep Forest'`, the four
      command labels `['LUCHAR','MOCHILA','CAMBIAR','HUIR']` and the prompt
      `'¿Qué hará Spheal?'`; and the release overlay's own builder drew `'E · continuar'`
      without throwing), and `npm test` + `npm run build` are green on the merge commit.

- [x] **Every battle opens with a skippable entry beat.** The route→battle cut was a single
      frame; `BattleScene.create` now ends with `this.startEntry(trigger.kind)` instead of
      `this.startFeed()`, and its `Mode` gains `'entry'` ahead of `'feed'`. The beat's step order
      and timings live in `src/ui/beats.ts` as **data** — the pure `entryBeat(kind, reducedFlash)`
      beside the shipped faint/switch beats, over the new `EntryKind`/`EntryStepKind`/`EntryStep`
      types and seven `ENTRY_*` constants — so the scene plays the beat and does not own it: a
      **black-out fade** (`cameras.main.fadeIn(320)`, the step that carries the cut and paints the
      stage black on the first painted battle frame), then **one white camera flash** (220 ms, the
      `playMega` shape and the beat's only full-screen blink) and then the appearing step — the
      wild foe dropping onto its platform (300 ms, 26 px), or, in a trainer battle, the trainer
      walking in first (280 ms, 22 px, **alpha only** so `refreshHud`'s layout read of
      `foeTrainer.visible` is not disturbed) and its **send-out** bringing the partner out after
      (260 ms). **Reduce flashing** (`D45`, already read once in `create`) drops the flash step
      and keeps the fade and the appearances, so the beat adds no second knob. It is
      **skippable** by a confirm or cancel press or a click through three guards that reuse the
      scene's existing input funnel and register **no new listener**, and `finishEntry` is its
      single re-entrancy-safe exit: it removes the step timer, kills the two sprite tweens,
      `resetFX`es the camera, restores both sprites and hands over to the first feed frame,
      still the engine's first log line. It draws no RNG, adds no run field, allocates nothing
      per frame and touches no `src/engine/**`, `src/data/**`, `src/scenes/RouteScene.ts` or
      audio path, so **no `SAVE_VERSION`** step and no fixed-seed re-pin. `docs/design-spec.md`
      §4 gains the one bullet that says how a battle opens. The suite went **1577 → 1582**
      tests (`entryBeat`'s five cases plus the six `levelUpBeats` ones, whose signature stays as
      it is for Batch 19's Task-56), `npx prettier --check src/ui/beats.ts src/ui/beats.test.ts`
      is clean, and `npm test` + `npm run build` are green on the merge commit. The three
      `[live]` criteria — the two openings read frame by frame and the skip / reduce-flashing
      pass — could not be measured on this browserless runner and are carried by an
      `agent-review` issue.

- [x] **The STATS tab lists every Mega and every G-Max forme as an information row.** A Mega is
      battle-only (`D34`), so the family graph had no trace of one; `src/ui/evolutionGraph.ts`
      now returns `kind` (`'species' | 'mega' | 'gmax'`) on **every** node and appends, at the
      end of each visited species node's body (after its whole evolution subtree, before its
      next sibling), one row per Mega `megaFormsForBase` returns — dex order, so Charizard
      shows X and Y side by side — and one for its G-Max forme (`gmaxFormForBase`), so a
      Charmander's panel lists Charizard's rows under the Charizard node exactly as a
      Charizard's panel does. Each row is inert by construction: `level` null, `current` and
      `ready` false whatever the held item, `id` = the forme's own species id so the band's
      `portraitFor` draws the forme's own cell (Task-15's packed portrait atlases already
      carry them), and the whole visible copy rides the node's `name`, which the shipped band
      draws with **no scene change at all**. The copy is the new `formeDisplayName`'s
      (`Charizard-Mega-X` → `Mega Charizard X`, `Toxtricity-Low-Key-Gmax` → `Gigantamax
      Toxtricity Low Key`) plus the forme's own `stoneName`: `Mega Charizard X · Mega Evolves
      with Charizardite X` and, because a G-Max has no stone gate at all (`D44`), `Gigantamax
      Charizard · Gigantamaxes with no stone`. The clause reads **`with`** rather than the
      plan's `while holding` on measurement, not taste: the long form is 312 px against the
      288 px box a depth-3 row has (`460 − 2·20 − 34·3 − 30`), the shipped one is 267 px, and
      the new test re-derives every width from `src/data/ui/font.json`. A sweep over all
      **88** Megas and **34** G-Max formes pins each row's `kind`, `parent`, `depth`, copy and
      non-null portrait; `src/ui/evolutionGraph.test.ts` grew to 20 tests (charizard 3 → 6
      ids, eevee 9 → 10, pikachu 4 → 7) and `src/ui/partyDetail.test.ts` re-pinned its
      Charmander family expectation to the same six ids — the suite went **1565 → 1577**
      tests. `docs/design-spec.md` §3 and `docs/battle-spec.md` §9 record the row and its
      dimmed, always-visible, never-clickable rule, and no run field, no rule and no
      `SAVE_VERSION` step moved. One known limit is documented rather than hidden: an Eevee's
      graph is 10 rows and the band's cell pool is `HUD_DETAIL_EVO_MAX = 9` (a `RouteScene.ts`
      constant this batch did not own), so its G-Max row is the one clipped row.
- [x] **The ⓘ detail button has one classifier, and the learnset band's now works.** The battle's
      MOVES window and the route HUD's learnset band hit-test the same `MoveGrid` cell two
      different ways; now there is one. `src/scenes/BattleScene.ts` loses the per-zone
      `pointermove`, `insideInfoButton` and the cell-local `infoRect` it stashed on each menu
      zone, and classifies the ⓘ from the **live pointer**
      (`this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.hitPoint)` — the reusable
      `Vector2` keeps the no-per-frame-allocation rule — then `moveGrid.indexAt` + `cellRect` +
      `infoAt`), with a `gameout` drop for an unpinned popup; the **press** keeps its own exact
      arithmetic (`zone.x + localX`) so the path the play report says already worked cannot
      regress. `src/ui/moveGrid.ts` loses `infoRect`, whose only consumer that stash was, and
      keeps every other member byte-identical (Batch 18's `moveGrid.test.ts` and the four-slot
      work are written against that surface). In `src/scenes/RouteScene.ts` the band's ⓘ is
      wired for the first time: `refreshLearnset` stops passing `info: null`, the panel's
      single info index is tagged `{ grid: 'moves' | 'learn'; index }` (it is an index into
      the band's **window**, so `scrollLearnset`, `updateLearnScrollDrag`, `scrollPoolTo` and
      both search branches call the new `dropLearnInfo` when they rebuild it), a
      `detailLearnInfoAt` mirrors the moves grid's helper, and the press order flips so the ⓘ
      wins over `startLearnDrag` while the cell's body still starts the drag. The dev's static
      reproduction is recorded in the spec: on pristine `main` the battle half's hover and
      click were fed the same local point and the same rect, so the two classifications
      returned the same boolean — the change removes that duplicate rather than fixing a
      formula, and the on-screen hover is one of the three `[live]` checks handed to a human.
      No test file was added, so the suite stayed at 135 files / **1565** tests, and no doc,
      data, engine or serial resource was touched.
- [x] **The enemy AI thinks with the cartridges' own script flags, and difficulty is one
      visible setting (`D46`).** `chooseAiCommand` stops scoring with one hard-coded
      function: `AiFlag` — `checkBadMove`, `tryToFaint`, `checkViability`,
      `setupFirstTurn`, `risky`, `preferBatonPass` — became **data** on the trainer
      archetype (`TrainerArchetype.aiFlags`; the union is declared in
      `src/data/trainers.ts` and the engine imports the **type** only), the six flags are
      a closed list of checks over `estimateDamage` / `canApplyStatus` /
      `legalMoveIndices` / `canMegaEvolve`, and **the highest score wins**, with an exact
      tie broken to the lowest index at the default level and from the battle's own
      `state.rng` at the top one. The flag ladder ships per class: a Youngster only skips
      a move that can do nothing and otherwise attacks, the middle classes heal and use
      their status moves, a Psychic and a Black Belt also go for the faint (the Black Belt
      gambles), and the **`ace`** archetype — which is also what the boss and the
      mini-boss are, so the plan's "Ace/boss/mini-boss get all of them" is one data row —
      carries all six. A wild no longer out-thinks an Ace: at the default level it picks a
      **random move that has PP left** (exactly one draw per turn) and only at the top one
      does it think with the flags. The run gains **`settings.aiLevel`** — `Normal` (the
      default) or `Hard` — as one `Difficulty` step row on the options screen (drawn by
      the data-driven screen, no scene change), a required `BattleLaunch.aiLevel` the
      route fills from the settings, and `Hard` is nothing but the cartridge's own Hard
      Mode: every trainer also gets *check bad move*, *try to faint* and *check
      viability*. It is defaulted per field in `parseSettings` (the `reducedFlash`
      shape), so **`SAVE_VERSION` stays 16** and the plan's chain stays
      14 → 15 → 16 → 17 → 18. The AI reads nothing but legal information — its own party
      and movesets, the **active** fighters' public facts, the field and `state.turn` —
      and never the opposing bench or its unrevealed moves, and it draws from `state.rng`
      alone. The enemy still gains **no Bag**: `validateBag` refuses every side but the
      player and the items the engine models on an enemy are held ones its own hooks
      apply, so the two levels differ in flag set, wild policy and tie-break, not in
      items. Every moved fixed-seed expectation carries its reason: the golden log — its
      snapshot **and** `harness.test.ts`'s line-for-line copy of it — moves because the
      golden battle is a wild one, so the new policy picks Vine Whip over the scored
      Tackle **and** spends one `Rng` draw per turn, while `mega.test.ts`, `gmax.test.ts`
      and `randomLearnsetBattle.test.ts` stayed byte-identical and `harness.ts` untouched.
      `docs/battle-spec.md` gained §11, `docs/tech-decisions.md` `D46`, `docs/data-spec.md`
      the archetype's new field and `src/data/README.md` a corrected role line. One
      `agent-review` issue carries the one `[live]` criterion (the options row on screen
      and the setting reaching a battle) this environment cannot measure.

- [x] **The accessibility pass: one reduced-flash knob, HP that reads without hue, the
      colour-only cues fixed, and the whole game playable from the keyboard (`D45`).**
      `Settings` gains `reducedFlash` (default off, `DEFAULT_REDUCED_FLASH`, read per field in
      `parseSettings`, so `SAVE_VERSION` stays **16** and `SAVE_MIGRATIONS` gains no step) with
      its `Reduce flashing` row in `src/ui/settingsScreen.ts`, and every full-frame effect in
      the tree obeys it: the two `cameras.main.flash` calls (`playMega`, `playGmax`), the route's
      hidden-item glint and the hold-to-reset scrim's release. HP survives the loss of hue: the
      new pure `src/ui/metrics.ts` exports (`LOW_HP_FRACTION`, `isLowHp`, `hpCueNotches`) cut the
      low-HP fill into ink notches in **both** battle panels while the player's panel keeps the
      `hp/maxHp` numbers it already printed. The hue-only readings are gone — a slash on a spent
      Poké Ball, `TOX` through the shipped abbreviation chip, the FRLG ▶ on the selected move
      cell, an underline on the active bag pocket, a 3-px stroke on a disabled cell — and the
      route HUD and every battle menu are operable from the keyboard alone (new pure
      `stepCursorWithHeader` / `boxPageForIndex` / `stepBagCursor` / `stepGridCursor` /
      `detailStops` / `stepStop` / `nextDetailTab`, plus a `hudKeyboardPane` focus that stops the
      walk and clears on pause; no keybind action, default or alias was added). `StarterScene`'s
      `typeBadges` loses the stale "no Fairy badge" claim and its provably dead text fallback.
      No panel geometry moved (the compact 0-px clearances and `FOE_PLATFORM_CLEAR` are
      untouched) and the contract is written down: `docs/design-spec.md` §10 with the audit
      table, `docs/tech-decisions.md` `D45`.
- [x] **Rotom's five appliances are a one-way, click-driven evolution (`D38`).**
      `src/data/dex/evolutions.ts` gains one module-private `FORM_EVOLUTIONS` override table —
      canon Rotom has no evolution at all, its appliances are a forme change from a key item, so
      the generated `evos` is honestly empty and the five branches are a **game rule** layered
      over the dex — read by `speciesEvolutionLevel`/`evolutionBranches` and walked **additively**
      by `evolutionFamily`/`evolutionDepth` (the only species whose answer moves is Rotom:
      family 1 → 6, depth 0 → 1, measured across all 1282 playable species). All five branches
      share the level the shipped BST-band rule resolves (**30** for Rotom's 440, asserted by
      identity rather than by a literal), the STATS tab's family graph draws the six rows and a
      click carries the member into the appliance keeping level, nickname, nature, gender, shiny,
      IVs/EVs, moves and PP, status and held item — only `speciesId` and the stats/ability derived
      from it move, with the missing HP carried onto the same maximum — and the change is
      **one-way, Eevee-style**: an appliance offers no branch and never leads back to Rotom or a
      sibling. No scene change was needed (the shipped click path carries it), the generated
      `species.json`/`meta.json` and `scripts/build-dex.mjs` are byte-identical (`npm run data:dex`
      was not run) and no fixed seed moved.
- [x] **The last three item-driven move retypes ship on the Plates' seam (`D37`).**
      Multi-Attack reads a **Memory**, Techno Blast a **Drive** — the 21 hand-authored rows gain
      `ItemDef.memory`/`ItemDef.drive`, the shape the `plate` field already froze, with their
      `shortDesc` finally true — and Natural Gift reads the berry's own dex pair
      (`getDexItem(id)?.naturalGift`, `{ type, basePower }`) through a new `onModifyMove` hook in
      the effect registry, spending the berry on `onAfterMove` so a missed or Protect-blocked
      move keeps it while the turn that used it still resolves with the berry's type and power.
      The panel rule moved to `itemMoveType` in `src/engine/battle/moveType.ts` (and
      `movePreview` now folds `runModifyMove`), so the FIGHT menu, the party panel and the battle
      can no longer disagree; the eleven unmodelled berries stay honest `no-op` rows. The 21 rows
      leave `COMPETITIVE_HELD` (**143 → 122**) and become `MEMORY_DRIVE_ITEMS`/`MEMORY_DRIVE_IDS`
      — ground-only `end`-band treasure exactly as the Plates are, with the Mart stocking none of
      them and no shelf moving — and the `D16` coverage table is regenerated
      (`npm run docs:coverage`: Items `290 total (138 port, 71 no-op, 81 excluded)`, the three
      move rows now reading `registry: effects/items.ts`), with `docs/balance/economy.md` following
      the split. No packer ran, no dex file changed and no fixed seed moved. One consequence is
      recorded rather than hidden: the route HUD's learnset-**pool** cells still classify with the
      ability-only `abilityMoveType`, so a pooled Multi-Attack, Techno Blast or Natural Gift row
      does not yet show the held item's type while the party panel and the FIGHT menu do — the way
      the pool has always read, and a follow-up rather than a regression.
- [x] **One biome ships: the never-wired entries are pruned (`D10`).** The backlog asked which
      biomes join the cycle; the human's answer was the inverse — *solo existe el bosque* — so
      nothing was added and everything unreachable was deleted. `src/data/biomes.ts` loses `wood`,
      `outdoor`, `cave` and the non-biome `placeholder` row: `BiomeId` is the singleton `'forest'`,
      `BIOMES` is `{ forest }` with its exact previous `name`/`tilesetId`/`layout`/`terrain`, and
      `BIOME_ORDER` stays `['forest']`, so `biomeForMap`/`biomeForRoute` answer exactly what they
      answered before for every seed — the frozen regression route in `sketch.test.ts` passes
      untouched. The registry follows: `TILESET_IDS`/`TILESET_NAMES`/`TILESETS` hold the forest field
      alone, `src/data/tilesets/palettes.ts` keeps only `FRLG_FOREST_PALETTE`, `wood.ts` is deleted
      (with its `.prettierignore` line) and `FRLG_TILESET` stays as the shared FRLG field layout that
      `FRLG_FOREST_TILESET` specialises. `PLACEHOLDER_TILESET` survives as a **test-only fixture** —
      exported from `placeholder.ts`, out of the registry, so `BootScene` no longer preloads the
      procedural sheet; the four parked atlas PNGs stay on disk, unreferenced, for a later art task.
      `RouteScene`'s pre-route `tilesetId` initialiser moves `'wood'` → `'forest'`, the only id boot
      preloads. Tests move with it (`exit.test.ts` and `tileFrames.test.ts` build against the fixture
      instead of `WOOD_TILESET`, the FRLG atlas sweep measures the shipped forest atlas only, the
      route fixtures stop labelling themselves `'wood'`), and `biomes.test.ts`/`ids.test.ts` now pin
      the singleton registries: 1484 tests, green.
- [x] **Gigantamax, in the Mega Evolution mould (`D44`).** A G-Max forme is a **battle state**: a holder
      whose own species has one may take it **before any move**, it **doubles HP** and leaves every
      other stat, its types and its ability alone (Añil's rule, not a G-Max stat table), and the battle
      end reverts it from the fighter's snapshot. The formes are generated, not hand-written:
      `scripts/build-dex.mjs` now emits `src/data/dex/gmaxes.json` beside `megas.json` (read through the
      new `src/data/dex/gmaxes.ts` + `gmaxes.test.ts`), and `scripts/anil/build-pokemon-sprites.mjs`
      regenerates the two portrait atlases (`public/anil/portraits{,-shiny}.png`) for the new cells.
      The mechanic is the new `src/engine/battle/gmax.ts` + `gmax.test.ts` — fixed seed, it fires **once
      per battle**, the doubling, the revert — threaded through
      `src/engine/battle/{turn,commands,fighter,state,ai}.ts`, with `src/scenes/BattleScene.ts` (+181)
      drawing the gate. **No Max moves**: a G-Max forme keeps its normal moves (`D42`, and the human's
      call when the batch was cut).
- [x] **A full party sends the catch to the PC, and only that route's boxed catch is swappable.** The
      capture screen is **gone**: the engine alone places the catch now (`addCaughtPokemon`), so
      `src/scenes/RouteScene.ts` lost **457 lines** net, `placeCapture` and the old `captured` field
      disappeared and `toPc` is derived from the resulting run. `createRun` seeds `pcCatch: null`, both
      `advanceRoute` and `advanceMap` clear it, and `pcMemberEditable(run, memberId)` is the single
      answer to whether the PC is editable on the current route, so a boxed catch is swapped there and
      nowhere else. The strip is the new `src/ui/notice.ts` (+ its test and the folder's role line, with
      a doc-comment-only touch in `src/ui/partyScreen.ts`), and `src/engine/save.ts` takes the
      **`SAVE_VERSION` step 15 → 16**: `SAVE_MIGRATIONS[15]` drops the old field and `parseRun` ignores
      `pcUnlocked` entirely.
- [x] **The main menu's Continue row shows where the run is.** `src/ui/runSummary.ts` gains
      `runPositionLabel(run)` — `Map <n> · <biome>` — and `src/scenes/MainMenuScene.ts` (+33) draws the
      label with the party's portraits beside the row, so Continue says which map and biome the run
      holds before loading it. `docs/design-spec.md` §2 records the row's third clause and
      `src/ui/runSummary.test.ts` (+46) pins the label. No run field, no `SAVE_VERSION` step.
- [x] **The learnset band scrolls instead of paging.** The band no longer pages: a new pure
      `src/ui/scroll.ts` (`maxScrollTop`, `clampScrollTop`, `scrollByRows`, `visibleRange`) owns
      the maths, and the **mouse wheel**, the `<` / `>` controls and a **drag on the band's own
      background** all move it one row at a time. The `<` / `>` pair stays as the keyboard/pad
      control (the search field keeps the ~78 px those glyphs occupy) and the old `1/3` counter and
      page-step are gone. The change is confined to `src/scenes/RouteScene.ts`, the new module and
      its test, one `src/ui/README.md` role line, and `docs/design-spec.md` §3 / `docs/tech-decisions.md`
      `D36` (which stop saying "paged"). One `[live]` criterion was **corrected in its spec**, not in
      the code: its first frozen press point fell inside the panel's 12 px move handle
      (`HUD_PANEL_BORDER`), so the drag moved the panel; the point now clears that ring. No run
      field, no RNG, no `SAVE_VERSION` step.
- [x] **A trainer's remaining team sits under its HP panel as Poké Balls.** In a **trainer** battle
      the foe's panel now carries a fixed row of balls — one per roster member with the fainted ones
      emptied, so it also shows how many the trainer started with — drawn from the packed Añil item
      atlas's own `itemIconFrame('pokeball')`, the same frame the capture throw already uses. A
      **wild** battle draws **no row**, and the active ball dims in the same repaint that empties its
      HP bar. `src/scenes/BattleScene.ts` alone (+50): no data, no `src/ui/**` module, no docs line,
      no packed asset, no run field.
- [x] **The party's lead walks behind the player on a route, idle and running.** A new
      `src/data/pokemonOverworld.ts` resolves a member's species id through Task-76's coverage
      manifest (`src/assets/pokemon/index.json`) to its `<fileId>` pair and the frame arithmetic
      `dirRow * cols + start + i`; a new `src/render/pokemonFollower.ts` registers one looping
      **idle** and one looping **walk** strip per facing (down / up / side, the right-facing side
      flipped), and `src/scenes/RouteScene.ts` trails the sprite exactly **one tile** behind the
      player, plays `walk` (faster while running) on each step and **loops `idle` while the player
      stands still** — a change the human asked for after the first QA, over the spec's parked rest
      frame — rebuilds it on a lead or room change, ignores it in the HUD camera and sorts it as a
      ground actor so a tree draws over it. A lead whose id is in the manifest's `missing` list
      draws nothing and never blocks the run. No run field and no rule, so no `SAVE_VERSION` step.
- [x] **The battle SWITCH window draws six fixed rows.** The party list is now **one row per
      member at a fixed cell size that does not stretch to fill the panel** — the new pure
      `src/ui/partyGrid.ts` owns the geometry (`partyGridLayout`, `fitPartyLabel`), the label is
      clipped with an ellipsis instead of wrapping, and the arrow keys step member to member.
      `PARTY_COLS` and the member-count-derived row height are gone from `BattleScene.ts`; a
      two-member party draws two rows and leaves the lower four sixths empty. `src/ui/README.md`
      gains its role line. No data, no rule, no run field.
- [x] **The Phase 9 docs close and `AGENTS.md` gains three standing rules.** `docs/maps-spec.md`'s
      open questions become resolved records and its §3 reads as the shipped algorithm; stale
      counts are corrected against the tree — **88** Megas (`D40`), eight maps to level 55, the
      fixed boss and mini-boss parties, the "from map 2 on" shop — and `docs/design-spec.md`,
      `docs/battle-spec.md`, `docs/routes-spec.md` and `docs/tech-decisions.md` are brought to the
      shipped state, with the Phase 9 steps archived in `CHANGELOG.md`. `AGENTS.md` records the
      per-folder README convention, the two-wave QA loop and the **Asset trees** rule. Docs only,
      no code.
- [x] **The balance pass, and the reusable scripted-battle harness.** The `docs/balance/` sheets
      are re-measured against the shipped numbers, and the seed-driven `scriptedBattle()` helper
      moves out of `src/engine/battle/golden.test.ts` into a shared
      `src/engine/battle/harness.ts` with its own test — the **golden log itself is
      byte-identical**, only its source moved, so the one task allowed to restructure it left it
      untouched. The harness fixes a seed, a turn cap, a player/enemy policy and the auto-replace
      path, and renders every `BattleEvent` kind. No engine rule changed, no run field.
- [x] **The overworld sprite set covers every species and form PMD Collab has — 1163 of the 1282
      playable ids — behind a coverage manifest the follower reads.** The three tools under
      `scripts/legacy-art/` were adapted from the sibling project's dependency-free pipeline
      (`fetch-pmdcollab.mjs`, `pmdcollab-species.mjs`, `extract-real-sprites.mjs`, reusing
      `zip-codec.mjs`/`png-codec.mjs`, **no new npm package**), taking their source tree through
      `--dest`/`--source` as an **absolute** path under the main checkout — never a tree under
      `sprite-sources/` linked into a worktree (the Legend's **Asset trees** rule, which is how
      Batch 3 lost the Añil clone). The work list is **derived** from our own dex, never
      hand-listed: a pair is covered only when its JSON carries `durationsMs`, so a
      `generate-pokemon.mjs` placeholder counts as uncovered. **526 new pairs** were packed from
      PMD Collab (the 652 that already carried real animation were left byte-identical — the diff
      is additions only, the three Castform pairs untouched), and the other **119** ids go into
      the new manifest's `missing` list: 15 nums below 650 whose committed pair is still a
      placeholder and which the server has no usable pack for, plus Gen 6+ formes with no upstream
      art. The new `src/assets/pokemon/index.json` is **generated** by
      `scripts/legacy-art/build-pokemon-index.mjs` (byte-reproducible, like `src/data/dex/**`) and
      is the frozen interface `[Task-41]` reads: `sprite` 32, `rows` 5, `dirRows`
      `down/downright/up/upright/left`, `files` (species id → `fileId`, where `fileId = num` or
      `num * 100 + formIndex`) and `missing`. `src/assets/README.md` and `docs/art-direction.md`
      record the PMD Collab tier's provenance, and its own headless `index.test.ts` asserts the
      coverage from the committed tree alone. No run field, so **no `SAVE_VERSION` step** — the
      chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **The debug overlay can teleport between floors, rooms and tiles, and ignore wild encounters
      and trainer sight.** The Route tab gains a *Teleport* block — `Floor`, `Room` and `X`/`Y`
      inputs (blank means `auto`) with a `Go` button each, a `#debug-location` readout and its own
      `#debug-teleport-status` line — and the General tab the two checkboxes; `src/main.ts` wires
      the five new handlers, the pattern every handler in the tree already follows. The scene
      reuses the **shipped** transitions rather than inventing a second way to change rooms:
      `teleportToFloor` runs the real `advanceMap` (resetting the destination floor's per-floor
      bookkeeping exactly as a normal floor change does — fog, trainers, items, captures, boss,
      `pcUnlocked`, level cap) but deliberately **does not heal** (the menu has its own *Heal*, and
      a silent heal would hide the very bug the tool is used to chase), `teleportToRoom` runs
      `advanceRoute` + `transitionTo` so it lands on a real door with the opposite arrival edge,
      and `teleportToTile` stops any walk first and then calls `movePlayerTo`, so a mid-step
      teleport cannot let the tween drag the player back and fire `onTileEntered` at the old tile.
      All three clamp into range and refuse a solid tile or a missing floor plan
      (`teleport failed: no floor plan` / `solid tile`). `debugLocationLabel(context)` is the new
      pure, tested helper (four exact strings). The two toggles are dev-only and unsaved: the
      ignore-encounters flag gates the grass roll and the ignore-trainers flag gates **both** sight
      paths (`trainerSpotted` and the spinning trainer's `seesPlayer` branch), the **boss and
      mini-boss count as trainers** so their sight stops too and the portal stays sealed until the
      boss falls (D31), and because a skipped roll spends no draw a run with a toggle on no longer
      matches its seeded stream — stated plainly rather than hidden. It adds no run field, so **no
      `SAVE_VERSION` step**; the chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **A boss always fields six Pokémon and a mini-boss three — map 1 the exception, at three and
      two.** Both rosters used to be derived from the floor's band (`band.trainerSize + 1`), so a
      boss's team grew and shrank with the level curve and a map-1 boss met you with two. The rule
      is now a fact about the boss: `src/data/bosses.ts` is new and holds
      `BOSS_PARTY: Readonly<Record<BossPartyKind, { firstMap; size }>>` — **`boss { firstMap: 3,
      size: 6 }`**, **`miniboss { firstMap: 2, size: 3 }`** — plus the pure
      `bossPartySize(kind, mapIndex)` (map 1 and any degenerate index read the map-1 row; from the
      kind's `firstMap` on it reads its `size`). `RosterOptions` (`src/engine/run/roster.ts`) gains
      an optional **`count`**, resolved as `Math.max(1, options.count ?? band.trainerSize)`, so the
      band default and every ordinary roster are **untouched** — the new field is optional and
      `roster.test.ts`'s band-size pin is unmodified. `src/scenes/RouteScene.ts` passes
      `count: bossPartySize(kind, room.mapIndex)` for exactly the two fights (the boss and the
      mini-boss) and nothing else; the boss keeps its `minLevel: band.maxLevel` and the stream keys
      are unchanged, so the task drew **no RNG of its own** — it only changes how many draws the
      roster's existing stream spends. `docs/maps-spec.md` §6 and its §7 mini-boss row,
      `docs/battle-spec.md` §7, `docs/balance/route-curve.md`'s Exceptions bullet,
      `docs/data-spec.md` and `src/data/README.md` carry the rule. The boss's XP **award is left
      uncapped** (a six-Pokémon boss pays six times `experienceAward`) and that is recorded as a
      decision for the balance pass to weigh, not a defect. No run field and no `SAVE_VERSION`
      step, so the chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **The early floors thin out: maps 1-2 place fewer trainers and less loot, and map 1 hangs
      no shop leaf.** A run's first steps were the heaviest in the game — floor 1 fielded **11.33
      trainers** in the sheet and up to 12 on a seed, near end-game density — and the geometry
      cannot shrink (a floor already sits on the guaranteed six rooms, `D30`), so the fix is the
      floor's *population pass* plus one special leaf. `src/data/population.ts` is new and holds
      `POPULATION: Record<BandId, BandPopulation>` (`BandPopulation = { trainerBonus; guardChance }`):
      **`early { -1, 0.5 }`**, **`low { -1, 0.75 }`**, and the four later bands `{ 0, 1 }`, which is
      *bit-identical* to a request that passes no population at all (no extra draw), so maps 3-8's
      routes are untouched by the default. `RouteRequest` gains an optional `population` and
      `placeTrainers` reads it: the tier bonus is `max(0, tier + trainerBonus)` and each pocket's
      guard exists only with `guardChance` (**one draw from the existing `populate` stream, and
      none at all when the chance is `>= 1` or `<= 0`**) — the spine guard is never thinned, so the
      lane-guard promise and the `wantsTrainers` gate keep their meaning. `ROUTE_LOOT`'s `early`
      and `low` `itemChance` fall to **0.5 / 0.6** (`pool` and `hiddenChance` byte-identical), and
      `src/engine/maps/plan.ts` gains `SHOP_FROM_MAP = 2` and `hangsShop(mapIndex)` so **map 1
      hangs no shop leaf** — a counter the run has no money for is dead weight and it already
      starts with its 10-ball pack — leaving floor 1 at **six rooms, seven when its mini-boss
      rolls**. `src/scenes/RouteScene.ts` passes `population: POPULATION[band.id]` in `buildRoute`
      (one line); `src/ui/mapView.ts` and `mapView.test.ts` closed **untouched**, because the
      minimap draws a leaf's marker from the plan and an absent leaf is simply a missing marker.
      **The re-measured eight-floor walk is the acceptance criterion**, and it moved more than the
      two floors the task set out to thin: dropping the shop leaf removes two `rng.int` draws from
      map 1's `map` stream (its special pass shifts), and `routeIndexForRoom`
      (`src/engine/run/floors.ts`, 48-53) sums the earlier maps' `rooms.length`, so a six-room map 1
      shifts **every route index from map 2 on** and re-rolls maps 2-8's routes. Floor 1 now measures
      **5.67 trainers** (was 12.00) and floor 2 **6.33** (was 12.33), every floor's
      `0.75 · T̄·A / needed` sits inside `1 – 1.5` (maps 1-2 inside `1.20 – 1.35`), and
      `LEVEL_BANDS.trainerXp` is re-solved **early 1.35 → 2.67**, **low 6.08 → 10.68** — numbers
      only, no other row moved. `docs/balance/route-curve.md` is rewritten to that measurement,
      `docs/maps-spec.md` §7 and `docs/design-spec.md` §7 and `docs/route-generator.md` carry the
      per-band population, the guard chance and the "from map 2 on" shop rule, and
      `src/data/README.md` lists `population.ts`. No run field and no `SAVE_VERSION` step, so the
      chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **The forest's tall grass draws in the forest's own palette, and nothing it draws ever
      covers the player's upper body.** Two halves, both scene/data: the FRLG fields declare a
      per-field **`grassRustleTint`** on the tileset (`0xC1D7EF` for the forest, none for the
      outdoor and cave fields, which share one config) applied to the single rustle overlay
      sprite, because the decompilation's `tall_grass.png` is the **outdoor** palette's art and
      the packer stamps the same five cells for every field — so in the forest (the only biome
      `BIOME_ORDER` walks) the overlay painted light blades (78,148,81) over the field's dark
      tuft (59,125,76), a `+19/+23/+5` per-channel mismatch the player read as "the floor turns a
      lighter green when I step in"; the tint brings the parked overlay to (59,125,76), matching
      the neighbouring tuft within a unit. And that same sprite is **cropped to the cell's rows
      6-15**, so **no frame of the hit draws above cell row 6** — the closing frame used to be
      opaque over the whole cell (816 px over the character on the desktop, 864 on the compact
      layout) and, now carrying the ground's own colour, read as the background jumping on top
      of the player; every frame's band now starts at row 6 (world y 153) and the character's
      top ~15 px stays visible through the whole beat, on both layouts. The three atlases and
      the packer are untouched, no run field, no `SAVE_VERSION` step, no RNG.
- [x] **The level curve is re-planned: eight finite maps, levels 2 → 55, and an infinite floor
      that keeps climbing.** `MAP_TUNING` (`src/data/maps.ts`) carries eight rows — caps
      **9 / 16 / 23 / 30 / 37 / 43 / 49 / 55**, stepping 7/7/7/7/6/6/6 — so the first floor is
      worth **+4** to a fresh level-5 starter instead of the single level it used to be, and
      `FINITE_MAPS` is 8. `LEVEL_BANDS` (`src/data/run.ts`) is re-spanned over the same six ids
      with its `bst` windows and `trainerSize` chain untouched, and `trainerXp` is re-solved
      (1.35 / 6.08 / 3.04 / 5.82 / 4.65 / 2.61) so the repo's own rule still holds — *0.75 × a
      floor's trainers pays that floor's cap* — with the walk's fills landing inside **1.09-1.44**
      (maps 1-2 at 1.42/1.44, with slack for the floor-1 thinning task). The `mapTuning` defect is
      fixed on the way: an out-of-table (infinite) map used to pin its `minLevel` at the last row's
      `maxLevel` while only the max climbed — floors became 40-48, 40-56 … and settled at a 40-100
      range — and now **both** ends climb and saturate at `MAP_MAX_LEVEL` (map 9 is 55-63, map 10
      63-71, and 10 000 is 100-100). `docs/balance/route-curve.md` is rewritten over the eight-row
      walk with the measured `T̄/A/needed/fill`, and `docs/maps-spec.md` §4/§5/§10 resolve `O-M7` in
      eight. One line of `src/engine/run/progression.test.ts` is re-pinned (`bandForLevel(10)`:
      `mid` → `low`), and the band-boundary floating-point identity the solver must survive is
      recorded in the spec. No run field, so no `SAVE_VERSION` step.
- [x] **The battle panels' type badges are twice the size.** The row `[Task-53]` shipped now draws
      each badge at **×2** — a 32×14 atlas frame becomes **64×28** — with `PANEL_TYPES_H` 20 → 36,
      `FOE_PANEL.h` **150** and `PLAYER_PANEL_H` **184**, and the text-chip fallback scaled with
      them (72×36, a 24 px label clipped to the box) so the two can never disagree. Every other row
      keeps its offset from `barY`; the panels' extra height comes out of the battlers' size caps,
      and the compact layout is still measured at **0 px** of battler behind a panel (cross-checked
      at the `COMPACT_SIZE` threshold and on a 640-px-tall phone) with `FOE_PLATFORM_CLEAR`
      untouched. `src/scenes/BattleScene.ts` alone; no data, no docs line, no run field.
- [x] **The tall-grass rustle draws only its blades, at the player's feet, and the still pose
      covers half the character.** Three cuts' worth: the packer no longer re-grounds the
      decompilation's `tall_grass.png` frames onto each field's floor — they are stamped with their
      **own alpha**, so the overlay shows the tile and the player through its transparent pixels
      instead of painting a solid cell over them — and the parked cell is the rip's **settled**
      frame, so standing in grass covers **13.5 of the player's 28.5 visible px (47 %)** and leaves
      the cap, face, shoulders and upper torso clear, while the hit's closing frame still closes
      over the cell for its ~70 ms and the sprite settles on a cell **byte-identical to the hit's
      last frame**, so the settle has no jump. Cells **6 and 45-48** of the three FRLG atlases are
      the only art that moved, repacked from the two sheets by absolute path, and
      `docs/tileset-spec.md` §6 records the rule and the rows. The earlier cuts are why: the anchor
      was provably not the blocker (pixel-identical captures), and the one-sided criterion that let
      a 26 % band pass was replaced by a two-sided one measured on both layouts.
- [x] **The tall grass rustles on the tile the player walks through, with FireRed's own
      animation.** Walking into (or standing in) a grass patch now plays the cartridge's
      *hit* on the player's tile: `scripts/frlg/build-tilesets.mjs` stamps the five
      `graphics/field_effects/pics/tall_grass.png` frames of the pret/pokefirered
      decompilation — materialised in the gitignored `sprite-sources/frlg/` and passed to
      the packer as **command-line paths**, so no packer ever reads inside a worktree — into
      the unused cells `6, 45-48` of each of the three FRLG atlases (cell 6 is the field's
      own tuft, byte-identical to the tall-grass frame 5; the four hits are re-grounded on
      the field's floor), and `RouteScene` cycles them on a single sprite over the player's
      own tile once per step, parking on the rest frame, hiding the moment they step out,
      and covering their feet while the opaque frame plays. `TilesetConfig` gains exactly one
      optional field (`grassRustle`), read through the new pure `grassRustleFrames`
      accessor beside `isGrassStepTile`; no other cell of the map animates, no RNG is drawn
      and no `SAVE_VERSION` step is taken. `docs/tileset-spec.md` §2/§6 and
      `docs/art-direction.md` (the new rip's provenance) record it.
- [x] **A finished run returns to the main menu instead of the starter pick.** `RunOverScene`
      now sends **both** outcomes — a wipe and a win — to `MainMenu` through one
      `returnToMenu()`, so the route the player came from is where a new run is started; the
      summary still reports the victory, the save is still cleared (`clearRun`) and the input
      guards (`RUN_OVER_INPUT_DELAY_MS`, `armed`, `leaving`) are unchanged. `docs/design-spec.md`
      §6 states the destination.
- [x] **An evolution that is not a level-up takes a BST level: 20 / 30 / 40, at least +10
      above the evolution that produced it.** `evolutionLevelForBst` and its
      `EVOLUTION_BST_LEVELS` bands (`src/data/dex/evolutions.ts`) resolve every **non-level**
      branch from the species' own `bst`, anchored on the run's `LevelBand.bst` windows, with
      a `EVOLUTION_MIN_GAP = 10` floor over the resolved level of the pre-evolution; the 69
      canon level-up branches keep their own cartridge levels byte-for-byte, and 60 of the
      156 non-level branches move (Primeape 30 → 40, Seadra 33 → 42, Scyther 20 → 40 …). The
      rule is written for the **shipped** caps and hardcodes none, so a later level-curve
      change moves the numbers and not the rule. `docs/battle-spec.md` §7, the `D38` entry and
      the new `docs/balance/route-curve.md` section carry it.
- [x] **The battle's two HP panels show the active Pokémon's types under its name.** One
      loop in `drawSidePanel` (`src/scenes/BattleScene.ts`) draws up to two badges per side
      from the live fighter (`displayActive`, so a switch, a forme change and a Mega all
      repaint it), read from the Añil type atlas the move cells already use and falling back
      to a coloured text chip for a type the atlas lacks; the panels grew `PANEL_TYPES_H` and
      every other row keeps its offset from `barY`. The compact phone layout needed a
      correction round once QA measured it: the taller foe panel was leaving 33 px of the foe
      battler behind the player panel, so the compact platform is now pinned a platform's
      depth above that panel and the overlap is **0 px**, with the desktop layout, the type
      row and the mon-size caps untouched. No new module, no `src/data/**`, no docs line and
      no literal.
- [x] **The Mart always stocks four rows, and every band's machine beside them.** The stock
      is a **10× ball pack** at half the catalogue price rounded to the hundred (¥1,000 /
      3,000 / 6,000), the band's **Potion** rung, and **two held items** at their catalogue
      price, followed by the per-band TM Task-22 ships — so every `kind: 'status'` cure and
      every X-item has left the buy list and now reaches a run only from ground loot and the
      mini-boss reward. `ShopSlot`/`ShopRow` gained `count` (the pack adds ten units for one
      price, the sell side is byte-identical and still unit-by-unit, so no buy-and-sell loop
      exists) and `SHOP_CORE`/`SHOP_ROTATION_COUNT` are gone. `docs/maps-spec.md` §7 and
      `docs/balance/economy.md` record the stock; `src/scenes/RouteScene.ts` was not touched.
- [x] **Every window in the game is drawn now instead of ripped, and the chrome carries its
      own translucency.** `src/ui/frlg.ts` sliced the FRLG sheets for all six scenes; it now
      serves a committed, **drawn** set under `src/assets/ui/**` (`window.png` 96x96,
      `textbox.png` 128x128, `font.png`) described by `src/data/ui/chrome.json` /
      `src/data/ui/font.json` and produced deterministically by the new
      `scripts/ui/build-chrome.mjs` (`npm run data:ui`), which also derives the font atlas —
      same glyph metrics, shadow pixels' alpha 255 → 128, white ink kept — from the FRLG
      originals, which stay in the tree as the source. Every exported name survives: the
      paddings (20/16/8, 36/28/28), the corners (20/24) and `addFrlgWindow`'s signature are
      unchanged, so no scene's layout was re-cut, while `addFrlgWindow` now applies the set's
      own alpha (0.88 window / 0.94 textbox) so the map and the field stay legible through
      every panel. `FRLG_INK` moves to the deep black `0x0b0b10` and the light window's field
      stays `#f8f8f8` — a dark field would have made the frozen ink unreadable (1.05:1) —
      and `hudTransparent` keeps its id, labels, default and storage, re-read as a degree:
      `Off` is the chrome's own alpha, `On` is the route HUD's alpha 0 plus its outline and
      light text (`applyHudBackground`'s base is `FRLG_WINDOW_ALPHA`). `src/ui/frlgFont.ts`,
      `src/ui/frlgFont.test.ts` (the manifest import), `src/ui/README.md`,
      `src/scenes/RouteScene.ts`, `src/assets/README.md` (three superseded),
      `docs/art-direction.md`, `docs/design-spec.md` §3/§4, `.prettierignore` (one generated
      line), `package.json` (`data:ui`). No settings-model, `src/engine/**` or `SAVE_VERSION`
      change.
- [x] **A Mart always offers one machine, and every machine shows its own type's art.**
      `SHOP_TM` (`src/data/shop.ts`) is the new per-band TM table — six bands, eight catalogue
      ids each, every band's list inside its own TM-number range and strictly after the
      previous band's — and `buildShop` (`src/ui/shop.ts`) draws **one** id from it **last**,
      so every pre-existing pick keeps its fixed-seed sequence. The slot is priced at the
      catalogue's `buyPrice` (¥3,000), deliberately not discounted, because a price under
      `sellPrice` would be a buy-and-sell money loop. `itemIconFrame` (`src/data/itemIcons.ts`)
      now resolves a TM to the `machine<type>` frame of the move it `teaches` — all 171 of
      them, with `machinenormal` as the fallback for an unknown move — because Añil's own
      `machine_<TYPE>` set was already packed: **no repack, no new art, no npm script**, and
      `hasItemIcon` still answers `false` for a TM. The Mart panel already drew whatever
      `buyRows` returned, so no scene changed. `src/data/shop.test.ts`, `src/ui/shop.test.ts`,
      `src/data/itemIcons.test.ts`, `docs/maps-spec.md` §7.
- [x] **A caught Pokémon keeps the share of health it had in the wild.** Reported in play as a
      catch that arrived healed; the loss was the **fold**, not the battle.
      `adoptAtLevel` (`src/engine/run/progression.ts`) rebuilt the member through
      `createFighter`, which starts at full HP, so the level it adopts (`squadLevel`) healed it
      too. It now re-derives the wild's own maximum (`statAtLevel` at the snapshot's level) and
      carries the **fraction**, `Math.round`ed and clamped to `[1, newMax]` — the
      `evolvePokemon` shape one function below — so a wild caught at 30% arrives at 30%, a
      full-HP member (the dev-only `addDebugPokemon`) is unchanged and a 0-HP fixture lands on
      1 HP instead of being released as fainted. Species, level, nature, IVs, EVs, ability,
      gender, shiny and held item are carried as before and the moveset/PP/status rebuild is
      untouched. No `Rng` draw moved, so **no fixed-seed expectation changed** and no re-pin
      was owed; no `SAVE_VERSION` step. `src/engine/run/progression.test.ts`,
      `src/engine/run/resolve.test.ts` (additions only).
- [x] **Run Away's ⓘ stops quoting the dex's competitive blurb.** Measured on `main`, the
      ability was implemented and `port`ed all along — `runAway()` sets `onTryEscape`,
      `runTryEscape` is consulted by `rollRun` **before** the speed odds, and `canRun` refuses
      while trapped — so the defect was the copy: all three ⓘ homes drew
      `detail.abilityDesc`, which carried the dex's "No competitive use" text. The new
      hand-authored `src/data/abilityText.ts` (`abilityText(id)`, ids normalised like
      `getAbility`) holds the override table, and `abilityDescription` (`src/ui/partyDetail.ts`)
      reads **override → dex → null**, so the one change fixes the route HUD's detail panel,
      the capture screen and the battle's SWITCH window. The measurement the entry asked for is
      in the report: the class is `ballfetch honeygather runaway`, and only Run Away is
      `port`ed (the other two are `excluded`, so their blurb does not lie).
      `src/data/abilityText.test.ts`, `src/ui/partyDetail.test.ts`, `docs/data-spec.md` §2,
      `src/data/README.md`.
- [x] **Nine Mega formes are no longer playable species.** `@pkmn/dex` tags its future
      formes `isNonstandard: "Future"`, and 40 of the 49 set `isMega: true` — but nine
      name the forme instead (`absolmegaz`, `garchompmegaz`, `lucariomegaz`, the two
      Meowstic, `magearnaoriginalmega` and the three Tatsugiri), so `isMega` missed them
      and `isPlayable` shipped them as ordinary wild species with **no** stone: the
      playable set was wider than the Mega set by exactly those ids. The shipped rule is
      the named predicate `isUnflaggedMegaForme` — a `Future`, non-`Past` forme whose
      `forme` is a `Mega`-style name carrying no `isMega` flag — added to the
      `isPlayable` chain, so `species.json` and `megas.json` now agree about what a Mega
      is. The playable set falls **1291 → 1282** and `learnsets` **1290 → 1281** while
      `megas.json` stays at 88; the three files the batch had arbitrated for a re-pin
      needed none, because no fixed-seed expectation depended on the nine.
      `scripts/build-dex.mjs`, the regenerated `src/data/dex/{species,learnsets,meta}.json`,
      `src/data/dex/megas.test.ts` + `README.md`, `docs/data-spec.md` §1,
      `docs/tech-decisions.md` (`D3`/`D40` counts), `docs/showdown-reuse.md` §2.
- [x] **A route can no longer ship with no trainer guarding its main lane.** Reported
      against `docs/route-generator.md` §3.4's promise: `placeTrainers` commits a spine
      trainer through `tryFrom` and ignores a `false` return, so a seed whose candidates
      all failed (`candidateOk`: wall-hugging, off the entries and pockets, crowded,
      seeing the entry, or cutting the route) shipped a route with no main-lane fight,
      and `validateRoute` had no field to say so. `RouteValidation` gains
      `missingLaneGuard` (the `'no-trainers'` reason), `ok` gains its conjunct, and
      `sketchRoute`/`sketchRouteSteps` re-roll inside the unchanged `MAX_ATTEMPTS = 8` —
      the attempt index is already part of every stream key, so a re-roll still yields
      one deterministic `(seed, routeIndex)` and draws no extra `Rng` value. The gate is
      **conditional**: the new exported `wantsTrainers(request)` (non-quiet, non-empty
      archetype pool) decides, because a `RouteMap` alone cannot know a quiet room — the
      map's entry and boss rooms — legitimately shipped none. §3.4's promise is now true
      and §4 lists `missingLaneGuard` beside the `borderBandGaps` Task-32 added (nine
      gated lists). One fixed seed changed its shipped attempt (`sweep-b` in
      `validate.test.ts`: attempt 0 → 1, 0 → 4 trainers); a 4 059-request sweep found 42
      requests that now re-roll and none that exhausts the eight attempts, and QA
      re-measured that seed independently.
      `src/engine/routes/{validate,sketch}.ts` + tests, `docs/route-generator.md`.

- [x] **A Pokémon can be named, right in its own STATS panel.** The battle layer already
      rendered a `FighterInput.nickname` but nothing ever set it, so every member showed its
      species name — and the nickname could not simply be `fighter.name`, because Mega
      Evolution and every forme change rewrite that field and restore it from
      `megaBackup.name`. So the nickname is its **own field**: `createFighter`,
      `snapshotFighter` and `restoreFighter` carry it (a test proves it survives a Mega),
      `partyRow`/`fighterDetail` prefer it, and the learn popup and the evolution message name
      the member by it. Typing it happens **in place**: the STATS tab's name row *is* the field
      (`HUD_NICKNAME_*`, a rectangle inside the panel's own window with the `>` focus mark and
      a `click to name` hint), following the MOVES tab's learnset search instead of a modal —
      and while it has focus **every** route key is inert (`handleAction`, `heldDirection`,
      `updateReset` and the dev key), with Enter committing, Escape discarding, and a press
      outside, a tab switch, closing or collapsing the panel or a pause discarding too.
      `normalizeNickname` collapses whitespace, trims and truncates to 12 **code points**, and
      `renameMember` reads the species' own name as "clear it". The save gains the field with a
      `SAVE_VERSION` 14 → 15 step whose migration adds nothing. `src/engine/run/nickname.ts` +
      test, `src/engine/battle/fighter.ts` + tests, `src/engine/save.ts` + test,
      `src/ui/{partyDetail,partyScreen,permadeath}.ts` + tests, `src/scenes/RouteScene.ts`,
      `docs/design-spec.md` §3, `docs/battle-spec.md` §7.
- [x] **Every type has its badge, Fairy included, and the statuses come from Añil too.** The
      FRLG sheet predates Fairy, so a Fairy type fell back to a text chip. Both atlases are now
      packed from Añil's own UI art (`Graphics/UI/types.png`, `statuses.png`) by two packers
      that take their source as an argument and fail loudly when it is missing — the repo's
      answer to keeping a gitignored asset out of a worktree. Frames keep the old geometry
      (types **32x14**, status **32x8**, 4 columns), so no consumer changed. Types: 19 badges —
      the 18 types plus the sheet's `???` slot, a flat bar with no glyph kept for manifest
      parity — and `fairy` draws. Statuses: Añil ships seven (SLP/PSN/BRN/PAR/FRZ/FNT/PKRS) and
      **no badly-poisoned** one, so `tox` keeps the `psn` frame and the test asserts the
      fallback instead of inventing a badge. Both tests decode the committed PNGs and check the
      frames are not empty, so a packer that wrote a blank sheet cannot pass.
      `scripts/frlg/build-{type,status}-icons.mjs`, the two `src/data/frlg/*.json` + atlases,
      `src/data/{typeIcons,statusIcons}.ts` + tests, `package.json` (`data:frlg:icons`),
      `docs/art-direction.md`.
- [x] **The dex ships the Z-A and Champions Megas: 48 → 88 Mega formes.** `@pkmn/dex` already
      carried them, tagged `isNonstandard: "Future"`, and our own `isMega` filter accepted only
      `Past`, so 40 formes were missing. The rule as shipped is the dex's own tag: a `Future`
      row counts when it carries **`isMega: true`**, not when its name ends in Mega — because
      nine `Future` entries name the forme instead (`absolmegaz`, `lucariomegaz`,
      `garchompmegaz`, the two Meowstic, `magearnaoriginalmega` and the three Tatsugiri), they
      are already in `species.json` as *playable* species, and three of them would share a stone
      (`meowsticite`, `magearnite`, `tatsugirinite`), which the one-stone-per-forme guard
      rejects; fixing that is registered as its own task. Two dex rows carried an inconsistent
      HP (`floettemega` 74, `zygardemega` 216) and the generator now normalises the HP **and**
      the `bst`, while still throwing when the discrepancy belongs to a `Past` Mega. Every new
      forme maps to its own Añil sheet (no art fallback), all of them get a stone row through
      `MEGA_STONES`, and `roster.test.ts` needed no re-pin. `scripts/build-dex.mjs`, the
      regenerated `src/data/dex/{megas,meta}.json`, `src/data/dex/megas.test.ts` + `README.md`,
      `src/data/anil/pokemon-sprites.json`, `public/anil/portraits*.png`, `docs/data-spec.md`,
      `docs/showdown-reuse.md`.
- [x] **An opening now owns its whole border band.** Reported in play: a route's opening showed
      only part of its door, with border tiles the opening occupied still wall/fence.
      `exitEdgeAt` was never the problem — it already counts any walkable border cell of an
      opening edge as a door — the **geometry** was: `placeAccess` opened a single ring cell
      while `carveGuaranteedPath` carved a two-wide lane, so the band's second cell existed only
      where `cleanWalls` happened to widen the hole, and that pass's bite band is three columns
      anchored at the map's left edge, so it never reached the second cell of an **east**
      opening in a room whose side is ≡ 1 mod 3 (maps 4-6). The fix is engine-only: a pure
      `openingBandCells` in `doors.ts`, `placeAccess` opening the whole band, the band cells
      joining the terrain passes' forbids, and a new `borderBandGaps` gate (sorted row-major) in
      `validateRoute` so `sketchRoute` re-rolls instead of shipping a half-band door. The
      regression freezes the failing case — seed `doors-c`, map 4, room 3, edge `E`, the
      `(30,20)` cell that used to be a wall — and the sweep covers maps 1-6. **A pre-existing
      hole it exposed** is registered as its own task: `placeTrainers` may return zero trainers
      and nothing gates it, against `docs/route-generator.md` §3.4's promise.
      `src/engine/routes/{doors,sketch,validate}.ts` + tests, `docs/routes-spec.md`.
- [x] **Every catch now mints its own member id, so a party row and its detail panel finally
      agree.** Reported in play: catch a third Pokémon and clicking it showed the **second**
      one's stats. The wild fighter was built with a constant id (`createFighter({ id: 'wild'
      })`, `BattleScene`), the encounter key behind it (`grass:x,y`) is not unique per run
      either, and `memberById` resolves a member by **first match** — so every catch of a run
      entered the party and the box as `wild` and the panel answered with the earliest one,
      while the row (drawn by index) looked right. `resolveBattle` now mints the catch's id at
      the fold through a pure `nextMemberId(run)` — grammar `catch-<n>`, stepped past any id
      the party or the box already holds, deterministic and with **no** `Rng` draw (`D11`) —
      which is engine-only, so no scene changed. An old save whose members already collide is
      repaired by `dedupeMemberIds(run)` in the save decoder's `parseRun`, a decode-time
      normalisation like `parseDiscoveredRooms`, so **no** `SAVE_VERSION` bump and no
      migration step; `pcUnlocked` is remapped by the same repair, so a catch keeps the box
      lock it named. `src/engine/run/{state,resolve}.ts` + tests, `src/engine/save.ts` +
      `save.test.ts`, `src/ui/partyDetail.ts` + test, `docs/battle-spec.md` §7.
- [x] **The run's held-item catalogue is the whole competitive set, with Añil's own
      icons.** `src/data/items.ts` grows to 143 new rows (51 the engine can model,
      92 honest `no-op`, 21 hand-authored), `ItemDef` gains nine fields
      (`damageBoost`, `speedBoost`, `accuracyBoost`, `critStages`, `alwaysLast`,
      `resistBerry`, `recoil`, `selfStatus`, `survive`) and
      `src/engine/battle/effects/items.ts` gains the handlers that read them plus
      `UNMODELLED_ITEMS`, the by-name record `scripts/effect-coverage.mjs` reads to
      print an honest `no-op` row (`D16`; the Items table is now 117 `port` / 92
      `no-op` / 81 `excluded`). **The seventeen Plates are obtainable at last**: they
      are catalogued rows the coverage table can see and they drop as `late`/`end`
      loot, where before a run could never hold one. The Mart stocks only what works
      and the ground hands out what does not, so no player buys a dead item. The FRLG
      sheet had no art for the modern items, so `scripts/anil/build-item-icons.mjs`
      packs Añil's 893 item icons into one 24 px atlas
      (`src/assets/anil/item-icons.png` + `src/data/anil/item-icons.json`, keyed by
      the normalised file name, with `hasItemIcon`/`itemIconFrame` over it) — which is
      exactly why no scene changed. `src/data/dex/items.ts` is the typed accessor the
      catalogue reads instead of raw JSON. No new `Rng` stream: the two probabilistic
      handlers draw the battle's own, and the loot and shop tables keep a fixed-seed
      regression. `package.json` (`data:anil:items`), `src/data/{items,loot,shop}.ts`
      plus their tests, `scripts/anil/build-item-icons.mjs`,
      `scripts/effect-coverage.mjs`, `docs/{art-direction,data-spec}.md`,
      `src/assets/README.md`, `src/data/README.md`, `src/data/dex/README.md`.
- [x] **An ability explains itself: the ability row carries the ⓘ the move cells
      have.** Hovering it floats the dex's own description and a click pins it, in
      the route HUD's STATS tab, the battle's SWITCH detail window and the capture
      screen. The floating window moved out of `MoveGrid` into
      `src/ui/infoPopup.ts`, so the move cells and the ability rows draw one
      implementation instead of drifting apart, and `src/ui/abilityInfo.ts` owns the
      ability row's control and the text it floats. The data was already generated
      and thrown away: `src/data/dex/abilities.ts` now carries `desc` and `shortDesc`
      (both coerced to `''`, so a consumer concatenates without a guard) and
      `MemberDetail.abilityDesc` carries the one-line text. The smoke pass also found
      and fixed a real bug on the capture screen: a pinned popup no longer closes when
      the pointer leaves it. `src/ui/{infoPopup,abilityInfo,partyDetail,moveGrid}.ts`
      plus their tests, `src/scenes/{RouteScene,BattleScene}.ts`,
      `docs/design-spec.md` §3/§4, `src/ui/README.md`.
- [x] **The shipped cues are the real FRLG soundtrack, not sine placeholders.** The
      first cut of the audio table committed a generated 1.5 s sine per music bed
      and a 0.2 s sine per cue, because `sprite-sources/frlg-audio/` was never
      materialised — so the game only ever beeped. `pret/pokefirered` ships its
      soundtrack as MIDI plus the instrument bank and samples, never as audio, so
      `scripts/frlg/render-frlg-audio.mjs` now fetches a sparse checkout of that
      decomp plus the `huderlem/poryaaaa` m4a renderer and renders one file per cue
      (the title, Route 1 and vs.-trainer beds, faint, level-up and the
      trainer-victory fanfare), cutting a looping bed down to its loop body so the
      file Phaser loops is the song's own loop. One master gain lifts the lot — the
      decomp's own `-V` mix lands near a tenth of full scale — and the packer's
      caps are per-cue now, so a fanfare is never cut mid-phrase; `cues.test.ts`
      fails if a committed cue is still a placeholder sine. **The `hit` and
      `encounter` cues were dropped rather than faked**: the original varies a hit
      per move (`SE_M_*`) and an encounter is the appearing Pokémon's cry, so
      `se_bang` (the Cut-door bang) and `se_warp_in` (a warp) were never going to
      stand in for them; both moments now play nothing until `[Task-30]` lands.
      Every remaining cue is still one cue-id row in `src/audio/cues.ts`, so a CC0
      set replaces the rip without touching a call site.
      `scripts/frlg/render-frlg-audio.mjs`, `scripts/frlg/build-audio.mjs`,
      `src/assets/audio/*.wav`, `src/audio/{cues,cues.test}.ts`,
      `src/scenes/{RouteScene,BattleScene}.ts`, `src/audio/README.md`,
      `src/assets/README.md`, `docs/tech-decisions.md` (`D22` addendum).
- [x] **Every Pokémon opens with a full four-move set by level 5.** At or below
      level 5 `defaultMoveset` now tops an under-full moveset up from the
      species' own learnset — earliest level-up moves first, then its
      TM/tutor/egg moves — keeping at least one damaging move, so a level-1 catch
      (or a wild Pokémon at the bottom of its band) never fights with one or two
      moves. A species with fewer than four legal moves gets everything it has,
      never a duplicate; above level 5 the "newest four" rule is unchanged. Pure
      and seed-stable, no RNG added. `src/engine/battle/fighter.ts`,
      `docs/battle-spec.md` §7.1.
- [x] **The game ships the full move set (D42).** `build-dex.mjs` generates every
      real move, the `Past` ones included, so a Dexit species keeps its learnset:
      `moves.json` grows 685 → **835** (King's Shield, Aromatherapy, Linoone's
      Belly Drum...). Dynamax (Max) and Z moves are dropped — the engine models
      neither — as are CAP/Future/Unobtainable entries, and Hidden Power's 17
      typings collapse to the single Normal entry (its IV-based type is not
      modelled; this also fixed a duplicate-id bug that corrupted the random
      learnset). `scripts/build-dex.mjs`, `src/data/dex/*.json`.
- [x] **Form-change abilities are generalised like Zero to Hero (D41).** Any
      species may now roll and use **Schooling, Zen Mode, Zen Mode (Galar),
      Shields Down, Tera Shift, Hunger Switch, Forecast, Flower Gift, Stance
      Change and Disguise**: from level 20 on, each changes the holder's forme by
      its own rule (`changeBattleForm`/`restoreBattleForm`, battle-only, snapshot
      kept on the base species) and flips back when the condition ends.
      `randomAbility` no longer bans them; `changeBattleForm` keeps the holder's
      ability so the rule keeps firing. Stance Change's Shield revert needs
      King's Shield (a `Past` move not shipped yet) and Commander stays excluded
      (doubles-only). `src/engine/battle/effects/abilities.ts`,
      `src/engine/battle/fighter.ts`, `src/engine/battle/randomAbility.ts`,
      `scripts/build-dex.mjs`, `docs/balance/effect-coverage.md`.
- [x] **The game ships the full National Dex (Dexit included).** `build-dex.mjs`
      no longer filters to the Gen 9 standard set: `species.json` is now **1291
      entries across all 1025 dex numbers** (911 → 1291), with **48 Megas** beside
      it (`D40`). Only non-species are dropped — CAP/fan entries, `Custom`
      (MissingNo, Pokéstar), LGPE's partner starters (no art) and the battle-only
      Gigantamax/Eternamax formes. A Dexit species with no gen-8 learnset falls
      back to its newest one, a forme inherits its base species', and a species
      whose whole learnset left Gen 9 (Unown) gets Tackle, so nothing ships with
      an empty moveset. Battle art repacked (`npm run data:anil`, 1291 species +
      48 megas). This is the prerequisite for the generalised form abilities.
      `scripts/build-dex.mjs`, `scripts/anil/build-pokemon-sprites.mjs`,
      `src/engine/battle/fighter.ts`, `src/data/dex/*.json`.
- [x] **Encounters and rosters are BST windows per floor, derived from the dex.**
      The hand-authored `ENCOUNTER_TABLES` (per biome) and the archetype `pools`
      are gone: a pure `speciesPool(band, roster)` (`src/engine/run/pool.ts`,
      `D39`) filters the playable dex by the band's inclusive **BST window**
      (`LevelBand.bst`, `src/data/run.ts`) and by the roster's bans. The windows
      tile `0..800` (~120-150 species each), so every spawnable species now
      appears somewhere — the wild covers all but the legendary/mythical tags,
      and a trainer may field any species, legendaries included. The tall grass
      bans `Restricted Legendary`, `Sub-Legendary` and `Mythical`; battle-only
      formes never spawn in either. A **boss** (map boss and mini-boss) fields the
      **upper half** of its band's window. `src/engine/run/pool.ts`,
      `src/engine/run/roster.ts`, `src/engine/routes/encounters.ts`,
      `src/data/run.ts`, `src/data/trainers.ts`, `src/data/biomes.ts`.
- [x] **Abilities are rolled per run, and two once-unimplementable ones are
      reworked around the random pool.** Every wild, trainer and starter Pokémon
      — and each catch — now **rolls its ability** from the implemented set under
      the run seed (`randomAbility`), the way its moveset already was (`D17`);
      an explicit ability (the debug editor) still wins. The roll draws only from
      the effect registry, so an unported ability can never appear, and No Guard
      is dropped when the moveset holds an OHKO move so the pair never meets. Two
      abilities that would be dead on an arbitrary species are now **generic**
      instead of banned: **Zero to Hero** turns any holder into Palafin-Hero
      when it leaves the field (battle only, reverts at the end), and **Wonder
      Guard** absorbs the **first** non-super-effective hit on each switch-in —
      the next hit lands normally. An **evolution re-rolls** the ability from the
      new species under the same seed. `src/engine/battle/randomAbility.ts`,
      `src/engine/battle/fighter.ts`, `src/engine/battle/effects/abilities.ts`,
      `src/engine/run/progression.ts`, `src/scenes/BattleScene.ts`.
- [x] **The effect coverage table is regenerated.** `npm run docs:coverage`
      reports the abilities and items already in the code that the stale table
      still called `excluded` (Normalize, Aerilate, Refrigerate, Wonder Guard,
      Zero to Hero, the treasure items…). `docs/balance/effect-coverage.md`.

- [x] **The debug Party tab sets the squad level once, not per member.** The
      level moved out of the member editor into a **Squad level** control at the
      top of the tab: it parks the run's XP and re-levels the **whole party and
      the PC box** together (they share one level, `D35`), while the member
      editor keeps moves, ability and nature. The member dropdown also suffixes
      identical labels (`Eevee Lv20 (1)`, `(2)`) so two same-species members at
      the same level can be told apart. `src/dev/debugMenu.ts`,
      `src/scenes/RouteScene.ts`, `src/main.ts`.
- [x] **Dev-added Pokémon no longer collide on their id.** The debug panel's
      counter resets on a reload, so a re-added species reused `debug:<sp>:1` and
      `updatePokemon` (which matches by id) then edited or replaced several
      members at once. `nextDebugPokemonId` scans the live party and box for a
      free counter, so every drop stays unique. `src/dev/ids.ts`,
      `src/scenes/RouteScene.ts`.
- [x] **Level evolutions, drawn as a family graph and taken with a click.**
      Every dex evolution — level, stone, trade, friendship, move — is resolved
      to a level (`evolutionBranches`): a canon level evolution keeps its level,
      the rest take their species' own level evolution or a stage default (base
      forms at 20, middle forms at 30), never below the level the species was
      obtained at, and all of a species' branches share it. Evolution is now
      **manual** (`D38`): a member no longer evolves on level-up or on a catch;
      the STATS tab draws its whole family as a graph — one row per species
      indented by stage, each with its sprite and the level it evolves at, the
      pre-evolutions included — with the current species gold and a branch whose
      level is met green, a `click to evolve` hint and a pointer cursor, so
      Eevee's eight forms are a choice. A click evolves the member, keeping its
      level, nature, IVs/EVs, moves, PP, status and held item and carrying the
      missing HP across. The STATS tab also paints the stat a nature raises green
      and the one it lowers red (in the battle panel too).
      `src/data/dex/evolutions.ts`, `src/ui/evolutionGraph.ts`,
      `src/engine/run/progression.ts`, `src/ui/partyDetail.ts`,
      `src/scenes/RouteScene.ts`, `src/scenes/BattleScene.ts`.
- [x] **The MOVES tab gains a learnset band: search, learned moves and bag TMs,
      dragged onto the four slots.** Below the slotted moves the detail window
      shows a search field over a paged, full-width grid of every move the member
      may equip — the level-up moves it has already learned and does not hold, and
      the moves a **TM in the bag** can teach it — tagged `Lv##` or `TM###`. The
      grid spans the window; its paging arrows ride the search row and an empty
      pool reads `no moves to learn`. A pool cell
      drags onto a slot to equip it (replacing what sat there), so a move already
      in the four slots is never listed; teaching never spends the TM (`D36`). The
      panel grew to fit the band. `src/engine/run/learnset.ts`,
      `src/scenes/RouteScene.ts`.
- [x] **Technical Machines.** The full base-Gen-9 TM catalogue (TM001 … TM171)
      ships as **reusable** `machine`-pocket items, hand-authored from the dex's
      `9M` learnset flags (`src/data/tms.ts`), and drops from route loot and
      mini-boss rewards. `src/data/items.ts`, `src/data/loot.ts`.
- [x] **A level-up popup announces "X learned Y!".** When the squad's level ticks
      up (`playLevelUp`) a modal lists every move each member crossed; any key or
      click dismisses it. `src/scenes/RouteScene.ts`.
- [x] **A move's type badge reflects the ability and the battle context.** The
      `-ate` abilities (Aerilate, Galvanize, Pixilate, Refrigerate), Liquid Voice
      and Normalize retype a move, and the context moves Weather Ball, Terrain
      Pulse, Revelation Dance and Aura Wheel read the weather, terrain, user's
      primary type or form — in the FIGHT menu, the party panel and the damage
      calc alike. `src/engine/battle/moveType.ts`,
      `src/engine/battle/effects/moves.ts`.
- [x] **Plates give Judgment its type.** The seventeen Plates ship as held items
      (`plate` plus the canon 1.2x `typeBoost`); while one is held, Judgment takes
      its type in the FIGHT menu, the party panel and the damage calc. Arceus is
      not spawnable yet, so the Plates are catalogued but not obtainable.
      `src/data/items.ts`, `src/engine/battle/effects/items.ts`,
      `src/engine/battle/moveType.ts`.
- [x] **The HUD move cell's ⓘ floats the description again.** `MoveGrid.infoAt`
      compared a cell-local point against an absolute rect, so the HUD's ⓘ button
      never matched and neither hover nor click showed the info popup; it now
      tests the point in cell-local space, so hovering the ⓘ floats the move's
      type and description and clicking it pins the popup. The popup now anchors
      to the hovered cell (`popupAtCell`) instead of the panel top, so in the HUD
      it appears right over the move it belongs to. `src/ui/moveGrid.ts`.
- [x] **The member detail panel is wider and shorter, with the stats in two
      columns.** The detail window (the STATS / MOVES popup) is now 460px wide
      instead of a copy of the party/box window: the HP bar is gone (the HP row
      prints `current / max`) and the six stats read as two columns of three
      (`HUD_DETAIL_STATS`), with NATURE / ABILITY and HELD / CAUGHT in two columns
      too. The wider window also gives the shared move grid cells enough room for
      full move names — the HUD's `MOVES` tab no longer wraps "Thunder Shock" onto
      the PP line. `src/scenes/RouteScene.ts`.
- [x] **The HUD's MOVES tab is the battle's move grid.** The member detail panel's
      MOVES tab now draws the shared `MoveGrid` component the battle's FIGHT menu
      uses — the same type-tinted 2x2 cells with the type and category badges, PP
      and power/accuracy, an ⓘ button and the floating description popup — instead
      of a plain list. The type badge is now the same size as the category badge,
      so the two read as one stacked column. Hovering or clicking the ⓘ floats
      (and pins) the move's info while the cells stay draggable to reorder the
      member's moves. `src/ui/moveGrid.ts`.
- [x] **The battle menu window is taller and the move names sit higher.** The
      bottom menu box grew (desktop `160→192`, compact `204→236`) to give the
      move cells more room, keeping its bottom edge (and so the message box) in
      place. In the shared grid the content anchors higher (`CELL_TOP`), so the
      move name reads as the cell's title above the badges. The ◀ back control
      now sits centred in a wider left column (`MOVE_BACK_COL` 46→64), so the
      grid starts clear of it instead of touching it. Switching a battle menu
      also hides the FIGHT / BAG / SWITCH / RUN cells again (they had been left
      visible under the bag and switch screens after the grid split).
- [x] **Starters require two consecutive evolutions.** The starter pool now keeps
      the base form of a line only when two more evolutions follow in a **chain**
      (`evolutionDepth >= 2` in `src/data/dex/evolutions.ts`), so a split line
      whose children are all final (Eevee, Scyther) is no longer offered even
      though its family has three members. `docs/design-spec.md` §3.
- [x] **The mini-boss and mega-stone rooms hold their own content** (Phase 9
      step 13). A **mini-boss** leaf fields a strong `ace` trainer (a band-level
      party one size larger, allowed a Mega Stone) that stands while unbeaten;
      beating it opens a **reward choice** — three distinct items drawn from the
      map's reward pool (`rewardChoices` in `src/ui/rewards.ts`), taken with `E`
      or skipped with `Q`. A **mega-stone** leaf holds a random **Mega Stone** on
      its far tile, taken with the interact key like any ground item, off a
      per-floor stream (`MEGA_STONE_IDS`). Both use stable content ids
      (`miniBossTrainerId`, `mega-<map>`), so a revisit rebuilds them identically
      and a beaten mini-boss stays beaten. `docs/maps-spec.md` §7, `D33`.
- [x] **The shop room and its Mart panel** (Phase 9 step 12). A shop floor's
      counter (`E`) opens a Pokémon Mart-style HUD window that only exists in that
      room: a **BUY** tab (the band's core of Balls/Potions plus one or two
      rotating items, at catalogue prices) and a **SELL** tab (any item at
      `sellPrice`), showing the run's money, each row's icon and owned count, and
      a feedback line. The stock is a pure `(band, rng)` roll
      (`buildShop` in `src/ui/shop.ts` over `src/data/shop.ts`), so a floor always
      opens the same shelves; the trades, rows and sellability are pure and
      headless-tested. `RouteScene` places the counter on the shop room's farthest
      tile, blocks it and opens the panel with `E`. `docs/maps-spec.md` §7,
      `docs/design-spec.md` §7, `D33`.
- [x] **The floor's special rooms are hung in the plan** (Phase 9 step 11).
      `MapPlan` gains a `specials` list and every `MapRoom` a `special` kind: a
      guaranteed **shop** leaf near the entry, a **mini-boss** leaf at 50% and a
      **mega-stone** leaf at 15% **from map 3 on** (the two may coincide). They
      are extra dead-end leaves on the same `map` stream, hung off regular rooms
      only (never the entry or the boss, so both keep their single door).
      `roomView` carries the kind through, the route builder treats a special
      room as **quiet** (no tall grass, ledges, items or trainers) and the minimap
      now draws each special's own marker. `docs/maps-spec.md` §7,
      `docs/routes-spec.md` §2, `D33`; plan tests for placement, counts, odds,
      coincidence and determinism.
- [x] **The Poké Dollar economy lands: trainers pay, valuables bank.** `RunState`
      carries `money` (a run starts with none; `SAVE_VERSION` 14 +
      `SAVE_MIGRATIONS[13]`). A beaten trainer drops its archetype's **fixed base
      plus jitter**, scaled by the map's band and tripled for the floor boss, and
      only a **first** win pays (`src/engine/run/reward.ts`, `BattleReward.money`,
      `resolveBattle`). The route HUD's **bag panel** grows a MONEY footer. Nine
      **valuables** (Stardust, Pearl, Nugget, Star Piece, Rare Bone, Big Pearl,
      Pearl String, Big Nugget, Comet Shard) join the catalogue as a new
      `valuable` kind with its own bag pocket (`VALUE`); they sell for their whole
      price (other goods still half) and turn up in the route loot pools by band
      (`src/data/loot.ts`). `docs/maps-spec.md` §7, `docs/design-spec.md` §7,
      `D33`; pure tests for the reward roll, `addMoney`/`spendMoney`, the
      migration and the pockets.
- [x] **The battle moves menu reads the numbers and floats its info.** The moves
      grid always reserves its full **2x2**, so one or two moves keep the same cell
      size as a full set, and each cell shows the move's **effective power** (base
      power folded with **STAB** and the attacker's **ability / item** boosts) and
      its **hit chance** (the move's accuracy under the net accuracy / evasion
      stage and any ability), both tinted **green** when raised and **red** when
      lowered, with an ↑ / ↓ on the accuracy. The selection **arrow inside the
      cell** is gone. The move's type and description moved out of an always-on
      popup into a floating window opened by a **ⓘ button** on hover or click; it
      no longer shifts the Pokémon's data panel and now carries the FRLG **type
      badge** and, for a status move, its **status badge**. The status badges are
      packed from the same `type-status-icons.png` source by
      `scripts/frlg/build-status-icons.mjs` (`src/assets/frlg/status-icons.png`,
      `src/data/statusIcons.ts`) and replace the text abbreviation in the battle HP
      panels. New pure `movePreview` in `src/engine/battle/preview.ts`.
- [x] **The Pokevial holds three charges, earned by fighting.** It is no longer a
      single-charge, text-labelled button that refilled at each floor's heal stop:
      the party header draws a **single bar** whose fill climbs through three
      colour stages with **POKEVIAL** written inside (the `x/3` count is gone and
      the hand cursor only shows over a **full** bar), each **beaten trainer** adds
      one charge up to the cap of three, a floor's **boss** fills the bar to the
      top, and the meter **carries over** between floors — only a fresh run starts
      full. Drinking it still rests the whole party and box
      (`POKEVIAL_MAX_CHARGES`, `chargePokevial`/`fillPokevial` in
      `src/engine/run/heal.ts`; `markBossDefeated` and `resolveBattle`).
- [x] **The party and the PC share one level and one XP bar.** XP is run-wide now
      (`RunState.xp`, `squadLevel`): a battle fills the squad's single bar and the
      whole party **and box** level with it, learning moves and evolving as they
      go, and a catch joins at that level (its stats, moveset and any allowed
      evolution are rebuilt from the species there, whatever level the wild was).
      The party panel leads with the shared `Lv` and a general XP bar and drops
      the per-row level and HP numbers (portrait, name and bar only), with the
      Pokevial centred under the bar; the battle's player panel draws the same
      general bar. The per-map cap still clamps gain (D9/D29, `SAVE_VERSION` 13,
      `SAVE_MIGRATIONS[12]`).
- [x] **HUD panel quick keys, and the panel button prints its key.** `P` opens
      PARTY, `I` the bag, `M` the map and `O` the PC box (the settings key moves to
      `Tab`); a panel's corner button now sits flush in its top-left and, on a
      keyboard screen, grows into a small rectangle that prints the key under the
      icon (a touch screen shows only the icon). The four actions join the keybind
      map (`SAVE_VERSION` 12, `SAVE_MIGRATIONS[11]`), so they are rebindable and
      listed in the settings screen (`src/data/keybinds.ts`, `RouteScene`).
- [x] **The party panel drops its `PARTY` title, and its HP bar is smaller** (0.6
      of the FRLG bar instead of 0.75), so the row reads cleaner (`RouteScene`).
- [x] **Every route is at least 30x30, and the entry and boss rooms are always
      exactly 30x30.** `MAP_MIN_ROOM_SIZE` (`src/data/maps.ts`) floors every map's
      size range at 30 — the maxima keep their progression, so maps 1–3 become
      30x30 and later maps stay a range — and `planMap` pins the floor's two quiet
      leaves, the **entry room** and the **boss room**, to that size on every map
      (`docs/maps-spec.md` §1/§6, `docs/routes-spec.md` §2).
- [x] **The touch controls live only on the route.** The on-screen pad and A / B
      are gone from the main menu, the starter pick, the settings screen and the
      run-over screen (the battle never had them), so a phone only shows them while
      walking a route. The pad's arms are also slimmer, longer and drawn without
      their chevrons (`src/ui/touchLayout.ts`, `src/ui/touchControls.ts`).
- [x] **The route HUD is always on screen** — the `I` toggle (and its keybind row)
      is gone — and a fresh save opens **only PARTY**, every other panel collapsed
      to its icon (`defaultHudLayout`, `RouteScene`). With the HUD always up,
      interacting (`E`) and hold-to-reset (`R`) are no longer blocked by it.
- [x] **The starter pick adapts to a phone.** On a narrow or portrait stage the
      three candidates stack as full-width rows (portrait left, name and type
      badges beside it), the whole card taps to pick, the level line is gone and
      the selected Pokémon's portrait bobs gently. Types draw as the FRLG **badge
      icons** packed by `scripts/frlg/build-type-icons.mjs` into
      `src/assets/frlg/type-icons.png` (`src/data/typeIcons.ts`); the FRLG sheet
      predates Fairy, so a Fairy type falls back to its name. `docs/design-spec.md`
      §3, `docs/art-direction.md`.
- [x] **Battle battlers draw 25% smaller on the phone layout** (`COMPACT_MON_SCALE`
      in `BattleScene`), so they sit clear of the stacked panels; the desktop
      square is unchanged. `docs/design-spec.md` §4.

- [x] **A run starts with ten Poké Balls.** `STARTING_BAG` (`src/data/run.ts`) hands
      a fresh run a stack of ten, so the first catch never waits on the route
      economy; every other item is still earned along the way.
- [x] **One catch per route, tied to the first wild battle.** A room's capture is
      spent by its **first wild battle** whatever the outcome — catching the
      Pokémon, defeating it or running away all close the room's window — so only
      the first wild Pokémon that appears can ever be caught there. Once spent, the
      **minimap marks the room** with a Poké Ball and the BALL command is disabled
      for later encounters (`useCapture` in `RouteScene.startBattle`,
      `buildMapView`'s `captureSpent`).
- [x] **A caught Pokémon remembers where it was found.** Each catch stores its
      **biome and route** (`RunPokemon.caughtAt`, `CatchLocation`), shown as a
      `CAUGHT  <biome> · Map <n> · Route <n>` line in the STATS tab
      (`memberDetail`/`MemberDetail.caughtLabel`).
- [x] **Single-door entry and boss, quiet rooms, PC lock and the full-party
      capture screen.** The map's **entry room** is now a **single-door leaf** like
      the boss (its only opening is the one link into the floor; the outward entry
      edge is not carved), so a floor needs at least **six** rooms — the two leaves
      plus a four-room core closed into a cycle (`buildFloor`, `src/data/maps.ts`).
      The entry room and the boss room are **quiet**: no tall grass, no ledges, no
      ground items and no trainers (`RouteRequest.quiet`, `sketchRoute`).
      The HUD's **PC (BOX) window** is always viewable but its swaps are **locked**
      except on the **first visit to a floor's entry room** and for the **Pokémon
      caught on the current floor**; a new floor resets both (`pcFullyEditable` /
      `pcMemberEditable`, `RunState.entryDeparted` / `pcUnlocked`, `SAVE_VERSION`
      11). A catch that leaves the party **full** opens a **capture screen**: the
      caught Pokémon's stats beside the party, to **swap it for a member** (the
      replaced one goes to the PC) or **send it to the PC** (`resolveBattle`
      `placeCapture`, `RouteScene.openCapturePrompt`). `docs/maps-spec.md` §2/§3/§6,
      `docs/routes-spec.md` §3/§6.
- [x] **Mega Evolution in battle** (`D34`, Phase 9 step 9). A Pokémon holding its
      **Mega Stone** can Mega Evolve **once per battle**: the command menu grows a
      **MEGA** control that arms the evolution, and the next FIGHT spends it while
      still attacking that turn. The forme is applied **before any move**, so the
      turn reads the Mega's Speed, type and ability (an on-switch-in ability such
      as Drought fires then), and the engine swaps stats, types and ability while
      keeping the item, moves and HP. The AI spends its stone on its first fight
      command. `src/engine/battle/mega.ts` holds `canMegaEvolve`/`megaEvolve` and
      `FightCommand` carries a `mega` flag; `snapshotFighter` returns to the base
      species after the battle. The 34 Mega formes of playable Gen 9 species are
      generated into `src/data/dex/megas.json` (their own file, never spawned) and
      `src/data/items.ts` builds one unsold stone per forme. Bosses, mini-bosses
      and the `ace` archetype carry a stone (`carriesMega`/`RosterOptions.allowMega`
      in `src/engine/run/roster.ts`); the ace pools gained a few Mega-capable
      species so it triggers. Fixed-seed tests in `mega.test.ts`, `megas.test.ts`
      and `roster.test.ts`; `docs/battle-spec.md` §9 updated.
- [x] **The boss room is a quiet dead-end.** The boss is hung off the floor's
      farthest regular room as an extra **dead-end leaf**, so it has a single door
      while the floor keeps its cycles (maps now roll at least five rooms). It
      carries no tall grass and no regular trainers — just the boss. Its **portal**
      is carved from the start on a free wall and stays **sealed** until the boss
      falls, so the room looks identical before and after it opens.
      `docs/maps-spec.md` §2/§6.
- [x] **Maps start in the centre.** The entry room has no outward door: the run
      spawns the player at the **centre** of the map's first room (a fresh run or a
      portal step), and its only openings are its links, so there is no door that
      leads back off the map. The route builder carves a lane from the centre to the
      carved network so the spawn is always floor and connected; a room is carved
      the same whichever way it is approached. `docs/maps-spec.md` §2/§3.
- [x] **Trainers stay beaten.** A room's carved geometry and its spawn no longer
      depend on the door the player arrived through, so entering the entry room
      from outside and from a neighbour builds the **same** room — same openings,
      same trainers, same items — and its trainer/item ids stay stable (a beaten
      trainer cannot reappear). Openings are also a couple of tiles wide now: any
      cell of the gap leads out, but only when the step is taken **toward** the
      border (walking along the gap never bounces the player back) —
      `src/engine/routes/doors.ts`.
- [x] **A floor's marks persist while you explore it.** Beaten trainers, taken
      ground items and spent captures no longer reset on every room change;
      `RunState` keeps them for the whole floor and only `advanceMap` clears them,
      so walking back into a room cannot respawn its content. The capture stays
      **one per room** (`capturedRooms`, save v9 with a v8→v9 migration), so a room
      grants a single catch while a different room can still catch.
      `docs/maps-spec.md` §2/§7.
- [x] **Room transitions are coherent** (`D30`). Leaving a room by a door now
      spawns the player at the **opposite** door of the neighbour — leave East,
      arrive West — instead of the door the plan derived from the entry by BFS, so
      a room reads the same from every approach and you can always walk straight
      back. The door the run arrived through lives in `RunState.arrivalEdge` (with
      a v7→v8 save migration that recovers the plan-derived edge), and the room's
      geometry, trainers and loot seed off a **stable per-room index**
      (`routeIndexForRoom`), not the run's moving counter, so walking back into a
      room lays out the **same** room instead of rerolling it. `docs/maps-spec.md`
      §2/§9 updated.
- [x] **The floor minimap** (`D32`). The `I` overlay's route header becomes the
      **floor minimap**: the map name sits over a Binding of Isaac-style grid of
      the rooms **discovered** so far, each drawn from the room's own width/height
      with its openings on the matching walls, the current room highlighted, the
      boss marked and the open portal flagged. A link is drawn only once **both** its
      ends are known, and a room stays hidden until it is entered, so the floor
      reveals itself as the run advances. The layout is pure and Phaser-free in
      `src/ui/mapView.ts` (`buildMapView`, `MAP_VIEW_GAP`) with its own tests;
      `RouteScene` only scales and paints it on a `Graphics`, redrawn on every room
      change. Special rooms already carry their own marker (shop, mini-boss,
      mega-stone), ready for Phase 9 step 11. `docs/maps-spec.md` §8,
      `docs/design-spec.md` §3 updated.
- [x] **Randomized learnsets and movesets** (`D17`). Every Pokémon now learns a
      per-run random move set instead of the canon's: `src/engine/battle/
      randomLearnset.ts` rolls a learnset from the run seed keyed by species id,
      keeping the canon's shape (same level-up levels, same number of TM/tutor/egg
      slots) but a random move per slot. Damage moves are ordered **least power to
      most**; the **first level-up move is always damaging**; each learnset keeps
      at least **60% damage / 20% status** so no mon ends up all-status; **OHKO
      moves are never rolled** and **fixed-damage moves only appear from level
      20**. The moveset wild, trainer and player Pokémon enter battle with is the
      last four moves the randomized learnset knows (`defaultMoveset`), and
      level-ups learn from it (`addExperience` now carries the run seed), so the
      whole run uses one consistent reroll. Wild/trainer builds
      (`BattleScene`), the starter (`StarterScene`), the debug drop (`RouteScene`)
      and `resolveBattle` all thread the run seed through; the `Move` type gained
      its generated `ohko`/`damage` markers. `docs/battle-spec.md` §7.1/§8 added;
      fixed-seed regression tests in `randomLearnset.test.ts`.
- [x] **Each HUD panel collapses to its own icon**, and the whole layout is a
      **global preference**. Every panel of the `I` overlay — the route header,
      PARTY, the bag, the PC BOX and the member detail window — now shows a small
      line-art glyph at its top-left (route flag, Poke Ball, bag, PC box,
      magnifier; procedural textures from `BootScene`). Clicking the icon
      **collapses** the panel to just that icon; clicking again **expands** it and
      pushes the others (a collapsed icon included) clear, so a panel beside a
      collapsed one always opens. The icon doubles as a **drag handle**: a press
      that moves past the slop repositions the panel, a press released without
      moving is the collapse/expand click. Panel drags now also **let go when the
      pointer leaves the canvas** (or its button is released off-screen), via the
      input's `gameout`/`pointerupoutside` plus a "button no longer down" check, so
      a held panel never keeps following a pointer that is gone. The offsets and
      collapsed flags are saved with the settings as `hudLayout`
      (`src/data/hudLayout.ts`, validated per field, no version bump since a
      missing field defaults) and re-applied when the route rebuilds, so the
      layout survives a reload and carries into the next run (D22).
      `docs/design-spec.md` §3/§7 updated.
- [x] **The route HUD panels can be moved** (`I`). Each panel — the route header,
      PARTY, the bag, the PC BOX and the member detail window — is its own
      container and is grabbed by its **frame** (the interior stays live, so rows,
      tabs and cells still click). A dragged panel **pushes** the others out of
      its way so two panels never overlap, and a drag that would need a panel to
      leave the screen (the push chain hits the edge) stops instead of covering
      one. The drag runs in small steps, each one rolled back if it cannot be
      settled, and the hit tests read the pointer in the panel's own coordinates,
      so a moved panel's content keeps working. The detail window docks beside the
      PC box the first time it opens (`hudPanels`/`updatePanelDrag` in
      `RouteScene`). `docs/design-spec.md` §3 updated.
- [x] **The main menu** is the landing screen now (`src/scenes/MainMenuScene.ts`):
      **New run**, **Continue** and **Options**. The boot scene goes straight to
      it instead of resuming a run or jumping to the starter pick. **Continue**
      appears only when the save holds a run with a living party and shows the
      route it is on; it resumes the run where it left off. **New run** opens the
      starter pick with a fresh seed, and the old run is replaced only once the
      new one is written to the save, so picking it by mistake or cancelling at
      the starter pick (new **cancel** action, bound to `Q`) returns to the menu
      with the run in progress intact. **Options** opens the settings screen
      paused-on-top, which now also lists the main menu as an opener and refreshes
      the menu's key hints on close. The menu takes the mouse (hover highlights a
      row, a click picks it) beside the keyboard and the touch pad.
      `docs/design-spec.md` §2/§7 updated.
- [x] **Route trainers are back**, the classic way. The generator's population
      pass (`src/engine/routes/sketch.ts` `placeTrainers`) now places them: one
      guards the main lane and one more stands by every filled pocket's item, plus
      the map-size tier's `trainerBonus`, so the count follows the route's size.
      Each trainer stands on floor **hugging a solid wall** (never a walkable
      tree tip), looks down a passable lane with a `sight` of 5 (a straight
      cardinal line that stops at a wall, a ledge, water or another trainer, so it
      never stares across an obstacle it could not chase over), and some carry a
      `turns` cycle so their facing (and line) rotates on a timer, like a
      "spinning" trainer — including catching a player who stands still in the
      beam. Placement is safe: a candidate is kept only while the entry still
      reaches **every** tile it could before (ledges and water count as
      impassable), so a trainer never plugs a lane, a branch or a pocket; no two
      trainers stand in neighbouring tiles; and no trainer spawns already watching
      — or able to spin and watch — the tile the player arrives on. A main-lane
      trainer looks down the lane, but an optional-path guard looks **across** it,
      wall to wall (a vertical path is watched horizontally and vice versa), so
      the sight closes the branch. New pure module
      `src/engine/routes/trainers.ts` (`sightLine`, `seesPlayer`, `trainerAt`,
      `trainerBlockers`) plus `Facing`/`RouteTrainer` on `RouteMap`;
      `validateRoute` now also proves a **trainer-free** entry→exit path, so no
      placement forces a battle. `RouteScene` draws them off the FRLG overworld
      atlas (nine poses per class: the resting pose of its facing, the right side
      flipped, and a two-frame walk cycle it plays while chasing), blocks their
      tile, walks a spotter toward the player and opens the menu battle when they
      see or are talked to, and hides a beaten one. The player and the trainers
      sort by their foot row, so a character north of a trainer passes behind it.
      `D11`, `docs/routes-spec.md` §2/§5, `docs/route-generator.md` §3.4,
      `docs/design-spec.md` §5 updated.
- [x] **Ground items are a gamble and sit deep.** An optional path now holds an
      item only with the band's `itemChance` probability (`ROUTE_LOOT`, 75% for
      now) instead of always, and when it does the pocket is the **deepest** tile
      of the branch — the item sits as far down the path as it can (the wall-hug
      is only a tie-break). A walkable tree tip no longer cuts a trainer's line of
      sight, so a player walking along a row of tips is still seen.
- [x] **Battle sprites are sized by the Pokémon's real height**, so a titan reads
      big and a Scatterbug tiny. The Añil art compresses the true 0.1m–20m range
      (Regigigas is drawn barely taller than Scatterbug), so scaling by the sheet
      left legendaries small. `species.json` now carries a canonical `heightm`
      (PokeAPI, `scripts/fetch-heights.mjs` → `scripts/data/heights.json`, merged
      by `build-dex.mjs`) and `src/data/spriteSize.ts` turns it into a drawn height
      through a sqrt curve. `src/render/spriteBounds.ts` measures each sheet's
      drawn box to convert that height into a zoom and anchors the sprite's feet
      on the platform. The base and max sizes grew, the platform grew and now
      scales with its mon, and each layout caps the size so nothing clips or
      overlaps. `D27`, `docs/data-spec.md` updated.
- [x] The party/PC HUD can now **swap** a member across the two panels by
      **dragging one onto a member of the other**: the two trade places, so a
      **boxed Pokémon can replace a party member even when the party is full**
      (the member it replaces takes the box slot). `engine/run/state.ts` gained
      `swapPartyBox` (both indices kept, refused only on an empty slot) and
      `src/ui/partyScreen.ts` the pure `swapAcross` reducer the route's pointer
      drop calls; a drop on empty space still just deposits/withdraws.
      `docs/design-spec.md` §3 updated.
- [x] The **portraits** (party, route HUD, starter cards, release beat) are
      Pokémon Añil's icons now, packed into `public/anil/portraits.png` and
      `portraits-shiny.png` (one 64x64 cell per dex entry, 32 columns, under half
      a megabyte each) and read through `src/data/portraits.ts`. A member's
      **shiny** flag picks the shiny atlas, so a caught shiny keeps its alternate
      palette everywhere. The PMDCollab `src/assets/portraits.png` is gone.
- [x] **Añil formes** resolve to their own art: the packer maps a dex forme to
      `<SPECIES>_<n>.png` when the Añil set lists `1..n`, with an explicit table
      for the ones that do not line up (the Alcremie cream/sweet grid, Arceus by
      type, the cap Pikachu, Minior's cores, Ogerpon's masks, Kyurem's swap,
      Greninja, Basculin, Rockruff and Vivillon's official Spanish pattern
      names). An unmapped forme falls back to its base species. `D27`,
      `docs/art-direction.md` updated.
- [x] The **battle sprites are Pokémon Añil's** now (front, back and icon), with
      **animation**, **shiny** and **female** variants. The art comes from the
      RPG Maker XP / Pokémon Essentials fangame (EricLostie), copied verbatim by
      `scripts/anil/build-pokemon-sprites.mjs` into `public/anil/` (9,581 sheets,
      ~169 MB) with a frame manifest at `src/data/anil/pokemon-sprites.json`. The
      sheets are horizontal filmstrips — frame = the sheet's own height, count =
      `width / height`, exactly how Añil's own plugin reads them — so the battle
      loads only the sheets it draws, plays one looping idle animation each and
      drops them on shutdown. A **shiny** flag landed on the fighter (persisted
      in the save) and rolls on its own encounter stream at 1 in 4096, so a
      caught shiny stays shiny and no fixed seed shifted. The old FRLG battle
      sheets (`src/assets/frlg/pokemon-*.png` and
      `scripts/frlg/build-pokemon-sprites.mjs`) are gone. `D27`,
      `docs/art-direction.md` updated.
- [x] The battle **SWITCH** menu now shows a wide **detail window** above the avatar
      grid for the member under the cursor — no tabs: the five battle stats, HP,
      nature, ability and held item in a left column, and the member's four moves
      as a **2x2 grid** on the right, each tinted by its type with its PP. Every
      switch cell gained a small **HP bar** (the numbers live in the detail
      window), and the shared model that resolves a member's panel data
      (`src/ui/partyDetail.ts`) now serves a live battle fighter as well as a run
      member. `docs/design-spec.md` §4 updated.
- [x] The battle menus are **grids** now. **FIGHT / BAG / SWITCH / RUN** is a 2x2
      grid like the **moves** menu, so all four moves show at once with no
      scrolling: each move cell is tinted by the move's **type** and shows its
      name, the **official category badge** (physical / special / status, packed
      from `scripts/frlg/build-category-icons.mjs`) and its PP. A **popup** above
      the menu lists the move's type and its **description** for the move under the
      cursor and lifts the Pokémon's data panel clear of it. **SWITCH** shows the
      party as a grid of **avatar** cells (face, name, level, HP), and every
      submenu puts the ◀ **back** control centred on its left edge. The arrow keys
      move around the grids; the mouse still hovers and clicks.
      `docs/design-spec.md` §4 updated.
- [x] The route HUD's party/PC members open a **detail panel** on click instead
      of being grabbed: a new window beside the box with **STATS** (HP bar, the
      five battle stats, nature, ability and the held item) and **MOVES** tabs,
      where the moves can be **dragged to reorder** them (that order is the
      battle menu's). Dragging a member still reorders it or moves it between the
      party and the box; a drag is told from a click by the pointer travelling
      past a small slop. `docs/design-spec.md` §3 updated.
- [x] Battle polish: the command menu takes the **mouse** — hovering a row moves
      the ▶ cursor, a click picks it, and a click advances the text feed — the
      cursor sprite's white matte is now transparent, and the top-right key-hint
      line is gone. The bag opens as **pockets** like the route HUD: **CONSUM**
      everywhere and, while a wild can still be caught, **BALL** (trainer battles
      offer only consumables). **RUN** in a wild battle escapes at once, with no
      yes/no prompt. The default keys are now **E** confirm / **Q** cancel
      (`interact` shares `E`, so the same press both confirms a menu and picks up
      the item in front of the player): `SAVE_VERSION` 5 with
      `SAVE_MIGRATIONS[4]` resetting a v4 document's keys. `docs/design-spec.md`
      §4 and `docs/tech-decisions.md` (`D23`) updated.
- [x] Battle feed fix: the typewriter carried no time across frames, so at 60 Hz
      (a frame shorter than one character) a message never revealed and the battle
      sat on an empty box until the player pressed. The leftover milliseconds are
      now kept frame to frame, so text types itself out and advances on its own at
      a slower read pace (no confirm needed). A ◀ back control in the moves /
      switch / bag menus backs out with a click, and a **run** puts you straight
      back on the route instead of waiting for Z.
- [x] The battle screen adapts to a **portrait phone**: on a narrow canvas the
      panels span the width, the player's Pokémon sits above its own panel (no
      longer behind it) and the menu takes the bottom box, hiding the message
      window while it is open. `docs/design-spec.md` §4 updated.
- [x] **Hidden ground items are walkable.** Only a visible Poke Ball blocks its
      tile now; a hidden sparkle can be walked over and taken underfoot, so a
      player never gets stuck on something they cannot see.
- [x] Ground items spawn **against walls**: the loot spot is the tile of a
      branch's lane with the most wall neighbours (a corner where there is one),
      falling back to the wider branch network when the lane itself has none.
      `docs/routes-spec.md` updated.
- [x] A new **Always run** setting (on by default) walks the route at running
      speed without holding the run key; it lives with the other preferences and
      is added to a save without a version bump since a missing field defaults.
      `docs/design-spec.md` §7 updated.
- [x] The player's **battle backs are no longer shiny.** The expansion exports
      its `back.png` sheets with the shiny palette baked in, so the packed atlas
      was recoloured: `build-pokemon-sprites.mjs` now remaps each back sprite by
      palette index through the folder's `normal.pal`, and the committed
      `pokemon-back.png` was rebuilt from the source with normal colours.
- [x] The battle closes itself after a win or a loss too (not just a run), and
      the command menu and the message window now share the whole bottom box on
      desktop as on phone — the message hides while a choice is open and both are
      wider. `docs/design-spec.md` §4 updated.
- [x] The battle stage is a **square** on a wide screen: centred and capped at
      900 px a side, with the paused route hidden behind it so the letterbox stays
      clean. A tall screen keeps the full stacked phone layout.

- [x] Routes hold **ground items** again, one at the far end of each optional path
      (a `pocket`). The number follows the route's **size** (a bigger map carves
      more branches, `MAP_SIZE_TIERS`); the contents come from the level band's
      weighted pool (`ROUTE_LOOT` in the restored `src/data/loot.ts`) drawn on the
      `populate` stream, with a per-band `hiddenChance`. A hidden item shows a
      faint, shimmering sparkle instead of a Poke Ball. `RouteMap.items` carries
      stable ids (`item-<routeIndex>-<n>`); a pocket a hazard sealed is skipped and
      no pocket may hold tall grass or a ledge, so an item never spawns on grass.
      An item **blocks its tile** while it is there and is taken with the new
      **interact** key (`E`) facing it, adding it to the bag and marking it in
      `RunState.pickedItems` (reset on advance, so a reload does not respawn it).
      The visible sprite is the FRLG field Poke Ball (`frlg/ground-item.png`,
      cropped by `scripts/frlg/build-field-items.mjs` from the standalone ball on
      the Hoeloo compilation). `docs/routes-spec.md`, `docs/route-generator.md`,
      `docs/art-direction.md`, `src/assets/README.md` updated.
- [x] Keybinds: **P is gone** (the HUD key `I` already opens the same party/PC
      overlay) and two actions are new: **interact** (`E`, ground items) and
      **reset** (`R`, below). The dev debug menu moved from `E` to `F` so it no
      longer clashes with interact.
- [x] **Hold-to-reset**: holding the reset key (`R`) fades the whole screen out
      under a small ring that fills; releasing early fades it back in, and filling
      it clears the save and starts a fresh run with a new seed
      (`RouteScene.updateReset`).
- [x] The starter screen picks with the **mouse**: a card is a click target, so
      hovering highlights it and clicking chooses that starter (`StarterScene`),
      beside the existing keyboard selection.

- [x] **Equip held items by dragging**: the route HUD's bag lets you pick up an
      `equipment` stack and drop it on a party row or a PC box cell to give the
      member that item; whatever it already held returns to the bag, so an equip
      is a swap, never a loss (`equipHeldItem` / `unequipHeldItem` in
      `src/engine/run/state.ts`, unit-tested). The party avatars are enlarged and
      a held item shows as a badge on an avatar's lower-right corner, in both the
      party and the box. Grabbing **that badge** takes the item off the member
      instead of grabbing the Pokémon, so it can be dragged onto another member to
      pass it along or onto the bag to unequip it; a drop anywhere else puts it
      back. A stack picked up from the bag leaves the list while it is in hand, and
      a badge is taken off only on the drop, so a carried item never shows in the
      bag mid-drag. `docs/design-spec.md` §3 updated.
- [x] Generation **scales by map-size ranges** via the new `src/data/mapSize.ts`
      (`MAP_SIZE_TIERS`: `small` / `medium` / `large`, keyed by the map area in
      tiles). `grassPatches` and `ledges` in `src/data/biomes.ts` are now **base**
      counts the terrain pass multiplies (terrain ×1 / ×2 / ×3), and a shape's
      `branchCount` gains a bonus (`+0` / `+1` / `+2`) so a bigger route carves
      more **optional paths**. The default 20x20 route stays `small`, so its output
      is unchanged. `docs/routes-spec.md` §2, `docs/route-generator.md` and
      `src/data/README.md` updated.
- [x] Branches can grow **off branches, not only off the spine**: `carveBranches`
      now roots each new lane on the **network** (the spine plus every lane already
      carved) and measures free space to that growing network, so a later branch
      can attach to an earlier one. The per-cell distance is a cardinal
      `distanceField` (same values as the old Manhattan scan, computed once per
      branch). `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] The **spine** keeps the whole-object border margin too: its jittered
      waypoints and the hub are pulled in by `pathWidth - 1`, the lane width
      `carveSquare` grows down/right from the anchor, so a lane never reaches
      within `wallMargin` of the border and leaves a one-row stump (the seed
      `1yv0j1t#r4` bottom fence no longer shows a bitten tree). `carveBranches`
      already pulled its last cell in by `branchWidth - 1`; this is the spine's
      counterpart. `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] Tall grass can **share a tree tip**: a walkable tip cardinally adjacent to a
      `TALL_GRASS` cell is a **grass tip** (`grassTipKeys` in
      `src/engine/tileFrames.ts`), so a patch packed against a tree spills onto its
      crown. `RouteScene` draws the grass frame **under** the crown (the crown
      stays the frame over the player) and rolls a wild encounter on stepping
      there; the procedural tuft tilesets get the overlay on the tip too.
      `docs/tileset-spec.md` §3b and `docs/routes-spec.md` updated.
- [x] Weighted **floor variants**: a `variants` entry may now be
      `{ frame, weight }` instead of a bare frame, so a map value can mix several
      tiles and make some rarer (`VariantFrames` in `src/engine/tileset.ts`,
      `variantFrame` in `src/engine/tileFrames.ts`). The positional hash is mixed
      hard so a rare tile scatters instead of lining up into a diagonal run.
- [x] Forest uses its **own darker ground**: the FRLG forest floor is now the
      dark `0,34` family (`rgb(88,160,128)`, the tone the tree bank is drawn on)
      instead of the outdoor `6,1` (`rgb(112,200,160)`), so the tree border blends
      into the field with no lighter halo. `FRLG_FOREST_TILESET` mixes the forest
      ground tiles with weights (`0,34` base, `2,34`/`3,34`/`5,34` variety, the
      flowered `0,38` rare) and the tall grass is the dark-palette tuft `2,33`,
      stamped whole. The ledge lip has no dark variant, so it is re-grounded onto
      the field's floor (`overFill` in `scripts/frlg/build-tilesets.mjs`).
      `docs/tileset-spec.md` and the forest palette updated.
- [x] Tall grass stamps the **real blade tuft**: the FRLG frames use source `7,0` of
      `sprite-sources/frlg/tileset-2.png` whole, with its own ground (frame 5 was
      previously the plain `6,0` floor variant). `docs/tileset-spec.md` §2/§6
      updated.
- [x] Biome is **forest only**: `BIOME_ORDER = ['forest']`, so a route always uses
      the forest tileset and encounters whatever its index (the outdoor/cave
      entries stay defined but dormant). The route **shape** is now a first-class
      algorithm concept: `docs/route-generator.md` defines `straight` (2 opposite
      openings), `bend` (L, 2 adjacent) and `cross` (4, opposite pairs), each with
      `openings` (edge + entry/exit) and the `links` the spine joins, and `RouteMap`
      is specced as `entry` + `exits`. Phase 2 step 1 has landed: `layout.ts`
      exports `SHAPES`, `RouteMap` carries `entry`/`exits` (the validator requires
      every exit), and the debug panel's Route tab selects a **Shape**.
- [x] Phase 2 step 2: per-pass RNG streams. `src/engine/routes/streams.ts` derives
      one independent `Rng` per build pass (`layout`/`terrain`/`populate`) from
      `(seed, routeIndex, attempt)`; `sketchRoute` builds fresh streams per reroll
      instead of continuing one `Rng`, so a change in one pass cannot shift the
      path another already placed. `streams.test.ts` pins determinism, the attempt
      key and pass independence; the frozen route signature is re-frozen. The
      organic shape carve (step 3) remains.
- [x] Phase 2 step 3: shape carve. `sketchRoute` now places **every** opening of
      the shape on its edge and carves the guaranteed **spine** through each
      `links` pair: jittered waypoints joined by cardinal A* corridors that follow
      a deterministic per-cell cost field (`findPath` gained `PathOptions`:
      `cost` + cardinal-only), at the shape's path width. `RouteMap` exposes the
      `spine`; a `cross` yields three exits and a `bend` an L. Hazards stay off
      the spine (steps 5-7). Tests cover every opening's edge, spine connectivity
      (entry → every exit), border safety, and the new `findPath` modes.
- [x] Phase 2 step 4: branches and pockets. Shapes carry `branchCount` /
      `branchMin` / `branchMax`; `carveBranches` draws each secondary lane off the
      spine (a cardinal corridor that never runs along it) from a tile far enough
      away, and `RouteMap` exposes `branches` plus `pockets` — the branch dead
      ends (exactly one carved neighbour). Branches are optional: the spine alone
      still solves the route. Tests: branches are carved, every pocket is a
      structural dead end and reachable, and each pocket is a terminal.
- [x] Route `EXIT` no longer draws the common-sheet **staircase** (a dungeon
      leftover that read oddly on an outdoor field): no tileset maps `EXIT` in
      `frames`/`commonFrames` any more, so the tile renders as plain ground. The
      `EXIT` value and the end-of-route logic are unchanged; a real exit
      marker/opening is deferred to Phase 8 (`TODO.md`, "Route exit art").
- [x] Layout trimmed to a single style: `LayoutStyle` is now only `forest`
      (FireRed/LeafGreen, entered S / left N) and every biome uses it; `route`
      (Route 1) and `cavern` (Mt. Moon) are removed until their interiors return.
      It still carves an open field (`kind: 'open'`), so maps stay plain. The
      debug panel's "Randomize" and its Layout select follow (`forest` only), and
      the `grass`/`water`/`ledges` fields were **removed** from the panel — the
      terrain passes stay dormant and are no longer exposed, which stops the
      panel from silently re-adding them to a route.
- [x] Debug **route regenerate**: the dev panel (`src/dev/debugMenu.ts`) has a
      "Route" section that exposes the generator inputs (`seed`, `routeIndex`,
      `attempt`, `layout`, `width`, `height`) and shows the
      derived biome and band read-only. A blank field is `auto` (live value), a
      "Randomize" button fills every override and `attempt` increments per press,
      so one seed can be re-rolled reproducibly. Wired through `main.ts` to
      `RouteScene.regenerateRoute`, which rebuilds map, tiles, entities and the
      encounter stream and re-places the player with no run state change. Behind
      `IS_DEVELOP`.
- [x] Debug **noclip toggle** and panel polish: the debug menu now has "Battle"
      and "Route" tabs, starts **closed**, and `E` shows or hides it (was `F2`,
      now `DEBUG_MENU_TOGGLE_KEY`). A "Pass through obstacles" checkbox lets the
      route move onto `WALL`/`WATER`/`LEDGE` in bounds so a map can be inspected
      without walking it. Behind `IS_DEVELOP`; reset on scene create and never
      persisted into the run.
- [x] Removed route **trainers** and **ground items** for now: `RouteMap` only
      carries tiles, start and exit, `sketchRoute` no longer takes
      `trainerCount`/`itemCount`/`loot`, and `RouteScene` drops the trainer
      sprites, line-of-sight triggers, item pickup and the hint's trainer count.
      `src/engine/routes/trainers.ts` and `src/data/loot.ts` (`ROUTE_LOOT`) are
      deleted. The archetype tables (`src/data/trainers.ts`) and the roster
      builder (`src/engine/run/roster.ts`) stay, dormant, for when population
      returns.

- [x] Routes are **carved out of the solid forest** again, matching
      `docs/route-generator.md`: the `open` layout no longer clears the interior,
      so `sketchRoute` keeps the grid solid and `carveGuaranteedPath` /
      `carveBranches` carve the shape's lanes through it (`findPath` gained a
      `passable` override). The one-tile tree/rock border stays solid and the
      carved spine, branches and pockets are the walkable lanes. Fixed-seed
      snapshot re-frozen; `docs/routes-spec.md` updated.
- [x] Removed the tree frame drawn **past the map** for now: `RouteScene` no
      longer pads the map or grows a margin, and the camera is bounded to the
      generated map while the generator is the focus. The debug panel's route size
      follows the generator default (`DEBUG_ROUTE_WIDTH`/`DEBUG_ROUTE_HEIGHT`).
- [x] Routes no longer write an `EXIT` tile **and no longer end on an exit**: the
      openings are plain floor and `RouteScene` no longer advances or rests when
      the player reaches one, so a route can be walked and inspected without
      leaving it. The `EXIT` map value and its tileset contract stay for later art.
      Fixed-seed snapshot re-frozen.
- [x] Debug **generator stepper**: the Route tab has `◂` / `Step ▸` / `Live`
      controls that walk the build phases one at a time (`sketchRouteSteps`
      snapshots `walls → access → spine → branches → terrain → final`) and render
      each on the map, so the carver can be inspected phase by phase. Behind
      `IS_DEVELOP`. The temporary default map size is 20x20
      (`ROUTE_WIDTH`/`ROUTE_HEIGHT`).
- [x] Dropped the debug `R` tileset-swap shortcut in `RouteScene` (and its hint
      line); tilesets still swap from the settings screen.
- [x] Route openings moved onto the **map border**: `edgeTile` now returns the
      outer border tile (a gap in the tree ring) instead of one tile inside, and
      the spine treats the openings as its inner endpoints. Border checks and the
      fixed-seed snapshot updated.
- [x] Spine refinement: a multi-link shape (`cross`) now routes **every link
      through a shared central hub**, so the entry reaches every exit by
      construction instead of relying on the jittered lanes crossing. `carveBranches`
      also re-checks its pockets after all branches are carved, so a later lane
      running alongside an earlier dead end no longer leaves a false pocket.
- [x] `carveBranches` refinement: branch lanes never carve the one-tile border,
      and their distance band **scales with the map size** (`0.25`–`0.70` of how
      far the interior reaches from the spine), so a roomy map uses the space for
      longer branches instead of the fixed 4–14.
- [x] Branch lanes are now **at least two tiles wide** (`2..4`, scaled by the free
      space) and open into a small **chamber** at the far end on a roomy map,
      instead of a one-tile cul-de-sac. A branch's far end is the **pocket** (was a
      1-neighbour dead end). Fixed-seed snapshot re-frozen.
- [x] Water is no longer a generator terrain pass: `carveWater` and the
      `waterBodies` knob are gone (biome terrain is `grassPatches` + `ledges`).
      `WATER` stays a map/tileset value for **decoration** later.
- [x] Fixed `carveGrass`: it seeds from the **off-spine** floor and never stamps a
      patch over the **spine** or an opening, so the guaranteed lane stays a clean,
      encounter-free lane (before it only avoided the openings). Test added.
- [x] Phase 2 step 5: terrain passes **on**. The `biome.terrain` counts are live
      again (forest 4 grass patches / 1 ledge line; the other biomes restored
      too), so routes stamp tall grass and ledges on the carved floor off the
      spine and the openings - ledges also keep off the pockets. A ledge line grows
      one tile at a time and **stops rather than strand a branch**: any run that
      would cut the walkable map in two is reverted, and a lane too narrow for a
      full run still keeps a single jumpable tile. `terrain-defaults.test.ts` is
      replaced by `terrain.test.ts` (off spine/openings/pockets, every exit
      reachable, no stranding, counts honoured). `docs/routes-spec.md` and
      `docs/route-generator.md` updated.
- [x] Wall tidy: the wall motif only draws a whole object from a run at least the
      motif's width and a whole number of objects tall, so a lane that grazed the
      forest left a one/two-tile sliver and a bitten column left a stub. `cleanWalls`
      (`src/engine/routes/walls.ts`, renamed from `cleanTrees`) now runs after the
      carve and before the terrain pass and drops both, **only turning WALL into
      FLOOR**, so it can widen a lane but never block one - the entry, every exit and
      the spine keep working and the openings stay reachable. A run that touches the
      one-tile border ring is left alone, so the map stays fenced. Its whole-object
      size is a **`WallFootprint`** (`cols`, `minHeight`) taken from the tileset's
      `wallPattern`, so another biome or wall art passes its own. Optional branches
      also keep a **`TREE_MARGIN` of two tiles** from the border (bounded
      `carveSquare`), so the outer tree mass is not bitten at all; only the spine
      pierces it, at the openings. New `walls.test.ts` (run heights, unit maps, no
      cut-off walls, branch margin, reachability); the frozen route and the
      `sketchRouteSteps` phases (now `... branches → clean → terrain ...`) re-frozen.
      `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] Fixed the debug **generator stepper**: `RouteScene.drawEntities` drew the
      tall-grass overlay from the live map, so tall grass showed in every phase even
      before the terrain pass. It now reads the phase's own map, matching the tiles
      the stepper renders.
- [x] Fixed the wall motif re-anchoring when a lane bit a column: `patternFrame`
      picked the row phase and the pattern column from the **current row's own run**,
      so a lane that crossed a column (a door at `place openings`, a spine or branch
      lane) split it into two shorter trees that re-anchored, and a lane that carved
      the side below the top slid the lower rows one pattern column aside (a tree's
      crown and lower leaves landed on different thirds). The phase and the column are
      now anchored to the column's **first and last wall cell**: a lane that crosses
      the column is a hole in the stack, not a new tree, so the raw carve steps only
      bite and everything settles at `cleanWalls`. `RouteScene` also resolves the
      frames against the route map framed by one ring of wall (`padMap`,
      `FRAME_PAD`), so the border trees read as a stack that continues past the limit
      instead of a tree cut off at the edge; the ring is never drawn. `patternFrame`
      tests added; `docs/tileset-spec.md` updated. The run-based centring of a lone
      narrow wall is unchanged.
- [x] The route **HUD panel** (route header, party and bag) now starts **hidden**
      and is toggled with the new **`hud` action, default `I`** (rebindable next to
      the others in Settings). The hint line spells the bound key.
- [x] `cleanWalls` is now **object-aware**: a lane that bites the side of a tree
      leaves a `cols`-wide band that no longer draws as a whole object, so the tidy
      removes that **whole tree row** and then **un-stacks** the rest of the column
      (whole runs kept, stubs dropped) instead of leaving a cut tree or a bare
      trunk. The tree each cell belongs to is anchored to the raw carve and held
      **fixed** for the whole tidy, so deleting a bitten tree never re-bases - and
      eats into - the whole trees beside it. Only `WALL` becomes `FLOOR` (safe to
      widen a lane, never block one) and the border ring stays. `walls.test.ts`
      gains a side-bite and an un-stack case; the frozen route is re-frozen and
      `docs/routes-spec.md`, `docs/route-generator.md` and `docs/tileset-spec.md`
      are updated.
- [x] Fixed the wall motif **anchoring** that still left cut trees: the scene framed
      the motif against the map padded with a **solid** wall ring (`padMap`), which
      added a wall left of column 0 and pushed every motif band one column aside, so
      an interior mass drew with its trees' columns rotated (a body tile only on one
      side). It now uses **`extendMap`**: the **vertical** rings continue the edge row
      (so a border tree still reads as going on past the limit) and the **side** rings
      stay open, binding the motif to the playable grid. `cleanWalls` anchors its bands
      the same way (and counts off-map as open), so what it cleans is what the scene
      draws. `docs/tileset-spec.md` updated; `extendMap` unit-tested.
- [x] Dev **"Map" tool**: the debug panel (`src/dev/debugMenu.ts`) gains a Map tab
      that describes the route **cell by cell** — the raw tile value, the atlas frame
      it resolves to, and, for the wall motif, the pattern row/column, the connected
      wall **mass** and the whole-object **tree** (band + contiguous stack) each cell
      belongs to — and can **export/import** it as JSON. The summary lists the trees
      whose band is not solid ("bitten"), the exact artifacts a cut tree shows as.
      Backed by the pure, tested `buildFrameMap`/`serializeFrameMap`/
      `parseFrameMapExport` (`src/engine/frameMap.ts`); `patternCell` is factored out
      of `patternFrame` (`src/engine/tileFrames.ts`) so the tool and the renderer
      share one anchor.
- [x] No lane may **bite the border band**: the spine now carves a straight
      `OpeningApproach` of `cols` tiles in from each opening before it may turn, its
      A* cost penalises the outer `cols` band, its waypoints are clamped to it, and
      branches use the same margin (was a fixed two tiles, which still let a lane
      carve the third column). A route now has **zero bitten trees** (checked across
      shapes/index/seeds, border included). `cleanWalls` also drops a border-ring cell
      only when it merely **widens an opening** (a lane already reaches the ring next
      to it), so a dangling fence nub under an entry/exit is removed while a fence in
      the middle of a run never opens. `walls.test.ts` gains the nub and
      no-bitten-tree cases; the frozen route is re-frozen and `docs/routes-spec.md`,
      `docs/route-generator.md` updated.
- [x] No **one-tile lane** is left: `cleanWalls` now anchors its `cols`-wide bands to
      a fixed **global grid** (from the map's left edge) instead of per column, so a
      one-tile lane that fell inside a band is widened to the whole band (before, the
      wall beside it re-anchored to its own edge and the lane stayed one tile, the
      uncleaned bite). The spine is also carved **two tiles wide** (`pathWidth: 2`), so
      a lane is at least two tiles in both axes; the tidy trims a run that reaches a
      border ring from its interior end, so a lane next to the fence is un-stacked
      without opening the map. `walls.test.ts` gains a no-one-tile-lane sweep; the
      `carve` blocked-share floor is 0.35 (lanes are wider); the frozen route is
      re-frozen and docs updated.
- [x] **Walkable tree tips**: a wall cell that draws as the motif's pure top row
      (`rows[0]`, a crown over open ground) is now a **tip**. `treeTipKeys`
      (`src/engine/tileFrames.ts`) finds them on the scene's connected-padded map, so
      a mass that reaches the border (part of the stack above) is not a tip; the route
      scene walks on them (its movement map turns a tip into floor, so the player
      steps under the crown) and draws the crown over the player
      (`TREE_TIP_DEPTH`). `tileFrames.test.ts` covers detached vs border masses;
      `docs/tileset-spec.md` updated.
- [x] The wall motif redraws **per run**: `patternFrame` anchors the row phase to a
      wall cell's own contiguous run, so a run a lane detached from the stack above
      or below draws as a whole tree - its own crown (`rows[0]`, a walkable tip) on
      top and its own base at the foot - instead of a mid-stack slice that showed a
      crown over ground with no tree above and no trunk at its own foot. The pattern
      **column** stays anchored to the column's first wall cell, so a side bite still
      cannot slide a run's columns aside. A mass that reaches the map's top or bottom
      edge is a **window** into the forest continuing past the limit: the motif
      extends it two rows outward before reading the phase (via an explicit
      `patternCell`/`resolveTileFrame` `border` flag the scene and the dev frame map
      pass), so the edge is a mid-stack crown/body and the pattern is never cut into a
      crop there. An interior run is unchanged, so a detached tree still shows its own
      crown and trunk. The scene frames the motif against the map itself (the
      `extendMap`/`padMap` frame ring is gone), so the motif binds to the playable
      grid. `treeTipKeys` never marks a one-tile border-ring cell, and a tip is drawn
      **above** the player (`TREE_TIP_DEPTH` 20 > the player's 10), so the character
      passes behind the crown. `tileFrames.test.ts` covers run re-anchoring and the
      edge window; `walls.test.ts` sweeps generated routes for a tip on every detached
      tree; `map.test.ts` drops the `extendMap` case; `docs/tileset-spec.md` updated.
- [x] An opening keeps a **corner clearance** of the wall motif's footprint
      (`cornerClearance`, `2 * cols`) instead of the old hardcoded 3, so `place
      openings` never bites the tree in a map corner into a partial or one-tile
      piece (the seed `1yv0j1t#r1` bottom-right corner). The frozen regression route
      is re-frozen and a sweep asserts every opening clears each corner;
      `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] A **short border piece** of wall reads as mid-stack, not a lone trunk: an
      opening's approach can leave a one-row stump at the map edge, and with the
      border window it drew the motif's base (`rows[last]`) because its foot fell on
      the visible cell. `patternCell` now extends such a piece (shorter than a whole
      object) at **both** ends before reading the phase, so it draws the crown/body
      a lane would see in the forest past the edge. `tileFrames.test.ts` covers it.
- [x] The lane keeps a **whole-object margin** from the map border: `wallMargin`
      is `max(cols, minHeight)` (not just `cols`), so the tree strip it leaves at
      the border is never shorter than a whole object - it draws its lower body and
      trunk instead of a stump (the seed `1yv0j1t#r1` top row no longer shows
      one-row stumps). The opening is also **aligned to its motif band**, so a
      `pathWidth`-wide approach never spills into the band beside it, and
      `carveBranches` pulls its last lane cell in by `branchWidth - 1` so a branch
      is never clamped into a one-tile stub at the bound. The frozen regression
      route is re-frozen; `docs/routes-spec.md` and `docs/route-generator.md`
      updated.
- [x] Ledges are **whole runs** now: a `LEDGE` line is at least three tiles and
      draws its own **ends** instead of repeating one centre tile. `carveLedges`
      lays the full run at once (three or four tiles) and drops it whole when it
      cannot reach three or would strand a branch, so no two-tile stub is left. A
      run must also touch a wall at one lateral end (the tile outside its left or
      right cap is wall), so a ledge hangs off the terrain instead of floating in
      open floor. The FRLG fields stamp a left cap, centre lip and right cap
      (`FRAME_LEDGE` plus frames 3/4), resolved per cell by `ledgeFrame`/
      `LedgeFrames` (`src/engine/tileFrames.ts`, `src/engine/tileset.ts`); the PMD
      sheets keep their single ground fallback. `docs/tileset-spec.md` and
      `docs/routes-spec.md` updated.
- [x] Tall grass is a **real field tile** now, not a procedural overlay: the FRLG
      atlases stamp the sheet's denser tufted grass at frame `5` (`FRLG_TALL_GRASS`,
      `docs/tileset-spec.md` §2/§6) and `RouteScene` only keeps the tuft overlay for
      the PMD tilesets that still fall back to plain ground. `carveGrass` now packs a
      patch **against the walls**: it stretches across a wall-to-wall corridor when
      that gap is at most `GRASS_SPAN_MAX` (5), so the patch touches a wall at both
      ends; when no corridor fits it falls back to a small block grown from a
      wall-adjacent seed through grassable cells only (never split by the spine), so
      a patch never floats free. `terrain.test.ts` covers the wall anchor and the
      size cap.
- [x] **`npm run lint` checks the formatting, with ESLint shipped dormant.** The
      script is `prettier --check .` over `printWidth: 105` and `endOfLine: "auto"`
      (the latter is what keeps the check green on a Windows checkout with
      `core.autocrlf=true`); `.prettierignore` is a 132-entry ledger naming every
      file Prettier would rewrite — the batch rule forbids reformatting a file a
      batch-mate owns — and each entry was verified non-conforming, so the ledger
      never hides a clean file. `eslint.config.mjs` ships as the dormant flat
      config the ESLint half activates: native `typescript@7.0.2` exposes no JS
      API and every `typescript-eslint` release up to 8.71.2 declares a peer below
      TypeScript 6.1, so no ESLint is installed. `package.json`,
      `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`.
- [x] **A contract README per code folder.** `src/engine/`, `src/scenes/`,
      `src/render/`, `src/ui/` and `src/dev/` gain one, and the root README gains a
      folder map. Each states the folder's invariant, one role line per file and
      its rules — deliberately no exported names, so a refactor cannot rot it.
      `README.md`, `src/{engine,scenes,render,ui,dev}/README.md`.
- [x] **The route validator checks the whole generator checklist (Step 8).**
      `validateRoute` now proves the spine walkable, no item stranded or lying on
      unwalkable terrain, the fence intact but for the openings, and every
      trainer's pose legal (backing wall, off the entry, the exit and the pockets,
      not crowded, no sight line into the entry). An unreachable pocket is
      reported but **not** gated, because `placeItems` is allowed to skip one a
      hazard sealed. Fixed-seed sweep per shape over every route shape.
      `src/engine/routes/validate.ts`.
- [x] **The coverage table classifies every move (the `D16` gap).**
      `scripts/effect-coverage.mjs` now derives `port | no-op | excluded` for all
      835 shipped moves (718 port, 86 no-op, 31 excluded) from the effect
      registry, the ids the turn loop special-cases and the data-driven fields the
      engine reads. The classification is written twice from one authority: the
      new Moves section of `docs/balance/effect-coverage.md` and a
      machine-readable `src/data/moveCoverage.json` behind `moveCoverage()`,
      `isUnportedMove()` and `unportedMoveIds()`. A develop build warns once per
      unported move it meets, which is now the port list.
      `scripts/effect-coverage.mjs`, `src/data/moveCoverage.{json,ts}`,
      `src/dev/warnings.ts`, `src/engine/battle/effects/registry.ts`.
- [x] **A floor's trainers pay that floor's level cap.** Beating 75 % of a floor's
      trainers must award the XP the squad needs to reach `levelCapForMap`:
      `experienceAward` now reads a per-band `LevelBand.trainerXp` multiplier off
      the **defeated** Pokémon's band, so the award keeps its signature and no
      caller changed. A fixed-seed test walks every finite map over three seeds
      and asserts the window `needed ≤ 0.75 · trainers · award ≤ 1.5 · needed`;
      `docs/balance/route-curve.md` is the sheet (bands, caps, trainer counts,
      the rule). `src/data/run.ts`, `src/engine/run/progression.ts`,
      `docs/balance/route-curve.md`.
- [x] **Audio: three music beds and five cues.** The cue vocabulary is one table
      in `src/audio/cues.ts` (pure, no Phaser) and the player in
      `src/audio/audio.ts`; the menu, route and battle beds and the encounter,
      hit, faint, level-up and victory cues are wired into Boot, MainMenu, Route
      and Battle, with the volume setting and the mute seam the accessibility pass
      will use. Assets are committed under `src/assets/audio/*.wav`, built by
      `scripts/frlg/build-audio.mjs` from the gitignored
      `sprite-sources/frlg-audio/`; that rip is not materialised in this clone, so
      the shipped cues are deterministic procedural placeholders that the rip
      replaces without touching a call site (`O4`). `D22` addendum, and the
      `AGENTS.md` Art convention now covers audio. `src/audio/`,
      `src/assets/audio/`, `scripts/frlg/build-audio.mjs`.
- [x] **The route generator and its validator are documented as they ship (Step
      10).** `docs/route-generator.md` stops being a blueprint: §4 transcribes
      `RouteValidation` field by field — the nine fields, `ok` gating the seven
      lists, `unreachablePockets` reported and never gated — §0's pseudocode uses
      the shipped names (`MAX_ATTEMPTS`, `attemptRoute`, `validateRoute`,
      `placeAccess`, `cleanWalls`, `carveBranches`, the six shapes), and the false
      "every pocket has exactly one walkable neighbour" assert is gone.
      `docs/routes-spec.md` step 5 and `AGENTS.md` follow: a route is a **room** of
      a floor, joined to its grid neighbours by their openings, and
      `src/engine/routes/` is its ten modules.
- [x] **Every reachable effect is ported — the coverage table has no `no-op` left
      (`D16`).** Task-06's 86 unported moves and 24 unported abilities are
      resolved: 68 moves and 23 abilities gained handlers (`effects/moves.ts`,
      `effects/abilities.ts`, `effects/weather.ts`, the side conditions in
      `state.ts` and the order/damage/accuracy seams) and the rest are `excluded`
      with the missing mechanic named — `reachable, not ported yet` is gone,
      `unportedMoveIds()` returns empty, and a develop build no longer warns.
      Abilities: 273 port / 38 excluded; moves: 786 port / 49 excluded. The
      **golden battle log is byte-identical** — no ability roll moved — and
      `docs/battle-spec.md` gained the screens, the new volatiles and the
      call-a-move determinism rule. `scripts/effect-coverage.mjs`,
      `src/engine/battle/effects/`, `docs/balance/effect-coverage.md`.
- [x] **Hidden Power's type comes from the holder's IVs again.** `moves.json`
      ships Hidden Power as a single Normal entry; `hiddenPowerType(ivs)` derives
      the 16 typings the cartridge way — the dex's own weights,
      `floor(value * 15 / 63)`, a missing IV counted as 31 — and a new
      `hiddenpower` move effect registers `onModifyMoveType` through
      `src/engine/battle/index.ts`, so the battle, the FIGHT preview and the STATS
      panel all show the same type. Precedence is base → Normalize → Liquid Voice
      → `-ate`. `D37` and `D42` no longer call the type unmodelled, and the shape
      is the seam Task-23's Multi-Attack, Techno Blast and Natural Gift build on.
      `src/engine/battle/moveType.ts`,
      `src/engine/battle/effects/hiddenPower.ts`, `src/ui/partyDetail.ts`.

## Phase 0 — Repo & scaffolding

- [x] `git init`; add `.gitignore` (`node_modules/`, `dist/`, `.vite/`, `*.local`,
      `sprite-sources/`).
- [x] Copy the workspace scaffolding from `slate-line`: `package.json` (Phaser
      `^3.90.0`, Vite `^8.3.0`, TypeScript `^7.0.2`, Vitest `^5.0.1`, scripts
      `dev/build/preview/test/test:watch/typecheck`), `vite.config.ts` (port
      `5175`), strict `tsconfig.json`, `index.html`, `opencode.json`,
      `.env.development`.
- [x] `src/main.ts` registers `BootScene`, `RouteScene` and a `BattleScene`
      placeholder; `npm run build` boots.
- [x] Pure engine foundations, ported from `pkm-mystery-dungeon-like` and adapted
      (`D14`, `D15`): `src/engine/rng.ts` (seeded RNG + text/daily seeds),
      `grid.ts`, `map.ts` (tile values, walkability, corner-cut rule, route-sketch
      parser), `fov.ts` (recursive shadowcasting), `vision.ts` (fog of war),
      `pathfinding.ts` (A* with corner-cut and custom blocking), `tileset.ts` (the
      atlas contract + shared wall/water shape sets), `tileFrames.ts` (the
      neighbour-aware frame resolver). 39 Vitest tests, co-located.
- [x] Swappable tilesets (`D10`): `src/data/tilesets/` with the placeholder and
      woods biome configs, the palette table and the registry
      (`TILESETS`, `tilesetTextureKey`); `RouteScene` renders a hardcoded route
      from the registry and proves the swap with `R`.
- [x] Dex pipeline (`D3`): `scripts/build-dex.mjs` (`npm run data:dex`) generates
      `src/data/dex/*.json` from `@pkmn/dex` (Gen 9): 911 playable species, 685
      moves, 310 abilities, 249 items, 819 learnsets, 25 natures, 19 types.
      `meta.json` records the counts; the package is a devDependency.
- [x] Imported art (`D14`): the 11 atlas/UI sheets and the 652 overworld sprite
      sheets (+ their manifests) from `pkm-mystery-dungeon-like`, plus its art
      pipeline scripts under `scripts/legacy-art/`.
- [x] Specs and decisions: `docs/design-spec.md`, `docs/battle-spec.md`,
      `docs/routes-spec.md`, `docs/tileset-spec.md`, `docs/showdown-reuse.md`,
      `docs/data-spec.md`, `docs/art-direction.md`,
      `docs/tech-decisions.md` (`D1`..`D16` + four open questions), folder
      contracts in `src/data/README.md`, `src/data/dex/README.md` and
      `src/assets/README.md`, and `README.md`.
- [x] Verified the slice: `npm test` (39 passing), `npm run build` clean, and the
      dev server renders the route with fog and the tileset swap.
- [x] Developer gate (`src/dev/env.ts`): reads `ENVIRONMENT` (set to `develop` by
      `.env.development`, undefined in a production build) and exposes
      `IS_DEVELOP` plus the `F2` debug-menu toggle key.
- [x] Debug menu (`src/dev/debugMenu.ts`): a dev-only DOM overlay (real text
      input + the browser's own `datalist` autocomplete, which the canvas cannot
      offer cheaply) that launches a wild battle from any of the 911 playable
      species at any level. `main.ts` imports it behind `IS_DEVELOP` with a
      dynamic import, so a production build never mounts it; the pure
      `matchSpecies` (exact id, exact name, then prefix/substring) and
      `clampLevel` are unit-tested. RouteScene's `B` key still rolls a random
      wild, and `F2` shows or hides the panel. `installDebugMenu` swallows keys
      only while the panel is open and blurs on close, so typing never drives the
      game and the game never goes deaf afterwards. 504 tests pass;
      `npm run build` clean.

## Phase 1 — Dex accessors & data contracts

- [x] `src/data/dex/species.ts`: `Species`/`Stats`/`Evolution` types plus
      `getSpecies(id)`, `speciesByNum(n)` (prefers the base forme) and
      `playableSpecies()` (the 911-row generated set).
- [x] `src/data/dex/moves.ts`: `Move` type and `getMove(id)`, `moveByType(type)`,
      `isDamaging(move)` (any non-`Status` move, so variable-power moves count).
- [x] `src/data/dex/learnsets.ts`: `learnsetOf`, `parseLearnSource`
      (`9L24`/`9M`/`9T`/`9E`, unknown codes → `other`), `levelUpMoves(id, level)`
      and `learnableBy(id, method)`.
- [x] `src/data/dex/types.ts`: `effectiveness(attackType, defenderTypes)` from the
      defensive chart (0/1/2/3 → 1x/2x/0.5x/0x, multiplied across dual types) plus
      `TYPE_NAMES`, the 18 battle types.
- [x] `src/data/dex/natures.ts`: `natureMultiplier(nature, stat)` and
      `statAtLevel(species, level, nature, ivs, evs)` (Gen 3+ stat formula, IVs
      default to 31, EVs to 0).
- [x] `src/data/dex/evolutions.ts`: `evolutionFor(speciesId, level)` and
      `isLevelEvolution(evolution)`.
- [x] `src/data/dex/index.ts` re-exports the six accessor modules.
- [x] Data-integrity tests (`src/data/dex/dex.test.ts`): row counts match
      `meta.json`, every learnset move exists in `moves.json`, every
      `evolutions[].into` exists in `species.json`, every species type is one of
      the 18, every move type is a known type. 65 tests pass.
- [x] Fixed the generator: `build-dex.mjs` now intersects learnsets with the
      retained move set, so a Gen 8 source naming a Gen 9-removed move no longer
      leaves a dangling id (regenerated `learnsets.json`, counts unchanged).

## Phase 2 — Route generation & exploration

- [x] `src/data/run.ts`: six `LEVEL_BANDS` with level ranges and trainer sizes,
      `ROUTES_PER_BAND`, `bandForRoute(routeIndex)`, `levelCapForRoute` and the
      `RUN_CHAIN` cadence (finite length, mini-boss every 4, boss block 8).
- [x] `src/data/encounters.ts`: per-biome, per-band weighted species pools for
      `wood` and `placeholder`; `src/data/biomes.ts` wires the biome → registered
      tileset + terrain counts + encounter tables and cycles them per route.
- [x] `src/data/trainers.ts`: ten archetypes (Youngster, Lass, Bug Catcher,
      Hiker, Camper, Picnicker, Fisher, Psychic, Black Belt, Ace Trainer) with a
      themed species pool and a placeholder marker colour (`spriteKey: null`, O1).
- [x] `src/engine/routes/routeMap.ts`: the `RouteMap` (seed, route index, biome,
      tiles, start, exit, trainers, items) plus `Facing`/`FACING_VECTORS`.
- [x] `src/engine/routes/validate.ts`: cardinal flood-fill and `validateRoute`,
      which requires the start to reach the exit and every trainer.
- [x] `src/engine/routes/trainers.ts`: `sightLine`/`seesPlayer` - a facing, a
      sight range, blocked by walls and by other trainers; re-evaluated per step.
- [x] `src/engine/routes/encounters.ts`: weighted roll + the `RouteEncounters`
      step counter, so the same grass walked in the same order rolls the same.
- [x] `src/engine/routes/sketch.ts`: the full pipeline (frame, rooms + terraces,
      grass/water/ledge terrain, trainer/item population) off one `Rng`, rerolled
      on validation failure; a frozen route signature guards the regression seed.
- [x] Ledges: `resolveMove` jumps south over a `LEDGE` to the tile beyond (and
      only south); other directions stay blocked.
- [x] `RouteScene` now consumes a generated `RouteMap`: procedural tall-grass,
      item and trainer-figure overlays that respect fog, item pickup, grass
      encounter messages, trainer line-of-sight messages and the exit beat. `R`
      still swaps tilesets.
- [x] Tests: band/trainer/dex existence checks for every authored species, route
      validity across seeds and indices, sight-line and ledge-movement rules, and
      a frozen generator signature. 99 tests pass; `npm run build` clean.

## Phase 3 — Battle engine core (pure, headless, tested)

- [x] `src/engine/battle/fighter.ts`: a battle fighter built from species + level
      + nature + IVs/EVs + moveset, with stat computation, stat stages (−6..+6),
      effective stats and Speed (paralysis halved), and HP/boost helpers.
- [x] `src/engine/battle/state.ts`: the battle state (two sides, parties, turn,
      weather/terrain fields, bag, seeded `Rng`) plus the structured event log
      the UI renders, and `finishBattle`.
- [x] `src/engine/battle/order.ts`: priority then effective Speed, ties on the
      battle RNG.
- [x] `src/engine/battle/damage.ts`: Gen 9 formula (STAB, effectiveness, crit,
      85-100% roll, sun/rain and burn modifiers), a deterministic `estimateDamage`
      for the AI and confusion self-hit damage.
- [x] `src/engine/battle/accuracy.ts`: accuracy/evasion stages and the hit roll.
- [x] `src/engine/battle/status.ts`: burn, poison, badly poisoned, paralysis,
      sleep, freeze with type immunities, wake/thaw counters and residuals.
- [x] `src/engine/battle/volatile.ts`: confusion, flinch, Leech Seed, Substitute,
      Taunt, Encore, trapped and perish count.
- [x] `src/engine/battle/turn.ts`: the turn loop (choices → bag/switch/run →
      moves → residuals → faint/replace) driven only by choices; a faint leaves
      `awaitingReplacement` for the owner's next choice.
- [x] `src/engine/battle/commands.ts`: `fight`, `bag`, `switch`, `run` with their
      validation, PP/Encore/Struggle handling and the battle items.
- [x] `src/engine/battle/runAway.ts`: the run odds (classic speed ratio + 30 per
      failed attempt); trainer battles and traps refuse.
- [x] `src/engine/battle/capture.ts`: Gen 9 catch value and four shake checks,
      ball and status bonuses, wild-only; one capture per route stays a run rule.
- [x] `src/engine/battle/ai.ts`: an expected-value trainer AI (damage,
      effectiveness, accuracy, status/boosts) that switches when the active
      Pokémon cannot hurt the foe and reads only legal state.
- [x] `src/data/items.ts`: the battle item catalogue (balls with catch
      multipliers, potions, status cures, X-items).
- [x] Catch rates: `@pkmn/dex` carries none, so `build-dex.mjs` now merges one
      into `species.json` from the committed PokeAPI table
      (`scripts/data/catch-rates.json`, fetched by `fetch-catch-rates.mjs`);
      `catchRateOf` exposes it and a dex test guards every species.
- [x] Golden test: a scripted fixed-seed battle frozen as an inline formatted log
      (the seed of the balance harness). 165 tests pass; `npm run build` clean.

## Phase 4 — Battle effects: abilities, items, weather, terrain

- [x] `src/engine/battle/effects/registry.ts`: declarative effect registry with
      Showdown's hook names (`onSwitchIn`, `onStart`, `onResidual`,
      `onModifyDamage`, `onTryHit`, `onAfterMove`, `onStatus`, `onBoost`),
      `registerEffect`/`getEffect`/`clearEffects` keyed by normalized id, and a
      dispatch that chains the source ability, the defender's ability and the
      move's own handlers (damage is threaded, boolean hooks stop on the first
      block). Wired into the turn loop: switch-in/start in `createBattle` and
      `performSwitch`, damage/status/boost/residual/after-move around the move
      resolution. No effects are registered yet, so the golden battle is byte for
      byte unchanged. 173 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/items.ts`: the held items, registered from the
      catalogue (`kind: 'held'`) — Leftovers (residual 1/16), Sitrus/Oran berries
      (heal below half, single use), Lum Berry (cures a status, single use) and the
      18 type-boost items (1.2x, only when the holder is the move's user). The
      registry now tells each handler which fighter owns the effect (`ctx.owner`),
      so a defender's item never boosts the attacker's move. Fighters gained a
      `heldItem` field. Potions, status cures and X-items already shipped as Bag
      items in Phase 3, so the Bag rejects `held` items. 183 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 1, the 24 abilities that
      show up before the mid routes — Intimidate (switch-in Attack drop, now run
      through the `onBoost` guards), Levitate (Ground immunity), Sturdy (survives
      a full-HP KO at 1 HP), the 30% contact punishes Static / Flame Body / Poison
      Point, the status immunities Immunity / Limber / Water Veil / Insomnia /
      Vital Spirit / Magma Armor, the starter pinch boosts Overgrow / Blaze /
      Torrent / Swarm, Guts (ignoring the burn Attack drop), Technician, the stat
      guards Clear Body / White Smoke / Hyper Cutter / Big Pecks / Keen Eye and
      Shed Skin. `effects/apply.ts` now owns the shared boost/status application
      so moves and abilities go through the same hooks, and `onBoost` learns
      whether a drop is self-inflicted. 199 tests pass; `npm run build` clean.
- [x] `docs/balance/effect-coverage.md` (D16): all 310 abilities and 262 items
      (the dex battle items plus the catalogue-only consumables) marked
      `port | no-op | excluded` — 63 ports, 227 abilities still `no-op`, and the
      exclusions spelled out (unreachable species, doubles-only, cut mechanics,
      items outside the run catalogue). `scripts/effect-coverage.mjs`
      (`npm run docs:coverage`) derives the `port` set from the registry and the
      catalogue so only the exclusions are hand-curated.
- [x] Dev coverage warning (`src/dev/warnings.ts`): behind the `IS_DEVELOP` gate,
      the registry warns once per effect when a battle meets an ability or held
      item with no ported handler, so a gap cannot hide during playtests (D16).
- [x] `src/engine/battle/effects/weather.ts` + `terrain.ts`: weather and terrain
      from moves (Sunny Day/Rain Dance/Sandstorm/Snowscape and the four terrain
      moves) and abilities (Drizzle/Drought/Sand Stream/Snow Warning and the four
      Surges), 5-turn counters with start/clear messages, the residual order
      (status → sandstorm chip → Grassy heal → ability/item residuals → Leech
      Seed → perish → decay/counters), sandstorm type/ability immunity, terrain
      status blocks (Electric sleep, Misty all) with `isGrounded`, and the
      terrain damage modifiers (Electric/Grassy/Psychic ×1.3, Misty Dragon and
      Grassy Earthquake/Bulldoze halved). 215 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 2, 24 more abilities — the
      absorb/redirect group (Water Absorb, Volt Absorb, Sap Sipper, Lightning Rod,
      Storm Drain, Motor Drive, Dry Skin), the defensive multipliers (Thick Fat,
      Heatproof, Ice Scales, Multiscale, Shadow Shield, Filter, Solid Rock, Prism
      Armor), the offensive ones (Tough Claws, Strong Jaw, Iron Fist, Sharpness,
      Huge Power, Pure Power), the switch-in boosts (Intrepid Sword, Dauntless
      Shield) and Moxie. `onModifyDamage` now carries effectiveness so Filter-style
      abilities can read a super-effective hit; the coverage table is at 95 ports
      (56 abilities). 222 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/moves.ts`: the Protect family (Protect, Detect,
      Spiky Shield, Baneful Bunker, Burning Bulwark, Silk Trap) with a protection
      volatile, diminishing consecutive-use odds and the contact punishments
      (damage/status/stat drop), plus Recycle (restores the last held item, which
      `effects/items.ts` now records). Fighters gained `volatiles.protect` /
      `protectStreak` and a `lastItemId`. 229 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 3, 25 more abilities — the
      weather/status Speed group (Chlorophyll, Swift Swim, Sand Rush, Quick Feet),
      the accuracy group (Compound Eyes, Hustle, Sand Veil, Snow Cloak), the
      damage group (Adaptability, Tinted Lens, Sheer Force, Reckless, Punk Rock,
      Water Bubble, Fluffy, Flash Fire), the weather healers (Ice Body, Rain Dish,
      Hydration) and the volatile/status blocks (Leaf Guard, Shield Dust, Own
      Tempo, Inner Focus, Oblivious, Aroma Veil). New hooks `onModifySpe`,
      `onModifyAccuracy`, `onTryVolatile` and `onTrySecondary`, wired in through
      `src/engine/battle/modifiers.ts` (Speed ordering and escape odds now read
      ability modifiers) and the turn loop (hit chance, volatile and secondary
      application; Sheer Force suppresses its secondaries, Shield Dust blocks
      them). Fighters gained `volatiles.flashFire`. The coverage table is at 120
      ports. 247 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 4, 24 more abilities — the
      switch group (Regenerator, Natural Cure, Frisk, Anticipation, Download), the
      priority group (Prankster, Gale Wings), the contact reactions (Rattled,
      Pickpocket, Effect Spore, Rough Skin), the crit/multihit/substitute group
      (Battle Armor, Shell Armor, Anger Point, Skill Link, Infiltrator), the
      stat-react group (Defiant, Competitive, Grass Pelt) and the move/status
      blocks (Damp, Bulletproof, Soundproof, Sweet Veil, Poison Heal). New hooks
      `onSwitchOut`, `onModifyPriority`, `onModifyCrit`, `onTrySubstitute` and
      `onModifyMultihit`; the crit roll moved out of `computeDamage` into the turn
      loop so crit blockers and Anger Point can hook it, and Poison Heal is
      skipped in the residual poison step. 266 tests pass; coverage at 144 ports;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 5, 18 more abilities — the
      contact group (Poison Touch, Gooey, Justified), the defensive multipliers
      (Marvel Scale, Sand Force), the absorbers (Earth Eater, Thermal Exchange),
      the stat shapers (Simple, Contrary, Moody), the reactions (Synchronize,
      Steadfast), Rock Head, Disguise, Overcoat, Run Away and the timing boosts
      (Analytic, Stakeout). New hooks `onModifyBoost`, `onModifyRecoil`,
      `onTryEscape` and `onAfterStatus`; the battle state tracks which sides have
      moved or switched this turn for Analytic/Stakeout, and fighters gained
      `volatiles.disguise`. 282 tests pass; coverage at 162 ports; `npm run build`
      clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 6, 27 more abilities — the
      type absorbers (Well-Baked Body, Wind Rider), the on-hit reactions (Stamina,
      Weak Armor, Steam Engine, Water Compaction), the offensive boosts (Dragon's
      Maw, Transistor, Rocky Payload, Mega Launcher), the crit group (Sniper,
      Super Luck, Merciless), the status-powered boosts (Solar Power, Flare Boost,
      Toxic Boost), the status/move blocks (Good as Gold, Purifying Salt,
      Comatose), No Guard, the Speed group (Slush Rush, Surge Surfer, Tangled
      Feet) and the on-hit punishers (Toxic Chain, Stench, Sand Spit, Seed Sower).
      New hook `onModifyCritRatio`; the damage payload carries `crit` for Sniper
      and the after-move payload carries `hit` so an immune or status move cannot
      trigger contact/on-hit abilities. Coverage at 189 ports (150 abilities);
      302 tests pass; `npm run build` clean.
- [x] Fixed the duplicated secondary effects: `build-dex.mjs` now drops the raw
      `secondary` field and keeps only the resolved `secondaries` array, and the
      engine applies that array once. A single-secondary move like Bulldoze no
      longer lowers Speed twice, and the self-boosting secondaries (Flame Charge,
      Ancient Power) land once. Regenerated the dex (moves.json only; content
      counts unchanged) and tightened the Sheer Force / Shield Dust tests to
      assert the exact stage. 305 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/moves.ts` + the turn loop: the odd move shapes.
      **Two-turn charge moves** (Solar Beam, Fly, Dig, Dive, Bounce, Phantom
      Force, Shadow Force, Meteor Beam, Electro Shot, Sky Attack, Freeze Shock,
      Ice Burn) lock the user and fire next turn regardless of the chosen
      command; Solar Beam/Blade skip the charge in sun. **Damage counters**
      (Counter, Mirror Coat 2x; Metal Burst, Comeuppance 1.5x) pay back the
      damage banked earlier in the turn and fail with nothing banked.
      **Yawn** puts the target to sleep after a turn; **Wish** heals half HP two
      turns later. **Self-switch moves** (U-turn, Volt Switch, Flip Turn, Parting
      Shot, Teleport, Baton Pass) deal their effect then ask for a replacement,
      and Baton Pass hands the user's stat stages to the incoming Pokémon (now
      carried on the side, applied in `performSwitch`). Fighters gained
      `volatiles.charging` and physical/special damage banks; sides gained
      `wishTurns` and `batonPassBoosts`. `autoReplace` no longer re-picks a
      healthy self-switched active. 314 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 7, 19 more abilities — the
      defensive/entry group (Fur Coat, Ice Face, Slow Start, Unburden, Forewarn,
      Supersweet Syrup, Pressure), the stat reactions (Speed Boost, Guard Dog
      intercepting Intimidate) and the item/contact group (Magician, Lingering
      Aroma, Harvest, Sticky Hold, Ripen, Cheek Pouch, Unnerve). Passive
      abilities whose behaviour sits at the call site are registered so the
      coverage table and the dev warning both see them: Early Bird and Corrosion
      in `status.ts`, Liquid Ooze in the drain path, Pressure in the PP cost and
      the berry abilities in `effects/items.ts`. Fighters gained
      `volatiles.slowStart`, `iceFace` and `supersweetSyrup`. Gluttony stays
      `no-op`: the run catalogue's berries all trigger at half HP, so it is not
      observable yet. Coverage at 208 ports (169 abilities); 333 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 8, 20 more abilities — the
      anti-priority trio (Armor Tail, Dazzling, Queenly Majesty, reading the
      *effective* priority so a Prankster status move is stopped too), Triage
      (+3 to healing moves), Serene Grace (a new `onModifySecondaryChance` hook
      doubles proc chances), Wonder Skin (status moves aimed at the holder,
      which needed the move passed into the accuracy check), Full Metal Body,
      Mirror Armor (a reflected drop carries its own reentrancy guard),
      Opportunist, Tangling Hair, Aftermath (a contact attacker is punished when
      the holder faints), Bad Dreams, Poison Puppeteer, Berserk and Anger Shell
      (one pinch trigger per drop below half, on the new `volatiles.pinchTriggered`),
      Chilling Neigh, Grim Neigh, Steely Spirit, Supreme Overlord and Klutz (the
      registry now skips a Klutz holder's held item entirely). Flower Veil moved
      to `excluded`: it only protects Grass-type *allies*, so it is dead in
      singles. Coverage at 228 ports (189 abilities); 351 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 9, 13 more abilities —
      Scrappy and Mind's Eye (a new `onModifyEffectiveness` hook pierces the
      Ghost immunity, and Mind's Eye also ignores the foe's evasion in
      `accuracy.ts`; Scrappy additionally blocks Intimidate), Magic Guard (a
      `takesIndirectDamage` guard in the turn loop and `volatile.ts` covers
      status, weather, Leech Seed, recoil, Liquid Ooze and confusion), Protean and
      Libero (type change once per switch-in), Truant (loaf turns), Trace (copies
      the foe's ability and replays its entry effects, with a ban list), 
      Electromorphosis and Wind Power (a shared Charge volatile that doubles the
      next Electric move), Soul-Heart (a new `onFaint` hook), Long Reach (the
      payloads now carry a resolved `contact` flag, so contact punishes and
      Tough Claws/Fluffy consult `moveContacts` instead of the raw move flag),
      Quick Draw and Stall (a new `onFractionalPriority` tie-break inside the
      priority bracket, honoured by `orderActions`). Coverage at 241 ports (202
      abilities); 364 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/registry.ts` + the turn loop: batch 10, the
      ability-suppression layer and stat auras — **Mold Breaker**, **Teravolt**
      and **Turboblaze** pierce the foe's ability for the duration of the move
      (a `state.abilityPierce` flag set in `useMove` and cleared before the
      contact reactions, so Static and friends still fire), **Mycelium Might**
      does the same for status moves and sends them last in the bracket,
      **Neutralizing Gas** switches off the opposing active's ability everywhere
      (`abilityActive` in `ownedEffects`), **Unaware** zeroes the attacker's or
      defender's relevant stages, and the **Ruin quartet** (Sword/Tablets/Beads/
      Vessel) applies its 0.75x aura to the right stat. The damage context gained
      `ignoreAttackBoosts`, `ignoreDefenseBoosts`, `attackMultiplier` and
      `defenseMultiplier`. Coverage at 251 ports (212 abilities); 370 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 11, 8 more abilities —
      **Air Lock** and **Cloud Nine** (`effectiveWeather` in `state.ts` nulls the
      weather for every effect while their holder is active, from damage and
      residual chip to Chlorophyll/Swift Swim/Weather Heal/Sand Veil, without
      stopping the weather timer), the **-ate** trio **Galvanize**, **Pixilate**
      and **Liquid Voice** (a new `onModifyMoveType` hook resolved before any
      immunity check, so the move is treated as its new type for the whole turn),
      **Unseen Fist** (contact moves break through Protect in `protectBlocks`),
      and the contact punishers **Cursed Body** (a `disabledMove` volatile that
      `legalMoveIndices`/`selectedMove`/`validateCommand` now honour, ticking down
      in `endOfTurnVolatile`) and **Cute Charm** (an `attract` volatile that adds a
      50% lost turn to `beforeMoveVolatile`). Coverage at 259 ports (220
      abilities); 377 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 12 closes the ability
      coverage. Ported with real behaviour: **Arena Trap**, **Shadow Tag** and
      **Magnet Pull** (`trappedBy` in `fighter.ts`, `isTrapped` in `state.ts`, so
      `validateSwitch` and `canRun` share one rule, with the Ghost/grounded/Steel
      immunity and Neutralizing Gas off-switch); **Battle Bond** (one-time
      Attack/Sp. Atk/Speed boost after a KO); **Cud Chew** (a consumed berry gets
      one more bite from a factored-out `applyHeldItemEffect`, with the `cudChew`
      volatile); **Dancer** (a dance move the foe uses is replayed by a
      `dancerFollowUp` guard that stops a mirror loop); **Gluttony** (lifts the
      berry threshold to half); **Hadron Engine** (Electric Terrain plus 4/3 Special)
      and **Orichalcum Pulse** (sun plus 4/3 physical); **Protosynthesis** and
      **Quark Drive** (the highest stat boosted 1.3x, Speed 1.5x, in sun or
      Electric Terrain); **Magic Bounce** (a reflectable status move is bounced
      back in `applyMoveEffects`); **Rivalry** (1.25x/0.75x by gender, on a new
      `gender` fighter field the run assigns in Phase 6); and **Illuminate**'s
      v1.3.2 accuracy-drop immunity. The unreachable-in-singles leftovers moved to
      `excluded` in the coverage script with explicit reasons (forme change,
      doubles/ally, weight, hazards, forced switch, out-of-battle). Only **Illusion**
      and **Imposter** stay `no-op`, both blocked on Transform. Coverage at 273
      ports (234 abilities, 2 no-op, 74 excluded); 388 tests pass; `npm run build`
      clean.
- [x] `src/engine/battle/effects/moves.ts` + `abilities.ts`: Transform, which
      closes the last two abilities. `transformInto` in `fighter.ts` copies the
      target's types, stats (never HP), ability, gender, moves (5 PP each) and
      stat stages, keeping a `transformBackup` so `restoreOriginalForm` (run from
      `resetBattleState`) reverts on switch-out; the copied ability is not
      re-triggered, which keeps recursion-prone abilities inert. The `transform`
      move and the **Imposter** switch-in both call it. **Illusion** stores the
      last healthy party member as an `illusion` volatile and drops it on the
      first damaging hit. Coverage at 275 ports (236 abilities, 0 no-op, 74
      excluded); 392 tests pass; `npm run build` clean.

## Phase 5 — Battle UI & presentation

- [x] `src/ui/`: the first presentational helpers — `metrics.ts` (HP fraction and
      the green/yellow/red thresholds, status abbreviations), `panel.ts` (rounded
      panels and HP/XP gauges) and `feed.ts` (`battleFrames`, which splits the
      engine's event log into message beats so a line lands with the HP drop it
      describes). `metrics` and `feed` are Phaser-free and unit-tested.
- [x] `src/scenes/BattleScene.ts`: the real menu battle. A backdrop with two
      platforms and tintable placeholder sprites, both HP readouts with colour
      thresholds and status badges, and a message box. The four commands open the
      move list (PP), the bag (filtered to usable items) and the party list
      (HP/level/status), and RUN flees a wild battle; a turn goes through
      `takeTurn` with the trainer AI and the log plays back one frame at a time
      (auto-advance, press to step, hold Z to fast-forward). A fainted active is
      replaced through a forced switch menu. A fixed demo party stands in until
      the run (Phase 6) supplies a real one. `BootScene` gained the placeholder
      battle textures; `RouteScene` a `B` dev key to preview the scene. 398 tests
      pass; `npm run build` clean.
- [x] `BattleScene`: the move list now shows each move's type, and RUN asks for a
      YES/NO confirmation before fleeing. 398 tests pass; `npm run build` clean.
- [x] Entry transitions: route → battle on trainer sight or a grass encounter and
      battle → route on win, loss, flee or catch. `battle.snapshotFighter` /
      `restoreFighter` carry the party's HP, PP and status across the scene
      (`src/engine/battle/fighter.ts`); `src/engine/run/` adds the `BattleLaunch` /
      `BattleReturn` contract plus `battleSeed` and a baseline `trainerRoster`
      (band party size, themed pool, seeded levels; Phase 6 still layers held
      items on top). `RouteScene` owns the demo party and bag, pauses itself and
      launches `BattleScene` on top, and adopts the result: fainted Pokémon are
      dropped (permadeath), a catch joins the party and spends the route's single
      capture, a beaten trainer stays beaten, and an empty party ends the run.
      The dev `B` key is now gated by `IS_DEVELOP`. 405 tests pass; `npm run build`
      clean.

- [x] `BattleScene` XP bar: `BattleLaunch` now carries each party member's XP,
      and the player's HP panel grew a blue XP gauge plus an `XP n` label driven
      by `experienceFraction`. It reads the run's XP, so it fills as battles are
      won.
- [x] Move FX and the capture beat (D20): `src/render/moveFx.ts` registers the six
      animation strips packed from `moves.png` (`ember`, `cross_poison`,
      `poison_gas`, `fire_punch`, `rock_slide`, `ancient_power`) with a move →
      archetype map (`moveFxFor`, by the move's own id/type/flags, never per move)
      and the atlas frame maths; `moveFx.test.ts` measures the committed atlas so
      a re-extract that shifts a strip fails the build. `BootScene` creates one
      animation per strip and `BattleScene` plays it over the side a move hit.
      `src/ui/capture.ts` turns the engine's `shakes`/`success` into the classic
      beat (`captureBeat`: a failed ball breaks on the interrupted shake, a catch
      holds through four) that `BattleScene` plays as a thrown ball, wobble and
      result, reusing the ball's item icon. 497 tests pass; `npm run build` clean.
- [x] Faint, switch and level-up beats (Phase 5): `src/ui/beats.ts` holds the
      timings plus the pure `levelUpBeats(before, after)`, which diffs the run
      party against the party after `resolveBattle` and reports only the members
      that gained a level (with the species it evolved into and the moves learned
      and forgotten). `BattleScene` plays the faint drop when a `faint` event
      lands and the withdraw/send-out when a `switch` event does (a forced
      replacement has nothing to withdraw, so it only sends the incoming in); a
      running beat owns its sprite so the HUD cannot snap it back mid-tween.
      `RouteScene` counts each levelled HUD row up to its new level with a gold
      flash, then resyncs. `beats.test.ts` covers the diff. 503 tests pass;
      `npm run build` clean.
- [x] Permadeath feedback (Phase 5): `src/ui/permadeath.ts` (Phaser-free, tested)
      turns the resolution's fallen list into release beats and the run into the
      end-screen lines (`runOverSummary` / `runOverLines`: routes cleared, seed,
      loss or win). `RouteScene` plays a "was released" beat per fallen Pokémon —
      scrim, portrait, name and level, advance on Z or after 1.6 s, with a short
      guard so the press that closed the battle cannot skip the first beat — and
      then either resumes the route or hands over to the new `RunOverScene`. The
      route's final exit now ends on that same screen in win mode; `Z / Enter`
      starts a fresh run from `StarterScene`. Fixing this exposed that
      `resolveBattle` never adopted the party the battle returned, so HP, PP and
      status were discarded and **permadeath never fired from a real battle**:
      `adoptBattleParty` now swaps each member's snapshot by id (XP lives on the
      run member, so it survives) before `releaseFainted` runs, with tests for
      the adoption and for the real full-HP-to-`released` flow. Verified in the
      browser: a wild loss releases the party and lands on the run-over screen.
      521 tests pass; `npm run build` clean.

## Phase 6 — Run structure, party & economy

- [x] Random starter pool: `src/data/dex/evolutions.ts` gained
      `evolutionFamily(speciesId)` — it walks `prevo` up to the base form and then
      `evos` back down, so a branching line (Eevee) counts every child and formes
      are included, with a cycle guard. `src/data/run.ts` replaces the hardcoded
      three with `starterCandidates()` (the 109 base forms whose line has at least
      three members, so a starter always has room to grow, `design-spec` §3) and
      `STARTER_POOL_SIZE`; `src/engine/run/starters.ts` adds `rollStarterPool(rng,
      count)`, a draw without replacement mirroring `trainerRoster`. `StarterScene`
      draws a fresh run seed, rolls three candidates from it and hands that same
      seed to the run, so a seed always shows the same starters. 483 tests pass;
      `npm run build` clean.

- [x] `src/engine/run/state.ts`: the `RunState` — seed, mode, route index, cached
      level cap, party, PC box, bag, beaten trainers and the per-route capture
      flag — with pure transitions: `createRun`, `advanceRoute` (raises the cap,
      clears the capture and the trainer marks), `addPokemon` (party to six, then
      box), `updatePokemon`, `addItem`/`consumeItem`, `useCapture`/`canCapture`,
      `markTrainerDefeated` and `hasLivingParty`. `src/engine/run/levelCap.ts`
      wraps the band cap (`capForRoute`, `clampToCap`, `reachedCap`).
- [x] `src/engine/run/progression.ts`: `RunPokemon` (a battle snapshot plus its
      XP), the medium-fast `level^3` curve (`xpForLevel`, `levelForXp`,
      `experienceFraction` for the XP bar), `experienceAward` (band-scaled, split
      across participants, trainer bonus) and `awardExperience` — clamps gain at
      the route cap, levels up, learns the crossed level-up moves (forgetting the
      oldest past four) and evolves once the cap allows it (`evolveIfReady`, which
      the heal stop will re-run). No RNG anywhere, so a replay awards the same XP.
      425 tests pass; `npm run build` clean.
- [x] `src/engine/run/perms.ts`: the permadeath enforcement point — `releaseFainted`
      drops a 0-HP member from the party and the box and reports who fell (D5,
      battle-spec §5).
- [x] `src/engine/run/resolve.ts`: `resolveBattle` folds a `BattleReturn` into the
      run — adopts the bag, enforces permadeath, places a catch (party or box) and
      spends the route's capture, marks a beaten trainer and awards XP to the
      survivors (split across the whole party until the battle reports who took
      part). `RouteScene` now owns a real `RunState` seeded with the demo starter
      and bag, drives party/bag/capture/beaten-trainers from it, and shows the
      "was released" / "Level up!" / "It evolved!" beats from the resolution
      events. Verified end to end in the browser: a wild win raised the XP bar from
      125 to 137. 435 tests pass; `npm run build` clean.
- [x] `src/engine/run/heal.ts`: the between-route heal stop — `healParty` restores
      HP and PP across the party and the box but never resurrects a 0-HP member
      (D5), and `restAndAdvance` composes it with `advanceRoute`. `RouteScene`
      now generates the current route from the run (seed + route index) instead of
      a hardcoded route 1, and the EXIT tile runs the beat: heal, advance, rebuild
      the scene on the next route. Verified in the browser: stepping the exit on
      route 1 (Woods) lands on route 2 (Test Grounds) with the party at full HP/PP,
      the cap and the per-route capture reset. 439 tests pass; `npm run build`
      clean.
- [x] Starter pick + route HUD: `StarterScene` opens the run (arrow keys choose,
      Z/Enter confirms) and hands a seeded `RunState` to `RouteScene` via `init`,
      which now falls back to the dev run only when started directly. New data:
      `STARTER_POOL`/`STARTING_BAG` (`src/data/run.ts`) and `src/data/portraits.ts`
      (PMDCollab portrait atlas + `num-1` frame mapping). `BootScene` loads
      `portraits.png`; the route HUD shows the route/biome header, the party with
      each member's portrait, level and HP, and the bag. The atlas was re-laid from
      a 25960px column into a 40-column grid (`scripts/legacy-art/relayout-
      portraits.mjs`) because it exceeded the WebGL texture limit and rendered
      black. Verified in the browser: pick Charmander → route 1 with HUD. 445 tests
      pass; `npm run build` clean.
- [x] `src/engine/run/chain.ts`: the route cadence from `src/data/run.ts` —
      `routeStage(index, mode)` classifies each route as `route`, `miniboss`
      (every `minibossEvery`), `boss` (closing each `bossBlock`) or `final` (the
      last route of a finite run), with its `block`/`slot` and `isBoss`/`isFinal`
      flags; `chainLength` and `isFinalStage` cover the finite finish line and the
      infinite mode branch (no final boss). `RouteScene` now
      asks `isFinalStage` instead of comparing against `RUN_CHAIN.finiteLength`
      directly. 453 tests pass; `npm run build` clean.
- [x] `src/data/items.ts` prices: every `ItemDef` carries a Poké Dollar `price`
      (`0` = never sold, the Master Ball), with `isForSale`, `buyPrice` and
      `sellPrice` (half, rounded down) helpers, plus `src/data/items.test.ts`
      (unique ids, known kinds, integer prices, ball prices in step with their
      catch bonus, no Revive). `docs/balance/economy.md` records the sheet and
      `docs/data-spec.md` moves the file to phase 3/6. 461 tests pass;
      `npm run build` clean.
- [x] Between-route reward as **ground items**: `src/data/loot.ts` holds the
      per-band `count` + weighted pool (`ROUTE_LOOT`), `sketchRoute` accepts a
      weighted `loot` pool (falling back to the old uniform `itemIds`) and draws
      positions *and* contents from the same route `Rng`, and `RouteScene` now
      actually adds a picked item to the bag and says "You found X!". Tests cover
      the tables and the deterministic weighted draw. 467 tests pass.
- [x] FRLG item icons (interface art per the user's FireRed/LeafGreen reminder):
      `scripts/frlg/build-item-icons.mjs` packs the 24x24 FRLG item icons (named
      per the pret/pokefirered decomp, so the id → icon map is authoritative)
      into the committed `src/assets/frlg/item-icons.png` plus
      `src/data/frlg/item-icons.json`, read through `src/data/itemIcons.ts`.
      `png-codec.mjs` gained sub-byte palette support (the decomp icons are 4-bit
      indexed). `BootScene` loads the atlas; the route draws each floor item with
      its icon and the HUD bag row shows the stacks as icons + counts. The raw
      FRLG UI sheets (menus, HUD, effects) are staged in `sprite-sources/frlg-ui/`
      for the coming UI pass. 470 tests pass; `npm run build` clean.
- [x] FRLG window chrome (interface art): `scripts/frlg/build-battle-ui.mjs`
      crops and 4x-upscales the light menu window and the navy battle message box
      from the FRLG `hpbars-menu` sheet into `src/assets/frlg/window.png` /
      `textbox.png`, drawn as Phaser nine-slices by `src/ui/frlg.ts`. `BootScene`
      loads both; `BattleScene`'s two HP panels and its message/command box and
      `RouteScene`'s HUD panel now use them (dark text on the light window, the
      message box grew to fit the four command rows). Verified in the browser.
      470 tests pass; `npm run build` clean.
- [x] FRLG bitmap font: `scripts/frlg/build-font.mjs` reads the sheet's
      `latin_normal.png` + `charmap.txt`, keys the flat blue background and the
      white padding to transparent, keeps the letter white with a mid-grey shadow
      (one texture serves both tint directions) and packs `src/assets/frlg/font.png`
      (2x) plus per-glyph metrics in `src/data/frlg/font.json` — 146 glyphs, the
      Latin set up to the Japanese sections plus the four named arrows. The
      runtime registers it as a Phaser bitmap font without an XML file
      (`src/ui/frlgFont.ts`, `frlgFontData()` builds Phaser's `BitmapFontData` and
      `registerFrlgFont` caches it), and `addFrlgText` is the single entry point:
      `BattleScene`, `RouteScene`'s hint/HUD and `StarterScene` now draw FRLG
      glyphs instead of `Phaser.GameObjects.Text`, so the monospace placeholder is
      gone. Verified in the browser.
- [x] Baked HP-bar/command-menu art from the same sheet: `build-battle-ui.mjs`
      now also crops the HP readout (`src/assets/frlg/hpbar.png` — the "HP" chip
      plus a track whose green fill it clears) and the ▶ command cursor
      (`src/assets/frlg/cursor.png`), and writes the measured geometry to
      `src/data/frlg/battle-ui.json`. `src/ui/frlg.ts` exposes `FRLG_HPBAR` and
      `addFrlgHpBar`, so the battle scene paints the HP colour (green/yellow/red)
      behind the baked overlay instead of a drawn rounded gauge, and the four
      commands moved into their own light FRLG window with the cursor marking the
      selection (the message box shrank to the classic two-line band). The debug
      hint in `RouteScene` gained a backing bar since bitmap text has no
      background. `StarterScene` was restyled to the same windows (FRLG card
      frames, the ▶ glyph as the selector, FRLG text throughout). 483 tests pass;
      `npm run build` clean.
- [x] Premier Ball: `src/data/items.ts` adds the commemorative Ball (the same
      200/1x rate as the Poke Ball, listed next to it so the catalogue stays in
      ascending price order) and `build-item-icons.mjs` maps it to the Poke Ball
      icon, since Gen 3 ships no distinct one. Tests guard its price/rate and keep
      it out of the ground-loot pool. 497 tests pass; `npm run build` clean.
- [x] Party/PC screens (Phase 6): `state.ts` gained the party/box moves
      (`moveInParty`, `moveInBox`, `depositToBox` — the party is never emptied —
      and `withdrawToParty`, which refuses a full party) and `src/ui/partyScreen.ts`
      holds the Phaser-free model and input reducer: per-member rows (name, level,
      HP, status, held item), the row window, and a `partyInput` state machine
      where `Z` picks a member up, `up`/`down` reorders it live, `left`/`right`
      sends it to the other pane and `X` restores it to where the grab started.
      `src/scenes/PartyScene.ts` draws the two panes (portraits, FRLG windows and
      text, a ▶ cursor and a grab highlight). It opens from the route HUD with `P`
      and as the between-route healing stop: the EXIT tile now heals the party and
      hands over to the same screen (titled "REST STOP"), and continuing advances
      the route. `heal.ts` drops `restAndAdvance`: the stop is a screen now, so the
      route composes `healParty` + the screen + `advanceRoute`. Fixed two bugs the
      playtest found: `scene.restart()` reuses a scene's previous start data, so
      the route was re-initialised with the *old* run and every exit tile bounced
      back to route 1 (the restart now passes the advanced run explicitly), and
      `PartyScene` kept a reference to the footer text of a previous session, so
      reopening the screen crashed on the destroyed object. 539 tests pass;
      `npm run build` clean. Verified in the browser: `P` opens the screen, grab +
      reorder, deposit, withdraw, `X` closes with the run adopted, and the rest
      stop heals on open and lands on route 2 on continue.
- [x] Trainer rosters per band: `src/data/trainers.ts` now gives every archetype a
       `pools` record keyed by `BandId` instead of one flat `pool`, and
       `trainerRoster` draws from `archetype.pools[band.id]`, so a route's rosters
       field that band's species — base forms in `early`/`low`, evolved forms
       (`furret`, `greedent`, `vikavolt`, `garchomp`...) in `late`/`end` — while
       the party size still follows `band.trainerSize` (`docs/routes-spec.md` §6).
       Each band pool holds at least as many species as its party size, and the
       tests assert every band is non-empty, every listed species exists in the
       generated dex and the `end` pool differs from `early`. The roster RNG,
       seeds and battle snapshots are untouched, so a replay is unchanged.
       541 tests pass; `npm run build` clean.

## Phase 7 — Persistence, meta & polish

- [x] Saved runs and settings (`src/engine/save.ts` + `localStorage`): one
      versioned document (`SAVE_VERSION`, `SAVE_KEY = 'pokerandomlike.save'`) holds
      the `Settings` (text speed, master volume) and the `RunState` in progress,
      so the version lives inside the JSON and the key never has to move. The
      pure module does the whole job — `encodeSave`/`decodeSave` (migrate →
      validate → default, never throwing), a `migrations` table keyed by the
      version it reads with `migrateDocument` walking a document up one version at
      a time, per-field validation that repairs bad settings, drops malformed
      party/box members and recomputes the level cap from the route, and thin
      `loadSave`/`storeRun`/`clearRun`/`storeSettings` wrappers over a
      `StorageLike`, so the tests never touch a browser. `src/storage.ts` is the
      only browser-facing piece (`browserStorage()` returns null when the store is
      blocked). `BootScene` resumes a saved run with a living party and otherwise
      starts a fresh one (a run saved after its last Pokémon fell is cleared),
      `RouteScene.persistRun()` writes on every run change (route create, battle
      result, party close, item pickup, heal, route advance) and `RunOverScene`
      clears the run on both outcomes (D5). 25 save tests cover the round trip,
      the migration path, corrupt/newer documents and the storage wrappers.
      566 tests pass; `npm run build` clean.
- [x] Run summary / score screen: the run now keeps its own score in
      `RunState.stats` (`RunStats` = catches + casualties, in `src/engine/run/state.ts`).
      `recordCatch` bumps the catch beside the capture it spends (called from
      `resolveBattle`) and `releaseFainted` bumps the casualties where a Pokémon
      is actually lost, so a catch that later falls counts as both. The end-of-run
      screen was rewritten around `src/ui/runSummary.ts` (`runSummary` /
      `runSummaryLines`): a win clears its route, a loss does not, and the panel
      shows routes cleared, Pokémon caught, Pokémon lost and the seed, with the
      release beats still owned by `src/ui/permadeath.ts`. The counters are on
      disk, which is the first real use of the migration path: `SAVE_VERSION` is
      now 2 and `SAVE_MIGRATIONS[1]` adds `stats` to a v1 run. 572 tests pass;
      `npm run build` clean.
- [x] Seed input and a run share string (`D21`): `src/engine/run/share.ts` turns a
      run into the token that starts it again — `PKRL-1-<f|i>-<seed>` — without
      carrying any progress, so a shared run starts on route 1.
      `encodeRunShare` stamps the prefix, the version and the mode letter and
      percent-encodes the seed (escaping `-` so the fields stay separable);
      `decodeRunShare` reads a share string back into `{ seed, mode }`, treats a
      string with no prefix as the seed itself (falling back to the player's mode
      choice) and rejects a prefixed string that is malformed — an unknown
      version, an unknown mode, a missing or broken seed — instead of quietly
      starting a different run. Round-tripping is tested across spaces,
      non-ASCII, `%` and hyphens. The starter screen shows the run's share string
      and `S` opens `src/ui/seedPrompt.ts`, a DOM prompt (like the dev debug
      menu, and it swallows its own keys) that accepts a pasted share string —
      taking its mode with it — or a typed seed and rerolls the three starters;
      the end-of-run screen reports the share string beside the raw seed.
      584 tests pass; `npm run build` clean.
- [x] Settings screen (`D22`): `Settings` gained the tileset preference (`auto`
      follows the biome, D10; anything else forces one everywhere), which made
      `SAVE_VERSION` 3 with `SAVE_MIGRATIONS[2]` filling it into a v2 document.
      The tileset ids and their display names moved to the asset-free
      `src/data/tilesets/ids.ts` (`TILESET_IDS`, `TILESET_NAMES`,
      `isTilesetPreference`, `resolveTileset`, `tilesetLabel`) so the engine can
      validate a preference without importing a `.png`, and `index.ts` builds the
      registry on that list. `src/scenes/SettingsScene.ts` (a pure model in
      `src/ui/settingsScreen.ts`) opens paused-on-top from the starter screen or
      the route HUD with `O`: up/down picks a row, left/right steps its value and
      each change is stored at once through `src/settings.ts`, so there is nothing
      to confirm. Every setting is honoured: text speed drives the new battle
      message typewriter (`src/ui/typewriter.ts` + `TEXT_SPEED_MS`; a confirm tap
      or `Z` held skips the line, and the read hold shortened to 450 ms to pay for
      the typing), volume goes into Phaser's sound manager at boot and on change
      (the only audio knob until Phase 8 ships sounds) and the route re-renders
      with the forced tileset when it resumes. Keybinds stayed a separate backlog
      item. 612 tests pass; `npm run build` clean.
- [x] Shared keybinds and the rebinding UI (`D23`): every scene now reads its
      confirm / cancel / move / party / settings key from one map instead of
      hardcoding it. `src/data/keybinds.ts` is the pure vocabulary — one key per
      action, the defaults, display labels, `actionForKey` (explicit binding,
      then the always-on `Enter`/`Space` confirm and `Esc` cancel aliases, so a
      rebind cannot lock a player out), `withBinding` (a rebind swaps with
      whichever action held the key, so no key is ambiguous) and
      `sanitizeKeybinds`. `src/input/` is the Phaser half: `subscribeKeybinds`
      listens to the plugin's generic `keydown`, reading the map per press so a
      rebind applies immediately and skipping auto-repeat, with `actionKeys` for
      the two spots that poll held state (the route's walk, the battle's
      hold-to-skip) and `keyNameOf` for the native-event lookup. `Settings`
      gained `keybinds`, so `SAVE_VERSION` is 4 and `SAVE_MIGRATIONS[3]` fills
      the defaults into a v3 document. `SettingsScene` shows them as `keybind`
      rows beside the `step` rows: confirm on one captures the next raw key
      (bound or not), cancel keeps the old one, and the on-screen hints are
      written from the live bindings. The route, battle, party, starter and
      run-over screens all moved onto the layer; the fixed debug/utility keys
      (`R` tileset, dev `B`, `S` seed prompt) stay on Phaser directly. 634 tests
      pass; `npm run build` clean.

## Phase 8 — Art, audio & release

- [x] FRLG battle trainer sprites (O1): `scripts/frlg/build-trainer-sprites.mjs`
      crops the ten trainers the archetypes use from the "Regular Trainers" grid
      of `sprite-sources/frlg/trainers.png` (64px cells on a 65px pitch, the flat
      orange cell keyed transparent) into `src/assets/frlg/trainers.png` plus
      `src/data/frlg/trainers.json`, read through `src/data/trainerSprites.ts`.
      Every archetype in `src/data/trainers.ts` names its `battleSprite` and
      `BattleScene` draws it on the enemy platform for a trainer battle (the
      trigger carries `archetypeId`); a wild battle keeps the placeholder mon.
      `trainerSprites.test.ts` measures the atlas shape and that every frame
      carries art. Overworld trainer sheets are still open (O1). 497 tests pass;
      `npm run build` clean.
- [x] FRLG route fields (`D18`): `D18` landed — `TilesetConfig.atlas` carries
      `tileSize`, `BootScene` loads each sheet at its own cell size and
      `RouteScene` scales every cell back to the 24px world tile, so the 16px
      FRLG atlases and the 24px PMD sheets coexist. `scripts/frlg/build-tilesets.mjs`
      composes three 64x208 atlases (outdoor, forest, cave) from the gitignored
      `sprite-sources/frlg/tileset-2.png`: the floor and its five variants
      (frames `1`,`2`,`41`-`43`, beside the common stair/trap slots), the wall
      autotile shapes stamped as the field's single repeated border (composited
      over the floor so transparent pixels read as ground) and the sheet's shared
      rocky-banked pond with every concave/diagonal corner filled. The three are
      registered as tilesets (`frlg.ts` with one shared config, `index.ts`,
      `palettes.ts`) and as biomes with encounter tables (`biomes.ts`,
      `encounters.ts`), and the route chain now cycles only FRLG fields —
      outdoor → forest → cave — so the imported PMD `wood` sheet no longer shows
      up in a run (`wood`/`placeholder` stay as manual settings overrides).
      `frlg.test.ts` measures each committed atlas and asserts every wall/water
      shape and floor variant is stamped. 638 tests pass; `npm run build` clean.
- [x] FRLG-style Pokémon battle sprites for every generation (O1): the dex is
      Gen 9 but the battle art now comes from the pokeemerald-expansion checkout
      (`graphics/pokemon/<species>/`, gitignored, never redistributed).
      `scripts/frlg/build-pokemon-sprites.mjs` maps each playable species to its
      expansion folder (a forme without its own art falls back to its base
      species), keys out the palette's flat background and packs three atlases —
      `src/assets/frlg/pokemon-{front,back,icon}.png` — plus the frame manifest
      `src/data/frlg/pokemon-sprites.json`, read through `src/data/pokemonSprites.ts`.
      `BattleScene` draws the foe's front frame and the player's active mon's back
      frame, replacing the placeholder battle mon. The overworld player sprite,
      portraits, move FX and battle backgrounds are the remaining PMD pieces
      (`TODO.md`). 638 tests pass; `npm run build` clean.
- [x] FRLG trainer overworld sprites (`D24`): a trainer on the route draws its
      class's FRLG overworld sprite instead of the tinted placeholder. The ten
      archetypes' down-facing idle frames come from the pret/pokefirered decomp
      (`graphics/object_events/pics/people/*.png`, 160x32 sheets of ten 16x32
      walk frames) via `scripts/frlg/build-overworld-sprites.mjs`, packed into
      `src/assets/frlg/overworld.png` + `src/data/frlg/overworld.json` and read
      through `src/data/overworldSprites.ts`; `psychic` borrows the Channeler and
      `ace` the male Cooltrainer, and `trainers.ts` sets each archetype's
      `spriteKey` to its manifest name. `RouteScene` draws the 16px frame at
      `TILE_SIZE / 16` with its feet on the tile bottom, beside the tinted facing
      arrow, and falls back to the placeholder only if a future archetype names a
      sprite the sheet lacks. `overworldSprites.test.ts` measures the atlas and
      that every archetype maps onto a non-empty frame. 641 tests pass;
      `npm run build` clean.
- [x] FRLG player overworld sprite with walk and run cycles (Phase 8, `D25`):
      the route's player is the FRLG protagonist instead of the PMD placeholder,
      and holding a direction now walks him. `red_normal.png` from the
      pret/pokefirered decomp (`graphics/object_events/pics/people/`, a 144x32
      strip of nine 16x32 frames: the resting pose plus a two-frame cycle of each
      direction) is packed by `scripts/frlg/build-player-sprite.mjs` into
      `src/assets/frlg/player.png` + `src/data/frlg/player.json`, read through
      `src/data/playerSprite.ts` (idle and walk frames per facing; the decomp
      side faces left, its right is the flipped frame). `src/render/playerAnim.ts`
      keys the three cycles and `BootScene` registers them.
      `RouteScene` moved from one tile per key press to hold-to-walk: a step
      slides between tiles over `WALK_STEP_MS` with the direction's animation
      playing, releasing shows the resting frame, and pushing into a wall turns
      in place. A new `run` keybind (`SHIFT` by default, rebindable, listed on the
      settings screen via `KEYBIND_ACTIONS`) cuts the step to `RUN_STEP_MS` and
      scales the cycle's `timeScale`, so running reuses the walking frames faster
      as the originals do. Encounters, fog and trainer sight are untouched — a
      step still lands on one tile and runs the same `onTileEntered` beat.
      `playerSprite.test.ts` and `playerAnim.test.ts` measure the atlas and the
      cycles. 646 tests pass; `npm run build` clean.
- [x] FireRed/LeafGreen-style route layouts and field tiles (`D26`): a route's
      shape now follows its biome instead of one generic blob. Calibrated against
      the real layouts in the pret/pokefirered decomp (`data/layouts/*/map.bin`),
      `src/engine/routes/layout.ts` carries three styles — `route` (Route 1: an
      open grass field, ~38% blocked, cut by one-tile tree hedges attached to the
      borders), `forest` (Viridian Forest: a one-tile-corridor labyrinth, ~57%
      blocked) and `cavern` (Mt. Moon: two-tile rock corridors and wide chambers,
      ~40% blocked). `sketch.ts` gained the two carvers (`carveHedges`,
      `carveMaze` with an optional braid) and a shortest-path guard that keeps
      solid terrain (water, ledges) off the way through, and `src/data/biomes.ts`
      names each biome's style. The FRLG atlases were recomposed
      (`scripts/frlg/build-tilesets.mjs`): the wall autotile now draws a tree in
      three layers — a canopy where the mass opens north, a trunk where it opens
      south and the leaf body elsewhere — so a tree border reads as trees instead
      of a flat repeated stamp; the forest field got real green grass (the old
      pick was a sand tile) and the sheet's last free cell became a rocky ledge
      lip (`FRAME_LEDGE`), which FRLG routes now draw on their one-way ledges
      instead of plain ground. `frlg.test.ts` measures the ledge frame, the new
      `layout.test.ts` covers the registry and the expanded `sketch.test.ts`
      asserts the per-style edge entries and density bands. 653 tests pass;
      `npm run build` clean.
- [x] FRLG walls are whole trees, not a per-shape stamp (`D26` follow-up): the
      tree bank draws a tree three tiles wide that stacks vertically, so one frame
      per autotile shape read as a flat hedge. `TilesetConfig` gained a
      `wallPattern` (a `cols` x `rows` motif) and `tileFrames.patternFrame`
      resolves it anchored to the wall mass's top-left: the first row is the
      mass's top, the last its base, the middle rows cycle as the wall rises and
      the columns repeat across x, centring the motif on a one-tile wall.
      `build-tilesets.mjs` stamps the FRLG fields' wall on frames `7`-`18` — a
      canopy against ground, a solid canopy (the tree bank's ground filled in so
      the tops stack without holes), the canopy body and the trunk. `frlg.test.ts`
      measures every pattern frame and `tileFrames.test.ts` covers the anchoring,
      the interior cycle and the centring. 657 tests pass; `npm run build` clean.
- [x] FRLG ground matched to the real field (`D26` follow-up): the outdoor field
      stamped its base floor from the sheet's lighter `2,3` tile, which does not
      match the game. Measured against a real FireRed/LeafGreen Route 1 capture,
      the plain ground is `rgb(112,200,160)` (sheet tile `6,1`), so the base floor
      now uses that and the lighter tiles stay as floor variants. 657 tests pass;
      `npm run build` clean.
- [x] FRLG walls use the real FireRed tree (`D26` follow-up): the wall motif
      stamped a canopy picked from higher up the sheet, so a border read as a
      generic hedge instead of the game's tree. It now takes the real 3x4 tree
      block in the bottom-left of `tileset-2.png`, above the pond (crown, two
      canopy rows and the trunk platform), three columns wide, and bakes the
      interior rows solid (`solidOver`) so a tall wall stacks without ground
      gaps. The four pattern frames still hold its twelve cells, so
      `frlg.test.ts` and `tileFrames.test.ts` are unchanged.
- [x] Routes larger than the camera, framed by trees (`D26` follow-up): a route is
      now 56x32 tiles instead of 24x16, so the camera follows the player and
      scrolls. The scene renders a four-tile tree/rock margin past the playable
      edge (`padMap`, `src/engine/map.ts`, `RouteScene.renderMap`) and bounds the
      camera to it, so the border reads as more forest and the empty background is
      never seen. The regression seed moved to the new size and the `route`
      layout's hedge count was retuned (15 -> 90) to keep Route 1's density band
      on the bigger field; `map.test.ts` covers `padMap`.
- [x] No fog of war on a route (`D6` follow-up): the route draws the whole map at
      full opacity, like the originals, so trainers and items are read off the map
      instead of a vision radius. `RouteScene` dropped its `Vision` recompute and
      the per-tile/entity alpha pass, and the now-unused `vision.ts` and `fov.ts`
      modules (and their barrel exports) were removed. 659 tests pass;
      `npm run build` clean.
- [x] Pixel-art filtering fixed dark seams between route tiles: the FRLG cells are
      16px art scaled to the 24px world tile, and the default linear filtering
      blended each cell with the neighbouring atlas frame at fractional camera
      scroll, leaving a dark line. `main.ts` now boots with `pixelArt: true` and
      `roundPixels: true`, so the 3x total scale (sheet cell x tileset scale x
      camera zoom) is nearest-neighbour and integer. 659 tests pass;
      `npm run build` clean.
- [x] FRLG tree crowns superimpose the trunk row above (`D26` follow-up): a tall
      tree wall showed one crown on a flat canopy run and a trunk only at the very
      foot. `patternFrame` now repeats the tree every three rows, so a wall shows a
      crown every three tiles and each trunk shows through underneath.
- [x] FRLG wall motif split into five frames so the bodies are right (`D26`
      follow-up): the wall had a single body frame, so the second visible row drew
      the lower body (row 36) instead of the wide one (row 35), and the baking
      sampled each tile's top-left pixel as "background", which is a leaf on the
      body rows and corrupted the right-hand tile. `fieldFrames` now keys the whole
      teal ground family (the grass and its darker shadow, detected by hue) so the
      body corners match the floor, and the motif holds five
      frames — crown over ground, crown over trunk, the two body rows and the
      trunk — so `patternFrame` runs body, lower, then the crown that overlaps the
      trunk. `frlg.ts` grows `FRLG_WALL_LOWER_FRAMES` and moves the base to
      19-21; `frlg.test.ts` checks every frame is stamped and `tileFrames.test.ts`
      pins the new interior cycle (`14, 17, 11`). 659 tests pass;
      `npm run build` clean.
- [x] FRLG walls draw the floor under them (`D26` follow-up): the tree carried a
      baked flat floor colour, but the floor tile next to a wall uses a lighter
      wall-edge variant, so the tree corners showed a darker green than the route.
      The crown and trunk frames now keep a transparent ground and `RouteScene`
      draws a floor frame under every cell (`resolveGroundFrame`,
      `src/engine/tileFrames.ts`), so a wall picks up the same floor variant as its
      neighbours and blends in. `frlg.test.ts` allows the transparent edge rows and
      `tileFrames.test.ts` covers `resolveGroundFrame`. 660 tests pass;
      `npm run build` clean.
- [x] FRLG tree crowns stack on the lower leaves (`D26` follow-up): the crown of
      the tree below lands on the lower-body row of the tree above and the body row
      covers that tree's trunk, so the interior hides the trunk and only the mass's
      foot shows the platform. The motif keeps six frames (top, body, crown, mid,
      lower, foot); `build-tilesets.mjs` composites `top` over `lower`, `body` over
      `lower` (mass top) and `body` over `base` (the row that hides the trunk),
      `patternFrame` alternates crown/body above the foot
      (`src/engine/tileFrames.ts`) and `frlg.ts` renames `CANOPY` to `CROWN` and adds
      `MID`. `frlg.test.ts` and `tileFrames.test.ts` updated; 661 tests pass;
      `npm run build` clean.
- [x] Routes are an open field with a one-tile tree frame: every route now carves
      `kind: 'open'` (interior plain ground, only the border wall), the scene pads
      the map with a single tree/rock ring (`MAP_MARGIN` 4 -> 1) and the biome
      terrain is zeroed (`grassPatches`/`waterBodies`/`ledges`), so routes are
      plain ground for now. The `hedges`/`maze` carvers stay in
      `src/engine/routes/sketch.ts` for when interiors return. `layout.ts`,
      `biomes.ts`, `sketch.test.ts` and `docs/routes-spec.md` updated. 661 tests
      pass; `npm run build` clean.
- [x] Open-field tree frame reads whole again (`D26` follow-up): the one-tile
      margin left a two-tile tree line, so a side showed only two of the motif's
      three columns (the right one cut off) and the top/bottom line had a crown and
      a trunk but no body. The frame is now three tiles wide on the sides
      (`MAP_MARGIN_X` 2) and four tiles deep top/bottom (`MAP_MARGIN_Y` 3, plus the
      route's own one-tile border), so a side shows the whole three-column tree and
      the top/bottom line carries both body rows between the crown and the trunk:
      the full 3x4 tree. `padMap` now takes an `{ x, y }` margin for it. Every
      sprite (`centerX`/`centerY`) shifts by the same per-axis margin, so the
      player, trainers and items line up with the ground `padMap` draws instead of
      drifting one tile up-left onto the tree ring. The FRLG field also drops the
      PMD-style wall-edge floor decal: the lighter `FLOOR_ALT_*` frames read as a
      path, so `FRLG_TILESET` now resolves the ground under and beside a wall to
      the plain floor frame and the field is uniform. `map.test.ts`,
      `tileFrames.test.ts` and `frlg.test.ts` pin the asymmetric margin, the border
      shape and the uniform ground; 665 tests pass; `npm run build` clean.
- [x] FRLG tree body row keeps its transparent ground (`D26` follow-up): the
      `BODY` frames (`10`-`12`) no longer bake the tree's lower leaves behind them
      (`overFill(body, lower)`) and key the ground out instead (`overNone(body)`),
      so the field's floor shows through the body row the same way it already comes
      through the mass's top and trunk foot, which reads lighter against the route.
      `scripts/frlg/build-tilesets.mjs` (comment) and `docs/tileset-spec.md` §3b
      updated; the three field atlases regenerated with `node
      scripts/frlg/build-tilesets.mjs` (reproducible: same hashes); 666 tests pass;
      `npm run build` clean.

## Phase 9 — Maps (route groups), biomes & progression

A **map** is a Binding of Isaac-style floor: a grid of routes (rooms) of one
biome, closed into at least one cycle, with its own level range, its special
rooms and a boss on the room farthest from the entry that opens the portal to the
next map. This phase reworked the flat route chain into those floors and added
the Poké Dollar economy. `[Task-17]` (Batch 6) is the docs/migration pass that
closed it.

### Step 1 — Map tuning tables (`src/data/maps.ts`)

- [x] **The per-map tuning tables land.** `MAP_TUNING` holds one row per map —
  its level range, its route-count range and the range each room rolls its width
  and height from — behind `mapTuning`, `levelRangeForMap`, `levelCapForMap`,
  `routeCountRangeForMap` and `routeSizeRangeForMap`, and `MAP_TUNING_STEP`
  extrapolates past the last row so an infinite run keeps climbing: the level
  range steps up at **both** ends and saturates at `MAP_MAX_LEVEL`, and the room
  count stops at `MAP_MAX_ROUTES` so a deep floor never becomes a maze. Data only
  — retuning never touches the generator. `docs/maps-spec.md` §4; tests in
  `src/data/maps.test.ts`.

### Step 2 — `MapPlan` floor generator (`src/engine/maps/plan.ts` + `streams.ts`)

- [x] **`planMap` rolls a whole floor off one `map` stream.** Everything a map is
  comes from `Rng(seed : "map" : mapIndex)`: the biome (never the previous map's),
  the room count and each room's width and height (rolled independently). The
  floor grows a **single-door entry leaf** into a 2x2 core closed into a 4-cycle,
  then expands onto adjacent free cells, closes **one or more** extra cycles, hangs
  the boss off the farthest room as an extra `dead-end` leaf and derives every
  room's opening set and shape. `MapPlan` is a pure function of `(seed, mapIndex)`
  with fixed-seed determinism, connectivity, cycle and no-dangling-opening tests.
  `docs/maps-spec.md` §2/§3; `D29`/`D30`.

### Step 3 — Route shapes from the opening set

- [x] **A route takes its shape from the plan, not a roll.** `dead-end`,
  `corridor` and `tee` join `straight`/`bend`/`cross` in
  `src/engine/routes/layout.ts`, and the route builder reads its opening set from
  the plan: every opening is the grid neighbour's **opposite** edge, aligned to
  the same border band, so leaving by one edge enters the neighbour by the other.
  Per-shape and connection regression tests.

### Step 4 — Plan-driven route size

- [x] **A room's size comes from the plan.** `routeForRoom`
  (`src/engine/maps/route.ts`) hands `sketchRoute` the room's own width and height
  — never the fixed 20x20 — with its opening set; the map-size tiers, the camera
  bounds and the beyond-edge margin (`padMap`) still hold at every plan size.
  Every room is at least **30x30** and the entry and boss rooms are pinned to it
  on every map. Fixed-seed regression per size; `docs/routes-spec.md` §2.

### Step 5 — Per-map levels & cap

- [x] **The map's level range is the band.** Wild encounters and trainer rosters
  read `levelRangeForMap` (rooms ramp `minLevel → maxLevel`), the player's cap is
  the map's `maxLevel` (`levelCapForMap`), and an evolution the cap blocks waits
  for the next map instead of being clamped. `bandForRoute`/`levelCapForRoute`
  are gone; the rosters stay RNG-free and their fixed-seed tests pin the band.

### Step 6 — Run state: floors & discovery

- [x] **`RunState` tracks the floor and its fog of discovery.** `mapIndex`,
  `routeInMap` and `discoveredRooms` sit beside the global `routeIndex`;
  `advanceRoute` moves a room while `advanceMap` changes floor and carries the
  heal stop (HP/PP only, never a resurrection), and a save migration lands the new
  fields. Pure tests, including the discovery rule; `docs/maps-spec.md` §2/§9.

### Step 7 — Boss & portal

- [x] **The boss seals the exit and opens the portal (`D31`).** The room farthest
  from the entry fields the map boss at the map's `maxLevel`; its portal is carved
  from the start on a free wall and stays **sealed** while the boss stands, so the
  room looks identical before and after, and stepping through it once it opens
  advances the run to the next map. A finite run's last map holds the **final
  boss** and no portal, so beating it wins the run; infinite mode reopens the
  portal forever. Pure guard/portal logic + `RouteScene` wiring.

### Step 8 — Route HUD minimap

- [x] **The route HUD header is the floor minimap (`src/ui/mapView.ts`, `D32`).**
  `buildMapView` lays out a Binding of Isaac-style grid of the **discovered**
  rooms — a cell per room from its own width/height with its openings on the
  matching walls, a link drawn only once **both** its ends are known, the current
  room highlighted, the boss marked and the open portal flagged — and `RouteScene`
  only scales and paints it. A room stays hidden until it is entered, so the floor
  reveals itself as the run advances. Pure layout + tests; `docs/maps-spec.md` §8.

### Step 9 — Mega Evolution in battle (`D34`)

- [x] **Mega Evolution is a battle mechanic (`src/engine/battle/mega.ts`).** A
  Pokémon holding its **Mega Stone** may Mega Evolve **once per battle** from the
  command menu's **MEGA** control: confirming it arms the evolution and the next
  FIGHT spends it while still attacking that turn, and the forme is applied
  **before any move**, so the turn reads the Mega's Speed, type and ability. Both
  the player and the AI can Mega Evolve, and only bosses, mini-bosses and the
  `ace` archetype carry stones. Every dex Mega ships — **88** formes in
  `src/data/dex/megas.json`, the nonstandard ones included — each with its own
  `held` stone in `src/data/items.ts`. `docs/battle-spec.md` §9; fixed-seed tests
  in `mega.test.ts`, `megas.test.ts` and `roster.test.ts`.

`[Task-17]` is the docs/migration pass that closes the phase: it finishes
`docs/maps-spec.md`, carries the shipped numbers into `docs/design-spec.md`,
`docs/routes-spec.md`, `docs/battle-spec.md` and `AGENTS.md`, fixes the stale
`D##` counts, and writes this archive.
