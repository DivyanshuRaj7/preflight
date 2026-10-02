// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../../src/ui/App.js";

const STORAGE_KEY = "preflight-theme";

describe("theme behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("defaults to dark on first load when no preference exists", () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("restores a stored light preference across reloads", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");

    document.documentElement.removeAttribute("data-theme");
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("restores a stored dark preference across reloads", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");

    document.documentElement.removeAttribute("data-theme");
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles manually between light and dark", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});