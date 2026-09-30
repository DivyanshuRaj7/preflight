import { CASES } from "./cases.js";

// Application context header: what is being verified, the active
// application control, and the single Run action. Stage progress lives in
// the pipeline panel once a run exists — it is not duplicated here.
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
  return (
    <header className="pf-workspace">
      <p className="pf-eyebrow">Verify before you submit</p>
      <h1 className="pf-title">Scholarship Renewal</h1>
      <p className="pf-case-id" translate="no">
        {selected.id} · {selected.scenario.split("-").join(" ").toUpperCase()}
      </p>
      {selected.adversarial === true ? (
        <p className="pf-adversarial-flag">
          <span className="pf-badge pf-badge-awaiting" translate="no">
            ADVERSARIAL
          </span>{" "}
          Known limitation case — its result tests the system boundary, not a normal application.
        </p>
      ) : null}
      <div className="pf-controls">
        <div className="pf-field pf-field-grow">
          <label htmlFor="case-select">Active application</label>
          <select id="case-select" value={selectedId} onChange={(event) => onSelect(event.target.value)}>
            {CASES.map((c) => (
              <option key={c.id} value={c.id}>
                Scholarship Renewal · {c.id} · {c.scenario.split("-").join(" ")}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="pf-btn" onClick={onRun} disabled={running}>
          {running ? "Running…" : "Run Preflight"}
        </button>
      </div>
    </header>
  );
}
