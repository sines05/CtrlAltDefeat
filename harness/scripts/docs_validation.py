#!/usr/bin/env python3
"""
docs_validation — deterministic "docs edited but not re-validated/built" detector.

SCRIPT-only, pure judgment. The A-leg twin of decision_capture, scoped to the
docs-SSOT pipeline (hs:docs-standardize → hs:docs-build). Given the working-tree
change set, it flags when a session edited docs SOURCE (docs/**/*.md or
docs/_index/*.yaml) WITHOUT the build output moving — i.e. structure may have
drifted from the rendered showcase / releases and the gate was not re-run.

Crying-wolf guard: signals ONLY when the repo has ACTUALLY ADOPTED the pipeline
(a docs/_index/showcase.yaml manifest exists). A generic repo that merely edits
docs/ never trips it. Suppressed when the build output (public/ or docs/public/)
also moved in the same change set — that means a build (which validates first)
already ran.

Signal (or None):
    {"type": "docs_unvalidated", "subjects": [<doc paths>], "total": <int>}

Deterministic: same (changes, has_pipeline) → same signal. Git/fs reads isolated
in collect(); the judgment is the pure assess(), unit-tested without a repo.
ALWAYS degrades to None (never raises) outside a git work tree.

CLI:
    docs_validation.py --root <project-dir>     # emit {signal: {...}|null}, exit 0
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

SIGNAL_TYPE = "docs_unvalidated"

# Manifest whose presence means "this repo adopted the docs-SSOT pipeline".
_PIPELINE_MARKER = ("docs", "_index", "showcase.yaml")

# Porcelain status codes that mean "this file was touched" (new or modified).
_TOUCH_STATUSES = frozenset({"A", "M", "R", "C", "??"})

# Build-output prefixes — their presence means a build (gate-first) already ran.
_BUILT_PREFIXES = ("public/", "docs/public/", "dist/")

_SUBJECT_CAP = 8


# ----------------------------------------------------------------------------
# Pure judgment
# ----------------------------------------------------------------------------

def _is_doc_source(posix: str) -> bool:
    """True when `posix` is docs SOURCE content (not generated output)."""
    if not posix.startswith("docs/") or posix.startswith("docs/public/"):
        return False
    if posix.endswith(".md"):
        return True
    # manifest / index data is structure too
    return posix.startswith("docs/_index/") and posix.endswith((".yaml", ".yml"))


def _is_built(posix: str) -> bool:
    return posix.startswith(_BUILT_PREFIXES)


def assess(changes: Iterable[Tuple[str, str]], has_pipeline: bool) -> Optional[Dict[str, Any]]:
    """Judge a change set. `changes` is (status, path) pairs (porcelain codes).
    Returns the signal when docs source was edited under an adopted pipeline and no
    build output moved, else None. Pure + deterministic (subjects sorted+de-duped)."""
    if not has_pipeline:
        return None
    subjects: List[str] = []
    built = False
    for status, raw in changes:
        posix = (raw or "").replace("\\", "/").strip()
        if not posix or status not in _TOUCH_STATUSES:
            continue
        if _is_built(posix):
            built = True
        if _is_doc_source(posix):
            subjects.append(posix)
    if not subjects or built:
        return None
    uniq = sorted(set(subjects))
    return {"type": SIGNAL_TYPE, "subjects": uniq[:_SUBJECT_CAP], "total": len(uniq)}


# ----------------------------------------------------------------------------
# Git / fs read (isolated, degrades to safe defaults — never raises)
# ----------------------------------------------------------------------------

def has_pipeline(root: Path) -> bool:
    """True when the repo adopted the docs-SSOT pipeline (manifest present)."""
    try:
        return (root.joinpath(*_PIPELINE_MARKER)).is_file()
    except OSError:
        return False


def _status_code(xy: str) -> str:
    s = xy.strip()
    if "?" in s:
        return "??"
    for c in ("A", "M", "D", "R", "C"):
        if c in s:
            return c
    return s[:1] or " "


def _porcelain_changes(root: Path) -> List[Tuple[str, str]]:
    """(status, repo-relative POSIX path) per `git status --porcelain -z -uall`.
    Degrades to [] (never raises) outside a git work tree."""
    try:
        proc = subprocess.run(
            ["git", "status", "--porcelain", "-z", "-uall"],
            cwd=str(root), capture_output=True, text=True, timeout=30,
        )
    except (OSError, FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if proc.returncode != 0:
        return []
    out: List[Tuple[str, str]] = []
    fields = proc.stdout.split("\x00")
    i = 0
    while i < len(fields):
        rec = fields[i]
        if not rec:
            i += 1
            continue
        xy, path = rec[:2], rec[3:]
        code = _status_code(xy)
        out.append((code, path))
        if xy and xy[0] in ("R", "C"):
            i += 1
            if i < len(fields) and fields[i]:
                out.append((code, fields[i]))
        i += 1
    return out


def collect(root) -> Optional[Dict[str, Any]]:
    """Assess the working tree at `root`. Returns the signal dict or None."""
    rp = Path(root)
    return assess(_porcelain_changes(rp), has_pipeline(rp))


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    args = ap.parse_args(argv)
    try:
        signal = collect(Path(args.root).resolve())
    except Exception:  # noqa: BLE001 — advisory contract: never crash
        signal = None
    print(json.dumps({"signal": signal}, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
