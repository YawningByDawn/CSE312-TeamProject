# Brief — CAST: everyone who is not a miner (town folk, Elites, enemies, crowds)

Handoff/log: `handoffs/CAST.md`. Port **5227**. Scratch `/tmp/cast/`.
Read: `DECISIONS.md` §13.11, §13.3, §14.3, §14.6, §10 (factions, Elites); `docs/refs/town.png`, `docs/refs/mine.png`, `handoffs/ref/ref-6x-figures-{a,b,c}.png`; `handoffs/P2-people.md` and `src/render/people/**` (the miner animator's rig, figure design, paint, clips, animator — read-only; you build on its public API and ask for additions under "Requests"); `src/sim/content/` (unit kinds, Elites, factions, responders).

The miner animator is making miners. The game also needs a town full of distinct people and enemies you can recognise at a glance. Same rig, same hand, same scale rules as the miners (small lanky figures like the reference).

## Build `src/render/people/cast/` (new files only)
1. **Town folk:** smelter hands, traders and stallholders, farmers, carters, clerks, washerwomen, children, beggars, drunks, a lamplighter — outfits, props and 2–3 work/leisure clips each (hammer, bellows, haggle, weigh, sow/reap, carry sacks, write, scrub, run/play, beg, stagger, light a lamp).
2. **Elites:** each named Elite in the sim as an individual — silhouette, costume, bearing, a signature idle and a signature reaction to being whispered to / turned (the Magistrate, the High Priest, the Guildmaster or whatever the content defines; read it). Readable from far zoom by silhouette and one accent colour, with no icon over the head.
3. **Enemies and authority:** mine guards (variants), the overseer, Temple priests and acolytes (kiln-orange accents, censers, the Flame), the inquisitor (tall, slow, a lantern that searches — the figure the player learns to dread), Council soldiers and officers (steel-blue, pikes, shields, drums), hunters with dogs; clips: patrol, search, notice, point, seize, beat, burn, ward, pray against you, march, stand guard, break a door.
4. **The converted:** how allegiance shows on every design — subtle at first (a violet glint, a secret sign), unmistakable when devoted (posture, markings, the lamp's colour) — and how fear, zeal and doubt show in posture.
5. **Crowds and groups:** formations with internal life — market crowd, congregation at the temple steps, procession, patrol squad, work gang, mob, queue at the lift, funeral; each member animated at a low rate, group silhouettes readable when zoomed out; conversion of a group shown as colour passing through it person by person.
6. **Animals** (small, cheap): dogs, a cat, chickens, a mule with a cart.
All sprite-cached for hundreds on screen; gray (Sensed) variants; far-zoom specks/blobs.

## Interface first
Within your first ten tool calls list the roles/designs/clips you provide and how a `PersonView` selects them (role ids, `activity` names, group API) at the top of your handoff — the life director and the town renderer consume it.

## Proof and self-grading
`dev/cast.html` + `e2e/cast-shots.cjs`: contact sheets (every design × clips at 8 phases, zoom 1 and 3, colour and gray), a line-up at equal scale beside `handoffs/ref/ref-6x-figures-b.png` and a crop of `town.png`, crowd strips (12 frames), far-zoom readability sheet → `screenshots/cast-*.png`; perf (300 figures). Follow `handoffs/RULES.md` rule 13 (grade yourself against the reference after every milestone; keep going until your honest score is ≥ 8).

## Ownership
Yours only: `src/render/people/cast/**`, `dev/cast.html`, `e2e/cast-shots.cjs`, `screenshots/cast-*.png`, `handoffs/CAST.md`. Append `### CAST — Town folk, Elites, enemies, crowds` to `DECISIONS.md`.
