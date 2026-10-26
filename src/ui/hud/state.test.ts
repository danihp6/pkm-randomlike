import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { getItem } from '../../data/items';
import { getMission } from '../../data/missions';
import { barredMovesFor, legalMoveIndices } from '../../engine/battle/commands';
import { createFighter, snapshotFighter, type BattleFighter } from '../../engine/battle/fighter';
import { createBattle, type BattleState } from '../../engine/battle/state';
import { biomeForMap } from '../../engine/maps/plan';
import { POKEVIAL_MAX_CHARGES } from '../../engine/run/heal';
import { missionMet } from '../../engine/run/missions';
import { experienceFraction } from '../../engine/run/progression';
import { createRun, squadLevel, type RunState } from '../../engine/run/state';
import { Rng } from '../../engine/rng';
import { t } from '../../i18n';
import { hpFraction } from '../metrics';
import { partyRow } from '../partyScreen';
import { projectHud, syncHud, type HudBattleBagRow, type HudState } from './state';

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
