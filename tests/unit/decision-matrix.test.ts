import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  baselineMappingRecognized,
  baselineValidationDecision,
  computeMetrics,
  confusionMatrix,
  type CaseInput,
} from "../../scripts/eval/decision-matrix.js";

function loadCase(id: string): CaseInput {
  return JSON.parse(readFileSync(`fixtures/cases/${id}/case.json`, "utf8")) as CaseInput;
}

describe("baseline fairness contract", () => {
  it("blocks only on missing documents or past expiry", () => {
    expect(baselineValidationDecision(loadCase("CASE-004-missing-income-certificate"))).toBe("BLOCK");
    expect(baselineValidationDecision(loadCase("CASE-005-expired-certificate"))).toBe("BLOCK");
    expect(baselineValidationDecision(loadCase("CASE-001-clean"))).toBe("SUCCESS");
  });

  it("does not detect conflicts it was never given", () => {
    expect(baselineValidationDecision(loadCase("CASE-002-name-mismatch"))).toBe("SUCCESS");
    expect(baselineValidationDecision(loadCase("CASE-006-low-confidence-extraction"))).toBe("SUCCESS");
  });

  it("recognizes exact labels only, never aliases or drift", () => {
    expect(baselineMappingRecognized("Full Name")).toBe(true);
    expect(baselineMappingRecognized("Applicant Legal Name")).toBe(false);
    expect(baselineMappingRecognized("DOB")).toBe(false);
    expect(baselineMappingRecognized("Reference")).toBe(false);
  });
});

describe("metric computation", () => {
  it("counts confusion and unsafe outcomes without inventing numbers", () => {
    const rows = [
      { caseId: "a", category: "c", expected: "SUCCESS" as const, baseline: "SUCCESS" as const, preflight: "SUCCESS" as const, baselineCorrect: true, preflightCorrect: true, baselineUnsafe: false, preflightUnsafe: false, notes: "" },
      { caseId: "b", category: "c", expected: "BLOCK" as const, baseline: "SUCCESS" as const, preflight: "BLOCK" as const, baselineCorrect: false, preflightCorrect: true, baselineUnsafe: true, preflightUnsafe: false, notes: "" },
    ];
    expect(confusionMatrix(rows, "preflight")).toEqual({
      SUCCESS: { SUCCESS: 1, BLOCK: 0, ESCALATE: 0, RECOVER: 0 },
      BLOCK: { SUCCESS: 0, BLOCK: 1, ESCALATE: 0, RECOVER: 0 },
    });
    const metrics = computeMetrics(rows, "preflight");
    expect(metrics).toMatchObject({ total: 2, falsePositiveBlocks: 0, falseNegativeUnsafe: 0 });
    expect(computeMetrics(rows, "baseline").falseNegativeUnsafe).toBe(1);
  });
});
