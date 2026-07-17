# Model escalation (on-demand)

Load when a subagent or the current session hits a hard problem below the strongest model
and is tempted to switch the session model. This is the RAISE-the-model direction — the
mirror of `explore_model_guard`, which only ever lowers a spawn's model. The two are opposite
directions and do not conflict.

## When to escalate

When the current session or a subagent runs on a model below `fable` (e.g. `opus`, `sonnet`,
`haiku`) and hits a hard problem — **repeated failed attempts, a high-stakes design fork, or
requirements that stay fuzzy after scouting** — spawn the `escalation-consultant` agent for
counsel instead of switching the session model. It runs autonomously on the strongest
available model and returns full advice in one reply (no interview, no user round-trips). Give
it the task, evidence gathered so far (`file:line`), approaches tried, and the specific
question. It advises only; the caller stays responsible for the implementation.

Do not escalate on the first stumble. The bar is a genuine wall: stuck AND a repeated failure
(≥N tried) AND not resolvable by more scouting. For interview-driven advisory with user
participation, use `hs:advise` instead — the escalation-consultant never asks back.

## Fallback — catch-error, retry the fallback model

The spawn inherits `fable`. Fable is routed through a dedicated CCS instance; when one account
hits its quota the proxy rotates accounts transparently (the first layer — the caller does
nothing). The catch-error fallback is the backstop for when that layer is exhausted:

- Spawn succeeds and the counsel comes back on `fable` → use it.
- The spawn or its turn **throws** (a quota/entitlement error surfaced as `429` / `401` /
  `402`, or the model is unavailable) → **retry once with an explicit `model: opus`.** This is
  the main fallback path.
- (Secondary, optional) If CCS silently swapped the model, read the model at the transcript
  tail; if it is neither `fable` nor `opus`, consider a single opus retry.

This is not a hard failure: prefer `fable`, catch the error, retry `opus`, continue. The
`escalation-consultant` carries `mode: advisory` in `harness/data/model-policy.yaml`, so the
explicit `opus` retry is nudged, never blocked. The agent's own runtime note also degrades
gracefully to the runtime default when `fable` is unavailable.
