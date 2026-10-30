import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { getItem } from '../../data/items';
import { getMission } from '../../data/missions';
import { barredMovesFor, legalMoveIndices } from '../../engine/battle/commands';
import {
  createFighter,
  snapshotFighter,
  type BattleFighter,
  type BoostId,
} from '../../engine/battle/fighter';
import { scriptedBattle } from '../../engine/battle/harness';
import { createBattle, type BattleEvent, type BattleState } from '../../engine/battle/state';
import { performSwitch } from '../../engine/battle/turn';
import { biomeForMap } from '../../engine/maps/plan';
import { POKEVIAL_MAX_CHARGES } from '../../engine/run/heal';
import { missionMet } from '../../engine/run/missions';
import { experienceFraction } from '../../engine/run/progression';
import { createRun, squadLevel, type RunState } from '../../engine/run/state';
import { Rng } from '../../engine/rng';
import { setLocale, t } from '../../i18n';
import { battleFrames } from '../feed';
import { hpFraction, statusAbbreviation } from '../metrics';
import { partyRow } from '../partyScreen';
import {
  advanceBattleDisplay,
  battleDisplayOf,
  projectHud,
  syncHud,
  type HudBattleBagRow,
  type HudBattleDisplay,
  type HudState,
} from './state';

const starter = {
  fighter: snapshotFighter(
    createFighter({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['ember', 'scratch', 'growl'],
    }),
  ),
};

function freshRun(): RunState {
  return createRun({ seed: 'task-123', starter });
}

function fighter(id: string, speciesId: string, moves: readonly string[]): BattleFighter {
  return createFighter({ id, speciesId, level: 5, moves });
}

function battleWith(
  options: Readonly<{
    player: BattleFighter[];
    enemy: BattleFighter[];
    isWild: boolean;
    double?: boolean;
    noHeal?: boolean;
    bag?: readonly string[];
  }>,
): BattleState {
  return createBattle({
    player: options.player,
    enemy: options.enemy,
    rng: new Rng(1),
    isWild: options.isWild,
    ...(options.double ? { double: true } : {}),
    ...(options.noHeal ? { noHeal: true } : {}),
    bag: (options.bag ?? []).map((itemId, index) => ({
      item: getItem(itemId)!,
      count: index + 1,
    })),
  });
}

function singleBattle(): BattleState {
  return battleWith({
    player: [fighter('player-1', 'charmander', ['ember', 'scratch'])],
    enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
    isWild: true,
    bag: ['pokeball', 'potion'],
  });
}

function bagRow(state: HudState, itemId: string): HudBattleBagRow {
  const row = state.battle?.bag.find((entry) => entry.itemId === itemId);
  if (!row) throw new Error(`no bag row for ${itemId}`);
  return row;
}

/** A battle whose stages are set on the fighters, the way a stat change leaves them. */
function stagedBattle(
  boosts: Readonly<Partial<Record<BoostId, number>>>,
  options: Readonly<{ foe?: Readonly<Partial<Record<BoostId, number>>>; double?: boolean }> = {},
): BattleState {
  const battle = battleWith({
    player: options.double
      ? [fighter('player-1', 'charmander', ['ember']), fighter('player-2', 'squirtle', ['watergun'])]
      : [fighter('player-1', 'charmander', ['ember'])],
    enemy: [
      fighter('enemy-1', 'bulbasaur', ['tackle']),
      ...(options.double ? [fighter('enemy-2', 'geodude', ['tackle'])] : []),
    ],
    isWild: true,
    ...(options.double ? { double: true } : {}),
  });
  Object.assign(battle.sides.player.party[0].boosts, boosts);
  if (options.foe !== undefined) Object.assign(battle.sides.enemy.party[0].boosts, options.foe);
  return battle;
}

/** Every stat at stage 0: the vector a battle's beat opens on. */
const NO_BOOSTS = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 } as const;

/** The damage events of a log, in the order the engine wrote them. */
function damageEvents(log: readonly BattleEvent[]): Extract<BattleEvent, { kind: 'damage' }>[] {
  return log.filter(
    (event): event is Extract<BattleEvent, { kind: 'damage' }> => event.kind === 'damage',
  );
}

/**
 * One fixed-seed scripted turn whose foe is the faster side: the enemy Rattata
 * strikes before the player's Charmander can reply, so the log's first damage is
 * the player's and the reply's is the foe's.
 */
function fasterFoeTurn(moves: Readonly<{ player: string; enemy: string }>): Readonly<{
  battle: BattleState;
  opening: HudBattleDisplay;
}> {
  const openings: (HudBattleDisplay | undefined)[] = [];
  const battle = scriptedBattle({
    player: [{ id: 'player-1', speciesId: 'charmander', level: 5, moves: [moves.player] }],
    enemy: [{ id: 'enemy-1', speciesId: 'rattata', level: 5, moves: [moves.enemy] }],
    seed: 2026,
    turnCap: 1,
    playerCommand: (state) => {
      openings.push(battleDisplayOf(state));
      return { type: 'fight', moveIndex: 0 };
    },
    enemyCommand: () => ({ type: 'fight', moveIndex: 0 }),
  });
  const opening = openings[0];
  if (opening === undefined) throw new Error('the scripted turn never opened');
  return { battle, opening };
}

/** Walks a battle's log one frame at a time, returning the beat after each frame. */
function walkFrames(battle: BattleState, opening: HudBattleDisplay): HudBattleDisplay[] {
  const seen: HudBattleDisplay[] = [];
  let display = opening;
  for (const frame of battleFrames(battle.log)) {
    display = advanceBattleDisplay(battle, display, frame.events);
    seen.push(display);
  }
  return seen;
}

describe('projectHud on the route', () => {
  it('projects a fresh run into a JSON-safe snapshot', () => {
    const run = freshRun();
    const state = projectHud({ screen: 'route', run, notice: null });

    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
    expect(state.money).toBe(0);
    expect(typeof state.money).toBe('number');
    expect(state.battle).toBeNull();
    expect(state.route).not.toBeNull();
    const route = state.route!;
    expect(route.pokevialCharges).toBe(3);
    expect(route.pokevialMax).toBe(POKEVIAL_MAX_CHARGES);
    expect(route.squadLevel).toBe(5);
    expect(route.xpFraction).toBe(0);
    expect(route.biomeId).toBe('forest');
    expect(route.biomeName).toBe('Deep Forest');
    expect(state.party).toHaveLength(1);
    expect(state.party[0].hpFraction).toBe(1);
  });

  it('derives each route field from the run and from nowhere else', () => {
    const base = freshRun();
    const missionRow = getMission('flawless')!;
    const notice = { text: 'hello', holdMs: 1000 };
    const run: RunState = {
      ...base,
      mode: 'infinite',
      mapIndex: 2,
      routeInMap: 3,
      levelCap: 12,
      xp: 250,
      pokevialCharges: 1,
      bossDefeated: true,
      discoveredRooms: [0, 2, 3],
      money: 1234,
      bag: [
        { itemId: 'potion', count: 2 },
        { itemId: 'mystery', count: 1 },
      ],
      mission: { id: 'flawless', progress: 0, completed: false },
      missionsCompleted: 2,
      stats: { catches: 3, casualties: 1 },
    };
    const state = projectHud({ screen: 'route', run, notice });
    const route = state.route!;
    const level = squadLevel(run);
    const row = partyRow(run.party[0]);

    expect(state.money).toBe(run.money);
    expect(state.notice).toBe(notice);
    expect(route.mode).toBe(run.mode);
    expect(route.mapIndex).toBe(run.mapIndex);
    expect(route.routeInMap).toBe(run.routeInMap);
    expect(route.routeIndex).toBe(run.routeIndex);
    expect(route.biomeId).toBe(biomeForMap(run.seed, run.mapIndex));
    expect(route.biomeName).toBe(getBiome(route.biomeId).name);
    expect(route.levelCap).toBe(run.levelCap);
    expect(route.squadLevel).toBe(level);
    expect(route.xp).toBe(run.xp);
    expect(route.xpFraction).toBe(experienceFraction(run.xp, level));
    expect(route.pokevialCharges).toBe(run.pokevialCharges);
    expect(route.pokevialMax).toBe(POKEVIAL_MAX_CHARGES);
    expect(route.bossDefeated).toBe(run.bossDefeated);
    expect(route.discoveredRooms).toStrictEqual(run.discoveredRooms);
    expect(route.mission).toStrictEqual({
      id: 'flawless',
      name: t(missionRow.nameKey),
      met: missionMet(run),
    });
    expect(route.missionsCompleted).toBe(run.missionsCompleted);
    expect(route.stats).toStrictEqual(run.stats);
    expect(route.stats.catches).toBe(3);
    expect(route.stats.casualties).toBe(1);

    expect(state.party[0]).toStrictEqual({
      ...row,
      hpFraction: hpFraction(row.hp, row.maxHp),
    });
    expect(state.party[0].name).toBe('Charmander');
    expect(state.bag).toStrictEqual([
      { itemId: 'potion', name: 'Potion', count: 2, category: 'consumable' },
      { itemId: 'mystery', name: 'mystery', count: 1, category: null },
    ]);
  });

  it('copies every array it hands out', () => {
    const base = freshRun();
    const run: RunState = {
      ...base,
      bag: [{ itemId: 'potion', count: 2 }],
      discoveredRooms: [0, 1],
    };
    const state = projectHud({ screen: 'route', run, notice: null });
    const route = state.route!;

    expect(state.party).not.toBe(run.party);
    expect(state.bag).not.toBe(run.bag);
    expect(route.discoveredRooms).not.toBe(run.discoveredRooms);
    expect(route.discoveredRooms).toStrictEqual(run.discoveredRooms);
    expect(route.stats).not.toBe(run.stats);
    expect(state.party[0]).not.toBe(run.party[0]);
  });

  it('does not touch the run', () => {
    const base = freshRun();
    const run: RunState = {
      ...base,
      money: 480,
      xp: 300,
      pokevialCharges: 2,
      bag: [{ itemId: 'potion', count: 1 }],
    };
    const party = run.party;
    const hp = run.party.map((member) => member.fighter.hp);
    const pp = run.party.map((member) => member.fighter.moves.map((slot) => slot.pp));

    projectHud({ screen: 'route', run, notice: null });
    projectHud({ screen: 'route', run, notice: null });
    syncHud({ screen: 'route', run, notice: null }, () => {});

    expect(run.money).toBe(480);
    expect(run.xp).toBe(300);
    expect(run.pokevialCharges).toBe(2);
    expect(run.party).toBe(party);
    expect(run.party[0]).toBe(party[0]);
    expect(run.party.map((member) => member.fighter.hp)).toStrictEqual(hp);
    expect(run.party.map((member) => member.fighter.moves.map((slot) => slot.pp))).toStrictEqual(pp);
  });
});

describe('projectHud in battle', () => {
  it('projects a single battle with one active a side', () => {
    const battle = singleBattle();
    const state = projectHud({ screen: 'battle', battle, canCapture: true });

    expect(state.route).toBeNull();
    expect(state.money).toBeNull();
    expect(state.party).toHaveLength(0);
    expect(state.bag).toHaveLength(0);
    expect(state.notice).toBeNull();
    expect(state.battle).not.toBeNull();
    const snapshot = state.battle!;
    expect(snapshot.sides.player.actives).toHaveLength(1);
    expect(snapshot.sides.player.actives[0].slot).toBe(0);
    expect(snapshot.sides.player.actives[0].moves).toHaveLength(2);
    expect(snapshot.sides.enemy.actives[0].moves).toHaveLength(0);
    expect(snapshot.sides.player.party[0].hpFraction).toBe(1);
    expect(snapshot.turn).toBe(battle.turn);
    expect(snapshot.isWild).toBe(true);
    expect(snapshot.winner).toBeNull();
    expect(snapshot.weather).toBeNull();
    expect(snapshot.terrain).toBeNull();
    expect(snapshot.fog).toBe(false);
    expect(snapshot.noHeal).toBe(false);
    expect(snapshot.noFlee).toBe(false);
    expect(snapshot.bannedSpecies).toBeNull();
    expect(snapshot.sides.player.name).toBe(battle.sides.player.name);
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });

  it('fields two actives a side in a double battle', () => {
    const battle = battleWith({
      player: [
        fighter('player-1', 'charmander', ['ember']),
        fighter('player-2', 'squirtle', ['watergun']),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle']), fighter('enemy-2', 'geodude', ['tackle'])],
      isWild: false,
      double: true,
    });
    const state = projectHud({ screen: 'battle', battle, canCapture: false });
    const snapshot = state.battle!;

    expect(snapshot.double).toBe(true);
    expect(snapshot.sides.player.actives.map((active) => active.slot)).toStrictEqual([0, 1]);
    expect(snapshot.sides.enemy.actives.map((active) => active.slot)).toStrictEqual([0, 1]);
    expect(snapshot.sides.player.actives[0].moves.length).toBeGreaterThan(0);
    expect(snapshot.sides.player.actives[1].moves.length).toBeGreaterThan(0);
    expect(snapshot.sides.enemy.actives[1].moves).toHaveLength(0);
  });

  it("marks the switchable rows and only the player's", () => {
    const battle = battleWith({
      player: [
        fighter('player-1', 'charmander', ['ember']),
        fighter('player-2', 'squirtle', ['watergun']),
        fighter('player-3', 'geodude', ['tackle']),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: false,
    });
    const state = projectHud({ screen: 'battle', battle, canCapture: false });
    const snapshot = state.battle!;

    expect(snapshot.sides.player.party[0].canSwitchTo).toBe(false);
    expect(snapshot.sides.player.party[1].canSwitchTo).toBe(true);
    expect(snapshot.sides.player.party[2].canSwitchTo).toBe(true);
    for (const row of snapshot.sides.enemy.party) {
      expect(row.canSwitchTo).toBe(false);
    }
  });

  it("carries the move menu's usable flags from legalMoveIndices", () => {
    const battle = singleBattle();
    const active = battle.sides.player.party[0];
    active.moves[0].pp = 0;
    const state = projectHud({ screen: 'battle', battle, canCapture: true });
    const moves = state.battle!.sides.player.actives[0].moves;
    const expected = active.moves.map((_, index) =>
      legalMoveIndices(active, barredMovesFor(battle, 'player')).includes(index),
    );

    expect(moves.map((move) => move.usable)).toStrictEqual(expected);
    expect(moves[0].usable).toBe(false);
    expect(moves[1].usable).toBe(true);
    expect(moves[0].pp).toBe(0);
  });

  it("carries the battle bag's usability", () => {
    const wild = battleWith({
      player: [fighter('player-1', 'charmander', ['ember'])],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: true,
      bag: ['pokeball', 'potion', 'choicescarf', 'nugget'],
    });
    const state = projectHud({ screen: 'battle', battle: wild, canCapture: true });
    expect(bagRow(state, 'pokeball').usable).toBe(true);
    expect(bagRow(state, 'pokeball').category).toBe('ball');
    expect(bagRow(state, 'potion').usable).toBe(true);
    expect(bagRow(state, 'potion').category).toBe('consumable');
    expect(bagRow(state, 'choicescarf').usable).toBe(false);
    expect(bagRow(state, 'choicescarf').category).toBe('equipment');
    expect(bagRow(state, 'nugget').usable).toBe(false);
    expect(bagRow(state, 'nugget').category).toBe('valuable');

    const noCapture = projectHud({ screen: 'battle', battle: wild, canCapture: false });
    expect(bagRow(noCapture, 'pokeball').usable).toBe(false);

    const trainer = battleWith({
      player: [fighter('player-1', 'charmander', ['ember'])],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: false,
      bag: ['pokeball', 'potion'],
    });
    const trainerState = projectHud({ screen: 'battle', battle: trainer, canCapture: true });
    expect(bagRow(trainerState, 'pokeball').usable).toBe(false);
    expect(bagRow(trainerState, 'potion').usable).toBe(true);

    const noHeal = battleWith({
      player: [fighter('player-1', 'charmander', ['ember'])],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: true,
      noHeal: true,
      bag: ['pokeball', 'potion', 'choicescarf', 'nugget'],
    });
    const noHealState = projectHud({ screen: 'battle', battle: noHeal, canCapture: true });
    expect(noHealState.battle!.noHeal).toBe(true);
    expect(noHealState.battle!.bag.every((row) => !row.usable)).toBe(true);
  });

  it('emits once through syncHud', () => {
    const run = freshRun();
    const seen: HudState[] = [];
    const returned = syncHud({ screen: 'route', run, notice: null }, (next) => {
      seen.push(next);
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(returned);
    expect(projectHud({ screen: 'route', run, notice: null })).toStrictEqual(
      projectHud({ screen: 'route', run, notice: null }),
    );

    const battle = singleBattle();
    const emitted: HudState[] = [];
    const fromBattle = syncHud({ screen: 'battle', battle, canCapture: true }, (next) => {
      emitted.push(next);
    });
    expect(emitted).toStrictEqual([fromBattle]);
  });

  it('names a mission the floor has met', () => {
    const missionRow = getMission('flawless')!;
    const base = freshRun();
    const clean: RunState = { ...base, hpLost: 0, floorCasualties: 0 };
    const met = projectHud({ screen: 'route', run: clean, notice: null }).route!.mission!;

    expect(met.name).toBe(t(missionRow.nameKey));
    expect(met.met).toBe(true);

    const wounded: RunState = { ...clean, stats: { ...clean.stats, casualties: 1 } };
    const lost = projectHud({ screen: 'route', run: wounded, notice: null }).route!.mission!;
    expect(lost.met).toBe(false);

    const unknown: RunState = {
      ...clean,
      mission: { id: 'no-such-mission', progress: 0, completed: false },
    };
    expect(projectHud({ screen: 'route', run: unknown, notice: null }).route!.mission).toStrictEqual({
      id: 'no-such-mission',
      name: 'no-such-mission',
      met: true,
    });
  });
});

describe('projectHud stat stages', () => {
  it('carries the non-zero stages in BOOST_IDS order, each with its label', () => {
    const battle = stagedBattle({ atk: 2, spe: -1 });
    const lead = projectHud({ screen: 'battle', battle, canCapture: true }).battle!.sides.player
      .actives[0]!;

    expect(lead.stages).toStrictEqual([
      { stat: 'atk', label: 'ATK', stage: 2 },
      { stat: 'spe', label: 'SPE', stage: -1 },
    ]);
  });

  it('carries no stage at all while every stage is zero', () => {
    const state = projectHud({ screen: 'battle', battle: singleBattle(), canCapture: true });

    expect(state.battle!.sides.player.actives[0]!.stages).toStrictEqual([]);
  });

  it('gives every active and both sides their own list', () => {
    const battle = stagedBattle({ def: -3 }, { foe: { spa: 1, accuracy: -2 }, double: true });
    Object.assign(battle.sides.player.party[1].boosts, { evasion: 6 });
    const snapshot = projectHud({ screen: 'battle', battle, canCapture: true }).battle!;

    expect(
      snapshot.sides.player.actives.map((active) => active.stages.map((row) => row.stat)),
    ).toStrictEqual([['def'], ['evasion']]);
    expect(snapshot.sides.player.actives[0]!.stages[0]).toStrictEqual({
      stat: 'def',
      label: 'DEF',
      stage: -3,
    });
    expect(snapshot.sides.player.actives[1]!.stages[0]).toStrictEqual({
      stat: 'evasion',
      label: 'EVA',
      stage: 6,
    });
    expect(snapshot.sides.enemy.actives[0]!.stages).toStrictEqual([
      { stat: 'spa', label: 'SPA', stage: 1 },
      { stat: 'accuracy', label: 'ACC', stage: -2 },
    ]);
  });

  it('resolves the chip labels through the locale table', () => {
    const battle = stagedBattle({ atk: 1, spe: 2 });
    setLocale('es');
    try {
      const lead = projectHud({ screen: 'battle', battle, canCapture: true }).battle!.sides.player
        .actives[0]!;
      const labels = lead.stages.map((row) => t(`battle.stage.${row.stat}`));

      expect(labels).toStrictEqual(['ATA', 'VEL']);
      expect(lead.stages.map((row) => row.label)).toStrictEqual(labels);
    } finally {
      setLocale('en');
    }
  });

  it('is pure: the same battle and locale deep-equal', () => {
    const battle = stagedBattle({ atk: 2, spe: -1 });
    const first = projectHud({ screen: 'battle', battle, canCapture: true });
    const second = projectHud({ screen: 'battle', battle, canCapture: true });

    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(battle.sides.player.party[0].boosts.atk).toBe(2);
  });
});

describe('battleDisplayOf', () => {
  it("opens on each live slot's hp, maxHp, status and a zeroed boost vector", () => {
    const battle = battleWith({
      player: [
        fighter('player-1', 'charmander', ['ember']),
        fighter('player-2', 'squirtle', ['watergun']),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle']), fighter('enemy-2', 'geodude', ['tackle'])],
      isWild: false,
      double: true,
    });
    const partner = battle.sides.player.party[1];
    partner.status = 'brn';
    partner.boosts.spe = -2;
    const display = battleDisplayOf(battle);
    const lead = battle.sides.player.party[0];

    expect(display.player[0]).toStrictEqual({
      hp: lead.hp,
      maxHp: lead.maxHp,
      status: null,
      boosts: NO_BOOSTS,
    });
    expect(display.player[1]).toStrictEqual({
      hp: partner.hp,
      maxHp: partner.maxHp,
      status: 'brn',
      boosts: { ...NO_BOOSTS, spe: -2 },
    });
    expect(display.enemy[0]?.status).toBe(battle.sides.enemy.party[0].status);
    expect(display.enemy[1]?.hp).toBe(battle.sides.enemy.party[1].hp);
    expect(JSON.parse(JSON.stringify(display))).toStrictEqual(display);
    expect(display.player[1]?.boosts).not.toBe(partner.boosts);
  });

  it('leaves the second slot empty in a single battle', () => {
    const display = battleDisplayOf(singleBattle());

    expect(display.player).toHaveLength(2);
    expect(display.enemy).toHaveLength(2);
    expect(display.player[1]).toBeNull();
    expect(display.enemy[1]).toBeNull();
    expect(display.player[0]?.hp).toBe(display.player[0]?.maxHp);
  });

  it('hands out copies, never the fighter itself', () => {
    const battle = singleBattle();
    const display = battleDisplayOf(battle);
    const lead = battle.sides.player.party[0];

    expect(display.player[0]?.boosts).not.toBe(lead.boosts);
    expect(display.player[0]?.boosts).toStrictEqual(lead.boosts);
    lead.boosts.atk = 3;
    lead.hp = 1;

    expect(display.player[0]?.boosts.atk).toBe(0);
    expect(display.player[0]?.hp).toBe(lead.maxHp);
  });
});

describe('advanceBattleDisplay', () => {
  it("lands each side's HP on the line that reports it, in the engine's own order", () => {
    const { battle, opening } = fasterFoeTurn({ player: 'scratch', enemy: 'tackle' });
    const damages = damageEvents(battle.log);

    expect(damages).toHaveLength(2);
    expect(damages[0].side).toBe('player');
    expect(damages[1].side).toBe('enemy');
    expect(opening.player[0]?.hp).toBe(opening.player[0]?.maxHp);

    const seen = walkFrames(battle, opening);
    const foeHitFrame = battleFrames(battle.log).findIndex((frame) => frame.events.includes(damages[0]));
    const replyFrame = battleFrames(battle.log).findIndex((frame) => frame.events.includes(damages[1]));

    expect(foeHitFrame).toBeGreaterThan(0);
    expect(replyFrame).toBeGreaterThan(foeHitFrame);
    expect(seen[foeHitFrame - 1].player[0]?.hp).toBe(opening.player[0]?.hp);
    expect(seen[foeHitFrame].player[0]?.hp).toBe(damages[0].hp);
    expect(seen[foeHitFrame].enemy[0]?.hp).toBe(opening.enemy[0]?.hp);
    expect(seen[replyFrame].enemy[0]?.hp).toBe(damages[1].hp);
    expect(seen[replyFrame].player[0]?.hp).toBe(damages[0].hp);
    expect(seen[replyFrame].enemy[0]?.hp).not.toBe(opening.enemy[0]?.hp);
  });

  it("moves a stage to the event's absolute value on its own frame and no earlier one", () => {
    const { battle, opening } = fasterFoeTurn({ player: 'growl', enemy: 'tackle' });
    const boosts = battle.log.filter(
      (event): event is Extract<BattleEvent, { kind: 'boost' }> => event.kind === 'boost',
    );

    expect(boosts).toHaveLength(1);
    const seen = walkFrames(battle, opening);
    const boostFrame = battleFrames(battle.log).findIndex((frame) => frame.events.includes(boosts[0]));

    expect(boostFrame).toBeGreaterThan(0);
    for (let index = 0; index < boostFrame; index++) {
      expect(seen[index].enemy[0]?.boosts.atk).toBe(0);
    }
    expect(seen[boostFrame].enemy[0]?.boosts[boosts[0].stat]).toBe(boosts[0].stages);
    expect(seen[boostFrame].enemy[0]?.boosts[boosts[0].stat]).toBe(
      battle.sides.enemy.party[0].boosts[boosts[0].stat],
    );
  });

  it('faints one slot and leaves the other side where it was', () => {
    const battle = battleWith({
      player: [
        fighter('player-1', 'charmander', ['ember']),
        fighter('player-2', 'squirtle', ['watergun']),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: true,
    });
    const opening = battleDisplayOf(battle);
    const lead = battle.sides.enemy.party[0];
    const maxHp = lead.maxHp;
    const playerHp = opening.player[0]?.hp;
    lead.hp = 0;

    const fainted = advanceBattleDisplay(battle, opening, [
      { kind: 'damage', side: 'enemy', amount: maxHp, hp: 0, maxHp, effectiveness: 1, crit: false },
      { kind: 'faint', side: 'enemy', fighterId: lead.id },
    ]);

    expect(fainted.enemy[0]).toStrictEqual({ hp: 0, maxHp, status: null, boosts: NO_BOOSTS });
    expect(fainted.enemy[1]).toBeNull();
    expect(fainted.player[0]?.hp).toBe(playerHp);
  });

  it('repoints a slot to the incoming fighter on its switch event', () => {
    const battle = battleWith({
      player: [
        fighter('player-1', 'charmander', ['ember']),
        fighter('player-2', 'squirtle', ['watergun']),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: true,
    });
    const opening = battleDisplayOf(battle);
    const incoming = battle.sides.player.party[1];
    incoming.hp = incoming.maxHp - 3;
    incoming.status = 'psn';
    incoming.boosts.atk = 2;
    const from = battle.log.length;
    performSwitch(battle, 'player', 1);
    const events = battle.log.slice(from);

    expect(events.some((event) => event.kind === 'switch')).toBe(true);
    const after = advanceBattleDisplay(battle, opening, events);

    expect(after.player[0]).toStrictEqual({
      hp: incoming.hp,
      maxHp: incoming.maxHp,
      status: 'psn',
      boosts: { ...NO_BOOSTS, atk: 2 },
    });
    expect(after.player[1]).toBeNull();
    expect(after.enemy[0]?.hp).toBe(opening.enemy[0]?.hp);
  });

  it('hands back the same beat when a frame changes no HP, status or stage', () => {
    const battle = singleBattle();
    battle.sides.player.party[0].hp = 12;
    const display = battleDisplayOf(battle);

    const same = advanceBattleDisplay(battle, display, [
      { kind: 'turn', turn: 2 },
      { kind: 'move', side: 'player', moveId: 'ember' },
      { kind: 'text', key: 'battle.log.used' },
      { kind: 'run', side: 'player', success: false },
    ]);

    expect(same).toStrictEqual(display);
    expect(same).toBe(display);
  });

  it('never mutates the beat it is handed', () => {
    const battle = battleWith({
      player: [fighter('player-1', 'charmander', ['ember'])],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: true,
    });
    const opening = battleDisplayOf(battle);
    const before = JSON.parse(JSON.stringify(opening));
    battle.sides.enemy.party[0].hp = 4;
    battle.sides.enemy.party[0].boosts.def = -1;

    advanceBattleDisplay(battle, opening, [
      { kind: 'damage', side: 'enemy', amount: 3, hp: 4, maxHp: 19, effectiveness: 1, crit: false },
      { kind: 'boost', side: 'enemy', stat: 'def', stages: -1 },
    ]);

    expect(JSON.parse(JSON.stringify(opening))).toStrictEqual(before);
  });
});

describe('projectHud with a beat', () => {
  it('paints the actives from the beat and keeps the live species, level and party rows', () => {
    const battle = battleWith({
      player: [
        fighter('player-1', 'charmander', ['ember', 'scratch']),
        fighter('player-2', 'squirtle', ['watergun']),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle'])],
      isWild: true,
    });
    const display = battleDisplayOf(battle);
    const lead = display.player[0];
    if (lead === null || lead === undefined) throw new Error('the lead is on the field');
    const beaten: HudBattleDisplay = {
      ...display,
      player: [
        { ...lead, hp: 7, status: 'brn', boosts: { ...lead.boosts, atk: 2 } },
        display.player[1] ?? null,
      ],
    };

    const state = projectHud({ screen: 'battle', battle, canCapture: true, display: beaten });
    const active = state.battle!.sides.player.actives[0]!;
    const live = battle.sides.player.party[0];

    expect(active.hp).toBe(7);
    expect(active.maxHp).toBe(live.maxHp);
    expect(active.hpFraction).toBe(hpFraction(7, live.maxHp));
    expect(active.status).toBe('brn');
    expect(active.statusLabel).toBe(statusAbbreviation('brn'));
    expect(active.stages).toStrictEqual([{ stat: 'atk', label: 'ATK', stage: 2 }]);
    expect(active.speciesId).toBe(live.speciesId);
    expect(active.level).toBe(live.level);
    expect(active.name).toBe(live.name);
    expect(active.moves).toHaveLength(2);
    expect(active.canSwitchTo).toBe(false);
    expect(state.battle!.sides.player.party[0]!.hp).toBe(live.hp);
    expect(state.battle!.sides.player.party[0]!.hpFraction).toBe(hpFraction(live.hp, live.maxHp));
    expect(state.battle!.sides.player.party[1]!.canSwitchTo).toBe(true);
  });

  it('equals the live projection when it is given no beat', () => {
    const battle = singleBattle();
    battle.sides.player.party[0].hp = 9;

    expect(projectHud({ screen: 'battle', battle, canCapture: true })).toStrictEqual(
      projectHud({ screen: 'battle', battle, canCapture: true, display: battleDisplayOf(battle) }),
    );
  });

  it('also emits through syncHud with a beat', () => {
    const battle = singleBattle();
    const display = battleDisplayOf(battle);
    const seen: HudState[] = [];

    const emitted = syncHud({ screen: 'battle', battle, canCapture: true, display }, (next) => {
      seen.push(next);
    });

    expect(seen).toStrictEqual([emitted]);
    expect(emitted.battle!.sides.player.actives[0]!.hp).toBe(display.player[0]?.hp);
  });
});

describe('advanceBattleDisplay in a double battle', () => {
  it('picks the slot whose displayed HP moves by the event amount', () => {
    const battle = battleWith({
      player: [
        createFighter({ id: 'player-1', speciesId: 'charmander', level: 5, moves: ['ember'] }),
        createFighter({ id: 'player-2', speciesId: 'squirtle', level: 9, moves: ['watergun'] }),
      ],
      enemy: [fighter('enemy-1', 'bulbasaur', ['tackle']), fighter('enemy-2', 'geodude', ['tackle'])],
      isWild: false,
      double: true,
    });
    const display = battleDisplayOf(battle);
    const partnerMax = display.player[1]!.maxHp;
    const leadHp = display.player[0]!.hp;
    expect(partnerMax).not.toBe(display.player[0]!.maxHp);
    battle.sides.player.party[1].hp = 5;

    const after = advanceBattleDisplay(battle, display, [
      {
        kind: 'damage',
        side: 'player',
        amount: partnerMax - 5,
        hp: 5,
        maxHp: partnerMax,
        effectiveness: 1,
        crit: false,
      },
    ]);

    expect(after.player[0]?.hp).toBe(leadHp);
    expect(after.player[1]?.hp).toBe(5);
    expect(after.enemy[0]?.hp).toBe(display.enemy[0]?.hp);
  });
});
