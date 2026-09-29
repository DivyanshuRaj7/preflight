// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../../src/ui/App.js";

describe("theme behavior", () => {
  it("defaults to light on fresh load", () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles manually between light and dark", () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
