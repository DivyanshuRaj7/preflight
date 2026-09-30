import type { CanonicalField } from "../mapping/contracts.js";

// Approval contract (TASK-007). A human explicitly approves THIS EXACT
// STATE — never "this application" in the abstract. Approval is bound to a
// deterministic fingerprint of the reviewed values; any submission-relevant
// change produces a different fingerprint and the old approval authorizes
// nothing. All inputs are explicit data (including approvedAt): domain code
// never reads a clock, and no AI judges approval.

export type ApprovalStatus = "AWAITING_APPROVAL" | "APPROVED" | "INVALIDATED";

export type ApprovalRecord = {
  applicationId: string;
  reviewedFingerprint: string;
  approvedAt: string;
  approver: string;
  status: Extract<"APPROVED", ApprovalStatus>;
};

// cyrb53: tiny, dependency-free, deterministic across Node and browsers.
// Same logical state always yields the same hex fingerprint.
export function hashState(canonical: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

// Stable serialization: sorted keys, one fact per line. Key order in the
// input object cannot change the fingerprint.
export function computeStateFingerprint(values: Record<string, string>): string {
  const canonical = Object.keys(values)
    .sort()
    .map((key) => `${key}=${values[key]}`)
    .join("\n");
  return hashState(canonical);
}

export function grantApproval(input: {
  applicationId: string;
  fingerprint: string;
  approvedAt: string;
  approver?: string;
}): ApprovalRecord {
  return {
    applicationId: input.applicationId,
    reviewedFingerprint: input.fingerprint,
    approvedAt: input.approvedAt,
    approver: input.approver ?? "synthetic-human",
    status: "APPROVED",
  };
}

export type ApprovalCheck =
  | { status: Extract<"APPROVED", ApprovalStatus> }
  | { status: Extract<"INVALIDATED", ApprovalStatus>; reason: string };

// Validity is DERIVED by comparing fingerprints, never assumed from the
// record's existence. A changed state invalidates a prior approval.
export function checkApproval(record: ApprovalRecord | null, currentFingerprint: string): ApprovalCheck {
  if (record === null || record.status !== "APPROVED") {
    return { status: "INVALIDATED", reason: "No granted approval exists for this application." };
  }
  if (record.reviewedFingerprint !== currentFingerprint) {
    return {
      status: "INVALIDATED",
      reason: `Reviewed state ${record.reviewedFingerprint} does not match current state ${currentFingerprint}.`,
    };
  }
  return { status: "APPROVED" };
}

export const SUBMISSION_VALUE_FIELDS: CanonicalField[] = [
  "fullName",
  "dateOfBirth",
  "address",
  "annualFamilyIncome",
  "bankAccountNumber",
  "scholarshipApplicationReference",
];
