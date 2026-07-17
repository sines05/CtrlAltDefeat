"""artifact_io.py — the one gate-artifact writer: run_seq stamp + atomic write.

The three gate producers (plan_approval, write_verification, write_review_decision)
route their final write through stamp_and_write, so run_seq is stamped in a SINGLE
place (D1) and every gate artifact lands atomically. The orchestrator's watchdog reads
these by run_seq to reject a stale/prior-run artifact — which only works if the
producer stamps it.

D1 boundary discipline: tầng-1 does NOTHING with run_seq's semantics — it reads the env
the orchestrator exported and writes the field. Env absent → run_seq:null; a standalone
harness (no orchestrator) writes null forever and stays correct.
"""
import json
import os
from pathlib import Path

_ENV_KEY = "HARNESS_RUN_SEQ"


class CrossVolumeError(RuntimeError):
    """The .tmp landed on a different volume than the target dir, so os.replace could
    not be atomic. Raised BEFORE any replace so the reader never sees a torn file."""


def _run_seq_from_env(env=None):
    """The orchestrator-exported run_seq as int, or None when absent/blank/malformed.
    Fail-open to null (never raise): a dev running the gate without an orchestrator
    must still write a valid artifact (back-compat)."""
    env = os.environ if env is None else env
    raw = env.get(_ENV_KEY)
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return int(raw)
    except (ValueError, TypeError):
        return None


def _serialize(path: Path, rec: dict) -> str:
    if path.suffix == ".yaml":
        import yaml
        return yaml.safe_dump(rec, allow_unicode=True, sort_keys=False)
    return json.dumps(rec, ensure_ascii=False, indent=2) + "\n"


def stamp_and_write(path, record, *, env=None) -> dict:
    """Stamp run_seq (from HARNESS_RUN_SEQ, null if absent) into a COPY of `record`,
    serialize by suffix (.yaml/.json), and write atomically: a .tmp in the SAME dir,
    same-volume assert, then os.replace. A reader listing *.json never sees the .tmp;
    a cross-volume tmp fails loud instead of a torn write. Returns the stamped record."""
    path = Path(path)
    rec = dict(record)
    rec["run_seq"] = _run_seq_from_env(env)
    body = _serialize(path, rec)

    tmp = path.parent / (path.name + ".tmp")
    # fsync the tmp before replace so "no torn write" holds across a crash too: os.replace
    # is atomic for the directory entry, but the tmp's data blocks may still be unflushed
    # (the classic rename-without-fsync gap → an empty/partial file after power loss).
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(body)
        fh.flush()
        os.fsync(fh.fileno())
    try:
        if os.stat(tmp).st_dev != os.stat(path.parent).st_dev:
            raise CrossVolumeError(
                "tmp %s and target dir %s are on different volumes — os.replace would "
                "not be atomic; refusing a torn write" % (tmp, path.parent))
        os.replace(tmp, path)
    except BaseException:
        # never leave a stray .tmp a reader might later mistake for content
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise
    return rec
