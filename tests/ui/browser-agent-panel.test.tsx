// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserAgentPanel } from "../../src/ui/BrowserAgentPanel.js";
import type { ExecutionResult } from "../../src/domain/execution/contracts.js";

const result: ExecutionResult = {
  status: "VERIFIED",
  plan: null,
  verified: [
    { canonicalField: "fullName", portalFieldId: "full-name", expected: "Rina Das", observed: "Rina Das", verified: true },
  ],
  saveDraftSucceeded: true,
  portalState: "SAVED",
  failure: null,
  recoveryAttempts: 0,
  trace: [],
};

function stubFetch(ok: boolean) {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({
      ok: true,
      caseId: "CASE-001-clean",
      inspected: 6,
      mapped: 6,
      headlessEnforced: true,
      ...(ok ? { portalScreenshot: "data:image/png;base64,AAAA" } : {}),
      result,
    }),
  });
}

describe("browser agent panel evidence", () => {
  it("shows the portal capture the agent's browser left behind", async () => {
    vi.stubGlobal("fetch", stubFetch(true));
    render(<BrowserAgentPanel caseId="CASE-001-clean" />);
    screen.getByRole("button", { name: /run browser agent/i }).click();
    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(img.getAttribute("alt")).toContain("portal state verified as SAVED");
    expect(screen.getByText(/captured by the agent/i)).toBeInTheDocument();
    // The request must not ask for a visible browser window.
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({ caseId: "CASE-001-clean" });
  });

  it("still renders the trace when no capture is available", async () => {
    vi.stubGlobal("fetch", stubFetch(false));
    render(<BrowserAgentPanel caseId="CASE-001-clean" />);
    screen.getByRole("button", { name: /run browser agent/i }).click();
    await waitFor(() => expect(screen.getByText("Browser agent completed successfully.")).toBeInTheDocument());
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});