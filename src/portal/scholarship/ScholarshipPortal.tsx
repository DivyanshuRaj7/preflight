import { useState } from "react";
import { initialPortalState, saveDraft } from "./portal-state.js";
import "./portal.css";

// Synthetic Scholarship Renewal Portal (TASK-005A). A standalone fictional
// application website that a browser agent will operate in later tasks. It is
// deliberately NOT the Preflight console: no evidence, no findings, no
// validation, no approval, no submission. Synthetic data only — never a real
// government or university portal.
const DEMO_APPLICANT: Record<string, string> = {
  fullName: "Rina Das",
  dateOfBirth: "2004-05-17",
  address: "14 Lake Road, Kolkata 700029",
  annualIncome: "180000",
  bankAccount: "SYNTHETIC-001234",
  applicationReference: "SCH-2026-001",
};

const EXPECTED_DOCUMENTS = [
  "Identity Document",
  "Marksheet",
  "Income Certificate",
  "Bank Proof",
] as const;

export function ScholarshipPortal() {
  // Deterministic test instrumentation (TASK-006): query-param scenario
  // modes alter portal behavior without randomness or network. Absent param
  // = default portal; existing tests and behavior are untouched.
  const [scenario] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("scenario") ?? "",
  );
  const [status, setStatus] = useState(initialPortalState);
  const [saveAttempts, setSaveAttempts] = useState(0);
  const [saveStuck, setSaveStuck] = useState(false);
  const [fullName, setFullName] = useState(DEMO_APPLICANT.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(DEMO_APPLICANT.dateOfBirth);
  const [address, setAddress] = useState(DEMO_APPLICANT.address);
  const [annualIncome, setAnnualIncome] = useState(DEMO_APPLICANT.annualIncome);
  const [bankAccount, setBankAccount] = useState(DEMO_APPLICANT.bankAccount);
  const [applicationReference, setApplicationReference] = useState(DEMO_APPLICANT.applicationReference);
  function handleSaveDraft(): void {
    if (scenario === "flaky-save" && saveAttempts === 0) {
      // Deterministic recoverable failure: the first attempt silently does
      // nothing observable; the portal provably remains DRAFT.
      setSaveAttempts(1);
      return;
    }
    if (scenario === "unknown-save") {
      // Deterministic inconclusive failure: the request leaves and the state
      // never resolves — neither SAVED nor confirmably DRAFT.
      setSaveAttempts(saveAttempts + 1);
      setSaveStuck(true);
      return;
    }
    setSaveAttempts(saveAttempts + 1);
    setStatus(saveDraft());
  }

  const visibleStatus = status === "SAVED" ? "SAVED" : saveStuck ? "SAVING…" : status;

  return (
    <div className="sp-page">
      <a className="sp-skip" href="#sp-form">
        Skip to application form
      </a>
      <header className="sp-masthead">
        <p className="sp-synth" translate="no">
          SYNTHETIC PORTAL
        </p>
        <h1>Scholarship Renewal Portal</h1>
        <p className="sp-sub">Synthetic Student Scholarship Program — Renewal Application</p>
      </header>
      <main
        className="sp-main"
        id="sp-form"
        data-testid="scholarship-portal"
      >
        <section aria-label="Application status">
          <h2 className="sp-section-title">Application status</h2>
          <p className="sp-status" data-testid="application-status" role="status" aria-live="polite">
            {visibleStatus}
          </p>
        </section>
        <section aria-label="Applicant details">
          <h2 className="sp-section-title">Applicant details</h2>
          <div className="sp-field">
            <label htmlFor="full-name">{scenario === "label-drift" ? "Applicant Legal Name" : "Full Name"}</label>
            <input
              id="full-name"
              data-testid="full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="sp-field">
            <label htmlFor="date-of-birth">Date of Birth</label>
            <input
              id="date-of-birth"
              data-testid="date-of-birth"
              name="dateOfBirth"
              type="date"
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </div>
          <div className="sp-field">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              data-testid="address"
              name="address"
              autoComplete="street-address"
              rows={3}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="sp-field">
            <label htmlFor="annual-income">Annual Family Income</label>
            <input
              id="annual-income"
              data-testid="annual-income"
              name="annualIncome"
              type="number"
              min={0}
              inputMode="numeric"
              value={annualIncome}
              onChange={(event) => setAnnualIncome(event.target.value)}
            />
          </div>
          <div className="sp-field">
            <label htmlFor="bank-account">Bank Account Number</label>
            <input
              id="bank-account"
              data-testid="bank-account"
              name="bankAccount"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={bankAccount}
              onChange={(event) => setBankAccount(event.target.value)}
            />
          </div>
          <div className="sp-field">
            <label htmlFor="application-reference">Scholarship Application Reference</label>
            <input
              id="application-reference"
              data-testid="application-reference"
              name="applicationReference"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={applicationReference}
              onChange={(event) => setApplicationReference(event.target.value)}
            />
          </div>
        </section>
        <section aria-label="Supporting documents">
          <h2 className="sp-section-title">Supporting Documents</h2>
          <ul className="sp-doc-list">
            {EXPECTED_DOCUMENTS.map((doc) => (
              <li key={doc}>
                <span aria-hidden="true">✓</span> {doc}
              </li>
            ))}
          </ul>
          <p className="sp-note">Informational only. Document upload is not part of this synthetic portal.</p>
        </section>
        <div className="sp-actions">
          <button type="button" data-testid="save-draft" onClick={handleSaveDraft}>
            Save Draft
          </button>
          {status === "SAVED" ? <p className="sp-saved-note">Draft saved</p> : null}
        </div>
      </main>
    </div>
  );
}
