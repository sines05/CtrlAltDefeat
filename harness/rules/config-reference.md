# Config reference (on-demand — NOT always-load)

Every tunable knob, the file that holds it, its default, how to change it, and
whether an env var overrides it. This is the index; each YAML file's own header
comment carries the per-knob detail. Load this when a question is "where do I
change X / what does X default to", not on every turn.

Two truths to keep in mind (full text in `harness/rules/harness-contract.md`):

- Config is **tamper-visible, not tamper-proof**: edits land as a git diff and a
  trace line. An env var marked `*` below repoints the config **file** itself — a
  known gap; the pre-push hook scrubs every `HARNESS_*` before judging a push, so
  it cannot weaken a protected-branch push.
- Human-edited config is YAML; machine-written data is JSON/JSONL. Edit the YAML
  by hand, or use the named tool where one exists.
- Some `harness/data/*.yaml` are **catalogs**, not knob tables — extended by adding
  rows, not by flipping a scalar, so they are out of scope for this index:
  `components.yaml`, `decomposition-map.yaml`, `persona-bundles.yaml`,
  `voice-presets.yaml`, `skill-defaults.yaml`, `skill-deps.yaml`,
  `observation-signals.yaml`, `route-probes.yaml`, `injectable-classifier.yaml`,
  `hook-dispatch.yaml`, the `thin-core-*.yaml`.

## Conversational register & generated output

| Knob | File | Default | Change how | Env |
|---|---|---|---|---|
| `terminal_voice_level` (0–5) | `harness/data/terminal-voice.yaml` | 5 | edit or `/hs:voice` | `HARNESS_TERMINAL_VOICE` * |
| `voice_level` (1–9) | `harness/data/terminal-voice.yaml` | 5 | edit or `/hs:voice` | * |
| `persona` | `harness/data/terminal-voice.yaml` | none | edit or `/hs:voice` | * |
| `no_markdown` | `harness/data/terminal-voice.yaml` | false | edit or `/hs:voice` | * |
| `interview_rigor` / `action_prompting` | `harness/data/terminal-voice.yaml` | standard | edit, `/hs:voice`, or `voice_prefs.py --set` (also via `/hs:setup`) | * |
| `language` (report/doc prose) | `harness/data/output.yaml` | vi | edit | — |
| `humanize` (advisory anti-AI-tell pass; apply only when publishing externally) | `harness/data/output.yaml` | **false (off)** | edit, `output_config.py --set`, or `/hs:setup` | `HARNESS_OUTPUT` (dev override, fail-open path only) |
| `audience` (off or 0–5; prose register for **CHAT + report prose**, evidence invariant; injected per session for chat, read via `--resolved` for reports) | `harness/data/output.yaml` | off (null) | edit, `output_config.py --set`, or `/hs:setup` | `HARNESS_OUTPUT` (dev override) |
| `code_style` (off or 0–5; **NOT scope-fenced** — shapes generated **CODE only** (comment density, verbosity, examples), NOT chat/report prose (that is `audience`); profiles in `harness/data/output-styles/`) | `harness/data/output.yaml` | off (null) | edit, `output_config.py --set`, or `/hs:setup` | `HARNESS_OUTPUT` (dev override) |
| `thinking_language` (language the model REASONS in; separate from `language` which is the prose written out. **Consumed**: `voice_inject` injects a "reason in `<lang>`" register directive into the session — but ONLY when it differs from `language` (no directive when both match). A soft prompt nudge, not an API param; scope-fenced — reasoning only, never evidence/gate) | `harness/data/output.yaml` | `en` | edit; read via `output_config.py --resolved` | `HARNESS_OUTPUT` (dev override, fail-open path only) |
| `plan.validation.{mode,minQuestions,maxQuestions,focusAreas}` (how `hs:plan` runs its validation interview: mode `prompt`/`auto`/`strict`/`none`; question bounds; focus areas) | `harness/data/skill-config.yaml` | `prompt` / 3 / 8 / [assumptions,risks,tradeoffs,architecture] | edit; read via `skill_config.py --resolved` | `HARNESS_SKILL_CONFIG` (fail-open path only) |
| `plan.resolution.branchPattern` (regex whose first capture group is the plan slug) | `harness/data/skill-config.yaml` | `(?:feat\|fix\|chore\|refactor\|docs)/(?:[^/]+/)?(.+)` | edit; `skill_config.extract_slug()` | `HARNESS_SKILL_CONFIG` (fail-open path only) |
| `skills.<name>.*` (open per-skill option bag, e.g. `skills.research.useGemini`) | `harness/data/skill-config.yaml` | `{}` | edit; `skill_config.skill_options(name)` | `HARNESS_SKILL_CONFIG` (fail-open path only) |

The voice knobs are conversational only: they never change code, generated
docs, evidence, or a gate decision. `audience`, `language`, and `humanize` shape
generated REPORT prose (not the terminal voice); evidence tokens (file:line / IDs
/ SHAs / numbers / quotes) stay invariant under all of them.

One command shows every resolved knob across both config files (terminal-voice +
output, honoring the dev overrides): `python3 harness/scripts/output_config.py --resolved`.
This is the single source a report skill/agent reads the register from — never a
hand read of the tracked `output.yaml` (that path is fail-closed and ignores the
dev override). The two config files stay deliberately separate (disjoint fail-mode,
override discovery, and scope-fence); `--resolved` is the unified view, not a merge.

The register is injected as context two ways, both built by ONE shared builder
(`harness/scripts/register_block.py`) so the surfaces cannot drift: `voice_inject`
at SessionStart (main session, re-fires on `/compact`) and `subagent_init` at
SubagentStart (every spawned subagent). Both carry the voice axes + universal-harm
floor + scope-fence PLUS the `audience` / `code_style` profile **BODY** — the
`## MANDATORY` / `## FORBIDDEN` directives sliced from
`harness/data/output-styles/{audience,code-style}-level-N.md` — not just the
one-line essence + a path the model never opens. A subagent inherits the SAME full
register the main session gets (a code-generating subagent needs the `code_style`
directives too), plus a one-line reinforcement extending the voice scope-fence over
ALL of its output (reasoning, reports, messages back to the lead). `body_for`
short-circuits to no body when a knob is off (default install) and fails open to
essence-only if a profile file is missing — it never blocks a session or a spawn.

## Gates, guards & autonomy

| Knob | File | Default | Change how | Env |
|---|---|---|---|---|
| guard `preset` + `overrides` | `harness/data/guard-policy.yaml` | balanced | edit or `guard_config.py` | `HARNESS_GUARD_POLICY` * |
| stage gates (push/pr/ship/deploy) | `harness/data/stage-policy.yaml` | shipped | edit | `HARNESS_STAGE_POLICY` * |
| ~~team roles · role→capability · approval quorum~~ — REMOVED (personal-first posture): the `team.yaml` + `roles-policy.yaml` machinery is deleted; plan-approval SLIM is self-approval (`count:1` always), no roster/quorum/role | — (deleted) | n/a | — | — |
| protected branches | `harness/data/protected-branches.yaml` | shipped | edit | `HARNESS_PROTECTED_BRANCHES` * |
| model-bound posture (`mode: block\|advisory\|off` + per-agent bound: `required_model` exact / `max_model` ceiling / `min_model` floor / `require_explicit` / `self_pinned`) — bounds ANY subagent-type; tier ladder haiku<sonnet<opus (`fable` exact-only); tier classification maps through `ANTHROPIC_DEFAULT_*_MODEL` and fails open on a custom/collapsed mapping; a bare inherit resolves the LIVE session model (transcript tail). Enforced by `explore_model_guard` (PreToolUse `Agent\|Task`, compliance, default block), reasoned escape via `explore_override.py`. NOT write_guard-locked (a human/dev may lower `mode`); reader fails open on a broken config. | `harness/data/model-policy.yaml` | shipped (block; built-ins bounded, hs:* self_pinned exact) | edit or lower `mode` | `HARNESS_MODEL_POLICY` * |
| `soft_stage_advisory` — top-level `stage-policy.yaml` flag for the `[advisory] soft stage … proceeding` reminder. Gate still traces either way. | `harness/data/stage-policy.yaml` | true (notify) | edit `stage-policy.yaml` | — |
| `hard_stage_advisory` — top-level `stage-policy.yaml` flag for the `[advisory] hard stage <reason>` line a hard stage prints when a receipt is missing/failed (personal-first: local advises, never blocks). SEPARATE from `soft_stage_advisory` so silencing hard noise never loses the soft signal. `false` = silent; the `gate_advisory` TRACE is emitted either way. | `harness/data/stage-policy.yaml` | true (notify) | edit `stage-policy.yaml` | — |
| active plan a hard stage gate validates against (selects which plan's artifacts satisfy the gate) | resolver in `artifact_check.py` | newest `in_progress` plan under `plans/` | `export` | `HARNESS_ACTIVE_PLAN` (path or bare dir under `plans/`; rejected if it resolves outside `plans/`) |
| test-policy (DoD per change-class) — tier-1 default + tier-2 repo override (`<root>/test-policy.yaml`); the `test_policy_dod` guard (enforcement category) re-reads raw JUnit/Cobertura/SARIF results referenced by `verification.json` and blocks a hard class missing a required type / with a failing or under-covered result. Security/a11y ride the same gate via `components:` globs (auth/payment → require a clean security SARIF, hard). | `harness/data/test-policy.yaml` | shipped | edit (tier-1) or add `<root>/test-policy.yaml` (tier-2) | `HARNESS_TEST_POLICY` * (tier-1 path) |
| `check_name_validation` — `write_verification.py` checks each `--check <name>` against the test-policy `test_types`; a name not in the set is invisible to the DoD gate (ships green-but-uncovered). `off` = ignore, `soft` = sharp advisory + still write (default), `hard` = refuse the write. A broken policy degrades to soft, never off. | `harness/data/test-policy.yaml` | soft | edit | `HARNESS_TEST_POLICY` * (tier-1 path) |
| change-class the DoD gate evaluates — DERIVED from the git diff by default (`change_class_derivation.py`); an explicit override is honored AND traced (`change_class_override`). | env only | derived | `export` | `HARNESS_CHANGE_CLASS` (feature\|bugfix\|refactor\|dep_bump_major\|release), `HARNESS_CHANGED_PATHS` (comma/newline paths for component-glob matching) |
| review-rules layer — operational rules live in the std SSOT tree (`harness/standards/areas/*.std.yaml`, `zone: operational`); `rule_view.load_rules_from_tree` selects rules whose scope intersects a diff and `hs:code-review` writes `rule-scan.json` (the flat `review-rules/` tree is retired). Per-rule `enabled:false` is the off-switch; author per-repo (layer-b) overrides in the folder. | `harness/standards/areas/*.std.yaml` + repo layer-b folder | shipped operational areas | edit the std tree, or add overrides in the layer-b folder | `HARNESS_USER_OVERRIDE` * (repo override file OR dir; overrides the `user_rules_dir` knob) |
| layer-b override folder — per-repo rules as a folder of `*.yaml` (`overrides:` lists merged); falls back to the legacy single `<root>/standards.user.yaml` when empty. | `harness/data/standards.yaml` (`user_rules_dir`) | `docs/standards/` | edit the knob | `HARNESS_USER_OVERRIDE` * (a file OR a dir wins over the knob) |
| standards-drift config (`drift.watch_trees`, `drift.context_docs`, `drift.structural_globs`) — feeds the `standards_drift` nudge (watched code trees vs auto-loaded prose docs) AND the Tier-2 `architecture_review` presence gate (`structural_globs`: a diff intersecting these must carry `architecture_review.checked==true`). Resolution precedence: `$HARNESS_STANDARDS_CONFIG` (a gitignored `.harness-dev/standards.yaml`-shaped file) → shipped `harness/data/standards.yaml drift:` → module constants, each fail-open. Shipped defaults are **GENERIC** cross-language (`src/ lib/ …`, `src/** lib/** …`), NEVER a specific repo's layout (a shipped value is every installer's default → leak). A repo whose trees differ sets its own via `.harness-dev`; an **empty `structural_globs` match set = Tier-2 dormant** for that repo. | `harness/data/standards.yaml` (`drift:`) | generic defaults | edit the shipped `drift:` (changes the default for everyone) or add a `.harness-dev/standards.yaml` override | `HARNESS_STANDARDS_CONFIG` * (file-path; `.harness-dev` dev override, gitignored + `HARNESS_*`-scrubbed at push) |
| rule-coverage gate ramp — the `_rule_scan_consistency` coverage branch refuses a `rule-scan.json` that omits an applicable operational rule (derived from `rule-scan.changed_files`). `off` = no-op, `soft` = warn-only (default for now), `hard` = block. | env only | soft | `export` | `HARNESS_RULE_COVERAGE` (off\|soft\|hard) |
| rule nudge — `rule_nudge_hook` names the review rules whose scope matches a file being written (capped by `nudge_max_rules`), once per file/session, fail-open. Default OFF; enabled per-repo via a gitignored `settings.local.json` env (NOT `harness-hooks.yaml`, so no manifest drift). | `harness/data/standards.yaml` (`nudge_max_rules`, default 3) | OFF / cap 3 | set the env in `settings.local.json`; edit the knob | `HARNESS_RULE_NUDGE` (truthy = ON) |
| shell-detector trust store — TOFU list of repo roots whose rule shell-detectors may auto-fire. Trust is the sole authorizer (base-verify is integrity-only, not an authorizer); trust is granted by the deliberate `/hs:setup` step, never on install. Per-machine, never in git; manage with `hs-cli trust`. | `~/.harness/trust.json` | empty (nothing trusted) | `hs-cli trust <repo>` | `HARNESS_TRUST_STORE` * (store path) |
| risk-rubric — `risk_rubric.derive_risk` maps a diff's files to `tiny`/`normal`/`high_risk` (hard-gate globs auth/migration/secret/api-contract force high_risk); the tier→ceremony map is skill-enforced (cook/code-review), NOT a hard gate. `enabled: false` collapses everything to tiny. | `harness/data/risk-rubric.yaml` | shipped (`enabled: true`, universal-minimal gates) | edit (gates/flags/thresholds/ceremony/`enabled`) | `HARNESS_RISK_RUBRIC` * |
| grace-expiry "now" — the date the DoD gate compares a grace's `expires` against; INJECTED for determinism (never a wall-clock read in the gate): env > repo HEAD commit date > `date.today()`. Past `expires` the gate stops honoring the grace and re-arms the full hard gate. | resolver in `artifact_check.py` | HEAD commit date | `export` | `HARNESS_NOW` (YYYY-MM-DD) |
| manual-test anchor session — when set, the `manual_test_anchor` PostToolUse hook records each Bash command as an anchor the DoD gate cross-checks (admissibility floor for manual evidence). | env only | off | `export` during a manual-test session | `HARNESS_MANUAL_TEST_SESSION` |
| standards line budget — advisory max lines for a standards doc, consumed by `install/_target_files._standards_maxloc()`. Env-only (no shipped config key); purely advisory (never gates). | env only | 800 | `export` | `HARNESS_STANDARDS_MAXLOC` |
| load/perf telemetry — `perf_telemetry.py` reads k6/JMeter JSON to `state/telemetry/perf-metrics.jsonl` and flags a p95 regression vs baseline as ADVISORY only (load is a measurement, never a hard gate). PRODUCER-ONLY today: no lens consumes `perf-metrics.jsonl` yet — the sink is retained for a future perf-trend lens, so the writer stays but nothing reads it back in-session. | (code, telemetry channel) | producing (unconsumed) | — | `HARNESS_TELEMETRY_DISABLED` (shared kill-switch) |
| `stale_plan_close_nudge` — advisory: on a publish-adjacent skill (hs:ship/hs:git), if the active plan is verified PASS but still `in_progress`, points at `close_plan.py` so it stops gating the next push/ship. Fail-open, never blocks. (A finished plan is closed deterministically by `close_plan.py`, called from cook finalize — a forgotten close is the failure this nudge catches.) | `harness/data/harness-hooks.yaml` | on | edit (`enabled: false`) | — |
| `glossary_pointer_inject` — SessionStart telemetry hook: emits a one-line additionalContext pointing at the glossary (term count + read-before-naming), re-firing on `/compact`. Read-only, fail-open; absent/empty `docs/glossary.yaml` → silent. (SessionStart additionalContext, NOT a Stop re-inject, so no runaway risk.) | `harness/data/harness-hooks.yaml` | on | edit (`enabled: false`); mirror in `.harness-dev/harness-hooks.yaml` | `HARNESS_TELEMETRY_DISABLED` (class kill-switch) |
| `glossary_capture_nudge` — Stop nudge (default ON, H1-resolved 260709): when a freshly-registered DEC coins a term the glossary lacks, surfaces a one-line advisory pointing at `/hs:remember` (throttled once/session); never writes the glossary, fail-open. | `harness/data/harness-hooks.yaml` | on | edit (`enabled: false`) to silence; mirror in `.harness-dev/harness-hooks.yaml` | — |
| `decision_reconcile_nudge` — Stop nudge (default ON): when the Decision Register has drifted ≥ N new DECs or ≥ M flips since the last reconcile marker, surfaces a one-line advisory pointing at `/hs:remember` → the `hs:decision-reconciler` agent (throttled once/session); Stop-only (count-triggered, no PostToolUse touched-flag), never blocks, fail-open. Thresholds in `decision-governance.yaml`. | `harness/data/harness-hooks.yaml` | on | edit (`enabled: false`) | `HARNESS_DECISION_RECONCILE_NUDGE` (1/true/yes/on) |
| autonomy level — cook's voluntary pause cadence, resolved by `autonomy_policy.py`: default pauses at plan-approve + ship, `ask_all` after every phase, `god` none. Hard stage gates apply at every level (no level self-ships). | env only | default | — | `HARNESS_AUTONOMY` (default\|ask_all\|god) |
| plan auto-finalize — the STATUS-FLIP half of `phase_progress_writer` (cook-end) + `auto_finalize_ship` (hs:ship backstop): auto-open a plan on each verification write, auto-close it when derive says N/N phases carry a PASS snapshot. A falsey value drops ONLY the flips — the per-phase evidence snapshot is still kept (harmless). Evidence-gated + trace-visible; never sweeps the corpus. | env only | ON | `export` | `HARNESS_AUTO_FINALIZE` (falsey `0`/`false`/`no`/`off` = flips OFF) |
| `cook.parallel` — opt-in multi-agent cook for independent phases (default OFF = sequential, non-breaking). Resolved by `cook_parallel_plan.py`: `--parallel` flag > env > config > default. Every slice verified before merge; full suite at the integration barrier; gates never bypassed. | `harness/data/cook.yaml` | false | edit, `cook_config.py --set`, `--parallel` (also via `/hs:setup`) | `HARNESS_COOK_PARALLEL` (1/true/yes/on) |
| `cook.parallel_max` — advisory cap on concurrent slices; the orchestrating agent applies it at fan-out (`cook_parallel_plan.py` emits the partition but does not enforce the cap). | `harness/data/cook.yaml` | 4 | edit or `cook_config.py --set` (also via `/hs:setup`) | — |
| decision-flip governance — `reconcile_threshold_new_decs` (N) / `reconcile_threshold_flips` (M) drive `decision_reconcile_nudge` + the release preflight reconcile gate; `confirm_ttl_s` is the TTL of a cross-scope confirm token (`decision_confirm.py`, read by the `decision_register.py` flip gate). Counter is advisory-only (flip-count via superseded-diff, not audit-grade). | `harness/data/decision-governance.yaml` | N=15 / M=8 / ttl=1800 | edit | `HARNESS_DECISION_GOVERNANCE` * (file-pointed) |
| telemetry hooks | (hook class, code) | on | — | `HARNESS_TELEMETRY_DISABLED` |
| hook crash log (exception metadata, no PII) | `harness/hooks/.logs/hook-crashes.log` | on | — | `HARNESS_HOOK_AUDIT_DISABLED` |
| standards line budget (advisory) | (installer warning) | 800 | `export` | `HARNESS_STANDARDS_MAXLOC` |
| write-guard (the config-edit gate itself) — `enabled` (`false` = break-glass: config files editable ONLY by a human editor OUTSIDE the agent session) + `extra_guarded` (add-only glob list). Read directly by `write_guard.py`; NOT affected by `HARNESS_HOOK_CONFIG`. | `harness/data/write-guard.yaml` | shipped (`enabled: true`) | edit by hand (break-glass) | `HARNESS_WRITE_GUARD_CONFIG` * |
| simplify-gate `mode` (`off`\|`warn`\|`block`) — the ship/pr/deploy diff-simplification gate (`simplify_gate.py`). AGENT-LOCKED (in write-guard's GUARD_LIST): an agent CANNOT edit it, and there is NO env override — only a human editing the file by hand changes it. | `harness/data/simplify-policy.yaml` | warn | edit by hand only | — |
| `mutation_guard` — `advisory_agents` (agent_types that must NOT mutate source mid-run) + `allow_paths` globs; content-hash snapshot at SubagentStart, diff at SubagentStop. DETECTION-only nudge, fail-open, default OFF per-agent. | `harness/data/mutation-guard.yaml` | shipped (off) | edit | — |
| review-policy — `profiles` (rounds/effort/scope/aspects) + per-stage floor + caps. OPTIONAL: absent ⇒ defaults (stage floors off, 3 built-in profiles; non-breaking). | `harness/data/review-policy.yaml` | absent ⇒ defaults | edit or `review_policy_config.py --set` | `HARNESS_REVIEW_POLICY` * |
| `hs:code-review` recall effort (`low`\|`medium`\|`high`\|`xhigh`\|`max`) → `fan_out`/`lenses`/`verify`; scales HOW Stage-2 findings are produced, NEVER the gate (verdict table + review-decision.json unchanged). Precedence: arg > env > file > default. | `harness/data/code-review.yaml` | low | edit; leading arg; `review_recall.py` | `HARNESS_REVIEW_EFFORT` |
| orchestration fan-out cap — `group_cap.{base,ceiling,floor}` (cross-skill spawn cap; self-discipline tier, not a boundary). Absent ⇒ defaults (old behaviour). | `harness/data/orchestration.yaml` | shipped | edit or `orchestration_config.py` | — |
| nudge-channels — per-nudge visibility as THREE independent flags `{model, user, stderr}` (the 4 legacy sink names `systemMessage`/`relay`/`stderr`/`off` are back-compat sugar only). | `harness/data/nudge-channels.yaml` | shipped | edit | `HARNESS_NUDGE_CHANNELS` |
| component selection — `components.{uiux,viz,devops,ai,stack,integrations,extra}` on/off; records ONLY deviations from ship-all (absent ⇒ enabled). `component_config.py` rewrites this + projects the state into `harness-hooks.yaml`. | `harness/data/component-policy.yaml` | ship-all | edit or `component_config.py` | — |
| context-surface — the optional HUMAN `systemMessage` mirror of the build_context reminder + the Stop model-channel pick. The MODEL always receives the full reminder; these knobs NEVER gate that off. | `harness/data/context-surface.yaml` | shipped | edit or `context_surface_config.py` | `HARNESS_CONTEXT_SURFACE` |

## Ownership, roster & identity

| Knob | File | Default | Change how | Env |
|---|---|---|---|---|
| `claims.lease_s` (claim lease seconds; `reviewers` / `allow_self_review` roster REMOVED under the personal-first posture) | constant + env (was `harness/data/team.yaml`) | 14400 | `export` | `HARNESS_CLAIM_LEASE_S` |
| fs_guard zones | `harness/data/ownership.yaml` | shipped | edit | `HARNESS_OWNERSHIP_FILE` * |
| per-agent_type write lanes (agent_rbac_guard) | `harness/data/agent-permissions.yaml` | shipped (default_deny + role lanes) | edit | `HARNESS_AGENT_PERMISSIONS_FILE` * |
| RBAC lane overlay — repo-local, ADD-only: role globs unioned into the base lanes (widen/add, never revoke) so a project grants an extra lane without editing the shipped table. Widens an active base; never arms an inert one. Distinct from `…_FILE` (which REPLACES the base path) | repo-local overlay file (e.g. `config/agent-permissions.overlay.yaml`, kept outside `harness/**` so it does not ship) | unset (no overlay) | `export` + write the overlay file | `HARNESS_AGENT_PERMISSIONS_OVERLAY` |
| recorded actor / agent | env | git email | `export` | `HARNESS_USER`, `HARNESS_AGENT` |
| remote notification relay — opt-in: `notify_remote.py` (Notification event) POSTs Claude's notification text to a webhook so unattended runs (AFK / `/goal`) reach the operator. https-only, no-op when unset, fail-open, URL never logged | env | unset (OFF) | `export` | `HARNESS_NOTIFY_WEBHOOK` |
| autonomy-loop context re-injection — `reinject_stop_context.py` (Stop event) re-emits voice+rules+context via a Stop `decision: block` + `reason` on a `/goal`/AFK continuation (stop_hook_active), since UserPromptSubmit does not fire there. VERIFIED (probe CC 2.1.201): a Stop `decision: block`+`reason` re-invokes the model with the reason as its context (documented channel), so emission is gated on an active-unmet `/goal` (transcript's last `goal_status` met:false) to avoid a self-sustaining runaway. Default ON; disable with `=0` (env-bound: restart the session). fail-open | env | unset = ON (goal-gated); disable = `0` | `export` | `HARNESS_REINJECT_STOP` |
| compaction pending-question re-surface — `pending_decisions_resurface.py` (SessionStart, gate `source=="compact"`) reads the transcript via `transcript_questions.py` (tail 256 KiB, reverse-scan for the last AskUserQuestion), and injects a one-shot additionalContext when that question is still open (unanswered, or answered with free text matching no option label); a clean option pick / no open question / any error → silent. nudge-class, fail-open. Unlike the Stop re-inject above, a SessionStart additionalContext only DECORATES the next turn (it does not re-invoke the model) → no goal-gate, no runaway. CC-internal transcript shape is version-fragile (pinned v2.1.195) so it fails open on drift. | `harness/data/harness-hooks.yaml` | on | edit (`enabled: false`) | — |

## Pipeline

| Knob | File | Default | Change how | Env |
|---|---|---|---|---|
| declared SDLC chains | `harness/data/skill-chains.yaml` | shipped | edit | `HARNESS_SKILL_CHAINS` * |
| critique `mode` (advisory\|gate) | `harness/data/critique.yaml` | advisory | edit or `critique_config.py --set mode=` (also via `/hs:setup`); per-run `--gate`/`--advisory`. mode=gate writes a verdict but enforces only when a stage lists `critique-consensus` in `requires:` | — |
| critique `lenses`/`loop`/`verdict` | `harness/data/critique.yaml` | shipped | edit (hand; structured) | — |
| task-store adapter — `provider` (`github`\|…) + `github.{base_url,repo,token_env,api_version}` + `timeouts`. The token is NEVER in the file: `token_env` only NAMES the env var holding each dev's PAT. | `harness/data/task-store.yaml` | provider `github` | edit | `HARNESS_TASK_STORE_CONFIG` |

After editing a tracked config, rebuild and re-verify is not required — these are
deployer-localized, so `verify_install --strict` treats edits as customization,
not drift (code still fails on any mismatch).

## Partner lane (ccs / provider-agnostic)

Opt-in second-engine lane run by a named ccs provider, ships OFF. SSOT
`harness/data/partner.yaml` — POLICY only (no provider list / no model tier;
provider discovery is a separate concern, `partner_transport.py` / `partner_preflight.py`).
Resolution is env-bound (`$HARNESS_PARTNER` > shipped) so a change needs a
**restart**, like guard/stage policy. Onboard via `/hs:setup`; delegate with `hs:partner`.

| Knob | File | Default | Change how | Env |
|---|---|---|---|---|
| `master` (kill-switch; off ⇒ whole lane inert) | `harness/data/partner.yaml` | **off** | edit | `HARNESS_PARTNER` * |
| `write` (`read_only` \| `worktree_staged`; a write always lands in a worktree) | `harness/data/partner.yaml` | read_only | edit | `HARNESS_PARTNER` * |
| `allow_live` (Layer-1 gate for `--live`; off ⇒ `--live` refused regardless of other axes) | `harness/data/partner.yaml` | off | edit | `HARNESS_PARTNER` * |
| `secret_scrub` (warn-only, never blocks a call) | `harness/data/partner.yaml` | warn | edit | `HARNESS_PARTNER` * |
| `purposes` (→ methodology-template key) / `timeouts` / `retry` / `cost_warn_usd` | `harness/data/partner.yaml` | shipped | edit | `HARNESS_PARTNER` * |

Forbidden states are normalized or rejected at load: `allow_live:on` + `master:off`
→ normalized off (`effective()`); `write:read_only` + `allow_live:on` → rejected
(loader). Reader: `partner_config.py` (`$HARNESS_PARTNER` env-bound — restart to bind).

## Gemini partner lane

Opt-in second-engine lane, ships OFF. SSOT `harness/data/gemini-partner.yaml`;
resolution is env-bound (`$HARNESS_GEMINI_PARTNER` > shipped) so any change needs a
**restart**, like guard/stage policy. Onboard via `/hs:setup`.

| Knob | File | Default | Change how | Env |
|---|---|---|---|---|
| master / mode / write / stop_review_gate | `harness/data/gemini-partner.yaml` | master **off** (whole lane inert) | edit | `HARNESS_GEMINI_PARTNER` * |
| `route_all_injection` (off\|on) | `harness/data/gemini-partner.yaml` | off | edit | `HARNESS_GEMINI_PARTNER` * |
| purposes→tier / overrides / timeouts / retry | `harness/data/gemini-partner.yaml` | shipped | edit | `HARNESS_GEMINI_PARTNER` * |
| `loop` {max_rounds, default_mode} | `harness/data/gemini-partner.yaml` | 3 / converge | edit | `HARNESS_GEMINI_PARTNER` * |
| skill `injectable` allowlist | each `SKILL.md` frontmatter | per-skill | `injectable_bootstrap.py --propose`→ratify→`--apply` | — |

`route_all_injection` gates ONLY the AUTO route-all injection of skill methodology;
manual `--skill` injection (Claude → gemini-relayer) is unaffected. Forbidden combos
reject at load: S8 (`route_all_injection`+`sandbox_write`), S9 (`route_all_injection`
without `mode: route-all`); S6' forces it off when master is off. Enabling injection
widens the egress blast radius (whole SKILL + cited rules + task context → Google;
`secret_scrub` is warn-only). `* env-bound — restart to bind.`

## Over-install cleanup (orphan sweep)

Two paths remove files a previous version left on disk; they are NOT
interchangeable:

| Path | What it does | When |
|---|---|---|
| `cleanup_orphans.py` (safe default) | classify orphans, back up, auto-remove only pristine version-dropped files + version-dropped symlinks (user-added files/symlinks are kept), defer modified ones | `install.sh` runs it on every upgrade; `hs:cleanup` / `hs-cli cleanup` re-runs it any time |
| `install.py --prune` (coarse) | unlink every orphan, no backup, no user-added/modified distinction | only to wipe a throwaway tree |

The safe path snapshots the OLD manifest before the over-install copies, so it can
tell version-dropped files from ones you added. It never touches `harness/state/`;
a first install (no old manifest) is a no-op, and a missing/unreadable NEW manifest
makes it refuse (no ground truth = no deletion). Backups land under
`harness/state/cleanup-backup/`.
