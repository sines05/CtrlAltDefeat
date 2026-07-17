# Review, audit & decision discipline (on-demand)

Load when reviewing code, applying audit feedback, deciding whether to reverse a prior call,
or cutting scope. These are the guardrails that keep a review from silently undoing verified
work or a user's decision.

## Verified decisions hold

Once verified by source, tests, or an empirical check, do not reverse on an abstract audit
concern — only on new evidence. State the verification source when rejecting a concern.

## User decisions are not silently undone

This includes thresholds, libraries, scope, schema, pricing, timelines, and UX. If an audit
suggests reversing one, present:

- the original decision
- the audit concern
- the trade-off
- the concrete options

Then wait for the user — do not self-apply the reversal.

## Scout first

For questions answerable by reading the repo, scout before asking. Ask only on conflicting
evidence, missing context, business judgment, or high reversibility risk.

## Threat-model before applying a security/robustness finding

Identify what the code actually stores, protects, or exposes; fix real failure modes, document
non-issues briefly. Ask when the risk is plausible but depends on product intent.
