import { describe, expect, it } from 'vitest';
import * as kit from './index';
import type {
  BarProps,
  BarTone,
  ChipProps,
  KitTone,
  MetaProps,
  PanelProps,
  PrimaryButtonProps,
  RowProps,
  SheetProps,
  TypeBadgeProps,
} from './index';

const CONTRACT = [
  'Bar',
  'Chip',
  'Meta',
  'Panel',
  'PrimaryButton',
  'Row',
  'Sheet',
  'TypeBadge',
  'barClass',
  'chipClass',
  'fillPercent',
  'joinClasses',
  'panelClass',
  'rowClass',
  'typeBadgeClass',
  'typeBadgeTone',
] as const;

describe('the kit barrel', () => {
  it('exports exactly the contract names, no more, no fewer', () => {
    expect(Object.keys(kit).sort()).toEqual([...CONTRACT].sort());
  });

  it('exports only functions at runtime', () => {
    for (const name of CONTRACT) {
      expect(typeof kit[name], name).toBe('function');
    }
  });

  it('accepts the contract prop types', () => {
    const tone: KitTone = 'accent';
    const barTone: BarTone = 'charge';
    const panel: PanelProps = { title: 'Options', aside: '02', children: 'body', class: 'options' };
    const row: RowProps = { children: 'row', selected: true, disabled: false, onPress: () => undefined };
    const chip: ChipProps = { letter: 'M', label: 'Moves', active: true, onPress: () => undefined };
    const bar: BarProps = { fraction: 0.5, tone: barTone, label: 'HP' };
    const sheet: SheetProps = { open: true, title: 'Bag', onClose: () => undefined, children: 'body' };
    const button: PrimaryButtonProps = { children: 'Go', onPress: () => undefined, disabled: false };
    const meta: MetaProps = { children: '9/9', tone: 'warning' };
    const badge: TypeBadgeProps = { type: 'fire', label: 'Fire' };

    expect(kit.Panel(panel).type).toBe('section');
    expect(kit.Row(row).type).toBe('button');
    expect(kit.Chip(chip).type).toBe('button');
    expect(kit.Bar(bar).type).toBe('div');
    expect(kit.Sheet(sheet)?.type).toBe('section');
    expect(kit.PrimaryButton(button).type).toBe('button');
    expect(kit.Meta(meta).type).toBe('span');
    expect(kit.TypeBadge(badge).type).toBe('span');
    expect(tone).toBe('accent');
  });
});
