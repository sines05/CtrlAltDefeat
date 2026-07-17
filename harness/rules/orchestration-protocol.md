# Orchestration protocol (on-demand)

Load when spawning subagents or coordinating parallel work. Backing implementation
for skill `hs:team`; matches the harness multi-agent primitives (`claims.py`,
`task_store.py`, `SendMessage` + Task*).

## Delegation context — required in every subagent prompt

task · files allowed to read · files allowed to modify · acceptance criteria ·
constraints · work-context path · reports path (default `plans/reports/`). Include
env (CWD, OS) when handing off work.

## Write-lane preflight — before delegating a Write-bearing task

The `agent_rbac_guard` gate blocks a subagent write that falls outside its role's
declared lane in `harness/data/agent-permissions.yaml` — and it fires only WHEN the
subagent writes, so a mismatch costs a wasted spawn + round-trip. Before handing a
task that writes files, glance at the target role's lane: if the write target's
directory is NOT in that lane, either (a) widen the lane repo-locally via an overlay
(`HARNESS_AGENT_PERMISSIONS_OVERLAY`, add-only — never edit the shipped table for a
project-specific path), or (b) delegate the work read-only (the agent returns the
content, the parent — unrestricted — writes it). Read-only agents (no Write tool)
never reach the gate.

## Ultracode Workflow — shared base workflows + mandatory fallback

The Workflow tool runs a deterministic orchestration script over subagents. The harness
ships reusable base scripts so consumers do not each hand-roll one.

- **Plan the spawn first.** For a non-trivial fan-out (research sweep, multi-lens critique,
  broad review), skill `hs:workflow-orchestrate` (agent `hs:workflow-orchestrator`) is the
  delegation planner: it derives subagents-vs-Workflow, groups the fan-out by concern, sizes
  the sub-count, sets the batch-consolidate cadence, and lays out early-write report paths —
  then presents the plan for approval before anything spawns. Route delegation design through
  it instead of hand-sizing a fan-out ad hoc.
- **Common-workflow dir.** Base workflows live at `harness/plugins/hs/workflows/*.js`
  (plugin-root auto-load — self-contained, never touches `.claude/`). Two shapes ship:
  `base-pipeline-verify` (find → verify, no barrier — for review-shaped consumers) and
  `base-fanout-consolidate` (fan-out N lenses → mechanical dedup — for multi-lens
  consumers like critique / predict / scout / security-scan).
- **Named vs inline.** Prefer `Workflow({name})` — the portable, registry-resolved path.
  Plugin workflows register under the **`hs:` namespace**: call `hs:base-pipeline-verify`
  / `hs:base-fanout-consolidate`, NOT the bare `meta.name` (the bare name does not
  resolve). A registry that has not picked up a new workflow yet (no reinstall+restart)
  → `Workflow({scriptPath:"<plugin-root>/workflows/<file>.js"})`. A call that needs a
  bespoke per-run script the base cannot model → inline `Workflow({script})`.
- **Inputs are DATA, not callbacks.** The VM forbids passing functions across the
  boundary, so a base takes its spec as JSON `args` (lens prompts, a `{{field}}` verify
  TEMPLATE the base renders, JSON Schemas). A base is depth-1 (it never calls another
  base).
- **Mandatory fallback.** Workflows are plan-gated (entitlement can be off), so every
  consumer MUST keep a non-Workflow inline-Task fan-out and **stamp which path ran**
  (`Workflow(name)` | `Workflow(scriptPath)` | `Workflow(inline)` | `inline-Task
  fallback`). A consumer with no fallback breaks wherever the entitlement is absent.
- **Determinism trap.** The VM aborts (`errorCode:4`) on `Date.now()`, `Math.random()`,
  or `new Date()`. Retry backoff is attempt-indexed (`base * 2**attempt` + `setTimeout`),
  never wall-clock jitter. Also: no control characters in a script (the approval dialog
  rejects them) and no `import`/`require`/`eval`/`new Function`/fs.
- **Governance lives at the tool boundary, not in the script.** A base's `agent()` spawns
  a REAL subagent (`agent_type="workflow-subagent"`), so its tool calls pass through the
  SAME PreToolUse/PostToolUse hooks (gate_stage / write_guard / agent_rbac_guard /
  telemetry) as any other subagent. Do not embed governance in the script — it is both
  impossible (the VM is sandboxed) and redundant.
- **Write lane + overlay.** `workflow-subagent` ships the conservative `plans/**` lane
  (reports/artifacts only — the same lane the other advisory agents hold). For a
  consumer `--fix` (code-review / security-scan) to edit code, grant the code-fix lane
  **per-repo via `HARNESS_AGENT_PERMISSIONS_OVERLAY`** (add-only union — never widen the
  shipped table, which would ride a tarball into a repo that never opted in). Recipe +
  the "set it once at setup" guidance: `hs:setup` TIER 3; the env knob:
  `harness/rules/config-reference.md` (RBAC lane overlay row). The block-reason prints
  the flag name at block time, so discovery is just-in-time even without the preflight.

## Route at the execution step

`hs:workflow-orchestrate` is the standard front door for a fan-out. These four clauses
are the single source the enforce-skills propagate from — do not re-derive them per skill.

1. **Route at the numbered step, not an end section.** Declare the
   `hs:workflow-orchestrate` route INSIDE the numbered execution step where the fan-out
   actually happens — never only in a trailing standalone section. A route parked at
   end-of-file is read as optional: the numbered workflow → base-template chain is
   self-contained and skips it. The route is the layer BEFORE the spawn line, not a
   replacement for it.
2. **Fixed vs variable fan-out.** For a **config-fixed** set (critique lenses, predict's
   five personas, security-scan's personas, code-review levels) `hs:workflow-orchestrate`
   has nothing to *size* — its value is the **challenge layer** (is this fan-out plan
   sound?), so route cheaply via the script's heuristic bypass. For a **variable** set
   (research angles, open scope) the route also sizes and groups — the count is unknown
   until routed.
3. **reason / strategy / scope contract.** The caller states three fields before routing —
   `reason` (concrete, citable trigger), `strategy` (mode + base template + group→count +
   barrier/parallel/isolation), `scope` (file-surface/SCALE + variable-vs-fixed count).
   `plan_orchestration.py` REFLECTS them verbatim and emits an advisory `assessment`
   (complexity / confidence / route_depth); the skip-vs-escalate decision stays with the
   model — the script never gate-blocks the choice. `route_depth:light` proceeds via the
   base; `route_depth:agent` escalates the `hs:workflow-orchestrator` agent before spawning.
4. **Three structural anti-waste mechanisms.** group-cap (wave-2 spawn ≤ the cross-cutting
   cap — never one sub per finding), batch-consolidate (per-group mechanical merge — never
   one giant Write), early-write (each sub flushes via `write_finding.py`). The
   cross-cutting caps live in ONE source — `harness/data/orchestration.yaml` (read via
   `orchestration_config.py`) — not per-skill prose. The base workflows surface a
   structural warning (visible in the run log) when a run exceeds the cap or omits
   early-write; they do not throw. This layer is **structural + visible**, not an absolute
   block.

**Commands — the one runnable home.** The enforce-skills point HERE for the exact commands
instead of re-spelling bare script names (which are not on PATH and live in two different
dirs — a copy-paste trap). Both scripts need a `python3 <path>` prefix:

```bash
# resolve the cross-cutting group cap for N distinct concerns (top-level scripts dir)
python3 harness/scripts/orchestration_config.py --group-cap <N>
# size + score the fan-out (skill-local script — full path, it is NOT on PATH)
python3 harness/plugins/hs/skills/workflow-orchestrate/scripts/plan_orchestration.py \
    --run-id <slug> --groups <k:n,...> --reason "…" --strategy "…" --scope "…" [--group-cap <n>]
```

Read `route_depth` from the JSON: `light` → proceed via the base; `agent` → escalate the
`hs:workflow-orchestrator` agent. Pass the resolved cap as `groupCap` + an `earlyWrite:{runId}` to
the base. A caller wanting the full walkthrough opens `hs:workflow-orchestrate` (its step 2).

## Context isolation

- Do NOT pass the full conversation history; summarize ONLY the decisions needed for
  the subtask.
- Give exact file paths instead of "look around the repo" — unless scouting is the task.
- Keep coordination, merge decisions, and human approvals in the controller session.

## Parallel work — safety conditions

Only run in parallel when **file ownership is clear** and integration points are known.
Do not edit in parallel: the same file, a generated artifact, a migration sequence, or
shared config. Ownership is split 1-winner via `harness/scripts/claims.py`; shared task
list via `harness/scripts/task_store.py`. Advisory subagents (report-only) do NOT mutate
plan/code unless explicitly assigned to do so.

## Model discipline when spawning Explore

`Explore` inherits the session model (Opus post-CC-2.1.198), which is expensive for
file-finding — a Haiku-class job. **Every Explore spawn MUST set `model:"haiku"`.** This is
enforced, not just advised: `explore_model_guard` (PreToolUse `Agent|Task`, compliance,
default **block**) blocks a mis-modeled Explore spawn; the posture lives in
`harness/data/model-policy.yaml` (`mode: block|advisory|off`, with a per-agent override, and
a whole-file `HARNESS_MODEL_POLICY` dev override). Genuinely need Opus for a search? Record a
reason via `harness/scripts/explore_override.py --grant --session <id> --reason ...` — the gate
consumes that marker and allows the spawn. Do NOT route around the pin with `general-purpose`
(it inherits Opus and the gate cannot see that intent — the honest mitigation is this rule and
the block message, not the exit code). A session-less/AFK spawn cannot use the marker; lower
`mode` instead.

## Model escalation when a subagent hits a hard wall

The opposite direction of the Explore pin: `explore_model_guard` only ever LOWERS a spawn's
model, but a core agent stuck below `fable` may need to RAISE it. Instead of switching the
session model, spawn the `escalation-consultant` for one-shot counsel (inherits `fable`, with
a catch-error retry to `opus`). Full conditions + fallback semantics live in the on-demand
rule `harness/rules/model-escalation.md`.

## Status protocol

Require each subagent to end with:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: 1-2 sentences
Concerns/Blockers: optional
```

`BLOCKED` / `NEEDS_CONTEXT` means change context, scope, or approach. Do NOT repeat
the same failing prompt unchanged. Multi-session or team work uses skill `hs:team`
and communicates via `SendMessage`.
