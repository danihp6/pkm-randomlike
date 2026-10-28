import { describe, expect, it } from 'vitest';
import * as kit from './index';
import type {
  BarProps,
  BarTone,
  ChipProps,
  KitTone,
  MetaProps,
  MoveCategoryIconProps,
  MoveTypeBadgeProps,
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
  'MoveCategoryIcon',
  'MoveTypeBadge',
  'MOVE_ICON_BOX',
  'Panel',
  'PrimaryButton',
  'Row',
  'Sheet',
  'TypeBadge',
  'barClass',
  'chipClass',
  'fillPercent',
  'joinClasses',
  'moveCategorySprite',
  'moveTypeSprite',
  'panelClass',
  'rowClass',
  'spriteBox',
  'typeBadgeClass',
  'typeBadgeTone',
] as const;

describe('the kit barrel', () => {
  it('exports exactly the contract names, no more, no fewer', () => {
    expect(Object.keys(kit).sort()).toEqual([...CONTRACT].sort());
  });

  it('exports the move icons as functions and their box as the board s 24', () => {
    for (const name of CONTRACT) {
      if (name === 'MOVE_ICON_BOX') continue;
      expect(typeof kit[name], name).toBe('function');
    }
    expect(kit.MOVE_ICON_BOX).toBe(24);
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
    const typeIcon: MoveTypeBadgeProps = { type: 'fire' };
    const categoryIcon: MoveCategoryIconProps = { category: 'Physical' };

    expect(kit.Panel(panel).type).toBe('section');
    expect(kit.Row(row).type).toBe('button');
    expect(kit.Chip(chip).type).toBe('button');
    expect(kit.Bar(bar).type).toBe('div');
    expect(kit.Sheet(sheet)?.type).toBe('section');
    expect(kit.PrimaryButton(button).type).toBe('button');
    expect(kit.Meta(meta).type).toBe('span');
    expect(kit.TypeBadge(badge).type).toBe('span');
    expect(kit.MoveTypeBadge(typeIcon).type).toBe('span');
    expect(kit.MoveCategoryIcon(categoryIcon).type).toBe('span');
    expect(tone).toBe('accent');
  });

  it('paints the type badge as the atlas glyph and never as a word', () => {
    const icon = kit.MoveTypeBadge({ type: 'fire' });
    expect(icon.props.class).toBe('kit-move-type');
    expect(icon.props.children).toBeUndefined();
    const word = kit.MoveTypeBadge({ type: 'nonsense' });
    expect(word.props.class).toBe('kit-type');
    expect(word.props.children).toBe('nonsense');
  });
});
