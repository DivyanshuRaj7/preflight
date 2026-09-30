import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { authorizeSubmission } from "../../src/domain/submission/authorize.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

const OPTIONS = { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" };
const CASE_DIR = "fixtures/cases/CASE-011-consistent-false-evidence";

// TASK-009 experiment proofs. The ground truth lives ONLY in
// ground-truth.json, which no runtime module imports — these tests pin both
// halves of that isolation.
describe("uniform false evidence experiment", () => {
  it("keeps ground truth out of every runtime input", () => {
    const caseText = readFileSync(`${CASE_DIR}/case.json`, "utf8");
    const expectedText = readFileSync("fixtures/expected/CASE-011-consistent-false-evidence.json", "utf8");
    const truth = JSON.parse(readFileSync(`${CASE_DIR}/ground-truth.json`, "utf8")) as {
      field: string;
      groundTruth: string;
    };
    // The true value appears nowhere the engine can see.
    expect(caseText).not.toContain(truth.groundTruth);
    expect(expectedText).not.toContain(truth.groundTruth);
    // ...while every extracted value agrees with every other one.
    const input = JSON.parse(caseText) as { evidence: Evidence[] };
    const extracted = new Set(input.evidence.filter((e) => e.field === truth.field).map((e) => e.text));
    expect(extracted.size).toBe(1);
    expect([...extracted][0]).not.toBe(truth.groundTruth);
  });

  it("records the actual pipeline decision without forcing it", () => {
    const input = JSON.parse(readFileSync(`${CASE_DIR}/case.json`, "utf8")) as {
      profile: ApplicantProfile;
      evidence: Evidence[];
    };
    const result = validateProfile(input.profile, input.evidence, OPTIONS);
    // Pinned observation (see fixtures.eval.test.ts): consistent evidence
    // yields READY with zero findings. There is no independent signal.
    expect(result.status).toBe("READY");
    expect(result.issues).toEqual([]);
  });

  it("keeps the authorization boundary intact despite the false READY", () => {
    const input = JSON.parse(readFileSync(`${CASE_DIR}/case.json`, "utf8")) as {
      profile: ApplicantProfile;
      evidence: Evidence[];
    };
    const preflight = validateProfile(input.profile, input.evidence, OPTIONS);
    // A false READY is a reliability problem, never an authorization bypass:
    // without explicit approval, submission is still refused.
    expect(
      authorizeSubmission({
        preflight,
        executionStatus: "IDLE",
        portalState: null,
        snapshot: null,
        approval: null,
      }),
    ).toMatchObject({ authorized: false });
  });
});
