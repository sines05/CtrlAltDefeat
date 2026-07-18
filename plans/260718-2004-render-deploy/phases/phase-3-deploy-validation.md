---
phase: 3
title: "Deploy Validation"
status: pending
plan: 260718-2004-render-deploy
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 3 — Deploy Validation

## Overview

Chứng minh Blueprint không phá build hiện có trước khi push, rồi thực hiện probe Render sau khi user cho phép action outbound. Không thêm source file; phase tạo verification receipts của harness theo `plan-graph.yaml`.

## Files

- **Create** `plans/260718-2004-render-deploy/artifacts/verification-P3.json` (receipt do harness tạo)
- **Modify** none
- **Delete** none

## Validation steps

1. Chạy `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` từ repo root.
2. Chạy artifact bằng `HOST=0.0.0.0 PORT=10000 node build/run.mjs`, request `http://127.0.0.1:10000/api/health`, assert HTTP 200 và `ok: true`; dừng process sạch.
3. Review diff để xác nhận `.env`, key values, `PORT` hardcode, và generated `build/` không bị tracked; `.env`/`build/` đã bị ignore [OBSERVED: `.gitignore:7-22`].
4. **Sau human approval**: import `render.yaml` trong Render, nhập existing Gemini key value vào dashboard, tạo một service, chờ health check healthy, và capture production URL.
5. Call `<production-url>/api/health`, root route, một asset/scene route, một live Gemini interaction, và mobile/QR path.
6. Trigger deploy lần hai của chính service (bằng push `main` đã kiểm tra hoặc Render Deploy Latest Commit); call exact URL lần nữa và so string URL với lần đầu. Nếu khác URL, dừng submit và giữ fallback Railway.

## Success

- [ ] Bốn local commands hoàn tất exit 0.
- [ ] Production artifact với host/port kiểu Render trả health HTTP 200.
- [ ] Render reports service healthy và production URL không đổi sau deploy thứ hai [ASSUMED until observed].
- [ ] No secret value xuất hiện trong diff/log/receipt.
- [ ] Gemini live smoke test thành công với key có sẵn; nếu provider lỗi, health/tour/static fallback vẫn usable và runbook ghi outcome thật.

## Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Render account/import/deploy fails | M / H | Giữ error output làm evidence; dùng Railway fallback đã nghiên cứu, không refactor app sang Vercel. |
| External Gemini quota/credential fails | M / H | Không claim live QA works; set degraded flag, preserve static tour, resolve account key/quota separately. |
| Main auto deploy nhận integration regression | M / H | Local gates trước push, health check mỗi revision, rollback cùng service — không thay URL. |
