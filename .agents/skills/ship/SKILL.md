---
name: ship
description: End-to-end shipping routine after a feature is complete and user-reviewed. Runs PR review, updates CLAUDE.md with learnings, commits/pushes/opens a PR, then watches CI and review comments — fixing any failures or feedback automatically. Use this skill whenever the user says "ship it", "ship this", "/ship", "ready to ship", "let's ship", "create a PR and watch it", or indicates they're done with a feature and want to get it merged.
disable-model-invocation: true
---

# Ship

Orchestrate the full shipping pipeline after a feature implementation is complete. The user has already reviewed the changes and is ready to go — your job is to get the PR open, green, and ready for merge.

## Steps

Run these steps sequentially. Each step must complete before moving to the next.

### Step 1: Review the changes

Invoke the `/pr-review-toolkit:review-pr` skill to review the current diff. If the review surfaces high-confidence issues (real bugs, security problems, logic errors), fix them before proceeding. Minor style nits that don't affect correctness can be noted but shouldn't block shipping.

### Step 2: Update CLAUDE.md

Invoke the `/claude-md-management:revise-claude-md` skill to capture any learnings from this session into the project's CLAUDE.md files. This keeps project context fresh for future sessions.

### Step 3: Commit, push, and open a PR

Invoke the `/commit-commands:commit-push-pr` skill to stage changes, create a commit, push the branch, and open a pull request on GitHub.

### Step 4: Watch the PR

After the PR is created, monitor it for CI results and review comments. This is a loop — keep watching until the PR is green and has no unresolved comments.

#### CI failures (lint, typecheck, test, build)

1. Run `gh pr checks <pr-number> --watch` to wait for CI to complete
2. If any check fails, investigate the failure:
   - `gh run view <run-id> --log-failed` to see what went wrong
   - Fix the root cause locally
   - Commit the fix (new commit, not amend) and push
   - Watch CI again
3. Repeat until all checks pass

#### Review comments

1. Run `gh api repos/{owner}/{repo}/pulls/<pr-number>/comments` to check for review comments
2. Also check `gh api repos/{owner}/{repo}/pulls/<pr-number>/reviews` for review-level feedback
3. For each comment:
   - Read and understand the feedback
   - If it's a valid fix request, apply the change
   - Commit and push
4. After addressing comments, watch CI again (fixes might introduce new failures)

#### When to stop

- All CI checks are green AND no unresolved review comments → report success and the PR URL
- If you've done 3+ rounds of fixes without converging, stop and ask the user for guidance rather than looping indefinitely
