import type {
  CanonicalField,
  FieldMapping,
  PortalField,
  SemanticMappingProvider,
} from "./contracts.js";

// Deterministic baseline mapper (TASK-005C). Safety over recall: matching is
// FULL normalized-string equality against an explicit table — never substring
// or fuzzy matching. Anything not explicitly listed is UNMAPPED; anything
// explicitly ambiguous is AMBIGUOUS. A wrong confident mapping is worse than
// no mapping, so uncertainty never becomes a match.
export const EXACT_CONFIDENCE = 1.0;
export const ALIAS_CONFIDENCE = 0.9;

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

// Primary (EXACT) label per canonical field.
const PRIMARY_LABELS: Record<CanonicalField, string> = {
  fullName: "full name",
  dateOfBirth: "date of birth",
  address: "address",
  annualFamilyIncome: "annual family income",
  bankAccountNumber: "bank account number",
  scholarshipApplicationReference: "scholarship application reference",
};

// Known aliases: normalized portal label → canonical field. Deliberately
// conservative — "account holder name" is absent on purpose and stays UNMAPPED.
const ALIASES: Record<string, CanonicalField> = {
  "applicant name": "fullName",
  "legal name": "fullName",
  "applicant legal name": "fullName",
  "name": "fullName",
  dob: "dateOfBirth",
  "birth date": "dateOfBirth",
  "family income": "annualFamilyIncome",
  income: "annualFamilyIncome",
  "annual income": "annualFamilyIncome",
  "account number": "bankAccountNumber",
  "bank account": "bankAccountNumber",
  "bank account no": "bankAccountNumber",
  "application reference": "scholarshipApplicationReference",
  "scholarship reference": "scholarshipApplicationReference",
};

// Labels that name a real concept but could mean more than one canonical
// field. "Reference" alone could be the scholarship reference or another
// identifier, so it MUST NOT resolve silently. Candidates explain the
// refusal; they never authorize a fill.
const AMBIGUOUS_LABELS: Record<string, CanonicalField[]> = {
  reference: ["scholarshipApplicationReference"],
  ref: ["scholarshipApplicationReference"],
  id: ["bankAccountNumber", "scholarshipApplicationReference"],
  number: ["annualFamilyIncome", "bankAccountNumber"],
  detail: [],
  details: [],
  info: [],
};

export function mapPortalField(field: PortalField): FieldMapping {
  const normalized = normalizeLabel(field.label);
  const base = {
    portalFieldId: field.id,
    portalLabel: field.label,
  };
  if (normalized in AMBIGUOUS_LABELS) {
    return {
      ...base,
      canonicalField: null,
      candidates: AMBIGUOUS_LABELS[normalized],
      confidence: 0,
      method: "NONE",
      status: "AMBIGUOUS",
    };
  }
  for (const [canonical, primary] of Object.entries(PRIMARY_LABELS) as [CanonicalField, string][]) {
    if (normalized === primary) {
      return { ...base, canonicalField: canonical, confidence: EXACT_CONFIDENCE, method: "EXACT", status: "MATCHED" };
    }
  }
  const aliased = ALIASES[normalized];
  if (aliased !== undefined) {
    return { ...base, canonicalField: aliased, confidence: ALIAS_CONFIDENCE, method: "ALIAS", status: "MATCHED" };
  }
  return { ...base, canonicalField: null, confidence: 0, method: "NONE", status: "UNMAPPED" };
}

export function mapPortalFields(fields: PortalField[]): FieldMapping[] {
  return fields.map(mapPortalField);
}

// Baseline provider: runs the deterministic mapper behind the future
// SemanticMappingProvider boundary. The only provider that runs in TASK-005C.
export class DeterministicBaselineProvider implements SemanticMappingProvider {
  readonly name = "deterministic-baseline";

  mapFields(_canonicalFields: CanonicalField[], portalFields: PortalField[]): FieldMapping[] {
    return mapPortalFields(portalFields);
  }
}
