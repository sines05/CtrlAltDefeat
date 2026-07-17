#!/usr/bin/env python3
"""seed_rbac_roles.py — user-runnable opt-in that grants extra builder agents a
write lane in agent-permissions.yaml.

What this seeds
---------------
ui-ux-designer now ships with a DEFAULT write lane in agent-permissions.yaml, so it
is not bricked by `default_deny: true` out of the box (the script SKIPS any role
already present — re-running is a no-op for it). The script's remaining effect is to
record the skill-creator eval-template names (analyzer/comparator/grader, not
spawnable agents) for provenance. Run it only if you want those eval lanes recorded.

Why a script (not a Write/Edit edit)
------------------------------------
agent-permissions.yaml is write-guarded against the Write/Edit TOOLS so a subagent
cannot self-grant a lane. A script the USER runs writes the file through normal
file IO, which is the sanctioned path — the human, not an agent, opts in.

The key-format trap
-------------------
Role keys are BARE agent names; the runtime `agent_type` is invocation-path
dependent (a plugin-qualified spawn arrives `hs:ui-ux-designer`, a bare spawn
arrives `ui-ux-designer`). agent_permissions de-namespaces a prefixed role onto its
bare key, so seeding the BARE name makes BOTH spawn forms land in the seeded lane.
Seeding a prefixed key would add a presence entry that never matches the bare
runtime role — useless. So we key BARE, on purpose.
"""
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

import config_io  # noqa: E402

_DEFAULT_PATH = _HERE.parent / "data" / "agent-permissions.yaml"

# Builder agents seeded into the agent-permissions table, keyed by their BARE
# runtime name (the agent frontmatter `name:` for ui-ux-designer; the agent
# filename stem for the skill-creator eval trio). ui-ux-designer now ships WITH a
# default lane (on-by-default after the single-plugin collapse), so seed() skips it
# as a no-op; the rest record the skill-creator eval trio. All carry Write/Edit and
# write build/eval artifacts under the harness tree (harness/**).
BUILDER_AGENTS = ("ui-ux-designer", "analyzer", "comparator", "grader")

# The lane these builders get: the same harness/** builder lane the in-fleet
# `developer`/`code-simplifier` already hold. Multi-segment for containment.
BUILDER_LANE = ["harness/**"]

# Header kept verbatim if the target file ever lacks its own leading comment block.
_FALLBACK_HEADER = (
    "# agent-permissions.yaml — per-agent_type write-lane table for "
    "agent_rbac_guard.\n"
)


@dataclass
class SeedResult:
    """What a seed run changed. ``added`` lists the agents newly granted a lane;
    an empty list means the run was a no-op (idempotent re-run)."""

    added: List[str] = field(default_factory=list)
    path: Path = None


def seed(path=_DEFAULT_PATH) -> SeedResult:
    """Add the builder agents to the permission table at ``path`` and write it back.

    Idempotent: an agent already present (under any lane) is left untouched, so a
    second run reports nothing added and produces an identical table. Raises
    FileNotFoundError if the table is missing — the user must point at the real,
    already-installed file rather than have one conjured.
    """
    import yaml  # lazy: keep importable without PyYAML until a write actually runs

    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError("permission table not found: %s" % p)

    raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValueError("agent-permissions.yaml must be a mapping, got %r" % type(raw))

    roles = raw.get("roles")
    if roles is None:
        roles = {}
    if not isinstance(roles, dict):
        raise ValueError("agent-permissions.yaml 'roles' must be a mapping")

    added: List[str] = []
    for agent in BUILDER_AGENTS:
        if agent in roles:
            continue  # already opted in — leave the existing lane as the user set it
        roles[agent] = list(BUILDER_LANE)
        added.append(agent)

    result = SeedResult(added=added, path=p)
    if not added:
        return result  # nothing to do — don't rewrite the file on a clean re-run

    raw["roles"] = roles
    # Preserve deny-by-default explicitly: a builders-only table with no
    # default_deny still denies the unlisted, but spelling it out keeps the file
    # honest after a programmatic rewrite.
    raw.setdefault("default_deny", True)

    header = config_io.leading_comment_block(p, _FALLBACK_HEADER)
    body = yaml.safe_dump(raw, sort_keys=False, default_flow_style=False, allow_unicode=True)
    p.write_text(header + body, encoding="utf-8")
    return result


def main(argv=None) -> int:
    """CLI entry: seed the default (or a given) table and report what changed."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Grant off-by-default plugin builder agents an RBAC write lane "
        "in agent-permissions.yaml (user opt-in for ui-ux-designer + the "
        "skill-creator eval agents)."
    )
    parser.add_argument(
        "--path",
        default=str(_DEFAULT_PATH),
        help="path to agent-permissions.yaml (default: the installed table)",
    )
    args = parser.parse_args(argv)

    try:
        result = seed(args.path)
    except FileNotFoundError as e:
        print("error: %s" % e, file=sys.stderr)
        return 1

    if result.added:
        print("seeded builder agents into %s:" % result.path)
        for agent in result.added:
            print("  + %s -> %s" % (agent, BUILDER_LANE))
    else:
        print("no change: builder agents already have a lane in %s" % result.path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
