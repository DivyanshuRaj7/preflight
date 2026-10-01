import type { CanonicalField } from "../../domain/mapping/contracts.js";
import type { DocumentType, Evidence } from "../../domain/contracts.js";
import type {
  DocumentInput,
  ExtractionProvider,
  ExtractionResult,
  ExtractedDocumentField,
} from "../../domain/extraction.js";
import type { OcrProvider } from "../../domain/ocr.js";
import { isValidCandidateShape, type SemanticExtractionProvider as SemanticProviderPort } from "../../domain/semantic.js";

// Semantic extraction converter (TASK-012). Pipeline: OCR lines → semantic
// candidates → VALIDATED ExtractionResult. The converter distrusts the
// semantic layer by construction:
// - every candidate must cite an OCR line that actually exists, verbatim;
// - malformed provider output fails the whole result (SEMANTIC_MALFORMED);
// - duplicate candidates for one field mean ambiguity: excluded, never merged;
// - low semantic confidence excludes (PARTIAL), it never silently passes;
// - unknown/unsupported fields are ignored, never fabricated;
// - extra provider properties (e.g. a "verdict") are never read — the
//   converter only touches the typed candidate fields above.
// Confidence discipline: field.confidence carries the SEMANTIC judgment,
// evidence.confidence carries the OCR measurement. Never conflated.

export const SEMANTIC_EXTRACTION_PROVIDER_NAME = "semantic-extraction";

export type SemanticFixtureDocument = {
  documentType: DocumentType;
  imagePath: string;
  expectedFields: CanonicalField[];
};

export type SemanticExtractionOptions = {
  lowConfidenceThreshold?: number;
  minSemanticConfidence?: number;
  semanticTimeoutMs?: number;
};

const DEFAULT_LOW_CONFIDENCE = 0.75;
const DEFAULT_MIN_SEMANTIC_CONFIDENCE = 0.5;
const DEFAULT_SEMANTIC_TIMEOUT_MS = 30_000;

export class SemanticExtractionProvider implements ExtractionProvider {
  readonly name = SEMANTIC_EXTRACTION_PROVIDER_NAME;
  private readonly ocr: OcrProvider;
  private readonly semantic: SemanticProviderPort;
  private readonly documents: Record<string, SemanticFixtureDocument>;
  private readonly lowConfidenceThreshold: number;
  private readonly minSemanticConfidence: number;
  private readonly semanticTimeoutMs: number;

  constructor(
    ocr: OcrProvider,
    semantic: SemanticProviderPort,
    documents: Record<string, SemanticFixtureDocument>,
    options: SemanticExtractionOptions = {},
  ) {
    this.ocr = ocr;
    this.semantic = semantic;
    this.documents = documents;
    this.lowConfidenceThreshold = options.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE;
    this.minSemanticConfidence = options.minSemanticConfidence ?? DEFAULT_MIN_SEMANTIC_CONFIDENCE;
    this.semanticTimeoutMs = options.semanticTimeoutMs ?? DEFAULT_SEMANTIC_TIMEOUT_MS;
  }

  async extractDocument(input: DocumentInput): Promise<ExtractionResult> {
    const configured = this.documents[input.documentId];
    if (configured === undefined) {
      return this.failed(input.documentId, input.documentType ?? "identity", "synthetic", "DOCUMENT_UNKNOWN", `No semantic fixture configured for ${input.documentId}.`);
    }
    if (input.documentType !== undefined && input.documentType !== configured.documentType) {
      return this.failed(input.documentId, configured.documentType, "synthetic", "DOCUMENT_TYPE_MISMATCH", `Expected ${input.documentType}, fixture holds ${configured.documentType}.`);
    }
    const ocrResult = await this.ocr.recognizeDocument(input.documentId, configured.imagePath);
    if (ocrResult.status === "FAILED") {
      return this.failed(input.documentId, configured.documentType, "ocr", ocrResult.error?.code ?? "OCR_FAILED", ocrResult.error?.message ?? "OCR failed.");
    }

    let interpretation;
    try {
      interpretation = await this.withTimeout(
        this.semantic.interpret({ documentId: input.documentId, documentType: configured.documentType }, ocrResult),
      );
    } catch (error) {
      const code = error instanceof Error && error.message === "SEMANTIC_TIMEOUT" ? "SEMANTIC_TIMEOUT" : "SEMANTIC_UNAVAILABLE";
      return this.failed(input.documentId, configured.documentType, "ocr", code, error instanceof Error ? error.message : "Semantic provider failed.");
    }
    if (!interpretation || !Array.isArray(interpretation.candidates) || !interpretation.candidates.every(isValidCandidateShape)) {
      return this.failed(input.documentId, configured.documentType, "ocr", "SEMANTIC_MALFORMED", "Semantic provider returned malformed output.");
    }

    const fields: ExtractedDocumentField[] = [];
    const evidence: Evidence[] = [];
    const missingFields: string[] = [];
    for (const expected of configured.expectedFields) {
      const valid = interpretation.candidates.filter(
        (c) =>
          c.field === expected &&
          c.value.trim() !== "" &&
          c.semanticConfidence >= this.minSemanticConfidence &&
          c.semanticConfidence <= 1 &&
          ocrResult.lines[c.sourceLineIndex]?.text === c.sourceText,
      );
      // Duplicate valid candidates for one field = ambiguity: exclude all of
      // them rather than merging or picking a winner.
      if (valid.length !== 1) {
        missingFields.push(expected);
        continue;
      }
      const candidate = valid[0];
      const source = ocrResult.lines[candidate.sourceLineIndex];
      const evidenceId = `ev-${input.documentId}-${expected}`;
      fields.push({ field: expected, value: candidate.value, confidence: candidate.semanticConfidence, evidenceId, page: source.page });
      evidence.push({
        id: evidenceId,
        documentId: input.documentId,
        page: source.page,
        field: expected,
        text: candidate.value,
        bbox: source.bbox ?? undefined,
        extractionMethod: "ocr",
        confidence: source.confidence,
      });
    }

    if (fields.length === 0) {
      return this.failed(input.documentId, configured.documentType, "ocr", "SEMANTIC_NO_FIELDS", "No expected field had a valid supported candidate.");
    }
    const confidence = Math.min(...fields.map((f) => f.confidence));
    if (confidence < this.lowConfidenceThreshold) {
      return this.result(input.documentId, configured.documentType, "LOW_CONFIDENCE", fields, evidence, confidence);
    }
    if (missingFields.length > 0) {
      return this.result(input.documentId, configured.documentType, "PARTIAL", fields, evidence, confidence, missingFields);
    }
    return this.result(input.documentId, configured.documentType, "SUCCESS", fields, evidence, confidence);
  }

  private withTimeout<T>(work: Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("SEMANTIC_TIMEOUT")), this.semanticTimeoutMs);
      Promise.resolve(work).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error("Semantic provider failed."));
        },
      );
    });
  }

  private failed(
    documentId: string,
    documentType: DocumentType,
    method: "synthetic" | "ocr",
    code: string,
    message: string,
  ): ExtractionResult {
    return {
      documentId,
      documentType,
      status: "FAILED",
      provider: this.name,
      extractionMethod: method,
      fields: [],
      evidence: [],
      error: { code, message },
      confidence: 0,
    };
  }

  private result(
    documentId: string,
    documentType: DocumentType,
    status: "SUCCESS" | "PARTIAL" | "LOW_CONFIDENCE",
    fields: ExtractedDocumentField[],
    evidence: Evidence[],
    confidence: number,
    missingFields?: string[],
  ): ExtractionResult {
    return {
      documentId,
      documentType,
      status,
      provider: this.name,
      extractionMethod: "ocr",
      fields,
      evidence,
      ...(missingFields !== undefined ? { missingFields } : {}),
      confidence,
    };
  }
}
