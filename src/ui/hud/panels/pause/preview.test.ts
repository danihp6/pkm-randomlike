import { describe, expect, it } from 'vitest';
import { PAUSE_SLUG } from './view';
import { installPausePreview, pausePreviewRequested } from './preview';

describe('pausePreviewRequested', () => {
  it('is true only when both flags ask for this slug', () => {
    for (const search of [
      '?hud=dom&hudFixture=03n-panels-pause-menu',
      '?hudFixture=03n-panels-pause-menu&hud=dom',
      'hud=dom&hudFixture=03n-panels-pause-menu',
      '?hud=dom&hudFixture=03n-panels-pause-menu&extra=1',
      '?extra=1&hud=DOM&hudFixture=03N-PANELS-PAUSE-MENU',
    ]) {
      expect(pausePreviewRequested(search), search).toBe(true);
    }
    expect(PAUSE_SLUG).toBe('03n-panels-pause-menu');
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hudFixture=03n-panels-pause-menu',
      '?hud=dom&hudFixture=03k-panels-notice-item',
      '?hud=dom&hudFixture=m03n-panels-pause-menu',
      '?hud=dom&hudFixture=03n panels pause menu',
      '?hud=game&hudFixture=03n-panels-pause-menu',
    ]) {
      expect(pausePreviewRequested(search), search).toBe(false);
    }
  });
});

describe('installPausePreview', () => {
  it('is inert — no node, no listener — without the flags or without a document', () => {
    expect(installPausePreview('')).toBeNull();
    expect(installPausePreview('?hud=dom')).toBeNull();
    expect(installPausePreview('?hud=dom&hudFixture=03n-panels-pause-menu')).toBeNull();
  });
});
