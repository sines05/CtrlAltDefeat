---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Production guide REST fallback abstention

## Executive Summary

Production is healthy but accepts an upstream Gemini abstention as the final REST answer, while the local no-key path converts the same out-of-corpus turn into a deterministic boundary answer. `GET https://ctrlaltdefeat-6obc.onrender.com/api/health` returned HTTP 200 with `qaLiveVoice.enabled: false`; typed chat therefore uses `/api/qa`, not Gemini Live. A known grounded production question returned `abstained: false`, while `Giấy dó được phát minh vào năm nào?` returned `abstained: true` with the provider's no-evidence reason. Estimated root fix: one small fallback normalization plus a deterministic provider-response test.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Out-of-corpus text yields a dead-end toast | H | M | Convert Gemini abstention to the existing boundary fallback answer. |
| Removing the Gemini secret masks rather than fixes behavior | M | M | Preserve the key; fix response normalization in code. |
| Live voice remains disabled | H | L for typed chat | Set `GEMINI_LIVE_QA_ENABLED=1` only when live WebSocket usage is intentionally enabled and separately tested. |

## Confirmed Root Cause

1. `apps/web/src/main.js:932-934` reads health capability; production reports `qaLiveVoice.enabled: false`, so `apps/web/src/qa/live-client.js:143-148` calls REST `/api/qa` for typed turns.
2. `apps/web/src/qa/live-client.js:62-75` renders `REST fallback abstained.` when that endpoint returns `abstained: true`.
3. `services/api/src/qa/index.js:304-317` accepts `generateGeminiGroundedAnswer()` whenever it returns successfully, including an object with `abstained: true`; it calls the deterministic local fallback only when Gemini throws.
4. The live production probe for `Giấy dó được phát minh vào năm nào?` returned `{ "abstained": true, "abstainReason": "Thông tin về năm phát minh giấy dó không có trong các dữ liệu cung cấp." }`.
5. The local no-key probe for a known grounded question returned the deterministic corpus answer, proving the local fallback path is different from production's successful Gemini response path.

## Rejected Hypotheses

- Render deploy/server failure: rejected; `/api/health` returned HTTP 200 and known, overview, and conversation REST questions all returned `abstained: false`.
- Invalid static scene ID: rejected; deployed UI uses `tay-ho-giay-do-room-01` at `apps/web/src/main.js:17,80-89`, and the same ID succeeds through production `/api/qa`.
- Missing Gemini key: rejected; production answers differ from `generateLocalGroundedAnswer()` and include an upstream-style abstention response, which only reaches the final packet after a successful provider response.

## Failing Repro Test

No local failing test was created: the defect depends on a successful production Gemini response that elects `abstained: true`; a local no-key process intentionally takes the non-abstaining deterministic fallback. The production HTTP probe is the reproducible evidence. A fix should first add a provider-mocked unit test that expects a `boundary` answer when Gemini returns `abstained: true`.

## Recommended Approach

In `services/api/src/qa/index.js`, treat a Gemini abstention for `boundary` (and any other policy whose local fallback is non-abstaining) as a provider fallback condition, then return `generateLocalGroundedAnswer()`. This preserves grounded Gemini answers, preserves the provider key, and removes the dead-end UI outcome without changing deployment configuration.

## Operational Considerations

Keep `GEMINI_LIVE_QA_ENABLED` disabled unless voice mode is intentionally enabled; it is unrelated to typed REST answers. Test one known grounded question and one out-of-corpus question against the Render URL after the patch.

## Decision Needed

Approve the narrow `/hs:fix` patch to normalize Gemini abstentions into the existing boundary response. Do not remove `GEMINI_API_KEYS` merely to force local fallback.
