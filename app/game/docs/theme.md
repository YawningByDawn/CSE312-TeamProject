# Hungry God Inc. — The world (theme bible)

Binding on every builder: art, animation, interface, words, sound, rules, events. Where this and an older handoff disagree, this wins. It is drawn from the three reference images in `docs/refs/` (looked at closely — do the same before you draw anything), the spec, and the owner: "Do we even know the theme? These guys are aliens. Establish a more distinct theme more properly… describe them and their architecture and environment. Flesh out all details that EVERYONE has been stumbling around." Items marked [Design] are the orchestrator's and open to the owner's veto.

## 1. The world in one paragraph
A dim, cold world under a small amber sun. Its people are the **wickfolk**: small, pale, big-headed, each with a living light on the crown of the head. They do not farm sunlight; they dig. Under their ground lie **soul crystals** — the crystallized souls of everything that ever died here — and they mine them, burn them for light and heat, and send the best up the road to the city, where the Temple feeds them to its god, **the Flame**, and the Council feeds them to a war against the red people beyond the mountains. You are what those souls used to belong to. You lie in a grave at the bottom of a poor mine under a poor mining town, and every cart that leaves is a piece of you going to your enemy.

## 2. Who owns which colour (the code everything obeys)
| Colour | Means | Where it appears |
|---|---|---|
| **Violet** | you; raw soul crystal | crystals, your grave, your colour creeping over the world, a follower's wick, your miracles, your interface accents |
| **Gold** | the Flame (the enemy god) | Temple braziers and carved stone lit from inside, hearth fires, the wicks of the faithful, priests' robes, holy things, the Temple's answers to you |
| **Cold white / pale blue** | the Council (the state, the mine's owners) | crystal-shard lamps, cast buildings, guards' plate, the tally house, searchlights, stamps and seals |
| **Teal** | the old rock and the damp | mine rock, glow-moss, pools, shell, cap-tree crowns, shadow side of everything |
| **Ochre, rust, tan** | the wickfolk's own daily life | dirt lanes, hide, felt, clay, stalk-timber, work clothes, clutter |
| **Red** | blood and the war | wounds, the levy's banners, war news, the red people; used nowhere else |
| **Gray** | sensed, not yet yours | everything in a Sensed area, with no colour at all |
| **Black `#000`** | unknown | Void |
One glance at a light tells you whose it is. Never use violet, gold or cold white for decoration.

## 3. The wickfolk
**Body.** Child-sized and stocky: the head is a third of the height (in `town.png` and `mine.png` the figures are small bodies under big round pale heads — keep exactly that silhouette). Smooth hairless skin the colour of pale ash with a cool teal cast in shadow; elders mottle darker. Two large, dark, wide-set eyes that **shine back** any light (a pair of glints is how you spot someone in the dark); no nose, two slits; a small low mouth. Two soft **ear-fins** at the sides of the head that move with feeling — up: alert; flat back: afraid; drooped: tired, grieving; flicking: lying or nervous. Four-fingered hands, short legs, broad flat feet, no tail. Children are tiny with heads half their height.

**The wick.** On the crown of every head sits a soft bud of living light, the size of a thumb. It is part of the body, not a lamp. Its **colour is the person's devotion**: gold for the faithful of the Flame (most people), pale and colourless for the doubting and the worn-out, **violet for yours**. Its brightness is their health and spirit: it gutters with fear and sickness, banks low in sleep, flares in prayer, anger and joy, and **goes out at death**. The Temple teaches every wick was lit from the one Flame; a violet wick is the worst thing a priest can see, which is why followers who Lie low wear their hoods up. (This is how the game shows who is yours with nothing floating over heads, and why a town seen from far away is a field of small gold lights going violet. In a Sensed area a wick is gray like everything else.)

**Dress.** Wraps, aprons and hooded capes of fungus-felt and beast-hide in ochre, tan and rust, belted with tools. Miners wear **smoked-horn goggles** against crystal glare and a horn **wick-cap** in the wet. A trade is told by silhouette, tool and one colour accent, never by a label: hewer (pick, goggles), hauler (yoke and hook), timberman (stalk-prop on the shoulder, adze), lift hand (lever gloves, whistle), pumpman (waders, wet to the waist), sorter (sieve tray), tally clerk (knot-cords at the belt, pale Council collar), overseer (tall stiff hood, rod), lampman (a rack of shard-lamps on the back), powderman (red-marked satchel, everyone keeps clear), beast-keeper (goad, shell-scraper), water carrier (two gourds on a pole), cook (pot and ladle), child trapper (sits by a door flap), surveyor (plumb line, cord reel).
**The Council's people** wear cast pale plate at shoulder and chest, a square-topped helm with a slot for the wick, and carry a shard-lamp on a staff — cold white light walks with them. **The Flame's people** wear layered gold-ochre robes, a polished brass face-mask, and carry a small brazier on a chain; their wicks are the brightest gold in town. **Elites** (masters, councillors, the high priest) are told by height of hood, length of cloak, metal on the body and an attendant or two.

**How they move and sound.** Quick short steps; they squat rather than sit, and sit on their heels to eat; they touch brow to brow in greeting (wick to wick) and cover the wick with a hand in shame or grief; they sleep curled, in heaps, in families. Speech is soft clicks, trills and hums — never human words in the sound; text gives the meaning.

**Life and death.** Households are **hearths**: three generations and a lodger or two under one shell, eight to ten to a home. The dead are carried to the Flame and burned, wick first; a death with no body to burn (the ones you eat) is a horror and a scandal. Names are short and plain (Ket, Oru, Maba); a person is "Ket of the third hearth on Low Row" when it matters.

## 4. Society
- **Three powers.** **The Council** owns the mine and the town for the far-off crown: it counts everything, issues lamps and tools, takes the crystals, raises the levy for the war. **The Temple of the Flame** owns births, deaths, feast days and consciences; it is fed a tithe of crystals, which it burns — the Flame is a god kept fat on souls. **The hearths** — the public — own nothing but talk, and talk decides who is shunned, who is sheltered and what becomes a mob.
- **The war.** Somewhere past the mountains the crown fights the **red people** (seen in `region.png` as the red land and the burning marches between). The slice never shows them. It shows what the war does here: quotas that rise, the **levy** that comes on a fixed day and takes the strong, the wounded who come home with dim wicks, refugees on the road, news read aloud in the market, crystal carts leaving under guard.
- **Work and pay.** Miners are paid in stamped clay **chits** on payday against what the tally house counted; a short count is docked from everyone on the shift. Debts are knots on a cord the lender keeps.
- **Food and animals.** They eat cap-flesh, pale roots, lichen bread, eel from the pools and beast meat on feast days; they drink sour cap-beer. **Pit beasts**: calf-sized, blind, six stub-legged animals under a ribbed teal shell, with two long feelers; they pull cart trains, give meat, hide and — when they moult — the shell plates houses are roofed with; frightened, they curl into a ball. Vermin are **skitters** (pale, many-legged, fast). **Lamp-moths** gather at crystal and at wicks.
- **Writing and signs.** No letters anyone on Earth could read. The Council writes in **notch tallies and knot-cords**; the Temple in **flame-glyphs** (curling strokes); everyone else uses **pictogram signs** (a pick, a cup, an eye, scales). All in-world signs are pictures.
- **The week.** As spec §5b: work days, payday, market day, the Flame's day, a rest day; plus the levy day when it comes.

## 5. Buildings — three hands built this town

> **The town's visual target is `docs/refs/town-target.png`** (owner, 2026-11-23: "The mushrooms are too small here and it's too bright but otherwise not bad"). Read `DECISIONS.md` §18 with this section: take the image as drawn (terraces, lane web, round plaza, cliff Temple, shell and cast houses, pens, open pits, cave dwellings, ~100–130 buildings 3–6 figures wide), but with **cap-trees as big as houses** and the whole picture **darker** (day median luminance about 45–60).
Look at `town.png`: a compact camp of **big lumpy buildings**, each 5–8 figures wide, seen from a **three-quarter top-down view** (roof mass dominant, a short front face, one dark doorway), packed along **worn ochre dirt lanes** one or two figures wide around small yards, with **clutter heaped against every wall**, lit by an even soft light in which every form is readable. That picture is the target. Three building languages, each owned by one power:

1. **Shell houses — the hearths' own (most of the town).** A low wall of packed clay and rubble, roofed with the **moulted shell of pit beasts**: long ribbed half-barrel vaults (this is what the ref's corrugated teal vaults become — ribs, not corrugation), in weathered teal, patched with rust-brown hide and odd plates, lashed with cord, weighted with stones. Poorer homes have no shell, only a **stretched hide** pulled lumpy over a frame of stalk-timber and bone and pegged down (the ref's draped teal and ochre lumps). Homes bud onto each other as families grow: lean-tos, pods, a smoke-vent with pale smoke, a round-topped low doorway with a hide flap and warm gold hearth light inside, one or two small round **membrane windows** that glow. Against the walls: gourds, baskets, drying racks of cap-flesh, coiled cord, a beast's shed shell, stacked fuel-cakes, washing on lines, a bench.
2. **Cast houses — the Council's.** Pale, smooth, **rounded-corner blocks** cast in segments (the ref's pale modular units): stamped panels, round ports, pipes, tanks, vents, a flat roof with a rail, cold white shard-lamps over the door, the Council's mark (a square within a square). Everything official is cast: the tally house, the sorting pens, the engine house and headframe, the guard post, the lamp store, the levy hall, the Keep, the gate, the vault. They look issued, numbered and out of place.
3. **Carved stone — the Temple's.** Cut **into the rock wall** of the bowl, never free-standing: arch within arch, reliefs of flames and bowed heads, stepped plinths, braziers and glowing idols, everything lit **gold from inside** (bottom right of `town.png`; the shrine at the left of `mine.png`). Old, fine, warm — the only beautiful architecture they have, and it belongs to your enemy.
- **Timber** is **stalk-timber**: the pale fibrous stems of cap-trees, used for props, frames, fences, carts.
- **Never:** brick, slate, gables, glass panes, corrugated iron, street lamps on posts in rows, chimneys with brick stacks, picket fences, anything that reads as a human village or a medieval castle. No flat front-view "dollhouse" buildings on a top-down map.
- **Light.** Buildings are lit as **forms** — a lit roof plane, a mid face, a shadow side, a contact shadow — under a soft overall light as in the reference. Lamps and windows are small accents on top. At night the overall light drops and cools but **every building still reads as a mass**; a town must never become dots of light on black. At the far view buildings are drawn shapes, not glow sprites.

**The town's places (each must be nameable at a glance):**
| Place | Hand | What it looks like |
|---|---|---|
| The pit head | cast | the headframe straddling the shaft, winding wheel, the engine house with a pale steam plume, the cage, a rail fan, white lamps |
| The tally house | cast | a long pale block with a weighing porch, big scales, strongboxes, a queue rail, knot-cords hung in rows |
| Sorting pens | cast + timber | open bins glowing violet through slats, a banner with a crystal mark (centre of `town.png`) |
| The Rows | shell | miners' homes in tight lines above the pit: the poorest, most patched, most crowded |
| The tavern | shell | the biggest shell vault in town, two shells end to end, barrels, benches outside, always lit and loud |
| The market | — | an open yard of hide awnings on poles that fills on market day and stands as bare poles otherwise |
| Gem workshop | shell | a round shell with a grinding wheel in the yard and a window-board of cut stones |
| The forge | shell + stone | a squat open-fronted shell, a bellows, an anvil stone, orange glow, slag heaps |
| Apothecary | hide | a draped hut hung with drying caps and gourds, pale smoke of several colours |
| The wash-place | stone | a stepped pool fed by runoff, wet stones, lines of washing |
| Chapel of the Flame | carved | the rock-cut front with its braziers; steps where people squat to pray; the town's brightest gold |
| The graveyard | carved | not graves — a **burning ground**: a blackened stone platform, urn niches cut in the wall, ash |
| The Keep and the vault | cast | the Council's square stack of cast blocks behind its own wall; the vault is a banded round door set in rock |
| The gate | cast | where the road climbs out of the bowl through a notch in the rock: two round cast towers, a barred portal, white lamps, a wall running off along the rim both ways |
| Carters' yard, beast pens | timber | curled and uncurled pit beasts, cart trains, shell-scrapers, dung heaps |
| Outskirts | — | lichen terraces, cap-gardens under hide frames, a pale-root store, the road |

## 6. The land
- **The bowl.** The town stands on the floor and terraces of an old open cut — a **stepped bowl** quarried over generations (the stepped rock edges round `town.png`). The first workings were adits in its walls; some are now stores and the homes of the poorest. The present mine goes down from the pit head at the bowl's low end. Rain runs to the pit. Beyond the rim: gray until you reach it, then black.
- **The mine** (`mine.png` is the benchmark). Continuous faceted rock walls in gray and **teal** (damp, glow-moss), warm ochre where lamps reach; stalk-timber props and frames; rails; dark teal pools and drops; violet crystal clusters that light the rock round them; cold white shard-lamps along the galleries, small gold shrine nooks the Temple keeps at every level; your grave in the deepest reach.
- **The surface.** No grass, no trees. **Cap-trees** — giant fungi with teal or amber crowns (`region.png`'s teal and amber forests) — stand in groves outside the bowl. Rock is furred with ochre and rust lichens; hollows hold teal moss. Fields are stepped lichen terraces and cap-gardens. Water is dark and still.
- **The sky.** A small amber sun, low and weak: day is a warm dim light with long shadows, dusk is long and copper, **night is truly black** — which is when you act. Weather as spec §5b: rain is fine, cold and slanted; fog pools in the bowl; storms throw white-violet lightning that for a blink shows everything.
- **Far away.** The road climbs the valley to the **city**: cast towers and one huge gold-lit Temple dome, many times the town. Past the mountains, on the horizon at the farthest view, a low red glow and smoke — the war.

## 7. Things they make
Picks with horn heads bound in metal; baskets and gourds, not buckets; carts of shell and stalk-timber on rails, pushed by hand or drawn in trains by pit beasts; the **lift**, a cage wound by a crystal-fired engine; pumps with long rocking beams; **shard-lamps** (a splinter of crystal in a horn cage — cold white; burning a soul a little at a time, which is why they hum); fuel-cakes of dung and cap-fibre for hearths; cord everywhere — lashing, knot-records, washing lines. Nothing is new; everything is patched.

## 8. You, the Flame, and the crystals
- **Soul crystals** are violet, faceted, lit from inside, and light the rock near them. **Every crystal is violet at its heart**; its affinity is a second colour inside it (inclusions, veins, the tint of some facets — gold for Flame, red for Blood, teal for Stone and so on), never a replacement, so that in the world every crystal reads as the same violet stuff as in `mine.png`. Grade shows as inner light and strangeness (dull and cloudy → blazing → wrong). When burned by the wickfolk they give cold white light; when burned for the Flame, gold; when they reach you, violet.
- **You** are a grave: a great crystal mass with an opening like an eye, violet veins spreading through rock from it. Your colour moves like damp and frost, never like fire.
- **The Flame** is never seen in the slice, only its light, its priests and its answers. In the ending something gold looks back.

## 9. Sound
Wickfolk: clicks, trills, hums; laughter is a rising trill; grief is a long low hum taken up by others. The mine: horn on stone, cord creak, water, the lift engine's chuff, shard-lamps' thin hum. The Council: whistles, iron, stamping. The Temple: brass bowls, a held choir note, fire. You: breath, low and reversed; glass singing when crystal is near. No dogs, horses, church organs or human crowd murmur.

## 10. Words
"People", "miners", "followers" in the interface; **wickfolk** only where the species must be named. Wick, hearth (household), shell house, cast house, pit beast, skitter, cap-tree, stalk-timber, shard-lamp, chit, knot-cord, the levy, the count, the burning ground, the bowl. Place names stay plain (the Rows, the Works, the Market, the Keep, Low Row). No invented fantasy names for countries in the slice: "the crown", "the city", "the red people", "the war".

## 11. What this changes for each piece
- **Miner animator, CAST (townspeople), cutscene, FINALE, VFX, HUD portraits:** the wickfolk body, eyes with eyeshine, ear-fins as an acting channel, the wick as devotion colour and life, dress and trade kit as above. One shared set of proportions and colours in `src/render/theme/` (built by the THEME builder) — miners and townspeople must be the same people.
- **TOWN-ART, town engine, world composition:** rebuild the town to §5–6: the bowl, three building languages, ~70–100 big buildings at the reference's scale and view (not ~450 small ones), lit forms, the places table, pictogram signs.
- **Mine engine, terrain, AMBIENT, WEATHER:** §6 the mine; shard-lamps white, shrine nooks gold, stalk-timber, pit beasts on the rails, lamp-moths, skitters; the amber sun and black night; no human-world props.
- **CRYSTAL, VFX, FEEL, HUD:** the colour code of §2 everywhere, including interface accents and effects.
- **WRITING, LIVING, BEHAV, SIM:** the words of §10; hearths; the war as pressure (quota, levy, wounded, refugees, news); funerals as burnings; wick colour as the visible sign of devotion (Lie low = hood up); trades and their kit; customs (brow to brow, covering the wick).
- **Audio:** §9.
