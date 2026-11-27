# CSE312-TeamProject

Deployed at: https://your-domain.com

## Run locally

```
docker compose up
```

Then open http://localhost:8080. No `.env` is needed; `compose.yaml` has defaults.

## Game

Hungry God Inc. lives in `app/game` (TypeScript, Vite, PixiJS). The app image builds it in a Node stage and serves the build at the site's root, `/`, after every other route. The title's top right corner opens a popup to log in or register (it posts to the auth service's `/register` and `/login`) and logs out; `/api/me` names who is logged in, `null` for nobody.

Multiplayer: logged in, the game opens the app's `/ws` socket; logged out, it plays alone. The title's Multiplayer swaps its menu for Host, Search and Back (logged out, it opens the login popup); Host and Search show in the title itself, no popup. The hub (`app/websocket`) owns the lobbies: Host opens one named `<host>'s lobby` for up to 4 players, no password; Search lists the open ones to join (a lobby playing a match is not open); the host leaving closes it, and a dropped connection leaves it.

The host's Start begins a match in **the shared mine** for everyone in the lobby. The hub runs it (`app/websocket/match.go`, 20 ticks a second by default, `TICK_RATE`) and the players only send what they want; the game draws it with its own mine, miners and crystals:

- **The world fits the players.** The mine opens three of its twelve zones a player (3, 6, 9 or 12 for 1 to 4); the rest is rock in the dark. The layouts are `app/game/src/content/arena.json`, which the server embeds and the game reads too, with the mine's walk grid (`walk.json`) as the walls.
- **Each player serves a different god**, by lobby order: the Violet, Crimson, Jade and Amber gods. Each spawns at their own god's shrine (an altar and pillar of light in the god's colour) in their own part of the mine; their miner, light and domain are in that colour.
- **Play:** WASD to walk, click to swing the pick. Walk over violet crystals to carry them (5 at most) and bring them to your own shrine; the first god given 20 wins. A swing knocks back and stuns anyone in reach and scatters what they carry for anyone to take; nobody is struck at their own shrine. After the winner shows, everyone is back in the lobby and the host can Start again. Leave takes a player out of the match and the lobby.

The socket's messages, JSON, the game reading them as `window.__hg.net` (`app/game/src/app/net.ts`):

- To the hub: `{"type":"game","data":...}` (relayed to every other player as `{"type":"game","from":<name>,"data":...}`), `{"type":"host"}`, `{"type":"search"}`, `{"type":"join","host":<name>}`, `{"type":"leave"}`, `{"type":"start"}` (the host only; anyone else is ignored); in a match `{"type":"input","dx":..,"dy":..}` (the heading held, each -1..1) and `{"type":"strike","dx":..,"dy":..}` (a swing toward that aim).
- From the hub: `state` (who is on, sent when it changes), `{"type":"lobby","lobby":{"host","name","members","max"}|null}` (the lobby the player is in, to each member whenever it changes; `null` when they are out of it), `{"type":"lobbies","lobbies":[...],"refused":"full"|"gone"|"playing"}` (the open lobbies, answering `search`, and a refused `join`, with the reason), `{"type":"match","match":{"players":[{"name","seat"}],"seats":[{"shrine":[x,y],"zones":[...]}],"goal","rate"}|null}` (the match the player is in as it starts; `null` when it ends or they leave), `{"type":"world","seq","players":[{"name","x","y","dx","dy","face","walked","moving","carry","swing","ax","ay","stun"}],"crystals":[[id,x,y]],"score":[...],"winner"}` (every tick of a match; `winner` is a seat, -1 while it plays), `kicked`.

Every action in a match is the server's, keyed by the username from the verified JWT: a client can only say which way it wants to walk and where it swings.

To work on it alone:

```
cd app/game
npm ci
npm run dev
```

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
6. Link the deploy command once, from the repo's folder, then run `deploy` from anywhere to start the app and to redeploy main after pushing changes:
   ```
   chmod +x deploy/deploy.sh
   sudo ln -sf "$PWD/deploy/deploy.sh" /usr/local/bin/deploy
   deploy
   ```
