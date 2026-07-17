---
phase: 4
title: "Avatar Animation"
status: pending
plan: 260717-1743-3d-museum-mvp
created: 2026-07-17
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 4 — Avatar Animation

## Overview

Gắn một avatar pre-rigged vào scene shell và cho chạy một animation dựng sẵn. Đây là phase asset-heavy: research đã chốt rằng core 3D không phải vấn đề chính; vấn đề là sourcing, cleanup, integration, và tránh runtime scale làm hỏng secondary animation [plans/reports/3d-museum-mvp-research-260717.md:13-18,22-25,33-35,55-60].

## Scope

- Chọn một avatar pre-rigged thật, ưu tiên VRM-style hoặc GLB đã rig sẵn [plans/reports/3d-museum-mvp-research-260717.md:38-41,63-65].
- Load avatar vào scene shell và play đúng một prebuilt animation clip.
- Bake/lock scale trước runtime; không dùng lip-sync.
- Nếu avatar fail load, scene shell vẫn sống và fallback 2D không vỡ.

## Inputs

- P3 scene shell.
- One candidate avatar asset with license and size acceptable [ASSUMED asset candidate].
- Three.js / avatar runtime chosen in P1.
- Probe expectation from prior run: Three.js animation mixer on this host already advanced and rendered WebGL2 [/tmp/three-probe/index.html:1-36][PRIOR].

## Outputs

- Avatar asset module/manifest.
- Scene integration that renders the avatar and plays one animation.
- Asset load/degrade tests.
- Verification artifact: `verification-phase-4-avatar-animation.json`.

## Touched Paths

Create [ASSUMED exact filenames depend on stack lock]:
- `assets/avatar/**`
- `apps/web/src/avatar/**`
- `tests/avatar/**`

Modify:
- `apps/web/src/scene/**`

Delete:
- none.

## Tests Before

- [ ] `test_avatar_asset_manifest_exists`: FAIL until a real pre-rigged avatar asset is referenced by manifest/path.
- [ ] `test_avatar_animation_clip_advances`: FAIL until one prebuilt animation plays in the renderer.
- [ ] `test_avatar_scale_is_locked`: FAIL until runtime scale changes are prohibited or converted to a baked asset path [plans/reports/3d-museum-mvp-research-260717.md:22-25,33-35].
- [ ] `test_avatar_failure_degrades_to_scene_only`: FAIL until avatar load failure does not break the room shell or fallback [docs/code-standards.md:80-99].

## Implement

1. Pick one asset candidate and import it end-to-end; do not spend time on custom rigging.
2. Add avatar loader/adapter module and connect it to the scene shell mount point.
3. Play one animation clip on load and keep it visually obvious but minimal.
4. Bake or freeze scale/orientation before runtime if the asset requires it.
5. Keep the fallback path intact when the asset is missing or malformed.

## Tests After

- [ ] Avatar loads from a real asset path and renders in the room.
- [ ] One animation clip plays and advances in the browser.
- [ ] Runtime scale is not required for the working path.
- [ ] Avatar load failure falls back to scene-only / 2D mode without crash.
- [ ] No lip-sync hooks exist.

## Regression Gate

- Run avatar tests with the Phase 1 command set.
- Then rerun the full Phase 1 command set: `<package-manager> test`, `<package-manager> lint`, `<package-manager> typecheck`, `<package-manager> build` [ASSUMED exact executable until P1 locks stack].

## Acceptance

- [ ] One pre-rigged avatar is visible in the room.
- [ ] Exactly one prebuilt animation is exercised in the MVP path.
- [ ] No runtime rigging or lip-sync code exists in this phase.
- [ ] Asset cleanup did not break fallback or scene shell.
- [ ] `verification-phase-4-avatar-animation.json` records load and animation evidence.

## Rollback

- Revert `assets/avatar/**`, `apps/web/src/avatar/**`, `tests/avatar/**`, and the `apps/web/src/scene/**` integration that mounts the avatar.
- Keep Phase 3 scene/fallback code if it still passes without the avatar.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Asset sourcing/license/cleanup consumes too much time | H | H | Time-box one real asset probe; keep the path minimal and reject custom rigging. |
| Runtime scale breaks spring/secondary animation | M | H | Bake scale/orientation before runtime; never scale live [plans/reports/3d-museum-mvp-research-260717.md:22-25,33-35,55-60]. |
| Avatar import bloats mobile memory | M | M | One asset only; no extra animation states, no lip-sync. |
