## What and why

## How was it tested

## Checklist

- [ ] Base branch is `dev` (only `dev` merges into `main`)
- [ ] No secrets or `.env` values in the diff
- [ ] `npm run lint`, `typecheck`, `test` and `build` pass
- [ ] UI changes are keyboard accessible and have labels / alt text
- [ ] Unfinished or risky behavior is behind a feature flag
- [ ] Each changed file or function has one reason to change (which single change would force it to be edited again?)
- [ ] Backend: `uv run lint-imports` passes (layers are not crossed)
