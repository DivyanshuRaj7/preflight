// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../../src/ui/App.js";
import { CASES } from "../../src/ui/cases.js";
import { runPreflightCase } from "../../src/ui/pipeline.js";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import manifest from "../../fixtures/manifest.json" with { type: "json" };

async function runCase(caseId: string) {
  render(<App />);
  fireEvent.change(screen.getByLabelText(/synthetic case/i), { target: { value: caseId } });
  fireEvent.click(screen.getByRole("button", { name: /run preflight/i }));
  return screen;
}

async function findingsSection(s: typeof screen) {
  return within(await s.findByLabelText("Validation findings"));
}

describe("preflight UI", () => {
  it("stays in sync with the fixture manifest", () => {
    expect(CASES.map((c) => c.id)).toEqual((manifest as { cases: { id: string }[] }).cases.map((c) => c.id));
  });

  it("renders READY for CASE-001", async () => {
    const s = await runCase("CASE-001-clean");
    expect(await s.findByText("No blocking issues detected.")).toBeInTheDocument();
    expect(s.getByText(/Evidence passed Preflight's defined validation checks./)).toBeInTheDocument();
    expect(s.getByText("5 documents · 3 critical fields · 0 blocking findings")).toBeInTheDocument();
    expect(s.getByText("Submission requires explicit human approval.")).toBeInTheDocument();
    // No truth guarantee anywhere on a READY screen.
    expect(s.queryByText(/objectively true|guaranteed correct|guaranteed to be accepted/i)).not.toBeInTheDocument();
  });

  it("does not offer CASE-011 in the demo picker", async () => {
    const s = await runCase("CASE-001-clean");
    await s.findByText("No blocking issues detected.");
    const select = s.getByLabelText(/synthetic case/i) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).not.toContain("CASE-011-consistent-false-evidence");
  });

  it("does not label clean cases adversarial", async () => {
    const s = await runCase("CASE-001-clean");
    await s.findByText("No blocking issues detected.");
    expect(s.queryByText("ADVERSARIAL")).not.toBeInTheDocument();
  });

  it("renders BLOCKED with NAME_MISMATCH for CASE-002", async () => {
    const s = await runCase("CASE-002-name-mismatch");
    const findings = await findingsSection(s);
    expect(findings.getByText("NAME_MISMATCH")).toBeInTheDocument();
    expect(s.getAllByText("Rina Dey").length).toBeGreaterThan(0);
  });

  it("renders DOB mismatch for CASE-003", async () => {
    const s = await runCase("CASE-003-dob-mismatch");
    expect((await findingsSection(s)).getByText("DOB_MISMATCH")).toBeInTheDocument();
  });

  it("renders missing-document finding for CASE-004", async () => {
    const s = await runCase("CASE-004-missing-income-certificate");
    expect((await findingsSection(s)).getByText("MISSING_REQUIRED_DOCUMENT")).toBeInTheDocument();
    expect(s.getByText("MISSING", { selector: ".pf-doc-row .pf-badge" })).toBeInTheDocument();
  });

  it("renders expiry finding for CASE-005", async () => {
    const s = await runCase("CASE-005-expired-certificate");
    expect((await findingsSection(s)).getByText("DOCUMENT_EXPIRED")).toBeInTheDocument();
  });

  it("renders low-confidence finding for CASE-006", async () => {
    const s = await runCase("CASE-006-low-confidence-extraction");
    const findings = await findingsSection(s);
    expect(findings.getByText("LOW_CONFIDENCE_CRITICAL_FIELD")).toBeInTheDocument();
    expect(findings.getByText(/low extraction confidence \(0\.42\)/)).toBeInTheDocument();
  });

  it("renders address mismatch for CASE-007", async () => {
    const s = await runCase("CASE-007-address-mismatch");
    expect((await findingsSection(s)).getByText("ADDRESS_MISMATCH")).toBeInTheDocument();
  });

  it("renders multiple findings for CASE-008", async () => {
    const s = await runCase("CASE-008-combined-failures");
    const findings = await findingsSection(s);
    expect(findings.getByText("MISSING_REQUIRED_DOCUMENT")).toBeInTheDocument();
    expect(findings.getByText("NAME_MISMATCH")).toBeInTheDocument();
  });

  it("shows evidence references and remediation", async () => {
    const s = await runCase("CASE-002-name-mismatch");
    expect(await s.findByText(/ev-doc-bank-proof-name → doc-bank-proof/)).toBeInTheDocument();
    // The fix surfaces in the decision panel and verbatim in the finding.
    expect(s.getAllByText(/Ensure the applicant name matches/).length).toBeGreaterThanOrEqual(2);
    expect((await findingsSection(s)).getByText(/Ensure the applicant name matches/)).toBeInTheDocument();
  });

  it("surfaces the selected finding headline and fix in the decision panel", async () => {
    const s = await runCase("CASE-004-missing-income-certificate");
    const panel = within(await s.findByLabelText("Verification pipeline"));
    expect(panel.getByText("Required document missing: income-certificate.")).toBeInTheDocument();
    expect(panel.getByText(/Provide the income-certificate document and re-run/)).toBeInTheDocument();
  });

  it("shows pipeline stages with counts from the real run", async () => {
    const s = await runCase("CASE-001-clean");
    const panel = await s.findByLabelText("Verification pipeline");
    const scope = within(panel);
    expect(scope.getByText("Documents")).toBeInTheDocument();
    expect(scope.getByText("Extraction")).toBeInTheDocument();
    expect(scope.getByText("Validation")).toBeInTheDocument();
    expect(scope.getByText("5 / 5 present")).toBeInTheDocument();
    expect(scope.getByText("5 succeeded")).toBeInTheDocument();
    expect(scope.getByText("Document coverage")).toBeInTheDocument();
    expect(scope.getByText("5 / 5 documents present")).toBeInTheDocument();
    expect(scope.getByRole("progressbar", { name: "Document coverage" })).toHaveAttribute("aria-valuenow", "5");
  });

  it("shows blocked pipeline stages for CASE-002", async () => {
    const s = await runCase("CASE-002-name-mismatch");
    const panel = await s.findByLabelText("Verification pipeline");
    const scope = within(panel);
    expect(scope.getByText("This application cannot proceed until 1 issue is resolved.")).toBeInTheDocument();
    expect(scope.getByRole("link", { name: "Review findings" })).toBeInTheDocument();
  });

  it("clears stale results when switching cases", async () => {
    const s = await runCase("CASE-002-name-mismatch");
    expect((await findingsSection(s)).getByText("NAME_MISMATCH")).toBeInTheDocument();
    fireEvent.change(s.getByLabelText(/synthetic case/i), { target: { value: "CASE-001-clean" } });
    expect(s.queryByText("NAME_MISMATCH")).not.toBeInTheDocument();
    expect(s.queryByRole("article")).not.toBeInTheDocument();
    expect(s.getByText("Nothing validated yet")).toBeInTheDocument();
  });

  it("invents no findings beyond the domain engine output", async () => {
    const s = await runCase("CASE-008-combined-failures");
    await findingsSection(s);
    const input = CASES.find((c) => c.id === "CASE-008-combined-failures");
    if (!input) throw new Error("fixture missing");
    const run = await runPreflightCase(input);
    const engineIds = run.decision.issues.map((issue) => issue.ruleId).sort();
    const renderedIds = within(s.getByLabelText("Validation findings"))
      .getAllByText(/^[A-Z_]+$/, { selector: ".pf-rule" })
      .map((el) => el.textContent)
      .sort();
    expect(renderedIds).toEqual(engineIds);
    // Cross-check the UI pipeline against the direct engine call.
    const direct = validateProfile(run.profile, run.evidence, { referenceDate: "2026-09-30" });
    expect(direct.issues.map((i) => i.ruleId)).toEqual(run.decision.issues.map((i) => i.ruleId));
  });

  it("approves the exact reviewed state without any submit control", async () => {
    const s = await runCase("CASE-001-clean");
    const panel = await s.findByLabelText("Final review and approval");
    const scope = within(panel);
    expect(scope.getByText("Review the verified application state before approving submission.")).toBeInTheDocument();
    fireEvent.click(scope.getByRole("button", { name: /review verified application/i }));
    const dialog = within(await s.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Approve submission" }));
    expect(await scope.findByText("APPROVED")).toBeInTheDocument();
    expect(scope.getByText("Submission: not authorized —")).toBeInTheDocument();
    expect(scope.getByText(/Approval covers this reviewed state/)).toBeInTheDocument();
    // The console authorizes nothing and submits nothing.
    expect(s.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  });
});
