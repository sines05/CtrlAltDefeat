# hs:use — running an off skill in detail

`hs:use` is the controlled front door that **runs** a skill this install turned **off** (omitted at the dir level — the only disable that works for a plugin skill). A disabled skill is not gone: its dir is stashed under `harness/plugins/hs/disabled-skills/<name>/` and recorded in `harness/state/install-omitted-skills.json`. This drawer is the full contract behind the thin SKILL.md.

**Scope:** `hs:use` runs ONE named target. It does NOT list the catalog and does NOT route a free-text purpose — that is `hs:find-skills`' job. **MUST delegate** all discovery to `hs:find-skills`; **NEVER** re-implement a `--list` or purpose-route here.

## State source — delta on SKILL.md

Same three `disabled_skills.py` flags as SKILL.md's State source block. Added detail:
`--status`/`--chain`/`--path` take an explicit multi-source view internally, so when a later
phase adds a cache source the same commands keep working unchanged.

## Run a named target — step-by-step detail

Elaborates SKILL.md's live/disabled/unknown branches (read that first for the rule; this is the
mechanics):

- **live** → `hs:use` adds nothing beyond the `/hs:<name>` redirect. Live targets emit NO demand.
- **disabled** → load the whole off tail, run it, then record demand:
  1. `disabled_skills.py --chain <name>` → the disabled deps that must load first, in load
     order. Read each one's stashed `SKILL.md` (+ its `references/`) so the target's
     handoffs resolve.
  2. Read `harness/plugins/hs/disabled-skills/<name>/SKILL.md` (path from `--path <name>`)
     and its `references/`, then perform the skill's prose exactly as written — same behavior
     as if installed.
  3. After the run, **MUST emit** demand so `lens_skill_usage` can see the re-enable signal:

     ```bash
     python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/emit_disabled_demand.py --skill hs:<name> --via proxy_run
     ```

     Emit is fail-open telemetry (deduped per session) — it never blocks the run.
- **unknown** → not a real skill name. Hand off to `hs:find-skills` to locate the right one (it may be a live skill under a different name).

Boundaries (discovery/delegate/toggle/edit/fabricate rules) live only in SKILL.md — see there, not
restated here.
