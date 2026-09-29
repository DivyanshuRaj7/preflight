import { describe, expect, it } from "vitest";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

const OPTIONS = { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" };

const evidence: Evidence[] = [
  { id: "ev-name", documentId: "doc-id", documentType: "identity", page: 1, field: "name", text: "Rina Das", extractionMethod: "synthetic", confidence: 1 },
  { id: "ev-dob", documentId: "doc-id", documentType: "identity", page: 1, field: "dateOfBirth", text: "2004-05-17", extractionMethod: "synthetic", confidence: 1 },
  { id: "ev-address", documentId: "doc-bank", documentType: "bank-proof", page: 1, field: "address", text: "14 Lake Road, Kolkata 700029", extractionMethod: "synthetic", confidence: 1 },
  { id: "ev-income-expiry", documentId: "doc-income", documentType: "income-certificate", page: 1, field: "expiryDate", text: "2027-03-31", extractionMethod: "synthetic", confidence: 1 },
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

const ruleIds = (result: ReturnType<typeof validateProfile>) => result.issues.map((x) => x.ruleId);

describe("preflight decision", () => {
  it("returns READY for a clean profile", () => {
    expect(validateProfile(baseProfile, evidence, OPTIONS)).toMatchObject({ status: "READY", issues: [] });
  });

  it("blocks missing required documents", () => {
    const result = validateProfile({ ...baseProfile, requiredDocuments: { ...baseProfile.requiredDocuments, "income-certificate": "missing" } }, evidence, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("MISSING_REQUIRED_DOCUMENT");
  });

  it("blocks invalid required documents", () => {
    const result = validateProfile({ ...baseProfile, requiredDocuments: { ...baseProfile.requiredDocuments, "bank-proof": "invalid" } }, evidence, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("DOCUMENT_INVALID");
  });

  it("blocks expired document status", () => {
    const result = validateProfile({ ...baseProfile, requiredDocuments: { ...baseProfile.requiredDocuments, "income-certificate": "expired" } }, evidence, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("DOCUMENT_EXPIRED");
  });

  it("blocks expired validity evidence", () => {
    const expired = evidence.map((e) => (e.id === "ev-income-expiry" ? { ...e, text: "2024-03-31" } : e));
    const result = validateProfile(baseProfile, expired, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    const finding = result.issues.find((x) => x.ruleId === "DOCUMENT_EXPIRED");
    expect(finding?.evidenceIds).toEqual(["ev-income-expiry"]);
  });

  it("blocks validity-required documents without verifiable expiry", () => {
    const result = validateProfile(baseProfile, evidence.filter((e) => e.id !== "ev-income-expiry"), OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("DOCUMENT_EXPIRED");
  });

  it("blocks unverifiable expiry values", () => {
    const bad = evidence.map((e) => (e.id === "ev-income-expiry" ? { ...e, text: "March 2027" } : e));
    const result = validateProfile(baseProfile, bad, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("DOCUMENT_EXPIRED");
  });

  it("lets the supplied reference date control expiry behavior", () => {
    const past = validateProfile(baseProfile, evidence, { ...OPTIONS, referenceDate: "2028-01-01" });
    expect(past.status).toBe("BLOCKED");
    expect(ruleIds(past)).toContain("DOCUMENT_EXPIRED");
    const future = validateProfile(baseProfile, evidence, { ...OPTIONS, referenceDate: "2026-09-30" });
    expect(future.status).toBe("READY");
  });

  it("blocks name mismatch across documents", () => {
    const conflict = [...evidence, { ...evidence[0], id: "ev-bank-name", documentId: "doc-bank", documentType: "bank-proof" as const, text: "Rina Dey" }];
    const result = validateProfile(baseProfile, conflict, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    const finding = result.issues.find((x) => x.ruleId === "NAME_MISMATCH");
    expect(finding?.evidenceIds).toEqual(["ev-bank-name", "ev-name"]);
    expect(finding?.field).toBe("name");
  });

  it("blocks date-of-birth mismatch across documents", () => {
    const conflict = [...evidence, { ...evidence[1], id: "ev-mark-dob", documentId: "doc-mark", documentType: "marksheet" as const, text: "2005-05-17" }];
    const result = validateProfile(baseProfile, conflict, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("DOB_MISMATCH");
  });

  it("blocks address mismatch across documents", () => {
    const conflict = [...evidence, { ...evidence[2], id: "ev-app-address", documentId: "doc-app", documentType: "scholarship-application" as const, text: "9 Park Street, Kolkata 700016" }];
    const result = validateProfile(
      { ...baseProfile, address: { value: "14 Lake Road", evidenceIds: ["ev-address", "ev-app-address"] } },
      conflict,
      OPTIONS,
    );
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("ADDRESS_MISMATCH");
  });

  it("blocks low-confidence critical fields without discarding evidence", () => {
    const result = validateProfile(
      { ...baseProfile, name: { value: "Rina Das", evidenceIds: ["ev-name"], confidence: 0.42 } },
      evidence,
      OPTIONS,
    );
    expect(result.status).toBe("BLOCKED");
    const finding = result.issues.find((x) => x.ruleId === "LOW_CONFIDENCE_CRITICAL_FIELD");
    expect(finding?.evidenceIds).toEqual(["ev-name"]);
    expect(finding?.field).toBe("name");
  });

  it("blocks critical fields without valid provenance", () => {
    const result = validateProfile({ ...baseProfile, name: { value: "Rina Das", evidenceIds: ["missing-evidence"] } }, evidence, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toContain("EVIDENCE_PROVENANCE");
  });

  it("returns every independent finding in stable order", () => {
    const profile: ApplicantProfile = {
      ...baseProfile,
      name: { value: "Rina Das", evidenceIds: ["ev-name", "ev-bank-name"] },
      requiredDocuments: { ...baseProfile.requiredDocuments, "income-certificate": "missing" },
    };
    const conflict = [...evidence.filter((e) => e.id !== "ev-income-expiry"), { ...evidence[0], id: "ev-bank-name", documentId: "doc-bank", documentType: "bank-proof" as const, text: "Rina Dey" }];
    const result = validateProfile(profile, conflict, OPTIONS);
    expect(result.status).toBe("BLOCKED");
    expect(ruleIds(result)).toEqual(["MISSING_REQUIRED_DOCUMENT", "NAME_MISMATCH"]);
  });

  it("gives every finding stable ids, remediation, and traceable evidence", () => {
    const profile: ApplicantProfile = {
      ...baseProfile,
      name: { value: "Rina Das", evidenceIds: ["ev-name", "ev-bank-name"] },
      requiredDocuments: { ...baseProfile.requiredDocuments, "income-certificate": "missing" },
    };
    const conflict = [...evidence.filter((e) => e.id !== "ev-income-expiry"), { ...evidence[0], id: "ev-bank-name", documentId: "doc-bank", documentType: "bank-proof" as const, text: "Rina Dey" }];
    const result = validateProfile(profile, conflict, OPTIONS);
    const known = new Set(conflict.map((e) => e.id));
    for (const issue of result.issues) {
      expect(issue.ruleId).toMatch(/^[A-Z_]+$/);
      expect(issue.remediation.length).toBeGreaterThan(0);
      for (const id of issue.evidenceIds) expect(known.has(id)).toBe(true);
    }
  });

  it("is deterministic and independent of the system clock", () => {
    const first = validateProfile(baseProfile, evidence, { referenceDate: "2026-09-30" });
    const second = validateProfile(baseProfile, evidence, { referenceDate: "2026-09-30" });
    expect(second).toEqual(first);
    expect(first.checkedAt).toBe("2026-09-30T00:00:00.000Z");
    expect(first.profileVersion).toBe("v1");
  });
});
