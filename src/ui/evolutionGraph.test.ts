import { describe, expect, it } from 'vitest';
import { evolutionBranches } from '../data/dex/evolutions';
import { evolutionGraph } from './evolutionGraph';

describe('evolutionGraph', () => {
  it('roots a three-stage line at its base and links the chain', () => {
    const graph = evolutionGraph('charizard', 36);
    expect(graph.map((node) => node.id)).toEqual(['charmander', 'charmeleon', 'charizard']);
    expect(graph.map((node) => node.depth)).toEqual([0, 1, 2]);
    expect(graph.map((node) => node.level)).toEqual([null, 16, 36]);
    expect(graph.find((node) => node.current)?.id).toBe('charizard');
    expect(graph.every((node) => !node.ready)).toBe(true);
  });

  it('shows a whole family and marks only the ready children clickable', () => {
    const graph = evolutionGraph('eevee', 20);
    expect(graph).toHaveLength(9);
    expect(graph[0]!.id).toBe('eevee');
    expect(graph[0]!.current).toBe(true);
    const ready = graph.filter((node) => node.ready);
    expect(ready).toHaveLength(8);
    expect(ready.every((node) => node.parent === 0 && node.level === 20)).toBe(true);
  });

  it('keeps the branches grey until their level is met', () => {
    const early = evolutionGraph('eevee', 19);
    expect(early.every((node) => !node.ready)).toBe(true);
  });

  it('lists the pre-evolutions beside a middle form\x27s own branch', () => {
    const graph = evolutionGraph('pikachu', 30);
    expect(graph.map((node) => node.id)).toEqual(['pichu', 'pikachu', 'raichu', 'raichualola']);
    expect(graph.find((node) => node.id === 'pikachu')?.level).toBe(20);
    expect(graph.filter((node) => node.ready).map((node) => node.id).sort()).toEqual([
      'raichu',
      'raichualola',
    ]);
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
    expect(graph.every((node) => !node.ready)).toBe(true);
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
