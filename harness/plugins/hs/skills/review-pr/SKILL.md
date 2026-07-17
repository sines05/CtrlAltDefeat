---
name: hs:review-pr
injectable: false
description: Review a GitHub PR or GitLab MR (forge auto-detected from the git remote) — diff, CI, correctness, security, breaking changes, anti-slop. Supports --fix (fix + commit) and --reply (post to the forge). Use for a full PR/MR review; for small local diffs use hs:code-review.
argument-hint: "<#PR|#MR|url> [--fix] [--reply]"
allowed-tools: [Bash, Read, Write, Edit, Grep, Glob, Task]
metadata:
  compliance-tier: workflow
---

# hs:review-pr — comprehensive pull request review

Review PR `$ARGUMENTS` in this repository.

Relationship to **hs:code-review**: hs:code-review is suited for a specific diff, a single commit, or pending changes. hs:review-pr covers the PR/branch level — including CI status, PR metadata, scope mismatch, and the --fix loop.

## Modes

| Mode | When |
|---|---|
| Review-only (default) | Print findings to chat. No edits, commits, or pushes. |
| `--fix` | Review -> fix findings -> commit+push -> re-review. Loop until no actionable findings remain. |
| `--reply` | After review (or after the fix loop), post the review to GitHub via `gh pr review`. |

Flags can be combined: `review-pr 123 --fix --reply` runs the fix loop then posts the final review.

## Argument parsing

Extract `PR_REF` from `$ARGUMENTS` by stripping `--fix` and `--reply`. Detect flags by substring match (order does not matter).

No argument -> `AskUserQuestion`: PR number/URL, mode, whether to use --fix.

## Workflow (hard)

### 1. Gather PR context

**Detect the forge first.** Read the git remote and pick exactly one CLI for the whole run — never mix `gh` and `glab`:

```bash
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
case "$REMOTE_URL" in
  *gitlab*) echo "FORGE=gitlab CLI=glab" ;;
  *github*) echo "FORGE=github CLI=gh" ;;
  *)        echo "FORGE=unknown — inspect 'git remote -v' and ASK; do not guess" ;;
esac
```

For a **GitHub** remote, gather context with `gh`:

```bash
gh pr view "$PR_REF" --json title,body,author,baseRefName,headRefName,headRefOid,files,additions,deletions,changedFiles
gh pr diff "$PR_REF"
gh pr checks "$PR_REF" 2>/dev/null || echo "No checks found"
gh pr diff "$PR_REF" --name-only 2>/dev/null | head -50
```

For a **GitLab** remote, use the `glab mr` equivalents (`glab mr view "$PR_REF"`, `glab mr diff "$PR_REF"`, …; `glab mr view` prints text — for JSON use `glab api`). The full `gh pr` ↔ `glab mr` command mapping, the unknown-forge ask rule, and the CLI/auth check live in `references/forge-detection.md`.

### 2. Read project context

Read `CLAUDE.md`, `docs/code-standards.md`, `docs/system-architecture.md` if they exist. Use them to detect project-specific convention violations.

**Structured rule layer** (preferred): the prose pattern in `references/project-rules-example.md` is now encoded as a diff-aware rule layer — run `rule_view.load_rules_dual` over the changed files (operational rules from the standards tree, the single source), judge the applied rules, and write `rule-scan.json` via `rule_view.build_rule_scan` (records `changed_files`). See
`code-review/references/review-rules-layer.md` for the procedure and the rule-scan/gate contract. To add a per-repo rule, use the rule-author skill (it writes `standards.user.yaml`). `references/project-rules-example.md` is retained as a worked example of the rule shape.

### 3. Mandatory gates

Run before the verdict — they produce findings even when the code itself is correct. Load `references/mandatory-gates.md` for the full procedure:

- **Duplicate / prior-work gate** — search PRs/issues/log + the codebase for an existing implementation; a merged/overlapping prior is an **Important** finding.
- **Strategic-necessity gate** — review as product owner: does the PR create clear value? Correct-but-unnecessary / scope-creep is an **Important** product-risk finding.

(Project standards are already loaded in step 2 — no separate standards gate needed.)

### 4. Analyze the diff

Read each changed file. For modified files, read the full file (not just the diff) to understand surrounding context. Check:

**Correctness**: logic error, off-by-one, nil/null dereference, missing error handling, race condition, edge case.

**Security**: injection (SQL/XSS/command/SSRF/path traversal), hardcoded secrets, missing input validation at system boundary, auth gap.

**Breaking changes**: API contract change without migration/shim, schema change without migration, removed/renamed public interface.

**Anti-slop**: Load `references/anti-ai-slop.md` when any of the following is true: diff >300 lines; PR creates >2 new files in `utils/`/`helpers/`/`lib/common/`; a new generic file name appears, a parallel reimplementation of an existing utility, an abstraction with a single caller, a config flag for a constant, catch-and-swallow, a linter silencer, phantom coverage, scope mismatch (title vs
diff size), or LLM-style commit messages. The reference contains the full taxonomy, severity rules, phrasing guide, and stack appendix.

**Testing**: Are new code paths tested? Do existing tests still pass? Phantom coverage?

### 5. Synthesize findings

**Summary**: 1-2 sentences describing what the PR does.

**Mandatory gates**: Duplicate — clear | overlap | duplicate · Strategic necessity — clear value | questionable | not justified. A failed gate is a blocker at **Important** severity.

**Risk level**: Low / Medium / High — based on scope, complexity, and breakage potential.

**Findings** by severity:
- **Critical**: must fix before merge (bug, security, data loss)
- **Important**: should fix (logic issue, missing validation, structural slop)
- **Suggestion**: nice-to-have (style, micro slop)

> Severity rule: structural slop -> Important; micro slop -> Suggestion.
> If you cannot articulate a **concrete cost** in this codebase -> do not flag.

**Verdict**:
- **Approve** — no Critical or Important findings
- **Request changes** — has Critical or Important findings
- **Comment** — Suggestions only, safe to merge

## Fix loop (`--fix`)

Do not stop at "code review clean" while merge conflicts or failing/pending checks remain. The blocking set is the union of: review findings (all Critical/Important + concrete in-scope Suggestions), **merge state** from `gh pr view "$PR_REF" --json mergeStateStatus,baseRefName,headRefName,headRefOid`, and **CI** from `gh pr checks "$PR_REF"` + `statusCheckRollup`. Approve only when all three
are clear.

1. If no actionable findings, no merge blockers, and all required checks are green -> stop, report **Approve**.
2. Fix findings using `hs:fix` with full context (PR ref, base/head branch, changed files, each finding: severity / file / line / expected / actual / why).
   Constraints: stay within PR scope, do not refactor outside scope, do not break the public contract unless the finding requires it.
3. Before committing, verify the worktree is still on the PR head: `git rev-parse HEAD` must match the `headRefOid` captured in step 1. If it diverged, re-fetch PR metadata and warn of concurrent changes — do not commit to the wrong branch. After `hs:fix` verifies -> use `hs:git` to commit and push to the PR head branch. Do not push if verification failed, secrets are present, or the working
   tree has unrelated changes.
4. **Resolve conflicts.** If the PR is not mergeable because the branch is stale or conflicted: `git fetch origin` → merge or rebase the PR head against `origin/<baseRefName>` per repo convention → resolve every conflict in real files → run the relevant tests → commit. Never mark the loop complete while `mergeStateStatus` still indicates conflicts.
5. **Watch CI.** After the push, start with `gh pr checks "$PR_REF"`; if any check is pending, watch/poll until every check is terminal (bound by the repo's normal CI duration, else a 30-minute ceiling on the same head SHA). On a clearly transient infrastructure failure, `gh run rerun <run-id> --failed` once then re-watch — do NOT rerun to hide a deterministic failure. All required checks must
   be green before an
   **Approve** verdict in `--fix` mode.
6. Re-review: repeat from step 1 with `--fix` (and `--reply` if it was set initially).

Stop when:
- Re-review has no remaining actionable findings, no merge conflicts, all required checks green
- `hs:fix` is blocked by an open user/business decision
- The same blocker survives 3 fix attempts (loop does not converge)
- An external blocker remains (missing credentials, service outage, unavailable approval)

Final `--fix` output: iteration count, final verdict, commits pushed, remaining findings, blockers.

## Reply mode (`--reply`)

Posts the review to the PR. Load `references/reply-mode.md` for the full procedure: gh pre-flight (falls back to printing locally if gh is absent/unauthenticated, never fails the skill), body format + footer + 60k cap, the verdict→`gh pr review` flag map, the self-PR 422→`--comment` fallback, and `--fix --reply` (post the final re-review on convergence).

## Final output

- Verdict (Approve / Request changes / Comment)
- Iteration count if `--fix` ran
- Commits pushed if `--fix` ran
- `--reply` succeeded / fell back / printed-locally
- Remaining findings or blockers
- Open questions if any
