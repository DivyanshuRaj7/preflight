import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authorizeSubmission } from "../domain/submission/authorize.js";
import { checkApproval, grantApproval } from "../domain/submission/approval.js";
import { buildReviewSnapshot, type ReviewSnapshot } from "../domain/submission/review.js";
import type { ApprovalRecord } from "../domain/submission/approval.js";
import type { PreflightRun } from "./pipeline.js";

// Compact review trigger + modal dialog around the existing approval flow
// (TASK: premium review interaction). The approval state machine is
// untouched: explicit grant bound to the snapshot fingerprint, domain
// authorization verdict, invalidation on change. The modal is presentation
// only — it never approves, authorizes, or submits anything by itself.
function humanizeField(field: string): string {
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="pf-trigger-chevron">
      <path d="M4.5 2.5l3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ApprovalPanel({ run }: { run: PreflightRun }) {
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  let snapshot: ReviewSnapshot | null = null;
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

  // Dialog lifecycle: move focus in, trap Tab, close on Escape, lock the
  // background scroll, and return focus to the trigger on close. Closing
  // never touches approval state — that stays with the state machine.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>("button, [href]")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open ]);

  function approve() {
    if (!snapshot) return;
    setApproval(
      grantApproval({
        applicationId: snapshot.applicationId,
        fingerprint: snapshot.fingerprint,
        approvedAt: new Date().toISOString(),
      }),
    );
    setOpen(false);
  }

  const fieldCount = snapshot ? Object.keys(snapshot.values).length : 0;

  return (
    <section className="pf-approval" aria-label="Final review and approval">
      <h2 className="pf-section-title">Final review</h2>
      <p className="pf-summary">Review the verified application state before approving submission.</p>
      {snapshotError || !snapshot ? (
        <p className="pf-summary">{snapshotError ?? "Review unavailable."}</p>
      ) : (
        <>
          {approval === null ? (
            <button ref={triggerRef} type="button" className="pf-review-trigger" onClick={() => setOpen(true)}>
              <ChevronIcon />
              <span className="pf-review-trigger-text">Review verified application</span>
              <span className="pf-review-trigger-meta" translate="no">
                {snapshot.preflightStatus} · {snapshot.portalState} · {fieldCount} fields
              </span>
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
          {open
            ? createPortal(
                <div
                  className="pf-modal-backdrop"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) setOpen(false);
                  }}
                >
                  <div
                    ref={dialogRef}
                    className="pf-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pf-review-title"
                    tabIndex={-1}
                  >
                    <div className="pf-modal-scroll">
                      <div className="pf-modal-head">
                        <div>
                          <h2 id="pf-review-title" className="pf-modal-title">
                            Review before approval
                          </h2>
                          <p className="pf-modal-case mono" translate="no">
                            {snapshot.applicationId}
                          </p>
                          <p className="pf-modal-states" translate="no">
                            {snapshot.preflightStatus} · {snapshot.portalState}
                          </p>
                        </div>
                        <button type="button" className="pf-modal-close" aria-label="Close review dialog" onClick={() => setOpen(false)}>
                          <CloseIcon />
                        </button>
                      </div>
                      <p className="pf-modal-purpose">Review this verified state before approving submission.</p>
                      <ul className="pf-modal-status" aria-label="Review status">
                        <li>
                          <span className="pf-modal-check" aria-hidden="true">
                            ✓
                          </span>
                          <div>
                            <strong translate="no">{snapshot.preflightStatus}</strong>
                            <span>
                              {run.decision.issues.length === 0
                                ? "No blocking issues detected."
                                : `${run.decision.issues.length} finding(s) on record — see Findings on the main page.`}
                            </span>
                          </div>
                        </li>
                        <li>
                          <span className="pf-modal-check" aria-hidden="true">
                            ✓
                          </span>
                          <div>
                            <strong translate="no">{snapshot.portalState}</strong>
                            <span>Portal state recorded in this review snapshot.</span>
                          </div>
                        </li>
                      </ul>
                      <h3 className="pf-modal-subhead">Applicant</h3>
                      <dl className="pf-applicant-grid">
                        {(
                          Object.entries(snapshot.values) as [string, string][]
                        ).map(([field, value]) => (
                          <div key={field} className={field === "address" ? "pf-applicant-wide" : undefined}>
                            <dt>{humanizeField(field)}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <h3 className="pf-modal-subhead">State fingerprint</h3>
                      <p className="pf-modal-fingerprint mono" translate="no">
                        {snapshot.fingerprint}
                      </p>
                      <p className="pf-summary pf-modal-warning">
                        Approval applies only to this exact verified state. Any relevant change invalidates
                        approval.
                      </p>
                    </div>
                    <div className="pf-modal-actions">
                      <button type="button" className="pf-btn-secondary" onClick={() => setOpen(false)}>
                        Cancel
                      </button>
                      <button type="button" className="pf-btn" onClick={approve}>
                        Approve submission
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </>
      )}
    </section>
  );
}
