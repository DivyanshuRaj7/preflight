import type { ApplicantProfile, Evidence, PreflightResult } from "../contracts.js";
import type { CanonicalField, FieldMapping } from "../mapping/contracts.js";
import type {
  ExecutionFailure,
  ExecutionPlan,
  ExecutionResult,
  FieldPlan,
  VerifiedField,
} from "./contracts.js";

// Pure execution planning + finalization (TASK-005D). No browser, no DOM, no
// I/O. The planner consumes the validation RESULT (never re-validates),
// consumes FieldMapping[] (never maps), and resolves canonical values from
// profile + evidence (never invents them).

export const REQUIRED_EXECUTION_FIELDS: CanonicalField[] = [
  "fullName",
  "dateOfBirth",
  "address",
  "annualFamilyIncome",
  "bankAccountNumber",
  "scholarshipApplicationReference",
];

// Identity facts live on the canonical profile; supplementary amounts and
// identifiers travel as evidence fields until the profile schema grows to
// hold them. Values always come from fixture/domain data, never literals.
export function resolveCanonicalValue(
  field: CanonicalField,
  profile: ApplicantProfile,
  evidence: Evidence[],
): string | undefined {
  switch (field) {
    case "fullName":
      return profile.name?.value;
    case "dateOfBirth":
      return profile.dateOfBirth?.value;
    case "address":
      return profile.address?.value;
    case "annualFamilyIncome":
    case "bankAccountNumber":
    case "scholarshipApplicationReference": {
      const items = evidence.filter((e) => e.field === field && e.text !== undefined && e.text !== "");
      if (items.length === 0) return undefined;
      return [...items].sort((a, b) => (a.id < b.id ? -1 : 1))[0].text;
    }
  }
}

function fail(reason: ExecutionFailure["reason"], message: string, extra?: Partial<ExecutionFailure>): ExecutionFailure {
  return { reason, message, ...extra };
}

export function buildExecutionPlan(
  preflight: PreflightResult,
  profile: ApplicantProfile,
  evidence: Evidence[],
  mappings: FieldMapping[],
  required: CanonicalField[] = REQUIRED_EXECUTION_FIELDS,
): { plan: ExecutionPlan } | { failure: ExecutionFailure } {
  if (preflight.status !== "READY") {
    return {
      failure: fail(
        "BLOCKED_PREFLIGHT",
        `Execution refused: preflight status is ${preflight.status}, required READY. No browser interaction occurred.`,
      ),
    };
  }
  if (preflight.profileVersion !== profile.version) {
    return {
      failure: fail(
        "PROFILE_VERSION_MISMATCH",
        `Execution refused: preflight version ${preflight.profileVersion} does not match profile version ${profile.version}.`,
      ),
    };
  }
  const fields: FieldPlan[] = [];
  for (const canonical of required) {
    const matched = mappings.find((m) => m.canonicalField === canonical && m.status === "MATCHED");
    if (!matched) {
      const ambiguous = mappings.find((m) => m.status === "AMBIGUOUS" && (m.candidates ?? []).includes(canonical));
      if (ambiguous) {
        return {
          failure: fail(
            "AMBIGUOUS_REQUIRED_FIELD",
            `Execution refused: mapping for required field '${canonical}' is ambiguous and will not be guessed.`,
            { canonicalField: canonical, portalFieldId: ambiguous.portalFieldId },
          ),
        };
      }
      return {
        failure: fail("UNMAPPED_REQUIRED_FIELD", `Execution refused: no safe mapping for required field '${canonical}'.`, {
          canonicalField: canonical,
        }),
      };
    }
    const value = resolveCanonicalValue(canonical, profile, evidence);
    if (value === undefined) {
      return {
        failure: fail("MISSING_VALUE", `Execution refused: no canonical value for required field '${canonical}'.`, {
          canonicalField: canonical,
          portalFieldId: matched.portalFieldId,
        }),
      };
    }
    fields.push({
      canonicalField: canonical,
      portalFieldId: matched.portalFieldId,
      portalLabel: matched.portalLabel,
      value,
    });
  }
  return { plan: { profileVersion: profile.version, fields } };
}

export type FieldObservation = { portalFieldId: string; observed: string };

// Compares independently read-back DOM values against the plan. COMPLETION ≠
// CORRECTNESS: any mismatch fails execution and forbids Save Draft.
export function finalizeExecution(
  plan: ExecutionPlan,
  observations: FieldObservation[],
  saveDraftSucceeded: boolean,
): ExecutionResult {
  const byId = new Map(observations.map((o) => [o.portalFieldId, o.observed]));
  const verified: VerifiedField[] = [];
  for (const field of plan.fields) {
    const observed = byId.get(field.portalFieldId);
    if (observed === undefined) {
      return {
        status: "FAILED",
        plan,
        verified,
        saveDraftSucceeded: false,
        portalState: null,
        failure: fail("VERIFICATION_MISMATCH", `Field '${field.canonicalField}' was never observed in the DOM.`, {
          canonicalField: field.canonicalField,
          portalFieldId: field.portalFieldId,
          expected: field.value,
        }),
      };
    }
    const ok = observed === field.value;
    verified.push({
      canonicalField: field.canonicalField,
      portalFieldId: field.portalFieldId,
      expected: field.value,
      observed,
      verified: ok,
    });
    if (!ok) {
      return {
        status: "FAILED",
        plan,
        verified,
        saveDraftSucceeded: false,
        portalState: null,
        failure: fail(
          "VERIFICATION_MISMATCH",
          `Field '${field.canonicalField}' differs: expected ${JSON.stringify(field.value)}, observed ${JSON.stringify(observed)}. Save Draft forbidden.`,
          {
            canonicalField: field.canonicalField,
            portalFieldId: field.portalFieldId,
            expected: field.value,
            observed,
          },
        ),
      };
    }
  }
  if (!saveDraftSucceeded) {
    return {
      status: "FAILED",
      plan,
      verified,
      saveDraftSucceeded: false,
      portalState: null,
      failure: fail("SAVE_DRAFT_FAILED", "Save Draft did not reach SAVED state."),
    };
  }
  return { status: "VERIFIED", plan, verified, saveDraftSucceeded: true, portalState: "SAVED", failure: null };
}
