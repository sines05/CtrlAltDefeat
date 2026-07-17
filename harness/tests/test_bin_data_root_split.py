"""test_bin_data_root_split.py — the bin/data root split contract.

A global install serves ONE shared binary (bin_root) to many projects, each with
its own private data home (data_root = <project>/.harness). This suite pins the
resolution precedence, the self-hosted collapse (bin==project), the two-project
state isolation, and the fail-closed marker that a broken global layout must NOT
decay past (never silent CWD).

Seams are env vars only (no monkeypatch of module internals) — the resolvers read
HARNESS_BIN_ROOT / HARNESS_ROOT / HARNESS_DATA_ROOT / CLAUDE_PROJECT_DIR /
HARNESS_STATE_DIR. Every test scrubs the ambient env first so the dogfood
session's own values never leak in.
"""
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import harness_paths  # noqa: E402

_ROOT_ENVS = ("HARNESS_BIN_ROOT", "HARNESS_ROOT", "HARNESS_DATA_ROOT",
              "CLAUDE_PROJECT_DIR", "HARNESS_STATE_DIR")


def _scrub(monkeypatch):
    for e in _ROOT_ENVS:
        monkeypatch.delenv(e, raising=False)


class TestBinRoot:
    def test_bin_root_from_env(self, monkeypatch, tmp_path):
        _scrub(monkeypatch)
        monkeypatch.setenv("HARNESS_BIN_ROOT", str(tmp_path))
        assert harness_paths.bin_root() == tmp_path.resolve()

    def test_bin_root_legacy_harness_root_alias(self, monkeypatch, tmp_path):
        # HARNESS_ROOT is kept as a bin_root() alias for the old test/e2e seams.
        _scrub(monkeypatch)
        monkeypatch.setenv("HARNESS_ROOT", str(tmp_path))
        assert harness_paths.bin_root() == tmp_path.resolve()

    def test_bin_root_env_beats_legacy(self, monkeypatch, tmp_path):
        _scrub(monkeypatch)
        monkeypatch.setenv("HARNESS_BIN_ROOT", str(tmp_path / "bin"))
        monkeypatch.setenv("HARNESS_ROOT", str(tmp_path / "legacy"))
        assert harness_paths.bin_root() == (tmp_path / "bin").resolve()


class TestDataRoot:
    def test_data_root_from_claude_project_dir(self, monkeypatch, tmp_path):
        _scrub(monkeypatch)
        proj = tmp_path / "proj"
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(proj))
        assert harness_paths.data_root() == proj.resolve() / ".harness"

    def test_data_root_env_wins(self, monkeypatch, tmp_path):
        _scrub(monkeypatch)
        d = tmp_path / "d"  # nested — a real parent, not the fs root (see F7 test)
        monkeypatch.setenv("HARNESS_DATA_ROOT", str(d))
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(tmp_path / "proj"))
        assert harness_paths.data_root() == d.resolve()

    def test_state_dir_under_data_root(self, monkeypatch, tmp_path):
        _scrub(monkeypatch)
        proj = tmp_path / "proj"
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(proj))
        assert harness_paths.state_dir() == proj.resolve() / ".harness" / "state"

    def test_two_projects_distinct_state(self, monkeypatch, tmp_path):
        # The race the brief names: two projects must never share a state dir.
        _scrub(monkeypatch)
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(tmp_path / "A"))
        a = harness_paths.state_dir()
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(tmp_path / "B"))
        b = harness_paths.state_dir()
        assert a != b
        assert a == (tmp_path / "A").resolve() / ".harness" / "state"
        assert b == (tmp_path / "B").resolve() / ".harness" / "state"


class TestSelfHostAndFailClosed:
    def test_self_hosted_collapse(self, monkeypatch, tmp_path):
        # Self-host is detected by HARNESS_BIN_ROOT UNSET (NOT by a .git walk-up).
        # With no project env, data_root collapses under the bin (dogfood).
        _scrub(monkeypatch)
        monkeypatch.setenv("HARNESS_ROOT", str(tmp_path))  # bin alias, BIN_ROOT unset
        assert harness_paths.data_root() == tmp_path.resolve() / ".harness"
        assert not harness_paths.data_root_unresolved(harness_paths.data_root())

    def test_data_root_failclosed_global_bin_git_present(self, monkeypatch, tmp_path):
        # F2 / the C4-defeats-C5 trap: a global bin is itself a git checkout.
        # HARNESS_BIN_ROOT SET + no project env → fail-closed marker, NEVER a
        # self-host collapse that would unlock the shared bin.
        _scrub(monkeypatch)
        binr = tmp_path / "bin"
        (binr / ".git").mkdir(parents=True)
        (binr / "harness" / "hooks").mkdir(parents=True)
        monkeypatch.setenv("HARNESS_BIN_ROOT", str(binr))
        assert harness_paths.data_root_unresolved(harness_paths.data_root())

    def test_data_root_failclosed_when_unresolved(self, monkeypatch, tmp_path):
        # Global layout, no project env, no marker → fail-closed marker, NOT CWD.
        _scrub(monkeypatch)
        monkeypatch.setenv("HARNESS_BIN_ROOT", str(tmp_path / "bin"))
        monkeypatch.chdir(tmp_path)
        dr = harness_paths.data_root()
        assert harness_paths.data_root_unresolved(dr)
        assert dr != tmp_path.resolve() / ".harness"  # never decayed to CWD

    def test_data_root_parent_root_rejected(self, monkeypatch, tmp_path):
        # F7: a data root whose parent is "/" (e.g. HARNESS_DATA_ROOT=/data) is
        # not a real project — treat as unresolved.
        _scrub(monkeypatch)
        monkeypatch.setenv("HARNESS_DATA_ROOT", "/data")
        assert harness_paths.data_root_unresolved(harness_paths.data_root())


class TestInstallMetadata:
    def test_install_metadata_stays_bin_side(self, monkeypatch, tmp_path):
        # install-omitted-skills.json describes the BINARY, not a project — under
        # a global layout it resolves under bin_state_dir(), never per-project
        # .harness/state.
        _scrub(monkeypatch)
        binr = tmp_path / "bin"
        (binr / "harness" / "hooks").mkdir(parents=True)
        monkeypatch.setenv("HARNESS_BIN_ROOT", str(binr))
        monkeypatch.setenv("CLAUDE_PROJECT_DIR", str(tmp_path / "proj"))
        bsd = harness_paths.bin_state_dir()
        assert bsd == binr.resolve() / "harness" / "state"

        import omit_record
        rec = omit_record.record_path(harness_paths.bin_root())
        assert bsd in rec.parents
        # the project data root exists and is distinct — metadata never lands there
        assert harness_paths.data_root() == (tmp_path / "proj").resolve() / ".harness"
        assert harness_paths.data_root() not in rec.parents
