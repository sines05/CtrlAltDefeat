#!/usr/bin/env python3
"""scope_hint.py — Lever A: a coarse, suggest-only difficulty classifier.

Reads a raw user prompt and returns a difficulty band + whether a heavy SDLC
skill was invoked. The context-injection hook uses the verdict ONLY to append a
one-line advisory when a trivial task rides a heavy skill (e.g. `/hs:plan fix
typo`). It never selects a mode, never downgrades, never blocks — advisory input.

Design bias: over-flag toward `risky`. The keyword match is deliberately by STEM
(substring), not word-boundary, so `migrations`/`authentication`/`schemas` all
trip — the safe direction, since a false `risky` merely WITHHOLDS the lighter-mode
suggestion (a false `trivial` would be the harmful one). Pure + stdlib-only; must
not import hook code (the hook imports it, not the reverse).
"""
import re

# Risky-topic stems (substring match on the lowercased prompt). Touching any of
# these is treated as high-stakes regardless of how few files are named — the
# suggestion engine must never nudge these toward a lighter path. Stems are
# truncated roots (e.g. `delet`, `truncat`, `migrat`) so plurals and variants
# (deletion, truncating, migrations) all trip. Includes destructive data/ops
# verbs, not just topics: a `drop the users table` under a heavy skill must never
# read as trivial.
_RISKY_STEMS = ("schema", "auth", "migrat", "pricing", "secret", "delet",
                "force", "rbac", "credential", "payment", "token",
                "drop", "truncat", "revoke", "grant", "deploy", "prod",
                "rollback", "wipe", "purge", "password", "permission",
                "apikey", "api key", "access key")

# Heavy SDLC skills where a trivial scope is worth a "consider a lighter mode"
# nudge. Matched as `hs:<name>` with an optional leading slash.
_HEAVY_SKILLS = ("plan", "cook", "ship", "discover", "understand", "review-pr",
                 "vibe", "team", "afk")
_HEAVY_RE = re.compile(r"/?hs:(" + "|".join(_HEAVY_SKILLS) + r")\b", re.IGNORECASE)

# A path-ish token: a slash-separated token, or a `name.ext` shape whose ext
# STARTS WITH A LETTER (so version numbers like 3.12 don't count as files). The
# slash branch is bounded ([^\s/]+) to avoid a greedy backtracking tail on a long
# slash-free prompt.
_PATHISH_RE = re.compile(r"[^\s/]+/[^\s/]+|\b[\w.-]+\.[A-Za-z]\w{0,4}\b")
# An explicit "N files/modules" count.
_NFILES_RE = re.compile(r"\b(\d+)\s+(?:files?|modules?|tests?)\b", re.IGNORECASE)

_TRIVIAL_FILE_CEILING = 3


def _file_mentions(text: str) -> int:
    """Best-effort count of distinct files the prompt implicates: the larger of
    the path-ish token count and any explicit 'N files' number. Scans a bounded
    prefix — the prompt is user-controlled and the count is a coarse band, so a
    length cap keeps the regex off a pathological tail."""
    text = text[:8000]
    pathish = {m.group(0) for m in _PATHISH_RE.finditer(text)}
    n_explicit = max((int(m.group(1)) for m in _NFILES_RE.finditer(text)), default=0)
    return max(len(pathish), n_explicit)


def classify(prompt_text) -> dict:
    """Return {level: trivial|standard|risky, reason, heavy_skill}. Never raises
    on odd input — a non-string or empty prompt is trivial with no heavy skill."""
    text = prompt_text if isinstance(prompt_text, str) else ""
    low = text.lower()
    heavy = bool(_HEAVY_RE.search(text))

    hit = next((s for s in _RISKY_STEMS if s in low), None)
    if hit:
        return {"level": "risky", "reason": "risky-topic stem %r" % hit,
                "heavy_skill": heavy}

    files = _file_mentions(text)
    if files <= _TRIVIAL_FILE_CEILING:
        reason = "no file mention" if files == 0 else "%d file(s), no risky stem" % files
        return {"level": "trivial", "reason": reason, "heavy_skill": heavy}

    return {"level": "standard", "reason": "%d files, no risky stem" % files,
            "heavy_skill": heavy}


if __name__ == "__main__":  # tiny manual probe
    import json
    import sys
    print(json.dumps(classify(" ".join(sys.argv[1:])), ensure_ascii=False))
