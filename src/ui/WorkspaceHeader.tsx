import { CASES, DEMO_CASE_IDS, demoDisplayName } from "./cases.js";

// Compact application context: what is being verified, the synthetic-case
// evaluation control, and the single Run action. The decision surface lives
// in the pipeline panel — this header only selects the scenario.
export function WorkspaceHeader({
  selectedId,
  running,
  onSelect,
  onRun,
}: {
  selectedId: string;
  running: boolean;
  onSelect: (id: string) => void;
  onRun: () => void;
}) {
  const selected = CASES.find((c) => c.id === selectedId) ?? CASES[0];
  const demoCases = CASES.filter((c) => DEMO_CASE_IDS.includes(c.id));
  const extraCases = CASES.filter((c) => !DEMO_CASE_IDS.includes(c.id) && c.adversarial !== true);
  const documentCount = new Set(selected.evidence.map((e) => e.documentId)).size;
  return (
    <header className="pf-workspace">
      <p className="pf-eyebrow">Verify before you submit</p>
      <div className="pf-context-row">
        <h1 className="pf-title">Scholarship Renewal</h1>
        <p className="pf-case-id" translate="no">
          {selected.id} · {selected.scenario.split("-").join(" ").toUpperCase()}
        </p>
      </div>
      <p className="pf-lede">Verify documents, cross-check application data, and catch blocking issues before submission.</p>
      {selected.adversarial === true ? (
        <p className="pf-adversarial-flag">
          <span className="pf-badge pf-badge-awaiting" translate="no">
            ADVERSARIAL
          </span>{" "}
          Known limitation case — its result tests the system boundary, not a normal application.
        </p>
      ) : null}
      <div className="pf-demo">
        <div className="pf-controls">
          <div className="pf-field pf-field-grow">
            <label htmlFor="case-select">Synthetic case</label>
            <select id="case-select" value={selectedId} onChange={(event) => onSelect(event.target.value)}>
              <optgroup label="Synthetic demo cases">
                {demoCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {demoDisplayName(c.id)}
                  </option>
                ))}
              </optgroup>
              {extraCases.length > 0 ? (
                <optgroup label="Additional evaluation cases">
                  {extraCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.scenario.split("-").join(" ")}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
          <button type="button" className="pf-btn" onClick={onRun} disabled={running}>
            {running ? "Running…" : "Run Preflight"}
          </button>
        </div>
        <p className="pf-context-line" translate="no">
          Synthetic fixture · {documentCount} supporting documents · no personal data
        </p>
      </div>
    </header>
  );
}
