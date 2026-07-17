---
name: hs:manual-test
injectable: false
description: Run a session-based manual/exploratory test (SBTM charter → session → debrief) and emit anchored, admissible evidence. Use for behavior a static result file cannot capture — exploratory passes, manual API/UX checks, staging smoke. The result must be admissible at a gate.
allowed-tools: [Bash, Read, Write, Grep, Glob, Task]
argument-hint: "[interactive|auto] [charter: what to explore]"
metadata:
  compliance-tier: workflow
---

# hs:manual-test — session-based manual testing with admissible evidence

Manual/exploratory testing that produces evidence a gate can READ — not a prose claim. Follows SBTM: **charter → session → debrief**. The output is admissible only to the floor its evidence earns (see Admissibility); it never overclaims.

## Charter → session → debrief

1. **Charter** — one focused mission for the session (≤ one paragraph): what area, what risk, what "done" looks like. For a HARD gate the charter must be
   **co-signed** by a rostered reviewer distinct from the author (reuse `plan_approval`); without a co-sign the result is soft.
2. **Session** — timeboxed exploration. Run real commands. **Set `HARNESS_MANUAL_TEST_SESSION=1`** so the `manual_test_anchor` hook records each Bash command as a telemetry anchor (the hook witnesses the command + output; you cite the anchor, you do not assert it).
3. **Debrief** — the PROOF table, written to the verification artifact as a `manual` check (see Evidence).

## Admissibility — claim TRUTHFULLY (the floor, not forgery-proof)

A telemetry anchor proves *a real command ran and this is its real output* — it kills pure fabrication. It does **not** prove the command tested the right thing (an agent can run a real command against the wrong endpoint and cite a real trace). So:

| Evidence | Admissible at |
|---|---|
| `claimed` (agent-written, no anchor) | soft only |
| `anchored` (anchor id present in the hook telemetry) | soft |
| `anchored` + human charter co-sign | **hard** |
| `anchored` with a fabricated anchor id | rejected |

Never describe anchored evidence as "forgery-proof". The co-sign is the human judgement the machine cannot supply.

## Evidence — the `manual` check in verification.json

Write the manual result as a check the DoD gate re-reads (it does not trust the status):

```json
{ "name": "manual", "format": "manual", "status": "PASS",
  "evidence_tier": "anchored", "anchor_id": "<from the hook telemetry>",
  "actor": "user:<author>", "charter_cosign": "user:<reviewer>|null" }
```

The gate (`artifact_check.evaluate_test_policy`) cross-checks the anchor and the co-sign; a `manual` type is required only when a tier-2 policy or component declares it (opt-in). Details: `references/sbtm.md`.

## Boundaries

- Manual-test is **opt-in**: it gates nothing unless a policy requires `manual`.
- The contract-validation probe (`hs:contract-test`) rides this `manual` check and the same admissibility — it adds no new tier; it is one way to generate the anchored evidence.
- The anchor is tamper-EVIDENCE, not authentication — the agent has no write path into the anchor trace; a citation that is not in the telemetry is rejected.
- e2e / staging smoke / visual export JUnit and ride the normal DoD reader — only the human/exploratory tier needs this skill.
