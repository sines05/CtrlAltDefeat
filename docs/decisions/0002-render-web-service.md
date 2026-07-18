# DEC 0002 — Render Web Service

Cập nhật: 2026-07-18

## Context

Demo cần một URL ổn định cho QR/marker, đồng thời service Node phải build frontend và phục vụ API/static content. `render.yaml` dùng build/runtime contract hiện hữu: `npm run build`, `node build/run.mjs`, và `/api/health`.

## Decision

User chốt Render Web Service là target production/demo. Service `ctrlaltdfeat-museum` deploy từ `main`; mỗi commit trigger deploy và phải giữ cùng Render URL.

Gemini secret chỉ được nhập ở Render dashboard qua biến `GEMINI_API_KEYS`; Blueprint chỉ khai báo tên biến với `sync: false`. Quyết định này không đổi frontend, API, build pipeline, database, DNS, hoặc local secret.

## Alternatives rejected

- Static site không chạy Node API/runtime artifact.
- Docker không thêm giá trị cho một service Node đã có build/start command rõ ràng.
- Tạo service mới khi redeploy làm mất URL ổn định cần cho QR và submission.

## Consequences

### Tốt

- Một service giữ URL demo ổn định và có health check `/api/health`.
- Render build/deploy theo `main`; rollback dùng revision của cùng service.
- Secret value không vào repository.

### Xấu

- Import Blueprint, credential, quota Gemini, và URL stability chỉ được chứng minh sau hành động dashboard được owner cho phép.
- Production incident vẫn cần chạy degraded tour/static fallback khi Gemini lỗi.

## Evidence

- `render.yaml` khai báo đúng một Node Web Service với `autoDeployTrigger: commit`.
- `package.json:6-11` định nghĩa `npm run build`; `scripts/build.mjs:52-65` dùng `HOST`/`PORT` runtime.
- `services/api/src/server.js:149-156` trả health payload cho `/api/health`.
- Canonical decision register chỉ chấp nhận ID dạng `DEC-<n>` và hiện không có record; plan dùng ID user-owned `DEC-RENDER-WEB-SERVICE`, nên không allocate ID khác mà không có approval.

## Rollback

Revert commit Blueprint/docs nếu cần dừng thay đổi repository. Trong Render, rollback hoặc redeploy revision healthy gần nhất của cùng service; nếu Gemini lỗi, tắt `GEMINI_LIVE_QA_ENABLED` và giữ tour/static fallback.

## Review trigger

Mở lại quyết định khi Render không giữ URL sau redeploy, health check không healthy, hoặc demo cần custom domain/multi-service.
