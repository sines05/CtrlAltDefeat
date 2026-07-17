---
name: hs:use
injectable: false
description: Run an install-disabled (off) skill from its stash + report; delegate discovery to hs:find-skills. Use when a skill is off.
argument-hint: "<skill> [args]"
allowed-tools: [Bash, Read, Grep, Glob, Skill]
metadata:
  compliance-tier: workflow
---

# hs:use — proxy to run an install-disabled skill

A fresh install can turn a skill **off** by omitting its dir (the only disable that works for a plugin skill). An off skill is not deleted: its dir is stashed under `harness/plugins/hs/disabled-skills/<name>/` and recorded in the omit list. `hs:use` is the controlled front door that **runs** one of those off skills from its stash without you having to re-enable it first.

`hs:use` owns exactly one job: resolve a named target and run it (or redirect a live one). **Discovery — listing off skills, or routing a free-text purpose to a skill — it does NOT own.** That belongs to `hs:find-skills`.

## Discovery is delegated (do not re-implement it)

- **MUST delegate** all discovery, listing, and purpose-routing to `hs:find-skills` — `hs:use` **NEVER** lists the catalog itself and **NEVER** re-derives a purpose→skill route. One owner for discovery means the off-skill catalog never forks.
- No argument, or a free-text purpose instead of a skill name → hand off to `hs:find-skills` (it tags any off match `[OFF — gọi: /hs:use <name>]`), then come back and run the name it returns.

## State source

State comes from one library, so the answer never drifts:

```bash
python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/disabled_skills.py --status <skill>   # live | disabled | unknown
python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/disabled_skills.py --path  <skill>    # abs stash dir
python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/disabled_skills.py --chain <skill>    # disabled deps, load order
```

## Run a named target (the one mechanism hs:use owns)

**MUST** resolve `disabled_skills.py --status <name>` FIRST — **NEVER** assume live vs off:

- **live** → **MUST delegate** to `/hs:<name>` and stop. **NEVER** paraphrase or reproduce a live skill's prose — that forks a second copy that drifts.
- **disabled** → **MUST** read `--chain <name>` (the off deps to load first, in load order); read each dep's stashed `SKILL.md`, then the target's stash `SKILL.md` (path from `--path`) + its `references/`, and perform its prose exactly, as if installed. After the run, **MUST emit** demand so the re-enable loop can see it:

  ```bash
  python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/emit_disabled_demand.py --skill hs:<name> --via proxy_run
  ```

  (Emit is fail-open telemetry — it never blocks the run. A live target emits NOTHING; the demand loop is only for off skills.)
- **unknown** → hand off to `hs:find-skills` to locate the right skill.

## Workflow

1. **Classify the argument** — a bare/normalized skill name → run it (below). No name, or a free-text purpose → **delegate to `hs:find-skills`**, then run the name it returns.
2. **Resolve state** via `disabled_skills.py --status` — never assume live vs off.
3. **Act**: live → delegate `/hs:<name>`; off → load the `--chain` + stash prose, run it, then emit demand.
4. **Report** what you did: which skill, its state, and — for an off skill you ran — the stash path you read plus the `hs_cli.py skills --enable <name>` command if the user wants it back permanently.

## Persistent on/off (toggle — batch)

Running an off skill is one-shot. To change what LOADS every session, toggle it. One command covers both a dev tree and an installed copy (it detects which):

```bash
python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/hs_cli.py skills --off drawio,vibe,shopify   # turn OFF (comma-list)
python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/hs_cli.py skills --on  vibe                  # turn back ON
```

- **Dev setup** (plugin loaded from the repo directory + a `.harness-dev/dev-off-skills.yaml` off-list): `--off/--on` edit that list and rebuild the curated symlink farm — the repo's `skills/` tree is never touched.
- **Installed copy** (no off-list file): `--off/--on` dir-omit into `disabled-skills/` (same as `--disable/--enable`).
- The 16-skill floor is refused. **A toggle only takes effect after you RESTART Claude Code** (the plugin catalog loads at session start) — always tell the user this.

Only run a toggle when the user ASKS to change what loads; to run an off skill once, use the proxy above instead (no restart, no toggle).

## Boundaries

- **Discovery is not yours.** Listing / purpose-routing → `hs:find-skills`, always.
- **Live → delegate, never duplicate.** For a live target `hs:use` only redirects to `/hs:<name>`; it never reproduces the skill's prose.
- **Never toggle during a run-once.** Running an off skill via the proxy NEVER moves dirs or edits the off-list. Persistent on/off is the explicit `--off/--on` toggle above — run it ONLY when the user asks to change what loads every session, and always name the restart.
- **Never edit a skill file** (live or stashed) while running it.
- Do not fabricate a skill or capability that `hs:find-skills` does not show.
