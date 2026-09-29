import learnsetsData from './learnsets.json';
import { normalizeId } from './species';

export type LearnMethod = 'level' | 'tm' | 'tutor' | 'egg' | 'other';

export type LearnSource = Readonly<{
  code: string;
  gen: number;
  method: LearnMethod;
  level: number | null;
}>;

export type Learnset = Readonly<Record<string, readonly LearnSource[]>>;

export type LevelUpMove = Readonly<{ moveId: string; level: number }>;

const METHOD_BY_LETTER: Readonly<Record<string, LearnMethod>> = {
  L: 'level',
  M: 'tm',
  T: 'tutor',
  E: 'egg',
};

const LEARNSETS = learnsetsData as unknown as Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;

export function parseLearnSource(code: string): LearnSource {
  const gen = Number(code[0]);
  const letter = code[1] ?? '';
  const method = METHOD_BY_LETTER[letter] ?? 'other';
  const levelPart = code.slice(2);
  const level = method === 'level' && levelPart.length > 0 ? Number(levelPart) : null;
  return { code, gen, method, level };
}

export function learnsetOf(speciesId: string): Learnset | undefined {
  const raw = LEARNSETS[normalizeId(speciesId)];
  if (!raw) return undefined;
  const entries: Record<string, LearnSource[]> = {};
  for (const [moveId, sources] of Object.entries(raw)) {
    entries[moveId] = sources.map(parseLearnSource);
  }
  return entries;
}

function bestSource(sources: readonly LearnSource[], method: LearnMethod): LearnSource | undefined {
  let best: LearnSource | undefined;
  for (const source of sources) {
    if (source.method !== method) continue;
    if (!best || source.gen > best.gen) best = source;
  }
  return best;
}

export function levelUpMoves(speciesId: string, level: number): readonly LevelUpMove[] {
  const learnset = learnsetOf(speciesId);
  if (!learnset) return [];
  const moves: LevelUpMove[] = [];
  for (const [moveId, sources] of Object.entries(learnset)) {
    const source = bestSource(sources, 'level');
    if (!source || source.level === null || source.level > level) continue;
    moves.push({ moveId, level: source.level });
  }
  return moves.sort((a, b) => a.level - b.level || a.moveId.localeCompare(b.moveId));
}

export function learnableBy(speciesId: string, method: LearnMethod): readonly string[] {
  const learnset = learnsetOf(speciesId);
  if (!learnset) return [];
  const moves: string[] = [];
  for (const [moveId, sources] of Object.entries(learnset)) {
    if (sources.some((source) => source.method === method)) moves.push(moveId);
  }
  return moves.sort();
}
