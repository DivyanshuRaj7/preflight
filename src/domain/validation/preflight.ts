import type { ApplicantProfile, Evidence, Finding, PreflightResult } from "../contracts.js";

const CRITICAL_FIELDS = ["name", "dateOfBirth", "address"] as const;

export function validateProfile(
  profile: ApplicantProfile,
  evidence: Evidence[],
  now = new Date().toISOString(),
): PreflightResult {
  const issues: Finding[] = [];
  const byId = new Map(evidence.map((item) => [item.id, item]));

  // Every critical field that is present must cite at least one known evidence id.
  // Unknown or empty provenance can never silently become success.
  for (const field of CRITICAL_FIELDS) {
    const extracted = profile[field];
    if (extracted === undefined) continue;
    const dangling = extracted.evidenceIds.filter((id) => !byId.has(id));
    if (extracted.evidenceIds.length === 0 || dangling.length > 0) {
      issues.push({
        ruleId: "EVIDENCE_PROVENANCE",
        severity: "critical",
        message: `Critical field '${field}' references missing evidence.`,
        evidenceIds: extracted.evidenceIds,
        blocking: true,
      });
    }
  }

  for (const [documentType, status] of Object.entries(profile.requiredDocuments)) {
    if (status === "missing") {
      issues.push({
        ruleId: "REQUIRED_DOCUMENT",
        severity: "error",
        message: `Required document missing: ${documentType}`,
        evidenceIds: [],
        blocking: true,
      });
    }
    if (status === "expired") {
      issues.push({
        ruleId: "DOCUMENT_EXPIRY",
        severity: "error",
        message: `Required document expired: ${documentType}`,
        evidenceIds: [],
        blocking: true,
      });
    }
    if (status === "invalid") {
      issues.push({
        ruleId: "DOCUMENT_INVALID",
        severity: "error",
        message: `Required document invalid: ${documentType}`,
        evidenceIds: [],
        blocking: true,
      });
    }
  }

  return {
    status: issues.some((issue) => issue.blocking) ? "BLOCKED" : "READY",
    issues,
    checkedAt: now,
    profileVersion: profile.version,
  };
}
