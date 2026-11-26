# Credits and licences

Every third-party thing Hungry God Inc. uses or ships: name, version, what it is for, licence, whether it is in the built game, and where it comes from. Versions and licences were read from `node_modules/<pkg>/package.json` and each package's own LICENSE file on 2026-11-23, not from memory. Builders: add a row when you add or use something new.

## In one paragraph

The built game (`npm run build`) contains our own TypeScript and PixiJS (MIT), bundled by Vite, plus two font files (IM Fell English, SIL OFL 1.1), the baked pictures under `assets/` and the baked sounds in `assets/audio/`, all made by our own code. Everything else below is a development or test tool and is not shipped.

## 0. Shipped runtime package: PixiJS (DECISIONS §90)

`pixi.js` 8.23.0 is the one runtime `dependency`: the view (`src/view/`) is built on it. Licence MIT (read from `node_modules/pixi.js/package.json` and its LICENSE), source https://github.com/pixijs/pixijs. Its own installed dependencies (read the same way): `earcut` 3.2.4 ISC, `eventemitter3` 5.0.4 MIT, `@xmldom/xmldom` 0.8.15 MIT, `gifuct-js` 2.1.2 MIT, `ismobilejs` 1.1.1 MIT, `parse-svg-path` 0.2.0 MIT, `tiny-lru` 11.4.7 BSD-3-Clause, `@types/earcut` 3.0.0 MIT and `@webgpu/types` 0.1.74 BSD-3-Clause (type definitions only). The bundle keeps their MIT notices in the bundler's licence comments.

## 1. Packages from `package.json` (all `devDependencies`; none ships in the game)

| Package | Version | Used for | Licence | Source (from its package metadata) |
|---|---|---|---|---|
| `typescript` | 7.0.2 | type-check (`npm run typecheck`, first half of `npm run build`) | Apache-2.0 | https://github.com/microsoft/TypeScript.git |
| `vite` | 8.3.8 | dev server, production build, preview | MIT | https://github.com/vitejs/vite.git |
| `vitest` | 5.1.1 | unit tests (`npm test`) | MIT | https://github.com/vitest-dev/vitest.git |
| `tsx` | 4.23.15 | runs the TypeScript scripts (`scripts/bots/table.ts`) | MIT | https://github.com/privatenumber/tsx |
| `@types/node` | 26.6.6 | Node type definitions for scripts and tests | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git (`types/node`) |

### Their installed dependencies (42 packages in `node_modules` in total, all dev-only)

Licences found across all 42: 34 MIT, 4 Apache-2.0, 2 MPL-2.0, 1 ISC, 1 BSD-3-Clause.

| Package | Version | Licence | Source |
|---|---|---|---|
| `esbuild`, `@esbuild/linux-x64` | 0.28.2 | MIT | https://github.com/evanw/esbuild.git |
| `@jridgewell/resolve-uri` | 3.1.3 | MIT | https://github.com/jridgewell/resolve-uri |
| `@jridgewell/sourcemap-codec`, `@jridgewell/trace-mapping` | 1.6.0, 0.3.31 | MIT | https://github.com/jridgewell/sourcemaps.git |
| `@oxc-project/types` | 0.156.0 | MIT | https://github.com/oxc-project/oxc.git |
| `rolldown`, `@rolldown/binding-linux-x64-gnu` | 1.2.19 | MIT | https://github.com/rolldown/rolldown.git |
| `@rolldown/pluginutils` | 1.1.1 | MIT | https://github.com/rolldown/plugins.git |
| `@types/chai` 5.2.3, `@types/deep-eql` 4.0.2, `@types/estree` 1.0.10 | | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@typescript/typescript-linux-x64` | 7.0.2 | Apache-2.0 | https://github.com/microsoft/TypeScript.git |
| `@vitest/mocker`, `@vitest/spy` | 5.1.1 | MIT | https://github.com/vitest-dev/vitest.git |
| `assertion-error` 2.0.1, `chai` 6.3.0 | | MIT | https://github.com/chaijs/chai (and `chaijs/assertion-error`) |
| `detect-libc` | 2.1.2 | Apache-2.0 | https://github.com/lovell/detect-libc.git |
| `es-module-lexer` | 2.3.2 | MIT | https://github.com/guybedford/es-module-lexer.git |
| `estree-walker` | 3.0.3 | MIT | https://github.com/Rich-Harris/estree-walker |
| `expect-type` | 1.4.0 | Apache-2.0 | https://github.com/mmkal/expect-type.git |
| `fdir` | 6.5.0 | MIT | https://github.com/thecodrr/fdir.git |
| `lightningcss`, `lightningcss-linux-x64-gnu` | 1.33.0 | **MPL-2.0** (see "Licences that are not plain permissive") | https://github.com/parcel-bundler/lightningcss.git |
| `magic-string` | 1.4.5 | MIT | https://github.com/Rich-Harris/magic-string.git |
| `nanoid` | 3.3.20 | MIT | https://github.com/ai/nanoid |
| `obug` | 3.0.0 | MIT | https://github.com/sxzz/obug.git |
| `picocolors` | 1.1.1 | ISC | https://github.com/alexeyraspopov/picocolors |
| `picomatch` | 4.0.7 | MIT | https://github.com/micromatch/picomatch |
| `postcss` | 8.5.33 | MIT | https://github.com/postcss/postcss |
| `source-map-js` | 1.2.4 | BSD-3-Clause | https://github.com/7rulnik/source-map-js |
| `std-env` | 4.3.0 | MIT | https://github.com/unjs/std-env |
| `tinybench` 6.2.4, `tinyexec` 1.3.1, `tinyglobby` 0.2.17 | | MIT | https://github.com/tinylibs/tinybench , https://github.com/tinylibs/tinyexec.git , https://github.com/SuperchupuDev/tinyglobby.git |
| `undici-types` | 8.9.0 | MIT | https://github.com/nodejs/undici.git |
| `why-is-node-running` | 3.2.1 | MIT | https://github.com/mafintosh/why-is-node-running.git |

`@esbuild/linux-x64` and `@rolldown/binding-linux-x64-gnu` carry their licence in `package.json` only (no LICENSE file in the package folder).

## 2. Tools used by the test and screenshot scripts (not in `package.json`, not shipped, not redistributed)

| Tool | Version | Used for | Licence | Source |
|---|---|---|---|---|
| Playwright (global install, `/usr/local/lib/node_modules_global/playwright`; the scripts set `NODE_PATH` to that folder) | 1.63.0 | every `e2e/**` script: drives the game in a browser and takes the `screenshots/` | Apache-2.0 (its package metadata and LICENSE file) | https://github.com/microsoft/playwright.git |
| Chromium as installed for Playwright (`/opt/pw-browsers`; it reports "Google Chrome for Testing 153.0.8010.12") | 153.0.8010.12 | the browser the e2e scripts run | **not recorded here**: no licence file ships in the install. Chromium is published by its project under BSD-style terms with bundled third-party components (per the project; not verified on this machine). | https://playwright.dev |
| Python 3 and Pillow (PIL) | 3.13.18, 12.3.0 | `e2e/lib/montage.py` (contact sheets) | Pillow: MIT-CMU (its package metadata) | https://github.com/python-pillow/Pillow |

## 3. Bundled assets that were not drawn or written in this repo

| File | What it is | Used for | Licence | In the built game? | Where it came from |
|---|---|---|---|---|---|
| `assets/fonts/im-fell-english-latin-400-normal.woff2`, `…-400-italic.woff2` | IM Fell English Roman and Italic; Latin subsets, font version 3.00 | every word of the interface (`src/ui/kit.ts` registers them as "HG Fell") | SIL Open Font License 1.1, as recorded in the files themselves: each font's name table reads "© 2007 Igino Marini (www.iginomarini.com) With Reserved Font Name IM FELL English …" with licence URL `http://scripts.sil.org/OFL`; the licence text is `assets/fonts/OFL.txt`. That text's first line reads "Google Inc." and it has no copyright line naming Igino Marini. | yes (2 files) | Said to be from @fontsource; that package is in neither `package.json` nor `node_modules`, so the download cannot be re-checked here. **Open decision for the owner: keep or remove** (see "Open items"). |

All other `.png`, `.jpg` and `.webp` files in the repo are our own bakes (`assets/`), screenshots we took (`screenshots/baselines/`) or reference material listed in section 4.

## 4. Reference images (not shipped)

| File | What it is | Status |
|---|---|---|
| `docs/refs/mine.png`, `town.png`, `town-target.png`, `region.png` | the owner's visual targets: lighting and rock for the mine, density and layout for the town, the land | Supplied by the owner (`docs/spec.md` §15, `CLAUDE.md`). Their own upstream origin and rights are not recorded anywhere in the repo: **owner to confirm** before the repository is made public. |
| `handoffs/ref/ref-3x-*.png`, `ref-6x-figures-*.png` | 3× and 6× crops of `docs/refs/mine.png`, made for the art notes (`handoffs/ART-REFERENCE.md`) | derived from the owner's `mine.png` |

They are not in the build: nothing in `src/` or `dev/` names a file in `docs/` or `handoffs/ref/`.

## 5. Reference only, nothing copied

| What | Used for | Source | Licence |
|---|---|---|---|
| sfx-skill | a design and measurement reference for sound effects: its loudness conventions ("brief" = loudest 200 ms) were borrowed as ideas; no file or code from it is in this repo | https://github.com/owoevan-dev/sfx-skill | MIT, as recorded by the audio builder in `DECISIONS.md`; not installed here and not re-verified |

## 6. What is made in code

- **All game audio was synthesised by our own code** (oscillators, noise and filters rendered offline) into the Ogg Opus packs in `assets/audio/`, which the player (`src/audio/index.ts`) fetches from its own origin. No recorded or third-party sound is used.
- **All art was baked by our own painters**, offline, into the atlases and tiles under `assets/` (`docs/art-pipeline.md`). The two fonts in section 3 are the only outside artwork in the game.
- **The game fetches only its own origin.** Every `fetch(`, `new WebSocket` and `new Worker` in `src/`: the baked files (`src/view/tables.ts`, `src/view/life/people.ts`, `src/audio/index.ts`, the fog worker `src/view/fog.ts`), and in a build made with `VITE_HG_NET` the course framework's `/api/me`, `/logout` and its game socket on the same host (`src/app/net.ts`).

## Licences that are not plain permissive

- `lightningcss` 1.33.0 and `lightningcss-linux-x64-gnu` 1.33.0: **MPL-2.0** (weak, file-level copyleft). A hard dependency of Vite 8, used at build time only. Its code is not in the shipped bundle and we have not modified it.
- Chromium for Testing: licence file not present locally (section 2). Not redistributed.
- IM Fell English: SIL OFL 1.1, a permissive font licence with conditions (see open items).

## Open items for the owner

1. **IM Fell English fonts: keep or remove.** They are bundled and shipped (two `.woff2` files). The OFL allows bundling and redistribution with software as long as the licence text and copyright notice travel with the fonts. The font files carry the Igino Marini notice and the licence file sits next to them, but `OFL.txt` names "Google Inc." rather than the author, and the files declare a Reserved Font Name ("IM FELL English …") while being Latin subsets re-encoded to woff2 by a third party (we use them under the family names "HG Fell" / "HG Fell SC"). Whether that is acceptable, or the lettering should become a face made in this repo, is the owner's call. Nothing was removed.
2. `docs/refs/*.png`: upstream origin and rights not recorded, owner to confirm.
4. sfx-skill's MIT licence is recorded second-hand (by the audio builder); it is reference only.
