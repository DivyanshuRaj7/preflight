// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../../src/ui/App.js";

async function runCase(caseId: string) {
  render(<App />);
  fireEvent.change(screen.getByLabelText(/synthetic case/i), { target: { value: caseId } });
  fireEvent.click(screen.getByRole("button", { name: /run preflight/i }));
  return screen;
}

async function openReview(s: typeof screen) {
  fireEvent.click(await s.findByRole("button", { name: /review verified application/i }));
  return within(await s.findByRole("dialog"));
}

describe("review modal", () => {
  it("A+B. shows a compact trigger with state metadata for READY", async () => {
    const s = await runCase("CASE-001-clean");
    const trigger = await s.findByRole("button", { name: /review verified application/i });
    expect(trigger).toHaveTextContent("Review verified application");
    expect(trigger).toHaveTextContent(/READY · SAVED · \d+ fields/);
    // The full applicant table stays out of the main page.
    expect(s.queryByText("State fingerprint")).not.toBeInTheDocument();
  });

  it("C+D. opens a dialog with the exact verified state", async () => {
    const s = await runCase("CASE-001-clean");
    const dialog = await openReview(s);
    expect(dialog.getByText("CASE-001-clean")).toBeInTheDocument();
    expect(dialog.getByText("Validation")).toBeInTheDocument();
    expect(dialog.getByText("Portal state")).toBeInTheDocument();
    expect(dialog.getByText("Full name")).toBeInTheDocument();
    expect(dialog.getByText("Rina Das")).toBeInTheDocument();
    expect(dialog.getByText("State fingerprint")).toBeInTheDocument();
    expect(dialog.getByText(/applies only to this exact verified state/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Approve submission" })).toBeInTheDocument();
  });

  it("E. Escape closes the dialog", async () => {
    const s = await runCase("CASE-001-clean");
    await openReview(s);
    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    expect(s.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("F. X closes the dialog", async () => {
    const s = await runCase("CASE-001-clean");
    const dialog = await openReview(s);
    fireEvent.click(dialog.getByRole("button", { name: "Close review dialog" }));
    expect(s.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("G+H. Cancel closes and focus returns to the trigger", async () => {
    const s = await runCase("CASE-001-clean");
    const dialog = await openReview(s);
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(s.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(s.getByRole("button", { name: /review verified application/i }));
  });

  it("I+J. approval uses the existing logic with unchanged fingerprint binding", async () => {
    const s = await runCase("CASE-001-clean");
    const dialog = await openReview(s);
    const fingerprintHeading = await dialog.findByText("State fingerprint");
    const hash = fingerprintHeading.nextElementSibling?.textContent?.match(/[0-9a-f]{8,}/)?.[0];
    expect(hash).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Approve submission" }));
    expect(s.queryByRole("dialog")).not.toBeInTheDocument();
    const panel = within(await s.findByLabelText("Final review and approval"));
    expect(await panel.findByText("APPROVED")).toBeInTheDocument();
    // The inline approval record carries the exact reviewed fingerprint.
    expect(panel.getByText(hash as string)).toBeInTheDocument();
  });

  it("K. BLOCKED applications get no review trigger or dialog", async () => {
    const s = await runCase("CASE-002-name-mismatch");
    await s.findByText("This application cannot proceed until 1 issue is resolved.");
    expect(s.queryByRole("button", { name: /review verified application/i })).not.toBeInTheDocument();
    expect(s.queryByRole("dialog")).not.toBeInTheDocument();
    expect(s.queryByRole("button", { name: "Approve submission" })).not.toBeInTheDocument();
  });
});
