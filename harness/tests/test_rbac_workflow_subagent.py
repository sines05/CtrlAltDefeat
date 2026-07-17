"""RBAC lane for the Workflow-tool subagent (`agent_type="workflow-subagent"`).

The Workflow tool's `agent()` spawns a built-in subagent whose runtime
`agent_type` is `workflow-subagent`. Under `default_deny: true` an undeclared
role may write nothing, so before P5 every such write was blocked ("no declared
write lane" — the gap fired live in the trace). P5 ships a CONSERVATIVE lane
(`plans/**` — reports/artifacts only, like the other advisory agents); the
code-fix lane (`harness/**`, `src/**`, …) is granted per-repo via the
`HARNESS_AGENT_PERMISSIONS_OVERLAY`, never ship-wide (a broad ship-table lane
would ride a tarball into a repo that never opted in).

Two tiers here:
- unit tests inject their own table and drive `agent_rbac_guard.core()` — they
  pin the lane LOGIC (in-lane allow, out-of-lane block, the clause-1 isolation
  floor that fires BEFORE the lane, and the overlay widen-only path);
- one shipped-table contract test reads the real `agent-permissions.yaml` and
  pins that the conservative `plans/**` lane is declared (the red->green driver).
"""
import importlib.util
import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
_HOOKS = _ROOT / "hooks" if (_ROOT / "hooks").exists() else _ROOT / "harness" / "hooks"
_SCRIPTS = _ROOT / "harness" / "scripts"
for _p in (_HOOKS, _SCRIPTS):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import hook_runtime  # noqa: E402

HOOK_PATH = _HOOKS / "agent_rbac_guard.py"
SHIPPED_PERMS = _ROOT / "harness" / "data" / "agent-permissions.yaml"


def _hr():
    import hook_runtime as hr  # noqa: E402
    return sys.modules.get("hook_runtime", hr)


def _load_guard():
    spec = importlib.util.spec_from_file_location("agent_rbac_guard", HOOK_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch):
    state = tmp_path / "state"
    logs = tmp_path / "logs"
    for d in (state, logs):
        d.mkdir(parents=True, exist_ok=True)
    cfg = tmp_path / "harness-hooks.yaml"
    cfg.write_text("hooks:\n  agent_rbac_guard:\n    enabled: true\n", encoding="utf-8")
    perm = tmp_path / "agent-permissions.yaml"
    monkeypatch.setenv("HARNESS_STATE_DIR", str(state))
    monkeypatch.setenv("HARNESS_HOOK_LOG_DIR", str(logs))
    monkeypatch.setenv("HARNESS_HOOK_CONFIG", str(cfg))
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_FILE", str(perm))
    monkeypatch.setenv("HARNESS_USER", "tester")
    monkeypatch.delenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", raising=False)
    _hr()._reset_config_cache()
    yield {"perm": perm, "root": tmp_path}
    _hr()._reset_config_cache()


def _perm(env, body):
    env["perm"].write_text(body, encoding="utf-8")


def _payload(env, *, agent_type="workflow-subagent", rel="harness/x.py", file_path=None):
    target = file_path if file_path is not None else str(env["root"] / rel)
    return {"session_id": "s1", "cwd": str(env["root"]),
            "hook_event_name": "PreToolUse", "tool_name": "Write",
            "tool_input": {"file_path": target}, "agent_type": agent_type}


# --- lane logic ---------------------------------------------------------------

def test_workflow_subagent_in_lane_allows(_env):
    _perm(_env, "default_deny: true\nroles:\n  workflow-subagent: ['plans/**']\n")
    mod = _load_guard()
    assert mod.core(_payload(_env, rel="plans/reports/r.md")) is None


def test_workflow_subagent_out_of_lane_blocks(_env):
    _perm(_env, "default_deny: true\nroles:\n  workflow-subagent: ['plans/**']\n")
    mod = _load_guard()
    reason = mod.core(_payload(_env, rel="harness/scripts/x.py"))
    assert reason and "outside" in reason.lower()


def test_workflow_subagent_undeclared_denied_by_default(_env):
    # The gap: with no workflow-subagent key under default_deny, every write blocks.
    _perm(_env, "default_deny: true\nroles:\n  developer: ['harness/**']\n")
    mod = _load_guard()
    reason = mod.core(_payload(_env, rel="plans/reports/r.md"))
    assert reason and "no declared write lane" in reason.lower()


def test_workflow_subagent_namespaced_resolves_to_bare(_env):
    # A plugin-qualified runtime role must de-namespace onto the bare key.
    _perm(_env, "default_deny: true\nroles:\n  workflow-subagent: ['plans/**']\n")
    mod = _load_guard()
    assert mod.core(_payload(_env, agent_type="hs:workflow-subagent",
                             rel="plans/x.md")) is None


def test_clause1_isolation_fires_before_lane(_env):
    # RT-C: even the broadest lane ('**') cannot rescue a write that escapes the
    # worktree/cwd root — the isolation floor (clause 1) blocks first. Target is an
    # absolute path OUTSIDE the payload cwd.
    _perm(_env, "default_deny: true\nroles:\n  workflow-subagent: ['**']\n")
    mod = _load_guard()
    outside = str(_env["root"].parent / "escape.py")
    reason = mod.core(_payload(_env, file_path=outside))
    assert reason and "isolation" in reason.lower()


def test_overlay_widens_lane_only(_env, tmp_path, monkeypatch):
    # The code-fix lane is granted per-repo via the overlay (add-only union), never
    # ship-wide. Base ships plans/**; overlay adds harness/** -> a harness write passes.
    _perm(_env, "default_deny: true\nroles:\n  workflow-subagent: ['plans/**']\n")
    overlay = tmp_path / "overlay.yaml"
    overlay.write_text("roles:\n  workflow-subagent: ['harness/**']\n", encoding="utf-8")
    monkeypatch.setenv("HARNESS_AGENT_PERMISSIONS_OVERLAY", str(overlay))
    _hr()._reset_config_cache()
    mod = _load_guard()
    # both the base lane and the overlay-added lane now pass
    assert mod.core(_payload(_env, rel="plans/x.md")) is None
    assert mod.core(_payload(_env, rel="harness/scripts/x.py")) is None


# --- shipped-table contract (red->green driver) -------------------------------

def test_shipped_table_declares_conservative_plans_lane():
    import agent_permissions as ap
    cfg = ap._read_table(str(SHIPPED_PERMS))
    assert cfg is not None, "shipped agent-permissions.yaml must parse"
    roles = cfg.get("roles") or {}
    assert roles.get("workflow-subagent") == ["plans/**"], (
        "workflow-subagent must ship the conservative plans/** lane (code-fix lane "
        "is overlay-granted per-repo, never ship-wide)"
    )
    # and the lane behaves: plans/ allowed, harness/ blocked under the shipped table.
    assert ap.decide("workflow-subagent", "plans/reports/r.md", cfg) is None
    assert ap.decide("workflow-subagent", "harness/x.py", cfg) is not None
