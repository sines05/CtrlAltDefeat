---
phase: 4
title: "Verification"
status: completed
plan: 260718-2242-eager-guide-voice-fix
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 4 — Verification

## Overview
Lock the new guide eager policy, voice recovery path, and live capability lane with focused verification and a final regression sweep.

## Files
**Modify**
- `plans/260718-2242-eager-guide-voice-fix/artifacts/verification.json`
- docs/manual/tests from earlier phases only if final verification exposes wording drift

## TDD
- **Tests-before (RED)** none new; consume phase outputs.
- **Verify**
  - `node --test tests/perf/demo-path-budget.test.mjs tests/e2e/media-manifest-runtime.test.mjs`
  - `node --test tests/e2e/live-voice-smoke.test.mjs tests/api/live/live-relay.contract.test.mjs tests/scene/guide-voice-audio.test.mjs`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - If available, probe `/api/health` locally to confirm `qaLiveVoice.enabled` reflects the new config.
- **Tests-after**
  - Record verification artifact with exact commands and verdicts.

## Success
- [x] Guide eager policy is reflected consistently in manifest, tests, manual checklist, and docs.
- [x] Voice mic flow no longer wedges UI state and has a defined disabled/unavailable recovery path.
- [x] Lint, typecheck, build, and focused tests are green.

## Risks
- Final verification may expose an upstream/provider incompatibility that reopens phase 3.
- Docs can drift from the shipped runtime if focused verification is skipped.
