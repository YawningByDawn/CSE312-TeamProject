# CSE312-TeamProject

Deployed at: https://your-domain.com

## Run locally

```
docker compose up
```

Then open http://localhost:8080. No `.env` is needed; `compose.yaml` has defaults.

## Game

Hungry God Inc. lives in `app/game` (TypeScript, Vite, PixiJS). The app image builds it in a Node stage and serves the build at `/game/`; the home page links to it once you log in. To work on it alone:

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
6. Start the app, and run the same command to redeploy after pushing changes:
   ```
   sh deploy/deploy.sh
   ```
