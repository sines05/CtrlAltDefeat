---
phase: 1
title: "Lock REST Grounding Contracts"
status: pending
plan: 260718-1059-gemini-live-voice
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 1 — Lock REST Grounding Contracts

## Overview
Extract a reusable grounding seam from `services/api/src/qa/index.js:181-267` without changing the REST response shape, so the Live relay can reuse the exact same retrieval/citation logic and the current `/api/qa` path stays a stable rollback anchor.

## Files
- **Modify** `services/api/src/qa/index.js`
- **Modify** `tests/api/qa-tts/qa-tts.contract.test.mjs`
- **Modify** `tests/e2e/mvp-smoke.test.mjs`
- **Modify** `docs/engineering/qa-grounding-prompt.md`

## TDD
### Tests Before
- [ ] `node --test tests/api/qa-tts/qa-tts.contract.test.mjs tests/e2e/mvp-smoke.test.mjs` locks the current citation refs, abstain behavior, and TTS handoff before the seam exists.
- [ ] Add a parity assertion that the seeded grounded answer still cites `content/approved/chunks/hotspot-01.json` for the current known question before any refactor.

### Implement
1. Extract a shared grounding helper from `answerQuestion` that returns the approved source/signoff/chunk selection and citation inputs.
2. Keep `answerQuestion` as the REST wrapper; do not move retrieval rules out of `qa/index.js`.
3. Make the seam export explicit so the Live relay can import it without duplicating ranking or citation assembly.
4. Update the grounding prompt doc so it no longer implies the old REST-only model path is the live transport.

### Tests After
- [ ] `node --test tests/api/qa-tts/qa-tts.contract.test.mjs tests/e2e/mvp-smoke.test.mjs` still passes with identical citation refs and abstain behavior on the same approved corpus.
- [ ] The new seam test proves the Live relay can reuse the same grounded chunk selection without changing REST output.

### Regression Gate
`npm run lint && npm run typecheck && npm run build && node --test tests/api/qa-tts/qa-tts.contract.test.mjs tests/e2e/mvp-smoke.test.mjs`

## Success
- [ ] `answerQuestion` still returns the same known citation ref for the seeded question set.
- [ ] Unknown questions still abstain with the same `abstainReason` contract.
- [ ] No response shape change leaks into `/api/qa` or `/api/tts`.
- [ ] The grounding seam is reusable by the Live relay without importing provider code into the QA layer.

## Risks
- Likelihood: M. Impact: H. Retrieval ranking or abstain thresholds can drift when the seam is extracted.
- Mitigation: snapshot the current contract tests first, keep the helper pure, and do not change the approved corpus or citation ordering rules.
