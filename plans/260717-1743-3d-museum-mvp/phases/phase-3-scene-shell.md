---
phase: 3
title: "Scene Shell"
status: pending
plan: 260717-1743-3d-museum-mvp
created: 2026-07-17
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 3 — Scene Shell

## Overview
Dựng một shell phòng 3D stylized với 3–5 hotspot, static scene/tour endpoints, và fallback 2D thật. Fallback ladder là bắt buộc: WebAR/3D viewer/2D không được vỡ luồng khi runtime 3D lỗi [docs/system-architecture.md:83-89][docs/code-standards.md:80-99].

## Scope
- Render một phòng museum-room stylized bằng runtime web đã khóa ở P1.
- Implement `GET /api/scene/{sceneId}` và `GET /api/tour/{tourId}` as static endpoints từ approved content P2 [docs/engineering/api-contract.md:18-47].
- Load scene/tour/hotspot data từ approved content P2, không hardcode text dài trong UI [docs/code-standards.md:58-63].
- Hiển thị 3–5 hotspot clickable và tour 5 bước [docs/decisions/0001-mvp-scope.md:11-18].
- Luôn có fallback 2D: poster/card + hotspot list + tour text.
- Không tích hợp avatar, Q&A, TTS, STT, lip-sync, hoặc advanced WebAR.

## Inputs
- P1 app/runtime/test commands.
- P2 approved content + explicit signoff artifact.
- API scene/tour contract [docs/engineering/api-contract.md:18-47].
- Prior Three.js probe result as [PRIOR] support for generic animation/WebGL feasibility [/tmp/three-probe/index.html:1-36].

## Outputs
- Scene entry route/page that loads the one-room shell.
- Static `GET /api/scene/{sceneId}` and `GET /api/tour/{tourId}` endpoints wired to approved content.
- Hotspot overlay/list wired to approved content IDs.
- 2D fallback mode reachable by capability failure or explicit query/dev toggle [ASSUMED exact trigger].
- Verification artifact: `verification-phase-3-scene-shell.json`.

## Touched Paths
Create [ASSUMED exact filenames depend on P1 stack]:
- `services/api/src/scene/**`
- `services/api/src/tour/**`
- `apps/web/src/scene/**`
- `apps/web/src/hotspots/**`
- `apps/web/src/fallback/**`
- `tests/scene/**`
- `tests/api/scene-tour/**`

Modify:
- `apps/web/src/**` entrypoint/router shell [ASSUMED exact file path].

Delete:
- none.

## Tests Before
- [ ] `test_scene_api_returns_approved_scene_config`: FAIL until `/api/scene/{sceneId}` returns approved scene metadata [docs/engineering/api-contract.md:18-33].
- [ ] `test_tour_api_returns_five_steps`: FAIL until `/api/tour/{tourId}` returns exactly 5 approved steps [docs/engineering/api-contract.md:34-47].
- [ ] `test_hotspot_count_is_3_to_5`: FAIL until UI renders 3–5 hotspot controls from approved IDs.
- [ ] `test_2d_fallback_renders_without_webgl`: FAIL until fallback mode renders poster/card + hotspot list instead of crashing [docs/system-architecture.md:83-89].
- [ ] `test_tour_text_visible_in_fallback`: FAIL until fallback shows tour text/citations needed by non-3D mode [docs/code-standards.md:80-99].

## Implement
1. Build a low-asset room shell first: simple geometry/materials or a single curated lightweight room asset [ASSUMED asset choice]; do not wait for avatar.
2. Add static scene/tour API adapters that read P2 approved content and return the contract payloads.
3. Map hotspot positions/labels to P2 content IDs; keep hotspot count configurable only through content data.
4. Add capability/error branch that renders fallback 2D rather than a dead canvas.
5. Expose tour controls/text in both 3D and fallback views.
6. Keep WebAR as optional future layer; do not implement marker tracking here.

## Tests After
- [ ] Scene route/page renders one room and approved scene metadata.
- [ ] `/api/scene/{sceneId}` and `/api/tour/{tourId}` return approved payloads from P2.
- [ ] Hotspot count is between 3 and 5 and every hotspot click reveals approved body/citation reference.
- [ ] Fallback mode renders without WebGL and preserves tour/hotspot content.
- [ ] Loading/degraded/fail states are visible and recoverable [docs/code-standards.md:80-83].

## Regression Gate

- Run scene/hotspot/fallback tests with the Phase 1 test command.
- Rerun full Phase 1 command set: `<package-manager> test`, `<package-manager> lint`, `<package-manager> typecheck`, `<package-manager> build` [ASSUMED exact executable until P1 locks stack].

## Acceptance
- [ ] One stylized room is visible in the main path.
- [ ] 3–5 hotspots are reachable by keyboard/pointer [ASSUMED accessibility test exactness until stack/UI library chosen].
- [ ] `GET /api/scene/{sceneId}` và `GET /api/tour/{tourId}` return approved data and are owned by P3.
- [ ] Fallback 2D is not just an error page; it contains poster/card, hotspot list, and tour text.
- [ ] No avatar/QA/TTS implementation appears in this phase.
- [ ] `verification-phase-3-scene-shell.json` records scene + fallback evidence.

## Rollback

- Revert `apps/web/src/scene/**`, `apps/web/src/hotspots/**`, `apps/web/src/fallback/**`, and `tests/scene/**`.
- If rollback is partial, keep fallback 2D only when its tests still pass; otherwise revert the whole phase.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WebGL/canvas path fails on target browser | M | H | 2D fallback built in same phase and tested before avatar polish. |
| `/api/scene` or `/api/tour` drift from P2 content | M | H | Keep static adapters in this phase and test against approved IDs. |
| Room asset becomes cleanup sink | M | H | Prefer primitive/stylized shell first; postpone prop polish. |
| Hotspot copy drifts from approved content | M | M | UI reads IDs from P2 data; no long text hardcoded in UI. |
