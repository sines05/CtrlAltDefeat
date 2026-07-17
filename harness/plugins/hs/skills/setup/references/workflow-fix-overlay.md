---
name: workflow-fix-overlay
description: Grant the workflow-subagent code-fix lane per-repo so a Workflow-orchestrated --fix does not block mid-run.
---

# Workflow `--fix` code-lane (opt-in overlay)

When `code-review --fix` or `security-scan --fix` runs through the ultracode Workflow, the edits are made by a `workflow-subagent`. That subagent ships only the conservative `plans/**` lane (reports/artifacts), so an attempt to edit code (`harness/**`, `src/**`, …) is blocked by `agent_rbac_guard` **mid-run** — wasted tokens, stalled work. Set the overlay ONCE at setup time to avoid that
surprise.

Grant the code-lane for THIS repo via the **add-only** overlay — never hand-edit the shipped
`agent-permissions.yaml`:

```yaml
# config/agent-permissions.overlay.yaml — kept outside harness/** so it never ships
roles:
  workflow-subagent: ["src/**", "lib/**"]   # the dirs Workflow --fix may edit in this repo
```

```bash
export HARNESS_AGENT_PERMISSIONS_OVERLAY="$(git rev-parse --show-toplevel)/config/agent-permissions.overlay.yaml"
```

Properties:

- **add-only** — the overlay widens the base lanes, it never revokes one;
- **git-visible** if you commit the overlay file (the env points at it; the file itself is inert until a shell `export`s the env);
- **reversible** by unsetting the env;
- **push-safe** — the pre-push hook scrubs every `HARNESS_*` variable, so the overlay never reaches the push gate.

Skip the overlay entirely and Workflow `--fix` still works — it just edits inline on the parent instead of through a `workflow-subagent`. Background: `harness/rules/orchestration-protocol.md` (Ultracode Workflow section) and the RBAC lane overlay row in `harness/rules/config-reference.md`.
