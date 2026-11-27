# CSE312-TeamProject

Deployed at: https://your-domain.com

## Run locally

```
docker compose up
```

Then open http://localhost:8080. No `.env` is needed; `compose.yaml` has defaults.

## Game

This branch (`backup-game`) serves **Gobble Grove**, a multiplayer "eat and evolve" arena game, instead of Hungry God Inc. (whose code stays in `app/game`, unbuilt). The client lives in `app/arena` (TypeScript, Vite, Canvas 2D); the app image builds it in a Node stage and serves the build at the site's root, `/`, after every other route. The game itself runs on the server, in the app's websocket hub (`app/websocket/arena.go`).

How it plays: everyone shares one meadow, topped up with bots. You start as a beetle; food and anything smaller you catch give xp, and each xp mark evolves you up the food chain: Beetle, Frog, Hare, Hedgehog, Boar, Lynx, Wolf, Bear, Bison, Mammoth. Anything a tier or more above you can eat you. A boost (click or Space) dashes and bites a creature your size, or one a tier up, and a bite that empties its health eats it. Beetles up to hedgehogs hide in bushes, and frogs under water, where nothing can eat them. Hunger falls faster the bigger you are, and an empty belly costs health. Bots grow no bigger than a wolf, so the top of the chain is for players.

The menu logs in or registers (it posts to the auth service's `/register` and `/login`) and logs out; `/api/me` names who is logged in, `null` for nobody. Only a logged-in player opens the app's `/ws` socket and plays. Its messages are JSON:

- To the hub: `{"type":"input","dx":..,"dy":..}` (where to steer, each in [-1, 1]), `{"type":"spawn"}` (start a new creature, when you have none), `{"type":"boost"}`. The lobby messages (`host`, `search`, `join`, `leave`, `start`) and the `game` relay still work as on main; the arena does not use them.
- From the hub: `world` once per connection (the map's size, ponds and bushes, the species and food kinds, the tick rate), then a `state` each tick: the player's own numbers in `me` (`null` before their first spawn; `alive: false` with who ate them after a death), and the creatures (`c`), food (`f`) and what was eaten (`e`) near them, plus the leaderboard (`lb`). `kicked` when a newer tab takes the player over.

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
6. Link the deploy command once, from the repo's folder, then run `deploy` from anywhere to start the app and to redeploy main after pushing changes:
   ```
   chmod +x deploy/deploy.sh
   sudo ln -sf "$PWD/deploy/deploy.sh" /usr/local/bin/deploy
   deploy
   ```
