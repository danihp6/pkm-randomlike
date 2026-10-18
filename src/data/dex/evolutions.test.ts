import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVEL_BANDS } from '../run';
import {
  EVOLUTION_BST_LEVELS,
  EVOLUTION_MIN_GAP,
  availableEvolutions,
  evolutionBranches,
  evolutionDepth,
  evolutionFamily,
  evolutionFor,
  evolutionLevel,
  evolutionLevelForBst,
  evolutionStage,
  formeFamily,
  isLevelEvolution,
} from './evolutions';
import { getSpecies, playableSpecies, type Evolution, type Species } from './species';

/** The level a species' own branches resolve at (all of them share it). */
function resolvedLevel(speciesId: string): number {
  return evolutionBranches(speciesId)[0]?.level ?? 0;
}

/** The rule shipped before this task: a 20/30 stage constant over the canon pre-evolution level. */
function previousLevel(species: Species): number {
  const canon = species.evolutions.find(isLevelEvolution)?.level ?? null;
  if (canon !== null) return canon;
  const base = evolutionStage(species.id) >= 1 ? 30 : 20;
  const previous = species.prevo ? getSpecies(species.prevo) : undefined;
  const levels = (previous?.evolutions ?? [])
    .filter(isLevelEvolution)
    .map((evolution) => evolution.level)
    .filter((level): level is number => level !== null);
  return levels.length > 0 ? Math.max(base, Math.min(...levels) + 1) : base;
}

describe('evolution accessors', () => {
  it('distinguishes level evolutions from every other method', () => {
    const bulbasaur = getSpecies('bulbasaur')!;
    const pikachu = getSpecies('pikachu')!;
    expect(isLevelEvolution(bulbasaur.evolutions[0]!)).toBe(true);
    expect(isLevelEvolution(pikachu.evolutions[0]!)).toBe(false);
  });

  it('returns the level evolution that a level triggers', () => {
    expect(evolutionFor('bulbasaur', 15)).toBeUndefined();
    expect(evolutionFor('bulbasaur', 16)?.into).toBe('ivysaur');
    expect(evolutionFor('pikachu', 100)).toBeUndefined();
    expect(evolutionFor('not-a-species', 100)).toBeUndefined();
  });
});

describe('evolution family', () => {
  it('collects a whole three-stage line from any of its members', () => {
    const expected = ['bulbasaur', 'ivysaur', 'venusaur'];
    for (const id of expected) {
      expect([...evolutionFamily(id)].sort(), id).toEqual(expected);
    }
  });

  it('walks up to the base form before branching back down', () => {
    const family = evolutionFamily('pikachu');
    expect(family).toContain('pichu');
    expect(family).toContain('pikachu');
    expect(family).toContain('raichu');
  });

  it('counts every branch of a split line', () => {
    expect(evolutionFamily('eevee').length).toBeGreaterThanOrEqual(9);
    expect(evolutionFamily('vaporeon')).toContain('eevee');
  });

  it('is a single member for a species that cannot evolve', () => {
    expect(evolutionFamily('tauros')).toEqual(['tauros']);
    expect(evolutionFamily('not-a-species')).toEqual([]);
  });
});

describe('forme family', () => {
  it('collects every entry sharing the species national dex number', () => {
    expect(formeFamily('raichu')).toContain('raichu');
    expect(formeFamily('raichu')).toContain('raichualola');
    for (const id of formeFamily('raichu')) {
      expect(getSpecies(id)!.num, id).toBe(26);
    }
  });

  it('carries the alternate formes of the build, in playable order', () => {
    expect(formeFamily('raichu')).toEqual(['raichu', 'raichualola']);
    expect(formeFamily('rotom').slice(0, 2)).toEqual(['rotom', 'rotomheat']);
  });

  it('leaves out the battle-only Mega and G-Max formes', () => {
    expect(formeFamily('charizard')).toEqual(['charizard']);
  });

  it('is empty for an unknown id', () => {
    expect(formeFamily('not-a-species')).toEqual([]);
  });
});

describe('evolution levels', () => {
  it('keeps a canon level evolution at its level', () => {
    expect(evolutionLevel('charmander', getSpecies('charmander')!.evolutions[0]!)).toBe(16);
  });

  it('levels every other method by the species bst band, all branches sharing one level', () => {
    const eevee = evolutionBranches('eevee');
    expect(eevee).toHaveLength(8);
    expect(new Set(eevee.map((branch) => branch.level))).toEqual(new Set([20]));
    // A mid-band species evolves later: Pikachu's Raichu waits for 30.
    expect(evolutionBranches('pikachu').every((branch) => branch.level === 30)).toBe(true);
  });

  it('reuses the species own level evolution for its other branches', () => {
    expect(evolutionBranches('kirlia').map((branch) => branch.level)).toEqual([30, 30]);
    expect(evolutionBranches('slowpoke').map((branch) => branch.level)).toEqual([37, 37]);
  });

  it('never evolves before the evolution that produced the species', () => {
    // Horsea evolves into Seadra at 32, so Kingdra waits out the +10 gap.
    expect(evolutionBranches('seadra')[0]!.level).toBe(42);
  });

  it('reports the stage from the prevo chain', () => {
    expect(evolutionStage('charmander')).toBe(0);
    expect(evolutionStage('charmeleon')).toBe(1);
    expect(evolutionStage('charizard')).toBe(2);
    expect(evolutionStage('not-a-species')).toBe(0);
  });

  it('filters to the branches a level allows', () => {
    expect(availableEvolutions('charmander', 15)).toEqual([]);
    expect(availableEvolutions('charmander', 16).map((branch) => branch.into)).toEqual(['charmeleon']);
    expect(availableEvolutions('eevee', 20)).toHaveLength(8);
    expect(availableEvolutions('not-a-species', 100)).toEqual([]);
  });
});

describe('evolution bst bands', () => {
  it('reads 20, 30 or 40 from the bst band at its edges', () => {
    expect(EVOLUTION_MIN_GAP).toBe(10);
    expect(evolutionLevelForBst(0)).toBe(20);
    expect(evolutionLevelForBst(305)).toBe(20);
    expect(evolutionLevelForBst(355)).toBe(20);
    expect(evolutionLevelForBst(356)).toBe(30);
    expect(evolutionLevelForBst(440)).toBe(30);
    expect(evolutionLevelForBst(441)).toBe(40);
    expect(evolutionLevelForBst(800)).toBe(40);
    expect(evolutionLevelForBst(Number.NaN)).toBe(20);
    expect(evolutionLevelForBst(Number.POSITIVE_INFINITY)).toBe(20);
    expect(evolutionLevelForBst(-1)).toBe(20);
  });

  it('mirrors the run level bands bst windows', () => {
    // The bands tile 0..800; the evolution windows are those bands grouped by the
    // level they read, with the top group folded into the +infinity ceiling band.
    const windows: { maxBst: number; level: number }[] = [];
    for (const band of LEVEL_BANDS) {
      const level = evolutionLevelForBst(band.bst.min);
      const last = windows[windows.length - 1];
      if (last && last.level === level) last.maxBst = band.bst.max;
      else windows.push({ maxBst: band.bst.max, level });
    }
    expect(LEVEL_BANDS[LEVEL_BANDS.length - 1]!.bst.max).toBe(800);
    expect(windows.length).toBe(EVOLUTION_BST_LEVELS.length);
    expect(windows.slice(0, -1)).toEqual(
      EVOLUTION_BST_LEVELS.slice(0, -1).map((window) => ({ maxBst: window.maxBst, level: window.level })),
    );
    const ceiling = EVOLUTION_BST_LEVELS[EVOLUTION_BST_LEVELS.length - 1]!;
    expect(ceiling.maxBst).toBe(Number.POSITIVE_INFINITY);
    expect(ceiling.level).toBe(windows[windows.length - 1]!.level);
    for (const band of LEVEL_BANDS) {
      expect(evolutionLevelForBst(band.bst.max), band.id).toBe(evolutionLevelForBst(band.bst.min));
    }
  });

  it('resolves the pinned dex levels', () => {
    const golden: readonly (readonly [string, number])[] = [
      ['eevee', 20],
      ['pichu', 20],
      ['pikachu', 30],
      ['ralts', 20],
      ['kirlia', 30],
      ['mankey', 28],
      ['primeape', 40],
      ['horsea', 32],
      ['seadra', 42],
      ['slowpoke', 37],
    ];
    for (const [id, level] of golden) {
      const levels = new Set(evolutionBranches(id).map((branch) => branch.level));
      expect(levels, id).toEqual(new Set([level]));
    }
  });

  it('floors every non-level branch on its bst band and its produced level', () => {
    let branches = 0;
    let moved = 0;
    for (const species of playableSpecies()) {
      const band = evolutionLevelForBst(species.bst);
      const canon = species.evolutions.find(isLevelEvolution)?.level ?? null;
      const previous = species.prevo ? getSpecies(species.prevo) : undefined;
      const produced = previous ? resolvedLevel(previous.id) : null;
      const before = previousLevel(species);
      for (const branch of species.evolutions) {
        if (isLevelEvolution(branch)) continue;
        branches += 1;
        const resolved = evolutionLevel(species.id, branch);
        if (resolved !== before) moved += 1;
        expect(resolved, `${species.id} -> ${branch.into} band`).toBeGreaterThanOrEqual(band);
        const overProduced = produced === null || resolved >= produced + EVOLUTION_MIN_GAP;
        const isCanonLevel = canon !== null && resolved === canon;
        expect(overProduced || isCanonLevel, `${species.id} -> ${branch.into} floor`).toBe(true);
      }
    }
    expect(branches).toBe(156);
    expect(moved).toBe(60);
  });

  it('moves the primeape and seadra lines and leaves the canon chain alone', () => {
    expect(previousLevel(getSpecies('primeape')!)).toBe(30);
    expect(evolutionBranches('primeape')[0]!.level).toBe(40);
    expect(previousLevel(getSpecies('seadra')!)).toBe(33);
    expect(evolutionBranches('seadra')[0]!.level).toBe(42);
  });

  it('keeps every canon level-up evolution at its raw dex level', () => {
    for (const species of playableSpecies()) {
      for (const branch of species.evolutions) {
        if (!isLevelEvolution(branch)) continue;
        expect(evolutionLevel(species.id, branch), `${species.id} -> ${branch.into}`).toBe(branch.level);
      }
    }
  });

  it('resolves the dex identically on every call and imports no rng', () => {
    const resolveAll = (): string =>
      playableSpecies()
        .map((species) => `${species.id}:${evolutionBranches(species.id).map((branch) => branch.level).join(',')}`)
        .join('|');
    expect(resolveAll()).toBe(resolveAll());

    const source = readFileSync(new URL('./evolutions.ts', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(['./species']);
    expect(source).not.toMatch(/rng/i);
    expect(source).not.toMatch(/\bdocument\b|\blocalStorage\b/);
    expect(source).not.toMatch(/Math\.random/);
  });
});

describe('evolution depth', () => {
  it('counts the longest chain, not the width of a branch', () => {
    expect(evolutionDepth('bulbasaur')).toBe(2);
    expect(evolutionDepth('ivysaur')).toBe(1);
    expect(evolutionDepth('venusaur')).toBe(0);
  });

  it('scores a split line whose children are all final as one step', () => {
    expect(evolutionDepth('scyther')).toBe(1);
    expect(evolutionDepth('eevee')).toBe(1);
  });

  it('is zero for a species that cannot evolve or an unknown id', () => {
    expect(evolutionDepth('tauros')).toBe(0);
    expect(evolutionDepth('not-a-species')).toBe(0);
  });
});

/** Rotom's five appliances are a hand-authored override, not dex data (`D38`). */
describe('rotom appliance override', () => {
  const APPLIANCES: readonly string[] = [
    'rotomheat',
    'rotomwash',
    'rotomfrost',
    'rotomfan',
    'rotommow',
  ];

  /** The `Evolution` the accessor's branch stands for (all five share the shape). */
  function evolutionOf(branch: { into: string; level: number; method: string }): Evolution {
    return {
      into: branch.into,
      method: branch.method,
      level: branch.level,
      item: null,
      move: null,
      condition: null,
    };
  }

  it('offers exactly the five appliances, all at one level, none a level evolution', () => {
    const branches = evolutionBranches('rotom');
    expect(branches.map((branch) => branch.into)).toEqual([...APPLIANCES]);
    expect(new Set(branches.map((branch) => branch.level)).size).toBe(1);
    for (const branch of branches) {
      expect(branch.method).toBe('forme');
      expect(isLevelEvolution(evolutionOf(branch))).toBe(false);
    }
  });

  it('resolves that one level through the rotom bst band', () => {
    const level = evolutionBranches('rotom')[0]!.level;
    expect(level).toBe(evolutionLevelForBst(getSpecies('rotom')!.bst));
    expect(level).toBe(30);
    for (const branch of evolutionBranches('rotom')) {
      expect(branch.level).toBe(level);
      expect(evolutionLevel('rotom', evolutionOf(branch))).toBe(branch.level);
    }
    // The override is not a canon level-up, so the raw dex check stays empty.
    expect(evolutionFor('rotom', 100)).toBeUndefined();
  });

  it('is grey below the resolved level and the five at it', () => {
    const level = evolutionBranches('rotom')[0]!.level;
    expect(availableEvolutions('rotom', level - 1)).toEqual([]);
    expect(availableEvolutions('rotom', level).map((branch) => branch.into)).toEqual([...APPLIANCES]);
  });

  it('reaches all six members from rotom, and only itself from an appliance', () => {
    expect([...evolutionFamily('rotom')].sort()).toEqual([
      'rotom',
      'rotomfan',
      'rotomfrost',
      'rotomheat',
      'rotommow',
      'rotomwash',
    ]);
    expect(evolutionDepth('rotom')).toBe(1);
    for (const id of APPLIANCES) {
      expect(evolutionBranches(id), id).toEqual([]);
      expect(evolutionFamily(id), id).toEqual([id]);
      expect(evolutionStage(id), id).toBe(0);
      // One-way: no override branch of an appliance points back to rotom.
      expect(evolutionFamily(id), id).not.toContain('rotom');
    }
  });

  it('leaves the generated dex rows untouched', () => {
    for (const id of ['rotom', ...APPLIANCES]) {
      const species = playableSpecies().find((entry) => entry.id === id)!;
      expect(species.evolutions, id).toEqual([]);
      expect(species.evos, id).toEqual([]);
      expect(species.prevo, id).toBe('');
    }
  });
});
