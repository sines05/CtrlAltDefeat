#!/usr/bin/env python3
"""check_permission.py — self-service write-lane check for an agent role.

An agent runs `python3 harness/scripts/check_permission.py --name <agent-name>` to
see its OWN effective write lanes, resolved LIVE from the RBAC table
(agent-permissions.yaml) plus any repo-local overlay — instead of hard-coding lane
globs into its body (which drift from the table). It prints the lanes and the rule:
write only within them; a write outside is BLOCKED by agent_rbac_guard, so STOP and
return the raw output. The permission table itself is caged — an agent cannot widen
its own lane; a wrong lane is a human decision.

Name resolution mirrors the guard: an exact key wins, else the de-namespaced bare
name (`hs:developer` -> `developer`). The path is HARNESS_AGENT_PERMISSIONS_FILE or
the shipped harness/data/agent-permissions.yaml; the overlay is merged from
HARNESS_AGENT_PERMISSIONS_OVERLAY (both read by agent_permissions.load_permissions).
"""
import argparse
import json as _json
import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
import agent_permissions as ap  # noqa: E402

_DATA = _HERE.parent / "data"


def _perm_path() -> Path:
    raw = os.environ.get("HARNESS_AGENT_PERMISSIONS_FILE")
    return Path(raw) if raw else (_DATA / "agent-permissions.yaml")


def _rbac_enabled() -> "bool | None":
    """Best-effort: is agent_rbac_guard actually running? None if undeterminable.
    A disabled guard means the lanes below are NOT enforced (a dev full-quyen repo)."""
    try:
        hooks_dir = _HERE.parent / "hooks"
        if str(hooks_dir) not in sys.path:
            sys.path.insert(0, str(hooks_dir))
        import hook_runtime
        return bool(hook_runtime.hook_enabled("agent_rbac_guard", "compliance"))
    except Exception:
        return None


def resolve(name: str, cfg=None):
    """Return (lanes, note, default_deny).

    lanes: list of globs, [] (mapped-nowhere / denied), or None (unrestricted).
    default_deny: the table's flag verbatim (None when the table is inert) — the
    caller decides an UNDECLARED role's fate from this FLAG, not from hard-coded
    prose, so a table that flips default_deny is honored without a code change."""
    if cfg is None:
        cfg = ap.load_permissions(_perm_path())
    if not cfg:
        return None, "RBAC table is inert (no roles declared) — no lane enforcement.", None
    dd = bool(cfg.get("default_deny", True))
    roles = cfg.get("roles") or {}
    lane = ap._resolve_lane(name, roles)
    if lane is not None:
        return lane, None, dd
    if name == ap.ROLE_PARENT or (":" in name and name.split(":", 1)[1] == ap.ROLE_PARENT):
        return None, "top-level agent (_parent) — unrestricted.", dd
    # UNDECLARED role: the flag decides, not a hard-coded policy.
    if dd:
        return [], ("role %r is not in the permission table; default_deny=true blocks ALL "
                    "writes — STOP, return raw output, ask the human to add a lane." % name), dd
    return None, ("role %r is undeclared and default_deny=false — writes allowed." % name), dd


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Show an agent role's effective write lanes (live from the RBAC table).")
    parser.add_argument("--name", required=True,
                        help="agent name, bare or plugin-qualified (developer or hs:developer)")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    lanes, note, default_deny = resolve(args.name)
    rbac_on = _rbac_enabled()

    if args.json:
        print(_json.dumps({"name": args.name, "lanes": lanes, "note": note,
                           "default_deny": default_deny, "rbac_enabled": rbac_on}))
        return 0

    print("Agent: %s" % args.name)
    if lanes is None:
        print("Write lanes: (unrestricted / not lane-enforced)")
    elif lanes == []:
        print("Write lanes: NONE")
    else:
        print("Write lanes (you may write ONLY within these globs):")
        for g in lanes:
            print("  - %s" % g)
    if note:
        print("Note: %s" % note)
    if rbac_on is False:
        print("Status: agent_rbac_guard is currently DISABLED — lanes above are NOT "
              "enforced this session (a dev full-quyen repo).")
    print("Rule: a write OUTSIDE your lanes is BLOCKED by agent_rbac_guard — STOP and "
          "return the raw output instead of writing out-of-lane. You cannot edit the "
          "permission table to widen your own lane (it is caged); a wrong lane is a "
          "human decision.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
