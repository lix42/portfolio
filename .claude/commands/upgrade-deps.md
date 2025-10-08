---
description: Check and upgrade dependencies with major version updates
allowed-tools: Bash(pnpm:*), Bash(npm:*), TodoWrite
---

# Upgrade Dependencies Command

Analyze all packages in the monorepo and identify major version upgrades that can be safely applied.

## Steps to execute:

1. List all packages in the monorepo
2. For each package, list its direct dependencies
3. Check for major version updates for all dependencies using `pnpm outdated --recursive --format json`
4. Analyze compatibility by checking peer dependencies for packages with major updates:
   - Use `npm view <package>@<version> peerDependencies --json` to check compatibility
   - Identify transitive dependency conflicts (e.g., if Package A and B both depend on Package C, check if they can upgrade together)
5. Present a list of packages that can be upgraded, with reasoning about why they're safe
6. Ask user for confirmation before upgrading
7. If user confirms, upgrade each package using `pnpm add <package>@^<version>` or `pnpm add -D <package>@^<version>`
8. After all upgrades, verify with:
   - `pnpm biome:check` (if available)
   - `pnpm lint:check` (if available)
   - `pnpm build`
   - `pnpm test`
   - Service smoking test (see `apps/service/CLAUDE.md`)
9. If any verification fails, investigate and fix the issues:
   - Check for breaking changes in changelogs
   - Add necessary type assertions or suppressions
   - Update test code if needed
10. Report final status with list of successfully upgraded packages

## Notes:
- Use the TodoWrite tool to track progress through all steps
- Be careful about packages that block each other (like React ecosystem with framework peer dependencies)
- Always check peer dependencies for major version updates
- When TypeScript errors occur, investigate if it's a real breaking change or just a type compatibility issue that can be suppressed
