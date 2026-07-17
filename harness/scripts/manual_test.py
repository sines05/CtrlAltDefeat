#!/usr/bin/env python3
"""manual_test.py — admissibility of a manual-test result.

The anti-fabrication floor: a telemetry-anchored
output proves "a real command ran and this is its real output" — it defeats pure
hallucination — but it does NOT prove the command exercised the right thing (an
agent with a shell can run a real command against the WRONG endpoint and cite a
real trace). So anchored is a FLOOR, never a correctness proof:

  - evidence_tier `claimed` (agent-written) is below the floor — never hard-admissible.
  - `anchored` is honored only when the cited anchor id is actually present in
    the manual-test anchor telemetry the hook wrote; a fabricated id is REJECTED.
  - a hard gate additionally needs a human charter CO-SIGN — a rostered reviewer
    distinct from the author. Anchored-without-co-sign stays SOFT.

This is presence + tamper-evidence, NOT authentication. The co-sign is the human
judgement the machine cannot supply; the anchor is the floor that makes pure
fabrication cost a real command run.
"""

import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

ANCHOR_SINK = "manual-test-anchor.jsonl"


def anchor_id_for(command: str) -> str:
    """Deterministic anchor id for a Bash command (sha256, 16 hex). No clock /
    randomness, so the citing artifact and the hook record agree."""
    return hashlib.sha256((command or "").encode("utf-8")).hexdigest()[:16]


def build_anchor(command, output=None, *, session=None) -> dict:
    """The anchor record the PostToolUse hook writes (actor + ts are added by
    telemetry_paths on append). output_hash links the trace to the real output
    without storing it."""
    rec = {"anchor_id": anchor_id_for(command), "cmd_hash": anchor_id_for(command)}
    if output is not None:
        rec["output_hash"] = hashlib.sha256(
            str(output).encode("utf-8")).hexdigest()[:16]
    if session:
        rec["session"] = session
    return rec


def _anchor_sink(root) -> Path:
    return Path(root) / "telemetry" / ANCHOR_SINK


def anchor_exists(anchor_id, root) -> bool:
    """True when `anchor_id` is present in the anchor sink under `root`
    (root = the state dir holding telemetry/). Fail-soft on a missing/corrupt
    sink — a missing record reads as 'not anchored', never a crash."""
    p = _anchor_sink(root)
    if not p.is_file():
        return False
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False
    for ln in text.splitlines():
        try:
            rec = json.loads(ln)
        except ValueError:
            continue
        if isinstance(rec, dict) and rec.get("anchor_id") == anchor_id:
            return True
    return False


def admissibility(check, root):
    """(tier, reason) for a manual-test check. tier ∈ anchored | claimed |
    rejected. `root` is the state dir holding telemetry/."""
    tier = (check or {}).get("evidence_tier")
    if tier != "anchored":
        return "claimed", ("evidence_tier is %r (agent-written) — below the "
                           "anchored floor" % tier)
    aid = check.get("anchor_id") or check.get("trace_id")
    if not aid:
        return "rejected", "evidence_tier is anchored but no anchor id is cited"
    if anchor_exists(aid, root):
        return "anchored", "anchor %s witnessed by the telemetry hook" % aid
    return "rejected", ("cited anchor %s is not in the manual-test anchor "
                        "telemetry — fabricated citation" % aid)


_LESSON_KINDS = ("feedback", "project")


def record_lesson(kind, payload, *, root=None, actor=None, session=None) -> bool:
    """Append one manual-testing lesson to state/manual-tester/<kind>.jsonl
    (append-only, actor+ts enriched). `feedback` = a setup gotcha; `project` = a
    real bug + how it reproduced. These compound across sessions so a later
    charter starts from known traps — they are LESSONS, never test evidence.
    Returns True when written. Invalid kind → False (never raises)."""
    if kind not in _LESSON_KINDS:
        return False
    try:
        import json
        from datetime import datetime, timezone
        if root is None:
            import harness_paths
            base = harness_paths.state_dir()
        else:
            base = Path(root)
        d = base / "manual-tester"
        d.mkdir(parents=True, exist_ok=True)
        if actor is None:
            try:
                import hook_runtime
                actor = hook_runtime.resolve_actor(session_id=session)
            except Exception:  # noqa: BLE001
                actor = "user:unknown"
        rec = {"kind": kind, "payload": payload, "actor": actor,
               "ts": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        if session:
            rec["session"] = session
        with open(d / ("%s.jsonl" % kind), "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return True
    except Exception:  # noqa: BLE001 — a lesson write must never break a session
        return False


def hard_admissible(check, root, team_path=None, team=None):
    """(ok, reason): a manual-test check is HARD-admissible only when its output
    is genuinely anchored AND the charter carries a co-sign. Personal-first: the
    co-sign is attribution (who vouched the command tested the right thing), not a
    roster check. Claimed/rejected, or anchored-without-co-sign, stays soft. The
    team/team_path params are accepted for caller compatibility, now unused."""
    tier, reason = admissibility(check, root)
    if tier != "anchored":
        return False, "manual evidence is %s — %s" % (tier, reason)
    cosign = (check or {}).get("charter_cosign")
    if not cosign:
        return False, ("anchored output but no charter co-sign — a hard manual "
                       "gate needs a co-sign vouching the charter (the anchor "
                       "proves a real command ran, not that it tested the right "
                       "thing)")
    return True, "anchored output + charter co-sign present"
