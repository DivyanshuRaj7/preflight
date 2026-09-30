import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { inspectPortalFields } from "../../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../../src/adapters/browser/execute.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

// TASK-005D real execution: READY fixture → browser inspection → semantic
// mapping → canonical fills → independent read-back → Save Draft → SAVED.
// No mocks, no Submit. Values come from the fixture, never from literals here:
// expected strings below assert the grounded outcome, they do not drive it.
test("application execution: validated profile fills and verifies the portal", async ({ page }) => {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { profile: ApplicantProfile; evidence: Evidence[] };

  // 1. Start from a READY application (real engine, explicit reference date).
  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  expect(preflight.status).toBe("READY");

  // 2-4. Open the portal and inspect real fields; map their meaning.
  await page.goto("/portal/scholarship-renewal");
  const portalFields = await inspectPortalFields(page);
  expect(portalFields.map((f) => f.label)).toEqual([
    "Full Name",
    "Date of Birth",
    "Address",
    "Annual Family Income",
    "Bank Account Number",
    "Scholarship Application Reference",
  ]);
  const mappings = mapPortalFields(portalFields);
  expect(mappings.every((m) => m.status === "MATCHED")).toBe(true);

  // 5-6. Build the plan from canonical data and execute it in the browser.
  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) throw new Error(`planning failed: ${planned.failure.message}`);
  const result = await runExecutionPlan(page, planned.plan);

  // 7-11. Verified fills, SAVED state, and provably no submission.
  expect(result.status).toBe("VERIFIED");
  expect(result.verified.map((v) => [v.canonicalField, v.observed])).toEqual([
    ["fullName", "Rina Das"],
    ["dateOfBirth", "2004-05-17"],
    ["address", "14 Lake Road, Kolkata 700029"],
    ["annualFamilyIncome", "180000"],
    ["bankAccountNumber", "SYNTHETIC-001234"],
    ["scholarshipApplicationReference", "SCH-2026-001"],
  ]);
  expect(result.saveDraftSucceeded).toBe(true);
  expect(result.portalState).toBe("SAVED");
  await expect(page.getByTestId("application-status")).toHaveText("SAVED");
  await expect(page.getByRole("button", { name: /submit/i })).toHaveCount(0);
});
