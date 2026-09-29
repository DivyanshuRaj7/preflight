import {
  DeterministicStubExtractionProvider,
  type StubDocument,
} from "../adapters/extraction/stub.js";
import { assembleApplicantProfile } from "../domain/profile/assemble.js";
import { validateProfile } from "../domain/validation/preflight.js";
import type {
  ApplicantProfile,
  DocumentStatus,
  DocumentType,
  Evidence,
  PreflightResult,
} from "../domain/contracts.js";
import type { ExtractionResult } from "../domain/extraction.js";

// UI-layer orchestration (TASK-004). This module contains NO validation
// policy and NO extraction heuristics: it only calls domain functions in
// pipeline order over synthetic fixture data.
//
// Fixture evidence IS the synthetic extraction output, so the chain is:
// group evidence by document → run the real ExtractionProvider per document
// → assemble the profile with the real assembler → decide with the real
// validation engine. Every number rendered by the UI comes from these calls.

export const REFERENCE_DATE = "2026-09-30";

export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "identity",
  "marksheet",
  "income-certificate",
  "bank-proof",
  "scholarship-application",
];

export type CaseInput = {
  id: string;
  scenario: string;
  profile: ApplicantProfile;
  evidence: Evidence[];
};

export type CaseDocument = {
  documentId: string | null;
  documentType: DocumentType;
  status: DocumentStatus;
  fieldCount: number;
};

export type PreflightRun = {
  caseId: string;
  scenario: string;
  documents: CaseDocument[];
  results: ExtractionResult[];
  profile: ApplicantProfile;
  evidence: Evidence[];
  decision: PreflightResult;
};

export async function runPreflightCase(input: CaseInput): Promise<PreflightRun> {
  const byDocument = new Map<string, Evidence[]>();
  for (const item of input.evidence) {
    const group = byDocument.get(item.documentId) ?? [];
    group.push(item);
    byDocument.set(item.documentId, group);
  }

  const stubDocuments: Record<string, StubDocument> = {};
  for (const [documentId, items] of byDocument) {
    const typed = items.find((item) => item.documentType !== undefined);
    if (typed?.documentType === undefined) continue;
    const fields: StubDocument["fields"] = {};
    for (const item of items) {
      if (item.field === undefined || item.text === undefined || item.text === "") continue;
      fields[item.field] = {
        text: item.text,
        // Unknown confidence is untrusted, never assumed perfect.
        confidence: item.confidence ?? 0,
        page: item.page,
        bbox: item.bbox,
      };
    }
    stubDocuments[documentId] = { documentType: typed.documentType, condition: "ok", fields };
  }

  const provider = new DeterministicStubExtractionProvider(stubDocuments);
  const results = await Promise.all(
    Object.keys(stubDocuments).map((documentId) => provider.extractDocument({ documentId })),
  );

  const { profile, evidence } = assembleApplicantProfile(results, {
    version: input.profile.version,
    requiredDocumentTypes: REQUIRED_DOCUMENT_TYPES,
  });
  const decision = validateProfile(profile, evidence, {
    referenceDate: REFERENCE_DATE,
    checkedAt: `${REFERENCE_DATE}T00:00:00.000Z`,
  });

  const documents: CaseDocument[] = REQUIRED_DOCUMENT_TYPES.map((documentType) => {
    const result = results.find((r) => r.documentType === documentType && r.status !== "FAILED");
    return {
      documentId: result?.documentId ?? null,
      documentType,
      status: profile.requiredDocuments[documentType],
      fieldCount: result?.fields.length ?? 0,
    };
  });

  return { caseId: input.id, scenario: input.scenario, documents, results, profile, evidence, decision };
}
