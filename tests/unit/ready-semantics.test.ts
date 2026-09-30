import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

const OPTIONS = { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" };

// TASK-010 semantic contract: READY means "no blocking condition detected
// under the defined rules" — never a truth guarantee. These tests pin the
// behavior (unchanged engine) and the language (no truth claims).
describe("READY semantic contract", () => {
  it("keeps clean cases READY and blocked cases BLOCKED", () => {
    const clean = JSON.parse(readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8")) as {
      profile: ApplicantProfile;
      evidence: Evidence[];
    };
    const blocked = JSON.parse(readFileSync("fixtures/cases/CASE-002-name-mismatch/case.json", "utf8")) as {
      profile: ApplicantProfile;
      evidence: Evidence[];
    };
    expect(validateProfile(clean.profile, clean.evidence, OPTIONS).status).toBe("READY");
    expect(validateProfile(blocked.profile, blocked.evidence, OPTIONS).status).toBe("BLOCKED");
  });

  it("leaves CASE-011 READY: no truth-verification logic was introduced", () => {
    const adversarial = JSON.parse(
      readFileSync("fixtures/cases/CASE-011-consistent-false-evidence/case.json", "utf8"),
    ) as { profile: ApplicantProfile; evidence: Evidence[] };
    const result = validateProfile(adversarial.profile, adversarial.evidence, OPTIONS);
    expect(result.status).toBe("READY");
    expect(result.issues).toEqual([]);
  });

  it("emits no truth guarantees in any finding or remediation text", () => {
    const manifest = JSON.parse(readFileSync("fixtures/manifest.json", "utf8")) as {
      cases: { id: string }[];
    };
    const forbidden = /guarantee|objectively true|ground truth|always correct/i;
    for (const entry of manifest.cases) {
      const input = JSON.parse(readFileSync(`fixtures/cases/${entry.id}/case.json`, "utf8")) as {
        profile: ApplicantProfile;
        evidence: Evidence[];
      };
      const result = validateProfile(input.profile, input.evidence, OPTIONS);
      for (const issue of result.issues) {
        expect(`${issue.message} ${issue.remediation}`).not.toMatch(forbidden);
      }
    }
  });
});
