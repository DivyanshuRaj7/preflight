import { afterEach, describe, expect, it } from "vitest";
import { isHeadlessEnforced, resolveHeadless } from "../../src/server/execute-service.js";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("resolveHeadless", () => {
  it("forces headless in production-style hosts even when headed was requested", () => {
    delete process.env.PREFLIGHT_FORCE_HEADLESS;
    delete process.env.NODE_ENV;
    // No opt-in from the host: safe default, which is what the production
    // server passes. This is the regression guard for the XServer failure.
    expect(resolveHeadless(true, { allowHeaded: false })).toBe(true);
    expect(resolveHeadless(true)).toBe(true);
    expect(isHeadlessEnforced({ allowHeaded: false })).toBe(true);
  });

  it("forces headless when the deployment declares it, even if headed was requested", () => {
    process.env.PREFLIGHT_FORCE_HEADLESS = "true";
    delete process.env.NODE_ENV;
    expect(resolveHeadless(true, { allowHeaded: true })).toBe(true);
    expect(isHeadlessEnforced({ allowHeaded: true })).toBe(true);
  });

  it("forces headless under NODE_ENV=production as a backstop", () => {
    delete process.env.PREFLIGHT_FORCE_HEADLESS;
    process.env.NODE_ENV = "production";
    expect(resolveHeadless(true, { allowHeaded: true })).toBe(true);
    expect(isHeadlessEnforced({ allowHeaded: true })).toBe(true);
  });

  it("respects a headed request only on a development host that opted in", () => {
    delete process.env.PREFLIGHT_FORCE_HEADLESS;
    delete process.env.NODE_ENV;
    expect(resolveHeadless(true, { allowHeaded: true })).toBe(false);
    expect(resolveHeadless(false, { allowHeaded: true })).toBe(true);
    expect(isHeadlessEnforced({ allowHeaded: true })).toBe(false);
  });
});