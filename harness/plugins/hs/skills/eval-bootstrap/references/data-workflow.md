# Data workflow (Phase 3.6)

Turn raw sample files into a locked ground-truth baseline the eval runs against.
Human-in-the-loop throughout — ground truth is judgment, not automation.

## 1. Discover samples

Find representative input files for the domain (CVs, tickets, documents…). Aim for
coverage of the edge cases the pipeline will hit, not just the happy path. Place
them under `data/<sample_dir>/`.

## 2. Produce `.txt` sidecars

The eval runner reads a pre-extracted `.txt` sidecar next to each file, so CI never
re-parses binaries and needs no PDF toolchain.

- **PDF / DOCX** → `python3 evals/scripts/extract_data_text.py --data-dir data/<sample_dir>`.
  This needs `pymupdf` + `python-docx` — go through the **Q4 ask-then-pip** gate
  first (declare in `evals/requirements.txt`, AskUserQuestion before installing).
- **Images** → **model read, never machine-OCR.** Read the image text yourself at
  bootstrap, review it for accuracy, and commit the `.txt` sidecar by hand. No OCR
  library — that keeps the runner deterministic and API-key-free.

## 3. Bootstrap ground truth (human in the loop)

Fill `evals/eval_types/<domain>/tests/production_fixtures/ground_truth.json`:

- One entry per case: `case_file`, the expected `ground_truth` field values, and a
  `notes` line saying WHERE each expected value comes from in the source.
- Set a field to `null` when it is genuinely absent (→ SKIP/MISS/EXTRA semantics).
- Do not guess. If a value is ambiguous in the source, note the ambiguity rather
  than inventing a crisp answer — a wrong ground truth poisons every future run.

## 4. Dry-run + iterate

Run the eval against the fixtures. Expect early mismatches — they usually mean the
eval-mock `extract` logic or the normaliser needs work, not that ground truth is
wrong. Fix the mock/normaliser until a clean run passes, then:

## 5. Lock the baseline

Once a clean run exits 0, PIN the contract: fill `SAMPLE_RESULTS` /
`EXPECTED_MATURITY` / `EXPECTED_PASSED` in the generated `test_scorer.py` from that
known run. From then on any scoring drift fails the contract test instead of
shipping silently.
