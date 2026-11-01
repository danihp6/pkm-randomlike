import { describe, expect, it } from 'vitest';
import { HUD_PANEL_IDS, defaultHudLayout, parseHudLayout } from './hudLayout';

describe('the HUD layout', () => {
  it('carries the mission card as its own saved slot, collapsed by default', () => {
    expect(HUD_PANEL_IDS).toContain('missions');
    expect(defaultHudLayout().missions).toEqual({ dx: 0, dy: 0, collapsed: true });
  });

  it('defaults a document that predates the mission card to collapsed', () => {
    const legacy = {
      header: { dx: 0, dy: 0, collapsed: false },
      party: { dx: 40, dy: -12, collapsed: false },
      bag: { dx: 0, dy: 0, collapsed: true },
      box: { dx: 0, dy: 0, collapsed: true },
      detail: { dx: 0, dy: 0, collapsed: true },
    };
    const layout = parseHudLayout(legacy);
    expect(layout.missions).toEqual({ dx: 0, dy: 0, collapsed: true });
    expect(layout.party).toEqual({ dx: 40, dy: -12, collapsed: false });
  });

  it('reads a saved mission slot back, with its offset and its open flag', () => {
    const layout = parseHudLayout({
      missions: { dx: 24, dy: 8, collapsed: false },
    });
    expect(layout.missions).toEqual({ dx: 24, dy: 8, collapsed: false });
  });

  it('junk in the mission slot falls back to the default, never to a NaN offset', () => {
    for (const value of [null, 'nope', 42, [], { dx: Number.NaN, dy: 'x', collapsed: 'yes' }]) {
      expect(parseHudLayout({ missions: value }).missions).toEqual(defaultHudLayout().missions);
    }
  });
});
