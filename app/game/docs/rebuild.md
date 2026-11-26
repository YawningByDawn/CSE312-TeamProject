# The rebuild: a lean `src` from what the screen shows

The game is rebuilt in `src2/` beside the old `src/` (136,000 non-blank lines, 467 shipped files), then `src2/` becomes `src/` and the old one is deleted in one commit (the SWITCH track). One agent builds, one deletes. Rules and numbers stay the sim's tables (`DECISIONS.md`). Nothing draws live: the view places baked sprites and picks frames.

Each track remakes one swathe as one simple system and keeps the important behaviour: what the player sees and does (section 2, "keep"). Behaviour that exists only to support the old code (its caches, its second paths, its notice channels, its switches) is not kept, and each such drop is written in section 2 with its reason. A track reads the old files of its lines to learn the behaviour, never to port their structure.

The tracks are items in `docs/work-queue.md` (rows SHRINK, LIVE, RENDERER, CORE, CUTS, ONE SOURCE). Each works in its own worktree branched from `main` and merges into the `rebuild` branch, never into `main`; `main` takes one landing, at SWITCH, so its line count only goes down. The interface between tracks is `src2/types.ts`, written once; a track that needs it changed changes every implementer in the same commit.

## 1. Architecture

    src2/types.ts                  -> nothing (types only; one type import from pixi.js)
    src2/content                   -> types
    src2/sim                       -> types, content
    src2/view, src2/ui, src2/audio -> types, content (sim only through the Query object app hands them)
    src2/app                       -> all
    gen, scripts, tests, e2e       -> may import src2; src2 never imports them

| Module | Is | Budget (non-blank) |
|---|---|---|
| `types.ts` | the cross-track contract | 420 |
| `content` | every table and every word: crystal tables, cards, blessings, roles, traits, trades, names, places and the world graph (ids, edges, coords, spots), dress list, stages, threats, events, notes, UI words (`uiText`), flags | 5,000 |
| `sim` | the spec formulas and rules on a 10 Hz live clock, deterministic from seed, tick and action log: god, whisper, routines, mining, crystals, crafting, items, cards, factions, threats, stages, win and loss (`sim/`), and the people's lives: society, plans by hour, routes, calendar, weather, world events, walkers (`sim/world/`) | 6,000 (rules 4,000, world 2,000) |
| `view` | PixiJS: one stage, one camera over one world (face, mine, town, valley), layers of baked sprites, people from the baked parts, effects from baked sheets, the films (opening, watershed, ending, takes) | 4,000 (world 2,000, life 2,000) |
| `ui` | DOM: the rest HUD, cards, menus, panels, building screens, tooltips, hints, settings, the front (title, bonus, defeat words) | 4,500 (hud 2,200, panels 2,300) |
| `audio` | plays the baked sounds: a cue per event kind, beds by stage, hour and weather, four buses | 400 |
| `app` | boot, one pump (fixed sim tick, one rAF frame), input to intents and actions, camera control, save, flags, `window.__hg` | 700 |
| **Total** | | **21,020** (cap 30,000) |

**The pump.** `app` steps the sim at 10 Hz from a fixed accumulator, builds one `ViewModel` a frame (state, alpha, render time, camera, focus, film, fresh events) and hands it to `view.frame`, `ui.frame`, `audio.frame`. A film (opening, watershed, ending) holds the clock; pause holds it; nothing else does. One clock: hour, daylight and animation all derive from the tick and the render time.

**No second copies.** One RNG (`sim/rng.ts`). One world graph (content) that the sim routes on and the view looks coordinates up in. No view model re-declaring the state: view and ui read `Readonly<GameState>` and ask `Query` for anything derived. One hit rule: the scene graph's hit areas (`View.pick`). One place for words (`content`).

**Reused as-is** (copied with import paths fixed, then trimmed only of what no inventory line uses):
- the spec formula code: `src/sim/formulas.ts`, `src/sim/rng.ts`, the crystal roll in `src/sim/crystals.ts`, and their tests in `tests/sim/`;
- the tables: `src/sim/content/*` (gems, cards, bonuses, traits, roles, people, stages, threats, town, maps, discoveries, affinity, events' data), `src/sim/balance.ts`, `src/sim/living/{trades,names,calendar,weather}.ts`' tables, `src/content/**` words, `src/content/flags.json`;
- the baked assets: `assets/props`, `assets/props11`, `assets/town`, `assets/people` (bake-people), `assets/audio`, `assets/mine/*` (ground, lit, night), `src/render/mine/dress` placement data and `groundLights.json`, the life atlas, thread, haze and sheen (`assets/life`, `assets/thread`, `assets/haze`, `assets/sheen` on view-m5), the opening (`assets/opening` on intro-cavern), `scenes/front/title-still.webp`, the bundled fonts.

**Rewritten:** the rest of sim (state, clock, actions, legality, every rule step, the people's lives) on the live clock; the PixiJS view (it reads the old `src/view` for how the mine is placed, nothing more); the whole DOM interface; app; the audio player.

**Baked, then deleted** (the BAKE track): every runtime painter left in `src/render`, `src/ui/play/kit`, `src/scenes` that a feature below needs. Its picture is baked once into `assets/<name>/` with an `AtlasManifest` (`src2/types.ts`), by a bake script in `gen/bake/` that runs the old painter. The assets are the source from then on; the bake scripts and the painters go at SWITCH.

## 2. Feature inventory

Every line lands in a track: SIM (rules), WORLD (people's lives), CONTENT, BAKE, VIEW (world), LIFE (people, effects, films), HUD, PANELS, APP (app and audio), TESTS, SWITCH. Old files are under `src/`. Where an open owner order changes a feature, the order wins and is named.

### Front and opening
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 1 | Title: the living grave still, Begin, Continue, Settings | scenes/front/{title,index,css,paint}.ts, title-still.webp | PANELS, BAKE (still) | keep |
| 2 | Opening: crystal cavern, an eye, tendrils rise, the eye opens in the mine, ~8 s then 5 s of tendrils (INTRO) | scenes/cutscene/*.ts, render/mine/thread.ts; assets/opening (intro-cavern) | LIFE | keep |
| 3 | Skip the opening: Esc at once or hold Space 1 s, prompt bottom right | scenes/cutscene/index.ts | APP (keys), HUD (prompt) | keep |
| 4 | The opening's last shot is the first gameplay view, no cut | scenes/cutscene/shotMine.ts, app/worlds.ts | LIFE | keep |
| 5 | Starting bonus: 1 of 3 on that frame (4 with Second Sight); CARDS: shows the first drawn hand | scenes/front/{bonus,pictures,adapter}.ts, ui/play/dialogs.ts, sim/blessings.ts | PANELS, SIM | keep |
| 6 | Loads at full resolution at once, no low-res pass | app/app.ts, render/mine/prebuilt.ts, mine/groundCache.ts | APP, VIEW | keep |
| 7 | Defeat: world drains to gray, the cause, Again / Same seed / Title | scenes/front/{defeat,text}.ts | LIFE (drain), PANELS | keep |
| 8 | Pause veil; auto-pause when the tab hides | scenes/front/pause.ts | APP, HUD | keep |

### Rules
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 9 | Spec formulas: V(D), Gain, Faith, Nether, InfluenceCost, DirectCost, miracle cost, Ember, Ichor max, XP thresholds, odds clamp | sim/formulas.ts, sim/balance.ts | SIM (as-is) | keep |
| 10 | One seeded RNG | sim/rng.ts (14 other copies go) | SIM (as-is) | keep |
| 11 | Live clock: 10 Hz, a day is 120 s, AP regenerate over the day, the day ends on the clock, solo pause, no speed, one save per day (LIVE) | sim/clock.ts, sim/turn.ts, app/session.ts | SIM, APP | keep |
| 12 | Phases bonus, live, won, lost; stages whisper and shade | sim/types.ts, sim/turn.ts, sim/content/stages.ts | SIM | keep |
| 13 | Divinity XP by source, ranks 1-7, each rank +1 AP, +1 socket, a blessing pick, wider pools, one unlock | sim/effects.ts, sim/life.ts, sim/content/stages.ts | SIM | keep |
| 14 | Hunger rises daily; eat to lower; starving eats a follower or costs Ichor | sim/selectors.ts, sim/effects.ts | SIM | keep |
| 15 | Malice rises; acts of evil vent it; lash out at the top; followers' own evil at half | sim/effects.ts, sim/mining.ts | SIM | keep |
| 16 | Ichor lost by purge, hunter, relic, starving; gained by gorging and the vault; 0 ends the run | sim/effects.ts, sim/selectors.ts | SIM | keep |
| 17 | Hold 0-100 per place, colour creeps at dawn from grave, followers' homes and benches, Shadow stones, miracles; Influence = sum of Hold; Presence and reach | sim/livingBridge.ts, sim/selectors.ts, sim/life.ts | SIM | keep |
| 18 | Visibility: active, sensed, void | sim/selectors.ts | SIM | keep |
| 19 | Whisper: 1 AP + Nether, odds shown with reasons, a failure softens, one a person a day | sim/whisper.ts, sim/legal.ts, sim/panels.ts | SIM | keep |
| 20 | Group whisper lands only when the group is together; the town's hours | sim/town/{reach,hours,groups}.ts | SIM | keep |
| 21 | Routines Pray, Offer, Lie low, Delve (II), Skim (III), Preach (Shade I), Stand watch (Shade II) | sim/legal.ts, sim/preach.ts | SIM | keep |
| 22 | Move a follower: odds, 1 AP or 2 if far, to a face or a surface place | sim/legal.ts, sim/life.ts | SIM | keep |
| 23 | Ties: help odds, notice, grief | sim/ties.ts | SIM | keep |
| 24 | Mining: diggers strike, vein level = (tier-1)*3 + depth, the Deep opened by Delve or a discovery | sim/mining.ts, sim/content/gems.ts | SIM | keep |
| 25 | Crystal roll: grade, base, affinity, modifiers and tiers, odd effect, curse, 1-in-N odds, name | sim/crystals.ts, sim/content/gems.ts, content/{gems,crystals}.ts | SIM (as-is), CONTENT | keep |
| 26 | Where stones go: pocket, cart, lift, tally house; the count at shift end, forgiven or short; searches; caught twice, taken | sim/mining.ts | SIM | keep |
| 27 | Tribute at dusk by devotion; Offer brings everything | sim/mining.ts | SIM | keep |
| 28 | Eat, burn, set in a socket, take out; resonance of 2 and 3; Flame stones burn until profaned | sim/crystals.ts, sim/profane.ts, sim/mods.ts | SIM | keep |
| 29 | Enchant, recombine, facet (1 of 3 cuts) | sim/crafting.ts | SIM | keep |
| 30 | A building is yours when its master and over half its workers are; its facility opens | sim/town/{buildings,sync,people}.ts | SIM | keep |
| 31 | Items: jewel, weights, relic, draught, lamp, clothing, brew; give, take back, exposure, cursed gifts | sim/items.ts, sim/town/gifts.ts | SIM | keep |
| 32 | Cards: 3 dealt at dusk, take 1 or none, hand of 5, discard, reroll, first play free then a Nether fee, pools widen by rank, +1 card a major rank (CARDS) | sim/cards.ts | SIM | keep |
| 33 | Miracles paid in crystal worth, affinity match half again | sim/cards.ts, sim/content/cards.ts | SIM, CONTENT | keep |
| 34 | Acts of evil, Devour a person among them | sim/cards.ts, sim/content/cards.ts | SIM, CONTENT | keep |
| 35 | Suspicion per faction, five levels, cooling | sim/factions.ts | SIM | keep |
| 36 | Council: searches, guards, lockdown, occupation; inspection; crackdown | sim/inspector.ts, sim/town/pushback.ts | SIM | keep |
| 37 | Temple: wards, purges, inquisitor, crusade | sim/town.ts, sim/content/threats.ts | SIM | keep |
| 38 | Public: rumours, informers, mob | sim/factions.ts | SIM | keep |
| 39 | Threats announced then land; answered with an item, a favour or hiding; writ seals | sim/town.ts, sim/town/pushback.ts, sim/content/threats.ts | SIM | keep |
| 40 | An Elite's favour | sim/town.ts | SIM | keep |
| 41 | Story events with a choice | sim/content/events.ts, content/events.ts | SIM, CONTENT | keep |
| 42 | Discoveries: cache, seam, loner, shortcut, relic, danger | sim/life.ts, sim/content/discoveries.ts | SIM | keep |
| 43 | Echo copies (twice the suspicion) | sim/crystals.ts, sim/types.ts | SIM | keep |
| 44 | Watershed gate: Divinity 4 and the pit head rooted | sim/turn.ts, sim/content/stages.ts | SIM | keep |
| 45 | The vault: opens at Shade III, a sure Impossible stone; opening it is the ending | sim/mining.ts | SIM | keep |
| 46 | Loss: Ichor 0, or rooted out | sim/effects.ts, sim/town.ts | SIM | keep |
| 47 | The day's ledger | content/ledger.ts, sim/turn.ts | SIM, PANELS | keep |

### People and the town's life
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 48 | ~60 mine people in 20+ trades, ~400 town people in 40+ trades, households, homes, work places, shifts, names, ties | sim/living/{society,trades,names}.ts, sim/content/{people,roles}.ts, sim/town/people.ts | WORLD, CONTENT | keep |
| 49 | Plans by hour: wake, eat, walk to work, ride the lift, work, tavern, chapel, market, wash, home, sleep; by weekday and weather | sim/living/{plans,calendar,weather,index}.ts, life/*.ts | WORLD | keep |
| 50 | Routes on one place graph: tunnels, the lift, streets | sim/living/world.ts, life/mineMap.ts, render/town/streetGraph.ts, render/people/nav.ts | WORLD, CONTENT | keep |
| 51 | The calendar: work days, payday, market day, the Flame's day, rest day | sim/living/calendar.ts | WORLD | keep |
| 52 | Weather by day and hour; rain floods the lower workings, fog blinds searches, storm stops the lift | sim/living/weather.ts | WORLD | keep |
| 53 | World events (wedding, birth, funeral, brawl, debt, inspector, caravan, strike, festival...), some chained, each opening or closing a door | sim/living/events.ts | WORLD, CONTENT | keep |
| 54 | Followers carry colour up: home, tavern seat, prayer bench | sim/livingBridge.ts | WORLD | keep |
| 55 | The opposition walks: guards' rounds, the inspector, the inquisitor, the mob | sim/town/pushback.ts, sim/inspector.ts | WORLD | keep |
| 56 | The day's feed: 8-16 plain notes a day, plus your own doings | sim/living/{feed,notekeys}.ts, content/living.ts | WORLD, CONTENT | keep |

### The world on screen
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 57 | Mine rock, walls, floor, cliff faces | render/mine/{rock,bake,ground,geometry,layout}.ts, render/terrain/*, render/art/{boulders,rockface}.ts; mine/prebuilt ground-1 | VIEW (prebuilt) | keep |
| 58 | Mine light: lamps, braziers, crystal glow; night by the hour | render/mine/{lit,litMine,litBaked}.ts, render/lighting.ts, theme/props/light*.ts; prebuilt lit-1, night-1 | VIEW | keep |
| 59 | Mine props and set pieces from the one dress list | render/mine/dress/*, mine/{things,dressing}.ts, art/props*.ts, theme/props/things.ts; assets/props, props11 | VIEW, CONTENT (dress data) | keep |
| 60 | Ore stones and crystals in the walls, glints by rarity | render/crystal/*, render/ambient/crystals.ts, mine/crystals2.ts | BAKE, VIEW | keep |
| 61 | Mine motion: lift cage, ore skip, carts on rails, rats, bats, moths, breathing flames | render/ambient/{mine,mineflow,themeprops}.ts, theme/props/life.ts; life atlas | VIEW | keep |
| 62 | Mine weather: wet walls, drips, water rising, rain and mist down the shaft | render/mine/weather.ts | BAKE, VIEW | keep |
| 63 | Town: buildings, landmarks, pit head, bowl, benches, streets, yards | render/town/*, render/art/town*.ts; assets/town | VIEW | keep |
| 64 | Town motion: smoke, the sheave, lit windows, lamplighter, flags, birds, mule carts, ore wagons | render/ambient/{town,townroute,townlife,townflow}.ts | BAKE, VIEW | keep |
| 65 | Town weather: puddles, lamp light on wet ground, runoff | render/weather/town.ts | BAKE, VIEW | keep |
| 66 | The valley: quarry bowl, spoil heaps, groves, gorge, tarn, the road; haze ridges | render/world/{valley,valleyArt}.ts; assets/haze | VIEW | keep |
| 67 | The shaft: walls, strata, guide rails | render/world/shaft.ts | BAKE, VIEW | keep |
| 68 | Fog: colour where active, gray where sensed, exact black void, no band | render/fog.ts, fogPrep.ts | BAKE (masks), VIEW | keep |
| 69 | Colour creeping at dawn, receding at a purge | render/fx/kinds/stain.ts, render/town/stain.ts | VIEW | keep |
| 70 | Light by the hour: dawn gold, night blue-black, cloud shadows, lamps at dusk | render/ambient/{grade,core,index}.ts | VIEW | keep |
| 71 | Sky weather at every zoom: rain, drizzle, storm, lightning, fog banks, wind, overcast | render/weather/*.ts | BAKE, VIEW | keep |
| 72 | One camera, one zoom: a face, the mine, the town, the valley; drag, wheel, pinch, keys; never a cut | render/camera.ts, world/{coords,capfade}.ts, feel/camera.ts | VIEW, APP | keep |
| 73 | Detail by zoom | render/world/coords.ts | VIEW | drop: a mechanism, not behaviour: the atlas manifests carry halved levels and the view picks one by zoom |
| 74 | Far-zoom beacons | render/world/beacons.ts | BAKE, VIEW | keep |
| 75 | Camera button: whole world, my mine | ui/plate.ts | HUD | drop: zoom and the click-to-go of the goal, feed and characters menu reach the same places (CUTS: nothing else) |

### People, moments and films on screen
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 76 | Every person in frame from the baked parts by role, posed by what they do, walking their route | render/people/*, view/{people,figures}.ts, mine/people.ts; assets/people | LIFE | keep |
| 77 | Allegiance by the wick: violet yours (brighter with devotion), gold the Flame's, pale; light pool at the feet | render/fx/kinds/{wick,wickGround}.ts, people/paint.ts | LIFE | keep |
| 78 | Posture in rain, wind, cold, fog | render/people/weather.ts | LIFE | keep |
| 79 | Riding the lift between the mine and the pit head | render/world/crossing.ts | LIFE | keep |
| 80 | A crowd only where people gather, each one clickable; no crowd tokens, no mine crowd, no ghost people (CUTS) | life/shapes.ts, render/town/{folk,folkLayer,people}.ts | LIFE | keep |
| 81 | Hover ring, picked ring, the pool under yours | scenes/play/marks.ts | LIFE | keep |
| 82 | The grave: the hoard, set stones and their aura | scenes/play/{grave,crystalart}.ts | LIFE | keep |
| 83 | The whisper: the god's violet thread and the outcome | render/fx/kinds/{god,grave}.ts, render/effects.ts; assets/thread | LIFE | keep |
| 84 | A strike's glint and reveal, scaled by its 1-in-N | render/fx/kinds/crystal.ts, render/crystal/anim.ts, feel/{scores,score}.ts | LIFE | keep |
| 85 | Pocketing, the cart, the count's chalk, the offering's walk and each reveal | render/fx/kinds/loop.ts, feel/tally.ts | LIFE | keep |
| 86 | Eat, burn, enchant, curse, recombine, facet, set a stone | render/fx/kinds/craft.ts | LIFE | keep |
| 87 | Each miracle and act of evil, devouring, an exposure | render/fx/kinds/{miracles,cards}.ts | LIFE | keep |
| 88 | Wards, the Council's steel, the Temple's fire, the bells | render/fx/kinds/world.ts | LIFE | keep |
| 89 | Wisps, sparks, motes | render/particles.ts, view/sparks.ts | LIFE | keep |
| 90 | Shake, punch, hit-stop | feel/{camera,recipes,feel,host,index}.ts, feel/kit/* | LIFE | keep |
| 91 | Rare finds and bad news take the camera | feel/fastday.ts | LIFE | keep |
| 92 | Notes appear where things happen | feel/notes.ts, scenes/play/livingday.ts | LIFE (anchor), HUD (text) | keep |
| 93 | The watershed: the camera rises up the shaft, the mine shrinks to a glowing point, the town opens gray and black, the lift's load rises with it | scenes/finale/{watershed,seq,motion,spline,host}.ts, render/world/cameraPath.ts | LIFE | keep |
| 94 | The ending: the gate, the road, the far city and its greater mines; its lines | scenes/finale/{ending,overlay,words}.ts | LIFE, PANELS (words) | keep |

### Interface
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 95 | The god's corner: hunger as the grave crystal filling, rank as lit facets, Nether and its nightly income, Hunger, Malice, Ichor values | ui/play/rest.ts, ui/play/kit/parts.ts | HUD | keep |
| 96 | The three powers as three wicks | ui/play/rest.ts, kit/parts.ts | HUD | keep |
| 97 | The crystal pouch by grade with counts | ui/play/rest.ts, kit/parts.ts | HUD | keep |
| 98 | The clock: hour, day, weekday; AP refilling; pause (LIVE replaces End Night, x2, x4 and skip) | ui/play/rest.ts, feel/fastday.ts, scenes/play/day.ts | HUD | keep |
| 99 | The depth gauge at the left edge | ui/play/{rest.ts,kit/meter.ts} | HUD | drop: the camera already shows depth; a sixth thing at rest (style.md §7, CUTS) |
| 100 | The people plate | ui/play/rest.ts | HUD | drop: the characters menu is the people list; a second copy of it (CUTS) |
| 101 | The goal in plain words; a click goes there | ui/play/{rest,record}.ts | HUD | keep |
| 102 | The record: goal and chronicle (C) | ui/play/record.ts, content/chronicle.ts | HUD | drop: the goal line and the day feed carry it; a chronicle is a second feed (CUTS) |
| 103 | The feed: notes, warnings, a click jumps there | ui/play/notes.ts | HUD | keep |
| 104 | Toasts | ui/kit.ts | HUD | drop: a second notice channel beside the feed and the notes where things happen (ONE SOURCE) |
| 105 | Tooltips: two plain lines, then Details; a builder's hover shows its name only (CUTS) | ui/tooltip.ts | HUD | keep |
| 106 | Hints that teach one thing, sit by it, go when done; the first three days teach the loop | ui/play/guide.ts | HUD | keep |
| 107 | Settings: volumes, interface size, always reachable (gear, Esc) | ui/{settings,prefs,plate}.ts | HUD | keep |
| 108 | The interface scales with the window, 24 px margin, nothing cut off at 1280x720 to 2560x1440 | ui/theme.ts, ui/play/css.ts | HUD | keep |
| 109 | Stats menu (I) | ui/play/sheet.ts, scenes/play/menusbridge.ts | HUD | keep |
| 110 | Characters menu (P) | ui/play/roster.ts | HUD | keep |
| 111 | The hand: up to five, rises on hover, Discard | ui/play/hand.ts | HUD | keep |
| 112 | The deal: three cards large in the centre at dusk, take one or none, reroll | ui/play/hand.ts, scenes/play/night.ts | HUD | keep |
| 113 | Card plates: art in the top two-thirds, name band, crystal pips, one sentence | ui/play/kit/{cards,art,parts}.ts | HUD, BAKE (card art) | keep |
| 114 | Inked slabs, parchment tabs, icons; IM Fell English | ui/{icons,ink,fonts}.ts, ui/plate.ts, ui/play/kit/surface.ts, ui/fonts/* | HUD, BAKE (plates) | keep |
| 115 | Person slab: portrait, name, line, ties, where now; Whisper with odds and why; routine; Move; give an item | ui/play/person.ts, ui/play/kit/figures.ts | PANELS, BAKE (portraits) | keep |
| 116 | Grave panel: sockets, set, take out, eat, enchant, recombine, resonance | ui/play/gravepanel.ts | PANELS | keep |
| 117 | Paying a miracle: choose the stones to burn | ui/play/pay.ts | PANELS | keep |
| 118 | A crystal's card: shape, name, odds, modifiers, odd effect | ui/play/kit/gems.ts | PANELS, BAKE (shapes) | keep |
| 119 | Building screen: interior with who works there now, master, what it makes, lit figures for how far yours, its bench (cuts, anvil, weights, profaning, draughts, lamps, cloth, brew) or why locked | ui/play/building.ts, ui/play/kit/{interiors,rooms,room,objects}.ts, scenes/play/shade/building.ts | PANELS, BAKE (interiors) | keep |
| 120 | Blessing pick at each rank | ui/play/dialogs.ts | PANELS | keep |
| 121 | A story event's choice | ui/play/dialogs.ts | PANELS | keep |
| 122 | Dusk: each offered stone revealed with its odds; the ledger | ui/play/dusk.ts | PANELS | keep |
| 123 | Answering a threat; opening the vault | ui/play/building.ts, scenes/play/shade/hud.ts | PANELS | keep |

### Sound
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 124 | A sound for every moment: strike by rarity and affinity, pocket, cart, count, offering, reveal, eat, burn, enchant, curse, recombine, set, each card, devour, exposure | audio/{index,types}.ts, feel/adapters.ts; assets/audio | APP (audio) | keep |
| 125 | Beds: opening, bonus, whisper, watershed, shade, ending, defeat; stingers | audio/{index,types}.ts | APP (audio) | keep |
| 126 | Ambience by hour and weather, crowd, the shift whistle, the lift | audio/{view,automation}.ts | APP (audio) | keep |
| 127 | Four volume buses | audio/types.ts | APP (audio) | keep |

### Shell
| # | Feature | Old files | Track | Keep |
|---|---|---|---|---|
| 128 | Boot and one pump | main.ts, app/{app,scene,registry}.ts | APP | keep |
| 129 | Pointer to world, picking by the scene graph | app/pointer.ts | APP, VIEW | keep |
| 130 | Resolution and device pixel ratio | app/resolution.ts | APP | keep |
| 131 | One save, replaced each dawn; Continue | app/session.ts | APP | keep |
| 132 | `?scene=play&seed=7&mute=1`, `&fast=1` | content/flags.ts | APP, CONTENT | keep |
| 133 | `window.__hg` | app/debug.ts | APP | keep |
| 134 | Keys I, P, C, Esc, Space | ui/play/menus.ts | APP | keep |
| 135 | The profiler: F3 reloads into the profiled page (`?prof=1`), every named function's ms, calls and KB per frame and per sim tick, GPU draws and uploads, heap; Copy report; `__hg.prof()` | render/profiler*.ts | APP (`src2/app/prof/`, `src2/app/boot.ts`, `tools/probes.ts`) | keep |

### Not player features (go at SWITCH, recorded here)
The old F3 profiler's files (`render/profiler*.ts`: #135 is the rebuilt one); the F4 renderer switch and the Canvas 2D frame; the `?props11`, `?crystals`, `?view`, `?bonus` switches (CUTS: the baked path is the only one); the in-game bakes, workers and IndexedDB caches (`terrain/worker.ts`, `world/valley.worker.ts`, `mine/groundCache.ts`, `mine/prebake.ts`, `idle.ts`, `slice.ts`); `feel-gen` (offline, joins `gen/`); `src/bots` (empty; bots live in `scripts/`).

## 3. Tracks

| Track | Item | Folder | Budget | Starts |
|---|---|---|---|---|---|
| SIM | rb-sim | `src2/sim/*.ts` | 4,000 | now |
| WORLD | rb-world | `src2/sim/world/` | 2,000 | now |
| CONTENT | rb-content | `src2/content/` | 5,000 | now |
| BAKE | rb-bake | `gen/bake/`, `assets/` | 2,500 (non-game, deleted at SWITCH) | now |
| VIEW | rb-view | `src2/view/` (world) | 2,000 | now |
| LIFE | rb-life | `src2/view/life/`, `src2/view/film/` | 2,000 | now |
| HUD | rb-hud | `src2/ui/hud/`, `src2/ui/kit.ts` | 2,200 | now |
| PANELS | rb-panels | `src2/ui/panels/` | 2,300 | now |
| APP | rb-app | `src2/app/`, `src2/audio/`, `src2/main.ts`, `rebuild.html` | 1,100 | now |
| TESTS | rb-tests | `tests/rebuild/`, `scripts/bots/` | 2,500 (non-game) | after SIM's first merge |
| SWITCH | rb-switch | everything | net −115,000 | when every track above has merged |

With `agent_cap` 4: SIM, CONTENT, BAKE, APP first (everything else reads them), then VIEW, HUD, WORLD, PANELS, then LIFE and TESTS, then SWITCH. A track that hands back at its cap gets its successor at once.
