import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateProfile } from "../src/domain/validation/preflight.js";
import type { ApplicantProfile, Evidence } from "../src/domain/contracts.js";

// TASK-003 evaluation: deterministic, no AI, no randomness.
// Runs the domain validation engine over every fixture case with an explicit
// reference date and compares status plus finding IDs against ground truth.
// Every manifest case is gated; nothing is deferred.
const REFERENCE_DATE = "2026-09-30";
const FIXED_NOW = "2026-09-30T00:00:00.000Z";

type ManifestEntry = { id: string; profile: string; expectedFile: string };
type Expected = { id: string; expectedPreflight: "READY" | "BLOCKED"; expectedFindingIds: string[] };
type CaseInput = { id: string; scenario: string; profile: ApplicantProfile; evidence: Evidence[] };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "fixtures/manifest.json"), "utf8")) as {
  version: number;
  cases: ManifestEntry[];
};

let passed = 0;
const failures: string[] = [];

for (const item of manifest.cases) {
  const expected = JSON.parse(
    await readFile(path.join(root, "fixtures/expected", item.expectedFile), "utf8"),
  ) as Expected;
  if (expected.id !== item.id) throw new Error(`Fixture id mismatch: ${item.id}`);
  const input = JSON.parse(
    await readFile(path.join(root, "fixtures/cases", item.id, "case.json"), "utf8"),
  ) as CaseInput;
  if (input.id !== item.id) throw new Error(`Case input id mismatch: ${item.id}`);

  const result = validateProfile(input.profile, input.evidence, {
    referenceDate: REFERENCE_DATE,
    checkedAt: FIXED_NOW,
  });
  const actualRuleIds = result.issues.map((issue) => issue.ruleId);
  const statusOk = result.status === expected.expectedPreflight;
  const findingsOk = expected.expectedFindingIds.every((id) => actualRuleIds.includes(id));
  if (statusOk && findingsOk) {
    passed += 1;
    console.log(`PASS ${item.id}: ${result.status} [${actualRuleIds.join(",")}]`);
  } else {
    failures.push(item.id);
    console.log(
      `FAIL ${item.id}: expected=${expected.expectedPreflight} ` +
        `[${expected.expectedFindingIds.join(",")}] actual=${result.status} [${actualRuleIds.join(",")}]`,
    );
  }
}

console.log(`Fixture manifest check: ${manifest.cases.length}/${manifest.cases.length} cases valid.`);
console.log(`TASK-003 validation gate: ${passed}/${manifest.cases.length} passed.`);
if (failures.length > 0) {
  console.error(`Evaluation failed for: ${failures.join(", ")}`);
  process.exit(1);
}
