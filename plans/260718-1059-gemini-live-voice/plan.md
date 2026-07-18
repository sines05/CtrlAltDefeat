---
id: 260718-1059-gemini-live-voice
title: "Migrate grounded QA to Gemini Live voice"
status: completed
mode: hard
tdd: true
branch: main
created: 2026-07-18
author: user:sonnguyenque5@gmail.com
decisions: []
phases:
  - phases/phase-1-lock-rest-grounding-contracts.md
  - phases/phase-2-add-backend-live-relay.md
  - phases/phase-3-wire-browser-live-voice.md
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Plan: Migrate grounded QA to Gemini Live voice

## Tổng quan
Chuyển grounded QA từ REST `generateContent` + `/api/tts` sang per-turn backend relay dùng Gemini Live API WebSocket, nhưng giữ `services/api/src/qa/index.js:181-267` làm nguồn sự thật duy nhất cho retrieval/citation. `/api/qa` và `/api/tts` ở `services/api/src/server.js:135-144` vẫn là fallback/rollback path; Live default-closed sau cờ `GEMINI_LIVE_QA_ENABLED=1` để staged rollout là thật.

## Quyết định đã khóa
- Không đụng corpus approved hay tour/scene schema; chỉ đổi transport và UI wiring [OBSERVED: docs/system-architecture.md:60-67,72-89].
- Retrieval và citation selection vẫn server-owned trong `services/api/src/qa/index.js:181-267`; relay mới chỉ được phép gọi seam được export từ file này, không được tự re-implement ranking.
- Model/API pin: `models/gemini-3.1-flash-live-preview` over Live API WebSocket endpoint `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`, not REST `generateContent` [OBSERVED: WebFetch Gemini Live API reference, 2026-07-18].
- Browser-to-backend dùng HTTP one-turn in MVP; backend-to-Gemini dùng isolated Live WebSocket sessions [OBSERVED: WebFetch Gemini Live API reference, 2026-07-18].
- `/api/qa` và `/api/tts` giữ nguyên như rollback path, vì code standards yêu cầu text Q&A + TTS là bắt buộc và degraded mode phải giữ transcript/text visible [OBSERVED: docs/code-standards.md:15-16,80-83].
- Voice-input đầu tiên là push-to-talk one-turn; continuous mic streaming, lip-sync, và WebAR nâng cao out of scope [OBSERVED: docs/code-standards.md:15-16; docs/system-architecture.md:109-118].

## Ràng buộc (constraint-scan)
- `plans/` là write zone duy nhất cho plan artifacts under `harness/data/ownership.yaml:16`; toàn bộ file plan phải nằm trong folder này.
- Hard stages require `verification` and `review-decision`/`plan-approval` on push/pr/merge/ship/deploy per `harness/data/stage-policy.yaml:25-53`.
- `verification.json` schema requires `stage`, `plan`, `actor`, `ts`, `checks`, `verdict`; cook writes it under `plans/<active>/artifacts/verification.json` [OBSERVED: harness/schemas/artifact-verification.json:4-6,28-49].
- System architecture already defines a mobile-first fallback ladder; do not invent a new journey or sneak stretch features into the mandatory path [OBSERVED: docs/system-architecture.md:72-89,113-119].

## Live capability contract
- `GEMINI_LIVE_QA_ENABLED` is default-closed: unset, empty, `0`, or any value other than `1` means disabled.
- `/api/health` exposes non-secret capability, e.g. `capabilities.qaLiveVoice = { enabled, model: "gemini-3.1-flash-live-preview" }`.
- Browser reads capability once during bootstrap and does not attempt Live when disabled.
- After one failed Live attempt in a turn, browser immediately falls back; no repeated failed Live call for the same turn.

## Live request contract
`POST /api/qa/live` is a backend HTTP façade over isolated Gemini Live provider calls.

Validation:
- Body must be JSON object with `sceneId` and exactly one of `text` or `audio`.
- `text` must trim to non-empty string.
- `audio` must be `{ mimeType, dataBase64, durationMs }`.
- `audio.mimeType` allowlist: `audio/webm`, `audio/mp4`, `audio/wav`.
- `audio.dataBase64` must decode to non-empty bytes and be `<= 5_000_000` bytes.
- `audio.durationMs` must be integer `> 0` and `<= 30000`.
- Invalid bodies return 400 using the existing error object shape from `docs/code-standards.md:65-83`; tests must cover missing body, both text+audio, neither text nor audio, blank text, invalid MIME, oversize audio, bad base64, and over-duration.

Request:
```json
{
  "sceneId": "tay-ho-giay-do-room-01",
  "text": "optional typed question",
  "audio": {
    "mimeType": "audio/webm",
    "dataBase64": "optional push-to-talk audio",
    "durationMs": 12000
  }
}
```

Success response:
```json
{
  "answer": "Vietnamese grounded answer text",
  "citations": [{ "label": "...", "ref": "content/approved/chunks/hotspot-01.json", "sourceId": "..." }],
  "confidence": "low|medium|high",
  "abstained": false,
  "abstainReason": null,
  "inputTranscript": "what the user said or typed",
  "outputTranscript": "what the voice response says",
  "audioMimeType": "audio/wav",
  "audioBase64": "base64 audio payload",
  "traceId": "uuid",
  "live": true
}
```

Failure response uses the existing API error shape from `docs/code-standards.md:65-83`; `LIVE_QA_DISABLED`, validation, upstream auth/connect/protocol timeout, and audio/transcript mismatch errors must not leak API keys.

## Provider-session separation
- Audio path uses two isolated provider calls/sessions.
- Session A: transcription-only Live session receives raw audio and returns `inputTranscript`; it is closed in `finally` before any answer call starts.
- Session B: grounded answer Live session receives only `inputTranscript`, scene metadata, and approved chunks/citations from the QA seam; it must never receive raw audio, Session A history, or unapproved context.
- Typed path skips Session A and treats trimmed `text` as `inputTranscript`; answer session still receives only text + approved chunks.
- Provider tests must assert pinned model ID and WSS endpoint for both sessions and assert answer-session payload excludes raw audio bytes and prior session history.

## Canonical answer text invariant
- Define one normalization helper for answer/audio parity: Unicode NFC, trim, collapse whitespace, strip terminal punctuation only; do not remove Vietnamese diacritics.
- A Live success is valid only when `normalize(outputTranscript) === normalize(answer)`.
- If upstream returns mismatched transcript/audio/citation state, regenerate audio once or reject the Live response before returning success.
- Fake-upstream tests must cover mismatch between `answer`, `outputTranscript`, audio payload, and citation refs; mismatches must not produce a fake successful Live answer.

## Fallback semantics
| Failure point | Required behavior |
|---|---|
| Typed Live disabled/fails before answer | Use existing `/api/qa` from typed text, then `/api/tts` from REST answer. |
| Audio mic denied in browser | No backend Live call; show typed recovery state, no fake citations. |
| Audio rejected before transcript | Show typed recovery state, no fake citations. |
| Audio transcript succeeded, answer session fails/mismatches/times out | Use existing `/api/qa` from `inputTranscript`, then `/api/tts` from REST answer. |
| REST fallback abstains | Show abstain text/reason and citations from REST only. |

## Timeouts, aborts, and cleanup
- Route-level timeout bounds the whole `/api/qa/live` turn.
- Each provider session has its own upstream timeout; transcription and answer timeouts are reported separately.
- Client disconnect/abort propagates to all in-flight provider sessions.
- Every WebSocket is closed in `finally`; fake-upstream hang/abort tests assert close count.
- Terminal events handled explicitly: `setupComplete`, `serverContent` with `turnComplete`/`generationComplete`, `goAway`, close, error, and timeout.
- `goAway`, unexpected close, or missing terminal event returns structured failure and triggers fallback semantics; no hanging request.

## Data flow
1. Browser input enters `apps/web/src/main.js:77-236` as text or push-to-talk.
2. Browser reads Live capability from `/api/health`; if disabled, it uses `/api/qa` + `/api/tts` without trying Live.
3. Browser calls `/api/qa/live` with exactly one of typed text or bounded audio payload.
4. Backend validates request; invalid input returns 400 and never opens provider sessions.
5. For audio, backend opens Session A for transcription, closes it, validates non-empty transcript, then runs the grounding seam from `services/api/src/qa/index.js:181-267`.
6. For text, backend treats text as `inputTranscript`, then runs the same grounding seam.
7. Backend opens Session B with transcript + approved chunks only, validates canonical answer text invariant, then returns answer/transcripts/audio/citations.
8. On failure, fallback follows the matrix above and preserves approved corpus/citation refs [OBSERVED: services/api/src/server.js:135-144; docs/code-standards.md:80-83].

## File ownership / touchpoints
| Phase | Files |
|---|---|
| 1 | `services/api/src/qa/index.js`, `tests/api/qa-tts/qa-tts.contract.test.mjs`, `tests/e2e/mvp-smoke.test.mjs`, `docs/engineering/qa-grounding-prompt.md` |
| 2 | `services/api/src/server.js`, `services/api/src/live/index.js`, `services/api/src/providers/gemini-live.js`, `tests/api/live/live-relay.contract.test.mjs`, `tests/api/live/gemini-live-provider.contract.test.mjs`, `tests/bootstrap/health-endpoint-smoke.test.mjs` |
| 3 | `apps/web/src/main.js`, `apps/web/src/qa/panel.js`, `apps/web/src/qa/live-client.js`, `apps/web/src/tts/panel.js`, `tests/api/qa-tts/tts-ui.contract.test.mjs`, `tests/e2e/live-voice-smoke.test.mjs`, `tests/mobile/manual-checklist.md` |

## Dependency graph
- P1 -> P2 -> P3.
- No parallel cook: all phases touch hot request/interaction surfaces and rollback behavior must be proven serially.

## Phases
| # | Theme | Phụ thuộc | Cỡ |
|---|---|---|---|
| 1 | Lock REST grounding contracts | — | small |
| 2 | Add backend Live relay | 1 | medium |
| 3 | Wire browser live voice | 2 | medium |

## Out of scope
- Không chạm approved content corpus, scene/tour schema, hay asset pipeline.
- Không chuyển browser sang direct-to-Google Live; backend vẫn là relay duy nhất.
- Không làm continuous mic streaming, lip-sync, hoặc WebAR redesign.
- Không thay thế `/api/qa` và `/api/tts`; chỉ dùng chúng làm rollback path.

## Acceptance (toàn plan)
- [ ] REST QA/TTS contract tests still pass after Phase 1, with unchanged citation refs and abstain behavior on the current seed corpus.
- [ ] `/api/qa/live` accepts exactly one of typed text or bounded push-to-talk audio and returns 400-shape errors for invalid input.
- [ ] Audio mode proves transcription session closes before grounded answer session starts; answer session receives only transcript + approved chunks.
- [ ] `answer` and `outputTranscript` satisfy canonical normalization; mismatch rejects/regenerates and is covered by fake-upstream tests.
- [ ] Live and REST citations match for the same seeded approved question.
- [ ] Browser can submit text and push-to-talk, render answer text, show input/output transcript, show citations, and play audio without direct provider access.
- [ ] Unset/`0` `GEMINI_LIVE_QA_ENABLED` disables Live by default; `1` exposes capability and permits one Live attempt per turn.
- [ ] Route timeout, upstream timeout, client abort, WebSocket `finally` close, and terminal event handling are covered by fake-upstream hang/abort tests.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, and the targeted `node --test` suites pass at the end of each phase.

## Rollback
- Phase 1: revert `services/api/src/qa/index.js` and the locked tests; REST path stays unchanged.
- Phase 2: unset or set `GEMINI_LIVE_QA_ENABLED=0`; `/api/qa/live` disabled and browser continues through `/api/qa` + `/api/tts`.
- Phase 3: revert browser voice wiring or leave Live disabled; the current panel continues on REST fallback only.
- If any phase regresses citation refs, response shape, transcript parity, or timeout cleanup, stop and revert that phase before advancing.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Retrieval seam drifts from current REST behavior | M | H | snapshot current REST tests; add Live-vs-REST citation parity; keep `answerQuestion` as wrapper over exported seam |
| Raw audio/session history contaminates grounded answer | M | H | isolate transcription and answer sessions; provider tests assert answer payload excludes raw audio/history |
| Invalid or oversized audio hits provider | M | H | exactlyOneOf validation, MIME allowlist, size/duration bounds, and 400-shape tests before provider calls |
| Audio output says something different than answer text | M | H | canonical text invariant, one regeneration or reject, fake-upstream mismatch tests |
| Live session/auth/protocol mismatch | M | H | pin model/endpoint/interface in provider tests; default-closed flag; fake-upstream tests; no API-key leakage |
| WebSocket hang/abort leaks resources | M | H | route/upstream timeouts, abort propagation, terminal event handling, finally close count assertions |
| Browser mic permission/autoplay friction | H | M | push-to-talk first, text input always available, typed recovery when no transcript exists |
| Relay latency becomes user-visible | M | M | keep MVP one-turn; add streaming/resume only after measured need |
