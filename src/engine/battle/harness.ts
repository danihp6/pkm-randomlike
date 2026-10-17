import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { legalMoveIndices, type Command } from './commands';
import { createFighter, type BattleFighter } from './fighter';
import { activeFighter, createBattle, type BattleEvent, type BattleState } from './state';
import { autoReplace, needsReplacement, takeTurn } from './turn';

/**
 * The reusable **scripted battle** the golden log and the AI regressions run on:
 * one seeded `BattleState` driven by two command policies, with the engine's own
 * replacement rule between turns. Pure (`src/engine/` carries no Phaser import)
 * and deterministic — the harness seeds the one `Rng` and adds no draw of its own,
 * so a fixed seed and fixed teams reproduce a fixed log (`D11`).
 */

/** One team member, in the shape the harness builds a fighter from. */
export interface HarnessFighterSpec {
  readonly id: string;
  readonly speciesId: string;
  readonly level: number;
  /** Default `'serious'` (the golden battle's own nature). */
  readonly nature?: string;
  /** Explicit slots; omitted means `createFighter`'s own default moveset. */
  readonly moves?: readonly string[];
}

export interface ScriptedBattleOptions {
  /** At least one member. */
  readonly player: readonly HarnessFighterSpec[];
  readonly enemy: readonly HarnessFighterSpec[];
  /** The `Rng` seed. Default 2026 — the golden battle's seed. */
  readonly seed?: number;
  /** Default `true` (the golden battle is a wild one). */
  readonly isWild?: boolean;
  /** The loop's guard, in turns. Default 50. */
  readonly turnCap?: number;
  /**
   * The player's command for a turn. Default: the first legal fight move
   * (`legalMoveIndices(activeFighter(state, 'player'))[0] ?? 0`).
   */
  readonly playerCommand?: (state: BattleState, turn: number) => Command;
  /** The enemy's command for a turn. Default `chooseAiCommand(state, 'enemy')`. */
  readonly enemyCommand?: (state: BattleState, turn: number) => Command;
}

const DEFAULT_SEED = 2026;
const DEFAULT_TURN_CAP = 50;

function buildFighter(spec: HarnessFighterSpec): BattleFighter {
  return createFighter({
    id: spec.id,
    speciesId: spec.speciesId,
    level: spec.level,
    nature: spec.nature ?? 'serious',
    ...(spec.moves ? { moves: spec.moves } : {}),
  });
}

function firstLegalMove(state: BattleState): Command {
  const legal = legalMoveIndices(activeFighter(state, 'player'));
  return { type: 'fight', moveIndex: legal[0] ?? 0 };
}

function aiCommand(state: BattleState): Command {
  return chooseAiCommand(state, 'enemy');
}

/**
 * Runs the battle to its end (or to `turnCap`) and returns the final state, whose
 * `log` is the whole scripted battle. Replaces a fainted active before each turn,
 * exactly as the golden battle does.
 */
export function scriptedBattle(options: ScriptedBattleOptions): BattleState {
  const turnCap = options.turnCap ?? DEFAULT_TURN_CAP;
  const playerCommand = options.playerCommand ?? firstLegalMove;
  const enemyCommand = options.enemyCommand ?? aiCommand;
  const state = createBattle({
    player: options.player.map(buildFighter),
    enemy: options.enemy.map(buildFighter),
    rng: new Rng(options.seed ?? DEFAULT_SEED),
    isWild: options.isWild ?? true,
  });

  for (let turn = 0; state.winner === null && turn < turnCap; turn++) {
    if (needsReplacement(state).length > 0) autoReplace(state);
    takeTurn(state, playerCommand(state, turn + 1), enemyCommand(state, turn + 1));
  }
  return state;
}

/** The battle log as text, one line per event — the golden snapshot's own formatter. */
export function formatBattleLog(state: BattleState): string {
  return state.log
    .map((event: BattleEvent): string => {
      switch (event.kind) {
        case 'turn':
          return `# turn ${event.turn}`;
        case 'text':
          return event.text;
        case 'move':
          return `  > ${event.side} ${event.moveId}`;
        case 'damage':
          return `  = ${event.side} -${event.amount} (${event.hp}/${event.maxHp}${event.crit ? ' crit' : ''}${event.effectiveness !== 1 ? ` x${event.effectiveness}` : ''})`;
        case 'heal':
          return `  = ${event.side} +${event.amount} (${event.hp}/${event.maxHp})`;
        case 'boost':
          return `  = ${event.side} ${event.stat} ${event.stages > 0 ? '+' : ''}${event.stages}`;
        case 'status':
          return `  = ${event.side} ${event.status}`;
        case 'cure':
          return `  = ${event.side} cured ${event.status}`;
        case 'faint':
          return `  = ${event.side} fainted`;
        case 'switch':
          return `  = ${event.side} sent ${event.fighterId}`;
        case 'mega':
          return `  = ${event.side} mega ${event.fighterId}`;
        case 'gmax':
          return `  = ${event.side} gmax ${event.fighterId}`;
        case 'forme':
          return `  = ${event.side} forme ${event.fighterId}`;
        case 'item':
          return `  = ${event.side} used ${event.itemId}`;
        case 'capture':
          return `  = capture ${event.success ? 'success' : 'fail'} (${event.shakes})`;
        case 'run':
          return `  = run ${event.success ? 'success' : 'fail'}`;
        case 'end':
          return `# end ${event.winner}`;
      }
    })
    .join('\n');
}
