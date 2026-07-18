---
phase: 2
title: "Vite Build Runtime"
status: pending
plan: 260718-1858-media-manifest-vite-runtime
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 2 — Vite Build Runtime

## Overview
Move the web runtime from raw static source serving to Vite-built output so bare `three` imports and Vite syntax are actually transformed. Keep the backend Node server as the API/static host for the built artifact.

## Requirements
- Add Vite and `three` dependencies through npm; current `package.json:1-16` has no dependencies and no lockfile was found by pre-plan probe.
- Configure Vite for vanilla JS; no React/framework migration.
- `npm run build` must run Vite for `apps/web` and then copy backend/content/static media into `build/`.
- Vite output must preserve current public URLs `/guide_girl/*.fbx`, `/asset/*.fbx`, `/making_step/*.mp4`, `/assets/avatar/*.glb`; current raw-copy behavior at `scripts/build.mjs:76-81` cannot be assumed after Vite.
- Runtime must serve built Vite output, not raw `/src/main.js`; `apps/web/index.html:494` currently points to raw source and is the bootstrap hazard.
- Browser smoke must fail on console exceptions including `Failed to resolve module specifier "three"` from the captured report at `plans/reports/asset-runtime-integration-research-260718.md:67-80`.

## Related Code Files
| Action | Path | Notes |
|---|---|---|
| Create | `vite.config.mjs` | Root `apps/web`, output `build/web`, explicit static media copy strategy. |
| Create | `package-lock.json` | npm dependency lock for Vite/three. |
| Create | `tests/bootstrap/vite-build-output.contract.test.mjs` | Build artifact layout and static media preservation. |
| Create | `tests/e2e/browser-bootstrap-smoke.test.mjs` | Real browser/bootstrap smoke; fail on module/console exception. |
| Modify | `package.json` | Add scripts/dependencies; keep existing command names working. |
| Modify | `scripts/build.mjs` | Use Vite build and copy API/content/avatar/static media dirs. |
| Modify | `scripts/run.mjs` | Serve Vite-built web root or fail loudly if build missing; no raw-source happy path. |
| Modify | `scripts/lint.mjs` | Syntax-check new config/scripts and stop assuming only raw static source. |
| Modify | `apps/web/index.html` | Keep Vite-compatible entry; built runtime must not expose raw `/src/main.js`. |
| Modify | `tests/bootstrap/health-endpoint-smoke.test.mjs` | Update root/script assertions for Vite output. |
| Delete | none | No asset move/delete in this phase. |

## Data flow
1. Source web enters Vite from `apps/web/index.html` and `apps/web/src/main.js`.
2. Vite resolves `three`/`three/addons/*` imports and rewrites module graph into bundled assets under `build/web`.
3. Build script copies backend source to `build/api/src`, approved content to `build/content/approved`, avatar GLBs to `build/assets/avatar`, and current static media dirs to `build/web/{asset,guide_girl,making_step}`.
4. Runtime starts existing `startServer` with `staticRoot: buildRoot` and `webRoot: buildRoot/web`, matching current `startServer` static parameters at `services/api/src/server.js:259-302`.
5. Browser loads built `index.html`, bundled JS, and later media assets by stable public URL.

## Tests Before
- [ ] Add `tests/bootstrap/vite-build-output.contract.test.mjs`; it must fail before Vite because `build/web` still contains raw source/copy semantics and no Vite manifest/bundled JS.
- [ ] Add `tests/e2e/browser-bootstrap-smoke.test.mjs`; it must fail against current raw runtime with the existing `three` module specifier error.
- [ ] Update `tests/bootstrap/health-endpoint-smoke.test.mjs`; it must fail until `/` serves Vite-built HTML instead of raw `/src/main.js`.
- [ ] Keep Phase 1 media endpoint tests in the regression set so build migration does not drop `/api/media` or static MP4 MIME.

## Implement
1. Add `vite` as dev dependency and `three` as runtime/bundled dependency; generate `package-lock.json` with npm.
2. Add minimal `vite.config.mjs`; do not add a frontend framework or plugin unless Vite itself requires it.
3. Update `scripts/build.mjs` to call Vite build before writing final `build/manifest.json`; preserve the generated `run.mjs` behavior with `webRoot: resolve(buildRoot, 'web')`.
4. Add an explicit post-Vite copy for `apps/web/asset`, `apps/web/guide_girl`, and `apps/web/making_step` into `build/web/`; this is the cheap fix that keeps current public paths.
5. Update `scripts/run.mjs` to serve built output by default; if missing, fail with a clear `run npm run build first` message or build once explicitly. Do not silently serve raw `apps/web` as the main runtime.
6. Update smoke tests to assert built HTML references Vite assets and no longer expects `/src/main.js` as the runtime module.

## Tests After
- [ ] `npm run build`
- [ ] `node --test tests/bootstrap/vite-build-output.contract.test.mjs`
- [ ] `node --test tests/e2e/browser-bootstrap-smoke.test.mjs`
- [ ] `node --test tests/bootstrap/health-endpoint-smoke.test.mjs tests/bootstrap/static-media-content-types.test.mjs`
- [ ] `node --test tests/api/media/media-manifest.contract.test.mjs`
- [ ] Browser smoke asserts no console error matching `Failed to resolve module specifier` and no untransformed `import.meta.glob` runtime exception.

## Regression Gate
`npm test && npm run lint && npm run typecheck && npm run build && node --test tests/bootstrap/vite-build-output.contract.test.mjs tests/e2e/browser-bootstrap-smoke.test.mjs tests/api/media/media-manifest.contract.test.mjs tests/bootstrap/static-media-content-types.test.mjs`

## Success Criteria
- [ ] `npm run build` produces `build/web/index.html` with Vite-built asset references, not raw `/src/main.js`.
- [ ] Built runtime contains representative `build/web/asset/*.fbx`, `build/web/guide_girl/*.fbx`, `build/web/making_step/*.mp4`, and `build/assets/avatar/*.glb`.
- [ ] Browser smoke passes without bare import resolution failure.
- [ ] `/api/media`, `/api/tour`, and static MP4 tests still pass after build migration.
- [ ] No new framework or unrelated frontend architecture layer is added.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Vite build omits static FBX/MP4 dirs | H | H | Contract test checks built files and runtime HEAD/GET. |
| Run command accidentally serves raw source | M | H | `scripts/run.mjs` must default to built web root or fail loudly. |
| Dependency install churns package manager expectations | M | M | Use existing npm package manager from `package.json:5`; create lockfile once. |
| Browser smoke unavailable in CI/local | M | M | `/usr/bin/google-chrome` exists in the current environment; a local unavailable-browser PASS_WITH_RISK is not acceptable unless that changes. |
| Build script gets overcomplicated | M | M | Keep one Vite build plus static copy; no dev proxy/middleware unless proven necessary. |

## Rollback
Revert Vite config, npm deps/lockfile, build/run/test changes and keep the last known-good build artifact. Do not use raw-source serving as an operational fallback, because `apps/web/index.html:494` plus `apps/web/src/main.js:1-5` is the known broken path.
