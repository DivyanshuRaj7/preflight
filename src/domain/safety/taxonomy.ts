// Failure taxonomy (reliability boundary). Seven categories, each with an
// explicit detector, retry/human/submission policy. This table is DATA, not
// prose: the coverage matrix and tests derive from it, so documentation and
// enforcement cannot quietly diverge.

export type FailureCategory =
  | "EVIDENCE_FAILURE"
  | "PROFILE_FAILURE"
  | "MAPPING_FAILURE"
  | "EXECUTION_FAILURE"
  | "STATE_VERIFICATION_FAILURE"
  | "AUTHORIZATION_FAILURE"
  | "MODEL_BOUNDARY_FAILURE";

export type CategoryPolicy = {
  definition: string;
  detector: string;
  retryAllowed: boolean;
  humanReviewRequired: boolean;
  submissionPermitted: boolean;
};

export const CATEGORY_POLICY: Record<FailureCategory, CategoryPolicy> = {
  EVIDENCE_FAILURE: {
    definition: "Source material is missing, invalid, expired, untrustworthy, or self-contradictory.",
    detector: "validateProfile evidence rules (EVIDENCE_PROVENANCE, MISSING_REQUIRED_DOCUMENT, DOCUMENT_INVALID, DOCUMENT_EXPIRED, LOW_CONFIDENCE_CRITICAL_FIELD)",
    retryAllowed: false,
    humanReviewRequired: true,
    submissionPermitted: false,
  },
  PROFILE_FAILURE: {
    definition: "Assembled identity facts disagree across documents.",
    detector: "validateProfile agreement rules (NAME_MISMATCH, DOB_MISMATCH, ADDRESS_MISMATCH)",
    retryAllowed: false,
    humanReviewRequired: true,
    submissionPermitted: false,
  },
  MAPPING_FAILURE: {
    definition: "Portal wording cannot be safely resolved to a canonical field.",
    detector: "DeterministicBaselineProvider statuses AMBIGUOUS / UNMAPPED",
    retryAllowed: false,
    humanReviewRequired: true,
    submissionPermitted: false,
  },
  EXECUTION_FAILURE: {
    definition: "A browser action observably failed to change state.",
    detector: "read-back comparison in finalizeExecution; confirmed NOT_REACHED verdict",
    retryAllowed: true,
    humanReviewRequired: false,
    submissionPermitted: false,
  },
  STATE_VERIFICATION_FAILURE: {
    definition: "Observed browser state is not the expected state, or is inconclusive.",
    detector: "verifyPortalState (EXPECTED_STATE / NOT_REACHED / UNKNOWN)",
    retryAllowed: true,
    humanReviewRequired: true,
    submissionPermitted: false,
  },
  AUTHORIZATION_FAILURE: {
    definition: "Approval is missing, stale, void, or bound to a different state.",
    detector: "checkApproval + authorizeSubmission typed denials",
    retryAllowed: false,
    humanReviewRequired: true,
    submissionPermitted: false,
  },
  MODEL_BOUNDARY_FAILURE: {
    definition: "The situation falls outside the supported schema, workflow, or evidence model.",
    detector: "SafetyDecision with uncertainty UNCERTAIN resolving to BLOCK or ESCALATE",
    retryAllowed: false,
    humanReviewRequired: true,
    submissionPermitted: false,
  },
};

// Maps stable validation rule IDs to their failure category. Unknown rule IDs
// are MODEL_BOUNDARY_FAILURE by construction: an unrecognized detector output
// is itself outside the supported model.
export const RULE_CATEGORY: Record<string, FailureCategory> = {
  EVIDENCE_PROVENANCE: "EVIDENCE_FAILURE",
  MISSING_REQUIRED_DOCUMENT: "EVIDENCE_FAILURE",
  DOCUMENT_INVALID: "EVIDENCE_FAILURE",
  DOCUMENT_EXPIRED: "EVIDENCE_FAILURE",
  LOW_CONFIDENCE_CRITICAL_FIELD: "EVIDENCE_FAILURE",
  NAME_MISMATCH: "PROFILE_FAILURE",
  DOB_MISMATCH: "PROFILE_FAILURE",
  ADDRESS_MISMATCH: "PROFILE_FAILURE",
};

export function categoryOfRule(ruleId: string): FailureCategory {
  return RULE_CATEGORY[ruleId] ?? "MODEL_BOUNDARY_FAILURE";
}
