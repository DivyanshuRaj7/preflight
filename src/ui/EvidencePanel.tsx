import { LOW_CONFIDENCE_THRESHOLD } from "../domain/validation/preflight.js";
import type { Evidence, Finding } from "../domain/contracts.js";

function confidenceText(confidence: number | undefined): string {
  if (confidence === undefined) return "not recorded";
  const verdict = confidence < LOW_CONFIDENCE_THRESHOLD ? `below ${LOW_CONFIDENCE_THRESHOLD} threshold` : "meets threshold";
  return `${confidence} (${verdict})`;
}

// Shows one evidence item: document → evidence → finding traceability.
// Confidence is plain readable text, never a decorative gauge.
export function EvidencePanel({
  finding,
  evidence,
  selectedId,
}: {
  finding: Finding | null;
  evidence: Evidence[];
  selectedId: string | null;
}) {
  const item = evidence.find((e) => e.id === selectedId) ?? null;
  if (!finding || !item) {
    return (
      <section className="pf-evidence-idle" id="evidence" aria-label="Evidence detail">
        <h2>Evidence</h2>
        <p>Evidence appears here when a finding references it.</p>
      </section>
    );
  }
  return (
    <section className="pf-evidence-panel" id="evidence" aria-label="Evidence detail">
      <h2>Evidence</h2>
      <dl>
            <dt>Evidence ID</dt>
            <dd className="mono" translate="no">
              {item.id}
            </dd>
            <dt>Document</dt>
            <dd className="mono" translate="no">
              {item.documentId}
            </dd>
            <dt>Document type</dt>
            <dd>{item.documentType ?? "not recorded"}</dd>
            <dt>Field</dt>
            <dd className="mono" translate="no">
              {item.field ?? "not recorded"}
            </dd>
            <dt>Extracted value</dt>
            <dd>{item.text ?? "not recorded"}</dd>
            <dt>Confidence</dt>
            <dd>{confidenceText(item.confidence)}</dd>
            <dt>Page</dt>
            <dd>{item.page !== undefined ? `page ${item.page}` : "not recorded"}</dd>
            <dt>Method</dt>
            <dd className="mono">{item.extractionMethod}</dd>
            <dt>Supports finding</dt>
            <dd className="mono" translate="no">
              {finding.ruleId}
            </dd>
          </dl>
          <p className="pf-evidence-trace" translate="no">
            {item.documentId} → {item.text ?? "∅"} → {item.id} → {finding.ruleId}
          </p>
    </section>
  );
}
