---
name: db-query
description: Run an ad-hoc SQL query against a D1 database (local, staging, or prod). Use this skill whenever the user wants to query, inspect, or explore database data — e.g. "show me all users", "check the messages table", "run this SQL", "query the DB".
disable-model-invocation: true
---

1. Extract the SQL query from the user's request (or ask if none was provided)
2. Ask which environment to run against: local, staging, or prod
3. Run the appropriate script:
   - local: `pnpm db:query:local -- "<SQL>"`
   - staging: `pnpm db:query:staging -- "<SQL>"`
   - prod: `pnpm db:query:prod -- "<SQL>"`
4. Display the results
