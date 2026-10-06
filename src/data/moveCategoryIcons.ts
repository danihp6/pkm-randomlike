import type { MoveCategory } from './dex';

/**
 * The three move-category badges the battle move grid draws instead of a word.
 * They are small procedural textures (there is no FRLG category-icon export), so
 * the keys and colours live here and `BootScene` paints them once.
 */
export const MOVE_CATEGORY_ICON_SIZE = 20;

export const MOVE_CATEGORY_ICONS: Readonly<Record<MoveCategory, Readonly<{ key: string; color: number }>>> = {
  Physical: { key: 'battle:category-physical', color: 0xe8552c },
  Special: { key: 'battle:category-special', color: 0x4a80d0 },
  Status: { key: 'battle:category-status', color: 0x8b8f9e },
};

/** The texture key of a move category, or null for an unknown category. */
export function categoryIconKey(category: string): string | null {
  return (MOVE_CATEGORY_ICONS as Readonly<Record<string, { key: string }>>)[category]?.key ?? null;
}
