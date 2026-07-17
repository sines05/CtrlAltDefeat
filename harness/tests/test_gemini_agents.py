"""gemini-relayer agent contract (phase 3).

ONE passthrough agent wraps the gemini companion: it runs it OUT of the main
thread (context isolation) and is the parallel fan-out unit. It pins haiku
(literal, CC-locked), carries only Bash+Read, makes EXACTLY ONE companion call
per spawn (the loop is Claude's job, phase 4), and returns the provenance
envelope VERBATIM — zero analysis, zero editorialising (no drift back to a
sonnet handler).
"""
import re
from pathlib import Path

_AGENT = (Path(__file__).resolve().parent.parent / "plugins" / "hs" / "agents"
          / "gemini-relayer.md")


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


def test_relayer_model_haiku():
    m = re.search(r"^model:\s*(\S+)\s*$", _frontmatter(_text()), re.MULTILINE)
    assert m and m.group(1).strip().lower() == "haiku"


def test_relayer_tools_minimal():
    m = re.search(r"^tools:\s*(.+)$", _frontmatter(_text()), re.MULTILINE)
    assert m
    tools = {t.strip() for t in m.group(1).split(",") if t.strip()}
    assert tools == {"Bash", "Read"}, "relayer tools should be exactly Bash, Read: %s" % tools


def test_relayer_prose_verbatim_invariant():
    body = _body(_text()).lower()
    assert "verbatim" in body
    # must NOT promise analysis/summary/editing (drift toward a handler)
    for forbidden in ("summarize the", "analyze the finding", "edit the output",
                      "rewrite the"):
        assert forbidden not in body, "relayer must not promise %r" % forbidden


def test_relayer_one_call_per_spawn():
    body = _body(_text()).lower()
    assert "one" in body and "spawn" in body
    assert "loop" in body  # explicitly disclaims looping (that is Claude's job)


def test_relayer_invokes_companion_skill_flag():
    body = _body(_text())
    assert "gemini_companion.py" in body
    assert "--skill" in body
