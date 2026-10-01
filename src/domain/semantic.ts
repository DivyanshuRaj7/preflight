import type { CanonicalField } from "./mapping/contracts.js";
import type { DocumentType } from "./contracts.js";
import type { OcrResult } from "./ocr.js";

// Semantic interpretation contracts (TASK-012). The semantic layer answers
// "what does this OCR text appear to mean?" — candidates with provenance,
// never verdicts. Deterministic validation downstream remains the ONLY
// authority for READY/BLOCKED. Model (or deterministic) output is UNTRUSTED
// DATA until validated against actual OCR evidence by the converter.
//
// AI FOR AMBIGUITY. CODE FOR CORRECTNESS.

// One interpreted candidate. sourceLineIndex points into the OcrResult lines
// array the provider was given; the converter verifies the citation before
// trusting anything. A candidate whose source cannot be found is unsupported.
export type SemanticCandidate = {
  field: CanonicalField | null;
  value: string;
  semanticConfidence: number;
  sourceText: string;
  sourceLineIndex: number;
};

export type SemanticInterpretation = {
  documentId: string;
  documentType?: DocumentType;
  provider: string;
  candidates: SemanticCandidate[];
};

// Boundary for semantic interpretation. Implementations MUST be pure
// text-in/candidates-out: no DOM, no browser, no application state changes,
// no validation verdicts. A deterministic dev provider and any future model
// provider implement this same interface.
export interface SemanticExtractionProvider {
  readonly name: string;
  interpret(
    input: { documentId: string; documentType?: string; imagePath?: string },
    ocr: OcrResult,
  ): Promise<SemanticInterpretation> | SemanticInterpretation;
}

export function isValidCandidateShape(candidate: unknown): candidate is SemanticCandidate {
  if (typeof candidate !== "object" || candidate === null) return false;
  const c = candidate as Record<string, unknown>;
  return (
    (typeof c.field === "string" || c.field === null) &&
    typeof c.value === "string" &&
    typeof c.semanticConfidence === "number" &&
    Number.isFinite(c.semanticConfidence) &&
    typeof c.sourceText === "string" &&
    typeof c.sourceLineIndex === "number" &&
    Number.isInteger(c.sourceLineIndex)
  );
}
