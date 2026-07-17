"""Tests for agent_permissions — the pure decision logic behind agent_rbac_guard.

The detector answers: given a role (agent_type, or '_parent' for the top-level
agent), a write target, and a parsed permission table, is the write in-lane?

Additive-skip contract: an absent or roleless table
yields None (no decision) so a fresh install never bricks the fleet — the gate is
inert until an operator declares a permission table.
"""
import os
import sys
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import agent_permissions as ap  # noqa: E402

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# additive-skip: no table => no decision (inert by default)
# ---------------------------------------------------------------------------

def test_none_config_skips():
    assert ap.decide("general-purpose", "harness/x.py", None) is None


def test_empty_roles_skips():
    assert ap.decide("general-purpose", "harness/x.py", {"roles": {}}) is None


# ---------------------------------------------------------------------------
# in-lane / out-of-lane
# ---------------------------------------------------------------------------

def _cfg(**roles):
    d = {"roles": roles}
    return d


def test_in_lane_allowed():
    cfg = _cfg(**{"general-purpose": ["plans/**", "docs/**"]})
    assert ap.decide("general-purpose", "plans/p/notes.md", cfg) is None


def test_out_of_lane_blocked():
    cfg = _cfg(**{"general-purpose": ["plans/**"]})
    reason = ap.decide("general-purpose", "harness/hooks/x.py", cfg)
    assert reason and "outside" in reason.lower()
    assert "general-purpose" in reason


def test_basename_glob_matches():
    cfg = _cfg(**{"cook": ["*.md"]})
    assert ap.decide("cook", "deep/nested/readme.md", cfg) is None


# ---------------------------------------------------------------------------
# undeclared role: default_deny governs
# ---------------------------------------------------------------------------

def test_undeclared_role_default_deny_blocks():
    cfg = {"roles": {"cook": ["harness/**"]}, "default_deny": True}
    reason = ap.decide("scout", "harness/x.py", cfg)
    assert reason and "scout" in reason


def test_undeclared_role_default_allow_skips():
    cfg = {"roles": {"cook": ["harness/**"]}, "default_deny": False}
    assert ap.decide("scout", "harness/x.py", cfg) is None


def test_default_deny_defaults_true_when_absent():
    # a table that declares roles but omits default_deny denies undeclared roles
    cfg = {"roles": {"cook": ["harness/**"]}}
    assert ap.decide("scout", "harness/x.py", cfg) is not None


# ---------------------------------------------------------------------------
# parent role
# ---------------------------------------------------------------------------

def test_parent_unrestricted_when_undeclared():
    # the top-level agent (_parent) must never be blocked just because a table
    # exists for subagent roles — only an EXPLICIT _parent entry restricts it
    cfg = {"roles": {"cook": ["harness/**"]}, "default_deny": True}
    assert ap.decide(ap.ROLE_PARENT, "anything/at/all.txt", cfg) is None


def test_parent_restricted_when_explicitly_declared():
    cfg = {"roles": {"_parent": ["plans/**"]}, "default_deny": True}
    assert ap.decide(ap.ROLE_PARENT, "plans/ok.md", cfg) is None
    assert ap.decide(ap.ROLE_PARENT, "harness/x.py", cfg) is not None


# ---------------------------------------------------------------------------
# load_permissions
# ---------------------------------------------------------------------------

def test_load_absent_file_is_none(tmp_path):
    assert ap.load_permissions(tmp_path / "nope.yaml") is None


def test_load_empty_roles_is_none(tmp_path):
    p = tmp_path / "perm.yaml"
    p.write_text("roles: {}\n", encoding="utf-8")
    assert ap.load_permissions(p) is None


def test_load_valid_table(tmp_path):
    p = tmp_path / "perm.yaml"
    p.write_text("default_deny: true\nroles:\n  cook: ['harness/**']\n", encoding="utf-8")
    cfg = ap.load_permissions(p)
    assert cfg["roles"]["cook"] == ["harness/**"]
    assert cfg["default_deny"] is True


def test_load_malformed_raises(tmp_path):
    # present-but-broken table → fail-closed (raise), NOT silently inert
    p = tmp_path / "perm.yaml"
    p.write_text("roles: [not, a, mapping]\n", encoding="utf-8")
    import pytest
    with pytest.raises(ap.PermissionsConfigError):
        ap.load_permissions(p)


# ---------------------------------------------------------------------------
# shipped table — pins the ratified RBAC lanes (not the synthetic cfgs above).
# Guards against a typo'd glob / dropped _parent / accidental re-inerting of the
# real agent-permissions.yaml the gate enforces.
# ---------------------------------------------------------------------------

_SHIPPED = Path(__file__).resolve().parent.parent / "data" / "agent-permissions.yaml"


def _shipped_cfg():
    cfg = ap.load_permissions(_SHIPPED)
    assert cfg is not None, "shipped agent-permissions.yaml is inert (roles empty) — RBAC not enabled"
    return cfg


def test_shipped_table_is_active_and_deny_by_default():
    cfg = _shipped_cfg()
    assert cfg["default_deny"] is True


def test_shipped_parent_unrestricted():
    cfg = _shipped_cfg()
    assert ap.decide(ap.ROLE_PARENT, "harness/hooks/anything.py", cfg) is None


def test_shipped_reviewer_in_lane_allowed():
    cfg = _shipped_cfg()
    assert ap.decide("hs:code-reviewer", "plans/p/review-decision.json", cfg) is None


def test_shipped_reviewer_out_of_lane_blocked():
    # a read-only reviewer must not write into the product tree
    cfg = _shipped_cfg()
    assert ap.decide("hs:code-reviewer", "harness/hooks/x.py", cfg) is not None


def test_shipped_developer_in_lane_allowed():
    # Shipped in-lane = plans/** (artifacts). The project CODE lane (harness/** in
    # the harness's own repo) is NOT shipped — it comes from the repo-local overlay.
    cfg = _shipped_cfg()
    assert ap.decide("hs:developer", "plans/p/notes.md", cfg) is None


def test_shipped_developer_has_no_harness_lane():
    # Regression (DEC-231): the shipped table must NOT grant harness/** to a build
    # role — a downstream install must not let an agent rewrite the installed
    # harness binary. The code lane is granted per-repo via the overlay instead.
    cfg = _shipped_cfg()
    assert ap.decide("hs:developer", "harness/scripts/x.py", cfg) is not None


def test_overlay_grants_harness_lane_in_this_repo():
    # THIS repo's config/ overlay re-grants the harness/** code lane stripped from
    # ship, so the build agents can still edit the harness's own source here.
    repo = Path(__file__).resolve().parents[2]
    overlay = repo / "config" / "agent-permissions.overlay.yaml"
    if not overlay.is_file():
        pytest.skip("repo-local overlay absent")
    prev = os.environ.get("HARNESS_AGENT_PERMISSIONS_OVERLAY")
    os.environ["HARNESS_AGENT_PERMISSIONS_OVERLAY"] = str(overlay)
    try:
        cfg = ap.load_permissions(_SHIPPED)
        assert ap.decide("hs:developer", "harness/scripts/x.py", cfg) is None
    finally:
        if prev is None:
            os.environ.pop("HARNESS_AGENT_PERMISSIONS_OVERLAY", None)
        else:
            os.environ["HARNESS_AGENT_PERMISSIONS_OVERLAY"] = prev


def test_shipped_developer_out_of_lane_blocked():
    # developer also carries plans/** + .claude/agent-memory/** (every hs role does,
    # so a declared `memory: project` field actually persists) — docs/** stays the
    # out-of-lane probe for the product-code builder role.
    cfg = _shipped_cfg()
    assert ap.decide("hs:developer", "docs/notes.md", cfg) is not None


def test_shipped_git_manager_writes_nothing():
    cfg = _shipped_cfg()
    assert ap.decide("hs:git-manager", "harness/x.py", cfg) is not None


def test_shipped_unknown_role_denied():
    cfg = _shipped_cfg()
    assert ap.decide("some-unlisted-agent", "harness/x.py", cfg) is not None


# ---------------------------------------------------------------------------
# de-namespace fallback — the runtime agent_type is invocation-path-dependent:
# the plugin-qualified spawn arrives 'hs:developer', the bare /hs:team spawn
# arrives 'developer'. The table is keyed by the bare agent name; a namespaced
# role resolves to its bare key so BOTH spawn paths land in the same lane.
# ---------------------------------------------------------------------------

def test_namespaced_role_resolves_to_bare_key():
    cfg = {"roles": {"developer": ["harness/**"]}, "default_deny": True}
    assert ap.decide("hs:developer", "harness/scripts/x.py", cfg) is None
    assert ap.decide("developer", "harness/scripts/x.py", cfg) is None


def test_namespaced_role_out_of_lane_still_blocked():
    cfg = {"roles": {"developer": ["harness/**"]}, "default_deny": True}
    assert ap.decide("hs:developer", "plans/x.md", cfg) is not None


def test_exact_key_takes_precedence_over_bare_fallback():
    cfg = {"roles": {"hs:developer": ["plans/**"], "developer": ["harness/**"]},
           "default_deny": True}
    assert ap.decide("hs:developer", "plans/x.md", cfg) is None
    assert ap.decide("hs:developer", "harness/x.py", cfg) is not None


def test_is_mapped_resolves_both_forms():
    cfg = {"roles": {"developer": ["harness/**"], "git-manager": []},
           "default_deny": True}
    assert ap.is_mapped("developer", cfg) is True
    assert ap.is_mapped("hs:developer", cfg) is True       # via de-namespace fallback
    assert ap.is_mapped("git-manager", cfg) is True        # declared empty lane is mapped
    assert ap.is_mapped("ghost-agent", cfg) is False       # would be default-denied
    assert ap.is_mapped(ap.ROLE_PARENT, cfg) is True       # top-level always mapped


def test_shipped_table_covers_bare_team_spawn_names():
    # the /hs:team workflow spawns BARE subagent_type names — they must resolve to
    # the SAME lane as the hs:-qualified form. Post DEC-231 the shipped code lane is
    # plans/** (harness/** is repo-local via the overlay), so probe plans/**.
    cfg = _shipped_cfg()
    assert ap.decide("developer", "plans/p/x.md", cfg) is None
    assert ap.decide("tester", "plans/p/t.md", cfg) is None
    assert ap.decide("code-reviewer", "plans/p/review.json", cfg) is None
    assert ap.decide("researcher", "plans/p/r.md", cfg) is None
    # and the plugin-qualified form resolves to the same lane
    assert ap.decide("hs:developer", "plans/p/x.md", cfg) is None


def test_ui_ux_designer_has_default_lane():
    # ui-ux-designer ships in the always-on hs plugin post-collapse (on by default),
    # so the default RBAC table must grant it a write lane — otherwise default_deny
    # silently denies its tool-mediated edits. Post DEC-231 the shipped lane is
    # plans/** (its code/showcase lane is repo-local via the overlay).
    import yaml
    repo = Path(__file__).resolve().parents[2]
    cfg = yaml.safe_load((repo / "harness/data/agent-permissions.yaml").read_text())
    assert "ui-ux-designer" in cfg["roles"]
    assert ap.decide("ui-ux-designer", "plans/p/design.md", cfg) is None
    assert ap.decide("hs:ui-ux-designer", "plans/p/x.md", cfg) is None  # de-namespaced


# ---------------------------------------------------------------------------
# B — the lane-violation reason must be actionable: name the lane AND point at
# the two remedies (widen via overlay / delegate read-only) so a blocked spawn
# teaches the main agent what to do, instead of just "no".
# ---------------------------------------------------------------------------

def test_lane_block_reason_suggests_remedy():
    cfg = _cfg(**{"ui-ux-designer": ["harness/**"]})
    reason = ap.decide("ui-ux-designer", "showcase/index.html", cfg)
    assert reason
    assert "overlay" in reason.lower()
    assert "read-only" in reason.lower()
    assert "ui-ux-designer" in reason  # still names the role
    assert "harness/**" in reason      # still names the lane it DOES have


# ---------------------------------------------------------------------------
# DEC-98 — additive overlay merge. HARNESS_AGENT_PERMISSIONS_OVERLAY points at a
# repo-local table whose role globs are UNIONED into the base lanes (widen/add
# only, never revoke). It widens an ACTIVE base; it never arms an inert one.
# ---------------------------------------------------------------------------

def _write(p, text):
    p.write_text(text, encoding="utf-8")
    return p


def test_overlay_unions_globs_into_existing_lane(tmp_path, monkeypatch):
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  ui-ux-designer: ['harness/**']\n")
    overlay = _write(tmp_path / "overlay.yaml",
                     "roles:\n  ui-ux-designer: ['showcase/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    cfg = ap.load_permissions(base)
    assert ap.decide("ui-ux-designer", "harness/x.py", cfg) is None       # base lane kept
    assert ap.decide("ui-ux-designer", "showcase/index.html", cfg) is None  # overlay added


def test_overlay_adds_new_role(tmp_path, monkeypatch):
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  cook: ['harness/**']\n")
    overlay = _write(tmp_path / "overlay.yaml",
                     "roles:\n  newbie: ['sandbox/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    cfg = ap.load_permissions(base)
    assert ap.decide("newbie", "sandbox/a.txt", cfg) is None
    assert ap.decide("newbie", "harness/x.py", cfg) is not None  # only what overlay granted


def test_overlay_is_additive_never_revokes(tmp_path, monkeypatch):
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  dev: ['harness/**']\n")
    overlay = _write(tmp_path / "overlay.yaml",
                     "roles:\n  dev: ['showcase/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    cfg = ap.load_permissions(base)
    assert ap.decide("dev", "harness/x.py", cfg) is None      # base glob survives
    assert ap.decide("dev", "showcase/x.html", cfg) is None   # overlay glob added


def test_overlay_no_duplicate_globs(tmp_path, monkeypatch):
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  dev: ['harness/**']\n")
    overlay = _write(tmp_path / "overlay.yaml",
                     "roles:\n  dev: ['harness/**', 'showcase/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    cfg = ap.load_permissions(base)
    assert cfg["roles"]["dev"] == ["harness/**", "showcase/**"]  # no dup of harness/**


def test_no_overlay_env_is_base_only(tmp_path, monkeypatch):
    monkeypatch.delenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", raising=False)
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  dev: ['harness/**']\n")
    cfg = ap.load_permissions(base)
    assert ap.decide("dev", "showcase/x.html", cfg) is not None


def test_overlay_onto_inert_base_stays_inert(tmp_path, monkeypatch):
    # an overlay WIDENS an active table; it must never single-handedly arm a deny gate
    base = _write(tmp_path / "perm.yaml", "roles: {}\n")  # inert
    overlay = _write(tmp_path / "overlay.yaml", "roles:\n  dev: ['showcase/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    assert ap.load_permissions(base) is None


def test_overlay_missing_file_ignored(tmp_path, monkeypatch):
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  dev: ['harness/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(tmp_path / "nope.yaml"))
    cfg = ap.load_permissions(base)
    assert cfg["roles"]["dev"] == ["harness/**"]


def test_overlay_malformed_raises(tmp_path, monkeypatch):
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: true\nroles:\n  dev: ['harness/**']\n")
    overlay = _write(tmp_path / "overlay.yaml", "roles: [not, a, mapping]\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    import pytest
    with pytest.raises(ap.PermissionsConfigError):
        ap.load_permissions(base)


def test_overlay_default_deny_owned_by_base(tmp_path, monkeypatch):
    # overlay contributes ONLY roles/globs; default_deny stays whatever the base set
    base = _write(tmp_path / "perm.yaml",
                  "default_deny: false\nroles:\n  dev: ['harness/**']\n")
    overlay = _write(tmp_path / "overlay.yaml",
                     "default_deny: true\nroles:\n  dev: ['showcase/**']\n")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    cfg = ap.load_permissions(base)
    assert cfg["default_deny"] is False  # base wins; overlay's default_deny ignored


# ---------------------------------------------------------------------------
# repo-local overlay LIVES IN config/ (declutters root) — dev-repo fact.
# The overlay is tracked-but-not-shipped (outside harness/**), so this assertion
# only holds on the harness development tree, not on installed copies.
# ---------------------------------------------------------------------------

@pytest.mark.dev_repo  # asserts THIS repo's overlay location — absent on installs
def test_repo_overlay_lives_in_config_not_root():
    config_overlay = _REPO_ROOT / "config" / "agent-permissions.overlay.yaml"
    root_overlay = _REPO_ROOT / "agent-permissions.overlay.yaml"
    assert config_overlay.is_file(), "overlay must live at config/agent-permissions.overlay.yaml"
    assert not root_overlay.exists(), "overlay must no longer sit at repo root"


@pytest.mark.dev_repo  # loads THIS repo's committed overlay from config/ — absent on installs
def test_repo_overlay_in_config_grants_showcase_lane(monkeypatch):
    # the committed overlay (now under config/) still arms the showcase/** lane for
    # ui-ux-designer when the env points at it — proves the move kept the gate wired.
    base = _REPO_ROOT / "harness" / "data" / "agent-permissions.yaml"
    overlay = _REPO_ROOT / "config" / "agent-permissions.overlay.yaml"
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    cfg = ap.load_permissions(base)
    assert cfg is not None  # base table is active, overlay widens it
    assert ap.decide("ui-ux-designer", "showcase/index.html", cfg) is None  # in-lane via overlay
