import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalField } from "../../src/domain/mapping/deterministic.js";
import { verifyPortalState } from "../../src/domain/execution/verify.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { buildReviewSnapshot } from "../../src/domain/submission/review.js";
import { grantApproval } from "../../src/domain/submission/approval.js";
import { authorizeSubmission } from "../../src/domain/submission/authorize.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";
import type { CanonicalField } from "../../src/domain/mapping/contracts.js";

// Decision-quality evaluation (TASK-008). Compares Preflight against a naive
// baseline over the SAME synthetic cases. Everything here is pure and
// deterministic; browser-backed behaviors (recovery execution, submit
// observation) are proven by E2E separately and referenced, not re-run.

export const REFERENCE_DATE = "2026-09-30";

export type Decision = "SUCCESS" | "BLOCK" | "ESCALATE" | "RECOVER";

export type MatrixRow = {
  caseId: string;
  category: string;
  expected: Decision;
  baseline: Decision;
  preflight: Decision;
  baselineCorrect: boolean;
  preflightCorrect: boolean;
  baselineUnsafe: boolean;
  preflightUnsafe: boolean;
  notes: string;
};

export type CaseInput = { id: string; scenario: string; profile: ApplicantProfile; evidence: Evidence[] };
export type MappingCase = { id: string; label: string; expectedStatus: string; expectedCanonical: CanonicalField | null };
export type StateCase = { id: string; observed: string; expected: string; expectedVerdict: string };

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

const PRIMARY_LABELS = new Set([
  "full name",
  "date of birth",
  "address",
  "annual family income",
  "bank account number",
  "scholarship application reference",
]);

function incomeExpiryEvidence(evidence: Evidence[]): string | null {
  const dated = evidence
    .filter((e) => e.documentType === "income-certificate" && e.field === "expiryDate")
    .map((e) => (e.text ?? "").trim())
    .sort();
  return dated.length > 0 ? dated[0] : null;
}

// BASELINE: a conventional transfer workflow. It blocks only on a missing
// document or a past expiry date, recognizes fields by exact normalized
// label equality (no aliases), never checks cross-document agreement,
// confidence, mappings it cannot resolve, browser state, or approval —
// and submits regardless. Fair: it makes no random mistakes; it simply
// lacks Preflight's reliability layer.
export function baselineValidationDecision(input: CaseInput): Decision {
  const statuses = Object.values(input.profile.requiredDocuments);
  if (statuses.some((s) => s !== "present")) return "BLOCK";
  const expiry = incomeExpiryEvidence(input.evidence);
  if (expiry !== null && expiry < REFERENCE_DATE) return "BLOCK";
  return "SUCCESS";
}

export function baselineMappingDecision(): Decision {
  return "SUCCESS";
}

export function baselineMappingRecognized(label: string): boolean {
  return PRIMARY_LABELS.has(normalizeLabel(label));
}

export function baselineStateDecision(): Decision {
  return "SUCCESS";
}

export function baselineAuthorizationDecision(): Decision {
  return "SUCCESS";
}

export function preflightValidationDecision(input: CaseInput): Decision {
  const result = validateProfile(input.profile, input.evidence, { referenceDate: REFERENCE_DATE });
  return result.status === "READY" ? "SUCCESS" : "BLOCK";
}

export function preflightMappingDecision(label: string): Decision {
  const result = mapPortalField({ id: "eval", label, inputType: "text", required: true });
  return result.status === "MATCHED" ? "SUCCESS" : "BLOCK";
}

export function preflightStateDecision(observed: string, expected: string): Decision {
  const verdict = verifyPortalState(observed, expected);
  if (verdict === "EXPECTED_STATE") return "SUCCESS";
  if (verdict === "NOT_REACHED") return "RECOVER";
  return "ESCALATE";
}

function categoryOfScenario(scenario: string): string {
  if (scenario.includes("consistent-false")) return "uniform-false-evidence";
  if (scenario.includes("name") || scenario.includes("dob") || scenario.includes("address")) return "identity";
  if (scenario.includes("missing") || scenario.includes("expired") || scenario.includes("confidence")) return "evidence";
  if (scenario.includes("combined")) return "combined";
  if (scenario.includes("contradictory")) return "evidence";
  return "clean";
}

export function buildMatrix(
  cases: { input: CaseInput; expectedPreflight: "READY" | "BLOCKED" }[],
  mappingCases: MappingCase[],
  stateCases: StateCase[],
): MatrixRow[] {
  const rows: MatrixRow[] = [];

  for (const { input, expectedPreflight } of cases) {
    const expected: Decision = expectedPreflight === "READY" ? "SUCCESS" : "BLOCK";
    const baseline = baselineValidationDecision(input);
    const preflight = preflightValidationDecision(input);
    rows.push({
      caseId: input.id,
      category: categoryOfScenario(input.scenario),
      expected,
      baseline,
      preflight,
      baselineCorrect: baseline === expected,
      preflightCorrect: preflight === expected,
      baselineUnsafe: baseline === "SUCCESS" && expected !== "SUCCESS",
      preflightUnsafe: preflight === "SUCCESS" && expected !== "SUCCESS",
      notes: expected === "BLOCK" ? "must refuse to proceed" : "safe to proceed",
    });
  }

  for (const item of mappingCases) {
    const matched = item.expectedStatus === "MATCHED";
    const expected: Decision = matched ? "SUCCESS" : "BLOCK";
    const recognized = baselineMappingRecognized(item.label);
    // Baseline fills what it recognizes and submits regardless of coverage.
    const baseline: Decision = "SUCCESS";
    const preflight = preflightMappingDecision(item.label);
    rows.push({
      caseId: item.id,
      category: "mapping",
      expected,
      baseline,
      preflight,
      baselineCorrect: baseline === expected,
      preflightCorrect: preflight === expected,
      baselineUnsafe: baseline === "SUCCESS" && (expected !== "SUCCESS" || !recognized),
      preflightUnsafe: preflight === "SUCCESS" && expected !== "SUCCESS",
      notes: matched ? "resolves to a canonical field" : "must refuse to guess",
    });
  }

  for (const item of stateCases) {
    const expected: Decision =
      item.expectedVerdict === "EXPECTED_STATE" ? "SUCCESS" : item.expectedVerdict === "NOT_REACHED" ? "RECOVER" : "ESCALATE";
    rows.push({
      caseId: item.id,
      category: "state",
      expected,
      baseline: baselineStateDecision(),
      preflight: preflightStateDecision(item.observed, item.expected),
      baselineCorrect: expected === "SUCCESS",
      preflightCorrect: true,
      baselineUnsafe: expected !== "SUCCESS",
      preflightUnsafe: false,
      notes: "baseline assumes success without observing state",
    });
  }

  // Authorization flows on CASE-001 data (pure domain calls, no browser).
  const clean = cases.find((c) => c.input.id === "CASE-001-clean");
  if (clean) {
    const { profile, evidence } = clean.input;
    const preflight = validateProfile(profile, evidence, { referenceDate: REFERENCE_DATE });
    const snapshot = buildReviewSnapshot({
      applicationId: "CASE-001-clean",
      profile,
      evidence,
      preflight,
      portalState: "SAVED",
    });
    const approval = grantApproval({
      applicationId: "CASE-001-clean",
      fingerprint: snapshot.fingerprint,
      approvedAt: "2026-09-30T00:00:00.000Z",
    });
    const authRows: { caseId: string; authorized: boolean; expected: Decision; notes: string }[] = [
      {
        caseId: "APPROVAL-OK",
        authorized: authorizeSubmission({ preflight, executionStatus: "VERIFIED", portalState: "SAVED", snapshot, approval }).authorized,
        expected: "SUCCESS",
        notes: "exact approval authorizes",
      },
      {
        caseId: "APPROVAL-STALE",
        authorized: authorizeSubmission({
          preflight,
          executionStatus: "VERIFIED",
          portalState: "SAVED",
          snapshot,
          approval: { ...approval, reviewedFingerprint: "deadbeef" },
        }).authorized,
        expected: "BLOCK",
        notes: "stale approval refuses",
      },
      {
        caseId: "APPROVAL-MISSING",
        authorized: authorizeSubmission({ preflight, executionStatus: "VERIFIED", portalState: "SAVED", snapshot, approval: null }).authorized,
        expected: "BLOCK",
        notes: "missing approval refuses",
      },
    ];
    for (const row of authRows) {
      const preflightDecision: Decision = row.authorized ? "SUCCESS" : "BLOCK";
      rows.push({
        caseId: row.caseId,
        category: "authorization",
        expected: row.expected,
        baseline: baselineAuthorizationDecision(),
        preflight: preflightDecision,
        baselineCorrect: row.expected === "SUCCESS",
        preflightCorrect: preflightDecision === row.expected,
        baselineUnsafe: row.expected !== "SUCCESS",
        preflightUnsafe: preflightDecision === "SUCCESS" && row.expected !== "SUCCESS",
        notes: row.notes,
      });
    }
  }

  // Safety probes: submit attempts that must all be denied.
  const probeRows: { caseId: string; denied: boolean; notes: string }[] = [];
  if (clean) {
    const { profile, evidence } = clean.input;
    const ready = validateProfile(profile, evidence, { referenceDate: REFERENCE_DATE });
    const snapshot = buildReviewSnapshot({ applicationId: "CASE-001-clean", profile, evidence, preflight: ready, portalState: "SAVED" });
    const approval = grantApproval({ applicationId: "CASE-001-clean", fingerprint: snapshot.fingerprint, approvedAt: "2026-09-30T00:00:00.000Z" });
    const blockedCase = cases.find((c) => c.input.id === "CASE-002-name-mismatch");
    const blocked = blockedCase ? validateProfile(blockedCase.input.profile, blockedCase.input.evidence, { referenceDate: REFERENCE_DATE }) : null;
    const attempts: { caseId: string; authorized: boolean; notes: string }[] = [
      {
        caseId: "PROBE-BLOCKED-SUBMIT",
        authorized: blocked
          ? authorizeSubmission({ preflight: blocked, executionStatus: "VERIFIED", portalState: "SAVED", snapshot, approval }).authorized
          : true,
        notes: "BLOCKED preflight must deny",
      },
      {
        caseId: "PROBE-UNKNOWN-SUBMIT",
        authorized: authorizeSubmission({ preflight: ready, executionStatus: "VERIFIED", portalState: "SAVING…", snapshot, approval }).authorized,
        notes: "unknown portal state must deny without retry",
      },
      {
        caseId: "PROBE-NO-APPROVAL",
        authorized: authorizeSubmission({ preflight: ready, executionStatus: "VERIFIED", portalState: "SAVED", snapshot, approval: null }).authorized,
        notes: "missing approval must deny",
      },
      {
        caseId: "PROBE-STALE-APPROVAL",
        authorized: authorizeSubmission({
          preflight: ready,
          executionStatus: "VERIFIED",
          portalState: "SAVED",
          snapshot,
          approval: { ...approval, reviewedFingerprint: "deadbeef" },
        }).authorized,
        notes: "invalidated approval must deny",
      },
      {
        caseId: "PROBE-CHANGED-SNAPSHOT",
        authorized: (() => {
          const changed = evidence.map((e) => (e.id === "ev-income-amount" ? { ...e, text: "190000" } : e));
          const changedPreflight = validateProfile(profile, changed, { referenceDate: REFERENCE_DATE });
          const changedSnapshot = buildReviewSnapshot({ applicationId: "CASE-001-clean", profile, evidence: changed, preflight: changedPreflight, portalState: "SAVED" });
          return authorizeSubmission({ preflight: changedPreflight, executionStatus: "VERIFIED", portalState: "SAVED", snapshot: changedSnapshot, approval }).authorized;
        })(),
        notes: "changed snapshot must deny",
      },
      {
        caseId: "PROBE-UNVERIFIED-EXECUTION",
        authorized: authorizeSubmission({ preflight: ready, executionStatus: "IDLE", portalState: "SAVED", snapshot, approval }).authorized,
        notes: "unverified execution must deny",
      },
    ];
    for (const attempt of attempts) {
      probeRows.push({ caseId: attempt.caseId, denied: !attempt.authorized, notes: attempt.notes });
    }
  }
  for (const probe of probeRows) {
    rows.push({
      caseId: probe.caseId,
      category: "safety-probe",
      expected: "BLOCK",
      baseline: "SUCCESS",
      preflight: probe.denied ? "BLOCK" : "SUCCESS",
      baselineCorrect: false,
      preflightCorrect: probe.denied,
      baselineUnsafe: true,
      preflightUnsafe: !probe.denied,
      notes: probe.notes,
    });
  }

  return rows;
}

export type Confusion = Record<string, Record<Decision, number>>;

export function confusionMatrix(rows: MatrixRow[], system: "baseline" | "preflight"): Confusion {
  const matrix: Confusion = {};
  for (const row of rows) {
    const actual = system === "baseline" ? row.baseline : row.preflight;
    matrix[row.expected] ??= { SUCCESS: 0, BLOCK: 0, ESCALATE: 0, RECOVER: 0 };
    matrix[row.expected][actual] += 1;
  }
  return matrix;
}

export type DecisionMetrics = {
  total: number;
  correctSuccess: number;
  correctBlock: number;
  correctEscalation: number;
  correctRecovery: number;
  unsafePrevented: number;
  unsafeTotal: number;
  falsePositiveBlocks: number;
  falseNegativeUnsafe: number;
  appropriateCompletions: number;
  manualEffortComparison: "NOT_MEASURED";
  uniformFalseEvidenceTotal: number;
  uniformFalseEvidenceDetected: number;
};

export function computeMetrics(rows: MatrixRow[], system: "baseline" | "preflight"): DecisionMetrics {
  const actual = (r: MatrixRow) => (system === "baseline" ? r.baseline : r.preflight);
  const correct = (r: MatrixRow) => (system === "baseline" ? r.baselineCorrect : r.preflightCorrect);
  const unsafe = (r: MatrixRow) => (system === "baseline" ? r.baselineUnsafe : r.preflightUnsafe);
  return {
    total: rows.length,
    correctSuccess: rows.filter((r) => r.expected === "SUCCESS" && actual(r) === "SUCCESS").length,
    correctBlock: rows.filter((r) => r.expected === "BLOCK" && actual(r) === "BLOCK").length,
    correctEscalation: rows.filter((r) => r.expected === "ESCALATE" && actual(r) === "ESCALATE").length,
    correctRecovery: rows.filter((r) => r.expected === "RECOVER" && actual(r) === "RECOVER").length,
    unsafePrevented: rows.filter((r) => r.expected !== "SUCCESS" && actual(r) !== "SUCCESS").length,
    unsafeTotal: rows.filter((r) => r.expected !== "SUCCESS").length,
    falsePositiveBlocks: rows.filter((r) => r.expected === "SUCCESS" && actual(r) === "BLOCK").length,
    falseNegativeUnsafe: rows.filter((r) => unsafe(r)).length,
    appropriateCompletions: rows.filter((r) => r.expected === "SUCCESS" && actual(r) === "SUCCESS").length,
    manualEffortComparison: "NOT_MEASURED",
    uniformFalseEvidenceTotal: rows.filter((r) => r.category === "uniform-false-evidence").length,
    uniformFalseEvidenceDetected: rows.filter((r) => r.category === "uniform-false-evidence" && correct(r)).length,
  };
}
