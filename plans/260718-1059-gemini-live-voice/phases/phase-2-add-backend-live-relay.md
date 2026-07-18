---
phase: 2
title: "Add Backend Live Relay"
status: pending
plan: 260718-1059-gemini-live-voice
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 2 — Add Backend Live Relay

## Overview
Add a default-closed backend Live turn relay that validates input, isolates transcription from grounded answering, pins `gemini-3.1-flash-live-preview` over the Live API WebSocket, and falls back through the existing REST path. This phase owns server/provider behavior only; browser UX wiring waits for Phase 3.

## Files
- **Create** `services/api/src/live/index.js`
- **Create** `services/api/src/providers/gemini-live.js`
- **Modify** `services/api/src/server.js`
- **Create** `tests/api/live/live-relay.contract.test.mjs`
- **Create** `tests/api/live/gemini-live-provider.contract.test.mjs`
- **Modify** `tests/bootstrap/health-endpoint-smoke.test.mjs`

## TDD
### Tests Before
- [ ] `node --test tests/bootstrap/*.test.mjs tests/api/qa-tts/qa-tts.contract.test.mjs` locks current server routes and REST QA contract before the new Live route exists.
- [ ] `node --test tests/api/live/live-relay.contract.test.mjs tests/api/live/gemini-live-provider.contract.test.mjs` is expected to fail until route/provider behavior exists.
- [ ] Add failing 400-shape tests for exactlyOneOf text/audio, blank text, missing input, invalid MIME, bad base64, oversize audio, and over-duration.
- [ ] Add failing capability tests for unset/`0`/`1` `GEMINI_LIVE_QA_ENABLED` via `/api/health`.
- [ ] Add failing fake-upstream tests for transcript/audio/citation mismatch, provider hang, client abort, and WebSocket close count.

### Implement
1. Add `/api/qa/live` in `services/api/src/server.js`, disabled unless `GEMINI_LIVE_QA_ENABLED === '1'`.
2. Extend `/api/health` with non-secret `capabilities.qaLiveVoice` so browser can avoid failed Live calls when disabled.
3. Validate the request before provider calls: JSON object, `sceneId`, exactly one of trimmed non-empty `text` or bounded `audio { mimeType, dataBase64, durationMs }`.
4. Keep constants local to the relay for MVP: MIME allowlist `audio/webm|audio/mp4|audio/wav`, max bytes `5_000_000`, max duration `30000ms`.
5. Implement `services/api/src/providers/gemini-live.js` with pinned model `models/gemini-3.1-flash-live-preview` and WSS endpoint `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`.
6. Split audio path into two isolated provider calls: transcription-only session receives raw audio and closes; answer session receives only transcript + approved chunks from the Phase 1 QA seam.
7. For typed path, skip transcription and call the answer session with trimmed text + approved chunks only.
8. Enforce canonical answer invariant: normalize Unicode NFC, trim, collapse whitespace, strip terminal punctuation; require normalized `outputTranscript === answer`, else regenerate audio once or reject Live success.
9. Add route timeout, per-upstream timeout, client abort propagation, explicit terminal event handling, and `finally` WebSocket close.
10. Map fallback: typed failure -> REST QA+TTS; audio failure after transcript -> REST QA+TTS from transcript; audio failure before transcript -> structured recovery with no fake citations.

### Tests After
- [ ] `node --test tests/api/live/live-relay.contract.test.mjs tests/api/live/gemini-live-provider.contract.test.mjs tests/api/qa-tts/qa-tts.contract.test.mjs tests/bootstrap/*.test.mjs` passes.
- [ ] Provider tests prove answer-session payload excludes raw audio bytes and prior session history.
- [ ] Fake-upstream hang/abort tests assert WebSocket close count and no hanging request.

### Regression Gate
`npm run lint && npm run typecheck && npm run build && node --test tests/api/live/live-relay.contract.test.mjs tests/api/live/gemini-live-provider.contract.test.mjs tests/api/qa-tts/qa-tts.contract.test.mjs tests/bootstrap/*.test.mjs`

## Success
- [ ] `/api/qa/live` is disabled by default and exposed as enabled only when `GEMINI_LIVE_QA_ENABLED=1`.
- [ ] Invalid input returns 400 with the existing API error object shape before any provider call.
- [ ] Audio mode closes transcription session before opening answer session.
- [ ] Answer session never receives raw audio or transcription session history.
- [ ] Mismatched answer/output transcript/citation state cannot return a successful Live response.
- [ ] Timeouts, aborts, `goAway`, unexpected close, and missing terminal event all close sockets and return structured failure.

## Risks
- Likelihood: M. Impact: H. Gemini Live protocol/auth mismatches can fail the relay at runtime.
- Mitigation: pin model/endpoint/interface in provider tests, keep Live default-closed, isolate provider module, and retain REST fallback.
