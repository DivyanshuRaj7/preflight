# Preflight — The Application Compiler

> Verify before you submit.

Preflight is a BFWAI/HACK 26 PS-01 MVP: a reliability layer that validates a synthetic scholarship application before a browser agent submits it.

## Quick start

```bash
npm install
npm run check
npm run test
npm run eval
```

Then read `TASKS.md`. Do not ask the coding agent to build the entire product at once.

## Project rules
- Synthetic/generated data only.
- AI is used for ambiguity; deterministic code owns correctness and authorization.
- Submission requires explicit human approval tied to the exact reviewed state.
- Unknown execution state is verified, never blindly retried.

## Core documents
- `PRD.md` — what we are building.
- `ARCHITECTURE.md` — boundaries and state model.
- `docs/CONTRACTS.md` — stable domain interfaces and invariants.
- `TASKS.md` — execution queue for the coding agent.
- `docs/BUILD_PLAN.md` — implementation order.
- `docs/RUNBOOK.md` — repeatable developer workflow.
- `docs/EVALUATION.md` — measured evaluation only.
- `docs/DEMO.md` — fixed demo sequence.

## Commands
- `npm run check` — TypeScript checks.
- `npm run test` — unit/integration tests.
- `npm run eval` — fixture evaluation.
- `npm run demo:reset` — reset local synthetic demo state.

## AI disclosure
Record every model, API, coding agent, and AI tool used during the challenge.

## Evaluation
Only measured results belong in the final results table. Never invent accuracy or recovery numbers.
