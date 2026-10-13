import { describe, expect, it } from 'vitest';
import meta from './meta.json';
import { allDexItems, getDexItem } from './items';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

describe('item accessors', () => {
  it('finds an item by id, normalising case and punctuation', () => {
    expect(getDexItem('choiceband')?.name).toBe('Choice Band');
    expect(getDexItem('Choice Band')).toBe(getDexItem('choiceband'));
    expect(getDexItem('Never-Melt-Ice')?.id).toBe('nevermeltice');
    expect(getDexItem('not-an-item')).toBeUndefined();
  });

  it('carries the dex text a catalogue row borrows', () => {
    const band = getDexItem('choiceband');
    expect(band?.shortDesc.length).toBeGreaterThan(0);
    expect(band?.desc.length).toBeGreaterThan(0);
    expect(band?.num).toBeGreaterThan(0);
    expect(band?.isNonstandard).toBeNull();
  });

  it('keeps the berry flag and the Natural Gift pair', () => {
    expect(getDexItem('sitrusberry')?.isBerry).toBe(true);
    expect(getDexItem('sitrusberry')?.naturalGift).toEqual({ basePower: 80, type: 'Psychic' });
    expect(getDexItem('choiceband')?.isBerry).toBeUndefined();
    expect(getDexItem('choiceband')?.naturalGift).toBeUndefined();
  });

  it('exposes the whole generated item set', () => {
    expect(allDexItems().length).toBe(counts.items);
  });
});
