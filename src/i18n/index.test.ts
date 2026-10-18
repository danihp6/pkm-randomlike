import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import font from '../data/ui/font.json';
import { en, type TranslationKey } from './en';
import { es } from './es';
import {
  DEFAULT_LOCALE,
  LOCALES,
  detectLocale,
  getLocale,
  isLocale,
  setLocale,
  t,
  translationParams,
} from './index';

const KEYS = Object.keys(en) as TranslationKey[];
const GLYPH_CODES = new Set(font.glyphs.map((glyph) => glyph.code));

/** Every token either table declares, so a render never trips the missing-param throw. */
function unionParams(key: TranslationKey): Record<string, string> {
  const params: Record<string, string> = {};
  for (const name of [...translationParams(en[key]), ...translationParams(es[key])]) {
    params[name] = 'X';
  }
  return params;
}

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

describe('the tables', () => {
  it('carries the same keys in both tables, both ways', () => {
    const english = new Set(Object.keys(en));
    const spanish = new Set(Object.keys(es));
    expect(spanish).toEqual(english);
    expect(Object.keys(es).length).toBe(Object.keys(en).length);
    for (const key of english) expect(spanish.has(key)).toBe(true);
    for (const key of spanish) expect(english.has(key)).toBe(true);
  });

  it('leaves no unresolved interpolation in either locale', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const key of KEYS) {
        const rendered = t(key, unionParams(key));
        expect(rendered, `${locale}:${key}`).not.toContain('{');
        expect(rendered, `${locale}:${key}`).not.toContain('}');
      }
    }
  });

  it('never declares a param in Spanish that English does not', () => {
    for (const key of KEYS) {
      const declared = new Set(translationParams(en[key]));
      for (const name of translationParams(es[key])) {
        expect(declared.has(name), `${key}: ${name}`).toBe(true);
      }
    }
  });

  it('draws every Spanish character in the FRLG font', () => {
    for (const key of KEYS) {
      // A `{token}` is substituted before drawing, and `\n` is a line break the
      // window splits on, not a glyph.
      const text = es[key].replace(/\{[A-Za-z0-9_]+\}/g, '').replace(/\n/g, '');
      for (const char of text) {
        const code = char.codePointAt(0)!;
        expect(GLYPH_CODES.has(code), `${key}: U+${code.toString(16)}`).toBe(true);
      }
    }
  });
});

describe('width guards', () => {
  function valuesFor(prefix: string): readonly [TranslationKey, string, string][] {
    return KEYS.filter((key) => key.startsWith(prefix)).map((key) => [key, en[key], es[key]]);
  }

  it('keeps every status chip exactly three characters wide', () => {
    const statuses = valuesFor('status.');
    expect(statuses).toHaveLength(6);
    for (const [key, english, spanish] of statuses) {
      expect(english.length, key).toBe(3);
      expect(spanish.length, key).toBe(3);
    }
  });

  it('keeps every bag pocket label at six characters or fewer', () => {
    const pockets = valuesFor('bag.');
    expect(pockets).toHaveLength(5);
    for (const [key, english, spanish] of pockets) {
      expect(english.length, key).toBeLessThanOrEqual(6);
      expect(spanish.length, key).toBeLessThanOrEqual(6);
    }
  });

  it('keeps every detail stat label at seven characters or fewer', () => {
    const stats = valuesFor('detail.stat.');
    expect(stats).toHaveLength(6);
    for (const [key, english, spanish] of stats) {
      expect(english.length, key).toBeLessThanOrEqual(7);
      expect(spanish.length, key).toBeLessThanOrEqual(7);
    }
  });

  it('keeps every battle command at seven characters or fewer', () => {
    const commands = valuesFor('battle.command.');
    expect(commands).toHaveLength(4);
    for (const [key, english, spanish] of commands) {
      expect(english.length, key).toBeLessThanOrEqual(7);
      expect(spanish.length, key).toBeLessThanOrEqual(7);
    }
  });
});

describe('detectLocale', () => {
  it('matches the primary subtag exactly', () => {
    expect(detectLocale('es-ES')).toBe('es');
    expect(detectLocale('es')).toBe('es');
    expect(detectLocale('ES-mx')).toBe('es');
    expect(detectLocale('es_MX')).toBe('es');
  });

  it('falls back to the source table for everything else', () => {
    expect(detectLocale('en-GB')).toBe('en');
    expect(detectLocale('fr-FR')).toBe('en');
    expect(detectLocale('ca-ES')).toBe('en');
    expect(detectLocale('')).toBe('en');
    expect(detectLocale('not a tag')).toBe('en');
  });
});

describe('isLocale', () => {
  it('accepts the shipped locales and rejects anything else', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(42)).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('translationParams', () => {
  it('reads the token names in order of first appearance, deduped', () => {
    expect(translationParams('{name} learned {move}!')).toEqual(['name', 'move']);
    expect(translationParams('{a}{b}{a}')).toEqual(['a', 'b']);
    expect(translationParams('no tokens here')).toEqual([]);
    expect(translationParams('{not a token}{ok_1}')).toEqual(['ok_1']);
  });
});

describe('t / setLocale / getLocale', () => {
  it('starts on the source table', () => {
    expect(getLocale()).toBe('en');
    expect(t('menu.new')).toBe('New run');
  });

  it('reads the current locale and switches in place', () => {
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('menu.new')).toBe('Nueva partida');
    setLocale('en');
    expect(t('menu.new')).toBe('New run');
  });

  it('leaves the locale alone when set to a value it does not ship', () => {
    setLocale('es');
    setLocale('fr' as unknown as 'en');
    expect(getLocale()).toBe('es');
    setLocale(42 as unknown as 'en');
    expect(getLocale()).toBe('es');
  });

  it('interpolates a named and a number param', () => {
    expect(t('route.learned', { name: 'Charmander', move: 'Ember' })).toBe('Charmander learned Ember!');
    expect(t('battle.xp', { xp: 1200 })).toBe('XP 1200');
  });

  it('ignores extra params', () => {
    expect(t('battle.xp', { xp: 7, spare: 'unused' })).toBe('XP 7');
  });

  it('throws when a token has no param, naming the key and the token', () => {
    expect(() => t('route.learned', { name: 'Charmander' })).toThrow(Error);
    expect(() => t('route.learned', { name: 'Charmander' })).toThrow(
      'i18n: missing param "move" for key "route.learned"',
    );
    expect(() => t('battle.xp')).toThrow('i18n: missing param "xp" for key "battle.xp"');
  });

  it('keeps the Spanish wording of the anchors the next tasks build on', () => {
    setLocale('es');
    expect(t('route.mapTitle', { map: 2, biome: 'Deep Forest' })).toBe('Mapa 2 · Deep Forest');
    expect(t('starter.title')).toBe('Elige tu inicial');
    expect(t('battle.promptAction', { name: 'Pikachu' })).toBe('¿Qué hará Pikachu?');
    expect(t('battle.outcomeCaught', { name: 'Sentret' })).toBe('¡Sentret ha sido capturado!');
    expect(t('route.learned', { name: 'Charmander', move: 'Ember' })).toBe(
      '¡Charmander ha aprendido Ember!',
    );
    expect(t('route.released', { level: 7, name: 'Sentret' })).toBe('Nv7 Sentret\nha sido liberado.');
    expect(t('notice.catchToPc', { name: 'Sentret' })).toBe(
      'Tu equipo está lleno: Sentret se ha ido al PC. Puedes cambiarlo antes de salir de esta ruta.',
    );
    expect(t('notice.itemObtained', { name: 'Potion' })).toBe('¡Has obtenido Potion!');
    expect(t('runOver.headlineWin')).toBe('¡La ruta final ha caído. Has ganado!');
    expect(t('runOver.blurbLoss')).toBe('La partida ha terminado: no queda nada.');
  });

  it('renders the keys the swept call sites interpolate, in both locales', () => {
    expect(t('release.controls', { confirm: 'Z' })).toBe('Z — continue');
    expect(t('dev.move', { n: 3 })).toBe('Move 3');
    setLocale('es');
    expect(t('release.controls', { confirm: 'Z' })).toBe('Z · continuar');
    expect(t('dev.move', { n: 3 })).toBe('Movimiento 3');
  });
});

describe('the source table is the record', () => {
  it('keeps the shipped English wording verbatim', () => {
    expect(en['menu.title']).toBe('PokeRandomLike');
    expect(en['menu.subtitle']).toBe('A Pokémon roguelike');
    expect(en['menu.continue']).toBe('Continue');
    expect(en['menu.new']).toBe('New run');
    expect(en['menu.options']).toBe('Options');
    expect(en['starter.title']).toBe('Choose your starter');
    expect(en['runOver.headlineWin']).toBe('The final route falls. You win!');
    expect(en['runOver.headlineLoss']).toBe('You have no more Pokémon!');
    expect(en['runOver.blurbWin']).toBe('Every route cleared — the chain ends here.');
    expect(en['runOver.blurbLoss']).toBe('The run is over — nothing carries over.');
    expect(en['settings.title']).toBe('SETTINGS');
    expect(en['hud.vial']).toBe('POKEVIAL');
    expect(en['hud.noMap']).toBe('no map');
    expect(en['hud.noItems']).toBe('no items');
    expect(en['hud.pressAnyKey']).toBe('press any key');
    expect(en['detail.noMovesToLearn']).toBe('no moves to learn');
    expect(en['route.mapTitle']).toBe('Map {map} · {biome}');
    expect(en['route.released']).toBe('Lv{level} {name}\nwas released.');
    expect(en['battle.command.fight']).toBe('FIGHT');
    expect(en['battle.command.bag']).toBe('BAG');
    expect(en['battle.command.switch']).toBe('SWITCH');
    expect(en['battle.command.run']).toBe('RUN');
    expect(en['battle.promptAction']).toBe('What will {name} do?');
    expect(en['battle.outcomeCaught']).toBe('Gotcha! {name} was caught!');
    expect(en['notice.catchToPc']).toBe(
      'Your party is full — {name} went to the PC. You can swap it in before you leave this route.',
    );
    expect(en['notice.itemObtained']).toBe('Obtained {name}!');
    expect(en['party.rowLabel']).toBe('{name}  Lv{level}{status}');
    expect(en['common.level']).toBe('Lv{level}');
    expect(en['common.unknownPokemon']).toBe('A Pokemon');
  });

  it('names each language in its own language', () => {
    expect(es['menu.title']).toBe(en['menu.title']);
    expect(es['hud.vial']).toBe(en['hud.vial']);
    expect(es['settings.title']).toBe('AJUSTES');
    expect(es['menu.new']).toBe('Nueva partida');
    expect(es['battle.command.fight']).toBe('LUCHAR');
    expect(es['battle.command.bag']).toBe('MOCHILA');
    expect(es['battle.command.switch']).toBe('CAMBIAR');
    expect(es['battle.command.run']).toBe('HUIR');
  });

  it('never uses the em dash the FRLG font cannot draw, in Spanish', () => {
    for (const key of KEYS) {
      expect(es[key], key).not.toContain('\u2014');
    }
  });
});

/**
 * The one mistake the tables cannot see: a call site whose param names do not
 * match the tokens its own key declares. A missing one throws at runtime (the
 * release overlay crashed that way) and an extra one is silently ignored (the
 * dev panel's `Move` lost its number), so this walks every `t('<key>', { … })`
 * call site in `src/` and compares the two sets.
 */
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CALL_SITE = /(?<![\w.$])t\(\s*'([a-z][A-Za-z0-9.]*)'/g;

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

/** The top-level property names of a `{ … }` literal body; nested brackets skipped. */
function propertyNames(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of body) {
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
    if (char === '{' || char === '(' || char === '[') depth++;
    else if (char === '}' || char === ')' || char === ']') depth--;
  }
  parts.push(current);
  return parts
    .map((part) => part.split(':')[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

type CallSite = Readonly<{ file: string; line: number; key: TranslationKey; params: readonly string[] }>;

function callSites(file: string, source: string): readonly CallSite[] {
  const sites: CallSite[] = [];
  CALL_SITE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CALL_SITE.exec(source)) !== null) {
    const key = match[1] as TranslationKey;
    if (!(key in en)) continue;
    let index = CALL_SITE.lastIndex;
    while (/\s/.test(source[index])) index++;
    let params: readonly string[] = [];
    if (source[index] === ',') {
      index++;
      while (/\s/.test(source[index])) index++;
      if (source[index] !== '{') continue;
      let depth = 0;
      let end = index;
      for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        else if (source[end] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      params = propertyNames(source.slice(index + 1, end));
    }
    sites.push({ file, line: source.slice(0, match.index).split('\n').length, key, params });
  }
  return sites;
}

describe('the call sites', () => {
  const sites = sourceFiles(SRC_DIR).flatMap((file) =>
    callSites(relative(SRC_DIR, file), readFileSync(file, 'utf8')),
  );

  it('scans the whole source tree', () => {
    expect(sites.length).toBeGreaterThan(250);
  });

  it('supplies exactly the tokens each key declares', () => {
    const mismatches: string[] = [];
    for (const site of sites) {
      const declared = translationParams(en[site.key]);
      const missing = declared.filter((name) => !site.params.includes(name));
      const extra = site.params.filter((name) => !declared.includes(name));
      if (missing.length > 0 || extra.length > 0) {
        mismatches.push(`${site.file}:${site.line}: ${site.key} missing [${missing}] extra [${extra}]`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
