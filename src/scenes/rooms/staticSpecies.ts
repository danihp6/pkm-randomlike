import { getSpecies } from '../../data/dex/species';
import { isItemPicked, markItemPicked } from '../../engine/run';
import { staticGateId, staticGateOpen, staticRoomContent, staticSpeciesId } from '../../engine/routes';
import { TILE_SIZE } from '../../engine/tileset';
import { gateOpenedNotice, staticLegendaryNotice, staticSealLockedNotice } from '../../ui/notice';
import { typeColor } from '../../ui/typeColors';
import type { RoomDescriptor } from './types';

/**
 * The **static-species** room (`docs/maps-spec.md` §7, `D47`): a dead-end leaf whose
 * route carved the shipped one-tile vault behind a bush, a rock or a pond. The
 * interact key opens that seal when a **party** member holds the seal's own property
 * (a type, or an ability for the pond), and the far side holds **one static species**
 * at the squad's level, fought through the scene's wild path so a catch spends the
 * room's capture exactly like tall grass. From map 4 on, a flawless floor the run
 * reaches with exactly one completed mission may hold a **legendary** instead. The
 * two records live **only** in the run's `pickedItems`, so a revisit and a reload
 * agree.
 */

const SILHOUETTE_RADIUS = TILE_SIZE * 0.3;
const HIGHLIGHT_RADIUS = TILE_SIZE * 0.12;
const HIGHLIGHT_OFFSET_X = -TILE_SIZE * 0.08;
const HIGHLIGHT_OFFSET_Y = -TILE_SIZE * 0.1;
const FIXTURE_DEPTH = 5;

const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

export const descriptor: RoomDescriptor = {
  kind: 'static',
  marker: 'static',
  fixture: (host) => {
    const gate = host.route().gate;
    if (!gate) return null;
    const view = host.view;
    if (isItemPicked(host.run, staticSpeciesId(view.mapIndex, view.roomId))) return null;
    const content = staticRoomContent(host.run, view.mapIndex, view.roomId, gate.kind);
    if (content.variant !== 'legendary') return { counter: gate.pocket };
    const name = getSpecies(content.speciesId)?.name ?? content.speciesId;
    return { counter: gate.pocket, notice: staticLegendaryNotice(name) };
  },
  interact: (host, tile) => {
    const gate = host.route().gate;
    if (!gate) return false;
    const view = host.view;
    const content = staticRoomContent(host.run, view.mapIndex, view.roomId, gate.kind);
    if (tile.x === gate.tile.x && tile.y === gate.tile.y) {
      const id = staticGateId(view.mapIndex, view.roomId);
      if (isItemPicked(host.run, id)) return false;
      if (!staticGateOpen(host.run, content.gate)) {
        host.showNotice(staticSealLockedNotice(gate.kind));
        return true;
      }
      host.commitRun(markItemPicked(host.run, id));
      host.rebuildRoom();
      host.showNotice(gateOpenedNotice());
      return true;
    }
    if (tile.x === gate.pocket.x && tile.y === gate.pocket.y) {
      const id = staticSpeciesId(view.mapIndex, view.roomId);
      if (isItemPicked(host.run, id)) return false;
      if (!host.startWildBattle) return false;
      host.commitRun(markItemPicked(host.run, id));
      host.rebuildRoom();
      host.startWildBattle({
        speciesId: content.speciesId,
        level: content.level,
        key: `static:${view.mapIndex}:${view.roomId}`,
      });
      return true;
    }
    return false;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const gate = host.route().gate;
    if (!gate) return;
    const view = host.view;
    if (isItemPicked(host.run, staticSpeciesId(view.mapIndex, view.roomId))) return;
    const content = staticRoomContent(host.run, view.mapIndex, view.roomId, gate.kind);
    const x = centerX(gate.pocket.x);
    const y = centerY(gate.pocket.y);
    host.scene.add
      .circle(x, y, SILHOUETTE_RADIUS, typeColor(getSpecies(content.speciesId)?.types[0] ?? ''))
      .setDepth(FIXTURE_DEPTH);
    host.scene.add
      .circle(x + HIGHLIGHT_OFFSET_X, y + HIGHLIGHT_OFFSET_Y, HIGHLIGHT_RADIUS, 0xffffff, 0.7)
      .setDepth(FIXTURE_DEPTH);
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0xf2c94c, 1);
    graphics.fillCircle(cx, cy, radius * 0.85);
    graphics.fillStyle(0x10161f, 1);
    graphics.fillCircle(cx, cy, radius * 0.34);
  },
};
