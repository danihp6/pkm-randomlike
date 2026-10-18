import { describe, expect, it } from 'vitest';
import { evolutionBranches } from '../data/dex/evolutions';
import { GMAX_FORMES, gmaxFormForBase } from '../data/dex/gmaxes';
import { MEGA_FORMES, megaFormsForBase } from '../data/dex/megas';
import { portraitFor } from '../data/portraits';
import fontData from '../data/ui/font.json';
import { evolutionGraph, formeDisplayName, type FamilyNode } from './evolutionGraph';

// The band's geometry, mirrored from `RouteScene` (HUD_DETAIL_W, HUD_PAD_X =
// FRLG_WINDOW_PADDING.x, HUD_DETAIL_EVO_INDENT; the name sits 30 px into the
// row). The scene cannot be imported headless, so the numbers are pinned here.
const HUD_DETAIL_W = 460;
const HUD_PAD_X = 20;
const HUD_DETAIL_EVO_INDENT = 34;
const HUD_DETAIL_EVO_NAME_INSET = 30;
const HUD_DETAIL_EVO_MAX_WIDTH = HUD_DETAIL_W - HUD_PAD_X * 2 - 96;

/** The px a row's name may occupy before it leaves the row's own background. */
function evoBoxWidth(depth: number): number {
  return HUD_DETAIL_W - HUD_PAD_X * 2 - HUD_DETAIL_EVO_INDENT * depth - HUD_DETAIL_EVO_NAME_INSET;
}

const ADVANCES = new Map(fontData.glyphs.map((glyph) => [glyph.code, glyph.xAdvance] as const));

/** The drawn px of `text` at size 16 from the size-32 font: half its advances. */
function drawnWidth(text: string): number {
  let units = 0;
  for (const char of text) units += ADVANCES.get(char.codePointAt(0) ?? 0) ?? 0;
  return units * 0.5;
}

const NONE_READY = (node: FamilyNode): boolean => !node.ready;

/** The battle-only rows a family carries, whatever their owner species is. */
function informationRows(speciesId: string): readonly FamilyNode[] {
  return evolutionGraph(speciesId, 100).filter((node) => node.kind !== 'species');
}

describe('evolutionGraph', () => {
  it('roots a three-stage line at its base, links the chain and lists its formes', () => {
    const graph = evolutionGraph('charizard', 36);
    expect(graph.map((node) => node.id)).toEqual([
      'charmander',
      'charmeleon',
      'charizard',
      'charizardmegax',
      'charizardmegay',
      'charizardgmax',
    ]);
    expect(graph.map((node) => node.depth)).toEqual([0, 1, 2, 3, 3, 3]);
    expect(graph.map((node) => node.row)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(graph.map((node) => node.level)).toEqual([null, 16, 36, null, null, null]);
    expect(graph.map((node) => node.parent)).toEqual([null, 0, 1, 2, 2, 2]);
    expect(graph.map((node) => node.current)).toEqual([false, false, true, false, false, false]);
    expect(graph.map((node) => node.kind)).toEqual(['species', 'species', 'species', 'mega', 'mega', 'gmax']);
    expect(graph.every(NONE_READY)).toBe(true);
  });

  it('shows a whole family and marks only the ready children clickable', () => {
    const graph = evolutionGraph('eevee', 20);
    expect(graph).toHaveLength(10);
    expect(graph[0]!.id).toBe('eevee');
    expect(graph[0]!.current).toBe(true);
    const ready = graph.filter((node) => node.ready);
    expect(ready).toHaveLength(8);
    expect(ready.every((node) => node.parent === 0 && node.level === 20)).toBe(true);
    expect(graph[9]).toMatchObject({
      id: 'eeveegmax',
      name: 'Gigantamax Eevee · Gigantamaxes with no stone',
      kind: 'gmax',
      depth: 1,
      row: 9,
      parent: 0,
      level: null,
      current: false,
      ready: false,
    });
  });

  it('keeps the branches grey until their level is met', () => {
    const early = evolutionGraph('eevee', 19);
    expect(early.every(NONE_READY)).toBe(true);
  });

  it('lists the pre-evolutions beside a middle form\x27s own branch', () => {
    const graph = evolutionGraph('pikachu', 30);
    expect(graph.map((node) => node.id)).toEqual([
      'pichu',
      'pikachu',
      'raichu',
      'raichumegax',
      'raichumegay',
      'raichualola',
      'pikachugmax',
    ]);
    expect(graph.find((node) => node.id === 'pikachu')?.level).toBe(20);
    expect(graph.filter((node) => node.ready).map((node) => node.id).sort()).toEqual([
      'raichu',
      'raichualola',
    ]);
    expect(graph.find((node) => node.id === 'pikachugmax')).toMatchObject({
      kind: 'gmax',
      depth: 2,
      parent: 1,
      level: null,
      current: false,
      ready: false,
    });
    const megas = graph.filter((node) => node.kind === 'mega');
    expect(megas.map((node) => node.id)).toEqual(['raichumegax', 'raichumegay']);
    expect(megas.every((node) => node.depth === 3 && node.parent === 2)).toBe(true);
    for (const mega of megas) {
      expect(mega.level).toBeNull();
      expect(mega.current).toBe(false);
      expect(mega.ready).toBe(false);
    }
  });

  it('is empty for an unknown species', () => {
    expect(evolutionGraph('not-a-species', 50)).toEqual([]);
  });

  it('shows a rotom with its five appliance children, only them ready', () => {
    const level = evolutionBranches('rotom')[0]!.level;
    const graph = evolutionGraph('rotom', level);
    expect(graph.map((node) => node.id)).toEqual([
      'rotom',
      'rotomheat',
      'rotomwash',
      'rotomfrost',
      'rotomfan',
      'rotommow',
    ]);
    expect(graph.map((node) => node.depth)).toEqual([0, 1, 1, 1, 1, 1]);
    expect(graph.map((node) => node.parent)).toEqual([null, 0, 0, 0, 0, 0]);
    expect(graph.map((node) => node.level)).toEqual([null, level, level, level, level, level]);
    expect(graph.map((node) => node.kind)).toEqual([
      'species',
      'species',
      'species',
      'species',
      'species',
      'species',
    ]);
    expect(graph.filter((node) => node.current).map((node) => node.id)).toEqual(['rotom']);
    expect(graph.filter((node) => node.ready).map((node) => node.id)).toEqual([
      'rotomheat',
      'rotomwash',
      'rotomfrost',
      'rotomfan',
      'rotommow',
    ]);
  });

  it('greys every rotom appliance row below the resolved level', () => {
    const level = evolutionBranches('rotom')[0]!.level;
    const graph = evolutionGraph('rotom', level - 1);
    expect(graph).toHaveLength(6);
    expect(graph.every(NONE_READY)).toBe(true);
  });

  it('shows a single, never-ready row for an appliance: the change is one-way', () => {
    const graph = evolutionGraph('rotomheat', 100);
    expect(graph).toHaveLength(1);
    expect(graph[0]!.id).toBe('rotomheat');
    expect(graph[0]!.current).toBe(true);
    expect(graph[0]!.ready).toBe(false);
    expect(graph[0]!.parent).toBeNull();
    expect(graph[0]!.level).toBeNull();
  });
});

describe('formeDisplayName', () => {
  it('moves a Mega letter after the base and a Gmax tag into its own word', () => {
    expect(formeDisplayName('Charizard-Mega-X')).toBe('Mega Charizard X');
    expect(formeDisplayName('Venusaur-Mega')).toBe('Mega Venusaur');
    expect(formeDisplayName('Charizard-Gmax')).toBe('Gigantamax Charizard');
    expect(formeDisplayName('Toxtricity-Low-Key-Gmax')).toBe('Gigantamax Toxtricity Low Key');
    expect(formeDisplayName('Charizard')).toBe('Charizard');
  });
});

describe('battle-only formes as information rows', () => {
  it('gives every Mega of the family a row under its base species', () => {
    for (const mega of MEGA_FORMES) {
      const graph = evolutionGraph(mega.baseSpeciesId, 100);
      const base = graph.find((node) => node.id === mega.baseSpeciesId);
      const row = graph.find((node) => node.id === mega.id);
      expect(base, mega.id).toBeDefined();
      expect(row, mega.id).toBeDefined();
      expect(row!.kind, mega.id).toBe('mega');
      expect(row!.name, mega.id).toBe(
        `${formeDisplayName(mega.name)} · Mega Evolves with ${mega.stoneName}`,
      );
      expect(row!.level, mega.id).toBeNull();
      expect(row!.current, mega.id).toBe(false);
      expect(row!.ready, mega.id).toBe(false);
      expect(row!.parent, mega.id).toBe(base!.row);
      expect(row!.depth, mega.id).toBe(base!.depth + 1);
      expect(portraitFor(row!.id), mega.id).not.toBeNull();
    }
  });

  it('gives every Gigantamax of the family a stone-less row under its base species', () => {
    for (const gmax of GMAX_FORMES) {
      const graph = evolutionGraph(gmax.baseSpeciesId, 100);
      const base = graph.find((node) => node.id === gmax.baseSpeciesId);
      const row = graph.find((node) => node.id === gmax.id);
      expect(base, gmax.id).toBeDefined();
      expect(row, gmax.id).toBeDefined();
      expect(row!.kind, gmax.id).toBe('gmax');
      expect(row!.name, gmax.id).toBe(
        `${formeDisplayName(gmax.name)} · Gigantamaxes with no stone`,
      );
      expect(row!.level, gmax.id).toBeNull();
      expect(row!.current, gmax.id).toBe(false);
      expect(row!.ready, gmax.id).toBe(false);
      expect(row!.parent, gmax.id).toBe(base!.row);
      expect(row!.depth, gmax.id).toBe(base!.depth + 1);
      expect(portraitFor(row!.id), gmax.id).not.toBeNull();
    }
  });

  it('prints the exact copy, stone and all', () => {
    const graph = evolutionGraph('charizard', 36);
    const [x, y] = megaFormsForBase('charizard');
    expect(graph[3]!.name).toBe(`Mega Charizard X · Mega Evolves with ${x!.stoneName}`);
    expect(graph[4]!.name).toBe(`Mega Charizard Y · Mega Evolves with ${y!.stoneName}`);
    expect(graph[3]!.name).toBe('Mega Charizard X · Mega Evolves with Charizardite X');
    expect(graph[4]!.name).toBe('Mega Charizard Y · Mega Evolves with Charizardite Y');
    expect(graph[5]!.name).toBe('Gigantamax Charizard · Gigantamaxes with no stone');
    expect(
      evolutionGraph('corviknight', 100).find((node) => node.id === 'corviknightgmax')?.name,
    ).toBe('Gigantamax Corviknight · Gigantamaxes with no stone');
    expect(
      evolutionGraph('toxtricitylowkey', 100).find((node) => node.id === 'toxtricitylowkeygmax')?.name,
    ).toBe('Gigantamax Toxtricity Low Key · Gigantamaxes with no stone');
  });

  it('is the same graph from one stage behind, anchored on the owner species', () => {
    const member = evolutionGraph('charmander', 5);
    const final = evolutionGraph('charizard', 36);
    expect(member.map((node) => node.id)).toEqual(final.map((node) => node.id));
    expect(member.map((node) => [node.depth, node.row, node.level, node.parent, node.kind])).toEqual(
      final.map((node) => [node.depth, node.row, node.level, node.parent, node.kind]),
    );
    expect(member.map((node) => node.current)).toEqual([true, false, false, false, false, false]);
    expect(member.every(NONE_READY)).toBe(true);
  });

  it('emits the same rows at any level: the forme never becomes ready', () => {
    for (const level of [1, 20, 100]) {
      expect(evolutionGraph('charizard', level).map((node) => node.id)).toEqual([
        'charmander',
        'charmeleon',
        'charizard',
        'charizardmegax',
        'charizardmegay',
        'charizardgmax',
      ]);
      expect(evolutionGraph('charizard', level).every(NONE_READY)).toBe(true);
    }
  });

  it('lists a species\x27 Megas before its G-Max row', () => {
    let checked = 0;
    for (const baseId of new Set(MEGA_FORMES.map((mega) => mega.baseSpeciesId))) {
      const gmax = gmaxFormForBase(baseId);
      if (!gmax) continue;
      checked += 1;
      const graph = evolutionGraph(baseId, 100);
      const base = graph.find((node) => node.id === baseId)!;
      const rows = graph.filter((node) => node.parent === base.row && node.kind !== 'species');
      expect(rows.map((node) => node.id)).toEqual([
        ...megaFormsForBase(baseId).map((mega) => mega.id),
        gmax.id,
      ]);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('draws the rows after the whole evolution subtree they hang off', () => {
    const graph = evolutionGraph('pikachu', 30);
    const lastEvolution = Math.max(
      ...graph.filter((node) => node.kind === 'species').map((node) => node.row),
    );
    expect(graph.find((node) => node.id === 'pikachugmax')!.row).toBeGreaterThan(lastEvolution);
  });

  it('finds a Mega row in the family of the species that owns it', () => {
    const rows = informationRows('eevee');
    expect(rows.map((node) => node.id)).toEqual(['eeveegmax']);
    expect(rows.every(NONE_READY)).toBe(true);
  });
});

describe('information row widths', () => {
  it('measures the pinned copies against the band\x27s depth-3 box', () => {
    expect(evoBoxWidth(3)).toBe(288);
    expect(HUD_DETAIL_EVO_MAX_WIDTH).toBe(324);
    expect(drawnWidth('Mega Charizard X · Mega Evolves with Charizardite X')).toBe(267);
    expect(drawnWidth('Gigantamax Corviknight · Gigantamaxes with no stone')).toBe(263);
    expect(drawnWidth('Gigantamax Charizard · Gigantamaxes with no stone')).toBe(256);
    expect(drawnWidth('Gigantamax Pikachu · Gigantamaxes with no stone')).toBe(244);
    expect(drawnWidth('Gigantamax Eevee · Gigantamaxes with no stone')).toBe(237);
  });

  it('rejects the longer clause: while holding overruns the depth-3 box', () => {
    const longer = drawnWidth('Mega Charizard X · Mega Evolves while holding Charizardite X');
    expect(longer).toBe(312);
    expect(longer).toBeGreaterThan(evoBoxWidth(3));
    expect(longer).toBeLessThan(HUD_DETAIL_EVO_MAX_WIDTH);
  });

  it('fits every information row of every forme inside its own row', () => {
    const copies = new Set<string>();
    for (const forme of [...MEGA_FORMES, ...GMAX_FORMES]) {
      const row = informationRows(forme.baseSpeciesId).find((node) => node.id === forme.id);
      expect(row, forme.id).toBeDefined();
      const width = drawnWidth(row!.name);
      expect(width, row!.name).toBeLessThanOrEqual(evoBoxWidth(row!.depth));
      expect(width, row!.name).toBeLessThanOrEqual(HUD_DETAIL_EVO_MAX_WIDTH);
      copies.add(row!.name);
    }
    expect(copies.size).toBe(MEGA_FORMES.length + GMAX_FORMES.length);
  });
});
