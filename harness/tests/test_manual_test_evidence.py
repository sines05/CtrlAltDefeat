"""test_manual_test_evidence.py — manual-test admissibility (anchored vs claimed).

The anti-fabrication floor: a telemetry-anchored output proves
"a real command ran and this is its real output" — it kills pure hallucination —
but it does NOT prove the command tested the right thing. So:
  - evidence_tier `claimed` (agent-written) is BELOW the floor → never hard-admissible.
  - `anchored` requires the cited anchor id to actually exist in the anchor
    telemetry; a fabricated id that is not in the sink is REJECTED.
  - even a real anchored output is hard-admissible ONLY with a valid human
    charter co-sign (a rostered reviewer, distinct from the author). Anchored
    without a co-sign stays SOFT. No "forgery-proof" overclaim.
"""
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import manual_test as mt  # noqa: E402


def _seed_anchor(tmp_path, command):
    """Write one real anchor record to the sink the gate cross-checks."""
    sink = tmp_path / "telemetry" / "manual-test-anchor.jsonl"
    sink.parent.mkdir(parents=True, exist_ok=True)
    aid = mt.anchor_id_for(command)
    import json
    from datetime import datetime, timezone
    sink.write_text(json.dumps({
        "anchor_id": aid, "cmd_hash": aid, "actor": "user:tester",
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }) + "\n", encoding="utf-8")
    return aid


def _team(tmp_path):
    p = tmp_path / "team.yaml"
    p.write_text('reviewers: ["user:lead@x.com"]\nallow_self_review: false\n',
                 encoding="utf-8")
    return p


# --- tier resolution -----------------------------------------------------------
def test_claimed_is_below_floor(tmp_path):
    tier, _ = mt.admissibility({"evidence_tier": "claimed"}, root=tmp_path)
    assert tier == "claimed"


def test_anchored_with_real_id_is_anchored(tmp_path):
    aid = _seed_anchor(tmp_path, "curl -s http://localhost/health")
    tier, _ = mt.admissibility(
        {"evidence_tier": "anchored", "anchor_id": aid}, root=tmp_path)
    assert tier == "anchored"


def test_anchored_with_fabricated_id_is_rejected(tmp_path):
    _seed_anchor(tmp_path, "curl -s http://localhost/health")
    tier, reason = mt.admissibility(
        {"evidence_tier": "anchored", "anchor_id": "deadbeefdeadbeef"},
        root=tmp_path)
    assert tier == "rejected"
    assert "anchor" in reason.lower()


# --- hard admissibility (needs cosign) -----------------------------------------
def test_anchored_without_cosign_is_not_hard(tmp_path):
    aid = _seed_anchor(tmp_path, "curl -s http://localhost/health")
    ok, reason = mt.hard_admissible(
        {"evidence_tier": "anchored", "anchor_id": aid, "actor": "user:dev"},
        root=tmp_path, team_path=_team(tmp_path))
    assert ok is False
    assert "co-sign" in reason.lower() or "cosign" in reason.lower()


def test_anchored_with_valid_cosign_is_hard(tmp_path):
    aid = _seed_anchor(tmp_path, "curl -s http://localhost/health")
    ok, _ = mt.hard_admissible(
        {"evidence_tier": "anchored", "anchor_id": aid, "actor": "user:dev",
         "charter_cosign": "user:lead@x.com"},
        root=tmp_path, team_path=_team(tmp_path))
    assert ok is True


def test_claimed_is_never_hard(tmp_path):
    ok, _ = mt.hard_admissible(
        {"evidence_tier": "claimed", "actor": "user:dev",
         "charter_cosign": "user:lead@x.com"},
        root=tmp_path, team_path=_team(tmp_path))
    assert ok is False


def test_self_cosign_is_accepted(tmp_path):
    # Personal-first: a self co-sign (cosign == author) is accepted — the cosign is
    # attribution, not a roster check.
    aid = _seed_anchor(tmp_path, "curl -s http://localhost/health")
    ok, _ = mt.hard_admissible(
        {"evidence_tier": "anchored", "anchor_id": aid,
         "actor": "user:lead@x.com", "charter_cosign": "user:lead@x.com"},
        root=tmp_path, team_path=_team(tmp_path))
    assert ok is True


# --- agent-memory (compounding lessons) ----------------------------------------
def test_record_lesson_appends_feedback_and_project(tmp_path):
    assert mt.record_lesson("feedback", "env DB_URL must be set first",
                            root=tmp_path, actor="user:t") is True
    assert mt.record_lesson("project", {"bug": "expired token resets",
                                       "repro": "POST /reset w/ stale token"},
                            root=tmp_path, actor="user:t") is True
    import json as _json
    fb = (tmp_path / "manual-tester" / "feedback.jsonl").read_text().splitlines()
    pj = (tmp_path / "manual-tester" / "project.jsonl").read_text().splitlines()
    assert _json.loads(fb[0])["payload"] == "env DB_URL must be set first"
    assert _json.loads(pj[0])["actor"] == "user:t" and "ts" in _json.loads(pj[0])


def test_record_lesson_rejects_unknown_kind(tmp_path):
    assert mt.record_lesson("evidence", "nope", root=tmp_path) is False
