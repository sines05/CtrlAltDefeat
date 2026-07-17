---
name: hs:document-skills
injectable: true
description: Create, edit, and analyze office files (.docx, .pdf, .pptx, .xlsx). Use to read content, create new files, edit with tracked changes, fill forms, or extract data from Word, PDF, PowerPoint, or Excel.
allowed-tools: [Bash, Read, Write, Edit]
argument-hint: "[docx|pdf|pptx|xlsx] [create|edit|extract|analyze]"
metadata:
  compliance-tier: knowledge
---

# hs:document-skills — office document operations

This skill provides processes and techniques for 4 common document formats. No fake code; no invented APIs — every technique has a real tool behind it.

## Quick routing

| Format | Primary tasks | Reference drawer |
|---|---|---|
| `.docx` | Create, edit XML, redline | `references/docx.md` |
| `.pdf` | Extract, merge, fill forms | `references/pdf.md` |
| `.pptx` | Create slides, edit templates, thumbnails | `references/pptx.md` |
| `.xlsx` | Data analysis, formulas, formatting | `references/xlsx.md` |

## Executable tools (restored)

Two bundled tools back the prose drawers — use them instead of hand-rolling:

- **HTML → PowerPoint**: `scripts/html2pptx.js` authors a pptxgenjs slide from an HTML layout (text, images, shapes, bullet lists; placeholder extraction; overflow detection). Runtime deps (`playwright`, `sharp`, `pptxgenjs`) are declared in `scripts/package.json` — run `npm install` in `scripts/` first; the script throws a clear error if the HTML body dimensions do not match the presentation
  layout. See `scripts/html2pptx.md` for the full guide.
- **OOXML validation (pre-pack safety net)**: before repacking an edited Office file, validate the unpacked tree against the bundled XSD schemas — it catches the malformed XML, broken relationships, and undeclared content types that make a file open as "corrupt":
  ```bash
  python3 ooxml/scripts/unpack.py <file.pptx> <dir>
  python3 ooxml/scripts/validate.py <dir> --original <file.pptx>   # exit 0 = clean
  python3 ooxml/scripts/pack.py <dir> <out.pptx>
  ```
  `validate.py` reports only NEW errors versus the original, so a pre-existing quirk in the source file does not block a legitimate edit. Requires `lxml` + `defusedxml`.

## Boundaries

- Do NOT invent library names or script paths that have not been verified.
- Do NOT reference skill paths outside the harness at runtime — the harness is self-contained.
- If an operation exceeds the scope of one drawer -> suggest using `hs:docs` (project documentation) or `hs:skill-creator` (packaging a dedicated tool).

## General process

1. **Identify format and task** — if the user is unclear, ask: what file type, read/create/edit?
2. **Load the drawer** — open `references/<format>.md` and read the decision tree.
3. **Check tool availability** — run `which pandoc`, `python -c "import pypdf"`, etc. before writing code.
4. **Implement** — follow the process in the drawer; use the appropriate CLI/Python/JS tool.
5. **Verify** — after creating or editing the file: reopen it, check the content, fix any errors.
6. **Code style** — concise code, no unused variables, no unnecessary print statements.

## When to stop and ask

- User has not specified the format -> ask immediately, do not guess.
- Required tool is not installed -> report the install command, do not proceed.
- Complex operation (legal redline, mail-merge, VBA macro) -> confirm scope before starting.

## Quick reference drawers

| Drawer | Content |
|---|---|
| `references/docx.md` | Create (python-docx), edit OOXML, redline workflow, text extraction |
| `references/pdf.md` | pypdf/pdfplumber, reportlab, qpdf CLI, OCR, form filling |
| `references/pptx.md` | python-pptx create/edit slides, templates, image rendering |
| `references/xlsx.md` | pandas / openpyxl, formulas, color-coding, recompute |
