"""partner-relayer agent contract (phase 6, twin of test_gemini_agents.py).

ONE passthrough agent wraps partner_companion.py: it runs it OUT of the main
thread (context isolation), pins haiku, carries only Bash+Read, and makes
EXACTLY ONE companion call per spawn — the body must reference the real
script it shells out to. maxTurns must be >= 2: a tool-then-respond courier
needs turn 1 for the companion tool_use and turn 2 to surface its stdout as
the final envelope; maxTurns: 1 terminates at the cap right after the tool_use
(error_max_turns, result=None), returning an EMPTY envelope. The one-call-only
contract is enforced by the agent's prose, not by starving its turn budget.
"""
import re
from pathlib import Path

_AGENT = (Path(__file__).resolve().parent.parent / "plugins" / "hs" / "agents"
          / "partner-relayer.md")


def _text():
    return _AGENT.read_text(encoding="utf-8")


def _frontmatter(text):
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    return text[:end] if end != -1 else text


def _body(text):
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    after = text.find("\n", end + 1) if end != -1 else -1
    return text[after + 1:] if after != -1 else ""


def test_relayer_exists():
    assert _AGENT.is_file()


def test_relayer_runs_partner_companion():
    text = _text()
    body = _body(text)
    assert "partner_companion.py" in body

    fm = _frontmatter(text)
    m = re.search(r"^maxTurns:\s*(\d+)\s*$", fm, re.MULTILINE)
    assert m and int(m.group(1)) >= 2  # >=2 so the courier can surface its tool output

    m = re.search(r"^model:\s*(\S+)\s*$", fm, re.MULTILINE)
    assert m and m.group(1).strip().lower() == "haiku"


def test_relayer_never_chooses_provider():
    body = _body(_text()).lower()
    # the relayer is a dumb courier — Claude picks the provider, not the agent
    assert "you never" in body or "never choose" in body or "does not choose" in body
