---
name: hs:insights
injectable: true
description: "Surface read-only usage insights from harness telemetry — hot vs never-used skills, workflow chains, gate-block patterns — and propose end-user optimizations. Use when reviewing how the harness is actually used. Advisory only; never mutates. Pairs with hs:retro (git-history) and hs:setup (to act on a suggestion)."
allowed-tools: [Bash, Read]
argument-hint: "[--days N] [--lens workflow|skill_usage|session|gate|perf_trend|all]"
metadata:
  compliance-tier: workflow
---

# hs:insights — read-only usage insights

Aggregates the harness telemetry sinks (`harness/state/telemetry/*.jsonl`) through the read-only lens front-end and narrates what the numbers say, then proposes optimizations the user can act on. It NEVER mutates config, code, skills, or telemetry — every suggestion is advisory, and acting on one goes through the normal tools (`/hs:setup`, a skill edit, a backlog entry).

This is the telemetry twin of `hs:retro` (which reads git history). Use both for a full picture.

## Flow

1. **Gather** (read-only, deterministic):

   ```bash
   python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/analyze_telemetry.py --lens all --days 30
   ```

   Add `--days N` to widen/narrow the window, `--lens skill_usage` (or `workflow`) for one lens, `--format json` if you want to post-process. The command prints a `## NOT measured` block — read it: it enumerates what telemetry does NOT capture (cost, correctness, non-script wall-clock). Do not let a clean number read as full coverage.

2. **Respect the gates.** Each lens carries `gated` / `sufficient`. When `gated: true` the data is below the low-volume threshold — report the raw counts but SUPPRESS recommendations (sparse data is noise). Say so explicitly rather than over-reading three data points.

3. **Narrate + propose.** For the data that IS sufficient, surface:
   - **Hot skills** — the most-invoked; candidates to keep fast and well-documented.
   - **Never-invoked owned skills** (`never_used_owned`) — trim/merge candidates. RAISE them; never
     auto-remove. A skill may be new, seasonal, or load-bearing-but-rare — ask before cutting.
   - **Workflow chains** vs declared (`skill-chains.yaml`) — undeclared common chains may be worth
     declaring; declared-but-unused chains may be stale.
   - **Gate-block / bypass patterns** — recurring `write_guard_bypass` or gate blocks in
     `hook-telemetry.jsonl` suggest a detector that is too tight or a workflow papering over a gate.
   - **Session shape** (`--lens session`, over `sessions.jsonl`) — duration p50/p90, the tool mix,
     files-modified + subagent totals, sessions/day. Where the real time goes.
   - **Gate advisory/block trend** (`--lens gate`, over the gate trace) — pass / block / **advisory**
     / skip counts per stage + hook, with the top block/advisory reasons. Personal-first: local
     advises rather than blocks, so a rising `gate_advisory` count is the "how many receipt gaps
     would gate on remote" signal — surface it, do not treat it as a block.

4. **Hand off, do not act.** If a suggestion is config (voice, guard, roster, language) point at `/hs:setup`. If it is a skill change, record it via `backlog_register.py add`. If it is a stage/detector tuning, describe the change and let the user decide — detector loosening is a posture decision.

## Boundaries

- READ-ONLY: this skill runs `analyze_telemetry.py` (which never writes) and reads JSONL sinks. It must not edit telemetry, config, or code. Producing a report is the whole job.
- Render reports per `harness/rules/output-rendering.md`: resolve `language` / `audience` / `humanize` live via `python3 "${HARNESS_BIN_ROOT:-.}"/harness/scripts/output_config.py --resolved` (never hand-read the tracked file); the rule holds the register behavior and the evidence-invariant fence.
- Never present a suggestion as a decision already made. The user adjudicates; the lens only counts.
