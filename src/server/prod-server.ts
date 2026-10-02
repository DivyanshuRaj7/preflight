import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { executeCase } from "./execute-service.js";

// Production runtime: serves the built console + synthetic portal and hosts
// the SAME execution service as the dev bridge (no second engine, no mocks).
// Requires a host capable of running Node + Playwright Chromium; without
// browsers installed, /api/execute fails honestly and the UI shows its
// unavailable/error state. Static-only hosts cannot run this by design.
const PORT = Number(process.env.PORT ?? "4173");
const HOST = process.env.HOST ?? "0.0.0.0";
const DIST = join(process.cwd(), "dist");
const BODY_LIMIT = 4096;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

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

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function serveStatic(pathname: string, res: ServerResponse): void {
  // SPA fallback: the console (/) and the portal (/portal/*) are one client
  // bundle; any extensionless route serves index.html. Paths stay inside dist.
  const candidate = pathname === "/" ? "/index.html" : pathname;
  const file = normalize(join(DIST, candidate));
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  } catch {
    try {
      res.statusCode = pathname.startsWith("/assets/") ? 404 : 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFileSync(join(DIST, "index.html")));
    } catch {
      res.statusCode = 500;
      res.end("Build output missing: run npm run build first.");
    }
  }
}

let running = false;

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true, service: "preflight", bridge: true });
    return;
  }
  if (url.pathname === "/api/execute") {
    if (req.method !== "POST") {
      json(res, 405, { ok: false, stage: "request", error: "Use POST with a JSON body." });
      return;
    }
    if (running) {
      json(res, 409, { ok: false, stage: "request", error: "A browser-agent run is already in progress." });
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req)) as unknown;
    } catch {
      json(res, 400, { ok: false, stage: "request", error: "Invalid JSON body." });
      return;
    }
    running = true;
    try {
      // Explicit: this runtime has no display, so a visible browser is never
      // launched here regardless of what the client requests.
      const outcome = await executeCase(
        body as { caseId?: unknown; headed?: unknown; scenario?: unknown },
        `http://${req.headers.host ?? "localhost"}`,
        { allowHeaded: false },
      );
      json(res, outcome.status, outcome.body);
    } catch (error) {
      json(res, 500, {
        ok: false,
        stage: "execution",
        error: error instanceof Error ? error.message : "Browser execution failed.",
      });
    } finally {
      running = false;
    }
    return;
  }
  if (req.method === "GET") {
    serveStatic(url.pathname, res);
    return;
  }
  res.statusCode = 405;
  res.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`Preflight production server: http://${HOST}:${PORT} (dist + portal + /api/execute)`);
});
