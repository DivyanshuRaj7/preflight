# Preflight Domain Contracts

These contracts are the stable spine of the MVP. Change them deliberately. Any contract change requires tests and fixture updates.

## 1. Evidence

Every critical extracted fact must point back to source evidence.

```ts
type Evidence = {
  id: string;
  documentId: string;
  documentType?: DocumentType;
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
  remediation: string;
  field?: string;
  evidenceIds: string[];
  blocking: boolean;
};
```

Every finding carries a stable `ruleId`, an explicit severity, a human-readable
message, a `remediation` action, and the evidence ids it was derived from.
Field-scoped findings also set `field`.

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

## 9b. OCR boundary (TASK-011)

Real OCR plugs in below the extraction contract without changing it:

```text
image file → PaddleOcrProvider → OcrResult { lines[] } → fixture adapter → ExtractionResult
```

- `src/domain/ocr.ts` owns the neutral `OcrLine` / `OcrResult` /
  `OcrProvider` types. The domain never imports PaddleOCR.
- `OcrResult` preserves text, per-line confidence, bounding box (or null),
  page, engine name, and engine version. OCR errors are typed
  (`OCR_UNAVAILABLE` / `OCR_TIMEOUT` / `OCR_FAILED` / `OCR_UNREADABLE`).
- `PaddleOcrExtractionProvider` runs OCR, then applies the labeled
  DETERMINISTIC OCR FIXTURE ADAPTER ("Label: value" parsing against the
  fixture manifest). PaddleOCR performs layout/text recognition only —
  semantic field meaning comes from the fixture table, and the future
  multimodal layer will replace that stage.
- Provider selection is explicit: `OCR_PROVIDER=paddleocr`, otherwise the
  deterministic stub. The stub remains the default for fast tests.

## 9c. Semantic interpretation boundary (TASK-012)

`OcrResult` → `SemanticExtractionProvider` → validated `ExtractionResult`.
The semantic layer proposes candidates (`field`, `value`,
`semanticConfidence`, `sourceText`, `sourceLineIndex`); the converter
trusts nothing until each candidate cites an OCR line that actually exists,
verbatim. Malformed output, timeouts, and unavailable providers fail
closed (`SEMANTIC_MALFORMED` / `SEMANTIC_TIMEOUT` / `SEMANTIC_UNAVAILABLE`);
duplicate candidates mean ambiguity and are excluded, never merged;
unsupported fields are ignored, never fabricated. Confidence discipline:
`field.confidence` carries the semantic judgment,
`evidence.confidence` carries the OCR measurement. Extra provider
properties (including any "verdict") are never read — READY/BLOCKED comes
only from deterministic validation. The deterministic development provider
is the default; optional OpenRouter, Google Gemini REST, or Groq direct-API
providers (`SEMANTIC_PROVIDER=openrouter|gemini|groq`, each key-gated,
fetch-only, no SDKs) implement
the same interface for live inference without changing any rule above.
Selection: `EXTRACTION_PROVIDER=semantic` (legacy
`OCR_PROVIDER=paddleocr` still selects the fixture-label adapter).

## 10. Validation engine

`validateProfile(profile, evidence, options)` is a pure deterministic function:
identical input always yields identical status, finding IDs, finding order,
severity, evidence references, remediation, and structure. It never reads the
system clock, generates random values, or touches the network.

```ts
type ValidationOptions = {
  referenceDate?: string;       // YYYY-MM-DD; controls expiry behavior
  checkedAt?: string;           // defaults to the reference date at 00:00 UTC
  validityRequired?: DocumentType[]; // default: ["income-certificate"]
  lowConfidenceThreshold?: number;   // default: 0.75
};
```

Rules, in fixed execution order:

| Order | ruleId | Trigger |
|---|---|---|
| 1 | `EVIDENCE_PROVENANCE` | present critical field cites unknown or empty evidence |
| 2 | `MISSING_REQUIRED_DOCUMENT` | required document status is `missing` |
| 3 | `DOCUMENT_INVALID` | required document status is `invalid` |
| 4 | `DOCUMENT_EXPIRED` | status is `expired`, or validity-required evidence is missing, unparseable, or dated before `referenceDate` |
| 5 | `NAME_MISMATCH` | distinct normalized names across evidence |
| 6 | `DOB_MISMATCH` | distinct birth dates across evidence |
| 7 | `ADDRESS_MISMATCH` | distinct normalized addresses across evidence |
| 8 | `LOW_CONFIDENCE_CRITICAL_FIELD` | present critical field confidence below threshold |

Determinism notes:

- The evaluation date is always supplied explicitly; without `referenceDate`
  the expiry rule is skipped rather than guessed.
- Name/address comparison uses deterministic normalization (trim, collapse
  whitespace, lowercase); dates compare exactly after trimming.
- Unverifiable freshness (missing or unparseable expiry evidence for a
  validity-required document) blocks: uncertainty never becomes success.
- Multiple independent defects each produce a finding; ordering follows the
  table above with sorted evidence references inside each finding.
