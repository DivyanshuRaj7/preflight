import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PaddleOcrProvider } from "../src/adapters/ocr/paddleocr.js";
import { PaddleOcrExtractionProvider, type OcrFixtureDocument } from "../src/adapters/extraction/paddle.js";
import type { DocumentType } from "../src/domain/contracts.js";

// OCR harness (TASK-011): runs REAL PaddleOCR over the synthetic document
// fixtures and reports measured properties. No pixel-perfect assertions —
// key-text detection, confidence, bounding boxes, and typed failures.
// Usage: npm run eval:ocr (requires Python + paddleocr, see requirements-ocr.txt).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type DocumentManifest = {
  version: number;
  documents: {
    documentId: string;
    documentType: DocumentType;
    path: string;
    expectedFields: Record<string, string[]>;
    expectedTexts: string[];
  }[];
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

const manifest = JSON.parse(await readFile(path.join(root, "fixtures/documents/manifest.json"), "utf8")) as DocumentManifest;
const documents: Record<string, OcrFixtureDocument> = {};
for (const doc of manifest.documents) {
  documents[doc.documentId] = { documentType: doc.documentType, imagePath: path.join(root, doc.path), expectedFields: doc.expectedFields };
}

const provider = new PaddleOcrExtractionProvider(new PaddleOcrProvider(), documents);
let processed = 0;
let succeeded = 0;
let lowConfidence = 0;
let failed = 0;
const failures: string[] = [];

for (const doc of manifest.documents) {
  const result = await provider.extractDocument({ documentId: doc.documentId, documentType: doc.documentType });
  processed += 1;
  const lines = result.evidence.map((e) => normalize(e.text ?? "")).join("\n");
  const missing = doc.expectedTexts.filter((text) => !lines.includes(normalize(text)));
  const boxes = result.evidence.filter((e) => e.bbox !== undefined).length;
  if (result.status === "SUCCESS" || result.status === "PARTIAL") succeeded += 1;
  if (result.status === "LOW_CONFIDENCE") lowConfidence += 1;
  if (result.status === "FAILED") failed += 1;
  const line = `${result.status} ${doc.documentId}: confidence=${result.confidence.toFixed(3)} ` +
    `fields=${result.fields.length} boxes=${boxes}/${result.evidence.length} ` +
    `keys=${doc.expectedTexts.length - missing.length}/${doc.expectedTexts.length}`;
  if (result.status === "FAILED" || missing.length > 0) {
    failures.push(doc.documentId);
    console.log(`FAIL ${line} missing=[${missing.join("; ")}] error=${result.error?.code ?? "none"}`);
  } else {
    console.log(`PASS ${line}`);
  }
}

console.log(`OCR harness: ${processed} processed, ${succeeded} succeeded-or-partial, ${lowConfidence} low-confidence, ${failed} failed.`);
if (failures.length > 0) {
  console.error(`OCR harness failed for: ${failures.join(", ")}`);
  process.exit(1);
}

// Machine-readable mirror of the numbers printed above, so the evaluation
// console reads measured output instead of restating it. Written only on a
// clean run; evaluation semantics are untouched.
await writeFile(
  path.join(root, "eval/ocr-results.json"),
  `${JSON.stringify(
    {
      generatedBy: "npm run eval:ocr",
      provider: "paddleocr",
      documents: { processed, succeededOrPartial: succeeded, lowConfidence, failed },
      passed: succeeded,
      total: processed,
      failedDocuments: failures,
    },
    null,
    2,
  )}\n`,
);
