#!/bin/sh
# Deploys main: `deploy` from anywhere once linked (`sudo ln -s "$PWD/deploy/deploy.sh" /usr/local/bin/deploy`).
set -e
cd "$(dirname "$(readlink -f "$0")")/.."
git checkout main
git pull --ff-only
docker compose up -d --build
