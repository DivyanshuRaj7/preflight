import type { ExecutionResult, VerifiedField } from "../domain/execution/contracts.js";

// Presentation-only derivation: execution result → visible checklist rows.
// Every row is computed from the payload the runtime bridge returned; nothing
// is staged or assumed. A row is marked complete only when its underlying
// condition holds in the data.
export type ExecuteBridgePayload = {
  ok: boolean;
  caseId: string;
  inspected: number;
  mapped: number;
  headlessEnforced?: boolean;
  result: ExecutionResult;
};

export type TraceRow = { ok: boolean; text: string };

export function describeExecution(payload: ExecuteBridgePayload): {
  rows: TraceRow[];
  completion: { ok: boolean; text: string };
  fields: VerifiedField[];
} {
  const { result } = payload;
  const total = result.verified.length;
  const verifiedCount = result.verified.filter((v) => v.verified).length;
  const rows: TraceRow[] = [
    { ok: payload.inspected > 0, text: `Portal inspected (${payload.inspected} fields)` },
    {
      ok: payload.mapped > 0 && payload.mapped === payload.inspected,
      text: `${payload.mapped} fields mapped`,
    },
    { ok: total > 0, text: `${total} values entered` },
    {
      ok: total > 0 && verifiedCount === total,
      text: `${verifiedCount} values independently verified`,
    },
    { ok: result.saveDraftSucceeded, text: "Draft saved" },
  ];
  if (result.recoveryAttempts > 0 && result.status === "RECOVERED") {
    rows.push({
      ok: true,
      text: `Recovered after ${result.recoveryAttempts} miss(es); SAVED verified`,
    });
  }
  rows.push({
    ok: result.portalState === "SAVED",
    text: `Portal state verified: ${result.portalState ?? "unknown"}`,
  });
  let completion: { ok: boolean; text: string };
  if (result.status === "VERIFIED") {
    completion = { ok: true, text: "Browser agent completed successfully." };
  } else if (result.status === "RECOVERED") {
    completion = { ok: true, text: "Browser agent recovered and completed." };
  } else {
    completion = {
      ok: false,
      text: `Execution ended ${result.status}: ${result.failure?.message ?? "no detail recorded."}`,
    };
  }
  return { rows, completion, fields: result.verified };
}
