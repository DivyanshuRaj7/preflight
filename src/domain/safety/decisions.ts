import type { FieldMapping } from "../mapping/contracts.js";
import type { PreflightResult } from "../contracts.js";
import type { ExecutionResult } from "../execution/contracts.js";
import type { ApprovalCheck } from "../submission/approval.js";
import { categoryOfRule, type FailureCategory } from "./taxonomy.js";

// Safety decision envelope (reliability boundary). Architectural decision:
// UNCERTAIN lives HERE, not in the main lifecycle state machine. Preflight,
// mapping, execution, and approval layers already terminate uncertainty in
// dedicated states (BLOCKED, AMBIGUOUS/UNMAPPED, ESCALATED, INVALIDATED,
// UNKNOWN verdicts); a parallel global UNCERTAIN state would fork every
// consumer for zero new information. Instead this envelope names uncertainty
// explicitly, carries its provenance, and resolves ONLY to existing terminal
// states — UNCERTAIN can never resolve to a success state.

export type SafetyVerdict = "PROCEED" | "BLOCK" | "ESCALATE";
export type Uncertainty = "CERTAIN" | "UNCERTAIN";

// Existing terminal states an uncertain-or-failed decision may resolve to.
// Success states (READY, APPROVED, SUBMITTING, SUBMITTED, VERIFIED, MATCHED)
// are deliberately absent: resolving UNCERTAIN to any of them is forbidden.
const NON_SUCCESS_TERMINALS = [
  "BLOCKED",
  "AMBIGUOUS",
  "UNMAPPED",
  "ESCALATED",
  "FAILED",
  "INVALIDATED",
  "UNKNOWN",
  "UNKNOWN_STATE",
] as const;

export type NonSuccessTerminal = (typeof NON_SUCCESS_TERMINALS)[number];

export type SafetyDecision = {
  verdict: SafetyVerdict;
  uncertainty: Uncertainty;
  category: FailureCategory;
  detector: string;
  ruleId?: string;
  evidenceIds: string[];
  reason: string;
  mapsTo: NonSuccessTerminal;
};

function refuse(
  verdict: Extract<SafetyVerdict, "BLOCK" | "ESCALATE">,
  uncertainty: Uncertainty,
  category: FailureCategory,
  detector: string,
  mapsTo: string,
  reason: string,
  extra?: { ruleId?: string; evidenceIds?: string[] },
): SafetyDecision {
  if (!isUnsafeDestinationOk(mapsTo)) {
    // Structural invariant: a refusal resolves ONLY to an existing
    // non-success terminal. UNCERTAIN (or any refusal) can never become
    // READY, APPROVED, SUBMITTING, or any other success state.
    throw new Error(`Safety invariant violated: refusal cannot resolve to '${mapsTo}'.`);
  }
  return {
    verdict,
    uncertainty,
    category,
    detector,
    ruleId: extra?.ruleId,
    evidenceIds: extra?.evidenceIds ?? [],
    reason,
    mapsTo,
  };
}

function isUnsafeDestinationOk(mapsTo: string): mapsTo is NonSuccessTerminal {
  return (NON_SUCCESS_TERMINALS as readonly string[]).includes(mapsTo);
}

export function blockDecision(
  uncertainty: Uncertainty,
  category: FailureCategory,
  detector: string,
  mapsTo: NonSuccessTerminal,
  reason: string,
  extra?: { ruleId?: string; evidenceIds?: string[] },
): SafetyDecision {
  return refuse("BLOCK", uncertainty, category, detector, mapsTo, reason, extra);
}

export function escalateDecision(
  uncertainty: Uncertainty,
  category: FailureCategory,
  detector: string,
  mapsTo: NonSuccessTerminal,
  reason: string,
  extra?: { ruleId?: string; evidenceIds?: string[] },
): SafetyDecision {
  return refuse("ESCALATE", uncertainty, category, detector, mapsTo, reason, extra);
}

export function isUnsafeDestination(mapsTo: string): boolean {
  return !isUnsafeDestinationOk(mapsTo);
}

// Translators: existing domain outcomes rendered as uniform safety decisions.
// Provenance (detector, rule, evidence) is preserved, never reworded away.
export function decideFromPreflight(result: PreflightResult): SafetyDecision[] {
  if (result.status === "READY") return [];
  return result.issues
    .filter((issue) => issue.blocking)
    .map((issue) =>
      blockDecision("CERTAIN", categoryOfFinding(issue.ruleId), `validateProfile:${issue.ruleId}`, "BLOCKED", issue.message, {
        ruleId: issue.ruleId,
        evidenceIds: issue.evidenceIds,
      }),
    );
}

export function decideFromMapping(mappings: FieldMapping[]): SafetyDecision[] {
  return mappings
    .filter((m) => m.status !== "MATCHED")
    .map((m) =>
      blockDecision(
        m.status === "AMBIGUOUS" ? "UNCERTAIN" : "CERTAIN",
        "MAPPING_FAILURE",
        `DeterministicBaselineProvider:${m.status}`,
        m.status === "AMBIGUOUS" ? "AMBIGUOUS" : "UNMAPPED",
        `Portal field '${m.portalLabel}' ${m.status === "AMBIGUOUS" ? "has multiple plausible meanings" : "matches no canonical field"}; refusing to guess.`,
        { evidenceIds: [] },
      ),
    );
}

export function decideFromExecution(result: ExecutionResult): SafetyDecision[] {
  if (result.status === "VERIFIED" || result.status === "RECOVERED") return [];
  if (result.status === "ESCALATED") {
    return [
      escalateDecision("UNCERTAIN", "STATE_VERIFICATION_FAILURE", "verifyPortalState:UNKNOWN", "ESCALATED", result.failure?.message ?? "Escalated on inconclusive state."),
    ];
  }
  return [
    blockDecision("CERTAIN", "EXECUTION_FAILURE", "finalizeExecution", "FAILED", result.failure?.message ?? "Execution failed."),
  ];
}

export function decideFromApproval(check: ApprovalCheck): SafetyDecision[] {
  if (check.status === "APPROVED") return [];
  return [
    blockDecision("CERTAIN", "AUTHORIZATION_FAILURE", "checkApproval:INVALIDATED", "INVALIDATED", check.reason),
  ];
}

// Local helper kept adjacent to its translators.
function categoryOfFinding(ruleId: string): FailureCategory {
  return categoryOfRule(ruleId);
}
