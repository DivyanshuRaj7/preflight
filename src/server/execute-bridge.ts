import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { executeCase } from "./execute-service.js";

// Dev-only runtime bridge: POST /api/execute delegates to the shared
// execution service. Dev only (`apply: "serve"`) — see prod-server.ts for the
// production host of the same service.
const BODY_LIMIT = 4096;

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

export function preflightExecuteBridge(): Plugin {
  let running = false;
  return {
    name: "preflight-execute-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/execute", async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, stage: "request", error: "Use POST with a JSON body." }));
          return;
        }
        if (running) {
          res.statusCode = 409;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, stage: "request", error: "A browser-agent run is already in progress." }));
          return;
        }
        let body: unknown;
        try {
          body = JSON.parse(await readBody(req)) as unknown;
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, stage: "request", error: "Invalid JSON body." }));
          return;
        }
        // Portal URL comes from the request's own Host header, so the agent
        // always drives the server the judge is actually viewing.
        const host = req.headers.host;
        if (!host) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, stage: "request", error: "Missing Host header." }));
          return;
        }
        running = true;
        try {
          const outcome = await executeCase(
            body as { caseId?: unknown; headed?: unknown; scenario?: unknown },
            `http://${host}`,
            // Dev middleware only: this process is a developer's local machine,
            // so the "Show the browser window" option may open real Chromium.
            { allowHeaded: true },
          );
          res.statusCode = outcome.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(outcome.body));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              stage: "execution",
              error: error instanceof Error ? error.message : "Browser execution failed.",
            }),
          );
        } finally {
          running = false;
        }
      });
    },
  };
}
