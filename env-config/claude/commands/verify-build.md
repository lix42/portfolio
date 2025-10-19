---
description: Verify build integrity with linting, type checking, tests, and smoke tests
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(node:*), TodoWrite, Read
---

# Verify Build Command

Run a comprehensive verification of the build to ensure code quality, type
safety, and functionality.

## Steps to execute

1. Run Biome checks (if available):
   - `pnpm biome:check`
2. Run linting checks (if available):
   - `pnpm lint:check`
3. Run build for all packages (Note: apps/service uses build for validation only - no artifacts generated):
   - `pnpm build`
4. Run all tests:
   - `pnpm test`
5. Run service smoke test (see `apps/service/CLAUDE.md`):
   - Follow the smoke testing procedure for the service

## Verification process

- Use the TodoWrite tool to track progress through verification steps
- If any step fails, report the failure immediately with details
- For each failed step, provide:
  - Error messages and stack traces
  - Relevant file paths and line numbers
  - Suggested fixes or areas to investigate
- Continue with remaining steps even if one fails to get complete picture
- Provide final summary of all verification results

## Notes

- These checks should be run after any significant code changes
- Useful before creating commits or pull requests
- Can be run individually or as a complete suite
- Smoke tests may require additional setup (check service documentation)
- For `apps/service`: The build command runs linting and type checking only (no artifacts)
- The service is deployed directly via `wrangler deploy` without a build step
