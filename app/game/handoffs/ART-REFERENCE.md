# How to read `docs/refs/mine.png` — the binding reading for all mine/town terrain art

`docs/refs/mine.png` is the only benchmark (DECISIONS §13.5). Two blind critics read it in contradictory ways ("rounded boulders three deep on every side" vs "faceted planes, walls on all four sides"). Both are partly wrong. This is the orchestrator's reading from 3× crops, checked against the whole image. The crops are in `handoffs/ref/` (`ref-3x-northwest.png`, `ref-3x-northeast.png`, `ref-3x-south.png`). Builders and critics: look at those crops next to this text before drawing or judging.

The view is a 3/4 top-down: you look down and slightly northward. That decides everything below.

## 1. Wall faces exist only where rock faces the viewer
- **North side of every floor** (= the south face of the rock mass above it): a tall **cliff face**, roughly 1.5–2.5 figure-heights high. It is built from **big chunky slabs and blocks** — angular forms with softened corners, mostly taller than wide or squarish, some leaning; neighbouring slabs differ a lot in width. Each slab is nearly one flat tone with a slightly lighter top/upper-left plane and a darker foot; a few inner plane breaks and short crack lines. Slabs are separated by **dark gaps and firm ink lines**, heavier at the wall's top silhouette and at the foot.
  - They are **not round beans, pebbles or eggs**, and not a Voronoi mosaic either. Think quarried, weathered blocks stacked into a face.
  - The face reads as one continuous wall: slabs touch and overlap; there is no smooth "backing" visible between them.
- **West and east sides:** the wall face wraps around from the north and continues down the sides, getting narrower (foreshortened) and dying out toward the south.
- **South side of a floor:** **no wall face at all.** The floor simply ends at an inked, irregular contour with a thin, slightly lighter lip and a few crack ticks; beyond it is the top of the rock mass, which is dark. A floor reaching the darkness across a thin lip on its south side is **correct**. Do not add boulder walls there.
- **Rubble:** rounded stones appear only as **scree at the foot of wall faces** and as occasional heaps — a loose scatter of gray-teal stones of mixed size, densest against the wall, thinning within about one figure-height. Not evenly sprinkled over floors.

## 2. Tops of rock masses (islands between corridors, and everything behind a wall's top edge)
- Along the edge: the ink contour and a narrow, uneven band of dark teal (the visible top surface near the edge), sometimes with a lighter lip.
- Inward: it **fades smoothly into near-black** within a short distance. Large islands are mostly darkness with a teal margin. This soft fade is in the reference; it is not a flat fill and not a textured plateau.
- The fade is the only place where a soft gradient is right. Everything else is crisp.

## 3. The outer boundary — the owner's rule beats the reference
The reference draws a soft gray glow around the mine's outer contour. **The owner has ruled this out: "No visible band should exist."** So: no glow, halo, lit rim or lighter line outside or along the outer contour. Rock tops darken to exact `#000`; a south floor edge is ink line → black. Luminance profiles outward across any boundary must fall monotonically after the ink line.

## 4. Floors
- Calm and dark: a muted **dark teal-gray** in cool areas, **warm brown-ochre only inside warm light**. Low contrast, low saturation. Large areas are nearly even in tone with soft, low-contrast mottling and a few faint cracks.
- Sparse detail: a few gray stones (mostly near walls), small debris near work spots. No confetti of pebbles, no flagstone/crazy-paving, no camouflage blotches, no airbrushed coloured ellipses.
- Rails are crisp drawn objects (two rails, clear evenly spaced sleepers) with a slightly darker bed; they belong to the prop layer.

## 5. Light and palette
- Base: cool teal rock and teal-gray floor. Where a fire or the shrine lights it, rock and floor shift to **muted gold-ochre** (not lime, not yellow-green), brightest next to the source and falling off within a chamber. The lit zone has a readable edge but no hard disc.
- Light models the wall: slabs facing the source are lighter, their sides and feet darker.
- Crystals glow pale violet and tint only their immediate surroundings.
- Overall: roughly half neutral/gray-teal stone, a quarter saturated teal, the rest warm; highlights reach fairly bright values on lit slab tops.

## 6. Line and finish
- Ink is dark teal-black, medium weight, slightly irregular; heavier on outer silhouettes, wall tops, wall feet and overlaps; thin inside forms. A little hatching on shadow sides and under overhangs — sparse.
- Everything is crisp at 2–3× except the rock-top fade.
- Scale: figures are small — a wall face is about two figures tall, a slab is one to two figures wide, a corridor is 3–5 figures wide.

## 7. What fails
Polygons / Voronoi / stained glass; masonry; rows of similar round stones ("beads", "teeth"); pebble piles as walls; smooth airbrushed walls; busy or brown-everywhere floors; lime or neon lighting; any rim, band, halo or glow at a boundary; blur.
