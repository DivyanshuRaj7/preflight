import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { chromium } from "@playwright/test";
import { validateProfile } from "../domain/validation/preflight.js";
import { mapPortalFields } from "../domain/mapping/deterministic.js";
import { buildExecutionPlan } from "../domain/execution/plan.js";
import { inspectPortalFields } from "../adapters/browser/portal.js";
import { runExecutionPlan } from "../adapters/browser/execute.js";
import { createTracer } from "../domain/execution/contracts.js";
import type { ApplicantProfile, Evidence } from "../domain/contracts.js";

// Read server-side (never bundled): import attributes behave differently
// inside the Vite config bundle, so plain fs keeps this robust.
function manifestIds(): string[] {
  const manifest = JSON.parse(readFileSync("fixtures/manifest.json", "utf8")) as {
    cases: { id: string }[];
  };
  return manifest.cases.map((c) => c.id);
}

// Dev-only runtime bridge: POST /api/execute runs the EXISTING browser
// execution stack (inspect → map → plan → runExecutionPlan with a real
// tracer) in a real Chromium driven by this server, against the portal this
// same server serves. Nothing here reimplements execution: every step calls
// the production adapter/domain functions, and the response carries their
// real result and trace. Dev only (`apply: "serve"`) — static builds have no
// endpoint, and the UI says so instead of pretending.
const CASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const BODY_LIMIT = 4096;
const REFERENCE_DATE = "2026-09-30";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function preflightExecuteBridge(): Plugin {
  let running = false;
  return {
    name: "preflight-execute-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/execute", async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "POST") {
          send(res, 405, { ok: false, stage: "request", error: "Use POST with a JSON { caseId } body." });
          return;
        }
        if (running) {
          send(res, 409, { ok: false, stage: "request", error: "A browser-agent run is already in progress." });
          return;
        }
        let body: { caseId?: unknown; headed?: unknown };
        try {
          body = JSON.parse(await readBody(req)) as { caseId?: unknown; headed?: unknown };
        } catch {
          send(res, 400, { ok: false, stage: "request", error: "Invalid JSON body." });
          return;
        }
        const caseId = body.caseId as string | undefined;
        const showWindow = body.headed === true;
        running = true;
        let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
        try {
          const ids = manifestIds();
          if (!caseId || !CASE_ID_PATTERN.test(caseId) || !ids.includes(caseId)) {
            send(res, 422, { ok: false, stage: "case", error: `Unknown synthetic case: ${String(caseId)}.` });
            return;
          }
          const input = JSON.parse(readFileSync(`fixtures/cases/${caseId}/case.json`, "utf8")) as {
            profile: ApplicantProfile;
            evidence: Evidence[];
          };
          const preflight = validateProfile(input.profile, input.evidence, { referenceDate: REFERENCE_DATE });
          if (preflight.status !== "READY") {
            send(res, 422, {
              ok: false,
              stage: "validation",
              error: `Execution refused: preflight is ${preflight.status}, required READY. No browser interaction occurred.`,
            });
            return;
          }
          // Portal URL comes from the request's own Host header, so the agent
          // always drives the server the judge is actually viewing — never a
          // default port that may not be listening.
          const host = req.headers.host;
          if (!host) {
            send(res, 400, { ok: false, stage: "request", error: "Missing Host header." });
            return;
          }
          const base = `http://${host}`;
          browser = await chromium.launch({ headless: !showWindow });
          const page = await browser.newPage();
          await page.goto(`${base}/portal/scholarship-renewal`);
          const portalFields = await inspectPortalFields(page);
          const mappings = mapPortalFields(portalFields);
          const matched = mappings.filter((m) => m.status === "MATCHED").length;
          if (matched !== mappings.length) {
            send(res, 422, {
              ok: false,
              stage: "mapping",
              error: `${mappings.length - matched} portal field(s) did not map; refusing to fill. No values were entered.`,
            });
            return;
          }
          const planned = buildExecutionPlan(preflight, input.profile, input.evidence, mappings);
          if (!("plan" in planned)) {
            send(res, 422, { ok: false, stage: "planning", error: `Planning failed: ${planned.failure.message}` });
            return;
          }
          const tracer = createTracer();
          const result = await runExecutionPlan(page, planned.plan, { tracer });
          send(res, 200, {
            ok: true,
            caseId,
            inspected: portalFields.length,
            mapped: matched,
            result,
          });
        } catch (error) {
          send(res, 500, {
            ok: false,
            stage: "execution",
            error: error instanceof Error ? error.message : "Browser execution failed.",
          });
        } finally {
          running = false;
          await browser?.close().catch(() => undefined);
        }
      });
    },
  };
}
