import { describe, expect, it } from 'vitest';
import { runOverPreviewRequested } from './preview';

describe('runOverPreviewRequested', () => {
  it('is true only when both flags ask for one of this panel’s frames', () => {
    for (const search of [
      '?hud=dom&hudFixture=06-run-over-defeat',
      '?hud=dom&hudFixture=07-run-over-victory',
      '?hud=dom&hudFixture=07b-run-over-victory-pokemon',
      '?hudFixture=07-run-over-victory&hud=dom',
      '?hudFixture=06-run-over-defeat&hud=dom',
      '?hud=dom&hudFixture=07b-run-over-victory-pokemon&extra=1',
      '?extra=1&hud=DOM&hudFixture=06-RUN-OVER-DEFEAT',
    ]) {
      expect(runOverPreviewRequested(search), search).toBe(true);
    }
  });

  it('is false without both flags or for another frame', () => {
    for (const search of [
      '',
      '?hud=dom',
      '?hudFixture=06-run-over-defeat',
      '?hudFixture=07-run-over-victory',
      '?hud=game&hudFixture=06-run-over-defeat',
      '?hud=dom&hudFixture=01-main-menu',
      '?hud=dom&hudFixture=m06-run-over-defeat',
      '?hud=dom&hudFixture=m07-run-over-victory',
      '?hud=dom&hudFixture=08-stats-totals',
      '?hud=dom&hudFixture=06 run over defeat',
      '?hud=dom&hudFixture=',
    ]) {
      expect(runOverPreviewRequested(search), search).toBe(false);
    }
  });
});
