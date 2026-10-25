import { describe, expect, it } from 'vitest';
import { statsPreviewRequested } from './preview';

describe('statsPreviewRequested', () => {
  it('is true only when both flags ask for one of this panel’s frames', () => {
    for (const search of [
      '?hud=dom&hudFixture=08-stats-totals',
      '?hud=dom&hudFixture=08b-stats-runs',
      '?hud=dom&hudFixture=08c-stats-pokemon',
      '?hud=dom&hudFixture=09-ranking',
      '?hud=dom&hudFixture=09b-ranking-pokemon',
      '?hudFixture=08-stats-totals&hud=dom',
      '?hudFixture=09b-ranking-pokemon&hud=dom',
      '?hud=dom&hudFixture=08c-stats-pokemon&extra=1',
      '?extra=1&hud=DOM&hudFixture=09-RANKING',
    ]) {
      expect(statsPreviewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hudFixture=08-stats-totals',
      '?hudFixture=09-ranking',
      '?hud=game&hudFixture=08-stats-totals',
      '?hud=dom&hudFixture=01-main-menu',
      '?hud=dom&hudFixture=07-run-over-victory',
      '?hud=dom&hudFixture=m08-stats-totals',
      '?hud=dom&hudFixture=m09-ranking',
      '?hud=dom&hudFixture=08 stats totals',
      '?hud=dom&hudFixture=',
    ]) {
      expect(statsPreviewRequested(search), search).toBe(false);
    }
  });
});
