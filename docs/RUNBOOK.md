# Preflight Runbook

## Clean start

```bash
npm install
npm run check
npm run test
npm run eval
```

## Development loop

1. Read `AGENTS.md`.
2. Open `TASKS.md` and select exactly the task the human assigned.
3. Read the referenced contract/architecture docs.
4. Implement the smallest change.
5. Run checks.
6. Inspect the diff.
7. Report what changed and stop.

## Demo reset

```bash
npm run demo:reset
```

This must reset only local synthetic state. Never introduce real personal data.

## Debugging rule

When a test fails, fix the smallest causal issue. Do not respond by redesigning unrelated modules.
