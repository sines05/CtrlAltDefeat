---
phase: 3
title: "Wire Browser Live Voice"
status: pending
plan: 260718-1059-gemini-live-voice
created: 2026-07-18
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Phase 3 — Wire Browser Live Voice

## Overview
Wire the browser to the default-closed Live capability, preserve text-first recovery, and add push-to-talk without direct provider access. This phase does not change backend grounding; it consumes the Phase 2 route and keeps `/api/qa` + `/api/tts` fallback visible.

## Files
- **Create** `apps/web/src/qa/live-client.js`
- **Create** `tests/e2e/live-voice-smoke.test.mjs`
- **Modify** `apps/web/src/main.js`
- **Modify** `apps/web/src/qa/panel.js`
- **Modify** `apps/web/src/tts/panel.js`
- **Modify** `tests/api/qa-tts/tts-ui.contract.test.mjs`
- **Modify** `tests/mobile/manual-checklist.md`

## TDD
### Tests Before
- [ ] `node --test tests/api/qa-tts/tts-ui.contract.test.mjs` locks the current panel render, transcript fallback, and audio controls before browser voice wiring changes.
- [ ] Add a failing transport test for `apps/web/src/qa/live-client.js` proving exactlyOneOf request assembly and no Live call when capability is disabled.
- [ ] Add a failing smoke test proving one failed Live attempt falls back without a repeated failed Live call in the same turn.

### Implement
1. Move Live request assembly into `apps/web/src/qa/live-client.js`; keep it thin: capability check, exactlyOneOf payload, one Live attempt, fallback decision.
2. Update `apps/web/src/main.js` to read `/api/health` capability once during bootstrap.
3. Text path: if Live enabled, try `/api/qa/live`; on failure use `/api/qa` then `/api/tts` with the typed text.
4. Audio path: record push-to-talk with user gesture, send bounded `{ mimeType, dataBase64, durationMs }`; if mic denied or no transcript is returned, show typed recovery and no citations.
5. Audio fallback after transcript: if Live returns `inputTranscript` but answer/audio fails, call `/api/qa` + `/api/tts` with that transcript.
6. Extend `apps/web/src/qa/panel.js` so answer text, input transcript, output transcript, citations, recovery status, and audio state are visible.
7. Keep `apps/web/src/tts/panel.js` as degraded audio fallback, not a second primary voice stack.
8. Update the manual mobile checklist for mic denied, typed fallback, audio transcript fallback, Live disabled, and transcript/audio mismatch recovery.

### Tests After
- [ ] `node --test tests/api/qa-tts/tts-ui.contract.test.mjs tests/e2e/live-voice-smoke.test.mjs` passes with text mode, push-to-talk, capability gating, and fallback rendering intact.
- [ ] Browser transport test proves disabled capability prevents Live call, typed failure falls back to REST QA+TTS, audio-before-transcript shows typed recovery/no fake citations, and audio-after-transcript falls back using transcript.

### Regression Gate
`npm run lint && npm run typecheck && npm run build && node --test tests/api/qa-tts/tts-ui.contract.test.mjs tests/e2e/live-voice-smoke.test.mjs tests/bootstrap/*.test.mjs`

## Success
- [ ] Browser never calls Live when `/api/health` reports disabled capability.
- [ ] Browser makes at most one Live attempt per turn before falling back.
- [ ] Text input reaches Live when enabled and renders answer text, citations, transcripts, and audio state.
- [ ] Push-to-talk sends one bounded audio turn when mic permission is granted.
- [ ] Mic denial or pre-transcript audio failure shows typed recovery with no fake citations.
- [ ] Post-transcript Live failure uses the transcript for REST QA+TTS fallback.

## Risks
- Likelihood: H. Impact: M. Browser mic permissions, autoplay, and mobile capture can make the first voice-input cut brittle.
- Mitigation: push-to-talk first, text input always available, capability-gated Live attempt, and typed recovery when no transcript exists.
