---
name: db-migrate
description: Create a new D1 SQL migration file and optionally apply it to local/staging/prod
disable-model-invocation: true
---

1. Find the highest-numbered file in apps/database/migrations/ (format: NNNN_name.sql)
2. Create the next file: NNNN+1_<name>.sql with the user's SQL
3. Ask which environment to apply to: local, staging, or prod
4. Run the appropriate script from package.json:
   - local: `pnpm db:migrate:local apps/database/migrations/<file>`
   - staging: `pnpm db:migrate:staging apps/database/migrations/<file>`
   - prod: `pnpm db:migrate:prod apps/database/migrations/<file>`
