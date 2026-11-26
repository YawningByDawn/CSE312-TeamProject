# TOWN-SIM — the town's rules as people (handoff)

Owns `src/sim/**` (town: `src/sim/town/*`, `content/town.ts`, `content/events.ts` TOWN_EVENTS), `tests/town/**`, `scripts/sim-bots.ts`. Binding: `docs/town.md`, `docs/vision.md` §4. Decisions: DECISIONS §44.
- One person = one unit (LIVING ids); Elites = building masters + officers; groups derived (`town/groups.ts`), whispered at an hour where they gather (`whisperGroup`). No crowd units, no Congregation merge.
- Buildings (`town/buildings.ts` `townBuildings`): a workplace is yours with its master and more than half of its workers; lost the same way. `facilityView` is a thin adapter.
- Gifts: `useGift` rumour, debt, food, records, guards; benches make things to carry (weights, relic, draught, lamp, clothing, brew, jewels); standing: metal, road, lesson, vault, gate, hearth.
- Things people carry: `giveItem` free — a follower wears the boon, anyone else gets the curse (`items.ts`); `takeItem` free. Bots make, give and take back (`bots/index.ts carryThings`).
- Searches in the town (`mining.ts` `townCount`, `townSearches`, `titheHome`): the tithe is carried home past the tally house count and a named soldier's row/cart search; worn things are evidence.
- Pushback: announced moves only, each through a named person at a place and hour (`town/pushback.ts`); `SHADE_RESPONDER` fires nothing but a landed crusade's torches.
- The win: `openVault` once the council hall is yours (`vaultWhy`); `victoryProgress` says so. Kindle removed.
- Town story events: six with rules (`TOWN_EVENT` numbers); `EVENTS.shade` = those + six mine events.

For other pieces:
- UI: new item kinds `lamp|clothing|brew` and facilities `lampHouse|clothHall|brewhouse` (text in `src/content/craft.ts`); lamp/clothing/brew are no longer `useGift` options. `search` events may carry `by` (a soldier), `zone`, `where: 'lift'|'rows'|'carts'`; `tally` may carry `by`, `zone`.
- PLAY-SHADE / PLAY-CORE: the scripted town player (`src/scenes/play/shade/autoplay.ts`) got a minimal vault step (`kind: 'vault'`) and weights council-hall people, but never takes the hall: `tests/play-core/fullrun.test.ts` "seed 11 to a win" (now lost) and "seed 3 … to an end" (stalls 90 nights) fail until that player aims at the hall (e.g. `whisperGroup` on `crew:councilhall`).
- LIFE: `tests/life/presets.ts` leaves out the town's own workers (LIVING ids working in the town); the mine director does not stage them.
- Balance (not tuned here): 8 seeds/bot — no bot reaches the vault; all runs end in a loss except 1 sensible and 2 random at the 100-turn cap.
