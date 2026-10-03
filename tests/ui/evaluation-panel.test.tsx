// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { loadEvaluationSummary } from "../../src/server/evaluation-service.js";

// Fixtures are NOT hard-coded expectations in this file: the artifact is read
// through the same loader the API uses, and assertions compare the rendered
// UI against those derived values.
const summary = loadEvaluationSummary();

function stubFetch(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => payload }),
  );
}

async function renderPanel() {
  const { EvaluationPanel } = await import("../../src/ui/EvaluationPanel.js");
  render(<EvaluationPanel />);
  return screen.findByLabelText("Evaluation");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evaluation console", () => {
  it("1. renders the section and its framing", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(within(section).getByText("Evaluation")).toBeInTheDocument();
    expect(within(section).getByText("Measured, not claimed.")).toBeInTheDocument();
  });

  it("2. shows the standard result derived from the artifact", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(summary).not.toBeNull();
    expect(
      within(section).getByLabelText(
        `${summary!.standard.correct} of ${summary!.standard.total} standard cases correct`,
      ),
    ).toBeInTheDocument();
    expect(within(section).getByText("Standard cases correct")).toBeInTheDocument();
  });

  it("3. shows the baseline result", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(
      within(section).getByText(`${summary!.standard.baselineCorrect} / ${summary!.standard.total}`),
    ).toBeInTheDocument();
    expect(within(section).getByText("Baseline")).toBeInTheDocument();
  });

  it("4. shows safety metrics", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(
      within(section).getByText(`${summary!.standard.unsafePrevented} / ${summary!.standard.unsafeTotal}`),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(`${summary!.safety.probesDenied} / ${summary!.safety.probesTotal}`),
    ).toBeInTheDocument();
    expect(within(section).getByText("Unauthorized submissions")).toBeInTheDocument();
  });

  it("5. shows the unauthorized-submission count", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    const dd = within(section).getByText("Unauthorized submissions").nextElementSibling;
    expect(dd?.textContent).toBe(String(summary!.safety.unauthorizedSubmissions));
  });

  it("6. shows the full evaluation result", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(within(section).getByText(`${summary!.full.correct} / ${summary!.full.total}`)).toBeInTheDocument();
    expect(within(section).getByText("Full evaluation")).toBeInTheDocument();
  });

  it("7. explains the CASE-011 boundary", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(within(section).getByText(/uniformly false but internally consistent evidence/i)).toBeInTheDocument();
    expect(within(section).getByText(/human\s+review is required/i)).toBeInTheDocument();
  });

  it("8. shows the OCR result", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(within(section).getByText(`${summary!.ocr!.passed} / ${summary!.ocr!.total}`)).toBeInTheDocument();
    expect(within(section).getByText("OCR evaluation")).toBeInTheDocument();
  });

  it("9. never claims a perfect full score", async () => {
    stubFetch(summary);
    const section = await renderPanel();
    expect(within(section).queryByText(`${summary!.full.total} / ${summary!.full.total}`)).not.toBeInTheDocument();
    expect(summary!.full.correct).toBeLessThan(summary!.full.total);
  });

  it("10. shows no numbers when the artifact is unavailable", async () => {
    stubFetch({ ok: false, error: "unavailable" }, false);
    const section = await renderPanel();
    await waitFor(() =>
      expect(within(section).getByText(/unavailable in this build/i)).toBeInTheDocument(),
    );
    expect(within(section).queryByText(/Standard cases correct/)).not.toBeInTheDocument();
    expect(within(section).queryByText(/\d+\s*\/\s*\d+/)).not.toBeInTheDocument();
  });
});