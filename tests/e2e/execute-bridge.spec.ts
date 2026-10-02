import { expect, test } from "@playwright/test";

// Runtime bridge proof: the dev server endpoint genuinely executes the
// existing stack in a real Chromium against the real portal — VERIFIED with
// 6/6 read-back for CASE-001, honest refusal without any browser
// interaction for a BLOCKED case.
test("execute bridge: real run for CASE-001, refusal for CASE-002", async ({ request }) => {
  const ok = await request.post("/api/execute", { data: { caseId: "CASE-001-clean" } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.ok).toBe(true);
  expect(body.inspected).toBe(6);
  expect(body.mapped).toBe(6);
  expect(body.result.status).toBe("VERIFIED");
  expect(body.result.verified.filter((v: { verified: boolean }) => v.verified)).toHaveLength(6);
  expect(body.result.saveDraftSucceeded).toBe(true);
  expect(body.result.portalState).toBe("SAVED");

  const refused = await request.post("/api/execute", { data: { caseId: "CASE-002-name-mismatch" } });
  expect(refused.status()).toBe(422);
  const denial = await refused.json();
  expect(denial.ok).toBe(false);
  expect(denial.error).toContain("No browser interaction occurred");
});
