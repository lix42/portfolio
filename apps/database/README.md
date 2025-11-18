# Database Migrations

This directory contains D1 database migration scripts.

## Running Migrations

```bash
# Local database
wrangler d1 execute portfolio-sql-staging \
  --local \
  --file=apps/database/migrations/0001_initial_schema.sql

# Remote staging database
wrangler d1 execute portfolio-sql-staging \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql

# Remote production database
wrangler d1 execute portfolio-sql-prod \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql
```

## Migration Files

- `0001_initial_schema.sql` - Initial schema (companies, documents, chunks tables)
- `0002_test_data.sql` - Test data for development

## Schema Documentation

See `docs/cloudflare-migration/design/database-schema.md` for detailed schema design.
