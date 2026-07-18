---
phase: 4
title: "Runtime Validation Docs"
status: pending
in_place: true
plan: 260718-1858-media-manifest-vite-runtime
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 4 — Runtime Validation Docs

## Overview
Validate the built app in the real browser/runtime path and update only the docs needed to describe the new media architecture accurately. This phase is inline because it owns docs files and docs-manager/developer ownership split would add ceremony without reducing runtime risk.

## Requirements
- Run final build/runtime/browser validation against the Vite-built backend-served app, not raw source.
- Confirm `/api/media`, MP4 playback/lazy loading, representative FBX lazy loading/fallback, and 5-step tour preservation in one runtime pass.
- Update docs to remove stale "no app code" claims at `docs/code-standards.md:7` and `docs/system-architecture.md:7` only where needed.
- Document `/api/media/{sceneId}` in `docs/engineering/api-contract.md` without adding upload/CMS/CDN/database promises.
- Add an automated docs contract test so documentation drift fails red before docs edits.
- Update mobile/manual/perf checks to cover the new lazy-media path and no-eager-load requirement.

## Related Code Files
| Action | Path | Notes |
|---|---|---|
| Create | `tests/docs/media-architecture.contract.test.mjs` | Docs contract: `/api/media/{sceneId}` present, stale no-app wording absent, no CMS/upload/CDN promise. |
| Modify | `docs/system-architecture.md` | Add media manifest/API and Vite-built runtime to actual architecture; trim stale no-app wording. |
| Modify | `docs/code-standards.md` | Update status/test guidance narrowly; keep approved-content and fallback rules. |
| Modify | `docs/engineering/api-contract.md` | Add `GET /api/media/{sceneId}` contract and response/error notes. |
| Modify | `tests/mobile/manual-checklist.md` | Add browser/device checks for media manifest, MP4, FBX fallback, and tour preservation. |
| Modify | `tests/perf/demo-path-budget.test.mjs` | Lock no-eager media startup budget with observable checks, not guessed timing thresholds. |
| Delete | none | No runtime deletion. |

## Data flow
1. Build produces Vite web output and backend runtime using Phase 2 pipeline.
2. Runtime serves `/`, `/api/scene/{sceneId}`, `/api/tour/{tourId}`, `/api/media/{sceneId}`, and static MP4/FBX/GLB paths through backend.
3. Browser smoke records console/network behavior: scene/tour/media fetched, initial load excludes all MP4/FBX binaries, first station activation fetches one MP4, representative model activation/fallback works.
4. Manual checklist validates target browsers/devices; evidence goes into phase verification artifact.
5. Docs are updated after validation so they describe observed behavior, not intended behavior.

## Tests Before
- [ ] Extend `tests/perf/demo-path-budget.test.mjs` to fail if initial route fetches all MP4/FBX media or if manifest payload contains binary/base64 media.
- [ ] Add `tests/docs/media-architecture.contract.test.mjs`; it must fail until docs mention `/api/media/{sceneId}`, remove stale "no app code" wording, and avoid CMS/upload/CDN promises.
- [ ] Update `tests/mobile/manual-checklist.md` with unchecked items for MP4 playback, station copy, FBX lazy/fallback, and tour 5-step preservation.

## Implement
1. Run final commands from all phases on a clean build: `npm test`, targeted `node --test`, `npm run lint`, `npm run typecheck`, `npm run build`, browser smoke.
2. Exercise runtime with one scene load, one process station activation, one representative FBX model path or fallback, and one tour/QA smoke.
3. Decide empirically whether `.fbx` MIME or MP4 Range support is required. If playback/loader works, leave them unchanged; if not, stop and revise earlier phase ownership before adding server behavior.
4. Update docs with the actual contract and data flow: approved media manifest, `/api/media/{sceneId}`, Vite-built frontend, backend static asset serving, lazy loading/fallback.
5. Update mobile checklist and perf budget test so future changes cannot reintroduce eager media startup.

## Tests After
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `find tests -type f -name '*.test.mjs' -print0 | xargs -0 node --test`
- [ ] `node --test tests/docs/media-architecture.contract.test.mjs tests/perf/demo-path-budget.test.mjs tests/api/scene-tour/scene-tour.contract.test.mjs`
- [ ] Browser smoke from `tests/e2e/browser-bootstrap-smoke.test.mjs` and `tests/e2e/media-manifest-runtime.test.mjs`
- [ ] Manual checklist completed. Because `/usr/bin/google-chrome` exists in the current environment, local browser-unavailable PASS_WITH_RISK is not acceptable unless the executable disappears or crashes before launch.

## Regression Gate
`npm test && npm run lint && npm run typecheck && npm run build && find tests -type f -name '*.test.mjs' -print0 | xargs -0 node --test`

Browser/manual gate: run the project browser smoke and attach evidence in `plans/260718-1858-media-manifest-vite-runtime/artifacts/verification-P4.json`. If a real browser is unavailable despite `/usr/bin/google-chrome`, mark verification `BLOCKED`, not PASS_WITH_RISK.

## Success Criteria
- [ ] Final built runtime opens in browser without module resolution errors.
- [ ] `/api/scene`, `/api/tour`, and `/api/media/tay-ho-giay-do-room-01` are fetched in the runtime path.
- [ ] Initial browser network does not fetch all 10 MP4 files or all FBX files.
- [ ] Activating a station loads/plays a representative MP4 or displays explicit degraded fallback.
- [ ] Representative FBX lazy path either loads or falls back without blocking tour/QA/TTS.
- [ ] `GET /api/tour/tour-01` still returns 5 steps after all phases.
- [ ] Docs reflect actual architecture and do not introduce out-of-scope gallery/CMS/CDN/upload promises.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Browser smoke cannot run in current environment | L | M | `/usr/bin/google-chrome` exists now; treat local browser failure as BLOCKED unless environment changes. |
| Docs become aspirational again | M | M | Automated docs contract test blocks stale/noisy claims. |
| Perf budget invents arbitrary timing thresholds | M | M | Assert structural no-eager-load/network counts; avoid made-up millisecond targets unless measured. |
| Runtime probe reveals FBX MIME/Range issue late | M | H | Stop and revise plan/ownership before changing server behavior; do not sneak patch into docs phase. |
| Full suite exposes unrelated stale tests | M | M | Fix only path/test harness issues needed to make existing tests portable; do not weaken assertions. |

## Rollback
Revert docs/manual/perf-test/docs-test changes. If runtime validation fails due product behavior, rollback must target the owning earlier phase rather than hiding failure in docs or tests.
