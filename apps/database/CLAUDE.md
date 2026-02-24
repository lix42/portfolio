# Database Migrations

D1 SQLite database migration scripts for the portfolio service. No build step — just SQL files applied via `wrangler d1 execute`.

## Migration Files

| File | Description |
|------|-------------|
| `migrations/0001_initial_schema.sql` | Initial schema: companies, documents, chunks tables |
| `migrations/0002_test_data.sql` | Test/seed data for development |
| `migrations/0003_normalized_tags.sql` | Normalized tags schema update |

## Commands

Run from the **repo root** using the root-level scripts:

```bash
# Local (uses local D1 replica)
pnpm db:migrate:local -- migrations/0001_initial_schema.sql

# Staging (remote)
pnpm db:migrate:staging -- migrations/0001_initial_schema.sql

# Production (remote)
pnpm db:migrate:prod -- migrations/0001_initial_schema.sql

# Query local DB
pnpm db:query:local -- "SELECT COUNT(*) FROM documents"

# Query staging
pnpm db:query:staging -- "SELECT COUNT(*) FROM documents"
```

Or directly with wrangler:

```bash
wrangler d1 execute portfolio-sql-staging --local --file=apps/database/migrations/0001_initial_schema.sql
wrangler d1 execute portfolio-sql-staging --remote --file=apps/database/migrations/0001_initial_schema.sql
wrangler d1 execute portfolio-sql-prod --remote --file=apps/database/migrations/0001_initial_schema.sql
```

## Databases

| Environment | D1 Database Name |
|-------------|-----------------|
| Local / Staging | `portfolio-sql-staging` |
| Production | `portfolio-sql-prod` |

## Gotchas

- **No package.json here** — this directory is not a workspace package, just a conventions folder for SQL files.
- Apply migrations in order (0001 → 0002 → ...). D1 has no built-in migration tracker — track applied migrations manually or via a `migrations` table.
- See `docs/cloudflare-migration/design/database-schema.md` for full schema design documentation.
