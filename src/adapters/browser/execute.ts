import type { Page } from "@playwright/test";
import { createTracer, type ExecutionResult, type ExecutionTracer } from "../../domain/execution/contracts.js";
import { finalizeExecution, type FieldObservation } from "../../domain/execution/plan.js";
import { decideRecoveryPolicy, MAX_RECOVERY_ATTEMPTS, verifyPortalState } from "../../domain/execution/verify.js";
import type { ExecutionPlan } from "../../domain/execution/contracts.js";
import { clickSaveDraft, fillPortalField, readPortalField, readPortalState } from "./portal.js";

// Failure-aware execution runner (TASK-006). ACTION → OBSERVE → DECIDE:
// EXPECTED → complete; confirmed NOT_REACHED → one bounded recovery, then
// verify again; UNKNOWN → stop and escalate, never retry. The save loop is
// structurally bounded (at most maxRecoveries retries) — no unbounded or
// blind retry exists here. Comparison lives in domain finalizeExecution;
// this runner only moves data and records the trace. It never validates,
// never maps, never submits.
export async function runExecutionPlan(
  page: Page,
  plan: ExecutionPlan,
  options?: { tracer?: ExecutionTracer; maxRecoveries?: number },
): Promise<ExecutionResult> {
  const tracer = options?.tracer ?? createTracer();
  const maxRecoveries = options?.maxRecoveries ?? MAX_RECOVERY_ATTEMPTS;
  tracer.record("EXECUTION_STARTED", `Executing ${plan.fields.length} mapped fields for profile ${plan.profileVersion}.`);

  for (const field of plan.fields) {
    tracer.record("ACTION_ATTEMPTED", `Filling '${field.canonicalField}' into portal field ${field.portalFieldId}.`);
    await fillPortalField(page, field.portalFieldId, field.value);
  }
  const observations: FieldObservation[] = [];
  for (const field of plan.fields) {
    observations.push({ portalFieldId: field.portalFieldId, observed: await readPortalField(page, field.portalFieldId) });
  }
  const preSave = finalizeExecution(plan, observations, false);
  // SAVE_DRAFT_FAILED here means "all values verified, save is the next
  // step". Any other failure is a real mismatch: stop, never save.
  if (!preSave.failure || preSave.failure.reason !== "SAVE_DRAFT_FAILED") {
    const failed = { ...preSave, trace: tracer.events, recoveryAttempts: 0 };
    if (failed.failure) tracer.record("ACTION_FAILED", failed.failure.message);
    tracer.record("EXECUTION_COMPLETED", `Execution ended with status ${failed.status}.`);
    return failed;
  }
  tracer.record("STATE_VERIFIED", "All filled values match the plan; proceeding to Save Draft.");

  for (let attempt = 0; attempt <= maxRecoveries; attempt++) {
    tracer.record("ACTION_ATTEMPTED", `Clicking Save Draft (save attempt ${attempt + 1}).`);
    await clickSaveDraft(page);
    const state = await readPortalState(page);
    const verdict = verifyPortalState(state, "SAVED");
    tracer.record("STATE_VERIFIED", `Save attempt ${attempt + 1} observed portal state.`, state);
    const decision = decideRecoveryPolicy(verdict, attempt, maxRecoveries);
    if (decision === "COMPLETE") {
      if (attempt > 0) {
        tracer.record("RECOVERY_COMPLETED", `Recovery succeeded on attempt ${attempt + 1}; state SAVED verified.`);
      }
      tracer.record("EXECUTION_COMPLETED", "Portal state SAVED verified; execution complete.");
      const done = finalizeExecution(plan, observations, true);
      return {
        ...done,
        status: attempt > 0 ? "RECOVERED" : done.status,
        trace: tracer.events,
        recoveryAttempts: attempt,
      };
    }
    if (decision === "ESCALATE") {
      tracer.record("ACTION_FAILED", `Save attempt ${attempt + 1} did not reach SAVED.`, state);
      if (verdict === "UNKNOWN") {
        tracer.record("ESCALATED", "Portal state is inconclusive; stopping without retry.");
        return {
          status: "ESCALATED",
          plan,
          verified: preSave.verified,
          saveDraftSucceeded: false,
          portalState: null,
          failure: {
            reason: "UNKNOWN_STATE",
            message: `Save outcome is inconclusive (observed ${JSON.stringify(state)}). Stopped without retry.`,
            observed: state,
          },
          trace: tracer.events,
          recoveryAttempts: attempt,
        };
      }
      tracer.record("ESCALATED", "Recovery budget exhausted; stopping.");
      return {
        ...finalizeExecution(plan, observations, false),
        trace: tracer.events,
        recoveryAttempts: attempt,
        failure: {
          reason: "SAVE_DRAFT_FAILED",
          message: `Save Draft did not reach SAVED after ${attempt + 1} attempt(s).`,
        },
      };
    }
    tracer.record("RECOVERY_STARTED", `Confirmed miss; starting bounded recovery ${attempt + 1}/${maxRecoveries}.`);
  }
  throw new Error("Unreachable: save loop is bounded by maxRecoveries.");
}
