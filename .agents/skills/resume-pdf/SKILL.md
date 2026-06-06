---
name: resume-pdf
description: Build a styled PDF resume from a markdown source file via headless Chrome. Use when the user wants to regenerate, recreate, or rebuild the resume PDF, update the PDF after editing the resume markdown, or convert a resume .md to .pdf. Default source is resume/Lix-Resume.md -> resume/Lix-Resume.pdf.
---

# Build Resume PDF

Convert a structured resume markdown file into a polished PDF. The pipeline is:
markdown → HTML (`md_to_html.py` + `resume.css`) → PDF (headless Chrome `--print-to-pdf`).

This matches how the original `Lix-Resume.pdf` was produced (headless Chrome / Skia, Helvetica Neue).

## Usage

Run the build script from the repo root:

```bash
.claude/skills/resume-pdf/build-resume.sh resume/Lix-Resume.md resume/Lix-Resume.pdf
```

- Arg 1 (required): input markdown path.
- Arg 2 (optional): output PDF path. Defaults to the input path with `.pdf`.
- `CHROME_BIN` env var overrides Chrome auto-detection.

The script writes the PDF and prints `Built: <path> (<bytes> bytes)`. It uses a temp
directory for the intermediate HTML and cleans it up automatically — no stray files.

## Default paths

- Source: `resume/Lix-Resume.md`
- Output: `resume/Lix-Resume.pdf`

When the user says "rebuild/recreate/regenerate the resume PDF" without specifying paths,
use these defaults.

## Markdown contract

`md_to_html.py` expects this structure (the styling depends on it):

```markdown
# Full Name
- 555-555-5555
- email@example.com
- City, ST 00000
- [linkedin.com/in/handle](https://www.linkedin.com/in/handle/)

## Senior Frontend Engineer        <- FIRST H2 becomes the title line
One-paragraph professional summary.  <- paragraph(s) until the next H2

## Skills                           <- later H2s are section headers
- **Languages:** TypeScript, JavaScript
- **Frameworks:** React, TanStack Query

## Experience
### Company — Role                  <- H3 = a job; split on em/en dash or hyphen
*Mon YYYY – Present*                 <- italic line = the date range (right-aligned)
- Accomplishment bullet.
- Accomplishment bullet.
```

Inline markdown supported anywhere: `**bold**`, `` `code` ``, `[text](url)`.

Rules the parser relies on:
- The **first** `## ` heading is treated as the title/role line, not a section.
- All later `## ` headings are section headers.
- A section containing `### ` entries renders as experience (company/role + dates + bullets).
- A section containing only `- ` items renders as a list (e.g. Skills); a leading
  `**Label:**` is bolded automatically.

## Verifying the result

Headless Chrome output isn't plain-text greppable. To confirm content rendered:

1. Copy the PDF into an MCP-accessible dir if needed (e.g. `~/Downloads`), since the
   PDF Tools extension is sandboxed to Documents/Downloads/Desktop.
2. Use the PDF Tools MCP `read_pdf_content` to spot-check the text, then delete the copy.

Or check page count without rendering:

```bash
strings <output.pdf> | grep -c "/Type /Page$"
```

## Styling changes

Edit `resume.css` to adjust fonts, spacing, margins, or colors. The `@page` rule controls
paper size and margins. Page font is Helvetica Neue to match the original. After any CSS
edit, re-run the build script to regenerate the PDF.
