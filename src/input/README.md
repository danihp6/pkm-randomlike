# `src/input/` — keyboard layer

The one place scenes turn key presses into player actions. The vocabulary —
which actions exist, their defaults, labels and the pure rebind rules — lives in
`src/data/keybinds.ts`, so the save can validate a binding without Phaser.
`input.ts` is the Phaser half:

- `subscribeKeybinds(scene, handler)` routes a scene's keydowns through the map
  (confirm / cancel / move / party / hud / settings). Auto-repeat is skipped, the
  map is re-read per press so a rebind applies immediately, and a paused scene
  gets nothing.
- `actionKeys(scene, action)` returns the Phaser Keys behind an action, for the
  two places that poll held state (the route's walk, the battle's hold-to-skip).
- `keyNameOf(event)` maps a native event to the Phaser key name the map stores.

Scenes keep their own one-off keys (the dev `B` wild battle, the starter's `S` seed
prompt) on Phaser directly; anything the player can rebind goes through here.
