import { h } from 'preact';
import { describe, expect, it } from 'vitest';
import { Bar, fillPercent } from './bar';
import { barClass } from './classes';

describe('fillPercent', () => {
  it('reads the fraction as a clamped percentage', () => {
    expect(fillPercent(0)).toBe('0%');
    expect(fillPercent(0.615)).toBe('61.5%');
    expect(fillPercent(1)).toBe('100%');
    expect(fillPercent(0.1234)).toBe('12.34%');
  });

  it('clamps below zero and above one', () => {
    expect(fillPercent(-1)).toBe('0%');
    expect(fillPercent(-0.4)).toBe('0%');
    expect(fillPercent(2)).toBe('100%');
  });

  it('falls back to zero for a non-finite fraction', () => {
    expect(fillPercent(Number.NaN)).toBe('0%');
    expect(fillPercent(Number.POSITIVE_INFINITY)).toBe('0%');
    expect(fillPercent(Number.NEGATIVE_INFINITY)).toBe('0%');
  });

  it('never prints a trailing zero pair', () => {
    for (const fraction of [0, 0.5, 1, 0.25]) {
      expect(fillPercent(fraction)).not.toContain('.00');
      expect(fillPercent(fraction)).toMatch(/^\d+(\.\d{1,2})?%$/);
    }
  });
});

describe('Bar', () => {
  it('is a progressbar whose class comes from its helper', () => {
    const vnode = h(Bar, { fraction: 0.5 });
    expect(vnode.type).toBe(Bar);
    const rendered = Bar({ fraction: 0.5 });
    expect(rendered.type).toBe('div');
    expect(rendered.props.class).toBe(barClass());
    expect(rendered.props.role).toBe('progressbar');
    expect(rendered.props['aria-valuemin']).toBe(0);
    expect(rendered.props['aria-valuemax']).toBe(100);
  });

  it('reports the clamped fraction as an integer valuenow', () => {
    expect(Bar({ fraction: 0.615 }).props['aria-valuenow']).toBe(61);
    expect(Bar({ fraction: 2 }).props['aria-valuenow']).toBe(100);
    expect(Bar({ fraction: -1 }).props['aria-valuenow']).toBe(0);
    expect(Bar({ fraction: Number.NaN }).props['aria-valuenow']).toBe(0);
  });

  it('gives the fill its width from the helper', () => {
    const fill = Bar({ fraction: 0.615 }).props.children;
    expect(fill.type).toBe('div');
    expect(fill.props.class).toBe('kit-bar__fill');
    expect(fill.props.style.width).toBe(fillPercent(0.615));
  });

  it('uses the label as the accessible name and the tone as the modifier', () => {
    const rendered = Bar({ fraction: 0.5, tone: 'xp', label: 'Experience' });
    expect(rendered.props['aria-label']).toBe('Experience');
    expect(rendered.props.class).toBe(barClass({ tone: 'xp' }));
    expect(Bar({ fraction: 0.5 }).props['aria-label']).toBeUndefined();
  });
});
