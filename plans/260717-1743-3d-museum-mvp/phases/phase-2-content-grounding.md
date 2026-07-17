---
phase: 2
title: "Content Grounding"
status: pending
plan: 260717-1743-3d-museum-mvp
created: 2026-07-17
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 2 — Content Grounding

## Overview
Tạo bộ assumed-clean / provisional content nhỏ nhưng đủ dùng cho scene, hotspots, tour, Q&A, và TTS. `content/derived/image-observations` là derived_unverified nên chỉ làm input nháp; phase này sẽ clean, normalize, và synthesize corpus dùng được ngay rồi để đường thay thế bằng data thật sau [content/derived/image-observations/README.md:1-26][ASSUMED].

## Scope
- Tạo seed `ContentSource`, `RagChunk`, `TourStep`, `QaExample`, và TTS scripts theo schema đề xuất [docs/engineering/rag-content-schema.md:9-89]. Nếu clean data thật chưa có, synthesize corpus giả định từ ảnh/text hiện có và tag rõ provisional.
- Đủ 3–5 hotspot và tour 5 bước theo MVP scope [docs/decisions/0001-mvp-scope.md:11-18].
- Mỗi chunk có `sourceId`; mỗi tour/QA reference được tới source/chunk đã approved [docs/engineering/rag-content-schema.md:69-89].
- Tạo explicit signoff/provisional-signoff artifact dưới `content/approved/signoffs/**`; không tự phong `approved` nếu thiếu review cuối.
- Không build retrieval/provider/UI ở phase này; đó là P3/P5.

## Inputs
- Phase 1 command/runtime output.
- RAG schema và API contract [docs/engineering/rag-content-schema.md:9-89][docs/engineering/api-contract.md:48-88].
- Derived image observations as draft-only material [content/derived/image-observations/README.md:17-25].
- Derived image observations + any text approved sẵn + explicit signoff/provisional-signoff artifact [ASSUMED clean data thật không sẵn].

## Outputs
- `content/approved/**` seed corpus có source, chunks, tour, QA examples, TTS script, và signoff/provisional-signoff artifact, tất cả có thể swap bằng data thật sau.
- Content validation tests.
- Verification artifact: `verification-phase-2-content-grounding.json`.

## Touched Paths
Create:
- `content/approved/sources/museum-room-01.json` [ASSUMED filename]
- `content/approved/chunks/hotspot-01.json` … `content/approved/chunks/hotspot-05.json` [ASSUMED 3–5 final count]
- `content/approved/tours/tour-01.json`
- `content/approved/qa-examples/qa-01.json` … `content/approved/qa-examples/qa-05.json` [ASSUMED count]
- `content/approved/tts/intro-01.json`
- `content/approved/signoffs/museum-room-01.json`
- `tests/content/**` [ASSUMED exact runner path from P1]

Modify:
- none expected outside `content/approved/**` and `tests/content/**`.

Delete:
- none; never delete aliases from derived observations [content/derived/image-observations/README.md:10-21].

## Tests Before
- [ ] `test_seed_sources_have_status`: FAIL until every source has `status: provisional` hoặc `status: approved` [docs/engineering/rag-content-schema.md:15-22].
- [ ] `test_approved_content_has_explicit_signoff`: FAIL until signoff artifact exists and names the reviewed source/chunk set.
- [ ] `test_chunks_have_source_and_citation`: FAIL until every chunk has `sourceId`, `text`, and `citation` [docs/engineering/rag-content-schema.md:25-38,69-74].
- [ ] `test_tour_steps_reference_chunks`: FAIL until 5 tour steps reference existing chunk IDs [docs/engineering/rag-content-schema.md:41-54].
- [ ] `test_qa_examples_have_expected_sources`: FAIL until QA examples map to source IDs [docs/engineering/rag-content-schema.md:57-66].

## Implement
1. Pick one room narrative and 3–5 hotspot topics from the available image/text corpus; if only derived image observations exist, clean and synthesize a provisional seed corpus from them, tagged for later replacement [content/derived/image-observations/README.md:1-26][ASSUMED].
2. Write the smallest provisional/approved source-chunk set that supports the tour, hotspots, and 3–5 smoke QA prompts.
3. Write the explicit signoff or provisional-signoff record with reviewer/author, date, and reviewed source IDs; do not hide whether the review is provisional.
4. Keep text short and citation labels explicit; do not encode long prose directly in UI [docs/code-standards.md:58-63].
5. Add TTS script text for one intro/tour line; no provider call in this phase.
6. Run content validation red→green.

## Tests After
- [ ] All sources have `status: provisional` hoặc `status: approved` kèm provenance rõ.
- [ ] Signoff/provisional-signoff artifact exists and references the seed source/chunk set.
- [ ] All chunks have valid `sourceId`, `sceneId`, `text`, `keywords`, `citation`, and `provenance`.
- [ ] Tour has exactly 5 steps and each step cites at least one chunk.
- [ ] QA examples have expected answer hints and source IDs.
- [ ] TTS script references the provisional/approved tour-answer text actually shipped in this seed corpus.

## Regression Gate

- Run `tests/content/**` with the Phase 1 test command.
- Then rerun the Phase 1 full command set: `<package-manager> test`, `<package-manager> lint`, `<package-manager> typecheck`, `<package-manager> build` [ASSUMED exact executable until P1 locks stack].

## Acceptance
- [ ] 3–5 hotspot records exist and match the one-room scope.
- [ ] Tour has 5 steps.
- [ ] At least 3 QA examples have answer hints and citations.
- [ ] Explicit signoff or provisional-signoff artifact exists for the seed content set.
- [ ] No final answer/tour text depends on untagged derived observations; provisional data must be visibly swappable.
- [ ] `verification-phase-2-content-grounding.json` records content validation output.

## Rollback

- Revert/delete `content/approved/**` and `tests/content/**` from this phase.
- Leave `content/derived/**` untouched; it is input evidence, not generated output.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| No clean content ready | M | H | Synthesize assumed-clean corpus with provisional tags; keep replacement path for real data. |
| Signoff becomes self-asserted paperwork | M | H | Require a separate review artifact with named reviewer and reviewed IDs; provisional signoff must be explicit. |
| QA coverage too broad for seed corpus | M | H | Limit smoke questions to seeded provisional/approved chunks; P5 abstains outside coverage. |
| Content schema drifts before code consumes it | M | M | Schema tests are the contract; P3/P5 read only through validated IDs. |
