import { describe, expect, it } from "vitest";
import { describeExecution, type ExecuteBridgePayload } from "../../src/ui/execution-trace.js";
import type { ExecutionResult } from "../../src/domain/execution/contracts.js";

function payload(overrides: Partial<ExecutionResult> & { inspected?: number; mapped?: number }): ExecuteBridgePayload {
  const result: ExecutionResult = {
    status: "VERIFIED",
    plan: null,
    verified: [
      { canonicalField: "fullName", portalFieldId: "full-name", expected: "Rina Das", observed: "Rina Das", verified: true },
      { canonicalField: "dateOfBirth", portalFieldId: "date-of-birth", expected: "2004-05-17", observed: "2004-05-17", verified: true },
    ],
    saveDraftSucceeded: true,
    portalState: "SAVED",
    failure: null,
    recoveryAttempts: 0,
    trace: [],
    ...overrides,
  } as ExecutionResult;
  return { ok: true, caseId: "CASE-001-clean", inspected: 6, mapped: 6, result };
}

describe("describeExecution", () => {
  it("marks every row complete for a verified run", () => {
    const { rows, completion } = describeExecution(payload({}));
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(rows.map((r) => r.text)).toEqual([
      "Portal inspected (6 fields)",
      "6 fields mapped",
      "2 values entered",
      "2 values independently verified",
      "Draft saved",
      "Portal state verified: SAVED",
    ]);
    expect(completion).toEqual({ ok: true, text: "Browser agent completed successfully." });
  });

  it("reports recovery without hiding the miss", () => {
    const { rows, completion } = describeExecution(payload({ status: "RECOVERED", recoveryAttempts: 1 }));
    expect(rows.some((r) => r.text.includes("Recovered after 1 miss"))).toBe(true);
    expect(completion.ok).toBe(true);
  });

  it("never shows success for escalation or mismatch", () => {
    const escalated = describeExecution(
      payload({
        status: "ESCALATED",
        saveDraftSucceeded: false,
        portalState: null,
        failure: { reason: "UNKNOWN_STATE", message: "inconclusive" },
      }),
    );
    expect(escalated.completion.ok).toBe(false);
    expect(escalated.rows.some((r) => !r.ok)).toBe(true);
    expect(escalated.completion.text).toContain("ESCALATED");

    const mismatch = describeExecution(
      payload({
        verified: [
          { canonicalField: "fullName", portalFieldId: "full-name", expected: "Rina Das", observed: "Rina Dey", verified: false },
        ],
      }),
    );
    expect(mismatch.rows.find((r) => r.text.includes("independently verified"))?.ok).toBe(false);
  });
});
