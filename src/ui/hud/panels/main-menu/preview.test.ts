import { describe, expect, it } from 'vitest';
import { mainMenuPreviewRequested } from './preview';

describe('mainMenuPreviewRequested', () => {
  it('is true only when both flags ask for one of this panel’s frames', () => {
    for (const search of [
      '?hud=dom&hudFixture=01-main-menu',
      '?hud=dom&hudFixture=01b-main-menu-no-save',
      '?hudFixture=01-main-menu&hud=dom',
      '?hudFixture=01b-main-menu-no-save&hud=dom',
      '?hud=dom&hudFixture=01-main-menu&extra=1',
      '?extra=1&hud=DOM&hudFixture=01-MAIN-MENU',
      '?hudFixture=01-main-menu',
      '?hud=game&hudFixture=01-main-menu',
      '?hudFixture=01b-main-menu-no-save',
    ]) {
      expect(mainMenuPreviewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hud=dom&hudFixture=02-options',
      '?hud=dom&hudFixture=m01-main-menu',
      '?hud=dom&hudFixture=m01b-main-menu-no-save',
      '?hud=dom&hudFixture=01 main menu',
      '?hud=dom&hudFixture=01%20main%20menu',
      '?hud=dom&hudFixture=',
    ]) {
      expect(mainMenuPreviewRequested(search), search).toBe(false);
    }
  });
});
