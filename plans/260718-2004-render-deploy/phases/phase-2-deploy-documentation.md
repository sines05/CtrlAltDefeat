---
phase: 2
title: "Deploy Documentation"
status: pending
plan: 260718-2004-render-deploy
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 2 — Deploy Documentation

## Overview

Thay phần deploy còn `[ASSUMED]` bằng runbook Render ngắn, và ghi user-owned infrastructure decision. Đây là documentation-only phase; không chạm code đang tích hợp.

## Files

- **Modify** `docs/operations/deployment.md`
- **Create** `docs/decisions/0002-render-web-service.md`
- **Delete** none

## Implementation steps

1. Cập nhật trạng thái và môi trường deploy thành Render Web Service; tham chiếu `render.yaml`, production URL một service, branch `main` autodeploy, `/api/health`, start/build commands, và rollback revision trong cùng service.
2. Ghi quy trình secret: xác định key name từ local `.env`, dán value vào Render dashboard khi Blueprint prompt, không commit/copy/export `.env`, không dùng `PORT` tùy biến.
3. Ghi validation live: root + `/api/health`, one real Gemini/live interaction, QR/mobile smoke path, và so URL sau redeploy thứ hai.
4. Tạo decision record `0002-render-web-service.md` ghi context, user quyết định, alternatives rejected, consequences, source evidence, và rollback; dùng glossary hiện có, không tạo thuật ngữ mới. `docs/glossary.yaml` không tồn tại [OBSERVED: failed read 2026-07-18], nên không có glossary SSOT để cập nhật.
5. Register `DEC-RENDER-WEB-SERVICE` bằng `decision_register.py --append-alloc ...` nếu script yêu cầu canonical register; nếu register không tồn tại/không hỗ trợ docs decision record thì ghi receipt [ASSUMED — verify during cook].

## Success

- [ ] Docs không còn nói môi trường cuối chưa chốt và không mâu thuẫn `render.yaml`.
- [ ] Không có secret value, `.env` path, hoặc QR URL tạm trong docs.
- [ ] Decision record giữ Render decision là user-owned và nêu scope không đổi application code.
- [ ] Tất cả hướng dẫn vận hành giữ fallback khi Gemini outage thay vì làm hỏng tour/static flow [OBSERVED: `docs/operations/deployment.md:43-47`].

## Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Documentation drift với Blueprint | M / M | Review hai file cùng diff; commands/health path phải match field của `render.yaml`. |
| Decision record làm phình scope | L / L | Giới hạn record ở deploy target, rollback, và secret policy; không redesign architecture. |
