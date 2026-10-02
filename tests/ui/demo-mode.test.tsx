// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { App } from "../../src/ui/App.js";
import { CASES, DEMO_CASE_IDS, demoDisplayName } from "../../src/ui/cases.js";
import { runPreflightCase } from "../../src/ui/pipeline.js";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import manifest from "../../fixtures/manifest.json" with { type: "json" };

const manifestIds = (manifest as { cases: { id: string }[] }).cases.map((c) => c.id);

describe("demo mode", () => {
  it("A. maps every exposed demo case to an existing fixture", () => {
    expect(DEMO_CASE_IDS.length).toBe(6);
    for (const id of DEMO_CASE_IDS) {
      expect(manifestIds).toContain(id);
      expect(CASES.some((c) => c.id === id)).toBe(true);
    }
    expect(demoDisplayName("CASE-001-clean")).toBe("Clean application");
    expect(demoDisplayName("CASE-002-name-mismatch")).toBe("Name mismatch");
  });

  it("B. produces READY for CASE-001 through the real pipeline", async () => {
    const input = CASES.find((c) => c.id === "CASE-001-clean");
    if (!input) throw new Error("fixture missing");
    const run = await runPreflightCase(input);
    expect(run.decision.status).toBe("READY");
  });

  it("C. produces BLOCKED + NAME_MISMATCH for CASE-002 through the real pipeline", async () => {
    const input = CASES.find((c) => c.id === "CASE-002-name-mismatch");
    if (!input) throw new Error("fixture missing");
    const run = await runPreflightCase(input);
    expect(run.decision.status).toBe("BLOCKED");
    expect(run.decision.issues.map((i) => i.ruleId)).toContain("NAME_MISMATCH");
  });

  it("D. renders only engine-produced findings", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/active application/i), { target: { value: "CASE-002-name-mismatch" } });
    fireEvent.click(screen.getByRole("button", { name: /run preflight/i }));
    const section = within(await screen.findByLabelText("Validation findings"));
    const input = CASES.find((c) => c.id === "CASE-002-name-mismatch");
    if (!input) throw new Error("fixture missing");
    const run = await runPreflightCase(input);
    const direct = validateProfile(run.profile, run.evidence, { referenceDate: "2026-09-30" });
    const rendered = section
      .getAllByText(/^[A-Z_]+$/, { selector: ".pf-rule" })
      .map((el) => el.textContent)
      .sort();
    expect(rendered).toEqual(direct.issues.map((i) => i.ruleId).sort());
  });

  it("E. selecting and running a case never mutates the fixture", async () => {
    const before = readFileSync("fixtures/cases/CASE-002-name-mismatch/case.json", "utf8");
    const input = CASES.find((c) => c.id === "CASE-002-name-mismatch");
    if (!input) throw new Error("fixture missing");
    const snapshot = JSON.stringify(input);
    await runPreflightCase(input);
    render(<App />);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(readFileSync("fixtures/cases/CASE-002-name-mismatch/case.json", "utf8")).toBe(before);
  });

  it("F. demo runs with no API keys present", async () => {
    for (const key of ["OPENROUTER_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"]) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    const input = CASES.find((c) => c.id === "CASE-001-clean");
    if (!input) throw new Error("fixture missing");
    const run = await runPreflightCase(input);
    expect(run.decision.status).toBe("READY");
  });

  it("H. hides CASE-011 from the normal demo picker", () => {
    render(<App />);
    const select = screen.getByLabelText(/active application/i) as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).not.toContain("CASE-011-consistent-false-evidence");
    for (const id of DEMO_CASE_IDS) expect(values).toContain(id);
    expect(screen.queryByText("ADVERSARIAL")).not.toBeInTheDocument();
  });
});
