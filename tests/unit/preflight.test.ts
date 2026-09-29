import { describe, expect, it } from "vitest";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

const evidence: Evidence[] = [
  { id: "ev-name", documentId: "doc-id", page: 1, field: "name", text: "Rina Das", extractionMethod: "synthetic", confidence: 1 },
  { id: "ev-dob", documentId: "doc-id", page: 1, field: "dateOfBirth", text: "2004-05-17", extractionMethod: "synthetic", confidence: 1 },
  { id: "ev-address", documentId: "doc-bank", page: 1, field: "address", text: "14 Lake Road, Kolkata 700029", extractionMethod: "synthetic", confidence: 1 },
];

const baseProfile: ApplicantProfile = {
  name: { value: "Rina Das", evidenceIds: ["ev-name"], confidence: 1 },
  dateOfBirth: { value: "2004-05-17", evidenceIds: ["ev-dob"], confidence: 1 },
  requiredDocuments: {
    identity: "present",
    marksheet: "present",
    "income-certificate": "present",
    "bank-proof": "present",
    "scholarship-application": "present"
  },
  version: "v1"
};

describe("preflight decision", () => {
  it("returns READY for a clean profile", () => {
    expect(validateProfile(baseProfile, evidence, "2026-09-30T00:00:00.000Z")).toMatchObject({ status: "READY", issues: [] });
  });

  it("blocks missing required documents", () => {
    const result = validateProfile({ ...baseProfile, requiredDocuments: { ...baseProfile.requiredDocuments, "income-certificate": "missing" } }, evidence);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("REQUIRED_DOCUMENT");
  });

  it("blocks expired required documents", () => {
    const result = validateProfile({ ...baseProfile, requiredDocuments: { ...baseProfile.requiredDocuments, "income-certificate": "expired" } }, evidence);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("DOCUMENT_EXPIRY");
  });

  it("blocks critical fields without valid provenance", () => {
    const result = validateProfile({ ...baseProfile, name: { value: "Rina Das", evidenceIds: ["missing-evidence"] } }, evidence);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("EVIDENCE_PROVENANCE");
  });

  it("blocks dateOfBirth without valid provenance", () => {
    const result = validateProfile(
      { ...baseProfile, dateOfBirth: { value: "2004-05-17", evidenceIds: ["missing-evidence"] } },
      evidence,
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("EVIDENCE_PROVENANCE");
  });

  it("blocks address without valid provenance", () => {
    const result = validateProfile(
      { ...baseProfile, address: { value: "14 Lake Road", evidenceIds: ["missing-evidence"] } },
      evidence,
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("EVIDENCE_PROVENANCE");
  });

  it("blocks critical fields with empty evidence lists", () => {
    const result = validateProfile(
      { ...baseProfile, name: { value: "Rina Das", evidenceIds: [] } },
      evidence,
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("EVIDENCE_PROVENANCE");
  });

  it("blocks invalid required documents", () => {
    const result = validateProfile({ ...baseProfile, requiredDocuments: { ...baseProfile.requiredDocuments, "bank-proof": "invalid" } }, evidence);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.map((x) => x.ruleId)).toContain("DOCUMENT_INVALID");
  });

  it("is deterministic and carries the profile version", () => {
    const first = validateProfile(baseProfile, evidence, "2026-09-30T00:00:00.000Z");
    const second = validateProfile(baseProfile, evidence, "2026-09-30T00:00:00.000Z");
    expect(second).toEqual(first);
    expect(first.profileVersion).toBe("v1");
    expect(first.checkedAt).toBe("2026-09-30T00:00:00.000Z");
  });
});
