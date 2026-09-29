import { describe, expect, it } from "vitest";
import { assertCanSubmit, canSubmit, submissionRejectionReasons } from "../../src/domain/submission/authorize.js";
import type { Approval, PortalRun, PortalRunState, PreflightResult } from "../../src/domain/contracts.js";

const ready: PreflightResult = { status: "READY", issues: [], checkedAt: "2026-09-30T00:00:00.000Z", profileVersion: "v1" };
const blocked: PreflightResult = {
  status: "BLOCKED",
  issues: [{ ruleId: "REQUIRED_DOCUMENT", severity: "error", message: "Required document missing: income-certificate", evidenceIds: [], blocking: true }],
  checkedAt: "2026-09-30T00:00:00.000Z",
  profileVersion: "v1",
};
const pending: Approval = { status: "PENDING", profileVersion: "v1" };
const approved: Approval = { status: "APPROVED", profileVersion: "v1" };
const rejected: Approval = { status: "REJECTED", profileVersion: "v1" };
const awaiting: PortalRun = { runId: "run-1", state: "AWAITING_APPROVAL", profileVersion: "v1" };

describe("submission safety invariant", () => {
  it("allows submission for READY + APPROVED + AWAITING_APPROVAL on one version", () => {
    expect(canSubmit(ready, approved, awaiting)).toBe(true);
    expect(() => assertCanSubmit(ready, approved, awaiting)).not.toThrow();
    expect(submissionRejectionReasons(ready, approved, awaiting)).toEqual([]);
  });

  it("rejects blocked preflight", () => {
    expect(canSubmit(blocked, approved, awaiting)).toBe(false);
    expect(() => assertCanSubmit(blocked, approved, awaiting)).toThrow(/preflight\.status is BLOCKED/);
  });

  it("rejects pending approval", () => {
    expect(canSubmit(ready, pending, awaiting)).toBe(false);
    expect(() => assertCanSubmit(ready, pending, awaiting)).toThrow(/approval\.status is PENDING/);
  });

  it("rejects rejected approval", () => {
    expect(canSubmit(ready, rejected, awaiting)).toBe(false);
    expect(() => assertCanSubmit(ready, rejected, awaiting)).toThrow(/approval\.status is REJECTED/);
  });

  it("rejects approval for a different profile version", () => {
    expect(() => assertCanSubmit(ready, { ...approved, profileVersion: "v2" }, awaiting)).toThrow(/approval\.profileVersion/);
  });

  it("rejects a portal run for a different profile version", () => {
    expect(canSubmit(ready, approved, { ...awaiting, profileVersion: "v2" })).toBe(false);
    expect(() => assertCanSubmit(ready, approved, { ...awaiting, profileVersion: "v2" })).toThrow(/portalRun\.profileVersion/);
  });

  it.each([
    "NOT_STARTED",
    "FILLED",
    "SUBMITTING",
    "SUBMITTED",
    "VERIFIED",
    "UNKNOWN",
    "FAILED",
  ] satisfies PortalRunState[])("rejects portal state %s", (state) => {
    const portalRun: PortalRun = { ...awaiting, state };
    expect(canSubmit(ready, approved, portalRun)).toBe(false);
    expect(() => assertCanSubmit(ready, approved, portalRun)).toThrow(/portalRun\.state/);
  });
});
