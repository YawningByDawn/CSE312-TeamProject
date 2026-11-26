# Art pipeline: the baked pictures and sounds, and what places them

Every picture and sound the game shows was made by our own painters offline and ships as files under `assets/`. Nothing draws at load or per frame (`contract.md`, Architecture): the view places sprites of these files and picks frames. The painters and bake scripts are not in this tree; a new or changed asset is a bake that writes its folder in the shape below (the rules for the agent that makes one: `docs/contracts/asset.md`).

## The shapes

- **Atlas** (`AtlasManifest`, `src/types/tracks.ts`): one picture `file` plus `manifest.json` with `cells: name -> [x, y, w, h, k, ax, ay]` (the rect in the picture, k px per world unit, the cell's origin), optional `clips` (cell names in frame order at fps) and `levels`. A PNG or WebP atlas ships level 0 only and Pixi mipmaps it on the GPU; a compressed one (`.bc1`, `.bc3`) ships each level as `<file>@1..@n`. `src/view/atlas.ts` loads it; `Atlas.sprite(name)` places a cell.
- **Table**: an atlas whose picture is data, one texel per cell of a grid (`tables`, `cell`, `gw`, `gh`): the fog fields and the land's mask, read by the fog worker (`src/view/fog.worker.ts`), never shown as a picture.
- **Tiles**: a folder per tile (`x<i>y<j>/`, `n<i><j>/`), each its own atlas with its world `rect`, placed where the rect says.
- **Sheet**: an atlas the DOM shows as CSS backgrounds (`src/ui/panels/art.ts` `cell`, `src/ui/kit.ts`), k = 2 px per CSS px.

## The folders

| Folder | Shape | Holds | Read by |
|---|---|---|---|
| `audio/` | packs + `manifest.json` | every sound as byte ranges of 11 Ogg Opus packs: sfx with variants, beds, ambience, stingers | `src/audio/index.ts` (one-shots decoded per sound, long material streamed by `src/audio/loop.ts`) |
| `mine/` | two pictures | `lit-1.webp`, the mine lit by its static lights with every prop and set piece in it, and `night-1.png`, the night's light as a ratio to the day's | `src/view/ground.ts` |
| `sheen/` | picture + grid | the wet streaks on the mine's faces and floor, and which fog cell owns each | `src/view/sheen.ts` |
| `life/` | atlas | the white cells the lights, effects, marks and films tint and place: soft glows, puffs, stars, caps, rings | `src/view/index.ts` (one atlas shared by lights, effects, weather and films) |
| `people/` | `people.json` + `<look>.hi.webp` | every look's cut-out parts and their variants, at close zoom | `src/view/life/people.ts`, `looks.ts` |
| `poses/` | `poses.json` + `lo*.webp` pages | the poses each role's loops step through, and every look's low-detail picture | `src/view/life/people.ts`, `looks.ts`, `rig.ts` |
| `town/` | pages + `manifest.json` | every building, place, prop and cap-tree of the town at two scales, each placed once by the manifest | `src/view/town.ts` |
| `townground/` | tiles, `.bc1` | the surface's ground lit by day | `src/view/surface.ts` |
| `townlight/` | atlas | the town's day and night light maps, its glow and its lamp cores | `src/view/town.ts`, `grade.ts`, `index.ts` |
| `gray/` | `mine/`, `things/`, tiles | the Sensed gray twin of the mine, of the town's things and of its ground | `src/view/gray.ts`, `town.ts` |
| `fog/` | tables | the mine's and the town's fog fields | `src/view/fog.ts`, `fog.worker.ts` |
| `haze/` | noises | the drifting haze over Sensed ground | `src/view/fog.ts` |
| `valley/` | `far/`, four near tiles, `mask/` table | the land round the town and its known-ground mask | `src/view/valley.ts`, `fog.worker.ts` |
| `weather/` | atlas, `.bc3` | white cells the view tints: rain streaks, smears, puddles, fog banks, gusts, lightning, the mine's pools | `src/view/weather.ts` |
| `defeat/` | atlas | the defeat's ramps and the grave's eye | `src/view/film/films.ts`, `src/ui/panels/art.ts` |
| `ui/` | sheet | the interface's plates, frames, icons and nine-slices | `src/ui/kit.ts`, `src/ui/panels/art.ts` |
| `cardart/`, `crystals/`, `crystalmarks/<affinity>/`, `portraits/p<n>/`, `interiors/<room>/`, `front/`, `title/` | sheets | card art, the stones by base and grade, each affinity's material, the people's portraits, each room's interior, the title's still and its lettering | `src/ui/panels/art.ts` |
| `opening/` | `opening.mp4` | the opening film: the owner-approved opening's last 8 s (the eye opens, the crystal rises, the god's thread spreads), recorded at 1920x1080 60 fps with its sound, H.264 + AAC, 1.7 MB | `src/view/film/opening.ts` (played over the canvas while the `opening` film runs; `e2e/opening-check.cjs`) |
| `fonts/` | two `.woff2` + `OFL.txt` | IM Fell English (`CREDITS.md`) | `src/ui/kit.ts` |

Every file under `assets/` has a reader in this table: `npm run build` emits each one, and `tools/reach.cjs` holds the code side.
