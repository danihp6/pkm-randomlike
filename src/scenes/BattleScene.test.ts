import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { monIdleFrames } from './BattleScene';
import { pokemonSprite } from '../data/pokemonSprites';

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

/**
 * The scene draws with Phaser, so the one figure it owes the run cannot be played
 * headless: this reads the seam itself, the `src/ui/hud/panels/detail` precedent.
 * `battleTallies`' own arithmetic is covered by `src/engine/run/battleLink.test.ts`.
 */
const SOURCE = readFileSync(fileURLToPath(new URL('./BattleScene.ts', import.meta.url)), 'utf8');

describe('returnToRoute', () => {
  it('reads the tallies off the finished battle’s own log and player party', () => {
    const calls = SOURCE.match(
      /tallies: battleTallies\(this\.state\.log, this\.state\.sides\.player\.party\)/g,
    );
    expect(calls).toHaveLength(1);
  });

  it('imports the reader from the run engine, not from its own arithmetic', () => {
    expect(SOURCE).toContain('  battleTallies,\n');
    expect(SOURCE).not.toContain('function battleTallies');
  });

  it('keeps the fielded-id list beside the tallies, unchanged', () => {
    expect(SOURCE).toContain('used: [...this.state.usedFighterIds],');
  });
});

/**
 * The preload is scene wiring over the manifest accessor, so the seam is read from
 * the source the same way: `pokemonSprite`'s own lookup is `src/data/pokemonSprites`'
 * contract, and what this pins is which kinds and which fighters the scene asks for.
 */
describe('battleSheets', () => {
  const body = (): string => {
    const start = SOURCE.indexOf('  private battleSheets(): PokemonSpriteSheet[] {');
    expect(start).toBeGreaterThan(-1);
    const end = SOURCE.indexOf('\n  }\n', start);
    expect(end).toBeGreaterThan(start);
    return SOURCE.slice(start, end);
  };

  it('loads both sheet kinds for every fighter of both whole parties', () => {
    const source = body();
    expect(source).toContain('for (const kind of MON_SPRITE_KINDS) {');
    expect(source).toContain('add(fighter.speciesId, fighter.shiny, female, kind);');
    expect(source).toContain('for (const fighter of this.playerFighters) addFighter(fighter);');
    expect(source).toContain('for (const fighter of this.enemyFighters) addFighter(fighter);');
    expect(source).not.toContain("addFighter(fighter, 'front')");
    expect(source).not.toContain("addFighter(fighter, 'back')");
  });

  it('names both kinds in the one constant the loop walks', () => {
    const kinds = SOURCE.match(/const MON_SPRITE_KINDS: readonly PokemonSpriteKind\[\] = \[([^\]]*)\];/);
    expect(kinds).not.toBeNull();
    expect(kinds?.[1].match(/'[a-z]+'/g)).toEqual(["'front'", "'back'"]);
  });

  it('keeps the Mega and G-Max forme sheets inside that same loop', () => {
    const source = body();
    expect(source).toContain('if (mega) add(mega.id, fighter.shiny, female, kind);');
    expect(source).toContain('if (gmax) add(gmax.id, fighter.shiny, female, kind);');
    expect(source.indexOf('if (mega) add(mega.id')).toBeGreaterThan(
      source.indexOf('for (const kind of MON_SPRITE_KINDS) {'),
    );
    expect(source).toContain('megaFormForItem(fighter.heldItem)');
    expect(source).toContain('gmaxFormForBase(fighter.speciesId)');
  });

  it('loads a species both sides field once per kind', () => {
    const source = body();
    expect(source).toContain('const sheets = new Map<string, PokemonSpriteSheet>();');
    expect(source).toContain('sheets.set(sheet.textureKey, sheet);');
    expect(source).toContain('return [...sheets.values()];');
  });
});

/**
 * The transform's own engine rule is `transformInto`'s, covered in
 * `src/engine/battle/fighter.test.ts`; what the scene owes is the redraw of the
 * copied species when the engine reports the `forme` event.
 */
describe('the transform redraw', () => {
  it('re-syncs both mon sprites from the reported fighter', () => {
    const start = SOURCE.indexOf("        case 'forme': {");
    expect(start).toBeGreaterThan(-1);
    const end = SOURCE.indexOf('        case ', start + 10);
    const source = SOURCE.slice(start, end);
    expect(source).toContain(
      'const fighter = this.state.sides[event.side].party.find((p) => p.id === event.fighterId);',
    );
    expect(source).toContain(
      'this.setDisplayFighter(event.side, this.fighterSlot(event.side, event.fighterId), fighter);',
    );
    expect(source).toContain('this.syncMonSprites();');
  });
});

/**
 * The placeholder is the documented fallback, not a bug: a species the shipped
 * manifest does not name has no sheet to load, so the preloaded `battle:mon`
 * texture keeps drawing and `showMon` returns before it touches the sprite.
 */
describe('a species the manifest does not name', () => {
  it('keeps the placeholder and leaves showMon on its early return', () => {
    expect(pokemonSprite('missingno', 'front')).toBeNull();
    expect(pokemonSprite('missingno', 'back')).toBeNull();
    expect(SOURCE).toContain('    if (!sheet) return;\n');
    expect(SOURCE).toContain('    if (!this.textures.exists(sheet.textureKey)) return;\n');
  });
});

/**
 * The target step is scene wiring over an engine rule, so the seam is read from the
 * source: `targetStepFor`'s four cases are covered by `src/engine/battle/commands.test.ts`,
 * and the card's prompt row by the `battle-moves` panel's own tests.
 */
describe('the target step', () => {
  it('asks the engine s own predicate once and keeps no copy of it', () => {
    expect(SOURCE.match(/targetStepFor\(/g)).toHaveLength(1);
    expect(SOURCE).toContain('  targetStepFor,\n');
    expect(SOURCE).not.toContain('needsTargetStep');
    expect(SOURCE).not.toContain('const SPREAD_TARGETS');
  });

  it('keeps the card open through the step and names the marked foe', () => {
    expect(SOURCE).toContain("open: this.mode === 'moves' || this.mode === 'target',");
    expect(SOURCE).toContain("this.mode === 'target' && this.targetSlot !== null");
    expect(SOURCE).toContain("this.slotFighter('enemy', this.targetSlot)?.name ?? null");
  });
});

/**
 * The command window is scene wiring over the `battle-command` panel's pure view,
 * so the seam is read from the source: the grid arithmetic is that panel's own
 * `view.test.ts`, and the card is `battle-moves`' `battleMovesBox`.
 */
describe('the DOM command window', () => {
  it('is pushed once, from the emit point the other cards use', () => {
    const pushes = SOURCE.match(
      /this\.commandController\?\.update\(this\.battleCommandInput\(menu\)\);/g,
    );
    expect(pushes).toHaveLength(1);
    expect(SOURCE.match(/mountBattleCommand\(/g)).toHaveLength(1);
  });

  it('mounts and disposes with the other DOM panels', () => {
    expect(SOURCE).toContain('    this.mountBattleCommandPanel();\n');
    expect(SOURCE).toContain('      this.disposeCommandPanel();\n');
    expect(SOURCE).toContain(
      'this.commandController = mountBattleCommand(host, (intent) => this.onBattleCommandIntent(intent));',
    );
  });

  it('draws no canvas window at all: the card is the command window', () => {
    expect(SOURCE).not.toContain('renderCommandMenu');
    expect(SOURCE).not.toContain('menuPanel');
  });
});
