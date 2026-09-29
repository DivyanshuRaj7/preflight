import type { Approval, PortalRun, PreflightResult } from "../contracts.js";

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
