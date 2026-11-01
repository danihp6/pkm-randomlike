import { describe, expect, it } from 'vitest';
import battleHpFixture from '../../../../../design/fixtures/05-battle-hud.json';
import screenSpec from '../../../../../design/screens/05-battle-hud.json';
import { createFighter, type BoostId } from '../../../../engine/battle/fighter';
import { createBattle } from '../../../../engine/battle/state';
import { Rng } from '../../../../engine/rng';
import { projectHud, type HudState } from '../../state';
import { gapFor, gapIsEmpty, type ScreenSpec } from '../../specGap';
import { buildView, slug } from '../../specGap.views/battle-hp';
import { battleHpBox, battleHpStages, foeBallRow } from './view';

/**
 * The `05 Battle HUD` spec gap, measured: what the battle HP view claims (one plate, no
 * string, no colour) and the numbers it deliberately does not claim — the player plate's
 * 14 px, the 16 px ball row, the stage grid's anchor — read against the frame's own spec.
 */

const DESKTOP = { width: 1280, height: 800 };
const SPEC: ScreenSpec = screenSpec;
const SINGLE = { enemy: false, player: false };
const FOE_SPECIES = ['bulbasaur', 'geodude', 'machop'] as const;
const STAGE_ORDER: readonly BoostId[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy'];

/** A trainer battle whose foe fields `size` members, with `boosts` on the player's lead. */
function battleState(
  size: number,
  boosts: Readonly<Partial<Record<BoostId, number>>> = {},
): HudState {
  const battle = createBattle({
    player: [createFighter({ id: 'player-1', speciesId: 'charmander', level: 5, moves: ['ember'] })],
    enemy: FOE_SPECIES.slice(0, size).map((speciesId, index) =>
      createFighter({ id: `enemy-${index + 1}`, speciesId, level: 5, moves: ['tackle'] }),
    ),
    rng: new Rng(243),
    isWild: false,
  });
  Object.assign(battle.sides.player.party[0]!.boosts, boosts);
  return projectHud({ screen: 'battle', battle, canCapture: false });
}

const frameBox = (name: string): Readonly<{ x: number; y: number; w: number; h: number }> => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame carries no box named ${name}`);
  return { x: box.x, y: box.y, w: box.width, h: box.height };
};

describe('the 05 Battle HUD adapter', () => {
  it('answers for its own screen and claims the one plate the frame and the panel agree on', () => {
    expect(slug).toBe('05-battle-hud');
    expect(buildView(SPEC).boxes).toStrictEqual([
      { name: 'foe panel', x: 64, y: 48, w: 368, h: 100 },
    ]);
    expect(buildView(SPEC).boxes[0]).toStrictEqual({
      name: 'foe panel',
      ...battleHpBox(DESKTOP, 'enemy', 0),
    });
    expect(frameBox('foe panel')).toStrictEqual({ x: 64, y: 48, w: 368, h: 100 });
  });

  it('claims no string and no colour, because the fixture carries no battle', () => {
    const view = buildView(SPEC);

    expect(battleHpFixture.state.battle).toBeNull();
    expect(view.strings).toStrictEqual([]);
    expect(view.colours).toStrictEqual([]);
    expect(SPEC.boxes).toHaveLength(99);
    expect(SPEC.text).toHaveLength(44);
    expect(SPEC.colours).toHaveLength(33);
  });

  it('reports no gap against its own spec', () => {
    expect(gapFor(buildView(SPEC), SPEC)).toStrictEqual({
      missing: [],
      moved: [],
      strings: [],
      colours: [],
    });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });

  it('claims nothing for a frame that does not name the plate', () => {
    const unnamed: ScreenSpec = { ...SPEC, boxes: SPEC.boxes.filter((box) => box.name !== 'foe panel') };

    expect(buildView(unnamed).boxes).toStrictEqual([]);
    expect(gapIsEmpty(gapFor(buildView(unnamed), unnamed))).toBe(true);
  });

  it('records the player plate 14 px below the frame, on the shared bottom line', () => {
    const plate = battleHpBox(DESKTOP, 'player', 0);
    const frame = frameBox('player panel');

    expect(frame).toStrictEqual({ x: 64, y: 660, w: 368, h: 100 });
    expect(plate).toStrictEqual({ x: 64, y: 674, w: 368, h: 100 });
    expect(plate.x).toBe(frame.x);
    expect(plate.w).toBe(frame.w);
    expect(plate.h).toBe(frame.h);
    expect(plate.y - frame.y).toBe(14);
  });

  it('records the 16 px ball row the panel draws under a 24 px board cell', () => {
    const row = foeBallRow(battleState(2), DESKTOP);

    expect(row.balls.map((ball) => ball.box)).toStrictEqual([
      { x: 64, y: 156, w: 16, h: 16 },
      { x: 84, y: 156, w: 16, h: 16 },
    ]);
    expect(row.balls[1]!.box.x - row.balls[0]!.box.x).toBe(20);
    expect(row.box).toStrictEqual({ x: 64, y: 156, w: 36, h: 16 });

    const board = frameBox('foe party ball 1');
    expect(board).toStrictEqual({ x: 88, y: 160, w: 24, h: 24 });
    expect(frameBox('foe party ball 2').x - board.x).toBe(28);
  });

  it('records the stage grid right-aligned to the plate, not on the board origin', () => {
    const boosts: Partial<Record<BoostId, number>> = {};
    for (const stat of STAGE_ORDER) boosts[stat] = 1;
    const grid = battleHpStages(battleState(1, boosts), DESKTOP, SINGLE).box;

    expect(grid).toStrictEqual({ x: 318, y: 592, w: 114, h: 74 });
    expect(frameBox('stat stages')).toStrictEqual({ x: 448, y: 673, w: 114, h: 74 });
  });
});
