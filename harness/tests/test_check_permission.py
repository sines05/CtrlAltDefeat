"""Tests for check_permission.py — the self-service agent write-lane reporter."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
import check_permission as cp  # noqa: E402


@pytest.fixture
def fixture_table(tmp_path, monkeypatch):
    t = tmp_path / "perms.yaml"
    t.write_text(
        "default_deny: true\nroles:\n"
        "  _parent: ['**']\n"
        "  developer: ['harness/**', 'plans/**']\n",
        encoding="utf-8")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_FILE", str(t))
    monkeypatch.delenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", raising=False)
    return t


def test_known_role_lanes(fixture_table):
    lanes, note, dd = cp.resolve("developer")
    assert lanes == ["harness/**", "plans/**"]
    assert note is None
    assert dd is True


def test_namespaced_role_de_namespaces(fixture_table):
    # a plugin-qualified spawn name lands in the bare-keyed lane
    lanes, _, _ = cp.resolve("hs:developer")
    assert lanes == ["harness/**", "plans/**"]


def test_unknown_role_reports_the_flag(fixture_table):
    # unknown-role fate is driven by the default_deny FLAG, surfaced in the result
    lanes, note, dd = cp.resolve("nobody-here")
    assert lanes == []
    assert dd is True
    assert "default_deny" in note


def test_unknown_role_allowed_when_flag_off(tmp_path, monkeypatch):
    t = tmp_path / "p.yaml"
    t.write_text("default_deny: false\nroles:\n  developer: ['plans/**']\n", encoding="utf-8")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_FILE", str(t))
    monkeypatch.delenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", raising=False)
    lanes, note, dd = cp.resolve("nobody-here")
    assert dd is False
    assert lanes is None  # not lane-confined when default_deny is off


def test_parent_unrestricted(fixture_table):
    lanes, _, _ = cp.resolve("_parent")
    assert lanes == ["**"]


def test_cli_prints_lane_and_rule(fixture_table):
    proc = subprocess.run(
        [sys.executable, str(_SCRIPTS / "check_permission.py"), "--name", "developer"],
        capture_output=True, text=True, env={**os.environ})
    assert proc.returncode == 0
    assert "harness/**" in proc.stdout
    assert "BLOCKED" in proc.stdout and "caged" in proc.stdout
