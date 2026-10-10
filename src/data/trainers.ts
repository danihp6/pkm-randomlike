import type { BandId } from './run';

export type TrainerPools = Readonly<Record<BandId, readonly string[]>>;

/**
 * The Poké Dollars a beaten trainer of this archetype drops: a **fixed base**
 * plus a **jitter** rolled from `base` to `base + jitter` (`docs/maps-spec.md`
 * §7, D33). Both scale with the map's band through
 * `TRAINER_MONEY_BAND_SCALE`, so a late trainer pays more. Balance data (O-M5);
 * tuning never touches the code that rolls it.
 */
export type TrainerMoney = Readonly<{ base: number; jitter: number }>;

/**
 * How much a map's band multiplies a trainer's money. The base/jitter on each
 * archetype are the **early** values; a later band scales both, so the reward
 * tracks the level range the roster fields. Data, so retuning is an edit here.
 */
export const TRAINER_MONEY_BAND_SCALE: Readonly<Record<BandId, number>> = {
  early: 1,
  low: 1.25,
  mid: 1.75,
  high: 2.5,
  late: 3.5,
  end: 5,
};

export type TrainerArchetype = Readonly<{
  id: string;
  name: string;
  className: string;
  /**
   * Frame in the overworld trainer atlas (`src/assets/frlg/overworld.png`,
   * Phase 8) drawn on the route tile, or null for a placeholder sprite. The
   * frame map lives in `src/data/frlg/overworld.json`.
   */
  spriteKey: string | null;
  /** Marker colour for the facing arrow. */
  colour: number;
  /**
   * Frame in the battle trainer sheet (`src/assets/frlg/trainers.png`, Phase 8
   * O1) shown on the enemy platform, or null for a placeholder sprite. The
   * frame map lives in `src/data/frlg/trainers.json`.
   */
  battleSprite: string | null;
  /**
   * Themed species pool per level band; the roster generator draws from the
   * route's band, so a youngster leads with sentrets on route 1 and fields
   * furrets, greedents and cinccinos late (`docs/routes-spec.md` §5).
   */
  pools: TrainerPools;
  /** The Poké Dollars a beaten member of this archetype drops (`D33`). */
  money: TrainerMoney;
  /**
   * True for the `ace` archetype (and, at the call site, map bosses): its
   * roster may carry a Mega Stone, so its Pokémon can Mega Evolve (`D34`).
   */
  carriesMega?: boolean;
}>;

export const TRAINER_ARCHETYPES: readonly TrainerArchetype[] = [
  {
    id: 'youngster',
    money: { base: 60, jitter: 30 },
    name: 'Youngster',
    className: 'Youngster',
    spriteKey: 'youngster',
    colour: 0x60a5fa,
    battleSprite: 'youngster',
    pools: {
      early: ['sentret', 'skwovet', 'yungoos', 'lechonk', 'meowth', 'minccino'],
      low: ['sentret', 'skwovet', 'yungoos', 'lechonk', 'meowth', 'minccino', 'furret', 'gumshoos'],
      mid: ['furret', 'gumshoos', 'oinkologne', 'persian', 'lechonk', 'minccino', 'meowth'],
      high: ['furret', 'gumshoos', 'oinkologne', 'persian', 'greedent', 'cinccino'],
      late: ['greedent', 'cinccino', 'persian', 'oinkologne', 'furret', 'gumshoos'],
      end: ['greedent', 'cinccino', 'persian', 'oinkologne', 'furret', 'gumshoos', 'meowth'],
    },
  },
  {
    id: 'lass',
    money: { base: 70, jitter: 30 },
    name: 'Lass',
    className: 'Lass',
    spriteKey: 'lass',
    colour: 0xf472b6,
    battleSprite: 'lass',
    pools: {
      early: ['milcery', 'flabebe', 'igglybuff', 'snubbull', 'fidough', 'eevee', 'bounsweet'],
      low: ['milcery', 'flabebe', 'igglybuff', 'snubbull', 'fidough', 'eevee', 'bounsweet', 'jigglypuff', 'floette'],
      mid: ['jigglypuff', 'floette', 'dachsbun', 'steenee', 'granbull', 'eevee', 'snubbull'],
      high: ['wigglytuff', 'florges', 'tinkatuff', 'tsareena', 'dachsbun', 'granbull', 'jigglypuff'],
      late: ['florges', 'tsareena', 'tinkaton', 'alcremie', 'wigglytuff', 'dachsbun', 'sylveon'],
      end: ['tinkaton', 'alcremie', 'florges', 'tsareena', 'sylveon', 'wigglytuff', 'dachsbun'],
    },
  },
  {
    id: 'bugcatcher',
    money: { base: 50, jitter: 25 },
    name: 'Bug Catcher',
    className: 'Bug Catcher',
    spriteKey: 'bugcatcher',
    colour: 0x84cc16,
    battleSprite: 'bugcatcher',
    pools: {
      early: ['scatterbug', 'tarountula', 'nymble', 'grubbin', 'combee', 'joltik', 'snom', 'dewpider', 'surskit'],
      low: ['scatterbug', 'tarountula', 'nymble', 'grubbin', 'joltik', 'snom', 'dewpider', 'surskit', 'spewpa', 'charjabug'],
      mid: ['spewpa', 'charjabug', 'spidops', 'lokix', 'masquerain', 'joltik', 'tarountula', 'nymble'],
      high: ['spidops', 'lokix', 'masquerain', 'galvantula', 'araquanid', 'charjabug', 'spewpa'],
      late: ['vikavolt', 'galvantula', 'araquanid', 'frosmoth', 'vespiquen', 'vivillon', 'spidops'],
      end: ['vikavolt', 'galvantula', 'araquanid', 'frosmoth', 'vespiquen', 'vivillon', 'spidops', 'lokix'],
    },
  },
  {
    id: 'hiker',
    money: { base: 90, jitter: 40 },
    name: 'Hiker',
    className: 'Hiker',
    spriteKey: 'hiker',
    colour: 0xf59e0b,
    battleSprite: 'hiker',
    pools: {
      early: ['nacli', 'rockruff', 'rhyhorn', 'phanpy', 'drilbur', 'mudbray', 'silicobra', 'sandshrew', 'larvitar', 'carbink'],
      low: ['nacli', 'rockruff', 'rhyhorn', 'phanpy', 'drilbur', 'mudbray', 'silicobra', 'sandshrew', 'larvitar', 'naclstack', 'donphan'],
      mid: ['naclstack', 'donphan', 'excadrill', 'mudsdale', 'sandaconda', 'sandslash', 'rhydon', 'nacli'],
      high: ['excadrill', 'mudsdale', 'sandaconda', 'sandslash', 'rhydon', 'lycanroc', 'naclstack', 'pupitar'],
      late: ['garganacl', 'rhyperior', 'tyranitar', 'lycanroc', 'excadrill', 'sandslash', 'pupitar'],
      end: ['garganacl', 'rhyperior', 'tyranitar', 'lycanroc', 'excadrill', 'sandaconda', 'mudsdale', 'donphan'],
    },
  },
  {
    id: 'camper',
    money: { base: 80, jitter: 35 },
    name: 'Camper',
    className: 'Camper',
    spriteKey: 'camper',
    colour: 0x22c55e,
    battleSprite: 'camper',
    pools: {
      early: ['seedot', 'shroomish', 'cottonee', 'petilil', 'foongus', 'fomantis', 'smoliv', 'capsakid', 'cacnea', 'snover'],
      low: ['seedot', 'shroomish', 'cottonee', 'petilil', 'foongus', 'fomantis', 'smoliv', 'capsakid', 'cacnea', 'snover', 'nuzleaf', 'dolliv'],
      mid: ['nuzleaf', 'dolliv', 'breloom', 'amoonguss', 'lurantis', 'cacturne', 'whimsicott', 'smoliv'],
      high: ['nuzleaf', 'dolliv', 'breloom', 'amoonguss', 'lurantis', 'cacturne', 'lilligant', 'abomasnow'],
      late: ['shiftry', 'arboliva', 'breloom', 'amoonguss', 'lurantis', 'cacturne', 'abomasnow', 'whimsicott'],
      end: ['shiftry', 'arboliva', 'breloom', 'amoonguss', 'lurantis', 'cacturne', 'abomasnow', 'scovillain'],
    },
  },
  {
    id: 'picnicker',
    money: { base: 80, jitter: 35 },
    name: 'Picnicker',
    className: 'Picnicker',
    spriteKey: 'picnicker',
    colour: 0xfacc15,
    battleSprite: 'picnicker',
    pools: {
      early: ['hoppip', 'oddish', 'bellsprout', 'lotad', 'eevee', 'skiddo', 'bounsweet', 'flabebe'],
      low: ['hoppip', 'oddish', 'bellsprout', 'lotad', 'eevee', 'skiddo', 'bounsweet', 'flabebe', 'skiploom', 'gloom', 'floette'],
      mid: ['skiploom', 'gloom', 'weepinbell', 'lombre', 'gogoat', 'steenee', 'eevee', 'oddish'],
      high: ['skiploom', 'gloom', 'weepinbell', 'lombre', 'gogoat', 'steenee', 'floette'],
      late: ['jumpluff', 'bellossom', 'victreebel', 'ludicolo', 'gogoat', 'tsareena', 'florges'],
      end: ['jumpluff', 'bellossom', 'victreebel', 'ludicolo', 'gogoat', 'tsareena', 'florges'],
    },
  },
  {
    id: 'fisher',
    money: { base: 100, jitter: 45 },
    name: 'Fisher',
    className: 'Fisher',
    spriteKey: 'fisher',
    colour: 0x38bdf8,
    battleSprite: 'fisher',
    pools: {
      early: ['magikarp', 'wooper', 'psyduck', 'poliwag', 'slowpoke', 'shellder', 'horsea', 'seel', 'barboach', 'corphish', 'shellos', 'ducklett', 'arrokuda', 'wiglett', 'finizen', 'veluza', 'clauncher', 'skrelp', 'tentacool', 'lapras'],
      low: ['magikarp', 'wooper', 'psyduck', 'poliwag', 'slowpoke', 'shellder', 'horsea', 'seel', 'barboach', 'corphish', 'shellos', 'ducklett', 'arrokuda', 'wiglett', 'finizen', 'veluza', 'clauncher', 'skrelp', 'tentacool', 'lapras', 'quagsire', 'golduck', 'poliwhirl', 'seadra', 'whiscash', 'gastrodon'],
      mid: ['quagsire', 'golduck', 'poliwhirl', 'seadra', 'whiscash', 'gastrodon', 'crawdaunt', 'wugtrio', 'magikarp', 'corphish'],
      high: ['quagsire', 'golduck', 'poliwhirl', 'seadra', 'whiscash', 'gastrodon', 'crawdaunt', 'wugtrio', 'barraskewda', 'swanna'],
      late: ['gyarados', 'golduck', 'quagsire', 'crawdaunt', 'gastrodon', 'kingdra', 'wugtrio', 'barraskewda', 'cloyster', 'seadra'],
      end: ['gyarados', 'golduck', 'crawdaunt', 'kingdra', 'barraskewda', 'wugtrio', 'cloyster', 'lapras', 'palafin', 'veluza', 'quagsire'],
    },
  },
  {
    id: 'psychic',
    money: { base: 120, jitter: 50 },
    name: 'Psychic',
    className: 'Psychic',
    spriteKey: 'psychic',
    colour: 0xa78bfa,
    battleSprite: 'psychic',
    pools: {
      early: ['drowzee', 'ralts', 'spoink', 'bronzor', 'gothita', 'solosis', 'espurr', 'indeedee'],
      low: ['drowzee', 'ralts', 'spoink', 'bronzor', 'gothita', 'solosis', 'espurr', 'indeedee', 'kirlia', 'grumpig', 'gothorita', 'duosion'],
      mid: ['kirlia', 'grumpig', 'gothorita', 'duosion', 'bronzong', 'meowstic', 'drowzee', 'ralts'],
      high: ['kirlia', 'grumpig', 'gothorita', 'duosion', 'bronzong', 'meowstic', 'indeedee'],
      late: ['gardevoir', 'gallade', 'grumpig', 'gothitelle', 'reuniclus', 'bronzong', 'meowstic'],
      end: ['gardevoir', 'gallade', 'gothitelle', 'reuniclus', 'bronzong', 'meowstic', 'indeedee'],
    },
  },
  {
    id: 'blackbelt',
    money: { base: 130, jitter: 55 },
    name: 'Black Belt',
    className: 'Black Belt',
    spriteKey: 'blackbelt',
    colour: 0xef4444,
    battleSprite: 'blackbelt',
    pools: {
      early: ['makuhita', 'riolu', 'timburr', 'mienfoo', 'crabrawler', 'croagunk'],
      low: ['makuhita', 'riolu', 'timburr', 'mienfoo', 'crabrawler', 'croagunk', 'gurdurr'],
      mid: ['gurdurr', 'mienfoo', 'crabrawler', 'croagunk', 'makuhita', 'hariyama', 'timburr'],
      high: ['gurdurr', 'mienshao', 'crabominable', 'toxicroak', 'hariyama', 'passimian', 'crabrawler'],
      late: ['hariyama', 'mienshao', 'conkeldurr', 'toxicroak', 'crabominable', 'passimian', 'falinks'],
      end: ['conkeldurr', 'mienshao', 'lucario', 'toxicroak', 'crabominable', 'passimian', 'falinks', 'hariyama'],
    },
  },
  {
    id: 'ace',
    money: { base: 200, jitter: 80 },
    name: 'Ace Trainer',
    className: 'Ace Trainer',
    spriteKey: 'ace',
    colour: 0x94a3b8,
    battleSprite: 'ace',
    carriesMega: true,
    pools: {
      early: ['deino', 'axew', 'gible', 'noibat', 'dratini', 'goomy', 'tinkatink', 'pawniard', 'scraggy', 'mimikyu'],
      low: ['deino', 'axew', 'gible', 'noibat', 'dratini', 'goomy', 'tinkatink', 'pawniard', 'mimikyu', 'houndoom'],
      mid: ['deino', 'axew', 'gible', 'noibat', 'dratini', 'goomy', 'tinkatink', 'pawniard', 'scraggy', 'scizor'],
      high: ['gabite', 'fraxure', 'tinkatuff', 'scraggy', 'bisharp', 'zweilous', 'axew', 'gible', 'metagross'],
      late: ['gabite', 'fraxure', 'dragonair', 'sliggoo', 'tinkatuff', 'scrafty', 'bisharp', 'zweilous', 'lucario'],
      end: ['garchomp', 'dragonite', 'haxorus', 'goodra', 'hydreigon', 'kingambit', 'tinkaton', 'mimikyu', 'scrafty', 'gallade'],
    },
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
