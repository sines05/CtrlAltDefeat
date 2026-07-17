---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Research: text Q&A + TTS backend

**Mode**: breadth  
**Date**: 2026-07-17  
**Sources reviewed**: 10

## Tóm tắt
- Chọn backend mỏng, provider-agnostic, kiểu modular monolith với 3 port rõ: corpus/retrieval, answer synthesis, speech synthesis.
- Giữ `/api/scene` + `/api/tour` static; `/api/qa` sync và grounded; `/api/tts` tách riêng để transcript vẫn sống khi audio lỗi.
- Không dùng `output_config.format` cho cùng request cần citations; Anthropic nói citations và structured outputs không tương thích, 400.
- Dataset ảnh approved không có citation native; phải convert sang text/custom-content/OCR/caption layer trước khi cite.
- TTS p95, độ trung thực citation cho ảnh, và policy live-web là [ASSUMED] cho tới khi cook đo.

## So sánh
| Phương án | Lợi | Hại | Fit dự án |
|---|---|---|---|
| A. Modular monolith + adapter ports | Ít code, đúng contract hiện có, fallback rõ, dễ swap provider | Cần normalize citation/abstain ở server, audio là 2 hop | +++ |
| B. Monolith + async TTS job/artifact | Che latency audio, cache/reuse audio tốt | Queue/state/polling, thêm infra, không cần thiết cho 40h | ++ |
| C. Tách QA/TTS thành service riêng | Isolation tốt, scale rõ | Overkill cho repo hiện tại, ops nặng, rủi ro trễ demo | -- |

## Khuyến nghị
**Priority 1**: A — Modular monolith, sync Q&A, riêng TTS adapter, canonical answer packet do server normalize.

**Fallback**: B — chỉ khi cook chứng minh TTS p95 vượt ngưỡng UX hoặc audio reuse thành bottleneck.

### Boundary nên chốt
- `SceneRepository` / `TourRepository`: static JSON đã duyệt.
- `ApprovedCorpusRetriever`: chỉ approved content; ưu tiên text chunks, không cite ảnh thô.
- `LiveWebRetriever`: adapter riêng cho web nguồn mới; chỉ bật khi câu hỏi current/changing hoặc corpus thiếu.
- `AnswerSynthesizer`: trả text + citation map + abstain metadata.
- `SpeechSynthesizer`: text/SSML -> audioUrl/transcript; không tham gia grounding.

### Shape nên có ở app layer
- `QaAnswer { answer, citations, confidence, abstained, abstainReason, traceId }`
- `SpeechResult { audioUrl, transcript, voice, traceId }`
- `Error { code, message, retryable, traceId }`

## Vì sao
- Repo hiện chưa có app code, manifest, hay stack chốt; gate còn mở [docs/code-standards.md:7-8][docs/system-architecture.md:93-107][plans/reports/scout-260717-setup-ps142.md:14-19].
- API contract đã tách scene/tour/qa/tts; giữ tách boundary này là nhỏ nhất và đúng hướng MVP [docs/engineering/api-contract.md:16-89].
- Code standards yêu cầu UI/service/provider adapter tách lớp; không gọi provider trực tiếp từ view [docs/code-standards.md:58-63].
- PRD, user flow, DEC đều ưu tiên tour, grounded QA, TTS, và fallback text khi audio fail [docs/ux/user-flow.md:37-53][docs/decisions/0001-mvp-scope.md:11-24][docs/engineering/mvp-40h.md:32-72].
- RAG schema đã giả định chunk/source/citation riêng; đó là đúng chỗ để gắn nguồn chứ không phải model output raw [docs/engineering/rag-content-schema.md:11-74].

## Citations / abstention
- Với Claude citations, chỉ PDF/plain text/custom content là cite được; image citations chưa có [docs/citations lines 321-323, 329-341].
- Citations và structured outputs không đi cùng nhau; nếu bật citations cho document/search_result mà thêm `output_config.format`, API trả 400 [docs/citations lines 379-383].
- Vì vậy, `/api/qa` nên để model trả text có citations, rồi backend normalize thành JSON response; đừng ép model xuất strict JSON schema nếu citation là bắt buộc.
- Cho approved image dataset: chuyển ảnh sang OCR/caption/custom-content chunk trước, hoặc ít nhất lưu `sourceId`/`assetId` để citation map về nguồn nội bộ. Không trông chờ citation native trên ảnh [docs/vision.md; docs/citations lines 323, 329-341].
- Abstention phải explicit: nếu retrieval coverage thấp hoặc evidence conflict, trả `abstained=true` + `abstainReason`, không đoán bừa.

## Latency / error / fallback
- Với output dài hoặc turn nhiều tool, stream để tránh timeout; Anthropic khuyên streaming cho request dài, và SDK tự retry transient 429/5xx [docs/streaming.md][docs/errors.md].
- Error policy app-level nên map `429/500/529/504` thành `retryable=true`; `400/404` không retry [docs/errors.md].
- Nếu live-web branch dùng Anthropic web search, citations đi kèm trong response và domain filtering có sẵn (`allowed_domains` / `blocked_domains`) [https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool].
- Live-web chỉ nên là fallback/extension, không phải đường mặc định cho corpus approved.
- TTS fail không được làm rơi transcript text; UI giữ transcript + citation tĩnh.

## Cook phải probe
1. Một thin slice end-to-end: scene -> tour -> QA -> TTS trên 1 scene thật.
2. Image citation path: raw image vs OCR/caption vs custom-content chunk; đo hit-rate citation và độ trùng nguồn.
3. `POST /qa` latency: p50/p95, with/without live-web, with corpus đủ/thiếu.
4. `POST /tts` latency: time-to-first-audio, complete-audio, cache hit, URL lifetime.
5. Failure drills: `refusal`, corpus thiếu evidence, web search unavailable, TTS timeout, 429/500/529/504.
6. Response shape: verify server-normalized JSON có đủ `abstained`, `citations`, `traceId`, và text fallback vẫn render khi TTS chết.

## Điều chưa đánh giá
- Exact TTS vendor, cost, quota, và quality. [ASSUMED]
- Exact live-web policy: default-on hay only-on-demand. [ASSUMED]
- Persist answer artifact hay chỉ trả text để `/tts` dùng trực tiếp. [ASSUMED]
- Stack/framework cụ thể. Repo hiện chưa có manifest hay app runtime [docs/code-standards.md:7-8].

## Evidence and references
[1] /home/sonnq6/CtrlAltDefeat/docs/engineering/api-contract.md:16-89 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[2] /home/sonnq6/CtrlAltDefeat/docs/system-architecture.md:17-119 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[3] /home/sonnq6/CtrlAltDefeat/docs/engineering/rag-content-schema.md:11-89 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[4] /home/sonnq6/CtrlAltDefeat/docs/code-standards.md:7-16,58-83,101-106 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[5] /home/sonnq6/CtrlAltDefeat/docs/ux/user-flow.md:37-53,62-68 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[6] /home/sonnq6/CtrlAltDefeat/docs/engineering/mvp-40h.md:32-72 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[7] /home/sonnq6/CtrlAltDefeat/docs/decisions/0001-mvp-scope.md:11-24,39-43 | CtrlAltDefeat docs | 2026-07-17 | VERIFIED
[8] https://platform.claude.com/docs/en/build-with-claude/citations.md | Anthropic | 2026-07-17 | VERIFIED
[9] https://platform.claude.com/docs/en/build-with-claude/vision.md | Anthropic | 2026-07-17 | VERIFIED
[10] https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool | Anthropic | 2026-07-17 | VERIFIED
[11] https://platform.claude.com/docs/en/build-with-claude/streaming.md | Anthropic | 2026-07-17 | VERIFIED
[12] https://platform.claude.com/docs/en/api/errors.md | Anthropic | 2026-07-17 | VERIFIED

## Câu hỏi mở
- [ASSUMED] Approved image dataset sẽ được OCR/caption hóa thành text chunks hay giữ image+metadata? — source needed: sample corpus + cook pilot.
- [ASSUMED] TTS p95 có nằm trong UX budget hay cần async job? — source needed: cook latency measurement.
- [ASSUMED] Live-web mặc định bật hay chỉ khi corpus thiếu/current-question? — source needed: product decision.
- [ASSUMED] Có cần persist answer artifact để `/tts` tái dùng không? — source needed: demo requirement.
