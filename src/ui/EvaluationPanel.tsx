import { useEffect, useState } from "react";
import type { EvaluationSummary } from "../server/evaluation-service.js";

type Phase = "loading" | "ready" | "unavailable";

// Evidence console for measured evaluation output. Every value is rendered
// from the harness artifact served by /api/evaluation; nothing is restated
// here. Missing data shows an explicit unavailable state rather than numbers.
export function EvaluationPanel() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [showCases, setShowCases] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/evaluation")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as EvaluationSummary;
      })
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "loading") {
    return (
      <section className="pf-eval" aria-label="Evaluation" aria-busy="true">
        <h2 className="pf-section-title">Evaluation</h2>
        <p className="pf-summary">Loading measured results…</p>
      </section>
    );
  }

  if (phase === "unavailable" || summary === null) {
    return (
      <section className="pf-eval" aria-label="Evaluation">
        <h2 className="pf-section-title">Evaluation</h2>
        <p className="pf-summary">Evaluation results are unavailable in this build.</p>
        <p className="pf-summary">No measurement artifact is present, so no numbers are shown.</p>
      </section>
    );
  }

  const { standard, safety, full, boundary, ocr, cases } = summary;

  return (
    <section className="pf-eval" aria-label="Evaluation">
      <h2 className="pf-eval-title">Evaluation</h2>
      <p className="pf-eval-tagline">Measured, not claimed.</p>
      <p className="pf-eval-lede">
        Preflight was evaluated on a synthetic decision set designed to test correctness, safety,
        recovery, and submission control.
      </p>

      <div className="pf-eval-primary">
        <p className="pf-eval-big" aria-label={`${standard.correct} of ${standard.total} standard cases correct`}>
          <span>{standard.correct}</span> <span className="pf-eval-slash">/</span> <span>{standard.total}</span>
        </p>
        <p className="pf-eval-big-label">Standard cases correct</p>
      </div>

      <dl className="pf-eval-grid">
        <div>
          <dt>Baseline</dt>
          <dd>
            {standard.baselineCorrect} / {standard.total}
          </dd>
          <p>Naive baseline on the same cases</p>
        </div>
        <div>
          <dt>Unsafe continuations prevented</dt>
          <dd>
            {standard.unsafePrevented} / {standard.unsafeTotal}
          </dd>
          <p>Cases that would have proceeded unsafely</p>
        </div>
        <div>
          <dt>Safety probes denied</dt>
          <dd>
            {safety.probesDenied} / {safety.probesTotal}
          </dd>
          <p>Submission attempts that had to be refused</p>
        </div>
        <div>
          <dt>Unauthorized submissions</dt>
          <dd>{safety.unauthorizedSubmissions}</dd>
          <p>Probes that reached a submission decision</p>
        </div>
      </dl>

      <div className="pf-eval-secondary">
        <div>
          <p className="pf-eval-secondary-value">
            {full.correct} / {full.total}
          </p>
          <p className="pf-eval-secondary-label">Full evaluation</p>
          <p className="pf-eval-secondary-note">
            {boundary ? `${boundary.caseId} — known adversarial consistency boundary` : "All cases correct"}
          </p>
        </div>
        <div>
          <p className="pf-eval-secondary-value">{ocr ? `${ocr.passed} / ${ocr.total}` : "—"}</p>
          <p className="pf-eval-secondary-label">OCR evaluation</p>
          <p className="pf-eval-secondary-note">
            {ocr ? "Real PaddleOCR over synthetic document fixtures" : "Not measured in this build"}
          </p>
        </div>
      </div>

      {boundary ? (
        <div className="pf-eval-boundary">
          <p className="pf-eval-boundary-title">
            {boundary.caseId}: expected {boundary.expected}, observed {boundary.actual}
          </p>
          <p>
            {boundary.caseId} contains uniformly false but internally consistent evidence. The same
            evidence cannot prove itself wrong. Independent evidence, a trusted source, or human
            review is required. Preflight verifies consistency and workflow correctness, not ground
            truth — and explicit human approval is still required before any submission.
          </p>
        </div>
      ) : null}

      <div className="pf-eval-cases">
        <button
          type="button"
          className="pf-btn-secondary"
          aria-expanded={showCases}
          onClick={() => setShowCases(!showCases)}
        >
          {showCases ? "Hide" : "Show"} per-case results ({cases.length})
        </button>
        {showCases ? (
          <div className="pf-eval-table-wrap">
            <table className="pf-eval-table">
              <caption className="pf-eval-caption">
                Per-case results from the evaluation artifact (source: {summary.generatedBy})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Category</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Preflight</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((row) => (
                  <tr key={row.caseId} className={row.preflightCorrect ? undefined : "is-boundary"}>
                    <th scope="row" className="mono">
                      {row.caseId}
                    </th>
                    <td>{row.category}</td>
                    <td className="mono">{row.expected}</td>
                    <td className="mono">{row.preflight}</td>
                    <td className={row.preflightCorrect ? "pf-eval-pass" : "pf-eval-boundary-cell"}>
                      {row.preflightCorrect ? "correct" : "boundary"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}