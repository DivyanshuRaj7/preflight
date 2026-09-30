# Preflight — The Application Compiler

> Verify before you submit.

![Preflight — Verify before you submit](docs/preflight-hero.svg)

Preflight is a BFWAI/HACK 26 PS-01 MVP: a reliability layer for high-stakes digital applications. It validates a synthetic scholarship application, maps validated applicant data onto a local portal, executes the browser workflow, and independently verifies the resulting state before saving.

[![synthetic data only](https://img.shields.io/badge/data-synthetic--only-informational)](docs/EVALUATION.md)
[![deterministic validation](https://img.shields.io/badge/validation-deterministic-informational)](docs/CONTRACTS.md)
[![no paid AI API](https://img.shields.io/badge/AI%20API-none%20required-informational)](docs/CONTRACTS.md)

## Quick start

```bash
npm install
npm run check
npm run test
npm run eval
npm run build
npm run test:e2e
```

Playwright Chromium may need to be installed once on a fresh clone:

```bash
npx playwright install chromium
```

Then read `TASKS.md`. Do not ask the coding agent to build the entire product at once.

## Project rules

- Synthetic/generated data only.
- AI is used for ambiguity; deterministic code owns correctness and authorization.
- Validation must pass before browser execution.
- BLOCKED applications cannot execute.
- AMBIGUOUS or UNMAPPED required fields cannot execute.
- Browser actions are verified by reading the resulting DOM state.
- Unknown execution states must be verified rather than blindly retried.
- Human approval and synthetic submission are implemented against the local portal only; real-world submission remains out of scope.

## Current MVP

The current vertical slice covers a synthetic scholarship renewal workflow:

1. Synthetic documents are represented through deterministic fixtures.
2. Evidence is assembled into a canonical applicant profile.
3. Deterministic validation detects blocking inconsistencies.
4. A READY profile can inspect the synthetic portal.
5. Portal fields are mapped to canonical fields through the semantic mapping boundary.
6. Playwright fills the mapped fields.
7. Preflight reads the values back from the browser and compares them against expected values.
8. Portal label drift is absorbed by the existing mapper without changing the profile.
9. Save Draft is allowed only after successful verification.
10. The portal's SAVED state is independently verified.
11. A confirmed miss gets exactly one bounded recovery; unknown state escalates instead of retrying.
12. A final review snapshot fingerprints the exact state to be submitted.
13. A human explicitly approves that exact state; any later change voids the approval.
14. Submission is authorized only against a matching approval, then executed in the browser.
15. The SUBMITTED state is independently verified; unknown final state escalates with no blind retry.

Submission exists ONLY against the local synthetic scholarship portal. There is no real government or production submission.

## Core architecture

```text
Synthetic Documents
        ↓
Extraction
        ↓
Canonical Applicant Profile
        ↓
Deterministic Validation
        ↓
   READY / BLOCKED
        ↓
Portal Inspection
        ↓
Semantic Field Mapping
        ↓
Execution Plan
        ↓
Playwright Execution
        ↓
State Verification
   ┌────┼────┐
   ↓    ↓    ↓
EXPECTED  RECOVER  UNKNOWN
   ↓       ↓        ↓
   │    VERIFY    ESCALATE
   └───────┬────────┘
           ↓
         SAVED
           ↓
      FINAL REVIEW
           ↓
   AWAITING APPROVAL
           ↓
    HUMAN APPROVAL
           ↓
   FINGERPRINT CHECK
           ↓
        SUBMIT
           ↓
   FINAL STATE VERIFY
           ↓
       SUBMITTED
           ↓
        VERIFIED
```

Central principle: **AI for ambiguity. Code for correctness.**

Semantic interpretation (what a portal label means) is isolated from deterministic validation, execution authorization, and state verification. A wrong confident interpretation can never silently become a trusted fact.

## Core documents

- `PRD.md` — product requirements and scope.
- `ARCHITECTURE.md` — system boundaries and state model.
- `docs/CONTRACTS.md` — stable domain interfaces and invariants.
- `TASKS.md` — implementation queue and completed milestones.
- `docs/BUILD_PLAN.md` — implementation order.
- `docs/RUNBOOK.md` — repeatable developer workflow.
- `docs/EVALUATION.md` — evaluation methodology and measured results.
- `docs/DEMO.md` — fixed demo sequence.

## Commands

- `npm run check` — TypeScript type checks.
- `npm test` — Vitest unit, integration, and UI tests.
- `npm run eval` — deterministic fixture evaluation.
- `npm run dev` — start the Preflight UI and synthetic portal locally.
- `npm run build` — production build of the frontend into `dist/`.
- `npm run test:e2e` — Playwright browser suite (starts Vite automatically).
- `npm run test:e2e:headed` — same suite in a visible browser for debugging.
- `npm run demo:reset` — reset local synthetic demo state.

## Project structure

```text
src/
├── domain/
│   ├── validation/
│   ├── profile/
│   ├── mapping/
│   ├── execution/
│   └── submission/
├── adapters/
│   ├── extraction/
│   └── browser/
├── portal/
│   └── scholarship/
└── ui/

tests/
├── unit/
├── integration/
├── ui/
└── e2e/

fixtures/
docs/
```

## Human approval boundary

Submission requires explicit human approval tied to the exact reviewed application state.

The approval contains a deterministic fingerprint of the reviewed state — a state integrity check, not cryptographic security. If a submission-relevant value changes after approval, approval becomes invalid. Therefore approved state ≠ current state means submission refused.

## Safety boundaries

Preflight deliberately separates interpretation from correctness-critical decisions.

AI / semantic layer — used for:

- document interpretation
- ambiguous field meaning
- semantic portal-field mapping

Deterministic layer — owns:

- validation
- required-document checks
- identity consistency
- provenance
- execution preconditions
- mapping acceptance/rejection
- expected-vs-observed verification
- submission authorization

Failure handling is deterministic, not autonomous:

- browser actions are not successful merely because Playwright did not throw
- actual portal state is inspected after every action
- known recoverable failures use a bounded recovery policy (exactly one retry)
- unknown state is preserved as uncertainty and escalated, never blindly retried
- required AMBIGUOUS/UNMAPPED mappings cannot execute
- no submission without explicit approval
- approval is bound to the exact reviewed state
- changed state invalidates approval
- submission authorization is deterministic
- final submission state is independently verified
- unknown submission state is escalated rather than blindly retried

The current implementation uses the deterministic baseline mapping and does not require a paid AI API.

## Evaluation

Evaluation uses deterministic synthetic cases. Current fixture evaluation: **8/8 PASS**.

Decision quality is measured over 28 synthetic cases against a documented
naive baseline (`docs/BASELINE.md`, full report in
`docs/EVALUATION_REPORT.md`, machine-readable output in `eval/results.json`):

- Preflight: **28/28 correct** (5 success, 19 block, 3 escalation, 1 recovery)
- False positives: **0** · false negatives (unsafe continuations): **0**
- Unsafe continuations prevented: **23/23**
- Safety probes denied (blocked/unknown/missing/stale/changed/unverified submit attempts): **6/6**
- Reruns produce byte-identical results.

These are results on the current synthetic evaluation set, NOT a general
accuracy claim. Known limitation: uniformly incorrect but internally
consistent evidence may remain undetectable (see the report's senior review).

The final evaluation will measure things such as:

- extraction accuracy
- conflict detection
- missing/invalid document handling
- browser execution success
- verification failures
- recovery behavior
- unsafe submission prevention

Only measured results belong in the final results table. Never present targets as measured results.

## Testing

Current verified state:

- Vitest: 127/127 PASS
- Fixture evaluation: 8/8 PASS
- Production build: PASS
- Playwright E2E: 8/8 PASS

The browser suite currently covers:

- portal smoke test
- clean six-field execution
- portal label drift
- recoverable save failure (one bounded recovery)
- unknown save state (escalation, no retry)
- full approval → submission → verification
- approval invalidation on state change
- unknown submission (single attempt, escalation)
- independent read-back
- SAVED state
- zero Submit interaction

## Failure handling

Preflight records structured execution events so a failed run can explain:

- what action was attempted
- what failed
- what state was observed
- whether recovery was safe
- whether recovery occurred
- why escalation happened

Unknown state results in escalation rather than blind retry. The same
state-verification principle applies to final submission: the Submit action
is not proof of a successful submission. The final browser state must be
observed, and an unknown final state means STOP / ESCALATE.

## AI disclosure

Record the AI models, APIs, coding agents, and AI tools used during the challenge. Current project development includes AI-assisted coding through OpenCode/Muse. Keep this section updated as the build progresses.

## Current status

Implemented:

- deterministic document/extraction boundary
- canonical applicant profile
- deterministic validation
- evidence/provenance handling
- synthetic scholarship portal
- Playwright browser infrastructure
- semantic portal-field mapping
- validated browser execution
- independent read-back verification
- label drift handling
- actual state verification
- bounded recovery
- unknown-state escalation
- structured execution trace
- Save Draft / SAVED verification
- final review snapshot
- human approval
- approval fingerprint
- approval invalidation
- submission authorization
- synthetic submission
- final-state verification
- unknown submission escalation

Next milestone:

- broader failure injection and recovery coverage
- evaluation expansion with measured baselines

## Demo

See [docs/DEMO.md](docs/DEMO.md) for the fixed demo sequence. The demo uses synthetic data and deliberately planted failures.
