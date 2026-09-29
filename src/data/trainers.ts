export type TrainerArchetype = Readonly<{
  id: string;
  name: string;
  className: string;
  /** Overworld sprite key, or null while no trainer art exists (O1). */
  spriteKey: string | null;
  /** Placeholder marker colour used until `spriteKey` exists. */
  colour: number;
  /** Themed species pool the roster generator draws from (Phase 6). */
  pool: readonly string[];
}>;

export const TRAINER_ARCHETYPES: readonly TrainerArchetype[] = [
  {
    id: 'youngster',
    name: 'Youngster',
    className: 'Youngster',
    spriteKey: null,
    colour: 0x60a5fa,
    pool: ['sentret', 'skwovet', 'yungoos', 'lechonk', 'meowth', 'minccino'],
  },
  {
    id: 'lass',
    name: 'Lass',
    className: 'Lass',
    spriteKey: null,
    colour: 0xf472b6,
    pool: ['milcery', 'flabebe', 'igglybuff', 'snubbull', 'fidough', 'tinkatink', 'eevee', 'bounsweet'],
  },
  {
    id: 'bugcatcher',
    name: 'Bug Catcher',
    className: 'Bug Catcher',
    spriteKey: null,
    colour: 0x84cc16,
    pool: ['scatterbug', 'tarountula', 'nymble', 'grubbin', 'combee', 'joltik', 'snom', 'dewpider', 'surskit'],
  },
  {
    id: 'hiker',
    name: 'Hiker',
    className: 'Hiker',
    spriteKey: null,
    colour: 0xf59e0b,
    pool: ['nacli', 'rockruff', 'rhyhorn', 'phanpy', 'drilbur', 'mudbray', 'silicobra', 'sandshrew', 'larvitar', 'carbink'],
  },
  {
    id: 'camper',
    name: 'Camper',
    className: 'Camper',
    spriteKey: null,
    colour: 0x22c55e,
    pool: ['seedot', 'shroomish', 'cottonee', 'petilil', 'foongus', 'fomantis', 'smoliv', 'capsakid', 'cacnea', 'snover'],
  },
  {
    id: 'picnicker',
    name: 'Picnicker',
    className: 'Picnicker',
    spriteKey: null,
    colour: 0xfacc15,
    pool: ['hoppip', 'oddish', 'bellsprout', 'lotad', 'eevee', 'skiddo', 'bounsweet', 'flabebe'],
  },
  {
    id: 'fisher',
    name: 'Fisher',
    className: 'Fisher',
    spriteKey: null,
    colour: 0x38bdf8,
    pool: ['magikarp', 'wooper', 'psyduck', 'poliwag', 'slowpoke', 'shellder', 'horsea', 'seel', 'barboach', 'corphish', 'shellos', 'ducklett', 'arrokuda', 'wiglett', 'finizen', 'veluza', 'clauncher', 'skrelp', 'tentacool', 'lapras'],
  },
  {
    id: 'psychic',
    name: 'Psychic',
    className: 'Psychic',
    spriteKey: null,
    colour: 0xa78bfa,
    pool: ['drowzee', 'ralts', 'spoink', 'bronzor', 'gothita', 'solosis', 'espurr', 'indeedee'],
  },
  {
    id: 'blackbelt',
    name: 'Black Belt',
    className: 'Black Belt',
    spriteKey: null,
    colour: 0xef4444,
    pool: ['makuhita', 'riolu', 'timburr', 'mienfoo', 'crabrawler', 'passimian', 'falinks', 'croagunk'],
  },
  {
    id: 'ace',
    name: 'Ace Trainer',
    className: 'Ace Trainer',
    spriteKey: null,
    colour: 0x94a3b8,
    pool: ['deino', 'axew', 'gible', 'noibat', 'dratini', 'goomy', 'mimikyu', 'tinkatink', 'pawniard', 'scraggy'],
  },
];

const BY_ID = new Map<string, TrainerArchetype>(
  TRAINER_ARCHETYPES.map((archetype) => [archetype.id, archetype]),
);

export const TRAINER_ARCHETYPE_IDS: readonly string[] = TRAINER_ARCHETYPES.map(
  (archetype) => archetype.id,
);

export function getTrainerArchetype(id: string): TrainerArchetype | undefined {
  return BY_ID.get(id);
}
