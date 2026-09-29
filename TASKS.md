# Preflight — Execution Tasks

## How to use this file
Muse Spark must work on **one unchecked task at a time**. Do not choose the next task itself.

For each task:
1. Read the task and referenced contracts.
2. State the smallest implementation plan.
3. Change only the allowed areas unless a contract requires a coordinated change.
4. Add/update tests and fixtures.
5. Run the required commands.
6. Report pass/fail and stop.
7. Only then should the human move to the next task.

## TASK-001 — Domain contracts + safety invariants
**Status:** READY FOR CHECKPOINT

Scope:
- Define canonical domain types.
- Define READY/BLOCKED preflight decision.
- Define approval and submission states.
- Enforce the server/domain submission invariant.
- Add deterministic scholarship fixture manifest and expected outcomes.

Allowed areas:
- `src/domain/**`
- `fixtures/**`
- `tests/unit/**`
- `tests/eval/**`
- `scripts/run-evaluation.ts`
- `docs/CONTRACTS.md`

Non-goals:
- OCR/model integration
- UI
- Playwright
- database
- authentication

Required checks:
- `npm run check`
- `npm run test`
- `npm run eval`

Checkpoint:
`feat: establish preflight domain contracts`

## TASK-002 — Deterministic extraction adapter + profile assembly
**Status:** TODO

Do not start until TASK-001 is green.

## TASK-003 — Validation engine
**Status:** TODO

## TASK-004 — Preflight UI
**Status:** TODO

## TASK-005 — Synthetic portal
**Status:** TODO

## TASK-006 — Playwright execution + state verification
**Status:** TODO

## TASK-007 — Approval + controlled submission
**Status:** TODO

## TASK-008 — Failure injection + recovery
**Status:** TODO

## TASK-009 — Evaluation expansion + baseline
**Status:** TODO

## TASK-010 — Demo + submission hardening
**Status:** TODO
