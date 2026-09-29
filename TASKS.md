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
**Status:** DONE

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
**Status:** DONE

Scope:
- Define the stable `ExtractionProvider` contract in domain code.
- Implement `DeterministicStubExtractionProvider` driven by fixture scenario data.
- Support SUCCESS / PARTIAL / FAILED / LOW_CONFIDENCE without silent upgrades.
- Preserve evidence provenance and confidence through extraction.
- Assemble extraction results into profile/domain input without validation policy.
- Cover with unit tests plus an extraction-to-profile integration test.

Non-goals (belong to TASK-003 or later):
- name / DOB mismatch detection, confidence threshold policy,
  missing-document / expiry validation, real OCR/LLM integration, UI,
  portal, Playwright, database, authentication.

Definition of done:
- ExtractionProvider contract exists; stub is deterministic and fixture-driven.
- Provenance and confidence survive extraction; FAILED yields no facts.
- No validation policy lives in extraction.
- `npm run check`, `npm run test`, `npm run eval` are green.

Do not start until TASK-001 is green.

## TASK-003 — Validation engine
**Status:** DONE

Scope:
- Deterministic READY/BLOCKED validation engine over profile + evidence.
- Rules: provenance, missing/invalid/expired documents, evidence-based
  expiry with explicit reference date, name/DOB/address cross-document
  agreement, low-confidence critical fields, combined failures.
- Stable finding IDs with remediation and evidence references.
- Fixture cases CASE-001..CASE-008 with ground-truth expectations.
- Full gating in `npm run eval` (no deferred validation cases).

Non-goals (later tasks):
- UI, portal, Playwright, approval UI, failure injection, real OCR/LLM,
  database, authentication, deployment, MCP.

Definition of done:
- Engine is pure: no clock, randomness, network, or environment dependence.
- All 8 fixture cases evaluate to their expected outcomes.
- Unit, integration, and eval tests cover every rule above.
- Submission authorization invariant remains intact.
- `npm run check`, `npm run test`, `npm run eval` are green.

## TASK-004 — Preflight UI
**Status:** IN PROGRESS (current task)

Scope:
- React + Vite + TypeScript frontend in `src/ui/` (DESIGN.md is the visual
  source of truth).
- Application shell: TopBar, SideNav, StatusHeader, FindingList,
  EvidencePanel, DocumentList, StatusBadge.
- Synthetic case selection (CASE-001..CASE-008) with a Run Preflight action.
- Live domain pipeline in the browser: fixture documents → real
  ExtractionProvider → real assembler → real validation engine.
- Findings, evidence, remediation, and documents rendered verbatim from
  domain output; case switching clears stale state.
- Frontend tests in `tests/ui/`; responsive + accessible per DESIGN.md.

Non-goals (later tasks):
- Playwright, browser automation, synthetic portal, real OCR/LLM,
  authentication, payments, database, deployment, approval/submission
  execution (UI shows READY only; it never submits).

Definition of done:
- All 8 cases render actual domain results; no invented findings.
- `npm run check`, `npm run test`, `npm run eval` are green.
- `npm run dev` serves the UI locally.

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
