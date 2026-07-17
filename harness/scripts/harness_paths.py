#!/usr/bin/env python3
"""harness_paths.py — single home for root + state-dir resolution.

Two roots, one shared binary serving many projects:

  bin_root()   — where the programs live (hooks, scripts, skills, rules, data
                 templates). Read-only at runtime for every actor. A global
                 install points every project at ONE bin.
  data_root()  — a project's private data home `.harness/`. All per-project
                 state, telemetry, trace, writeable config land here.

`root()` is kept as a back-compat alias for `bin_root()` so the shipped-binary
readers are untouched by the split. Resolution is PURE (no mkdir): writers own
their own mkdir, readers never create what they inspect.

Precedence (exact):
  bin_root():   HARNESS_BIN_ROOT > HARNESS_ROOT (legacy alias) > __file__-relative
                > upward walk(harness/manifest.json | harness/hooks/) > CWD
  data_root():  HARNESS_DATA_ROOT > CLAUDE_PROJECT_DIR/.harness
                > (self-host, ONLY when HARNESS_BIN_ROOT UNSET) bin_root()/.harness
                > FAIL-CLOSED marker (caller-visible) — never a silent CWD
  state_dir():  HARNESS_STATE_DIR > data_root()/state
  bin_state_dir(): bin_root()/harness/state   # install metadata, never project-side

FAIL-CLOSED (red-team F2/F5/F7): under a global layout (HARNESS_BIN_ROOT set) a
data_root() that cannot resolve a project returns the unresolved marker instead
of decaying to CWD — guards MUST treat it as "no project root" and BLOCK. Self-host
is detected by HARNESS_BIN_ROOT being UNSET (a global bin is itself a git checkout,
so a `.git` walk-up would wrongly collapse it). A data root whose parent is the
filesystem root (e.g. HARNESS_DATA_ROOT=/data) is not a real project (F7).
"""

import os
from pathlib import Path
from typing import Optional

# Fail-closed sentinel: a global-layout data_root() that cannot resolve a
# project returns this. Absolute + non-existent so an accidental write under it
# fails loudly rather than silently landing in CWD/home. Callers/guards detect
# it via data_root_unresolved() and BLOCK.
_UNRESOLVED = Path("/__harness_data_root_unresolved__")


def _bin_root_from_file() -> Optional[Path]:
    """The bin root inferred from this file's own location: harness_paths.py
    lives at <bin>/harness/scripts/harness_paths.py. Returns the candidate only
    when it actually carries the harness markers (so a relocated copy falls
    through to the CWD walk-up)."""
    here = Path(__file__).resolve()
    cand = here.parent.parent.parent  # scripts -> harness -> <bin>
    if (cand / "harness" / "manifest.json").is_file() or (cand / "harness" / "hooks").is_dir():
        return cand
    return None


def bin_root() -> Path:
    raw = os.environ.get("HARNESS_BIN_ROOT") or os.environ.get("HARNESS_ROOT")
    if raw:
        return Path(raw).resolve()
    from_file = _bin_root_from_file()
    if from_file is not None:
        return from_file
    cur = Path.cwd().resolve()
    for candidate in (cur, *cur.parents):
        if (candidate / "harness" / "manifest.json").is_file():
            return candidate
        if (candidate / "harness" / "hooks").is_dir():
            return candidate
    return cur


def root() -> Path:
    """Back-compat alias for bin_root() — the shipped-binary readers keep using
    root() and transparently see the bin root."""
    return bin_root()


def _valid_project_dir(data_dir: Path) -> bool:
    """A data root is a real project only when its enclosing project dir is not
    the filesystem root (F7): HARNESS_DATA_ROOT=/data → project "/" is rejected."""
    parent = data_dir.parent
    return parent != Path(parent.anchor)


def data_root() -> Path:
    """The per-project data home `.harness/`. See module docstring for the exact
    precedence and the fail-closed contract."""
    raw = os.environ.get("HARNESS_DATA_ROOT")
    if raw:
        cand = Path(raw).resolve()
        return cand if _valid_project_dir(cand) else _UNRESOLVED
    proj = os.environ.get("CLAUDE_PROJECT_DIR")
    if proj:
        cand = Path(proj).resolve() / ".harness"
        return cand if _valid_project_dir(cand) else _UNRESOLVED
    # Self-host (dogfood): ONLY when HARNESS_BIN_ROOT is UNSET. A global bin is
    # itself a git checkout, so this must NOT key off a `.git` walk-up (F2).
    if not os.environ.get("HARNESS_BIN_ROOT"):
        return bin_root() / ".harness"
    # Global layout with no resolvable project → fail-closed, never CWD.
    return _UNRESOLVED


def data_root_unresolved(p: Path) -> bool:
    """True when `p` is the fail-closed marker — guards must BLOCK on this."""
    return Path(p) == _UNRESOLVED


def project_root() -> Path:
    """The per-project root for gate/scan operations that must target the
    project being worked on — NOT the shared binary. Precedence:
    CLAUDE_PROJECT_DIR (the working project) > the data-home-derived project dir
    (data_root().parent) > bin root (self-host, where bin == project). Always
    concrete — a scan/gate always has a real tree to point at.

    Use root()/bin_root() for BIN-global config; use this only for project-scoped
    file operations (git diff of the project, plans/ receipts, source scans).
    Under self-host these coincide (bin == project), so switching a project-scoped
    caller from root() to project_root() is a no-op there and only diverges — the
    intended fix — under a global install."""
    proj = os.environ.get("CLAUDE_PROJECT_DIR")
    if proj:
        cand = Path(proj)
        if cand.is_dir():
            resolved = cand.resolve()
            # F7 fail-closed: never hand back the filesystem root as a project to
            # WRITE into (inject would stamp "/plans/reports/..."). data_root()
            # rejects this same case; mirror it here and fall through to the next
            # tier instead of returning "/".
            if resolved != Path(resolved.anchor):
                return resolved
    dr = data_root()
    if not data_root_unresolved(dr):
        return dr.parent
    return bin_root()


def state_dir() -> Path:
    raw = os.environ.get("HARNESS_STATE_DIR")
    if raw:
        return Path(raw)
    return data_root() / "state"


def bin_state_dir() -> Path:
    """Bin-side state home for install metadata (install-omitted-skills.json,
    install-state.json) — describes the INSTALL, not a project, so it never
    rides data_root()."""
    return bin_root() / "harness" / "state"


def engine_home() -> Path:
    """The courier's stable engine home: where `harness setup` copies the engine
    out of the plugin cache. `<XDG_DATA_HOME|~/.local/share>/harness`. PURE — no
    mkdir (writers own their own mkdir). This is orthogonal to bin_root()/
    data_root(): it names the shared install location a global-mode bin_root()
    then points at, and does NOT touch self-host detection (a self-host repo
    leaves HARNESS_BIN_ROOT UNSET and never consults this)."""
    base = os.environ.get("XDG_DATA_HOME") or "~/.local/share"
    # A relative XDG_DATA_HOME must NOT anchor the SHARED engine home to CWD (which
    # `.resolve()` on a relative path would do — giving every project its own engine
    # under <cwd>/…). The XDG spec says a relative value is invalid and should be
    # ignored, so fall back to the ~/.local/share default.
    if base != "~/.local/share" and not os.path.isabs(os.path.expanduser(base)):
        base = "~/.local/share"
    p = Path(base).expanduser() / "harness"
    try:
        return p.resolve()
    except (OSError, RuntimeError):
        # a symlink loop / ELOOP on XDG_DATA_HOME must not crash the diagnostic verbs
        # (doctor/version) that call engine_home() before any other guard; fall back to
        # the un-resolved absolute path so downstream .is_file() checks simply report the
        # engine home as absent instead of raising RuntimeError('Symlink loop').
        return p.absolute()


def engine_current() -> Path:
    """The `current` pointer under engine_home() — the default engine a repo's
    HARNESS_BIN_ROOT resolves to when it is not pinned to a version dir."""
    return engine_home() / "current"


def trace_dir() -> Path:
    return state_dir() / "trace"


def telemetry_dir() -> Path:
    return state_dir() / "telemetry"
