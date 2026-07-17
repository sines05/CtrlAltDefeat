"""Tests for the docs_validation detector (docs-SSOT twin of decision_capture).

The detector answers ONE deterministic question: did this session edit docs SOURCE
(docs/**/*.md or docs/_index/*.yaml) under an ADOPTED pipeline (showcase.yaml
present) WITHOUT the build output moving?

The judgment is the pure `assess(changes, has_pipeline)` — unit-testable without a
repo. The git/fs reads (`_porcelain_changes`, `has_pipeline`, `collect`) are smoked
once over a real temp tree.
"""

import subprocess
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import docs_validation as dv  # noqa: E402


# --- assess(): pure judgment, no git/fs ---

def test_doc_edit_under_pipeline_fires():
    sig = dv.assess([("M", "docs/architecture/c4.md")], has_pipeline=True)
    assert sig is not None
    assert sig["type"] == dv.SIGNAL_TYPE
    assert sig["subjects"] == ["docs/architecture/c4.md"]
    assert sig["total"] == 1


def test_index_yaml_edit_fires():
    sig = dv.assess([("M", "docs/_index/showcase.yaml")], has_pipeline=True)
    assert sig is not None and sig["subjects"] == ["docs/_index/showcase.yaml"]


def test_no_pipeline_never_fires():
    # generic repo that merely edits docs/ must not trip the nudge
    sig = dv.assess([("M", "docs/readme.md")], has_pipeline=False)
    assert sig is None


def test_build_output_moved_suppresses():
    # public/ also changed → a build (gate-first) ran → clean
    sig = dv.assess([
        ("M", "docs/modules/README.md"),
        ("M", "public/index.html"),
    ], has_pipeline=True)
    assert sig is None


def test_docs_public_generated_is_not_source():
    # only generated output touched → nothing to validate
    sig = dv.assess([("M", "docs/public/pages/modules.html")], has_pipeline=True)
    assert sig is None


def test_non_doc_edit_ignored():
    sig = dv.assess([("M", "src/app.py"), ("A", "harness/hooks/x.py")], has_pipeline=True)
    assert sig is None


def test_deleted_doc_not_a_touch():
    sig = dv.assess([("D", "docs/old.md")], has_pipeline=True)
    assert sig is None


def test_subjects_sorted_deduped_and_capped():
    changes = [("M", "docs/z%d.md" % i) for i in range(12)] + [("M", "docs/a.md"), ("M", "docs/a.md")]
    sig = dv.assess(changes, has_pipeline=True)
    assert sig is not None
    assert sig["subjects"] == sorted(sig["subjects"])
    assert len(sig["subjects"]) == dv._SUBJECT_CAP
    assert sig["total"] == 13  # 12 distinct z + 1 a (a deduped)


# --- fs/git reads: smoked over a real temp tree ---

def test_has_pipeline_detects_manifest(tmp_path):
    assert dv.has_pipeline(tmp_path) is False
    (tmp_path / "docs" / "_index").mkdir(parents=True)
    (tmp_path / "docs" / "_index" / "showcase.yaml").write_text("theme: x\n", encoding="utf-8")
    assert dv.has_pipeline(tmp_path) is True


def test_collect_outside_git_degrades_to_none(tmp_path):
    # no git repo, no manifest → None, never raises
    assert dv.collect(tmp_path) is None


def test_collect_smoke_real_git(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@t"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=tmp_path, check=True)
    (tmp_path / "docs" / "_index").mkdir(parents=True)
    (tmp_path / "docs" / "_index" / "showcase.yaml").write_text("theme: x\n", encoding="utf-8")
    (tmp_path / "docs" / "guide.md").write_text("# hi\n", encoding="utf-8")
    sig = dv.collect(tmp_path)
    assert sig is not None
    assert "docs/guide.md" in sig["subjects"]
