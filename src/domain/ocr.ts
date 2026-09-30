import type { ExtractionMethod } from "./contracts.js";

// Domain-neutral OCR contracts (TASK-011). The domain layer depends on THESE
// types, never on PaddleOCR classes, worker JSON shapes, or Python. OCR
// answers "what text appears where" — it never assigns semantic field
// meaning; that stays in the extraction/mapping layers.

export type OcrStatus = "SUCCESS" | "FAILED";

export type OcrLine = {
  text: string;
  confidence: number;
  bbox: [number, number, number, number] | null;
  page: number;
};

export type OcrError = {
  code: "OCR_UNAVAILABLE" | "OCR_TIMEOUT" | "OCR_FAILED" | "OCR_UNREADABLE";
  message: string;
};

export type OcrResult = {
  documentId: string;
  status: OcrStatus;
  engine: string;
  engineVersion: string;
  extractionMethod: ExtractionMethod;
  lines: OcrLine[];
  error?: OcrError;
};

export interface OcrProvider {
  readonly name: string;
  recognizeDocument(documentId: string, imagePath: string): Promise<OcrResult>;
}
