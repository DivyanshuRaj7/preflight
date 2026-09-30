// State verification + recovery policy (TASK-006). Pure and deterministic.
// The browser's OBSERVED state is the source of truth — "Playwright did not
// throw" is never proof of success.

export type StateVerdict = "EXPECTED_STATE" | "NOT_REACHED" | "UNKNOWN";

export type RecoveryDecision = "COMPLETE" | "RETRY_ONCE" | "ESCALATE";

export const MAX_RECOVERY_ATTEMPTS = 1;

export function verifyPortalState(observed: string | null, expected: string): StateVerdict {
  if (observed === expected) return "EXPECTED_STATE";
  if (observed === null || observed.trim() === "") return "UNKNOWN";
  // Only the previously-known safe state counts as a confirmed miss.
  // Anything else is inconclusive: neither success nor confirmed failure.
  if (observed === "DRAFT") return "NOT_REACHED";
  return "UNKNOWN";
}

// Bounded and explicit: at most MAX_RECOVERY_ATTEMPTS, only for a confirmed
// miss. UNKNOWN never retries — uncertainty escalates, always.
export function decideRecoveryPolicy(
  verdict: StateVerdict,
  recoveriesUsed: number,
  maxRecoveries: number = MAX_RECOVERY_ATTEMPTS,
): RecoveryDecision {
  if (verdict === "EXPECTED_STATE") return "COMPLETE";
  if (verdict === "UNKNOWN") return "ESCALATE";
  return recoveriesUsed < maxRecoveries ? "RETRY_ONCE" : "ESCALATE";
}
