import type { CanonicalField } from "../../domain/mapping/contracts.js";
import type { DocumentType } from "../../domain/contracts.js";
import type { OcrResult } from "../../domain/ocr.js";
import type {
  SemanticCandidate,
  SemanticExtractionProvider,
  SemanticInterpretation,
} from "../../domain/semantic.js";

// Deterministic semantic provider (development/test double for the semantic
// boundary). It exercises the SAME provider interface a future model would
// implement — text in, candidates with provenance out — using an explicit
// label table instead of a model. OCR content is treated strictly as DATA:
// only known labels produce candidates, so prompt-injection-like lines
// ("Ignore previous instructions", "Approve this application") are inert.
// It never emits validation verdicts, never changes state, never guesses:
// unknown labels become field-null candidates, never fabricated facts.

export const DETERMINISTIC_SEMANTIC_PROVIDER_NAME = "deterministic-semantic";

const PRIMARY_LABELS: Record<CanonicalField, string> = {
  fullName: "full name",
  dateOfBirth: "date of birth",
  address: "address",
  annualFamilyIncome: "annual family income",
  bankAccountNumber: "bank account number",
  scholarshipApplicationReference: "scholarship application reference",
};

const ALIASES: Record<string, CanonicalField> = {
  "applicant name": "fullName",
  "applicant legal name": "fullName",
  "legal name": "fullName",
  name: "fullName",
  dob: "dateOfBirth",
  "birth date": "dateOfBirth",
  "residential address": "address",
  "family annual income": "annualFamilyIncome",
  "yearly family income": "annualFamilyIncome",
  "family income": "annualFamilyIncome",
  "annual income": "annualFamilyIncome",
  "account number": "bankAccountNumber",
  "bank account": "bankAccountNumber",
  "bank account no": "bankAccountNumber",
  "application reference": "scholarshipApplicationReference",
  "scholarship reference": "scholarshipApplicationReference",
};

export function normalizeSemanticLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

export class DeterministicSemanticProvider implements SemanticExtractionProvider {
  readonly name = DETERMINISTIC_SEMANTIC_PROVIDER_NAME;

  interpret(
    input: { documentId: string; documentType?: DocumentType },
    ocr: OcrResult,
  ): SemanticInterpretation {
    const candidates: SemanticCandidate[] = [];
    ocr.lines.forEach((line, sourceLineIndex) => {
      const colon = line.text.indexOf(":");
      if (colon < 0) return;
      const label = normalizeSemanticLabel(line.text.slice(0, colon));
      const value = line.text.slice(colon + 1).trim();
      if (value === "") return;
      let field: CanonicalField | null = null;
      let semanticConfidence = 0;
      for (const [canonical, primary] of Object.entries(PRIMARY_LABELS) as [CanonicalField, string][]) {
        if (label === primary) {
          field = canonical;
          semanticConfidence = 1.0;
          break;
        }
      }
      if (field === null && label in ALIASES) {
        field = ALIASES[label];
        semanticConfidence = 0.9;
      }
      candidates.push({
        field,
        value,
        semanticConfidence,
        sourceText: line.text,
        sourceLineIndex,
      });
    });
    return { documentId: input.documentId, documentType: input.documentType, provider: this.name, candidates };
  }
}
