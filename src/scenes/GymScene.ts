import Phaser from 'phaser';
import { playCue, playMusic } from '../audio/audio';
import { gymForBadge } from '../data/gyms';
import type { KeybindAction } from '../data/keybinds';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import { PLAYER_SPRITE_TEXTURE_KEY, PLAYER_SPRITE_WIDTH, playerSpriteFrame } from '../data/playerSprite';
import { BADGE_CAPS } from '../data/region';
import { getTrainerArchetype } from '../data/trainers';
import { FRLG_INTERIOR_TILESET } from '../data/tilesets/interior';
import { IS_DEVELOP } from '../dev/env';
import type { Tile } from '../engine/grid';
import { DOOR, tileAt } from '../engine/map';
import { planCity } from '../engine/region/city/plan';
import { iceCellAt, slideStep, type IceRoom } from '../engine/region/gym/ice';
import { gymSolved, planGym, type GymPlan } from '../engine/region/gym/plan';
import { nodeOf, planRegion, type RegionPlan } from '../engine/region/plan';
import { buildNodeMeshes } from '../engine/region/preload';
import {
  gymLeaderFoe,
  gymLeaderId,
  gymReward,
  gymTrainerFoe,
  gymTrainerId,
  grantBadge,
  type GymFoe,
} from '../engine/run/badge';
import { battleSeed, type BattleLaunch, type BattleReturn } from '../engine/run/battleLink';
import { resolveBattle } from '../engine/run/resolve';
import { hasLivingParty, isTrainerDefeated, markItemPicked, type RunState } from '../engine/run/state';
import { loadSave, storeRun, type Settings } from '../engine/save';
import { TILE_SIZE } from '../engine/tileset';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { TRAINER_TEXTURE_KEY } from './BootScene';
import { actorDepth, WORLD_TRANSITION_MS, WorldScene } from './WorldScene';
import { RUN_STEP_MS, WALK_STEP_MS, WorldWalker, type MoveDirection } from './walker';

/**
 * A gym as a place you walk (`docs/region-spec.md` §3, §7.2, §7.4): the city's own
 * four rooms drawn from `planGym` on the interior tileset, the player on the shared
 * `WorldWalker`, the ice room's slide rule read off `SlideStep`, the room's trainer
 * and the leader fought as ordinary `Battle` launches that fold back through the
 * shipped `resolveBattle`, the solved mark in `pickedItems` and the door back to the
 * city it came through.
 *
 * It owns no rule of its own: the badge is `run/badge.ts`'s, the rooms and the ice
 * floor are `region/gym/`'s, and the way out of the city is the shipped `exitGate`.
 */

export const regionSceneKey = 'Gym';

/** The scene key a gym battle returns to. */
export const GYM_RETURN_SCENE = 'Gym';

/** The one music bed a gym plays (`menu-music`). */
const GYM_MUSIC = 'menu-music';

/** The room index the leader's own room holds in `InteriorPlan.rooms`. */
const LEADER_ROOM = 3;

/** The tile one step in each direction lands on. */
const STEP: Readonly<Record<MoveDirection, Tile>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** What the debug/dev browser pass reads. */
export type GymDebugState = Readonly<{
  /** The gym's city node key, `city:1`; `''` before the plan resolves. */
  key: string;
  tile: { x: number; y: number };
  /** The gym room the player stands in, `0..3` (`entrance`, `trainer`, `puzzle`, `leader`); `-1` off the plan. */
  room: number;
  /** How many rooms the gym's own plan holds: `4`. */
  rooms: number;
  /** The puzzle's stack entry id: `'ice'`. */
  puzzle: string;
  /** The door the player enters the puzzle room through, or null. */
  puzzleDoor: { x: number; y: number } | null;
  /** The door that leads into the leader's room, or null. */
  leaderDoor: { x: number; y: number } | null;
  /** True when the run carries `gym-solved:<key>`. */
  solved: boolean;
  /** Slides and hole falls played since this scene started. */
  slides: number;
  falls: number;
  /** The regular trainers still unbeaten, with the tile each stands on. */
  trainers: readonly { index: number; id: string; tile: { x: number; y: number } }[];
  /** The leader: its id, its tile, and the roster it fields. */
  leader: { id: string; tile: { x: number; y: number }; size: number; levels: readonly number[] };
  /** The run's badges, and the ladder's width (`BADGE_CAPS.length`). */
  badges: readonly number[];
  badgeTotal: number;
  /** The gym's one way out: the door the player arrived on. */
  entry: { x: number; y: number };
  /** True while a step's tween is in flight. */
  stepping: boolean;
  fighting: boolean;
}>;

/** A host the interact key may open: the room-1 trainer, or the leader. */
type HostTarget = Readonly<{ role: 'trainer' | 'leader'; index: number }>;

/** Whether `tile` lies inside a room's rect, wall ring included. */
function inRect(
  rect: Readonly<{ x: number; y: number; width: number; height: number }>,
  tile: Tile,
): boolean {
  return (
    tile.x >= rect.x && tile.x < rect.x + rect.width && tile.y >= rect.y && tile.y < rect.y + rect.height
  );
}

function copyTile(tile: Tile): { x: number; y: number } {
  return { x: tile.x, y: tile.y };
}

export class GymScene extends WorldScene {
  private run: RunState | null = null;
  private settings!: Settings;
  /** The city's node key: the payload's, or the run's own. */
  private cityKey = '';
  /** The plan the gym was read off, or null when the key is not a gym city. */
  private plan: RegionPlan | null = null;
  /** The gym on screen, or null before its plan resolves. */
  private gym: GymPlan | null = null;
  private walker: WorldWalker | null = null;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  private keys: Readonly<Record<MoveDirection, Phaser.Input.Keyboard.Key[]>> | null = null;
  /** The fight this scene opened, or null while it is not fighting. */
  private foe: GymFoe | null = null;
  /** Every host sprite drawn on the floor, so a redraw can drop them. */
  private hosts: Phaser.GameObjects.GameObject[] = [];
  /** The earliest `time` the next ice press may be answered. */
  private nextStepAt = 0;
  /** The direction a slide refused, so a held key is not re-asked until it is released. */
  private blocked: MoveDirection | null = null;
  private slides = 0;
  private falls = 0;
  /** True once the way out is taken, so a second landing cannot travel twice. */
  private leaving = false;

  constructor() {
    super(regionSceneKey);
  }

  init(data?: { run?: RunState; cityKey?: string; interiorKey?: string }): void {
    this.foe = null;
    this.walker = null;
    this.playerSprite = null;
    this.hosts = [];
    this.nextStepAt = 0;
    this.blocked = null;
    this.slides = 0;
    this.falls = 0;
    this.leaving = false;
    this.gym = null;
    this.plan = null;

    const run = data?.run ?? loadSave(browserStorage()).run;
    if (!run) {
      this.run = null;
      this.scene.start('MainMenu');
      return;
    }
    this.run = run;
    // `interiorKey` is the seam's (the scene *is* the gym), so only the city is kept.
    this.cityKey = data?.cityKey ?? run.nodeKey;
  }

  create(): void {
    this.settings = loadSettings();
    this.exposeDebugScene();

    const run = this.run;
    let plan: RegionPlan | null = null;
    let gym: GymPlan | null = null;
    if (run !== null) {
      // `planGym` throws `not a gym: <key>`; a throw is a warn on an empty camera,
      // never a crash (the `CityScene` rule), and nothing is cached between entries.
      try {
        plan = planRegion(run.seed);
        gym = planGym(plan, this.cityKey);
      } catch (error) {
        console.warn(`gym: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (plan === null || gym === null) return;

    this.plan = plan;
    this.gym = gym;
    this.cityKey = gym.cityKey;

    this.drawWorld({
      tiles: gym.interior.tiles,
      meshes: buildNodeMeshes(gym.interior.tiles, FRLG_INTERIOR_TILESET),
      tilesetId: 'interior',
    });
    this.cameras.main.fadeIn(WORLD_TRANSITION_MS);

    this.buildPlayer(gym.interior.entry);
    this.redrawHosts();

    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
    this.keys = {
      up: actionKeys(this, 'up'),
      down: actionKeys(this, 'down'),
      left: actionKeys(this, 'left'),
      right: actionKeys(this, 'right'),
    };

    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    playMusic(this, GYM_MUSIC);
    this.events.on(Phaser.Scenes.Events.RESUME, this.takeMusicBack, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.takeMusicBack, this);
    });
  }

  override update(time: number, delta: number): void {
    if (this.foe !== null || this.leaving) return;
    const walker = this.walker;
    const sprite = this.playerSprite;
    const gym = this.gym;
    if (walker === null || sprite === null || gym === null) return;

    const running = this.settings.alwaysRun || (this.runKey?.isDown ?? false);
    const ice = gym.puzzle.ice;
    if (ice !== null && iceCellAt(ice, walker.tile) === 'ice') {
      this.pollSlide(time, running, ice);
    } else {
      walker.update(delta, running);
    }
    sprite.setDepth(actorDepth(sprite.y));
  }

  /** Called by `BattleScene` before it stops: folds the fight and marks what it left. */
  applyBattleResult(result: BattleReturn): void {
    const foe = this.foe;
    const run = this.run;
    this.foe = null;
    if (foe === null || run === null) return;

    this.run = resolveBattle(run, result, gymReward(foe)).run;
    // The badge is the leader's own victory, and `grantBadge` refuses a repeat: a
    // fight replayed after the win cannot hand a second one over.
    if (result.outcome === 'win' && foe.role === 'leader') {
      this.run = grantBadge(this.run, foe.badge);
    }
    this.persistRun();

    if (!hasLivingParty(this.run)) {
      this.leaving = true;
      this.scene.start('RunOver', { run: this.run, won: false });
      return;
    }
    if (result.outcome === 'win') playCue(this, 'victory');
    // A loss or a flee leaves the host unbeaten, so the press opens it again; a win
    // drops the sprite, because a beaten host is not drawn.
    this.redrawHosts();
  }

  /** Opens the room-1 trainer `index`'s battle; false when there is none to open. */
  startTrainerFight(index: number): boolean {
    const run = this.run;
    const plan = this.plan;
    const gym = this.gym;
    if (run === null || plan === null || gym === null) return false;
    if (this.foe !== null || this.leaving) return false;
    if (isTrainerDefeated(run, gymTrainerId(gym.cityKey, index))) return false;
    return this.openFight(gymTrainerFoe(plan, run, gym.cityKey, index));
  }

  /** Opens the leader's battle; false when there is no leader left or no plan. */
  startLeaderFight(): boolean {
    const run = this.run;
    const plan = this.plan;
    const gym = this.gym;
    if (run === null || plan === null || gym === null) return false;
    if (this.foe !== null || this.leaving) return false;
    if (isTrainerDefeated(run, gymLeaderId(gym.cityKey))) return false;
    return this.openFight(gymLeaderFoe(plan, run, gym.cityKey));
  }

  /** Walks back out to the city door the gym was entered through; false when refused. */
  exitToCity(): boolean {
    const run = this.run;
    const plan = this.plan;
    const gym = this.gym;
    if (run === null || plan === null || gym === null) return false;
    if (this.leaving || this.foe !== null) return false;

    this.persistRun();
    // The city's own gym door, so `CityScene.spawnFor` stands the player back on it.
    let door: Tile | undefined;
    try {
      door = planCity(plan, gym.cityKey).buildings.find(
        (building) => building.interiorKey === 'gym',
      )?.door;
    } catch {
      door = undefined;
    }
    this.leaving = true;
    this.scene.start('City', door === undefined ? { run: this.run } : { run: this.run, spawn: door });
    return true;
  }

  /** Dev only. */
  debugGymState(): GymDebugState {
    const run = this.run;
    const plan = this.plan;
    const gym = this.gym;
    const walker = this.walker;
    const tile = walker === null ? { x: 0, y: 0 } : copyTile(walker.tile);
    const badges = run === null ? [] : [...run.badges];

    if (run === null || plan === null || gym === null) {
      return {
        key: '',
        tile,
        room: -1,
        rooms: 0,
        puzzle: '',
        puzzleDoor: null,
        leaderDoor: null,
        solved: false,
        slides: this.slides,
        falls: this.falls,
        trainers: [],
        leader: { id: '', tile: { x: 0, y: 0 }, size: 0, levels: [] },
        badges,
        badgeTotal: BADGE_CAPS.length,
        entry: { x: 0, y: 0 },
        stepping: walker !== null && walker.stepping,
        fighting: this.foe !== null,
      };
    }

    const rooms = gym.interior.rooms ?? [];
    const leaderSlot = gym.interior.slots.find((slot) => slot.role === 'leader');
    const trainerTiles = gym.interior.slots
      .filter((slot) => slot.role === 'trainer')
      .map((slot) => copyTile(slot.tile));
    const trainers = trainerTiles
      .map((hostTile, index) => ({ index, id: gymTrainerId(gym.cityKey, index), tile: hostTile }))
      .filter((trainer) => !isTrainerDefeated(run, trainer.id));
    const leaderFoe = gymLeaderFoe(plan, run, gym.cityKey);
    const roomAt = rooms.findIndex((room) => inRect(room.rect, tile));

    return {
      key: gym.cityKey,
      tile,
      room: roomAt,
      rooms: rooms.length,
      puzzle: gym.puzzle.entry.id,
      puzzleDoor: rooms[2]?.doorIn === undefined ? null : copyTile(rooms[2].doorIn),
      leaderDoor: rooms[LEADER_ROOM]?.doorIn === undefined ? null : copyTile(rooms[LEADER_ROOM].doorIn),
      solved: gymSolved(run, gym),
      slides: this.slides,
      falls: this.falls,
      trainers,
      leader: {
        id: gymLeaderId(gym.cityKey),
        tile: leaderSlot === undefined ? { x: 0, y: 0 } : copyTile(leaderSlot.tile),
        size: leaderFoe.roster.length,
        levels: leaderFoe.roster.map((entry) => entry.level),
      },
      badges,
      badgeTotal: BADGE_CAPS.length,
      entry: copyTile(gym.interior.entry),
      stepping: walker !== null && walker.stepping,
      fighting: this.foe !== null,
    };
  }

  /** Dev only: stands the player on `tile` and lets that tile's own landing rule answer. */
  placePlayer(tile: Tile): void {
    const walker = this.walker;
    if (walker === null) return;
    walker.place(tile);
    this.playerSprite?.setDepth(actorDepth(this.playerSprite.y));
    this.landed(tile);
  }

  /** Dev only: one step through the same dispatch `update` uses; false when nothing moved. */
  stepDirection(direction: MoveDirection): boolean {
    const walker = this.walker;
    const gym = this.gym;
    if (walker === null || gym === null || this.foe !== null || this.leaving) return false;
    const ice = gym.puzzle.ice;
    const moved =
      ice !== null && iceCellAt(ice, walker.tile) === 'ice'
        ? this.slideTo(direction, ice)
        : walker.step(direction);
    this.playerSprite?.setDepth(actorDepth(this.playerSprite.y));
    return moved;
  }

  /** The music bed comes back after a battle took the channel. */
  private takeMusicBack(): void {
    playMusic(this, GYM_MUSIC);
  }

  private persistRun(): void {
    if (this.run) storeRun(browserStorage(), this.run);
  }

  private buildPlayer(spawn: Tile): void {
    const gym = this.gym;
    if (gym === null) return;
    const sprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(actorDepth(0));
    this.playerSprite = sprite;
    this.walker = new WorldWalker(this, sprite, gym.interior.tiles, {
      onStep: (_from, to) => this.landed(to),
    });
    this.walker.place(spawn);
    sprite.setDepth(actorDepth(sprite.y));
    this.followCamera(sprite);
  }

  /**
   * Draws every host the run has not beaten: the room-1 trainer and the leader, on
   * their slots, exactly as the route draws a trainer. A beaten host is gone on the
   * next entry, because it is gone from this draw.
   */
  private redrawHosts(): void {
    for (const object of this.hosts) object.destroy();
    this.hosts = [];
    const gym = this.gym;
    const run = this.run;
    if (gym === null || run === null) return;
    const node = this.plan === null ? undefined : nodeOf(this.plan, gym.cityKey);
    if (node === undefined) return;
    const archetype = getTrainerArchetype(gymForBadge(node.badge).archetypeId);
    const spriteKey = archetype?.spriteKey ?? null;
    const frame = overworldSpriteFrame(spriteKey ?? '', 'down');

    for (const slot of gym.interior.slots) {
      if (slot.role !== 'trainer' && slot.role !== 'leader') continue;
      const trainer = slot.role === 'trainer';
      const id = trainer ? gymTrainerId(gym.cityKey, 0) : gymLeaderId(gym.cityKey);
      if (isTrainerDefeated(run, id)) continue;
      const footY = this.centerY(slot.tile.y) + TILE_SIZE / 2;
      const sprite =
        frame !== null
          ? this.add
              .sprite(this.centerX(slot.tile.x), footY, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
              .setOrigin(0.5, 1)
              .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
              .setDepth(actorDepth(footY))
          : this.add
              .sprite(this.centerX(slot.tile.x), this.centerY(slot.tile.y), TRAINER_TEXTURE_KEY)
              .setTint(archetype?.colour ?? 0xffffff)
              .setDepth(actorDepth(footY));
      this.hosts.push(sprite);
    }
  }

  /** The host the press opens: unbeaten, and on the player's tile or an orthogonal neighbour. */
  private hostBeside(): HostTarget | null {
    const gym = this.gym;
    const run = this.run;
    const walker = this.walker;
    if (gym === null || run === null || walker === null) return null;
    const at = walker.tile;
    for (const slot of gym.interior.slots) {
      if (slot.role !== 'trainer' && slot.role !== 'leader') continue;
      const trainer = slot.role === 'trainer';
      const index = trainer ? 0 : -1;
      const id = trainer ? gymTrainerId(gym.cityKey, index) : gymLeaderId(gym.cityKey);
      if (isTrainerDefeated(run, id)) continue;
      if (Math.abs(slot.tile.x - at.x) + Math.abs(slot.tile.y - at.y) <= 1) {
        return { role: slot.role, index };
      }
    }
    return null;
  }

  /** The confirm and the interact key both open the host the player stands on or beside. */
  private handleAction(action: KeybindAction): void {
    if (action !== 'interact' && action !== 'confirm') return;
    if (!this.scene.isActive()) return;
    if (this.foe !== null || this.leaving) return;
    const host = this.hostBeside();
    if (host === null) return;
    if (host.role === 'leader') this.startLeaderFight();
    else this.startTrainerFight(host.index);
  }

  /** Launches `foe`'s battle over a paused gym, with the run's own party and bag. */
  private openFight(foe: GymFoe): boolean {
    const run = this.run;
    if (run === null) return false;
    const launch: BattleLaunch = {
      trigger: {
        kind: 'trainer',
        trainerId: foe.id,
        trainerName: foe.name,
        roster: foe.roster,
        archetypeId: foe.archetypeId,
      },
      player: run.party.map((member) => member.fighter),
      bag: run.bag,
      xp: run.xp,
      seed: battleSeed(run.seed, run.routeIndex, foe.id),
      runSeed: run.seed,
      routeIndex: run.routeIndex,
      // A gym is fought for its badge: no capture, no catch.
      canCapture: false,
      firstCatch: false,
      aiLevel: loadSettings().aiLevel,
      returnScene: GYM_RETURN_SCENE,
    };
    this.foe = foe;
    this.scene.pause();
    this.scene.launch('Battle', launch);
    return true;
  }

  /** The direction the player is pushing, in the walker's own precedence. */
  private heldDirection(): MoveDirection | null {
    const keys = this.keys;
    if (keys === null) return null;
    const pressed = (list: Phaser.Input.Keyboard.Key[]): boolean =>
      list.some((key) => key.isDown || Phaser.Input.Keyboard.JustDown(key));
    if (pressed(keys.left)) return 'left';
    if (pressed(keys.right)) return 'right';
    if (pressed(keys.up)) return 'up';
    if (pressed(keys.down)) return 'down';
    return null;
  }

  /**
   * One press on the ice room (`docs/region-spec.md` §7.4): the walker is not updated
   * at all here, and the scene drives the cadence itself. A direction the floor
   * refused is held back until the key is released, so nothing is allocated per frame.
   */
  private pollSlide(time: number, running: boolean, ice: IceRoom): void {
    const direction = this.heldDirection();
    if (direction === null) {
      this.blocked = null;
      return;
    }
    if (direction === this.blocked) return;
    this.blocked = null;
    if (time < this.nextStepAt) return;
    this.nextStepAt = time + (running ? RUN_STEP_MS : WALK_STEP_MS);
    if (!this.slideTo(direction, ice)) this.blocked = direction;
  }

  /**
   * One ice step: a `DOOR` ahead is an ordinary one-tile walk even from ice, because
   * the doors sit on the room's wall ring and `slideStep` could never end on one.
   * Otherwise the room's own floor decides — a hole lands the player wherever its
   * landing says, any other stop is a slide — and a stop where the player stood is a
   * refusal, never a move.
   */
  private slideTo(direction: MoveDirection, ice: IceRoom): boolean {
    const walker = this.walker;
    const gym = this.gym;
    if (walker === null || gym === null) return false;
    const from = walker.tile;
    const step = STEP[direction];
    if (tileAt(gym.interior.tiles, { x: from.x + step.x, y: from.y + step.y }) === DOOR) {
      return walker.step(direction);
    }
    const result = slideStep(ice, from, direction);
    if (result.landing !== null) {
      this.falls += 1;
      walker.place(result.landing.tile);
      this.landed(result.landing.tile);
      return true;
    }
    if (result.stop.x === from.x && result.stop.y === from.y) return false;
    this.slides += 1;
    walker.place(result.stop);
    this.landed(result.stop);
    return true;
  }

  /**
   * What a landed tile means: the leader's room is the gym's solved mark, and the
   * door the player arrived on walks them back out. Both are the run's facts.
   */
  private landed(tile: Tile): void {
    if (this.leaving) return;
    this.markSolved(tile);
    if (this.leaving) return;
    const gym = this.gym;
    if (gym === null) return;
    if (tile.x === gym.interior.entry.x && tile.y === gym.interior.entry.y) this.exitToCity();
  }

  /**
   * Room 3 is reachable only through the ice room (§7.2 keeps the entrance/leader
   * wall shut), so standing there is proof the room was crossed. Written once, and
   * only when the run does not already carry it.
   */
  private markSolved(tile: Tile): void {
    const gym = this.gym;
    const run = this.run;
    if (gym === null || run === null) return;
    if (gymSolved(run, gym)) return;
    const room = (gym.interior.rooms ?? [])[LEADER_ROOM];
    if (room === undefined || !inRect(room.rect, tile)) return;
    this.run = markItemPicked(run, gym.solvedKey);
    this.persistRun();
  }

  /** Dev only: the browser pass reaches this scene by name, as it does the city's. */
  private exposeDebugScene(): void {
    if (!IS_DEVELOP) return;
    (globalThis as Record<string, unknown>).__pkmGym = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (globalThis as Record<string, unknown>).__pkmGym;
    });
  }
}

export const regionSceneClass = GymScene;
