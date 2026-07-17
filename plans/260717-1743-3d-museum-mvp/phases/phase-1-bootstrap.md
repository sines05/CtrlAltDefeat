---
phase: 1
title: "Bootstrap"
status: pending
plan: 260717-1743-3d-museum-mvp
created: 2026-07-17
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 1 — Bootstrap

## Overview

Khóa stack và tạo runtime mỏng trước khi feature code bắt đầu. Repo hiện không có app code, `package.json`, `pyproject.toml`, hay test runtime, nên mọi phase sau phải phụ thuộc vào output của phase này [docs/code-standards.md:7-8][docs/system-architecture.md:91-107].

## Scope

- Chọn stack web/API tối thiểu cho MVP và ghi command thật cho `test`, `lint`, `typecheck`, `build` [ASSUMED exact command names until implementation].
- Tạo skeleton `apps/web`, `services/api`, và `tests` theo repo shape đề xuất [docs/code-standards.md:18-38].
- Expose `GET /api/health` trả `{ "ok": true }` theo contract [docs/engineering/api-contract.md:91-98].
- Không dựng scene, content, avatar, Q&A, hay TTS trong phase này.

## Inputs

- Stack gates còn mở trong architecture docs [docs/system-architecture.md:91-107].
- Proposed repo shape và MVP coding rules [docs/code-standards.md:18-38,58-63,84-99].
- API health contract [docs/engineering/api-contract.md:91-98].

## Outputs

- App/API/test runtime tối thiểu chạy được.
- Package/test command set được lock để P2–P6 dùng lại.
- Health route smoke xanh.
- Verification artifact: `verification-phase-1-bootstrap.json`.

## Touched Paths

Create [ASSUMED exact filenames depend on stack lock]:
- `package.json`
- `apps/web/**`
- `services/api/**`
- `tests/bootstrap/**`

Modify:
- none expected.

Delete:
- none.

## Tests Before

- [ ] `test_workspace_bootstrap_contract`: viết test yêu cầu root manifest, app web, service API, và test command tồn tại; chạy trước implement phải FAIL vì repo hiện blank [docs/code-standards.md:7-8].
- [ ] `test_health_endpoint_smoke`: viết smoke test cho `GET /api/health -> { ok: true }`; chạy trước implement phải FAIL vì endpoint chưa có [docs/engineering/api-contract.md:91-98].
- [ ] `test_error_shape_contract_stub`: lock error object shape chuẩn cho API skeleton; chạy trước implement phải FAIL hoặc PASS theo skeleton hiện có [docs/code-standards.md:65-78].

## Implement

1. Chọn stack nhỏ nhất đủ cho web 3D + API nhẹ; không thêm queue, DB, auth, hoặc CMS [docs/code-standards.md:10-17][docs/system-architecture.md:52-70].
2. Scaffold `apps/web` và `services/api` theo stack đã chọn; giữ UI/application/provider boundaries rõ để P5 không gọi provider từ view [docs/code-standards.md:58-63].
3. Add `GET /api/health` và error response helper tối thiểu theo contract [docs/engineering/api-contract.md:91-117].
4. Add test runner + scripts cho unit/integration smoke; ghi exact command set vào repo scripts [ASSUMED exact package manager].
5. Run red→green cho các tests-before; không chạm museum feature scope.

## Tests After

- [ ] `test_workspace_bootstrap_contract` PASS: root command set, `apps/web`, `services/api`, và `tests` có entrypoint thật.
- [ ] `test_health_endpoint_smoke` PASS: health route trả `{ "ok": true }`.
- [ ] `test_error_shape_contract_stub` PASS: API skeleton có error object `{ error: { code, message, retryable, traceId? } }`.

## Regression Gate

- Chạy command set Phase 1 đã khóa: `<package-manager> test`, `<package-manager> lint`, `<package-manager> typecheck`, `<package-manager> build` [ASSUMED exact executable until stack lock].
- Nếu stack không có bước lint/typecheck riêng, ghi lý do trong `verification-phase-1-bootstrap.json` và không fake pass.

## Acceptance

- [ ] Một dev mới clone repo có thể chạy test/build/lint/typecheck command đã khóa.
- [ ] Health route chạy được trong runtime thật, không chỉ import test.
- [ ] No feature scope: không có scene/hotspot/avatar/QA/TTS code ngoài stub cần cho health/error.
- [ ] `verification-phase-1-bootstrap.json` ghi command, exit code, và verdict.

## Rollback

- Revert commit Phase 1 để bỏ `package.json`, `apps/web/**`, `services/api/**`, `tests/bootstrap/**`.
- Vì repo trước đó blank app/runtime [docs/code-standards.md:7-8], rollback không cần data migration.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chọn stack quá nặng | M | H | Chỉ chọn thứ cần cho web + API + tests; DB/queue/CMS là out of scope. |
| Command set mơ hồ làm P2–P6 đoán | M | H | Phase 1 acceptance bắt ghi exact commands và chạy chúng. |
| Bootstrap tạo abstraction “for later” | M | M | Chỉ skeleton health/error; provider adapters để P5. |
