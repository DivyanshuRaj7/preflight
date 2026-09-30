import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import {
  authorizeSubmission,
  type SubmissionAuthorization,
} from "../../src/domain/submission/authorize.js";
import {
  checkApproval,
  computeStateFingerprint,
  grantApproval,
  type ApprovalRecord,
} from "../../src/domain/submission/approval.js";
import { buildReviewSnapshot, type ReviewSnapshot } from "../../src/domain/submission/review.js";
import type { ExecutionStatus } from "../../src/domain/execution/contracts.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

const OPTIONS = { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" };
const APPROVED_AT = "2026-09-30T00:00:00.000Z";

type CaseInput = { id: string; profile: ApplicantProfile; evidence: Evidence[] };

function loadCase(id: string): CaseInput {
  return JSON.parse(readFileSync(`fixtures/cases/${id}/case.json`, "utf8")) as CaseInput;
}

function readyContext() {
  const input = loadCase("CASE-001-clean");
  const preflight = validateProfile(input.profile, input.evidence, OPTIONS);
  expect(preflight.status).toBe("READY");
  const snapshot = buildReviewSnapshot({
    applicationId: "CASE-001-clean",
    profile: input.profile,
    evidence: input.evidence,
    preflight,
    portalState: "SAVED",
  });
  const approval = grantApproval({
    applicationId: "CASE-001-clean",
    fingerprint: snapshot.fingerprint,
    approvedAt: APPROVED_AT,
  });
  return { input, preflight, snapshot, approval };
}

function authorize(
  overrides: Partial<{
    preflight: ReturnType<typeof validateProfile>;
    executionStatus: ExecutionStatus;
    portalState: string | null;
    snapshot: ReviewSnapshot | null;
    approval: ApprovalRecord | null;
  }> = {},
): SubmissionAuthorization {
  const ctx = readyContext();
  return authorizeSubmission({
    preflight: ctx.preflight,
    executionStatus: "VERIFIED",
    portalState: "SAVED",
    snapshot: ctx.snapshot,
    approval: ctx.approval,
    ...overrides,
  });
}

describe("submission authorization", () => {
  it("A. rejects submission with no approval", () => {
    expect(authorize({ approval: null })).toMatchObject({ authorized: false, reason: "APPROVAL_REQUIRED" });
  });

  it("B. allows submission for an approved exact state", () => {
    expect(authorize()).toMatchObject({ authorized: true });
  });

  it("C. rejects a fingerprint mismatch", () => {
    const ctx = readyContext();
    const tampered: ApprovalRecord = { ...ctx.approval, reviewedFingerprint: "deadbeef" };
    expect(authorize({ approval: tampered })).toMatchObject({ authorized: false, reason: "APPROVAL_INVALIDATED" });
  });

  it("D. invalidates approval after a state change", () => {
    const ctx = readyContext();
    const changed = {
      ...ctx.input,
      evidence: ctx.input.evidence.map((e) =>
        e.id === "ev-income-amount" ? { ...e, text: "190000" } : e,
      ),
    };
    const next = buildReviewSnapshot({
      applicationId: "CASE-001-clean",
      profile: changed.profile,
      evidence: changed.evidence,
      preflight: validateProfile(changed.profile, changed.evidence, OPTIONS),
      portalState: "SAVED",
    });
    expect(next.fingerprint).not.toBe(ctx.snapshot.fingerprint);
    expect(checkApproval(ctx.approval, next.fingerprint).status).toBe("INVALIDATED");
    expect(
      authorize({ snapshot: next, preflight: validateProfile(changed.profile, changed.evidence, OPTIONS) }),
    ).toMatchObject({ authorized: false, reason: "APPROVAL_INVALIDATED" });
  });

  it("E. rejects BLOCKED validation", () => {
    const blockedCase = loadCase("CASE-002-name-mismatch");
    const blocked = validateProfile(blockedCase.profile, blockedCase.evidence, OPTIONS);
    expect(blocked.status).toBe("BLOCKED");
    expect(authorize({ preflight: blocked })).toMatchObject({ authorized: false, reason: "BLOCKED_PREFLIGHT" });
  });

  it("F. rejects a portal that is not SAVED", () => {
    expect(authorize({ portalState: "DRAFT" })).toMatchObject({ authorized: false, reason: "NOT_SAVED" });
  });

  it("G. rejects UNKNOWN portal state without retry semantics", () => {
    const denied = authorize({ portalState: "SAVING…" });
    expect(denied).toMatchObject({ authorized: false, reason: "UNKNOWN_STATE" });
    expect(authorize({ portalState: null })).toMatchObject({ authorized: false, reason: "UNKNOWN_STATE" });
  });

  it("H. rejects stale approval bound to a different version", () => {
    const ctx = readyContext();
    const stale = grantApproval({
      applicationId: "CASE-001-clean",
      fingerprint: ctx.snapshot.fingerprint,
      approvedAt: APPROVED_AT,
    });
    const moved = buildReviewSnapshot({
      applicationId: "CASE-001-clean",
      profile: { ...ctx.input.profile, version: "v2" },
      evidence: ctx.input.evidence,
      preflight: { ...ctx.preflight, profileVersion: "v2" },
      portalState: "SAVED",
    });
    expect(checkApproval(stale, moved.fingerprint).status).toBe("INVALIDATED");
    expect(authorize({ snapshot: moved, preflight: { ...ctx.preflight, profileVersion: "v2" } })).toMatchObject({
      authorized: false,
      reason: "APPROVAL_INVALIDATED",
    });
  });

  it("I. authorizes correct approval with the exact state", () => {
    const result = authorize({ executionStatus: "RECOVERED" });
    expect(result).toMatchObject({ authorized: true });
  });

  it("requires verified execution, not merely a saved portal", () => {
    expect(authorize({ executionStatus: "IDLE" })).toMatchObject({
      authorized: false,
      reason: "NOT_READY_FOR_APPROVAL",
    });
  });
});

describe("state fingerprint", () => {
  it("is stable for identical input regardless of key order", () => {
    const a = computeStateFingerprint({ x: "1", y: "2" });
    const b = computeStateFingerprint({ y: "2", x: "1" });
    expect(a).toBe(b);
    expect(computeStateFingerprint({ x: "1", y: "3" })).not.toBe(a);
  });
});
