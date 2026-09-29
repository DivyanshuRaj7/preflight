import type { DocumentType, Evidence, ExtractionMethod } from "./contracts.js";

// Extraction contract (TASK-002). The rest of Preflight depends on this
// interface, never on a concrete OCR/LLM provider. Future adapters
// (PaddleOCR, multimodal AI) implement ExtractionProvider.
//
// The extraction layer answers "What did we extract?" It MUST NOT answer
// "Is the application valid?" — validity stays in domain validation.

export type ExtractionStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "LOW_CONFIDENCE";

export type DocumentInput = {
  documentId: string;
  // Optional caller expectation. If supplied and it disagrees with the
  // provider's observed document type, extraction FAILS instead of guessing.
  documentType?: DocumentType;
};

export type ExtractedDocumentField = {
  field: string;
  value: string;
  confidence: number;
  evidenceId: string;
  page?: number;
};

export type ExtractionError = {
  code: string;
  message: string;
};

export type ExtractionResult = {
  documentId: string;
  documentType: DocumentType;
  status: ExtractionStatus;
  // Stable provider identifier, e.g. "deterministic-stub".
  provider: string;
  extractionMethod: ExtractionMethod;
  // Trusted-fact candidates. Empty when status is FAILED: a failed
  // extraction MUST NOT produce facts.
  fields: ExtractedDocumentField[];
  // Raw provenance for every extracted field. Never discarded.
  evidence: Evidence[];
  // Present when status is PARTIAL: fields the provider could not read.
  missingFields?: string[];
  // Present when status is FAILED.
  error?: ExtractionError;
  // Aggregate confidence: minimum field confidence, 0 when no fields.
  confidence: number;
};

export interface ExtractionProvider {
  readonly name: string;
  extractDocument(input: DocumentInput): Promise<ExtractionResult>;
}
