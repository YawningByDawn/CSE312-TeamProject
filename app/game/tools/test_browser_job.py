import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_job as bj  # noqa: E402

TOOLS = Path(__file__).resolve().parent


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


@pytest.fixture
def repo(tmp_path):
    """A worktree: tracked, untracked, ignored and screenshots/ files, node_modules with a relative link, the two tools."""
    r = tmp_path / "wt"
    (r / "src").mkdir(parents=True)
    (r / "tools").mkdir()
    for f in ("browser_job.py", "_proc.py"):
        shutil.copy(TOOLS / f, r / "tools" / f)
    (r / ".gitignore").write_text("node_modules\nignored.txt\n/.gamejob/\n")
    (r / "src" / "a.ts").write_text("a")
    (r / "gone.txt").write_text("x")
    (r / "screenshots").mkdir()
    (r / "screenshots" / "old.png").write_text("png")
    git(r, "init", "-q")
    git(r, "add", ".")
    git(r, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init")
    (r / "gone.txt").unlink()
    (r / "new.txt").write_text("untracked")
    (r / "ignored.txt").write_text("ignored")
    (r / "node_modules" / "pkg").mkdir(parents=True)
    (r / "node_modules" / "pkg" / "index.js").write_text("module.exports = 1")
    (r / "node_modules" / ".bin").mkdir()
    os.symlink("../pkg/index.js", r / "node_modules" / ".bin" / "pkg")
    return r


def test_leading_name_value_arguments_are_the_jobs_environment():
    assert bj.split_env(["STATIC=dist", "TABLE=1", "node", "X=1"]) == ({"STATIC": "dist", "TABLE": "1"}, ["node", "X=1"])
    assert bj.split_env(["node"]) == ({}, ["node"])


@pytest.mark.parametrize("value", ["/tmp/dist", "C:\\dist", "http://127.0.0.1:5287", "http://localhost:5173/x"])
def test_a_value_that_means_nothing_on_the_vm_is_refused(value):
    with pytest.raises(ValueError, match="nothing on the game VM"):
        bj.check_env({"STATIC": value})
    bj.check_env({"STATIC": "dist", "OUT": "screenshots/perf-ui", "ONLY": "mine-rest|mine-day"})


def test_the_working_files_leave_out_ignored_deleted_and_screenshots(repo):
    assert sorted(bj.working_files(repo)) == [".gitignore", "new.txt", "src/a.ts", "tools/_proc.py", "tools/browser_job.py"]


def test_the_stage_hard_links_the_worktree_and_ships_what_is_asked(repo, tmp_path):
    d = repo / bj.STAGE / "s"
    bj.stage(repo, d, ["screenshots/old.png"], False)
    assert os.stat(d / "in" / "src" / "a.ts").st_ino == os.stat(repo / "src" / "a.ts").st_ino
    assert (d / "in" / "screenshots" / "old.png").read_text() == "png"
    assert not (d / "in" / "node_modules").exists()  # it goes as gamejob.py --deps
    assert not (d / "in" / "ignored.txt").exists() and not (d / "in" / "gone.txt").exists()
    for bad in ("../outside", "nope.txt", "."):
        with pytest.raises(ValueError, match="--ship"):
            bj.stage(repo, repo / bj.STAGE / bad.replace("/", "_"), [bad], False)


def test_the_vm_side_reports_what_the_job_wrote_and_deleted(tmp_path, monkeypatch, capsys):
    job, out = tmp_path / "job", tmp_path / "out"
    (job / "node_modules").mkdir(parents=True)
    (job / "keep.txt").write_text("same")
    (job / "edit.txt").write_text("before")
    (job / "drop.txt").write_text("x")
    out.mkdir()
    script = ("import os,pathlib; pathlib.Path('edit.txt').write_text('after ' + os.environ['MODE']); "
              "pathlib.Path('drop.txt').unlink(); pathlib.Path('screenshots/a').mkdir(parents=True); "
              "pathlib.Path('screenshots/a/s.png').write_text('png'); pathlib.Path('node_modules/cache').write_text('c'); "
              "raise SystemExit(3)")
    monkeypatch.chdir(job)
    monkeypatch.setenv("GAMEJOB_OUT", str(out))
    monkeypatch.setenv("GAMEJOB_PORT", "41200")
    assert bj.exec_job(["MODE=vm", sys.executable, "-c", script]) == 3
    assert "on the game VM from port 41200, exit 3" in capsys.readouterr().out
    tree = sorted(str(p.relative_to(out / "tree")) for p in (out / "tree").rglob("*") if p.is_file())
    assert tree == ["edit.txt", "screenshots/a/s.png"]
    assert (out / "tree" / "edit.txt").read_text() == "after vm"
    assert (out / "deleted.txt").read_text() == "drop.txt\n"


def test_the_jobs_writes_and_deletions_are_made_in_the_worktree(tmp_path):
    root, out = tmp_path / "wt", tmp_path / "out"
    (root / "a").mkdir(parents=True)
    (root / "a" / "old.txt").write_text("old")
    (out / "tree" / "b").mkdir(parents=True)
    (out / "tree" / "b" / "new.txt").write_text("new")
    (out / "deleted.txt").write_text("a/old.txt\n")
    assert bj.apply_back(out, root) == 2
    assert (root / "b" / "new.txt").read_text() == "new" and not (root / "a" / "old.txt").exists()


# gamejob.py as the job runner does it: a node_modules in --in refused, --in copied to a VM-side dir with the --deps tree's
# node_modules linked in, argv run there with GAMEJOB_OUT, out/ copied to --out
FAKE_GAMEJOB = """
import os, shutil, subprocess, sys, tempfile
a = sys.argv[1:]
src, dst, deps = a[a.index('--in') + 1], a[a.index('--out') + 1], a[a.index('--deps') + 1]
argv = a[a.index('--') + 1:]
opts = a[:a.index('--')]
print('options', *[x for x in opts if x.startswith('--')], 'timeout', opts[opts.index('--timeout') + 1], file=sys.stderr)
if os.path.exists(os.path.join(src, 'node_modules')):
    sys.exit('node_modules shipped: name its tree with --deps instead')
vm = tempfile.mkdtemp()
shutil.copytree(src, vm + '/in', symlinks=True)
os.symlink(os.path.join(opts[opts.index('--deps') + 1], 'node_modules'), vm + '/in/node_modules')
os.makedirs(vm + '/out')
code = subprocess.run(argv, cwd=vm + '/in', env={**os.environ, 'GAMEJOB_OUT': vm + '/out', 'GAMEJOB_PORT': '41200', 'GAMEJOB_PORTS': '100'}).returncode
shutil.copytree(vm + '/out', dst, symlinks=True, dirs_exist_ok=True)
shutil.rmtree(vm)
sys.exit(code)
"""


@pytest.fixture
def relay(tmp_path, monkeypatch):
    """The fake job runner."""
    (tmp_path / "gamejob.py").write_text(FAKE_GAMEJOB)
    monkeypatch.setattr(bj, "GAMEJOB", tmp_path / "gamejob.py")
    monkeypatch.setattr(bj, "LEDGER", tmp_path / "jobs.jsonl")


def test_a_job_round_trip_runs_in_a_copy_and_lands_its_outputs_here(repo, relay, capfd):
    script =("import os,pathlib; assert not pathlib.Path('ignored.txt').exists(); "
              "pathlib.Path('screenshots/r').mkdir(parents=True); pathlib.Path('screenshots/r/x.txt').write_text(os.environ['K']); "
              "pathlib.Path('src/a.ts').unlink()")
    assert bj.run_browser_job(["K=v", sys.executable, "-c", script], root=repo) == 0
    assert (repo / "screenshots" / "r" / "x.txt").read_text() == "v"
    assert not (repo / "src" / "a.ts").exists()
    assert not any((repo / bj.STAGE).iterdir())
    err = capfd.readouterr().err
    assert "[browser job] staged " in err and " round trip " in err and "2 files back, exit 0: K=v " in err
    assert "options --in --out --deps --timeout timeout 7200\n" in err
    end = json.loads(bj.LEDGER.read_text().splitlines()[-1])
    assert end["ev"] == "end" and end["exit"] == 0 and 0 <= end["run_ms"] <= end["trip_ms"] and end["staged_ms"] >= 0


def test_the_vm_admits_by_load_alone_so_every_job_has_the_one_hang_cap_no_exclusive_run_and_no_budget(repo, relay, capfd):
    """contract.md, the game VM: no queue, slot, budget or exclusive job; one hang cap, HANG_CAP_S, for all."""
    for args in (["TABLE=1", "true", "e2e/perf-ui.cjs"], ["true", "tools/shot-driver.cjs"], ["true"]):
        assert bj.run_browser_job(args, root=repo) == 0
    assert capfd.readouterr().err.count("options --in --out --deps --timeout timeout 7200\n") == 3
    assert not [k for k in vars(bj) if re.search(r"budget|exclusive", k, re.I)]
    with pytest.raises(SystemExit):
        bj.main(["--timeout", "5", "node", "x.cjs"])
    with pytest.raises(SystemExit):
        bj.main(["--exclusive", "node", "x.cjs"])


def test_a_build_is_reused_while_its_inputs_are_unchanged(repo, monkeypatch):
    builds = []
    spawn = bj.spawn_group

    def fake_vite(argv, **kw):
        out = Path(argv[argv.index("--outDir") + 1])
        out.mkdir(parents=True)
        (out / "index.html").write_text((repo / "src" / "a.ts").read_text())
        builds.append(out)
        return spawn(["true"])

    monkeypatch.setattr(bj, "spawn_group", fake_vite)
    index = (repo / ".git" / "index").read_bytes()
    k0 = bj.dist_key(repo)
    first = bj.built_dist(repo)
    (repo / "screenshots" / "new.png").write_text("a shot")
    (repo / "ignored.txt").write_text("changed")
    assert bj.dist_key(repo) == k0 and bj.built_dist(repo) == first and len(builds) == 1   # nothing a build reads changed
    for f in ("docs/queue.md", "e2e/perf.cjs", "tests/a.test.ts", "README.md", "tools/x.py"):
        (repo / f).parent.mkdir(exist_ok=True)
        (repo / f).write_text("not built from")
    git(repo, "add", ".")   # a staged or committed change to them is none either
    assert bj.dist_key(repo) == k0
    index = (repo / ".git" / "index").read_bytes()
    (repo / "src" / "a.ts").write_text("b")
    second = bj.built_dist(repo)
    assert second != first and len(builds) == 2 and (second / "index.html").read_text() == "b"
    assert sorted(p.name for p in second.parent.iterdir()) == [second.name]   # the old build is gone
    assert (repo / ".git" / "index").read_bytes() == index   # the worktree's own index is untouched


def test_the_build_key_of_a_game_folder_in_a_bigger_repo_ignores_the_repos_other_files(tmp_path):
    top = tmp_path / "top"
    game = top / "app" / "game"
    (game / "src").mkdir(parents=True)
    (game / ".gitignore").write_text("/.gamejob/\n")
    (game / "src" / "a.ts").write_text("a")
    (top / "server.go").write_text("x")
    git(top, "init", "-q")
    git(top, "add", ".")
    git(top, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init")
    k0 = bj.dist_key(game)
    (top / "server.go").write_text("changed")
    git(top, "add", ".")
    assert bj.dist_key(game) == k0
    (game / "src" / "a.ts").write_text("b")
    assert bj.dist_key(game) != k0


def job_port(offset: str, env: dict[str, str]) -> subprocess.CompletedProcess:
    code = f"console.log(require('./e2e/lib/browser.cjs').jobPort({offset}))"
    base = {k: v for k, v in os.environ.items() if not k.startswith("GAMEJOB_")}
    return subprocess.run(["node", "-e", code], cwd=TOOLS.parent, env={**base, **env}, capture_output=True, text=True)


def test_every_job_port_is_the_jobs_base_plus_an_offset_under_its_count():
    job = {"GAMEJOB_PORT": "41200", "GAMEJOB_PORTS": "100"}
    assert job_port("", job).stdout.strip() == "41200"
    assert job_port("99", job).stdout.strip() == "41299"
    for bad in ("100", "-1", "1.5"):
        assert job_port(bad, job).returncode != 0


def test_a_server_outside_a_job_is_refused():
    assert "runs only in a game VM job" in job_port("", {}).stderr
    assert job_port("", {"GAMEJOB_PORT": "41200"}).returncode != 0


def test_a_launch_outside_a_job_is_refused():
    lib = (TOOLS.parent / "e2e" / "lib" / "browser.cjs").read_text()
    assert "if (!process.env.GAMEJOB_OUT) throw" in lib and "--use-angle=vulkan" in lib
    launches = [p for p in (TOOLS.parent / "e2e").rglob("*.cjs") if "chromium.launch(" in p.read_text()]
    launches += [p for p in (TOOLS.parent / "scripts").rglob("*.cjs") if "chromium.launch(" in p.read_text()]
    assert [p.name for p in launches] == ["browser.cjs"]
