---
phase: 3
title: "Live Config Provider"
status: completed
plan: 260718-2242-eager-guide-voice-fix
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 3 — Live Config Provider

## Overview
Fix the recorded-audio path so mic input can reach the live backend when enabled, fail gracefully when disabled, and never leave the tour/UI stuck in voice mode. This phase owns frontend recorder/client logic plus the repo config lane that exposes live capability.

## Files
**Create**
- `tests/scene/live-voice-ui-state.test.mjs` (only if extending `guide-voice-audio.test.mjs` becomes too awkward)

**Modify**
- `apps/web/src/systems/UIController.js`
- `apps/web/src/main.js`
- `apps/web/src/qa/live-client.js`
- `apps/web/src/systems/TourManager.js`
- `.env.example`
- `render.yaml`
- `tests/e2e/live-voice-smoke.test.mjs`
- `tests/api/live/live-relay.contract.test.mjs`
- `tests/scene/guide-voice-audio.test.mjs`

## TDD
- **Tests-before (RED)**
  - Extend `tests/e2e/live-voice-smoke.test.mjs` with an audio + capability-disabled recovery case.
  - Extend `tests/scene/guide-voice-audio.test.mjs` or add one frontend mic-state test to prove:
    - empty recording does not wedge the modal/UI,
    - submit path resets recoverable state,
    - audio payload is sent exactly once.
  - Re-run `node --test tests/api/live/live-relay.contract.test.mjs` to protect MIME/route validation.
- **Implement**
  - Choose a supported `MediaRecorder` MIME via `MediaRecorder.isTypeSupported`.
  - Reset UI cleanly on empty blob, recorder failure, and submit completion.
  - Stop dropping audio at the UI seam when `liveCapability.enabled === false`; return a defined recovery state instead.
  - Reset `QUESTION_VOICE` to `WATCHING_DIALOGUE` after submit or close.
  - Expose `GEMINI_LIVE_QA_ENABLED=1` in `.env.example` and `render.yaml`.
  - Treat frontend/state fixes as the first lane; only reopen provider transport if focused evidence still shows upstream audio incompatibility after MIME/state/config fixes.
- **Tests-after**
  - Re-run the focused frontend + live route set until green.

## Success
- [x] A mic attempt either reaches the live route once or returns a defined recovery state; it never silently dies.
- [x] The frontend is never stuck in `QUESTION_VOICE` after a voice attempt.
- [x] Supported recording MIME is chosen explicitly instead of relying on browser default.
- [x] Repo config makes live capability opt-in explicit and testable.

## Risks
- Browser/container audio may still be incompatible with upstream Gemini Live even after MIME selection.
- Tightening state transitions in `TourManager` can break continue/type/voice buttons if the reset point is wrong.
