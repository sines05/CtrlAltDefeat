# Phase 6 mobile smoke checklist

Status: NOT RUN in this session.

Missing device evidence:
- No real Android Chrome device was driven in-session.
- No real iOS Safari device was driven in-session.

Required manual path:
1. Open landing page.
2. Confirm scene shell loads.
3. Force fallback with `?fallback=1`.
4. Ask a known QA question and confirm citation appears.
5. Enable Live capability and ask a typed question; confirm one Live attempt, answer text, citations, input/output transcript, and audio playback all render.
6. Deny mic permission; confirm typed recovery state appears and no fake citations are shown.
7. Allow mic permission, tap `Record voice`, stop the turn, and confirm push-to-talk sends one bounded audio request.
8. Simulate Live answer failure after transcript and confirm REST fallback reuses the transcript.
9. Trigger TTS and confirm transcript stays visible if audio fails.
10. Verify the first scene load does not request every MP4 or FBX binary.
11. Activate one process station; confirm its approved manifest title/narration renders and only its MP4 loads or a visible degraded fallback appears.
12. Walk to one model activation area; confirm its FBX loads lazily or fallback geometry remains usable without breaking the 5-step tour.
13. Confirm the tour still exposes exactly 5 approved steps after the media manifest request.
14. Record browser + device name.

This file is evidence of the missing mobile run, not a claim that mobile passed.
