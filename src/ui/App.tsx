import { useEffect, useState } from "react";
import { CASES } from "./cases.js";
import { runPreflightCase, type PreflightRun } from "./pipeline.js";
import { PreflightMark, MoonIcon, SunIcon } from "./Logo.js";
import { WorkspaceHeader } from "./WorkspaceHeader.js";
import { PipelinePanel } from "./PipelinePanel.js";
import { ApprovalPanel } from "./ApprovalPanel.js";
import { FindingList, type EvidenceSelection } from "./FindingList.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { DocumentList } from "./DocumentList.js";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  // Fresh loads default to light; the toggle (and only the toggle) enables dark.
  return "light";
}

// Preflight workspace: masthead, application context, decision, findings,
// evidence, documents. Presentation only — every value comes from the domain
// pipeline in pipeline.ts.
export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const [run, setRun] = useState<PreflightRun | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState(0);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function selectCase(id: string) {
    // Switching cases clears stale results immediately — never show one
    // case's findings under another case's name.
    setSelectedId(id);
    setRun(null);
    setSelectedFinding(0);
    setSelectedEvidence(null);
  }

  async function handleRun() {
    const input = CASES.find((c) => c.id === selectedId) ?? CASES[0];
    setRunning(true);
    try {
      const result = await runPreflightCase(input);
      setRun(result);
      setSelectedFinding(0);
      setSelectedEvidence(result.decision.issues[0]?.evidenceIds[0] ?? null);
    } finally {
      setRunning(false);
    }
  }

  function handleFindingSelect(selection: EvidenceSelection | null, findingIndex: number) {
    setSelectedFinding(findingIndex);
    setSelectedEvidence(selection?.evidenceId ?? null);
  }

  const evidenceById = new Map((run?.evidence ?? []).map((item) => [item.id, item]));
  const activeFinding = run && run.decision.issues.length > 0 ? run.decision.issues[selectedFinding] ?? null : null;

  return (
    <>
      <a className="pf-skip" href="#workspace">
        Skip to workspace
      </a>
      <div className="pf-topbar">
        <span className="pf-brand">
          <PreflightMark />
          <span className="pf-wordmark">Preflight</span>
          <span className="pf-wordmark-sub">The Application Compiler</span>
        </span>
        <div className="pf-topbar-right">
          <span className="pf-synth-pill" translate="no">
            SYNTHETIC
          </span>
          <span className="pf-refdate">ref 2026-09-30</span>
          <button
            type="button"
            className="pf-theme-toggle"
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </div>
      <main className="pf-main" id="workspace">
        <WorkspaceHeader selectedId={selectedId} running={running} onSelect={selectCase} onRun={handleRun} />
        {running ? (
          <div className="pf-skeleton" aria-busy="true" aria-label="Validation running">
            <div className="pf-sk-line w60" />
            <div className="pf-sk-line w90" />
            <div className="pf-sk-line w40" />
          </div>
        ) : null}
        {!run && !running ? (
          <div className="pf-empty">
            <h2>Nothing validated yet</h2>
            <p>Verify an application before it is submitted. Choose a synthetic case above and run the check.</p>
            <ol>
              <li>Choose a synthetic case.</li>
              <li>Run Preflight.</li>
              <li>Read the findings, evidence, and remediation.</li>
            </ol>
            <p className="pf-empty-note">Synthetic data only. This interface never submits anything.</p>
          </div>
        ) : null}
        {run && !running ? (
          <>
            <div role="status" aria-live="polite" aria-label="Preflight result">
              <PipelinePanel run={run} finding={activeFinding} />
            </div>
            <section id="findings" aria-label="Validation findings">
              <h2 className="pf-section-title">Findings</h2>
              <FindingList
                issues={run.decision.issues}
                evidenceById={evidenceById}
                selectedIndex={selectedFinding}
                selectedEvidenceId={selectedEvidence}
                onSelect={handleFindingSelect}
              />
            </section>
            <EvidencePanel finding={activeFinding} evidence={run.evidence} selectedId={selectedEvidence} />
            <section id="documents" className="pf-docs" aria-label="Case documents">
              <h2 className="pf-section-title">Documents</h2>
              <DocumentList documents={run.documents} />
              <p className="pf-docs-more">Additional document types will be added.</p>
            </section>
            {run.decision.status === "READY" ? <ApprovalPanel run={run} /> : null}
          </>
        ) : null}
        <footer className="pf-footer">
          <p>
            AI for ambiguity. Code for correctness. · Synthetic data only — this interface never submits anything.
          </p>
        </footer>
</main>
    </>
  );
}
