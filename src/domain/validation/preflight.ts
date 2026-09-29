import type {
  ApplicantProfile,
  DocumentType,
  Evidence,
  Finding,
  PreflightResult,
} from "../contracts.js";

// Deterministic validation engine (TASK-003). Pure function of its inputs:
// identical input always yields identical status, finding IDs, finding order,
// severity, evidence references, remediation, and structure.
//
// Forbidden inside: Date.now(), new Date() for implicit current time,
// Math.random(), UUIDs, network access, environment-dependent behavior.
// Any date the engine needs (expiry evaluation, checkedAt) is supplied
// explicitly via ValidationOptions.

export type ValidationOptions = {
  // Evaluation date as YYYY-MM-DD. Controls expiry behavior. When absent,
  // the DOCUMENT_EXPIRED rule is skipped (documented, deterministic).
  referenceDate?: string;
  // Observation timestamp. Defaults to the reference date at midnight UTC so
  // output never depends on the system clock.
  checkedAt?: string;
  // Document types that must carry verifiable, unexpired validity evidence.
  validityRequired?: DocumentType[];
  // Critical profile fields below this confidence are blocked, never trusted.
  lowConfidenceThreshold?: number;
};

export const DEFAULT_VALIDITY_REQUIRED: DocumentType[] = ["income-certificate"];
export const LOW_CONFIDENCE_THRESHOLD = 0.75;
export const EXPIRY_EVIDENCE_FIELD = "expiryDate";

const CRITICAL_FIELDS = ["name", "dateOfBirth", "address"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeLoose(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeStrict(value: string): string {
  return value.trim();
}

function distinctSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function validateProfile(
  profile: ApplicantProfile,
  evidence: Evidence[],
  options: ValidationOptions = {},
): PreflightResult {
  const issues: Finding[] = [];
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const referenceDate = options.referenceDate;
  const validityRequired = options.validityRequired ?? DEFAULT_VALIDITY_REQUIRED;
  const lowConfidenceThreshold = options.lowConfidenceThreshold ?? LOW_CONFIDENCE_THRESHOLD;

  // 1. Provenance: every present critical field must cite known evidence.
  for (const field of CRITICAL_FIELDS) {
    const extracted = profile[field];
    if (extracted === undefined) continue;
    const dangling = extracted.evidenceIds.filter((id) => !byId.has(id));
    if (extracted.evidenceIds.length === 0 || dangling.length > 0) {
      issues.push({
        ruleId: "EVIDENCE_PROVENANCE",
        severity: "critical",
        message: `Critical field '${field}' references missing evidence.`,
        remediation: `Attach valid source evidence for '${field}' and re-run preflight.`,
        field,
        evidenceIds: extracted.evidenceIds,
        blocking: true,
      });
    }
  }

  // 2-3. Required documents: missing and invalid block deterministically,
  // in requiredDocuments order.
  for (const [documentType, status] of Object.entries(profile.requiredDocuments)) {
    if (status === "missing") {
      issues.push({
        ruleId: "MISSING_REQUIRED_DOCUMENT",
        severity: "error",
        message: `Required document missing: ${documentType}.`,
        remediation: `Provide the ${documentType} document and re-run preflight.`,
        evidenceIds: [],
        blocking: true,
      });
    }
    if (status === "invalid") {
      issues.push({
        ruleId: "DOCUMENT_INVALID",
        severity: "error",
        message: `Required document invalid: ${documentType}.`,
        remediation: `Replace the invalid ${documentType} document and re-run preflight.`,
        evidenceIds: [],
        blocking: true,
      });
    }
    if (status === "expired") {
      issues.push({
        ruleId: "DOCUMENT_EXPIRED",
        severity: "error",
        message: `Required document expired: ${documentType}.`,
        remediation: `Provide a renewed ${documentType} with a validity date on or after the evaluation date.`,
        evidenceIds: [],
        blocking: true,
      });
    }
  }

  // 4. Expiry / freshness from evidence. Only "present" documents are
  // examined here ("missing"/"expired"/"invalid" statuses already reported
  // above). A validity-required document with missing, unparseable, or past
  // expiry evidence is BLOCKED: unverifiable freshness is never trusted.
  if (referenceDate !== undefined) {
    for (const documentType of validityRequired) {
      if (profile.requiredDocuments[documentType] !== "present") continue;
      const dated = evidence
        .filter((item) => item.documentType === documentType && item.field === EXPIRY_EVIDENCE_FIELD)
        .map((item) => ({ id: item.id, raw: (item.text ?? "").trim() }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const expired = dated.filter((d) => ISO_DATE.test(d.raw) && d.raw < referenceDate);
      const unverifiable = dated.filter((d) => !ISO_DATE.test(d.raw));
      if (dated.length === 0) {
        issues.push({
          ruleId: "DOCUMENT_EXPIRED",
          severity: "error",
          message: `Document ${documentType} requires validity but has no verifiable expiry evidence.`,
          remediation: `Provide a renewed ${documentType} with a validity date on or after the evaluation date.`,
          evidenceIds: [],
          blocking: true,
        });
      } else if (expired.length > 0) {
        issues.push({
          ruleId: "DOCUMENT_EXPIRED",
          severity: "error",
          message: `Document ${documentType} expired on ${distinctSorted(expired.map((d) => d.raw)).join(", ")}.`,
          remediation: `Provide a renewed ${documentType} with a validity date on or after the evaluation date.`,
          evidenceIds: expired.map((d) => d.id),
          blocking: true,
        });
      } else if (unverifiable.length > 0) {
        issues.push({
          ruleId: "DOCUMENT_EXPIRED",
          severity: "error",
          message: `Document ${documentType} has an unverifiable expiry value: ${distinctSorted(unverifiable.map((d) => `"${d.raw}"`)).join(", ")}.`,
          remediation: `Provide a renewed ${documentType} with a validity date on or after the evaluation date.`,
          evidenceIds: unverifiable.map((d) => d.id),
          blocking: true,
        });
      }
    }
  }

  // 5-7. Cross-document consistency from evidence texts. Distinct normalized
  // values for the same field across evidence become one blocking finding
  // each, citing every involved evidence id (sorted).
  issues.push(...checkFieldAgreement(evidence, "name", "NAME_MISMATCH", normalizeLoose, "Name"));
  issues.push(...checkFieldAgreement(evidence, "dateOfBirth", "DOB_MISMATCH", normalizeStrict, "Date of birth"));
  issues.push(...checkFieldAgreement(evidence, "address", "ADDRESS_MISMATCH", normalizeLoose, "Address"));

  // 8. Low-confidence critical fields are blocked, never silently trusted.
  // Confidence survives assembly as the minimum contributor, so this check
  // sees the weakest link. Original evidence and confidence are preserved
  // in the finding.
  for (const field of CRITICAL_FIELDS) {
    const extracted = profile[field];
    if (extracted === undefined) continue;
    if (extracted.confidence !== undefined && extracted.confidence < lowConfidenceThreshold) {
      issues.push({
        ruleId: "LOW_CONFIDENCE_CRITICAL_FIELD",
        severity: "critical",
        message: `Critical field '${field}' has low extraction confidence (${extracted.confidence}).`,
        remediation: `Re-capture or manually verify the ${field} evidence and re-run preflight.`,
        field,
        evidenceIds: [...extracted.evidenceIds].sort(),
        blocking: true,
      });
    }
  }

  return {
    status: issues.some((issue) => issue.blocking) ? "BLOCKED" : "READY",
    issues,
    checkedAt: options.checkedAt ?? `${referenceDate ?? "1970-01-01"}T00:00:00.000Z`,
    profileVersion: profile.version,
  };
}

function checkFieldAgreement(
  evidence: Evidence[],
  field: string,
  ruleId: string,
  normalize: (value: string) => string,
  label: string,
): Finding[] {
  const candidates = evidence.filter(
    (item) => item.field === field && item.text !== undefined && normalize(item.text) !== "",
  );
  const groups = new Map<string, { raw: string; ids: string[] }>();
  for (const item of candidates) {
    const key = normalize(item.text as string);
    const group = groups.get(key) ?? { raw: (item.text as string).trim(), ids: [] };
    group.ids.push(item.id);
    groups.set(key, group);
  }
  if (groups.size <= 1) return [];
  const values = distinctSorted([...groups.values()].map((g) => `"${g.raw}"`));
  const ids = distinctSorted([...groups.values()].flatMap((g) => g.ids));
  return [
    {
      ruleId,
      severity: "critical",
      message: `${label} differs across documents: ${values.join(" vs ")}.`,
      remediation: `Ensure the applicant ${field} matches across all documents; correct the source document and re-run preflight.`,
      field,
      evidenceIds: ids,
      blocking: true,
    },
  ];
}
