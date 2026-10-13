import { describe, expect, it } from 'vitest';
import { getSpecies, statAtLevel } from '../../data/dex';
import { memberDetail } from '../../ui/partyDetail';
import type { BattleReturn, BattleOutcome } from './battleLink';
import { createRunPokemon, xpForLevel, type RunPokemon } from './progression';
import { resolveBattle, type BattleReward } from './resolve';
import { createRun, type RunState } from './state';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 3, moves: ['scratch'] });

function hurt(pokemon: RunPokemon, hp: number): RunPokemon {
  return { ...pokemon, fighter: { ...pokemon.fighter, hp } };
}

function returned(run: RunState, outcome: BattleOutcome, extra: Partial<BattleReturn> = {}): BattleReturn {
  return {
    outcome,
    message: 'done',
    player: run.party.map((member) => member.fighter),
    bag: run.bag,
    captured: null,
    ...extra,
  };
}

const wild: BattleReward = { enemyLevels: [4], isTrainer: false };

describe('resolveBattle', () => {
  it('awards XP to the squad on a win and adopts the bag', () => {
    const run = createRun({ seed: 's', starter, bag: [{ itemId: 'potion', count: 1 }] });
    const result = resolveBattle(run, returned(run, 'win', { bag: [{ itemId: 'pokeball', count: 2 }] }), wild);
    expect(result.run.bag).toEqual([{ itemId: 'pokeball', count: 2 }]);
    expect(result.run.xp).toBeGreaterThan(run.xp);
    expect(result.released).toEqual([]);
  });

  it('clamps a win at the map cap', () => {
    const run = createRun({ seed: 's', starter });
    const cap = run.levelCap;
    const result = resolveBattle(run, returned(run, 'win'), { enemyLevels: [999], isTrainer: false });
    expect(result.run.party[0].fighter.level).toBe(cap);
    expect(result.run.xp).toBe(xpForLevel(cap));
    expect(result.events).toContainEqual({ kind: 'capped', level: cap });
  });

  it('marks the trainer beaten on a trainer win', () => {
    const run = createRun({ seed: 's', starter });
    const reward: BattleReward = { enemyLevels: [4], isTrainer: true, trainerId: 'trainer-1-0' };
    const result = resolveBattle(run, returned(run, 'win'), reward);
    expect(result.run.defeatedTrainers).toEqual(['trainer-1-0']);
  });

  it('earns a Pokevial charge for a new trainer win and never twice', () => {
    const run = { ...createRun({ seed: 's', starter }), pokevialCharges: 0 };
    const reward: BattleReward = { enemyLevels: [4], isTrainer: true, trainerId: 'trainer-1-0' };
    const first = resolveBattle(run, returned(run, 'win'), reward);
    expect(first.run.pokevialCharges).toBe(1);
    const again = resolveBattle(first.run, returned(first.run, 'win'), reward);
    expect(again.run.pokevialCharges).toBe(1);
  });

  it('does not charge the Pokevial on a wild win', () => {
    const run = { ...createRun({ seed: 's', starter }), pokevialCharges: 0 };
    expect(resolveBattle(run, returned(run, 'win'), wild).run.pokevialCharges).toBe(0);
  });

  it('drops a trainer\'s money on a win, exactly once', () => {
    const run = createRun({ seed: 's', starter });
    const reward: BattleReward = { enemyLevels: [4], isTrainer: true, trainerId: 'trainer-1-0', money: 250 };
    const first = resolveBattle(run, returned(run, 'win'), reward);
    expect(first.run.money).toBe(250);
    const again = resolveBattle(first.run, returned(first.run, 'win'), reward);
    expect(again.run.money).toBe(250);
  });

  it('drops no money on a wild win or a trainer loss', () => {
    const run = createRun({ seed: 's', starter });
    expect(resolveBattle(run, returned(run, 'win'), wild).run.money).toBe(0);
    const reward: BattleReward = { enemyLevels: [4], isTrainer: true, trainerId: 'trainer-1-0', money: 250 };
    expect(resolveBattle(run, returned(run, 'lose'), reward).run.money).toBe(0);
  });

  it('places a catch, spends the room capture and awards XP', () => {
    const run = createRun({ seed: 's', starter });
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const result = resolveBattle(run, returned(run, 'capture', { captured: caught.fighter }), wild);
    expect(result.run.capturedRooms).toContain(run.routeInMap);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['starter', 'catch-1']);
    expect(result.run.xp).toBeGreaterThan(run.xp);
    expect(result.run.stats.catches).toBe(1);
  });

  it('does not count a battle that was not a capture', () => {
    const run = createRun({ seed: 's', starter });
    expect(resolveBattle(run, returned(run, 'win'), wild).run.stats.catches).toBe(0);
  });

  it('folds a damaged catch at the share of health it had in the wild', () => {
    const run = createRun({ seed: 's', starter });
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 5 });
    const f = caught.fighter;
    const oldMax = statAtLevel(getSpecies('sentret')!, 5, f.nature, f.ivs, f.evs).hp;
    const damaged = { ...f, hp: Math.max(1, Math.floor(oldMax / 4)) };
    const result = resolveBattle(run, returned(run, 'capture', { captured: damaged }), wild);
    const placed = result.run.party.find((member) => member.fighter.id === 'catch-1');
    expect(placed).toBeDefined();
    const target = placed!.fighter.level;
    const newMax = statAtLevel(getSpecies('sentret')!, target, f.nature, f.ivs, f.evs).hp;
    expect(placed!.fighter.hp).toBe(Math.max(1, Math.round((damaged.hp / oldMax) * newMax)));
    expect(placed!.fighter.hp).toBeLessThan(newMax);
  });

  it('records where a catch was made', () => {
    const run = createRun({ seed: 's', starter });
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const catchLocation = { biomeId: 'forest', mapIndex: 1, routeInMap: 2 };
    const result = resolveBattle(run, returned(run, 'capture', { captured: caught.fighter }), wild, {
      catchLocation,
    });
    const placed = result.run.party.find((member) => member.fighter.id === 'catch-1');
    expect(placed?.caughtAt).toEqual(catchLocation);
  });

  it('defers the catch location with the capture screen', () => {
    const run = createRun({ seed: 's', starter });
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const catchLocation = { biomeId: 'forest', mapIndex: 2, routeInMap: 1 };
    const result = resolveBattle(run, returned(run, 'capture', { captured: caught.fighter }), wild, {
      placeCapture: false,
      catchLocation,
    });
    expect(result.captured?.fighter.id).toBe('catch-1');
    expect(result.captured?.caughtAt).toEqual(catchLocation);
    expect(result.run.party.some((member) => member.fighter.id === 'wild')).toBe(false);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['starter']);
  });

  it('counts every fainted member as a casualty', () => {
    const run = createRun({ seed: 's', starter });
    const reserve = createRunPokemon({ id: 'reserve', speciesId: 'squirtle', level: 4 });
    const two = { ...run, party: [run.party[0], reserve] };
    const result = resolveBattle(two, returned(two, 'lose', { player: [hurt(two.party[0], 0).fighter, hurt(reserve, 0).fighter] }), wild);
    expect(result.run.stats.casualties).toBe(2);
  });

  it('sends a catch to the box when the party is full', () => {
    const full: RunState = { ...createRun({ seed: 's', starter }), party: Array(6).fill(starter) };
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const result = resolveBattle(full, returned(full, 'capture', { captured: caught.fighter }), wild);
    expect(result.run.party).toHaveLength(6);
    expect(result.run.box.map((member) => member.fighter.id)).toEqual(['catch-1']);
  });

  it('re-keys every catch so a later one cannot shadow an earlier one', () => {
    let run = createRun({ seed: 'catch-a', starter });
    // What `BattleScene` sends for a `grass:x,y` encounter: both wild fighters carry
    // the constant id `wild`, so the run has to re-key each catch as it enters.
    const first = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const second = createRunPokemon({ id: 'wild', speciesId: 'pikachu', level: 3 });
    run = resolveBattle(run, returned(run, 'capture', { captured: first.fighter }), wild).run;
    run = resolveBattle(run, returned(run, 'capture', { captured: second.fighter }), wild).run;

    expect(run.party.map((member) => member.fighter.id)).toEqual(['starter', 'catch-1', 'catch-2']);
    // A first-match lookup would have answered both ids with the first catch.
    expect(memberDetail(run, run.party[1].fighter.id)?.name).toBe('Sentret');
    expect(memberDetail(run, run.party[2].fighter.id)?.name).toBe('Pikachu');
    expect(memberDetail(run, run.party[2].fighter.id)?.id).toBe('catch-2');
    expect(run.stats.catches).toBe(2);
  });

  it('mints the same ids when the same two catches are replayed', () => {
    const play = (): RunState => {
      let run = createRun({ seed: 'catch-a', starter });
      const first = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
      const second = createRunPokemon({ id: 'wild', speciesId: 'pikachu', level: 3 });
      run = resolveBattle(run, returned(run, 'capture', { captured: first.fighter }), wild).run;
      return resolveBattle(run, returned(run, 'capture', { captured: second.fighter }), wild).run;
    };
    const once = play();
    const again = play();
    expect(again.party.map((member) => member.fighter.id)).toEqual(['starter', 'catch-1', 'catch-2']);
    expect(again).toEqual(once);
    expect(again.stats.catches).toBe(2);
  });

  it('releases every fainted member on a loss', () => {
    const run = createRun({ seed: 's', starter });
    const wiped = { ...run, party: [hurt(starter, 0)] };
    const result = resolveBattle(wiped, returned(wiped, 'lose'), wild);
    expect(result.run.party).toEqual([]);
    expect(result.released.map((member) => member.fighter.id)).toEqual(['starter']);
    expect(result.events).toEqual([]);
  });

  it('adopts the party the battle returned, releasing what it fainted', () => {
    const run = createRun({ seed: 's', starter: createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5 }) });
    const reserve = createRunPokemon({ id: 'reserve', speciesId: 'squirtle', level: 4 });
    const two = { ...run, party: [run.party[0], reserve] };
    const result = resolveBattle(
      two,
      returned(two, 'win', {
        player: [hurt(two.party[0], 0).fighter, hurt(reserve, 3).fighter],
      }),
      wild,
    );
    expect(result.released.map((member) => member.fighter.id)).toEqual(['starter']);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['reserve']);
    expect(result.run.party[0].fighter.hp).toBe(3);
  });

  it('keeps the squad XP across the snapshot swap', () => {
    const run = createRun({ seed: 's', starter });
    const result = resolveBattle(run, returned(run, 'run'), wild);
    expect(result.run.xp).toBe(run.xp);
  });

  it('awards nothing when the player flees', () => {
    const run = createRun({ seed: 's', starter });
    const result = resolveBattle(run, returned(run, 'run'), wild);
    expect(result.run.party[0]).toEqual(starter);
    expect(result.events).toEqual([]);
  });
});
