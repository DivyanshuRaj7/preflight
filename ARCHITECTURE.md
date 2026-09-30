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
