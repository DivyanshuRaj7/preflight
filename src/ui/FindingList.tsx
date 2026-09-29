import type { Evidence, Finding } from "../domain/contracts.js";
import { StatusBadge } from "./StatusBadge.js";

export type EvidenceSelection = { findingIndex: number; evidenceId: string };

// Cited evidence grouped by source document: the generic "why" behind any
// finding. No rule knowledge here — grouping and display only. Rendered only
// when the finding cites more than one distinct extracted value.
function ComparedValues({
  finding,
  evidenceById,
}: {
  finding: Finding;
  evidenceById: Map<string, Evidence>;
}) {
  const groups = new Map<string, { docType: string; docId: string; value: string }>();
  for (const id of finding.evidenceIds) {
    const item = evidenceById.get(id);
    if (!item || item.text === undefined || item.text === "") continue;
    const group = groups.get(item.documentId) ?? {
      docType: item.documentType ?? "document",
      docId: item.documentId,
      value: item.text,
    };
    groups.set(item.documentId, group);
  }
  const rows = [...groups.values()];
  const distinct = new Set(rows.map((r) => r.value.trim().toLowerCase()));
  if (distinct.size <= 1) return null;
  return (
    <div className="pf-compared">
      <p className="pf-compared-title">Compared values</p>
      <dl>
        {rows.map((row) => (
          <div className="pf-compared-row" key={row.docId}>
            <dt translate="no">
              {row.docType} · {row.docId}
            </dt>
            <dd className="mismatch">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FindingCard({
  finding,
  index,
  evidenceById,
  selected,
  selectedEvidenceId,
  onSelect,
}: {
  finding: Finding;
  index: number;
  evidenceById: Map<string, Evidence>;
  selected: boolean;
  selectedEvidenceId: string | null;
  onSelect: (selection: EvidenceSelection | null, findingIndex: number) => void;
}) {
  return (
    <article className={`pf-finding${finding.blocking ? " is-blocking" : ""}`} aria-labelledby={`finding-${index}-title`}>
      <div className="pf-finding-head">
        {finding.blocking ? (
          <StatusBadge status="BLOCKED" />
        ) : (
          <span className="pf-badge pf-badge-neutral">{finding.severity.toUpperCase()}</span>
        )}
        <h3 id={`finding-${index}-title`}>{finding.message}</h3>
      </div>
      <p className="pf-why">
        <span className="pf-rule" translate="no">
          {finding.ruleId}
        </span>
        {" · "}
        <span className="pf-severity">
          severity {finding.severity}
          {finding.blocking ? " · blocking" : " · non-blocking"}
          {finding.field ? ` · field ${finding.field}` : ""}
        </span>
      </p>
      <ComparedValues finding={finding} evidenceById={evidenceById} />
      {finding.evidenceIds.length > 0 ? (
        <ul className="pf-ev-refs" aria-label={`Evidence for ${finding.ruleId}`}>
          <li className="pf-ev-refs-label" aria-hidden="true">
            Evidence
          </li>
          {finding.evidenceIds.map((id) => {
            const item = evidenceById.get(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className="pf-ev-chip"
                  translate="no"
                  aria-pressed={selected && selectedEvidenceId === id}
                  title={item ? `${item.field ?? "field"}: ${item.text ?? ""}` : id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect({ findingIndex: index, evidenceId: id }, index);
                  }}
                >
                  {id}
                  {item ? ` → ${item.documentId}` : ""}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="pf-remediation">
        <strong>Remediation</strong>
        {finding.remediation}
      </div>
    </article>
  );
}

// Renders domain findings verbatim, in engine order. No finding is invented,
// reworded, or reordered here.
export function FindingList({
  issues,
  evidenceById,
  selectedIndex,
  selectedEvidenceId,
  onSelect,
}: {
  issues: Finding[];
  evidenceById: Map<string, Evidence>;
  selectedIndex: number;
  selectedEvidenceId: string | null;
  onSelect: (selection: EvidenceSelection | null, findingIndex: number) => void;
}) {
  const blocking = issues.filter((issue) => issue.blocking).length;
  if (issues.length === 0) {
    return (
      <p className="pf-quiet-result" role="status">
        <strong>All checks passed</strong>
        <span>No blocking findings were detected.</span>
      </p>
    );
  }
  return (
    <>
      <p className="pf-summary">
        <strong>{blocking} blocking</strong> · {issues.length - blocking} non-blocking · order set by the
        validation engine
      </p>
      <ol className="pf-finding-list">
        {issues.map((finding, index) => (
          <li key={`${finding.ruleId}-${index}`}>
            <FindingCard
              finding={finding}
              index={index}
              evidenceById={evidenceById}
              selected={selectedIndex === index}
              selectedEvidenceId={selectedEvidenceId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ol>
    </>
  );
}
