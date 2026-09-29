import { describe, expect, it } from "vitest";
import {
  DeterministicStubExtractionProvider,
  STUB_PROVIDER_NAME,
} from "../../src/adapters/extraction/stub.js";
import { loadStubDocumentsFromFile } from "../../src/adapters/extraction/stub-files.js";
import { assembleApplicantProfile } from "../../src/domain/profile/assemble.js";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import type { ExtractionProvider, ExtractionResult } from "../../src/domain/extraction.js";

const documents = loadStubDocumentsFromFile("fixtures/extraction/documents.json");
const provider = new DeterministicStubExtractionProvider(documents);

describe("deterministic stub extraction", () => {
  it("produces identical output for identical input", async () => {
    const first = await provider.extractDocument({ documentId: "doc-identity" });
    const second = await provider.extractDocument({ documentId: "doc-identity" });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("preserves document type", async () => {
    const result = await provider.extractDocument({ documentId: "doc-identity" });
    expect(result.documentType).toBe("identity");
    expect(result.status).toBe("SUCCESS");
    expect(result.provider).toBe(STUB_PROVIDER_NAME);
  });

  it("keeps provenance for every extracted fact", async () => {
    const result = await provider.extractDocument({ documentId: "doc-identity" });
    const byId = new Map(result.evidence.map((item) => [item.id, item]));
    expect(result.fields.length).toBeGreaterThan(0);
    for (const field of result.fields) {
      const evidence = byId.get(field.evidenceId);
      expect(evidence).toBeDefined();
      expect(evidence?.documentId).toBe("doc-identity");
      expect(evidence?.field).toBe(field.field);
      expect(evidence?.text).toBe(field.value);
      expect(evidence?.extractionMethod).toBe("synthetic");
      expect(evidence?.confidence).toBe(field.confidence);
    }
  });

  it("preserves confidence, including the aggregate", async () => {
    const result = await provider.extractDocument({ documentId: "doc-identity-faint" });
    expect(result.status).toBe("LOW_CONFIDENCE");
    expect(result.fields).toContainEqual(
      expect.objectContaining({ field: "name", value: "Rina Das", confidence: 0.42 }),
    );
    expect(result.confidence).toBe(0.42);
  });

  it("marks PARTIAL as distinguishable from SUCCESS", async () => {
    const partial = await provider.extractDocument({ documentId: "doc-marksheet-partial" });
    expect(partial.status).toBe("PARTIAL");
    expect(partial.status).not.toBe("SUCCESS");
    expect(partial.missingFields).toContain("dateOfBirth");
    expect(partial.fields.map((f) => f.field)).not.toContain("dateOfBirth");
  });

  it("produces no trusted critical facts on FAILED", async () => {
    const failed = await provider.extractDocument({ documentId: "doc-income-unreadable" });
    expect(failed.status).toBe("FAILED");
    expect(failed.fields).toEqual([]);
    expect(failed.error?.code).toBe("DOCUMENT_UNREADABLE");
    expect(failed.confidence).toBe(0);
  });

  it("fails unknown documents deterministically without facts", async () => {
    const failed = await provider.extractDocument({ documentId: "doc-does-not-exist" });
    expect(failed.status).toBe("FAILED");
    expect(failed.fields).toEqual([]);
    expect(failed.error?.code).toBe("DOCUMENT_UNKNOWN");
  });

  it("represents LOW_CONFIDENCE explicitly with evidence intact", async () => {
    const result = await provider.extractDocument({ documentId: "doc-identity-faint" });
    expect(result.status).toBe("LOW_CONFIDENCE");
    // Low confidence is surfaced, never silently upgraded to SUCCESS.
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBe(result.fields.length);
  });
});

describe("provider replaceability", () => {
  it("accepts a mock provider without changing domain validation code", async () => {
    const mock: ExtractionProvider = {
      name: "mock-provider",
      async extractDocument(input): Promise<ExtractionResult> {
        return {
          documentId: input.documentId,
          documentType: "identity",
          status: "SUCCESS",
          provider: "mock-provider",
          extractionMethod: "manual",
          fields: [{ field: "name", value: "Mock Person", confidence: 0.9, evidenceId: "ev-mock-name" }],
          evidence: [
            {
              id: "ev-mock-name",
              documentId: input.documentId,
              field: "name",
              text: "Mock Person",
              extractionMethod: "manual",
              confidence: 0.9,
            },
          ],
          confidence: 0.9,
        };
      },
    };
    const result = await mock.extractDocument({ documentId: "doc-mock" });
    const { profile, evidence } = assembleApplicantProfile([result], {
      version: "v-mock",
      requiredDocumentTypes: ["identity"],
    });
    expect(profile.name?.value).toBe("Mock Person");
    const decision = validateProfile(profile, evidence, { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" });
    expect(decision.status).toBe("READY");
  });
});
