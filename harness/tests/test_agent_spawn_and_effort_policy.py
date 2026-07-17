"""Agent frontmatter capability policy — spawn lanes, effort tiers, explicit writes.

Ratified in-session against the official CC subagent frontmatter contract
(code.claude.com/docs/en/subagents), after an empirical probe proved the scoped
`Task(Explore)` form is a NO-OP inside a subagent definition: CC ignores the
parenthesised type list, so a `Task(Explore)` agent can in fact spawn any subagent
type (verified: a read-only lens spawned a general-purpose child that wrote a file).

Consequences encoded here:
  * `Task(Explore)` is retired everywhere — the scoped form promised containment it
    never delivered; the real write enforcement is agent_rbac_guard, not the tool syntax.
  * Spawn (a bare `Task`/`Agent`) is granted to every agent EXCEPT four carve-outs:
      - gemini-relayer / workflow-orchestrator — contract says they never spawn;
      - red-teamer / independent-revalidator — epistemic independence: they must
        re-derive from PRIMARY evidence first-hand, never delegating the reading.
  * `effort` pins per-agent reasoning depth (overrides session, replace-semantics,
    model-capability clamped) — adversarial/gate-bearing high, mechanical low.
  * Report-writing lenses declare Write/Edit explicitly instead of smuggling them in
    through the `memory:` auto-grant.
"""
import re
from pathlib import Path

import yaml

_AGENTS = Path(__file__).resolve().parents[1] / "plugins" / "hs" / "agents"
_FM = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

# --- ratified decision tables -------------------------------------------------

EFFORT = {
    "red-teamer": "xhigh", "independent-revalidator": "xhigh", "code-reviewer": "xhigh",
    "planner": "xhigh", "debugger": "xhigh", "brainstormer": "xhigh",
    "escalation-consultant": "xhigh",
    "critique-consolidator": "high", "decision-reconciler": "high",
    "product-value-critic": "high", "market-fit-critic": "high",
    "code-simplifier": "high", "workflow-orchestrator": "high", "developer": "high",
    "researcher": "high", "docs-manager": "high", "ui-ux-designer": "high",
    "advisor": "high",
    "spec-tech-critic": "high",
    "tester": "medium", "journal-writer": "medium", "git-manager": "medium",
    "spec-craft-critic": "medium",
    "project-manager": "low", "gemini-relayer": "low", "partner-relayer": "low",
}

# agents that must NOT carry a subagent-spawn tool
NO_SPAWN = {
    "gemini-relayer", "partner-relayer", "workflow-orchestrator", "red-teamer",
    "independent-revalidator",
    # spec-tech-critic / spec-craft-critic: read-only hs:critique lenses mapped
    # from product-spec's tech-critic/craft-critic (harness/plugins/hs/skills/
    # spec/references/spec-critique.md) — same epistemic-independence rationale
    # as red-teamer/independent-revalidator above: a critique lens must read the
    # scan bundle first-hand, never delegate the reading to a spawned child.
    "spec-tech-critic", "spec-craft-critic",
}

# report-writing lenses that must declare Write + Edit explicitly (not via memory)
EXPLICIT_WRITERS = {
    "code-reviewer", "researcher", "red-teamer", "market-fit-critic",
    "product-value-critic", "independent-revalidator", "critique-consolidator",
}


def _fm(name):
    text = (_AGENTS / (name + ".md")).read_text(encoding="utf-8")
    m = _FM.match(text)
    assert m, "%s.md has no frontmatter" % name
    return yaml.safe_load(m.group(1))


def _tool_tokens(name):
    return {t.strip() for t in str(_fm(name).get("tools", "")).split(",") if t.strip()}


def _skills(name):
    return set(_fm(name).get("skills", []) or [])


def _all_agents():
    return sorted(p.stem for p in _AGENTS.glob("*.md"))


# --- spawn policy -------------------------------------------------------------

def test_scoped_task_explore_retired_everywhere():
    offenders = [n for n in _all_agents() if any("(Explore)" in t for t in _tool_tokens(n))]
    assert not offenders, "Task(Explore) is decorative and must be retired: %s" % offenders


def test_spawn_granted_to_all_but_carve_outs():
    missing = []
    for n in _all_agents():
        if n in NO_SPAWN:
            continue
        if not ({"Task", "Agent"} & _tool_tokens(n)):
            missing.append(n)
    assert not missing, "these agents should carry a bare Task/Agent spawn tool: %s" % missing


def test_carve_outs_have_no_spawn_tool():
    leaked = [n for n in NO_SPAWN if ({"Task", "Agent"} & _tool_tokens(n))]
    assert not leaked, "spawn carve-outs must not gain Task/Agent: %s" % leaked


# --- effort tiers -------------------------------------------------------------

def test_every_agent_pins_the_ratified_effort():
    bad = []
    for n in _all_agents():
        got = _fm(n).get("effort")
        want = EFFORT.get(n)
        if want is None:
            bad.append((n, "no ratified effort in table"))
        elif got != want:
            bad.append((n, "effort=%r want %r" % (got, want)))
    assert not bad, "effort drift: %s" % bad


# --- explicit writes ----------------------------------------------------------

def test_report_writers_declare_write_explicitly():
    bad = []
    for n in EXPLICIT_WRITERS:
        toks = _tool_tokens(n)
        if "Write" not in toks or "Edit" not in toks:
            bad.append((n, sorted(toks)))
    assert not bad, "report-writing lenses must declare Write+Edit in tools: %s" % bad


# --- per-agent specifics ------------------------------------------------------

def test_brainstormer_can_write_and_learn():
    fm = _fm("brainstormer")
    assert fm.get("memory") == "project", "brainstormer needs memory: project"
    toks = _tool_tokens("brainstormer")
    assert {"Write", "Edit"} <= toks, "brainstormer must declare Write+Edit: %s" % sorted(toks)
    assert {"Task", "Agent"} & toks, "brainstormer must be able to spawn"


def test_project_manager_has_skill_tool():
    assert "Skill" in _tool_tokens("project-manager"), \
        "project-manager activates hs:project-management at runtime — needs Skill tool"


def test_developer_declares_worktree_isolation_and_spine_skills():
    fm = _fm("developer")
    assert fm.get("isolation") == "worktree", "developer must declare isolation: worktree"
    assert {"cook", "test"} <= _skills("developer"), "developer preloads cook+test"


def test_tester_and_docs_manager_preload_spine_skills():
    assert "test" in _skills("tester"), "tester preloads the test skill"
    assert {"docs", "repomix"} <= _skills("docs-manager"), "docs-manager preloads docs+repomix"
