---
id: 260717-1743-3d-museum-mvp
title: "3D museum MVP"
description: "Kế hoạch hard/TDD cho MVP bảo tàng 3D tối giản với Q&A grounding, TTS, avatar animation và fallback 2D."
status: in_progress
priority: P1
effort: "~40h target / 6 phases [ASSUMED until Phase 1 stack + Phase 4 asset probe]"
mode: hard
tdd: true
branch: main
created: 2026-07-17
author: user:sonnguyenque5@gmail.com
decisions: []
phase_graph: plan-graph.yaml
tags: [mvp, 3d, museum, qa, tts, fallback]
phases:
  - phases/phase-1-bootstrap.md
  - phases/phase-2-content-grounding.md
  - phases/phase-3-scene-shell.md
  - phases/phase-4-avatar-animation.md
  - phases/phase-5-qa-tts.md
  - phases/phase-6-fallback-smoke.md
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Plan: 3D museum MVP

## Tổng quan
Ship đường mỏng nhất có thể: một phòng 3D stylized, 3–5 hotspot, một avatar pre-rigged với một animation dựng sẵn, Q&A text grounded có citation, avatar nói bằng TTS, và một fallback 2D thật; STT, lip-sync, và WebAR nâng cao nằm ngoài MVP [docs/decisions/0001-mvp-scope.md:7-24][docs/system-architecture.md:13-15,72-89][docs/code-standards.md:12-16,80-99]. Repo hiện chưa có app runtime, manifest, hay test runner, nên Phase 1 phải khóa stack/bootstrap trước khi chạm feature code [docs/code-standards.md:7-8][docs/system-architecture.md:93-107]. Phần khó không phải animation Three.js nói chung — probe trước đó đã cho `status=ok`, `rotation=1.571`, `webgl=2` — mà là sourcing/cleanup/integration asset và kiểm chứng fallback mobile/perf; P3 owns `/api/scene` + `/api/tour`, P5 owns QA/TTS + abstention, và hai track này được tách để QA/TTS không bị khóa vào avatar asset [/tmp/three-probe/index.html:1-36][PRIOR][plans/reports/3d-museum-mvp-research-260717.md:13-25,55-60].

## Quyết định đã khóa
- Giữ scope reduced: entry bằng QR/image marker, một scene chính, fallback 3D viewer hoặc 2D, tour 5 bước, Q&A text grounded, và TTS; STT, lip-sync, WebAR nâng cao không vào MVP [docs/decisions/0001-mvp-scope.md:11-24].
- `/api/scene/{sceneId}` và `/api/tour/{tourId}` do P3 sở hữu; P5 không phụ thuộc avatar asset để ship QA/TTS [docs/engineering/api-contract.md:16-47].
- `content/approved/**` sẽ được seed bằng clean giả định (draft-clean / provisional) từ ảnh và text đã có, rồi swap dần bằng data thật; signoff vẫn phải tồn tại nhưng có thể là provisional trong giai đoạn đầu [docs/engineering/rag-content-schema.md:69-89][ASSUMED].
- `/api/qa` phải normalize server-side `answer`, `citations`, `confidence`, `abstained`, `abstainReason`, `traceId`; citations và strict structured output không đi cùng nhau trong cùng request [plans/reports/qa-tts-backend-research-260717.md:16-18,39-56].
- Fallback ladder không được phá: nếu AR/3D/AI lỗi, user vẫn đi được đến viewer/poster/hotspot/text/transcript [docs/system-architecture.md:83-89][docs/code-standards.md:80-99].
- Core scene/avatar chọn curated glTF/VRM path, không đẩy full AI-generated 3D scene vào critical path [plans/reports/3d-museum-mvp-research-260717.md:13-18,43-53].

## Constraint scan
| Constraint | Evidence | Plan response |
|---|---|---|
| Write lane chỉ trong `plans/**` | `ownership.yaml` khai báo `plans: [plans/]` [harness/data/ownership.yaml:8-16]. | Toàn bộ artifact chỉ nằm trong `plans/260717-1743-3d-museum-mvp/`. |
| Push/pr/ship/deploy dùng verification + plan approval | `stage-policy.yaml` yêu cầu verification, review-decision, plan-approval cho pr/merge/ship/deploy [harness/data/stage-policy.yaml:25-52]. | Mỗi phase phải tạo verification artifact; approval vẫn là bước người duyệt sau validate. |
| Repo blank, chưa có app code/manifest/test runtime | `code-standards.md` nêu repo hiện chỉ có harness và không có `package.json`, `pyproject.toml`, hay runtime app [docs/code-standards.md:5-8]. | Phase 1 là bootstrap bắt buộc, không phải nicety. |
| Stack chưa chốt | `system-architecture.md` gate A/B/C còn `[ASSUMED]` cho stack, asset, provider [docs/system-architecture.md:91-107]. | Phase 1 khóa stack; Phase 4 probe một avatar asset thật; Phase 5 giữ provider adapter mỏng. |
| Content grounding phải có source/chunk/citation rõ | `rag-content-schema.md` yêu cầu `ContentSource`, `RagChunk`, `TourStep`, `QaExample` và rule mỗi chunk phải có source, mỗi QA phải truy được citation [docs/engineering/rag-content-schema.md:9-89]. | Phase 2 chỉ tạo approved corpus nhỏ nhưng đủ gắn nguồn và signoff. |
| Error/fallback behavior phải rõ | `code-standards.md` bắt loading / degraded fallback / fail with recovery action; nếu QA fail vẫn show tour/citations, nếu TTS fail vẫn show transcript [docs/code-standards.md:65-99]. | Phase 3, 5, 6 đều test degraded mode chứ không chỉ happy path. |
| Glossary SSOT không có | `docs/glossary.yaml` không tồn tại trong snapshot này [OBSERVED via pre-plan filesystem check]. | Không tạo thuật ngữ mới; dùng đúng vocabulary sẵn có: scene, tour, Q&A, TTS, fallback. |

## Luồng dữ liệu

1. **Entry → scene/tour**: QR hoặc image marker mở web app; client lấy scene metadata và tour steps, rồi render landing scene [docs/system-architecture.md:72-81][docs/engineering/api-contract.md:18-47].
2. **Assumed-clean content → grounding**: source/chunk/tour/QA seed được dựng sạch giả định từ ảnh/text hiện có; Q&A đọc provisional chunks và map citation về `sourceId`/`chunkId`, rồi swap sang data thật khi có [docs/engineering/rag-content-schema.md:11-89][ASSUMED].
3. **Question → answer packet**: user gửi câu hỏi text; `/api/qa` trả `answer`, `citations`, `confidence`, hoặc error chuẩn; nếu evidence thiếu thì abstain thay vì đoán [docs/engineering/api-contract.md:48-68,100-117][plans/reports/qa-tts-backend-research-260717.md:51-71].
4. **Transcript → speech**: UI gửi transcript/approved text sang `/api/tts`; service trả `audioUrl` + `transcript`; nếu audio fail thì transcript vẫn còn trên màn hình [docs/engineering/api-contract.md:71-88][docs/code-standards.md:80-82].
5. **3D → fallback**: runtime ưu tiên scene/avatar, nhưng luôn có poster/list/2D hotspot mode; stretch feature không chen vào giữa ladder [docs/system-architecture.md:83-89].
6. **Logs tối thiểu**: chỉ cần scene load, fallback hit, QA request, TTS play cho demo; telemetry hơn thế là [ASSUMED] YAGNI [docs/system-architecture.md:113-119].

## Các phase
| # | Theme | Phụ thuộc | Cỡ |
|---|---|---|---|
| 1 | Bootstrap | none | nhỏ nhưng chặn toàn bộ feature |
| 2 | Content Grounding | P1 | nhỏ / data-first |
| 3 | Scene Shell | P1, P2 | trung bình |
| 4 | Avatar Animation | P3 | trung bình, asset-heavy |
| 5 | Qa Tts | P2, P3 | trung bình, provider-agnostic |
| 6 | Fallback Smoke | P3, P4, P5 | nhỏ nhưng bắt buộc |

## Phân rã phụ thuộc

- P1 phải xong trước mọi phase khác vì repo chưa có app manifest/runtime.
- P2 phải xong trước P3/P5 để scene, tour, và Q&A có approved IDs/citations.
- P3 phải xong trước P4/P5 vì room shell, scene/tour endpoints, và fallback UI là nền chung.
- P4 và P5 không phụ thuộc lẫn nhau; plan graph để chúng tách file ownership, không share surface.
- P6 phải xong sau P3/P4/P5 vì smoke cần all runtime paths.
- Không có phase nào start song song với phase khác trên cùng file surface; plan này cố ý serial cho các phần chạm chung, nhưng P4/P5 là sibling không đụng nhau.

## File ownership

| Phase | Owns | Notes |
|---|---|---|
| P1 Bootstrap | `package.json`, bootstrap config, `apps/web/**`, `services/api/**`, `tests/bootstrap/**` [ASSUMED exact filenames] | Owns setup only; no museum feature code. |
| P2 Content Grounding | `content/approved/**`, `tests/content/**` | Must not modify `content/derived/**`; derived observations remain read-only input [content/derived/image-observations/README.md:10-21]. |
| P3 Scene Shell | `services/api/src/scene/**`, `services/api/src/tour/**`, `apps/web/src/scene/**`, `apps/web/src/hotspots/**`, `apps/web/src/fallback/**`, `tests/scene/**`, `tests/api/scene-tour/**` [ASSUMED exact paths] | Owns room, hotspot, fallback, and static scene/tour endpoints. |
| P4 Avatar Animation | `assets/avatar/**`, `apps/web/src/avatar/**`, `tests/avatar/**`, scene mount edits [ASSUMED exact paths] | Owns avatar integration only; no QA/TTS. |
| P5 QA + TTS | `services/api/src/qa/**`, `services/api/src/tts/**`, `services/api/src/providers/**`, `apps/web/src/qa/**`, `apps/web/src/tts/**`, `tests/api/qa-tts/**` [ASSUMED exact paths] | Owns provider adapters and answer/speech UI. |
| P6 Fallback Smoke | `tests/e2e/**`, `tests/perf/**`, `tests/mobile/**` [ASSUMED exact paths] | No product code ownership; failures route back to owning phase. |

No parallel batch edits shared files because P3 serializes the scene/tour/API shell before the smoke, and P4/P5 are split so they do not overlap on file ownership.

## Test matrix
| Layer | Behavior | Phase |
|---|---|---|
| Bootstrap | manifest/runtime commands, health route, API error shape | P1 |
| Content | provisional/approved source status, explicit signoff artifact, chunk source/citation links, 5 tour steps, QA examples | P2 |
| Scene/API | scene route/page, `/api/scene/{sceneId}`, `/api/tour/{tourId}`, 3–5 hotspots, 2D fallback renders without WebGL | P3 |
| Asset | avatar manifest exists, animation clip advances, asset failure degrades | P4 |
| API/QA | known answer with citation, unknown question abstains, `abstained`/`abstainReason`, TTS success/failure shapes | P5 |
| UX fallback | transcript/citations remain when QA/TTS/3D fails | P3/P5/P6 |
| E2E | landing → scene → hotspot → QA citation → TTS → forced fallback | P6 |
| Mobile/perf | real-device/browser smoke and long-task check | P6 [ASSUMED target matrix] |

## Backwards compatibility / migration

- No existing app users, runtime data, or integrations need migration because the repo has no app/runtime today [docs/code-standards.md:7-8].
- Existing `content/derived/**` data is preserved; aliases/duplicates are not deleted because the observation README says aliases are retained to avoid broken references [content/derived/image-observations/README.md:10-21].
- New `content/approved/**` data is additive and validated before API/UI consumes it [docs/engineering/rag-content-schema.md:69-89].
- API contract changes after P5 require plan revision because client must depend on contract, not provider internals [docs/engineering/api-contract.md:10-15].

## Out of scope

- STT, lip-sync, WebAR nâng cao [docs/decisions/0001-mvp-scope.md:20-24].
- Multi-room, multi-avatar, CMS/admin, auth, payments, queue, vector DB, live-web default path [plans/reports/qa-tts-backend-research-260717.md:23-30,58-63][plans/reports/3d-museum-mvp-research-260717.md:43-53].
- Full AI-generated scene/avatar pipeline; chỉ cho phép AI hỗ trợ prop tĩnh nếu sau này cần, và không ở critical path MVP [plans/reports/3d-museum-mvp-research-260717.md:13-18,43-53].
- Persist answer artifact riêng ngoài contract hiện tại [ASSUMED] không cần cho demo này.

## Acceptance toàn plan
- [ ] Phase 1 chốt stack, package manager, test commands, và bootstrap files trước khi feature phase bắt đầu.
- [ ] Một phòng 3D stylized render được với 3–5 hotspot và luôn có đường 2D fallback.
- [ ] `GET /api/scene/{sceneId}` và `GET /api/tour/{tourId}` trả đúng seeded scene/tour data do P3 sở hữu.
- [ ] Assumed-clean corpus có signoff artifact/provisional signoff, và mọi file đều có đường thay thế bằng data thật khi xuất hiện.
- [ ] `POST /api/qa` trả answer chỉ khi có citation tới seed corpus hiện hành; câu hỏi thiếu evidence phải set `abstained`/`abstainReason` hoặc trả error chuẩn, không bịa.
- [ ] `POST /api/tts` trả audio hoặc ít nhất giữ transcript nếu audio/provider fail.
- [ ] Smoke test đi qua landing → scene → hotspot → QA citation → TTS → fallback drill.
- [ ] Không có STT, lip-sync, advanced WebAR, vector DB, queue, CMS, hay live-web default path lọt vào MVP.
- [ ] Mỗi phase phát sinh verification artifact trước khi phase sau bắt đầu.

## Rollback

- Mỗi phase đi bằng một commit riêng; nếu hỏng thì revert theo thứ tự ngược dependency.
- P1 rollback: bỏ bootstrap/runtime skeleton, trả repo về blank state.
- P2 rollback: xóa `content/approved/**`; giữ nguyên `content/derived/**` vì đó là lớp derived_unverified, không phải source final.
- P3 rollback: remove scene shell, giữ fallback 2D nếu nó vẫn xanh.
- P4 rollback: tắt/remove avatar asset path và animation hook; scene/fallback vẫn sống.
- P5 rollback: disable QA/TTS adapter, quay về tour + transcript/fallback content.
- P6 rollback: xóa smoke/perf harness thôi; lỗi sản phẩm phải quay về phase sở hữu chứ không vá tại smoke.

## Rủi ro

| Rủi ro | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Asset avatar không đủ sạch / không đúng license / không có clip | H | H | Phase 4 probe một asset thật trước khi polish; nếu fail thì dừng ở static avatar card và giữ transcript path. |
| Cleanup/integration asset vượt budget 40h | H | H | Giữ curated core trước, AI prop chỉ là optional; time-box từng asset và bỏ set dressing trước khi bỏ fallback [plans/reports/3d-museum-mvp-research-260717.md:13-18,43-60]. |
| Fallback 2D/mobile perf không đạt | M | H | Build fallback trước polish; Phase 6 test trên browser thật và kiểm long tasks [plans/reports/3d-museum-mvp-research-260717.md:16-18,55-60]. |
| Seed corpus quá mỏng cho QA | M | H | Câu trả lời chỉ được dùng seeded chunks; thiếu evidence thì abstain, không mượn raw derived image observations trực tiếp [docs/engineering/rag-content-schema.md:69-89][content/derived/image-observations/README.md:1-26]. |
| TTS provider/quota/latency chặn demo | M | H | Dùng adapter boundary + transcript fallback; nếu provider chưa khóa thì giữ speech dựng sẵn [docs/system-architecture.md:104-107][plans/reports/qa-tts-backend-research-260717.md:58-71,73-97]. |
| Bootstrap stack bị chọn sai | M | M | Phase 1 chốt stack một lần; không đổi framework sau khi phase 1 đã green trừ khi mở lại plan. |
| Scope creep quay lại qua feature “hay ho” | M | M | DEC 0001 chặn STT/lip-sync/advanced WebAR trước khi smoke mandatory pass [docs/decisions/0001-mvp-scope.md:39-46]. |

## Unresolved assumptions

- [ASSUMED] Exact package manager, frontend framework, backend runtime, và test runner; Phase 1 phải khóa và cập nhật command thật.
- [ASSUMED] Không có clean data sẵn; Phase 2 sẽ synthesize assumed-clean corpus từ ảnh/text hiện có và giữ đường thay thế bằng data thật sau.
- [ASSUMED] Có thể lấy một pre-rigged avatar với license/size/clip phù hợp trong budget Phase 4.
- [ASSUMED] TTS provider/credentials/quota sẵn sàng; nếu không, cần quyết định người thật trước khi dùng speech dựng sẵn cho demo; P5 vẫn phải ship độc lập với avatar.
- [ASSUMED] Target mobile matrix là Android Chrome + iOS Safari; Phase 6 phải xác nhận trên thiết bị thật.
- [ASSUMED] Ngưỡng perf chính xác sẽ được chốt sau run thật đầu tiên; hiện chỉ cam kết tránh long tasks và giữ fallback usable.
