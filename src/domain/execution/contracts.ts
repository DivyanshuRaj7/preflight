import type { CanonicalField, FieldMapping } from "../mapping/contracts.js";

// Execution contracts (TASK-005D). The execution layer moves an already-READY
// application into the synthetic portal. It NEVER validates (it consumes the
// validation result), NEVER maps by itself (it consumes FieldMapping[]), and
// NEVER submits (it stops at SAVED).
//
// Lifecycle for this task only: IDLE → EXECUTING → VERIFYING → VERIFIED.
// Any failure terminates with status FAILED and a typed reason.

export type ExecutionStatus = "IDLE" | "EXECUTING" | "VERIFYING" | "VERIFIED" | "FAILED";

export type ExecutionFailureReason =
  | "BLOCKED_PREFLIGHT"
  | "PROFILE_VERSION_MISMATCH"
  | "UNMAPPED_REQUIRED_FIELD"
  | "AMBIGUOUS_REQUIRED_FIELD"
  | "MISSING_VALUE"
  | "VERIFICATION_MISMATCH"
  | "SAVE_DRAFT_FAILED";

export type ExecutionFailure = {
  reason: ExecutionFailureReason;
  message: string;
  canonicalField?: CanonicalField;
  portalFieldId?: string;
  expected?: string;
  observed?: string;
};

// One planned fill: a canonical value routed through an already-decided mapping.
export type FieldPlan = {
  canonicalField: CanonicalField;
  portalFieldId: string;
  portalLabel: string;
  value: string;
};

export type ExecutionPlan = {
  profileVersion: string;
  fields: FieldPlan[];
};

// Independent read-back of one filled field.
export type VerifiedField = {
  canonicalField: CanonicalField;
  portalFieldId: string;
  expected: string;
  observed: string;
  verified: boolean;
};

export type ExecutionResult = {
  status: ExecutionStatus;
  plan: ExecutionPlan | null;
  verified: VerifiedField[];
  saveDraftSucceeded: boolean;
  portalState: "SAVED" | null;
  failure: ExecutionFailure | null;
};

export type { FieldMapping };
