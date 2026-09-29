import { readFileSync } from "node:fs";
import { parseStubDocuments, type StubDocument } from "./stub.js";

// Node-only file loading for stub fixtures. Kept out of ./stub.js so the
// provider module stays browser-safe for the React UI. Used by tests and
// scripts; the browser bundles fixture data via static imports instead.
export function loadStubDocumentsFromFile(filePath: string): Record<string, StubDocument> {
  return parseStubDocuments(readFileSync(filePath, "utf8"));
}
