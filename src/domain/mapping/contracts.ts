// Semantic mapping contracts (TASK-005C). The canonical profile is the
// stable internal representation; portal wording is external and may drift.
// The mapping layer translates portal vocabulary into canonical fields —
// never the reverse. It performs NO browser I/O, NO network calls, NO LLM
// calls, and fills NOTHING. It answers only: "what does this portal field
// represent?"

// Canonical applicant fields. fullName/dateOfBirth/address correspond to the
// existing profile's name/dateOfBirth/address; the remaining three are the
// canonical names for portal-supplied data (income, bank, reference) whose
// VALUES are resolved by later execution layers — the mapper only names the
// meaning, never the value, and never changes the profile schema.
export type CanonicalField =
  | "fullName"
  | "dateOfBirth"
  | "address"
  | "annualFamilyIncome"
  | "bankAccountNumber"
  | "scholarshipApplicationReference";

// An observed portal field: plain structured data. Deliberately NOT a DOM
// element and NOT a Playwright locator — the mapper never touches a Page.
export type PortalField = {
  id: string;
  label: string;
  inputType: string;
  required: boolean;
};

export type MappingStatus = "MATCHED" | "AMBIGUOUS" | "UNMAPPED";

export type MappingMethod = "EXACT" | "ALIAS" | "SEMANTIC" | "NONE";

export type FieldMapping = {
  portalFieldId: string;
  portalLabel: string;
  canonicalField: CanonicalField | null;
  // Plausible meanings for AMBIGUOUS mappings; used only to explain refusal.
  candidates?: CanonicalField[];
  confidence: number;
  method: MappingMethod;
  status: MappingStatus;
};

// Boundary for a future AI/VLM semantic provider. Deterministic baseline
// results use EXACT (1.0) or ALIAS (0.9); only a SEMANTIC provider may
// return provider-supplied confidence with method SEMANTIC. No implementation
// here requires an API key or network access.
export interface SemanticMappingProvider {
  readonly name: string;
  mapFields(
    canonicalFields: CanonicalField[],
    portalFields: PortalField[],
  ): Promise<FieldMapping[]> | FieldMapping[];
}

export const ALL_CANONICAL_FIELDS: CanonicalField[] = [
  "fullName",
  "dateOfBirth",
  "address",
  "annualFamilyIncome",
  "bankAccountNumber",
  "scholarshipApplicationReference",
];
