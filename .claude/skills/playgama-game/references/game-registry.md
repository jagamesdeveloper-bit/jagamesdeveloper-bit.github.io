# Game registry (snapshot 2026-11-08)

Snapshot only - **status changes; call `list_applications` for truth.** Use this to recognise a game by title and reuse its id.
Org has 33 games. Live/active: Elska (Unity, the only Unity one known), Tangle Tails (js). Rejected: 2048 remaster. Processing: Tangle Tails, Last Square. Everything else is DRAFT; Bloomfall, Tangle Tails confirmed agent-built js (check `get_application` engine/createdVia for the rest).

| Title | applicationId | Status | Last updated |
|---|---|---|---|
| Elska - dog vs zombies! Multiplayer co-op | cmplfo3fp00xvlw0heev23n3x | UPDATED (live) | 2026-11-07 |
| Tangle Tails | cmuu0p2qo0c91g40hs2lhctmq | PROCESSING | 2026-11-07 |
| Last Square | cmutxbevy0axjg40he128pd5g | PROCESSING | 2026-10-08 |
| 2048 +Reverb +Slowed (remastered) | cmsq6b2f802m1o60half8on52 | REJECTED | 2026-09-15 |
| Bloomfall | cmw6hql3w0jrrno0h716gku7s | DRAFT | 2026-11-07 |
| In Pieces | cmvmj2r9q0vvfih0hvxezmq9s | DRAFT | 2026-11-07 |
| Potion Pour | cmvnrijro1fjeih0hj71waixz | DRAFT | 2026-11-07 |
| Pin the Tail | cmvnri8001fj1ih0h5uwqdaou | DRAFT | 2026-11-07 |
| Skyline Snap | cmvnr79bt1f6yih0h2hnycstr | DRAFT | 2026-11-07 |
| Sloth Sprint | cmvnpjpbo1q5uh90hciwekcd4 | DRAFT | 2026-11-07 |
| Hex Harvest | cmvnpjgm31q5sh90hd33t9sia | DRAFT | 2026-11-07 |
| Goblin Kicker | cmvjrucf00a2gmx0hlohtwsf2 | DRAFT | 2026-11-05 |
| Ricochet Foundry | cmvjceur500qfjx0hs4nwxjv0 | DRAFT | 2026-11-05 |
| Drift Ducks | cmvdv559m9j33nj0h9bf192gt | DRAFT | 2026-11-05 |
| Swarm Bloom | cmvbft0y40pidnj0hxlsolzj4 | DRAFT | 2026-11-05 |
| Ghost Grocer | cmvnr7b6i1rheh90hckhmnubm | DRAFT | 2026-10-31 |
| Jelly Jam | cmvnr4dvm1f5hih0hddl6rvsx | DRAFT | 2026-10-31 |
| Dino Dig | cmvnpk4oh1q5yh90hm6seit52 | DRAFT | 2026-10-31 |
| Bounce Brigade | cmvnpk0xh1e85ih0ho5upaids | DRAFT | 2026-10-31 |
| Cat Cannon Golf | cmvnpjzit1e83ih0ho1lgkhul | DRAFT | 2026-10-31 |
| Tower of Toast | cmvnpjx5h1q5wh90h39jxgpg7 | DRAFT | 2026-10-31 |
| ONE MORE THING | cmvnial3h1ktzh90hl2znb5xu | DRAFT | 2026-10-31 |
| Tangle Arena | cmvp46dyw2ppkh90h5bxd1069 | DRAFT | 2026-10-26 |
| Switchyard Sort | cmvjhsbch08t4jx0h6c17yuhq | DRAFT | 2026-10-22 |
| Paper Platoon | cmvfkihkf03z6j50hhlyn1uri | DRAFT | 2026-10-19 |
| TWISTWAY | cmvf4tlp80d9uie0hs7o8lup4 | DRAFT | 2026-10-19 |
| THE LOOP | cmvcd203r4e61nj0hfl2ev9mj | DRAFT | 2026-10-19 |
| MOTH | cmvc4h4kb3ihknj0hbvsgwqsj | DRAFT | 2026-10-17 |
| SWING SHOT | cmv2hmhfb0gx4ma0hl6zw5o7d | DRAFT | 2026-10-10 |
| Paper Pit | cmuzy02nc07hcr10hmw0061u5 | DRAFT | 2026-10-10 |
| LANTERN TIDE | cmuzw297b06pqr10hcip96h0r | DRAFT | 2026-10-08 |
| TINY KINGDOM | cmuu58c860dymg40hsgn3rkb2 | DRAFT | 2026-10-04 |
| PRESSWORKS | cmutz4l510byvhj0h837ygz5k | DRAFT | 2026-10-04 |

Many DRAFT games were never submitted - when asked to "finish" one, start from `get_launch_steps` and `get_application` (form gaps, missing covers, archive state), not from scratch.
