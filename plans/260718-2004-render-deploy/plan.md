---
id: 260718-2004-render-deploy
title: "Chuẩn bị Render Web Service"
description: "Thêm Blueprint Render và tài liệu vận hành tối thiểu cho một URL demo ổn định."
status: in_progress
priority: P1
effort: "30–45 phút thực thi, không tính Render build queue"
mode: fast
tdd: false
branch: main
created: 2026-07-18
author: user:sonnguyenque5@gmail.com
decisions: [DEC-RENDER-WEB-SERVICE]
phases:
  - phases/phase-1-render-blueprint.md
  - phases/phase-2-deploy-documentation.md
  - phases/phase-3-deploy-validation.md
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Plan: Chuẩn bị Render Web Service

## Tổng quan

Thêm đúng một Render Blueprint để `main` tự deploy vào cùng một Web Service và cập nhật tài liệu vận hành/decision record; không đổi frontend, API, build pipeline hoặc secret local. App đã build thành `build/` và khởi động với `node build/run.mjs` [OBSERVED: `scripts/build.mjs:76-100`]; health endpoint hiện có là `GET /api/health` và trả HTTP 200 [OBSERVED: `services/api/src/server.js:141-154`].

## Quyết định đã khoá

- **DEC-RENDER-WEB-SERVICE**: Render Web Service là nền tảng production/demo.
- Render nối branch `main`; mỗi push trigger build/deploy tự động theo `autoDeployTrigger: commit` [PRIOR: https://render.com/docs/blueprint-spec].
- Giữ một service và nộp Render subdomain của service đó; không tạo service thay thế khi cập nhật.
- Dùng secret Gemini hiện có trong `.env` qua Render dashboard/Blueprint prompt, tuyệt đối không đọc giá trị để ghi vào repo. `.env` đã bị gitignore [OBSERVED: `.gitignore:7-11`].

## Ràng buộc (constraint-scan)

- `ownership.yaml:9` chỉ cho harness scripts ghi tài liệu vào `docs/`; `render.yaml` là root config ngoài zone này [OBSERVED: `harness/data/ownership.yaml:8-16`]. Cook phải tạo nó trực tiếp trong repo và không gọi script bị fence cho path đó.
- `stage-policy.yaml:41-52` yêu cầu `verification`, `review-decision`, `plan-approval` tại `pr`, `ship`, `deploy`; mỗi phase phải phát `verification-P<n>.json`, và review/approval phải tồn tại trước deploy.
- `render.yaml` dùng `runtime: node`, `buildCommand`, `startCommand`, `healthCheckPath`, `autoDeployTrigger`; `autoDeploy` đã deprecated [PRIOR: https://render.com/docs/blueprint-spec].
- `healthCheckPath` phải bắt đầu bằng `/`; `/api/health` đã có contract thực [PRIOR + OBSERVED: Render Blueprint docs; `services/api/src/server.js:146-153`].

## Phases

| # | Theme | Phụ thuộc | Cỡ |
|---|---|---|---|
| 1 | Render Blueprint | — | 1 file |
| 2 | Deploy Documentation | P1 | 2 files |
| 3 | Deploy Validation | P1, P2 | Không thêm source file |

## Out of scope

- Không đổi logic HTTP server, routes, frontend, asset pipeline, CI, Docker, database hoặc DNS custom domain.
- Không commit/copy nội dung `.env`, Gemini key, hay tạo secret mới.
- Không deploy/submit URL thay người dùng; đây là hành động outward-facing và chỉ thực hiện sau approval.

## Acceptance (toàn plan)

- [ ] Root `render.yaml` mô tả đúng một native Node Web Service trên `main`, chạy `npm run build` rồi `node build/run.mjs`, probe `/api/health`, và autodeploy theo commit.
- [ ] Blueprint dùng `HOST=0.0.0.0`, pin Node `24.14.1`, không đặt `PORT`, và khai báo Gemini secret bằng `sync: false`, không có secret value trong Git.
- [ ] `docs/operations/deployment.md` và `docs/decisions/0002-render-web-service.md` phản ánh Render, quy trình copy key qua dashboard, rollback, và URL stability contract.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` chạy xanh; runtime production artifact trả 200 từ `/api/health` với `HOST=0.0.0.0` và `PORT` mô phỏng Render.
- [ ] Sau hành động deploy được user cho phép, cùng URL trả `/api/health` trước và sau một deploy thứ hai; Gemini/live route được smoke test bằng key có sẵn.

## Rollback

Revert commit Blueprint/docs để dừng thay đổi repo; trong Render dùng rollback/redeploy revision tốt gần nhất của **cùng service** để giữ URL. Nếu Gemini lỗi, set `GEMINI_LIVE_QA_ENABLED=0`; tour/static fallback vẫn phải còn phục vụ theo app hiện có.

## Risks

| Risk | Mitigation |
|---|---|
| Push `main` auto deploy revision đang tích hợp nhưng lỗi | Render health check chặn revision không healthy; chạy local gates trước push và dùng rollback của cùng service. |
| Secret bị lộ | Chỉ đặt value vào Render dashboard sau Blueprint prompt; review diff/`git diff --check` để bảo đảm không có value. |
| `PORT` bị hardcode hoặc server bind loopback | Không khai báo `PORT`; blueprint set `HOST=0.0.0.0`; Phase 3 thực thi probe với port được inject. |
| URL bị thay khi tạo service khác | Tạo một Blueprint service duy nhất; mọi iteration sau deploy chính service đó. |
