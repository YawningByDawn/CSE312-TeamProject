# Multiplayer: the shared mine

The living reference for multiplayer: what it does now, where each piece lives, and how to change it. The rules here
are a **first draft, not final**. When you change how multiplayer plays, update this file in the same commit, and add a
line to `DECISIONS.md` §133 for anything that changes the design rather than just a number.

**If you are an AI assistant given a multiplayer task:** read this whole file first. The section
[How to change things](#how-to-change-things) says which files a change touches, and
[Rules the repo enforces](#rules-the-repo-enforces) lists the checks your change must keep passing.

All paths are relative to the repo root. The game's own paths start with `app/game/`.

---

## What it is now

1. **Lobby.** A logged-in player picks Multiplayer on the title screen, then Host (opens `<name>'s lobby`, up to 4
   players) or Search (lists open lobbies to join). See `DECISIONS.md` §131.
2. **Start.** The host presses Start. Everyone in the lobby enters a **match** in the shared mine at once. A lobby that
   is playing is hidden from Search, and joining it is refused (`"playing"`).
3. **Match.** Real time: everyone acts at once and sees the others move live (the course's Objective 3 asks for this; see
   `app/game/docs/cse312-requirements.md`).
   - **The world fits the players.** The map is the single-player mine. It has 12 zones, and each player opens 3 of them,
     so 1/2/3/4 players get 3/6/9/12 zones. Closed zones are solid rock and drawn black.
   - **Each player serves a different god**, by lobby order (host first): seat 0 the Violet god, 1 Crimson, 2 Jade,
     3 Amber. Each spawns at their god's **shrine** in their own **domain** (that god's 3 zones). Their miner, the light
     at their feet, a faint wash over their domain's floor and their shrine's altar are in the god's colour.
   - **Goal.** Walk over violet crystals to pick them up, carry them to your **own** shrine to score. The first god to
     the goal (20) wins.
   - **Fighting.** Click to swing your pick. A hit stuns the other player, knocks them back and scatters the crystals
     they carry for anyone to grab. Nobody can be hit while standing at their own shrine.
4. **End.** The winner shows for 6 seconds, then everyone is back in the lobby and the host can Start again. **Leave**
   (bottom right in a match) takes a player out of the match and the lobby.

**The server is the authority.** The Go hub owns every position, wall, crystal, hit and score, and steps the match
20 times a second. A browser only sends "I'm holding this direction" and "I swung toward here", under the username from
its verified JWT, so a player can't teleport, score, or act as someone else.

---

## Where everything lives

### The shared data (one source for server and game)

| File | What it holds |
|---|---|
| `app/game/src/content/arena.json` | **The rules and layouts.** `rules`: every match number (table below). `layouts[n-1]`: the mine for `n` players, one seat per player, each a `shrine` point and its 3 `zones`. |
| `app/game/src/content/walk.json` | The mine's walkable floor: a 300 x 175 grid of 8-unit cells, each the index of its zone (`zones` list) or 255 for rock. Baked from the fog art; don't hand-edit. |
| `app/game/src/content/arena.ts` | Types for `arena.json`, and `GOD_COLOURS` (the 4 gods' colours, client only). |

The Go server **embeds** both JSON files at build time (`app/main.go`, `//go:embed`; the Dockerfile copies them into
the Go build stage), and the game bundles them too. **After editing either, rebuild both:** `docker compose up --build`.

### Server (Go, `app/websocket/`)

| File | What it does |
|---|---|
| `arena.go` | Loads and **validates** the two JSON files at startup (`Load`; the server refuses to start on a bad layout). Walls: `stands(x, y)`. Precomputes where crystals may appear (`findSpots`). |
| `match.go` | **The match rules.** `newMatch` (seats and spawns), `step` (one tick: swings, stuns, walking, picking up, giving, winning, new crystals), `strike`, `blow`, `scatter`, `remove`. |
| `lobby.go` | Lobbies, and starting, stepping and ending their matches (`start`, `step`, `resume`). Routes `input` and `strike` to the player's match. `maxLobbyPlayers = 4`. |
| `hub.go` | The one goroutine that owns all state; the tick loop (`TICK_RATE`, default 20); presence (`state`). |
| `messages.go` | Every message's JSON shape (`encodeMatch`, `encodeWorld`, ...) and which incoming types are accepted (`decode`). Names are HTML-escaped on the way out. |
| `websocket.go` | The socket: JWT check on the handshake, message size and rate limits (1 KB, 60 a second). |
| `match_test.go`, `lobby_test.go` | Go tests for the above. |

### Game (TypeScript, `app/game/src/`)

| File | What it does |
|---|---|
| `app/net.ts` | The socket: keeps `net.match` (the setup) and the last two `world` ticks (`net.world`, `net.was`); `net.move`, `net.strike`. |
| `app/match.ts` | `MatchFeed`: builds `vm.match` each frame, smoothing everyone between the server's last two ticks (one tick behind). |
| `app/pump.ts` | Holds the single-player clock while a match plays; runs the feed; forwards moves and strikes. |
| `app/input.ts` | In a match: WASD sends the held direction, a click sends a swing aim, the camera follows you (`MATCH_ZOOM`). |
| `types/tracks.ts` | `MatchSetup`, `MatchWorld`, `MatchBody`, `MatchShown`, `MatchView`, and the `Net` interface. |
| `view/arena.ts` | `matchRules` (makes the renderer light only the open zones, in daylight, with no ores) and the `Arena` layers: domain wash, shrines (altar, pillar, ring, the heap of given crystals), crystals on the ground, carried crystals over heads, hit flash, stun motes. |
| `view/life/players.ts` | Places each player as a miner figure tinted in their god's colour (the people layer's figures). |
| `ui/panels/match.ts` | The match HUD: the gods' board (top left), names over heads, the help line, Leave, the winner banner. |
| `ui/panels/lobby.ts` | The lobby screens; the host's Start. |
| `content/words/panels.ts` | Every word the player sees: `match.*` (god names, help line, banner) and `lobby.*`. |

Tests: `app/game/tests/rebuild/app/match.test.ts` (the smoothing). Design record: `app/game/DECISIONS.md` §133.

---

## The rules (`arena.json` → `rules`)

Lengths are in mine units (the mine is 2400 x 1400; a miner is about 36 tall). Times are in seconds.

| Key | Now | Meaning |
|---|---|---|
| `speed` | 90 | Walking speed, units a second. |
| `feet` | 5 | Radius of a player's feet against the walls. |
| `pick` | 18 | A crystal is picked up within this distance. |
| `carry` | 5 | Most crystals one player can carry. |
| `shrine` | 48 | Standing this close to your own shrine gives what you carry; nobody is hit inside it. Also the ring drawn on the ground. |
| `goal` | 20 | The first god given this many crystals wins. |
| `crystals` | 6 | Crystals on the ground at most: `crystals + crystalsEach x seats` (9, 12, 15, 18 for 1-4 players). |
| `crystalsEach` | 3 | (see above) |
| `spawnEvery` | 1.2 | Seconds between new crystals while under the cap. The ground starts full. |
| `spawnClear` | 80 | New crystals never appear closer than this to any shrine. |
| `swing` | 0.62 | How long a swing lasts (matches the miner's baked swing animation; change only with the art). The swinger can't walk meanwhile. |
| `blow` | 0.26 | When in the swing the hit lands (also the animation's own moment). |
| `reach` | 40 | A hit lands on anyone within this of the swinger's feet (plus `feet`)... |
| `arc` | 70 | ...and within this many degrees either side of the aim. Anyone right at the feet is always hit. |
| `stun` | 1.2 | A hit player can't move or swing for this long, and can't be hit again meanwhile. |
| `knock` | 28 | How far a hit pushes them (walls stop it). |
| `scatter` | 36 | Their carried crystals land on the floor within this distance. |
| `over` | 6 | Seconds the winner shows before everyone returns to the lobby. |

Numbers that are **not** in `arena.json` (change them in code):

| Where | What |
|---|---|
| `app/websocket/lobby.go` `maxLobbyPlayers` | Most players in a lobby (4). See "Change the player cap" below. |
| `compose.yaml` / `.env.example` `TICK_RATE`; default in `hub.go` `defaultTickRate` | Server updates a second (20). The game reads it from each match's setup, so no client change is needed. |
| `app/websocket/match.go` `grow` | New crystals keep `3 x pick` apart from each other. |
| `app/game/src/app/input.ts` `MATCH_ZOOM` | How far the camera zooms in at match start (0.3; 0 is closest, 1 the whole mine). |
| `app/game/src/content/arena.ts` `GOD_COLOURS` | The 4 gods' colours. |
| `app/game/src/view/arena.ts` (top constants) | Looks only: crystal size and bob, altar, heap, domain wash strength. |

---

## The layouts (`arena.json` → `layouts`)

`layouts[0]` is the 1-player mine, `layouts[3]` the 4-player mine. Each entry lists one seat per player, in lobby order.
A seat is `{ "shrine": [x, y], "zones": [three zone names] }`. The open world is every zone some seat lists.

| Players | Open zones (by seat) | Shrines |
|---|---|---|
| 1 | cartway, grave, heartvein | the grave's south rim (1190, 895) |
| 2 | westdrift, cartway, grave · sorting, heartvein, eastworks | westdrift (532, 684) · eastworks (1996, 684) |
| 3 | cartway, grave, lowgallery · overseer, lift, sorting · heartvein, eastworks, sump | cartway (868, 676) · lift (1940, 236) · sump (1756, 1164) |
| 4 | kilnshrine, westdrift, bunks · overseer, lift, sorting · heartvein, eastworks, sump · cartway, grave, lowgallery | bunks (652, 340) · lift (1940, 236) · sump (1756, 1164) · lowgallery (796, 1116) |

### The mine's zones

`(x, y)` is each zone's most open floor point, a good shrine spot. Neighbours are zones that share floor, so you can
walk between them.

| # | Zone | Open point | Neighbours |
|---|---|---|---|
| 0 | kilnshrine (far west) | (260, 708) | westdrift |
| 1 | westdrift | (532, 684) | kilnshrine, bunks, cartway |
| 2 | bunks (north-west) | (652, 340) | westdrift, cartway, overseer |
| 3 | cartway | (868, 676) | westdrift, bunks, grave, lowgallery, sorting |
| 4 | overseer (north) | (1180, 196) | bunks, lift |
| 5 | lift (north-east) | (1940, 236) | overseer, sorting |
| 6 | sorting | (1460, 476) | cartway, lift, eastworks |
| 7 | grave (centre) | (1204, 804) is the grave's pit; use (1190, 895) | cartway, heartvein |
| 8 | heartvein | (1604, 860) | grave, eastworks |
| 9 | eastworks (east) | (1996, 684) | sorting, heartvein, sump |
| 10 | lowgallery (south) | (796, 1116) | cartway, sump |
| 11 | sump (south-east) | (1756, 1164) | eastworks, lowgallery |

### What a valid layout needs

The server checks these at startup (`Load` in `arena.go`) and won't start if one fails:

- exactly `maxLobbyPlayers` layouts, and layout `n` has exactly `n` seats;
- every zone name is one of `walk.json`'s `zones`;
- each shrine stands on open floor (feet included) of one of **its own** seat's zones.

The Go tests also check:

- every open zone can be walked to from the first shrine (`TestEveryOpenZoneIsReachable`);
- **3 zones a player** (`TestTheMineOpensThreeZonesAPlayer`): update this test if you change that design;
- specific closed zones for 1 and 2 players (`TestClosedZonesAreRock`): update it if you change those layouts.

---

## How to change things

Every change below needs a rebuild to show up: `docker compose up --build`.

**Tune a number** (speed, goal, carry, reach, ...): edit `rules` in `arena.json`. No code change. Run `go test ./...`
in `app/` (some tests read rule values, so they follow), and update the rules table above.

**Change a layout, a spawn or the world size:** edit `layouts` in `arena.json` using the zone table above. Keep each
domain's zones next to each other and the whole open set connected. Run `go test ./...` in `app/`; if you changed
"3 zones a player" or the 1- and 2-player layouts, update the tests named above, then this file's layouts table.

**Rename or recolour a god:** names are `match.god.0` to `match.god.3` in
`app/game/src/content/words/panels.ts`; colours are `GOD_COLOURS` in `app/game/src/content/arena.ts`. Seat `i` uses
entry `i` of both.

**Change the player cap** (say, to 6):

- `maxLobbyPlayers` in `lobby.go`;
- add layouts 5 and 6 to `arena.json`, using all 12 zones or fewer per player;
- add `GOD_COLOURS` entries;
- add `match.god.N` words;
- check the board in `ui/panels/match.ts` still fits;
- update the Go tests that assume 4.

**Add a rule the server enforces** (e.g. a time limit, a respawn, a power-up):

1. Implement it in `match.go` (state on `match` or `mPlayer`, logic in `step`), with a test in `match_test.go`.
2. If players must see it, add the field to `worldPlayer` / `worldMessage` (or `matchView`) and its encoder in
   `messages.go`.
3. Mirror the field in `types/tracks.ts` (`MatchBody`, `MatchWorld` or `MatchSetup`). `app/match.ts` copies every body
   field into `MatchShown` automatically, but **position-like fields need interpolating** there too, like `x`/`y`.
4. Show it: on the map in `view/arena.ts` (or on the figure in `view/life/players.ts`), on the HUD in
   `ui/panels/match.ts`. Words go in `content/words/panels.ts`.
5. If it's tunable, put its number in `arena.json` `rules` (and the `rules` structs in `arena.go` and `arena.ts`).

**Add a new player action** (e.g. a dash key):

1. Accept the message type in `decode` (`messages.go`); unknown types are dropped.
2. Route it in `lobbies.handle` (`lobby.go`) to a new `match` method.
3. Add a sender to `Net` (`types/tracks.ts`) and `net.ts`, a forwarder in `pump.ts` (like `matchMove`), and a key in
   `input.ts`. A new key also needs a `Bind` (`types/tracks.ts`) and a default in `content/keys.ts`.
4. Document the message in the protocol section below.

**Use a different map:** not supported yet. The mine is the only map: its art, walls (`walk.json`) and zones are baked
together, so a new map means new art and a new walk grid. Layouts can only open or close the existing zones.

---

## The protocol

JSON over the app's `/ws` WebSocket. Only logged-in players can connect (the JWT cookie is checked on the handshake).

**To the server**

| Message | When |
|---|---|
| `{"type":"host"}`, `{"type":"search"}`, `{"type":"join","host":name}`, `{"type":"leave"}` | Lobby screens. `leave` also leaves a match. |
| `{"type":"start"}` | The host's Start. Ignored from anyone else, or while the lobby plays. |
| `{"type":"input","dx":-1..1,"dy":-1..1}` | In a match: the direction held, sent when it changes. Kept until the next one. |
| `{"type":"strike","dx":..,"dy":..}` | In a match: swing toward that direction from your feet. Ignored while swinging or stunned. |
| `{"type":"game","data":...}` | Relayed to every other player as `{"type":"game","from":name,"data":...}`. Unused by the game today. |

**From the server**

| Message | When |
|---|---|
| `{"type":"state","players":[{"name"}]}` | Who is online, sent when it changes. |
| `{"type":"lobby","lobby":{"host","name","members","max"}\|null}` | The lobby you're in, whenever it changes. |
| `{"type":"lobbies","lobbies":[...],"refused":"full"\|"gone"\|"playing"}` | Open lobbies, answering `search` or a refused `join`. |
| `{"type":"match","match":{"players":[{"name","seat"}],"seats":[{"shrine":[x,y],"zones":[...]}],"goal","rate"}\|null}` | A match starts (also re-sent to a new tab taking over); `null` when it ends or you leave it. |
| `{"type":"world","seq","players":[...],"crystals":[[id,x,y]],"score":[per seat],"winner"}` | Every tick of a match. Each player: `name, x, y, dx, dy, face, walked, moving, carry, swing, ax, ay, stun` (`swing` is seconds into a swing, -1 when not swinging; `stun` is seconds left). `winner` is a seat, -1 while playing. |
| `{"type":"kicked"}` | Another tab took this account over. |

---

## Running and testing it

- **Unit tests.**
  - Server: `cd app && go mod tidy && go test ./...` (the Dockerfile tidies too; don't commit the `go.sum` or `go.mod`
    changes tidy makes).
  - Game: `cd app/game && npx vitest run tests/rebuild/app/match.test.ts`, and `npm run typecheck`.
- **Playing it.** `docker compose up --build`, open http://localhost:8080 in two to four separate browser profiles or
  private windows, register a different account in each, then host and join one lobby. `npm run dev` alone has **no
  multiplayer**: the hub only exists in the full stack.
- **Inspecting it.** In the browser console, `__hg.net.match` is the setup and `__hg.net.world` the latest tick;
  `__hg.camera({ zoom: 1 })` zooms out over the whole mine.

---

## Rules the repo enforces

The game folder has its own checks (`app/game/contract.md`, Architecture). Run them after a change, from `app/game`:

```
node tools/size.cjs && node tools/systems.cjs && node tools/reach.cjs && node tools/flags.cjs && node tools/text.cjs
```

- **Player-visible words** live in `src/content/words/` and are read with `uiText(...)`. No literal strings in
  ui or view code.
- **No `src/` file over 400 non-blank lines.** `src/view/life/people.ts` is at exactly 400. Add match code to
  `players.ts` or `arena.ts`, not there.
- **Layers:** `src/sim` (the single-player rules) knows nothing about multiplayer. The renderer and HUD read
  `vm.match`, and only `src/app` touches the socket.
- **The query string** is read only in `src/content/flags.ts`.

---

## Known limitations and ideas

These are open, not decided:

- **A refresh or dropped connection leaves the match.** The hub takes a disconnected player out of their lobby (and its
  match) on the next tick, so reloading mid-match drops you; what you carried falls on the floor and your god's score
  stays. Only a second tab taking over while the first is still connected resumes the match.
- **No client-side prediction.** You see your own miner one tick (50 ms) plus network delay behind your keys. Fine on a
  LAN; a far server may want prediction for your own miner.
- **The goal is the only end.** There's no time limit or sudden death; a player who leaves keeps their seat's score on
  the board as "gone".
- **One map**, the single-player mine. Layout choices are limited to its 12 zones.
- **Untuned.** The numbers come from two bots on a local server, not real play.

Ideas if the rules change: a match timer, stealing from a rival's shrine heap, respawning at your shrine after a big
hit, power-ups, uneven teams, or more interaction with the single-player systems (skeletons, ores).
