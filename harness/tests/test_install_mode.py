"""test_install_mode.py — global vs project install wiring.

A global install points every project's hook commands at the ONE shared binary
($HARNESS_BIN_ROOT) instead of the per-project $CLAUDE_PROJECT_DIR/harness tree,
and emits the machine-specific root env into settings.local.json (never the
committed settings.json — the bin path is per-machine). Project mode is unchanged
(back-compat). An existing per-project harness/ tree refuses a --global install
(uninstall-first, no auto-migrate).
"""
import json
import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_INSTALL_DIR = _REPO_ROOT / "harness" / "install"
if str(_INSTALL_DIR) not in sys.path:
    sys.path.insert(0, str(_INSTALL_DIR))

import install as installer  # noqa: E402
import _wire_env  # noqa: E402
import _harden_bin  # noqa: E402

# registration raw: $HARNESS_ROOT is BARE (to_command adds the quoting) — mirrors
# hooks-registration.yaml, never pre-quoted.
_RAW = '"$HARNESS_PY" $HARNESS_ROOT/harness/hooks/x.py'


class TestToCommandMode:
    def test_global_mode_points_at_bin_root(self):
        out = installer.to_command(_RAW, py="python3", mode="global")
        assert '"$HARNESS_BIN_ROOT"/harness/hooks/x.py' in out
        assert "$CLAUDE_PROJECT_DIR" not in out

    def test_project_mode_unchanged(self):
        out = installer.to_command(_RAW, py="python3", mode="project")
        assert '"$CLAUDE_PROJECT_DIR"/harness/hooks/x.py' in out
        assert "$HARNESS_BIN_ROOT" not in out

    def test_default_mode_is_project_backcompat(self):
        assert installer.to_command(_RAW, py="python3") == \
            installer.to_command(_RAW, py="python3", mode="project")


class TestWireEnv:
    def _settings_local(self, target):
        return json.loads((target / ".claude" / "settings.local.json")
                          .read_text(encoding="utf-8"))

    def test_emits_both_roots_to_settings_local(self, tmp_path):
        _wire_env.wire_env(tmp_path, bin_root="/opt/harness",
                           data_root="/proj/.harness", dry_run=False)
        env = self._settings_local(tmp_path).get("env", {})
        assert env["HARNESS_BIN_ROOT"] == "/opt/harness"
        assert env["HARNESS_DATA_ROOT"] == "/proj/.harness"
        # never the committed settings.json
        assert not (tmp_path / ".claude" / "settings.json").exists()

    def test_data_root_optional(self, tmp_path):
        _wire_env.wire_env(tmp_path, bin_root="/opt/harness",
                           data_root=None, dry_run=False)
        env = self._settings_local(tmp_path).get("env", {})
        assert env["HARNESS_BIN_ROOT"] == "/opt/harness"
        assert "HARNESS_DATA_ROOT" not in env  # omitted → data_root() derives it

    def test_idempotent(self, tmp_path):
        _wire_env.wire_env(tmp_path, bin_root="/opt/harness", data_root=None)
        _wire_env.wire_env(tmp_path, bin_root="/opt/harness", data_root=None)
        assert self._settings_local(tmp_path)["env"]["HARNESS_BIN_ROOT"] == "/opt/harness"

    def test_preserves_existing_local_env(self, tmp_path):
        d = tmp_path / ".claude"; d.mkdir()
        (d / "settings.local.json").write_text(
            json.dumps({"env": {"HARNESS_OUTPUT": "vi"}}), encoding="utf-8")
        _wire_env.wire_env(tmp_path, bin_root="/opt/harness", data_root=None)
        env = self._settings_local(tmp_path)["env"]
        assert env["HARNESS_OUTPUT"] == "vi"  # untouched
        assert env["HARNESS_BIN_ROOT"] == "/opt/harness"


class TestHardenBin:
    def test_harden_makes_bin_readonly(self, tmp_path):
        import os
        binf = tmp_path / "harness" / "hooks"
        binf.mkdir(parents=True)
        f = binf / "x.py"; f.write_text("x", encoding="utf-8")
        _harden_bin.harden_bin(tmp_path, dry_run=False)
        mode = (os.stat(f).st_mode & 0o222)
        assert mode == 0, "expected no write bits after harden"

    def test_dry_run_changes_nothing(self, tmp_path):
        import os
        f = tmp_path / "harness" / "x.py"
        f.parent.mkdir(parents=True); f.write_text("x", encoding="utf-8")
        before = os.stat(f).st_mode
        _harden_bin.harden_bin(tmp_path, dry_run=True)
        assert os.stat(f).st_mode == before


class TestModeSelection:
    def test_no_flag_non_interactive_defaults_project_with_warning(self, tmp_path, capsys):
        # neither --global nor --project + non-interactive → keep the historical
        # PROJECT default (back-compat automation) but WARN loudly (not a fully
        # silent choice). A TTY run prompts instead (not exercised here).
        rc = installer.main([
            "--target", str(tmp_path / "proj"),
            "--source", str(_REPO_ROOT), "--dry-run", "--non-interactive"])
        assert rc == 0
        assert "no install mode flag" in capsys.readouterr().err.lower()

    def test_global_project_mutually_exclusive(self, tmp_path):
        rc = installer.main([
            "--target", str(tmp_path / "proj"), "--source", str(_REPO_ROOT),
            "--dry-run", "--non-interactive", "--global", "--project"])
        assert rc == 2


class TestRefuseExistingTree:
    def test_global_refuses_existing_per_project_harness(self, tmp_path):
        # a target that already carries a per-project harness/ tree must NOT be
        # global-installed over — refuse with an uninstall-first guide.
        target = tmp_path / "proj"
        (target / "harness" / "hooks").mkdir(parents=True)
        res = installer.install(_REPO_ROOT, target, mode="global", dry_run=True)
        assert not res["ok"]
        assert any("uninstall" in str(p).lower() for p in res["problems"])


class TestFinalVerify:
    """_final_verify must resolve integrity against the bin under global (the
    tree lives BIN-side, never at the project target) — else every real
    --global install reports a false "manifest missing" drift and --strict fails.
    """

    def test_global_verifies_bin_not_target(self, tmp_path):
        target = tmp_path / "proj"
        (target / ".claude").mkdir(parents=True)
        result = {"warnings": [], "problems": [], "ok": True}
        installer._final_verify(target, True, result,
                                mode="global", source_root=_REPO_ROOT)
        # the manifest lives bin-side; a global verify must NOT flag it missing
        # at the (deliberately tree-less) project target.
        assert not any("manifest missing" in str(p).lower()
                       for p in result["problems"])

    def test_project_mode_verifies_the_target_tree(self):
        # project mode resolves integrity at the target: the dogfood tree is
        # present, so it must NOT report a missing manifest (hash drift from
        # in-flight edits is legitimate and out of scope for this test).
        result = {"warnings": [], "problems": [], "ok": True}
        installer._final_verify(_REPO_ROOT, True, result,
                                mode="project", source_root=_REPO_ROOT)
        assert not any("manifest missing" in str(p).lower()
                       for p in result["problems"]), result["problems"]


class TestGlobalPrePush:
    """A global install must NOT leave a repo-local pre-push hook active. The
    hook loads push_gate from <repo>/harness/scripts, which a global install
    never places in the project ("no per-project tree copy") — so an installed
    harness hook would brick every push with ImportError. Global must skip
    installing it AND self-clean a stale harness hook left by a prior per-project
    install, while never touching a user's own foreign hook."""

    _HOOK_SRC = _REPO_ROOT / "harness" / "install" / "git-pre-push-hook.sh"

    def _global(self, target):
        return installer.install(_REPO_ROOT, target, mode="global", dry_run=False)

    def test_fresh_global_install_leaves_no_harness_prepush(self, tmp_path):
        target = tmp_path / "proj"
        (target / ".git" / "hooks").mkdir(parents=True)
        res = self._global(target)
        assert res["ok"], res["problems"]
        installed = target / ".git" / "hooks" / "pre-push"
        assert not installed.exists() or \
            installed.read_bytes() != self._HOOK_SRC.read_bytes()

    def test_global_install_self_cleans_stale_harness_prepush(self, tmp_path):
        target = tmp_path / "proj"
        (target / ".git" / "hooks").mkdir(parents=True)
        stale = target / ".git" / "hooks" / "pre-push"
        stale.write_bytes(self._HOOK_SRC.read_bytes())  # prior per-project hook
        res = self._global(target)
        assert res["ok"], res["problems"]
        # the stale harness hook bricks pushes under global — it must be gone
        assert not stale.exists() or \
            stale.read_bytes() != self._HOOK_SRC.read_bytes()

    def test_global_install_self_cleans_stale_OLDER_version_harness_prepush(self, tmp_path):
        # The real migration path: install per-project on harness vN, upgrade to
        # vN+1, then switch to global. The stale hook carries the harness
        # identity header but differs byte-for-byte from the current source (the
        # scrub body changed across versions). A hash-exact match would MISS it,
        # leaving a hook that still bricks pushes under global.
        target = tmp_path / "proj"
        (target / ".git" / "hooks").mkdir(parents=True)
        stale = target / ".git" / "hooks" / "pre-push"
        src = self._HOOK_SRC.read_text(encoding="utf-8")
        older = src.replace("for _v in $(env", "# (older-version body)\nfor _v in $(env")
        assert older != src, "the mutation must actually change the bytes"
        stale.write_text(older, encoding="utf-8")
        res = self._global(target)
        assert res["ok"], res["problems"]
        assert not stale.exists(), \
            "a stale OLDER-version harness hook must be cleaned (it bricks pushes)"

    def test_global_install_leaves_foreign_prepush_untouched(self, tmp_path):
        target = tmp_path / "proj"
        (target / ".git" / "hooks").mkdir(parents=True)
        foreign = target / ".git" / "hooks" / "pre-push"
        foreign.write_text("#!/bin/sh\necho not-ours\n")
        res = self._global(target)
        assert res["ok"], res["problems"]
        assert foreign.read_text() == "#!/bin/sh\necho not-ours\n"
