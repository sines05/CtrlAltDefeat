---
phase: 1
title: "Media Manifest Api"
status: pending
plan: 260718-1858-media-manifest-vite-runtime
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 1 — Media Manifest API

## Overview
Create the backend-owned approved media manifest and read-only `GET /api/media/{sceneId}` contract, then fix MP4 MIME delivery. This phase does not touch frontend runtime and does not modify the approved 5-step tour.

## Requirements
- Add `content/approved/media/tay-ho-giay-do-room-01.json` with only model/video metadata for the current scene.
- Manifest includes exactly 10 process stations for current process videos and references existing public media paths discovered under `apps/web/making_step`, `apps/web/asset`, `apps/web/guide_girl`, and `assets/avatar`.
- Station titles/narrations are approved manifest data; do not keep production station copy in client code after Phase 3.
- Add `GET /api/media/{sceneId}` using the existing GET route/error style in `services/api/src/server.js:141-185` and `services/api/src/http/errors.js:1-12`.
- Add `.mp4: video/mp4` to the static MIME map at `services/api/src/server.js:12-23`; do not add `.fbx` MIME unless Phase 4 proves a real loader failure.
- Preserve `GET /api/tour/{tourId}` and its 5 approved steps from `services/api/src/tour/index.js:17-23`.
- Fix the pre-existing bootstrap gate blocker in `tests/bootstrap/workspace-bootstrap-contract.test.mjs:6` so `npm test` can be used as a real regression gate.

## Related Code Files
| Action | Path | Notes |
|---|---|---|
| Create | `content/approved/media/tay-ho-giay-do-room-01.json` | Approved media manifest; no images/gallery/CMS fields. |
| Create | `services/api/src/media/index.js` | Read/validate/clone manifest; follow current content reader style from `services/api/src/scene/index.js:1-15`. |
| Create | `tests/api/media/media-manifest.contract.test.mjs` | API contract and error shape tests. |
| Create | `tests/content/media-manifest-content.contract.test.mjs` | Content/schema/reference tests for manifest JSON. |
| Create | `tests/bootstrap/static-media-content-types.test.mjs` | MP4/FBX/GLB static serving checks. |
| Modify | `services/api/src/server.js` | Import media service, add route, add `.mp4` MIME. |
| Modify | `tests/bootstrap/workspace-bootstrap-contract.test.mjs` | Replace stale absolute repo root and make script assertions tolerant of Vite changes. |
| Delete | none | Deletion is unnecessary here. |

## Data flow
1. File metadata enters `content/approved/media/tay-ho-giay-do-room-01.json` with `manifestId`, `sceneId`, `status: approved`, `version`, `assets[]`, `processStations[]`, and `bindings`.
2. `services/api/src/media/index.js` reads JSON from `content/approved/media/`, verifies `sceneId`, clones arrays/objects, and returns `null` for unknown scene.
3. `services/api/src/server.js` matches `GET /api/media/([^/]+)`, calls media service, returns 200 JSON or 404 `MEDIA_MANIFEST_NOT_FOUND` using `createErrorResponse`.
4. Static requests still flow through `serveStatic` at `services/api/src/server.js:83-112`; only MP4 content type changes.
5. Frontend does not consume this phase yet; Phase 3 owns consumer switch.

## Tests Before
- [ ] Add `tests/content/media-manifest-content.contract.test.mjs`; it must fail before manifest exists, asserting 10 stations, model/video-only asset kinds, all `assetId` references valid, all public paths exist, and no `.jpg`/image/gallery fields.
- [ ] Add `tests/api/media/media-manifest.contract.test.mjs`; it must fail before route/service exists, asserting 200 payload for `tay-ho-giay-do-room-01`, 404 error shape for unknown scene, and zero mutation of `GET /api/tour/tour-01` 5-step behavior.
- [ ] Add `tests/bootstrap/static-media-content-types.test.mjs`; it must fail on current `.mp4` `application/octet-stream` behavior from `services/api/src/server.js:12-23`.
- [ ] Update `tests/bootstrap/workspace-bootstrap-contract.test.mjs`; run `npm test` and observe current stale-root failure turn green only after the root resolution fix.

## Implement
1. Build manifest schema in plain JSON; KISS fields only: IDs, kind/role/format/mimeType/publicPath/byteLength/loader/preload/status, process station copy, and binding IDs.
2. Include current assets: 11 `.fbx`, 2 `.glb`, and 10 `.mp4` from the pre-plan asset probe; exclude JPEG/images even if present elsewhere.
3. Add `services/api/src/media/index.js` with one exported `getMediaManifest(sceneId)`; no DB, no cache layer, no upload/admin code.
4. Add media route to `services/api/src/server.js` beside scene/tour GET routes.
5. Add `.mp4: 'video/mp4'` to `MIME_TYPES`; keep `.glb` as `model/gltf-binary`; leave `.fbx` defaulting to `application/octet-stream` for now.
6. Fix workspace bootstrap root resolution to derive repo root from `import.meta.url`, not `/home/anoreo/Desktop/CtrlAltDefeat`.

## Tests After
- [ ] `node --test tests/content/media-manifest-content.contract.test.mjs`
- [ ] `node --test tests/api/media/media-manifest.contract.test.mjs`
- [ ] `node --test tests/bootstrap/static-media-content-types.test.mjs`
- [ ] `node --test tests/api/scene-tour/scene-tour.contract.test.mjs`
- [ ] `npm test`

## Regression Gate
`npm test && node --test tests/content/media-manifest-content.contract.test.mjs tests/api/media/media-manifest.contract.test.mjs tests/bootstrap/static-media-content-types.test.mjs tests/api/scene-tour/scene-tour.contract.test.mjs && npm run lint && npm run typecheck`

## Success Criteria
- [ ] `/api/media/tay-ho-giay-do-room-01` returns manifest metadata with 10 process stations and no binary/base64 payload.
- [ ] Unknown scene returns 404 with `error.code === 'MEDIA_MANIFEST_NOT_FOUND'`.
- [ ] `GET /api/tour/tour-01` still has exactly 5 steps.
- [ ] Representative MP4 returns `video/mp4`; representative FBX and GLB return 200.
- [ ] `npm test` no longer fails on stale absolute repo root.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Manifest JSON drifts from actual files | M | H | Content test stats every referenced path and checks byte length. |
| Client-generated captions sneak back in later | M | H | Manifest content test requires station copy; Phase 3 tests remove `PAPERMAKING_STEPS` production dependency. |
| Tour gets polluted with 10 stations | M | H | Run scene-tour contract in this phase and final plan gates. |
| Overbuilding schema into CMS | M | M | JSON file + GET only; no write route, DB, auth, or admin. |
| `.fbx` MIME bikeshed wastes time | M | L | Explicitly defer until Phase 4 empirical browser probe. |

## Rollback
Revert the media JSON, service, route, MIME map entry, and new tests. Existing scene/tour/QA/TTS behavior remains intact because this phase is additive except the MP4 MIME fix.
