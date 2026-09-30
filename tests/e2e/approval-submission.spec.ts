import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { createTracer } from "../../src/domain/execution/contracts.js";
import { buildReviewSnapshot } from "../../src/domain/submission/review.js";
import { grantApproval } from "../../src/domain/submission/approval.js";
import { authorizeSubmission } from "../../src/domain/submission/authorize.js";
import { verifyPortalState } from "../../src/domain/execution/verify.js";
import { clickSubmitApplication, inspectPortalFields, readPortalState } from "../../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../../src/adapters/browser/execute.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

// TASK-007 full path: validate → execute → SAVED → final review → explicit
// human approval → authorized submit → observed SUBMITTED → VERIFIED.
test("approval to submission: exact state authorized, submitted, verified", async ({ page }) => {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { id: string; profile: ApplicantProfile; evidence: Evidence[] };
  const tracer = createTracer();

  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  expect(preflight.status).toBe("READY");

  await page.goto("/portal/scholarship-renewal");
  const mappings = mapPortalFields(await inspectPortalFields(page));
  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) throw new Error(`planning failed: ${planned.failure.message}`);
  const executed = await runExecutionPlan(page, planned.plan, { tracer });
  expect(executed.status).toBe("VERIFIED");
  expect(await readPortalState(page)).toBe("SAVED");
  tracer.record("FINAL_REVIEW_CREATED", "SAVED state verified; building final review snapshot.");

  const snapshot = buildReviewSnapshot({
    applicationId: input.id,
    profile: input.profile,
    evidence: input.evidence,
    preflight,
    portalState: "SAVED",
  });
  tracer.record("FINAL_REVIEW_CREATED", `Review snapshot fingerprinted ${snapshot.fingerprint}.`);
  tracer.record("AWAITING_APPROVAL", "Snapshot ready; submission blocked until human approval.");

  // Explicit human approval of THIS EXACT STATE (synthetic local action).
  const approval = grantApproval({
    applicationId: input.id,
    fingerprint: snapshot.fingerprint,
    approvedAt: "2026-09-30T00:00:00.000Z",
  });
  tracer.record("APPROVAL_GRANTED", `Human approved fingerprint ${approval.reviewedFingerprint}.`);

  const decision = authorizeSubmission({
    preflight,
    executionStatus: executed.status,
    portalState: "SAVED",
    snapshot,
    approval,
  });
  expect(decision).toMatchObject({ authorized: true });
  tracer.record("SUBMISSION_AUTHORIZED", "All eight authorization conditions hold.");

  tracer.record("SUBMISSION_STARTED", "Authorized Submit click.");
  await clickSubmitApplication(page);
  const observed = await readPortalState(page);
  expect(verifyPortalState(observed, "SUBMITTED")).toBe("EXPECTED_STATE");
  tracer.record("SUBMISSION_COMPLETED", "Portal reports SUBMITTED.", observed);
  tracer.record("FINAL_STATE_VERIFIED", "Observed SUBMITTED matches authorized intent.");
  await expect(page.getByText("Application submitted")).toBeVisible();

  const types = tracer.events.map((e) => e.type);
  for (const required of [
    "FINAL_REVIEW_CREATED",
    "AWAITING_APPROVAL",
    "APPROVAL_GRANTED",
    "SUBMISSION_AUTHORIZED",
    "SUBMISSION_STARTED",
    "SUBMISSION_COMPLETED",
    "FINAL_STATE_VERIFIED",
  ]) {
    expect(types).toContain(required);
  }
});
