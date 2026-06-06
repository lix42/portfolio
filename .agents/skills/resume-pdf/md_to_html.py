#!/usr/bin/env python3
"""Convert a structured resume markdown file to styled HTML.

Usage: md_to_html.py <resume.md> <resume.css>  > out.html

Expected markdown structure (see SKILL.md for the contract):

    # Full Name
    - contact item
    - contact item
    - [link text](url)

    ## Job Title              <- first H2 becomes the title line
    Summary paragraph...      <- paragraph(s) until next H2

    ## Skills                 <- subsequent H2s are section headers
    - **Label:** comma, separated, values

    ## Experience
    ### Company — Role        <- H3 = job; split on em dash
    *Date range*              <- italic line = dates
    - bullet
    - bullet

Inline formatting supported in any text: **bold**, `code`, [text](url).
"""
import sys
import re
import html


def inline(text: str) -> str:
    """Apply inline markdown (links, code, bold) after HTML-escaping."""
    text = html.escape(text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    return text


def parse(lines):
    doc = {"name": "", "contacts": [], "title": "", "summary": [], "sections": []}
    state = "header"  # header -> summary -> section
    title_seen = False
    section = None
    job = None

    def flush_job():
        nonlocal job
        if job is not None:
            section["jobs"].append(job)
            job = None

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue

        if line.startswith("# "):
            doc["name"] = line[2:].strip()
            continue

        if line.startswith("## "):
            heading = line[3:].strip()
            if not title_seen:
                doc["title"] = heading
                title_seen = True
                state = "summary"
                continue
            flush_job()
            section = {"name": heading, "kind": None, "jobs": [], "items": []}
            doc["sections"].append(section)
            state = "section"
            continue

        if line.startswith("### ") and section is not None:
            flush_job()
            heading = line[4:].strip()
            parts = re.split(r"\s+[—–-]\s+", heading, maxsplit=1)
            job = {
                "company": parts[0].strip(),
                "role": parts[1].strip() if len(parts) > 1 else "",
                "dates": "",
                "bullets": [],
            }
            section["kind"] = "experience"
            continue

        if line.startswith("- "):
            content = line[2:].strip()
            if state == "header":
                doc["contacts"].append(content)
            elif job is not None:
                job["bullets"].append(content)
            elif section is not None:
                section["kind"] = section["kind"] or "list"
                section["items"].append(content)
            continue

        stripped = line.strip()
        if stripped.startswith("*") and stripped.endswith("*") and job is not None:
            job["dates"] = stripped.strip("*").strip()
            continue

        if state == "summary":
            doc["summary"].append(stripped)
            continue

    flush_job()
    return doc


def render(doc, css):
    out = []
    out.append("<!DOCTYPE html>")
    out.append('<html lang="en"><head><meta charset="utf-8" />')
    out.append(f"<title>{html.escape(doc['name'])} — Resume</title>")
    out.append(f"<style>\n{css}\n</style></head><body>")

    out.append(f"<h1>{inline(doc['name'])}</h1>")

    if doc["contacts"]:
        sep = '<span class="sep">|</span>'
        items = sep.join(inline(c) for c in doc["contacts"])
        out.append(f'<div class="contact">{items}</div>')

    if doc["title"]:
        out.append(f'<div class="title">{inline(doc["title"])}</div>')
    if doc["summary"]:
        out.append(f'<p class="summary">{inline(" ".join(doc["summary"]))}</p>')

    for section in doc["sections"]:
        out.append(f"<h2>{inline(section['name'])}</h2>")
        if section["kind"] == "experience":
            for job in section["jobs"]:
                out.append('<div class="job"><div class="job-head">')
                role = f' <span class="role">— {inline(job["role"])}</span>' if job["role"] else ""
                out.append(
                    f'<div class="who"><span class="company">{inline(job["company"])}</span>{role}</div>'
                )
                out.append(f'<div class="when">{inline(job["dates"])}</div></div>')
                if job["bullets"]:
                    out.append('<ul class="bullets">')
                    for b in job["bullets"]:
                        out.append(f"<li>{inline(b)}</li>")
                    out.append("</ul>")
                out.append("</div>")
        else:
            out.append('<ul class="skills">')
            for item in section["items"]:
                out.append(f"<li>{inline(item)}</li>")
            out.append("</ul>")

    out.append("</body></html>")
    return "\n".join(out)


def main():
    if len(sys.argv) < 3:
        sys.exit("Usage: md_to_html.py <resume.md> <resume.css>")
    with open(sys.argv[1], encoding="utf-8") as f:
        lines = f.read().split("\n")
    with open(sys.argv[2], encoding="utf-8") as f:
        css = f.read()
    sys.stdout.write(render(parse(lines), css))


if __name__ == "__main__":
    main()
