# Gravity Shift

**Entry for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026) — theme: SHIFT**

A third-person arena shooter set on a neon construction site, where you can kick the floor out from under everyone. Hit one of the magenta gravity panels and the whole arena turns 90° — that wall becomes the floor, and every other fighter, crate, barrel and rocket falls. You land on your feet.

**Play in the browser:** _itch.io link coming soon_

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look / aim (click to capture the mouse) |
| W A S D | Walk |
| Shift | Sprint — vaults low obstacles |
| Space | Jump · hold near a ledge to grab it |
| C (hold) | Crouch · Shift + C = slide |
| Left mouse | Pistol, or the shotgun once you find one |
| Mouse wheel / Q / 1 / 2 | Switch pistol ⇄ shotgun |
| Right mouse | Flare rocket — fire at your feet and jump for a rocket jump |
| E | Kick — knocks fighters down, sends boxes and spiders flying; at a magenta panel it turns the arena |
| R / Esc | Reload / pause |

## Features

- A tutorial with five practice rooms: advanced traversal, a drone shooting range, rocket jumping, an arena-shift corridor puzzle and a first fight against an easy bot

- Gravity turns: the level, its decoration, props, fighters and projectiles all rotate together
- Seeded level generation — share a seed to replay the same arena
- Bots with a view cone, reaction time and four skill levels (or 0 bots to explore)
- Rocket jumps, sliding kicks, ledge grabs, knockdowns and ragdolls
- White spiders that crawl on any surface and ignore gravity turns
- Custom WebGL renderer and procedural audio — no engine, no external assets

## Building

The game is plain JavaScript with no dependencies. `index.html` is the built, self-contained game; to rebuild it after editing anything in `src/` or `shell.html`:

```
python3 build.py
```

Then open `index.html` in a browser.

| File | Contents |
| --- | --- |
| `shell.html` | Page, menus, styles |
| `src/01_engine.js` | Math, WebGL renderer |
| `src/02_world.js` | Voxel level, generator, collision, rotations, navigation |
| `src/02b_deco.js` | Pipes, vents, cables, lamps |
| `src/03_chars.js` | Fighters: movement, parkour, procedural animation, ragdolls |
| `src/04_combat.js` | Weapons, explosions, props, sound |
| `src/04b_spiders.js` | Spiders |
| `src/05_ai.js` | Bots |
| `src/06_game.js` | Game loop, input, camera, HUD, menus |
| `src/07_tutorial.js` | Tutorial rooms, drones, objectives |

## How AI was used

Designed and directed by me; the code was written with Claude (Anthropic's AI assistant) from my design and feedback.

## License

MIT — see [LICENSE](LICENSE).
