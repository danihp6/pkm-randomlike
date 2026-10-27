import { describe, expect, it } from 'vitest';
import { BARRED_HEALING_MOVES } from '../../data/noHeal';
import { getItem } from '../../data/items';
import { getMove } from '../../data/dex';
import { Rng } from '../rng';
import {
  barredMovesFor,
  chargingCommand,
  findMoveIndex,
  legalMoveIndices,
  replacementOwed,
  selectedMove,
  targetStepFor,
  useBagItem,
  validateCommand,
  type Command,
} from './commands';
import { createFighter, type FighterInput } from './fighter';
import { activeFighter, createBattle, type BattleState } from './state';
import { performSwitch, takeDoubleTurn } from './turn';

const make = (input: FighterInput) => createFighter(input);

const build = (
  playerMoves: readonly string[],
  enemyMoves: readonly string[],
  isWild = true,
  bag: readonly { itemId: string; count: number }[] = [],
): BattleState =>
  createBattle({
    player: [make({ id: 'player', speciesId: 'charmander', level: 20, moves: playerMoves })],
    enemy: [make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: enemyMoves })],
    rng: new Rng(1),
    isWild,
    bag: bag.map((slot) => ({ item: getItem(slot.itemId)!, count: slot.count })),
  });

describe('move selection', () => {
  it('lists only moves with PP, honouring Encore', () => {
    const state = build(['ember', 'growl'], ['tackle']);
    const fighter = state.sides.player.party[0];
    expect(legalMoveIndices(fighter)).toEqual([0, 1]);
    fighter.moves[0].pp = 0;
    expect(legalMoveIndices(fighter)).toEqual([1]);
  });

  it('falls back to Struggle when every move is spent', () => {
    const state = build(['ember', 'growl'], ['tackle']);
    const fighter = state.sides.player.party[0];
    fighter.moves.forEach((slot) => (slot.pp = 0));
    expect(selectedMove(fighter, { type: 'fight', moveIndex: 0 })?.move.id).toBe('struggle');
  });
});

describe('validateCommand', () => {
  const fight = (moveIndex = 0): Command => ({ type: 'fight', moveIndex });

  it('rejects an out-of-range or spent move', () => {
    const state = build(['ember', 'growl'], ['tackle']);
    expect(validateCommand(state, 'player', fight(4))).toBe('There is no such move.');
    state.sides.player.party[0].moves[0].pp = 0;
    expect(validateCommand(state, 'player', fight(0))).toBe('That move has no PP left.');
  });

  it('rejects a ball in a trainer battle', () => {
    const state = build(['ember'], ['tackle'], false, [{ itemId: 'pokeball', count: 1 }]);
    expect(validateCommand(state, 'player', { type: 'bag', itemId: 'pokeball' })).toBe(
      'Ball: cannot be used in a trainer battle.',
    );
  });

  it('requires a replacement before anything else', () => {
    const state = build(['ember'], ['tackle']);
    state.sides.player.party[0].hp = 0;
    state.sides.player.awaitingReplacement = true;
    expect(validateCommand(state, 'player', fight(0))).toBe('A replacement must be sent out first.');
  });

  it('refuses a route-only item, keeping the shipped verdicts (Task-103)', () => {
    const bag = [
      { itemId: 'candyred', count: 1 },
      { itemId: 'exorcistbottle', count: 1 },
      { itemId: 'weatherbottle', count: 1 },
      { itemId: 'medicbottle', count: 1 },
      { itemId: 'potion', count: 1 },
      { itemId: 'leftovers', count: 1 },
    ];
    const state = build(['ember'], ['tackle'], true, bag);
    state.sides.player.party[0].hp = 1;
    for (const id of ['candyred', 'exorcistbottle', 'weatherbottle', 'medicbottle']) {
      expect(validateCommand(state, 'player', { type: 'bag', itemId: id }), id).toBe(
        'Only usable on the route.',
      );
    }
    expect(validateCommand(state, 'player', { type: 'bag', itemId: 'potion' })).toBeNull();
    expect(validateCommand(state, 'player', { type: 'bag', itemId: 'leftovers' })).toBe(
      'Held items can only be used while held.',
    );
  });
});

describe('replacementOwed', () => {
  const withReserve = (): BattleState =>
    createBattle({
      player: [
        make({ id: 'player', speciesId: 'charmander', level: 20, moves: ['tackle'] }),
        make({ id: 'reserve', speciesId: 'squirtle', level: 20, moves: ['tackle'] }),
      ],
      enemy: [
        make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }),
        make({ id: 'foe2', speciesId: 'geodude', level: 20, moves: ['tackle'] }),
      ],
      rng: new Rng(1),
      isWild: true,
    });

  it('tracks the player side from a fresh board through the replacement', () => {
    const state = withReserve();
    expect(replacementOwed(state)).toBe(false);

    state.sides.player.party[0].hp = 0;
    takeDoubleTurn(state, {}, {});
    expect(state.sides.player.awaitingReplacement).toBe(true);
    expect(replacementOwed(state)).toBe(true);

    performSwitch(state, 'player', 1);
    expect(state.sides.player.awaitingReplacement).toBe(false);
    expect(replacementOwed(state)).toBe(false);
  });

  it('stays false with no reserve left, where the run ends instead', () => {
    const state = build(['tackle'], ['tackle']);
    state.sides.player.party[0].hp = 0;
    takeDoubleTurn(state, {}, {});
    expect(state.winner).toBe('enemy');
    expect(state.sides.player.awaitingReplacement).toBe(false);
    expect(replacementOwed(state)).toBe(false);
  });

  it('answers for the player only, never an enemy that owes one', () => {
    const state = withReserve();
    state.sides.enemy.party[0].hp = 0;
    takeDoubleTurn(state, {}, {});
    expect(state.sides.enemy.awaitingReplacement).toBe(true);
    expect(replacementOwed(state)).toBe(false);
  });
});

describe('chargingCommand', () => {
  const board = (): BattleState =>
    createBattle({
      player: [
        make({ id: 'player', speciesId: 'dugtrio', level: 20, moves: ['dig', 'tackle', 'growl'] }),
        make({ id: 'reserve', speciesId: 'squirtle', level: 20, moves: ['tackle'] }),
      ],
      enemy: [
        make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }),
        make({ id: 'foe2', speciesId: 'geodude', level: 20, moves: ['tackle'] }),
      ],
      rng: new Rng(1),
      isWild: true,
    });

  it('answers nothing while the lead is not charging', () => {
    expect(chargingCommand(board(), 'player')).toBeNull();
  });

  it('hands back the charge move as the turn it is locked into', () => {
    const state = board();
    state.sides.player.party[0].volatiles.charging = 'dig';
    expect(chargingCommand(state, 'player')).toEqual({ type: 'fight', moveIndex: 0 });
    const command = chargingCommand(state, 'player');
    expect(Object.keys(command ?? {}).sort()).toEqual(['moveIndex', 'type']);
  });

  it('names the slot the charge move actually sits in', () => {
    const state = board();
    state.sides.player.party[0].volatiles.charging = 'growl';
    expect(chargingCommand(state, 'player')).toEqual({ type: 'fight', moveIndex: 2 });
  });

  it('answers nothing when the locked move left the moveset', () => {
    const state = board();
    state.sides.player.party[0].volatiles.charging = 'fly';
    expect(chargingCommand(state, 'player')).toBeNull();
  });

  it('answers nothing while the side owes a replacement', () => {
    const state = board();
    state.sides.player.party[0].volatiles.charging = 'dig';
    state.sides.player.awaitingReplacement = true;
    expect(chargingCommand(state, 'player')).toBeNull();
  });

  it('answers nothing once the battle is over', () => {
    const state = board();
    state.sides.player.party[0].volatiles.charging = 'dig';
    state.winner = 'player';
    expect(chargingCommand(state, 'player')).toBeNull();
  });

  it('reads its own side only', () => {
    const state = board();
    state.sides.enemy.party[0].volatiles.charging = 'tackle';
    expect(chargingCommand(state, 'player')).toBeNull();
    expect(chargingCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
  });
});

describe('useBagItem', () => {
  it('heals and consumes the item', () => {
    const state = build(['ember'], ['tackle'], true, [{ itemId: 'potion', count: 2 }]);
    const fighter = state.sides.player.party[0];
    fighter.hp = fighter.maxHp - 5;
    expect(useBagItem(state, 'player', 'potion')).toBe(true);
    expect(fighter.hp).toBe(fighter.maxHp);
    expect(state.bag[0].count).toBe(1);
  });

  it('captures a wild Pokémon with a ball and ends the battle', () => {
    const state = build(['ember'], ['tackle'], true, [{ itemId: 'masterball', count: 1 }]);
    expect(useBagItem(state, 'player', 'masterball')).toBe(true);
    expect(state.winner).toBe('player');
    expect(state.bag.length).toBe(0);
    expect(state.log.some((event) => event.kind === 'capture' && event.success)).toBe(true);
  });
});

/** A battle with the room rule on or off, and an optional bag. */
const buildRoom = (
  playerMoves: readonly string[],
  enemyMoves: readonly string[],
  bag: readonly { itemId: string; count: number }[] = [],
  noHeal = true,
): BattleState =>
  createBattle({
    player: [make({ id: 'player', speciesId: 'charmander', level: 20, moves: playerMoves })],
    enemy: [make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: enemyMoves })],
    rng: new Rng(1),
    isWild: true,
    ...(noHeal ? { noHeal: true } : {}),
    bag: bag.map((slot) => ({ item: getItem(slot.itemId)!, count: slot.count })),
  });

describe('move selection with a barred set', () => {
  it('leaves every move legal when nothing is barred', () => {
    const state = build(['synthesis', 'tackle'], ['tackle']);
    const fighter = state.sides.player.party[0];
    expect(legalMoveIndices(fighter)).toEqual([0, 1]);
    expect(legalMoveIndices(fighter, new Set())).toEqual([0, 1]);
  });

  it('drops the barred moves from the legal indices', () => {
    const state = build(['synthesis', 'tackle'], ['tackle']);
    const fighter = state.sides.player.party[0];
    expect(legalMoveIndices(fighter, new Set(['synthesis']))).toEqual([1]);
  });

  it('falls back to Struggle when every legal move is barred', () => {
    const state = build(['synthesis'], ['tackle']);
    const fighter = state.sides.player.party[0];
    const barred = new Set(BARRED_HEALING_MOVES);
    expect(legalMoveIndices(fighter, barred)).toEqual([]);
    expect(selectedMove(fighter, { type: 'fight', moveIndex: 0 }, barred)?.move.id).toBe('struggle');
  });

  it('never picks a barred move, even when its slot is the one asked for', () => {
    const state = build(['synthesis', 'tackle'], ['tackle']);
    const fighter = state.sides.player.party[0];
    const selected = selectedMove(fighter, { type: 'fight', moveIndex: 0 }, new Set(['synthesis']));
    expect(selected?.move.id).not.toBe('synthesis');
    expect(selected).toBeNull();
  });
});

describe('a no-heal battle', () => {
  const fight = (moveIndex = 0) => ({ type: 'fight', moveIndex }) as const;

  it('starts with the room rule as its first log line', () => {
    const state = buildRoom(['synthesis', 'tackle'], ['tackle']);
    expect(state.noHeal).toBe(true);
    expect(state.log[0]).toEqual({
      kind: 'text',
      key: 'battle.log.roomNoHeal',
    });
  });

  it('leaves the flag off, and the log clear, outside the room', () => {
    const state = buildRoom(['synthesis', 'tackle'], ['tackle'], [], false);
    expect(state.noHeal).toBe(false);
    expect(state.log.some((event) => event.kind === 'text')).toBe(false);
  });

  it('refuses the Bag for the player', () => {
    const state = buildRoom(['tackle'], ['tackle'], [{ itemId: 'potion', count: 1 }]);
    expect(validateCommand(state, 'player', { type: 'bag', itemId: 'potion' })).toBe(
      'No items can be used in this room.',
    );
    // The gate is `validateCommand`, so the bag stack is never spent.
    expect(state.bag).toHaveLength(1);
  });

  it('still refuses the enemy a Bag, unchanged', () => {
    const state = buildRoom(['tackle'], ['tackle']);
    expect(validateCommand(state, 'enemy', { type: 'bag', itemId: 'potion' })).toBe(
      'Only the player has a Bag.',
    );
  });

  it('refuses a barred move while another one is legal', () => {
    const state = buildRoom(['synthesis', 'tackle'], ['tackle']);
    expect(validateCommand(state, 'player', fight(0))).toBe('That move cannot be used in this room.');
    expect(validateCommand(state, 'player', fight(1))).toBeNull();
  });

  it('refuses a barred move anywhere in the list, not just the first', () => {
    const state = buildRoom(['recover', 'tackle'], ['tackle']);
    expect(validateCommand(state, 'player', fight(0))).toBe('That move cannot be used in this room.');
    state.sides.player.party[0].moves[0].moveId = 'drainpunch';
    expect(validateCommand(state, 'player', fight(0))).toBe('That move cannot be used in this room.');
  });

  it('lets the barred move through when it is the only one left, and resolves Struggle', () => {
    const state = buildRoom(['synthesis'], ['tackle']);
    expect(validateCommand(state, 'player', fight(0))).toBeNull();
    const fighter = activeFighter(state, 'player');
    const selected = selectedMove(fighter, { type: 'fight', moveIndex: 0 }, new Set(['synthesis']));
    expect(selected?.move.id).toBe('struggle');
    expect(selected?.slot).toBeNull();
  });

  it('lets the barred move through when every other move is spent', () => {
    const state = buildRoom(['synthesis', 'tackle'], ['tackle']);
    const fighter = activeFighter(state, 'player');
    fighter.moves[1].pp = 0;
    expect(validateCommand(state, 'player', fight(0))).toBeNull();
    // Nothing is legal, so the room's convention is the same as "No PP": Struggle.
    expect(selectedMove(fighter, { type: 'fight', moveIndex: 0 }, new Set(['synthesis']))?.move.id).toBe(
      'struggle',
    );
  });

  it('leaves the enemy’s own healing move legal', () => {
    const state = buildRoom(['tackle'], ['synthesis']);
    expect(validateCommand(state, 'enemy', fight(0))).toBeNull();
    const enemy = activeFighter(state, 'enemy');
    expect(legalMoveIndices(enemy, barredMovesFor(state, 'enemy'))).toEqual([0]);
    expect(
      selectedMove(enemy, { type: 'fight', moveIndex: 0 }, barredMovesFor(state, 'enemy'))?.move.id,
    ).toBe('synthesis');
  });

  it('bars nothing for the enemy, and nothing for the player outside the room', () => {
    const room = buildRoom(['synthesis', 'tackle'], ['synthesis']);
    expect(barredMovesFor(room, 'enemy').size).toBe(0);
    expect([...barredMovesFor(room, 'player')]).toEqual([...BARRED_HEALING_MOVES]);

    const open = buildRoom(['synthesis'], ['synthesis'], [], false);
    expect(barredMovesFor(open, 'player').size).toBe(0);
    expect(selectedMove(activeFighter(open, 'player'), fight())?.move.id).toBe('synthesis');
  });

  it('still spends a potion outside the room', () => {
    const outside = buildRoom(['tackle'], ['tackle'], [{ itemId: 'potion', count: 1 }], false);
    outside.sides.player.party[0].hp -= 5;
    expect(useBagItem(outside, 'player', 'potion')).toBe(true);
    expect(outside.bag).toHaveLength(0);
  });

  it('finds the indices a scene uses to disable the barred rows', () => {
    const state = buildRoom(['synthesis', 'tackle'], ['tackle']);
    const fighter = activeFighter(state, 'player');
    const barred = barredMovesFor(state, 'player');
    expect(findMoveIndex(fighter, 'synthesis')).toBe(0);
    expect(legalMoveIndices(fighter, barred)).toEqual([1]);
    expect(
      fighter.moves.map((slot, index) => ({
        id: slot.moveId,
        enabled: legalMoveIndices(fighter, barred).includes(index),
      })),
    ).toEqual([
      { id: 'synthesis', enabled: false },
      { id: 'tackle', enabled: true },
    ]);
  });
});

describe('the double-battle slots', () => {
  const buildDouble = (double: boolean): BattleState =>
    createBattle({
      player: [
        make({ id: 'player', speciesId: 'charmander', level: 20, moves: ['tackle', 'dazzlinggleam'] }),
        make({ id: 'partner', speciesId: 'squirtle', level: 20, moves: ['tackle'] }),
      ],
      enemy: [
        make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }),
        make({ id: 'foe2', speciesId: 'geodude', level: 20, moves: ['tackle'] }),
      ],
      rng: new Rng(1),
      isWild: false,
      double,
    });

  it('refuses a slot 1 command when the battle does not field it', () => {
    const state = buildDouble(false);
    const command: Command = { type: 'fight', moveIndex: 0, slot: 1 };
    expect(validateCommand(state, 'player', command)).toBe('There is no second active Pokémon.');
    expect(validateCommand(state, 'player', { type: 'switch', partyIndex: 1, slot: 1 })).toBe(
      'There is no second active Pokémon.',
    );
  });

  it('accepts both slots in a double battle and refuses an already active switch', () => {
    const state = buildDouble(true);
    expect(validateCommand(state, 'player', { type: 'fight', moveIndex: 0, slot: 1 })).toBeNull();
    expect(validateCommand(state, 'player', { type: 'switch', partyIndex: 1, slot: 0 })).toBe(
      'That Pokémon is already out.',
    );
  });

  it('accepts only a live opposing slot as a single-target target', () => {
    const state = buildDouble(true);
    const aimed = (target: { side: 'player' | 'enemy'; slot: 0 | 1 }): Command => ({
      type: 'fight',
      moveIndex: 0,
      target,
    });
    expect(validateCommand(state, 'player', aimed({ side: 'enemy', slot: 1 }))).toBeNull();
    expect(validateCommand(state, 'player', aimed({ side: 'player', slot: 1 }))).toBe(
      'That is not an opposing Pokémon.',
    );
    expect(validateCommand(state, 'player', aimed({ side: 'enemy', slot: 0 }))).toBeNull();
  });

  it('ignores the target of a spread move', () => {
    const state = buildDouble(false);
    const command: Command = {
      type: 'fight',
      moveIndex: 1,
      target: { side: 'enemy', slot: 1 },
    };
    expect(validateCommand(state, 'player', command)).toBeNull();
  });
});

describe('the target step', () => {
  const buildDouble = (double: boolean, secondFoe = true): BattleState =>
    createBattle({
      player: [
        make({ id: 'player', speciesId: 'charmander', level: 20, moves: ['ember', 'tackle'] }),
        make({ id: 'partner', speciesId: 'squirtle', level: 20, moves: ['tackle'] }),
      ],
      enemy: [
        make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }),
        ...(secondFoe ? [make({ id: 'foe2', speciesId: 'geodude', level: 20, moves: ['tackle'] })] : []),
      ],
      rng: new Rng(1),
      isWild: false,
      double,
    });

  const move = (id: string) => getMove(id)!;

  it('owes the step for a single-target damaging move over two standing foes', () => {
    expect(targetStepFor(buildDouble(true), 'player', move('ember'))).toBe(true);
    expect(targetStepFor(buildDouble(true), 'player', move('tackle'))).toBe(true);
  });

  it('skips it with one standing foe, a single battle, or no move at all', () => {
    const oneFoe = buildDouble(true, false);
    expect(targetStepFor(oneFoe, 'player', move('ember'))).toBe(false);
    const fainted = buildDouble(true);
    fainted.sides.enemy.party[1].hp = 0;
    expect(targetStepFor(fainted, 'player', move('ember'))).toBe(false);
    expect(targetStepFor(buildDouble(false), 'player', move('ember'))).toBe(false);
    expect(targetStepFor(buildDouble(true), 'player', null)).toBe(false);
  });

  it('skips it for every spread target the dex declares', () => {
    const state = buildDouble(true);
    expect(targetStepFor(state, 'player', move('dazzlinggleam'))).toBe(false);
    expect(targetStepFor(state, 'player', move('earthquake'))).toBe(false);
  });

  it('skips it for a status move, and for a self or ally one', () => {
    const state = buildDouble(true);
    expect(targetStepFor(state, 'player', move('toxic'))).toBe(false);
    expect(targetStepFor(state, 'player', move('growl'))).toBe(false);
    expect(targetStepFor(state, 'player', { ...move('tackle'), target: 'self' })).toBe(false);
    expect(targetStepFor(state, 'player', { ...move('tackle'), target: 'ally' })).toBe(false);
  });

  it('reads the opposing side of the side it was asked about', () => {
    const state = buildDouble(true);
    expect(targetStepFor(state, 'enemy', move('ember'))).toBe(true);
    state.sides.player.party[1].hp = 0;
    expect(targetStepFor(state, 'enemy', move('ember'))).toBe(false);
  });
});
