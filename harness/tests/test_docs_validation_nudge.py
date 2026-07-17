"""Tests for the docs_validation_nudge hook (docs-SSOT twin of decision_capture_nudge).

A thin NUDGE-class wrapper around the `docs_validation` detector. NEVER blocks:
when docs source was edited under an adopted pipeline without a re-build it surfaces
a one-line advisory (pointing at /hs:docs-standardize) and records one observation,
then allows. Properties under test mirror the decision-capture nudge:

  - nudge posture: default OFF (config-gated); even ON it only warns + records.
  - no-op guard: PostToolUse write sets an ephemeral touched-flag; Stop runs the
    detector ONLY when set.
  - crying-wolf guard: a repo WITHOUT the pipeline marker never fires.
  - visible degradation: a broken detector chain emits docs_validation_degraded.
"""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

_HOOKS = Path(__file__).resolve().parent.parent / "hooks"
if str(_HOOKS) not in sys.path:
    sys.path.insert(0, str(_HOOKS))

import hook_runtime  # noqa: E402,F401
from conftest import _git  # noqa: E402

HOOK_PATH = _HOOKS / "docs_validation_nudge.py"


def _hook_runtime():
    import hook_runtime as hr  # noqa: E402
    return sys.modules.get("hook_runtime", hr)


def _load_hook():
    spec = importlib.util.spec_from_file_location("docs_validation_nudge", HOOK_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _write_config(path: Path, enabled: bool = True):
    path.write_text(
        "hooks:\n"
        "  docs_validation_nudge:\n"
        "    enabled: %s\n" % ("true" if enabled else "false"),
        encoding="utf-8",
    )


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch):
    state = tmp_path / "state"
    tdir = tmp_path / "tmp"
    logs = tmp_path / "logs"
    for d in (state, tdir, logs):
        d.mkdir(parents=True, exist_ok=True)
    cfg = tmp_path / "harness-hooks.yaml"
    _write_config(cfg, enabled=True)
    monkeypatch.setenv("HARNESS_STATE_DIR", str(state))
    monkeypatch.setenv("TMPDIR", str(tdir))
    monkeypatch.setenv("HARNESS_HOOK_LOG_DIR", str(logs))
    monkeypatch.setenv("HARNESS_HOOK_CONFIG", str(cfg))
    monkeypatch.setenv("HARNESS_USER", "tester")
    _hook_runtime()._reset_config_cache()
    yield {"state": state, "tmp": tdir, "cfg": cfg}
    _hook_runtime()._reset_config_cache()


def _reconfig(cfg: Path, enabled: bool):
    _write_config(cfg, enabled=enabled)
    _hook_runtime()._reset_config_cache()


def _repo(tmp_path, with_pipeline: bool, with_doc_edit: bool):
    """Committed git repo. `with_pipeline` drops docs/_index/showcase.yaml (adopted);
    `with_doc_edit` leaves an untracked docs/*.md so the detector fires."""
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "t@t.t")
    _git(repo, "config", "user.name", "t")
    (repo / "README.md").write_text("base\n", encoding="utf-8")
    if with_pipeline:
        idx = repo / "docs" / "_index"
        idx.mkdir(parents=True)
        (idx / "showcase.yaml").write_text("theme: x\n", encoding="utf-8")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "base")
    if with_doc_edit:
        (repo / "docs").mkdir(exist_ok=True)
        (repo / "docs" / "guide.md").write_text("# new\n", encoding="utf-8")
    return repo


def _stop_payload(proj: Path, session_id="sess-1"):
    return {"session_id": session_id, "cwd": str(proj), "hook_event_name": "Stop"}


def _post_payload(proj: Path, file_path: str, session_id="sess-1"):
    return {"session_id": session_id, "cwd": str(proj),
            "hook_event_name": "PostToolUse", "tool_name": "Write",
            "tool_input": {"file_path": file_path}}


def _trace_events(state: Path):
    tdir = state / "trace"
    out = []
    if tdir.is_dir():
        for f in sorted(tdir.glob("trace-*.jsonl")):
            for line in f.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    out.append(json.loads(line))
    return out


def _events_of(state: Path, name: str):
    return [e for e in _trace_events(state) if e.get("event") == name]


# --- no-op guard ---

def test_noop_when_flag_unset(_env, tmp_path):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=True)
    rc = mod.handle_stop(_stop_payload(proj), str(proj))
    assert rc == 0
    assert _events_of(_env["state"], "docs_validation_observation") == []


def test_post_tool_use_sets_flag(_env, tmp_path):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=False)
    rc = mod.handle_post_tool_use(
        _post_payload(proj, str(proj / "docs" / "x.md"), session_id="sx"), str(proj))
    assert rc == 0
    assert mod.touched_flag_set("sx")


# --- nudge: surface advisory + record, never block ---

def test_doc_edit_surfaced_and_recorded(_env, tmp_path, capsys):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=True)
    mod.set_touched_flag("sess-1")
    rc = mod.handle_stop(_stop_payload(proj), str(proj))
    assert rc == 0  # nudge NEVER blocks
    err = capsys.readouterr().err
    assert "guide.md" in err
    assert "/hs:docs-standardize" in err
    assert _events_of(_env["state"], "docs_validation_observation")


def test_no_pipeline_records_nothing(_env, tmp_path, capsys):
    # crying-wolf guard: doc edited but repo never adopted the pipeline
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=False, with_doc_edit=True)
    mod.set_touched_flag("sess-1")
    rc = mod.handle_stop(_stop_payload(proj), str(proj))
    assert rc == 0
    assert capsys.readouterr().err.strip() == ""
    assert _events_of(_env["state"], "docs_validation_observation") == []


def test_clean_tree_records_nothing(_env, tmp_path, capsys):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=False)
    mod.set_touched_flag("sess-1")
    rc = mod.handle_stop(_stop_payload(proj), str(proj))
    assert rc == 0
    assert capsys.readouterr().err.strip() == ""
    assert _events_of(_env["state"], "docs_validation_observation") == []


# --- visible degradation ---

def test_degraded_trace_when_detector_missing(_env, tmp_path, monkeypatch):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=True)
    mod.set_touched_flag("sess-1")

    def _boom():
        raise ImportError("docs_validation hidden for the test")
    monkeypatch.setattr(mod, "_import_detector", _boom)

    rc = mod.handle_stop(_stop_payload(proj), str(proj))
    assert rc == 0
    assert _events_of(_env["state"], "docs_validation_degraded")
    assert _events_of(_env["state"], "docs_validation_observation") == []


# --- nudge default OFF ---

def test_disabled_hook_is_inert(_env, tmp_path, capsys):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=True)
    mod.set_touched_flag("sess-1")
    _reconfig(_env["cfg"], enabled=False)
    rc = mod.handle_stop(_stop_payload(proj), str(proj))
    assert rc == 0
    assert capsys.readouterr().err.strip() == ""
    assert _events_of(_env["state"], "docs_validation_observation") == []


def test_hook_writes_nothing_into_the_project(_env, tmp_path):
    mod = _load_hook()
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=True)
    mod.set_touched_flag("sess-1")
    before = {p.relative_to(proj) for p in proj.rglob("*")}
    mod.handle_stop(_stop_payload(proj), str(proj))
    after = {p.relative_to(proj) for p in proj.rglob("*")}
    assert before == after


# --- CLI shape ---

def _run(mode, payload, env):
    args = [sys.executable, str(HOOK_PATH)]
    if mode == "post":
        args.append("--post-tool-use")
    return subprocess.run(args, input=json.dumps(payload),
                          capture_output=True, text=True, env=env)


def test_cli_post_then_stop_records_observation(_env, tmp_path):
    proj = _repo(tmp_path, with_pipeline=True, with_doc_edit=True)
    env = dict(os.environ)
    env["CLAUDE_PROJECT_DIR"] = str(proj)
    rc_post = _run("post", _post_payload(proj, str(proj / "docs" / "guide.md")), env)
    assert rc_post.returncode == 0, rc_post.stderr
    rc_stop = _run("stop", _stop_payload(proj), env)
    assert rc_stop.returncode == 0, rc_stop.stderr
    assert _events_of(_env["state"], "docs_validation_observation"), rc_stop.stderr
