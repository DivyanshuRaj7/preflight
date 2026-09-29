import type { ApplicantProfile, DocumentType, Evidence } from "../contracts.js";
import type { ExtractionResult } from "../extraction.js";

// Profile assembly (TASK-002). Maps extraction results onto the canonical
// applicant profile shape. This is structural reporting of what was observed,
// NOT validation: it never decides whether the application is valid, ready,
// expired, or mismatched. Those verdicts belong to domain validation
// (TASK-003 and the TASK-001 preflight decision).
//
// - Only non-FAILED results contribute fields. FAILED results contribute nothing.
// - Profile critical fields keep every contributing evidence id and the
//   minimum contributing confidence, so provenance and confidence survive
//   assembly for downstream validation to judge.
// - requiredDocuments reports observed presence ("present" vs "missing") for a
//   caller-supplied required set. Expiry/invalidity cannot be observed by
//   extraction and are never assigned here.

const PROFILE_FIELDS = ["name", "dateOfBirth", "address"] as const;

export type AssembleOptions = {
  version: string;
  requiredDocumentTypes: DocumentType[];
};

export function assembleApplicantProfile(
  results: ExtractionResult[],
  options: AssembleOptions,
): { profile: ApplicantProfile; evidence: Evidence[] } {
  const evidenceById = new Map<string, Evidence>();
  for (const result of results) {
    for (const item of result.evidence) {
      if (!evidenceById.has(item.id)) evidenceById.set(item.id, item);
    }
  }

  const profile = {
    requiredDocuments: {} as Record<DocumentType, "present" | "missing">,
    version: options.version,
  } as ApplicantProfile;

  for (const fieldName of PROFILE_FIELDS) {
    const contributors = results
      .filter((result) => result.status !== "FAILED")
      .flatMap((result) =>
        result.fields
          .filter((field) => field.field === fieldName)
          .map((field) => ({ value: field.value, confidence: field.confidence, evidenceId: field.evidenceId })),
      );
    if (contributors.length === 0) continue;
    profile[fieldName] = {
      value: contributors[0].value,
      evidenceIds: contributors.map((c) => c.evidenceId),
      confidence: Math.min(...contributors.map((c) => c.confidence)),
    };
  }

  for (const documentType of options.requiredDocumentTypes) {
    const observed = results.some(
      (result) => result.documentType === documentType && result.status !== "FAILED",
    );
    profile.requiredDocuments[documentType] = observed ? "present" : "missing";
  }

  return { profile, evidence: [...evidenceById.values()] };
}
