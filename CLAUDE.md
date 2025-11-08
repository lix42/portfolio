# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Rules

### Default to verified docs, not memory

When working with frameworks or UI libraries (e.g., Cloudflare, Hono, React Router, Tailwind, Panda CSS, Radix UI, Ark UI, Park UI, etc.) — never rely on memory or training data.

	•	Always check official documentation for the latest APIs and examples.
	•	Use live sources (e.g., Context7 API) to fetch up-to-date references when possible.
	•	Trust verified sources, even for tools you already know well.

### Think Critically and Verify

When asked “Does it make sense?”, “What do you think?”, or given a statement or plan — never assume it’s correct.

	•	Always analyze and validate logic before agreeing.
	•	Push back on mistakes or weak reasoning.
	•	Give a short, reasoned explanation instead of simple approval.
	•	If uncertain, state assumptions and what extra info you need to confirm.

### Plan Before You Act

Before making meaningful changes, propose and confirm a plan first.

	•	Small safe edits (e.g., formatting, lint, typo) are fine directly.
	•	Discuss first for any major change — type fixes, refactors, new features, or behavior changes.
	•	Present what you’ll change and why before acting.
	•	Once agreed, follow the plan and summarize results after.
