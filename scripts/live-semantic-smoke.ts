import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PaddleOcrProvider } from "../src/adapters/ocr/paddleocr.js";
import { OpenRouterSemanticProvider } from "../src/adapters/models/openrouter.js";
import { SemanticExtractionProvider, type SemanticFixtureDocument } from "../src/adapters/extraction/semantic.js";
import { parseSendImageFlag } from "../src/adapters/extraction/factory.js";
import { assembleApplicantProfile } from "../src/domain/profile/assemble.js";
import { validateProfile } from "../src/domain/validation/preflight.js";
import type { DocumentType } from "../src/domain/contracts.js";
import type { CanonicalField } from "../src/domain/mapping/contracts.js";

// Controlled LIVE semantic smoke test (needs OPENROUTER_API_KEY; otherwise
// exits 2 without calling anything). Real chain only:
// PNG → PaddleOCR → OpenRouter candidates → provenance validation →
// ExtractionResult → deterministic validation. Prints metadata and fields —
// never the API key, never chain-of-thought.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.error("Live smoke test not executed because OPENROUTER_API_KEY is unavailable.");
  process.exit(2);
}

type ManifestDoc = { documentId: string; documentType: DocumentType; path: string; expectedFields: Record<string, string[]> };
const manifest = JSON.parse(await readFile(path.join(root, "fixtures/documents/manifest.json"), "utf8")) as {
  documents: ManifestDoc[];
};

const sendImage = parseSendImageFlag(process.env);
const semantic = new OpenRouterSemanticProvider({
  apiKey: process.env.OPENROUTER_API_KEY as string,
  model: process.env.OPENROUTER_MODEL,
  sendImage,
  timeoutMs: 180_000,
});
const ocr = new PaddleOcrProvider();
const documents: Record<string, SemanticFixtureDocument> = {};
for (const doc of manifest.documents) {
  documents[doc.documentId] = {
    documentType: doc.documentType,
    imagePath: path.join(root, doc.path),
    expectedFields: Object.keys(doc.expectedFields) as CanonicalField[],
  };
}
const provider = new SemanticExtractionProvider(ocr, semantic, documents);

console.log(`model=${semanticModelId()} sendImage=${sendImage} imageAttachedPerRequest=${sendImage}`);
function semanticModelId(): string {
  return process.env.OPENROUTER_MODEL ?? "(provider default)";
}

const results = [];
for (const doc of manifest.documents) {
  const started = Date.now();
  const result = await provider.extractDocument({ documentId: doc.documentId, documentType: doc.documentType });
  const latencyMs = Date.now() - started;
  const provenanceOk = result.evidence.every(
    (e) => typeof e.confidence === "number" && (e.bbox === undefined || (Array.isArray(e.bbox) && e.bbox.length === 4)),
  );
  console.log(
    `${doc.documentId}: status=${result.status} latencyMs=${latencyMs} ` +
      `fields=[${result.fields.map((f) => `${f.field}=${f.value} (sem ${f.confidence})`).join("; ")}] ` +
      `ocrConf=[${result.evidence.map((e) => e.confidence).join(",")}] provenanceOk=${provenanceOk}`,
  );
  results.push(result);
}

const { profile, evidence } = assembleApplicantProfile(results, {
  version: "v-live-smoke",
  requiredDocumentTypes: ["identity", "marksheet", "income-certificate", "bank-proof"],
});
const decision = validateProfile(profile, evidence, { referenceDate: "2026-09-30" });
console.log(`validation verdict=${decision.status} issues=[${decision.issues.map((i) => i.ruleId).join(",")}]`);
