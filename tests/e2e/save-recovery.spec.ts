import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalFields } from "../../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../../src/domain/execution/plan.js";
import { createTracer } from "../../src/domain/execution/contracts.js";
import { inspectPortalFields } from "../../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../../src/adapters/browser/execute.js";
import type { ApplicantProfile, Evidence } from "../../src/domain/contracts.js";

// TASK-006 scenario 2: the first Save Draft deterministically fails while
// the portal provably stays DRAFT. Exactly one bounded recovery follows.
test("recoverable save: one miss, one recovery, then SAVED", async ({ page }) => {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { profile: ApplicantProfile; evidence: Evidence[] };
  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  expect(preflight.status).toBe("READY");

  await page.goto("/portal/scholarship-renewal?scenario=flaky-save");
  const mappings = mapPortalFields(await inspectPortalFields(page));
  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) throw new Error(`planning failed: ${planned.failure.message}`);

  const tracer = createTracer();
  const result = await runExecutionPlan(page, planned.plan, { tracer });

  expect(result.status).toBe("RECOVERED");
  expect(result.recoveryAttempts).toBe(1);
  expect(result.portalState).toBe("SAVED");
  const types = tracer.events.map((e) => e.type);
  expect(types.filter((t) => t === "ACTION_ATTEMPTED").length).toBeGreaterThanOrEqual(2);
  expect(types).toContain("RECOVERY_STARTED");
  expect(types).toContain("RECOVERY_COMPLETED");
  expect(types.filter((t) => t === "RECOVERY_STARTED")).toHaveLength(1);
});

// TASK-006 scenario 3: Save Draft never resolves observably. Preflight must
// stop and escalate — exactly one save attempt, no retry, no Save Draft
// assumption, uncertainty preserved in the trace.
test("unknown save state: stop, escalate, never retry", async ({ page }) => {
  const input = JSON.parse(
    readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"),
  ) as { profile: ApplicantProfile; evidence: Evidence[] };
  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  expect(preflight.status).toBe("READY");

  await page.goto("/portal/scholarship-renewal?scenario=unknown-save");
  const mappings = mapPortalFields(await inspectPortalFields(page));
  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) throw new Error(`planning failed: ${planned.failure.message}`);

  const tracer = createTracer();
  const result = await runExecutionPlan(page, planned.plan, { tracer });

  expect(result.status).toBe("ESCALATED");
  expect(result.failure?.reason).toBe("UNKNOWN_STATE");
  expect(result.saveDraftSucceeded).toBe(false);
  expect(result.portalState).toBeNull();
  expect(await page.getByTestId("application-status").textContent()).not.toContain("SAVED");
  const types = tracer.events.map((e) => e.type);
  const saveAttempts = tracer.events.filter(
    (e) => e.type === "ACTION_ATTEMPTED" && e.detail.startsWith("Clicking Save Draft"),
  );
  expect(saveAttempts).toHaveLength(1);
  expect(types).toContain("ESCALATED");
  expect(types).not.toContain("RECOVERY_STARTED");
});
