---
description: Check and upgrade dependencies with major version updates
allowed-tools: Bash(pnpm:*), Bash(npm:*), TodoWrite
---

# Upgrade Dependencies Command

Analyze all packages in the monorepo and identify major version upgrades
that can be safely applied.

## Steps to execute

1. List all packages in the monorepo
2. For each package, list its direct dependencies
3. Check for major version updates for all dependencies using
   `pnpm outdated --recursive --format json`
4. Analyze compatibility by checking peer dependencies for packages with
   major updates:
   - Use `npm view <package>@<version> peerDependencies --json` to check
     compatibility
   - Identify transitive dependency conflicts (e.g., if Package A and B both
     depend on Package C, check if they can upgrade together)
5. For each package with a feasible major version upgrade:
   - Search for the package's changelog using GitHub search or web search
   - Look for CHANGELOG.md, HISTORY.md, or GitHub releases
   - Analyze major changes between current and target versions
   - Identify breaking changes, new features, and migration requirements
6. Present a list of packages that can be upgraded with:
   - Current version → Target version
   - Summary of major changes from changelog
   - Breaking changes and migration notes
   - Reasoning about why upgrade is safe or what needs attention
7. Ask user for confirmation before upgrading
8. If user confirms, upgrade each package using `pnpm add <package>@^<version>`
   or `pnpm add -D <package>@^<version>`
9. After all upgrades, verify with:
   - `pnpm biome:check` (if available)
   - `pnpm lint:check` (if available)
   - `pnpm build`
   - `pnpm test`
   - Service smoking test (see `apps/service/CLAUDE.md`)
10. If any verification fails, investigate and fix the issues:
    - Reference changelog breaking changes
    - Add necessary type assertions or suppressions
    - Update test code if needed
11. Report final status with list of successfully upgraded packages

## Notes

- Use the TodoWrite tool to track progress through all steps
- Be careful about packages that block each other (like React ecosystem with
  framework peer dependencies)
- Always check peer dependencies for major version updates
- For changelog lookup, try these approaches in order:
  - Use `gh api` or `gh repo view` to find the package's GitHub repository
  - Use `gh api` to read CHANGELOG.md or similar files from the repo
  - Use `gh release list` and `gh release view` for GitHub releases
  - Fall back to MCP GitHub tools if `gh` commands fail:
    - `mcp__github_repos__search_repositories` to find the package's repo
    - `mcp__github_repos__get_file_contents` to read CHANGELOG.md or similar
    - `mcp__github_repos__list_releases` for GitHub releases
  - Fall back to `WebSearch` if repository is not on GitHub
- When analyzing changelogs, focus on:
  - Breaking changes marked with "BREAKING" or in major version sections
  - Migration guides or upgrade instructions
  - Deprecated features that may affect the codebase
  - New peer dependency requirements
- When TypeScript errors occur, investigate if it's a real breaking change or
  just a type compatibility issue that can be suppressed
