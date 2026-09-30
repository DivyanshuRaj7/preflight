import type { PreflightRun } from "./pipeline.js";

type StageState = "ready" | "blocked" | "attention";

type Stage = { name: string; detail: string; state: StageState };

function stageClass(state: StageState): string {
  switch (state) {
    case "ready":
      return "is-ready";
    case "blocked":
      return "is-blocked";
    case "attention":
      return "is-attention";
  }
}

function countEvidencedCriticalFields(run: PreflightRun): number {
  const profile = run.profile;
  return [profile.name, profile.dateOfBirth, profile.address].filter((f) => f !== undefined).length;
}

// Verification pipeline: one segmented status row, a labeled document-
// coverage bar, and the decision. Every count and status is computed from
// the run — never staged animation or hard-coded demo content.
export function PipelinePanel({ run }: { run: PreflightRun }) {
  const present = run.documents.filter((d) => d.status === "present").length;
  const missing = run.documents.length - present;
  const succeeded = run.results.filter((r) => r.status === "SUCCESS").length;
  const partial = run.results.filter((r) => r.status === "PARTIAL").length;
  const failed = run.results.filter((r) => r.status === "FAILED").length;
  const low = run.results.filter((r) => r.status === "LOW_CONFIDENCE").length;
  const blocking = run.decision.issues.filter((issue) => issue.blocking).length;
  const criticalFields = countEvidencedCriticalFields(run);
  const ready = run.decision.status === "READY";

  const extractionDetail = [
    `${succeeded} succeeded`,
    ...(partial > 0 ? [`${partial} partial`] : []),
    ...(low > 0 ? [`${low} low confidence`] : []),
    ...(failed > 0 ? [`${failed} failed`] : []),
  ].join(" · ");
  const extractionState: StageState =
    failed > 0 ? "blocked" : partial + low > 0 ? "attention" : "ready";

  const stages: Stage[] = [
    {
      name: "Documents",
      detail: `${present} / ${run.documents.length} present`,
      state: missing > 0 ? "blocked" : "ready",
    },
    { name: "Extraction", detail: extractionDetail, state: extractionState },
    {
      name: "Validation",
      detail: ready ? "READY" : "BLOCKED",
      state: ready ? "ready" : "blocked",
    },
  ];

  const barPercent = run.documents.length === 0 ? 0 : Math.round((present / run.documents.length) * 100);

  return (
    <section className="pf-pipeline" aria-label="Verification pipeline">
      <p className={`pf-decision-word ${ready ? "is-ready" : "is-blocked"}`} role="status" aria-live="polite">
        <span className="pf-decision-dot" aria-hidden="true" />
        {ready ? "READY" : "BLOCKED"}
      </p>
      {ready ? (
        <div className="pf-decision-body">
          <p>No blocking issues detected.</p>
          <p className="pf-decision-sub">Evidence passed Preflight&apos;s defined validation checks.</p>
          <p className="pf-decision-counts">
            {run.documents.length} documents · {criticalFields} critical fields · {blocking} blocking findings
          </p>
          <p className="pf-decision-note">Submission requires explicit human approval.</p>
        </div>
      ) : (
        <div className="pf-decision-body">
          <p>
            This application cannot proceed until {blocking} issue{blocking === 1 ? "" : "s"}{" "}
            {blocking === 1 ? "is" : "are"} resolved.
          </p>
          <div className="pf-pipeline-actions">
            <a className="pf-btn pf-btn-link" href="#findings">
              Review findings
            </a>
            <button
              type="button"
              className="pf-btn-secondary"
              onClick={() => document.getElementById("case-select")?.focus()}
            >
              Verify another application
            </button>
          </div>
        </div>
      )}
      <ol className="pf-stage-row" aria-label="Pipeline stages">
        {stages.map((stage) => (
          <li key={stage.name} className={`pf-stage-cell ${stageClass(stage.state)}`}>
            <span className="pf-stage-dot" aria-hidden="true" />
            <div>
              <p className="pf-stage-name">{stage.name}</p>
              <p className="pf-stage-detail">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="pf-coverage">
        <div className="pf-coverage-head">
          <span>Document coverage</span>
          <span>
            {present} / {run.documents.length} documents present
          </span>
        </div>
        <div
          className="pf-progress"
          role="progressbar"
          aria-label="Document coverage"
          aria-valuemin={0}
          aria-valuemax={run.documents.length}
          aria-valuenow={present}
        >
          <div
            className={`pf-progress-fill ${missing > 0 ? "is-blocked" : "is-ready"}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
