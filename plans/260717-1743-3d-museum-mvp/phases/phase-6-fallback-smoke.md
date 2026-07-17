---
phase: 6
title: "Fallback Smoke"
status: pending
plan: 260717-1743-3d-museum-mvp
created: 2026-07-17
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 6 — Fallback Smoke

## Overview

Validate the MVP path end-to-end and prove fallback/mobile behavior instead of assuming it. This phase owns smoke/perf/failure evidence only; product bugs found here go back to the owning phase, not random smoke-test patches.

## Scope

- Drive landing → scene → hotspot → QA citation → TTS play → forced fallback.
- Run failure drills for scene asset failure, QA unavailable/missing evidence, and TTS failure.
- Run at least one desktop browser smoke plus target mobile browser/device checks [ASSUMED target matrix: Android Chrome + iOS Safari].
- Record long-task/perf evidence on the demo-critical path; research flags >50ms as a long task and mobile frame budget as the bottleneck [plans/reports/3d-museum-mvp-research-260717.md:16-18,24-25,55-60].
- Do not add product features in this phase.

## Inputs

- P3 scene/fallback path.
- P4 avatar animation.
- P5 QA/TTS paths.
- Stage policy requiring verification before push/pr/ship [harness/data/stage-policy.yaml:25-52].

## Outputs

- E2E smoke tests and/or manual-test script for the mandatory path.
- Forced fallback tests.
- Failure drill evidence.
- Mobile/perf smoke record.
- Verification artifact: `verification-phase-6-fallback-smoke.json`.

## Touched Paths

Create [ASSUMED exact runner paths depend on P1 stack]:
- `tests/e2e/**`
- `tests/perf/**`
- `tests/mobile/**`

Modify:
- none expected in product code. If product code must change, return to owning phase and update this phase after fix.

Delete:
- none.

## Tests Before

- [ ] `test_mvp_happy_path_smoke`: FAIL until landing → scene → hotspot → QA → citation → TTS works.
- [ ] `test_forced_2d_fallback_smoke`: FAIL until forced fallback route/mode renders hotspot list + tour + transcript surface.
- [ ] `test_qa_tts_failure_drills`: FAIL until QA/TTS failures preserve readable content and recovery UI [docs/code-standards.md:80-83].
- [ ] `test_demo_path_long_tasks_under_budget`: FAIL or mark BLOCKED until browser perf evidence confirms no demo-critical long task >50ms [plans/reports/3d-museum-mvp-research-260717.md:16-18,24-25].

## Implement

1. Add a smoke runner for the exact MVP route; keep selectors stable and minimal.
2. Add a forced fallback switch using an existing capability/error hook from P3; do not add new product mode just for tests unless P3 already exposed one [ASSUMED exact hook].
3. Add failure-drill fixtures/mocks for QA unavailable, unknown question, and TTS timeout/error.
4. Add perf capture for scene load and first hotspot interaction; fail or record risk on >50ms long tasks.
5. Run smoke in desktop browser and on target mobile browsers/devices; record device/browser versions in verification.

## Tests After

- [ ] Happy path smoke passes.
- [ ] Forced fallback smoke passes without WebGL/3D dependency.
- [ ] QA unavailable/missing evidence keeps tour/citations visible.
- [ ] TTS failure keeps transcript visible.
- [ ] Mobile/perf evidence is recorded with browser/device names and long-task result.

## Regression Gate

- Run full Phase 1 command set.
- Run the E2E smoke command added in this phase [ASSUMED exact command until P1 stack/test runner exists].
- Run manual/real-device checklist if automation cannot drive iOS Safari; record as evidence, not a verbal claim.

## Acceptance

- [ ] Full MVP route passes at least once in an automated or tool-driven browser run.
- [ ] Fallback 2D route passes independently of 3D/avatar.
- [ ] At least one real mobile browser/device smoke is recorded, or the phase is BLOCKED with exact missing device reason.
- [ ] No long task >50ms is observed on the demo-critical path, or risk is explicitly marked PASS_WITH_RISK with captured evidence.
- [ ] No product code is modified in P6 unless routed back to the owning phase.
- [ ] `verification-phase-6-fallback-smoke.json` records all commands/checks and verdict.

## Rollback

- Revert `tests/e2e/**`, `tests/perf/**`, and `tests/mobile/**`.
- If P6 exposed a real product bug, do not hide it by deleting the smoke; fix via the owning phase then rerun P6.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Real mobile device/browser unavailable | M | H | Mark BLOCKED/PASS_WITH_RISK with exact missing device; do not claim mobile pass from desktop emulation. |
| Provider flakiness makes smoke nondeterministic | M | M | Mock failure drills separately; happy path can use deterministic test adapter if provider is unstable [ASSUMED]. |
| Perf regression found too late | M | H | P6 fails smoke rather than shipping; rollback to P3/P4/P5 owner depending on root cause. |
| Test harness changes product behavior | L | M | Use existing fallback/error hooks; no test-only product branch unless explicitly isolated. |
