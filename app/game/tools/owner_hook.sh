#!/bin/sh
# The pre-commit and pre-merge-commit hook of every checkout, installed by tools/land.py into the shared .git/hooks.
# A linked worktree staging a queue file runs the owner's checkout's land.py --staged (the queue State rules; the owner's
# copy, as a worktree's older land.py would take the flag for something else). The owner's checkout runs the fleet's
# owner guard, which refuses a commit on main unless it is a landing made through the commit lane; a guard that cannot run
# refuses too.
case "$(git rev-parse --git-dir)" in
  */worktrees/*)
    game=app/game   # the game's folder in the repo: its queue files and tools
    git diff --cached --quiet -- $game/docs/queue.md $game/docs/queue-deferred.md && exit 0
    py=$(command -v python || command -v python3)   # Windows has python; Linux and macOS often only python3
    top=$(git rev-parse --show-toplevel); common=$(git rev-parse --git-common-dir)
    unset GIT_DIR   # git sets it for a hook: left set, the folder below would be taken for the work tree's root
    cd "$top/$game" && exec "$py" "$common/../$game/tools/land.py" --staged ;;
esac
gitdir="$(git rev-parse --git-common-dir)"
case "$gitdir" in /*|[A-Za-z]:*) ;; *) gitdir="$(git rev-parse --show-toplevel)/$gitdir" ;; esac
root="$(cd "$gitdir/.." && pwd)"
eng="$root/../engine/Universal/tooling/hooks"; [ -d "$eng" ] || eng="$root/engine/Universal/tooling/hooks"
py="$root/.venv/bin/python"; [ -x "$py" ] || py="$(command -v python3 || command -v python)"
refuse() { echo "commit refused: the owner guard cannot run ($1); only a landing moves main and this checkout cannot tell one from a commit." >&2; exit 1; }
[ -n "$py" ] || refuse "no python"
[ -f "$eng/owner_guard.py" ] || refuse "$eng/owner_guard.py is missing"
"$py" "$eng/owner_guard.py" "$(basename "$0")"; rc=$?
[ "$rc" = 127 ] && refuse "its interpreter did not start"
exit "$rc"
