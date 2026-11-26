# PROPS 5 — every mine prop as an illustration (behind `?props=4`)

## Inventory: what the mine draws (things.ts, dressing.ts via art/props + art/props2, ambient/mine.ts)
One line each, per docs/theme.md (wickfolk; horn, hide, shell, clay, stalk-timber, the Council's cast stone).
`[S]` = baked sprite placed with the flag; `[ ]` = still the old drawing.

Containers
- [S] basket (ore / crystal / cap-flesh / empty): twined reed basket, braided rim, carrying cord — `basket-*`
- [S] bundle: rolled hide (or felt) bundle, spiral end, two cinched cords with knots — `bundle` (v2 = felt)
- [S] gourds / gourd: dried gourds with stoppers and cord slings, one lying — `gourds`, `gourd`
- [S] jar: tall clay jar, lugs with a cord through them, cloth or stopper — `jar`
- [S] canister: the Council's cast crystal canister, seams and rivets, port, clay tag — `canister`
- [S] offering bowl (ore / chits / crystal): clay bowl on a foot — `obowl`
- [S] offerings by the shrine fire: jars, cloth-tied pot, bowl of food, candle stub, hide sack — `offerings` (baked, not placed by the mine: no caller draws this group)
- [S] crates (earlier loop; not placed by the mine either)

Timber
- [S] stalk frame (timber set): posts with wedges, pale weathered lintel, dog and lashing — `frame`
- [S] adit: the frame shoring a dark mouth in packed boulders — `adit`
- [ ] stalk pile, scaffold, duckboard, chute, loading deck, mooring post
- [S] rail stack: spare rails on sleepers, pry bar — `railstack`

Lights
- [S] torch (replaces the work-light tripods, h < 60): crooked stake in a cairn, rag head, pitch, flame — `lantern`
- [S] tally lamp (h ≥ 60): lashed stalk tripod, arm, shard cage, notched tally board — `tallylamp`
- [S] shard lamp on a wall peg: horn peg, cord, shard cage — `hooklamp`
- [S] ember pot: clay pot of coals on a horn bracket from a rock crack — `emberpot`
- [S] cold brazier: clay bowl on lashed horn legs, dead ash and char — `brazier`
- [S] censer: pierced clay lid glowing, horn legs and finial, smoke — `censer`
- [S] hearth: stone ring, coals, pot hung from two lashed poles — `hearth`
- [ ] votives, offering-table flames, hanging censer, flame nook, kiln shrine, candle

Tools
- [S] horn pick: haft with hide grip, horn tine through an iron-wedged eye — `pick` (turned by placement)
- [S] shell scoop: shell blade lashed into a split haft — `scoop`
- [S] rope coil: two coils tied together, whipped end — `ropecoil`
- [S] tool rack: posts, peg rail, horn pegs, picks and scoops hung, cord coil — `toolrack`
- [S] balance: cast pillar on stepped blocks, horn beam, shell pans, chits and a weight stone — `balance`
- [S] notch board: two boards on stalk legs, rows of tally notches (red = owed), knotted cords — `notchboard`
- [ ] staff rack, switch lever, signal bell, knot cords

Furniture
- [S] rest pallet: slatted stalk frame, quilted felt pad (red / teal / ochre), folded hide, rolled-hide pillow — `pallet`
- [S] hide screen: posts and pole, hide laced through punched holes, patch — `hidescreen`
- [S] cut stones: dressed blocks stacked, wedge and cord, chips — `cutstones`
- [ ] sort table, offering table, prayer mat, cast block, wash trough, trough, shrine steps, hidden cache, clothes line

Lift and works
- [ ] lift frame, crystal engine, counterweights, pump works, boom, cage, punt, pipe, brick fan

Creatures
- [S] shed shell: moulted ribbed shell plate, curled, broken edge — `shedshell`
- [S] bones: rib pieces, gnawed long bone, jaw with teeth — `bones`
- [S] pit beast pulling the cart train (ambient): 4 walk frames + standing — `beast-walk`, `beast-stand`
- [ ] pit beast in its stall (things.ts pitBeast / beastStall), skitter

Ambient
- [S] rolling carts: `cart-full-body` / `cart-empty-body` + `cartwheel`, the wheels turned by the distance rolled

Natural dressing (left as is by design): floor rocks, ore and rubble heaps, crystal clusters and heaps, stalagmites, split boulder, fungus beds, ripples.

## State
Generators: `src/feel-gen/props/` (parts, pen, containers, timber, lights, tools, furniture, creatures, cart, crates,
crystal; index = registry; dev = sheet/compare views). Bake: `PORT=… flock … node scripts/bake-props.cjs`.
Proof: `screenshots/props5-large-1..4.png`, `screenshots/props5-in-game-1.png`, `-2.png`, `-before.png`
(`scripts/props-ingame.cjs`). Decisions: DECISIONS §45. Default (no flag) unchanged; prebuilt-ground hash test green.

## Next (if the owner accepts the direction)
The `[ ]` lines above; a second pass on the weakest (hook lamp, pick, scoop, shed shell, bones: under 300 marks).
