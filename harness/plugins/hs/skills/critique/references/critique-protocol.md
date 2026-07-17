# hs:critique — lens-set rationale (on-demand)

The fan-out mechanics (batching, lens independence, the finding contract, hand-off to the consolidator) live inline in `SKILL.md` step 2 now — load this file only when the *why* behind a lens-set pick needs justifying (e.g. proposing a new default in `critique.yaml`, or explaining to a user why `--lenses` overrides the config default).

## Why these lens sets

`harness/data/critique.yaml` ships the defaults; this is the reasoning behind them.

| Artifact type | Lenses | Why these |
|---|---|---|
| plan / decision / design | `hs:red-teamer`, `hs:independent-revalidator`, `hs:brainstormer`, `hs:product-value-critic`, `hs:market-fit-critic` | failure-mode + irreversibility; sealed-room re-derivation of the load-bearing claim; assumption / alternative challenge; desirability (real user need, riskiest assumption); positioning (alternatives, defensibility, value capture) |
| code / diff | `hs:red-teamer`, `hs:code-reviewer`, `hs:independent-revalidator` | attack surface; production-readiness (concurrency, trust boundary, N+1); independent re-derivation of a claimed result |

Each lens is an existing read-only agent that already carries the Evidence Filter (`harness/rules/verification-mechanism.md`): findings anchor to `file:line` / a reproduction / a triggering input, and separate `proven` from `suspected` (`[ASSUMED]`).

## Hand-off

For what to pass to `hs:critique-consolidator` and what comes back, see `consolidation-contract.md`.
