# ONE MORE THING

A 2D physics burglar game. You are a tiny, stretchy thief stealing from a sleeping giant's living room, and everything you steal stays physically stuck to you.

Hand-inked storybook look: wobbly outlines, cel shading, film grain, paper-card HUD. The thief is a regular little burglar (striped shirt, beanie, domino mask) with comically stretchy arms, and loot hangs from his belt on twine.

HTML5 canvas + [Matter.js](https://brm.io/matter-js/) 0.19 (bundled locally). The only external script is the Playgama Bridge.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move / hop | A D / arrows, W / Space | on-screen ◀ ▶ HOP |
| Stretch an arm, grab furniture, reel yourself in | hold mouse (right mouse = second arm) | hold a finger in the room (two fingers = two arms) |
| Stash loot onto your body | quick click on loot, or E, or reel loot in and let go close to you | quick tap |
| Drop a hauled item | Q (item nearest the cursor) | DROP |
| Restart | R | ↻ button |
| Mute | M | speaker button |

Reeling yourself up to a ledge hauls you over it. Loot inside the doormat zone by the mousehole banks itself after a moment.

## Rules

* Impacts make noise (speed × mass × material). Small bumps are free, big crashes aren't, and the doormat muffles sound.
* Noise past 100 wakes the giant: you get 11 seconds to get home. Anything still unbanked when he catches you is lost.
* Bank $700 to "pay the rent", but there are $1450 of loot in the room.

## Loot personalities

necklace (swings), pocket watch, bouncy ball (destabilises the haul), teapot, candlestick, frying pan (loud), television (heavy), vacuum cleaner (occasionally switches on and drags you), trophy, diamond ring.

## Layout

* `index.html` – page shell (loads the Bridge from the Playgama CDN)
* `game.js` – physics world, arms/haul mechanics, noise/giant, HUD, Bridge integration (storage, pause/audio events, interstitial at run end, telemetry)
* `art.js` – all illustrated drawing (room, loot, creature)
* `audio.js` – synthesized sound effects
* `playgama-bridge-config.json` – Bridge config

Debug hooks live on `window.__omt` (state access, `stepN(n)` to advance the simulation) so a headless browser can drive the game.
