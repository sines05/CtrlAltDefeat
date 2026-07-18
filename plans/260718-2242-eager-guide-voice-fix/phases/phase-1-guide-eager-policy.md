---
phase: 1
title: "Guide Eager Policy"
status: completed
plan: 260718-2242-eager-guide-voice-fix
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 1 — Guide Eager Policy

## Overview
Flip guide animated assets from accidental eager behavior into explicit product policy. This phase only changes manifest/adapter/tests/docs contract so the repo stops contradicting itself before any runtime optimization work begins.

## Files
**Modify**
- `content/approved/media/tay-ho-giay-do-room-01.json`
- `apps/web/src/media/manifest-adapter.js`
- `tests/perf/demo-path-budget.test.mjs`
- `tests/e2e/media-manifest-runtime.test.mjs`
- `tests/mobile/manual-checklist.md`
- `docs/system-architecture.md`
- `docs/code-standards.md`
- `docs/engineering/api-contract.md`
- `README.md`
- `docs/submission-overview.md`

## TDD
- **Tests-before (RED)**
  - `node --test tests/perf/demo-path-budget.test.mjs tests/e2e/media-manifest-runtime.test.mjs`
  - Expect current assertions to conflict with intentional eager guide policy.
- **Implement**
  - Mark the 4 guide FBX as `preload: "eager"` and document that this means eager guide promotion after shell/bootstrap, not a blanket startup rule for all media.
  - Preserve `preload` in manifest adapter so tests/runtime can distinguish guide eager from other media.
  - Update perf/e2e/manual/docs wording to allow guide eager post-bootstrap while keeping prop/video lazy semantics.
- **Tests-after**
  - Re-run the same focused tests until green.

## Success
- [x] Only the guide assets change preload policy; videos and non-guide scene props remain lazy by contract.
- [x] No doc/test still calls guide eager a bug or deferred mismatch.
- [x] Manifest adapter exposes preload metadata instead of dropping it.

## Risks
- Over-correcting docs into “everything can eager-load” language.
- Touching too many runtime files before the policy contract is stable.
