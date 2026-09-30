import { describe, expect, it } from "vitest";
import { ALL_CANONICAL_FIELDS } from "../../src/domain/mapping/contracts.js";
import {
  DeterministicBaselineProvider,
  mapPortalField,
  mapPortalFields,
} from "../../src/domain/mapping/deterministic.js";
import type { PortalField } from "../../src/domain/mapping/contracts.js";

function field(label: string, id = "f-1"): PortalField {
  return { id, label, inputType: "text", required: true };
}

describe("deterministic baseline mapper", () => {
  it("A. matches Full Name exactly", () => {
    expect(mapPortalField(field("Full Name"))).toMatchObject({
      canonicalField: "fullName",
      confidence: 1.0,
      method: "EXACT",
      status: "MATCHED",
    });
  });

  it("B. matches a known alias", () => {
    expect(mapPortalField(field("Applicant Name"))).toMatchObject({
      canonicalField: "fullName",
      confidence: 0.9,
      method: "ALIAS",
      status: "MATCHED",
    });
  });

  it("C. survives label drift to Applicant Legal Name", () => {
    expect(mapPortalField(field("Applicant Legal Name"))).toMatchObject({
      canonicalField: "fullName",
      method: "ALIAS",
      status: "MATCHED",
    });
  });

  it("D. matches the DOB alias", () => {
    expect(mapPortalField(field("DOB"))).toMatchObject({
      canonicalField: "dateOfBirth",
      status: "MATCHED",
    });
  });

  it("E. matches the Family Income alias", () => {
    expect(mapPortalField(field("Family Income"))).toMatchObject({
      canonicalField: "annualFamilyIncome",
      status: "MATCHED",
    });
  });

  it("F. matches the Account Number alias", () => {
    expect(mapPortalField(field("Account Number"))).toMatchObject({
      canonicalField: "bankAccountNumber",
      status: "MATCHED",
    });
  });

  it("G. leaves unknown labels unmapped", () => {
    expect(mapPortalField(field("Favorite Color"))).toMatchObject({
      canonicalField: null,
      confidence: 0,
      method: "NONE",
      status: "UNMAPPED",
    });
  });

  it("H. marks bare Reference as ambiguous, never guessed", () => {
    expect(mapPortalField(field("Reference"))).toMatchObject({
      canonicalField: null,
      status: "AMBIGUOUS",
    });
  });

  it("I. never silently maps Account Holder Name to bankAccountNumber", () => {
    const result = mapPortalField(field("Account Holder Name"));
    expect(result.canonicalField).not.toBe("bankAccountNumber");
    expect(result.status).toBe("UNMAPPED");
  });

  it("J. is deterministic for identical inputs", () => {
    const inputs = [field("Full Name"), field("DOB"), field("Reference"), field("Favorite Color")];
    expect(JSON.stringify(mapPortalFields(inputs))).toBe(JSON.stringify(mapPortalFields(inputs)));
  });

  it("maps the portal v1 labels through the provider boundary", async () => {
    const provider = new DeterministicBaselineProvider();
    const results = await provider.mapFields(ALL_CANONICAL_FIELDS, [
      field("Full Name", "full-name"),
      field("Date of Birth", "dob"),
      field("Address", "address"),
    ]);
    expect(results.map((r) => [r.portalFieldId, r.canonicalField, r.status])).toEqual([
      ["full-name", "fullName", "MATCHED"],
      ["dob", "dateOfBirth", "MATCHED"],
      ["address", "address", "MATCHED"],
    ]);
  });
});

describe("label drift invariance", () => {
  it("portal v1 Full Name and portal v2 Applicant Legal Name both reach fullName", () => {
    const v1 = mapPortalField({ id: "full-name", label: "Full Name", inputType: "text", required: true });
    const v2 = mapPortalField({ id: "legal-name", label: "Applicant Legal Name", inputType: "text", required: true });
    expect(v1.canonicalField).toBe("fullName");
    expect(v2.canonicalField).toBe("fullName");
    expect(v1.status).toBe("MATCHED");
    expect(v2.status).toBe("MATCHED");
  });
});
