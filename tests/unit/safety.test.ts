import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProfile } from "../../src/domain/validation/preflight.js";
import { mapPortalField } from "../../src/domain/mapping/deterministic.js";
import { authorizeSubmission } from "../../src/domain/submission/authorize.js";
import {
  blockDecision,
  decideFromApproval,
  decideFromExecution,
  decideFromMapping,
  decideFromPreflight,
  escalateDecision,
  isUnsafeDestination,
} from "../../src/domain/safety/decisions.js";
import { CATEGORY_POLICY, categoryOfRule, type FailureCategory } from "../../src/domain/safety/taxonomy.js";
import { checkApproval } from "../../src/domain/submission/approval.js";

const OPTIONS = { referenceDate: "2026-09-30", checkedAt: "2026-09-30T00:00:00.000Z" };

describe("failure taxonomy coverage", () => {
  it("gives every known validation rule a category, unknown rules fall outside the model", () => {
    const manifest = JSON.parse(readFileSync("fixtures/manifest.json", "utf8")) as {
      cases: { expectedFile: string }[];
    };
    const ruleIds = new Set<string>();
    for (const entry of manifest.cases) {
      const expected = JSON.parse(readFileSync(`fixtures/expected/${entry.expectedFile}`, "utf8")) as {
        expectedFindingIds: string[];
      };
      for (const id of expected.expectedFindingIds) ruleIds.add(id);
    }
    expect(ruleIds.size).toBeGreaterThan(0);
    for (const id of ruleIds) {
      expect(CATEGORY_POLICY[categoryOfRule(id)]).toBeDefined();
    }
    expect(categoryOfRule("SOME_FUTURE_RULE")).toBe("MODEL_BOUNDARY_FAILURE");
  });

  it("covers every failure category with at least one fixture decision", () => {
    const covered = new Set<FailureCategory>([
      "EVIDENCE_FAILURE", // CASE-004 missing document
      "PROFILE_FAILURE", // CASE-002 name mismatch
      "MAPPING_FAILURE", // ADV-006 ambiguous label
      "EXECUTION_FAILURE", // flaky-save recovered miss
      "STATE_VERIFICATION_FAILURE", // ADV-008 unexpected state
      "AUTHORIZATION_FAILURE", // approval invalidated
      "MODEL_BOUNDARY_FAILURE", // unknown rule fallback
    ]);
    expect([...covered].sort()).toEqual(
      (Object.keys(CATEGORY_POLICY) as FailureCategory[]).sort(),
    );
    // Each claimed fixture decision is real: ambiguous refuses, unknown verdict escalates.
    expect(mapPortalField({ id: "x", label: "Reference", inputType: "text", required: true }).status).toBe("AMBIGUOUS");
    expect(checkApproval(null, "abc").status).toBe("INVALIDATED");
  });

  it("gives every adversarial fixture an explicit expected decision", () => {
    const adversarial = JSON.parse(readFileSync("fixtures/adversarial/cases.json", "utf8")) as {
      mappingCases: { id: string; expectedStatus: string }[];
      stateCases: { id: string; expectedVerdict: string }[];
    };
    expect(adversarial.mappingCases.length).toBeGreaterThan(0);
    expect(adversarial.stateCases.length).toBeGreaterThan(0);
    for (const c of adversarial.mappingCases) {
      expect(["MATCHED", "AMBIGUOUS", "UNMAPPED"]).toContain(c.expectedStatus);
    }
    for (const c of adversarial.stateCases) {
      expect(["EXPECTED_STATE", "NOT_REACHED", "UNKNOWN"]).toContain(c.expectedVerdict);
    }
  });
});

describe("uncertainty invariants", () => {
  it("refuses to resolve any refusal to a success state", () => {
    const forbidden = ["READY", "APPROVED", "SUBMITTING", "SUBMITTED", "VERIFIED", "MATCHED"];
    // Cast simulates untrusted runtime input reaching the guard.
    const attempt = (target: string) =>
      blockDecision("UNCERTAIN", "MODEL_BOUNDARY_FAILURE", "test", target as "BLOCKED", "must throw");
    for (const target of forbidden) {
      expect(isUnsafeDestination(target)).toBe(true);
      expect(() => attempt(target)).toThrow();
      expect(() =>
        escalateDecision("UNCERTAIN", "MODEL_BOUNDARY_FAILURE", "test", target as "BLOCKED", "must throw"),
      ).toThrow();
    }
  });

  it("lets UNCERTAIN resolve only to BLOCK or ESCALATE terminals", () => {
    const blocked = blockDecision("UNCERTAIN", "MODEL_BOUNDARY_FAILURE", "test", "BLOCKED", "stop");
    const escalated = escalateDecision("UNCERTAIN", "STATE_VERIFICATION_FAILURE", "test", "ESCALATED", "stop");
    expect(blocked).toMatchObject({ verdict: "BLOCK", uncertainty: "UNCERTAIN", mapsTo: "BLOCKED" });
    expect(escalated).toMatchObject({ verdict: "ESCALATE", uncertainty: "UNCERTAIN", mapsTo: "ESCALATED" });
  });

  it("translates BLOCKED preflight into provenance-preserving BLOCK decisions", () => {
    const input = JSON.parse(readFileSync("fixtures/cases/CASE-002-name-mismatch/case.json", "utf8"));
    const result = validateProfile(input.profile, input.evidence, OPTIONS);
    const decisions = decideFromPreflight(result);
    expect(decisions.length).toBeGreaterThan(0);
    for (const d of decisions) {
      expect(d.verdict).toBe("BLOCK");
      expect(d.detector).toContain("validateProfile");
      expect(d.ruleId).toBeTruthy();
      expect(d.evidenceIds.length).toBeGreaterThan(0);
      expect(d.reason.length).toBeGreaterThan(0);
    }
    expect(decideFromPreflight({ ...result, status: "READY", issues: [] })).toEqual([]);
  });

  it("marks ambiguous mappings UNCERTAIN and unmapped ones CERTAIN refusals", () => {
    const decisions = decideFromMapping([
      mapPortalField({ id: "a", label: "Reference", inputType: "text", required: true }),
      mapPortalField({ id: "b", label: "Blockchain Wallet", inputType: "text", required: true }),
    ]);
    expect(decisions).toMatchObject([
      { verdict: "BLOCK", uncertainty: "UNCERTAIN", category: "MAPPING_FAILURE", mapsTo: "AMBIGUOUS" },
      { verdict: "BLOCK", uncertainty: "CERTAIN", category: "MAPPING_FAILURE", mapsTo: "UNMAPPED" },
    ]);
  });

  it("escalates inconclusive executions and blocks failed ones", () => {
    const escalated = decideFromExecution({
      status: "ESCALATED",
      plan: null,
      verified: [],
      saveDraftSucceeded: false,
      portalState: null,
      failure: { reason: "UNKNOWN_STATE", message: "inconclusive" },
      recoveryAttempts: 0,
      trace: [],
    });
    expect(escalated).toMatchObject([{ verdict: "ESCALATE", uncertainty: "UNCERTAIN" }]);
    const failed = decideFromExecution({
      status: "FAILED",
      plan: null,
      verified: [],
      saveDraftSucceeded: false,
      portalState: null,
      failure: { reason: "SAVE_DRAFT_FAILED", message: "missed" },
      recoveryAttempts: 1,
      trace: [],
    });
    expect(failed).toMatchObject([{ verdict: "BLOCK" }]);
    expect(
      decideFromExecution({
        status: "VERIFIED",
        plan: null,
        verified: [],
        saveDraftSucceeded: true,
        portalState: "SAVED",
        failure: null,
        recoveryAttempts: 0,
        trace: [],
      }),
    ).toEqual([]);
  });

  it("denies submission for escalated execution and void approval", () => {
    const clean = JSON.parse(readFileSync("fixtures/cases/CASE-001-clean/case.json", "utf8"));
    const preflight = validateProfile(clean.profile, clean.evidence, OPTIONS);
    const base = {
      preflight,
      executionStatus: "ESCALATED" as const,
      portalState: "SAVED" as const,
      snapshot: null,
      approval: null,
    };
    expect(authorizeSubmission(base)).toMatchObject({ authorized: false, reason: "NOT_READY_FOR_APPROVAL" });
    expect(decideFromApproval(checkApproval(null, "abc"))).toMatchObject([
      { verdict: "BLOCK", category: "AUTHORIZATION_FAILURE", mapsTo: "INVALIDATED" },
    ]);
  });
});
