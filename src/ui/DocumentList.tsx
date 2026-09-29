import type { CaseDocument } from "./pipeline.js";

const STATUS_LABEL: Record<CaseDocument["status"], { label: string; className: string }> = {
  present: { label: "PRESENT", className: "pf-badge-neutral" },
  missing: { label: "MISSING", className: "pf-badge-blocked" },
  expired: { label: "EXPIRED", className: "pf-badge-blocked" },
  invalid: { label: "INVALID", className: "pf-badge-blocked" },
};

// Every required document renders a row. Missing documents are explicit rows,
// never silent gaps. Type labels are humanized presentation text; statuses
// and counts come from the domain run.
function displayType(documentType: CaseDocument["documentType"]): string {
  const words = documentType.split("-");
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function DocumentList({ documents }: { documents: CaseDocument[] }) {
  return (
    <ul className="pf-doc-list">
      {documents.map((doc) => {
        const status = STATUS_LABEL[doc.status];
        return (
          <li key={doc.documentType}>
            <div className="pf-doc-row">
              <span className={`pf-badge ${status.className}`}>{status.label}</span>
              <span className="pf-doc-type">{displayType(doc.documentType)}</span>
              <span className="pf-doc-id">{doc.documentId ?? "not supplied"}</span>
              <span className="pf-doc-meta">
                {doc.fieldCount} field{doc.fieldCount === 1 ? "" : "s"} extracted
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
