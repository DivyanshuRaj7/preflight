import type { CanonicalField, FieldMapping } from "../mapping/contracts.js";

// Execution contracts (TASK-005D). The execution layer moves an already-READY
// application into the synthetic portal. It NEVER validates (it consumes the
// validation result), NEVER maps by itself (it consumes FieldMapping[]), and
// NEVER submits (it stops at SAVED).
//
// Lifecycle for this task only: IDLE → EXECUTING → VERIFYING → VERIFIED.
// Any failure terminates with status FAILED and a typed reason.

export type ExecutionStatus = "IDLE" | "EXECUTING" | "VERIFYING" | "VERIFIED" | "RECOVERED" | "ESCALATED" | "FAILED";

export type ExecutionFailureReason =
  | "BLOCKED_PREFLIGHT"
  | "PROFILE_VERSION_MISMATCH"
  | "UNMAPPED_REQUIRED_FIELD"
  | "AMBIGUOUS_REQUIRED_FIELD"
  | "MISSING_VALUE"
  | "VERIFICATION_MISMATCH"
  | "SAVE_DRAFT_FAILED"
  | "UNKNOWN_STATE";

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
  recoveryAttempts: number;
  trace: ExecutionEvent[];
};

export type ExecutionEventType =
  | "EXECUTION_STARTED"
  | "PORTAL_INSPECTED"
  | "MAPPING_RESOLVED"
  | "ACTION_ATTEMPTED"
  | "ACTION_FAILED"
  | "STATE_VERIFIED"
  | "RECOVERY_STARTED"
  | "RECOVERY_COMPLETED"
  | "ESCALATED"
  | "EXECUTION_COMPLETED"
  | "FINAL_REVIEW_CREATED"
  | "AWAITING_APPROVAL"
  | "APPROVAL_GRANTED"
  | "APPROVAL_INVALIDATED"
  | "SUBMISSION_AUTHORIZED"
  | "SUBMISSION_STARTED"
  | "SUBMISSION_COMPLETED"
  | "FINAL_STATE_VERIFIED"
  | "SUBMISSION_ESCALATED";

// One trace event: WHAT happened, WHY, WHAT state was observed, and WHAT
// Preflight does next. Synthetic data only — never secrets or PII.
export type ExecutionEvent = {
  seq: number;
  type: ExecutionEventType;
  detail: string;
  observedState?: string | null;
};

export type ExecutionTracer = {
  events: ExecutionEvent[];
  record: (type: ExecutionEventType, detail: string, observedState?: string | null) => void;
};

export function createTracer(): ExecutionTracer {
  const events: ExecutionEvent[] = [];
  return {
    events,
    record: (type, detail, observedState) => {
      events.push({ seq: events.length + 1, type, detail, observedState: observedState ?? null });
    },
  };
}

export type { FieldMapping };
