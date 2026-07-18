---
id: 260718-2242-eager-guide-voice-fix
title: "Align guide eager-load policy and fix voice mic flow"
status: completed
mode: hard
tdd: true
branch: feat/media-runtime-guide-voice
created: 2026-07-18
author: user:sonnguyenque5@gmail.com
decisions: []
phases:
  - phases/phase-1-guide-eager-policy.md
  - phases/phase-2-guide-promotion-hitch-reduction.md
  - phases/phase-3-live-config-provider.md
  - phases/phase-4-verification.md
phase_graph: plan-graph.yaml
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Plan: Align guide eager-load policy and fix voice mic flow

## Tổng quan
Khóa lại policy cho guide animated assets là **eager load có chủ đích sau bootstrap**, rồi tối ưu đường promote để giảm hitch khi swap từ fallback sang animated guide. Cùng lúc đó, vá luồng mic voice end-to-end để audio thực sự đi qua seam Live/REST recovery đúng cách và frontend không bị kẹt state sau khi ghi âm. Scope này giữ lazy/degraded cho scene props, media phụ, và video nặng; không mở rộng sang một media scheduler tổng quát hay sweep toàn bộ nợ media/runtime cũ.

## Quyết định đã khoá
- Guide animated assets dùng policy name `preload: "eager"`; docs sẽ nói rõ đây là eager sau bootstrap cho guide path.
- Mục tiêu là load guide sớm nhưng không giật, không hạ chất lượng góc nhìn đầu.
- Lazy/degraded vẫn áp cho scene props / media phụ / video nặng, không áp blanket lên guide.
- Voice fix chạy theo lane code + config: sửa UI/client/API seam và cập nhật `.env.example` + `render.yaml` để Live thực sự bật được ở local/deploy Render lane.
- Frontend/state path là ưu tiên debug đầu tiên cho mic voice; chỉ mở rộng sang provider transport rewrite nếu focused evidence vẫn chỉ ra incompatibility ở upstream audio seam.

## Ràng buộc (constraint-scan)
- `docs/system-architecture.md:55-80` và `docs/code-standards.md:38-43,60-72` hiện đang encode giả định lazy media khá rộng; phase 1 phải đảo các claim này cho nhất quán với policy guide eager.
- `harness/data/stage-policy.yaml:30-52` giữ push/merge/deploy ở hard stage với verification artifacts; cook phải phát `verification-PN.json` cho từng phase.
- `harness/data/ownership.yaml:9-16` cho phép docs dưới `docs/` và plan artifacts dưới `plans/`; implementation chạm cả app/api/content/tests/docs nên phải giữ phase ownership rõ.
- `services/api/src/live/index.js:105-181` là gate capability + MIME/size/duration contract cho voice audio; frontend phải gửi payload phù hợp thay vì dựa vào giả định browser default.

## Phases
| # | Theme | Phụ thuộc | Cỡ |
|---|---|---|---|
| 1 | Guide eager policy + contract reversal | none | medium |
| 2 | Guide promotion hitch reduction | 1 | medium |
| 3 | Voice mic flow + live enablement | 2 | large |
| 4 | Verification + docs/manual alignment | 1-3 | medium |

## Phases chi tiết

### P1 — Guide eager policy + contract reversal
Đổi 4 guide FBX trong `content/approved/media/tay-ho-giay-do-room-01.json` sang `preload: "eager"`, preserve trường `preload` qua `apps/web/src/media/manifest-adapter.js`, rồi cập nhật tests/docs đang coi eager guide là bug. Không đổi lazy behavior của video hay scene props.

### P2 — Guide promotion hitch reduction
Giữ eager prewarm sau bootstrap, nhưng chia `promoteAnimatedCharacters()` trong `apps/web/src/main.js` thành các nhịp promotion nhỏ để tránh gom clone/material/mixer/swap vào một tick lớn. Reuse `modelRegistry` promise cache; không tạo scheduler tổng quát mới.

### P3 — Voice mic flow + live enablement
Sửa `apps/web/src/systems/UIController.js` để chọn MIME an toàn bằng `MediaRecorder.isTypeSupported`, auto-stop trong trần 30s, reset cleanly khi blob rỗng hoặc recorder fail. Sau khi phase 2 ổn định `apps/web/src/main.js`, sửa tiếp `apps/web/src/qa/live-client.js` và `apps/web/src/main.js` để audio attempt không bị drop sớm khi capability false, và luồng recovery không gọi `/api/qa` với câu hỏi rỗng. Reset `QUESTION_VOICE` về `WATCHING_DIALOGUE` sau submit/close. Cập nhật `.env.example` và `render.yaml` để `GEMINI_LIVE_QA_ENABLED=1` có mặt ở lane local/deploy.

### P4 — Verification + docs/manual alignment
Cập nhật docs/manual/perf tests để phản ánh policy mới: guide assets được eager post-bootstrap, còn scene props/video vẫn lazy. Chạy focused tests cho guide eager contract, voice mic flow, live route MIME/capability, rồi regression gate build/lint/test.

## File ownership
| Phase | Owns create | Owns modify | Must not touch |
|---|---|---|---|
| P1 | none | `content/approved/media/tay-ho-giay-do-room-01.json`, `apps/web/src/media/manifest-adapter.js`, `tests/perf/demo-path-budget.test.mjs`, `tests/e2e/media-manifest-runtime.test.mjs`, `tests/mobile/manual-checklist.md`, `docs/system-architecture.md`, `docs/code-standards.md`, `docs/engineering/api-contract.md`, `README.md`, `docs/submission-overview.md` | voice provider internals, route validation logic |
| P2 | none | `apps/web/src/main.js`, maybe `apps/web/src/media/model-registry.js` only if a tiny preload helper is unavoidable, guide-related focused tests | manifest/docs/config unless test fallout requires update |
| P3 | maybe one frontend mic-state test file if needed | `apps/web/src/systems/UIController.js`, `apps/web/src/main.js`, `apps/web/src/qa/live-client.js`, `apps/web/src/systems/TourManager.js`, `.env.example`, `render.yaml`, `tests/e2e/live-voice-smoke.test.mjs`, `tests/api/live/live-relay.contract.test.mjs`, `tests/scene/guide-voice-audio.test.mjs` | broad QA grounding logic, scene prop lazy logic |
| P4 | none | docs/manual/tests touched by phases 1-3 plus plan artifacts | feature expansion outside eager-guide + voice fix |

## Acceptance (toàn plan)
- [x] Guide assets are explicitly represented as eager in the approved media manifest and no longer contradicted by docs/tests.
- [x] First render still comes from fallback shell quickly, but guide promotion no longer does all heavy swap work in one large synchronous step.
- [x] Scene props and heavy videos remain lazy/degraded; guide eager does not widen into “load everything”.
- [x] Voice mic path chooses a supported recording MIME, handles empty/failed recordings cleanly, and never leaves the frontend stuck in `QUESTION_VOICE`.
- [x] Audio attempts follow a recovery path when Live is disabled or unavailable instead of silently dying at the UI seam.
- [x] Local/deploy config documents and exposes `GEMINI_LIVE_QA_ENABLED` consistently.
- [x] Focused tests, lint, and build pass.

## Out of scope
- Generalized media scheduler/orchestrator.
- Broad sweep of scene-prop lazy bugs beyond what is required to preserve the eager-guide distinction in tests/docs.
- Rewriting Gemini Live provider transport unless the focused probe proves the current browser-audio payload is incompatible even after MIME/state fixes.
- Fixing every deferred media-service/static-serving issue from prior reviews.

## Rollback
- P1 rollback: revert manifest `preload` policy and the matching docs/tests contract edits as one slice.
- P2 rollback: revert staged promotion changes in `apps/web/src/main.js` and keep the previous eager behavior if the swap path regresses animation correctness.
- P3 rollback: revert mic/UI/client/config changes together; typed QA/TTS must remain intact.
- P4 rollback: revert docs/manual/test-only changes if they drift from the shipped runtime behavior.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Eager guide policy accidentally expands to all media startup | M | H | Scope `preload: "eager"` to the 4 guide assets only and assert the rest remain lazy. |
| Hitch persists because parse/clone/swap still happens in one frame | H | M | Split promotion work into staged steps; keep fallback until final swap. |
| Voice still fails because deploy flag remains off | H | M | Treat `.env.example` + `render.yaml` as owned files in the same plan; verify `/api/health` capability contract. |
| Frontend still gets stuck after mic attempt | H | H | Reset `QUESTION_VOICE` on submit/close and add a focused mic-state test. |
| Browser/container audio still rejected upstream | M | M | First harden MIME selection and route validation path; only escalate to transport conversion if focused evidence says current provider seam is still insufficient. |
