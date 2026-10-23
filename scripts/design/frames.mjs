export const page = 'Page 1';

export const frames = [
  { name: '01 Main menu', task: 145, panel: 'main-menu', scene: 'src/scenes/MainMenuScene.ts' },
  { name: '01b Main menu · no save', task: 145, panel: 'main-menu', scene: 'src/scenes/MainMenuScene.ts' },
  { name: '02 Options', task: 127, panel: 'options', scene: 'src/scenes/SettingsScene.ts' },
  { name: '03 Route HUD', task: 139, panel: 'hud', scene: 'src/scenes/panels/hud.ts' },
  { name: '03b Panels · row view', task: 129, panel: 'bag', scene: 'src/scenes/panels/bag.ts' },
  { name: '03c Panels · compress', task: 131, panel: 'party', scene: 'src/scenes/panels/party.ts' },
  { name: '03d Route · shop · buy', task: 134, panel: 'shop', scene: 'src/scenes/panels/shop.ts' },
  { name: '03e Route · shop · sell', task: 134, panel: 'shop', scene: 'src/scenes/panels/shop.ts' },
  { name: '03f Panels · reward item', task: 136, panel: 'rewards', scene: 'src/scenes/panels/rewards.ts' },
  { name: '03g Panels · reward pokemon', task: 136, panel: 'rewards', scene: 'src/scenes/panels/rewards.ts' },
  { name: '03h Panels · rocket slots', task: null, panel: 'rocket', scene: 'src/scenes/rooms/casino.ts' },
  { name: '03i Panels · trade pick', task: 135, panel: 'trade', scene: 'src/scenes/panels/trade.ts' },
  { name: '03j Panels · trade result', task: 135, panel: 'trade', scene: 'src/scenes/panels/trade.ts' },
  { name: '03k Panels · notice item', task: 137, panel: 'notices', scene: 'src/scenes/panels/notices.ts' },
  { name: '03l Panels · notice level up', task: 137, panel: 'notices', scene: 'src/scenes/panels/notices.ts' },
  { name: '03m Panels · pokemon moves', task: 132, panel: 'detail', scene: 'src/scenes/panels/detail.ts' },
  { name: '03n Panels · pause menu', task: 138, panel: 'pause', scene: 'src/scenes/panels/pause.ts' },
  { name: '03o Panels · map routes', task: 133, panel: 'map', scene: 'src/scenes/panels/map.ts' },
  { name: '03p Panels · pc rip', task: 130, panel: 'pc', scene: 'src/scenes/panels/pc.ts' },
  { name: '04 Starter pick', task: 147, panel: 'starter', scene: 'src/scenes/StarterScene.ts' },
  { name: '05 Battle HUD', task: 140, panel: 'battle-hp', scene: 'src/scenes/BattleScene.ts' },
  { name: '05b Battle · message', task: 144, panel: 'battle-log', scene: 'src/scenes/BattleScene.ts' },
  { name: '05c Battle · bag', task: 142, panel: 'battle-bag', scene: 'src/scenes/BattleScene.ts' },
  { name: '05d Battle · pokemon', task: 143, panel: 'battle-switch', scene: 'src/scenes/BattleScene.ts' },
  { name: '05e Battle · stats', task: 143, panel: 'battle-switch', scene: 'src/scenes/BattleScene.ts' },
  { name: '06 Run over · defeat', task: 148, panel: 'run-over', scene: 'src/scenes/RunOverScene.ts' },
  { name: '07 Run over · victory', task: 148, panel: 'run-over', scene: 'src/scenes/RunOverScene.ts' },
  { name: '07b Run over · victory · pokemon', task: 148, panel: 'run-over', scene: 'src/scenes/RunOverScene.ts' },
  { name: '08 Stats · totals', task: 146, panel: 'stats', scene: 'src/ui/hud/panels/stats' },
  { name: '08b Stats · runs', task: 146, panel: 'stats', scene: 'src/ui/hud/panels/stats' },
  { name: '08c Stats · pokemon', task: 146, panel: 'stats', scene: 'src/ui/hud/panels/stats' },
  { name: '09 Ranking', task: 146, panel: 'stats', scene: 'src/ui/hud/panels/stats' },
  { name: '09b Ranking · pokemon', task: 146, panel: 'stats', scene: 'src/ui/hud/panels/stats' },
];

export function slugOf(name) {
  return name
    .toLowerCase()
    .replace(/·/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
