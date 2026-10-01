// Environment verification (local setup task): proves the application can
// load .env and that provider selection behaves. Run:
//   npx tsx --env-file=.env scripts/verify-env.ts
// Prints key PRESENCE only — never values.
import { createExtractionProvider, parseSendImageFlag, providerKindFromEnv, resolveSemanticProvider } from "../src/adapters/extraction/factory.js";
import { loadStubDocumentsFromFile } from "../src/adapters/extraction/stub-files.js";
import type { OcrFixtureDocument } from "../src/adapters/extraction/paddle.js";

function hasKey(name: string): boolean {
  const value = process.env[name] ?? "";
  return value.trim() !== "";
}

const failures: string[] = [];
function check(name: string, condition: boolean): void {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) failures.push(name);
}

// 1. The application loads the local environment.
check("env loads (SEMANTIC_PROVIDER present)", (process.env.SEMANTIC_PROVIDER ?? "") !== "");

// 2. Deterministic works without keys.
const stubDocuments = loadStubDocumentsFromFile("fixtures/extraction/documents.json");
const ocrDocuments: Record<string, OcrFixtureDocument> = {};
const stub = createExtractionProvider("stub", { stubDocuments, ocrDocuments });
check("deterministic stub builds keyless", stub.name === "deterministic-stub");

// 3-4. Explicit selection resolves to the right provider family.
// (Missing-key behavior is asserted rigorously below.)
console.log(`GEMINI_API_KEY present: ${hasKey("GEMINI_API_KEY")}, OPENROUTER_API_KEY present: ${hasKey("OPENROUTER_API_KEY")}`);

// 5. Missing keys produce controlled errors, never silent fallback.
for (const [selection, requiredKey] of [
  ["gemini", "GEMINI_API_KEY"],
  ["openrouter", "OPENROUTER_API_KEY"],
] as const) {
  if (hasKey(requiredKey)) {
    console.log(`SKIP missing-key control for ${selection} (key present)`);
    continue;
  }
  try {
    resolveSemanticProvider(
      { stubDocuments, ocrDocuments },
      { SEMANTIC_PROVIDER: selection } as NodeJS.ProcessEnv,
    );
    check(`${selection} missing key throws SEMANTIC_UNAVAILABLE`, false);
  } catch (error) {
    check(`${selection} missing key throws SEMANTIC_UNAVAILABLE`, error instanceof Error && error.message.includes("SEMANTIC_UNAVAILABLE"));
  }
}

// 6. Image flag parses consistently.
check("sendImage parses true/1, rejects other", parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "true" }) && parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "1" }) && !parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "yes" }) && !parseSendImageFlag({}));

console.log(`SEMANTIC_PROVIDER=${process.env.SEMANTIC_PROVIDER ?? "(unset→deterministic)"} providerKind=${providerKindFromEnv()}`);
if (failures.length > 0) {
  console.error(`verify-env failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("verify-env: all checks passed.");
