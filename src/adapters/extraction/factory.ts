import type { ExtractionProvider } from "../../domain/extraction.js";
import type { OcrProvider } from "../../domain/ocr.js";
import { DeterministicStubExtractionProvider, type StubDocument } from "./stub.js";
import { PaddleOcrExtractionProvider, type OcrFixtureDocument, type PaddleExtractionOptions } from "./paddle.js";
import { PaddleOcrProvider } from "../ocr/paddleocr.js";

// Provider selection (TASK-011). Node-only module: it may reference
// node:fs-backed loaders and the OCR engine, so the browser UI must NOT
// import it (the UI keeps using its own static stub wiring).
// Selection: OCR_PROVIDER=paddleocr, anything else (or unset) → stub.
export type ExtractionProviderKind = "stub" | "paddleocr";

export type ProviderDependencies = {
  stubDocuments: Record<string, StubDocument>;
  ocrDocuments: Record<string, OcrFixtureDocument>;
  ocr?: OcrProvider;
  paddleOptions?: PaddleExtractionOptions;
};

export function providerKindFromEnv(env: NodeJS.ProcessEnv = process.env): ExtractionProviderKind {
  return env.OCR_PROVIDER === "paddleocr" ? "paddleocr" : "stub";
}

export function createExtractionProvider(kind: ExtractionProviderKind, deps: ProviderDependencies): ExtractionProvider {
  if (kind === "paddleocr") {
    if (!deps.ocr) {
      throw new Error("OCR_PROVIDER=paddleocr requires an OcrProvider (pass PaddleOcrProvider explicitly).");
    }
    return new PaddleOcrExtractionProvider(deps.ocr, deps.ocrDocuments, deps.paddleOptions);
  }
  return new DeterministicStubExtractionProvider(deps.stubDocuments);
}

export function createDefaultOcrProvider(): PaddleOcrProvider {
  return new PaddleOcrProvider();
}
