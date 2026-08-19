# League scheduler service

This private FastAPI service is the future boundary for OR-Tools CP-SAT scheduling. Milestones 0
and 1 intentionally expose only health and readiness endpoints; schedule authoring and solving
begin in Milestone 3.

From the repository root:

```bash
pnpm scheduler:sync --frozen
pnpm scheduler:test
```

The container is pinned to Python 3.14.7. Local Python 3.14 patch releases are accepted for
development, while CI verifies the exact repository pin.
