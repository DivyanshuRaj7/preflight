import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateProfile } from "../src/domain/validation/preflight.js";
import type { ApplicantProfile, Evidence } from "../src/domain/contracts.js";

// TASK-001 evaluation: deterministic, no AI, no randomness.
// Runs the domain preflight decision over every fixture case and compares
// against the expected outcome. Rules owned by later tasks
// (IDENTITY_NAME_MISMATCH, IDENTITY_DOB_MISMATCH, LOW_CONFIDENCE_EXTRACTION)
// are reported as DEFERRED and do not fail this gate.
const FIXED_NOW = "2026-09-30T00:00:00.000Z";
const TASK_001_RULES = new Set([
  "REQUIRED_DOCUMENT",
  "DOCUMENT_EXPIRY",
  "DOCUMENT_INVALID",
  "EVIDENCE_PROVENANCE",
]);

type ManifestEntry = { id: string; profile: string; expectedFile: string };
type Expected = { id: string; expectedPreflight: "READY" | "BLOCKED"; expectedFindingIds: string[] };
type CaseInput = { id: string; scenario: string; profile: ApplicantProfile; evidence: Evidence[] };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "fixtures/manifest.json"), "utf8")) as {
  version: number;
  cases: ManifestEntry[];
};

let gated = 0;
let gatedPass = 0;
let deferred = 0;
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

  const result = validateProfile(input.profile, input.evidence, FIXED_NOW);
  const actualRuleIds = result.issues.map((issue) => issue.ruleId);
  const isDeferred = expected.expectedFindingIds.some((id) => !TASK_001_RULES.has(id));

  if (isDeferred) {
    deferred += 1;
    console.log(
      `DEFERRED ${item.id}: expected=${expected.expectedPreflight} ` +
        `[${expected.expectedFindingIds.join(",")}] actual=${result.status} ` +
        `[${actualRuleIds.join(",")}] (rule owned by a later task)`,
    );
    continue;
  }

  gated += 1;
  const statusOk = result.status === expected.expectedPreflight;
  const findingsOk = expected.expectedFindingIds.every((id) => actualRuleIds.includes(id));
  if (statusOk && findingsOk) {
    gatedPass += 1;
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
console.log(`TASK-001 gate: ${gatedPass}/${gated} passed, ${deferred} deferred to later tasks.`);
if (failures.length > 0) {
  console.error(`Evaluation failed for: ${failures.join(", ")}`);
  process.exit(1);
}
