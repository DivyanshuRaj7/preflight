import { describe, expect, it } from "vitest";
import {
  PaddleOcrExtractionProvider,
  extractFixtureFields,
  type OcrFixtureDocument,
} from "../../src/adapters/extraction/paddle.js";
import { createExtractionProvider, providerKindFromEnv } from "../../src/adapters/extraction/factory.js";
import type { OcrLine, OcrProvider, OcrResult } from "../../src/domain/ocr.js";
import type { DocumentType } from "../../src/domain/contracts.js";

function line(text: string, confidence = 0.99): OcrLine {
  return { text, confidence, bbox: [10, 20, 300, 50], page: 1 };
}

function ocrProvider(lines: OcrLine[] | null, error?: OcrResult["error"]): OcrProvider {
  return {
    name: "mock-ocr",
    recognizeDocument: async (documentId) =>
      lines === null
        ? { documentId, status: "FAILED", engine: "mock", engineVersion: "0", extractionMethod: "ocr", lines: [], error }
        : { documentId, status: "SUCCESS", engine: "mock", engineVersion: "0", extractionMethod: "ocr", lines },
  };
}

const documents: Record<string, OcrFixtureDocument> = {
  "doc-identity": {
    documentType: "identity",
    imagePath: "fixtures/documents/doc-identity.png",
    expectedFields: { name: ["Full Name", "Name"], dateOfBirth: ["Date of Birth"] },
  },
};

describe("deterministic OCR fixture adapter", () => {
  it("parses Label: value lines without guessing", () => {
    const { fields, evidence, missingFields } = extractFixtureFields("doc-identity", documents["doc-identity"].expectedFields, [
      line("Full Name: Rina Das"),
      line("Date of Birth: 2004-05-17"),
    ]);
    expect(missingFields).toEqual([]);
    expect(fields.map((f) => [f.field, f.value])).toEqual([
      ["name", "Rina Das"],
      ["dateOfBirth", "2004-05-17"],
    ]);
    expect(evidence[0]).toMatchObject({ documentId: "doc-identity", extractionMethod: "ocr", field: "name" });
    expect(evidence[0].bbox).toEqual([10, 20, 300, 50]);
  });

  it("reports missing fields instead of inventing values", () => {
    const { fields, missingFields } = extractFixtureFields("doc-identity", documents["doc-identity"].expectedFields, [
      line("Full Name: Rina Das"),
    ]);
    expect(fields).toHaveLength(1);
    expect(missingFields).toEqual(["dateOfBirth"]);
  });

  it("ignores lines without a recognized label", () => {
    const { fields, missingFields } = extractFixtureFields("doc-identity", documents["doc-identity"].expectedFields, [
      line("Account Holder Name: Someone Else"),
      line("Name: Rina Das"),
      line("Date of Birth: 2004-05-17"),
    ]);
    expect(fields.map((f) => f.value)).toEqual(["Rina Das", "2004-05-17"]);
    expect(missingFields).toEqual([]);
  });
});

describe("paddle extraction provider", () => {
  it("returns SUCCESS with provenance for complete reads", async () => {
    const provider = new PaddleOcrExtractionProvider(ocrProvider([line("Full Name: Rina Das"), line("Date of Birth: 2004-05-17")]), documents);
    const result = await provider.extractDocument({ documentId: "doc-identity", documentType: "identity" });
    expect(result.status).toBe("SUCCESS");
    expect(result.extractionMethod).toBe("ocr");
    expect(result.provider).toBe("paddleocr-extraction");
    expect(result.evidence.every((e) => e.extractionMethod === "ocr" && e.documentId === "doc-identity")).toBe(true);
  });

  it("returns PARTIAL when a fixture field is unreadable", async () => {
    const provider = new PaddleOcrExtractionProvider(ocrProvider([line("Full Name: Rina Das")]), documents);
    const result = await provider.extractDocument({ documentId: "doc-identity" });
    expect(result.status).toBe("PARTIAL");
    expect(result.missingFields).toEqual(["dateOfBirth"]);
  });

  it("produces no facts when OCR fails, preserving the error code", async () => {
    const provider = new PaddleOcrExtractionProvider(
      ocrProvider(null, { code: "OCR_TIMEOUT", message: "timed out" }),
      documents,
    );
    const result = await provider.extractDocument({ documentId: "doc-identity" });
    expect(result.status).toBe("FAILED");
    expect(result.fields).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.error?.code).toBe("OCR_TIMEOUT");
  });

  it("marks LOW_CONFIDENCE explicitly instead of trusting weak reads", async () => {
    const provider = new PaddleOcrExtractionProvider(
      ocrProvider([line("Full Name: Rina Das", 0.42), line("Date of Birth: 2004-05-17", 0.9)]),
      documents,
    );
    const result = await provider.extractDocument({ documentId: "doc-identity" });
    expect(result.status).toBe("LOW_CONFIDENCE");
    expect(result.confidence).toBeCloseTo(0.42);
  });

  it("rejects unknown documents and type mismatches without OCR", async () => {
    let calls = 0;
    const counting: OcrProvider = {
      name: "counting",
      recognizeDocument: async (documentId) => {
        calls += 1;
        return { documentId, status: "SUCCESS", engine: "mock", engineVersion: "0", extractionMethod: "ocr", lines: [] };
      },
    };
    const provider = new PaddleOcrExtractionProvider(counting, documents);
    expect((await provider.extractDocument({ documentId: "doc-nope" })).status).toBe("FAILED");
    expect((await provider.extractDocument({ documentId: "doc-identity", documentType: "marksheet" as DocumentType })).status).toBe("FAILED");
    expect(calls).toBe(0);
  });
});

describe("provider selection", () => {
  const stubDocuments = {
    "doc-identity": {
      documentType: "identity" as DocumentType,
      condition: "ok" as const,
      fields: { name: { text: "Rina Das", confidence: 1 } },
    },
  };
  it("defaults to the deterministic stub", () => {
    expect(providerKindFromEnv({} as NodeJS.ProcessEnv)).toBe("stub");
    const provider = createExtractionProvider("stub", { stubDocuments, ocrDocuments: {} });
    expect(provider.name).toBe("deterministic-stub");
  });

  it("selects paddleocr from the environment and refuses to run without an engine", () => {
    expect(providerKindFromEnv({ OCR_PROVIDER: "paddleocr" } as NodeJS.ProcessEnv)).toBe("paddleocr");
    expect(() => createExtractionProvider("paddleocr", { stubDocuments, ocrDocuments: documents })).toThrow(/requires an OcrProvider/);
  });
});
