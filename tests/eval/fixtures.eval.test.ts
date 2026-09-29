import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

const FIXED_NOW = "2026-09-30T00:00:00.000Z";
// Rules enforced by the TASK-001 validator. Other expected rule ids are owned
// by later tasks (TASK-003 validation engine) and are covered by the eval
// script as DEFERRED, not by these assertions.
const TASK_001_RULES = new Set([
  "REQUIRED_DOCUMENT",
  "DOCUMENT_EXPIRY",
  "DOCUMENT_INVALID",
  "EVIDENCE_PROVENANCE",
]);

type ManifestEntry = { id: string; profile: string; expectedFile: string };
type Expected = { id: string; expectedPreflight: "READY" | "BLOCKED"; expectedFindingIds: string[] };
type CaseInput = { id: string; scenario: string; profile: ApplicantProfile; evidence: Evidence[] };

const manifest = JSON.parse(readFileSync("fixtures/manifest.json", "utf8")) as {
  version: number;
  cases: ManifestEntry[];
};

function loadCase(entry: ManifestEntry): { expected: Expected; input: CaseInput } {
  const expected = JSON.parse(readFileSync(`fixtures/expected/${entry.expectedFile}`, "utf8")) as Expected;
  const input = JSON.parse(readFileSync(`fixtures/cases/${entry.id}/case.json`, "utf8")) as CaseInput;
  return { expected, input };
}

describe("fixture manifest determinism", () => {
  it("has a stable version and unique case ids", () => {
    expect(manifest.version).toBe(1);
    const ids = manifest.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps manifest, case inputs, and expected files in agreement", () => {
    for (const entry of manifest.cases) {
      const { expected, input } = loadCase(entry);
      expect(expected.id).toBe(entry.id);
      expect(input.id).toBe(entry.id);
      expect(input.profile.version).toBeTruthy();
      expect(Array.isArray(input.evidence)).toBe(true);
    }
  });
});

describe("TASK-001 fixture outcomes", () => {
  for (const entry of manifest.cases) {
    const { expected, input } = loadCase(entry);
    const deferred = expected.expectedFindingIds.some((id) => !TASK_001_RULES.has(id));

    if (deferred) {
      it(`${entry.id} defers to a later-task rule`, () => {
        expect(expected.expectedPreflight).toBe("BLOCKED");
        expect(expected.expectedFindingIds.length).toBeGreaterThan(0);
      });
      continue;
    }

    it(`${entry.id} produces ${expected.expectedPreflight}`, () => {
      const result = validateProfile(input.profile, input.evidence, FIXED_NOW);
      expect(result.status).toBe(expected.expectedPreflight);
      for (const ruleId of expected.expectedFindingIds) {
        expect(result.issues.map((issue) => issue.ruleId)).toContain(ruleId);
      }
    });
  }
});
