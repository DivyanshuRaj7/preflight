import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { inspectPortalFields } from "../../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../../src/adapters/browser/execute.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

// TASK-006 scenario 1: the portal relabels "Full Name" as
// "Applicant Legal Name". No special-case browser logic: the adapter reports
// the observed label, the existing deterministic mapper resolves it, and the
// canonical profile schema is untouched.
test("label drift: Applicant Legal Name still fills from fullName", async ({ page }) => {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { profile: ApplicantProfile; evidence: Evidence[] };
  expect(validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" }).status).toBe("READY");

  await page.goto("/portal/scholarship-renewal?scenario=label-drift");
  const portalFields = await inspectPortalFields(page);
  expect(portalFields.find((f) => f.id === "full-name")?.label).toBe("Applicant Legal Name");

  const mappings = mapPortalFields(portalFields);
  expect(mappings.find((m) => m.portalFieldId === "full-name")).toMatchObject({
    canonicalField: "fullName",
    status: "MATCHED",
  });

  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) throw new Error(`planning failed: ${planned.failure.message}`);
  const result = await runExecutionPlan(page, planned.plan);

  expect(result.status).toBe("VERIFIED");
  expect(result.portalState).toBe("SAVED");
  await expect(page.getByTestId("application-status")).toHaveText("SAVED");
});
