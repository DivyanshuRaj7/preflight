import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { validateProfile } from "../domain/validation/preflight.js";
import { mapPortalFields } from "../domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../domain/execution/plan.js";
import { inspectPortalFields } from "../adapters/browser/portal.js";
import { runExecutionPlan } from "../adapters/browser/execute.js";
import { createTracer } from "../domain/execution/contracts.js";
import type { ApplicantProfile, Evidence } from "../domain/contracts.js";

// Shared execution service: the single implementation behind every
// /api/execute host (Vite dev middleware, production Node server). It runs
// the EXISTING stack — validate → inspect → map → plan → runExecutionPlan
// with a real tracer in a real Chromium — and returns plain JSON the UI
// renders without invention. No HTTP here; hosts own transport.
const CASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const SCENARIO_PATTERN = /^[a-z][a-z-]*$/;
const REFERENCE_DATE = "2026-09-30";

export type ExecuteRequest = { caseId?: unknown; headed?: unknown; scenario?: unknown };

export type ExecuteOutcome =
  | { status: number; body: { ok: true; caseId: string; inspected: number; mapped: number; result: unknown } }
  | { status: number; body: { ok: false; stage: string; error: string } };

// Read server-side (never bundled): import attributes behave differently
// inside config/server bundles, so plain fs keeps this robust.
function manifestIds(): string[] {
  const manifest = JSON.parse(readFileSync("fixtures/manifest.json", "utf8")) as {
    cases: { id: string }[];
  };
  return manifest.cases.map((c) => c.id);
}

export async function executeCase(input: ExecuteRequest, portalBase: string): Promise<ExecuteOutcome> {
  const caseId = input.caseId as string | undefined;
  const showWindow = input.headed === true;
  const scenario = typeof input.scenario === "string" && SCENARIO_PATTERN.test(input.scenario) ? input.scenario : "";
  if (!caseId || !CASE_ID_PATTERN.test(caseId) || !manifestIds().includes(caseId)) {
    return { status: 422, body: { ok: false, stage: "case", error: `Unknown synthetic case: ${String(caseId)}.` } };
  }
  const data = JSON.parse(readFileSync(`fixtures/cases/${caseId}/case.json`, "utf8")) as {
    profile: ApplicantProfile;
    evidence: Evidence[];
  };
  const preflight = validateProfile(data.profile, data.evidence, { referenceDate: REFERENCE_DATE });
  if (preflight.status !== "READY") {
    return {
      status: 422,
      body: {
        ok: false,
        stage: "validation",
        error: `Execution refused: preflight is ${preflight.status}, required READY. No browser interaction occurred.`,
      },
    };
  }
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: !showWindow });
    const page = await browser.newPage();
    await page.goto(`${portalBase}/portal/scholarship-renewal${scenario ? `?scenario=${scenario}` : ""}`);
    const portalFields = await inspectPortalFields(page);
    const mappings = mapPortalFields(portalFields);
    const matched = mappings.filter((m) => m.status === "MATCHED").length;
    if (matched !== mappings.length) {
      return {
        status: 422,
        body: {
          ok: false,
          stage: "mapping",
          error: `${mappings.length - matched} portal field(s) did not map; refusing to fill. No values were entered.`,
        },
      };
    }
    const planned = buildExecutionPlan(preflight, data.profile, data.evidence, mappings);
    if (!("plan" in planned)) {
      return { status: 422, body: { ok: false, stage: "planning", error: `Planning failed: ${planned.failure.message}` } };
    }
    const tracer = createTracer();
    const result = await runExecutionPlan(page, planned.plan, { tracer });
    return { status: 200, body: { ok: true, caseId, inspected: portalFields.length, mapped: matched, result } };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
