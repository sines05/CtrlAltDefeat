#!/usr/bin/env python3
"""docs_validation_nudge — opt-in docs-revalidation nudge (nudge-class).

The docs-SSOT twin of decision_capture_nudge. A thin, deterministic wrapper around
the `docs_validation` detector: it owns NO detection logic. On turn-end it asks the
detector "did this session edit docs SOURCE (docs/**/*.md or docs/_index/*.yaml)
under an ADOPTED docs-SSOT pipeline without the build output moving?". If so it
surfaces a ONE-line advisory pointing at /hs:docs-standardize → /hs:docs-build and
records one observation in the audit trace — then ALWAYS allows. Never blocks,
never writes anything.

Crying-wolf guard lives in the detector (signals only when docs/_index/showcase.yaml
exists), so a repo that has not adopted the pipeline never trips it.

Class is `nudge` (default OFF): asleep until enabled in harness-hooks.yaml.

Two events, one file:
  - default          → `Stop`. Runs the detector behind the touched-flag no-op
    guard, surfaces a signal, records an observation.
  - `--post-tool-use`→ `PostToolUse`. Sets an EPHEMERAL, session-keyed touched-flag
    in $TMPDIR (never committed).

Visible-degradation: if the detector cannot be imported, emits a
`docs_validation_degraded` audit event first, then allows.
"""

import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import hook_runtime  # noqa: E402
import trace_log     # noqa: E402

HOOK_CLASS = "nudge"
NAME = "docs_validation_nudge"
ALLOW_EXIT = 0


def _import_detector():
    """Insert the sibling scripts dir and import the detector. Raises ImportError
    when the chain is incomplete (exercised by the degraded-path test)."""
    sd = str(Path(__file__).resolve().parent.parent / "scripts")
    if sd not in sys.path:
        sys.path.insert(0, sd)
    import docs_validation  # noqa: E402 — resolved only after the path insert
    return docs_validation


def _project_dir(stdin_cwd: Optional[str] = None) -> Optional[str]:
    return hook_runtime.project_dir(stdin_cwd)


def _enabled() -> bool:
    try:
        return hook_runtime.hook_enabled(NAME, HOOK_CLASS)
    except Exception:  # noqa: BLE001
        return False


# --- ephemeral, session-keyed touched-flag ($TMPDIR — not committed) ---

def _temp_dir() -> Path:
    return Path(os.environ.get("TMPDIR") or tempfile.gettempdir())


def safe_id(session_id: str) -> str:
    return hook_runtime.safe_session_id(session_id)


def _flag_path(session_id: str) -> Path:
    return _temp_dir() / ("harness-docsval-touched-%s" % safe_id(session_id))


def set_touched_flag(session_id: str) -> Path:
    path = _flag_path(session_id)
    try:
        path.write_text("1", encoding="utf-8")
    except OSError:
        pass
    return path


def touched_flag_set(session_id: str) -> bool:
    return _flag_path(session_id).exists()


# --- advisory text + observation note ---

def _advisory_text(signal: Dict[str, Any]) -> str:
    subjects = signal.get("subjects") or []
    total = signal.get("total", len(subjects))
    shown = ", ".join(subjects)
    if total > len(subjects):
        shown += " (+%d more)" % (total - len(subjects))
    return ("docs-validation: %d docs source file(s) edited without re-running the "
            "pipeline: %s. Run /hs:docs-standardize to re-check structure, then "
            "/hs:docs-build to re-render. Advisory only." % (total, shown))


def _observation_note(signal: Dict[str, Any]) -> str:
    subjects = signal.get("subjects") or []
    total = signal.get("total", len(subjects))
    return "docs_unvalidated×%d — %s" % (total, ", ".join(subjects))


def _trace_degraded(actor: str, session_id: str, exc: Exception) -> None:
    try:
        trace_log.append_event(hook=NAME, event="docs_validation_degraded",
                               actor=actor, session=session_id,
                               status="degraded", note=str(exc)[:200])
    except Exception:  # noqa: BLE001
        pass


def _record_observation(actor: str, session_id: str, signal: Dict[str, Any]) -> None:
    try:
        trace_log.append_event(hook=NAME, event="docs_validation_observation",
                               actor=actor, session=session_id,
                               status="observed", note=_observation_note(signal))
    except Exception:  # noqa: BLE001
        pass


# --- handlers ---

def handle_stop(payload: Dict[str, Any], project_dir: Optional[str] = None) -> int:
    if not _enabled():
        return ALLOW_EXIT
    project_dir = project_dir or _project_dir(payload.get("cwd"))
    if not project_dir:
        return ALLOW_EXIT

    session_id = payload.get("session_id") or ""
    if not touched_flag_set(session_id):
        return ALLOW_EXIT

    actor = hook_runtime.resolve_actor(session_id)

    try:
        detector = _import_detector()
    except ImportError as exc:
        _trace_degraded(actor, session_id, exc)
        return ALLOW_EXIT

    try:
        signal = detector.collect(project_dir)
    except Exception as e:  # noqa: BLE001 — advisory: never break turn-end
        hook_runtime.log_hook_error(NAME, e)
        return ALLOW_EXIT

    if signal:
        hook_runtime.route_relay_nudge(
            NAME, _advisory_text(signal),
            lambda: _record_observation(actor, session_id, signal))
    return ALLOW_EXIT


def handle_post_tool_use(payload: Dict[str, Any],
                         project_dir: Optional[str] = None) -> int:
    if not _enabled():
        return ALLOW_EXIT
    tool_input = payload.get("tool_input")
    file_path = tool_input.get("file_path") if isinstance(tool_input, dict) else None
    if isinstance(file_path, str) and file_path:
        set_touched_flag(payload.get("session_id") or "")
    return ALLOW_EXIT


def main(argv: Optional[List[str]] = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    post_mode = "--post-tool-use" in argv
    payload = hook_runtime.read_stdin_json()
    project_dir = _project_dir(payload.get("cwd"))
    try:
        rc = (handle_post_tool_use if post_mode else handle_stop)(payload, project_dir)
    except Exception as e:  # noqa: BLE001
        try:
            hook_runtime.log_hook_error(NAME, e)
        except Exception:
            pass
        rc = ALLOW_EXIT
    hook_runtime.drain_or_continue()
    return rc


if __name__ == "__main__":
    sys.exit(main())
