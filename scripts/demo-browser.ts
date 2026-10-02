// Live browser-agent demo (demo:browser). Runs the REAL pipeline against the
// REAL synthetic portal and prints only what actually happened — every
// checklist line below is derived from observed run data, never staged.
// Usage: npm run demo:browser [-- --headed] [--scenario=flaky-save]
//        [--case=CASE-001-clean] [--port=5231]
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { validateProfile } from "../src/domain/validation/preflight.js";
import { mapPortalFields } from "../src/domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../src/domain/execution/plan.js";
import { inspectPortalFields } from "../src/adapters/browser/portal.js";
import { runExecutionPlan } from "../src/adapters/browser/execute.js";
import { createTracer } from "../src/domain/execution/contracts.js";
import type { ApplicantProfile, Evidence } from "../src/domain/contracts.js";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const PORT = Number(args.get("port") ?? "5231");
const CASE_ID = String(args.get("case") ?? "CASE-001-clean");
const SCENARIO = args.get("scenario") ? `?scenario=${args.get("scenario")}` : "";
const HEADED = args.get("headed") === "true";

let server: ChildProcess | undefined;

function fail(message: string): never {
  console.log(`! ${message}`);
  server?.kill();
  process.exit(1);
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) fail(`dev server never came up at ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

try {
  const dir = CASE_ID.split("-").slice(0, 2).join("-");
  const input = JSON.parse(
    readFileSync(`fixtures/cases/${CASE_ID}/case.json`, "utf8"),
  ) as { profile: ApplicantProfile; evidence: Evidence[] };

  const preflight = validateProfile(input.profile, input.evidence, { referenceDate: "2026-09-30" });
  console.log(`Preflight decision: ${preflight.status} (${dir})`);
  if (preflight.status !== "READY") {
    fail(`Execution refused: preflight is ${preflight.status}, required READY. No browser interaction occurred.`);
  }

  server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${PORT}`;
  await waitForServer(`${base}/`);

  const browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage();
  await page.goto(`${base}/portal/scholarship-renewal${SCENARIO}`);

  console.log("\nBROWSER EXECUTION");
  const portalFields = await inspectPortalFields(page);
  console.log(`✓ Portal inspected (${portalFields.length} fields)`);
  const mappings = mapPortalFields(portalFields);
  const matched = mappings.filter((m) => m.status === "MATCHED").length;
  if (matched !== mappings.length) fail(`${mappings.length - matched} field(s) did not map; refusing to fill.`);
  console.log(`✓ ${matched} fields mapped`);

  const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
  if (!("plan" in planned)) fail(`Planning failed: ${planned.failure.message}`);

  const tracer = createTracer();
  const result = await runExecutionPlan(page, planned.plan, { tracer });
  const verified = result.verified.filter((v) => v.verified).length;
  console.log(`✓ ${planned.plan.fields.length} values entered`);
  if (verified !== planned.plan.fields.length) {
    fail(`Only ${verified}/${planned.plan.fields.length} values verified on read-back; stopping.`);
  }
  console.log(`✓ ${verified} values independently verified`);
  if (!result.saveDraftSucceeded) fail(`Save Draft did not succeed: ${result.failure?.message ?? "unknown"}.`);
  console.log("✓ Draft saved");
  if (result.recoveryAttempts > 0) {
    console.log(`↻ Recovery succeeded after ${result.recoveryAttempts} recoverable miss(es); state SAVED verified.`);
  }
  if (result.portalState !== "SAVED") fail(`Portal state is ${result.portalState ?? "unknown"}, required SAVED.`);
  console.log("✓ Portal state: SAVED");
  if (result.status === "ESCALATED" || result.status === "FAILED") {
    fail(`Execution ended ${result.status}: ${result.failure?.message ?? "unknown"}.`);
  }
  console.log(`\nBrowser agent completed successfully (${result.status}).`);

  if (args.get("verbose") === "true") {
    console.log("\nTrace events:");
    for (const e of tracer.events) console.log(`  ${e.seq}. ${e.type} — ${e.detail}`);
  }
  await browser.close();
} finally {
  server?.kill();
}
