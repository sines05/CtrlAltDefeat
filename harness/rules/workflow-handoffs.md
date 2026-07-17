# Workflow handoffs (on-demand)

Handoff table between SDLC steps -- who receives what, what is handed over, where to stop.
Matches `harness/data/skill-chains.yaml` (lens: declared-vs-actual).

| # | From -> To | Handover | Pass condition |
|---|---|---|---|
| 1 | idea -> hs:plan | problem description + constraints | standards loaded |
| 2 | hs:plan -> red-team | plan.md + phases | plan fully written |
| 3 | red-team -> validate | disposition table Accept/Reject | findings with evidence processed |
| 4 | validate -> HUMAN reviewer | Validation Log, Failed: 0 | all blocking questions finalized |
| 5 | HUMAN reviewer -> hs:cook | plan approved + DECs recorded | explicit approval (all autonomy stops here) |
| 5a | HUMAN reviewer -> hs:afk | plan approved + DECs recorded | unattended (AFK) variant of #5: replaces manual cook with an unattended loop; still requires explicit approval at the front, human re-reviews at the tail (#5b) |
| 5b | hs:afk -> hs:test | code + unattended commit loop | relevant suite green; human verifies before ship (counterpart of #6 for the unattended branch) |
| 6 | hs:cook -> hs:test | code + TDD tests per-phase | relevant suite green |
| 7 | hs:test -> hs:cook | QA report, ALL failures listed | any failure -> fix loop (#6/#7) |
| 8 | hs:test -> artifact | verification.json verdict | 100% pass (PASS) |
| 9 | hs:cook -> hs:code-review | implemented code (pending changes / branch) | implementation done -> review before ship |
| 9a | hs:code-review -> artifact | review-decision.json | verdict PASS required for hard stage |
| 9b | hs:code-review -> hs:git | review-decision.json verdict PASS | review PASS -> commit/push |
| 10 | artifact -> ship | gate_stage reads artifacts | gate pass; ship is the second HUMAN checkpoint |

Enterprise delta: handoff 10 connects to GitLab MR (the `ticket_id` seam already
exists in the schema). (Personal-first posture: there is NO reviewer role/quorum
gate on 9a — review is self-approval; the old `team.yaml`/`roles-policy.yaml`
role-check machinery was removed.)

**Handoff #5 -- context isolation:** between "HUMAN reviewer"
and "hs:cook", RECOMMENDED to `/clear` so cook runs from a clean context
(planning carryover -- research/red-team/debate -- skews cook). hs:plan returns
an **ABSOLUTE PATH** so the post-`/clear` session can still locate the plan.
Nudge `cook_isolation_nudge` (advisory, fail-open) fires when hs:plan + hs:cook
are detected in the same session (best-effort). This is a recommendation, NOT a
gate -- it does not block cook.

**Handoff #5 -- flag propagation (discover -> plan -> cook):** the mode/flag
decision is made ONCE (in discover's scope read or plan's mode step) and then
mirrored down the chain mechanically -- a receiving skill never re-decides it.
Three carry rules, each surfaced to the user (do not carry silently -- the user
must see which mode is being run and why):

- **discover -> plan, three tiers.** discover routes the plan command by brief
  scope: complex / multi-step / wide file surface -> `--hard --deep --tdd`;
  ordinary feature/refactor -> `--hard --tdd`; tiny (typo / one-line / docs /
  no testable code) -> `--fast` (drop `--tdd`). State the tier + reason, emit one
  command.
- **plan -> cook, `--tdd` mirrors the plan.** A `--tdd` plan (the default) MUST
  produce a cook command carrying `--tdd`; only a `--fast`/no-test plan drops it.
  `--hard`/`--fast`/`--deep` are plan-only and are NOT passed to cook.
- **plan -> cook, `--parallel` is a DUAL recommendation.** When the plan is
  parallel-capable (it emitted the dependency matrix + file-ownership table), the
  handoff prints BOTH the parallel and the sequential cook command plus a one-line
  risk read recommending one: disjoint ownership, no core/shared surface ->
  recommend parallel (the integration barrier still runs the full suite serially);
  any batch touching core / shared config / migration / hot module -> recommend
  sequential but STILL print the parallel line so the user can override with eyes
  open. A plan with no dependency matrix is sequential-only -- omit the parallel
  line. cook's own `--parallel` resolver (`cook_parallel_plan.py`) is the final
  arbiter and re-demotes any overlapping batch regardless of the flag; the handoff
  recommendation never weakens that.

## Orchestrator pre/parallel handoffs

Orchestrator discover/understand/triage connect into chain 1-10 above, numbers
unchanged:

| From -> To | Handover | Pass condition |
|---|---|---|
| hs:discover -> hs:plan | discovery brief (problem + evidence + chosen direction + open questions + out-of-scope) | brief finalized; RECOMMENDED /clear between discovery<->plan -- nudge `discover_isolation_nudge` (advisory, default OFF) |
| hs:understand -> hs:plan/hs:triage | codebase map (read-only) | map sufficient for design/localization; do NOT modify code |
| hs:triage -> hs:fix | triaged defect + repro (localized) | severity not architectural -> fast-path |
| hs:triage -> hs:plan | defect affects architecture / 3+ failing hypotheses | escalate to full pipeline instead of fast-fix |
| hs:techstack -> hs:test | detected stack (languages, test_cmd, package manager) | non-Python target -> detect the real test command before running test (do NOT assume pytest) |
| hs:security-scan -> hs:code-review | security findings + proposed fixes | findings triaged -> review the fixes before they ship |
| hs:afk | unattended branch of the plan->test pipeline: inserted between #5 and #6 (rows #5a/#5b in table above) | plan approved; loop commits freely in the middle, human reviews at both ends (#5a entry, #5b exit) |
| hs:discover/research/triage/cook/predict -> hs:bakeoff | ≥2 measurable candidate directions + a mechanical metric, reasoning can't separate them | preconditions hold (else fall back to hs:predict) — escalation, not a default step |

**Composite-source notation:** the `discover/research/triage/cook/predict -> hs:bakeoff`
row above is shorthand for five independent handoffs — each listed source hands off to
`hs:bakeoff` on its own (it is NOT a sequence through the listed skills). The slash
separates alternative sources, not pipeline steps.

| hs:bakeoff -> hs:plan/hs:cook | verdict (winner + full scoreboard) OR tie_within_noise→human | verdict written; winner is outside the noise band (tie/insufficient -> hand to human, do NOT proceed) |
| hs:plan/hs:discover -> hs:critique | artifact under critique (plan / chosen direction) + scope | lenses fan out (batched ≤2), consolidated to one verdict; gate mode also writes `critique-consensus.json` (advisory by default — enforcement OFF until a stage opts the kind into `stage-policy.yaml` `requires:`, a write-guarded human edit) |
| hs:docs-scaffold -> hs:docs-standardize | stub skeleton (frontmatter + headings + TBD) | required-set stubbed -> validate structure (frontmatter/id/graph) before content |
| hs:docs-standardize -> hs:docs-build | structure artifact PASS (docs-check.json, 0 errors) | gate green -> render showcase HTML + flat-md/pdf/excel releases; advisory `docs_validation_nudge` (default OFF) flags docs edited without re-running this pipeline |

`hs:triage` reuses fix-loop #6/#7 and the same gate `verification.json` #8 -- does not create a new gate.
`hs:afk` does NOT create a new gate: routes Ralph sandbox | fallback native, still stops at both human-reviewer endpoints (#5a/#5b) and verifies via `verification.json` #8.
Matches `harness/data/skill-chains.yaml` (4 chains added accordingly). Archetype contract: `harness/rules/orchestrator-skills.md`.
