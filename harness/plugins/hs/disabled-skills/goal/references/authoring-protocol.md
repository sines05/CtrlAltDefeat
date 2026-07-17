# Authoring protocol — preparing a built-in /goal run

`hs:goal` runs ONCE, at the start, then hands the loop to built-in `/goal`. This file is the detail behind the three START actions in `SKILL.md`.

## Why authoring-time, not loop-time

Verified from the binary: built-in `/goal` takes a string objective and self-iterates until its Stop-hook reports "met". Two facts shape everything here:

1. The loop **resets context every tick** and **never fires `UserPromptSubmit` mid-loop** — so the rule layer and terminal voice are NOT re-injected during the run (memory: autonomy-loop-bypasses-context-injection, verified 0/30).
2. Therefore the run cannot rely on anything held in conversation memory. It must work from FILES: a self-contained `goal.md`, the bell ledger, and the `cycle_N.md` breadcrumbs.

`hs:goal` cannot change the loop (built-in). What it CAN do is make the run self-sufficient before the loop starts.

## Action 1 — generate a NEW self-contained goal.md

Interview for three things, then write them into a fresh `goal.md`:

- **Objective** — the string the loop iterates toward.
- **Acceptance** — what "met" means concretely (the Stop-hook's target). Vague acceptance is the main way a goal run never ends or ends early.
- **Scope fence** — what is explicitly OUT, so the loop does not wander.

Include a pointer to `harness/rules/` in the file itself (the loop will not have the rules re-injected, so the reference must be IN the goal.md).

**Authoring boundary:** see SKILL.md Boundaries for the rule (always author a NEW `goal.md`). Editing an existing one would couple this run to another run's leftovers.

## Action 2 — arm the bell with a run tag

Arm `hs:autonomous-bell` (see its SKILL.md) keyed by the run tag (the cron id / goal run id). Two threads matter:

- The bell's stop decision is a consecutive-empty counter read from disk — the deterministic off-switch the memory-blind loop cannot make from recollection.
- The bell's backlog evidence is **run-scoped**: any backlog item the run defers is added with `source_ref: <run-tag>`, and the bell reads `autonomy_bell.py --backlog-signal --source-ref <run-tag>`. This is the producer side of the run scope the bell consumes — a global open item from another run must never pin THIS run to `found` (C2).

## Action 3 — scaffold the cycle dir

The built-in host writes `goal.md` to `goals/<goal_name>/goal.md` (relative to the launch cwd). Scaffold the cycle memory in that SAME dir — `goals/<goal_name>/cycle_N.md`, beside the host's `goal.md` — so each tick can append a breadcrumb the next tick reads. The shape and the read-latest/write-next protocol live in `references/cycle-convention.md`. The dir shares the goal run's lifecycle
(durable WITHIN one run only), and the whole `goals/` tree is gitignored — ephemeral per-run, never a tracked artifact.

## Then hand off

Start built-in `/goal iterate-until-met` and stop. `hs:goal` owns no iteration code: the built-in engine drives the loop, the bell owns the stop decision, and the cycle breadcrumbs carry memory across ticks. The skill's whole job was to make those three things possible before the loop began.
