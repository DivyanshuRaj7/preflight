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
