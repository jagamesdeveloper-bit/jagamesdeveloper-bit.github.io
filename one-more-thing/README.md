# ONE MORE THING

A 2D physics burglar game. You are a tiny, stretchy thief stealing from a sleeping giant's living room, and everything you steal stays physically stuck to you.

Hand-printed storybook look: ink lines that are heavier on the shadow side, flat colour printed slightly off-register, halftone-dot shadows, film grain, an ink-blue night against warm lamplight, a foreground depth layer and a paper-card HUD. The thief is a regular little burglar (striped shirt, beanie, domino mask) with comically stretchy arms, and loot hangs from his belt on twine.

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
* Noise past 100 wakes the giant. He walks in through the hallway door on the right on huge hairy legs in heavy lugged work boots, aiming each step at where you are heading. A red shadow shows every landing spot; a foot or a leg touching you squashes you. Duck under a lifted foot or slip between his planted legs. He is faster than a loaded burglar and slower than an empty-handed one, so drop loot to run. The doormat by the mousehole is safe. Anything unbanked when he gets you is lost. Every stomp has weight: hit-stop, screen shake, floor cracks, dust and wood chips, a lamp that dips, and a slow-motion squash.
* Each night has a goal (night 1: $700, +$250 every night). Clear it and the next night starts with a higher goal, a faster giant and louder impacts. There is $3405 of loot in the room, and your best night is saved. Cash from every run goes to the Fence.

## Loot personalities

necklace (swings), pocket watch, bouncy ball (destabilises the haul), teapot, candlestick, frying pan (loud), television (heavy), vacuum cleaner (occasionally switches on and drags you), trophy, diamond ring, rubber duck (squeaks on every bump), cheese wheel (heavy, rolls), snow globe (smashes on a hard knock), alarm clock (rings a few seconds after you grab it), music box (leaks noise while carried), toaster (pops toast and jolts your haul), cheese wedge (bait), piggy bank (jingles when you run), balloon (floats and lifts you, pops on hard things), catnip mouse (makes the cat much faster while you carry it), golden egg (rolls off shelves), harmonica (wheezes when bumped), lunchbox, jewel box (top shelf), dumbbell (absurdly heavy), lava lamp (glows, tips over easily).

From night 3 a robot vacuum patrols the floor: it stuns and makes noise, so hop over it, and it docks when the giant is up. From night 4 nights alternate between STORM (lightning, then loud thunder) and FULL MOON (loot worth 20% more, a lighter-sleeping giant).

The Fence: every run's banked cash is saved. Spend it between nights on permanent gear (rubber soles, long sleeves, deep pouch, cat treats, three levels each). Optional rewarded ads: double a run's cash, borrow a gadget for one night, or take a second chance after being squashed with a big haul (once per attempt). They never block the normal buttons.

Snap traps sit on the floor: step on one and you're stunned and noisy, so hop over them. A rolling ball or dropped loot can spring them too.

From night 2, Mr. Whiskers the cat naps on the sofa. Noise (or sneaking too close) wakes him, and each night he is a lighter sleeper. He hunts on the floor, leaps onto low furniture, crouches for a moment, then lunges. A hit swats your whole haul loose and stuns you. Jump his lunge or get up high. He bolts when the giant wakes.

A brass curtain rail runs across the gap above the TV cabinet: grab it to swing.

## Layout

* `index.html` – page shell (loads the Bridge from the Playgama CDN)
* `game.js` – physics world, arms/haul mechanics, noise/giant, HUD, Bridge integration (storage, pause/audio events, interstitial at run end, telemetry)
* `art.js` – all illustrated drawing (room, loot, creature)
* `audio.js` – synthesized sound effects
* `playgama-bridge-config.json` – Bridge config

Debug hooks live on `window.__omt` (state access, `stepN(n)` to advance the simulation) so a headless browser can drive the game.
