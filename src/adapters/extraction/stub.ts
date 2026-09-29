import { readFileSync } from "node:fs";
import type { DocumentType } from "../../domain/contracts.js";
import type {
  DocumentInput,
  ExtractionError,
  ExtractionProvider,
  ExtractionResult,
  ExtractionStatus,
} from "../../domain/extraction.js";

// Deterministic synthetic extraction stub (TASK-002). Scenario behavior comes
// from injected fixture configuration, not from hard-coded branches. No
// randomness, no timestamps, no network calls. This stub answers
// "What did we extract?" — it performs no validation.

export const STUB_PROVIDER_NAME = "deterministic-stub";

export type StubCondition = "ok" | "partial" | "failed" | "low-confidence";

export type StubField = {
  text: string;
  confidence: number;
  page?: number;
  bbox?: [number, number, number, number];
};

export type StubDocument = {
  documentType: DocumentType;
  condition: StubCondition;
  fields: Record<string, StubField>;
  missingFields?: string[];
  error?: ExtractionError;
};

export type StubDocumentsFile = {
  version: number;
  documents: Record<string, StubDocument>;
};

export function parseStubDocuments(jsonText: string): Record<string, StubDocument> {
  const parsed = JSON.parse(jsonText) as StubDocumentsFile;
  if (typeof parsed !== "object" || parsed === null || typeof parsed.documents !== "object") {
    throw new Error("Invalid stub documents file: expected { version, documents }");
  }
  return parsed.documents;
}

export function loadStubDocumentsFromFile(filePath: string): Record<string, StubDocument> {
  return parseStubDocuments(readFileSync(filePath, "utf8"));
}

function statusFor(condition: StubCondition): ExtractionStatus {
  switch (condition) {
    case "ok":
      return "SUCCESS";
    case "partial":
      return "PARTIAL";
    case "failed":
      return "FAILED";
    case "low-confidence":
      return "LOW_CONFIDENCE";
  }
}

export class DeterministicStubExtractionProvider implements ExtractionProvider {
  readonly name = STUB_PROVIDER_NAME;
  private readonly documents: Record<string, StubDocument>;

  constructor(documents: Record<string, StubDocument>) {
    this.documents = documents;
  }

  async extractDocument(input: DocumentInput): Promise<ExtractionResult> {
    const stored = this.documents[input.documentId];
    if (stored === undefined) {
      return {
        documentId: input.documentId,
        documentType: input.documentType ?? "identity",
        status: "FAILED",
        provider: this.name,
        extractionMethod: "synthetic",
        fields: [],
        evidence: [],
        error: {
          code: "DOCUMENT_UNKNOWN",
          message: `No stub fixture configured for document ${input.documentId}.`,
        },
        confidence: 0,
      };
    }
    if (input.documentType !== undefined && input.documentType !== stored.documentType) {
      return {
        documentId: input.documentId,
        documentType: stored.documentType,
        status: "FAILED",
        provider: this.name,
        extractionMethod: "synthetic",
        fields: [],
        evidence: [],
        error: {
          code: "DOCUMENT_TYPE_MISMATCH",
          message: `Expected ${input.documentType} but fixture holds ${stored.documentType}.`,
        },
        confidence: 0,
      };
    }

    const status = statusFor(stored.condition);
    if (status === "FAILED") {
      return {
        documentId: input.documentId,
        documentType: stored.documentType,
        status,
        provider: this.name,
        extractionMethod: "synthetic",
        fields: [],
        evidence: [],
        error: stored.error ?? { code: "EXTRACTION_FAILED", message: "Extraction failed." },
        confidence: 0,
      };
    }

    const fields = Object.entries(stored.fields).map(([field, stub]) => ({
      field,
      value: stub.text,
      confidence: stub.confidence,
      evidenceId: `ev-${input.documentId}-${field}`,
      page: stub.page,
    }));
    const evidence = Object.entries(stored.fields).map(([field, stub]) => ({
      id: `ev-${input.documentId}-${field}`,
      documentId: input.documentId,
      page: stub.page,
      field,
      text: stub.text,
      bbox: stub.bbox,
      extractionMethod: "synthetic" as const,
      confidence: stub.confidence,
    }));
    const confidence = fields.length === 0 ? 0 : Math.min(...fields.map((f) => f.confidence));

    return {
      documentId: input.documentId,
      documentType: stored.documentType,
      status,
      provider: this.name,
      extractionMethod: "synthetic",
      fields,
      evidence,
      ...(status === "PARTIAL" ? { missingFields: stored.missingFields ?? [] } : {}),
      confidence,
    };
  }
}
