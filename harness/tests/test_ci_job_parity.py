"""Parity between the CI faces and the ci.sh single source — the anti-drift gate.

The GitHub matrix and the GitLab job set are held to the job names ci.sh declares,
so a job added or renamed in one place but not the other reds here.
ci.sh --list-remote is the source of truth; the workflow YAML is parsed and compared.
"""
import subprocess
from pathlib import Path

import pytest

# Dev-repo-only: asserts CI-face parity against scripts/ci.sh + .github/workflows,
# present in the development checkout but not in an installed bundle.
pytestmark = pytest.mark.dev_repo

yaml = pytest.importorskip("yaml")

_REPO = Path(__file__).resolve().parents[2]
_CI_SH = _REPO / "scripts" / "ci.sh"
_GH_CI = _REPO / ".github" / "workflows" / "ci.yml"
_GL_CI = _REPO / ".gitlab-ci.yml"

# GitLab top-level keys that configure the pipeline rather than name a job.
_GL_RESERVED = {"stages", "default", "variables", "workflow", "include", "image"}


def _ci_sh(*args):
    res = subprocess.run(
        ["bash", str(_CI_SH), *args],
        capture_output=True,
        text=True,
        cwd=str(_REPO),
    )
    assert res.returncode == 0, res.stderr
    return {ln.strip() for ln in res.stdout.splitlines() if ln.strip()}


def _gh_doc():
    return yaml.safe_load(_GH_CI.read_text(encoding="utf-8"))


def _matrix_jobs(doc):
    return set(doc["jobs"]["test"]["strategy"]["matrix"]["job"])


def test_github_matrix_equals_ci_sh_remote():
    remote = _ci_sh("--list-remote")
    assert _matrix_jobs(_gh_doc()) == remote


def test_github_matrix_step_dispatches_to_ci_sh():
    doc = _gh_doc()
    steps = doc["jobs"]["test"]["steps"]
    run_blob = "\n".join(str(s.get("run", "")) for s in steps)
    assert "bash scripts/ci.sh" in run_blob
    assert "${{ matrix.job }}" in run_blob


def test_github_installs_coverage_and_xdist():
    # The orchestrator job runs the drive-test coverage leg on the runner, so the
    # coverage CLI must be installed — dropping it surfaces as `coverage-unmeasurable`.
    # xdist parallelises the suites. Both belong in the install.
    text = _GH_CI.read_text(encoding="utf-8")
    installs = [ln for ln in text.splitlines() if "pip install" in ln]
    assert installs, "expected at least one pip install line"
    joined = " ".join(installs)
    assert "coverage" in joined, f"coverage missing from CI installs: {installs}"
    assert "pytest-xdist" in text


def test_ci_installs_orchestrator_tier_deps():
    # The orchestrator + scoring-contract jobs collect orchestrator/tests, several of
    # which hard-import loguru (the oplog lane's real backend). loguru is a declared
    # tầng-2 dep (orchestrator/requirements.txt) — CI must install that requirements
    # file for those jobs or collection ImportErrors. Guards the two-tier separation:
    # the tầng-2 deps come from the tầng-2 registry, not hand-copied into the tầng-1 line.
    reqs = (_REPO / "orchestrator" / "requirements.txt")
    assert reqs.is_file(), "orchestrator/requirements.txt (tầng-2 dep registry) missing"
    assert "loguru" in reqs.read_text(encoding="utf-8"), \
        "orchestrator/requirements.txt no longer declares loguru — revisit this guard"
    gh = _GH_CI.read_text(encoding="utf-8")
    assert "orchestrator/requirements.txt" in gh, \
        "GitHub CI must `pip install -r orchestrator/requirements.txt` for the orchestrator-tier jobs"
    gl = _GL_CI.read_text(encoding="utf-8")
    assert "orchestrator/requirements.txt" in gl, \
        "GitLab template must install the tầng-2 requirements too (parity)"


def test_github_concurrency_and_trigger_hardening():
    doc = _gh_doc()
    assert doc["concurrency"]["cancel-in-progress"] is True
    on = doc.get(True) or doc.get("on")  # YAML parses bare `on:` as boolean True
    assert on["push"]["branches"] == ["main"]
    assert "pull_request" in on


def test_github_matrix_fail_fast_disabled():
    # 7 independent jobs became one matrix; fail-fast:false keeps a red cell from
    # cancelling the others, so a run still surfaces ALL failures at once.
    doc = _gh_doc()
    assert doc["jobs"]["test"]["strategy"]["fail-fast"] is False


def test_github_single_matrix_job():
    doc = _gh_doc()
    assert list(doc["jobs"].keys()) == ["test"]


# --- GitLab portability template ----------------------------------------------

def _gitlab_jobs():
    doc = yaml.safe_load(_GL_CI.read_text(encoding="utf-8"))
    return {k: v for k, v in doc.items()
            if k not in _GL_RESERVED and isinstance(v, dict)}


def test_gitlab_jobs_are_subset_of_ci_sh():
    allnames = _ci_sh("--list-all")
    assert set(_gitlab_jobs()) <= allnames


def test_gitlab_carries_no_stale_ownership_ref():
    # Assemble the token from parts so this test's own source doesn't trip the
    # personal-first absence guard (test_tier_c_absence git-greps for the literal).
    stale_ref = "work-" + "ownership"
    assert stale_ref not in _GL_CI.read_text(encoding="utf-8")


def test_gitlab_demoted_no_ssot_or_mirror_language():
    text = _GL_CI.read_text(encoding="utf-8").lower()
    assert "ssot" not in text
    assert "mirror" not in text


def test_gitlab_jobs_dispatch_to_ci_sh():
    for name, job in _gitlab_jobs().items():
        script = job.get("script") or []
        blob = "\n".join(script) if isinstance(script, list) else str(script)
        assert "ci.sh" in blob, f"gitlab job {name} must dispatch to ci.sh"
