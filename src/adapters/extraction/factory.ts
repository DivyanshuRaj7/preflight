import type { ExtractionProvider } from "../../domain/extraction.js";
import type { OcrProvider } from "../../domain/ocr.js";
import type { SemanticExtractionProvider } from "../../domain/semantic.js";
import { DeterministicStubExtractionProvider, type StubDocument } from "./stub.js";
import { PaddleOcrExtractionProvider, type OcrFixtureDocument, type PaddleExtractionOptions } from "./paddle.js";
import { SemanticExtractionProvider as SemanticConverter, type SemanticFixtureDocument, type SemanticExtractionOptions } from "./semantic.js";
import { DeterministicSemanticProvider } from "../models/deterministic.js";
import { createGeminiSemanticProvider } from "../models/gemini.js";
import { createGroqSemanticProvider } from "../models/groq.js";
import { createOpenRouterSemanticProvider } from "../models/openrouter.js";
import { PaddleOcrProvider } from "../ocr/paddleocr.js";

// Provider selection (TASK-011, extended TASK-012). Node-only module: it may
// reference node:fs-backed loaders and the OCR engine, so the browser UI must
// NOT import it (the UI keeps using its own static stub wiring).
// Selection: EXTRACTION_PROVIDER=semantic | paddleocr | stub (default stub).
// The legacy OCR_PROVIDER=paddleocr is honored when EXTRACTION_PROVIDER is
// unset. The fixture provider always survives for deterministic tests.
export type ExtractionProviderKind = "stub" | "paddleocr" | "semantic";

export type ProviderDependencies = {
  stubDocuments: Record<string, StubDocument>;
  ocrDocuments: Record<string, OcrFixtureDocument>;
  semanticDocuments?: Record<string, SemanticFixtureDocument>;
  ocr?: OcrProvider;
  semantic?: SemanticExtractionProvider;
  paddleOptions?: PaddleExtractionOptions;
  semanticOptions?: SemanticExtractionOptions;
};

// SEMANTIC_SEND_IMAGE is honored by BOTH live providers identically:
// "true"/"1" (case-insensitive) enables image attach, anything else disables.
export function parseSendImageFlag(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.SEMANTIC_SEND_IMAGE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

// Resolves the semantic interpreter for kind "semantic": an explicitly
// injected provider wins; otherwise SEMANTIC_PROVIDER=openrouter|gemini
// builds the live provider (throws SEMANTIC_UNAVAILABLE without a key),
// and anything else — including unset — stays deterministic. Never silent
// fallback.
export function resolveSemanticProvider(
  deps: ProviderDependencies,
  env: NodeJS.ProcessEnv = process.env,
): SemanticExtractionProvider {
  if (deps.semantic) return deps.semantic;
  const sendImage = parseSendImageFlag(env);
  if (env.SEMANTIC_PROVIDER === "openrouter") return createOpenRouterSemanticProvider(env, { sendImage });
  if (env.SEMANTIC_PROVIDER === "gemini") return createGeminiSemanticProvider(env, { sendImage });
  if (env.SEMANTIC_PROVIDER === "groq") return createGroqSemanticProvider(env, { sendImage });
  return new DeterministicSemanticProvider();
  return new DeterministicSemanticProvider();
}

export function providerKindFromEnv(env: NodeJS.ProcessEnv = process.env): ExtractionProviderKind {
  if (env.EXTRACTION_PROVIDER === "semantic" || env.EXTRACTION_PROVIDER === "paddleocr" || env.EXTRACTION_PROVIDER === "stub") {
    return env.EXTRACTION_PROVIDER;
  }
  return env.OCR_PROVIDER === "paddleocr" ? "paddleocr" : "stub";
}

export function createExtractionProvider(kind: ExtractionProviderKind, deps: ProviderDependencies): ExtractionProvider {
  if (kind === "paddleocr") {
    if (!deps.ocr) {
      throw new Error("paddleocr extraction requires an OcrProvider (pass PaddleOcrProvider explicitly).");
    }
    return new PaddleOcrExtractionProvider(deps.ocr, deps.ocrDocuments, deps.paddleOptions);
  }
  if (kind === "semantic") {
    if (!deps.ocr || !deps.semanticDocuments) {
      throw new Error("semantic extraction requires an OcrProvider and semantic fixture documents.");
    }
    return new SemanticConverter(deps.ocr, resolveSemanticProvider(deps), deps.semanticDocuments, deps.semanticOptions);
  }
  return new DeterministicStubExtractionProvider(deps.stubDocuments);
}

export function createDefaultOcrProvider(): PaddleOcrProvider {
  return new PaddleOcrProvider();
}
