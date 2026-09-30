# Preflight — Architecture

## System flow

```text
USER GOAL + SYNTHETIC DOCUMENTS
          ↓
DOCUMENT INGESTION
          ↓
OCR / MULTIMODAL EXTRACTION (adapter)
          ↓
EVIDENCE
          ↓
CANONICAL APPLICANT PROFILE
          ↓
DETERMINISTIC VALIDATION (domain)
     ┌────┴────┐
 BLOCKED      READY
     ↓           ↓
 USER FIX     PORTAL EXECUTION
     ↓           ↓
 REVALIDATE   STATE VERIFICATION
                 ↓
          AWAITING_APPROVAL
                 ↓
          HUMAN APPROVAL GATE
                 ↓
              SUBMIT
                 ↓
          VERIFY FINAL STATE
```

## Repository boundaries

```text
src/
  domain/          # pure business rules and safety invariants
  adapters/        # replaceable external integrations
  portal/          # local synthetic scholarship portal
  ui/              # presentation only
fixtures/          # deterministic synthetic inputs + expected outcomes
tests/             # unit, integration, e2e, evaluation
scripts/           # reproducible developer/demo commands
docs/              # contracts, build plan, runbook, evaluation, demo
.opencode/         # coding-agent guidance
```

## Hard boundary

```text
AI / OCR → evidence → deterministic domain decision → controlled browser execution
```

No LLM response may directly authorize a submission.

## State model

```text
DRAFT → EXTRACTED → VALIDATING
  → BLOCKED → USER_FIX → VALIDATING
  → READY → EXECUTING → VERIFYING
  → AWAITING_APPROVAL → APPROVED → SUBMITTING
  → SUBMITTED → VERIFIED

VERIFYING may also lead to RECOVER / ESCALATE.
Submission uncertainty is UNKNOWN until verified.
```

## Provider abstraction

```ts
interface MultimodalProvider {
  extractDocument(input: DocumentInput): Promise<ExtractionResult>;
  interpretPortalField(input: PortalFieldInput): Promise<PortalMapping>;
}
```

## Failure injection

Use one typed local-only scenario:

```ts
type DemoScenario =
  | "clean"
  | "name-mismatch"
  | "portal-label-change"
  | "submit-timeout";
```

Document defects belong to fixtures. Portal label drift and submit timeout belong to the synthetic portal.

## Browser execution layer

Playwright is the browser execution layer. TASK-005B establishes browser
connectivity only: a real Chromium opens the synthetic portal and proves
read → interact → verify through accessible semantics. Intelligent
field mapping and controlled execution are intentionally implemented in
later tasks, never in the smoke test.

```text
Playwright
    ↓
Portal observation
    ↓
PortalField[]
    ↓
Semantic Mapping (deterministic baseline; AI provider later)
    ↓
FieldMapping[]
    ↓
Execution (later task)
```

### Browser Execution Boundary (TASK-005D)

Execution moves an already-READY application into the synthetic portal and
stops at SAVED. Final submission, approval, recovery, and retries are
intentionally later work.

```text
READY validation result
    ↓
Browser Inspection (adapter reports id/label/type, never meaning)
    ↓
PortalField[]
    ↓
Semantic Mapping (existing deterministic baseline)
    ↓
FieldMapping[] + canonical values (profile identity facts, evidence amounts)
    ↓
Execution Plan (refused unless READY, version-bound, fully MATCHED, valued)
    ↓
Playwright fill by stable id (no semantic re-derivation, no coordinates)
    ↓
Independent DOM read-back vs plan (COMPLETION ≠ CORRECTNESS)
    ↓
Save Draft only when every read-back matches, then verify SAVED
```

Rules: BLOCKED preflight refuses before any browser interaction;
UNMAPPED/AMBIGUOUS required fields and missing values refuse before any
fill; any read-back mismatch forbids Save Draft with expected vs observed;
the adapter never validates, never maps, and never submits.

### Failure-Aware Execution (TASK-006)

Playwright actions are never trusted on their own: every action is followed
by an observation of actual browser state, classified by a typed verifier.

```text
ACTION → OBSERVE ACTUAL STATE → KNOWN SUCCESS? → continue
                             → confirmed NOT_REACHED → one bounded recovery → verify again
                             → UNKNOWN → STOP / ESCALATE (never retry)
```

- `verifyPortalState` distinguishes EXPECTED_STATE / NOT_REACHED / UNKNOWN
  from observed DOM text. Only the previously-known safe state counts as a
  confirmed miss; anything else is inconclusive.
- `decideRecoveryPolicy` allows exactly one recovery (`MAX_RECOVERY_ATTEMPTS
  = 1`) for confirmed misses. UNKNOWN always escalates — uncertainty never
  retries, never assumes success, never assumes failure, never continues to
  Save Draft.
- Every run emits a structured `ExecutionEvent` trace (started, inspected,
  attempted, failed, verified, recovery started/completed, escalated,
  completed) answering WHAT happened, WHY, WHAT was observed, and WHAT
  Preflight did next.
- Deterministic portal scenario modes (`?scenario=label-drift`,
  `flaky-save`, `unknown-save`) exercise drift tolerance, single recovery,
  and stop-on-unknown without randomness or network.

### Uncertainty Boundary (reliability milestone)

Architectural decision, justified: UNCERTAIN lives in the
`src/domain/safety/` decision envelope, NOT in the main lifecycle state
machine. Five layers already terminate uncertainty in dedicated states
(BLOCKED; AMBIGUOUS/UNMAPPED; ESCALATED + UNKNOWN_STATE; INVALIDATED;
UNKNOWN verdicts), and AGENTS.md already mandates uncertainty → BLOCKED /
NEEDS_REVIEW / UNKNOWN. A parallel global UNCERTAIN state would fork the
submission invariant, the UI, the eval harness, and 100+ tests for zero new
information — while creating two sources of truth.

Instead `SafetyDecision` names uncertainty explicitly (`CERTAIN` |
`UNCERTAIN`), carries full provenance (verdict, reason, evidenceIds,
detector, rule), and resolves structurally ONLY to existing non-success
terminals. The constructor throws on any other target, so UNCERTAIN can
never become READY, APPROVED, SUBMITTING, or any success state — enforced
by code, not convention. Translators render existing preflight, mapping,
execution, and approval outcomes into this uniform envelope without
changing their behavior. See `docs/FAILURE_TAXONOMY.md` and
`docs/FAILURE_COVERAGE.md`.

### Human Approval + Synthetic Submission (TASK-007)

```text
SAVED
  ↓
FINAL REVIEW (snapshot + fingerprint of exact submitted values)
  ↓
AWAITING_APPROVAL (submission blocked until explicit human approval)
  ↓
APPROVED (record bound to the reviewed fingerprint)
  ↓
SUBMITTING (authorized click only)
  ↓
SUBMITTED (observed portal state)
  ↓
FINAL STATE VERIFICATION → VERIFIED
```

Rules: no path SAVED → SUBMITTING without explicit approval tied to the
exact reviewed state — enforced in deterministic domain code, never by UI
visibility. Any submission-relevant change produces a new fingerprint and
voids prior approval (INVALIDATED). Unknown final state stops and escalates;
Submit is never retried blindly. The synthetic portal exposes SUBMITTED (and
an `unknown-submit` stuck mode); it knows nothing of approvals or fingerprints.
