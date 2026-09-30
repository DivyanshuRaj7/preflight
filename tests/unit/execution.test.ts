import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import {
  buildExecutionPlan,
  finalizeExecution,
  resolveCanonicalValue,
} from "../../src/domain/execution/plan.js";
import type { ApplicantProfile, Evidence, PreflightResult } from "../../src/domain/contracts.js";
import type { FieldMapping } from "../../src/domain/mapping/contracts.js";

const OPTIONS = { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" };

type CaseInput = { id: string; scenario: string; profile: ApplicantProfile; evidence: Evidence[] };

function loadCase(id: string): CaseInput {
  return JSON.parse(readFileSync(`fixtures/cases/${id}/case.json`, "utf8")) as CaseInput;
}

const clean = loadCase("CASE-001-clean");
const cleanPreflight = validateProfile(clean.profile, clean.evidence, OPTIONS);

const PORTAL_LABELS = [
  { id: "full-name", label: "Full Name", inputType: "text", required: true },
  { id: "date-of-birth", label: "Date of Birth", inputType: "date", required: true },
  { id: "address", label: "Address", inputType: "text", required: true },
  { id: "annual-income", label: "Annual Family Income", inputType: "number", required: true },
  { id: "bank-account", label: "Bank Account Number", inputType: "text", required: true },
  { id: "application-reference", label: "Scholarship Application Reference", inputType: "text", required: true },
];

describe("execution planning", () => {
  it("builds a six-field plan from a READY result without duplicating values", () => {
    expect(cleanPreflight.status).toBe("READY");
    const mappings = mapPortalFields(PORTAL_LABELS);
    expect(mappings.every((m) => m.status === "MATCHED")).toBe(true);
    const outcome = buildExecutionPlan(cleanPreflight, clean.profile, clean.evidence, mappings);
    expect("plan" in outcome).toBe(true);
    if (!("plan" in outcome)) return;
    expect(outcome.plan.fields.map((f) => [f.canonicalField, f.value])).toEqual([
      ["fullName", "Rina Das"],
      ["dateOfBirth", "2004-05-17"],
      ["address", "14 Lake Road, Kolkata 700029"],
      ["annualFamilyIncome", "180000"],
      ["bankAccountNumber", "SYNTHETIC-001234"],
      ["scholarshipApplicationReference", "SCH-2026-001"],
    ]);
  });

  it("resolves identity facts from the profile, never from literals", () => {
    expect(resolveCanonicalValue("fullName", clean.profile, [])).toBe("Rina Das");
    expect(resolveCanonicalValue("annualFamilyIncome", clean.profile, [])).toBeUndefined();
    expect(resolveCanonicalValue("annualFamilyIncome", clean.profile, clean.evidence)).toBe("180000");
  });

  it("rejects BLOCKED preflight without a plan", () => {
    const blockedCase = loadCase("CASE-002-name-mismatch");
    const blocked = validateProfile(blockedCase.profile, blockedCase.evidence, OPTIONS);
    expect(blocked.status).toBe("BLOCKED");
    const outcome = buildExecutionPlan(blocked, blockedCase.profile, blockedCase.evidence, mapPortalFields(PORTAL_LABELS));
    expect(outcome).toMatchObject({ failure: { reason: "BLOCKED_PREFLIGHT" } });
    expect("plan" in outcome).toBe(false);
  });

  it("rejects UNMAPPED required fields", () => {
    const mappings: FieldMapping[] = mapPortalFields([
      ...PORTAL_LABELS.filter((f) => f.id !== "annual-income"),
      { id: "hobby", label: "Favorite Color", inputType: "text", required: false },
    ]);
    const outcome = buildExecutionPlan(cleanPreflight, clean.profile, clean.evidence, mappings);
    expect(outcome).toMatchObject({
      failure: { reason: "UNMAPPED_REQUIRED_FIELD", canonicalField: "annualFamilyIncome" },
    });
  });

  it("rejects AMBIGUOUS required fields without guessing", () => {
    const relabeled = PORTAL_LABELS.map((f) =>
      f.id === "application-reference" ? { ...f, id: "reference", label: "Reference" } : f,
    );
    const outcome = buildExecutionPlan(cleanPreflight, clean.profile, clean.evidence, mapPortalFields(relabeled));
    expect(outcome).toMatchObject({
      failure: { reason: "AMBIGUOUS_REQUIRED_FIELD", canonicalField: "scholarshipApplicationReference" },
    });
  });

  it("rejects version drift between preflight and profile", () => {
    const stale: PreflightResult = { ...cleanPreflight, profileVersion: "v0" };
    const outcome = buildExecutionPlan(stale, clean.profile, clean.evidence, mapPortalFields(PORTAL_LABELS));
    expect(outcome).toMatchObject({ failure: { reason: "PROFILE_VERSION_MISMATCH" } });
  });
});

describe("execution finalization", () => {
  it("verifies exact read-backs and SAVED", () => {
    const outcome = buildExecutionPlan(cleanPreflight, clean.profile, clean.evidence, mapPortalFields(PORTAL_LABELS));
    if (!("plan" in outcome)) throw new Error("expected a plan");
    const observations = outcome.plan.fields.map((f) => ({ portalFieldId: f.portalFieldId, observed: f.value }));
    const result = finalizeExecution(outcome.plan, observations, true);
    expect(result.status).toBe("VERIFIED");
    expect(result.portalState).toBe("SAVED");
    expect(result.verified.every((v) => v.verified)).toBe(true);
  });

  it("fails on a single mismatched value and forbids save", () => {
    const outcome = buildExecutionPlan(cleanPreflight, clean.profile, clean.evidence, mapPortalFields(PORTAL_LABELS));
    if (!("plan" in outcome)) throw new Error("expected a plan");
    const observations = outcome.plan.fields.map((f) => ({
      portalFieldId: f.portalFieldId,
      observed: f.canonicalField === "fullName" ? "Rina Dey" : f.value,
    }));
    const result = finalizeExecution(outcome.plan, observations, true);
    expect(result.status).toBe("FAILED");
    expect(result.saveDraftSucceeded).toBe(false);
    expect(result.failure).toMatchObject({
      reason: "VERIFICATION_MISMATCH",
      canonicalField: "fullName",
      expected: "Rina Das",
      observed: "Rina Dey",
    });
  });
});
