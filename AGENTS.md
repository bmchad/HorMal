# HörMal Agent Instructions

## Housekeeping & Commit Policy
1. **Document Context & Decisions**: Always maintain and update `docs/context/PROJECT_CONTEXT.md` when architectural decisions, migrations, or prompt changes occur.
2. **Commit Along the Way**: Make atomic, clear commits using conventional commits format as milestones are reached.
3. **Always Push**: Always push all commits to `origin main` upon finishing tasks.
4. **AWS Deployments**: Stack `hormal` is in `sa-east-1` under account `340528522954`. Always ensure the AWS access credentials from `.env` are set when running SAM or AWS CLI commands.
