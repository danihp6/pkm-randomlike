import { afterEach, describe, expect, it } from 'vitest';
import { allAbilities } from '../data/dex/abilities';
import { allMoves } from '../data/dex/moves';
import abilitiesEs from '../data/i18n/es/abilities.json';
import meta from '../data/i18n/es/meta.json';
import movesEs from '../data/i18n/es/moves.json';
import {
  MISSING_ES,
  abilityDescription,
  abilityName,
  abilityNameFromEnglish,
  moveDescription,
  moveName,
  moveShortDescription,
} from './content';
import { DEFAULT_LOCALE, setLocale } from './index';

type ContentRow = Readonly<{ name: string; description: string; shortDescription: string }>;
type DexRow = Readonly<{ id: string; desc: string; shortDesc: string }>;

const MOVES_ES = movesEs as unknown as Readonly<Record<string, ContentRow>>;
const ABILITIES_ES = abilitiesEs as unknown as Readonly<Record<string, ContentRow>>;

const AUTHORED_MOVES: readonly string[] = [
  'alluringvoice',
  'burningbulwark',
  'dragoncheer',
  'electroshot',
  'ficklebeam',
  'hardpress',
  'ivycudgel',
  'malignantchain',
  'matchagotcha',
  'mightycleave',
  'psychicnoise',
  'supercellslam',
  'syrupbomb',
  'tachyoncutter',
  'temperflare',
  'terastarstorm',
  'thunderclap',
  'upperhand',
];

const AUTHORED_ABILITIES: readonly string[] = [
  'angershell',
  'armortail',
  'beadsofruin',
  'commander',
  'costar',
  'cudchew',
  'eartheater',
  'electromorphosis',
  'embodyaspectcornerstone',
  'embodyaspecthearthflame',
  'embodyaspectteal',
  'embodyaspectwellspring',
  'goodasgold',
  'guarddog',
  'hadronengine',
  'hospitality',
  'lingeringaroma',
  'mindseye',
  'myceliummight',
  'opportunist',
  'orichalcumpulse',
  'poisonpuppeteer',
  'protosynthesis',
  'purifyingsalt',
  'quarkdrive',
  'rockypayload',
  'seedsower',
  'sharpness',
  'supersweetsyrup',
  'supremeoverlord',
  'swordofruin',
  'tabletsofruin',
  'teraformzero',
  'terashell',
  'terashift',
  'thermalexchange',
  'toxicchain',
  'toxicdebris',
  'vesselofruin',
  'wellbakedbody',
  'windpower',
  'windrider',
  'zerotohero',
];

const ENGLISH_TOKENS: readonly string[] = [
  ' the ',
  ' and ',
  ' with ',
  ' this ',
  ' move ',
  ' damage ',
  ' power ',
  ' user ',
  ' target ',
];

afterEach(() => setLocale(DEFAULT_LOCALE));

function expectSpanishTable(
  rows: Readonly<Record<string, ContentRow>>,
  dexRows: readonly DexRow[],
  authored: readonly string[],
): void {
  const dexById = new Map(dexRows.map((row) => [row.id, row] as const));
  const authoredIds = new Set(authored);

  for (const id of authored) expect(rows[id], id).toBeDefined();

  for (const [id, row] of Object.entries(rows)) {
    const dex = dexById.get(id);
    if (!dex) throw new Error(`${id} has a Spanish row but no dex row`);

    expect(row.description.length, id).toBeGreaterThanOrEqual(15);
    expect(row.description.length, id).toBeLessThanOrEqual(200);
    expect(row.shortDescription.length, id).toBeGreaterThan(0);

    const english = [dex.desc, dex.shortDesc]
      .filter((text) => text.length > 0)
      .map((text) => text.trim().toLowerCase());
    expect(english, id).not.toContain(row.description.trim().toLowerCase());

    const padded = ` ${row.description.toLowerCase()} `;
    for (const token of ENGLISH_TOKENS) expect(padded, `${id}:${token}`).not.toContain(token);

    // Only the rows authored for this language are held to the one-clause bound:
    // the imported PokeAPI rows reuse the long text in `shortDescription`.
    if (authoredIds.has(id)) {
      expect(row.shortDescription.length, id).toBeGreaterThanOrEqual(10);
      expect(row.shortDescription.length, id).toBeLessThanOrEqual(80);
    }
  }
}

describe('the Spanish content table', () => {
  it('covers every move and ability', () => {
    expect(meta.moves.named).toBe(allMoves().length);
    expect(meta.moves.named).toBe(835);
    expect(meta.abilities.named).toBe(311);
    expect(meta.abilities.total).toBe(allAbilities().length);
    expect(meta.moves.described).toBe(835);
    expect(meta.abilities.described).toBe(311);
    expect(meta.moves.missingNames).toEqual([]);
    expect(meta.abilities.missingNames).toEqual([]);
    expect(meta.moves.missingDescriptions).toEqual([]);
    expect(meta.abilities.missingDescriptions).toEqual([]);
    expect(MISSING_ES).toEqual([]);
    expect(new Set(MISSING_ES).size).toBe(MISSING_ES.length);
  });

  it('describes the 61 authored rows in Spanish prose', () => {
    expect(AUTHORED_MOVES).toHaveLength(18);
    expect(AUTHORED_ABILITIES).toHaveLength(43);
    expectSpanishTable(MOVES_ES, allMoves(), AUTHORED_MOVES);
    expectSpanishTable(ABILITIES_ES, allAbilities(), AUTHORED_ABILITIES);
  });

  it('prints the official Spanish names, not literal translations', () => {
    setLocale('es');
    expect(moveName('tackle')).toBe('Placaje');
    expect(moveName('ember')).toBe('Ascuas');
    expect(moveName('growl')).toBe('Gruñido');
    expect(moveName('alluringvoice')).toBe('Canto Encantador');
    expect(moveName('dragoncheer')).toBe('Bramido Dragón');
    expect(moveName('malignantchain')).toBe('Cadena Virulenta');
    expect(abilityName('blaze')).toBe('Mar Llamas');
    expect(abilityName('torrent')).toBe('Torrente');
    expect(abilityName('overgrow')).toBe('Espesura');
    expect(abilityNameFromEnglish('Blaze')).toBe('Mar Llamas');
  });

  it('prints the official Spanish descriptions and keeps English intact', () => {
    setLocale('es');
    expect(moveDescription('tackle')).toBe('Embestida con todo el cuerpo.');
    expect(moveShortDescription('tackle')).toBe('Embestida con todo el cuerpo.');
    expect(moveDescription('ember')).toContain('quemaduras');
    expect(abilityDescription('blaze')).toContain('tipo Fuego');
    expect(abilityDescription('overgrow')).toContain('tipo Planta');
    for (const id of AUTHORED_MOVES) {
      expect(moveDescription(id).length, id).toBeGreaterThan(0);
      expect(moveShortDescription(id).length, id).toBeGreaterThan(0);
    }
    for (const id of AUTHORED_ABILITIES) {
      expect(abilityDescription(id).length, id).toBeGreaterThan(0);
    }

    setLocale('en');
    expect(moveName('tackle')).toBe('Tackle');
    expect(moveDescription('tackle')).toBe('No additional effect.');
    expect(abilityName('blaze')).toBe('Blaze');
    expect(abilityDescription('blaze')).toContain('1/3');
  });
});
