// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScholarshipPortal } from "../../src/portal/scholarship/ScholarshipPortal.js";
import { initialPortalState, saveDraft } from "../../src/portal/scholarship/portal-state.js";

describe("synthetic scholarship portal", () => {
  it("renders the portal page with heading and synthetic indicator", () => {
    render(<ScholarshipPortal />);
    expect(screen.getByRole("heading", { name: "Scholarship Renewal Portal" })).toBeInTheDocument();
    expect(screen.getByText("SYNTHETIC PORTAL")).toBeInTheDocument();
    expect(screen.getByTestId("scholarship-portal")).toBeInTheDocument();
  });

  it("exposes all required fields with accessible labels", () => {
    render(<ScholarshipPortal />);
    expect(screen.getByLabelText("Full Name")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Date of Birth")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Annual Family Income")).toBeInTheDocument();
    expect(screen.getByLabelText("Bank Account Number")).toBeInTheDocument();
    expect(screen.getByLabelText("Scholarship Application Reference")).toBeInTheDocument();
  });

  it("prefills deterministic synthetic demo data", () => {
    render(<ScholarshipPortal />);
    expect(screen.getByLabelText("Full Name")).toHaveValue("Rina Das");
    expect(screen.getByTestId("application-reference")).toHaveValue("SCH-2026-001");
  });

  it("starts in DRAFT and moves to SAVED on Save Draft", () => {
    render(<ScholarshipPortal />);
    expect(screen.getByTestId("application-status")).toHaveTextContent("DRAFT");
    fireEvent.click(screen.getByTestId("save-draft"));
    expect(screen.getByTestId("application-status")).toHaveTextContent("SAVED");
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("keeps portal state transitions pure and deterministic", () => {
    expect(initialPortalState()).toBe("DRAFT");
    expect(saveDraft()).toBe("SAVED");
    expect(saveDraft()).toBe(saveDraft());
  });

  it("requires no external network", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    // @ts-expect-error spy without a mocking library
    globalThis.fetch = (url: string) => {
      calls.push(String(url));
      throw new Error("network disabled in test");
    };
    try {
      render(<ScholarshipPortal />);
      fireEvent.click(screen.getByTestId("save-draft"));
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
