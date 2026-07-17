"""Tests for seed_rbac_roles — the user-runnable opt-in that adds off-by-default
plugin builder agents (ui-ux-designer, analyzer, comparator, grader) to a write
lane in agent-permissions.yaml.

Why this exists: those builders carry Write/Edit but ship ABSENT from the RBAC
roles table. Once their plugin is enabled and the gate is active, default_deny
bricks every write they attempt (systemic fail-toward-brick). This seed lets the
user opt them in.

The seed must survive the known key-format split: role keys may be hs:-prefixed
while agent_type arrives BARE on a subagent spawn. We key by the BARE name so the
de-namespace fallback in agent_permissions resolves both forms onto the seeded
lane — a presence entry that never matches at runtime would be useless.
"""
import sys
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import agent_permissions as ap  # noqa: E402
import seed_rbac_roles as srr  # noqa: E402


# A minimal active table mirroring the shipped shape (header + deny-by-default +
# the builder/advisory lanes) so the seed has a realistic file to mutate.
_BASE_YAML = """\
# agent-permissions.yaml — per-agent_type write-lane table.
# Header prose that must survive a seed rewrite.
default_deny: true
roles:
  _parent: ["**"]
  developer: ["harness/**"]
  code-reviewer: ["plans/**"]
"""


def _write_base(tmp_path):
    p = tmp_path / "agent-permissions.yaml"
    p.write_text(_BASE_YAML, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# the builder agents land in a real write lane
# ---------------------------------------------------------------------------

def test_seed_adds_builder_agents(tmp_path):
    p = _write_base(tmp_path)
    srr.seed(p)
    cfg = ap.load_permissions(p)
    for agent in srr.BUILDER_AGENTS:
        assert agent in cfg["roles"], "%s missing from seeded roles" % agent
        assert cfg["roles"][agent], "%s seeded with an empty lane" % agent


# ---------------------------------------------------------------------------
# the seeded entry actually takes effect at runtime — for BOTH the bare
# agent_type and the plugin-qualified one (de-namespace fallback).
# ---------------------------------------------------------------------------

def test_seeded_bare_agent_type_is_in_lane(tmp_path):
    p = _write_base(tmp_path)
    srr.seed(p)
    cfg = ap.load_permissions(p)
    # a bare agent_type ('ui-ux-designer') resolves to the seeded permission and
    # an in-lane write is allowed (decide returns None)
    assert ap.decide("ui-ux-designer", "harness/x.tsx", cfg) is None


def test_seeded_namespaced_agent_type_is_in_lane(tmp_path):
    p = _write_base(tmp_path)
    srr.seed(p)
    cfg = ap.load_permissions(p)
    # the plugin-qualified spawn form resolves to the same bare-keyed lane
    assert ap.decide("hs:ui-ux-designer", "harness/x.tsx", cfg) is None


def test_seeded_agents_were_denied_before(tmp_path):
    # baseline: without the seed these builders are default-denied (the bug)
    p = _write_base(tmp_path)
    cfg = ap.load_permissions(p)
    assert ap.decide("ui-ux-designer", "harness/x.tsx", cfg) is not None


# ---------------------------------------------------------------------------
# idempotent: running twice does not duplicate the lane
# ---------------------------------------------------------------------------

def test_seed_is_idempotent(tmp_path):
    p = _write_base(tmp_path)
    first = srr.seed(p)
    cfg1 = ap.load_permissions(p)
    second = srr.seed(p)
    cfg2 = ap.load_permissions(p)
    assert cfg1["roles"] == cfg2["roles"]
    # the second run reports it added nothing new
    assert first.added
    assert not second.added


# ---------------------------------------------------------------------------
# the seed leaves the rest of the table intact (header + existing lanes)
# ---------------------------------------------------------------------------

def test_seed_preserves_existing_lanes(tmp_path):
    p = _write_base(tmp_path)
    srr.seed(p)
    cfg = ap.load_permissions(p)
    assert cfg["roles"]["developer"] == ["harness/**"]
    assert cfg["roles"]["code-reviewer"] == ["plans/**"]
    assert cfg["roles"]["_parent"] == ["**"]
    assert cfg["default_deny"] is True


def test_seed_preserves_header_comment(tmp_path):
    p = _write_base(tmp_path)
    srr.seed(p)
    text = p.read_text(encoding="utf-8")
    assert "per-agent_type write-lane table" in text
    assert "must survive a seed rewrite" in text


# ---------------------------------------------------------------------------
# guard: a missing or inert table is reported, not silently mangled
# ---------------------------------------------------------------------------

def test_seed_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        srr.seed(tmp_path / "does-not-exist.yaml")
