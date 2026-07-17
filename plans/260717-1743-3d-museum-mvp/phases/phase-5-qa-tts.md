---
phase: 5
title: "Qa Tts"
status: pending
plan: 260717-1743-3d-museum-mvp
created: 2026-07-17
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 5 — QA + TTS

## Overview
Wire grounded text Q&A and TTS through the thin API boundary, then expose transcript/audio controls in the scene UI. Keep `/api/qa` and `/api/tts` separate so transcript + citations survive audio/provider failure [docs/engineering/api-contract.md:48-88][docs/code-standards.md:80-82][plans/reports/qa-tts-backend-research-260717.md:13-18,27-43]. This phase does not depend on the avatar asset; avatar integration can consume the same speech packet later, but QA/TTS must stand alone.

## Scope
- Implement `POST /api/qa` over the seeded provisional/approved corpus from P2.
- Implement `POST /api/tts` through a provider adapter or deterministic local/mock adapter allowed by Phase 1 environment [ASSUMED exact provider].
- UI lets user submit text, read answer/citations, and play TTS audio.
- The API returns a normalized QA packet with `answer`, `citations`, `confidence`, `abstained`, `abstainReason`, and `traceId` on no-evidence/conflict paths.
- No live-web retrieval, no vector DB, no async queue, và không có avatar dependency.

## Inputs
- P2 approved corpus and QA examples.
- P3 scene/fallback UI.
- API contract [docs/engineering/api-contract.md:48-117].
- Research recommendation for modular monolith / adapter ports [plans/reports/qa-tts-backend-research-260717.md:13-18,27-43].

## Outputs
- `/api/qa` and `/api/tts` implementations.
- Approved corpus retriever, answer synthesizer/normalizer, speech adapter.
- Scene UI panel for question, answer, citations, transcript, and audio play.
- Verification artifact: `verification-phase-5-qa-tts.json`.

## Touched Paths
Create [ASSUMED exact filenames depend on P1 stack]:
- `services/api/src/qa/**`
- `services/api/src/tts/**`
- `services/api/src/providers/**`
- `apps/web/src/qa/**`
- `apps/web/src/tts/**`
- `tests/api/qa-tts/**`

Modify:
- `services/api/src/qa/**`
- `services/api/src/tts/**`
- `apps/web/src/qa/**`
- `apps/web/src/tts/**`

Delete:
- none.

## Tests Before
- [ ] `test_qa_known_question_returns_citation`: FAIL until known QA example returns answer + citation map [docs/engineering/api-contract.md:48-68].
- [ ] `test_qa_unknown_question_abstains`: FAIL until missing evidence returns `abstained`/`abstainReason` instead of invented answer [docs/engineering/rag-content-schema.md:69-89].
- [ ] `test_qa_rejects_unapproved_source`: FAIL until derived/unapproved content cannot be used as final grounding [content/derived/image-observations/README.md:1-26].
- [ ] `test_tts_returns_audio_url_and_transcript`: FAIL until TTS endpoint returns transcript + audio handle [docs/engineering/api-contract.md:71-88].
- [ ] `test_tts_failure_preserves_transcript`: FAIL until UI keeps transcript if adapter fails [docs/code-standards.md:80-82].

## Implement
1. Add corpus retriever that reads only the current P2 seed corpus (provisional or approved).
2. Add answer path that returns answer/citations/confidence/abstained/abstainReason and abstains on low/no evidence.
3. Avoid forcing model structured output in the same request as provider-native citations; research flags citation + structured-output incompatibility [plans/reports/qa-tts-backend-research-260717.md:16-18,51-56].
4. Add speech adapter that takes text and returns `{ audioUrl, transcript }` or standard retryable error.
5. Add UI panel: question input, answer, citations, transcript, play/stop audio.
6. Keep fallback UI rendering answer/transcript/citations when 3D/avatar/TTS degrades.

## Tests After
- [ ] Known QA examples return cited answers.
- [ ] Unknown/out-of-corpus question abstains with recoverable UI state.
- [ ] `abstained` and `abstainReason` are present on no-evidence responses.
- [ ] Unapproved derived observations are not accepted as grounding source.
- [ ] TTS success returns transcript + playable audio handle or documented deterministic mock handle [ASSUMED provider in local tests].
- [ ] TTS failure leaves transcript and citations visible.
- [ ] No lip-sync hooks exist.

## Regression Gate

- Run API contract + UI tests with the Phase 1 command set.
- Then rerun the full Phase 1 command set: `<package-manager> test`, `<package-manager> lint`, `<package-manager> typecheck`, `<package-manager> build` [ASSUMED exact executable until P1 locks stack].

## Acceptance
- [ ] `POST /api/qa` response includes `answer`, `citations`, `confidence`, và `abstained`/`abstainReason` on no-evidence paths, grounded only in the current seed corpus [docs/engineering/api-contract.md:48-68].
- [ ] Missing evidence path does not hallucinate; nó phải abstain hoặc trả standard error.
- [ ] `POST /api/tts` response includes `audioUrl` and `transcript` on success [docs/engineering/api-contract.md:83-88].
- [ ] UI keeps transcript if audio/provider fails.
- [ ] Audio play works without avatar coupling; avatar integration can subscribe later.
- [ ] `verification-phase-5-qa-tts.json` records QA, TTS, and failure drill evidence.

## Rollback

- Revert `services/api/src/qa/**`, `services/api/src/tts/**`, `services/api/src/providers/**`, `apps/web/src/qa/**`, `apps/web/src/tts/**`, and API/UI integration edits.
- Keep P3 scene/fallback and P4 avatar working without Q&A/TTS.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TTS provider quota/latency blocks demo | M | H | Adapter boundary + transcript fallback; if provider is unavailable, use approved pre-rendered audio only after human decision [ASSUMED]. |
| Citation fidelity fails for image-derived material | M | H | Do not cite raw derived observations; only cite reviewed text chunks [content/derived/image-observations/README.md:1-26][plans/reports/qa-tts-backend-research-260717.md:51-56]. |
| Live-web or vector DB sneaks in | M | M | Keep approved corpus retriever only; live-web remains out of scope [plans/reports/qa-tts-backend-research-260717.md:58-63]. |
| Structured output conflicts with citations | M | M | Normalize server-side; do not require provider-native citations plus strict output format in one call [plans/reports/qa-tts-backend-research-260717.md:16-18,51-56]. |
