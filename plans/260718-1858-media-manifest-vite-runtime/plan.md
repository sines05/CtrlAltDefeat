---
id: 260718-1858-media-manifest-vite-runtime
title: "Integrate model/video media manifest and Vite runtime"
description: "Hard/TDD plan to move model/video metadata behind an approved backend media manifest, migrate web runtime to Vite output, and lazy-load FBX/MP4 assets without changing the 5-step tour."
status: completed
priority: P1
effort: "~2-3 implementation days / 4 serial phases"
mode: hard
tdd: true
branch: main
created: 2026-07-18
author: user:sonnguyenque5@gmail.com
decisions: []
phase_graph: plan-graph.yaml
tags: [media, manifest, vite, threejs, backend-api, tdd]
phases:
  - phases/phase-1-media-manifest-api.md
  - phases/phase-2-vite-build-runtime.md
  - phases/phase-3-manifest-driven-media-ui.md
  - phases/phase-4-runtime-validation-docs.md
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Plan: Integrate model/video media manifest and Vite runtime

## Tổng quan
Ship only the pieces that must exist: backend-owned approved media manifest for model/video, `GET /api/media/{sceneId}`, Vite-built web runtime, and lazy loading for MP4/FBX; no gallery/CMS/RAG images because that is scope creep. Current backend already has route pattern for scene/tour at `services/api/src/server.js:141-185`, but `services/api/src/scene/index.js:42-52` returns `assets: []` and `services/api/src/tour/index.js:17-23` returns the approved 5-step tour, so media must go through a separate endpoint rather than stuffing the 10 process stations into tour. Browser bootstrap is currently broken by bare `three` imports at `apps/web/src/main.js:1-5`, and the web code uses `import.meta.glob` at `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:80-86`, so raw static serving is the wrong runtime; Vite is the minimum migration that matches the source. Static server is missing `.mp4` MIME at `services/api/src/server.js:12-23`; Phase 1 adds `.mp4 -> video/mp4` and keeps `.fbx` unchanged until a real browser/loader probe proves otherwise.

## Quyết định đã khoá
- Public scope only model + video.
- Backend owns approved scene-scoped media manifest under `content/approved/media/`; frontend consumes API only, no filesystem scan or hardcoded production station captions.
- 10 process videos are separate process stations; the approved 5-step tour in `content/approved/tours/tour-01.json` stays intact and `GET /api/tour/{tourId}` remains on the 5-step contract.
- Use Vite for web build/runtime; raw static serving cannot resolve `three` imports in `apps/web/src/main.js:1-5`, and the captured Chrome exception in `plans/reports/asset-runtime-integration-research-260718.md:67-80` proves the browser bootstrap failure.
- Keep current FBX assets and lazy-load them; the current startup `Promise.all([...10 FBX...])` and video preload loops in `apps/web/src/main.js:180-201,598-601` must not survive.
- No eager startup load of the current media volume: the pre-plan probe counted 11 FBX files at 143,189,644 bytes, 10 MP4 files at 23,909,698 bytes, and 2 GLB files at 5,348,068 bytes; API returns metadata only, binaries stay static and lazy.

## Ràng buộc (constraint-scan)
| Constraint | Evidence | Plan response |
|---|---|---|
| Planner write lane | `harness/data/ownership.yaml:1-16` documents script containment zones and `plans: [plans/]`. | This artifact only writes under `plans/260718-1858-media-manifest-vite-runtime/`; implementation phases later touch product files. |
| Push/pr/ship artifact policy | `harness/data/stage-policy.yaml:25-53` requires verification for push and verification/review-decision/plan-approval for pr/merge/ship/deploy. | `plan-graph.yaml` declares `verification-PN.json` post artifact for every phase; cook must emit these before phase completion. |
| Approved-content rule | `docs/code-standards.md:12-16,60-63` requires approved data for RAG/tour and forbids long UI hardcoding; `docs/system-architecture.md:60-67` defines approved content store. | Captions/narrations for process stations live in approved manifest JSON under `content/approved/media/`; frontend does not auto-generate descriptions and nothing provisional is served from the approved tree. |
| Error/fallback contract | `docs/code-standards.md:65-83` defines standard API errors and degraded fallback; `docs/system-architecture.md:83-89` defines fallback ladder. | `/api/media` uses existing error shape; missing manifest degrades media wall/model loading without breaking tour/QA/TTS. |
| Existing API boundary | `docs/engineering/api-contract.md:11-15` says client depends on contract, not provider internals; `docs/engineering/api-contract.md:103-114` gives error model. | Add `/api/media/{sceneId}` as read-only JSON contract; no DB/CDN/upload layer. |
| Stale standards wording | `docs/code-standards.md:7` and `docs/system-architecture.md:7` still say no app code exists. | Phase 4 makes only targeted doc corrections needed for accurate architecture; no broad docs modernization. |
| Baseline test drift | `npm test` currently fails because `tests/bootstrap/workspace-bootstrap-contract.test.mjs:6` hardcodes `/home/anoreo/Desktop/CtrlAltDefeat`; command output showed ENOENT on `/home/anoreo/Desktop/CtrlAltDefeat/package.json`. | Phase 1 fixes this gate blocker before relying on bootstrap regression checks. |

## Data flow
1. **Media metadata authoring**: approved model+video metadata enters `content/approved/media/tay-ho-giay-do-room-01.json`; byte lengths and public paths reference existing static files under `/asset`, `/guide_girl`, `/making_step`, and `/assets/avatar`.
2. **Backend validation/read**: `services/api/src/media/index.js` reads JSON beside existing approved content readers, validates references, and returns a cloned scene-scoped payload.
3. **API delivery**: `services/api/src/server.js:141-185` extends current GET route pattern with `GET /api/media/{sceneId}`; 404 returns standard `createErrorResponse` from `services/api/src/http/errors.js:1-12`.
4. **Static delivery**: Node server keeps serving existing public asset paths via `serveStatic` at `services/api/src/server.js:83-112`; Phase 1 adds MP4 MIME only, while Vite build Phase 2 copies static media dirs so URLs survive in `build/web`.
5. **Frontend bootstrap**: Vite bundles `apps/web/src/main.js`, resolving `three` imports and transforming Vite-only syntax; runtime serves Vite output, not raw `/src/main.js`.
6. **Frontend media consumption**: browser bootstrap fetches scene, tour, then media in that order; `createExhibitionWall` receives `processStations[]` and `assets[]`, not `import.meta.glob`, and `VideoDisplay` keeps `preload='none'` from `apps/web/src/components/VideoDisplay/VideoDisplay.js:18-27`.
7. **Lazy model/video loading**: model registry resolves `assetId -> publicPath/loader/role`; FBXLoader calls happen only after base scene render and station/model activation, not inside a single startup `Promise.all` gate.
8. **Fallback/degraded path**: manifest/API/video/model failure yields mock/empty station and model placeholders, while the approved 5-step tour and QA/TTS flows remain usable per `docs/code-standards.md:80-83`.

## Dependency graph
Sequential only: `P1 -> P2 -> P3 -> P4`.

| Phase | Depends on | Why serial |
|---|---|---|
| P1 Media manifest API | none | Defines backend contract and MIME behavior consumed by later phases. |
| P2 Vite build/runtime | P1 | Runtime smoke should include `/api/media`; build must preserve the new approved content/static media paths. |
| P3 Manifest-driven media UI | P2 | Frontend import graph must run through Vite before browser smoke can prove manifest consumption. |
| P4 Runtime validation/docs | P3 | End-to-end checks and docs must reflect final API/build/UI behavior. |

No parallel cook. Phase 2 and Phase 3 both affect browser bootstrap semantics, and Phase 1/2 both alter test gates; serial execution avoids shared-surface roulette.

## File ownership
| Phase | Owns create | Owns modify | Must not touch |
|---|---|---|---|
| P1 | `content/approved/media/tay-ho-giay-do-room-01.json`, `services/api/src/media/index.js`, `tests/api/media/media-manifest.contract.test.mjs`, `tests/content/media-manifest-content.contract.test.mjs`, `tests/bootstrap/static-media-content-types.test.mjs` | `services/api/src/server.js`, `tests/bootstrap/workspace-bootstrap-contract.test.mjs` | `apps/web/**`, Vite scripts/config, tour content |
| P2 | `vite.config.mjs`, `package-lock.json`, `tests/bootstrap/vite-build-output.contract.test.mjs`, `tests/e2e/browser-bootstrap-smoke.test.mjs` | `package.json`, `scripts/build.mjs`, `scripts/run.mjs`, `scripts/lint.mjs`, `apps/web/index.html`, `tests/bootstrap/health-endpoint-smoke.test.mjs` | `services/api/src/server.js`, media manifest JSON/service, frontend media logic |
| P3 | `apps/web/src/media/client.js`, `apps/web/src/media/manifest-adapter.js`, `apps/web/src/media/model-registry.js`, `tests/e2e/media-manifest-runtime.test.mjs`, `tests/scene/exhibition-wall-media.test.mjs`, `tests/avatar/avatar-media-manifest.contract.test.mjs` | `apps/web/src/main.js`, `apps/web/src/components/ExhibitionWall/ExhibitionWall.js`, `apps/web/src/components/ExhibitionStation/ExhibitionStation.js`, `apps/web/src/components/VideoDisplay/VideoDisplay.js`, `apps/web/src/systems/VideoActivationSystem/VideoActivationSystem.js`, `apps/web/src/avatar/manifest.js`, `apps/web/src/avatar/state.js`, `apps/web/src/avatar/runtime.js` | Backend routes/build scripts/docs |
| P4 | `tests/docs/media-architecture.contract.test.mjs` | `docs/system-architecture.md`, `docs/code-standards.md`, `docs/engineering/api-contract.md`, `tests/mobile/manual-checklist.md`, `tests/perf/demo-path-budget.test.mjs` | Product runtime code, manifest schema, build scripts |

P4 runs inline (`in_place: true`) because it touches `docs/**`; that keeps the docs write honest instead of pretending the default developer lane owns it.

## Phases
| # | Theme | Phụ thuộc | Cỡ |
|---|---|---|---|
| 1 | Media manifest API + MIME | none | medium |
| 2 | Vite build/runtime migration | P1 | medium |
| 3 | Manifest-driven lazy media UI | P2 | large |
| 4 | Runtime validation + docs | P3 | small |

## Test matrix
| Layer | Locked behavior | Phase |
|---|---|---|
| Content contract | Manifest exists under `content/approved/media/`, has 10 `processStations`, references only model/video asset kinds, no JPEG/image/gallery entries, and all station copy is approved manifest data. | P1 |
| API contract | `GET /api/media/tay-ho-giay-do-room-01` returns scene-scoped manifest; unknown scene returns `MEDIA_MANIFEST_NOT_FOUND`; `/api/tour/tour-01` still returns exactly 5 steps. | P1 |
| Static media | `HEAD/GET /making_step/Buoc1_nau_do.mp4` returns `video/mp4`; representative FBX remains fetchable without inventing MIME claims. | P1 |
| Build contract | Vite build resolves `three`, emits bundled web assets, and copies `/asset`, `/guide_girl`, `/making_step`, `/assets/avatar` into runtime output. | P2 |
| Browser bootstrap | Headless browser opens `/` without `Failed to resolve module specifier "three"` and without raw `import.meta.glob` leaking to runtime. | P2 |
| Frontend station data | Exhibition wall uses `processStations[]` from API; no client filesystem glob and no auto-generated captions/narrations. | P3 |
| Lazy loading | No startup `stations.forEach(...videoDisplay.load())`; no single `Promise.all` over all FBX assets gates first scene render; videos load on activation through `VideoDisplay.play()`. | P3 |
| Fallback | Media API/video/model failure degrades media elements only; scene/tour/QA/TTS remain usable and the approved tour still renders as 5 steps. | P3/P4 |
| Docs contract | `docs/engineering/api-contract.md` mentions `/api/media/{sceneId}`, stale “no app code” wording is removed, and no CMS/upload/CDN promise appears. | P4 |
| Runtime validation | Final build + run + browser smoke + targeted node tests pass; manual mobile checklist covers MP4 playback, FBX fallback, and tour preservation. | P4 |

## Backwards compatibility / migration
- `GET /api/scene/{sceneId}` remains compatible and does not inline the 10-station catalog; current `assets: []` behavior at `services/api/src/scene/index.js:42-52` is not converted into a second media SSOT.
- `GET /api/tour/{tourId}` stays unchanged for the approved 5-step tour, with existing test coverage at `tests/api/scene-tour/scene-tour.contract.test.mjs:45-68`.
- Existing public asset URLs stay stable: `/guide_girl/*.fbx`, `/asset/*.fbx`, `/making_step/*.mp4`, `/assets/avatar/*.glb`, matching static resolution pattern at `services/api/src/server.js:67-76`.
- No existing persisted user data or DB migration exists in this repo; migration is additive content + additive endpoint + frontend consumer switch.
- Existing avatar/static preview API should remain callable as a fallback adapter during Phase 3; backend manifest becomes production SSOT for new media decisions.
- Rollout switch is low-tech: if Phase 3 fails, keep Vite/runtime and backend manifest, revert only frontend consumer changes so tour/QA/TTS still run.

## Red Team Disposition
All findings were accepted and propagated into the phase files.

| Finding | Decision | Plan update |
|---|---|---|
| MMVR-F01 | Accept | Phase 4 is inline (`in_place: true`) because the docs write crosses the default developer lane. |
| MMVR-F02 | Accept | Phase 4 regression gate uses a recursive `find tests ... | xargs -0 node --test` sweep instead of a shallow shell glob. |
| MMVR-F03 | Accept | Add `tests/docs/media-architecture.contract.test.mjs` so stale docs claims fail before docs edits land. |
| MMVR-F04 | Accept | Manifest status is `approved`; no provisional public content is served from `content/approved/media/`. |
| MMVR-F05 | Accept | Keep process stations separate from the approved 5-step tour and keep runtime assertions on the tour contract. |
| MMVR-F06 | Accept | Phase 3 bootstraps scene -> tour -> media explicitly before media consumption. |
| MMVR-F07 | Accept | Phase 3 keeps shell-first degraded rendering while manifest data arrives later. |
| MMVR-F08 | Accept | Phase 2 rollback is revert-only; it never treats raw-source serving as a deployable fallback. |

## Acceptance (toàn plan)
- [ ] `content/approved/media/tay-ho-giay-do-room-01.json` exists and includes all current public model/video assets: 11 `.fbx`, 2 `.glb`, 10 `.mp4` from the pre-plan asset probe, with `status: approved`.
- [ ] `GET /api/media/tay-ho-giay-do-room-01` returns manifest metadata only; response body contains no binary/base64 media and no image/JPEG gallery entries.
- [ ] `GET /api/media/unknown` returns 404 with standard error object and `MEDIA_MANIFEST_NOT_FOUND`.
- [ ] `GET /api/tour/tour-01` still returns exactly 5 approved steps; no process station is written into `content/approved/tours/tour-01.json`.
- [ ] `.mp4` static response returns `video/mp4`; `.glb` remains `model/gltf-binary`; `.fbx` remains fetchable and MIME is changed only if Phase 4 proves a browser loader failure.
- [ ] `npm run build` uses Vite for web output and preserves `/asset`, `/guide_girl`, `/making_step`, and `/assets/avatar` paths in build runtime.
- [ ] Browser smoke on built runtime has no unresolved bare `three` import and no untransformed `import.meta.glob` exception.
- [ ] Frontend process stations consume manifest titles/narrations/assets; no hardcoded autogenerated captions or client file glob remain in production path.
- [ ] Startup does not eagerly load the current ~172 MB media set; station videos and FBX models load lazily with degraded fallback.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `find tests -type f -name '*.test.mjs' -print0 | xargs -0 node --test` pass before plan is considered cooked.
- [ ] `tests/docs/media-architecture.contract.test.mjs` passes and docs no longer claim no app code or imply gallery/CMS/CDN/upload.

## Rollback
- P1 rollback: revert media manifest JSON, media service, `/api/media` route, and `.mp4` MIME patch; existing scene/tour/QA/TTS endpoints continue to work.
- P2 rollback: revert Vite config/dependencies/build/run changes and keep the last known-good build artifact; do not deploy raw `/src/main.js` as a fallback because that path is already known broken.
- P3 rollback: revert frontend media consumer/lazy-loader changes; keep P1/P2 so `/api/media` and Vite runtime are still available for a smaller follow-up.
- P4 rollback: revert docs/manual/perf-test updates only; no runtime state changes.
- Cross-phase failure rule: if tour length, approved content boundary, or browser bootstrap regresses, stop at that phase and revert that phase before advancing.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Manifest becomes a mini CMS | M | H | Read-only JSON under `content/approved/media/`; no POST/PUT/admin/upload fields; out-of-scope list is explicit. |
| Tour schema/content gets polluted by 10 process stations | M | H | Dedicated `/api/media/{sceneId}` plus existing tour test; P1 adds media tests that assert process stations stay outside tour. |
| Vite build drops current static media paths | H | H | P2 test asserts built runtime contains representative `/asset`, `/guide_girl`, `/making_step`, `/assets/avatar` files before browser smoke. |
| Browser bootstrap still fails after bundling | M | H | P2 headless browser test fails on console exceptions and `Failed to resolve module specifier`; no reliance on node syntax checks alone. |
| Lazy-loading refactor breaks first scene render | M | H | P3 preserves existing geometric fallback blocks from `apps/web/src/main.js:496-609` while moving expensive assets behind activation. |
| Manifest API outage blanks user journey | M | M | Media-only degraded state; approved tour/QA/TTS fallback remains independent per `docs/code-standards.md:80-83`. |
| `.fbx` MIME or Range support becomes a real browser issue | M | M | Phase 4 probes runtime behavior; change `.fbx` MIME or add Range only with observed failure, not speculation. |
| Baseline tests hide failures due stale absolute paths | H | M | Phase 1 fixes bootstrap gate path; Phase 4 full-suite validation catches remaining stale test path drift. |

## Validation Log
| ID | Topic | Decision | Evidence |
|---|---|---|---|
| VL-1 | Mode | Use hard + TDD, serial phases. | User requested HARD + TDD; phase count 4 and shared runtime/API surfaces make `--fast` wrong. |
| VL-2 | Scope challenge | HOLD reduced scope; no extra CMS/CDN/gallery/DB. | User explicitly excluded gallery/image RAG/upload/admin/CMS; codebase has file-based approved content at `content/approved/**`. |
| VL-3 | Vite vs raw runtime | Vite is required, not optional polish. | `apps/web/src/main.js:1-5`, `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:80-86`, and browser exception evidence at `plans/reports/asset-runtime-integration-research-260718.md:67-80`. |
| VL-4 | `/api/media` separate endpoint | Keep media separate from scene/tour. | `services/api/src/scene/index.js:42-52` currently has empty assets; `services/api/src/tour/index.js:17-23` is tour-only; user chose dedicated endpoint. |
| VL-5 | Baseline probe | `npm test` is currently not green before implementation. | Fresh `npm test` failed on `tests/bootstrap/workspace-bootstrap-contract.test.mjs:6` hardcoded stale root; P1 owns fix. |
| VL-6 | Phase 4 execution mode | Run docs validation inline. | `harness/plugins/hs/skills/cook/SKILL.md:60-66` and the docs lane conflict mean P4 is safer as `in_place: true`. |

### Whole-Plan Consistency Sweep
- Files reread after scaffold before final fill: `plan.md`, all `phases/phase-*.md`.
- Decision deltas checked: endpoint separate, Vite required, model/video-only scope, lazy-loading, no tour schema change, approved-only manifest.
- Reconciled stale references: root phase files not used; all phase files are under `phases/`.
- Unresolved contradictions: 0.

## Out of scope
- JPEG gallery, derived image captions, image RAG, image upload/admin, content CMS.
- Asset database, CDN migration, checksums/versioned cache-busting, upload workflows, approval UI.
- Converting FBX to GLB in this pass.
- Reworking the approved 5-step tour schema or `content/approved/tours/tour-01.json`.
- Adding MP4 Range support unless Phase 4 proves it is needed for target playback/seek.
- Adding explicit `.fbx` MIME unless Phase 4 proves current `application/octet-stream` breaks runtime.
- Changing QA/RAG/TTS/live-voice behavior except where smoke tests prove media fallback does not break them.

## Unresolved questions
- None blocking for cook. Phase 4 must empirically decide whether `.fbx` MIME and MP4 Range support are real runtime blockers; until then they stay out of scope.
