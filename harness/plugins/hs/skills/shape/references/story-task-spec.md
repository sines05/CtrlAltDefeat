# Story → task decomposition flow (BA)

How `hs:shape --task` turns an approved PO story into one or more dev-task sidecar records,
and how that BA output later feeds `hs:plan`'s intake.

## Flow

1. **Read the PO story graph.** `hs:shape` reads (never writes) `hs:spec`'s
   `spec_graph.build_graph(root)` output — the same traceability graph hs:spec builds from
   `docs/product/{vision,brd,prds,epics,stories}`. This is how a BA sees which story ids exist
   to `serves` against.
2. **Decide the decomposition.** The BA (human-in-the-loop) looks at one story — or a small
   related cluster — and decides how many tasks it needs, and whether any task also covers
   other stories (the n-1 shape: e.g. a shared auth-session migration several login/signup/reset
   stories all depend on).
3. **Author each task.** `task_model.author(root, serves=[...], title=..., estimate=...,
   depends_on=[...], acceptance=[...])` allocates the next `TASK-<n>` and writes it under
   `docs/product/shape/tasks/TASK-<n>.md` via `shape_path()` (write containment — never touches
   `docs/product/stories/`).
4. **Resolve + flag.** `serves_resolver.resolve_serves(root, tasks)` (or
   `resolve_serves_from_dir(root)` to pick up everything already on disk) builds the
   story<->task map and flags any `serves` id that does not resolve to a real story node —
   dangling, not rejected, so recording intent ahead of the story landing is allowed.
5. **Hand off to Dev.** The resulting task list (with its `serves` map) is BA→Dev plan intake —
   `hs:plan` consumes it the same way it consumes any other pre-decomposed work list; `hs:shape`
   does not reinvent phase planning — it produces the task list `hs:plan` consumes, not a second
   decomposition engine. Once a plan is approved,
   `hs:cook` → `hs:test` → `hs:code-review` close the Dev/Test half of the loop — that half is
   already closed by the harness's existing gates; this flow only closes the PO→BA→Dev seam.

## What this flow deliberately does NOT do

- It never mutates a PO story file — `docs/product/stories/` is read-only from `hs:shape`'s
  side, enforced by `shape_path()`, not just by convention.
- It never assigns story points or hours to the PO story itself — a BA `estimate` lives only in
  the sidecar task record, respecting `hs:spec`'s deliberate "no story points in the story"
  boundary (`guardrails-and-boundaries.md`).
- It never invents a second decomposition/planning engine — the task list is the seam
  `hs:plan` intake reads; the phase-graph machinery stays `hs:plan`'s job.

## Independence from `strict_gate.py`

`hs:spec`'s `strict_gate.py` can read shape task frontmatter as DATA (e.g. to flag an orphaned
`serves` at PO validate time), but it does not import `serves_resolver.py` or `task_model.py` —
that would couple the PO validate gate's code to the BA layer's implementation, which the
PO/BA layering forbids. If `strict_gate.py` needs the same dangling-detection logic, it
re-reads the task files and the graph itself rather than calling into this skill's scripts.
