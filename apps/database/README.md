# Database Migrations

This directory contains D1 database migration scripts.

## Running Migrations

```bash
# Local database
wrangler d1 execute portfolio-dev \
  --local \
  --file=apps/database/migrations/0001_initial_schema.sql

# Remote dev database
wrangler d1 execute portfolio-dev \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql
```

## Migration Files

- `0001_initial_schema.sql` - Initial schema (companies, documents, chunks tables)
- `0002_test_data.sql` - Test data for development

## Schema Documentation

See `docs/cloudflare-migration/design/database-schema.md` for detailed schema design.
