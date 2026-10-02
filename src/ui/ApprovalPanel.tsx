import { useState } from "react";
import { authorizeSubmission } from "../domain/submission/authorize.js";
import { checkApproval, grantApproval } from "../domain/submission/approval.js";
import { buildReviewSnapshot } from "../domain/submission/review.js";
import type { ApprovalRecord } from "../domain/submission/approval.js";
import type { PreflightRun } from "./pipeline.js";

// Minimal approval boundary UI (TASK-007). Shows the final review a human
// must read before approving, records an explicit approval bound to the
// review fingerprint, and presents the domain authorization verdict. This
// console performs no browser execution, so authorization honestly reports
// what is missing. It never submits anything.
export function ApprovalPanel({ run }: { run: PreflightRun }) {
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);

  let snapshot = null;
  let snapshotError: string | null = null;
  try {
    snapshot = buildReviewSnapshot({
      applicationId: run.caseId,
      profile: run.profile,
      evidence: run.evidence,
      preflight: run.decision,
      portalState: "SAVED",
    });
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : "Review unavailable.";
  }

  const check = approval && snapshot ? checkApproval(approval, snapshot.fingerprint) : null;
  const authorization =
    snapshot !== null
      ? authorizeSubmission({
          preflight: run.decision,
          executionStatus: "IDLE",
          portalState: "SAVED",
          snapshot,
          approval,
        })
      : null;

  return (
    <section className="pf-approval" aria-label="Final review and approval">
      <h2 className="pf-section-title">Final review</h2>
      <p className="pf-summary">Review the verified application state before approving submission.</p>
      {snapshotError || !snapshot ? (
        <p className="pf-summary">{snapshotError ?? "Review unavailable."}</p>
      ) : (
        <>
          <p className="pf-review-state">
            Verified state · <strong>{snapshot.preflightStatus}</strong>
            <span aria-hidden="true"> · </span>Portal state · <strong>{snapshot.portalState}</strong>
          </p>
          <details className="pf-review-details">
            <summary>Review before approval</summary>
            <dl className="pf-review-list">
              <div>
                <dt>Application</dt>
                <dd translate="no">{snapshot.applicationId}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{snapshot.preflightStatus}</dd>
              </div>
              <div>
                <dt>Portal state</dt>
                <dd>{snapshot.portalState}</dd>
              </div>
              {(
                Object.entries(snapshot.values) as [string, string][]
              ).map(([field, value]) => (
                <div key={field}>
                  <dt translate="no">{field}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div>
                <dt>State fingerprint</dt>
                <dd className="mono" translate="no">
                  {snapshot.fingerprint}
                </dd>
              </div>
            </dl>
          </details>
          {approval === null ? (
            <button
              type="button"
              className="pf-btn"
              onClick={() =>
                setApproval(
                  grantApproval({
                    applicationId: snapshot.applicationId,
                    fingerprint: snapshot.fingerprint,
                    approvedAt: new Date().toISOString(),
                  }),
                )
              }
            >
              Approve submission
            </button>
          ) : (
            <p className="pf-summary">
              Approval: <strong>{check?.status ?? "INVALIDATED"}</strong> · fingerprint{" "}
              <span className="mono" translate="no">
                {approval.reviewedFingerprint}
              </span>
            </p>
          )}
          <p className="pf-summary">
            Approval applies only to this exact verified state. Any relevant change invalidates approval.
          </p>
          {authorization && !authorization.authorized ? (
            <>
              <p className="pf-summary">
                Submission: not authorized — <span className="mono">{authorization.reason}</span>
              </p>
              <p className="pf-summary">
                Approval covers this reviewed state. Submission is a separate gate that additionally
                requires a verified browser execution, which this console does not perform.
              </p>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
