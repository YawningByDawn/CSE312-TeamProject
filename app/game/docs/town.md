# Hungry God Inc. — The town (binding definition)

Owner, verbatim: "It should be a real world you conquer with many professions many people and events, daily life going about." · "Faceting unlocks when you take over a gem workshop and crafting into jewelry when you take over a forge. Similarly other buildings grant you their facilities to create cursed items." · "people do stuff 24/7 according to how they would in real life. If they're out of frame they are only data." · On the town as built until 2026-11-23: "tear it all down. … WHY ARE THERE CIRCLES OF 50 PEOPLE JUST PLASTERED ON THE SCREEN? WHY THE FUCK IS SHIT PLACED RANDOMLY?" · "BUILD A WHOLE FUCKING SIM".

This page replaces every earlier description of the town stage (spec §5 "ordinary people act as groups with a headcount", §12 "People are groups", DECISIONS §29 and the `ui4` mock-ups). Where anything disagrees with this page, this page wins.

## 1. What the town is
The town is **the same game as the mine, one level up the lift**: the same world, camera, interface, verbs and nightly loop. It is a simulated place, not a board. There is no "town mode", no token, no marker ring, no overlay diagram drawn on the ground.

## 2. People
- **Every townsperson is one person**: a name, a trade, a home, a household, a workplace, ties, a daily plan (`src/sim/living`: about 400 people, 40+ trades). They are simulated around the clock and drawn as themselves whenever they are in frame, at every zoom. Out of frame they are data.
- **No crowd tokens.** A "group" in the rules is a real set of named people who live or work together — the forge's crew, a household, the chapel's congregation, a guard watch. It is never drawn as a ring, cluster or headcount badge: you see those people where they really are (the crew at the forge on shift, at home asleep at night, at the tavern after pay). Its headcount is its members.
- **Reaching a group** means speaking to them where they gather: the rules' group whisper lands when its members are together (their shift, their meal, their service), and the interface says where and when that is.
- **Elites** are the masters of buildings and the officers of the three powers. They are people like anyone else: they have a home, a day, habits you can learn and use.
- A crowd exists only when people actually gather (market day, a service, a hanging, a brawl): it is that many individual figures standing there, each still clickable.

## 3. Buildings
Every building is a place from `src/sim/living/world.ts` `PLACES` or a household's home. Nothing else is placed. Each has: a type, a master (if it is a workplace), the people who work there and their hours, what it does for the town, and what it gives you when it is yours.

| Building (district) | For the town | Yours, it gives you |
|---|---|---|
| Tally house (pit head) | counts the stones for the Council | false weights: stones skimmed before the count |
| Lamp house (pit head) | fills and trims the mine's lamps | cursed lamps |
| Tavern, cap-beer shed (rows, well square) | drink, talk, pay night | rumours; a place to turn people cheaply |
| Tannery, loom house (rows, well square) | hide and cloth | cursed clothing |
| Smelter (works) | melts ore and scrap | metal for the forge |
| **Forge** (works) | tools, hoops, ironwork | **jewellery**: set a stone in a ring, amulet or circlet a follower wears |
| Cart shed, beast pens, haul yard (works) | carries the stones to the gate | the crystals' road, link by link |
| **Gem workshop** (market) | cuts stones for the city | **faceting**: choose one of three cuts for a stone |
| Knot-lender (market) | debts on knotted cords | debts as a hold over people |
| Cake ovens, fuel-cake yard, market stalls (market) | food and fuel | poisoned or blessed food on a chosen day |
| Apothecary (well square) | salves and draughts | cursed draughts |
| Brewhouse, pottery, gardens (gardens) | beer, jars, cap-crops | cursed brew and vessels |
| School room (well square) | children's lessons | what the children repeat at home |
| Chapel, temple (temple hill) | the Flame's services | the Temple's own house turned: false relics |
| Cord room (keep) | the Council's records | forged records |
| Barracks, drill yard (keep) | the guard | guards who look away |
| Council hall, vault (keep) | rule; where the stones are kept | the vault open is the end of the slice |
| Gate, gate lodge, city road (gate) | the way out to the city | the ending beat |
| Homes (every district) | where each household sleeps, eats, keeps its things | a household that is yours seeds your colour in its street |

The items in the right-hand column that the rules do not have yet are added to the simulation as real, usable things (the owner: "be bold in creating new systems"); faceting and jewellery already exist in `src/sim/crafting.ts`.

**Taking a building.** A workplace is yours when its master is yours and more than half of the people who work there are yours. It can be lost again the same way. A building that is yours shows it in the world (your colour in its light and on its people), not with a badge.

## 4. The building's screen
Clicking a building opens **that building's own screen**, in the approved interface kit, large enough to be a place and not a tooltip:
- the building painted as an open-fronted interior with its people at work in it right now;
- its master (portrait, name, what they want), and the workers as named, clickable people with where each is at this hour;
- what it makes, in one line; how far it is yours, as lit figures (yours) against unlit ones, never a percent bar;
- once it is yours, **its bench**: the gem workshop's cutting bench (place a stone, see three cuts, choose), the forge's anvil (stone + form + who wears it), and so on for each craft in the table. A building without a craft shows what it gives you instead.
What you do to a person or a building is a verb on this screen. Cards are only the night's draw (`docs/style.md` §7).

## 5. Layout
The town is laid out as a town, by hand, once (seeded only in small things):
- **Districts**, in the order the crystals travel: the **pit head** (lift, tally house, lamp house) → the **rows** (miners' homes, tavern, tannery, the burning ground at the edge) → the **works** (haul yard, pens, cart shed, smelter, forge) → the **market** (square, gem workshop, ovens, fuel yard, knot-lender) → **well square** (well, wash-place, apothecary, cap-beer shed, school, loom house) with the **gardens** behind it (brewhouse, pottery) → **temple hill** (high houses, chapel, temple and its steps) → the **keep** (council hall, vault, cord room, barracks, drill yard) → the **gate** (gate lodge, cord walk, the city road).
- **Streets** join the districts along the crystals' road; every building fronts a street or a yard with its door on it; homes stand in rows along lanes, one building per household (or a shared row house), each with a number of sleepers that matches who lives there.
- **Nothing is scattered.** No filler buildings, no props or cap-trees dropped by noise across lots: cap-trees stand in the gardens, yards and at the town's edge; clutter belongs to the building it leans on.
- Scale and view as the mine: the same top-down angle, figures the same size as in the mine, doors a figure wide.

## 6. The night and the Day in the town
Unchanged from the mine: at night you whisper, command, play one miracle and one act of evil or skip them, use what your buildings give you, and end the night; the Day runs in 24 seconds with the camera yours. The three powers (Temple, Council, Town) push back **through people doing things in the world** — an inspector walks to the forge, guards search a row, a priest preaches against you on the steps — and you answer on the screen of the person or building involved.
