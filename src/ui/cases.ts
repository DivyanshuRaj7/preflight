import manifest from "../../fixtures/manifest.json" with { type: "json" };
import case001 from "../../fixtures/cases/CASE-001-clean/case.json" with { type: "json" };
import case002 from "../../fixtures/cases/CASE-002-name-mismatch/case.json" with { type: "json" };
import case003 from "../../fixtures/cases/CASE-003-dob-mismatch/case.json" with { type: "json" };
import case004 from "../../fixtures/cases/CASE-004-missing-income-certificate/case.json" with { type: "json" };
import case005 from "../../fixtures/cases/CASE-005-expired-certificate/case.json" with { type: "json" };
import case006 from "../../fixtures/cases/CASE-006-low-confidence-extraction/case.json" with { type: "json" };
import case007 from "../../fixtures/cases/CASE-007-address-mismatch/case.json" with { type: "json" };
import case008 from "../../fixtures/cases/CASE-008-combined-failures/case.json" with { type: "json" };
import case009 from "../../fixtures/cases/CASE-009-contradictory-evidence/case.json" with { type: "json" };
import case011 from "../../fixtures/cases/CASE-011-consistent-false-evidence/case.json" with { type: "json" };
import type { CaseInput } from "./pipeline.js";

const byId: Record<string, unknown> = {
  "CASE-001-clean": case001,
  "CASE-002-name-mismatch": case002,
  "CASE-003-dob-mismatch": case003,
  "CASE-004-missing-income-certificate": case004,
  "CASE-005-expired-certificate": case005,
  "CASE-006-low-confidence-extraction": case006,
  "CASE-007-address-mismatch": case007,
  "CASE-008-combined-failures": case008,
  "CASE-009-contradictory-evidence": case009,
  "CASE-011-consistent-false-evidence": case011,
};

function assertCaseInput(id: string, raw: unknown): CaseInput {
  const candidate = raw as Partial<CaseInput>;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    candidate.id !== id ||
    typeof candidate.scenario !== "string" ||
    typeof candidate.profile !== "object" ||
    !Array.isArray(candidate.evidence)
  ) {
    throw new Error(`Invalid synthetic case fixture: ${id}`);
  }
  return candidate as CaseInput;
}

// Cases in manifest order. A UI test pins this list to the manifest so the
// demo set can never silently drift from ground truth.
export const CASES: CaseInput[] = (
  manifest as { cases: { id: string }[] }
).cases.map((entry) => assertCaseInput(entry.id, byId[entry.id]));

// Curated Synthetic Demo list: the six judge-facing scenarios. Evaluation
// and adversarial cases (007+) stay reachable for testing but out of the
// default demo picker; CASE-011 never appears as a normal demo case.
export const DEMO_CASE_IDS = [
  "CASE-001-clean",
  "CASE-002-name-mismatch",
  "CASE-003-dob-mismatch",
  "CASE-004-missing-income-certificate",
  "CASE-005-expired-certificate",
  "CASE-006-low-confidence-extraction",
];

const DEMO_DISPLAY_NAMES: Record<string, string> = {
  "CASE-001-clean": "Clean application",
  "CASE-002-name-mismatch": "Name mismatch",
  "CASE-003-dob-mismatch": "DOB mismatch",
  "CASE-004-missing-income-certificate": "Missing income certificate",
  "CASE-005-expired-certificate": "Expired certificate",
  "CASE-006-low-confidence-extraction": "Low-confidence extraction",
};

export function demoDisplayName(id: string): string {
  return DEMO_DISPLAY_NAMES[id] ?? id;
}
