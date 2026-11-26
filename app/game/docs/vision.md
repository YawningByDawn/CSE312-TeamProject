# Hungry God Inc. — The game, crystallized (binding)

Owner, 2026-11-23: "Crystallize and consolidate. Make a refined, high quality vision and execute. Clean code." · "Some incomplete code and ideas instead of deleting them, go the other way. Flesh them out into actual systems if it's clear the vision is lacking, or implementation is half-hearted, OR just remove it."

This page says what the game is and, for every system that exists in the code today, whether it stays as it is, is built out properly, or is removed. It is written from a read-only audit of the code (2026-11-23). `docs/spec.md` gives the formulas; `docs/town.md` defines the town; `docs/style.md` and `docs/theme.md` the look. Where the code disagrees with this page, the code is wrong.

## 1. The game in one paragraph
You are a god that fell into a grave under a crystal mine. You cannot act; you can only reach people. **Each night** you have a few actions: whisper to someone to turn them, give your followers standing orders, work the stones in your grave, draw special cards into your hand and use them (the first each turn free, further ones for Nether). **Each Day** runs by itself in 24 seconds while you watch whatever you like: every person lives their own day, your followers strike crystals and bring some to you at dusk. **Crystals are everything**: you eat them against Hunger, burn them to pay for miracles, set them in the grave for standing effects, and craft them. Two pressures push you to act (Hunger, and Malice, an urge: the higher it is, the more an act of evil gives you); three powers push back when you are noticed (Temple, Council, Town). When the pit head is yours the camera pulls back and the same game continues in the town, where the things worth taking are **buildings**, each of which gives you its craft. The slice ends when the Council's vault is open and the road to the city lies ahead.

## 2. One rule for everything below
Every system has **one implementation, reachable by the player, played by the bots, and tested**. Anything that is not all four is either built out until it is, or deleted with its text, state and balance keys.

## 3. Systems that stay as they are
Whisper and conversion · standing orders (pray, offer, lie low, delve, skim) · Move · Hunger and eating · blessings (start and each rank) · the crystal roll (grade, base, affinity, mods, odd effects, the 1-in-N stones) · eat / burn / set / resonance · enchant and recombine · tribute and the dusk offering · the count and the lift searches · Hold and colour spread · visibility and discoveries · divinity levels · the calendar, weather and living events · saves and settings.

## 4. Systems that get built out properly
| System | Today | Becomes |
|---|---|---|
| **Jewellery and cursed items** | The forge can make a jewel; nothing can wear it. Three item powers are dead. Give/take exists only for the random bot. | One system, **things people carry**. A jewel (forge) carries its stone's effect onto the follower who wears it. A cursed item (each building's gift, `docs/town.md` §3) is given free to anyone: a follower gets its boon, anyone else gets its curse. Giving and taking is a verb on the person's slab. A searched carrier is evidence. The bots use it. |
| **Faceting** | Works in the old town screen only; the mine's grave shows it locked forever. | The gem workshop's bench on its building screen; the grave shows the cut. |
| **Taking a building** | Hold 100 or the master turned; forge and apothecary have no master. | `docs/town.md` §3: master yours and more than half the workers yours, every workplace has a master, it can be lost again. |
| **Preach and Stand watch** (spec §8) | Do not exist. | Two town orders: a follower **preaches** to the people they live or work with where they gather; a follower **stands watch** at a building and blunts the next move against it. |
| **Ties between people** | Card text only. | The living model's real ties (household, workmates, friends) count: a follower's ties are easier to turn, and they notice when one of theirs is devoured or taken. |
| **Pushback** | Two models at once. In the mine the inspector can never catch anyone (it looks for a task nobody has). In the town, random strikes fire beside the announced moves. | One model: **a power's move is a person doing something in the world** (an inspector walks the galleries, guards search a row, a priest preaches on the steps), announced a Day ahead, answerable on that person's or building's screen. Same in the mine and in the town. |
| **Searches in the town** | None. | Guards search rows and carts in the town as they search the lift in the mine. |
| **Town story events** | The town replays the mine's events; six town events have words and no rules. | The six get rules; the town draws from its own set. |
| **The vault and the win** | The vault opens by itself, sits in the tally house, and is not needed to win; the win asks for level 7 and the gate. | The vault is in the keep. Opening it is a choice you make once the Council hall is yours, and it **is** the end of the slice; the ending beat follows at the gate. |
| **Flame stones** | "Hallowed until profaned": nothing can profane one. | An act of evil in the same place profanes it (the stone turns, the Temple notices). |
| **The cards** | Three miracles and three acts of evil are dealt along the bottom every night; each group is played once or skipped; nothing is kept. | **A hand you build** (DECISIONS §43): one draw button beside your hand, usable once a night. A draw shows one set of three in the centre of the screen, from one pool of miracles and acts of evil mixed; you take one into your hand or none. The hand holds at most five cards and is kept from night to night. The first special card you use each turn is free; each further one that turn has a Nether fee that grows. |

## 5. Rules brought back to the spec
- **Hunger at the top:** the god eats one of its own followers each night, and loses Ichor if it has none (today it eats a stranger at no cost).
- **Malice at the top:** a random act of evil plays itself at full notice (today it kills people in an area).
- **Ichor** is lost only to lost Influence, hunters, relics and starving (today also for every lost follower).
- **Influence** is the sum of Hold (today the average).
- **The watershed** fires when the pit head is rooted; every line of text says so. Mine followers stay themselves in the town.
- **The Day** is 24 seconds at ×1 everywhere (DECISIONS §31).
- **Malice's pace** (about ten nights from calm to the top) is set when the bots are run for `BALANCE.md`, not before.

## 6. Removed
- **Crowd units, the Congregation, crowd cover** (`docs/town.md`: every townsperson is one person).
- **Kindle** (buying extra actions with Nether): not in the spec, offered only in the old town screen, and it dissolves the one hard limit of the night.
- **Gorge** (never written, forty-odd mentions).
- **Mine tiers II–V**: the slice has one mine; depth 1–3 stays.
- **The stand-in game** and everything only it uses (`scenes/play/standin.ts`, `crystals.ts`, `NightV3`, `DayReplay`, `life/standin.ts`, the `?sim=` and `?standin=` switches, placeholder scenes).
- **Dead state and names from earlier versions**: orders and tasks, strikes, nine event kinds nobody emits, the 43 unused balance keys, deprecated aliases, the `influence` alias.
- **Doubles**: `types3` into `types`, `balance3` into `balance`, `ledger31` into `ledger`, `powers.ts` into `cards.ts`, the second title screen, the old starting-bonus picker.

## 7. Who does what
- The town rules builder: taking a building, crowds out, pushback as people, the vault and the win, searches and story events in the town, things people carry.
- A mine rules builder, after the town rules land (same files): §5, Preach and Stand watch, ties, Flame stones, the first night, the dead state and the doubles in `src/sim`.
- The play scene's builder, after its current piece: the stand-in game out, the Day at 24 s only.
- The interface builder: the building screens with their benches, give/wear on the person's slab, the starting-bonus picker in the approved look.
