import { afterEach, describe, expect, it } from "vitest";
import { isHeadlessEnforced, resolveHeadless } from "../../src/server/execute-service.js";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("resolveHeadless", () => {
  it("respects a headed request in local development", () => {
    delete process.env.PREFLIGHT_FORCE_HEADLESS;
    delete process.env.NODE_ENV;
    expect(resolveHeadless(true)).toBe(false);
    expect(resolveHeadless(false)).toBe(true);
    expect(isHeadlessEnforced()).toBe(false);
  });

  it("forces headless when the deployment declares it, even if headed was requested", () => {
    process.env.PREFLIGHT_FORCE_HEADLESS = "true";
    delete process.env.NODE_ENV;
    expect(resolveHeadless(true)).toBe(true);
    expect(isHeadlessEnforced()).toBe(true);
  });

  it("forces headless under NODE_ENV=production as a backstop", () => {
    delete process.env.PREFLIGHT_FORCE_HEADLESS;
    process.env.NODE_ENV = "production";
    expect(resolveHeadless(true)).toBe(true);
    expect(isHeadlessEnforced()).toBe(true);
  });
});
