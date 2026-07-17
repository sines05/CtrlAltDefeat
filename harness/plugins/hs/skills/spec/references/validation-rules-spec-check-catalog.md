# Validation Rules Spec — Check Catalog

Split out of [validation-rules-spec.md](validation-rules-spec.md) to stay under the reference size cap. Same document, same authority — only the location moved.

## Check Catalog

| ID | Owner | Severity | Trigger | Message Template |
|----|-------|----------|---------|------------------|
| `orphan_story` | script | error | a story with a missing or empty `epic` field (no parent reference at all) | "Story {id} has no epic reference." |
| `orphan_epic` | script | error | an epic with a missing or empty `prd` field (no parent reference at all) | "Epic {id} has no PRD reference." |
| `orphan_prd` | script | error | a PRD whose `brd_goals` is empty or missing (not declared). Unresolved IDs in a non-empty `brd_goals` list surface as `dangling_link` instead | "PRD {id} has no BRD goals declared." |
| `orphan_brd_goal` | script | warn | a BRD goal with no PRDs referencing it | "BRD goal {id} has no PRDs addressing it." |
| `dangling_link` | script | error | any frontmatter ID reference that doesn't resolve | "{file}: reference {ref} does not resolve." |
| `parent_type_mismatch` | script | error | a parent reference (`epic` on a story, `prd` on an epic) that resolves to a REAL artifact of the WRONG type — passes `dangling_link` (the id exists) but silently corrupts the traceability chain | "Story's epic reference {ref} resolves to a {actual}, not an epic." |
| `unaddressed_parent` | script | warn | a parent (epic/PRD) with zero inbound child edges of the expected type (BRD goals with zero PRDs use `orphan_brd_goal` instead) | "{id} has no {child_type} addressing it (gap-analysis input)." |
| `missing_ac` | script | error | a story with empty / missing `acceptance_criteria` | "Story {id} has no acceptance criteria." |
| `low_ac_count` | script | warn | a story with `len(acceptance_criteria) < 2` | "Story {id} has fewer than 2 acceptance criteria ({count})." |
| `goal_without_metric` | script | error | a BRD goal (`type: goal`) whose `metrics` is empty or missing (frontmatter-and-id-spec requires ≥1 metric slug) | "BRD goal {id} has no success metric; at least one metric slug is required." |
| `dup_id` | script | error | two artifacts sharing the same `id` | "Duplicate ID {id} in {files}." |
| `invalid_id` | script | error | an `id` not matching the parent-scoped grammar | "ID {id} does not match expected pattern {pattern}." |
| `unknown_enum` | script | error | a closed-enum field with a value outside the allowed set (incl. a `risks[]` entry's `impact`/`likelihood` ∈ {low,med,high} or `status` ∈ {open,mitigated,accepted}) | "{file}: field {field} value '{value}' not in {allowed}." |
| `unknown_ref` | script | error | a `competitive_parity` key that does not resolve to any competitor ID declared in the BRD's `competitors:` list — emitted by `check_consistency._check_competitive_parity` | "{id}: competitive_parity key '{ref}' does not resolve to any BRD competitor." |
| `parse_error` | script | error | YAML parse failure or missing required field | "{file}: parse error — {detail}." |
| `status_inconsistency` | script | warn | child `approved` under parent `draft`, or descendant approval newer than ancestor | "{id} status inconsistent with parent {parent_id}." |
| `version_inconsistency` | script | warn | child semver `version` greater than parent's | "{id} version {v} exceeds parent {pid} version {pv}." |
| `self_reference` | script | error | an artifact whose `epic`, `prd`, or `brd_goals` reference points at its own ID | "{id} references itself via `{field}`." |
| `invalid_type` | script | error | see *Trigger detail* below ↓ | "{file}: field {field} value '{value}' is not a valid {expected}." |
| `persona_cap_exceeded` | script | warn | `personas` list with > soft-cap entries (sanity check against spec drift) | "{id}: personas list ({count}) exceeds soft cap ({cap})." |
| `risk_high_ratio` | script | warn | more than `RISK_HIGH_RATIO` (default 0.5) of an artifact's risks are `impact: high` (deterministic ratio) | "{id} has {high}/{total} risks at impact=high (>{pct}%)." |
| `risk_blindspot` | script | warn | an epic with ≥ `RISK_BLINDSPOT_MIN_STORIES` (default 5) child stories and zero declared risks — child-story count is a deterministic graph traversal, NOT an LLM judgment | "{id} has {story_count} child stories but no declared risks." |
| `dep_cycle` | script | error | a circular `depends_on` chain (A→B→…→A) detected by an iterative Tarjan SCC pass (no `RecursionError` on long chains); `context.cycle` carries the closed path | "Circular depends_on chain: {a → b → a}." |
| `dep_dangling` | script | error | a `depends_on` target that does not resolve to a real artifact — same dangling family as `dangling_link` (lives in `check_traceability`) | "{id} depends_on unknown artifact {ref}." |
| `dep_type_mismatch` | script | error | a `depends_on` target that resolves to a real artifact of the WRONG type (not a PRD/Epic — e.g. a story or BRD goal); the depends_on-edge analogue of `parent_type_mismatch`, missed by `dep_dangling` (target exists) | "{id} depends_on {ref}, which is a {type}, not a prd or epic." |
| `dep_order` | script | warn | A `depends_on` B but A's `target_date` is BEFORE B's — A is due before the prerequisite it waits on (deterministic; fires only when BOTH dates parse) | "{id} target_date {a} is before its prerequisite {b} target_date {b_date}." |
| `time_child_late` | script | warn | a child's `target_date` is AFTER its parent's (an epic due after its PRD finishes) — deterministic date compare, fires only when BOTH dates parse | "{id} target_date {c} is after parent {pid} target_date {p}." |
| `overdue` | script (`time_advisory.py --today`, OUTSIDE the `--validate` gate) | advisory | an artifact whose `target_date` is strictly before `--today` (default real today; pinnable for reproducibility) — consumes the wall clock so it is deliberately NOT a structural gate (keeps the gate byte-reproducible) | "{id} target_date {td} is before today {today} (overdue by {n} days)." |
| `session_md_gitignored` | script | warn | `docs/product/.session.md` matched by a `.gitignore` rule — session state is meant to be committed (resumable across PO sessions) | "docs/product/.session.md is gitignored; session state must be committed." |
| `session_stale` | script (`session_staleness.py`) | warn | `.session.md` `updated` predates the newest artifact `updated` — the session (an authorised assume-source) may assert facts the spec has moved past | "docs/product/.session.md updated {d} predates the newest artifact edit ({id} updated {d2}); re-read before assuming from it." |
| `session_superseded` | script (`session_staleness.py`) | warn | see *Trigger detail* below ↓ | "docs/product/.session.md predates {n} decision(s) [{ids}]; decisions.md is authoritative — verify the session does not contradict them." |
| `missing_id` | script | error | an artifact whose frontmatter has no `id:` at all | "Artifact in {where} has no `id:` in its frontmatter." |
| `malformed_id` | script | error | an artifact whose `id:` is not a plain string (a hand-edit left it a list/number/mapping) | "Artifact in {where} has a non-string `id:` (must be a plain string)." |
| `goal_without_status` | script | warn \| error | a BRD goal missing the required `status`; `warn` on a legacy spec, `error` once the BRD declares `schema_version >= 2` (a migrated/fresh spec is fully gated) | "BRD goal {id} is missing the required `status` (draft\|review\|approved)." |
| `misplaced_parent_field` | script | warn | a story carrying a parent-link field (`prd`/`brd_goals`) that belongs on its PRD/epic — a story's only parent reference is `epic` | "Story {id} carries {misplaced}, but a story's only parent reference is `epic`." |
| `persona_without_portrait` | script | warn | a persona named in an artifact's `personas` frontmatter with no matching portrait defined for it | "Persona {persona} is declared in {id} frontmatter but has no portrait." |
| `subsystem_horizon_drift` | script | warn | a subsystem whose PRODUCT.md table `horizon` disagrees with the horizon its own artifact declares | "Subsystem {id}: PRODUCT.md table says horizon={a}, artifact says {b}." |
| `dangling_serves` | script (`strict_gate.py`) | error | a shape task's `serves` id does not resolve to any live story in this spec's graph — the one cross-layer check `strict_gate` runs beyond `check_traceability` + `check_consistency` | "Shape task {task_id} serves {ref}, which cannot resolve to any live story." |
| `dup_task_id` | script (`strict_gate.py`) | error | two DISTINCT shape task files (`docs/product/shape/tasks/*.md`) carry the same frontmatter `id` — the shape-side analogue of `dup_id` (which only covers PO artifacts); left unflagged it makes `serves_resolver`'s two coverage maps silently disagree | "Shape task id {id} is already used by {ref}; task ids must be unique." |
| `fence_breach` | script (`check_fence.py`, OUTSIDE the `--validate` gate) | warn | a changed working-tree path (git porcelain) not under `docs/product/` — the advisory pull-side companion to `fs_guard.py` | "{file} was touched outside the spec boundary (docs/product/). Advisory only — the skill writes specs under docs/product/; confirm this change belongs here." |
| `legacy_metric_key` | script (`check_consistency_schema.py`) | warn | a BRD goal with no `metrics:` but the old singular `metric:` key still present — a warn, never an auto-rename | "Goal {nid} uses the old singular `metric:` key; ... Rename it to `metrics:` by hand ..., then confirm with the PO." |
| `unknown_goal_key` | script (`check_consistency_schema.py`) | warn | a BRD goal frontmatter key outside the allowed set (id/title/metrics/status/owner/moscow) | "Goal {nid} carries an out-of-spec key `{k}`; allowed goal keys are id/title/metrics/status/owner/moscow." |
| `bad_version_format` | script (`check_consistency_schema.py`) | warn | an artifact `version:` that fails `parse_semver` (not semver-lite major.minor.patch) | "{nid} version {ver!r} is not semver-lite (major.minor.patch, e.g. 1.0.0)." |
| `invest_quality` | LLM | warn | a story failing INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable) | "Story {id}: INVEST concern — {dimension}: {explanation}." |
| `vagueness` | LLM | warn | a story or PRD requirement using vague language ("should", "easy", "fast") without quantification | "{id}: vague language — '{phrase}'. Suggest quantification." |
| `core_value_drift` | LLM | warn | an artifact's narrative drifts from PRODUCT.md's core-value sentence | "{id}: core-value alignment is {aligned\|weak\|off}: {rationale}." |
| `gold_plating` | LLM | warn | scope expansion beyond the stated PRD problem | "{id}: gold-plating — {addition} not motivated by stated problem." |
| `semantic_duplication` | LLM | warn | two artifacts express the same intent in different words | "{id1} ≈ {id2}: semantic duplication detected — {explanation}." |
| `time_realism` | LLM (anchored to SCRIPT-precomputed numbers — see scaffold below) | warn | see *Trigger detail* below ↓ | "{id}: deadline likely unrealistic — size {size}, {child_story_count} stories, {days_remaining} days to {target_date}." |
| `competitive_drift` | LLM (anchored to SCRIPT-resolved parity — see scaffold below) | warn | see *Trigger detail* below ↓ | "{id}: competitive drift — behind on every tracked competitor ({all_behind_competitors}); scope core-value." |
| `contradiction` | LLM | error | a new claim contradicts an `approved` artifact | "{id} contradicts approved {other_id}: {contradiction}. SURFACE TO PO — never auto-flip." |

**Trigger detail** (full trigger text for the rows above whose Trigger cell was shortened to a pointer, so the table stays narrow):

- `invalid_type` — a list-typed field that is not a list, a wrong-shape field (e.g. a `risks[]` entry that is not a mapping, a `competitive_parity` that is not a dict), or a closed-enum sub-field (dates, `depends_on` type) with an invalid value (reuse — no separate `invalid_shape`).
  The artifact `type` field is **directory-derived and trusted** — `check_consistency` does NOT validate it against an enum.
- `session_superseded` — one or more active `DEC-<n>` are dated AFTER `.session.md` `updated` — decisions ruled after the snapshot the session cannot reflect; `decisions.md` is authoritative (Q5), the session is never auto-rewritten.
- `time_realism` — an epic's deadline is unrealistic for its scope — flag ONLY when all anchors present AND `size=='L'` AND `child_story_count>=6` AND `days_remaining<21`; uncertain/missing anchor → no-flag.
- `competitive_drift` — a core-value PRD is losing its competitive edge — flag ONLY when `eligible` (scope=='core-value' AND `competitors_with_data>=2`) AND EVERY real (non-`none`) parity is `behind`; wrong scope / <2 data / any non-`behind` → no-flag.

