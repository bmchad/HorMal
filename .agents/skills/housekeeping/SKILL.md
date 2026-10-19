---
name: housekeeping
description: Automated housekeeping workflow for HörMal. Maintains documentation in docs/context/, performs atomic git commits along changes, and always pushes to remote.
---

# Housekeeping Skill for HörMal

This skill defines the mandatory housekeeping protocol to maintain codebase hygiene, persist context and decisions, and ensure all changes are committed and pushed.

## 1. Context & Decisions Maintenance
Whenever you:
- Implement a new feature or resolve a bug
- Introduce or modify architectural patterns, prompts, or agents
- Execute database schema changes or migrations
- Modify deployment parameters or infrastructure

**You MUST update `docs/context/PROJECT_CONTEXT.md`** with:
1. A concise entry in the **Key Architectural Decisions Log**.
2. Any newly added database columns or migrations.
3. Relevant configuration or runbook instructions.

## 2. Commit Protocol (Commit Along the Way)
Do NOT accumulate massive uncommitted working trees. Commit incrementally:
- Use conventional commits format:
  - `feat: ...` for user-facing features or agent enhancements
  - `fix: ...` for bug fixes or stability corrections
  - `style: ...` for UI/CSS visual updates
  - `refactor: ...` for code reorganizations
  - `docs: ...` for documentation and context updates
  - `chore: ...` for build, dependencies, or migration scripts
- Ensure commit messages are descriptive and reference the key components modified.

## 3. Remote Push Protocol (Always Push When Finished)
Before concluding any task or user request:
1. Run `git status` to ensure all relevant files are tracked and clean.
2. Push all commits to the remote repository:
   ```bash
   git push origin main
   ```
3. Confirm that the remote is up to date with `git status`.
