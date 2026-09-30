import type { Approval, PortalRun, PreflightResult } from "../contracts.js";
import type { ExecutionStatus } from "../execution/contracts.js";
import { checkApproval, type ApprovalRecord } from "./approval.js";
import type { ReviewSnapshot } from "./review.js";

// Domain/server-side submission authorization. The UI must never enforce this;
// it only presents state. Every rejection reason is explicit: uncertainty
// becomes a denial, never a silent success.
export function submissionRejectionReasons(
  preflight: PreflightResult,
  approval: Approval,
  portalRun: PortalRun,
): string[] {
  const reasons: string[] = [];
  if (preflight.status !== "READY") {
    reasons.push(`preflight.status is ${preflight.status}, expected READY`);
  }
  if (approval.status !== "APPROVED") {
    reasons.push(`approval.status is ${approval.status}, expected APPROVED`);
  }
  if (portalRun.state !== "AWAITING_APPROVAL") {
    reasons.push(`portalRun.state is ${portalRun.state}, expected AWAITING_APPROVAL`);
  }
  if (approval.profileVersion !== preflight.profileVersion) {
    reasons.push(
      `approval.profileVersion ${approval.profileVersion} does not match preflight.profileVersion ${preflight.profileVersion}`,
    );
  }
  if (portalRun.profileVersion !== preflight.profileVersion) {
    reasons.push(
      `portalRun.profileVersion ${portalRun.profileVersion} does not match preflight.profileVersion ${preflight.profileVersion}`,
    );
  }
  return reasons;
}

export function canSubmit(
  preflight: PreflightResult,
  approval: Approval,
  portalRun: PortalRun,
): boolean {
  return submissionRejectionReasons(preflight, approval, portalRun).length === 0;
}

export function assertCanSubmit(
  preflight: PreflightResult,
  approval: Approval,
  portalRun: PortalRun,
): void {
  const reasons = submissionRejectionReasons(preflight, approval, portalRun);
  if (reasons.length > 0) {
    throw new Error(`Submission denied: ${reasons.join("; ")}`);
  }
}

// Final submission authorization (TASK-007). There is NO path SAVED →
// SUBMITTING without explicit human approval bound to the exact reviewed
// state. Every condition is checked in deterministic code; UI visibility is
// never a boundary. Uncertainty becomes denial.
export type SubmissionDenialReason =
  | "BLOCKED_PREFLIGHT"
  | "NOT_READY_FOR_APPROVAL"
  | "NOT_SAVED"
  | "UNKNOWN_STATE"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_INVALIDATED";

export type SubmissionAuthorization =
  | { authorized: true; reason?: undefined }
  | { authorized: false; reason: SubmissionDenialReason; message: string };

export function authorizeSubmission(input: {
  preflight: PreflightResult;
  executionStatus: ExecutionStatus;
  portalState: string | null;
  snapshot: ReviewSnapshot | null;
  approval: ApprovalRecord | null;
}): SubmissionAuthorization {
  const deny = (reason: SubmissionDenialReason, message: string): SubmissionAuthorization => ({
    authorized: false,
    reason,
    message,
  });
  if (input.preflight.status !== "READY") {
    return deny("BLOCKED_PREFLIGHT", `Submission refused: preflight is ${input.preflight.status}, required READY.`);
  }
  if (input.executionStatus !== "VERIFIED" && input.executionStatus !== "RECOVERED") {
    return deny(
      "NOT_READY_FOR_APPROVAL",
      `Submission refused: execution is ${input.executionStatus}, required VERIFIED (browser run with read-back proof).`,
    );
  }
  if (input.snapshot === null) {
    return deny("NOT_READY_FOR_APPROVAL", "Submission refused: no final review snapshot exists.");
  }
  if (input.portalState === null || (input.portalState !== "SAVED" && input.portalState !== "DRAFT")) {
    return deny(
      "UNKNOWN_STATE",
      `Submission refused: portal state is inconclusive (${JSON.stringify(input.portalState)}). Stopped without retry.`,
    );
  }
  if (input.portalState !== "SAVED") {
    return deny("NOT_SAVED", `Submission refused: portal state is ${input.portalState}, required SAVED.`);
  }
  if (input.approval === null) {
    return deny("APPROVAL_REQUIRED", "Submission refused: no explicit human approval exists.");
  }
  const check = checkApproval(input.approval, input.snapshot.fingerprint);
  if (check.status !== "APPROVED") {
    return deny("APPROVAL_INVALIDATED", `Submission refused: approval invalid — ${check.reason}`);
  }
  return { authorized: true };
}

export function assertSubmissionAuthorized(
  input: Parameters<typeof authorizeSubmission>[0],
): void {
  const result = authorizeSubmission(input);
  if (!result.authorized) {
    throw new Error(`Submission denied (${result.reason}): ${result.message}`);
  }
}
