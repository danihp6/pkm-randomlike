import { getSpecies, type Evolution } from './species';

export function isLevelEvolution(evolution: Evolution): boolean {
  return evolution.method === 'level' && evolution.level !== null;
}

export function evolutionFor(speciesId: string, level: number): Evolution | undefined {
  const species = getSpecies(speciesId);
  if (!species) return undefined;
  return species.evolutions.find(
    (evolution) =>
      isLevelEvolution(evolution) && evolution.level !== null && level >= evolution.level,
  );
}
