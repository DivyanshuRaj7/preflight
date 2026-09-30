import type { DocumentType } from "../../domain/contracts.js";
import type {
  DocumentInput,
  ExtractionProvider,
  ExtractionResult,
  ExtractedDocumentField,
} from "../../domain/extraction.js";
import type { Evidence } from "../../domain/contracts.js";
import type { OcrLine, OcrProvider } from "../../domain/ocr.js";

// PaddleOCR-backed extraction (TASK-011). Two explicit stages:
//
//  1. OCR (PaddleOCR): "Applicant Name: Rina Das" as positioned text.
//  2. DETERMINISTIC OCR FIXTURE ADAPTER (below): matches known fixture
//     labels ("Full Name:", "Name:") to OCR lines and splits "Label: value".
//
// PaddleOCR itself performs NO semantic field extraction — that distinction
// is load-bearing. The fixture adapter is honest scaffolding for synthetic
// documents, never AI extraction, and the future multimodal layer will
// replace stage 2 while reusing stage 1.

export const PADDLE_EXTRACTION_PROVIDER_NAME = "paddleocr-extraction";

export type OcrFixtureDocument = {
  documentType: DocumentType;
  imagePath: string;
  // Canonical field -> accepted fixture labels (without trailing colon).
  expectedFields: Record<string, string[]>;
};

export function normalizeOcrText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// DETERMINISTIC OCR FIXTURE ADAPTER: full-line "Label: value" parsing
// against the fixture's known labels. No substrings, no guessing.
export function extractFixtureFields(
  documentId: string,
  expectedFields: Record<string, string[]>,
  lines: OcrLine[],
): { fields: ExtractedDocumentField[]; evidence: Evidence[]; missingFields: string[] } {
  const fields: ExtractedDocumentField[] = [];
  const evidence: Evidence[] = [];
  const missingFields: string[] = [];
  for (const [field, labels] of Object.entries(expectedFields)) {
    const wanted = new Set(labels.map((label) => normalizeOcrText(label)));
    const match = lines.find((line) => {
      const colon = line.text.indexOf(":");
      if (colon < 0) return false;
      return wanted.has(normalizeOcrText(line.text.slice(0, colon)));
    });
    if (!match || match.text.slice(match.text.indexOf(":") + 1).trim() === "") {
      missingFields.push(field);
      continue;
    }
    const value = match.text.slice(match.text.indexOf(":") + 1).trim();
    const evidenceId = `ev-${documentId}-${field}`;
    fields.push({ field, value, confidence: match.confidence, evidenceId, page: match.page });
    evidence.push({
      id: evidenceId,
      documentId,
      page: match.page,
      field,
      text: value,
      bbox: match.bbox ?? undefined,
      extractionMethod: "ocr",
      confidence: match.confidence,
    });
  }
  return { fields, evidence, missingFields };
}

export type PaddleExtractionOptions = {
  lowConfidenceThreshold?: number;
};

const DEFAULT_LOW_CONFIDENCE = 0.75;

export class PaddleOcrExtractionProvider implements ExtractionProvider {
  readonly name = PADDLE_EXTRACTION_PROVIDER_NAME;
  private readonly ocr: OcrProvider;
  private readonly documents: Record<string, OcrFixtureDocument>;
  private readonly lowConfidenceThreshold: number;

  constructor(
    ocr: OcrProvider,
    documents: Record<string, OcrFixtureDocument>,
    options: PaddleExtractionOptions = {},
  ) {
    this.ocr = ocr;
    this.documents = documents;
    this.lowConfidenceThreshold = options.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE;
  }

  async extractDocument(input: DocumentInput): Promise<ExtractionResult> {
    const configured = this.documents[input.documentId];
    if (configured === undefined) {
      return {
        documentId: input.documentId,
        documentType: input.documentType ?? "identity",
        status: "FAILED",
        provider: this.name,
        extractionMethod: "synthetic",
        fields: [],
        evidence: [],
        error: { code: "DOCUMENT_UNKNOWN", message: `No OCR fixture configured for ${input.documentId}.` },
        confidence: 0,
      };
    }
    if (input.documentType !== undefined && input.documentType !== configured.documentType) {
      return {
        documentId: input.documentId,
        documentType: configured.documentType,
        status: "FAILED",
        provider: this.name,
        extractionMethod: "synthetic",
        fields: [],
        evidence: [],
        error: { code: "DOCUMENT_TYPE_MISMATCH", message: `Expected ${input.documentType}, fixture holds ${configured.documentType}.` },
        confidence: 0,
      };
    }
    const ocrResult = await this.ocr.recognizeDocument(input.documentId, configured.imagePath);
    if (ocrResult.status === "FAILED") {
      // OCR failure propagates as extraction failure with zero facts.
      return {
        documentId: input.documentId,
        documentType: configured.documentType,
        status: "FAILED",
        provider: this.name,
        extractionMethod: "ocr",
        fields: [],
        evidence: [],
        error: { code: ocrResult.error?.code ?? "OCR_FAILED", message: ocrResult.error?.message ?? "OCR failed." },
        confidence: 0,
      };
    }
    const { fields, evidence, missingFields } = extractFixtureFields(input.documentId, configured.expectedFields, ocrResult.lines);
    if (fields.length === 0) {
      return {
        documentId: input.documentId,
        documentType: configured.documentType,
        status: "FAILED",
        provider: this.name,
        extractionMethod: "ocr",
        fields: [],
        evidence: [],
        error: { code: "OCR_UNREADABLE", message: "No fixture fields could be read from OCR output." },
        confidence: 0,
      };
    }
    const confidence = Math.min(...fields.map((f) => f.confidence));
    if (confidence < this.lowConfidenceThreshold) {
      return {
        documentId: input.documentId,
        documentType: configured.documentType,
        status: "LOW_CONFIDENCE",
        provider: this.name,
        extractionMethod: "ocr",
        fields,
        evidence,
        confidence,
      };
    }
    if (missingFields.length > 0) {
      return {
        documentId: input.documentId,
        documentType: configured.documentType,
        status: "PARTIAL",
        provider: this.name,
        extractionMethod: "ocr",
        fields,
        evidence,
        missingFields,
        confidence,
      };
    }
    return {
      documentId: input.documentId,
      documentType: configured.documentType,
      status: "SUCCESS",
      provider: this.name,
      extractionMethod: "ocr",
      fields,
      evidence,
      confidence,
    };
  }
}
