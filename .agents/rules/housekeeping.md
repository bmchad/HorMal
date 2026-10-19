# Housekeeping & Commit Rules for HörMal

1. **Maintain Context in `docs/context/`**:
   - Whenever any architectural decision, agent prompt change, database schema alteration, or infrastructure tweak is made, immediately record it in [docs/context/PROJECT_CONTEXT.md](file:///d:/KingsPec/Computa%C3%A7%C3%A3o/HorenApp/docs/context/PROJECT_CONTEXT.md).

2. **Commit Along the Way**:
   - Create focused, atomic commits as features or fixes are completed.
   - Use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`, `style:`).
   - Never leave completed work uncommitted.

3. **Always Push When Finished**:
   - At the conclusion of any task, push all commits to the remote branch (`git push origin main`).
   - Verify deployment to CloudFront / S3 / Lambda when applicable.
