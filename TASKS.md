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

## TASK-005 — Synthetic portal + browser layer
**Status:** IN PROGRESS (005A, 005B, 005C DONE; 005D current)

## TASK-005A — Synthetic scholarship portal (target only)
**Status:** DONE

Scope:
- Local synthetic portal at `/portal/scholarship-renewal` in
  `src/portal/scholarship/` (component, pure DRAFT|SAVED state, styles).
- Six labeled fields (Full Name kept for later label-drift work), four
  informational document rows, Save Draft → SAVED, deterministic synthetic
  prefills aligned with existing fixtures (fixtures untouched).
- Semantic labels + stable data-testids for future Playwright; portal
  imports zero Preflight domain logic.
- Tests in `tests/ui/portal.test.tsx`.

Non-goals (TASK-005B+): Playwright, browser agent, semantic mapping,
failure injection, approval, submission, database, auth, network.

Definition of done:
- Route serves locally; DRAFT → SAVED visible in DOM and deterministic.
- `npm run check`, `npm run test`, `npm run eval`, `npm run build` green.

## TASK-005B — Playwright browser layer (smoke only)
**Status:** DONE

Scope:
- `@playwright/test` + Chromium; `playwright.config.ts` (Chromium,
  headless default, webServer auto-starts Vite on port 5220, screenshot
  and trace on failure only).
- One smoke test `tests/e2e/portal-smoke.spec.ts`: real browser opens
  `/portal/scholarship-renewal`, verifies heading, SYNTHETIC indicator,
  and DRAFT; reads Full Name (Rina Das) via accessible label; edits one
  safe field; clicks Save Draft; observes SAVED + Draft saved.
- Scripts: `npm run test:e2e`, `npm run test:e2e:headed`. Fresh-clone
  browser install: `npx playwright install chromium`.

Non-goals (later tasks): agent, mapping, auto-fill, state machine,
failure injection, recovery, approval, submission. No agent logic here.

## TASK-005C — Semantic field mapping (no execution)
**Status:** DONE

Scope:
- `src/domain/mapping/` contracts + deterministic baseline; canonical
  profile schema untouched, portal vocabulary lives in the mapping layer.
- Full-equality normalized matching only (no substrings); explicit alias
  table (Full Name/Applicant Legal Name→fullName, DOB→dateOfBirth,
  Family Income→annualFamilyIncome, Account Number→bankAccountNumber);
  explicit AMBIGUOUS set (bare Reference); unknown → UNMAPPED.
- EXACT 1.0 / ALIAS 0.9 fixed confidence; SemanticMappingProvider
  boundary with DeterministicBaselineProvider as the only runner.
- Tests in `tests/unit/mapping.test.ts` incl. v1/v2 label-drift invariance.

Non-goals (TASK-005D+): filling, execution, recovery, approval,
submission. Mapper has zero Playwright/React/network/LLM dependency
and fills nothing.

## TASK-005D — Validated execution to SAVED (no submission)
**Status:** DONE

Scope:
- `src/domain/execution/` contracts + pure plan/finalize; READY-gated,
  version-bound plans; UNMAPPED/AMBIGUOUS/missing-value refusal; exact
  read-back comparison (COMPLETION ≠ CORRECTNESS).
- `src/adapters/browser/` portal inspection (id/label/type metadata),
  id-based fill/read, save/state primitives, plan runner. Adapter never
  validates, maps, or submits.
- CASE-001 gains income/bank/reference evidence (no expected-output
  change); canonical values resolve from profile + evidence, never
  literals in production code.
- Tests: `tests/unit/execution.test.ts` (BLOCKED/UNMAPPED/AMBIGUOUS/
  mismatch safety), `tests/e2e/application-execution.spec.ts` (real
  six-field fill → verify → SAVED, no Submit).

Non-goals (later tasks): final Submit, approval, recovery, retries,
planning loop, LLM control. Execution stops at SAVED.

## TASK-006 — Failure-aware browser execution
**Status:** DONE

Scope:
- Typed state verifier (EXPECTED_STATE / NOT_REACHED / UNKNOWN) over
  observed DOM text; UNKNOWN never retries, never assumes, never saves.
- Bounded recovery policy: exactly one retry for confirmed misses, then
  escalate. Outcomes RECOVERED / ESCALATED added; BLOCKED/UNMAPPED/
  AMBIGUOUS/mismatch guards preserved.
- Structured execution trace (10 event types) on every run.
- Portal scenario modes via `?scenario=`: label-drift (mapper resolves
  Applicant Legal Name), flaky-save (one miss → recovery → SAVED),
  unknown-save (inconclusive → ESCALATED, single attempt proven).
- Tests: `tests/unit/recovery.test.ts`, `tests/e2e/label-drift.spec.ts`,
  `tests/e2e/save-recovery.spec.ts`.

Non-goals (later tasks): final Submit, approval, planning loop, LLM
control. Execution stops at SAVED.

## TASK-007 — Human approval + synthetic submission
**Status:** IN PROGRESS (current task)

Scope:
- Approval contract (AWAITING_APPROVAL/APPROVED/INVALIDATED), cyrb53 state
  fingerprint, final review snapshot, extended submission authorization
  (READY + VERIFIED/RECOVERED + SAVED + snapshot + fingerprint-bound
  approval, typed denials).
- Portal SUBMITTED + unknown-submit mode; adapter clickSubmit; E2E full
  path, invalidation, and unknown-submission proofs with ordered traces.
- Minimal console approval panel (review, explicit approve, verdict; no
  submit control).

Non-goals (later tasks): real portals, auth, planning loop, LLM control.

## TASK-008 — Failure injection + recovery
**Status:** TODO

## TASK-009 — Evaluation expansion + baseline
**Status:** TODO

## TASK-010 — Demo + submission hardening
**Status:** TODO
