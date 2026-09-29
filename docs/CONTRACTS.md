# Preflight Domain Contracts

These contracts are the stable spine of the MVP. Change them deliberately. Any contract change requires tests and fixture updates.

## 1. Evidence

Every critical extracted fact must point back to source evidence.

```ts
type Evidence = {
  id: string;
  documentId: string;
  page?: number;
  field?: string;
  text?: string;
  bbox?: [number, number, number, number];
  extractionMethod: "ocr" | "multimodal" | "manual" | "synthetic";
  confidence?: number;
};
```

## 2. Applicant profile

```ts
type ApplicantProfile = {
  name?: ExtractedField<string>;
  dateOfBirth?: ExtractedField<string>;
  address?: ExtractedField<string>;
  requiredDocuments: Record<DocumentType, DocumentStatus>;
  version: string;
};
```

## 3. Findings

```ts
type Finding = {
  ruleId: string;
  severity: "critical" | "error" | "warning";
  message: string;
  evidenceIds: string[];
  blocking: boolean;
};
```

## 4. Preflight decision

`READY` means no blocking findings remain. `BLOCKED` means at least one blocking finding exists.

## 5. Approval

```text
PENDING → APPROVED | REJECTED
```

Approval is tied to an exact application/profile version. A material change invalidates approval.

## 6. Portal/submission state

```text
NOT_STARTED → FILLED → AWAITING_APPROVAL → SUBMITTING
                                      ↘ UNKNOWN
                                      ↘ FAILED
SUBMITTING → SUBMITTED → VERIFIED
```

## 7. Submission invariant

A submission may occur only when all three conditions are true:

```text
preflight.status === READY
AND approval.status === APPROVED
AND portalRun.state === AWAITING_APPROVAL
```

Additionally, approval and portalRun must refer to the same
application/profile version as the preflight result:

```text
approval.profileVersion === preflight.profileVersion
AND portalRun.profileVersion === preflight.profileVersion
```

A material profile change invalidates any prior approval or portal run.

This is a domain/server invariant. The UI is never trusted to enforce it.

## 8. AI boundary

AI/model output is untrusted input. AI may extract, classify, interpret ambiguity, or map portal labels. Deterministic domain code decides validity, readiness, approval, and submission permission.

## 9. Extraction contract

The rest of Preflight depends on the `ExtractionProvider` interface, never on a concrete OCR/LLM provider. Future adapters (PaddleOCR, multimodal AI) implement the same interface.

```ts
type ExtractionStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "LOW_CONFIDENCE";

type ExtractionResult = {
  documentId: string;
  documentType: DocumentType;
  status: ExtractionStatus;
  provider: string;
  extractionMethod: ExtractionMethod;
  fields: ExtractedDocumentField[]; // empty when FAILED
  evidence: Evidence[];             // raw provenance, never discarded
  missingFields?: string[];         // set when PARTIAL
  error?: ExtractionError;          // set when FAILED
  confidence: number;               // minimum field confidence, 0 when none
};

interface ExtractionProvider {
  readonly name: string;
  extractDocument(input: DocumentInput): Promise<ExtractionResult>;
}
```

Rules:

- `FAILED` produces no fields: a failed extraction must never become trusted facts.
- `PARTIAL` and `LOW_CONFIDENCE` stay explicit; they are never silently upgraded to `SUCCESS`.
- Every extracted field cites evidence carrying document id, field, page/location when available, extraction method, and confidence.
- Extraction answers "What did we extract?" It never answers "Is the application valid?" Validity, readiness, approval, and submission permission remain deterministic domain decisions.
