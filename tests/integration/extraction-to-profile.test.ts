import { describe, expect, it } from "vitest";
import {
  DeterministicStubExtractionProvider,
  loadStubDocumentsFromFile,
} from "../../src/adapters/extraction/stub.js";
import { assembleApplicantProfile } from "../../src/domain/profile/assemble.js";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import type { DocumentType } from "../../src/domain/contracts.js";

const FIXED_NOW = "2026-09-30T00:00:00.000Z";
const ALL_DOCUMENTS: DocumentType[] = [
  "identity",
  "marksheet",
  "income-certificate",
  "bank-proof",
  "scholarship-application",
];

// fixture document → ExtractionProvider → structured result → profile/domain input.
describe("extraction to profile chain", () => {
  it("turns a clean fixture document into READY domain input", async () => {
    const provider = new DeterministicStubExtractionProvider(
      loadStubDocumentsFromFile("fixtures/extraction/documents.json"),
    );
    const results = await Promise.all(
      ["doc-identity", "doc-marksheet", "doc-income-certificate", "doc-bank-proof", "doc-scholarship-application"].map(
        (documentId) => provider.extractDocument({ documentId }),
      ),
    );
    expect(results.every((r) => r.status === "SUCCESS")).toBe(true);

    const { profile, evidence } = assembleApplicantProfile(results, {
      version: "v1",
      requiredDocumentTypes: ALL_DOCUMENTS,
    });
    expect(profile.name?.value).toBe("Rina Das");
    expect(profile.name?.evidenceIds.length).toBeGreaterThan(0);

    const decision = validateProfile(profile, evidence, FIXED_NOW);
    expect(decision.status).toBe("READY");
  });

  it("carries PARTIAL extraction through without validation in the adapter", async () => {
    const provider = new DeterministicStubExtractionProvider(
      loadStubDocumentsFromFile("fixtures/extraction/documents.json"),
    );
    const result = await provider.extractDocument({ documentId: "doc-marksheet-partial" });
    expect(result.status).toBe("PARTIAL");

    const { profile, evidence } = assembleApplicantProfile([result], {
      version: "v1",
      requiredDocumentTypes: ["marksheet"],
    });
    // The adapter reports what was read; it does not judge completeness.
    expect(profile.name?.value).toBe("Rina Das");
    expect(profile.dateOfBirth).toBeUndefined();
    expect(profile.requiredDocuments["marksheet"]).toBe("present");
    for (const id of profile.name?.evidenceIds ?? []) {
      expect(evidence.map((e) => e.id)).toContain(id);
    }
  });

  it("contributes nothing from FAILED extraction", async () => {
    const provider = new DeterministicStubExtractionProvider(
      loadStubDocumentsFromFile("fixtures/extraction/documents.json"),
    );
    const result = await provider.extractDocument({ documentId: "doc-income-unreadable" });
    expect(result.status).toBe("FAILED");

    const { profile, evidence } = assembleApplicantProfile([result], {
      version: "v1",
      requiredDocumentTypes: ["income-certificate"],
    });
    expect(profile.name).toBeUndefined();
    expect(evidence).toEqual([]);
    expect(profile.requiredDocuments["income-certificate"]).toBe("missing");
  });
});
