import { describe, expect, it } from 'vitest';
import { battleLogPreviewRequested } from './preview';

describe('battleLogPreviewRequested', () => {
  it('is true only when both flags ask for one of this frame s two exports', () => {
    for (const search of [
      '?hud=dom&hudFixture=05b-battle-message',
      '?hudFixture=05b-battle-message&hud=dom',
      '?hud=dom&hudFixture=m05b-battle-message',
      '?hud=dom&hudFixture=05b-battle-message&extra=1',
      '?extra=1&hud=DOM&hudFixture=05B-BATTLE-MESSAGE',
      '?hud=game&hudFixture=05b-battle-message',
      '?hudFixture=05b-battle-message',
    ]) {
      expect(battleLogPreviewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hud=dom&hudFixture=05-battle-hud',
      '?hud=dom&hudFixture=05c-battle-bag',
      '?hud=dom&hudFixture=05d-battle-pokemon',
      '?hud=dom&hudFixture=05b battle message',
      '?hud=dom&hudFixture=05b%20battle%20message',
    ]) {
      expect(battleLogPreviewRequested(search), search).toBe(false);
    }
  });
});
