import type { ApplicantProfile, Evidence, PreflightResult } from "../contracts.js";
import { resolveCanonicalValue } from "../execution/plan.js";
import { computeStateFingerprint, SUBMISSION_VALUE_FIELDS } from "./approval.js";
import type { CanonicalField } from "../mapping/contracts.js";

// Final review snapshot (TASK-007). Built after SAVED verification, this is
// the exact state the human reviews and approves — values, versions, and
// verdicts together. The fingerprint binds approval to THESE values.
export type ReviewSnapshot = {
  applicationId: string;
  profileVersion: string;
  preflightStatus: PreflightResult["status"];
  portalState: string;
  values: Record<CanonicalField, string>;
  findingIds: string[];
  evidenceCount: number;
  fingerprint: string;
};

export function buildReviewSnapshot(input: {
  applicationId: string;
  profile: ApplicantProfile;
  evidence: Evidence[];
  preflight: PreflightResult;
  portalState: string;
}): ReviewSnapshot {
  const values = {} as Record<CanonicalField, string>;
  for (const field of SUBMISSION_VALUE_FIELDS) {
    const value = resolveCanonicalValue(field, input.profile, input.evidence);
    if (value === undefined) {
      throw new Error(`Cannot review application: no canonical value for '${field}'.`);
    }
    values[field] = value;
  }
  const fingerprint = computeStateFingerprint({
    applicationId: input.applicationId,
    profileVersion: input.profile.version,
    preflightStatus: input.preflight.status,
    portalState: input.portalState,
    ...values,
  });
  return {
    applicationId: input.applicationId,
    profileVersion: input.profile.version,
    preflightStatus: input.preflight.status,
    portalState: input.portalState,
    values,
    findingIds: input.preflight.issues.map((issue) => issue.ruleId),
    evidenceCount: input.evidence.length,
    fingerprint,
  };
}
