# CSE312-TeamProject

Deployed at: https://your-domain.com

## Run locally

```
docker compose up
```

Then open http://localhost:8080. No `.env` is needed; `compose.yaml` has defaults.

## Game

This branch (`backup-game`) serves **Gobble Grove**, a multiplayer "eat and evolve" arena game, instead of Hungry God Inc. (whose code stays in `app/game`, unbuilt). The client lives in `app/arena` (TypeScript, Vite, Canvas 2D); the app image builds it in a Node stage and serves the build at the site's root, `/`, after every other route. The game itself runs on the server, in the app's websocket hub (`app/websocket`: `arena.go`, `species.go`, `ability.go`, `bots.go`, `view.go`).

How it plays: everyone shares one world (10000 × 8000), topped up with bots, split into five biomes, each with its own ground, terrain, food and creatures: the Fernlands (meadow) in the middle, Mirewood (swamp, tar pits and murky ponds) to the west, the Ashen Peaks (volcano) along the north, Frostmarch (tundra) along the south, and the sea to the east, with islands, kelp and reefs. Lava in the Ashen Peaks burns anything that is not fireproof or flying, so fireproof creatures can hide in it; ice in Frostmarch sends everyone sliding except the creatures born there. You start as a millipede. Food and anything smaller you catch give xp, and with enough of it you choose what to evolve into: 51 species over 12 tiers, prehistoric up to tier 7 and mythical above, splitting into land, sea (through the Devil Frog) and air (through the Meganeura) lines, up to Ymir, Tiamat and Quetzalcoatl. The menu's "See the evolution tree" (or T in game) shows it all. Instead of evolving you can stay as you are for a stat point, which raises your bite (+20%), skill (+20%), health (+15%) or speed (+5%) by a level, up to 5 each (Z, X, C, V, or the + on the upgrade bars at the bottom left, which light up while you have points); the next offer then comes at half the xp. At the top of the tree, xp earns stat points.

Some ground is safe for some creatures only. Rocks on land and coral reefs at sea are too steep for anything above tier 4: small creatures can get onto them and big ones are pushed back to the edge (fliers can still reach you). Tar pits bog big creatures down while small ones skitter across. Islands are land out at sea, where sea creatures are stranded. Each biome grows its own loose food (berries, mushrooms, eggs in the meadow; fernheads in the swamp; emberberries in the volcano; frostberries and pinecones in the tundra; krill, clams, fish at sea), and food sources keep growing their own: ginkgo trees drop nuts, termite mounds swarm, nests lay eggs, the meat on the bones of fallen giants grows back, ponds grow lilies, fishing holes in the tundra ice give fish, and vents in the sea feed shrimp. Now and then a glowing starfruit ripens somewhere on land, worth 60 xp to anyone.

Fights are health (HP) against bites (ATK); each species has its own, tanks more health and a weaker bite, hunters the other way. Anything a tier or more above you bites you when it touches you, but no single hit takes more than half your health: a bitten creature is thrown clear, runs faster for a second, and bites back, so it has a chance to get away, and health only grows back a few seconds after the last hurt. A bigger creature's tail is its weak spot, marked with a yellow target while you play: touching it bites it for half as much again, and it cannot bite you back from there. A boost (click or Space) dashes and bites a creature your size, or a bigger one (less, the bigger it is). Every species also has a skill (right-click, E or Shift) with a cooldown: a charge, a stomp that throws back everything near, a pull that drags it in, or a spit that flies; skills hurt bigger creatures less too, and grow with their level: stomps and pulls reach further (and from level 3 a stomp dazes), charges run longer and go through more creatures, and spits fly bigger and further, three at a time from level 3 and five at level 5. A bite or skill that empties a creature's health eats it, whichever is bigger. While you play, creatures that can eat you are outlined red and ones you can eat green.

Anyone can play: the menu's "Play as guest" plays without an account, under a made-up name like `Guest4821` (usernames are lower case, so no account can have one). Logging in or registering (the menu posts to the auth service's `/register` and `/login`) plays under your username; `/api/me` names who is logged in, `null` for nobody. The game opens the app's `/ws` socket with the login cookie, or as a guest with `?guest=<key>`, a random 32-hex-digit key the tab keeps, so a guest who reconnects gets the same name and creature back. Its messages are JSON:

- To the hub: `{"type":"input","dx":..,"dy":..}` (where to steer, each in [-1, 1]), `{"type":"spawn"}` (start a new creature, when you have none), `{"type":"boost"}`, `{"type":"ability"}`, `{"type":"evolve","to":<species>}` (one your offer lists, or -1 to stay for a stat point), `{"type":"upgrade","stat":"bite"|"ability"|"health"|"speed"}`. The lobby messages (`host`, `search`, `join`, `leave`, `start`) and the `game` relay still work as on main; the arena does not use them.
- From the hub: `hello` once per connection (the name you play under), `world` (the map: size, coastline, ponds, ferns, kelp, islands, tar pits, rocks, reefs and food sources; the species tree, food kinds, xp needs and tick rate), then a `state` each tick: your own numbers in `me` (`null` before your first spawn; `offer` lists what you may evolve into; `alive: false` with who ate you after a death), and the creatures (`c`), food (`f`), shots (`p`) and what was eaten (`e`) near you, plus the leaderboard (`lb`). `kicked` when a newer tab takes the player over.

The hub steps the arena `TICK_RATE` times a second (20 by default); the client draws a little in the past, between two states, so movement stays smooth.

To work on the client alone, with the stack running (`docker compose up`) for logging in and the socket:

```
cd app/arena
npm ci
npm run dev
```

Then open http://127.0.0.1:5173; the dev server forwards `/ws`, `/api`, `/login`, `/register` and `/logout` to http://localhost:8080. The server's tests: `cd app && go mod tidy && go test ./...` (the repo leaves `go.sum` out; the Dockerfile tidies too).

## Deploy (Ubuntu server)

Host nginx terminates HTTPS and forwards to the compose stack on `127.0.0.1:8080`. Its config is `deploy/host-nginx.conf`.

1. Point a DNS A record for your domain at the server's IP.
2. Install Docker, nginx and Certbot:
   ```
   curl -fsSL https://get.docker.com | sudo sh
   sudo apt install -y nginx certbot
   ```
3. Clone the repo, then create `.env` from `.env.example` with real passwords and `HTTP_BIND=127.0.0.1:8080` (keeps port 8080 off the internet).
4. Get a certificate. Certbot briefly stops nginx to use port 80, and renews the same way automatically:
   ```
   sudo certbot certonly --standalone -d your-domain.com \
     --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
   ```
5. Install the host nginx config, replacing `your-domain.com` with your domain:
   ```
   sudo cp deploy/host-nginx.conf /etc/nginx/sites-available/webproject
   sudo sed -i 's/your-domain.com/YOUR_DOMAIN/g' /etc/nginx/sites-available/webproject
   sudo ln -s /etc/nginx/sites-available/webproject /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```
6. Link the deploy command once, from the repo's folder, then run it from anywhere to start the app and to redeploy after pushing changes: `deploy io` deploys Gobble Grove (the `backup-game` branch), and `deploy` deploys Hungry God Inc. (`main`):
   ```
   chmod +x deploy/deploy.sh
   sudo ln -sf "$PWD/deploy/deploy.sh" /usr/local/bin/deploy
   deploy
   ```
