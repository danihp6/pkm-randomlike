import { describe, expect, it } from 'vitest';
import { barClass, chipClass, joinClasses, panelClass, rowClass, typeBadgeClass } from './classes';

describe('joinClasses', () => {
  it('joins the truthy names with a single space', () => {
    expect(joinClasses('kit-row', 'kit-row--selected')).toBe('kit-row kit-row--selected');
  });

  it('drops every falsy part and never leaves a double space', () => {
    for (const parts of [
      [],
      [undefined],
      [null],
      [false],
      [''],
      ['  '],
      ['kit-row', undefined, '  ', null, false],
    ] as const) {
      expect(joinClasses(...parts)).not.toContain('  ');
      expect(joinClasses(...parts)).toBe(joinClasses(...parts).trim());
    }
    expect(joinClasses()).toBe('');
    expect(joinClasses('a', undefined, 'b')).toBe('a b');
  });
});

describe('panelClass', () => {
  it('is the panel class alone, or the panel plus the caller class', () => {
    expect(panelClass()).toBe('kit-panel');
    expect(panelClass({})).toBe('kit-panel');
    expect(panelClass({ class: 'options' })).toBe('kit-panel options');
  });
});

describe('rowClass', () => {
  it('adds one modifier per truthy flag', () => {
    expect(rowClass()).toBe('kit-row');
    expect(rowClass({ interactive: true })).toBe('kit-row kit-row--interactive');
    expect(rowClass({ selected: true, disabled: true })).toBe(
      'kit-row kit-row--selected kit-row--disabled',
    );
    expect(rowClass({ interactive: true, selected: true, disabled: true, class: 'bag-row' })).toBe(
      'kit-row kit-row--interactive kit-row--selected kit-row--disabled bag-row',
    );
  });

  it('never treats a false flag as truthy', () => {
    expect(rowClass({ interactive: false, selected: false, disabled: false })).toBe('kit-row');
  });
});

describe('chipClass', () => {
  it('carries the base kit class and the active modifier only when active', () => {
    expect(chipClass()).toBe('kit kit-chip');
    expect(chipClass({ active: false })).toBe('kit kit-chip');
    expect(chipClass({ active: true })).toBe('kit kit-chip kit-chip--active');
  });
});

describe('barClass', () => {
  it('defaults to the hp tone and switches on the given one', () => {
    expect(barClass()).toBe('kit-bar kit-bar--hp');
    expect(barClass({ tone: 'hp' })).toBe('kit-bar kit-bar--hp');
    expect(barClass({ tone: 'xp' })).toBe('kit-bar kit-bar--xp');
    expect(barClass({ tone: 'charge' })).toBe('kit-bar kit-bar--charge');
  });
});

describe('typeBadgeClass', () => {
  it('is the type badge class and nothing else', () => {
    expect(typeBadgeClass()).toBe('kit-type');
  });
});
