import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { createTracer } from "../../src/domain/execution/contracts.js";
import { buildReviewSnapshot } from "../../src/domain/submission/review.js";
import { grantApproval } from "../../src/domain/submission/approval.js";
import { authorizeSubmission } from "../../src/domain/submission/authorize.js";
import { decideRecoveryPolicy, verifyPortalState } from "../../src/domain/execution/verify.js";
import { clickSubmitApplication, inspectPortalFields, readPortalState } from "../../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../../src/adapters/browser/execute.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

// TASK-007 unknown submission: the Submit request leaves but the final state
// never resolves. Exactly one Submit attempt, then STOP — never a blind retry.
test("unknown submission: one attempt, then escalate", async ({ page }) => {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { id: string; profile: ApplicantProfile; evidence: Evidence[] };
  const tracer = createTracer();
  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  expect(preflight.status).toBe("READY");

  await page.goto("/portal/scholarship-renewal?scenario=unknown-submit");
  const mappings = mapPortalFields(await inspectPortalFields(page));
  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) throw new Error(`planning failed: ${planned.failure.message}`);
  const executed = await runExecutionPlan(page, planned.plan, { tracer });
  expect(executed.status).toBe("VERIFIED");

  const snapshot = buildReviewSnapshot({
    applicationId: input.id,
    profile: input.profile,
    evidence: input.evidence,
    preflight,
    portalState: "SAVED",
  });
  const approval = grantApproval({
    applicationId: input.id,
    fingerprint: snapshot.fingerprint,
    approvedAt: "2026-09-30T00:00:00.000Z",
  });
  const decision = authorizeSubmission({
    preflight,
    executionStatus: executed.status,
    portalState: "SAVED",
    snapshot,
    approval,
  });
  expect(decision).toMatchObject({ authorized: true });

  tracer.record("SUBMISSION_STARTED", "Authorized Submit click (single attempt).");
  await clickSubmitApplication(page);
  const observed = await readPortalState(page);
  expect(verifyPortalState(observed, "SUBMITTED")).toBe("UNKNOWN");
  expect(decideRecoveryPolicy("UNKNOWN", 0)).toBe("ESCALATE");
  tracer.record("SUBMISSION_ESCALATED", `Final state inconclusive (${JSON.stringify(observed)}); no retry.`);
  expect(await page.getByText("Application submitted")).toHaveCount(0);

  const starts = tracer.events.filter((e) => e.type === "SUBMISSION_STARTED");
  expect(starts).toHaveLength(1);
});
