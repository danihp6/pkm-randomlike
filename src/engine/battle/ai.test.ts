import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { HARD_MODE_FLAGS, chooseAiCommand } from './ai';
import { legalMoveIndices } from './commands';
import { createFighter, type FighterInput } from './fighter';
import { formatBattleLog, scriptedBattle } from './harness';
import { activeFighter, createBattle, type BattleState } from './state';

const SEED = 1;

const build = (
  player: readonly FighterInput[],
  enemy: readonly FighterInput[],
  options: Readonly<{ seed?: number; isWild?: boolean }> = {},
): BattleState =>
  createBattle({
    player: player.map((input) => createFighter(input)),
    enemy: enemy.map((input) => createFighter(input)),
    rng: new Rng(options.seed ?? SEED),
    isWild: options.isWild ?? false,
  });

/** A level-20 Rock/Ground lead, so a weak enemy move scores a handful of points. */
const PLAYER_LEAD: FighterInput = { id: 'p', speciesId: 'geodude', level: 20, moves: ['tackle'] };

/** A level-1 Charmander: its Tackle scores 2 through the expected value. */
const WEAK_FOE = (moves: readonly string[]): FighterInput => ({
  id: 'e',
  speciesId: 'charmander',
  level: 1,
  moves,
});

const movesOf = (state: BattleState, side: 'player' | 'enemy'): readonly string[] =>
  activeFighter(state, side).moves.map((slot) => slot.moveId);

describe('chooseAiCommand', () => {
  it('picks the super effective move', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 5, moves: ['tackle'] }],
      [{ id: 'e', speciesId: 'charmander', level: 50, moves: ['ember', 'growl'] }],
    );
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
  });

  it('falls back to the first move when everything is spent', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
      [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember'] }],
    );
    state.sides.enemy.party[0].moves.forEach((slot) => (slot.pp = 0));
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
  });

  it('switches when the active Pokémon cannot hurt the foe', () => {
    const state = build(
      [{ id: 'p', speciesId: 'geodude', level: 20, moves: ['tackle'] }],
      [
        { id: 'e1', speciesId: 'geodude', level: 20, moves: ['thundershock'] },
        { id: 'e2', speciesId: 'charmander', level: 20, moves: ['ember'] },
      ],
    );
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'switch', partyIndex: 1 });
  });

  it('replaces a fainted active with the healthiest reserve', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
      [
        { id: 'e1', speciesId: 'charmander', level: 20, moves: ['ember'] },
        { id: 'e2', speciesId: 'geodude', level: 20, moves: ['tackle'] },
      ],
    );
    state.sides.enemy.party[0].hp = 0;
    state.sides.enemy.awaitingReplacement = true;
    const command = chooseAiCommand(state, 'enemy');
    expect(command.type).toBe('switch');
    if (command.type === 'switch') expect(command.partyIndex).toBe(1);
  });

  it('defaults to the normal difficulty with no flags', () => {
    const state = build([PLAYER_LEAD], [WEAK_FOE(['tackle', 'thunderwave'])]);
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
    expect(HARD_MODE_FLAGS).toEqual(['checkBadMove', 'tryToFaint', 'checkViability']);
    expect(movesOf(state, 'enemy')).toEqual(['tackle', 'thunderwave']);
  });
});

describe('the AI flags', () => {
  it('checkBadMove refuses a boost the Pokémon is already capped at', () => {
    const board = (): BattleState => {
      const state = build([PLAYER_LEAD], [WEAK_FOE(['swordsdance', 'tackle'])]);
      activeFighter(state, 'enemy').boosts.atk = 6;
      return state;
    };
    // With the guard off the capped Swords Dance still scores 40 and beats Tackle.
    expect(chooseAiCommand(board(), 'enemy', { flags: ['checkViability'] })).toEqual({
      type: 'fight',
      moveIndex: 0,
    });
    expect(chooseAiCommand(board(), 'enemy', { flags: ['checkViability', 'checkBadMove'] })).toEqual({
      type: 'fight',
      moveIndex: 1,
    });
  });

  it('checkBadMove refuses a status that cannot land and a heal at full HP', () => {
    // Thunder Wave cannot paralyse an Electric type and Recover heals nothing at
    // full HP: the viability rungs already score both 0, and the guard states the
    // same rule explicitly, so neither board changes its pick.
    const boards: readonly Readonly<{ lead: FighterInput; move: string }>[] = [
      { lead: { id: 'p', speciesId: 'pikachu', level: 20, moves: ['tackle'] }, move: 'thunderwave' },
      { lead: PLAYER_LEAD, move: 'recover' },
    ];
    for (const { lead, move } of boards) {
      const state = build([lead], [WEAK_FOE(['tackle', move])]);
      expect(
        chooseAiCommand(state, 'enemy', { flags: ['checkViability', 'checkBadMove'] }),
      ).toEqual({ type: 'fight', moveIndex: 0 });
      expect(chooseAiCommand(state, 'enemy', { flags: ['checkViability'] })).toEqual({
        type: 'fight',
        moveIndex: 0,
      });
    }
  });

  it('tryToFaint takes a move that would faint the foe over a status move worth 60', () => {
    const board = (): BattleState => {
      const state = build(
        [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
        [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['tackle', 'thunderwave'] }],
      );
      // 5 HP: Tackle's 10 points faint, and on their own they are worth less than
      // the 60 a status move is.
      state.sides.player.party[0].hp = 5;
      return state;
    };
    expect(chooseAiCommand(board(), 'enemy', { flags: ['checkViability'] })).toEqual({
      type: 'fight',
      moveIndex: 1,
    });
    expect(
      chooseAiCommand(board(), 'enemy', { flags: ['checkViability', 'tryToFaint'] }),
    ).toEqual({ type: 'fight', moveIndex: 0 });
  });

  it('checkViability scores the status, boost, heal and volatile rungs', () => {
    const boards: readonly Readonly<{ moves: readonly string[]; index: number }>[] = [
      { moves: ['tackle', 'thunderwave'], index: 1 },
      { moves: ['tackle', 'swordsdance'], index: 1 },
      { moves: ['tackle', 'recover'], index: 1 },
      { moves: ['tackle', 'confuseray'], index: 1 },
    ];
    for (const board of boards) {
      const state = build([PLAYER_LEAD], [WEAK_FOE(board.moves)]);
      // Below a quarter of its pool, so the heal rung can score.
      const foe = state.sides.enemy.party[0];
      foe.hp = Math.max(1, Math.floor(foe.maxHp / 8));
      expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
      expect(chooseAiCommand(state, 'enemy', { flags: ['checkViability'] })).toEqual({
        type: 'fight',
        moveIndex: board.index,
      });
    }
  });

  it('setupFirstTurn boosts on turn 0 and not on turn 1', () => {
    const state = build([PLAYER_LEAD], [WEAK_FOE(['swordsdance', 'tackle'])]);
    expect(chooseAiCommand(state, 'enemy', { flags: ['setupFirstTurn'] })).toEqual({
      type: 'fight',
      moveIndex: 0,
    });
    state.turn = 1;
    expect(chooseAiCommand(state, 'enemy', { flags: ['setupFirstTurn'] })).toEqual({
      type: 'fight',
      moveIndex: 1,
    });
  });

  it('risky takes a self-destructing move on a close call', () => {
    const board = (): BattleState => build([PLAYER_LEAD], [WEAK_FOE(['selfdestruct', 'thunderwave'])]);
    expect(chooseAiCommand(board(), 'enemy', { flags: ['checkViability'] })).toEqual({
      type: 'fight',
      moveIndex: 1,
    });
    expect(chooseAiCommand(board(), 'enemy', { flags: ['checkViability', 'risky'] })).toEqual({
      type: 'fight',
      moveIndex: 0,
    });
  });

  it('preferBatonPass bails out only with a positive stage on the active', () => {
    const state = build([PLAYER_LEAD], [WEAK_FOE(['batonpass', 'tackle'])]);
    expect(chooseAiCommand(state, 'enemy', { flags: ['preferBatonPass'] })).toEqual({
      type: 'fight',
      moveIndex: 1,
    });
    activeFighter(state, 'enemy').boosts.atk = 1;
    expect(chooseAiCommand(state, 'enemy', { flags: ['preferBatonPass'] })).toEqual({
      type: 'fight',
      moveIndex: 0,
    });
  });
});

describe('the difficulty', () => {
  it('hard adds the trio to a trainer that carries no flags', () => {
    const state = build([PLAYER_LEAD], [WEAK_FOE(['tackle', 'thunderwave'])]);
    expect(chooseAiCommand(state, 'enemy', { level: 'normal' })).toEqual({
      type: 'fight',
      moveIndex: 0,
    });
    expect(chooseAiCommand(state, 'enemy', { level: 'hard' })).toEqual({
      type: 'fight',
      moveIndex: 1,
    });
  });

  it('hard keeps the flags the archetype already carries', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
      [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['tackle', 'thunderwave'] }],
    );
    state.sides.player.party[0].hp = 5;
    expect(chooseAiCommand(state, 'enemy', { level: 'hard', flags: ['checkViability'] })).toEqual({
      type: 'fight',
      moveIndex: 0,
    });
  });

  it('normal keeps the lowest index on a tie and spends no draw', () => {
    const state = build([PLAYER_LEAD], [WEAK_FOE(['tackle', 'scratch'])]);
    const twin = build([PLAYER_LEAD], [WEAK_FOE(['tackle', 'scratch'])]);
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
    expect(state.rng.next()).toBe(twin.rng.next());
  });

  it('hard draws the tie from the battle rng', () => {
    const state = build([PLAYER_LEAD], [WEAK_FOE(['tackle', 'scratch'])]);
    const twin = build([PLAYER_LEAD], [WEAK_FOE(['tackle', 'scratch'])]);
    const expected = twin.rng.int(0, 1);
    expect(chooseAiCommand(state, 'enemy', { level: 'hard' })).toEqual({
      type: 'fight',
      moveIndex: expected,
    });
  });
});

describe('the wild policy', () => {
  it('picks a random legal move, the same one for the same seed', () => {
    const board = (): BattleState =>
      build(
        [PLAYER_LEAD],
        [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember', 'growl'] }],
        { isWild: true },
      );
    const first = chooseAiCommand(board(), 'enemy');
    expect(chooseAiCommand(board(), 'enemy')).toEqual(first);
  });

  it('does not always pick the lowest legal index', () => {
    const picks = new Set<number>();
    for (let seed = 1; seed <= 8; seed++) {
      const state = build(
        [PLAYER_LEAD],
        [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember', 'growl'] }],
        { seed, isWild: true },
      );
      const command = chooseAiCommand(state, 'enemy');
      expect(command.type).toBe('fight');
      if (command.type === 'fight') picks.add(command.moveIndex);
    }
    expect(picks.has(1)).toBe(true);
    expect(picks.has(0)).toBe(true);
  });

  it('spends exactly one draw per turn', () => {
    const board = (): BattleState =>
      build(
        [PLAYER_LEAD],
        [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember', 'growl'] }],
        { isWild: true },
      );
    const state = board();
    const twin = board();
    const legal = legalMoveIndices(activeFighter(state, 'enemy'));
    expect(legal).toEqual([0, 1]);
    // The twin's next value is the one draw the AI owes; the one after it is the
    // value the battle stream sits on once the AI has spent exactly that draw.
    const pick = twin.rng.int(0, legal.length - 1);
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: pick });
    expect(state.rng.next()).toBe(twin.rng.next());
  });

  it('spends no draw at all when only one move has PP left', () => {
    const board = (): BattleState =>
      build([PLAYER_LEAD], [WEAK_FOE(['ember'])], { isWild: true });
    const state = board();
    const twin = board();
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
    expect(state.rng.next()).toBe(twin.rng.next());
  });

  it('leaves a trainer on the expected value even with a random-looking board', () => {
    const state = build(
      [PLAYER_LEAD],
      [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember', 'growl'] }],
    );
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
  });
});

describe('the switch rules', () => {
  const cannotHurt = (trapped: boolean): BattleState => {
    const state = build(
      [{ id: 'p', speciesId: 'geodude', level: 20, moves: ['tackle'] }],
      [
        { id: 'e1', speciesId: 'geodude', level: 20, moves: ['thundershock'] },
        { id: 'e2', speciesId: 'charmander', level: 20, moves: ['ember'] },
      ],
    );
    if (trapped) activeFighter(state, 'enemy').volatiles.trapped = true;
    return state;
  };

  it('swaps out a Pokémon that cannot hurt the foe for one that can', () => {
    expect(chooseAiCommand(cannotHurt(false), 'enemy')).toEqual({ type: 'switch', partyIndex: 1 });
  });

  it('never switches while trapped', () => {
    const command = chooseAiCommand(cannotHurt(true), 'enemy');
    expect(command.type).toBe('fight');
    if (command.type === 'fight') expect(command.moveIndex).toBe(0);
  });

  it('leaves on the turn Perish Song would claim the active', () => {
    const state = build(
      [{ id: 'p', speciesId: 'geodude', level: 20, moves: ['tackle'] }],
      [
        { id: 'e1', speciesId: 'charmander', level: 20, moves: ['ember'] },
        { id: 'e2', speciesId: 'squirtle', level: 20, moves: ['watergun'] },
      ],
    );
    activeFighter(state, 'enemy').volatiles.perish = 1;
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'switch', partyIndex: 1 });
    activeFighter(state, 'enemy').volatiles.trapped = true;
    expect(chooseAiCommand(state, 'enemy').type).toBe('fight');
  });
});

describe('the scripted battle (D11)', () => {
  it('drives the hard policy through the harness enemyCommand hook', () => {
    const run = (): string =>
      formatBattleLog(
        scriptedBattle({
          isWild: false,
          turnCap: 2,
          player: [{ id: 'p', speciesId: 'magikarp', level: 20, moves: ['splash'] }],
          enemy: [{ id: 'e', speciesId: 'charmander', level: 1, moves: ['tackle', 'thunderwave'] }],
          enemyCommand: (state) => chooseAiCommand(state, 'enemy', { level: 'hard' }),
        }),
      );
    const log = run();
    // `hard` handed the trainer checkViability: the 60-point status move wins.
    expect(log).toContain('  > enemy thunderwave');
    expect(log).toContain('# turn 2');
    expect(run()).toBe(log);
  });
});

describe('honesty', () => {
  it('never reads the opposing bench', () => {
    const player: readonly FighterInput[] = [
      { id: 'p1', speciesId: 'geodude', level: 20, moves: ['tackle'] },
      { id: 'p2', speciesId: 'magikarp', level: 5, moves: ['splash'] },
    ];
    const enemy: readonly FighterInput[] = [
      { id: 'e', speciesId: 'charmander', level: 20, moves: ['ember', 'growl'] },
    ];
    const honest = build(player, enemy);
    const meddled = build(player, enemy);
    const bench = meddled.sides.player.party[1];
    bench.speciesId = 'mewtwo';
    bench.hp = 0;
    bench.moves = [{ moveId: 'psychic', pp: 5, maxPp: 5 }];
    bench.boosts.atk = 6;
    bench.status = 'brn';
    expect(chooseAiCommand(meddled, 'enemy')).toEqual(chooseAiCommand(honest, 'enemy'));
  });
});
