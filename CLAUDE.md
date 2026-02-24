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
	•	Present what you'll change and why before acting.
	•	Once agreed, follow the plan and summarize results after.

### Code Organization

Prefer pure functions over classes. Use classes only when required (Durable Objects, framework APIs).

File organization pattern:
	•	types.ts - Type definitions and interfaces
	•	utils.ts or utils/ - Pure utility functions
	•	Feature folders (e.g., steps/) for domain logic
	•	Class files contain minimal orchestration only

## Project Overview

Turborepo monorepo using pnpm workspaces.

**Apps:**
- `apps/service` — Hono API on Cloudflare Workers (RAG backend)
- `apps/ui` — TanStack Start (React) frontend on Cloudflare Workers

**Packages:**
- `packages/shared` — Shared schemas, types, prompts, utilities
- `packages/env-config` — Environment configuration
- `packages/eslint-config` — Shared ESLint config

## Commands

```bash
# Development (UI only)
pnpm dev

# Run all tests
pnpm test

# Lint (Biome)
pnpm lint
pnpm lint:fix

# Type checking (all packages)
pnpm typecheck

# Build all
pnpm build

# Database migrations (D1)
pnpm db:migrate:local -- migrations/001.sql
pnpm db:migrate:staging -- migrations/001.sql
pnpm db:query:local -- "SELECT * FROM table"
```

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Linter/Formatter:** Biome (not ESLint/Prettier)
- **Frontend:** TanStack Start (React Router v7), Tailwind CSS v4, Base UI, TanStack Query
- **Backend:** Hono on Cloudflare Workers with D1 + Vectorize + R2 + OpenAI
