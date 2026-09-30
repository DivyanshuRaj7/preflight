import type { Page } from "@playwright/test";
import { finalizeExecution, type FieldObservation } from "../../domain/execution/plan.js";
import type { ExecutionPlan, ExecutionResult } from "../../domain/execution/contracts.js";
import { clickSaveDraft, fillPortalField, readPortalField, readPortalState } from "./portal.js";

// Executes an already-built plan: fill each mapped field by id, read every
// value back independently, and click Save Draft ONLY if all read-backs match.
// Comparison lives in domain finalizeExecution; this runner only moves data.
export async function runExecutionPlan(page: Page, plan: ExecutionPlan): Promise<ExecutionResult> {
  for (const field of plan.fields) {
    await fillPortalField(page, field.portalFieldId, field.value);
  }
  const observations: FieldObservation[] = [];
  for (const field of plan.fields) {
    observations.push({ portalFieldId: field.portalFieldId, observed: await readPortalField(page, field.portalFieldId) });
  }
  const preSave = finalizeExecution(plan, observations, false);
  // SAVE_DRAFT_FAILED here means "all values verified, save is the next
  // step". Any other failure is a real mismatch: stop, never save.
  if (!preSave.failure || preSave.failure.reason !== "SAVE_DRAFT_FAILED") return preSave;
  await clickSaveDraft(page);
  const state = await readPortalState(page);
  return finalizeExecution(plan, observations, state === "SAVED");
}
