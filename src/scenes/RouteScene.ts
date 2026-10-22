import Phaser from 'phaser';
import { biomeForRoute, getBiome } from '../data/biomes';
import { getMove, getSpecies, normalizeId, TYPE_NAMES, type StatId, type Stats } from '../data/dex';
import { GROUND_ITEM_TEXTURE_KEY } from '../data/groundItemSprite';
import { type HudPanelId } from '../data/hudLayout';
import { FINITE_MAPS, levelCapForMap } from '../data/maps';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { getItem } from '../data/items';
import { tmNumber } from '../data/tms';
import { getMission } from '../data/missions';
import {
  BERRY_TREE_ENEMY_BOOSTS,
  CURSE_ENEMY_BOOST,
  NPC_ROWS,
  TUTOR_MOVES,
  type NpcRow,
} from '../data/npcs';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../data/portraits';
import {
  PLAYER_SPRITE_TEXTURE_KEY,
  PLAYER_SPRITE_WIDTH,
  playerSpriteFrame,
  type PlayerFacing,
} from '../data/playerSprite';
import { pokemonOverworldSheet, type PokemonOverworldSheet } from '../data/pokemonOverworld';
import { playerWalkAnimKey, playerWalkTimeScale } from '../render/playerAnim';
import { followerAnimKey, followerAnims } from '../render/pokemonFollower';
import { ROUTE_LOOT } from '../data/loot';
import {
  ROOM_BATTLEFIELDS,
  type RoomBattlefield,
  type RoomConditionId,
  type RoomConditionKind,
} from '../data/battlefields';
import type { MapPassiveTrigger } from '../data/passives';
import { bossIsDouble, bossPartySize, type BossPartyKind } from '../data/bosses';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import { trainerFacingPose, trainerWalkAnimKey } from '../render/trainerAnim';
import { getTrainerArchetype, TRAINER_ARCHETYPE_IDS } from '../data/trainers';
import { trainerLevel } from '../data/trainerLevels';
import { bandForLevel } from '../data/run';
import { IS_DEVELOP } from '../dev/env';
import { nextDebugPokemonId } from '../dev/ids';
import type {
  DebugPartyEdit,
  DebugPartyMember,
  DebugRouteContext,
  DebugRouteInput,
  DebugTeleportResult,
} from '../dev/debugMenu';
import { restoreFighter, type BoostId, type FighterInput } from '../engine/battle';
import {
  BOSS_MONEY_MULTIPLIER,
  MAX_PARTY_SIZE,
  MAX_MOVES,
  POKEVIAL_MAX_CHARGES,
  addItem,
  addPokemon,
  adoptAtLevel,
  advanceMap,
  advanceRoute,
  bandForMap,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
  editRunPokemon,
  equipHeldItem,
  evolveMember,
  experienceFraction,
  fullHealMember,
  hasLivingParty,
  isItemPicked,
  isTrainerDefeated,
  markBossDefeated,
  markItemPicked,
  nextMemberId,
  pcMemberEditable,
  resolveBattle,
  routeIndexForRoom,
  runBand,
  squadLevel,
  trainerMoney,
  trainerRoster,
  unequipHeldItem,
  updatePokemon,
  useCapture,
  usePokevial,
  xpForLevel,
  type BagCounts,
  type BattleLaunch,
  type BattleReturn,
  type BattleReward,
  type BattleTrigger,
  type RunPokemon,
  type RunState,
} from '../engine/run';
import { equipMove, learnsetPool, unequipMove, type LearnEntry } from '../engine/run/learnset';
import {
  rerollAbility,
  rerollIvs,
  rerollNature,
  sacrifice,
  swapSpecies,
  teachMove,
  type MemberEdit,
  type MemberEditLine,
  type MemberEditRefusal,
} from '../engine/run/memberEdits';
import { useItemOn } from '../engine/run/items';
import { battleHpLoss, missionCompletedBy, missionForMap, recordHpLost } from '../engine/run/missions';
import {
  FORCED_FIELD_FLOORS,
  forcedFieldId,
  withCurse,
  withForcedField,
  withNextWildType,
  withoutCurse,
  withoutNextWildType,
  type RunModifiers,
} from '../engine/run/modifiers';
import { partyHasType } from '../engine/run/party';
import { NICKNAME_MAX_LENGTH, normalizeNickname, renameMember } from '../engine/run/nickname';
import { speciesPool, wildExclusions } from '../engine/run/pool';
import { runPassives, type PassivePickup } from '../engine/run/passives';
import { abilityMoveType } from '../engine/battle/moveType';
import { COMMON_TEXTURE_KEY, TILESETS, type TilesetId, tilesetTextureKey } from '../data/tilesets';
import type { Tile } from '../engine/grid';
import {
  FLOOR,
  TALL_GRASS,
  WALL,
  isWalkable,
  mapPixelSize,
  mapSize,
  resolveMove,
  type TileMap,
} from '../engine/map';
import { hashSeed, randomSeed, Rng } from '../engine/rng';
import { clearRun, storeRun, type Settings } from '../engine/save';
import {
  DEFAULT_SHAPE,
  DEFAULT_TRAINER_SIGHT,
  RouteEncounters,
  bannedSpeciesOf,
  borderEdge,
  chefTrade,
  encounterTableFor,
  exitEdgeAt,
  gateId,
  guaranteedNpc,
  medicHeal,
  npcBerryHarvest,
  npcForcedField,
  npcPrize,
  npcRequirementMet,
  npcSpot,
  npcTrainerId,
  npcTreeWild,
  npcUseId,
  npcWildType,
  rollWildLevel,
  roomNpc,
  secretShopSealId,
  seesPlayer,
  sketchRoute,
  sketchRouteSteps,
  specialTrainerFor,
  staticGateId,
  trainerAt,
  trainerHidden,
  withForcedAbility,
  type ChefTradeRefusal,
  type Facing,
  type RouteItem,
  type RouteMap,
  type RouteRequest,
  type RouteShape,
  type RouteStep,
  type RouteTrainer,
} from '../engine/routes';
import {
  bossOpeningRoll,
  roomBattlefield,
  roomKindOf,
  type BossOpeningRoll,
} from '../engine/routes/battlefield';
import { bossRoomHeal, bossRoomSealed } from '../engine/routes/bossRoom';
import {
  OPPOSITE_EDGE,
  bossTrainerId,
  isFinalMap,
  miniBossTrainerId,
  planMap,
  roomAcross,
  roomView,
  type MapEdge,
  type MapPlan,
  type RoomView,
} from '../engine/maps';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import {
  resolveTileFrame,
  resolveGroundFrame,
  grassRustleFrames,
  grassTipKeys,
  hiddenItemFrame,
  isGrassStepTile,
  treeTipKeys,
  type TileFrame,
} from '../engine/tileFrames';
import { parseFrameMapExport, routeFromFrameMapExport, serializeFrameMap } from '../engine/frameMap';
import { BAG_CATEGORIES, bagCategoryLabel, bagForCategory, type BagCategory } from '../ui/bag';
import { pokemonRewardChoices, rewardChoices, rewardRows, type RewardRow } from '../ui/rewards';
import { buildMapView, type MapRoomMarker, type MapViewRoom } from '../ui/mapView';
import {
  BOX_COLS,
  BOX_PAGE_SIZE,
  BOX_ROWS,
  boxCellIndex,
  boxPageCount,
  boxRows,
  dragTo,
  dropGrabbed,
  grabAt,
  initialPartyUi,
  partyInput,
  ripRows,
  swapAcross,
  type PartyUiState,
  type PaneId,
} from '../ui/partyScreen';
import {
  CLOSED_DETAIL,
  NATURE_DOWN_TINT,
  NATURE_UP_TINT,
  closeDetail,
  dropMove,
  grabMove,
  memberDetail,
  natureEffect,
  openDetail,
  reorderMoves,
  setDetailTab,
  statLabel,
  typeColor,
  type DetailState,
  type DetailTab,
  type MemberDetail,
} from '../ui/partyDetail';
import { type FamilyNode } from '../ui/evolutionGraph';
import {
  FRLG_HPBAR,
  FRLG_HPBAR_KEY,
  FRLG_WINDOW_ALPHA,
  FRLG_WINDOW_PADDING,
  addFrlgWindow,
  badgeInkFor,
} from '../ui/frlg';
import { MoveGrid, padMoveGridCells, type MoveGridCell } from '../ui/moveGrid';
import { AbilityInfoButton, abilityInfoContent, abilityInfoSpot } from '../ui/abilityInfo';
import { InfoPopup } from '../ui/infoPopup';
import {
  areaEntryNotice,
  catchToPcNotice,
  eggHatchNotice,
  itemPickupNotice,
  itemUsedNotice,
  levelUpNotice,
  missionCompleteNotice,
  type Notice,
} from '../ui/notice';
import { hatchEgg } from '../ui/casino';
import { hpColorInt, hpFraction } from '../ui/metrics';
import { STATUS_ICON_TEXTURE_KEY, STATUS_ICON_W, statusIconFrame } from '../data/statusIcons';
import { levelUpBeats, type LevelUpBeat } from '../ui/beats';
import {
  RELEASE_HOLD_MS,
  RELEASE_INPUT_DELAY_MS,
  releaseBeats,
  type ReleaseBeat,
} from '../ui/permadeath';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { addFloatingPanel, type FloatingPanel } from '../ui/floatingPanel';
import { openNpcPanel, NPC_MAX_CHOICES, type NpcPanelView } from '../ui/npcPanel';
import {
  FRLG_ACCENT,
  FRLG_BADGE_INK,
  FRLG_MUTED,
  FRLG_POSITIVE,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SURFACE,
  FRLG_TRACK,
} from '../ui/frlg';
import { clampScrollTop, maxScrollTop, scrollByRows, visibleRange } from '../ui/scroll';
import { createTouchControls, type TouchControls } from '../ui/touchControls';
import { t, type TranslationKey } from '../i18n';
import { moveName, moveShortDescription } from '../i18n/content';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { listenForBack } from '../input/backButton';
import { prefersTouchControls } from '../input/device';
import { playCue, playMusic } from '../audio/audio';
import { loadSettings, saveSettings } from '../settings';
import { browserStorage } from '../storage';
import { GRASS_TEXTURE_KEY, PANEL_ICON_KEYS, PANEL_ICON_SIZE, TRAINER_TEXTURE_KEY } from './BootScene';
import { collectDescriptors, type RoomRegistry } from './rooms/registry';
import { openMart } from './rooms/shop';
import type {
  RoomDescriptor,
  RoomDrop,
  RoomHost,
  RoomPanel,
  RoomRowDrag,
  RoomWildBattle,
} from './rooms/types';

/**
 * Every special room kind's descriptor module (`D47`), discovered from the folder
 * itself: a new room is a new file here and the scene is not edited. The negative
 * pattern keeps the folder's own tests out of the browser bundle.
 */
const ROOM_MODULES = import.meta.glob(['./rooms/*.ts', '!./rooms/*.test.ts'], { eager: true });

/**
 * The world camera's zoom while walking a route: tiles read at 2x on a desktop
 * window. A touch screen has a much narrower viewport, so it pulls back a quarter
 * (`ROUTE_TOUCH_ZOOM_OUT`) to keep the same slice of the route on screen. Only
 * the route uses this camera; the menus and the battle are untouched.
 */
const ROUTE_CAMERA_ZOOM = 2;
const ROUTE_TOUCH_ZOOM_OUT = 0.75;
const routeCameraZoom = (): number =>
  ROUTE_CAMERA_ZOOM * (prefersTouchControls() ? ROUTE_TOUCH_ZOOM_OUT : 1);

/** Item stacks the route HUD's bag window shows before it drops the rest. */
const HUD_BAG_ROWS = 6;

/**
 * The route HUD is one FRLG window per concern, stacked down the right edge: a
 * slim route header, then the party (portrait, name, level and HP bar) and the
 * bag (pocket tabs over the active pocket's icon, name and count). The widths
 * are shared so the three stack flush.
 */
const HUD_PANEL_W = 344;
const HUD_TOP = 8;
const HUD_GAP = 8;
/** Content stays inside the FRLG window's baked border (`FRLG_WINDOW_PADDING`). */
const HUD_PAD_X = FRLG_WINDOW_PADDING.x;
const HUD_PAD_TOP = FRLG_WINDOW_PADDING.top;
const HUD_PAD_BOTTOM = FRLG_WINDOW_PADDING.bottom + 4;
/**
 * The route header **is** the floor minimap now (`docs/maps-spec.md` §8): the map
 * name over the discovered-rooms grid, one panel in the free top-left corner. Its
 * title band leaves room for a wrapped name.
 */
const HUD_MAP_X = 8;
const HUD_MAP_Y = HUD_TOP;
const HUD_MAP_W = 216;
const HUD_MAP_H = 250;
const HUD_MAP_TITLE_H = HUD_PAD_TOP + 34;
/** The Pokevial bar centred under the party header's level/XP line: its size in px. */
const HUD_VIAL_W = 100;
const HUD_VIAL_H = 20;
/**
 * The Pokevial fill colour at 1, 2 and 3 charges. A single bar that grows and
 * changes shade as it fills, so the three steps read as one meter topping up.
 */
const HUD_VIAL_FILL_COLORS = [0xfde68a, 0xfbbf24, 0xf97316];
/**
 * The party window is narrower than the bag/box now that its rows drop the HP
 * and level text: portrait, name and the HP bar only. The header stacks the
 * squad's shared level line, the XP bar and the centred Pokevial.
 */
const HUD_PARTY_W = 250;
const HUD_PARTY_ROW = 52;
const HUD_PARTY_COLUMN = 56;
const HUD_XP_BAR_INSET = 12;
const HUD_XP_BAR_H = 8;
const HUD_XP_BAR_Y = HUD_PAD_TOP + 16 + 6;
const HUD_VIAL_Y = HUD_XP_BAR_Y + HUD_XP_BAR_H + 8;
const HUD_PARTY_HEADER = HUD_VIAL_Y + HUD_VIAL_H + 8;
/** The party avatar, enlarged to the row height so the held-item badge reads. */
const HUD_PARTY_PORTRAIT_SCALE = 0.7;
/** The status badge at the right of a party row's name line. */
const HUD_PARTY_STATUS_SCALE = 1.5;
/** Gap (px) kept between the row name and its status badge. */
const HUD_PARTY_STATUS_GAP = 4;
/** The held-item icon on an avatar's lower-right corner. */
const HUD_HELD_ICON_SCALE = 0.85;
const HUD_BOX_HELD_ICON_SCALE = 1;
/** Pointer travel (px) that turns a click into a drag while grabbing a member. */
const HUD_DRAG_SLOP = 4;
/** The bag pocket tabs: five across the window's padded inner width. */
const HUD_TAB_W = 55;
const HUD_TAB_H = 26;
const HUD_TAB_GAP = 4;
const HUD_BAG_HEADER = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BAG_ROW = 40;
/** The bag panel's footer band: the Poké Dollar readout under the item rows. */
const HUD_BAG_FOOTER = 26;
/** The PC BOX window: a page tab strip over a grid of avatar cells. */
const HUD_BOX_PAD = 12;
const HUD_BOX_TAB_W = 32;
const HUD_BOX_TAB_GAP = 4;
const HUD_BOX_TABS_H = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BOX_CELL = 76;
const HUD_BOX_CELL_GAP = 4;
const HUD_BOX_GRID_H = BOX_ROWS * HUD_BOX_CELL + (BOX_ROWS - 1) * HUD_BOX_CELL_GAP;
const HUD_BOX_H = HUD_BOX_TABS_H + HUD_BOX_GRID_H + HUD_BOX_PAD;
const HUD_BOX_MAX_PAGES = 7;
const HUD_BOX_RIP_TAB_W = 32;
/** The cap the RIP tab carries: the abbreviation reads the same in both locales. */
const HUD_BOX_RIP_LABEL = 'RIP';
/** The minimap's current-room gold: a content marker, not a chrome tone. */
const HUD_MAP_CURRENT_FILL = 0xf6d98a;
const HUD_MAP_CURRENT_STROKE = 0x9a7a1f;

/** The veil a locked box cell wears, shared by the cell and the RIP tab. */
const HUD_BOX_LOCK_FILL = FRLG_SURFACE;
const HUD_BOX_LOCK_ALPHA = 0.55;

/** The frame band (px) of a HUD panel that grabs it instead of its content. */
const HUD_PANEL_BORDER = 12;
/** How far (px) past a panel's frame the grab band reaches, to cover the seam. */
const HUD_PANEL_GRAB_PAD = 4;
/** Gap (px) a moved panel keeps from the screen edge. */
const HUD_PANEL_MARGIN = 8;
/** The collapse-icon button at a panel's top-left, flush with the corner. */
const HUD_ICON = PANEL_ICON_SIZE;
const HUD_ICON_INSET = 0;
/** Alpha of a panel's window background when the Transparent HUD option is on. */
const HUD_BG_TRANSPARENT_ALPHA = 0;
/**
 * With the window hidden, each panel keeps a drawn outline so its edge still
 * reads, and its text turns to the card's ink to stay legible over the map
 * behind it. The outline is the muted tone (`scripts/ui/build-chrome.mjs`), so
 * the Transparent HUD still matches the card it stands in for.
 */
const HUD_BG_BORDER = FRLG_MUTED;
const HUD_BG_BORDER_WIDTH = 3;
const HUD_BG_BORDER_RADIUS = 12;
const HUD_BG_BORDER_ALPHA = 0.9;
const HUD_BG_TEXT = FRLG_INK;
/** Height of the key-hint band the button adds under the icon on a keyboard. */
const HUD_KEY_H = 16;
/** The key letter's text size, so it sits centred in that band. */
const HUD_KEY_TEXT = 16;
/** Where a panel's header/content starts, leaving room for the icon button. */
const HUD_CONTENT_LEFT = HUD_ICON_INSET + HUD_ICON + 6;

/**
 * The quick key that opens each panel (`P` party, `I` bag, `M` map, `O` PC box).
 * The member detail popup has none, so its button stays a plain icon square.
 */
const PANEL_KEY_ACTIONS: Readonly<Partial<Record<HudPanelId, KeybindAction>>> = {
  header: 'map',
  party: 'party',
  bag: 'bag',
  box: 'box',
};

/** The pause menu (ESC / left-edge swipe): a centred window with two rows. */
const PAUSE_MENU_W = 360;
const PAUSE_MENU_ROW_H = 56;
const PAUSE_MENU_ITEMS = ['settings', 'reset'] as const;
const PAUSE_MENU_LABELS: Readonly<Record<(typeof PAUSE_MENU_ITEMS)[number], TranslationKey>> = {
  settings: 'pause.settings',
  reset: 'pause.reset',
};

/**
 * The member detail panel: a click on a party or PC-box member opens it to the
 * left of the box. A header (name, level, types) sits over two tabs — STATS and
 * MOVES — and the MOVES grid can be dragged to reorder the member's moves.
 */
const HUD_DETAIL_TAB_H = 26;
const HUD_DETAIL_TABS_TOP = 72;
const HUD_DETAIL_CONTENT_TOP = HUD_DETAIL_TABS_TOP + HUD_DETAIL_TAB_H + 10;
/**
 * The STATS tab's nickname field: an editable box in the header's name row, the
 * same look and height as the MOVES tab's search field. It stops short of the
 * right-aligned level column, so the two share the row without touching.
 */
const HUD_NICKNAME_FIELD_H = 22;
const HUD_NICKNAME_FIELD_TOP = HUD_PAD_TOP - 1;
const HUD_NICKNAME_LEVEL_W = 72;
const HUD_NICKNAME_MIN_W = 48;
const HUD_DETAIL_STAT_ROW = 26;
const HUD_DETAIL_STAT_COLS = 2;
const HUD_DETAIL_STAT_ROWS = 3;
const HUD_DETAIL_INFO_ROW = 22;
const HUD_DETAIL_INFO_ROWS = 2;
/**
 * The detail window is wider and shorter than the party/box windows so six
 * stats read in two columns of three (no HP bar) and the shared move grid's
 * cells stay wide enough for the full move names.
 */
const HUD_DETAIL_W = 460;
/**
 * The MOVES tab stacks three bands: the 2x2 slotted moves grid, a search field
 * and the learnset pool (the moves already learned plus the bag TMs). The panel
 * is tall enough for all three with the pool showing two rows at a time.
 */
const HUD_DETAIL_MOVE_GRID_H = 188;
const HUD_DETAIL_SEARCH_H = 24;
const HUD_DETAIL_LEARN_GAP = 8;
/** The learnset pool's window: two columns of two rows, scrolled one row at a time. */
const HUD_DETAIL_LEARN_COLS = 2;
const HUD_DETAIL_LEARN_ROWS = 2;
const HUD_DETAIL_MOVES_H = 560;
const HUD_DETAIL_H = Math.max(
  HUD_DETAIL_CONTENT_TOP +
    HUD_DETAIL_STAT_ROWS * HUD_DETAIL_STAT_ROW +
    8 +
    HUD_DETAIL_INFO_ROWS * HUD_DETAIL_INFO_ROW +
    HUD_PAD_BOTTOM,
  HUD_DETAIL_MOVES_H,
);
/**
 * The STATS tab: the six stats in two columns of three. HP leads the first
 * column; its bar is gone, so the row prints the current / max HP.
 */
const HUD_DETAIL_STATS: readonly (readonly StatId[])[] = [
  ['hp', 'atk', 'def'],
  ['spa', 'spd', 'spe'],
];
const HUD_DETAIL_TYPE_W = 74;
/**
 * The STATS tab's evolution band: a title over the family **graph** — one row
 * per species, indented by stage, joined by elbow edges with each branch's level
 * on the right. Nine rows cover the widest family (Eevee's eight plus itself);
 * a ready branch is green and clickable, the current species gold.
 */
const HUD_DETAIL_EVO_TITLE_TOP = 250;
const HUD_DETAIL_EVO_TOP = HUD_DETAIL_EVO_TITLE_TOP + 22;
const HUD_DETAIL_EVO_MAX = 9;
const HUD_DETAIL_EVO_ROW_H = 28;
const HUD_DETAIL_EVO_INDENT = 34;
const HUD_DETAIL_EVO_PORTRAIT_SCALE = 0.4;
const HUD_DETAIL_EVO_LINE = FRLG_MUTED;
const HUD_DETAIL_EVO_READY = FRLG_POSITIVE;
const HUD_DETAIL_EVO_CURRENT = FRLG_ACCENT;

/**
 * The HUD's panel widths for the current window: the fixed design sizes, clamped
 * so no panel grows past the screen (a phone shows them nearly full-width, and the
 * panels overlap since they no longer fit side by side). Everything derived from a
 * width — the HP bar scale, the XP bar and the detail panel's lateral padding —
 * is computed here too, so one place decides the layout.
 */
type HudMetrics = Readonly<{
  panelW: number;
  partyW: number;
  detailW: number;
  mapW: number;
  partyHpBarScale: number;
  xpBarW: number;
  detailPadX: number;
}>;

function hudMetrics(width: number): HudMetrics {
  const max = Math.max(160, width - HUD_PANEL_MARGIN * 2);
  const partyW = Math.min(HUD_PARTY_W, max);
  const detailW = Math.min(HUD_DETAIL_W, max);
  return {
    panelW: Math.min(HUD_PANEL_W, max),
    partyW,
    detailW,
    mapW: Math.min(HUD_MAP_W, max),
    partyHpBarScale: (partyW - HUD_PAD_X * 2 - HUD_PARTY_COLUMN) / FRLG_HPBAR.width,
    xpBarW: partyW - HUD_PAD_X * 2 - HUD_XP_BAR_INSET * 2,
    // A clamped detail panel has little room, so it drops its lateral padding.
    detailPadX: detailW < HUD_DETAIL_W ? 12 : HUD_PAD_X,
  };
}

/**
 * The transient notice strip (`src/ui/notice.ts`): a slim FRLG textbox pinned at
 * the top of the screen, narrowed when the viewport cannot hold its full width.
 */
const NOTICE_W = 720;
const NOTICE_H = 44;
const NOTICE_TOP = 24;

/** The floor's mission line (`docs/routes-spec.md` §6): one slim card under the notice strip. */
const MISSION_W = 360;
const MISSION_H = 32;
const MISSION_TOP = NOTICE_TOP + NOTICE_H + 8;

/**
 * The area-entry panel (`docs/routes-spec.md` §6, `src/ui/notice.ts`): the boxed
 * banner that greets the player on entering a room. It is the same `'window'`
 * card as the strip and the mission line, told apart by being boxed, taller,
 * lower and fringed in the accent — the one card whose 1px ring is the accent
 * instead of the muted hairline (`FRLG_ACCENT`'s "never a border of its own" is
 * the rule; this card is its frozen exception).
 */
const AREA_PANEL_W = 360;
const AREA_PANEL_H = 64;
const AREA_PANEL_TOP = MISSION_TOP + MISSION_H + 8;
/** Above the HUD's cards, below the mission line (439) and the notice strip (440). */
const AREA_PANEL_DEPTH = 438;

/** The mini-boss reward choice (Phase 9): one window of item and Pokémon rows. */
const REWARD_W = 560;
const REWARD_H = 660;
const REWARD_ROW_H = 84;
/** How many items a beaten mini-boss offers (`docs/maps-spec.md` §7). */
const MINI_BOSS_REWARD_CHOICES = 3;
/** How many unidentified Pokémon the same window offers. */
const MINI_BOSS_REWARD_POKEMON_CHOICES = 3;

/** The drag ghost a room row draws: above every panel, below nothing. */
const ROW_DRAG_DEPTH = 640;

/**
 * Render depth of a wall cell's walkable tip: above the actors so the character
 * passes **behind** the crown, below the grass overlay and the HUD.
 */
const TREE_TIP_DEPTH = 20;

/**
 * Render depth of a room's condition filter: over the tiles, the actors and the tree
 * tips, under the dev hover marker (30) and the HUD (150).
 */
const BATTLEFIELD_DEPTH = 25;

/**
 * Ground actors (the player and the trainers) sort by their foot position, so a
 * lower tile draws in front: a player standing north of a trainer passes behind
 * it. The whole band stays between the ground items (`5`) and the tree tips
 * (`20`), so layering above the map is untouched.
 */
const ACTOR_DEPTH = 8;
const ACTOR_DEPTH_STEP = 0.0001;

/** The render depth of a ground actor standing with its feet at `footY`. */
function actorDepth(footY: number): number {
  return ACTOR_DEPTH + footY * ACTOR_DEPTH_STEP;
}

/** The four directions, in the order the update loop tests them. */
type MoveKey = 'up' | 'down' | 'left' | 'right';

/** Which of the detail panel's two move grids a hit or the floating popup belongs to. */
type DetailInfoGrid = 'moves' | 'learn';
/** The ⓘ the panel's info state names: the grid and the cell index in that grid's window. */
type DetailInfoTarget = { grid: DetailInfoGrid; index: number };
/** The cell under the pointer plus whether the point sits on its ⓘ button. */
type DetailInfoHit = DetailInfoTarget & { onInfo: boolean };

/** How long one tile takes to cross on foot, and with the run key held. */
const WALK_STEP_MS = 200;
const RUN_STEP_MS = 110;

/** One frame of the player's own tall-grass rustle, in ms. */
const GRASS_STEP_MS = 70;
/** Over the actor band (`ACTOR_DEPTH` + foot-y step, 491-497), under `TREE_TIP_DEPTH`. */
const GRASS_STEP_DEPTH = 10;

/** Hold the reset key this long to start a fresh run: a filling ring + a fade. */
const RESET_HOLD_MS = 1600;
const RESET_RADIUS = 22;
const RESET_FADE_IN_MS = 260;

/** How long a "spinning" trainer holds a facing before it turns to the next. */
const TRAINER_TURN_MS = 1400;
/** How long one chase step takes while a trainer walks toward the player. */
const TRAINER_CHASE_STEP_MS = 170;

const MOVE_STEP: Readonly<Record<MoveKey, Tile>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The cardinal a tile step moves toward, for a trainer's walk pose. */
function stepFacing(from: Tile, to: Tile): Facing {
  if (to.x > from.x) return 'E';
  if (to.x < from.x) return 'W';
  if (to.y < from.y) return 'N';
  return 'S';
}

/** A trainer drawn on the route, with its atlas key when it has a decomp sprite. */
type TrainerSpriteEntry = {
  trainer: RouteTrainer;
  sprite: Phaser.GameObjects.Sprite;
  spriteKey: string | null;
};

/** The room's special NPC (`docs/maps-spec.md` §7): the row it rolled and its tile. */
type RoomNpc = Readonly<{ row: NpcRow; tile: Tile }>;

/** What one battle launch adds beyond the trigger: the guardian's boosts and its no-flee rule. */
type BattleExtras = Readonly<{
  noFlee?: boolean;
  enemyBoosts?: Partial<Record<BoostId, number>>;
}>;

/**
 * One draggable HUD panel. Its window chrome and content live in `body` and its
 * collapse button in `icon`; both are children of `container`. `x`/`y`/`w`/`h`
 * are the expanded layout rect and `dx`/`dy` the drag displacement; `expanded` is
 * false when the panel is collapsed to its icon. The current on-screen rect is
 * the layout rect (or the icon's) shifted by the offset, which is what the drag
 * and the hit tests read. Panels overlap freely and the one in hand rides on top.
 */
type HudPanel = {
  id: HudPanelId;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Container;
  /** The quick-key action that opens this panel, or null for the detail popup. */
  key: KeybindAction | null;
  /** The key letter under the icon (null on a touch screen or without a key). */
  keyLabel: Phaser.GameObjects.BitmapText | null;
  /** The button's size: a square, or a rectangle when it shows the key letter. */
  iconW: number;
  iconH: number;
  /** The window chrome, faded when the Transparent HUD option is on. */
  window: Phaser.GameObjects.NineSlice;
  /** The outline drawn in its place while the window is hidden. */
  border: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  expanded: boolean;
};

/** The base inputs of the route on screen, before the debug reroll nonce. */
type RouteParams = Readonly<{
  seed: string;
  routeIndex: number;
  shape: RouteShape;
  width: number;
  height: number;
  grassPatches: number;
  ledges: number;
  /** The plan-driven room (normal play); absent for the dev generator/import tools. */
  room?: RoomView;
}>;

/** How `transitionTo` places the player after the rebuild. */
type TransitionOptions = Readonly<{ keepPosition?: boolean }>;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** "serious" -> "Serious", for the nature line. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/** The line an NPC card prints when a member edit refuses, by reason. */
const NPC_REFUSALS: Readonly<Record<MemberEditRefusal, TranslationKey>> = {
  'no-member': 'npc.refused.noMember',
  'no-slots': 'npc.refused.noSlots',
  'no-bag': 'npc.refused.noBag',
  'no-species': 'npc.refused.noSpecies',
  'no-ability': 'npc.refused.noAbility',
  'not-a-tutor-move': 'npc.refused.notTutorMove',
};

/** The line the chef's card prints when its trade refuses, by reason. */
const CHEF_REFUSALS: Readonly<Record<ChefTradeRefusal, TranslationKey>> = {
  'no-member': 'npc.refused.noMember',
  'already-held': 'npc.chef.alreadyHeld',
  'no-berries': 'npc.chef.noBerries',
};

/** True when a point falls inside a rect, for the detail panel's hit tests. */
function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
  );
}

/** True when `tile` is inside the playable map (the border included). */
function inBounds(map: TileMap, tile: Tile): boolean {
  return tile.y >= 0 && tile.y < map.length && tile.x >= 0 && tile.x < map[0].length;
}

// Until the starter pick lands, the scene seeds a run with a fixed demo starter
// and bag and walks its routes off one dev seed.
const DEV_SEED = 'dev-seed';

const DEMO_STARTER: FighterInput = {
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['ember', 'scratch', 'growl'],
};
const DEMO_RESERVE: FighterInput = {
  id: 'reserve',
  speciesId: 'squirtle',
  level: 4,
  moves: ['watergun', 'tackle', 'tailwhip'],
};

const DEMO_BAG: readonly BagCounts[] = [];

/** One dev wild roll: what the room's live stream handed out on a step. */
export type DebugWildRoll = Readonly<{ speciesId: string; level: number; shiny: boolean }>;

export class RouteScene extends Phaser.Scene {
  private route!: RouteMap;
  private map!: TileMap;
  /** `map` for movement: a tree's walkable tip is passable even though it draws as wall. */
  private moveMap!: TileMap;
  /** The tiles `drawTiles` renders: the live map, or a dev generator step. */
  private renderTiles!: TileMap;
  /** Tree tips a grass patch shares: grass drawn under the crown, encounter on step. */
  private grassTipKeys: Set<string> = new Set();
  /** Dev only: the build-phase snapshots of the route on screen. */
  private generatorSteps: readonly RouteStep[] = [];
  private generatorStepIndex: number | null = null;
  private encounters!: RouteEncounters;
  private tilesetId: TilesetId = 'forest';
  private player: Tile = { x: 1, y: 1 };
  private playerSprite!: Phaser.GameObjects.Sprite;
  private tileSprites: Phaser.GameObjects.Image[][][] = [];
  /** Tall-grass overlays and any future entities, so a rebuild can clear them. */
  private entitySprites: Phaser.GameObjects.GameObject[] = [];
  /** The one sprite the player's own grass rustle draws; hidden when out of grass. */
  private grassStep: Phaser.GameObjects.Sprite | null = null;
  /** The ground items on screen, so a pickup can hide one and a rebuild clear all. */
  private itemSprites: { item: RouteItem; sprite: Phaser.GameObjects.Image }[] = [];
  /** The trainers on screen, so a win can hide one and a rebuild clear all. */
  private trainerSprites: TrainerSpriteEntry[] = [];
  /** Which facing a spinning trainer is showing, so a turn only redraws on change. */
  private trainerSpinIndex = new Map<string, number>();
  /** The facing each trainer is currently using, so a spinner's cone turns too. */
  private trainerFacing = new Map<string, Facing>();
  /** The trainer walking toward a player it spotted, until the battle opens. */
  private chase: {
    entry: TrainerSpriteEntry;
    position: Tile;
  } | null = null;
  /** The inputs behind the route on screen; the debug reroll rebuilds from it. */
  private routeParams!: RouteParams;
  private run!: RunState;
  /** The floor plan and the room it is playing, for map navigation and the portal. */
  private plan: MapPlan | null = null;
  private room: RoomView | null = null;
  /** The condition the room on screen rolled, or null when it rolled none. */
  private battlefield: RoomBattlefield | null = null;
  /** The boss room's opening (arena and the boss lead's stages), or null outside it. */
  private bossOpening: BossOpeningRoll | null = null;
  /** The room's condition filter (one tinted rectangle over the room), or null. */
  private battlefieldOverlay: Phaser.GameObjects.Rectangle | null = null;
  private settings!: Settings;
  /** The saved reduce-flashing preference, re-read with the settings (D45). */
  private reducedFlash = false;
  /** Dev only: walk through solid tiles so a route can be inspected quickly. */
  private passThrough = false;
  /** Dev only: color the cell under the mouse and show its tile coordinates. */
  private hoverInspect = false;
  /** Dev only: while true the tall grass rolls no wild encounter. */
  private ignoreEncounters = false;
  /** Dev only: while true no line of sight opens a trainer battle. */
  private ignoreTrainers = false;
  private hoverCell: Tile | null = null;
  private hoverMarker: Phaser.GameObjects.Rectangle | null = null;
  private hoverLabel: Phaser.GameObjects.BitmapText | null = null;
  private gameOver = false;
  private battleCounter = 0;
  /** Dev only: unique ids for Pokémon dropped in from the debug menu. */
  private debugMonCounter = 0;
  private pendingBattle: BattleLaunch | null = null;
  /** The movement keys behind the current bindings (arrows plus WASD), watched every frame. */
  private moveKeys!: Record<MoveKey, Phaser.Input.Keyboard.Key[]>;
  /** The run key; held while walking, it speeds the step and the walk cycle. */
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  /** Hold-to-reset: the key, the progress toward restarting and the overlay. */
  private resetKey: Phaser.Input.Keyboard.Key | null = null;
  /** The on-screen pad + A / B, on a touch screen only. */
  private touch: TouchControls | null = null;
  /** Detaches the phone's Back-gesture listener (the pause-menu opener). */
  private detachBack: (() => void) | null = null;
  /** The pause menu (ESC, or a left-edge swipe on mobile): Settings and Reset. */
  private pauseMenu!: Phaser.GameObjects.Container;
  private pauseMenuOpen = false;
  private pauseMenuIndex = 0;
  /** Reset is two-press: the first arms it, the second starts the new run. */
  private pauseMenuArmed = false;
  private pauseMenuRows: {
    highlight: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private resetHold = 0;
  private resetScrim!: Phaser.GameObjects.Rectangle;
  private resetRing!: Phaser.GameObjects.Graphics;
  /** The direction the player faces, for the idle frame and the walk cycle. */
  private facing: PlayerFacing = 'down';
  /** The last cardinal the player faced, so the interact key can look ahead. */
  private facingDir: MoveKey = 'down';
  /** The in-flight step, while the sprite slides from one tile to the next. */
  private walkTween: Phaser.Tweens.Tween | null = null;
  /** The party's lead Pokémon, drawn trailing the player; null when it has no art. */
  private followerSprite: Phaser.GameObjects.Sprite | null = null;
  /** The pair the follower draws from, so a step plays the right facing's strip. */
  private followerSheet: PokemonOverworldSheet | null = null;
  /** The lead species the follower is resolved for, so a lead change loads once. */
  private followerSpecies: string | null = null;
  /** The follower's own in-flight step, which trails the player's by one tile. */
  private followerTween: Phaser.Tweens.Tween | null = null;
  private hudRoot!: Phaser.GameObjects.Container;
  /** The draggable panels of the HUD, in draw order. */
  private hudPanels: HudPanel[] = [];
  /** The panel widths for this window, clamped to the screen (see `hudMetrics`). */
  private hud!: HudMetrics;
  /** Each panel text's own tint, so Transparent HUD can turn it white and back. */
  private hudTextTints = new Map<Phaser.GameObjects.BitmapText, number>();
  /** The panel being dragged (pointer start + its offset at grab time), or null. */
  private hudPanelDrag: {
    id: HudPanelId;
    pointerStart: { x: number; y: number };
    offsetStart: { x: number; y: number };
  } | null = null;
  /**
   * A press on a collapse icon waiting to become a click (toggle) or a drag
   * (once the pointer passes the slop), or null.
   */
  private hudIconPress: { id: HudPanelId; originX: number; originY: number } | null = null;
  /** Whether the detail panel has been placed once (it is not re-docked after). */
  private hudDetailPlaced = false;
  private hudTitle!: Phaser.GameObjects.BitmapText;
  /** The floor minimap panel: its graphics and the "no map" label. */
  private hudMapGraphics!: Phaser.GameObjects.Graphics;
  private hudMapEmpty!: Phaser.GameObjects.BitmapText;
  /** The pinned HUD camera; a rebuild must teach it to ignore the new sprites. */
  private hudCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private hudBagRows: {
    icon: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.BitmapText;
    count: Phaser.GameObjects.BitmapText;
  }[] = [];
  /** The bag pocket tabs (FRLG strip) and which pocket is showing. */
  private hudBagTabs: {
    category: BagCategory;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudBagCategory: BagCategory = 'equipment';
  private hudBagEmpty!: Phaser.GameObjects.BitmapText;
  /** The bag window's Poké Dollar readout, right-aligned in its footer band. */
  private hudMoneyText!: Phaser.GameObjects.BitmapText;
  /** The HUD's party/box grab (the shared reducer's cursor), and whether it moved. */
  private hudUi: PartyUiState = initialPartyUi();
  private hudGrabMoved = false;
  /** The equipment stack in hand while a bag item is dragged; null otherwise. */
  private hudDragItem: string | null = null;
  /** The member a badge grab came from, so a stray drop puts the item back. */
  private hudDragItemFrom: string | null = null;
  /** The HUD's left edge, and the PARTY, bag and PC BOX windows' geometry. */
  private hudX = 0;
  private hudPartyY = 0;
  private hudPartyH = 0;
  private hudBagY = 0;
  private hudBagH = 0;
  private hudBoxX = 0;
  private hudBoxY = 0;
  private hudBoxH = 0;
  /** The box's current page, its page tabs and its avatar cells. */
  private hudBoxPage = 0;
  private hudBoxTabs: {
    page: number;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudBoxRip!: {
    veil: Phaser.GameObjects.Rectangle;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  };
  private hudBoxCells: {
    highlight: Phaser.GameObjects.Rectangle;
    bg: Phaser.GameObjects.Rectangle;
    portrait: Phaser.GameObjects.Image;
    held: Phaser.GameObjects.Image;
    status: Phaser.GameObjects.Image;
    /** A dim veil over a box member that is **locked** (the PC cannot be edited). */
    lock: Phaser.GameObjects.Rectangle;
  }[] = [];
  /** The avatar held "in hand" while a party/box member is being dragged. */
  private hudDragGhost!: Phaser.GameObjects.Image;
  private hudRows: {
    highlight: Phaser.GameObjects.Rectangle;
    portrait: Phaser.GameObjects.Image;
    held: Phaser.GameObjects.Image;
    status: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.BitmapText;
    bar: Phaser.GameObjects.Image;
    fill: Phaser.GameObjects.Rectangle;
  }[] = [];
  /** The Pokevial bar in the party header: its track, its charged fill and the label inside. */
  private hudVialFill!: Phaser.GameObjects.Rectangle;
  private hudVialLabel!: Phaser.GameObjects.BitmapText;
  /** The squad's shared level and XP bar in the party header. */
  private hudLevelText!: Phaser.GameObjects.BitmapText;
  private hudXpFill!: Phaser.GameObjects.Rectangle;
  private hudXpText!: Phaser.GameObjects.BitmapText;
  /** The member detail panel (STATS / MOVES) and the state behind it. */
  private hudDetail!: Phaser.GameObjects.Container;
  /** The detail window's chrome, faded when its transparency toggle is on. */
  private hudDetailWindow!: Phaser.GameObjects.NineSlice;
  private hudDetailState: DetailState = CLOSED_DETAIL;
  private hudDetailX = 0;
  private hudDetailY = 0;
  private hudDetailName!: Phaser.GameObjects.BitmapText;
  /** The nickname field's box, drawn under the name text on the STATS tab. */
  private hudNicknameBg!: Phaser.GameObjects.Rectangle;
  /** The nickname field's hit rectangle, in the panel's layout coordinates. */
  private hudNicknameRect = { x: 0, y: 0, w: 0, h: 0 };
  /** True while the nickname field owns the keyboard. */
  private hudNicknameFocus = false;
  /** The in-progress text; null while the field is not being edited. */
  private hudNicknameEdit: string | null = null;
  /** "click to name" inside the field's rectangle while the STATS tab is up. */
  private hudDetailNameHint!: Phaser.GameObjects.BitmapText;
  private hudDetailLevel!: Phaser.GameObjects.BitmapText;
  private hudDetailStatus!: Phaser.GameObjects.Image;
  private hudDetailTypes: {
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudDetailTabs: {
    tab: DetailTab;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudDetailStats!: {
    rows: { stat: StatId; label: Phaser.GameObjects.BitmapText; value: Phaser.GameObjects.BitmapText }[];
    nature: Phaser.GameObjects.BitmapText;
    ability: Phaser.GameObjects.BitmapText;
    held: Phaser.GameObjects.BitmapText;
    caught: Phaser.GameObjects.BitmapText;
  };
  /**
   * The STATS tab's evolution band: an "EVOLUTIONS" title, an empty hint and a
   * fixed grid of branch cells repainted by `refreshDetail` from
   * `MemberDetail.evolutions`. The ready cells are green and clickable.
   */
  private hudDetailEvoTitle!: Phaser.GameObjects.BitmapText;
  private hudDetailEvoHint!: Phaser.GameObjects.BitmapText;
  private hudDetailEvoEmpty!: Phaser.GameObjects.BitmapText;
  private hudDetailEvoGraphics!: Phaser.GameObjects.Graphics;
  private hudDetailEvoCells: {
    node: FamilyNode | null;
    rect: { x: number; y: number; w: number; h: number };
    bg: Phaser.GameObjects.Rectangle;
    portrait: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.BitmapText;
    level: Phaser.GameObjects.BitmapText;
  }[] = [];
  private hudDetailEmpty!: Phaser.GameObjects.BitmapText;
  /** The shared moves grid drawn in the MOVES tab, with its floating info popup. */
  private hudMoveGrid!: MoveGrid;
  /** The move whose ⓘ floats its info popup, or null; `pinned` keeps it up. */
  private hudDetailInfo: DetailInfoTarget | null = null;
  private hudDetailInfoPinned = false;
  /** The ⓘ beside the STATS tab's ability row, and the window it floats. */
  private hudAbilityPopup!: InfoPopup;
  private hudAbilityInfoButton!: AbilityInfoButton;
  private hudAbilityInfo = false;
  private hudAbilityInfoPinned = false;
  /** The learnset pool: its grid, scroll window, search field, focus and the move in hand. */
  private hudLearnGrid!: MoveGrid;
  /** The first visible row of the pool window. */
  private hudLearnScrollTop = 0;
  /** The entries the window shows at `hudLearnScrollTop`, for hit-testing the drag. */
  private hudLearnWindow: readonly LearnEntry[] = [];
  /** The band's own rect as laid out, for the wheel and the background drag. */
  private hudLearnRect = { x: 0, y: 0, w: 0, h: 0 };
  /** The band's background drag in progress, or null. */
  private hudLearnScrollDrag: { startY: number; startTop: number; rowPitch: number } | null = null;
  private hudLearnQuery = '';
  private hudSearchFocus = false;
  private hudSearchBg!: Phaser.GameObjects.Rectangle;
  private hudSearchText!: Phaser.GameObjects.BitmapText;
  /** The search field and pool grid rects, laid out by `refreshDetail`. */
  private hudSearchRect = { x: 0, y: 0, w: 0, h: 0 };
  private hudLearnPrev!: Phaser.GameObjects.BitmapText;
  private hudLearnNext!: Phaser.GameObjects.BitmapText;
  /** "no moves to learn" when the pool offers nothing to equip. */
  private hudLearnEmpty!: Phaser.GameObjects.BitmapText;
  /** The pool move held while dragging it onto a slot, and its ghost chip. */
  private hudLearnDrag: string | null = null;
  private hudLearnGhost!: Phaser.GameObjects.BitmapText;
  /** The level-up / evolution popup and whether it is up. */
  private learnPopup!: Phaser.GameObjects.Container;
  private learnPopupTitle!: Phaser.GameObjects.BitmapText;
  private learnPopupBody!: Phaser.GameObjects.BitmapText;
  private learnPopupOpen = false;
  /** Scene time the popup opened, so the click that opened it cannot dismiss it. */
  private learnPopupAt = 0;
  /** Timestamps already handled, so a replayed keydown never types twice. */
  private searchKeyStamps = new Set<number>();
  /**
   * A member press waiting to become a click or a drag: a release without
   * movement opens the detail panel, a move past the slop grabs and reorders.
   */
  private hudPress: {
    pane: PaneId;
    index: number;
    memberId: string;
    originX: number;
    originY: number;
  } | null = null;
  /** The "was released" overlay while a beat sequence is playing. */
  private releaseRoot: Phaser.GameObjects.Container | null = null;
  private releaseQueue: ReleaseBeat[] = [];
  private releaseOnDone: (() => void) | null = null;
  private releaseWait: Phaser.Time.TimerEvent | null = null;
  private releaseArmed = false;
  private releasePortrait!: Phaser.GameObjects.Image;
  private releaseText!: Phaser.GameObjects.BitmapText;
  /**
   * The transient notice strip at the top of the screen (`src/ui/notice.ts`): one
   * at a time, dismissed by its own timer, never blocking input.
   */
  private noticeRoot: Phaser.GameObjects.Container | null = null;
  private noticeText: Phaser.GameObjects.BitmapText | null = null;
  private noticeTimer: Phaser.Time.TimerEvent | null = null;
  /**
   * The area-entry panel: a boxed banner under the strip and the mission line,
   * raised on every room entry and dismissed by its own timer. It takes no key and
   * blocks nothing, so it is a card, not a window the run waits on.
   */
  private areaPanelRoot: Phaser.GameObjects.Container | null = null;
  private areaPanelText: Phaser.GameObjects.BitmapText | null = null;
  private areaPanelTimer: Phaser.Time.TimerEvent | null = null;
  /**
   * True while `buildRoom` rebuilds the scene. A `buildRoute` runs `applyRoute`,
   * which raises the area panel for the dev frame-map import; inside a room build
   * the greeting belongs to the room entry itself (`create` / `transitionTo`), or
   * the boss-fall rebuild and the gate's rebuild would greet a room the run never
   * left.
   */
  private buildingRoom = false;

  private missionRoot: Phaser.GameObjects.Container | null = null;
  private hudMissionText: Phaser.GameObjects.BitmapText | null = null;
  /** The counter tile the room's own fixture placed, or null in a room without one. */
  private shopCounter: Tile | null = null;
  /** The special NPC this room rolled and its tile, or null off a room that rolled none. */
  private npc: RoomNpc | null = null;
  /** The NPC battle in flight, so its win can pay the row's prize. Cleared on the return. */
  private npcBattle: Readonly<{ row: NpcRow; mapIndex: number; roomId: number }> | null = null;
  /** Every special room kind's descriptor, indexed once per scene (`D47`). */
  private roomRegistry: RoomRegistry = collectDescriptors(ROOM_MODULES);
  /** The room's own panel while it owns the keyboard, or null; the scene owns the slot. */
  private roomPanel: RoomPanel | null = null;
  /** The mini-boss reward window: its floating card, root and callback. */
  private miniBossRewardPanel: FloatingPanel | null = null;
  private miniBossRewardRoot: Phaser.GameObjects.Container | null = null;
  private miniBossRewardOnDone: (() => void) | null = null;
  /** The room row in hand: the scene owns its ghost and resolves its drop. */
  private roomRowDrag: RoomRowDrag | null = null;
  private roomRowGhostIcon: Phaser.GameObjects.Image | null = null;
  private roomRowGhostLabel: Phaser.GameObjects.BitmapText | null = null;

  constructor() {
    super('Route');
  }

  init(data?: { run?: RunState }): void {
    if (data?.run) this.run = data.run;
  }

  /** Writes the run to the save slot (Phase 7), so a reload resumes it. */
  private persistRun(): void {
    storeRun(browserStorage(), this.run);
  }

  /**
   * Builds the run's current room from the map plan and points the scene at it:
   * its plan size and opening set, the biome's terrain and — in the boss room —
   * the map boss. The dev generator and the frame-map importer build a route
   * directly instead, without a room, so they keep the rolled shape.
   */
  private buildRoom(): void {
    const plan = planMap(this.run.seed, this.run.mapIndex);
    const view = roomView(plan, this.run.routeInMap, this.portalOpen(), this.run.arrivalEdge);
    this.plan = plan;
    this.room = view;
    const biome = getBiome(view.biomeId);
    // The room's geometry, trainers and loot seed off a **stable** per-room
    // index, not the run's moving counter, so walking back into a room shows the
    // same room (`docs/maps-spec.md` §9). The room's battle condition reads the
    // same index, so it too is the same on every visit.
    const roomIndex = routeIndexForRoom(plan, view.roomId);
    // The boss room always takes one of its two openings (`BOSS_OPENINGS`) and heals
    // the party and the box once per floor; every other room rolls at
    // `ROOM_BATTLEFIELD_CHANCE` or not at all. Both branches assign the opening, so no
    // stale boss stage survives a room change.
    const kind = roomKindOf(view);
    if (kind === 'boss') {
      const opening = bossOpeningRoll(this.run.seed, roomIndex);
      this.battlefield = opening.battlefield;
      this.bossOpening = opening;
      const healed = bossRoomHeal(this.run, view.mapIndex);
      if (healed !== this.run) {
        this.run = healed;
        this.persistRun();
      }
    } else {
      this.battlefield = roomBattlefield(this.run.seed, roomIndex, kind);
      this.bossOpening = null;
    }
    this.buildingRoom = true;
    this.buildRoute({
      seed: this.run.seed,
      routeIndex: roomIndex,
      shape: DEFAULT_SHAPE,
      width: view.width,
      height: view.height,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
      room: view,
    });
    this.buildingRoom = false;
    if (view.boss && !this.run.bossDefeated) {
      const boss = this.bossTrainer(view);
      if (boss) this.route = { ...this.route, trainers: [...this.route.trainers, boss] };
    }
    // A special room injects its own content, off stable ids, so a revisit rebuilds
    // it identically and a beaten mini-boss stays beaten (`docs/maps-spec.md` §7).
    // The room's own descriptor places it; the counter is cleared first, so a room
    // without one leaves nothing of the last room's behind (`D47`).
    this.shopCounter = null;
    const fixture = this.specialDescriptor()?.fixture?.(this.roomHost());
    if (fixture?.trainers) {
      this.route = { ...this.route, trainers: [...this.route.trainers, ...fixture.trainers] };
    }
    if (fixture?.items) {
      this.route = { ...this.route, items: [...this.route.items, ...fixture.items] };
    }
    if (fixture && 'counter' in fixture) this.shopCounter = fixture.counter ?? null;
    // A room's own line rides the strip once its fixture is in place (the no-heal
    // leaf announces its rule this way).
    if (fixture?.notice) this.showNotice(fixture.notice);
    this.placeSpecialTrainer(roomIndex);
    this.rollRoomNpc();
    // Last: the filter needs `this.map`, which `buildRoute` → `applyRoute` sets.
    this.buildBattlefieldOverlay();
  }

  /**
   * Overrides the room's first trainer with a special trainer when this room's own roll
   * draws one (`docs/routes-spec.md` §2). Once per build, from `buildRoom`, **before**
   * `rollRoomNpc()`; reads its own stream, so the room's route, trainers, items and the
   * floor's NPC do not move.
   */
  private placeSpecialTrainer(roomIndex: number): void {
    const room = this.room;
    if (!room) return;
    const trainer = specialTrainerFor({
      route: this.route,
      seed: this.run.seed,
      roomIndex,
      role: room.role,
      quiet: room.entry || room.boss || room.special !== null,
      missionsCompleted: this.run.missionsCompleted,
    });
    if (!trainer) return;
    this.route = {
      ...this.route,
      trainers: this.route.trainers.map((entry) => (entry.id === trainer.id ? trainer : entry)),
    };
  }

  /**
   * Places the room's special NPC (`docs/maps-spec.md` §7): at most one, only in a
   * regular `trainers` room and once per build — never in `update`. The floor's
   * **guaranteed** row is tried first (a placement, not a roll: it reads the plan and
   * no RNG), then the rolled rows on the room's own stream, so no route, trainer,
   * item or battle draw moves. A row whose art the packed sheet lacks is dropped
   * whole: no sprite, no block and no interact, and no second room is tried.
   */
  private rollRoomNpc(): void {
    this.npc = null;
    const room = this.room;
    if (!room || room.special !== null || room.role !== 'trainers') return;
    if (this.generatorStepIndex !== null) return;
    const eligible = NPC_ROWS.filter((row) => npcRequirementMet(this.run, row.requires));
    const guaranteed = guaranteedNpc(this.plan!, room.roomId, room.mapIndex);
    const placement = guaranteed
      ? { row: guaranteed, roomIndex: room.roomId }
      : roomNpc(this.run.seed, room.roomId, room.mapIndex, eligible);
    if (!placement) return;
    const tile = npcSpot(this.route, room.roomId, this.run.seed, placement.row.id);
    if (!tile) return;
    if (overworldSpriteFrame(placement.row.spriteKey) === null) return;
    this.npc = { row: placement.row, tile };
  }

  /** The descriptor for the room on screen, or null when it has none (`D47`). */
  private specialDescriptor(): RoomDescriptor | null {
    const kind = this.room?.special;
    return kind ? (this.roomRegistry.byKind.get(kind) ?? null) : null;
  }

  /** The plan room on screen; `buildRoom` sets it before any descriptor runs. */
  private get view(): RoomView {
    const room = this.room;
    if (!room) throw new Error('route scene has no plan room');
    return room;
  }

  /**
   * The port a room descriptor draws through (`D47`): the scene's own surface, with
   * `run` and `view` read live so a trade the panel commits is visible to its next
   * call. The room mutates the scene only through these methods.
   */
  private roomHost(): RoomHost {
    const scene = this;
    return {
      scene,
      get run(): RunState {
        return scene.run;
      },
      get view(): RoomView {
        return scene.view;
      },
      route: () => scene.route,
      rebuildRoom: () => scene.rebuildRoom(),
      entryTile: () => scene.route.entry,
      counterTile: () => scene.shopCounter,
      farthestRoomTile: () => scene.farthestRoomTile(),
      facingFromTo: (from, to) => scene.facingFromTo(from, to),
      generatorStepActive: () => scene.generatorStepIndex !== null,
      commitRun: (run) => scene.commitRun(run),
      // The room port still names this hook; no HUD pane holds the keyboard since
      // the route HUD went pointer-first (D45), so there is nothing to release.
      releaseHudKeyboard: () => undefined,
      openPanel: (panel) => scene.openPanel(panel),
      closePanel: () => scene.closePanel(),
      panelOpen: () => scene.panelOpen(),
      startTrainerBattle: (trainer) => scene.startTrainerBattle(trainer),
      startWildBattle: (encounter) => scene.startRoomWildBattle(encounter),
      showNotice: (notice) => scene.showNotice(notice),
      beginRowDrag: (drag) => scene.beginRowDrag(drag),
    };
  }

  /** Sets the scene's run, persists it and repaints the HUD (a Mart trade). */
  private commitRun(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.refreshHud();
  }

  /**
   * Folds the room's map passives for `trigger` into the run
   * (`src/engine/run/passives.ts`, `docs/routes-spec.md` §2). Silent — no save, no
   * repaint — when nothing paid, which the rule reports by returning the same run.
   */
  private applyMapPassives(trigger: MapPassiveTrigger): readonly PassivePickup[] {
    const { run, picks } = runPassives(this.run, trigger);
    if (picks.length === 0) return picks;
    this.run = run;
    this.persistRun();
    return picks;
  }

  /** Floats the pickup notice for each payment, in the rule's own order. */
  private showPassivePickups(picks: readonly PassivePickup[]): void {
    for (const pick of picks) {
      this.showNotice(itemPickupNotice(getItem(pick.itemId)?.name ?? pick.itemId));
    }
  }

  /** Gives the keyboard to `panel` until `closePanel()`; the scene owns the slot. */
  private openPanel(panel: RoomPanel): void {
    this.roomPanel = panel;
  }

  /** Tears the open panel down (room change, battle, run over). */
  private closePanel(): void {
    const panel = this.roomPanel;
    this.roomPanel = null;
    panel?.close();
  }

  /** True while a room's own panel owns the screen. */
  private panelOpen(): boolean {
    return this.roomPanel !== null;
  }

  /** True while a room panel is **modal**: a floating one never gates the route. */
  private modalPanelOpen(): boolean {
    return this.roomPanel !== null && this.roomPanel.modal !== false;
  }

  /**
   * Paints the room's battle condition as one tinted rectangle over the whole room.
   * The filter is static — the roll and the paint happen once per room build — and
   * the world camera keeps it while the pinned HUD camera ignores it.
   */
  private buildBattlefieldOverlay(): void {
    if (this.battlefieldOverlay) {
      this.battlefieldOverlay.destroy();
      this.battlefieldOverlay = null;
    }
    if (!this.battlefield || !this.map) return;
    const size = mapPixelSize(this.map, TILE_SIZE);
    const overlay = this.add
      .rectangle(0, 0, size.width, size.height, this.battlefield.tint, this.battlefield.alpha)
      .setOrigin(0, 0)
      .setDepth(BATTLEFIELD_DEPTH);
    this.battlefieldOverlay = overlay;
    this.hudCamera?.ignore([overlay]);
  }

  /** The portal is open once the map's boss has fallen, except on the final map (D31). */
  private portalOpen(): boolean {
    return this.run.bossDefeated && !isFinalMap(this.run.mode, this.run.mapIndex);
  }

  /**
   * The map boss: a themed `ace` trainer at the room's farthest walkable tile,
   * fielding a fixed six-member party (three on map 1) at the map's `maxLevel`. It
   * stands only while the map's boss is alive, so the portal stays sealed until it
   * falls.
   */
  private bossTrainer(view: RoomView): RouteTrainer | null {
    const position = this.farthestRoomTile();
    if (!position) return null;
    return {
      id: bossTrainerId(view.mapIndex),
      position,
      facing: this.facingFromTo(position, this.route.entry),
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: 'ace',
    };
  }

  /**
   * The walkable tile farthest (BFS) from the room entry, skipping tiles a
   * trainer or a visible item already owns; null when only the entry is free.
   */
  private farthestRoomTile(): Tile | null {
    const from = this.route.entry;
    const occupied = new Set<string>();
    for (const trainer of this.route.trainers)
      occupied.add(`${trainer.position.x},${trainer.position.y}`);
    for (const item of this.route.items) occupied.add(`${item.position.x},${item.position.y}`);
    const startKey = `${from.x},${from.y}`;
    const seen = new Set<string>([startKey]);
    const queue: Tile[] = [{ ...from }];
    let farthest: Tile | null = null;
    const deltas: readonly Tile[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (`${current.x},${current.y}` !== startKey && !occupied.has(`${current.x},${current.y}`)) {
        farthest = current;
      }
      for (const delta of deltas) {
        const next = { x: current.x + delta.x, y: current.y + delta.y };
        const key = `${next.x},${next.y}`;
        if (seen.has(key) || !isWalkable(this.moveMap, next)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return farthest;
  }

  /** The cardinal direction from `from` to `to` (the boss faces the door it guards). */
  private facingFromTo(from: Tile, to: Tile): Facing {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) return 'S';
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
    return dy > 0 ? 'S' : 'N';
  }

  /**
   * Builds the route for `params` (plus the debug reroll `attempt`) and points
   * the scene at it: map, render tiles, tileset and the encounter stream.
   * `create`, a room change and the debug "regenerate" all go through here so
   * they cannot drift.
   */
  private buildRoute(params: RouteParams, attempt = 0): void {
    const biome = params.room ? getBiome(params.room.biomeId) : biomeForRoute(params.routeIndex);
    const seed = attempt > 0 ? `${params.seed}#r${attempt}` : params.seed;
    this.routeParams = params;
    const pattern = TILESETS[biome.tilesetId].config.wallPattern;
    const wall = pattern
      ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
      : undefined;
    const band = params.room
      ? bandForMap(params.room.mapIndex)
      : runBand(this.run.seed, params.routeIndex);
    const loot = ROUTE_LOOT[band.id];
    const request: RouteRequest = {
      seed,
      routeIndex: params.routeIndex,
      biomeId: biome.id,
      layout: biome.layout,
      ...(params.room
        ? { openings: params.room.openings, width: params.room.width, height: params.room.height }
        : { shape: params.shape, width: params.width, height: params.height }),
      grassPatches: params.grassPatches,
      ledges: params.ledges,
      loot: loot.pool,
      hiddenChance: loot.hiddenChance,
      itemChance: loot.itemChance,
      ...(params.room ? { role: params.room.role } : {}),
      trainerArchetypes: TRAINER_ARCHETYPE_IDS,
      // The map's entry, boss and special rooms are **quiet**: no tall grass, no
      // ledges, no ground items and no trainers. The entry and boss are quiet
      // (`docs/maps-spec.md` §2/§6) and a special carries only its own content
      // (§7).
      quiet: params.room ? params.room.entry || params.room.boss || params.room.special !== null : false,
      // The gated room's vault is sealed until the floor's own mark says otherwise, so a
      // revisit and a reload draw exactly what the run has (`docs/maps-spec.md` §7). The
      // static and secret-shop leaves carve the same vault and read their own records.
      ...(params.room?.special === 'gated' ||
      params.room?.special === 'static' ||
      params.room?.special === 'secret-shop'
        ? {
            gate: isItemPicked(
              this.run,
              params.room.special === 'gated'
                ? gateId(params.room.mapIndex, params.room.roomId)
                : params.room.special === 'static'
                  ? staticGateId(params.room.mapIndex, params.room.roomId)
                  : secretShopSealId(params.room.mapIndex, params.room.roomId),
            )
              ? 'open'
              : 'sealed',
          }
        : {}),
      ...(wall ? { wall } : {}),
    };
    const route = sketchRoute(request);
    this.generatorSteps = IS_DEVELOP ? sketchRouteSteps(request) : [];
    this.applyRoute(route, params.room ?? null);
  }

  /**
   * Points the scene at an already-built route: its tiles become the live and
   * render maps, and the tileset and encounter stream follow the route's biome.
   * Both `buildRoute` and the debug frame-map import go through here so they
   * cannot drift. `view` is the plan room on screen (null for an imported map or
   * the dev generator), which carries the map band and the floor's level cap.
   */
  private applyRoute(route: RouteMap, view: RoomView | null = null): void {
    // The boss room's portal is carved from the start but sealed until the boss
    // falls, so the room looks the same before and after it opens.
    if (view?.boss && !view.portalOpen && view.portalEdge) {
      route = this.sealEdge(route, view.portalEdge);
    }
    this.route = route;
    this.map = route.tiles;
    this.renderTiles = this.map;
    this.generatorStepIndex = null;
    const biome = getBiome(route.biomeId);
    const band = view ? bandForMap(view.mapIndex) : runBand(this.run.seed, route.routeIndex);
    const cap = band.maxLevel;
    this.tilesetId = biome.tilesetId;
    this.moveMap = this.movementMap(this.map);
    this.encounters = new RouteEncounters(
      encounterTableFor(bandForLevel(squadLevel(this.run))),
      new Rng(hashSeed(`${route.seed}:encounters:${route.routeIndex}`)),
      (rng) => rollWildLevel(rng, squadLevel(this.run), cap),
      undefined,
      // Shinies roll on their own stream, so they never shift the encounter
      // sequence a fixed seed already produced.
      new Rng(hashSeed(`${route.seed}:shiny:${route.routeIndex}`)),
      wildExclusions(this.run),
      // The magician's type, so a room rebuilt from a save still obeys it.
      this.run.modifiers.nextWildType,
    );
    // The dev frame-map import reaches this seam on its own (it builds no room);
    // a route built for a room is greeted once by the room entry that asked for it.
    if (!this.buildingRoom) this.showAreaPanel();
  }

  create(): void {
    if (!this.run) {
      this.run = createRun({ seed: DEV_SEED, starter: createRunPokemon(DEMO_STARTER), bag: DEMO_BAG });
      this.run = addPokemon(this.run, createRunPokemon(DEMO_RESERVE));
    }
    this.persistRun();
    this.tileSprites = [];
    this.hudRows = [];
    this.hudBagRows = [];
    this.hudPanels = [];
    this.hudPanelDrag = null;
    this.hudIconPress = null;
    this.hudDetailPlaced = false;
    this.trainerSprites = [];
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    this.hudDetailState = CLOSED_DETAIL;
    this.hudPress = null;
    this.passThrough = false;
    this.ignoreEncounters = false;
    this.ignoreTrainers = false;
    this.clearHoverInspect();
    this.gameOver = false;
    this.pendingBattle = null;
    this.releaseRoot = null;
    this.releaseQueue = [];
    this.releaseOnDone = null;
    this.releaseWait = null;
    this.releaseArmed = false;
    this.roomPanel = null;
    this.shopCounter = null;
    this.npc = null;
    this.miniBossRewardPanel = null;
    this.miniBossRewardRoot = null;
    this.miniBossRewardOnDone = null;
    this.roomRowDrag = null;
    this.roomRowGhostIcon = null;
    this.roomRowGhostLabel = null;
    this.facing = 'down';
    this.walkTween = null;
    this.followerSprite = null;
    this.followerSheet = null;
    this.followerSpecies = null;
    this.followerTween = null;
    this.resetHold = 0;
    this.settings = loadSettings();
    this.reducedFlash = this.settings.reducedFlash;

    this.buildRoom();

    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = { ...this.route.entry };
    this.playerSprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(actorDepth(0));
    this.movePlayerTo(this.player.x, this.player.y);
    this.refreshTrainerVisibility();

    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
    this.cameras.main.setZoom(routeCameraZoom());
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);

    this.refreshMoveKeys();

    subscribeKeybinds(
      this,
      ({ action }) => this.handleAction(action),
      // The route holds the run, so it keeps its own settings snapshot rather
      // than re-reading the whole save on every key; `applySettings` refreshes it.
      () => this.settings.keybinds,
    );
    if (IS_DEVELOP) {
      this.input.keyboard!.on('keydown-B', () => {
        // A typed `b` belongs to the nickname field, not to the debug battle.
        if (this.textFieldFocused()) return;
        if (this.scene.isActive())
          this.startBattle({ kind: 'wild', speciesId: 'scatterbug', level: 5, key: 'dev' });
      });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        this.updateHoverInspect(pointer);
      });
      this.input.on('gameout', () => this.clearHoverInspect());
    }
    // Typed text is the only keystroke the route still reads directly: the two
    // in-panel fields consume it, and the level-up popup is dismissed by any key.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.scene.isActive()) return;
      // Auto-repeat is ignored, so a held key never types (or pages) twice; the
      // stamp guard drops the same event when the plugin re-delivers it.
      if (event.repeat || this.searchKeyStamps.has(event.timeStamp)) return;
      this.searchKeyStamps.add(event.timeStamp);
      if (this.searchKeyStamps.size > 64) this.searchKeyStamps.clear();
      if (this.learnPopupOpen) {
        this.closeLearnPopup();
        return;
      }
      // The nickname field owns the keyboard while it is focused: it consumes every
      // key, so nothing typed there reaches the game underneath.
      if (this.typeInNickname(event)) return;
      this.typeInDetailSearch(event);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleHudPointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handleHudPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleHudPointerUp(pointer));
    // A drag whose button is released off the canvas (or that leaves the screen)
    // must let go, or the held panel/member keeps following a pointer that is gone.
    this.input.on('pointerupoutside', () => this.cancelHudDrags());
    this.input.on('gameout', () => {
      this.cancelHudDrags();
      this.clearDetailInfo();
    });
    // The mouse wheel flips the PC box pages while the pointer is over it, and
    // scrolls the learnset band one row at a time while it is over that instead.
    // The box is tested first, so it wins where the two rects overlap.
    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        if (!this.scene.isActive()) return;
        if (this.pointerInBoxPanel(pointer)) {
          this.stepBoxPage(dy > 0 ? 1 : -1);
          return;
        }
        if (this.pointerInLearnBand(pointer)) this.scrollLearnset(dy > 0 ? 1 : -1);
      },
    );
    this.hud = hudMetrics(this.scale.width);
    this.buildHud();
    this.setupHudCamera();
    // The touch pad and the pause menu live on the pinned HUD camera (screen
    // space) and are ignored by the zoomed world camera, like the HUD.
    this.touch = createTouchControls(this, {
      onAction: (action) => this.handleAction(action),
    });
    this.cameras.main.ignore(this.touch.root);
    // On a touch screen the phone's own Back gesture opens the pause menu (the
    // browser hands it to us as a history pop); a keyboard uses Esc instead.
    if (this.touch.enabled) {
      this.detachBack = listenForBack(() => this.onBackGesture());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detachBack?.());
    }
    // A battle pauses the route mid-walk; drop the pad's held direction so the
    // player does not keep stepping the moment the route comes back, and give up
    // an in-progress nickname edit rather than resuming into a focused field.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      this.touch?.release();
      this.cancelNicknameEdit();
    });
    // The battle above took the music channel; the route takes it back.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.touch?.release();
      playMusic(this, 'route-music');
    });
    this.buildResetOverlay();
    this.buildPauseMenu();
    this.buildLearnPopup();
    this.buildNotice();
    this.buildAreaPanel();
    this.buildMissionLine();
    this.refreshHud();
    // The first room's greeting: the `applyRoute` of `buildRoom` ran before the
    // panel existed, so the banner is raised here instead.
    this.showAreaPanel();
    this.refreshDetail();
    playMusic(this, 'route-music');
  }

  /**
   * The player's intent behind one shared action, whatever drove it: a key from
   * the map or the on-screen A / B. While the pause menu is up it owns the input.
   */
  private handleAction(action: KeybindAction): void {
    if (!this.scene.isActive()) return;
    // The learnset search field and the nickname field own the keyboard while
    // either holds focus.
    if (this.textFieldFocused()) return;
    // The level-up popup is dismissed by any input.
    if (this.learnPopupOpen) {
      this.closeLearnPopup();
      return;
    }
    // A room's own **modal** panel owns the input while it is open; the floating
    // Mart and the reward take no key, so the route's quick keys keep working.
    if (this.roomPanel && this.roomPanel.modal !== false) {
      this.roomPanel.handle?.(action);
      return;
    }
    if (this.pauseMenuOpen) {
      this.handlePauseMenuAction(action);
      return;
    }
    switch (action) {
      case 'confirm':
        // `E` is the accept key: it moves a release beat on, and otherwise
        // doubles as the overworld interact (the shared default for both).
        if (this.releaseRoot) {
          if (this.releaseArmed) this.advanceRelease();
          return;
        }
        this.tryInteract();
        return;
      case 'interact':
        this.tryInteract();
        return;
      case 'cancel':
        this.openPauseMenu();
        return;
      case 'party':
        this.toggleHudPanel('party');
        return;
      case 'bag':
        this.toggleHudPanel('bag');
        return;
      case 'map':
        this.toggleHudPanel('header');
        return;
      case 'box':
        this.toggleHudPanel('box');
        return;
      case 'settings':
        this.openSettings();
        return;
    }
  }

  /**
   * Opens or collapses the HUD panel a quick key points at, exactly as a click on
   * its collapse icon does. Ignored while another overlay (the pause menu, a
   * release beat) owns the input.
   *
   * A quick key is a plain toggle (D45): it never takes the keyboard, so the
   * arrows keep walking the route while a pane is open.
   */
  private toggleHudPanel(id: HudPanelId): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot || this.pauseMenuOpen) {
      return;
    }
    const panel = this.panelById(id);
    if (!panel) return;
    this.togglePanel(panel);
  }

  /** The members a pane shows: the party, the PC box, or the fallen. */
  private paneMembers(pane: PaneId): readonly RunPokemon[] {
    if (pane === 'party') return this.run.party;
    return pane === 'rip' ? this.run.rip : this.run.box;
  }

  /** The stacks the bag window draws, in draw order. */
  private hudBagStacks(): readonly BagCounts[] {
    const inHand = this.hudDragItemFrom === null ? this.hudDragItem : null;
    return bagForCategory(this.run.bag, this.hudBagCategory)
      .filter((stack) => stack.itemId !== inHand)
      .slice(0, HUD_BAG_ROWS);
  }

  /** The move grid's marked cell: the move grabbed with the pointer, or none. */
  private detailSlotCursor(): number {
    return this.hudDetailState.grab ?? -1;
  }

  /** The pool grid's marked cell: the pool move in hand, or none. */
  private learnWindowCursor(): number {
    if (this.hudLearnDrag === null) return -1;
    return this.hudLearnWindow.findIndex((entry) => entry.moveId === this.hudLearnDrag);
  }

  /** Resolves the movement keys from the shared map; re-run when it changes. */
  private refreshMoveKeys(): void {
    const bind = (action: MoveKey): Phaser.Input.Keyboard.Key[] =>
      actionKeys(this, action, this.settings.keybinds);
    this.moveKeys = { up: bind('up'), down: bind('down'), left: bind('left'), right: bind('right') };
    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
    this.resetKey = actionKeys(this, 'reset', this.settings.keybinds)[0] ?? null;
  }

  /**
   * The persistent overlay: a route header (the map name over the floor minimap)
   * plus a party window (portrait, name, level and HP bar) and a bag window
   * (pocket tabs over the active pocket's icon, name and count), each its own
   * FRLG nine-slice so the two never share a panel.
   */
  private buildHud(): void {
    const { panelW, partyW, mapW, partyHpBarScale, xpBarW } = this.hud;
    const x = this.scale.width - panelW - 8;
    const left = x + HUD_PAD_X;
    const right = x + panelW - HUD_PAD_X;
    const headerChildren: Phaser.GameObjects.GameObject[] = [];
    const partyChildren: Phaser.GameObjects.GameObject[] = [];
    const bagChildren: Phaser.GameObjects.GameObject[] = [];
    const boxChildren: Phaser.GameObjects.GameObject[] = [];

    // The route header is the floor minimap: the map name over the grid of
    // discovered rooms, drawn on a Graphics so a room change can clear and redraw
    // it. The layout itself is the pure `buildMapView`; this panel only scales and
    // paints it (`docs/maps-spec.md` §8).
    const headerWindow = addFrlgWindow(this, HUD_MAP_X, HUD_MAP_Y, mapW, HUD_MAP_H);
    headerChildren.push(headerWindow);
    this.hudTitle = addFrlgText(this, HUD_MAP_X + HUD_CONTENT_LEFT, HUD_MAP_Y + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_INK,
    }).setMaxWidth(mapW - HUD_CONTENT_LEFT - HUD_PAD_X);
    this.hudMapGraphics = this.add.graphics();
    this.hudMapEmpty = addFrlgText(
      this,
      HUD_MAP_X + mapW / 2,
      HUD_MAP_Y + HUD_MAP_TITLE_H + 56,
      t('hud.noMap'),
      { size: 16, tint: FRLG_MUTED, origin: [0.5, 0] },
    );
    headerChildren.push(this.hudTitle, this.hudMapGraphics, this.hudMapEmpty);

    const partyY = HUD_TOP;
    const partyH = HUD_PARTY_HEADER + MAX_PARTY_SIZE * HUD_PARTY_ROW + HUD_PAD_BOTTOM;
    this.hudX = x;
    this.hudPartyY = partyY;
    this.hudPartyH = partyH;
    const partyWindow = addFrlgWindow(this, x, partyY, partyW, partyH);
    partyChildren.push(partyWindow);
    const partyLeft = x + HUD_PAD_X;
    const partyRight = x + partyW - HUD_PAD_X;
    // The Pokevial bar, centred under the level/XP line: a single meter that
    // grows and changes shade as it fills (one fill step per charge), with its
    // name written inside. Clicking a charged bar rests the whole party and box.
    const vialX = x + (partyW - HUD_VIAL_W) / 2;
    const vialY = partyY + HUD_VIAL_Y;
    const vialBg = this.add
      .rectangle(vialX, vialY, HUD_VIAL_W, HUD_VIAL_H, FRLG_TRACK.colour, FRLG_TRACK.alpha)
      .setOrigin(0, 0);
    this.hudVialFill = this.add
      .rectangle(vialX, vialY, 0, HUD_VIAL_H, HUD_VIAL_FILL_COLORS[0])
      .setOrigin(0, 0);
    this.hudVialLabel = addFrlgText(this, vialX + HUD_VIAL_W / 2, vialY + 3, t('hud.vial'), {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0],
    });
    partyChildren.push(vialBg, this.hudVialFill, this.hudVialLabel);
    // The squad's shared level and XP bar: every member levels together off this
    // one bar (`docs/battle-spec.md` §7).
    const xpBarY = partyY + HUD_XP_BAR_Y;
    const xpBarX = partyLeft + HUD_XP_BAR_INSET;
    this.hudLevelText = addFrlgText(this, xpBarX, partyY + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_INK,
    });
    const xpBg = this.add
      .rectangle(xpBarX, xpBarY, xpBarW, HUD_XP_BAR_H, FRLG_TRACK.colour, FRLG_TRACK.alpha)
      .setOrigin(0, 0);
    this.hudXpFill = this.add.rectangle(xpBarX, xpBarY, 0, HUD_XP_BAR_H, 0x60a5fa).setOrigin(0, 0);
    this.hudXpText = addFrlgText(this, partyRight - HUD_XP_BAR_INSET, partyY + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    });
    partyChildren.push(this.hudLevelText, xpBg, this.hudXpFill, this.hudXpText);
    this.hudRows = [];
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const rowY = partyY + HUD_PARTY_HEADER + i * HUD_PARTY_ROW;
      const highlight = this.add
        .rectangle(
          partyLeft,
          rowY,
          partyRight - partyLeft,
          HUD_PARTY_ROW - 4,
          FRLG_SELECTED_FILL.colour,
          FRLG_SELECTED_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const portraitX = partyLeft + 24;
      const portrait = this.add
        .image(portraitX, rowY + 26, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(HUD_PARTY_PORTRAIT_SCALE)
        .setVisible(false);
      const held = this.add
        .image(portraitX + 15, rowY + 39, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_HELD_ICON_SCALE)
        .setVisible(false);
      const column = partyLeft + HUD_PARTY_COLUMN;
      const name = addFrlgText(this, column, rowY + 6, '', { size: 16, tint: FRLG_INK }).setMaxWidth(
        partyRight - column,
      );
      const status = this.add
        .image(partyRight, rowY + 5, STATUS_ICON_TEXTURE_KEY, 0)
        .setOrigin(1, 0)
        .setScale(HUD_PARTY_STATUS_SCALE)
        .setVisible(false);
      const bar = this.add
        .image(column, rowY + 28, FRLG_HPBAR_KEY)
        .setOrigin(0, 0)
        .setScale(partyHpBarScale)
        .setVisible(false);
      const fill = this.add
        .rectangle(column, rowY + 28, 0, FRLG_HPBAR.fill.height * partyHpBarScale, 0x58d080)
        .setOrigin(0, 0)
        .setVisible(false);
      this.hudRows.push({ highlight, portrait, held, status, name, bar, fill });
      partyChildren.push(highlight, portrait, held, name, status, bar, fill);
    }

    const bagY = partyY + partyH + HUD_GAP;
    const bagH = HUD_BAG_HEADER + HUD_BAG_ROWS * HUD_BAG_ROW + HUD_BAG_FOOTER + HUD_PAD_BOTTOM;
    this.hudBagY = bagY;
    this.hudBagH = bagH;
    const bagWindow = addFrlgWindow(this, x, bagY, panelW, bagH);
    bagChildren.push(bagWindow);

    // Pocket tabs across the window's head, FRLG style: the active one reads
    // dark-on-light, the rest stay a pale folder. Click or `[` / `]` to switch.
    this.hudBagTabs = [];
    BAG_CATEGORIES.forEach((category, i) => {
      const tabX = x + HUD_CONTENT_LEFT + i * (HUD_TAB_W + HUD_TAB_GAP);
      const tabY = bagY + HUD_PAD_TOP;
      const bg = this.add
        .rectangle(tabX, tabY, HUD_TAB_W, HUD_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0);
      const label = addFrlgText(this, tabX + HUD_TAB_W / 2, tabY + 5, bagCategoryLabel(category), {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      });
      this.hudBagTabs.push({ category, bg, label });
      bagChildren.push(bg, label);
    });

    this.hudBagRows = [];
    for (let i = 0; i < HUD_BAG_ROWS; i++) {
      const rowY = bagY + HUD_BAG_HEADER + i * HUD_BAG_ROW;
      const icon = this.add
        .image(left + 10, rowY + 20, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(0.75)
        .setVisible(false);
      const name = addFrlgText(this, left + 28, rowY + 12, '', { size: 16, tint: FRLG_INK });
      const count = addFrlgText(this, right, rowY + 12, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      });
      this.hudBagRows.push({ icon, name, count });
      bagChildren.push(icon, name, count);
    }

    this.hudBagEmpty = addFrlgText(this, x + panelW / 2, bagY + HUD_BAG_HEADER + 36, t('hud.noItems'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [0.5, 0],
    });
    bagChildren.push(this.hudBagEmpty);

    // The footer holds the run's Poké Dollars: a hairline rule then the readout,
    // so the money sits with the bag it is spent from (`docs/maps-spec.md` §7).
    const footerY = bagY + HUD_BAG_HEADER + HUD_BAG_ROWS * HUD_BAG_ROW;
    const footerRule = this.add
      .rectangle(
        x + HUD_PAD_X,
        footerY + 4,
        panelW - HUD_PAD_X * 2,
        1,
        FRLG_ROW_STROKE.colour,
        FRLG_ROW_STROKE.alpha,
      )
      .setOrigin(0, 0);
    const moneyLabel = addFrlgText(this, x + HUD_PAD_X, footerY + 12, t('hud.money'), {
      size: 16,
      tint: FRLG_MUTED,
    });
    this.hudMoneyText = addFrlgText(this, x + panelW - HUD_PAD_X, footerY + 12, '', {
      size: 16,
      tint: FRLG_INK,
      origin: [1, 0],
    });
    bagChildren.push(footerRule, moneyLabel, this.hudMoneyText);

    // The PC BOX window: a page tab strip over a grid of avatar cells, in a
    // second column to the left of the party/bag stack. On a narrow screen there
    // is no room to the left, so it is clamped onto the screen and overlaps.
    const boxX = Math.max(HUD_PANEL_MARGIN, x - panelW - HUD_GAP);
    const boxY = HUD_TOP + 64;
    this.hudBoxX = boxX;
    this.hudBoxY = boxY;
    this.hudBoxH = HUD_BOX_H;
    const boxWindow = addFrlgWindow(this, boxX, boxY, panelW, HUD_BOX_H);
    boxChildren.push(boxWindow);

    this.hudBoxTabs = [];
    for (let page = 0; page < HUD_BOX_MAX_PAGES; page++) {
      const tabX = boxX + HUD_CONTENT_LEFT + page * (HUD_BOX_TAB_W + HUD_BOX_TAB_GAP);
      const bg = this.add
        .rectangle(
          tabX,
          boxY + HUD_PAD_TOP,
          HUD_BOX_TAB_W,
          HUD_TAB_H,
          FRLG_ROW_FILL.colour,
          FRLG_ROW_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(
        this,
        tabX + HUD_BOX_TAB_W / 2,
        boxY + HUD_PAD_TOP + 5,
        String(page + 1),
        {
          size: 16,
          tint: FRLG_INK,
          origin: [0.5, 0],
        },
      ).setVisible(false);
      this.hudBoxTabs.push({ page, bg, label });
      boxChildren.push(bg, label);
    }

    const ripX = boxX + panelW - HUD_PAD_X - HUD_BOX_RIP_TAB_W;
    const ripY = boxY + HUD_PAD_TOP;
    const ripBg = this.add
      .rectangle(ripX, ripY, HUD_BOX_RIP_TAB_W, HUD_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0);
    const ripVeil = this.add
      .rectangle(ripX, ripY, HUD_BOX_RIP_TAB_W, HUD_TAB_H, HUD_BOX_LOCK_FILL, HUD_BOX_LOCK_ALPHA)
      .setOrigin(0, 0);
    const ripLabel = addFrlgText(this, ripX + HUD_BOX_RIP_TAB_W / 2, ripY + 5, HUD_BOX_RIP_LABEL, {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0],
    });
    this.hudBoxRip = { veil: ripVeil, bg: ripBg, label: ripLabel };
    boxChildren.push(ripBg, ripVeil, ripLabel);

    const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
    const gridLeft = boxX + HUD_BOX_PAD + (panelW - HUD_BOX_PAD * 2 - gridW) / 2;
    this.hudBoxCells = [];
    for (let i = 0; i < BOX_PAGE_SIZE; i++) {
      const col = i % BOX_COLS;
      const row = Math.floor(i / BOX_COLS);
      const cellX = gridLeft + col * (HUD_BOX_CELL + HUD_BOX_CELL_GAP);
      const cellY = boxY + HUD_BOX_TABS_H + row * (HUD_BOX_CELL + HUD_BOX_CELL_GAP);
      const bg = this.add
        .rectangle(cellX, cellY, HUD_BOX_CELL, HUD_BOX_CELL, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
      const highlight = this.add
        .rectangle(
          cellX,
          cellY,
          HUD_BOX_CELL,
          HUD_BOX_CELL,
          FRLG_SELECTED_FILL.colour,
          FRLG_SELECTED_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const portrait = this.add
        .image(cellX + HUD_BOX_CELL / 2, cellY + HUD_BOX_CELL / 2, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(1)
        .setVisible(false);
      const held = this.add
        .image(cellX + 62, cellY + 62, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_BOX_HELD_ICON_SCALE)
        .setVisible(false);
      const status = this.add
        .image(cellX + HUD_BOX_CELL - 3, cellY + 2, STATUS_ICON_TEXTURE_KEY, 0)
        .setOrigin(1, 0)
        .setScale(HUD_PARTY_STATUS_SCALE)
        .setVisible(false);
      const lock = this.add
        .rectangle(cellX, cellY, HUD_BOX_CELL, HUD_BOX_CELL, HUD_BOX_LOCK_FILL, HUD_BOX_LOCK_ALPHA)
        .setOrigin(0, 0)
        .setVisible(false);
      this.hudBoxCells.push({ highlight, bg, portrait, held, status, lock });
      boxChildren.push(bg, highlight, portrait, held, status, lock);
    }

    // The member detail panel, drawn over the box's left; hidden until a member
    // is clicked. It goes before the drag ghost so the ghost still rides on top.
    this.hudDetail = this.buildDetailPanel();

    // Each panel is its own container holding a body (the window and its content)
    // and an icon button; a drag moves the whole panel and raises it over the
    // rest, and clicking the icon hides the body to collapse it.
    this.hudPanels = [
      this.makeHudPanel(
        'header',
        HUD_MAP_X,
        HUD_MAP_Y,
        mapW,
        HUD_MAP_H,
        this.add.container(0, 0, headerChildren),
        headerWindow,
        PANEL_ICON_KEYS.header,
        PANEL_KEY_ACTIONS.header ?? null,
      ),
      this.makeHudPanel(
        'party',
        x,
        partyY,
        partyW,
        partyH,
        this.add.container(0, 0, partyChildren),
        partyWindow,
        PANEL_ICON_KEYS.party,
        PANEL_KEY_ACTIONS.party ?? null,
      ),
      this.makeHudPanel(
        'bag',
        x,
        bagY,
        panelW,
        bagH,
        this.add.container(0, 0, bagChildren),
        bagWindow,
        PANEL_ICON_KEYS.bag,
        PANEL_KEY_ACTIONS.bag ?? null,
      ),
      this.makeHudPanel(
        'box',
        boxX,
        boxY,
        panelW,
        HUD_BOX_H,
        this.add.container(0, 0, boxChildren),
        boxWindow,
        PANEL_ICON_KEYS.box,
        PANEL_KEY_ACTIONS.box ?? null,
      ),
      this.makeHudPanel(
        'detail',
        this.hudDetailX,
        this.hudDetailY,
        this.hud.detailW,
        HUD_DETAIL_H,
        this.hudDetail,
        this.hudDetailWindow,
        PANEL_ICON_KEYS.detail,
        null,
      ),
    ];

    // The avatar held in hand while dragging, drawn last so it rides over the
    // panels and follows the pointer anywhere on screen.
    this.hudDragGhost = this.add.image(0, 0, PORTRAIT_TEXTURE_KEY, 0).setScale(0.9).setVisible(false);

    // The move held in hand while dragging a learnset entry onto a slot: a small
    // screen-space chip that follows the pointer over the HUD.
    this.hudLearnGhost = addFrlgText(this, 0, 0, '', {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0.5],
    }).setVisible(false);

    this.hudRoot = this.add
      .container(0, 0, [
        ...this.hudPanels.map((panel) => panel.container),
        this.hudDragGhost,
        this.hudLearnGhost,
      ])
      .setDepth(150);

    this.applyStoredHudLayout();
  }

  /** One HUD panel: its body container plus the collapse button at its corner. */
  private makeHudPanel(
    id: HudPanelId,
    x: number,
    y: number,
    w: number,
    h: number,
    body: Phaser.GameObjects.Container,
    window: Phaser.GameObjects.NineSlice,
    iconTexture: string,
    key: KeybindAction | null,
  ): HudPanel {
    const { icon, label, w: iconW, h: iconH } = this.buildPanelIcon(x, y, iconTexture, key);
    // The outline that stands in for the window while Transparent HUD is on. It
    // lives in the body, so collapsing the panel hides it with the content.
    const border = this.add.graphics().setVisible(false);
    border.lineStyle(HUD_BG_BORDER_WIDTH, HUD_BG_BORDER, HUD_BG_BORDER_ALPHA);
    border.strokeRoundedRect(x, y, w, h, HUD_BG_BORDER_RADIUS);
    body.add(border);
    const container = this.add.container(0, 0, [body, icon]);
    return {
      id,
      container,
      body,
      icon,
      key,
      keyLabel: label,
      iconW,
      iconH,
      window,
      border,
      x,
      y,
      w,
      h,
      dx: 0,
      dy: 0,
      expanded: true,
    };
  }

  /**
   * The dark button with a white glyph that collapses its panel, flush with the
   * panel's top-left corner. When the panel has a quick key and this is a keyboard
   * screen, it grows into a rectangle and prints that key's letter under the icon,
   * so the shortcut is discoverable; a touch screen shows only the icon.
   */
  private buildPanelIcon(
    x: number,
    y: number,
    textureKey: string,
    key: KeybindAction | null,
  ): {
    icon: Phaser.GameObjects.Container;
    label: Phaser.GameObjects.BitmapText | null;
    w: number;
    h: number;
  } {
    const showKey = key !== null && !prefersTouchControls();
    const h = HUD_ICON + (showKey ? HUD_KEY_H : 0);
    const bg = this.add
      .rectangle(x, y, HUD_ICON, h, FRLG_TRACK.colour, FRLG_TRACK.alpha)
      .setOrigin(0, 0);
    const image = this.add.image(x + HUD_ICON / 2, y + HUD_ICON / 2, textureKey);
    const children: Phaser.GameObjects.GameObject[] = [bg, image];
    let label: Phaser.GameObjects.BitmapText | null = null;
    if (showKey && key !== null) {
      label = addFrlgText(
        this,
        x + HUD_ICON / 2,
        y + HUD_ICON + (HUD_KEY_H - HUD_KEY_TEXT) / 2,
        keyLabel(this.settings.keybinds[key]),
        { size: HUD_KEY_TEXT, tint: FRLG_INK, origin: [0.5, 0] },
      );
      children.push(label);
    }
    return { icon: this.add.container(0, 0, children), label, w: HUD_ICON, h };
  }

  /** Re-prints the quick-key letters after a rebind (see `applySettings`). */
  private refreshPanelKeyLabels(): void {
    for (const panel of this.hudPanels) {
      if (panel.keyLabel && panel.key) {
        panel.keyLabel.setText(keyLabel(this.settings.keybinds[panel.key]));
      }
    }
  }

  /**
   * The member detail window: a header (name, level and type chips) over two
   * tabs, then either the STATS readout or the draggable MOVES grid (the shared
   * battle move grid, with its floating info popup). Built once; `refreshDetail`
   * fills it in and shows or hides the whole container.
   */
  private buildDetailPanel(): Phaser.GameObjects.Container {
    const { detailW, detailPadX } = this.hud;
    const x = Math.max(HUD_PANEL_MARGIN, this.hudBoxX - detailW - HUD_GAP);
    const y = this.hudBoxY;
    this.hudDetailX = x;
    this.hudDetailY = y;
    const left = x + detailPadX;
    const right = x + detailW - detailPadX;
    const innerW = detailW - detailPadX * 2;
    this.hudDetailWindow = addFrlgWindow(this, x, y, detailW, HUD_DETAIL_H);
    const children: Phaser.GameObjects.GameObject[] = [this.hudDetailWindow];
    // The nickname field's box, in the header's name row. It is pushed first, so
    // it sits under the name text and rides the panel with everything else.
    this.hudNicknameBg = this.add
      .rectangle(0, 0, 10, HUD_NICKNAME_FIELD_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
      .setVisible(false);
    children.push(this.hudNicknameBg);

    this.hudDetailName = addFrlgText(this, x + HUD_CONTENT_LEFT, y + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_INK,
    });
    this.hudDetailLevel = addFrlgText(this, right, y + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    });
    // The hint sits at the field's right end; `refreshNicknameField` places it.
    this.hudDetailNameHint = addFrlgText(this, right, y + HUD_PAD_TOP + 3, t('detail.clickToName'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    }).setVisible(false);
    this.hudDetailStatus = this.add
      .image(x + HUD_CONTENT_LEFT, y + HUD_PAD_TOP + 1, STATUS_ICON_TEXTURE_KEY, 0)
      .setOrigin(0, 0)
      .setScale(HUD_PARTY_STATUS_SCALE)
      .setVisible(false);
    children.push(this.hudDetailName, this.hudDetailNameHint, this.hudDetailLevel, this.hudDetailStatus);

    const chipY = y + HUD_PAD_TOP + 22;
    this.hudDetailTypes = [];
    for (let i = 0; i < 2; i++) {
      const chipX = left + i * (HUD_DETAIL_TYPE_W + 6);
      const bg = this.add
        .rectangle(chipX, chipY, HUD_DETAIL_TYPE_W, 20, FRLG_MUTED)
        .setOrigin(0, 0)
        .setVisible(false);
      const label = addFrlgText(this, chipX + HUD_DETAIL_TYPE_W / 2, chipY + 2, '', {
        size: 16,
        tint: FRLG_BADGE_INK,
        origin: [0.5, 0],
      }).setVisible(false);
      this.hudDetailTypes.push({ bg, label });
      children.push(bg, label);
    }

    const tabY = y + HUD_DETAIL_TABS_TOP;
    const tabW = (innerW - HUD_TAB_GAP) / 2;
    this.hudDetailTabs = [];
    (['stats', 'moves'] as DetailTab[]).forEach((tab, i) => {
      const tabX = left + i * (tabW + HUD_TAB_GAP);
      const bg = this.add
        .rectangle(tabX, tabY, tabW, HUD_DETAIL_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0);
      const label = addFrlgText(
        this,
        tabX + tabW / 2,
        tabY + 5,
        t(tab === 'stats' ? 'detail.tabStats' : 'detail.tabMoves'),
        {
          size: 16,
          tint: FRLG_INK,
          origin: [0.5, 0],
        },
      );
      this.hudDetailTabs.push({ tab, bg, label });
      children.push(bg, label);
    });

    const contentTop = y + HUD_DETAIL_CONTENT_TOP;
    // The six stats in two columns of three; the HP row prints current / max.
    const colW = innerW / HUD_DETAIL_STAT_COLS;
    const rows: {
      stat: StatId;
      label: Phaser.GameObjects.BitmapText;
      value: Phaser.GameObjects.BitmapText;
    }[] = [];
    HUD_DETAIL_STATS.forEach((column, ci) => {
      const colLeft = left + ci * colW;
      const colRight = colLeft + colW - 12;
      column.forEach((stat, ri) => {
        const rowY = contentTop + ri * HUD_DETAIL_STAT_ROW;
        const label = addFrlgText(this, colLeft, rowY, statLabel(stat), { size: 16, tint: FRLG_MUTED });
        const value = addFrlgText(this, colRight, rowY, '', {
          size: 16,
          tint: FRLG_INK,
          origin: [1, 0],
        });
        children.push(label, value);
        rows.push({ stat, label, value });
      });
    });
    const infoTop = contentTop + HUD_DETAIL_STAT_ROWS * HUD_DETAIL_STAT_ROW + 8;
    // NATURE / ABILITY in the left column, HELD / CAUGHT in the right.
    const infoColW = innerW / 2;
    const nature = addFrlgText(this, left, infoTop, '', { size: 16, tint: FRLG_MUTED });
    const ability = addFrlgText(this, left, infoTop + HUD_DETAIL_INFO_ROW, '', {
      size: 16,
      tint: FRLG_MUTED,
    });
    const held = addFrlgText(this, left + infoColW, infoTop, '', { size: 16, tint: FRLG_MUTED });
    const caught = addFrlgText(this, left + infoColW, infoTop + HUD_DETAIL_INFO_ROW, '', {
      size: 16,
      tint: FRLG_MUTED,
    });
    children.push(nature, ability, held, caught);
    this.hudDetailStats = { rows, nature, ability, held, caught };

    // The evolution band: a title over a family graph. The nodes are a fixed row
    // pool the refresh repositions by depth; `refreshDetail` also redraws the
    // edges. A click on a ready branch evolves the member.
    this.hudDetailEvoTitle = addFrlgText(
      this,
      left,
      y + HUD_DETAIL_EVO_TITLE_TOP,
      t('detail.evolution'),
      {
        size: 16,
        tint: FRLG_INK,
      },
    );
    this.hudDetailEvoHint = addFrlgText(
      this,
      right,
      y + HUD_DETAIL_EVO_TITLE_TOP,
      t('detail.clickToEvolve'),
      {
        size: 16,
        tint: HUD_DETAIL_EVO_READY,
        origin: [1, 0],
      },
    ).setVisible(false);
    this.hudDetailEvoEmpty = addFrlgText(
      this,
      x + detailW / 2,
      y + HUD_DETAIL_EVO_TOP + 24,
      t('detail.noEvolution'),
      { size: 16, tint: FRLG_MUTED, origin: [0.5, 0] },
    );
    children.push(this.hudDetailEvoTitle, this.hudDetailEvoHint, this.hudDetailEvoEmpty);
    this.hudDetailEvoGraphics = this.add.graphics();
    children.push(this.hudDetailEvoGraphics);
    this.hudDetailEvoCells = [];
    for (let i = 0; i < HUD_DETAIL_EVO_MAX; i++) {
      const rowY = y + HUD_DETAIL_EVO_TOP + i * HUD_DETAIL_EVO_ROW_H;
      const bg = this.add
        .rectangle(
          left,
          rowY,
          innerW,
          HUD_DETAIL_EVO_ROW_H - 2,
          FRLG_ROW_FILL.colour,
          FRLG_ROW_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setVisible(false);
      const portrait = this.add
        .image(left + 13, rowY + HUD_DETAIL_EVO_ROW_H / 2, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(HUD_DETAIL_EVO_PORTRAIT_SCALE)
        .setVisible(false);
      const name = addFrlgText(this, left + 30, rowY + 6, '', { size: 16, tint: FRLG_INK })
        .setMaxWidth(innerW - 96)
        .setVisible(false);
      const level = addFrlgText(this, right, rowY + 6, '', {
        size: 16,
        tint: FRLG_MUTED,
        origin: [1, 0],
      }).setVisible(false);
      this.hudDetailEvoCells.push({
        node: null,
        rect: { x: left, y: rowY, w: innerW, h: HUD_DETAIL_EVO_ROW_H - 2 },
        bg,
        portrait,
        name,
        level,
      });
      children.push(bg, portrait, name, level);
    }

    this.hudDetailEmpty = addFrlgText(this, x + detailW / 2, contentTop + 60, t('detail.noMoves'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [0.5, 0],
    });
    children.push(this.hudDetailEmpty);

    // The learnset band: a search field over the pool of learned moves and bag
    // TMs, scrolled one row of the 2x2 grid at a time. Its grid shares the moves
    // grid's look; the `<` / `>` pair rides the search row as a one-row scroll.
    this.hudSearchBg = this.add
      .rectangle(0, 0, 10, HUD_DETAIL_SEARCH_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
      .setVisible(false);
    this.hudSearchText = addFrlgText(this, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false);
    this.hudLearnPrev = addFrlgText(this, 0, 0, '<', {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0],
    }).setVisible(false);
    this.hudLearnNext = addFrlgText(this, 0, 0, '>', {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0],
    }).setVisible(false);
    this.hudLearnEmpty = addFrlgText(this, 0, 0, t('detail.noMovesToLearn'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [0.5, 0],
    }).setVisible(false);
    children.push(
      this.hudSearchBg,
      this.hudSearchText,
      this.hudLearnPrev,
      this.hudLearnNext,
      this.hudLearnEmpty,
    );

    const container = this.add.container(0, 0, children).setVisible(false);
    // The shared moves grid — the same component the battle's FIGHT menu draws —
    // fills the MOVES tab, with its own floating info popup. The learnset pool is
    // a second instance drawn below the search field.
    this.hudMoveGrid = new MoveGrid(this, container);
    this.hudLearnGrid = new MoveGrid(this, container);
    // The ability row's ⓘ and the window it floats, built after the grids so the
    // window rides over them like the move popup does.
    this.hudAbilityPopup = new InfoPopup(this, container);
    this.hudAbilityInfoButton = new AbilityInfoButton(this, this.hudAbilityPopup, container);
    return container;
  }

  private refreshHud(): void {
    if (!this.hudRoot) return;
    const biomeName = this.route ? getBiome(this.route.biomeId).name : '';
    this.hudTitle.setText(t('route.mapTitle', { map: this.run.mapIndex, biome: biomeName }));
    this.refreshMapView();

    // The shared bar: the level everyone sits at and the progress to the next.
    const level = squadLevel(this.run);
    this.hudLevelText.setText(t('hud.level', { level }));
    this.hudXpFill.setSize(this.hud.xpBarW * experienceFraction(this.run.xp, level), HUD_XP_BAR_H);
    this.hudXpText.setText(t('hud.xp', { xp: this.run.xp }));

    this.hudRows.forEach((row, i) => {
      const member = this.run.party[i];
      const visible = member !== undefined;
      const alive = member !== undefined && member.fighter.hp > 0;
      row.highlight.setVisible(this.hudUi.grabbed?.pane === 'party' && this.hudUi.index === i);
      row.name.setVisible(visible);
      row.bar.setVisible(alive);
      row.fill.setVisible(alive);
      if (!member) {
        row.portrait.setVisible(false);
        row.held.setVisible(false);
        row.status.setVisible(false);
        row.name.setText('');
        return;
      }
      const portrait = member ? portraitFor(member.fighter.speciesId, member.fighter.shiny) : null;
      row.portrait.setVisible(portrait !== null);
      if (portrait) row.portrait.setTexture(portrait.key, portrait.frame);
      const statusFrame = member.fighter.status ? statusIconFrame(member.fighter.status) : null;
      row.status.setVisible(statusFrame !== null);
      if (statusFrame !== null) row.status.setFrame(statusFrame);
      const heldFrame = member.fighter.heldItem ? itemIconFrame(member.fighter.heldItem) : null;
      const inHand = this.hudDragItemFrom === member.fighter.id;
      row.held.setVisible(heldFrame !== null && !inHand);
      if (heldFrame !== null) row.held.setFrame(heldFrame);
      const maxHp = restoreFighter(member.fighter).maxHp;
      const hp = member.fighter.hp;
      row.name.setText(
        member.fighter.nickname ??
          getSpecies(member.fighter.speciesId)?.name ??
          member.fighter.speciesId,
      );
      row.name.setMaxWidth(
        this.hudX +
          this.hud.partyW -
          HUD_PAD_X -
          row.name.x -
          (statusFrame !== null ? STATUS_ICON_W * HUD_PARTY_STATUS_SCALE + HUD_PARTY_STATUS_GAP : 0),
      );
      const fraction = hpFraction(hp, maxHp);
      const barScale = row.bar.scaleX;
      row.fill
        .setPosition(row.bar.x + FRLG_HPBAR.fill.x * barScale, row.bar.y + FRLG_HPBAR.fill.y * barScale)
        .setSize(
          Math.max(0, FRLG_HPBAR.fill.width * barScale * fraction),
          FRLG_HPBAR.fill.height * barScale,
        )
        .setFillStyle(hpColorInt(fraction));
    });

    // The party's lead walks behind the player: a lead change loads its pair once
    // and rebuilds the follower, so nothing here runs per frame.
    this.refreshFollower();

    // The Pokevial bar: its fill grows with the charges and takes the shade of
    // the charge it is at, so the meter reads as filling up.
    const charges = this.run.pokevialCharges;
    this.hudVialFill
      .setSize((HUD_VIAL_W * charges) / POKEVIAL_MAX_CHARGES, HUD_VIAL_H)
      .setFillStyle(HUD_VIAL_FILL_COLORS[charges - 1] ?? HUD_VIAL_FILL_COLORS[0]);

    // An item taken from the bag is not in the bag while it is being dragged.
    const bag = this.hudBagStacks();
    this.hudBagTabs.forEach((tab) => {
      const active = tab.category === this.hudBagCategory;
      this.paintTab(tab.bg, active);
      tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
    });
    this.hudBagEmpty.setVisible(bag.length === 0);
    this.hudMoneyText.setText(String(this.run.money));
    this.hudBagRows.forEach((row, i) => {
      const stack = bag[i];
      const frame = stack ? itemIconFrame(stack.itemId) : null;
      const visible = stack !== undefined && frame !== null;
      row.icon.setVisible(visible);
      row.name.setVisible(visible);
      row.count.setVisible(visible);
      if (!stack || frame === null) {
        row.name.setText('');
        row.count.setText('');
        return;
      }
      row.icon.setFrame(frame);
      row.name.setText(getItem(stack.itemId)?.name ?? stack.itemId);
      row.count.setText(`x${stack.count}`);
    });

    const pane: 'box' | 'rip' = this.hudUi.pane === 'rip' ? 'rip' : 'box';
    const rows = pane === 'rip' ? ripRows(this.run) : boxRows(this.run);
    const pageCount = boxPageCount(rows.length);
    if (this.hudBoxPage >= pageCount) this.hudBoxPage = pageCount - 1;
    this.hudBoxTabs.forEach((tab, i) => {
      const visible = i < pageCount;
      tab.bg.setVisible(visible);
      tab.label.setVisible(visible);
      const active = i === this.hudBoxPage;
      this.paintTab(tab.bg, active);
      tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
    });
    const ripActive = this.hudUi.pane === 'rip';
    this.paintTab(this.hudBoxRip.bg, ripActive);
    this.hudBoxRip.label.setTint(ripActive ? FRLG_ACCENT : FRLG_INK);
    this.hudBoxCells.forEach((cell, i) => {
      const index = boxCellIndex(this.hudBoxPage, i % BOX_COLS, Math.floor(i / BOX_COLS));
      const member = rows[index];
      const portrait = member ? portraitFor(member.speciesId, member.shiny) : null;
      cell.portrait.setVisible(portrait !== null);
      if (portrait) cell.portrait.setTexture(portrait.key, portrait.frame);
      const heldFrame = pane === 'box' && member?.heldItem ? itemIconFrame(member.heldItem) : null;
      const inHand = pane === 'box' && member !== undefined && this.hudDragItemFrom === member.id;
      cell.held.setVisible(heldFrame !== null && !inHand);
      if (heldFrame !== null) cell.held.setFrame(heldFrame);
      const statusFrame = pane === 'box' && member?.status ? statusIconFrame(member.status) : null;
      cell.status.setVisible(statusFrame !== null);
      if (statusFrame !== null) cell.status.setFrame(statusFrame);
      // The dead wear the lock veil on every filled cell; a locked box cell keeps
      // the shipped rule.
      cell.lock.setVisible(
        pane === 'rip'
          ? member !== undefined
          : member !== undefined && !pcMemberEditable(this.run, member.id),
      );
      cell.highlight.setVisible(this.hudUi.grabbed?.pane === pane && this.hudUi.index === index);
    });

    this.refreshDetail();

    // The floor's own objective: one line under the notice strip, and nothing at
    // all when the run carries no mission row (an old save's `null`).
    const mission = this.run.mission ? getMission(this.run.mission.id) : undefined;
    this.missionRoot?.setVisible(mission !== undefined);
    if (mission) this.hudMissionText?.setText(t('hud.mission', { mission: t(mission.nameKey) }));
  }

  /** Paints a tab's own fill and 1px outline: the accent pair when it is active. */
  private paintTab(bg: Phaser.GameObjects.Rectangle, active: boolean): void {
    const fill = active ? FRLG_SELECTED_FILL : FRLG_ROW_FILL;
    const stroke = active ? FRLG_SELECTED_STROKE : FRLG_ROW_STROKE;
    bg.setFillStyle(fill.colour, fill.alpha).setStrokeStyle(1, stroke.colour, stroke.alpha);
  }

  /**
   * Redraws the floor minimap from the plan and the run's discovery (`docs/maps-
   * spec.md` §8, D32): the discovered rooms sized from their plan width/height,
   * their openings on the matching walls, the links between two known neighbours
   * and the boss/portal/special markers. Only the drawing happens here; every
   * position and reveal rule comes from the pure `buildMapView`.
   */
  private refreshMapView(): void {
    if (!this.hudMapGraphics) return;
    const graphics = this.hudMapGraphics;
    graphics.clear();
    const plan = this.plan;
    if (!plan) {
      this.hudMapEmpty.setVisible(true);
      return;
    }
    const view = buildMapView(plan, {
      discovered: this.run.discoveredRooms,
      currentRoom: this.run.routeInMap,
      portalOpen: this.portalOpen(),
      captureSpent: this.run.capturedRooms,
      markers: plan.specials.reduce<Record<number, MapRoomMarker>>((all, special) => {
        all[special.roomId] = special.kind;
        return all;
      }, {}),
    });
    this.hudMapEmpty.setVisible(!view.visible);
    if (!view.visible) return;

    const areaX = HUD_MAP_X + HUD_PAD_X;
    const areaY = HUD_MAP_Y + HUD_MAP_TITLE_H;
    const areaW = this.hud.mapW - HUD_PAD_X * 2;
    const areaH = HUD_MAP_H - HUD_MAP_TITLE_H - HUD_PAD_BOTTOM;
    const scale = Math.min(areaW / view.width, areaH / view.height);
    const offsetX = areaX + (areaW - view.width * scale) / 2;
    const offsetY = areaY + (areaH - view.height * scale) / 2;
    const px = (value: number): number => offsetX + value * scale;
    const py = (value: number): number => offsetY + value * scale;

    // Links first, so the room cells paint over the corridor seams.
    graphics.lineStyle(3, FRLG_MUTED, 1);
    for (const link of view.links) {
      graphics.lineBetween(px(link.x1), py(link.y1), px(link.x2), py(link.y2));
    }

    for (const room of view.rooms) {
      const rx = px(room.x);
      const ry = py(room.y);
      const rw = room.w * scale;
      const rh = room.h * scale;
      graphics.fillStyle(
        room.current ? HUD_MAP_CURRENT_FILL : FRLG_ROW_FILL.colour,
        room.current ? 1 : FRLG_ROW_FILL.alpha,
      );
      graphics.fillRect(rx, ry, rw, rh);
      graphics.lineStyle(
        2,
        room.current ? HUD_MAP_CURRENT_STROKE : FRLG_ROW_STROKE.colour,
        room.current ? 1 : FRLG_ROW_STROKE.alpha,
      );
      graphics.strokeRect(rx, ry, rw, rh);

      const gap = Math.max(2.5, Math.min(rw, rh) * 0.18);
      for (const opening of room.openings) {
        const ox = px(opening.x);
        const oy = py(opening.y);
        graphics.lineStyle(
          4,
          opening.kind === 'portal' ? 0x3fa9f5 : opening.kind === 'entry' ? 0x4ad15c : FRLG_MUTED,
          1,
        );
        if (opening.edge === 'N' || opening.edge === 'S') {
          graphics.lineBetween(ox - gap, oy, ox + gap, oy);
        } else {
          graphics.lineBetween(ox, oy - gap, ox, oy + gap);
        }
      }

      this.drawMapMarker(graphics, room, rx + rw / 2, ry + rh / 2, Math.min(rw, rh));
    }
  }

  /** One room's minimap icon: a special marker, the boss, and the open portal ring. */
  private drawMapMarker(
    graphics: Phaser.GameObjects.Graphics,
    room: MapViewRoom,
    cx: number,
    cy: number,
    size: number,
  ): void {
    const radius = Math.max(3, size * 0.18);
    if (room.marker) {
      // The room's own descriptor draws its glyph (`D47`).
      this.roomRegistry.byMarker.get(room.marker)?.drawMarker?.(graphics, cx, cy, radius);
    } else if (room.boss) {
      graphics.fillStyle(0xb0304a, 1);
      graphics.fillCircle(cx, cy, radius);
      graphics.fillStyle(FRLG_INK, 1);
      graphics.fillCircle(cx - radius * 0.4, cy - radius * 0.15, radius * 0.22);
      graphics.fillCircle(cx + radius * 0.4, cy - radius * 0.15, radius * 0.22);
    } else if (room.captureSpent) {
      // A room whose single capture has been spent reads as a Poké Ball.
      this.drawCaptureBall(graphics, cx, cy, radius);
    }
    if (room.portal) {
      graphics.lineStyle(2, 0x3fa9f5, 1);
      graphics.strokeCircle(cx, cy, radius * 1.4);
    }
  }

  /** A small Poké Ball glyph on a minimap room whose capture has been spent. */
  private drawCaptureBall(
    graphics: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
  ): void {
    graphics.fillStyle(FRLG_INK, 1);
    graphics.fillCircle(cx, cy, radius);
    graphics.fillStyle(0xe2554e, 1);
    graphics.beginPath();
    graphics.arc(cx, cy, radius, Math.PI, Math.PI * 2, false);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(1.5, FRLG_INK, 1);
    graphics.strokeCircle(cx, cy, radius + 1);
    graphics.lineStyle(1.5, FRLG_BADGE_INK, 1);
    graphics.strokeCircle(cx, cy, radius);
    graphics.lineBetween(cx - radius, cy, cx + radius, cy);
    graphics.fillStyle(FRLG_BADGE_INK, 1);
    graphics.fillCircle(cx, cy, radius * 0.36);
    graphics.fillStyle(FRLG_INK, 1);
    graphics.fillCircle(cx, cy, radius * 0.2);
  }

  /**
   * Fills the detail panel from the run and shows the active tab, or hides it
   * when no member is open (or the member has left the run).
   */
  private refreshDetail(): void {
    if (!this.hudDetail) return;
    const panel = this.panelById('detail');
    const memberId = this.hudDetailState.memberId;
    const detail = memberId === null ? null : memberDetail(this.run, memberId);
    if (!detail) {
      // The member left the run: the panel hides and the field gives up its buffer.
      this.hudNicknameFocus = false;
      this.hudNicknameEdit = null;
      this.hudDetailState = CLOSED_DETAIL;
      if (panel) panel.container.setVisible(false);
      this.refreshNicknameField(null);
      return;
    }
    const dead = this.deadDetail();
    // The panel decides whether it is on screen; the body follows its state.
    this.hudDetail.setVisible(panel?.expanded ?? true);
    if (panel) panel.container.setVisible(true);
    this.hudDetailName.setText(detail.name);
    this.hudDetailLevel.setText(t('common.level', { level: detail.level }));
    const detailStatus = detail.status ? statusIconFrame(detail.status) : null;
    this.hudDetailStatus.setVisible(detailStatus !== null);
    if (detailStatus !== null) {
      this.hudDetailStatus
        .setFrame(detailStatus)
        .setPosition(this.hudDetailName.x + this.hudDetailName.width + 6, this.hudDetailName.y + 1);
    }
    this.hudDetailTypes.forEach((chip, i) => {
      const type = detail.types[i];
      chip.bg.setVisible(type !== undefined);
      chip.label.setVisible(type !== undefined);
      if (type === undefined) {
        chip.label.setText('');
        return;
      }
      const colour = typeColor(type);
      chip.bg.setFillStyle(colour);
      chip.label.setTint(badgeInkFor(colour));
      chip.label.setText(type.toUpperCase());
    });
    this.hudDetailTabs.forEach((tab) => {
      const active = tab.tab === this.hudDetailState.tab;
      this.paintTab(tab.bg, active);
      tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
    });

    const stats = this.hudDetailState.tab === 'stats';
    const { rows, nature, ability, held, caught } = this.hudDetailStats;
    rows.forEach((row) => {
      row.label.setVisible(stats);
      row.value.setVisible(stats);
      row.value.setText(
        row.stat === 'hp' ? `${detail.hp}/${detail.maxHp}` : String(detail.stats[row.stat]),
      );
      // Paint the stat a nature raises green and the one it lowers red; HP and a
      // neutral stat keep the normal ink.
      const effect = natureEffect(detail.nature, row.stat);
      const tint = effect === 'up' ? NATURE_UP_TINT : effect === 'down' ? NATURE_DOWN_TINT : FRLG_INK;
      row.value.setTint(tint);
      if (effect !== 'neutral') row.label.setTint(tint);
    });
    nature.setText(t('detail.nature', { nature: capitalize(detail.nature) }));
    ability.setText(t('detail.ability', { ability: detail.ability }));
    held.setText(t('detail.held', { held: detail.heldItemName ?? t('detail.none') }));
    caught.setText(t('detail.caughtLabel', { caught: detail.caughtLabel ?? t('detail.starter') }));
    nature.setVisible(stats);
    ability.setVisible(stats);
    held.setVisible(stats);
    caught.setVisible(stats);
    // The ABILITY row carries the same ⓘ a move cell does: the STATS tab shows it
    // and the window floats the ability's own text.
    if (stats && detail.abilityDesc !== null) {
      this.hudAbilityInfoButton.layout(
        abilityInfoSpot(ability.x + ability.width, ability.y),
        this.hudAbilityInfo,
        abilityInfoContent(detail.ability, detail.abilityDesc),
      );
    } else {
      this.hudAbilityInfoButton.hide();
    }
    this.refreshDetailEvolutions(stats && !dead, detail);

    const moves = this.hudDetailState.tab === 'moves';
    this.hudDetailEmpty.setVisible(moves && detail.moves.length === 0);
    // The MOVES tab is the shared battle move grid, drawn inside the panel's
    // container so it rides the panel when it is dragged. The info popup floats
    // over the grid for the hovered / pinned move.
    const gridTop = this.hudDetailY + HUD_DETAIL_CONTENT_TOP - HUD_PAD_TOP;
    const moveCells: MoveGridCell[] = moves
      ? detail.moves.map((move) => ({
          name: move.name,
          type: move.type,
          category: move.category,
          pp: move.pp,
          maxPp: move.maxPp,
          desc: move.desc,
          power: move.power,
          basePower: move.basePower,
          accuracy: move.accuracy,
          baseAccuracy: move.baseAccuracy,
          status: move.status,
          enabled: true,
        }))
      : [];
    this.hudMoveGrid.layout({
      x: this.hudDetailX,
      y: gridTop,
      w: this.hud.detailW,
      h: HUD_DETAIL_MOVE_GRID_H,
      cells: moves ? padMoveGridCells(moveCells, detail.moves.length === 0 ? 0 : MAX_MOVES) : [],
      selected: moves ? this.detailSlotCursor() : -1,
      info: moves && this.hudDetailInfo?.grid === 'moves' ? this.hudDetailInfo.index : null,
      popupAtCell: true,
    });

    this.refreshLearnset(detail.ability, moves && !dead);
    this.refreshNicknameField(detail, !dead);
  }

  /**
   * Lays the STATS tab's nickname field out for the open member and fills it from
   * the edit buffer: the box under the name text, the name row's own text (with a
   * `>` mark while it is being edited, like the learnset search field) and the
   * `click to name` hint at the box's right end. Drawing never ends an edit: the
   * buffer and the focus flag are read here, never written.
   */
  private refreshNicknameField(detail: MemberDetail | null, editable = true): void {
    const x = this.hudDetailX + HUD_CONTENT_LEFT - 4;
    this.hudNicknameRect = {
      x,
      y: this.hudDetailY + HUD_NICKNAME_FIELD_TOP,
      w: Math.max(
        HUD_NICKNAME_MIN_W,
        this.hudDetailX + this.hud.detailW - this.hud.detailPadX - HUD_NICKNAME_LEVEL_W - x,
      ),
      h: HUD_NICKNAME_FIELD_H,
    };
    const show = this.hudDetailState.tab === 'stats' && detail !== null && editable;
    this.hudNicknameBg
      .setPosition(this.hudNicknameRect.x, this.hudNicknameRect.y)
      .setSize(this.hudNicknameRect.w, this.hudNicknameRect.h)
      .setVisible(show);
    this.hudDetailName
      .setText(this.hudNicknameFocus ? `>${this.hudNicknameEdit ?? ''}` : (detail?.name ?? ''))
      .setMaxWidth(this.hudNicknameRect.w - 4);
    this.hudDetailNameHint
      .setPosition(this.hudNicknameRect.x + this.hudNicknameRect.w - 6, this.hudNicknameRect.y + 3)
      .setVisible(show && !this.hudNicknameFocus);
  }

  /** True when the pointer is on the nickname field's rectangle (STATS tab only). */
  private nicknameRowAt(pointer: Phaser.Input.Pointer): boolean {
    if (this.hudDetailState.tab !== 'stats') return false;
    if (this.deadDetail()) return false;
    return pointInRect(this.panelPoint(pointer, 'detail'), this.hudNicknameRect);
  }

  /** Focuses the nickname field and seeds it with the name the row shows. */
  private beginNicknameEdit(): void {
    const memberId = this.hudDetailState.memberId;
    if (memberId === null) return;
    if (this.deadDetail()) return;
    const detail = memberDetail(this.run, memberId);
    if (!detail) return;
    this.unpinAbilityInfo();
    this.hudNicknameEdit = detail.nickname ?? detail.name;
    this.hudNicknameFocus = true;
    this.hudSearchFocus = false;
    this.refreshDetail();
  }

  /**
   * Enter: the pure `normalizeNickname` decides the stored text and `renameMember`
   * the run, so the scene never re-implements the rule. The save follows only when
   * the run object actually changed.
   */
  private commitNicknameEdit(): void {
    const memberId = this.hudDetailState.memberId;
    const text = this.hudNicknameEdit;
    this.hudNicknameFocus = false;
    this.hudNicknameEdit = null;
    if (memberId !== null && text !== null) {
      const next = renameMember(this.run, memberId, normalizeNickname(text));
      if (next !== this.run) {
        this.run = next;
        this.persistRun();
      }
    }
    this.refreshDetail();
    this.refreshHud();
  }

  /** Escape, a press elsewhere, a tab switch, closing the panel, a battle: no write. */
  private cancelNicknameEdit(): void {
    if (!this.hudNicknameFocus && this.hudNicknameEdit === null) return;
    this.hudNicknameFocus = false;
    this.hudNicknameEdit = null;
    this.refreshDetail();
  }

  /**
   * The nickname field's key router: it consumes **every** key while the field is
   * focused, so nothing typed reaches the game underneath. Characters and
   * Backspace work in code points, Enter commits and Escape cancels.
   */
  private typeInNickname(event: KeyboardEvent): boolean {
    if (!this.hudNicknameFocus) return false;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitNicknameEdit();
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelNicknameEdit();
      return true;
    }
    if (event.key === 'Backspace') {
      this.hudNicknameEdit = [...(this.hudNicknameEdit ?? '')].slice(0, -1).join('');
    } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
      const points = [...(this.hudNicknameEdit ?? ''), event.key];
      if (points.length <= NICKNAME_MAX_LENGTH) this.hudNicknameEdit = points.join('');
    }
    event.preventDefault();
    this.refreshDetail();
    return true;
  }

  /** True while *either* in-panel text field owns the keyboard. */
  private textFieldFocused(): boolean {
    return this.hudNicknameFocus || this.hudSearchFocus;
  }

  /**
   * Paints the STATS tab's evolution graph from the member's family: the base
   * form down to every branch, indented by stage, with each edge's level. The
   * current species reads gold and a ready branch green and clickable; a branch
   * whose level is unmet stays grey until it is.
   */
  private refreshDetailEvolutions(stats: boolean, detail: MemberDetail): void {
    const graphics = this.hudDetailEvoGraphics;
    this.hudDetailEvoTitle.setVisible(stats);
    graphics.clear();
    const nodes = stats ? detail.evolutions.slice(0, HUD_DETAIL_EVO_MAX) : [];
    const show = stats && nodes.length > 0;
    this.hudDetailEvoEmpty.setVisible(stats && nodes.length === 0);
    this.hudDetailEvoHint.setVisible(stats && nodes.some((node) => node.ready));
    graphics.setVisible(show);

    const left = this.hudDetailX + this.hud.detailPadX;
    const right = this.hudDetailX + this.hud.detailW - this.hud.detailPadX;
    const top = this.hudDetailY + HUD_DETAIL_EVO_TOP;
    const rowY = (row: number): number => top + row * HUD_DETAIL_EVO_ROW_H;

    // Edges first, so the nodes' backgrounds paint over the seams.
    if (show) {
      graphics.lineStyle(2, HUD_DETAIL_EVO_LINE, 1);
      nodes.forEach((node) => {
        if (node.parent === null) return;
        const parent = nodes[node.parent];
        if (!parent) return;
        const spineX = left + parent.depth * HUD_DETAIL_EVO_INDENT + 13;
        const parentY = rowY(parent.row) + HUD_DETAIL_EVO_ROW_H / 2;
        const childY = rowY(node.row) + HUD_DETAIL_EVO_ROW_H / 2;
        const childX = left + node.depth * HUD_DETAIL_EVO_INDENT - 2;
        graphics.lineBetween(spineX, parentY, spineX, childY);
        graphics.lineBetween(spineX, childY, childX, childY);
      });
    }

    this.hudDetailEvoCells.forEach((cell, i) => {
      const node = nodes[i] ?? null;
      cell.node = node;
      cell.bg
        .setVisible(false)
        .setFillStyle(FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
      const visible = show && node !== null;
      cell.name.setVisible(visible);
      cell.level.setVisible(visible);
      cell.portrait.setVisible(visible);
      if (!node) return;
      const nodeX = left + node.depth * HUD_DETAIL_EVO_INDENT;
      const y = rowY(node.row);
      const width = right - nodeX;
      cell.rect = { x: nodeX, y, w: width, h: HUD_DETAIL_EVO_ROW_H - 2 };
      cell.bg.setPosition(nodeX, y).setSize(width, cell.rect.h);
      cell.portrait.setPosition(nodeX + 13, y + HUD_DETAIL_EVO_ROW_H / 2);
      const portrait = portraitFor(node.id);
      cell.portrait.setVisible(visible && portrait !== null);
      if (portrait) cell.portrait.setTexture(portrait.key, portrait.frame);
      cell.name.setPosition(nodeX + 30, y + 6).setText(node.name);
      cell.level.setText(node.level === null ? '' : t('detail.evoLevel', { level: node.level }));

      if (node.ready) {
        cell.bg.setVisible(true).setFillStyle(FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha);
        cell.name.setTint(HUD_DETAIL_EVO_READY);
        cell.level.setTint(HUD_DETAIL_EVO_READY);
      } else if (node.current) {
        cell.bg
          .setVisible(true)
          .setFillStyle(FRLG_SELECTED_FILL.colour, FRLG_SELECTED_FILL.alpha)
          .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha);
        cell.name.setTint(HUD_DETAIL_EVO_CURRENT);
        cell.level.setTint(HUD_DETAIL_EVO_CURRENT);
      } else {
        cell.name.setTint(FRLG_INK);
        cell.level.setTint(FRLG_MUTED);
      }
    });
  }

  /** The party/box member the open detail panel shows, or undefined. */
  private detailMember(): RunPokemon | undefined {
    const memberId = this.hudDetailState.memberId;
    if (memberId === null) return undefined;
    return (
      this.run.party.find((entry) => entry.fighter.id === memberId) ??
      this.run.box.find((entry) => entry.fighter.id === memberId) ??
      this.run.rip.find((entry) => entry.fighter.id === memberId)
    );
  }

  /** True while the open detail panel is showing a member of `run.rip`. */
  private deadDetail(): boolean {
    const memberId = this.hudDetailState.memberId;
    return memberId !== null && this.run.rip.some((member) => member.fighter.id === memberId);
  }

  /** The filtered learnset pool for the open member, in draw order. */
  private learnPool(): LearnEntry[] {
    const member = this.detailMember();
    if (!member) return [];
    const pool = learnsetPool(this.run, member, this.run.seed);
    const query = this.hudLearnQuery.trim().toLowerCase();
    if (query.length === 0) return pool;
    return pool.filter((entry) => {
      const move = getMove(entry.moveId);
      return (
        entry.moveId.includes(query) ||
        moveName(entry.moveId).toLowerCase().includes(query) ||
        (move?.type ?? '').toLowerCase().includes(query)
      );
    });
  }

  /** One learnset cell: the move's reading plus a Lv/Tutor/TM source tag in its name. */
  private learnCell(
    entry: LearnEntry,
    ability: string,
    ivs: Partial<Stats> | null | undefined,
  ): MoveGridCell {
    const move = getMove(entry.moveId);
    const basePower = move?.basePower ?? 0;
    const accuracy = move && move.accuracy !== true ? move.accuracy : null;
    const tag =
      entry.source === 'tm'
        ? t('detail.learnTm', { tm: tmNumber(entry.tmId ?? '') ?? '?' })
        : entry.source === 'tutor'
          ? t('detail.learnTutor')
          : t('detail.learnLevel', { level: entry.level ?? '?' });
    return {
      name: `${moveName(entry.moveId)}  ${tag}`,
      type: move ? abilityMoveType(ability, move, ivs) : '',
      category: move?.category ?? 'Status',
      pp: move?.pp ?? 0,
      maxPp: move?.pp ?? 0,
      desc: moveShortDescription(entry.moveId),
      power: basePower,
      basePower,
      accuracy,
      baseAccuracy: accuracy,
      status: move?.status ?? null,
      enabled: true,
    };
  }

  /** Draws the search field and the scrolled learnset pool under the moves grid. */
  private refreshLearnset(ability: string, moves: boolean): void {
    const pad = FRLG_WINDOW_PADDING;
    const gridTop = this.hudDetailY + HUD_DETAIL_CONTENT_TOP - HUD_PAD_TOP;
    const searchX = this.hudDetailX + pad.x;
    const searchY = gridTop + HUD_DETAIL_MOVE_GRID_H + HUD_DETAIL_LEARN_GAP;
    const searchW = this.hud.detailW - pad.x * 2;
    this.hudSearchRect = { x: searchX, y: searchY, w: searchW, h: HUD_DETAIL_SEARCH_H };
    this.hudSearchBg
      .setPosition(searchX, searchY)
      .setSize(searchW, HUD_DETAIL_SEARCH_H)
      .setVisible(moves);
    const placeholder =
      this.hudSearchFocus || this.hudLearnQuery.length > 0
        ? this.hudLearnQuery
        : t('detail.searchMoves');
    this.hudSearchText
      .setText(`${this.hudSearchFocus ? '>' : ' '} ${placeholder}`)
      .setTint(this.hudLearnQuery.length === 0 && !this.hudSearchFocus ? FRLG_MUTED : FRLG_INK)
      .setPosition(searchX + 6, searchY + 4)
      .setMaxWidth(searchW - 78)
      .setVisible(moves);

    const pool = moves ? this.learnPool() : [];
    const memberIvs = this.detailMember()?.fighter.ivs;
    const maxTop = maxScrollTop(pool.length, HUD_DETAIL_LEARN_COLS, HUD_DETAIL_LEARN_ROWS);
    this.hudLearnScrollTop = clampScrollTop(this.hudLearnScrollTop, maxTop);
    const { start, end } = visibleRange(
      this.hudLearnScrollTop,
      HUD_DETAIL_LEARN_COLS,
      HUD_DETAIL_LEARN_ROWS,
      pool.length,
    );
    this.hudLearnWindow = pool.slice(start, end);
    const learnTop = searchY + HUD_DETAIL_SEARCH_H + HUD_DETAIL_LEARN_GAP;
    const learnH = this.hudDetailY + HUD_DETAIL_H - learnTop;
    this.hudLearnRect = moves
      ? { x: this.hudDetailX, y: learnTop, w: this.hud.detailW, h: learnH }
      : { x: 0, y: 0, w: 0, h: 0 };
    this.hudLearnGrid.layout({
      x: this.hudDetailX,
      y: learnTop,
      w: this.hud.detailW,
      h: learnH,
      cells: this.hudLearnWindow.map((entry) => this.learnCell(entry, ability, memberIvs)),
      selected: moves ? this.learnWindowCursor() : -1,
      info: moves && this.hudDetailInfo?.grid === 'learn' ? this.hudDetailInfo.index : null,
      popupAtCell: true,
    });

    // The pool spans the full window; its scroll arrows ride the search row,
    // right-aligned, so the grid keeps the whole width.
    const navY = searchY + 4;
    const navRight = searchX + searchW - 10;
    const showNav = moves && maxTop > 0;
    this.hudLearnPrev
      .setPosition(navRight - 56, navY)
      .setAlpha(this.hudLearnScrollTop > 0 ? 1 : 0.35)
      .setVisible(showNav);
    this.hudLearnNext
      .setPosition(navRight, navY)
      .setAlpha(this.hudLearnScrollTop < maxTop ? 1 : 0.35)
      .setVisible(showNav);
    this.hudLearnEmpty
      .setPosition(this.hudDetailX + this.hud.detailW / 2, learnTop + Math.max(0, learnH / 2 - 8))
      .setVisible(moves && pool.length === 0);
  }

  /** Steps the PC BOX to another page and redraws. */
  private stepBoxPage(delta: number): void {
    const length = this.hudUi.pane === 'rip' ? this.run.rip.length : this.run.box.length;
    const pageCount = boxPageCount(length);
    this.hudBoxPage = Math.max(0, Math.min(pageCount - 1, this.hudBoxPage + delta));
    this.refreshHud();
  }

  /**
   * Drinks a full Pokevial: rests the whole party and box (clearing status) and
   * empties the meter. A partial or empty vial is a no-op, so a click never
   * changes the run.
   */
  private drinkPokevial(): void {
    const next = usePokevial(this.run);
    if (next === this.run) return;
    this.run = next;
    this.persistRun();
    this.refreshHud();
  }

  /**
   * HUD pointer input. A click on a party row or a box cell opens that member's
   * detail panel (STATS / MOVES); dragging instead picks the member up (gold
   * highlight), reorders it live over the same pane and a release over the other
   * pane moves it between the party and the PC box. A press on an equipment
   * stack picks the item up (it leaves the bag while in hand) and a release over
   * a member equips it; a press on a member's held badge takes that item in hand
   * instead of the Pokémon, to pass it to another member or drop it on the bag
   * to unequip it. A press inside the open detail panel drives its tabs and the
   * draggable move list; a press anywhere else closes it.
   */
  private handleHudPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive()) return;
    // A room row's own press starts its drag; nothing under it sees the press.
    if (this.roomRowDrag) return;
    // A modal room panel's own zones own the pointer while it is up.
    if (this.modalPanelOpen()) return;
    // The level-up popup is modal: a click just dismisses it.
    if (this.learnPopupOpen) {
      this.closeLearnPopup();
      return;
    }
    // The collapse icon sits in the frame band, so it is tested before the drag.
    // A press on it waits: a release without movement toggles the panel, a move
    // past the slop drags the panel from the icon (see pointermove).
    const icon = this.hudPanelIconAt(pointer);
    if (icon) {
      this.hudIconPress = { id: icon.id, originX: pointer.x, originY: pointer.y };
      this.input.setDefaultCursor('pointer');
      return;
    }
    // The Pokevial only drinks with a full meter: it rests the party and the box
    // (and clears status), then empties.
    if (this.run.pokevialCharges >= POKEVIAL_MAX_CHARGES && this.vialButtonAt(pointer)) {
      this.drinkPokevial();
      return;
    }
    // Grabbing a panel's frame moves it (raising it over the rest); its inner
    // area stays live for rows, tabs and cells.
    const panel = this.hudPanelAt(pointer);
    if (panel) {
      this.startPanelDrag(panel, pointer);
      return;
    }
    if (this.hudSearchFocus && !this.pointerInDetailPanel(pointer)) {
      this.hudSearchFocus = false;
      this.refreshDetail();
    }
    // A press outside the panel likewise ends an in-progress nickname edit.
    if (this.hudNicknameFocus && !this.pointerInDetailPanel(pointer)) this.cancelNicknameEdit();
    if (this.hudDetailState.memberId !== null && this.pointerInDetailPanel(pointer)) {
      // A control inside the detail panel acts; an empty spot falls through to
      // the panel drag at the end (so the detail window can be moved anywhere).
      if (this.handleDetailPointerDown(pointer)) return;
    }
    if (this.selectBagTab(pointer)) return;
    if (this.selectRipTab(pointer)) return;
    if (this.selectBoxTab(pointer)) return;
    if (!this.hudUi.grabbed) {
      const badge = this.hudHeldBadgeAt(pointer);
      if (badge) {
        this.startHudItemDrag(badge.itemId, pointer, badge.memberId);
        return;
      }
      const itemId = this.hudDraggableStackAt(pointer);
      if (itemId !== null) {
        this.startHudItemDrag(itemId, pointer);
        return;
      }
    }
    const target = this.hudTarget(pointer);
    const grabbed = this.hudUi.grabbed;
    if (!target) {
      if (grabbed) {
        this.dropHudGrab();
        return;
      }
      // Nothing interactive under the pointer: grab the panel's empty interior to
      // move it. The open detail is kept when its own empty space is grabbed, and
      // closed when the press is anywhere else.
      const owner = this.hudPanelOwnerAt(pointer);
      if (owner?.id !== 'detail' && this.hudDetailState.memberId !== null) {
        this.closeMemberDetail();
      }
      if (owner && owner.expanded) {
        this.startPanelDrag(owner, pointer);
        return;
      }
      return;
    }
    if (this.hudDetailState.memberId !== null) this.closeMemberDetail();
    if (grabbed) {
      if (grabbed.pane === target.pane) {
        const next = dragTo(this.run, this.hudUi, target.index);
        this.run = next.run;
        this.hudUi = dropGrabbed(next.ui);
      } else {
        this.dropHudAcross(grabbed, target);
        return;
      }
      this.finishHudGrab();
      return;
    }
    // Defer the grab: a release without movement is a click that opens the detail
    // panel, a move past the slop is a drag that reorders (see pointermove).
    const memberId = this.memberIdAt(target);
    if (memberId === null) return;
    this.hudPress = {
      pane: target.pane,
      index: target.index,
      memberId,
      originX: pointer.x,
      originY: pointer.y,
    };
    this.input.setDefaultCursor('pointer');
  }

  /** Shows the grabbed member's avatar in hand, following the pointer. */
  private showHudGhost(pane: PaneId, index: number, pointer: Phaser.Input.Pointer): void {
    const member = this.paneMembers(pane)[index];
    const portrait = member ? portraitFor(member.fighter.speciesId, member.fighter.shiny) : null;
    if (!portrait) {
      this.hudDragGhost.setVisible(false);
      return;
    }
    this.hudDragGhost
      .setTexture(portrait.key, portrait.frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
  }

  /**
   * Picks an equipment stack up so it can be dropped on a member to equip it: the
   * icon rides the pointer and leaves the bag list while in hand.
   */
  private startHudItemDrag(
    itemId: string,
    pointer: Phaser.Input.Pointer,
    from: string | null = null,
  ): void {
    const frame = itemIconFrame(itemId);
    if (frame === null) return;
    this.hudDragItem = itemId;
    this.hudDragItemFrom = from;
    this.hudGrabMoved = false;
    this.hudDragGhost
      .setTexture(ITEM_ICON_TEXTURE_KEY, frame)
      .setPosition(pointer.x, pointer.y)
      .setVisible(true);
    this.input.setDefaultCursor('grabbing');
    this.refreshHud();
  }

  /**
   * Starts a room row's drag (`D45`): the item icon or the row's own printed label
   * follows the pointer and the scene resolves the drop. A row never buys on press.
   */
  private beginRowDrag(drag: RoomRowDrag): void {
    this.endRowDrag();
    this.roomRowDrag = drag;
    this.ensureRowDragGhost();
    const frame = drag.itemId === null ? null : itemIconFrame(drag.itemId);
    if (frame !== null && this.roomRowGhostIcon) {
      this.roomRowGhostIcon.setFrame(frame).setPosition(drag.pointer.x, drag.pointer.y).setVisible(true);
      this.roomRowGhostLabel?.setVisible(false);
    } else {
      this.roomRowGhostIcon?.setVisible(false);
      this.roomRowGhostLabel
        ?.setPosition(drag.pointer.x, drag.pointer.y)
        .setText(drag.label)
        .setVisible(true);
    }
    this.input.setDefaultCursor('grabbing');
  }

  /** The two ghost objects, built once and reused by every room row drag. */
  private ensureRowDragGhost(): void {
    if (!this.roomRowGhostIcon) {
      this.roomRowGhostIcon = this.add
        .image(0, 0, ITEM_ICON_TEXTURE_KEY, 0)
        .setDepth(ROW_DRAG_DEPTH)
        .setVisible(false);
      this.cameras.main.ignore(this.roomRowGhostIcon);
    }
    if (!this.roomRowGhostLabel) {
      this.roomRowGhostLabel = addFrlgText(this, 0, 0, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0.5],
      })
        .setDepth(ROW_DRAG_DEPTH)
        .setVisible(false);
      this.cameras.main.ignore(this.roomRowGhostLabel);
    }
  }

  /** Puts the ghost away and restores the cursor; says nothing about the drop. */
  private endRowDrag(): void {
    if (!this.roomRowDrag) return;
    this.roomRowDrag = null;
    this.roomRowGhostIcon?.setVisible(false);
    this.roomRowGhostLabel?.setVisible(false);
    this.input.setDefaultCursor('default');
  }

  /** Resolves a released row and calls its `onDrop` exactly once. */
  private dropRowDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.roomRowDrag;
    if (!drag) return;
    const drop = this.roomDropAt(pointer, drag);
    this.endRowDrag();
    drag.onDrop(drop);
  }

  /** The bag, a living party/box member, the party panel for a Pokémon row, or none. */
  private roomDropAt(pointer: Phaser.Input.Pointer, drag: RoomRowDrag): RoomDrop {
    if (this.pointerInBagPanel(pointer)) return { onto: 'bag' };
    const target = this.hudTarget(pointer);
    const memberId = target && target.pane !== 'rip' ? this.memberIdAt(target) : null;
    if (memberId) return { onto: 'member', memberId };
    if (drag.itemId === null && this.pointerInPartyPanel(pointer)) return { onto: 'party' };
    return { onto: 'none' };
  }

  private handleHudPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.scene.isActive()) return;
    // A room row in hand follows the pointer; the release decides its drop.
    if (this.roomRowDrag) {
      if (!pointer.isDown) {
        this.endRowDrag();
        return;
      }
      this.roomRowGhostIcon?.setPosition(pointer.x, pointer.y);
      this.roomRowGhostLabel?.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      return;
    }
    if (this.modalPanelOpen() || this.learnPopupOpen) return;
    // A button released off-screen never fired `pointerup`; let go on the next move.
    if (!pointer.isDown) this.cancelHudDrags();
    // A press on a collapse icon becomes a panel drag once it passes the slop.
    if (this.hudIconPress && !this.hudPanelDrag) {
      const press = this.hudIconPress;
      if (Math.hypot(pointer.x - press.originX, pointer.y - press.originY) > HUD_DRAG_SLOP) {
        const panel = this.panelById(press.id);
        this.hudIconPress = null;
        if (panel) this.startPanelDrag(panel, pointer);
      }
    }
    // A panel drag follows the pointer and overlaps the others freely.
    if (this.hudPanelDrag) {
      this.updatePanelDrag(pointer);
      return;
    }
    if (this.hudLearnScrollDrag) {
      this.updateLearnScrollDrag(pointer);
      return;
    }
    if (this.hudDragItem !== null) {
      this.hudDragGhost.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      return;
    }
    // A learnset move rides the pointer until it is dropped on a slot.
    if (this.hudLearnDrag !== null) {
      this.hudLearnGhost.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      return;
    }
    // A held move reorders live as the pointer crosses another cell; over the
    // learnset band it leaves the grid so the release can unequip it.
    if (this.hudDetailState.grab !== null) {
      const row = this.pointerInLearnBand(pointer) ? null : this.detailMoveIndexAt(pointer);
      if (row !== null) {
        const next = reorderMoves(this.run, this.hudDetailState, row);
        if (next.run !== this.run || next.state !== this.hudDetailState) {
          this.run = next.run;
          this.hudDetailState = next.state;
          this.refreshDetail();
          this.refreshHud();
        }
      }
      this.input.setDefaultCursor('grabbing');
      return;
    }
    // A pending member press turns into a grab once the pointer passes the slop.
    if (this.hudPress && !this.hudUi.grabbed) {
      const press = this.hudPress;
      if (Math.hypot(pointer.x - press.originX, pointer.y - press.originY) <= HUD_DRAG_SLOP) {
        this.input.setDefaultCursor('pointer');
        return;
      }
      const next = grabAt(this.run, this.hudUi, press.pane, press.index);
      this.hudPress = null;
      if (!next.ui.grabbed) {
        this.input.setDefaultCursor('default');
        return;
      }
      this.run = next.run;
      this.hudUi = next.ui;
      this.hudGrabMoved = true;
      this.showHudGhost(press.pane, press.index, pointer);
      this.refreshHud();
    }
    if (this.hudUi.grabbed) {
      this.hudDragGhost.setPosition(pointer.x, pointer.y);
      this.input.setDefaultCursor('grabbing');
      const target = this.hudTarget(pointer);
      if (!target || target.pane !== this.hudUi.grabbed.pane) return;
      const next = dragTo(this.run, this.hudUi, target.index);
      if (next.run === this.run && next.ui === this.hudUi) return;
      this.run = next.run;
      this.hudUi = next.ui;
      this.refreshHud();
      return;
    }
    const overMember = this.hudTarget(pointer) !== null;
    const cell = this.detailInfoAt(pointer) ?? this.detailLearnInfoAt(pointer);
    const overMove = cell !== null;
    const overInfo = cell?.onInfo === true;
    this.updateDetailInfo(cell);
    const overAbilityInfo = this.abilityInfoAt(pointer);
    this.updateAbilityInfo(overAbilityInfo);
    const overItem = this.hudDraggableStackAt(pointer) !== null;
    const overIcon = this.hudPanelIconAt(pointer) !== null;
    // A ready evolution branch in the STATS tab reads as a click target too.
    const overEvolution =
      this.hudDetailState.memberId !== null &&
      this.pointerInDetailPanel(pointer) &&
      this.evolutionAt(this.panelPoint(pointer, 'detail')) !== null;
    // The name row is the rename field, so it reads as a click target as well.
    const overDetailName =
      this.hudDetailState.memberId !== null &&
      this.pointerInDetailPanel(pointer) &&
      this.nicknameRowAt(pointer);
    // The Pokevial only reads as clickable with a full meter; a partial one does
    // nothing on click.
    const overVial = this.run.pokevialCharges >= POKEVIAL_MAX_CHARGES && this.vialButtonAt(pointer);
    const overPanel =
      overMember || overMove || overItem || overEvolution || overVial
        ? false
        : this.hudPanelAt(pointer) !== null;
    this.input.setDefaultCursor(
      overInfo ||
        overAbilityInfo ||
        overMember ||
        overIcon ||
        overEvolution ||
        overDetailName ||
        overVial
        ? 'pointer'
        : overItem || overMove
          ? 'grab'
          : overPanel
            ? 'move'
            : 'default',
    );
  }

  /**
   * Lets go of any drag in progress without acting on the drop: used when the
   * pointer leaves the canvas or its button is released off-screen. A dragged
   * panel keeps the position it reached; a member or an item simply goes back.
   */
  private cancelHudDrags(): void {
    if (this.roomRowDrag) {
      this.endRowDrag();
      return;
    }
    if (this.hudPanelDrag) {
      this.endPanelDrag();
      return;
    }
    if (this.hudLearnScrollDrag) {
      this.endLearnScrollDrag();
      return;
    }
    if (this.hudIconPress) {
      this.hudIconPress = null;
      this.input.setDefaultCursor('default');
      return;
    }
    if (this.hudDragItem !== null) {
      this.endHudItemDrag();
      return;
    }
    if (this.hudLearnDrag !== null) {
      this.endLearnDrag();
      this.refreshDetail();
      return;
    }
    if (this.hudDetailState.grab !== null) {
      this.hudDetailState = dropMove(this.hudDetailState);
      this.persistRun();
      this.refreshDetail();
      return;
    }
    if (this.hudPress) {
      this.hudPress = null;
      this.input.setDefaultCursor('default');
      return;
    }
    if (this.hudUi.grabbed) this.dropHudGrab();
  }

  private handleHudPointerUp(pointer: Phaser.Input.Pointer): void {
    // A room row's release resolves its drop before any panel gate: the Mart and
    // the reward are floating, so their rows work while they are open.
    if (this.roomRowDrag) {
      this.dropRowDrag(pointer);
      return;
    }
    if (this.learnPopupOpen) {
      this.dismissLearnPopup();
      return;
    }
    if (this.modalPanelOpen()) {
      this.cancelHudDrags();
      return;
    }
    // A press on an icon released without moving is the collapse/expand click.
    if (this.hudIconPress) {
      const press = this.hudIconPress;
      this.hudIconPress = null;
      const panel = this.panelById(press.id);
      if (panel) this.togglePanel(panel);
      return;
    }
    if (this.hudPanelDrag) {
      this.endPanelDrag();
      return;
    }
    if (this.hudLearnScrollDrag) {
      this.endLearnScrollDrag();
      return;
    }
    // A released learnset move equips into the slot it was dropped on, if any.
    if (this.hudLearnDrag !== null) {
      const moveId = this.hudLearnDrag;
      const slot = this.detailMoveIndexAt(pointer);
      const memberId = this.hudDetailState.memberId;
      this.endLearnDrag();
      if (slot !== null && memberId !== null) {
        const next = equipMove(this.run, memberId, moveId, slot, this.run.seed);
        if (next !== this.run) {
          this.run = next;
          this.persistRun();
        }
      }
      this.refreshDetail();
      this.refreshHud();
      return;
    }
    if (this.hudDragItem !== null) {
      const itemId = this.hudDragItem;
      const from = this.hudDragItemFrom;
      const target = this.hudTarget(pointer);
      const intoBag = this.pointerInBagPanel(pointer);
      // The dead are not a drop target: a badge released on RIP goes back on its member.
      const targetId = target && target.pane !== 'rip' ? this.memberIdAt(target) : null;
      this.endHudItemDrag();
      if (targetId) {
        if (from === null) {
          const item = getItem(itemId);
          if (item && (item.kind === 'heal' || item.kind === 'status')) {
            const next = useItemOn(this.run, targetId, itemId);
            if (next !== this.run) {
              this.run = next;
              this.persistRun();
              this.refreshHud();
              this.showNotice(itemUsedNotice(item.name));
            }
          } else {
            this.equipHudItem(itemId, target);
          }
        } else if (targetId !== from) {
          this.run = equipHeldItem(unequipHeldItem(this.run, from), targetId, itemId);
          this.persistRun();
          this.refreshHud();
        }
      } else if (from !== null && intoBag) {
        // A badge dropped on the bag takes the item off for good.
        this.run = unequipHeldItem(this.run, from);
        this.persistRun();
        this.refreshHud();
      }
      // A badge dropped anywhere else just goes back on its member (nothing to do).
      return;
    }
    // A held move released on the learnset band is unequipped; anywhere else it
    // just drops where it last landed.
    if (this.hudDetailState.grab !== null) {
      const memberId = this.hudDetailState.memberId;
      if (memberId !== null && this.pointerInLearnBand(pointer)) {
        const next = unequipMove(this.run, memberId, this.hudDetailState.grab);
        if (next !== this.run) {
          this.run = next;
          this.persistRun();
        }
        this.hudDetailState = dropMove(this.hudDetailState);
        this.refreshDetail();
        this.refreshHud();
        return;
      }
      this.hudDetailState = dropMove(this.hudDetailState);
      this.persistRun();
      this.refreshDetail();
      return;
    }
    // A member pressed and released without moving is a click: open its detail.
    if (this.hudPress) {
      const memberId = this.hudPress.memberId;
      this.hudPress = null;
      this.openMemberDetail(memberId);
      return;
    }
    const grabbed = this.hudUi.grabbed;
    // A drag dropped over the other pane moves the member across; a drop on one
    // of its members swaps the two instead (so a full party can still take a
    // boxed member); otherwise it just drops where it last pointed. There is no
    // cancel.
    if (!grabbed || !this.hudGrabMoved) return;
    const across =
      grabbed.pane === 'party' ? this.pointerInBoxPanel(pointer) : this.pointerInPartyPanel(pointer);
    if (across) this.dropHudAcross(grabbed, this.hudTarget(pointer));
    else this.dropHudGrab();
  }

  /** Opens the detail panel on `memberId` (STATS tab) and draws it. */
  private openMemberDetail(memberId: string): void {
    // Opening a member always shows the window, even if it was left collapsed.
    const panel = this.panelById('detail');
    if (panel && !panel.expanded) {
      panel.expanded = true;
      this.hudDetail.setVisible(true);
    }
    this.hudDetailState = openDetail(memberId);
    this.resetDetailInfo();
    this.hudLearnScrollTop = 0;
    this.hudLearnQuery = '';
    this.hudSearchFocus = false;
    this.cancelNicknameEdit();
    this.endLearnDrag();
    this.refreshDetail();
    // The first open docks the panel beside the PC box; after that it stays
    // wherever the player dragged it.
    if (!this.hudDetailPlaced) {
      this.hudDetailPlaced = true;
      this.dockDetailPanel();
    }
  }

  /** Closes the detail panel and repaints the HUD behind it. */
  private closeMemberDetail(): void {
    if (this.hudDetailState.memberId === null) return;
    this.hudDetailState = closeDetail(this.hudDetailState);
    this.resetDetailInfo();
    this.cancelNicknameEdit();
    this.endLearnDrag();
    this.refreshDetail();
    this.refreshHud();
  }

  /**
   * A press inside the panel: focus the search field, scroll the learnset pool,
   * pick a pool move up to drag it onto a slot, switch tab, toggle a move's ⓘ
   * info popup, or pick a slot move up to reorder it. Returns false when the
   * press landed on an empty spot (no control), so the caller can move the panel.
   */
  private handleDetailPointerDown(pointer: Phaser.Input.Pointer): boolean {
    const point = this.panelPoint(pointer, 'detail');
    // The scroll arrows ride the search row, so they are tested before the field.
    const nav = this.learnNavAt(point);
    if (nav !== null) {
      this.hudSearchFocus = false;
      this.cancelNicknameEdit();
      this.scrollLearnset(nav === 'prev' ? -1 : 1);
      return true;
    }
    if (pointInRect(point, this.hudSearchRect)) {
      this.hudSearchFocus = true;
      this.refreshDetail();
      return true;
    }
    this.hudSearchFocus = false;
    // Any other press inside the panel leaves both text fields - except a press on
    // the nickname field itself, which keeps its edit (and its typed text) going.
    if (!this.nicknameRowAt(pointer)) this.cancelNicknameEdit();
    const tab = this.detailTabAt(pointer);
    if (tab !== null) {
      this.hudDetailState = setDetailTab(this.hudDetailState, tab);
      this.resetLearnDrag();
      this.resetDetailInfo();
      this.refreshDetail();
      return true;
    }
    if (this.hudDetailState.tab === 'stats') {
      // The ability ⓘ comes first: a press on it never starts the rename field and
      // never evolves the member.
      if (this.abilityInfoAt(pointer)) {
        this.toggleAbilityInfo();
        return true;
      }
      // The name row is the editable field: a press focuses it (or keeps it focused),
      // and never falls through to the panel drag or the evolution rows.
      if (this.nicknameRowAt(pointer)) {
        if (!this.hudNicknameFocus) this.beginNicknameEdit();
        return true;
      }
      // Any other press in the panel drops the ability window's pin.
      this.unpinAbilityInfo();
      const evolution = this.evolutionAt(point);
      if (evolution) {
        this.evolveOpenMember(evolution.id);
        return true;
      }
      return false;
    }
    if (this.hudDetailState.tab !== 'moves') return false;
    const learnCell = this.detailLearnInfoAt(pointer);
    if (learnCell?.onInfo === true) {
      this.toggleDetailInfo(learnCell);
      return true;
    }
    const poolIndex = this.hudLearnGrid.indexAt(point.x, point.y);
    if (poolIndex !== null) {
      const entry = this.hudLearnWindow[poolIndex];
      if (entry) this.startLearnDrag(entry.moveId, pointer);
      return true;
    }
    // A press on the band's own background (its inset or the gutter between its
    // rows) starts a scroll drag, so it never moves the panel instead.
    if (this.pointerInLearnBand(pointer)) {
      this.startLearnScrollDrag(point);
      return true;
    }
    const cell = this.detailInfoAt(pointer);
    if (!cell) return false;
    if (cell.onInfo) {
      this.toggleDetailInfo(cell);
      return true;
    }
    if (this.deadDetail()) return true;
    if (this.hudMoveGrid.isEmpty(cell.index)) return true;
    this.hudDetailState = grabMove(this.hudDetailState, cell.index);
    this.hudGrabMoved = false;
    this.refreshDetail();
    return true;
  }

  /** The pool scroll arrow under a panel-local point, or null. */
  private learnNavAt(point: { x: number; y: number }): 'prev' | 'next' | null {
    const hit = (text: Phaser.GameObjects.BitmapText): boolean =>
      text.visible && Math.abs(point.x - text.x) <= 16 && Math.abs(point.y - (text.y + 8)) <= 16;
    if (hit(this.hudLearnPrev)) return 'prev';
    if (hit(this.hudLearnNext)) return 'next';
    return null;
  }

  /** The last row the pool window may start at, or 0 when it all fits. */
  private maxLearnScrollTop(): number {
    return maxScrollTop(this.learnPool().length, HUD_DETAIL_LEARN_COLS, HUD_DETAIL_LEARN_ROWS);
  }

  /** Moves the pool window `deltaRows` rows (clamped) and redraws when it moved. */
  private scrollLearnset(deltaRows: number): void {
    const next = scrollByRows(this.hudLearnScrollTop, deltaRows, this.maxLearnScrollTop());
    if (next === this.hudLearnScrollTop) return;
    this.hudLearnScrollTop = next;
    this.dropLearnInfo();
    this.refreshDetail();
  }

  /** True when the pointer is over the MOVES tab's learnset band. */
  private pointerInLearnBand(pointer: Phaser.Input.Pointer): boolean {
    if (this.hudDetailState.tab !== 'moves' || !this.panelExpanded('detail')) return false;
    return pointInRect(this.panelPoint(pointer, 'detail'), this.hudLearnRect);
  }

  /** The drawn pitch between two pool rows, read off the laid-out grid. */
  private learnRowPitch(): number {
    const first = this.hudLearnGrid.cellRect(0);
    const second = this.hudLearnGrid.cellRect(HUD_DETAIL_LEARN_COLS);
    if (!first || !second || second.y <= first.y) return 0;
    return second.y - first.y;
  }

  /** Starts a scroll drag from the band's background at a panel-local point. */
  private startLearnScrollDrag(point: { x: number; y: number }): void {
    this.hudLearnScrollDrag = {
      startY: point.y,
      startTop: this.hudLearnScrollTop,
      rowPitch: this.learnRowPitch(),
    };
    this.input.setDefaultCursor('grabbing');
  }

  /**
   * Drags the pool window by whole rows: dragging down moves it towards the top
   * of the list and dragging up moves it down the list.
   */
  private updateLearnScrollDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.hudLearnScrollDrag;
    if (!drag || drag.rowPitch <= 0) return;
    const point = this.panelPoint(pointer, 'detail');
    const deltaRows = Math.round((point.y - drag.startY) / drag.rowPitch);
    const next = clampScrollTop(drag.startTop - deltaRows, this.maxLearnScrollTop());
    if (next === this.hudLearnScrollTop) return;
    this.hudLearnScrollTop = next;
    this.dropLearnInfo();
    this.refreshDetail();
  }

  /** Ends a scroll drag and restores the cursor. */
  private endLearnScrollDrag(): void {
    if (!this.hudLearnScrollDrag) return;
    this.hudLearnScrollDrag = null;
    this.input.setDefaultCursor('default');
  }

  /**
   * Picks a pool move up so it can be dropped onto a slot: its name chip rides the
   * pointer until the release lands on a slot.
   */
  private startLearnDrag(moveId: string, pointer: Phaser.Input.Pointer): void {
    this.hudLearnDrag = moveId;
    this.hudGrabMoved = false;
    this.hudLearnGhost.setText(moveName(moveId)).setPosition(pointer.x, pointer.y).setVisible(true);
    this.input.setDefaultCursor('grabbing');
    this.refreshDetail();
  }

  /** Clears the pool drag without equipping anything. */
  private resetLearnDrag(): void {
    this.hudLearnDrag = null;
    this.hudLearnGhost.setVisible(false);
  }

  /** Ends a learnset drag: hides the ghost and restores the cursor. */
  private endLearnDrag(): void {
    if (this.hudLearnDrag === null && !this.hudLearnGhost.visible) return;
    this.resetLearnDrag();
    this.hudGrabMoved = false;
    this.input.setDefaultCursor('default');
  }

  /**
   * Routes a key into the learnset search field while it holds focus: letters and
   * digits filter the pool, Backspace and Escape edit or leave the field. Returns
   * true when the key was consumed, so it never drives the game underneath.
   */
  private typeInDetailSearch(event: KeyboardEvent): boolean {
    if (!this.hudSearchFocus) return false;
    if (event.key === 'Escape' || event.key === 'Enter') {
      this.hudSearchFocus = false;
    } else if (event.key === 'Backspace') {
      if (this.hudLearnQuery.length === 0) return true;
      this.hudLearnQuery = this.hudLearnQuery.slice(0, -1);
      this.hudLearnScrollTop = 0;
      this.dropLearnInfo();
    } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
      this.hudLearnQuery += event.key;
      this.hudLearnScrollTop = 0;
      this.dropLearnInfo();
    } else {
      return true;
    }
    event.preventDefault();
    this.refreshDetail();
    return true;
  }

  /** Floats or hides the info popup as the pointer moves over a cell's ⓘ button. */
  private updateDetailInfo(cell: DetailInfoHit | null): void {
    if (this.hudDetailInfoPinned) return;
    const next: DetailInfoTarget | null =
      cell?.onInfo === true ? { grid: cell.grid, index: cell.index } : null;
    const current = this.hudDetailInfo;
    const same =
      next === null || current === null
        ? next === current
        : next.grid === current.grid && next.index === current.index;
    if (same) return;
    this.hudDetailInfo = next;
    this.refreshDetail();
  }

  /** Pins the popup of a move's ⓘ open, or closes it when it is already pinned. */
  private toggleDetailInfo(target: DetailInfoTarget): void {
    const current = this.hudDetailInfo;
    if (
      this.hudDetailInfoPinned &&
      current !== null &&
      current.grid === target.grid &&
      current.index === target.index
    ) {
      this.hudDetailInfoPinned = false;
      this.hudDetailInfo = null;
    } else {
      this.hudDetailInfoPinned = true;
      this.hudDetailInfo = target;
    }
    this.refreshDetail();
  }

  /** Floats or hides the ability ⓘ window as the pointer moves on and off it. */
  private updateAbilityInfo(over: boolean): void {
    if (this.hudAbilityInfoPinned) return;
    if (over === this.hudAbilityInfo) return;
    this.hudAbilityInfo = over;
    this.refreshDetail();
  }

  /** Pins the ability ⓘ window open, or closes it when it is already pinned. */
  private toggleAbilityInfo(): void {
    if (this.hudAbilityInfoPinned) {
      this.hudAbilityInfoPinned = false;
      this.hudAbilityInfo = false;
    } else {
      this.hudAbilityInfoPinned = true;
      this.hudAbilityInfo = true;
    }
    this.refreshDetail();
  }

  /** Drops the ability window and its pin, e.g. when a press lands elsewhere. */
  private unpinAbilityInfo(): void {
    if (!this.hudAbilityInfoPinned) return;
    this.hudAbilityInfoPinned = false;
    this.hudAbilityInfo = false;
    this.refreshDetail();
  }

  /** Drops the info popup and its pin, e.g. when the panel closes or changes tab. */
  private resetDetailInfo(): void {
    this.hudDetailInfo = null;
    this.hudDetailInfoPinned = false;
    this.hudAbilityInfo = false;
    this.hudAbilityInfoPinned = false;
  }

  /** Hides an unpinned info popup when the pointer leaves the canvas. */
  private clearDetailInfo(): void {
    if (!this.hudDetailInfoPinned && this.hudDetailInfo !== null) {
      this.hudDetailInfo = null;
      this.refreshDetail();
    }
    if (!this.hudAbilityInfoPinned && this.hudAbilityInfo) {
      this.hudAbilityInfo = false;
      this.refreshDetail();
    }
  }

  /**
   * Drops the band's info state when the band's window is rebuilt with different
   * entries: the target is an index into `hudLearnWindow`, so an index that
   * survives a scroll would name another move. The caller redraws right after.
   */
  private dropLearnInfo(): void {
    if (this.hudDetailInfo?.grid !== 'learn') return;
    this.hudDetailInfo = null;
    this.hudDetailInfoPinned = false;
  }

  /** True when the pointer is over the open detail panel. */
  private pointerInDetailPanel(pointer: Phaser.Input.Pointer): boolean {
    if (this.hudDetailState.memberId === null || !this.panelExpanded('detail')) return false;
    const point = this.panelPoint(pointer, 'detail');
    return (
      point.x >= this.hudDetailX &&
      point.x <= this.hudDetailX + this.hud.detailW &&
      point.y >= this.hudDetailY &&
      point.y <= this.hudDetailY + HUD_DETAIL_H
    );
  }

  /** The detail tab under the pointer, or null. */
  private detailTabAt(pointer: Phaser.Input.Pointer): DetailTab | null {
    if (!this.pointerInDetailPanel(pointer)) return null;
    const point = this.panelPoint(pointer, 'detail');
    const tab = this.hudDetailTabs.find(
      (entry) =>
        point.x >= entry.bg.x &&
        point.x <= entry.bg.x + entry.bg.width &&
        point.y >= entry.bg.y &&
        point.y <= entry.bg.y + entry.bg.height,
    );
    return tab?.tab ?? null;
  }

  /** The ready evolution branch under a panel-local point, or null. */
  private evolutionAt(point: { x: number; y: number }): FamilyNode | null {
    for (const cell of this.hudDetailEvoCells) {
      if (cell.node?.ready && pointInRect(point, cell.rect)) return cell.node;
    }
    return null;
  }

  /**
   * Evolves the open member into the clicked branch (the STATS tab), saves and
   * redraws, then announces it on the popup. `evolveMember` re-checks the level,
   * so a stale click is a no-op.
   */
  private evolveOpenMember(into: string): void {
    const memberId = this.hudDetailState.memberId;
    if (memberId === null) return;
    const member =
      this.run.party.find((entry) => entry.fighter.id === memberId) ??
      this.run.box.find((entry) => entry.fighter.id === memberId);
    if (!member) return;
    const name =
      member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId;
    const next = evolveMember(this.run, memberId, into);
    if (next === this.run) return;
    this.run = next;
    this.persistRun();
    this.refreshHud();
    this.showEvoPopup(name, getSpecies(into)?.name ?? into);
  }

  /** The move index under the pointer in the MOVES tab, or null outside a cell. */
  private detailMoveIndexAt(pointer: Phaser.Input.Pointer): number | null {
    if (!this.pointerInDetailPanel(pointer) || this.hudDetailState.tab !== 'moves') return null;
    const point = this.panelPoint(pointer, 'detail');
    return this.hudMoveGrid.indexAt(point.x, point.y);
  }

  /** The move cell under the pointer and whether it lands on that cell's ⓘ button. */
  private detailInfoAt(pointer: Phaser.Input.Pointer): DetailInfoHit | null {
    const index = this.detailMoveIndexAt(pointer);
    if (index === null) return null;
    const point = this.panelPoint(pointer, 'detail');
    const rect = this.hudMoveGrid.cellRect(index);
    const onInfo = rect !== null && this.hudMoveGrid.infoAt(index, point.x - rect.x, point.y - rect.y);
    return { grid: 'moves', index, onInfo };
  }

  /** The band's cell under the pointer and whether it lands on that cell's ⓘ button. */
  private detailLearnInfoAt(pointer: Phaser.Input.Pointer): DetailInfoHit | null {
    if (!this.pointerInDetailPanel(pointer) || this.hudDetailState.tab !== 'moves') return null;
    const point = this.panelPoint(pointer, 'detail');
    const index = this.hudLearnGrid.indexAt(point.x, point.y);
    if (index === null) return null;
    const rect = this.hudLearnGrid.cellRect(index);
    const onInfo = rect !== null && this.hudLearnGrid.infoAt(index, point.x - rect.x, point.y - rect.y);
    return { grid: 'learn', index, onInfo };
  }

  /**
   * True when the pointer is over the STATS tab's ability ⓘ. The panel container
   * sits at the origin with no scale, so its own point is the button's frame.
   */
  private abilityInfoAt(pointer: Phaser.Input.Pointer): boolean {
    if (!this.pointerInDetailPanel(pointer)) return false;
    const point = this.panelPoint(pointer, 'detail');
    return this.hudAbilityInfoButton.contains(point.x, point.y);
  }

  /** Equips the dragged stack to the member under the drop, saving the swap. */
  private equipHudItem(itemId: string, target: { pane: PaneId; index: number } | null): void {
    if (!target) return;
    if (target.pane === 'rip') return;
    const member = this.paneMembers(target.pane)[target.index];
    if (!member) return;
    const next = equipHeldItem(this.run, member.fighter.id, itemId);
    if (next === this.run) return;
    this.run = next;
    this.persistRun();
    this.refreshHud();
  }

  /** The id of the member at `target`, or null if that slot is empty. */
  private memberIdAt(target: { pane: PaneId; index: number }): string | null {
    const member = this.paneMembers(target.pane)[target.index];
    return member?.fighter.id ?? null;
  }

  /** Puts the dragged stack down and clears the in-hand state. */
  private endHudItemDrag(): void {
    this.hudDragItem = null;
    this.hudDragItemFrom = null;
    this.hudGrabMoved = false;
    this.hudDragGhost.setVisible(false);
    this.input.setDefaultCursor('default');
    this.refreshHud();
  }

  /** Moves the grabbed member to the other pane (deposit / withdraw). */
  private moveHudAcross(from: PaneId): void {
    const input = from === 'party' ? 'right' : 'left';
    const next = partyInput(this.run, this.hudUi, input);
    this.run = next.run;
    this.hudUi = next.ui;
    this.finishHudGrab();
  }

  /**
   * Drops the grabbed member over the other pane. A drop on one of its members
   * swaps the two (so a boxed member can join a full party); a drop on empty
   * space falls back to the plain deposit/withdraw.
   */
  private dropHudAcross(
    grabbed: { pane: PaneId },
    target: { pane: PaneId; index: number } | null,
  ): void {
    if (target && target.pane !== grabbed.pane && target.pane !== 'rip') {
      const next = swapAcross(this.run, this.hudUi, target.index);
      if (next.run !== this.run) {
        this.run = next.run;
        this.hudUi = next.ui;
        this.finishHudGrab();
        return;
      }
    }
    this.moveHudAcross(grabbed.pane);
  }

  /** Drops the grabbed member where it stands, saves it and redraws the HUD. */
  private dropHudGrab(): void {
    this.hudUi = dropGrabbed(this.hudUi);
    this.finishHudGrab();
  }

  private finishHudGrab(): void {
    this.hudGrabMoved = false;
    this.hudDragGhost.setVisible(false);
    this.persistRun();
    this.refreshHud();
  }

  /** The party row or box/rip cell under the pointer, or null. */
  private hudTarget(pointer: Phaser.Input.Pointer): { pane: PaneId; index: number } | null {
    const row = this.hudPartyRowAt(pointer);
    if (row !== null) return { pane: 'party', index: row };
    const cell = this.hudBoxCellAt(pointer);
    if (cell !== null) return { pane: this.hudUi.pane === 'rip' ? 'rip' : 'box', index: cell };
    return null;
  }

  /** The party index under the pointer, or null outside a filled row. */
  private hudPartyRowAt(pointer: Phaser.Input.Pointer): number | null {
    if (!this.pointerInPartyPanel(pointer)) return null;
    const point = this.panelPoint(pointer, 'party');
    const rowTop = this.hudPartyY + HUD_PARTY_HEADER;
    const slot = Math.floor((point.y - rowTop) / HUD_PARTY_ROW);
    if (point.y < rowTop || slot < 0 || slot >= MAX_PARTY_SIZE) return null;
    return slot < this.run.party.length ? slot : null;
  }

  /** True when the pointer is on the Pokevial button in the party header. */
  private vialButtonAt(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('party')) return false;
    const point = this.panelPoint(pointer, 'party');
    const left = this.hudX + (this.hud.partyW - HUD_VIAL_W) / 2;
    const top = this.hudPartyY + HUD_VIAL_Y;
    return (
      point.x >= left && point.x <= left + HUD_VIAL_W && point.y >= top && point.y <= top + HUD_VIAL_H
    );
  }

  /** The box index under the pointer, or null outside a filled cell. */
  private hudBoxCellAt(pointer: Phaser.Input.Pointer): number | null {
    const point = this.panelPoint(pointer, 'box');
    const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
    const gridLeft = this.hudBoxX + HUD_BOX_PAD + (this.hud.panelW - HUD_BOX_PAD * 2 - gridW) / 2;
    const stride = HUD_BOX_CELL + HUD_BOX_CELL_GAP;
    const col = Math.floor((point.x - gridLeft) / stride);
    const row = Math.floor((point.y - (this.hudBoxY + HUD_BOX_TABS_H)) / stride);
    if (col < 0 || col >= BOX_COLS || row < 0 || row >= BOX_ROWS) return null;
    const index = boxCellIndex(this.hudBoxPage, col, row);
    const length = this.hudUi.pane === 'rip' ? this.run.rip.length : this.run.box.length;
    return index < length ? index : null;
  }

  private pointerInPartyPanel(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('party')) return false;
    const point = this.panelPoint(pointer, 'party');
    return (
      point.x >= this.hudX &&
      point.x <= this.hudX + this.hud.partyW &&
      point.y >= this.hudPartyY &&
      point.y <= this.hudPartyY + this.hudPartyH
    );
  }

  private pointerInBoxPanel(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('box')) return false;
    const point = this.panelPoint(pointer, 'box');
    return (
      point.x >= this.hudBoxX &&
      point.x <= this.hudBoxX + this.hud.panelW &&
      point.y >= this.hudBoxY &&
      point.y <= this.hudBoxY + this.hudBoxH
    );
  }

  /** The bag stack under the pointer in the active pocket, or null. */
  private hudBagStackAt(pointer: Phaser.Input.Pointer): string | null {
    if (!this.pointerInBagPanel(pointer)) return null;
    const point = this.panelPoint(pointer, 'bag');
    const bag = bagForCategory(this.run.bag, this.hudBagCategory);
    const rowTop = this.hudBagY + HUD_BAG_HEADER;
    const slot = Math.floor((point.y - rowTop) / HUD_BAG_ROW);
    if (point.y < rowTop || slot < 0 || slot >= HUD_BAG_ROWS) return null;
    return bag[slot]?.itemId ?? null;
  }

  /** The bag stack under the pointer that can be dragged: a held item or a heal/status consumable. */
  private hudDraggableStackAt(pointer: Phaser.Input.Pointer): string | null {
    const itemId = this.hudBagStackAt(pointer);
    const kind = itemId === null ? null : (getItem(itemId)?.kind ?? null);
    return kind === 'held' || kind === 'heal' || kind === 'status' ? itemId : null;
  }

  /**
   * The held-item badge under the pointer, if any. Grabbing a badge picks the
   * item up instead of the Pokémon, so it can be moved to another member or
   * dropped on the bag to unequip it.
   */
  private hudHeldBadgeAt(pointer: Phaser.Input.Pointer): { itemId: string; memberId: string } | null {
    const target = this.hudTarget(pointer);
    if (!target || target.pane === 'rip') return null;
    const member = this.paneMembers(target.pane)[target.index];
    const itemId = member?.fighter.heldItem;
    if (!member || !itemId) return null;
    const badge =
      target.pane === 'party'
        ? this.hudRows[target.index]?.held
        : this.hudBoxCells[target.index - this.hudBoxPage * BOX_PAGE_SIZE]?.held;
    if (!badge || !badge.visible) return null;
    const point = this.panelPoint(pointer, target.pane);
    const radius = Math.max(badge.displayWidth, badge.displayHeight) / 2;
    if (Math.hypot(point.x - badge.x, point.y - badge.y) > radius) return null;
    return { itemId, memberId: member.fighter.id };
  }

  private pointerInBagPanel(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('bag')) return false;
    const point = this.panelPoint(pointer, 'bag');
    return (
      point.x >= this.hudX &&
      point.x <= this.hudX + this.hud.panelW &&
      point.y >= this.hudBagY &&
      point.y <= this.hudBagY + this.hudBagH
    );
  }

  /** A press on a bag pocket tab selects it; true when it handled the press. */
  private selectBagTab(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('bag')) return false;
    const point = this.panelPoint(pointer, 'bag');
    const tab = this.hudBagTabs.find(
      (entry) =>
        point.x >= entry.bg.x &&
        point.x <= entry.bg.x + entry.bg.width &&
        point.y >= entry.bg.y &&
        point.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return false;
    this.hudBagCategory = tab.category;
    this.refreshHud();
    return true;
  }

  /** A press on a PC box page tab selects it; true when it handled the press. */
  private selectBoxTab(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('box')) return false;
    const point = this.panelPoint(pointer, 'box');
    const tab = this.hudBoxTabs.find(
      (entry) =>
        entry.bg.visible &&
        point.x >= entry.bg.x &&
        point.x <= entry.bg.x + entry.bg.width &&
        point.y >= entry.bg.y &&
        point.y <= entry.bg.y + entry.bg.height,
    );
    if (!tab) return false;
    this.hudBoxPage = tab.page;
    // The cursor follows the page the pointer picked, so a page tab can never leave
    // the cursor pointing past the list it just switched to.
    if (!this.hudUi.grabbed) {
      const length = this.hudUi.pane === 'rip' ? this.run.rip.length : this.run.box.length;
      this.hudUi = { ...this.hudUi, index: Math.min(this.hudUi.index, length - 1) };
    }
    this.refreshHud();
    return true;
  }

  /** A press on the RIP tab shows the dead (or returns to the box); true when it handled it. */
  private selectRipTab(pointer: Phaser.Input.Pointer): boolean {
    if (!this.panelExpanded('box')) return false;
    const point = this.panelPoint(pointer, 'box');
    const { bg } = this.hudBoxRip;
    if (point.x < bg.x || point.x > bg.x + bg.width || point.y < bg.y || point.y > bg.y + bg.height) {
      return false;
    }
    this.setHudBoxPane(this.hudUi.pane === 'rip' ? 'box' : 'rip');
    return true;
  }

  /** Shows the box window's other list (`'rip'` or back to `'box'`). */
  private setHudBoxPane(pane: 'box' | 'rip'): void {
    if (this.hudUi.pane !== pane) this.hudUi = { pane, index: 0, grabbed: null };
    this.hudBoxPage = 0;
    this.refreshHud();
  }

  /**
   * The panel whose frame band is under the pointer. Only the topmost panel that
   * owns the point can be grabbed, so a border hidden behind another panel cannot
   * steal the drag.
   */
  private hudPanelAt(pointer: Phaser.Input.Pointer): HudPanel | null {
    const owner = this.hudPanelOwnerAt(pointer);
    if (!owner) return null;
    return this.onPanelBorder(owner, pointer) ? owner : null;
  }

  /**
   * True when `pointer` is on a panel's frame: inside the window (plus a small
   * pad, so the seam between two panels is grabbable) but outside its inner,
   * interactive area. The header has nothing interactive, so all of it grabs.
   */
  private onPanelBorder(panel: HudPanel, pointer: Phaser.Input.Pointer): boolean {
    const rect = this.panelRect(panel);
    const pad = HUD_PANEL_GRAB_PAD;
    const inside =
      pointer.x >= rect.x - pad &&
      pointer.x <= rect.x + rect.w + pad &&
      pointer.y >= rect.y - pad &&
      pointer.y <= rect.y + rect.h + pad;
    if (!inside) return false;
    if (panel.id === 'header') return true;
    const inset = HUD_PANEL_BORDER;
    const inner =
      pointer.x >= rect.x + inset &&
      pointer.x <= rect.x + rect.w - inset &&
      pointer.y >= rect.y + inset &&
      pointer.y <= rect.y + rect.h - inset;
    return !inner;
  }

  /** The panel with `id`, or undefined before the HUD is built. */
  private panelById(id: HudPanelId): HudPanel | undefined {
    return this.hudPanels.find((panel) => panel.id === id);
  }

  /** Whether a panel is expanded (content shown); a missing panel reads expanded. */
  private panelExpanded(id: HudPanelId): boolean {
    return this.panelById(id)?.expanded ?? true;
  }

  /** A panel's layout rect before the drag offset: the window, or its icon. */
  private panelBase(panel: HudPanel): { x: number; y: number; w: number; h: number } {
    if (!panel.expanded) {
      return {
        x: panel.x + HUD_ICON_INSET,
        y: panel.y + HUD_ICON_INSET,
        w: panel.iconW,
        h: panel.iconH,
      };
    }
    return { x: panel.x, y: panel.y, w: panel.w, h: panel.h };
  }

  /** A panel's current on-screen rect: its layout rect plus the drag offset. */
  private panelRect(panel: HudPanel): { x: number; y: number; w: number; h: number } {
    const base = this.panelBase(panel);
    return { x: base.x + panel.dx, y: base.y + panel.dy, w: base.w, h: base.h };
  }

  /** The collapse-icon button's current on-screen rect. */
  private panelIconRect(panel: HudPanel): { x: number; y: number; w: number; h: number } {
    return {
      x: panel.x + HUD_ICON_INSET + panel.dx,
      y: panel.y + HUD_ICON_INSET + panel.dy,
      w: panel.iconW,
      h: panel.iconH,
    };
  }

  /** The panel whose collapse icon is under the pointer; the topmost one wins. */
  private hudPanelIconAt(pointer: Phaser.Input.Pointer): HudPanel | null {
    const owner = this.hudPanelOwnerAt(pointer);
    if (!owner) return null;
    const rect = this.panelIconRect(owner);
    if (
      pointer.x >= rect.x &&
      pointer.x <= rect.x + rect.w &&
      pointer.y >= rect.y &&
      pointer.y <= rect.y + rect.h
    ) {
      return owner;
    }
    return null;
  }

  /**
   * The topmost visible panel whose rect contains the pointer: the panel that owns
   * a click there. Overlapping panels stack, so only the one on top answers.
   */
  private hudPanelOwnerAt(pointer: Phaser.Input.Pointer): HudPanel | null {
    for (let i = this.hudPanels.length - 1; i >= 0; i--) {
      const panel = this.hudPanels[i];
      if (!panel.container.visible) continue;
      const base = this.panelRect(panel);
      const pad = panel.expanded ? HUD_PANEL_GRAB_PAD : 0;
      if (
        pointer.x >= base.x - pad &&
        pointer.x <= base.x + base.w + pad &&
        pointer.y >= base.y - pad &&
        pointer.y <= base.y + base.h + pad
      ) {
        return panel;
      }
    }
    return null;
  }

  /**
   * Fades every panel's window chrome in or out to match the Transparent HUD
   * option; the content stays fully drawn either way. With the window hidden each
   * panel keeps a drawn outline and its text turns white, so it still reads over
   * the map behind it.
   */
  private applyHudBackground(): void {
    const transparent = this.settings.hudTransparent;
    const alpha = transparent ? HUD_BG_TRANSPARENT_ALPHA : FRLG_WINDOW_ALPHA;
    for (const panel of this.hudPanels) {
      panel.window.setAlpha(alpha);
      panel.border.setVisible(transparent);
      this.recolorPanelText(panel.body, transparent);
    }
  }

  /**
   * Turns every text inside a panel white (or restores its own colour). The
   * original tint is remembered the first time each text is seen, so a toggle
   * back and forth is lossless; a piece that re-tints itself (the move grid)
   * simply overrides this on its next refresh.
   */
  private recolorPanelText(container: Phaser.GameObjects.Container, white: boolean): void {
    for (const child of container.list) {
      if (child instanceof Phaser.GameObjects.BitmapText) {
        if (!this.hudTextTints.has(child)) this.hudTextTints.set(child, child.tintTopLeft);
        child.setTint(white ? HUD_BG_TEXT : this.hudTextTints.get(child)!);
      } else if (child instanceof Phaser.GameObjects.Container) {
        this.recolorPanelText(child, white);
      }
    }
  }

  /**
   * Collapses a panel to its icon or expands it again. The panel keeps its place
   * and is raised over the others, so a panel opened over another reads on top.
   */
  private togglePanel(panel: HudPanel): void {
    if (panel.expanded) {
      // Collapsing the detail panel takes the nickname field off screen too.
      if (panel.id === 'detail') this.cancelNicknameEdit();
      panel.expanded = false;
      panel.body.setVisible(false);
      this.applyPanelPositions();
      this.persistHudLayout();
      return;
    }
    panel.expanded = true;
    panel.body.setVisible(true);
    this.clampPanel(panel);
    this.raisePanel(panel);
    this.applyPanelPositions();
    this.persistHudLayout();
  }

  /** The pointer in a panel's own (layout) coordinates, undoing its drag offset. */
  private panelPoint(pointer: Phaser.Input.Pointer, id: HudPanelId): { x: number; y: number } {
    const panel = this.hudPanels.find((entry) => entry.id === id);
    if (!panel) return { x: pointer.x, y: pointer.y };
    return { x: pointer.x - panel.dx, y: pointer.y - panel.dy };
  }

  /** Raises a panel over the rest, in both the draw order and the hit order. */
  private raisePanel(panel: HudPanel): void {
    const index = this.hudPanels.indexOf(panel);
    if (index >= 0 && index < this.hudPanels.length - 1) {
      this.hudPanels.splice(index, 1);
      this.hudPanels.push(panel);
    }
    this.hudRoot.bringToTop(panel.container);
    // The held member/item ghosts must still ride above every panel.
    this.hudRoot.bringToTop(this.hudDragGhost);
    this.hudRoot.bringToTop(this.hudLearnGhost);
  }

  /** Starts dragging `panel` from the pointer, raising it over the rest. */
  private startPanelDrag(panel: HudPanel, pointer: Phaser.Input.Pointer): void {
    this.hudPanelDrag = {
      id: panel.id,
      pointerStart: { x: pointer.x, y: pointer.y },
      offsetStart: { x: panel.dx, y: panel.dy },
    };
    this.raisePanel(panel);
    this.input.setDefaultCursor('grabbing');
  }

  /** Moves the dragged panel to follow the pointer; it overlaps the others freely. */
  private updatePanelDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.hudPanelDrag;
    if (!drag) return;
    const panel = this.hudPanels.find((entry) => entry.id === drag.id);
    if (!panel) return;
    panel.dx = drag.offsetStart.x + (pointer.x - drag.pointerStart.x);
    panel.dy = drag.offsetStart.y + (pointer.y - drag.pointerStart.y);
    this.clampPanel(panel);
    this.applyPanelPositions();
  }

  private endPanelDrag(): void {
    this.hudPanelDrag = null;
    this.input.setDefaultCursor('default');
    this.persistHudLayout();
  }

  /** Pushes every panel's drag offset onto its container. */
  private applyPanelPositions(): void {
    for (const panel of this.hudPanels) panel.container.setPosition(panel.dx, panel.dy);
  }

  /** Keeps a panel fully on screen. */
  private clampPanel(panel: HudPanel): void {
    const base = this.panelBase(panel);
    const maxX = Math.max(HUD_PANEL_MARGIN, this.scale.width - base.w - HUD_PANEL_MARGIN);
    const maxY = Math.max(HUD_PANEL_MARGIN, this.scale.height - base.h - HUD_PANEL_MARGIN);
    panel.dx = Math.max(HUD_PANEL_MARGIN - base.x, Math.min(maxX - base.x, panel.dx));
    panel.dy = Math.max(HUD_PANEL_MARGIN - base.y, Math.min(maxY - base.y, panel.dy));
  }

  /** Saves the current panel offsets and collapsed flags as a global preference. */
  private persistHudLayout(): void {
    if (this.hudPanels.length === 0) return;
    const hudLayout = { ...this.settings.hudLayout };
    for (const panel of this.hudPanels) {
      hudLayout[panel.id] = {
        dx: panel.dx,
        dy: panel.dy,
        collapsed: !panel.expanded,
      };
    }
    this.settings = { ...this.settings, hudLayout };
    saveSettings(this.settings);
  }

  /** Applies the saved HUD layout to freshly built panels (D22 keeps settings). */
  private applyStoredHudLayout(): void {
    const layout = this.settings.hudLayout;
    for (const panel of this.hudPanels) {
      const stored = layout[panel.id];
      if (!stored) continue;
      panel.dx = stored.dx;
      panel.dy = stored.dy;
      panel.expanded = !stored.collapsed;
      panel.body.setVisible(panel.expanded);
    }
    this.applyHudBackground();
    // A resize can leave a stored layout off-screen; keep every panel reachable.
    // Overlaps are allowed, so the panels are just clamped, never pushed apart.
    for (const panel of this.hudPanels) this.clampPanel(panel);
    this.applyPanelPositions();
    this.hudDetailPlaced =
      this.settings.hudLayout.detail.dx !== 0 || this.settings.hudLayout.detail.dy !== 0;
  }

  /** Places the detail panel just left of the PC box the first time it opens. */
  private dockDetailPanel(): void {
    const detail = this.panelById('detail');
    const box = this.panelById('box');
    if (!detail || !box) return;
    const boxRect = this.panelRect(box);
    detail.dx = boxRect.x - HUD_GAP - this.hud.detailW - detail.x;
    detail.dy = boxRect.y - detail.y;
    this.clampPanel(detail);
    this.applyPanelPositions();
    this.persistHudLayout();
  }

  /** Two cameras: one follows the world, one pins the HUD overlay to the screen. */
  private setupHudCamera(): void {
    const hud = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hud.setScroll(0, 0);
    const keep = new Set<Phaser.GameObjects.GameObject>([this.hudRoot]);
    hud.ignore(this.children.list.filter((child) => !keep.has(child)));
    this.cameras.main.ignore([this.hudRoot]);
    this.hudCamera = hud;
  }

  /**
   * The hold-to-reset overlay: a full-screen scrim that fades the whole screen
   * out and a small ring that fills. Screen-space, built after the HUD camera
   * exists, so the world camera ignores it and only the pinned camera draws it.
   */
  private buildResetOverlay(): void {
    const { width, height } = this.scale;
    this.resetScrim = this.add
      .rectangle(0, 0, width, height, 0x05070c, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(400);
    this.resetRing = this.add.graphics().setScrollFactor(0).setDepth(401);
    this.cameras.main.ignore([this.resetScrim, this.resetRing]);
  }

  /** Advances the hold-to-reset progress while the key is down, or fades back in. */
  private updateReset(delta: number): void {
    const allowed =
      !this.gameOver &&
      !this.pendingBattle &&
      !this.releaseRoot &&
      !this.modalPanelOpen() &&
      !this.pauseMenuOpen &&
      // A held `R` while typing a name must not fill the ring and restart the run.
      !this.textFieldFocused() &&
      this.resetKey?.isDown === true;
    if (!allowed) {
      if (this.resetHold !== 0) {
        this.resetHold = 0;
        this.fadeResetOverlayIn();
      }
      return;
    }
    this.resetHold = Math.min(RESET_HOLD_MS, this.resetHold + delta);
    const progress = this.resetHold / RESET_HOLD_MS;
    this.drawResetOverlay(progress);
    if (progress >= 1) this.restartRun();
  }

  /** Paints the screen fade-out and the small pie that fills as the hold advances. */
  private drawResetOverlay(progress: number): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.tweens.killTweensOf(this.resetScrim);
    this.tweens.killTweensOf(this.resetRing);
    this.resetScrim.setAlpha(progress).setVisible(true);
    this.resetRing.clear();
    this.resetRing.fillStyle(FRLG_SURFACE, 0.5).fillCircle(cx, cy, RESET_RADIUS);
    this.resetRing.fillStyle(FRLG_ACCENT, 0.9);
    this.resetRing.slice(
      cx,
      cy,
      RESET_RADIUS,
      Phaser.Math.DegToRad(-90),
      Phaser.Math.DegToRad(-90 + progress * 360),
      false,
    );
    this.resetRing.fillPath();
    this.resetRing.lineStyle(2, FRLG_INK, 0.5).strokeCircle(cx, cy, RESET_RADIUS);
    this.resetRing.setAlpha(1);
  }

  /** Releasing the key fades the dark scrim and the ring back out. */
  private fadeResetOverlayIn(): void {
    this.tweens.killTweensOf([this.resetScrim, this.resetRing]);
    if (this.reducedFlash) {
      // The reduce-flashing preference releases the scrim instantly (D45).
      this.resetRing.clear();
      this.resetScrim.setAlpha(0);
      return;
    }
    this.tweens.add({
      targets: [this.resetScrim, this.resetRing],
      alpha: 0,
      duration: RESET_FADE_IN_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.resetRing.clear();
        this.resetScrim.setAlpha(0);
      },
    });
  }

  private hideResetOverlay(): void {
    this.tweens.killTweensOf([this.resetScrim, this.resetRing]);
    this.resetRing.clear();
    this.resetScrim.setAlpha(0);
  }

  /** Starts a brand-new run with a fresh seed (nothing carries over). */
  private restartRun(): void {
    this.resetHold = 0;
    this.hideResetOverlay();
    clearRun(browserStorage());
    this.scene.start('Starter', { seed: randomSeed() });
  }

  /**
   * A tile's display scale so every atlas lands on the same `TILE_SIZE` world
   * cell: the biome sheet's own cell (`D18`) or the 24px common sheet.
   */
  private tileScale(source: 'atlas' | 'common'): number {
    if (source === 'common') return TILE_SIZE / COMMON_TILE_SIZE;
    return TILE_SIZE / TILESETS[this.tilesetId].config.atlas.tileSize;
  }

  private tileImage(x: number, y: number, frame: TileFrame): Phaser.GameObjects.Image {
    const key = frame.source === 'common' ? COMMON_TEXTURE_KEY : tilesetTextureKey(this.tilesetId);
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, key, frame.frame)
      .setOrigin(0, 0)
      .setScale(this.tileScale(frame.source));
  }

  /**
   * The frames a cell draws: the floor under everything, then the tile itself
   * when it differs. The FRLG tree keeps a transparent ground, so the floor
   * (with its wall-edge variant) shows through instead of a baked flat colour.
   */
  private tileFrames(x: number, y: number): TileFrame[] {
    const config = TILESETS[this.tilesetId].config;
    const ground = resolveGroundFrame(this.renderTiles, x, y, config);
    const frames: TileFrame[] = [ground];
    // A tree tip a grass patch shares draws the grass frame under its crown; the
    // tilesets that fall back to the procedural tuft draw it in `drawEntities`.
    const grassFrame = config.frames[TALL_GRASS];
    if (
      grassFrame !== undefined &&
      grassFrame !== config.frames[FLOOR] &&
      this.grassTipKeys.has(`${x},${y}`)
    ) {
      frames.push({ source: 'atlas', frame: grassFrame });
    }
    const frame = resolveTileFrame(this.renderTiles, x, y, config, true);
    if (frame && (frame.source !== ground.source || frame.frame !== ground.frame)) frames.push(frame);
    return frames;
  }

  /**
   * The map movement runs on. A wall cell that draws as a tree's **pure top row**
   * (its walkable tip, `treeTipKeys`) is turned into floor, so the player walks
   * under the crown while the tile still renders as the wall motif, drawn over the
   * player (`TREE_TIP_DEPTH`).
   */
  /**
   * Returns `route` with its border opening on `edge` walled off, used to keep the
   * boss room's portal **sealed** until the boss falls. The interior lane that led
   * to it stays, ending at the solid border.
   */
  private sealEdge(route: RouteMap, edge: MapEdge): RouteMap {
    const tiles = route.tiles.map((row, y) =>
      row.map((value, x) =>
        borderEdge({ x, y }, route.width, route.height) === edge && value === FLOOR ? WALL : value,
      ),
    );
    return { ...route, tiles };
  }

  private movementMap(map: TileMap): TileMap {
    const config = TILESETS[this.tilesetId].config;
    const tips = treeTipKeys(map, config);
    this.grassTipKeys = grassTipKeys(map, config);
    if (tips.size === 0) return map;
    const copy = map.map((row) => row.slice());
    for (const key of tips) {
      const [x, y] = key.split(',').map(Number);
      copy[y][x] = FLOOR;
    }
    return copy;
  }

  private drawTiles(): void {
    const tips = treeTipKeys(this.renderTiles, TILESETS[this.tilesetId].config);
    const created: Phaser.GameObjects.GameObject[] = [];
    for (let y = 0; y < this.renderTiles.length; y++) {
      const row: Phaser.GameObjects.Image[][] = [];
      for (let x = 0; x < this.renderTiles[y].length; x++) {
        const tip = tips.has(`${x},${y}`);
        row.push(
          this.tileFrames(x, y).map((frame, index, all) => {
            const image = this.tileImage(x, y, frame);
            // Only the wall motif of a walkable tip goes over the player; its
            // ground - and a shared grass frame - stay under, so the player still
            // shows standing on the tile and walking through the grass.
            if (tip && index === all.length - 1) image.setDepth(TREE_TIP_DEPTH);
            created.push(image);
            return image;
          }),
        );
      }
      this.tileSprites.push(row);
    }
    // At create time the HUD camera does not exist yet and ignores everything
    // afterwards; on a rebuild it must ignore only the freshly drawn cells.
    this.hudCamera?.ignore(created);
  }

  private drawEntities(): void {
    const created: Phaser.GameObjects.GameObject[] = [];
    const config = TILESETS[this.tilesetId].config;
    // The player's own grass rustle: one hidden sprite, parked and played by
    // `refreshGrassStep` / `playGrassRustle` on the tile they occupy. It cycles the
    // field's own rustle frames when the tileset declares them and draws the
    // procedural tuft at one frame otherwise (`grassRustleFrames`).
    const rustle = grassRustleFrames(config);
    const rest = rustle[0];
    const step =
      rest === undefined
        ? this.add.sprite(0, 0, GRASS_TEXTURE_KEY)
        : this.add.sprite(0, 0, tilesetTextureKey(this.tilesetId), rest);
    step
      .setOrigin(0.5, 1) // was the default centre anchor
      .setScale(rest === undefined ? 1 : this.tileScale('atlas'))
      .setDepth(GRASS_STEP_DEPTH)
      .setTint(config.grassRustleTint ?? 0xffffff)
      .setVisible(false);
    // The atlas art's own first blade row is 6 on the parked cell but 0 on the closing one, so
    // the overlay is clipped to the cell's rows 6-15: no frame of the beat ever draws above the
    // player's hips (`docs/tileset-spec.md` §6). The procedural 24px tuft keeps its whole art.
    if (rest !== undefined) step.setCrop(0, 6, 16, 10);
    this.grassStep = step;
    this.entitySprites.push(step);
    created.push(step);
    // The FRLG fields draw tall grass as a real ground tile, so the procedural
    // tuft overlay is only for tilesets that still fall back to plain ground.
    const overlayGrass = config.frames[TALL_GRASS] === config.frames[FLOOR];
    if (!overlayGrass) {
      this.hudCamera?.ignore(created);
      return;
    }
    for (let y = 0; y < this.renderTiles.length; y++) {
      for (let x = 0; x < this.renderTiles[y].length; x++) {
        // A tree tip a grass patch shares gets the tuft too, under its crown.
        if (this.renderTiles[y][x] !== TALL_GRASS && !this.grassTipKeys.has(`${x},${y}`)) continue;
        const image = this.add.image(this.centerX(x), this.centerY(y), GRASS_TEXTURE_KEY).setDepth(1);
        this.entitySprites.push(image);
        created.push(image);
      }
    }
    this.hudCamera?.ignore(created);
  }

  /**
   * Draws the ground items on the route's pockets. A visible item is the FRLG
   * Poke Ball, like the originals; a hidden one is the biome's own floor patch
   * (`hiddenItemFrame`), drawn exactly as the ground under it — same texture,
   * same cell, same scale — so only its frame gives it away up close. Items
   * already taken stay hidden. Only the live route has items, so a dev generator
   * phase draws none.
   */
  private drawItems(): void {
    if (this.generatorStepIndex !== null) return;
    const config = TILESETS[this.tilesetId].config;
    const created: Phaser.GameObjects.GameObject[] = [];
    for (const item of this.route.items) {
      const taken = isItemPicked(this.run, item.id);
      const sprite = item.hidden
        ? this.add
            .image(
              this.centerX(item.position.x),
              this.centerY(item.position.y),
              tilesetTextureKey(this.tilesetId),
              hiddenItemFrame(config),
            )
            .setScale(TILE_SIZE / config.atlas.tileSize)
            .setVisible(!taken)
            .setDepth(5)
        : this.add
            .image(this.centerX(item.position.x), this.centerY(item.position.y), GROUND_ITEM_TEXTURE_KEY)
            .setScale(1.5)
            .setVisible(!taken)
            .setDepth(5);
      this.itemSprites.push({ item, sprite });
      this.entitySprites.push(sprite);
      created.push(sprite);
    }
    this.hudCamera?.ignore(created);
  }

  /**
   * Draws the route's trainers on their tiles, off the FRLG overworld atlas when
   * the archetype has a decomp sprite and the procedural stand-in otherwise. A
   * defeated trainer is gone for the route, so it is not drawn. The facing picks
   * the resting pose (down, up or the left-facing side, flipped for east), and a
   * spinning trainer's pose is refreshed on its timer in `update`.
   */
  private drawTrainers(): void {
    if (this.generatorStepIndex !== null) return;
    const created: Phaser.GameObjects.GameObject[] = [];
    for (const trainer of this.route.trainers) this.drawTrainer(trainer, created);
    this.drawRoomNpc(created);
    this.hudCamera?.ignore(created);
  }

  /** Draws one trainer's sprite (the body of `drawTrainers`' loop), booking it into `created`. */
  private drawTrainer(trainer: RouteTrainer, created: Phaser.GameObjects.GameObject[]): void {
    if (isTrainerDefeated(this.run, trainer.id)) return;
    const archetype = getTrainerArchetype(trainer.archetypeId);
    const spriteKey = archetype?.spriteKey ?? null;
    const frame = spriteKey ? overworldSpriteFrame(spriteKey) : null;
    const footY = this.centerY(trainer.position.y) + TILE_SIZE / 2;
    const sprite =
      frame !== null
        ? this.add
            .sprite(this.centerX(trainer.position.x), footY, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
            .setOrigin(0.5, 1)
            .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
            .setDepth(actorDepth(footY))
        : this.add
            .sprite(
              this.centerX(trainer.position.x),
              this.centerY(trainer.position.y),
              TRAINER_TEXTURE_KEY,
            )
            .setTint(archetype?.colour ?? 0xffffff)
            .setDepth(actorDepth(footY));
    const entry: TrainerSpriteEntry = {
      trainer,
      sprite,
      spriteKey: frame !== null ? spriteKey : null,
    };
    this.faceTrainerSprite(entry, trainer.facing);
    this.trainerFacing.set(trainer.id, trainer.facing);
    this.trainerSprites.push(entry);
    this.entitySprites.push(sprite);
    created.push(sprite);
  }

  /** Shows or hides every drawn trainer's sprite through the pure `trainerHidden` rule. */
  private refreshTrainerVisibility(): void {
    for (const entry of this.trainerSprites) {
      entry.sprite.setVisible(
        !trainerHidden(
          getTrainerArchetype(entry.trainer.archetypeId),
          entry.trainer.position,
          this.player,
        ),
      );
    }
  }

  /**
   * Draws the room's special NPC on its own free tile, off the packed overworld
   * atlas exactly as a trainer sprite is drawn. It never joins `trainerSprites`: it
   * has no sight, no spin, no chase and no roster.
   */
  private drawRoomNpc(created: Phaser.GameObjects.GameObject[]): void {
    const npc = this.npc;
    if (!npc) return;
    const frame = overworldSpriteFrame(npc.row.spriteKey);
    if (frame === null) return;
    const footY = this.centerY(npc.tile.y) + TILE_SIZE / 2;
    const sprite = this.add
      .sprite(this.centerX(npc.tile.x), footY, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
      .setDepth(actorDepth(footY));
    this.entitySprites.push(sprite);
    created.push(sprite);
  }

  /**
   * Draws the room's own fixture, whatever kind it is (`D47`): the room's
   * descriptor creates the objects, and the scene books them into the route's
   * teardown list and keeps the pinned HUD camera off them.
   */
  private drawRoomFixture(): void {
    const descriptor = this.specialDescriptor();
    if (!descriptor?.drawFixture) return;
    const before = this.children.list.length;
    descriptor.drawFixture(this.roomHost());
    const created = this.children.list.slice(before);
    if (created.length === 0) return;
    for (const sprite of created) this.entitySprites.push(sprite);
    this.hudCamera?.ignore(created);
  }

  /** Poses a resting trainer: the facing's idle frame, flipped for the right side. */
  private faceTrainerSprite(entry: TrainerSpriteEntry, facing: Facing): void {
    const pose = trainerFacingPose(facing);
    entry.sprite.setFlipX(pose.flipX);
    entry.sprite.anims.stop();
    if (!entry.spriteKey) return;
    const frame = overworldSpriteFrame(entry.spriteKey, pose.facing);
    if (frame !== null) entry.sprite.setFrame(frame);
  }

  /** Plays a walking trainer's cycle for a step direction, keeping its flip. */
  private playTrainerWalk(entry: TrainerSpriteEntry, facing: Facing): void {
    const pose = trainerFacingPose(facing);
    entry.sprite.setFlipX(pose.flipX);
    if (!entry.spriteKey) return;
    const key = trainerWalkAnimKey(entry.spriteKey, pose.facing);
    if (this.anims.exists(key)) entry.sprite.play(key, true);
  }

  /** A route tile's centre in world pixels. */
  private centerX(tileX: number): number {
    return tileX * TILE_SIZE + TILE_SIZE / 2;
  }

  private centerY(tileY: number): number {
    return tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  /** Snaps the sprite to a tile, without a step. */
  private movePlayerTo(x: number, y: number): void {
    this.player = { x, y };
    // The 16x32 FRLG frame stands with its feet on the tile's bottom edge, the
    // same placement the route's trainers use.
    this.playerSprite.setPosition(this.centerX(x), this.centerY(y) + TILE_SIZE / 2);
    this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
    // A snap (a room change, a debug teleport) leaves the follower on the player's
    // own tile; it only trails once a step is taken.
    this.placeFollower(this.player.x, this.player.y);
    this.refreshGrassStep();
  }

  /** Parks the follower on a tile with no step, idling, when it has a sprite. */
  private placeFollower(tileX: number, tileY: number): void {
    const sprite = this.followerSprite;
    if (!sprite) return;
    sprite.setPosition(this.centerX(tileX), this.centerY(tileY) + TILE_SIZE / 2);
    sprite.setDepth(actorDepth(sprite.y));
    this.restFollower();
  }

  /**
   * Paints the player's own tall-grass rustle on the one sprite `drawEntities`
   * built: parked on the rest frame on the tile they occupy, hidden the moment they
   * leave the grass, so no other cell ever animates. Called from `movePlayerTo` and
   * the end of every step tween, never per frame.
   */
  private refreshGrassStep(): void {
    const sprite = this.grassStep;
    if (!sprite) return;
    sprite.anims.stop();
    if (!isGrassStepTile(this.map, this.player.x, this.player.y, this.grassTipKeys)) {
      sprite.setVisible(false);
      return;
    }
    const frames = grassRustleFrames(TILESETS[this.tilesetId].config);
    sprite
      .setPosition(this.centerX(this.player.x), this.centerY(this.player.y) + TILE_SIZE / 2)
      .setVisible(true);
    if (frames.length > 0) sprite.setFrame(frames[0]);
  }

  /**
   * The hit, once per step: the field's own rustle frames in order (`frames[1]` on),
   * `GRASS_STEP_MS` apart, then back to the rest frame the sequence parks on. The
   * cycle is a Phaser animation built once per sequence, so a beat costs no
   * allocation and nothing drives the sprite while the player stands still.
   */
  private playGrassRustle(): void {
    const sprite = this.grassStep;
    if (!sprite) return;
    const frames = grassRustleFrames(TILESETS[this.tilesetId].config);
    if (frames.length < 2) return;
    const key = `grass-rustle:${sprite.texture.key}:${frames.join('-')}`;
    if (!this.anims.exists(key)) {
      this.anims.create({
        key,
        frames: [...frames.slice(1), frames[0]].map((frame) => ({ key: sprite.texture.key, frame })),
        frameRate: 1000 / GRASS_STEP_MS,
        repeat: 0,
      });
    }
    sprite.anims.play(key);
  }

  /** Turns the sprite to face a direction, flipping the left-facing side frame. */
  private face(direction: MoveKey): void {
    this.facingDir = direction;
    this.facing = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'side';
    this.playerSprite.setFlipX(direction === 'right');
    this.followerSprite?.setFlipX(direction === 'right');
  }

  /** Pushes into a blocked tile: turn to face it and stand. */
  private faceIdle(direction: MoveKey): void {
    this.face(direction);
    this.settleMovement();
  }

  /** Plays the direction's walk cycle while a step is in flight. */
  private walkStep(direction: MoveKey, to: Tile): void {
    this.face(direction);
    const running = this.settings.alwaysRun || (this.runKey?.isDown ?? false);
    this.playerSprite.anims.timeScale = playerWalkTimeScale(running, WALK_STEP_MS, RUN_STEP_MS);
    this.playerSprite.play(playerWalkAnimKey(this.facing), true);
    this.walkTween = this.tweens.add({
      targets: this.playerSprite,
      x: this.centerX(to.x),
      y: this.centerY(to.y) + TILE_SIZE / 2,
      duration: running ? RUN_STEP_MS : WALK_STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        this.walkTween = null;
        this.player = { x: to.x, y: to.y };
        this.refreshGrassStep();
        this.onTileEntered(direction);
      },
    });
    // The follower trails by exactly one tile: it steps onto the tile the player is
    // leaving, on the player's own cadence and run factor, so the two land together.
    this.followStep(running);
  }

  /**
   * Stands still and shows the resting frame of the current facing. Runs even
   * while the walk cycle is idle, so pushing into a blocked tile still turns the
   * sprite toward it instead of leaving the previous pose.
   */
  private settleMovement(): void {
    if (this.walkTween) return;
    if (this.playerSprite.anims.isPlaying) this.playerSprite.anims.stop();
    this.playerSprite.setFrame(playerSpriteFrame(this.facing));
    this.restFollower();
  }

  /**
   * Keeps the follower in step with the party's lead: the pair is resolved and
   * loaded once per lead species, so a lead change pays one load and a re-lead
   * costs none. Called from `refreshHud`, never per frame.
   */
  private refreshFollower(): void {
    const leadId: string | null = this.run.party.length > 0 ? this.run.party[0].fighter.speciesId : null;
    if (leadId === this.followerSpecies) return;
    // A load already in flight must finish first: returning here keeps the guard
    // unconsumed, so the next HUD repaint retries and a lead change is not lost.
    if (this.load.isLoading()) return;
    const sheet = leadId === null ? null : pokemonOverworldSheet(leadId);
    if (sheet && !this.textures.exists(sheet.textureKey)) {
      this.queueFollowerLoad(sheet);
      return;
    }
    this.followerSpecies = leadId;
    this.buildFollower(sheet);
  }

  /** Queues a pair's spritesheet and builds the follower once the loader completes. */
  private queueFollowerLoad(sheet: PokemonOverworldSheet): void {
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.followerSpecies = sheet.speciesId;
      this.buildFollower(sheet);
    });
    this.load.spritesheet(sheet.textureKey, sheet.url, {
      frameWidth: sheet.size,
      frameHeight: sheet.size,
    });
    // A loader only starts itself inside a scene's `preload`, so a queue built at
    // run time (a lead change) is started by hand.
    this.load.start();
  }

  /**
   * Builds the follower sprite for a pair, snapped to the player's own tile, or
   * clears it for a lead the manifest carries no art for. The texture is
   * registered once per file id and the strips once per key, so a re-lead is free.
   */
  private buildFollower(sheet: PokemonOverworldSheet | null): void {
    this.destroyFollower();
    this.followerSheet = sheet;
    if (!sheet) return;
    this.registerFollowerAnims(sheet);
    const footY = this.centerY(this.player.y) + TILE_SIZE / 2;
    const sprite = this.add
      .sprite(this.centerX(this.player.x), footY, sheet.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / sheet.size)
      .setDepth(actorDepth(footY))
      .setFlipX(this.facingDir === 'right');
    this.followerSprite = sprite;
    this.entitySprites.push(sprite);
    this.hudCamera?.ignore([sprite]);
    this.restFollower();
  }

  /** Registers a pair's idle and walk strips, once per animation key. */
  private registerFollowerAnims(sheet: PokemonOverworldSheet): void {
    for (const anim of followerAnims(sheet)) {
      if (this.anims.exists(anim.key)) continue;
      this.anims.create({
        key: anim.key,
        frames: anim.frames.map((frame) => ({ key: sheet.textureKey, frame })),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      });
    }
  }

  /** Drops the follower sprite and its in-flight step, leaving the texture loaded. */
  private destroyFollower(): void {
    this.followerTween?.remove();
    this.followerTween = null;
    this.followerSprite?.destroy();
    this.followerSprite = null;
  }

  /**
   * Steps the follower onto the tile the player is leaving, over the player's own
   * step duration and at its run factor, so the two tweens start and end together.
   */
  private followStep(running: boolean): void {
    const sprite = this.followerSprite;
    const sheet = this.followerSheet;
    if (!sprite || !sheet) return;
    const key = followerAnimKey(sheet, this.facing, 'walk');
    sprite.anims.timeScale = playerWalkTimeScale(running, WALK_STEP_MS, RUN_STEP_MS);
    if (this.anims.exists(key)) sprite.play(key, true);
    this.followerTween?.remove();
    this.followerTween = this.tweens.add({
      targets: sprite,
      x: this.centerX(this.player.x),
      y: this.centerY(this.player.y) + TILE_SIZE / 2,
      duration: running ? RUN_STEP_MS : WALK_STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        this.followerTween = null;
      },
    });
  }

  /**
   * Plays the follower's facing's looping idle strip, so it breathes while it stands
   * with the player. The strip is a loop, so re-entering rest does not restart it and
   * the walk path's run factor is dropped back to normal speed.
   */
  private restFollower(): void {
    const sprite = this.followerSprite;
    const sheet = this.followerSheet;
    if (!sprite || !sheet) return;
    sprite.anims.timeScale = 1;
    const key = followerAnimKey(sheet, this.facing, 'idle');
    if (this.anims.exists(key)) sprite.play(key, true);
  }

  private onTileEntered(direction: MoveKey): void {
    // A step re-paints the hidden archetypes' sprites before anything else: a
    // battle this step opens must not leave them drawn.
    this.refreshTrainerVisibility();
    // A door on the border changes room (or steps through the open portal).
    if (this.tryLeaveRoom(direction)) return;
    const grassy = isGrassStepTile(this.map, this.player.x, this.player.y, this.grassTipKeys);
    if (grassy && !this.ignoreEncounters) {
      // A step that lands in the grass plays the field's own rustle once.
      this.playGrassRustle();
      const encounter = this.encounters.step();
      if (encounter) {
        // A wild roll that actually happened spends the magician's type, so the
        // next grass step rolls the whole band again (`docs/routes-spec.md` §3).
        if (this.run.modifiers.nextWildType !== null) {
          this.run = { ...this.run, modifiers: withoutNextWildType(this.run.modifiers) };
          this.encounters.setTypeFilter(null);
          this.persistRun();
        }
        this.startBattle({
          kind: 'wild',
          speciesId: encounter.speciesId,
          level: encounter.level,
          shiny: encounter.shiny,
          key: `grass:${this.player.x},${this.player.y}`,
          tile: { x: this.player.x, y: this.player.y },
        });
        return;
      }
    }
    // Stepping into a trainer's cone makes it walk over and start the battle.
    const spotter = this.trainerSpotted();
    if (spotter) this.beginChase(spotter);
  }

  /**
   * Leaving the room through a door (`docs/maps-spec.md` §2): a link enters the
   * grid neighbour by its opposite edge (`advanceRoute`), and the boss room's
   * open portal crosses to the next map (`advanceMap`, with its heal stop). Only a
   * step taken **toward** the border counts, so walking along the gap of a wide
   * opening (or spawning on it) never bounces back. The arrival door counts too,
   * so a room can always be walked back. The dev generator/import tools have no
   * plan, so they never transition.
   */
  private tryLeaveRoom(direction: MoveKey): boolean {
    const room = this.room;
    const plan = this.plan;
    if (!room || !plan) return false;
    const edge = this.doorEdgeAt(this.player, direction);
    if (!edge) return false;
    // The boss room's only door is the way in, and it stays barred while the boss
    // stands (`docs/maps-spec.md` §6): the step is not a room change, so nothing is
    // committed, persisted or re-rolled.
    if (bossRoomSealed(room.boss, this.run.bossDefeated)) return false;
    if (room.portalEdge !== null && room.portalOpen && edge === room.portalEdge) {
      const before = this.run;
      const advanced = advanceMap(before);
      const hatch = hatchEgg(advanced);
      const afterAdvance = hatch ? hatch.run : advanced;
      this.transitionTo(afterAdvance);
      const met = missionCompletedBy(before, afterAdvance);
      // One notice at a time, and the hatch is the rarer beat.
      if (hatch) this.showNotice(eggHatchNotice(this.memberName(hatch.member)));
      else if (met) this.showNotice(missionCompleteNotice(t(met.nameKey)));
      return true;
    }
    const next = roomAcross(plan, room.roomId, edge);
    if (next === undefined) return false;
    // Leave by `edge`, arrive by its opposite (`docs/maps-spec.md` §2).
    this.transitionTo(advanceRoute(this.run, next, OPPOSITE_EDGE[edge]));
    return true;
  }

  /**
   * The map edge a **door** cell exits through: a passable tile of the room's
   * opening on that edge (an opening is a gap a couple of tiles wide, so the player
   * can leave from any of its cells), when the step that landed on it was taken
   * toward that border. A wall, a decorative tree tip on the border or a step
   * along the gap is not a door. Null for a non-border cell.
   */
  private doorEdgeAt(tile: Tile, direction: MoveKey): MapEdge | null {
    const approach = MOVE_STEP[direction];
    const approachEdge = approach.x > 0 ? 'E' : approach.x < 0 ? 'W' : approach.y > 0 ? 'S' : 'N';
    const room = this.room;
    if (room) {
      const edges = room.openings.map((opening) => opening.edge);
      return exitEdgeAt(this.map, this.route.width, this.route.height, edges, tile, approachEdge);
    }
    // No plan (the dev generator/import tools): the seeded tiles are the only guide.
    const edge = borderEdge(tile, this.route.width, this.route.height);
    if (!edge || edge !== approachEdge) return null;
    const isDoor =
      (this.route.entry.x === tile.x && this.route.entry.y === tile.y) ||
      this.route.exits.some((exit) => exit.x === tile.x && exit.y === tile.y);
    return isDoor ? edge : null;
  }

  /**
   * Rebuilds the scene for the room the run just entered: build the plan room,
   * redraw its tiles, items and trainers and spawn the player on its entry tile.
   * The run's state already carries the new map position.
   */
  private transitionTo(run: RunState, options?: TransitionOptions): void {
    const fromRoom = this.room;
    const fromMap = this.run.mapIndex;
    const tile = { x: this.player.x, y: this.player.y };
    this.run = run;
    this.persistRun();
    this.stopWalking();
    this.closePanel();
    // The reward card is floating, so a player who walks out with it up must not
    // carry it into the next room; closing runs its stored callback exactly once.
    this.closeMiniBossReward();
    this.clearRouteSprites();
    this.buildRoom();
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = options?.keepPosition === true ? tile : { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    this.refreshTrainerVisibility();
    const bounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    const picks = this.applyMapPassives('room');
    this.showPassivePickups(picks);
    this.refreshHud();
    // One room entry, one banner: the boss-fall rebuild is the same room with its
    // portal now open, so it greets nobody, while every door and the portal do.
    const entered = !fromRoom || fromMap !== this.run.mapIndex || fromRoom.roomId !== this.room?.roomId;
    if (entered) this.showAreaPanel();
  }

  /**
   * Redraws the room it is standing in after the run changed something the build reads
   * (the gate's opening): the room's build re-reads the `gate` flag, the player keeps
   * their tile and the room's **live** encounter sequence is carried over, so reopening
   * a seal can never restart the room's grass rolls.
   */
  private rebuildRoom(): void {
    if (!this.room) return;
    const tile = { x: this.player.x, y: this.player.y };
    const encounters = this.encounters;
    this.clearRouteSprites();
    this.buildRoom();
    this.encounters = encounters;
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = tile;
    this.movePlayerTo(tile.x, tile.y);
    this.refreshTrainerVisibility();
    this.refreshHud();
  }

  /**
   * Removes a beaten trainer's sprite and bookkeeping from the live route, so it
   * is never iterated again (a spinner's turn, a chase). Idempotent.
   */
  private removeTrainerSprite(trainerId: string): void {
    const index = this.trainerSprites.findIndex((entry) => entry.trainer.id === trainerId);
    if (index < 0) return;
    const [entry] = this.trainerSprites.splice(index, 1);
    this.tweens.killTweensOf(entry.sprite);
    const entityIndex = this.entitySprites.indexOf(entry.sprite);
    if (entityIndex >= 0) this.entitySprites.splice(entityIndex, 1);
    entry.sprite.destroy();
    this.trainerSpinIndex.delete(trainerId);
    this.trainerFacing.delete(trainerId);
  }

  /** The first undefeated trainer whose line of sight holds the player. */
  private trainerSpotted(): RouteTrainer | null {
    if (this.ignoreTrainers) return null;
    for (const trainer of this.route.trainers) {
      if (isTrainerDefeated(this.run, trainer.id)) continue;
      if (seesPlayer(this.route, this.effectiveTrainer(trainer), this.player, this.moveMap))
        return trainer;
    }
    return null;
  }

  /** The trainer as the scene currently poses it (a spinner's live facing). */
  private effectiveTrainer(trainer: RouteTrainer): RouteTrainer {
    const facing = this.trainerFacing.get(trainer.id);
    return facing && facing !== trainer.facing ? { ...trainer, facing } : trainer;
  }

  /** The trainer on `tile`, unless it has already been beaten on this route. */
  private liveTrainerAt(tile: Tile): RouteTrainer | undefined {
    const trainer = trainerAt(this.route, tile);
    return trainer && !isTrainerDefeated(this.run, trainer.id) ? trainer : undefined;
  }

  /** True when `tile` is the counter a room's fixture placed (a blocking fixture). */
  private shopCounterAt(tile: Tile): boolean {
    return this.shopCounter !== null && tile.x === this.shopCounter.x && tile.y === this.shopCounter.y;
  }

  /** True when the room's live special NPC stands on `tile`, so it blocks like an object. */
  private npcBlocks(tile: Tile): boolean {
    return this.npc !== null && tile.x === this.npc.tile.x && tile.y === this.npc.tile.y;
  }

  /**
   * Starts the classic "spotted you" beat: the trainer faces the player and
   * walks toward them tile by tile, then the battle opens. The player's input is
   * frozen while it happens, so the chase plays out like the originals.
   */
  private beginChase(trainer: RouteTrainer): void {
    if (this.chase || this.pendingBattle || this.gameOver) return;
    if (isTrainerDefeated(this.run, trainer.id)) return;
    const entry = this.trainerSprites.find((candidate) => candidate.trainer.id === trainer.id);
    if (!entry) {
      this.startTrainerBattle(trainer);
      return;
    }
    // Re-paint the sprites for the player's tile, then force the chased one on
    // screen: a ninja must be visible while it dashes in.
    this.refreshTrainerVisibility();
    entry.sprite.setVisible(true);
    this.stopWalking();
    this.touch?.release();
    this.chase = { entry, position: { ...trainer.position } };
    this.stepChase(0);
  }

  /** One chase step: walk closer, or open the battle once adjacent/stuck. */
  private stepChase(steps: number): void {
    const chase = this.chase;
    if (!chase) return;
    const here = chase.position;
    const adjacent = Math.abs(here.x - this.player.x) + Math.abs(here.y - this.player.y) <= 1;
    if (adjacent || steps > chase.entry.trainer.sight + 2) {
      this.finishChase();
      return;
    }
    const next = this.chaseStep(here, this.player);
    if (!next) {
      this.finishChase();
      return;
    }
    chase.position = next;
    this.playTrainerWalk(chase.entry, stepFacing(here, next));
    chase.entry.sprite.setDepth(actorDepth(this.centerY(next.y) + TILE_SIZE / 2));
    this.tweens.add({
      targets: chase.entry.sprite,
      x: this.centerX(next.x),
      y: this.centerY(next.y) + TILE_SIZE / 2,
      duration: TRAINER_CHASE_STEP_MS,
      ease: 'Linear',
      onComplete: () => this.stepChase(steps + 1),
    });
  }

  /** The next tile toward `target`, avoiding walls, items and other trainers. */
  private chaseStep(from: Tile, target: Tile): Tile | null {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const order: Tile[] =
      Math.abs(dx) >= Math.abs(dy)
        ? [
            { x: Math.sign(dx), y: 0 },
            { x: 0, y: Math.sign(dy) },
          ]
        : [
            { x: 0, y: Math.sign(dy) },
            { x: Math.sign(dx), y: 0 },
          ];
    for (const step of order) {
      if (step.x === 0 && step.y === 0) continue;
      const next = { x: from.x + step.x, y: from.y + step.y };
      if (Math.abs(next.x - target.x) + Math.abs(next.y - target.y) >= Math.abs(dx) + Math.abs(dy)) {
        continue;
      }
      if (!inBounds(this.moveMap, next) || !isWalkable(this.moveMap, next)) continue;
      if (this.itemBlocks(next)) continue;
      if (this.liveTrainerAt(next) || (next.x === target.x && next.y === target.y)) continue;
      return next;
    }
    return null;
  }

  /** Ends the chase: the trainer faces the player and the battle opens. */
  private finishChase(): void {
    const chase = this.chase;
    if (!chase) return;
    this.chase = null;
    const facing: Facing =
      this.player.x < chase.position.x
        ? 'W'
        : this.player.x > chase.position.x
          ? 'E'
          : this.player.y < chase.position.y
            ? 'N'
            : 'S';
    this.trainerFacing.set(chase.entry.trainer.id, facing);
    this.faceTrainerSprite(chase.entry, facing);
    this.startTrainerBattle(chase.entry.trainer);
  }

  /** Opens the menu battle against a trainer, with a roster seeded for that id. */
  private startTrainerBattle(trainer: RouteTrainer): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    if (isTrainerDefeated(this.run, trainer.id)) return;
    const archetype = getTrainerArchetype(trainer.archetypeId);
    if (!archetype) return;
    const band = this.room
      ? bandForMap(this.room.mapIndex)
      : runBand(this.run.seed, this.route.routeIndex);
    const mapIndex = this.room ? this.room.mapIndex : null;
    const isBoss = mapIndex !== null && trainer.id === bossTrainerId(mapIndex);
    const isMiniBoss = mapIndex !== null && trainer.id === miniBossTrainerId(mapIndex);
    const kind: BossPartyKind | null = isBoss ? 'boss' : isMiniBoss ? 'miniboss' : null;
    // The map boss fields a fixed max-level party (six, three on map 1) and the
    // mini-boss a fixed band-level party (three, two on map 1), both allowed a Mega
    // Stone; a regular trainer keeps its band's size (`src/data/bosses.ts`).
    const rosterBand = isBoss ? { ...band, minLevel: band.maxLevel } : band;
    const key =
      isBoss && this.room
        ? `${this.run.seed}:boss:${this.room.mapIndex}`
        : isMiniBoss && this.room
          ? `${this.run.seed}:miniboss:${this.room.mapIndex}`
          : `${this.run.seed}:trainer:${this.route.routeIndex}:${trainer.id}`;
    const roster = trainerRoster(rosterBand, new Rng(hashSeed(key)), trainer.id, {
      allowMega: isBoss || isMiniBoss || archetype.carriesMega === true,
      boss: isBoss || isMiniBoss,
      ...(kind !== null && mapIndex !== null ? { count: bossPartySize(kind, mapIndex) } : {}),
      // A regular trainer's level is a percentage of the live squad level by its own
      // party size, capped at the floor's ceiling (`docs/maps-spec.md` §5, D35); the
      // boss and the mini-boss keep the band draw they shipped with.
      ...(kind === null
        ? { levelFor: (size: number) => trainerLevel(squadLevel(this.run), size, band.maxLevel) }
        : {}),
    });
    this.startBattle({
      kind: 'trainer',
      trainerId: trainer.id,
      trainerName: archetype.name,
      roster: withForcedAbility(roster, archetype),
      archetypeId: archetype.id,
    });
  }

  /** Opens a room's own wild battle through the shipped wild path (`startBattle`). */
  private startRoomWildBattle(encounter: RoomWildBattle): void {
    this.startBattle({
      kind: 'wild',
      speciesId: encounter.speciesId,
      level: encounter.level,
      key: encounter.key,
    });
  }

  /** Fields the row's own trainer where the NPC stands (the Mega Stone keeper). */
  private startNpcBattle(row: NpcRow, mapIndex: number, roomId: number): void {
    const battle = row.battle;
    const tile = this.npc?.tile;
    if (!battle || !tile) return;
    this.npcBattle = { row, mapIndex, roomId };
    this.startTrainerBattle({
      id: npcTrainerId(mapIndex, roomId, row.id),
      position: tile,
      facing: 'S',
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: battle.archetypeId,
    });
    if (!this.pendingBattle) this.npcBattle = null;
  }

  /**
   * The interact key (`E` by default): take the ground item the player faces, or
   * the one underfoot. Hidden items show only a faint sparkle, so this is how
   * they are found. Ignored while a battle or a beat owns the screen.
   */
  private tryInteract(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    const step = MOVE_STEP[this.facingDir];
    const ahead = { x: this.player.x + step.x, y: this.player.y + step.y };
    // A room that answers the interact key (a casino machine, a trade counter)
    // consumes it first.
    if (this.specialDescriptor()?.interact?.(this.roomHost(), ahead) === true) return;
    // The room's own special NPC answers next, before any trainer's sight.
    if (this.talkToNpc(ahead)) return;
    // Talking to a trainer it is facing also opens the battle, like the originals.
    const trainer = this.liveTrainerAt(ahead);
    if (trainer) {
      this.startTrainerBattle(trainer);
      return;
    }
    if (!this.collectItemAt(ahead)) this.collectItemAt(this.player);
  }

  /**
   * Opens the special NPC's card when the player faces it, consuming the key.
   * False when no NPC stands there, so the key falls through to the trainer and
   * the ground-item checks unchanged.
   */
  private talkToNpc(tile: Tile): boolean {
    const npc = this.npc;
    if (!npc || npc.tile.x !== tile.x || npc.tile.y !== tile.y) return false;
    if (!this.panelOpen()) this.openNpcCard(npc);
    return true;
  }

  /**
   * Opens one NPC's card: its name, its greeting and its own rows plus `LEAVE`.
   * A one-shot row already used on this floor prints `npc.used` instead and offers
   * no choices, so only `LEAVE` remains; a `repeatable` row (the merchant) always
   * answers again.
   */
  private openNpcCard(npc: RoomNpc): void {
    const room = this.room;
    if (!room) return;
    const used =
      npc.row.repeatable !== true &&
      isItemPicked(this.run, npcUseId(room.mapIndex, room.roomId, npc.row.id));
    const choices = used
      ? []
      : (npc.row.choices ?? []).map((choice) => ({ id: choice.id, label: t(choice.label) }));
    this.openNpcCardView(
      {
        title: t(npc.row.nameKey),
        paragraph: used ? t('npc.used') : t(npc.row.greetingKey),
        choices,
      },
      (choiceId) => this.chooseNpc(npc.row, room.mapIndex, room.roomId, choiceId),
    );
  }

  /**
   * Opens one `npcPanel` card and keeps the scene's keyboard slot coherent: the
   * shell closes itself after firing a choice, and on `LEAVE` or `cancel` it closes
   * without one, so the slot is cleared on those too (`close()` is idempotent).
   */
  private openNpcCardView(view: NpcPanelView, onChoose?: (id: string) => void): void {
    let chosen = false;
    const panel = openNpcPanel(this, view, (id) => {
      chosen = true;
      onChoose?.(id);
    });
    this.openPanel({
      handle: (action) => {
        chosen = false;
        panel.handle(action);
        if (!chosen && (action === 'confirm' || action === 'interact' || action === 'cancel')) {
          this.closePanel();
        }
      },
      close: () => panel.close(),
    });
  }

  /**
   * Resolves the row the card accepted (`docs/maps-spec.md` §7). The **merchant**
   * opens the Mart and marks no use, so the merchant is there for the rest of the
   * floor; the tutor opens its move card, the four re-rolls open the member card and
   * the sacrifice draws its own member. The four run-modifier rows each commit one
   * fact — the curse, the forced sky, the narrowed wild type or the gate's item —
   * beside their use mark. Every other row records
   * `npc-<mapIndex>-<roomId>-<id>` in `pickedItems`, which `advanceMap` clears, so a
   * revisit and a reload know the card was taken.
   */
  private chooseNpc(row: NpcRow, mapIndex: number, roomId: number, _choiceId: string): void {
    switch (row.id) {
      case 'merchant':
        this.closePanel();
        openMart(this.roomHost());
        return;
      case 'tutor':
        this.closePanel();
        this.openTutorMoves(row, mapIndex, roomId);
        return;
      case 'nature':
      case 'ability':
      case 'iv-judge':
      case 'species':
        this.closePanel();
        this.openMemberCard(row, mapIndex, roomId, null);
        return;
      case 'sacrifice':
        this.closePanel();
        this.applyMemberEdit(row, mapIndex, roomId, sacrifice(this.run, this.npcContext(row, roomId)));
        return;
      case 'exorcist':
        this.commitNpcModifiers(
          row,
          mapIndex,
          roomId,
          withCurse(this.run.modifiers),
          t('npc.exorcist.done'),
        );
        return;
      case 'weather-man': {
        const field = npcForcedField(this.run.seed, roomId, row.id);
        this.commitNpcModifiers(
          row,
          mapIndex,
          roomId,
          withForcedField(this.run.modifiers, field.id),
          t('npc.weather.done', { floors: FORCED_FIELD_FLOORS }),
        );
        return;
      }
      case 'magician': {
        const typeId = npcWildType(this.run.seed, roomId, row.id);
        // The room on screen obeys the new type at once, so the card's promise is
        // true before the next room rebuild reads the saved modifier.
        this.encounters.setTypeFilter(typeId);
        this.commitNpcModifiers(
          row,
          mapIndex,
          roomId,
          withNextWildType(this.run.modifiers, typeId),
          t('npc.magician.done', { type: this.typeName(typeId) }),
        );
        return;
      }
      case 'type-gate': {
        const grant = row.grant;
        if (!grant) return;
        if (!partyHasType(this.run, grant.types)) {
          this.showNpcResult(row, t('npc.gate.refused'));
          return;
        }
        this.commitNpcResult(
          row,
          mapIndex,
          roomId,
          addItem(this.run, grant.itemId, 1),
          t('npc.gate.granted', { item: getItem(grant.itemId)?.name ?? grant.itemId }),
        );
        return;
      }
      case 'medic': {
        const healed = medicHeal(this.run, mapIndex, roomId);
        this.closePanel();
        this.commitRun(healed);
        this.showNpcResult(row, t('npc.medic.done'));
        return;
      }
      case 'chef':
        this.closePanel();
        this.openMemberCard(row, mapIndex, roomId, null);
        return;
      case 'berry-tree': {
        const berries = npcBerryHarvest(this.run.seed, roomId, row.id);
        let run = this.run;
        for (const berry of berries) run = addItem(run, berry);
        run = markItemPicked(run, npcUseId(mapIndex, roomId, row.id));
        this.closePanel();
        this.commitRun(run);
        const band = bandForMap(mapIndex);
        const wild = npcTreeWild(run.seed, roomId, row.id, this.encounters.currentTable(), (rng) =>
          rollWildLevel(rng, squadLevel(run), band.maxLevel),
        );
        if (wild) {
          this.startBattle(
            {
              kind: 'wild',
              speciesId: wild.speciesId,
              level: wild.level,
              shiny: wild.shiny,
              key: `npc:${roomId}:${row.id}`,
            },
            { noFlee: true, enemyBoosts: BERRY_TREE_ENEMY_BOOSTS },
          );
        }
        return;
      }
      case 'mega-stone':
        this.closePanel();
        this.startNpcBattle(row, mapIndex, roomId);
        return;
      default:
        this.commitRun(markItemPicked(this.run, npcUseId(mapIndex, roomId, row.id)));
        this.closePanel();
    }
  }

  /** The room's own stream context, shared by every member-edit operation. */
  private npcContext(row: NpcRow, roomId: number): Readonly<{ roomIndex: number; npcId: string }> {
    return { roomIndex: roomId, npcId: row.id };
  }

  /** The tutor's move card: `TUTOR_MOVES` in table order, each name from the dex. */
  private openTutorMoves(row: NpcRow, mapIndex: number, roomId: number): void {
    this.openNpcCardView(
      {
        title: t(row.nameKey),
        paragraph: t(row.greetingKey),
        choices: TUTOR_MOVES.map((moveId) => ({
          id: moveId,
          label: getMove(moveId)?.name ?? moveId,
        })),
      },
      (moveId) => {
        this.closePanel();
        this.openMemberCard(row, mapIndex, roomId, moveId);
      },
    );
  }

  /**
   * The member card: the party only (never the box), one row per member. `moveId`
   * is the tutored move the tutor carried here; the other rows ignore it.
   */
  private openMemberCard(row: NpcRow, mapIndex: number, roomId: number, moveId: string | null): void {
    const members = this.run.party.slice(0, NPC_MAX_CHOICES);
    this.openNpcCardView(
      {
        title: t(row.nameKey),
        paragraph: t('npc.pickMember'),
        choices: members.map((member) => ({
          id: member.fighter.id,
          label: t('party.rowLabel', {
            name: this.memberName(member),
            level: member.fighter.level,
            status: '',
          }),
        })),
      },
      (memberId) => {
        this.closePanel();
        this.chooseMember(row, mapIndex, roomId, memberId, moveId);
      },
    );
  }

  /**
   * Applies the row's edit to the picked member, or opens the tutor's slot card
   * first when the member already holds four moves.
   */
  private chooseMember(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    memberId: string,
    moveId: string | null,
  ): void {
    const ctx = this.npcContext(row, roomId);
    const member = this.run.party.find((entry) => entry.fighter.id === memberId);
    if (!member) return;
    switch (row.id) {
      case 'tutor': {
        const move = moveId ?? '';
        if (member.fighter.moves.length >= MAX_MOVES) {
          this.openSlotCard(row, mapIndex, roomId, memberId, move);
          return;
        }
        this.applyMemberEdit(row, mapIndex, roomId, teachMove(this.run, memberId, move, null));
        return;
      }
      case 'nature':
        this.applyMemberEdit(row, mapIndex, roomId, rerollNature(this.run, memberId, ctx));
        return;
      case 'ability':
        this.applyMemberEdit(row, mapIndex, roomId, rerollAbility(this.run, memberId, ctx));
        return;
      case 'iv-judge':
        this.applyMemberEdit(row, mapIndex, roomId, rerollIvs(this.run, memberId, ctx));
        return;
      case 'species':
        this.applyMemberEdit(row, mapIndex, roomId, swapSpecies(this.run, memberId, ctx));
        return;
      case 'chef': {
        const trade = chefTrade(this.run, memberId);
        if (!trade.ok) {
          this.showNpcResult(row, t(CHEF_REFUSALS[trade.reason]));
          return;
        }
        const holder = this.memberById(trade.memberId);
        const name = holder ? this.memberName(holder) : t('common.unknownPokemon');
        this.commitRun(markItemPicked(trade.run, npcUseId(mapIndex, roomId, row.id)));
        this.showNpcResult(
          row,
          t('npc.chef.done', { name, item: getItem(trade.dishId)?.name ?? trade.dishId }),
        );
        return;
      }
      default:
        return;
    }
  }

  /** The tutor's four rows, when the member must forget one to hold the new move. */
  private openSlotCard(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    memberId: string,
    moveId: string,
  ): void {
    const member = this.run.party.find((entry) => entry.fighter.id === memberId);
    if (!member) return;
    const slots = member.fighter.moves.slice(0, MAX_MOVES);
    this.openNpcCardView(
      {
        title: t(row.nameKey),
        paragraph: t('npc.pickSlot'),
        choices: slots.map((slot, index) => ({
          id: String(index),
          label: getMove(slot.moveId)?.name ?? slot.moveId,
        })),
      },
      (choiceId) => {
        this.closePanel();
        const slot = Number.parseInt(choiceId, 10);
        this.applyMemberEdit(
          row,
          mapIndex,
          roomId,
          teachMove(this.run, memberId, moveId, Number.isInteger(slot) ? slot : null),
        );
      },
    );
  }

  /**
   * Commits a successful edit **plus** its use mark in one write, marks nothing on a
   * refusal, and prints the result or the refusal on the row's card.
   */
  private applyMemberEdit(row: NpcRow, mapIndex: number, roomId: number, edit: MemberEdit): void {
    if (!edit.ok) {
      this.showNpcResult(row, t(NPC_REFUSALS[edit.reason]));
      return;
    }
    const edited = this.memberById(edit.memberId);
    const name = edited ? this.memberName(edited) : t('common.unknownPokemon');
    this.commitRun(markItemPicked(edit.run, npcUseId(mapIndex, roomId, row.id)));
    this.showNpcResult(row, this.memberEditParagraph(edit.line, name));
  }

  /** The result card: the row's name as its title and one line, no choices. */
  private showNpcResult(row: NpcRow, paragraph: string): void {
    this.openNpcCardView({ title: t(row.nameKey), paragraph, choices: [] });
  }

  /**
   * Commits one run fact **plus** its use mark in one write and prints the row's
   * result card, so a modifier row leaves exactly one run write behind on its floor.
   */
  private commitNpcResult(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    run: RunState,
    paragraph: string,
  ): void {
    this.commitRun(markItemPicked(run, npcUseId(mapIndex, roomId, row.id)));
    this.showNpcResult(row, paragraph);
  }

  /** The same commit, for a row whose one fact is the run's `modifiers` record. */
  private commitNpcModifiers(
    row: NpcRow,
    mapIndex: number,
    roomId: number,
    modifiers: RunModifiers,
    paragraph: string,
  ): void {
    this.commitNpcResult(row, mapIndex, roomId, { ...this.run, modifiers }, paragraph);
  }

  /** The dex's own English name for a normalized type id, or the id itself. */
  private typeName(typeId: string): string {
    return TYPE_NAMES.find((name) => normalizeId(name) === typeId) ?? typeId;
  }

  /** The party or box member `memberId` names, in the run **before** the edit. */
  private memberById(memberId: string): RunPokemon | undefined {
    return (
      this.run.party.find((entry) => entry.fighter.id === memberId) ??
      this.run.box.find((entry) => entry.fighter.id === memberId)
    );
  }

  /** One `MemberEditLine` as the sentence the result card prints; names come from the dex. */
  private memberEditParagraph(line: MemberEditLine, name: string): string {
    switch (line.kind) {
      case 'tutor':
        return t('npc.result.tutor', {
          name,
          move: getMove(line.moveId)?.name ?? line.moveId,
        });
      case 'nature':
        return t('npc.result.nature', { name, nature: capitalize(line.nature) });
      case 'ability':
        return t('npc.result.ability', { name, ability: line.ability });
      case 'secondAbility':
        return t('npc.result.secondAbility', { name, ability: line.ability });
      case 'ivs':
        return t('npc.result.ivs', { name });
      case 'species':
        return t('npc.result.species', {
          name,
          species: getSpecies(line.speciesId)?.name ?? line.speciesId,
        });
      case 'sacrifice':
        return t('npc.result.sacrifice', {
          name,
          item: getItem(line.itemId)?.name ?? line.itemId,
          result: this.memberEditParagraph(line.reward, name),
        });
    }
  }

  /**
   * True when a **visible** unpicked ground item occupies `tile`, so movement is
   * blocked. Hidden items (the faint sparkle) never block: they are walked over
   * and picked up underfoot with the interact key.
   */
  private itemBlocks(tile: Tile): boolean {
    return this.route.items.some(
      (item) =>
        item.position.x === tile.x &&
        item.position.y === tile.y &&
        !item.hidden &&
        !isItemPicked(this.run, item.id),
    );
  }

  /** Takes the unpicked ground item on `tile`, saving it to the run's bag. */
  private collectItemAt(tile: Tile): boolean {
    const item = this.route.items.find(
      (candidate) =>
        candidate.position.x === tile.x &&
        candidate.position.y === tile.y &&
        !isItemPicked(this.run, candidate.id),
    );
    if (!item) return false;
    this.run = markItemPicked(addItem(this.run, item.itemId), item.id);
    this.persistRun();
    this.showNotice(itemPickupNotice(getItem(item.itemId)?.name ?? item.itemId));
    const sprite = this.itemSprites.find((entry) => entry.item.id === item.id);
    if (sprite) {
      this.tweens.killTweensOf(sprite.sprite);
      sprite.sprite.setVisible(false).setAlpha(0);
    }
    this.refreshHud();
    return true;
  }

  /** Opens the settings screen paused-on-top, like a battle (`Tab`). */
  private openSettings(): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Route' });
  }

  /**
   * The pause menu (ESC, or a left-edge swipe on a touch screen): a centred
   * window dimming the route with a Settings row and a Reset row. It does not
   * pause the scene — the route's update stops walking while it is up — so the
   * pad and A / B still drive it: up/down to pick, A to choose, B to close.
   */
  /**
   * The level-up popup: a centred window listing "X learned Y!" for every member
   * that crossed a move on the way up. Any key or a click dismisses it.
   */
  private buildLearnPopup(): void {
    const { width, height } = this.scale;
    const panelW = 560;
    const panelH = 220;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2;
    const scrim = this.add.rectangle(0, 0, width, height, 0x05070c, 0.55).setOrigin(0, 0);
    const panel = addFrlgWindow(this, x, y, panelW, panelH);
    this.learnPopupTitle = addFrlgText(this, x + 24, y + 18, t('hud.learnTitle'), {
      size: 32,
      tint: FRLG_INK,
    });
    this.learnPopupBody = addFrlgText(this, x + 24, y + 76, '', {
      size: 16,
      tint: FRLG_INK,
      lineSpacing: 8,
    }).setMaxWidth(panelW - 48);
    const hint = addFrlgText(this, x + panelW - 24, y + panelH - 30, t('hud.pressAnyKey'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    });
    const zone = this.add.zone(0, 0, width, height).setOrigin(0, 0);
    zone.setInteractive();
    zone.on('pointerdown', () => this.dismissLearnPopup());
    this.learnPopup = this.add
      .container(0, 0, [scrim, panel, this.learnPopupTitle, this.learnPopupBody, hint, zone])
      .setDepth(460)
      .setVisible(false);
    this.cameras.main.ignore(this.learnPopup);
  }

  /** Shows the learn popup for the level-up beats, or stays hidden if none learned. */
  private showLearnPopup(beats: readonly LevelUpBeat[]): void {
    if (this.learnPopupOpen) return;
    const lines: string[] = [];
    for (const beat of beats) {
      const member = this.run.party.find((entry) => entry.fighter.id === beat.id);
      const species = getSpecies(member?.fighter.speciesId ?? '');
      const name = member?.fighter.nickname ?? species?.name ?? t('common.unknownPokemon');
      for (const moveId of beat.learned) {
        lines.push(t('route.learned', { name, move: moveName(moveId) }));
      }
    }
    if (lines.length === 0) return;
    this.learnPopupTitle.setText(t('hud.learnTitle'));
    this.learnPopupBody.setText(lines.join('\n'));
    this.learnPopupOpen = true;
    this.learnPopupAt = this.time.now;
    this.learnPopup.setVisible(true);
  }

  /**
   * Shows the evolution popup ("X evolved into Y!") on the same window the level
   * up uses; any key or a click dismisses it like the learn popup.
   */
  private showEvoPopup(fromName: string, intoName: string): void {
    if (this.learnPopupOpen) return;
    this.learnPopupTitle.setText(t('hud.evolveTitle'));
    this.learnPopupBody.setText(t('route.evolved', { from: fromName, into: intoName }));
    this.learnPopupOpen = true;
    this.learnPopupAt = this.time.now;
    this.learnPopup.setVisible(true);
  }

  /**
   * Dismisses the learn/evolution popup, unless it was just opened: the click
   * that evolved a member also raises its pointerup, which must not close the
   * popup it just showed.
   */
  private dismissLearnPopup(): void {
    if (this.time.now - this.learnPopupAt < 250) return;
    this.closeLearnPopup();
  }

  /** Dismisses the learn/evolution popup; safe when it is not up. */
  private closeLearnPopup(): void {
    if (!this.learnPopupOpen) return;
    this.learnPopupOpen = false;
    this.learnPopup.setVisible(false);
  }

  /**
   * The transient notice strip (`src/ui/notice.ts`): one fixed FRLG textbox at the
   * top of the screen, built screen-space after the HUD camera exists so only the
   * pinned camera draws it, hidden until a notice arrives.
   */
  private buildNotice(): void {
    const width = Math.min(NOTICE_W, this.scale.width - 32);
    const x = (this.scale.width - width) / 2;
    // The strip is the same card as every other panel, and its text is the
    // card's own ink.
    const strip = addFrlgWindow(this, x, NOTICE_TOP, width, NOTICE_H);
    this.noticeText = addFrlgText(this, this.scale.width / 2, NOTICE_TOP + NOTICE_H / 2, '', {
      align: 'center',
      origin: 0.5,
      size: 16,
      tint: FRLG_INK,
    });
    this.noticeText.setMaxWidth(width - 32);
    this.noticeRoot = this.add.container(0, 0, [strip, this.noticeText]).setDepth(440).setVisible(false);
    this.cameras.main.ignore(this.noticeRoot);
  }

  /**
   * Floats one transient notice. One at a time: a second notice replaces the first
   * and restarts its hold. Nothing is blocked and no key is consumed.
   */
  private showNotice(notice: Notice): void {
    if (!this.noticeRoot || !this.noticeText) return;
    this.noticeText.setText(notice.text);
    this.noticeRoot.setVisible(true);
    this.noticeTimer?.remove(false);
    this.noticeTimer = this.time.delayedCall(notice.holdMs, () => this.hideNotice());
  }

  /** Takes the notice strip down; safe when it is not up. */
  private hideNotice(): void {
    this.noticeTimer?.remove(false);
    this.noticeTimer = null;
    this.noticeRoot?.setVisible(false);
  }

  /**
   * The area-entry panel (`src/ui/notice.ts`, `docs/routes-spec.md` §6): the boxed
   * banner that greets the player on entering a room, pinned under the mission
   * line, screen-space on the HUD camera like the strip and hidden until a room is
   * entered. It is the same `'window'` card as every other panel and the one card
   * whose 1px ring is the accent rather than the muted hairline.
   */
  private buildAreaPanel(): void {
    const width = Math.min(AREA_PANEL_W, this.scale.width - 32);
    const x = (this.scale.width - width) / 2;
    const card = addFrlgWindow(this, x, AREA_PANEL_TOP, width, AREA_PANEL_H, 'window');
    const hairline = this.add.graphics();
    hairline.lineStyle(1, FRLG_ACCENT, 1);
    hairline.strokeRect(x + 0.5, AREA_PANEL_TOP + 0.5, width - 1, AREA_PANEL_H - 1);
    this.areaPanelText = addFrlgText(this, this.scale.width / 2, AREA_PANEL_TOP + AREA_PANEL_H / 2, '', {
      align: 'center',
      origin: 0.5,
      size: 18,
      tint: FRLG_INK,
    });
    this.areaPanelText.setMaxWidth(width - 32);
    this.areaPanelRoot = this.add
      .container(0, 0, [card, hairline, this.areaPanelText])
      .setDepth(AREA_PANEL_DEPTH)
      .setVisible(false);
    this.cameras.main.ignore(this.areaPanelRoot);
  }

  /**
   * Names the area the run just walked into. No key, no scroll, no pause: the
   * banner is the room's greeting and the walk goes on under it. A no-op until the
   * panel is built and the scene has a route, so `applyRoute` may raise it during
   * `create`.
   */
  private showAreaPanel(): void {
    if (!this.areaPanelRoot || !this.areaPanelText || !this.route) return;
    const notice = areaEntryNotice(getBiome(this.route.biomeId).name);
    this.areaPanelText.setText(notice.text);
    this.areaPanelRoot.setVisible(true);
    this.areaPanelTimer?.remove(false);
    this.areaPanelTimer = this.time.delayedCall(notice.holdMs, () => this.hideAreaPanel());
  }

  /** Takes the area banner down; safe when it is not up. */
  private hideAreaPanel(): void {
    this.areaPanelTimer?.remove(false);
    this.areaPanelTimer = null;
    this.areaPanelRoot?.setVisible(false);
  }

  /**
   * The floor's mission line (`docs/routes-spec.md` §6): one card pinned under the
   * notice strip, screen-space on the HUD camera like the strip itself, hidden while
   * the run carries no mission row (an old save).
   */
  private buildMissionLine(): void {
    const x = (this.scale.width - MISSION_W) / 2;
    const card = addFrlgWindow(this, x, MISSION_TOP, MISSION_W, MISSION_H);
    this.hudMissionText = addFrlgText(this, this.scale.width / 2, MISSION_TOP + MISSION_H / 2, '', {
      align: 'center',
      origin: 0.5,
      size: 16,
      tint: FRLG_INK,
    });
    this.hudMissionText.setMaxWidth(MISSION_W - 32);
    this.missionRoot = this.add
      .container(0, 0, [card, this.hudMissionText])
      .setDepth(439)
      .setVisible(false);
    this.cameras.main.ignore(this.missionRoot);
  }

  /** The display name a notice uses: nickname, else species, the way `partyRow` reads it. */
  private memberName(member: RunPokemon): string {
    return (
      member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId
    );
  }

  private buildPauseMenu(): void {
    const { width, height } = this.scale;
    const panelH = 88 + PAUSE_MENU_ITEMS.length * PAUSE_MENU_ROW_H;
    const x = (width - PAUSE_MENU_W) / 2;
    const y = (height - panelH) / 2;
    const rowX = x + 24;
    const rowW = PAUSE_MENU_W - 48;

    const scrim = this.add.rectangle(0, 0, width, height, 0x05070c, 0.55).setOrigin(0, 0);
    const panel = addFrlgWindow(this, x, y, PAUSE_MENU_W, panelH);
    const title = addFrlgText(this, x + 24, y + 20, t('hud.menu'), { size: 32, tint: FRLG_INK });

    const children: Phaser.GameObjects.GameObject[] = [scrim, panel, title];
    this.pauseMenuRows = PAUSE_MENU_ITEMS.map((_item, i) => {
      const rowY = y + 76 + i * PAUSE_MENU_ROW_H;
      const highlight = this.add
        .rectangle(
          rowX,
          rowY,
          rowW,
          PAUSE_MENU_ROW_H - 8,
          FRLG_SELECTED_FILL.colour,
          FRLG_SELECTED_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const label = addFrlgText(this, rowX + 16, rowY + 12, t(PAUSE_MENU_LABELS[PAUSE_MENU_ITEMS[i]]), {
        size: 16,
        tint: FRLG_INK,
      });
      const zone = this.add.zone(rowX, rowY, rowW, PAUSE_MENU_ROW_H).setOrigin(0, 0);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.pauseMenuIndex = i;
        this.pauseMenuArmed = false;
        this.activatePauseMenu();
      });
      children.push(highlight, label, zone);
      return { highlight, label };
    });

    this.pauseMenu = this.add.container(0, 0, children).setDepth(450).setVisible(false);
    this.cameras.main.ignore(this.pauseMenu);
  }

  private openPauseMenu(): void {
    if (this.pauseMenuOpen || this.gameOver || this.pendingBattle || this.releaseRoot) return;
    // The pause menu takes the player away from the panel, so an in-progress
    // nickname edit is discarded (the phone's Back gesture can open it directly).
    this.cancelNicknameEdit();
    this.pauseMenuOpen = true;
    this.pauseMenuIndex = 0;
    this.pauseMenuArmed = false;
    this.settleMovement();
    this.touch?.release();
    this.pauseMenu.setVisible(true);
    this.refreshPauseMenu();
  }

  private closePauseMenu(): void {
    this.pauseMenuOpen = false;
    this.pauseMenuArmed = false;
    this.pauseMenu.setVisible(false);
  }

  /** The phone's Back gesture: closes the pause menu, or opens it when closed. */
  private onBackGesture(): void {
    if (!this.scene.isActive()) return;
    if (this.pauseMenuOpen) this.closePauseMenu();
    else this.openPauseMenu();
  }

  private handlePauseMenuAction(action: KeybindAction): void {
    switch (action) {
      case 'up':
        this.movePauseMenu(-1);
        return;
      case 'down':
        this.movePauseMenu(1);
        return;
      case 'confirm':
        this.activatePauseMenu();
        return;
      case 'cancel':
        this.closePauseMenu();
        return;
    }
  }

  private movePauseMenu(delta: number): void {
    const count = PAUSE_MENU_ITEMS.length;
    this.pauseMenuIndex = (this.pauseMenuIndex + delta + count) % count;
    this.pauseMenuArmed = false;
    this.refreshPauseMenu();
  }

  /** Runs the chosen row: Settings pauses onto it; Reset arms, then starts over. */
  private activatePauseMenu(): void {
    const item = PAUSE_MENU_ITEMS[this.pauseMenuIndex];
    if (item === 'settings') {
      this.closePauseMenu();
      this.openSettings();
      return;
    }
    if (!this.pauseMenuArmed) {
      this.pauseMenuArmed = true;
      this.refreshPauseMenu();
      return;
    }
    this.closePauseMenu();
    this.restartRun();
  }

  private refreshPauseMenu(): void {
    this.pauseMenuRows.forEach((row, i) => {
      row.highlight.setVisible(i === this.pauseMenuIndex);
      const reset = PAUSE_MENU_ITEMS[i] === 'reset';
      row.label.setText(
        reset && this.pauseMenuArmed ? t('pause.resetArmed') : t(PAUSE_MENU_LABELS[PAUSE_MENU_ITEMS[i]]),
      );
    });
  }

  /**
   * Called by `SettingsScene` before it closes: re-reads the preferences and
   * applies what changed (a rebind re-resolves the movement keys, and the
   * Transparent HUD option redraws the panels).
   */
  applySettings(): void {
    this.settings = loadSettings();
    this.reducedFlash = this.settings.reducedFlash;
    // A rebind happened behind this screen; re-resolve the movement keys so the
    // new keys are live the moment the route resumes.
    this.refreshMoveKeys();
    this.refreshPanelKeyLabels();
    // The Transparent HUD option may have changed.
    this.applyHudBackground();
  }

  /** Pauses the route and rolls the battle on top of it (Phase 5 transition). */
  private startBattle(trigger: BattleTrigger, extras: BattleExtras = {}): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.battleCounter += 1;
    const key =
      trigger.kind === 'wild' ? `${trigger.key}:${this.battleCounter}` : `trainer:${trigger.trainerId}`;
    // The room's capture is spent the moment its **first wild battle** starts,
    // whatever the outcome: catching, defeating or fleeing all close the window, so
    // only the first wild Pokémon that appears can be caught. The battle still
    // allows the catch (the flag is read before spending) and the route HUD and
    // minimap mark the room spent as soon as it is back.
    const captureAllowed = canCapture(this.run);
    const firstCatch = this.run.stats.catches === 0;
    if (trigger.kind === 'wild') {
      this.run = useCapture(this.run);
      this.persistRun();
    }
    const launch: BattleLaunch = {
      trigger,
      player: this.run.party.map((member) => member.fighter),
      xp: this.run.xp,
      bag: this.run.bag,
      seed: battleSeed(this.run.seed, this.run.routeIndex, key),
      runSeed: this.run.seed,
      routeIndex: this.run.routeIndex,
      canCapture: captureAllowed,
      firstCatch,
      // The difficulty the battle's AI reads from the launch (D46): the settings
      // are re-read whenever the options screen closes, so a change reaches the
      // next battle.
      aiLevel: this.settings.aiLevel,
      // The room's own condition, so every battle that starts here — trainers,
      // the boss and wilds alike — begins under it (`docs/maps-spec.md` §7). A sky
      // the weather man pinned replaces it for the floors it still covers.
      battlefield: this.forcedBattlefield() ?? this.battlefield,
      // The no-heal leaf's rule rides the launch too, so its trainer's battle and
      // any dev wild opened in the room both carry it.
      noHeal: this.room?.special === 'no-heal',
      // The boss room's battle is the map boss's own — a double battle on every
      // floor (`docs/maps-spec.md` §6); every other room's battles stay single.
      ...(this.room?.boss === true ? { double: bossIsDouble('boss') } : {}),
      // The banned-species leaf's rule rides the launch the same way: every battle
      // the room opens bars the party's most-used species from being sent out.
      bannedSpecies: this.room?.special === 'banned' ? bannedSpeciesOf(this.run) : null,
      // The berry tree's guardian forbids the flight (`runAway.ts`), unless an
      // escape effect (Run Away, the Smoke Ball) grants it.
      ...(extras.noFlee ? { noFlee: true } : {}),
      // The exorcist's hex, the boss room's opening and the guardian's own boost are
      // separate data rows on purpose: their keys never collide (atk, spe and def),
      // so the spread needs no arithmetic.
      ...(extras.enemyBoosts || this.bossOpening || this.run.modifiers.curse
        ? {
            enemyBoosts: {
              ...(extras.enemyBoosts ?? {}),
              ...(this.bossOpening?.boosts ?? {}),
              ...(this.run.modifiers.curse ? CURSE_ENEMY_BOOST : {}),
            },
          }
        : {}),
    };
    if (this.run.modifiers.curse) {
      this.run = { ...this.run, modifiers: withoutCurse(this.run.modifiers) };
      this.persistRun();
    }
    this.pendingBattle = launch;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /**
   * The condition a battle starts under when the run carries a forced sky: the
   * modifier's id resolved through `ROOM_BATTLEFIELDS`, or null for no sky and for
   * an id the table does not know.
   */
  private forcedBattlefield(): RoomBattlefield | null {
    const id = forcedFieldId(this.run.modifiers);
    if (id === null) return null;
    return ROOM_BATTLEFIELDS.find((row) => row.id === id) ?? null;
  }

  /**
   * Dev only: opens a battle against a chosen wild Pokémon from the debug menu.
   * Ignored while the route is paused behind another battle or the run is over.
   */
  startDebugWildBattle(speciesId: string, level: number): void {
    if (!IS_DEVELOP || this.gameOver || this.pendingBattle || this.releaseRoot || !this.scene.isActive())
      return;
    this.startBattle({ kind: 'wild', speciesId, level, key: `debug:${speciesId}` });
  }

  /**
   * Dev only: the condition filter the route is drawing for the room on screen — the
   * row it was rolled from and the tint/alpha the live overlay itself was painted
   * with — or null when the room rolled no condition.
   */
  debugBattlefieldOverlay(): Readonly<{
    id: RoomConditionId;
    kind: RoomConditionKind;
    tint: number;
    alpha: number;
    visible: boolean;
  }> | null {
    if (!IS_DEVELOP || !this.battlefield || !this.battlefieldOverlay) return null;
    return {
      id: this.battlefield.id,
      kind: this.battlefield.kind,
      tint: this.battlefieldOverlay.fillColor,
      alpha: this.battlefieldOverlay.fillAlpha,
      visible: this.battlefieldOverlay.visible,
    };
  }

  /**
   * Dev only: drops a chosen Pokémon into the run. It joins the party while
   * there is room and the PC box after that (the capture rule), then the save
   * and the HUD follow. Returns where it landed, or null with no live run.
   */
  addDebugPokemon(speciesId: string, level: number): 'party' | 'box' | null {
    if (!IS_DEVELOP || !this.run || this.gameOver) return null;
    // The counter resets on a reload, so scan the live ids to stay unique: a
    // duplicate would make the editor and `updatePokemon` hit several members.
    const used = [...this.run.party, ...this.run.box].map((member) => member.fighter.id);
    const { id, counter } = nextDebugPokemonId(speciesId, used, this.debugMonCounter);
    this.debugMonCounter = counter;
    // The squad shares one level, so the new member joins at that level rather
    // than the requested one; the dev level editor moves the whole squad.
    const pokemon = adoptAtLevel(
      createRunPokemon({
        id,
        speciesId,
        level,
        learnsetSeed: this.run.seed,
      }),
      squadLevel(this.run),
      this.run.seed,
    );
    this.run = addPokemon(this.run, pokemon);
    this.persistRun();
    this.refreshHud();
    return this.run.party.some((member) => member.fighter.id === pokemon.fighter.id) ? 'party' : 'box';
  }

  /** Dev only: adds `count` of an item to the run's bag and resyncs the HUD. */
  addDebugItem(itemId: string, count: number): void {
    if (!IS_DEVELOP || !this.run || this.gameOver) return;
    this.run = addItem(this.run, itemId, count);
    this.persistRun();
    this.refreshHud();
  }

  /** Dev only: the party members the editor can target, with their live shape. */
  debugParty(): readonly DebugPartyMember[] {
    if (!IS_DEVELOP || !this.run) return [];
    return this.run.party.map((member) => ({
      id: member.fighter.id,
      speciesId: member.fighter.speciesId,
      name: getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId,
      level: member.fighter.level,
      nature: member.fighter.nature,
      ability: member.fighter.ability,
      moves: member.fighter.moves.map((slot) => slot.moveId),
    }));
  }

  /**
   * Dev only: rolls `count` wild encounters off the room's live stream, skipping
   * the chance misses and advancing that stream. Returns them in roll order, or
   * nothing with no live run, a finished run or no room on screen.
   */
  debugRollWildEncounters(count = 1): readonly DebugWildRoll[] {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.encounters) return [];
    const rolls = Math.max(1, Math.min(500, Math.floor(Number.isFinite(count) ? count : 1)));
    const result: DebugWildRoll[] = [];
    for (let tries = 0; tries < rolls * 64 && result.length < rolls; tries++) {
      const encounter = this.encounters.step();
      if (!encounter) continue;
      result.push({
        speciesId: encounter.speciesId,
        level: encounter.level,
        shiny: encounter.shiny,
      });
    }
    return result;
  }

  /**
   * Dev only: moves the whole squad — the party **and** the PC box — onto
   * `level`, since they share one level and one XP bar (D35). It parks the XP at
   * that level and re-levels every member. Returns false with no live run.
   */
  setDebugSquadLevel(level: number): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver) return false;
    const settle = (member: RunPokemon): RunPokemon => editRunPokemon(member, { level });
    const target = Math.max(1, Math.floor(level));
    this.run = {
      ...this.run,
      xp: xpForLevel(target),
      party: this.run.party.map(settle),
      box: this.run.box.map(settle),
    };
    this.persistRun();
    this.refreshHud();
    return true;
  }

  /**
   * Dev only: overrides a party member's moves, ability or nature (its level is
   * the squad's, set by `setDebugSquadLevel`), then resyncs the save and the
   * HUD. Returns false with no live run or a bad id.
   */
  editDebugPokemon(memberId: string, edit: DebugPartyEdit): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver) return false;
    const member = this.run.party.find((candidate) => candidate.fighter.id === memberId);
    if (!member) return false;
    this.run = updatePokemon(this.run, editRunPokemon(member, edit));
    this.persistRun();
    this.refreshHud();
    return true;
  }

  /**
   * Dev only: fully restores a party member — HP and PP to full, status cleared
   * and a 0-HP member revived. Returns false with no live run or a bad id.
   */
  healDebugPokemon(memberId: string): boolean {
    if (!IS_DEVELOP || !this.run || this.gameOver) return false;
    const member = this.run.party.find((candidate) => candidate.fighter.id === memberId);
    if (!member) return false;
    this.run = updatePokemon(this.run, fullHealMember(member));
    this.persistRun();
    this.refreshHud();
    return true;
  }

  /** Called by `BattleScene` before it stops: folds the result back into the run. */
  applyBattleResult(result: BattleReturn): void {
    const pending = this.pendingBattle;
    this.pendingBattle = null;
    if (!pending) return;

    const reward = this.rewardFor(pending.trigger);
    const before = this.run.party;
    // What the battle took out of the party is the floor mission's progress; read
    // before the fold, because the fold swaps the snapshots.
    const hpLoss = battleHpLoss(this.run, result.player);
    const { run, released, capture, events } = resolveBattle(this.run, result, reward, {
      catchLocation: {
        biomeId: this.route.biomeId,
        mapIndex: this.run.mapIndex,
        routeInMap: this.run.routeInMap,
      },
    });
    this.run = run;
    this.run = recordHpLost(this.run, hpLoss);
    // The room's capture was already spent when the wild battle started
    // (`startBattle`); this keeps it spent even if a path ever skips that.
    if (pending.trigger.kind === 'wild') this.run = useCapture(this.run);
    // A catch narrows this room's table at once: the room is NOT rebuilt (`applyRoute`
    // would restart its encounter stream), only the live exclusion is re-read.
    this.encounters.setExclusions(wildExclusions(this.run));

    // The keeper's stone is paid **here**, never at battle start, so a lost or
    // reloaded battle pays nothing and a later talk finds the card spent.
    const npc = this.npcBattle;
    this.npcBattle = null;
    let npcPrizeId: string | null = null;
    if (
      npc &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === npcTrainerId(npc.mapIndex, npc.roomId, npc.row.id) &&
      result.outcome === 'win'
    ) {
      const prize = npcPrize(this.run.seed, npc.roomId, npc.row.id, npc.row.battle?.prizeIds ?? []);
      if (prize) {
        this.run = markItemPicked(
          addItem(this.run, prize),
          npcUseId(npc.mapIndex, npc.roomId, npc.row.id),
        );
        npcPrizeId = prize;
      }
    }

    const bossId = this.room?.boss === true ? bossTrainerId(this.room.mapIndex) : null;
    const wonBoss =
      bossId !== null &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === bossId &&
      isTrainerDefeated(this.run, bossId);
    if (wonBoss) this.run = markBossDefeated(this.run);
    // Beating the floor's mini-boss earns the item choice just below.
    const miniBossId = this.room?.special === 'mini-boss' ? miniBossTrainerId(this.room.mapIndex) : null;
    const wonMiniBoss =
      miniBossId !== null &&
      pending.trigger.kind === 'trainer' &&
      pending.trigger.trainerId === miniBossId &&
      isTrainerDefeated(this.run, miniBossId);
    const won = result.outcome === 'win' || result.outcome === 'capture';
    const picks = won ? this.applyMapPassives('win') : [];
    this.persistRun();
    this.refreshHud();

    // A beaten trainer leaves the route for good: drop its sprite and its entry,
    // so a spinner can never spot the player and open the battle again.
    if (pending.trigger.kind === 'trainer') {
      const trainerId = pending.trigger.trainerId;
      if (isTrainerDefeated(this.run, trainerId)) this.removeTrainerSprite(trainerId);
    }

    const over = !hasLivingParty(this.run);
    this.gameOver = over;
    const finish = (): void => {
      if (over) {
        this.scene.start('RunOver', { run: this.run, won: false });
        return;
      }
      if (wonBoss) {
        // The final boss ends a finite run; every other map opens its portal, so
        // rebuild the room with the new door and let the player walk through.
        if (isFinalMap(this.run.mode, this.run.mapIndex)) {
          this.scene.start('RunOver', { run: this.run, won: true });
          return;
        }
        this.transitionTo(this.run, { keepPosition: true });
        return;
      }
      if (wonMiniBoss) {
        this.openMiniBossReward(() => this.playLevelUp(levelUpBeats(before, this.run.party, events)));
        return;
      }
      this.playLevelUp(levelUpBeats(before, this.run.party, events));
    };

    this.playReleaseBeats(releaseBeats(released), () => {
      // Raised inside the callback, so a permadeath overlay and the notice never
      // share the screen, and it never delays `finish()`.
      this.showPassivePickups(picks);
      if (npcPrizeId) this.showNotice(itemPickupNotice(getItem(npcPrizeId)?.name ?? npcPrizeId));
      if (capture?.toPc) this.showNotice(catchToPcNotice(this.memberName(capture.member)));
      finish();
    });
  }

  /**
   * The mini-boss reward (`docs/maps-spec.md` §7, D33, D45): a beaten strong
   * trainer opens one **floating** card of six rows — three items from the map's
   * reward pool and three Pokémon it presents only by their highest stat and their
   * nature. A row is taken by dragging it onto the bag or the party; the ✕ leaves
   * it, and either way the stored callback (the level-up beat) runs. The two lists
   * ride **sibling streams**, so the item rows a fixed seed already produced do
   * not move.
   */
  private openMiniBossReward(onDone: () => void): void {
    if (this.miniBossRewardPanel) {
      onDone();
      return;
    }
    const band = bandForMap(this.run.mapIndex);
    const rng = new Rng(hashSeed(`${this.run.seed}:reward:${this.run.mapIndex}`));
    const items = rewardChoices(ROUTE_LOOT[band.id].pool, MINI_BOSS_REWARD_CHOICES, rng);
    const pokemon = pokemonRewardChoices({
      pool: speciesPool(band, 'wild'),
      count: MINI_BOSS_REWARD_POKEMON_CHOICES,
      level: squadLevel(this.run),
      learnsetSeed: this.run.seed,
      rng: new Rng(hashSeed(`${this.run.seed}:reward:${this.run.mapIndex}:pokemon`)),
    });
    const rows = rewardRows(items, pokemon);
    if (rows.length === 0) {
      onDone();
      return;
    }
    this.miniBossRewardOnDone = onDone;
    this.buildMiniBossReward(rows);
  }

  /** Tears down the reward card and runs its callback (the level-up beat). */
  private closeMiniBossReward(): void {
    const onDone = this.miniBossRewardOnDone;
    this.miniBossRewardOnDone = null;
    this.miniBossRewardPanel?.destroy();
    this.miniBossRewardPanel = null;
    this.miniBossRewardRoot = null;
    onDone?.();
  }

  /** Builds the reward card: the item rows first, then the anonymous Pokémon rows. */
  private buildMiniBossReward(rows: readonly RewardRow[]): void {
    const panel = addFloatingPanel(this, {
      width: REWARD_W,
      height: REWARD_H,
      title: t('reward.title'),
      onClose: () => this.closeMiniBossReward(),
    });
    this.miniBossRewardPanel = panel;
    this.miniBossRewardRoot = panel.root;
    const content = panel.content;
    const left = content.x;
    const width = content.w;
    const children: Phaser.GameObjects.GameObject[] = [
      addFrlgText(this, left, content.y, t('reward.choose'), { size: 16, tint: FRLG_MUTED }),
    ];
    const rowsTop = content.y + 34;
    rows.forEach((row, i) => {
      const rowY = rowsTop + i * REWARD_ROW_H;
      const highlight = this.add
        .rectangle(
          left,
          rowY,
          width,
          REWARD_ROW_H - 8,
          FRLG_SELECTED_FILL.colour,
          FRLG_SELECTED_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const zone = this.add
        .zone(left, rowY, width, REWARD_ROW_H - 8)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => highlight.setVisible(true));
      zone.on('pointerout', () => highlight.setVisible(false));
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.beginRowDrag({
          itemId: row.kind === 'item' ? row.itemId : null,
          label: row.kind === 'item' ? row.name : row.label,
          pointer: { x: pointer.x, y: pointer.y },
          onDrop: (drop) => this.takeMiniBossReward(row, drop),
        });
      });
      // A Pokémon row prints its label on the row's own line and nothing above it,
      // so an unidentified option can never leak a name, an icon or a description.
      if (row.kind === 'item') {
        const icon = this.add
          .image(left + 26, rowY + 26, ITEM_ICON_TEXTURE_KEY, itemIconFrame(row.itemId) ?? 0)
          .setScale(1.1);
        const name = addFrlgText(this, left + 56, rowY + 8, row.name, {
          size: 20,
          tint: FRLG_INK,
        });
        const desc = addFrlgText(this, left + 56, rowY + 38, row.description, {
          size: 16,
          tint: FRLG_MUTED,
        }).setMaxWidth(width - 80);
        children.push(highlight, icon, name, desc, zone);
        return;
      }
      const name = addFrlgText(this, left + 16, rowY + 30, row.label, {
        size: 20,
        tint: FRLG_INK,
      });
      children.push(highlight, name, zone);
    });
    children.push(
      addFrlgText(this, left, content.y + content.h - 20, t('reward.controls'), {
        size: 16,
        tint: FRLG_MUTED,
      }),
    );
    panel.root.add(children);
  }

  /**
   * Takes one reward row on its drop and closes: an item joins the bag first and
   * only then spends or equips itself on the member (an item that does not apply
   * stays in the bag); a Pokémon lands through the **shipped placement** —
   * `createRunPokemon` adopted at the squad's level into `addPokemon` (a full
   * party sends it to the box) — and is **not a catch**: no room capture is spent,
   * no `stats.catches` moves and no `pcCatch` is recorded. Any other drop leaves
   * the card up and changes nothing.
   */
  private takeMiniBossReward(row: RewardRow, drop: RoomDrop): void {
    if (!this.miniBossRewardRoot) return;
    if (row.kind === 'pokemon') {
      if (drop.onto !== 'party') return;
      const option = row.option;
      const member = adoptAtLevel(
        createRunPokemon({
          id: nextMemberId(this.run),
          speciesId: option.speciesId,
          level: option.level,
          nature: option.nature,
          learnsetSeed: this.run.seed,
        }),
        squadLevel(this.run),
        this.run.seed,
      );
      this.run = addPokemon(this.run, member);
      this.persistRun();
      this.refreshHud();
      this.closeMiniBossReward();
      return;
    }
    if (drop.onto !== 'bag' && drop.onto !== 'member') return;
    let run = addItem(this.run, row.itemId);
    if (drop.onto === 'member') {
      const kind = getItem(row.itemId)?.kind;
      if (kind === 'heal' || kind === 'status') run = useItemOn(run, drop.memberId, row.itemId);
      else if (kind === 'held') run = equipHeldItem(run, drop.memberId, row.itemId);
    }
    this.run = run;
    this.persistRun();
    this.showNotice(itemPickupNotice(getItem(row.itemId)?.name ?? row.itemId));
    this.refreshHud();
    this.closeMiniBossReward();
  }

  /**
   * Permadeath feedback (Phase 5): one beat per fallen Pokémon — a scrim, its
   * portrait and "<name> was released." — then `onDone`. With nothing to show it
   * calls back straight away, so the caller keeps one code path.
   */
  private playReleaseBeats(beats: readonly ReleaseBeat[], onDone: () => void): void {
    if (beats.length === 0) {
      onDone();
      return;
    }
    this.releaseQueue = [...beats];
    this.releaseOnDone = onDone;
    this.releaseArmed = false;
    this.buildReleaseOverlay();
    this.time.delayedCall(RELEASE_INPUT_DELAY_MS, () => {
      this.releaseArmed = true;
    });
    this.showReleaseBeat();
  }

  private buildReleaseOverlay(): void {
    const { width, height } = this.scale;
    const panelW = 460;
    const panelH = 264;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2 - 24;
    const scrim = this.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0);
    const panel = addFrlgWindow(this, x, y, panelW, panelH);
    this.releasePortrait = this.add.image(width / 2, y + 96, PORTRAIT_TEXTURE_KEY, 0).setScale(2);
    this.releaseText = addFrlgText(this, width / 2, y + 168, '', {
      align: 'center',
      tint: FRLG_INK,
      origin: 0.5,
    });
    this.releaseText.setMaxWidth(panelW - 48);
    const hint = addFrlgText(
      this,
      width / 2,
      y + panelH + 28,
      t('release.controls', { confirm: keyLabel(this.settings.keybinds.confirm) }),
      {
        size: 16,
        tint: FRLG_MUTED,
        origin: 0.5,
      },
    );
    // The HUD camera was told to ignore everything that existed at setup, not
    // this, so the overlay lives there; the world camera must drop it.
    this.releaseRoot = this.add
      .container(0, 0, [scrim, panel, this.releasePortrait, this.releaseText, hint])
      .setDepth(300);
    this.cameras.main.ignore(this.releaseRoot);
  }

  private showReleaseBeat(): void {
    const beat = this.releaseQueue[0];
    if (!beat || !this.releaseRoot) {
      this.finishReleaseBeats();
      return;
    }
    const portrait = portraitFor(beat.speciesId, beat.shiny);
    this.releasePortrait.setVisible(portrait !== null);
    if (portrait) this.releasePortrait.setTexture(portrait.key, portrait.frame);
    this.releaseText.setText(t('route.released', { level: beat.level, name: beat.name }));
    this.releaseWait?.remove(false);
    this.releaseWait = this.time.delayedCall(RELEASE_HOLD_MS, () => this.advanceRelease());
  }

  private advanceRelease(): void {
    if (this.releaseQueue.length === 0) return;
    this.releaseWait?.remove(false);
    this.releaseWait = null;
    this.releaseQueue.shift();
    this.showReleaseBeat();
  }

  private finishReleaseBeats(): void {
    this.releaseWait?.remove(false);
    this.releaseWait = null;
    this.releaseQueue = [];
    this.releaseRoot?.destroy();
    this.releaseRoot = null;
    const done = this.releaseOnDone;
    this.releaseOnDone = null;
    done?.();
  }

  /**
   * The level-up beat: the squad's shared level counts up in the party header
   * with a gold flash on every member that levelled, then the HUD resyncs
   * (Phase 5). Since all members share one level, the count is a single tween.
   */
  private playLevelUp(beats: readonly LevelUpBeat[]): void {
    if (beats.length === 0) return;
    playCue(this, 'level-up');
    const from = Math.min(...beats.map((beat) => beat.fromLevel));
    const to = Math.max(...beats.map((beat) => beat.toLevel));
    const counter = { level: from };
    const paint = (): void => {
      this.hudLevelText.setText(t('hud.level', { level: Math.round(counter.level) }));
    };
    paint();
    for (const beat of beats) {
      const index = this.run.party.findIndex((member) => member.fighter.id === beat.id);
      this.hudRows[index]?.portrait.setTint(FRLG_ACCENT);
    }
    this.tweens.add({
      targets: counter,
      level: to,
      duration: 520,
      ease: 'Quad.easeOut',
      onUpdate: paint,
      onComplete: () => {
        for (const row of this.hudRows) row.portrait.clearTint();
        // Every level-up says so, not only the ones that crossed a move. One
        // notice: a second beat replaces the first rather than stacking.
        for (const beat of beats) {
          const member = this.run.party.find((entry) => entry.fighter.id === beat.id);
          this.showNotice(
            levelUpNotice(member ? this.memberName(member) : t('common.unknownPokemon'), beat.toLevel),
          );
        }
        this.refreshHud();
        // Announce each move crossed on the way up, now that the counter landed.
        this.showLearnPopup(beats);
      },
    });
  }

  private rewardFor(trigger: BattleTrigger): BattleReward {
    if (trigger.kind === 'wild') return { enemyLevels: [trigger.level], isTrainer: false };
    // A beaten trainer drops Poké Dollars: its archetype's base + jitter, scaled
    // by the map's band and tripled for the floor boss (`docs/maps-spec.md` §7,
    // D33). The roll is keyed by the run, map and trainer, so a replay pays the
    // same (D11).
    const archetype = trigger.archetypeId ? getTrainerArchetype(trigger.archetypeId) : undefined;
    let money: number | undefined;
    if (archetype) {
      const isBoss = trigger.trainerId === bossTrainerId(this.run.mapIndex);
      const rng = new Rng(hashSeed(`${this.run.seed}:money:${this.run.mapIndex}:${trigger.trainerId}`));
      money = trainerMoney(
        archetype,
        bandForMap(this.run.mapIndex),
        rng,
        isBoss ? BOSS_MONEY_MULTIPLIER : 1,
      );
    }
    return {
      enemyLevels: trigger.roster.map((entry) => entry.level),
      isTrainer: true,
      trainerId: trigger.trainerId,
      ...(money !== undefined ? { money } : {}),
      ...(archetype?.reward !== undefined ? { item: archetype.reward } : {}),
    };
  }

  /** Cancels a step in flight, so a rebuild can move the player cleanly. */
  private stopWalking(): void {
    this.walkTween?.stop();
    this.walkTween = null;
    this.playerSprite?.anims.stop();
  }

  /** Destroys the route's tiles and entity overlays before a rebuild. */
  private clearRouteSprites(): void {
    for (const row of this.tileSprites) {
      for (const cell of row) {
        for (const image of cell) image.destroy();
      }
    }
    this.tileSprites = [];
    for (const entry of this.itemSprites) this.tweens.killTweensOf(entry.sprite);
    for (const entry of this.trainerSprites) this.tweens.killTweensOf(entry.sprite);
    if (this.grassStep) this.grassStep.anims.stop();
    this.grassStep = null;
    this.destroyFollower();
    this.followerSheet = null;
    this.followerSpecies = null;
    for (const sprite of this.entitySprites) sprite.destroy();
    this.entitySprites = [];
    this.itemSprites = [];
    this.trainerSprites = [];
    this.npc = null;
    this.trainerSpinIndex.clear();
    this.trainerFacing.clear();
    this.chase = null;
    if (this.battlefieldOverlay) {
      this.battlefieldOverlay.destroy();
      this.battlefieldOverlay = null;
    }
    this.battlefield = null;
    this.clearHoverInspect();
  }

  /**
   * Debug only: the inputs behind the route on screen and its derived biome and
   * band, for the debug menu's "Route" panel. Null when no route is active.
   */
  debugRouteContext(): DebugRouteContext | null {
    if (!IS_DEVELOP || !this.run || !this.routeParams || !this.scene.isActive()) return null;
    return {
      seed: this.routeParams.seed,
      routeIndex: this.routeParams.routeIndex,
      mode: this.run.mode,
      biomeName: this.room
        ? getBiome(this.room.biomeId).name
        : biomeForRoute(this.routeParams.routeIndex).name,
      bandName: this.room
        ? bandForMap(this.room.mapIndex).name
        : runBand(this.run.seed, this.routeParams.routeIndex).name,
      shape: this.routeParams.shape,
      width: this.routeParams.width,
      height: this.routeParams.height,
      passThrough: this.passThrough,
      hoverInspect: this.hoverInspect,
      mapIndex: this.run.mapIndex,
      roomInMap: this.run.routeInMap,
      roomCount: this.room ? this.room.roomCount : 0,
      tile: { x: this.player.x, y: this.player.y },
      ignoreEncounters: this.ignoreEncounters,
      ignoreTrainers: this.ignoreTrainers,
    };
  }

  /** Dev only: the trainers drawn on the route and whether each sprite is showing. */
  debugTrainerSprites(): readonly Readonly<{
    id: string;
    archetypeId: string;
    x: number;
    y: number;
    facing: Facing;
    /** Manhattan distance from the player's tile to the trainer's. */
    distance: number;
    visible: boolean;
  }>[] {
    if (!IS_DEVELOP) return [];
    return this.trainerSprites.map((entry) => ({
      id: entry.trainer.id,
      archetypeId: entry.trainer.archetypeId,
      x: entry.trainer.position.x,
      y: entry.trainer.position.y,
      facing: entry.trainer.facing,
      distance:
        Math.abs(entry.trainer.position.x - this.player.x) +
        Math.abs(entry.trainer.position.y - this.player.y),
      visible: entry.sprite.visible,
    }));
  }

  /**
   * Dev only: swaps the room's first undefeated trainer's archetype and redraws just that
   * sprite (`IS_DEVELOP` only). False with no trainer or an unknown id.
   */
  debugOverrideTrainer(archetypeId: string): boolean {
    if (!IS_DEVELOP) return false;
    const archetype = getTrainerArchetype(archetypeId);
    if (!archetype) return false;
    const trainer = this.route.trainers.find((entry) => !isTrainerDefeated(this.run, entry.id));
    if (!trainer) return false;
    const swapped: RouteTrainer = { ...trainer, archetypeId: archetype.id };
    this.route = {
      ...this.route,
      trainers: this.route.trainers.map((entry) => (entry.id === trainer.id ? swapped : entry)),
    };
    this.removeTrainerSprite(trainer.id);
    const created: Phaser.GameObjects.GameObject[] = [];
    this.drawTrainer(swapped, created);
    this.hudCamera?.ignore(created);
    this.refreshTrainerVisibility();
    return true;
  }

  /** Debug only: toggles walking through solid tiles (walls, water, ledges). */
  setPassThrough(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.passThrough = enabled;
  }

  /** Debug only: toggles the hovered-cell highlight and its x,y label. */
  setHoverInspect(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.hoverInspect = enabled;
    if (!enabled) {
      this.clearHoverInspect();
      return;
    }
    // The pointer is already over a cell: show it without waiting for a move.
    this.updateHoverInspect(this.input.activePointer);
  }

  /** Debug only: while true the tall grass rolls no wild encounter. */
  setIgnoreEncounters(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.ignoreEncounters = enabled;
  }

  /** Debug only: while true no line of sight opens a trainer battle. */
  setIgnoreTrainers(enabled: boolean): void {
    if (!IS_DEVELOP) return;
    this.ignoreTrainers = enabled;
  }

  /**
   * Debug only: colors the route cell under the pointer and labels its `x,y`.
   * It is recomputed on every pointer move; the marker is reused until the
   * pointer lands on another cell, and dropped entirely when the setting is off.
   */
  private updateHoverInspect(pointer: Phaser.Input.Pointer): void {
    if (!this.hoverInspect || !this.scene.isActive() || !this.map) {
      this.clearHoverInspect();
      return;
    }
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tile: Tile = { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
    if (!inBounds(this.map, tile)) {
      this.clearHoverInspect();
      return;
    }
    if (this.hoverCell && this.hoverCell.x === tile.x && this.hoverCell.y === tile.y) return;
    this.hoverCell = tile;
    const label = `${tile.x},${tile.y}`;
    if (!this.hoverMarker) {
      this.hoverMarker = this.add
        .rectangle(this.centerX(tile.x), this.centerY(tile.y), TILE_SIZE, TILE_SIZE, FRLG_ACCENT, 0.3)
        .setStrokeStyle(2, FRLG_ACCENT, 0.9)
        .setDepth(30);
      this.hoverLabel = addFrlgText(this, this.centerX(tile.x), this.centerY(tile.y), label, {
        size: 16,
        tint: FRLG_INK,
        origin: 0.5,
      })
        .setScale(0.5)
        .setDepth(31);
      // Both cameras render every object unless told otherwise; the pinned HUD
      // camera would otherwise draw a second marker at the unscrolled position.
      this.hudCamera?.ignore([this.hoverMarker, this.hoverLabel]);
      return;
    }
    this.hoverMarker.setPosition(this.centerX(tile.x), this.centerY(tile.y));
    this.hoverLabel?.setPosition(this.centerX(tile.x), this.centerY(tile.y)).setText(label);
  }

  /** Debug only: removes the hovered-cell highlight, if any. */
  private clearHoverInspect(): void {
    this.hoverCell = null;
    this.hoverMarker?.destroy();
    this.hoverMarker = null;
    this.hoverLabel?.destroy();
    this.hoverLabel = null;
  }

  /**
   * Debug only: the generator phase currently rendered. `index` is 0-based and
   * `index === total - 1` is the live map. Null when no route is active.
   */
  generatorStepInfo(): { index: number; total: number; label: string } | null {
    if (!IS_DEVELOP || this.generatorSteps.length === 0) return null;
    const index = this.generatorStepIndex ?? this.generatorSteps.length - 1;
    return { index, total: this.generatorSteps.length, label: this.generatorSteps[index].label };
  }

  /** Debug only: render the previous/next generator phase (wraps the live map). */
  stepGenerator(delta: number): void {
    if (!IS_DEVELOP || this.generatorSteps.length === 0) return;
    const last = this.generatorSteps.length - 1;
    const next =
      this.generatorStepIndex === null
        ? delta < 0
          ? last
          : 0
        : Math.max(0, Math.min(last, this.generatorStepIndex + delta));
    this.showGeneratorStep(next === last ? null : next);
  }

  /** Debug only: leave the stepper and render the live route again. */
  resetGeneratorStep(): void {
    if (!IS_DEVELOP) return;
    this.showGeneratorStep(null);
  }

  private showGeneratorStep(step: number | null): void {
    if (!this.scene.isActive()) return;
    this.generatorStepIndex = step;
    this.renderTiles = step === null ? this.map : this.generatorSteps[step].tiles;
    this.stopWalking();
    this.clearRouteSprites();
    this.drawTiles();
    this.drawEntities();
  }

  /**
   * Debug only: rebuilds the route from the panel's inputs without touching the
   * run. `attempt` rerolls the same base inputs reproducibly (D11).
   */
  regenerateRoute(input: DebugRouteInput): void {
    if (!IS_DEVELOP || !this.run || !this.routeParams) return;
    if (!this.scene.isActive() || this.gameOver || this.pendingBattle || this.releaseRoot) {
      return;
    }

    const params: RouteParams = {
      seed: input.seed.trim() ? input.seed.trim() : this.routeParams.seed,
      routeIndex: Math.max(1, Math.floor(input.routeIndex)),
      shape: input.shape,
      width: clampInt(input.width, 16, 128),
      height: clampInt(input.height, 16, 96),
      grassPatches: this.routeParams.grassPatches,
      ledges: this.routeParams.ledges,
    };
    const attempt = Math.max(0, Math.floor(input.attempt));

    // The dev generator builds a rolled shape, not a plan room: no map doors.
    this.room = null;
    this.plan = null;
    this.shopCounter = null;
    this.npc = null;
    this.stopWalking();
    this.clearRouteSprites();
    this.buildRoute(params, attempt);
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = { ...this.route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
  }

  /**
   * Debug only: moves the run to `mapIndex`, clamped to the run's map range and
   * built exactly as `advanceMap` builds a new floor — except that it does **not**
   * heal (that is the map transition's own reward) and it resets the destination
   * floor's bookkeeping even when that floor is the one the run is already on.
   */
  teleportToFloor(mapIndex: number): DebugTeleportResult {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.scene.isActive()) {
      return { ok: false, error: t('dev.error.noRoute') };
    }
    const requested = Number.isFinite(mapIndex) ? Math.floor(mapIndex) : this.run.mapIndex;
    const floor =
      this.run.mode === 'finite'
        ? Math.max(1, Math.min(FINITE_MAPS, requested))
        : Math.max(1, requested);
    const plan = planMap(this.run.seed, floor);
    const run: RunState = {
      ...this.run,
      routeIndex: this.run.routeIndex + 1,
      mapIndex: floor,
      routeInMap: plan.entryRoom,
      arrivalEdge: plan.entryEdge,
      discoveredRooms: [plan.entryRoom],
      bossDefeated: false,
      entryDeparted: false,
      pcCatch: null,
      levelCap: levelCapForMap(floor),
      defeatedTrainers: [],
      pickedItems: [],
      capturedRooms: [],
      mission: missionForMap(this.run.seed, floor),
      hpLost: 0,
      floorCasualties: this.run.stats.casualties,
    };
    this.transitionTo(run);
    return { ok: true };
  }

  /**
   * Debug only: moves the run to a room of the current floor, clamped to the
   * plan. No arrival edge is passed, so `advanceRoute` derives a real door and the
   * destination is a room reached through one.
   */
  teleportToRoom(roomInMap: number): DebugTeleportResult {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.scene.isActive()) {
      return { ok: false, error: t('dev.error.noRoute') };
    }
    const plan = this.plan;
    if (!plan) return { ok: false, error: t('dev.error.noFloorPlan') };
    const requested = Number.isFinite(roomInMap) ? Math.floor(roomInMap) : this.run.routeInMap;
    const room = Math.max(0, Math.min(plan.rooms.length - 1, requested));
    this.transitionTo(advanceRoute(this.run, room));
    return { ok: true };
  }

  /**
   * Debug only: moves the player onto a tile of the current room, clamped to the
   * map. A solid tile is refused — the player would be stuck in it (tick *Pass
   * through obstacles* first). A teleport is a position change, not a step: it
   * rolls no encounter and runs no sight check on arrival.
   */
  teleportToTile(x: number, y: number): DebugTeleportResult {
    if (!IS_DEVELOP || !this.run || this.gameOver || !this.scene.isActive()) {
      return { ok: false, error: t('dev.error.noRoute') };
    }
    const size = mapSize(this.map);
    const tile = {
      x: Number.isFinite(x) ? Math.floor(x) : this.player.x,
      y: Number.isFinite(y) ? Math.floor(y) : this.player.y,
    };
    tile.x = Math.max(0, Math.min(size.width - 1, tile.x));
    tile.y = Math.max(0, Math.min(size.height - 1, tile.y));
    if (!isWalkable(this.moveMap, tile)) return { ok: false, error: t('dev.error.solidTile') };
    // The in-flight tween must not carry the sprite back to the old destination
    // and run `onTileEntered` there.
    this.stopWalking();
    this.movePlayerTo(tile.x, tile.y);
    // A teleport runs no sight check; it only re-paints the sprites' visibility.
    this.refreshTrainerVisibility();
    this.refreshHud();
    return { ok: true };
  }

  /**
   * Debug only: the on-screen route described cell by cell (tile value, resolved
   * atlas frame, wall-pattern row/column and the whole-object tree each cell
   * belongs to), as JSON for the menu's "Map" tab. Null when no route is active.
   */
  exportFrameMap(): string | null {
    if (!IS_DEVELOP || !this.route || !this.scene.isActive()) return null;
    const config = TILESETS[this.tilesetId].config;
    return JSON.stringify(serializeFrameMap(this.route, config), null, 2);
  }

  /**
   * Debug only: rebuild the route from an exported frame map and show it. It does
   * not touch the run, so an imported map is only for inspection; the route
   * params follow it so the panel keeps describing what is on screen.
   */
  importFrameMap(text: string): { ok: boolean; error?: string } {
    if (!IS_DEVELOP || !this.scene.isActive()) return { ok: false, error: t('dev.error.noRoute') };
    let exported;
    try {
      exported = parseFrameMapExport(text);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : t('dev.error.invalidFrameMap'),
      };
    }
    this.stopWalking();
    this.clearRouteSprites();
    this.room = null;
    this.plan = null;
    this.shopCounter = null;
    this.npc = null;
    const route = routeFromFrameMapExport(exported);
    this.generatorSteps = [];
    this.applyRoute(route);
    const biome = getBiome(route.biomeId);
    this.routeParams = {
      seed: route.seed,
      routeIndex: route.routeIndex,
      shape: route.shape,
      width: route.width,
      height: route.height,
      grassPatches: biome.terrain.grassPatches,
      ledges: biome.terrain.ledges,
    };
    this.drawTiles();
    this.drawEntities();
    this.drawItems();
    this.drawTrainers();
    this.drawRoomFixture();
    this.player = { ...route.entry };
    this.movePlayerTo(this.player.x, this.player.y);
    const cameraBounds = mapPixelSize(this.map, TILE_SIZE);
    this.cameras.main.setBounds(0, 0, cameraBounds.width, cameraBounds.height);
    return { ok: true };
  }

  override update(time: number, delta: number): void {
    // The hold-to-reset runs whatever the route is doing (a battle pauses the
    // scene, so it never fires behind another screen).
    this.updateReset(delta);
    this.updateTrainerSpins(time);
    // The player sorts against the trainers by its foot row every frame, so the
    // depth follows a step in flight instead of snapping when it lands.
    this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
    if (this.followerSprite) this.followerSprite.setDepth(actorDepth(this.followerSprite.y));
    if (
      this.gameOver ||
      this.pendingBattle ||
      this.releaseRoot ||
      this.modalPanelOpen() ||
      this.pauseMenuOpen ||
      this.chase
    ) {
      this.settleMovement();
      return;
    }
    const direction = this.heldDirection();
    if (!direction) {
      this.settleMovement();
      return;
    }
    // A step is still sliding; the next one starts when it lands.
    if (this.walkTween) return;
    const step = MOVE_STEP[direction];
    // Dev noclip: step onto any in-bounds tile, solid or not.
    const direct = { x: this.player.x + step.x, y: this.player.y + step.y };
    if (this.passThrough && inBounds(this.map, direct)) {
      this.walkStep(direction, direct);
      return;
    }
    const result = resolveMove(this.moveMap, this.player, step);
    // A visible ground item, a live trainer or the room's special NPC blocks its
    // tile, like an object in the originals: the item is taken with the interact
    // key and the trainer is talked to. A hidden item can be walked over.
    if (
      !result ||
      this.itemBlocks(result.to) ||
      this.liveTrainerAt(result.to) ||
      this.shopCounterAt(result.to) ||
      this.npcBlocks(result.to)
    ) {
      this.faceIdle(direction);
      return;
    }
    this.walkStep(direction, result.to);
  }

  /** Turns every "spinning" trainer to the next facing on the shared timer. */
  private updateTrainerSpins(time: number): void {
    if (this.generatorStepIndex !== null) return;
    if (
      this.gameOver ||
      this.pendingBattle ||
      this.releaseRoot ||
      this.modalPanelOpen() ||
      this.pauseMenuOpen ||
      this.chase
    )
      return;
    for (const entry of this.trainerSprites) {
      if (isTrainerDefeated(this.run, entry.trainer.id)) continue;
      const turns = entry.trainer.turns;
      if (!turns || turns.length < 2) continue;
      const index = Math.floor(time / TRAINER_TURN_MS) % turns.length;
      if (this.trainerSpinIndex.get(entry.trainer.id) === index) continue;
      this.trainerSpinIndex.set(entry.trainer.id, index);
      this.trainerFacing.set(entry.trainer.id, turns[index]);
      this.faceTrainerSprite(entry, turns[index]);
      // A spinner that swings its cone onto a player standing still still spots
      // them, the same as stepping into a fixed trainer's line of sight.
      if (
        !this.ignoreTrainers &&
        seesPlayer(this.route, this.effectiveTrainer(entry.trainer), this.player, this.moveMap)
      ) {
        this.beginChase(entry.trainer);
        return;
      }
    }
  }

  /**
   * The direction the player is pushing. A held key keeps walking; a fresh tap
   * counts even if it is released before the next frame, so a quick press still
   * moves a tile. The on-screen pad answers after the keyboard, so the two never
   * fight over a direction.
   */
  private heldDirection(): MoveKey | null {
    if (this.textFieldFocused()) return null;
    const { up, down, left, right } = this.moveKeys;
    const pressed = (keys: Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((key) => key.isDown || Phaser.Input.Keyboard.JustDown(key));
    if (pressed(left)) return 'left';
    if (pressed(right)) return 'right';
    if (pressed(up)) return 'up';
    if (pressed(down)) return 'down';
    return this.touch?.heldDirection() ?? null;
  }
}
