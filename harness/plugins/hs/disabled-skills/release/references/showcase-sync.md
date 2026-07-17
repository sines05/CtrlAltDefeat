# Showcase sync

`build.py` writes the showcase into the local `showcase/` dir but never pushes it. `showcase_sync.sync()` publishes that output to the public showcase repo.

## File-set (from release.yaml)

Exactly these paths are copied — nothing else travels:

- `index.html`
- `sdlc-harness-showcase.html`
- `guides/`
- `assets/`

Source dir + remote URL + branch + the file-set live in `release/release.yaml`. The remote is not GitHub-only: the sync uses plain `git clone/add/commit/push`, so any host works. Point it elsewhere (e.g. a GitLab/Gitea repo) with `--showcase-url` rather than editing code.

## VERSION marker

`build.py` output is version-less, so the showcase repo had nothing to answer "is this version already synced?". The sync writes a `VERSION` file (holding `X.Y.Z`) into the showcase repo and commits with message `release: vX.Y.Z`. The step-3 idempotency probe reads this marker.

## Clone-when-absent

If the showcase repo isn't checked out locally, sync `git clone`s it to a temp dir, copies + commits + pushes there, then **removes the temp dir** after the push. A locally present checkout is used in place (no temp).

## Posture

- **solo** → sync pushes the showcase commit.
- **team** → sync commits locally and **prints** the showcase push command.

The staging is explicit (`git add <file-set> VERSION`), never a blanket `git add -A`, so a dirty showcase working tree can't smuggle files into a release.
