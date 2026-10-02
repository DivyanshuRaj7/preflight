import { useRef, useState } from "react";
import { describeExecution, type ExecuteBridgePayload } from "./execution-trace.js";

type Phase = "idle" | "running" | "done" | "error" | "unavailable";

const REQUEST_TIMEOUT_MS = 240_000;

// Browser-agent runner (UI presentation only). On READY it POSTs to the
// dev-only /api/execute bridge, which drives a real Chromium through the
// existing execution stack and returns the real result + trace. Every line
// rendered here is derived from that response. No staged steps, no fake
// progress: while the request is pending the UI shows only an honest busy
// state with Cancel. Static builds have no endpoint — the panel says so.
export function BrowserAgentPanel({ caseId }: { caseId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [payload, setPayload] = useState<ExecuteBridgePayload | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleRun() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setPhase("running");
    setPayload(null);
    setFailure(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
        signal: controller.signal,
      });
      if (res.status === 404) {
        setPhase("unavailable");
        return;
      }
      const body = (await res.json()) as
        | (ExecuteBridgePayload & { ok: true })
        | { ok: false; stage: string; error: string };
      if (!body.ok || !res.ok) {
        setPhase("error");
        setFailure(!body.ok ? `${body.stage}: ${body.error}` : `Request failed with HTTP ${res.status}.`);
        return;
      }
      setPayload(body);
      setPhase("done");
    } catch (error) {
      if (controller.signal.aborted) {
        setPhase("idle");
        return;
      }
      setPhase("error");
      setFailure(error instanceof Error ? error.message : "Browser execution request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  const trace = payload ? describeExecution(payload) : null;

  return (
    <section className="pf-agent" aria-label="Browser agent execution">
      <h2 className="pf-section-title">Browser agent</h2>
      {phase === "idle" || phase === "running" ? (
        <>
          <p className="pf-summary">
            Run the verified application through the synthetic portal in a real browser: inspect,
            map, fill, independently read back, save, and verify SAVED.
          </p>
          <div className="pf-agent-controls">
            <button type="button" className="pf-btn" onClick={handleRun} disabled={phase === "running"}>
              {phase === "running" ? "Browser agent running…" : "Run browser agent"}
            </button>
            {phase === "running" ? (
              <button type="button" className="pf-btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            ) : null}
          </div>
          <p className="pf-summary pf-agent-note">
            Runs a real Chromium on the server. To watch it locally, run the console with `npm run dev`.
          </p>
        </>
      ) : null}
      {phase === "unavailable" ? (
        <p className="pf-summary">Browser execution is unavailable in this build (no runtime bridge).</p>
      ) : null}
      {phase === "error" ? (
        <div role="status">
          <p className="pf-summary">
            <strong>Browser agent did not complete.</strong>
          </p>
          <p className="pf-summary mono" translate="no">
            {failure}
          </p>
          <button type="button" className="pf-btn-secondary" onClick={handleRun}>
            Try again
          </button>
        </div>
      ) : null}
      {phase === "done" && trace && payload ? (
        <div role="status" aria-live="polite">
          <ul className="pf-trace-list">
            {trace.rows.map((row) => (
              <li key={row.text} className={row.ok ? "is-ok" : "is-bad"}>
                <span aria-hidden="true">{row.ok ? "✓" : "!"}</span> {row.text}
              </li>
            ))}
          </ul>
          {trace.fields.length > 0 ? (
            <>
              <h3 className="pf-trace-subhead">Independently verified values</h3>
              <dl className="pf-trace-values">
                {trace.fields.map((field) => (
                  <div key={field.canonicalField}>
                    <dt translate="no">{field.canonicalField}</dt>
                    <dd>
                      <span translate="no">{field.expected}</span>
                      <span aria-hidden="true"> {field.expected === field.observed ? "=" : "≠"} </span>
                      <span translate="no">{field.observed}</span>{" "}
                      <span aria-hidden="true">{field.verified ? "✓" : "!"}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          <p className={`pf-trace-completion ${trace.completion.ok ? "is-ok" : "is-bad"}`}>
            {trace.completion.text}
          </p>
          <button type="button" className="pf-btn-secondary" onClick={handleRun}>
            Run again
          </button>
        </div>
      ) : null}
    </section>
  );
}
