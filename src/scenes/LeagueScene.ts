import Phaser from 'phaser';
import type { KeybindAction } from '../data/keybinds';
import { LEAGUE, type LeagueRow } from '../data/league';
import { LEAGUE_LEVEL } from '../data/region';
import { IS_DEVELOP } from '../dev/env';
import {
  leagueCleared,
  leagueEnter,
  leagueFoe,
  leagueNext,
  leagueProgress,
  leagueReward,
  leagueTrainerId,
  leagueWin,
  type LeagueFoe,
} from '../engine/region/league';
import { nodeKey, nodeOf, planRegion, type RegionPlan } from '../engine/region/plan';
import {
  TOWER_NODE_KEY,
  towerHeal,
  towerOpen,
  towerResolve,
  towerReward,
  towerStep,
  type TowerFoe,
} from '../engine/region/tower';
import { travel } from '../engine/region/travel';
import {
  battleSeed,
  hasLivingParty,
  resolveBattle,
  type BattleLaunch,
  type BattleReturn,
  type RunState,
} from '../engine/run';
import { loadSave, storeRun, type Settings } from '../engine/save';
import { subscribeKeybinds } from '../input/input';
import { playCue, playMusic } from '../audio/audio';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { t } from '../i18n';
import { addFrlgWindow, FRLG_ACCENT, FRLG_MUTED, FRLG_SURFACE } from '../ui/frlg';
import { addFrlgText, FRLG_INK } from '../ui/frlgFont';
import { createScenePanels, type ScenePanels } from './panels/host';

/**
 * The League (`docs/region-spec.md` §7.6) and the endless tower behind it (§7.11),
 * as one screen of two modes. In **league** mode it is the four Elite Four members
 * and the Champion, fought as one chain the moment the run walks in: the screen heals
 * on entry, opens the next unbeaten row's battle, heals again after every win and
 * never shows a shop or a door. In **tower** mode it is the run's endless streak:
 * the entry heal, the next rung off the run's own streak and the wipe that is the
 * only ending. `src/engine/region/league.ts` and `src/engine/region/tower.ts` own
 * who fights, what they field and when the way out opens; this scene plays those
 * rules and draws them.
 *
 * It is a region node scene like a city or a gym, so it registers itself through
 * `regionSceneKey` / `regionSceneClass` and `src/main.ts` never names it. It
 * reads the run it is handed (`scene.start('League', { run })`) — or, on a resume,
 * the saved one — and folds each battle through the shipped `resolveBattle`.
 */

export const regionSceneKey = 'League';

/** The scene key a League row's battle returns to. */
export const LEAGUE_RETURN_SCENE = 'League';

/** Which of the League node's two modes the scene is playing. */
export type LeagueSceneMode = 'league' | 'tower';

/** The panel's widest size, the margin it keeps from the screen, and its two row heights. */
const PANEL_MAX_WIDTH = 720;
const PANEL_MARGIN = 40;
const ROW_HEIGHT = 46;
const FOOTER_HEIGHT = 32;
const PANEL_PADDING = 28;

export class LeagueScene extends Phaser.Scene {
  private run: RunState | null = null;
  /** The run `init` was handed, before the entry heal. */
  private incoming: RunState | null = null;
  /** Which of the node's two modes the run it was handed asks for. */
  private mode: LeagueSceneMode = 'league';
  /** The League row whose battle is open, or null while the scene is not fighting. */
  private foe: LeagueFoe | null = null;
  /** The tower rung whose battle is open, or null in league mode or between fights. */
  private towerFoe: TowerFoe | null = null;
  /**
   * The row to open once this scene is resumed. A battle's `stop` lands in the
   * same scene queue as anything launched from its own return, so the next fight
   * waits a frame: `update` opens it after the resume.
   */
  private pending: number | null = null;
  /** The tower's next rung, queued the same one-frame way as `pending`. */
  private pendingTower = false;
  /** True once the run-over hand-off is queued; the scene stops itself after it. */
  private ending = false;
  /** True once the exit has been taken, so a second press cannot travel twice. */
  private leaving = false;
  /** How many entry heals actually rested something. */
  private healed = 0;
  /** Everything `paint` drew, so a repaint can drop it. */
  private painted: Phaser.GameObjects.GameObject[] = [];
  /** The settings the cards read; read once per entry, like every node scene. */
  private settings!: Settings;
  /** The shared panel layer the League mounted once its run was healed. */
  private panelLayer: ScenePanels | null = null;

  constructor() {
    super(regionSceneKey);
  }

  init(data?: { run?: RunState }): void {
    this.incoming = data?.run ?? null;
    this.foe = null;
    this.towerFoe = null;
    this.pending = null;
    this.pendingTower = false;
    this.ending = false;
    this.leaving = false;
    this.healed = 0;
  }

  create(): void {
    const incoming = this.incoming ?? loadSave(browserStorage()).run;
    if (!incoming) {
      this.scene.start('MainMenu');
      return;
    }

    // The mode is the node the run stands on: the League plays its chain, the
    // tower behind it plays the endless streak (`docs/region-spec.md` §7.11).
    this.mode = incoming.nodeKey === TOWER_NODE_KEY ? 'tower' : 'league';

    // The entry heal: HP and PP back to full across the party and the box, never
    // a revival (D5), and the run only rewritten when something was missing.
    const healed = this.mode === 'tower' ? towerHeal(incoming) : leagueEnter(incoming);
    this.run = healed;
    if (this.run !== incoming) this.healed += 1;
    this.persistRun();

    this.settings = loadSettings();
    this.mountPanels();
    this.paint();
    playMusic(this, 'menu-music');
    // The battle above took the music channel; the League takes it back between
    // two fights, exactly as the route does.
    this.events.on(Phaser.Scenes.Events.RESUME, this.takeMusicBack, this);
    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.takeMusicBack, this);
      this.scale.off('resize', this.onResize, this);
      for (const object of this.painted) object.destroy();
      this.painted = [];
    });

    if (IS_DEVELOP) {
      (globalThis as Record<string, unknown>).__pkmLeague = this;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (globalThis as Record<string, unknown>).__pkmLeague;
      });
    }

    if (this.mode === 'tower') {
      this.startTowerFight();
      return;
    }
    const next = leagueNext(this.run);
    if (next !== null) this.startFight(next);
  }

  /**
   * Opens the fight the scene is waiting on once the battle that just returned
   * has finished stopping, and stops the scene itself after a run over. A paused
   * scene runs neither, so the chain is one frame behind the fold by design.
   */
  override update(): void {
    if (this.pending !== null) {
      const index = this.pending;
      this.pending = null;
      if (!this.leaving && !this.ending) this.startFight(index);
      return;
    }
    if (this.pendingTower) {
      this.pendingTower = false;
      if (!this.leaving && !this.ending) this.startTowerFight();
      return;
    }
    if (this.ending) {
      this.ending = false;
      this.scene.stop();
    }
  }

  /**
   * Called by `BattleScene` before it stops: folds the row's result, heals after
   * a win and queues the next row. A wipe goes straight to the run-over screen.
   * In tower mode it folds through `towerResolve`, so a win steps the streak and
   * heals while a loss re-opens the same rung and only a wipe ends the run.
   */
  applyBattleResult(result: BattleReturn): void {
    if (this.mode === 'tower') {
      this.applyTowerResult(result);
      return;
    }
    const foe = this.foe;
    const run = this.run;
    this.foe = null;
    if (!foe || !run) return;

    const folded = resolveBattle(run, result, leagueReward(foe));
    this.run = folded.run;
    const won = result.outcome === 'win' || result.outcome === 'capture';
    if (won) this.run = leagueWin(this.run, foe.index);
    this.persistRun();

    if (!hasLivingParty(this.run)) {
      this.paint();
      this.ending = true;
      this.scene.start('RunOver', { run: this.run, won: false });
      return;
    }

    if (!won) {
      // A fight the run walked out of leaves the row unbeaten: it is fought again.
      this.pending = foe.index;
      return;
    }

    // A won row heals the squad before the next one — the League's one service
    // (`docs/region-spec.md` §6) — and never pulls a fallen member back (D5).
    const rested = leagueEnter(this.run);
    if (rested !== this.run) {
      this.run = rested;
      this.healed += 1;
      this.persistRun();
    }
    playCue(this, 'victory');
    this.paint();
    this.pending = leagueNext(this.run);
  }

  /** Dev only: what a browser pass reads. */
  debugLeagueState(): Readonly<{
    key: string;
    mode: LeagueSceneMode;
    progress: number;
    next: number | null;
    cleared: boolean;
    foes: readonly number[];
    healed: number;
    paused: boolean;
    streak: number;
    towerOpen: boolean;
    towerFoe: Readonly<{
      rung: number;
      trainerId: string;
      name: string;
      level: number;
      partySize: number;
    }> | null;
    run: RunState;
  }> {
    const run = this.run;
    const tower = this.mode === 'tower';
    const foe = tower ? this.towerFoe : null;
    return {
      key: regionSceneKey,
      mode: this.mode,
      progress: run ? leagueProgress(run) : 0,
      next: tower || !run ? null : leagueNext(run),
      cleared: run ? leagueCleared(run) : false,
      foes: LEAGUE.map((row) => row.index),
      healed: this.healed,
      paused: this.scene.isPaused(),
      streak: run ? run.towerStreak : 0,
      towerOpen: run ? towerOpen(run) : false,
      towerFoe: foe
        ? {
            rung: foe.rung,
            trainerId: foe.trainerId,
            name: foe.name,
            level: foe.level,
            partySize: foe.roster.length,
          }
        : null,
      run: run as RunState,
    };
  }

  /** Called when a battle folds the League back on screen: the bed returns. */
  private takeMusicBack(): void {
    playMusic(this, 'menu-music');
  }

  /**
   * The seven cards a node scene draws (`./panels/host.ts`), built here because the
   * League is a screen of its own and not a `WorldScene`: the healed run, the two
   * writes it owns and no room card. The cards unmount with the scene.
   */
  private mountPanels(): void {
    const layer = createScenePanels({
      scene: this,
      run: () => this.liveRun(),
      settings: () => this.settings,
      actions: {
        openSettings: () => this.openSettings(),
        commitRun: (run) => this.commitRun(run),
        persistRun: () => this.persistRun(),
      },
    });
    this.panelLayer = layer;
    layer.build();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.panelLayer === null) return;
      this.panelLayer.close();
      this.panelLayer = null;
    });
  }

  /** A window resize repaints the canvas panel and every card over it. */
  private onResize(): void {
    this.paint();
    this.panelLayer?.refresh();
  }

  /** The pause card's Settings row: the League pauses under the options page. */
  private openSettings(): void {
    if (this.foe !== null || this.towerFoe !== null || this.leaving) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: regionSceneKey });
  }

  /** Sets the scene's run, persists it and repaints the cards (a HUD write). */
  private commitRun(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.panelLayer?.refresh();
  }

  /** The live run, or a throw: the layer is only built once the run is healed. */
  private liveRun(): RunState {
    const run = this.run;
    if (run === null) throw new Error('the League has no run');
    return run;
  }

  /** Writes the run to the save slot, so a reload resumes the chain it is on. */
  private persistRun(): void {
    if (this.run) storeRun(browserStorage(), this.run);
  }

  /** The row's battle, launched over a paused League with the run's own party. */
  private startFight(index: number): void {
    const run = this.run;
    if (!run || this.leaving) return;
    const foe = leagueFoe(planRegion(run.seed), run, index);
    const launch: BattleLaunch = {
      trigger: {
        kind: 'trainer',
        trainerId: leagueTrainerId(foe.index),
        trainerName: foe.row.name,
        roster: foe.roster,
        archetypeId: foe.row.archetypeId,
      },
      player: run.party.map((member) => member.fighter),
      bag: run.bag,
      xp: run.xp,
      seed: battleSeed(run.seed, run.routeIndex, leagueTrainerId(foe.index)),
      runSeed: run.seed,
      routeIndex: run.routeIndex,
      // The League is fought for the badge it already is: no capture, no catch.
      canCapture: false,
      firstCatch: false,
      aiLevel: loadSettings().aiLevel,
      returnScene: LEAGUE_RETURN_SCENE,
    };
    this.foe = foe;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /**
   * The tower's fight after the run's own streak (`docs/region-spec.md` §7.11):
   * the shipped trainer battle, with no archetype row, no capture and the rung's
   * own battle seed, over a paused League.
   */
  private startTowerFight(): void {
    const run = this.run;
    if (!run || this.leaving) return;
    const foe = towerStep(run, run.towerStreak);
    if (foe === null) return;
    const launch: BattleLaunch = {
      trigger: {
        kind: 'trainer',
        trainerId: foe.trainerId,
        trainerName: foe.name,
        roster: foe.roster,
      },
      player: run.party.map((member) => member.fighter),
      bag: run.bag,
      xp: run.xp,
      seed: battleSeed(run.seed, run.routeIndex, foe.trainerId),
      runSeed: run.seed,
      routeIndex: run.routeIndex,
      // The tower is endless and fought for its own streak: no capture, no catch.
      canCapture: false,
      firstCatch: false,
      aiLevel: loadSettings().aiLevel,
      returnScene: LEAGUE_RETURN_SCENE,
    };
    this.towerFoe = foe;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /**
   * The tower's fold: a win steps the streak and rests the squad, a loss re-asks
   * for the same rung, and only a party with nobody living ends the run — the
   * tower never ends a run that still has a party.
   */
  private applyTowerResult(result: BattleReturn): void {
    const foe = this.towerFoe;
    const run = this.run;
    this.towerFoe = null;
    if (!foe || !run) return;

    const folded = resolveBattle(run, result, towerReward(foe));
    const won = result.outcome === 'win' || result.outcome === 'capture';
    const settled = towerResolve(folded.run, foe, won);
    this.run = settled.run;
    this.persistRun();

    if (settled.over) {
      this.paint();
      this.ending = true;
      this.scene.start('RunOver', { run: this.run });
      return;
    }

    if (!won) {
      this.pendingTower = true;
      return;
    }

    playCue(this, 'victory');
    this.paint();
    this.pendingTower = true;
  }

  /**
   * The exit (`docs/region-spec.md` §5, §7.6, §7.11): the tower's door, through the
   * region's one travel seam, and only once `towerOpen` says the Champion has
   * fallen. Before that the press is refused and the League keeps the run, and in
   * tower mode there is nowhere left to walk: the tower is the last node.
   */
  exitToTower(): boolean {
    const run = this.run;
    if (
      !run ||
      this.mode === 'tower' ||
      this.leaving ||
      this.foe !== null ||
      this.towerFoe !== null ||
      this.pending !== null ||
      this.pendingTower
    ) {
      return false;
    }
    if (!towerOpen(run)) return false;
    const arrived = travel(planRegion(run.seed), run, TOWER_NODE_KEY, 'walk');
    if (!arrived.ok) return false;
    this.leaving = true;
    this.run = arrived.run;
    this.persistRun();
    // The tower has no world and no carver, so the run re-enters this scene: the
    // restart's `init` resets `leaving` and its `create` reads the tower node and
    // plays tower mode. A self-`start` paired with `stop` would kill it instead.
    this.scene.restart({ run: this.run });
    return true;
  }

  /** The confirm and the interact key both take the exit once it is open. */
  private handleAction(action: KeybindAction): void {
    if (action !== 'confirm' && action !== 'interact') return;
    if (!this.scene.isActive()) return;
    this.exitToTower();
  }

  /** Repaints the whole screen from the live run: the five League rows, or the tower's one. */
  private paint(): void {
    for (const object of this.painted) object.destroy();
    this.painted = [];
    const run = this.run;
    if (!run) return;

    const width = this.scale.width;
    const height = this.scale.height;
    const panelWidth = Math.max(320, Math.min(PANEL_MAX_WIDTH, width - PANEL_MARGIN * 2));
    const panelHeight = PANEL_PADDING * 2 + ROW_HEIGHT * (LEAGUE.length + 1) + FOOTER_HEIGHT;
    const left = Math.round((width - panelWidth) / 2);
    const top = Math.max(PANEL_MARGIN, Math.round((height - panelHeight) / 2));
    const progress = leagueProgress(run);
    const next = leagueNext(run);

    const backdrop = this.add.rectangle(0, 0, width, height, FRLG_SURFACE).setOrigin(0, 0);
    const panel = addFrlgWindow(this, left, top, panelWidth, panelHeight);
    this.painted.push(backdrop, panel);

    const plan = planRegion(run.seed);
    if (this.mode === 'tower') {
      this.paintTower(run, plan, left, top, panelWidth);
      return;
    }

    const title = nodeOf(plan, nodeKey('league', 1))?.name ?? regionSceneKey;
    this.painted.push(
      addFrlgText(this, left + PANEL_PADDING, top + PANEL_PADDING, title, {
        tint: FRLG_ACCENT,
      }),
    );

    let rowY = top + PANEL_PADDING + ROW_HEIGHT;
    for (const row of LEAGUE) {
      this.paintRow(row, left, rowY, panelWidth, progress, next);
      rowY += ROW_HEIGHT;
    }

    if (leagueCleared(run)) {
      this.painted.push(
        addFrlgText(this, left + panelWidth / 2, rowY + 6, t('hud.pressAnyKey'), {
          tint: FRLG_INK,
          align: 'center',
          origin: [0.5, 0],
        }),
      );
    }
  }

  /**
   * The tower's one row (`docs/region-spec.md` §7.11): the node's name as the
   * title, the run's streak as a bare figure and the level every rung's five carry.
   * The panel's box is the League's own, so the screen does not move, and there is
   * no cleared footer: the tower is never cleared.
   */
  private paintTower(
    run: RunState,
    plan: RegionPlan,
    left: number,
    top: number,
    panelWidth: number,
  ): void {
    const title = nodeOf(plan, TOWER_NODE_KEY)?.name ?? regionSceneKey;
    const rowY = top + PANEL_PADDING + ROW_HEIGHT;
    this.painted.push(
      addFrlgText(this, left + PANEL_PADDING, top + PANEL_PADDING, title, { tint: FRLG_ACCENT }),
      addFrlgText(this, left + PANEL_PADDING, rowY, String(run.towerStreak), { tint: FRLG_ACCENT }),
      addFrlgText(
        this,
        left + panelWidth - PANEL_PADDING,
        rowY,
        t('hud.level', { level: LEAGUE_LEVEL }),
        {
          tint: FRLG_MUTED,
          align: 'right',
          origin: [1, 0],
        },
      ),
    );
  }

  /** One row of the list: the mark, the class, the name and the level. */
  private paintRow(
    row: LeagueRow,
    left: number,
    rowY: number,
    panelWidth: number,
    progress: number,
    next: number | null,
  ): void {
    const beaten = row.index <= progress;
    const current = row.index === next;
    const markX = left + PANEL_PADDING + 6;
    const mark = this.add.circle(markX, rowY + 8, 5, beaten ? FRLG_ACCENT : FRLG_MUTED);
    if (!beaten) mark.setFillStyle(FRLG_SURFACE);
    mark.setStrokeStyle(2, current ? FRLG_ACCENT : FRLG_MUTED);
    this.painted.push(
      mark,
      addFrlgText(this, left + PANEL_PADDING + 24, rowY, row.className, {
        tint: current ? FRLG_ACCENT : FRLG_MUTED,
      }),
      addFrlgText(this, left + PANEL_PADDING + 24 + 140, rowY, row.name, {
        tint: beaten ? FRLG_MUTED : FRLG_INK,
      }),
      addFrlgText(this, left + panelWidth - PANEL_PADDING, rowY, t('hud.level', { level: row.level }), {
        tint: FRLG_MUTED,
        align: 'right',
        origin: [1, 0],
      }),
    );
  }
}

export const regionSceneClass = LeagueScene;
