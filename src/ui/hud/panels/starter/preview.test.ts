import { describe, expect, it } from 'vitest';
import { starterPreviewRequested } from './preview';

describe('starterPreviewRequested', () => {
  it('is true only when both flags ask for one of this panel’s frames', () => {
    for (const search of [
      '?hud=dom&hudFixture=04-starter-pick',
      '?hud=dom&hudFixture=m04-starter-pick',
      '?hudFixture=04-starter-pick&hud=dom',
      '?hudFixture=m04-starter-pick&hud=dom',
      '?hud=dom&hudFixture=04-starter-pick&extra=1',
      '?extra=1&hud=DOM&hudFixture=04-STARTER-PICK',
      '?hudFixture=04-starter-pick',
      '?hud=game&hudFixture=04-starter-pick',
      '?hudFixture=m04-starter-pick',
    ]) {
      expect(starterPreviewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hud=dom&hudFixture=01-main-menu',
      '?hud=dom&hudFixture=03-route-hud',
      '?hud=dom&hudFixture=04',
      '?hud=dom&hudFixture=04 starter pick',
      '?hud=dom&hudFixture=',
    ]) {
      expect(starterPreviewRequested(search), search).toBe(false);
    }
  });
});
