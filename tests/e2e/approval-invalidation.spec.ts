import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { createTracer } from "../../src/domain/execution/contracts.js";
import { buildReviewSnapshot } from "../../src/domain/submission/review.js";
import { checkApproval, grantApproval } from "../../src/domain/submission/approval.js";
import { authorizeSubmission } from "../../src/domain/submission/authorize.js";
import { inspectPortalFields, readPortalState } from "../../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../../src/adapters/browser/execute.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

function loadClean() {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { id: string; profile: ApplicantProfile; evidence: Evidence[] };
  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  if (preflight.status !== "READY") throw new Error("fixture is not READY");
  return { input, preflight };
}

// TASK-007 invalidation: approve the exact SAVED state, then change a
// submission-relevant value. The old approval must refuse — and no Submit
// click may occur.
test("approval invalidated: changed income refuses submission without submit", async ({ page }) => {
  const { input, preflight } = loadClean();
  const tracer = createTracer();

  await page.goto("/portal/scholarship-renewal");
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
  tracer.record("APPROVAL_GRANTED", `Human approved fingerprint ${approval.reviewedFingerprint}.`);

  // Submission-relevant change AFTER approval: annual income 180000 → 190000.
  await page.getByLabel("Annual Family Income").fill("190000");
  const changedEvidence = input.evidence.map((e) => (e.id === "ev-income-amount" ? { ...e, text: "190000" } : e));
  const changedPreflight = validateProfile(input.profile, changedEvidence, { referenceDate: "2026-09-30" });
  const changedSnapshot = buildReviewSnapshot({
    applicationId: input.id,
    profile: input.profile,
    evidence: changedEvidence,
    preflight: changedPreflight,
    portalState: "SAVED",
  });
  expect(changedSnapshot.fingerprint).not.toBe(snapshot.fingerprint);
  expect(checkApproval(approval, changedSnapshot.fingerprint).status).toBe("INVALIDATED");
  tracer.record("APPROVAL_INVALIDATED", "Income change produced a new fingerprint; prior approval void.");

  const decision = authorizeSubmission({
    preflight: changedPreflight,
    executionStatus: executed.status,
    portalState: "SAVED",
    snapshot: changedSnapshot,
    approval,
  });
  expect(decision).toMatchObject({ authorized: false, reason: "APPROVAL_INVALIDATED" });

  // Prove no Submit click occurred: portal never left SAVED.
  expect(await readPortalState(page)).toBe("SAVED");
  await expect(page.getByText("Application submitted")).toHaveCount(0);
});
