---
phase: 1
title: "Render Blueprint"
status: pending
plan: 260718-2004-render-deploy
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 1 — Render Blueprint

## Overview

Tạo một Blueprint native Node cho đúng một Render Web Service, tái dùng build/runtime/health contract hiện hữu. Phase này không sửa application code vì `scripts/build.mjs` đã tạo artifact self-contained và `build/run.mjs` đọc `HOST`/`PORT` [OBSERVED: `scripts/build.mjs:48-59,76-100`].

## Files

- **Create** `render.yaml`
- **Modify** none
- **Delete** none

## Implementation steps

1. Khai báo service có `type: web`, `runtime: node`, branch `main`, tên service ổn định dành cho URL nộp bài, `buildCommand: npm run build`, `startCommand: node build/run.mjs`, `healthCheckPath: /api/health`, và `autoDeployTrigger: commit` [PRIOR: https://render.com/docs/blueprint-spec].
2. Khai báo `HOST=0.0.0.0`, `NODE_VERSION=24.14.1`, `NODE_ENV=production`; không khai báo `PORT` vì Render inject port runtime.
3. Khai báo chỉ variable name của secret Gemini (`GEMINI_API_KEY` hoặc đúng key name đang có trong `.env`) với `sync: false`; không chép giá trị `.env` hay viết fallback secret [PRIOR: https://render.com/docs/blueprint-spec].
4. Không dùng Docker, static-site service, `npm start`, hoặc `autoDeploy` deprecated.

## Success

- [ ] `render.yaml` chỉ tạo một Web Service native Node, không có static service hay secret value.
- [ ] Commands khớp exact package scripts/runtime: `npm run build` và `node build/run.mjs` [OBSERVED: `package.json:6-11`; `scripts/build.mjs:100`].
- [ ] Health path khớp route 200 hiện hữu [OBSERVED: `services/api/src/server.js:146-153`].
- [ ] Render Blueprint UI có thể import file mà không yêu cầu sửa server code [ASSUMED — verify Phase 3 bằng import thực].

## Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Key name Blueprint khác `.env` hiện hữu | M / H | So khớp **tên biến** khi nhập secret trong dashboard, không in/commit value. |
| Render schema thay đổi | L / M | Import Blueprint thực trong Phase 3; đọc lỗi schema và sửa chỉ config field được docs hiện hành hỗ trợ. |
