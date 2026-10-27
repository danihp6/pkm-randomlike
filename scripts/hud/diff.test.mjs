import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALLOWLIST,
  SCREEN_MARKERS,
  chromeCandidates,
  classifyScreen,
  desktopSlugs,
  framesWithoutFixtures,
  screenOf,
} from './diff.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCREENS = join(ROOT, 'design', 'screens');
const FIXTURES = join(ROOT, 'design', 'fixtures');
const HUD_STATE_KEYS = ['party', 'bag', 'money', 'route', 'battle', 'notice'];

const screenSlugs = desktopSlugs(readdirSync(SCREENS));
const fixtureFiles = readdirSync(FIXTURES).filter((name) => name.endsWith('.json'));
const fixtureSlugs = fixtureFiles.map((name) => name.slice(0, -'.json'.length)).sort();
const fixtures = fixtureFiles.map((name) => ({
  name,
  slug: name.slice(0, -'.json'.length),
  json: JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')),
}));

describe('chromeCandidates', () => {
  it('puts the override first, then Linux, then Windows and Edge', () => {
    const candidates = chromeCandidates({ CHROME_PATH: '/opt/chrome', LOCALAPPDATA: 'C:/Users/dev/AppData/Local' });
    expect(candidates[0]).toBe('/opt/chrome');
    const linux = candidates.indexOf('/usr/bin/google-chrome');
    expect(linux).toBeGreaterThan(0);
    for (const windows of candidates.filter((candidate) => candidate.startsWith('C:/'))) {
      expect(candidates.indexOf(windows)).toBeGreaterThan(linux);
    }
    expect(candidates).toContain('C:/Users/dev/AppData/Local/Google/Chrome/Application/chrome.exe');
    expect(candidates[candidates.length - 1]).toBe('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
  });

  it('drops an unset override instead of keeping an empty candidate', () => {
    const candidates = chromeCandidates({ LOCALAPPDATA: 'C:/Users/dev/AppData/Local' });
    expect(candidates).not.toContain(undefined);
    expect(candidates).not.toContain('');
    expect(candidates[0]).toBe('/usr/bin/google-chrome');
  });

  it('finds this machine’s Chromium without CHROME_PATH', () => {
    expect(chromeCandidates({}).includes('/usr/bin/google-chrome')).toBe(true);
  });
});

describe('desktopSlugs', () => {
  it('keeps the desk frames, drops the mobile twins and everything that is not a PNG', () => {
    expect(desktopSlugs(['02-options.png', 'm02-options.png', '02-options.svg', 'README.md'])).toEqual([
      '02-options',
    ]);
  });
});

describe('the board’s frames and their fixtures', () => {
  it('reads the 33 desk frames the board ships', () => {
    expect(screenSlugs).toHaveLength(33);
    expect(screenSlugs[0]).toBe('01-main-menu');
    expect(screenSlugs[screenSlugs.length - 1]).toBe('09b-ranking-pokemon');
  });

  it('reports a frame with neither a fixture nor an allow-list entry', () => {
    const missing = framesWithoutFixtures(
      ['01-main-menu', '03c-panels-compress', '03e-route-shop-sell'],
      ['01-main-menu'],
      FIXTURE_ALLOWLIST,
    );
    expect(missing).toEqual(['03e-route-shop-sell']);
  });

  it('keeps an allow-listed frame out of the missing list and its reason non-empty', () => {
    const missing = framesWithoutFixtures(Object.keys(FIXTURE_ALLOWLIST), [], FIXTURE_ALLOWLIST);
    expect(missing).toEqual([]);
    for (const [slug, reason] of Object.entries(FIXTURE_ALLOWLIST)) {
      expect(typeof slug).toBe('string');
      expect(typeof reason).toBe('string');
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('has a fixture or a reasoned allow-list entry for every desk frame', () => {
    expect(framesWithoutFixtures(screenSlugs, fixtureSlugs)).toEqual([]);
  });

  it('names no allow-listed frame in a fixture, and ships no orphan fixture', () => {
    for (const slug of Object.keys(FIXTURE_ALLOWLIST)) {
      expect(fixtureSlugs).not.toContain(slug);
      expect(screenSlugs).toContain(slug);
    }
    expect(fixtureSlugs.filter((slug) => !screenSlugs.includes(slug))).toEqual([]);
  });
});

describe('every fixture file', () => {
  it('carries its own slug, the six-key state and a lower-kebab screen', () => {
    for (const { name, slug, json } of fixtures) {
      expect(json.slug, name).toBe(slug);
      expect(Object.keys(json.state), name).toEqual(HUD_STATE_KEYS);
      expect(typeof json.screen, name).toBe('string');
      expect(screenOf(json), name).toBe(json.screen);
    }
  });

  it('names a screen the harness knows how to read', () => {
    const screens = new Set([...Object.keys(SCREEN_MARKERS), ...fixtures.map((entry) => entry.json.screen)]);
    for (const screen of ['options', 'main-menu', 'starter', 'bag', 'shop', 'trade', 'notices']) {
      expect(screens.has(screen), screen).toBe(true);
    }
  });
});

describe('screenOf', () => {
  it('accepts a lower-kebab screen and nothing else', () => {
    expect(screenOf({ screen: 'options' })).toBe('options');
    expect(screenOf({ screen: 'battle-switch' })).toBe('battle-switch');
    for (const value of ['', 'Options', 'o p', 'a'.repeat(65), 7, null, true, ['options'], { id: 'options' }]) {
      expect(screenOf({ screen: value }), String(value)).toBeNull();
    }
    expect(screenOf({})).toBeNull();
    expect(screenOf(null)).toBeNull();
    expect(screenOf([{ screen: 'options' }])).toBeNull();
    expect(screenOf('options')).toBeNull();
  });
});

describe('classifyScreen', () => {
  it('compares a frame whose screen the page carries, and names that screen', () => {
    expect(classifyScreen('options', ['options', 'main-menu'])).toEqual({
      comparable: true,
      measured: 'options',
      reason: null,
    });
  });

  it('reports a frame the page cannot show as unavailable with the screen it needs', () => {
    expect(classifyScreen('shop', ['main-menu'])).toEqual({
      comparable: false,
      measured: 'main-menu',
      reason: 'the frame needs screen "shop"',
    });
    expect(classifyScreen('shop', []).measured).toBe('none');
  });

  it('compares a frame that names no screen, keeping today’s behaviour', () => {
    expect(classifyScreen(null, ['main-menu'])).toEqual({
      comparable: true,
      measured: 'main-menu',
      reason: null,
    });
    expect(classifyScreen(null, []).measured).toBe('none');
  });

  it('survives a reading that never arrived', () => {
    expect(classifyScreen('options', undefined)).toEqual({
      comparable: false,
      measured: 'none',
      reason: 'the frame needs screen "options"',
    });
  });
});

describe('the CLI', () => {
  it('is imported for its helpers without starting a server, a browser or an exit', () => {
    const module = pathToFileURL(join(ROOT, 'scripts', 'hud', 'diff.mjs')).href;
    const script = `import(${JSON.stringify(module)}).then((m) => console.log(Object.keys(m).sort().join(',')))`;
    const stdout = execFileSync(process.execPath, ['-e', script], {
      cwd: ROOT,
      timeout: 30000,
      encoding: 'utf8',
    });
    expect(stdout.trim().split(',')).toContain('chromeCandidates');
    expect(stdout).not.toContain('artifacts:');
  });
});
