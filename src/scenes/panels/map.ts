import type Phaser from 'phaser';
import { getBiome } from '../../data/biomes';
import { isFinalMap } from '../../engine/maps';
import { t } from '../../i18n';
import {
  FRLG_BADGE_INK,
  FRLG_MUTED,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { buildMapView, type MapRoomMarker, type MapViewRoom } from '../../ui/mapView';
import { PANEL_ICON_KEYS } from '../BootScene';
import {
  HUD_CONTENT_LEFT,
  HUD_PAD_BOTTOM,
  HUD_PAD_TOP,
  HUD_PAD_X,
  HUD_TOP,
  PANEL_KEY_ACTIONS,
  makeHudPanel,
} from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The route header, which **is** the floor minimap (`docs/maps-spec.md` §8, `D32`):
 * the map name over the discovered-rooms grid, one panel in the free top-left
 * corner. The layout and every reveal rule come from the pure `buildMapView`; this
 * module only scales and paints it.
 */

const HUD_MAP_X = 8;
const HUD_MAP_Y = HUD_TOP;
const HUD_MAP_H = 250;
const HUD_MAP_TITLE_H = HUD_PAD_TOP + 34;
/** The minimap's current-room gold: a content marker, not a chrome tone. */
const HUD_MAP_CURRENT_FILL = 0xf6d98a;
const HUD_MAP_CURRENT_STROKE = 0x9a7a1f;

let hudTitle!: Phaser.GameObjects.BitmapText;
/** The floor minimap panel: its graphics and the "no map" label. */
let hudMapGraphics!: Phaser.GameObjects.Graphics;
let hudMapEmpty!: Phaser.GameObjects.BitmapText;

/** The portal is open once the map's boss has fallen, except on the final map (D31). */
function portalOpen(host: RoutePanelHost): boolean {
  const run = host.run();
  return run.bossDefeated && !isFinalMap(run.mode, run.mapIndex);
}

/**
 * Redraws the floor minimap from the plan and the run's discovery: the discovered
 * rooms sized from their plan width/height, their openings on the matching walls,
 * the links between two known neighbours and the boss/portal/special markers.
 */
function refreshMapView(host: RoutePanelHost): void {
  if (!hudMapGraphics) return;
  const graphics = hudMapGraphics;
  graphics.clear();
  const plan = host.plan();
  if (!plan) {
    hudMapEmpty.setVisible(true);
    return;
  }
  const run = host.run();
  const view = buildMapView(plan, {
    discovered: run.discoveredRooms,
    currentRoom: run.routeInMap,
    portalOpen: portalOpen(host),
    captureSpent: run.capturedRooms,
    markers: plan.specials.reduce<Record<number, MapRoomMarker>>((all, special) => {
      all[special.roomId] = special.kind;
      return all;
    }, {}),
  });
  hudMapEmpty.setVisible(!view.visible);
  if (!view.visible) return;

  const areaX = HUD_MAP_X + HUD_PAD_X;
  const areaY = HUD_MAP_Y + HUD_MAP_TITLE_H;
  const areaW = host.hud().mapW - HUD_PAD_X * 2;
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

    drawMapMarker(host, graphics, room, rx + rw / 2, ry + rh / 2, Math.min(rw, rh));
  }
}

/** One room's minimap icon: a special marker, the boss, and the open portal ring. */
function drawMapMarker(
  host: RoutePanelHost,
  graphics: Phaser.GameObjects.Graphics,
  room: MapViewRoom,
  cx: number,
  cy: number,
  size: number,
): void {
  const radius = Math.max(3, size * 0.18);
  if (room.marker) {
    // The room's own descriptor draws its glyph (`D47`).
    host.rooms().byMarker.get(room.marker)?.drawMarker?.(graphics, cx, cy, radius);
  } else if (room.boss) {
    graphics.fillStyle(0xb0304a, 1);
    graphics.fillCircle(cx, cy, radius);
    graphics.fillStyle(FRLG_INK, 1);
    graphics.fillCircle(cx - radius * 0.4, cy - radius * 0.15, radius * 0.22);
    graphics.fillCircle(cx + radius * 0.4, cy - radius * 0.15, radius * 0.22);
  } else if (room.captureSpent) {
    // A room whose single capture has been spent reads as a Poké Ball.
    drawCaptureBall(graphics, cx, cy, radius);
  }
  if (room.portal) {
    graphics.lineStyle(2, 0x3fa9f5, 1);
    graphics.strokeCircle(cx, cy, radius * 1.4);
  }
}

/** A small Poké Ball glyph on a minimap room whose capture has been spent. */
function drawCaptureBall(
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

export const descriptor: RoutePanelDescriptor = {
  id: 'map',
  order: 10,
  hudPanel: 'header',
  build(host: RoutePanelHost): void {
    const { mapW } = host.hud();
    const scene = host.scene;
    const children: Phaser.GameObjects.GameObject[] = [];
    const window = addFrlgWindow(scene, HUD_MAP_X, HUD_MAP_Y, mapW, HUD_MAP_H);
    children.push(window);
    hudTitle = addFrlgText(scene, HUD_MAP_X + HUD_CONTENT_LEFT, HUD_MAP_Y + HUD_PAD_TOP, '', {
      size: 16,
      tint: FRLG_INK,
    }).setMaxWidth(mapW - HUD_CONTENT_LEFT - HUD_PAD_X);
    hudMapGraphics = scene.add.graphics();
    hudMapEmpty = addFrlgText(
      scene,
      HUD_MAP_X + mapW / 2,
      HUD_MAP_Y + HUD_MAP_TITLE_H + 56,
      t('hud.noMap'),
      { size: 16, tint: FRLG_MUTED, origin: [0.5, 0] },
    );
    children.push(hudTitle, hudMapGraphics, hudMapEmpty);
    // The header has nothing interactive, so its whole window grabs for a drag.
    makeHudPanel(
      host,
      'header',
      HUD_MAP_X,
      HUD_MAP_Y,
      mapW,
      HUD_MAP_H,
      scene.add.container(0, 0, children),
      window,
      PANEL_ICON_KEYS.header,
      PANEL_KEY_ACTIONS.header ?? null,
    );
  },
  refresh(host: RoutePanelHost): void {
    if (!hudTitle) return;
    hudTitle.setText(
      t('route.mapTitle', {
        map: host.run().mapIndex,
        biome: getBiome(host.route().biomeId).name,
      }),
    );
    refreshMapView(host);
  },
};
