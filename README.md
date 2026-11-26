# CSE312-TeamProject

Deployed at: https://your-domain.com

## Run locally

```
docker compose up
```

Then open http://localhost:8080. No `.env` is needed; `compose.yaml` has defaults.

## Game

Hungry God Inc. lives in `app/game` (TypeScript, Vite, PixiJS). The app image builds it in a Node stage and serves the build at the site's root, `/`, after every other route. The title's top right corner opens a popup to log in or register (it posts to the auth service's `/register` and `/login`) and logs out; `/api/me` names who is logged in, `null` for nobody.

Multiplayer: logged in, the game opens the app's `/ws` socket; logged out, it plays alone. The hub relays a `{"type":"game","data":...}` message to every other player as `{"type":"game","from":<name>,"data":...}`, and its `state` messages list who is on; the game reads them as `window.__hg.net` (`app/game/src/app/net.ts`). No game content uses it yet.

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
