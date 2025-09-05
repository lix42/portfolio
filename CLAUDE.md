# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a Portfolio RAG Assistant that uses Retrieval-Augmented Generation to answer questions about past work experience. The system consists of:

- **Data Ingestion**: Python scripts that chunk markdown content, generate embeddings via OpenAI, and store in Supabase with pgvector
- **Backend API**: Hono TypeScript service deployed on Cloudflare Workers that handles RAG queries
- **Frontend**: Waku-based React UI (in development)
- **Database**: Supabase with vector search capabilities

## Monorepo Structure

* `/supabase`: Database schema, migrations, and Supabase CLI configuration
* `/scripts`: Python data ingestion pipeline (companies, documents, chunking, embeddings)
* `/apps/service`: Hono TypeScript API for RAG chat functionality (Cloudflare Workers)
* `/apps/ui`: Waku React frontend (in development)
* `/packages`: Shared packages (unused currently)

## Development Commands

**Root level commands:**
- `pnpm dev:service` - Start backend service in development
- `pnpm dev:ui` - Start frontend in development  
- `pnpm dev` - Start both service and UI concurrently
- `pnpm build:service` - Build backend for production
- `pnpm build:ui` - Build frontend for production
- `pnpm build` - Build both applications

**Service-specific (in /apps/service):**
- `pnpm test` - Run Vitest tests
- `pnpm deploy` - Build and deploy to Cloudflare Workers
- `pnpm cf-typegen` - Generate CloudflareBindings types

**Data ingestion (in /scripts):**
- `python ingest_companies.py [--remote]` - Ingest company data
- `python ingest_documents.py [--remote]` - Ingest document data with chunking

## Key TypeScript Conventions

From `.cursor/rules/`:
- Use kebab-case for file names
- Use camelCase for variables/functions, PascalCase for classes/types/interfaces
- Prefix generic type parameters with `T` (e.g., `TKey`, `TValue`)
- Use `import type` for type-only imports (prefer top-level over inline)
- Avoid default exports unless required by framework
- Install packages via package manager commands, not manual package.json edits

## Package Manager

Uses `pnpm` with workspace configuration. The monorepo has workspaces for `@portfolio/service` and `@portfolio/ui`.
