# Hungry God Inc. — The style (binding art direction)

Owner: "we have a clear style. I want triple A grade shit not kids doodles." The style is the one in `docs/refs/mine.png` (and `docs/refs/town-target.png` for the town). This page says what that style is, in rules a builder can check. `docs/theme.md` says what things are; this says how they are drawn. Where they disagree on looks, this wins.

## 1. In one line
**A hand-inked, hand-painted dark storybook**: heavy black ink contours with living line weight, three or four hard-edged tones per material, drawn texture on every surface, small warm lamps and violet crystals glowing in a teal-black dark. The company it keeps: *Darkest Dungeon*, *Don't Starve*, *Cult of the Lamb* — not a vector app, not a 3D render, not pixel art.

## 1a. View (binding; owner, 2026-11-24)
Owner: "the perspective doesn't seem right. You have to decide between an angled down view and a top down. Right now it reads as a weird mix. I'm more a fan of the angled down". Decided: **angled down, everywhere** — mine, town, valley, building interiors' objects. `docs/refs/mine.png` is this view. Nothing is drawn in plan.
- **The numbers: 45°.** Owner: "Make a flat grid that has a slight angle and place stuff on it. Before placing stuff on it let me see a mockup of the perspective"; three mockups were sent (camera 60°, 45°, 30° above the floor) and the owner picked the middle one ("B"). So `ky` = `kz` = 0.71 for everything: a thing's depth shows at 71 % and its height at 71 % (`src/feel-gen/rock/view.ts` `VIEW2`). A circle on the floor is an ellipse 0.71 as tall as it is wide. Props drawn earlier at the steeper 30° (`src/feel-gen/props/hewn.ts` `VIEW` `ky` 0.5 / `kz` 0.86, hand-shaped ellipses at 0.44) are brought to 45° as they are next touched; a new or redrawn prop is drawn at 45°. A free-standing object may be turned slightly so one end shows (`kx`); the ground and walls are not turned.
- **The floor is a tilted plane.** Anything lying on it is foreshortened: a circle is an ellipse 0.71 as tall as it is wide (the grave's mouth, pools, rings of stones, shadows, pools of light, wheel contact). Further back is higher on the screen and is overlapped by what stands in front.
- **Whatever stands, stands straight up the screen** and shows a front and a top: people, props, crystals, posts, doors, walls. Never a table, cart, pot, pallet or bench seen from straight above.
- **Walls have height** (about one and a half people) and it is the same everywhere. A wall at the back of a room (the floor is below it on screen) shows its **front face** rising from the floor line to its top edge, then its top. A wall at the front of a room (the floor is above it on screen) shows its top and back only and may cover the feet of what stands right behind it. Side walls show a narrow face. A wall is never a plan outline with facets pointing every way.
- **Rails, sleepers, steps, kerbs** have thickness: a lit top and a dark near side.
- **One light direction** for shadows (§5): shadows fall the same way for everything and lie on the floor as foreshortened shapes.

## 2. Line
- Ink is warm black `#0b0a0c`. Never grey lines, never coloured outlines (except glow rims and an enemy's thin harm-red line, DECISIONS §128).
- Every object has a **closed outer contour about 1/30 of the object's height — 1.5–2 px on a prop at game scale, never heavier than the line in the reference crop at equal pixel scale**; inner form lines about half that. (Corrected 2026-11-23: an earlier 2.5–3.5 px rule made props read as stickers.) Thin even hairlines are still forbidden; interface slabs, being large, keep a 3 px contour.
- Line weight **swells** on the shadow side, under overhangs and at ground contact; it **thins and breaks** on the lit side. Corners overshoot a little. Strokes wobble by hand (low-frequency, ±0.5 px): no ruler-straight or perfectly elliptical edge anywhere.
- Black is also a fill: deep creases, undersides, door mouths and cast shadows go to solid ink.

## 3. Tone
- Each material is **3–4 flat tones with hard edges** (deep shadow, shadow, base, light) plus small specular flecks. **No smooth gradients on objects.** Gradients exist only in light: glow halos, light pools, fog.
- Shadow shapes are drawn shapes that describe the form (a plank's underside, the core shadow of a barrel), not a darker copy of the outline.
- **No flat area larger than ~12×12 px at game scale without a mark**: grain lines, hatching in shadow (2–4 short parallel strokes), chips, cracks, nail heads, stains, pebbles, moss tufts. The reference has a mark on everything.
- Everything sits on a **contact shadow** (solid ink ellipse under it) and casts a short soft-edged shadow away from the nearest light.

## 4. Colour (sampled from `mine.png`; use these, not new ones)
| Role | Shadow → light |
|---|---|
| Old rock, damp (teal) | `#0c2224` `#132e30` `#243f3f` `#3a5a57` |
| Dry rock, sensed ground (warm grey) | `#1a1a19` `#252523` `#3c3a36` `#575855` `#736e70` |
| Dirt, timber, hide (ochre) | `#3a2d1f` `#5e4d37` `#846a49` `#af926f` |
| Lamp and hearth light | pool `#c98a3c` → core `#ffd98a` (gold belongs to the Flame: `docs/theme.md` §2) |
| Crystal (violet — yours) | `#3a2360` `#6b46b8` `#a784e6` `#c1adc5` → core `#f4ecff` |
| Council light | cold white `#dfeaf2` |
| Void | `#000` |
The picture is **dark**: outside light pools most pixels are below 35 % brightness. Saturation lives only in light sources and what they touch. Whole-frame median brightness: mine ~50/255, town by day 45–60.

## 5. Light
- Three kinds only, each a pool with a soft falloff that tints the ground and the facing sides of things: **warm lamps** (small, many), **violet crystal glow** (bloom halo + tint on neighbours), **cold Council white**. Away from a light, things fall to the teal-black ambient.
- Seen areas end in a soft grey mist rim into black Void; no hard band, no coloured edge.

## 6. Objects (props, buildings, mushrooms)
- Built from the materials above with real construction: planks with gaps and nails, staves and hoops, lashed joints, patched cloth, chipped stone. Silhouettes are chunky and slightly crooked, with one clear read at 24 px.
- Detail survives at game scale: judge at 1×, not zoomed.
- Checked only by a side-by-side crop against the reference **at equal pixel scale**. If a stranger would not say "same artist", it is not done.

## 7. Interface
The interface is made by the same hand as the world: **inked and painted objects, not web panels.** Model: *Darkest Dungeon*'s interface discipline in this palette.
- **Forbidden:** thin gold corner brackets, 1 px borders, pills, percent bars, drop-shadowed rounded rectangles, small-caps label rows, more than five things on screen at rest, paragraphs on buttons, jargon.
- **Surfaces:** dark slabs with a hand-cut irregular edge and a 3 px ink contour, painted in the warm-grey rock ramp with a chiselled light edge on top and hatching toward the bottom; labels on torn hide/parchment tabs (ochre ramp) in ink. Nothing translucent, nothing glassy.
- **Colour means what it means in the world:** violet is the player's (costs, the player's actions, End Night); gold is the Temple; cold white is the Council; ochre is the public; red is harm. No decorative colour.
- **Type:** IM Fell English (bundled) for names and titles, at 22 px or more; body and numbers in a plain strong serif or the bundled text face at 16 px or more (at 1600×900); numbers that the player decides with are big (28 px+). Ink-black on parchment or pale `#e9dcc3` on dark slab. No all-caps rows smaller than 14 px.
- **Words:** six words or fewer per label, plain speech a stranger understands in two seconds ("Hungry", "3 crystals", "The Temple is watching"). A number appears only where the player chooses with it.
- **Icons and cards are illustrations** in the world's style (ink contour, 3–4 tones, a mark on every surface), not glyphs. A card is a painted plate ~150×215 px at 1600×900: art fills the top two-thirds, the name on a parchment band, the cost as crystal pips, one sentence.
- **Layout at rest (Night), five things:** top-left the clock (the sun or moon dial, the day, the weather) with the three powers under it as three wicks whose flame height is their alarm; top-right only the settings cog in the corner itself; bottom-left the god (hunger as the grave crystal filling, rank as lit facets); bottom-right the crystal pouch (shards by grade with counts); bottom-centre **your hand** (the special cards you hold, at most five, rising on hover) with one carved draw button beside it. Pressing it deals **one set of three cards in the centre of the screen**, large, drawn from one pool of miracles and acts of evil mixed; you take one into your hand or none, and the set leaves. The first special card you use each turn is free; each further one that turn costs Nether, more each time, shown on the card as a Nether price. (Owner, 2026-11-23: "The cards should appear one set of 3 at the time at the center of your screen. Not placed at the bottom there. You can draw a card into your hand" · "let's make it so that you draw from a pool of miracles and evils" · "can use 1 special card each turn". Cards are only miracles and acts of evil: whisper, commands, eating, answers to a threat and anything done to a person are verbs on the opened panel, never cards); holding the clock ends the day. The goal is one line over the god. Everything else (a person, the grave, the record, settings) opens on demand next to what was clicked and closes again.
- **Numbers and menus:** the god's corner shows Nether as a number (with what comes in a night) and the values of Hunger, Malice and Ichor beside their words. A **stats menu** (every stat, its number, what moves it, what it does now) opens from the god's corner; a **characters menu** (everyone who is yours and the people you know of, one row each; a click goes to the person) opens from a carved button at rest. Owner, 2026-11-24: "I should see SOME stats" · "where is nether?" · "where's the menu with my stats? Where's the menu with my characters?" (DECISIONS §47).
- **Size:** the interface scales with the view (one factor from the window, the same share of the screen at 1280×720 and at 2560×1440), with an "Interface size" setting (Small / Medium / Large). At rest it frames the world and does not sit on it. Owner, 2026-11-24: "It's way too big and there's not UI size scaling with resolution" · "Don't overcompensate and make it microscopic". Body text is at least 14 px on screen at 1600×900 (this replaces the 16 px above), names 19 px or more.
- 24 px safe margin; nothing overlaps or is cut off at 1280×720, 1600×900 or 2560×1440.
