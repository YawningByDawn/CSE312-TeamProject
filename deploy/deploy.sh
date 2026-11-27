#!/bin/sh
# Deploys a game: `deploy io` deploys Gobble Grove (the backup-game branch); `deploy`, or `deploy` with anything else,
# deploys Hungry God Inc. (main). Run it from anywhere once linked (`sudo ln -s "$PWD/deploy/deploy.sh" /usr/local/bin/deploy`).
# All the work is in a function that runs only once sh has read the whole file: checking out the other branch rewrites
# this file under it.
set -e

deploy() {
	case "$1" in
	io) branch=backup-game ;;
	*) branch=main ;;
	esac
	cd "$(dirname "$(readlink -f "$0")")/.."
	git fetch origin "$branch"
	git checkout "$branch"
	git pull --ff-only origin "$branch"
	docker compose up -d --build
}

deploy "$@"
exit
