# Scout Report — /home/sonnq6/CtrlAltDefeat

## Relevant files

- `/home/sonnq6/CtrlAltDefeat/CLAUDE.md` — harness onboarding instructions; no product requirements or application architecture.
- `/home/sonnq6/CtrlAltDefeat/.claude/settings.json` — Claude Code hook wiring for the vendored harness.
- `/home/sonnq6/CtrlAltDefeat/harness/` — self-contained SDLC harness; no application source tree detected.
- `/home/sonnq6/CtrlAltDefeat/harness/data/` — harness posture/config files.
- `/home/sonnq6/CtrlAltDefeat/harness/plugins/hs/` — HS skills and agents.
- `/home/sonnq6/CtrlAltDefeat/.gitignore` — repository ignore rules; Git metadata is absent.

## Observed patterns

- The target is a fresh harness-enabled project with no `.git` directory.
- No `src/`, `app/`, `frontend/`, `backend/`, `tests/`, `package.json`, `pyproject.toml`, or deployment manifest exists yet.
- No `docs/` directory or product documentation exists yet.
- No application language or framework can be observed; stack decisions remain open.
- The requested product scope is external to the current tree: VAIC 2026 PS142, WebAR/3D fallback, verified-knowledge RAG, voice guide, and a 40-hour MVP for four people including one BA.
- The harness's existing `docs/code-standards.md` and `docs/system-architecture.md` are absent, so they must be created before planning/cook workflows rely on them.

## Open questions

- Which implementation stack will the team commit to (for example TypeScript frontend + Python API, or a single-stack alternative)?
- Which LLM, STT, and TTS providers are permitted and available during the hackathon?
- Is a licensed GLB/3D asset already available, or should the MVP use a 2D/3D-viewer fallback?
- Which expert-approved paper-do content and citations are available for the initial knowledge base?
- What deployment target and API-secret storage are available?
- Does the team want a monorepo layout or separate frontend/backend repositories? Recommend one repository for the 40-hour MVP.

## Bootstrap recommendation

Create documentation first under `docs/` only:

- `docs/code-standards.md`
- `docs/system-architecture.md`
- `docs/product/vision.md`
- `docs/product/prd.md`
- `docs/product/user-stories.md`
- `docs/ux/user-flow.md`
- `docs/engineering/mvp-40h.md`
- `docs/engineering/api-contract.md`
- `docs/engineering/rag-content-schema.md`
- `docs/operations/deployment.md`
- `docs/decisions/0001-mvp-scope.md`

Keep the architecture thin and make the QR/text/3D-viewer fallback the guaranteed path; treat full WebAR object tracking, real-time scan reconstruction, voice input, and lip-sync as conditional stretch scope.
