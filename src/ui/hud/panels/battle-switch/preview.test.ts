import { describe, expect, it } from 'vitest';
import { previewRequested } from './preview';

describe('previewRequested', () => {
  it('is true only when both flags ask for this frame', () => {
    for (const search of [
      '?hud=dom&hudFixture=05d-battle-pokemon',
      '?hudFixture=05d-battle-pokemon&hud=dom',
      '?hud=dom&hudFixture=05d-battle-pokemon&extra=1',
      '?extra=1&hud=DOM&hudFixture=05D-BATTLE-POKEMON',
    ]) {
      expect(previewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hudFixture=05d-battle-pokemon',
      '?hud=dom&hudFixture=05-battle-hud',
      '?hud=dom&hudFixture=05c-battle-bag',
      '?hud=dom&hudFixture=m05d-battle-pokemon',
      '?hud=dom&hudFixture=05d battle pokemon',
      '?hud=dom&hudFixture=05d%20battle%20pokemon',
      '?hud=game&hudFixture=05d-battle-pokemon',
    ]) {
      expect(previewRequested(search), search).toBe(false);
    }
  });
});
