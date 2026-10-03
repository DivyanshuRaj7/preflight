import { expect, test } from "@playwright/test";
import { loadEvaluationSummary } from "../../src/server/evaluation-service.js";

// Read-only endpoint proof: the served payload must equal the artifact-derived
// summary, so the console can never show numbers the harness did not produce.
test("evaluation API serves artifact-derived results", async ({ request }) => {
  const expected = loadEvaluationSummary();
  expect(expected).not.toBeNull();

  const res = await request.get("/api/evaluation");
  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.standard).toEqual(expected!.standard);
  expect(body.safety).toEqual(expected!.safety);
  expect(body.full).toEqual(expected!.full);
  expect(body.ocr).toEqual(expected!.ocr);
  expect(body.cases).toHaveLength(expected!.cases.length);
  expect(body.generatedBy).toBe(expected!.generatedBy);
});

test("evaluation console is reachable and shows headline metrics", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Evaluation" }).click();
  await expect(page.getByText("Measured, not claimed.")).toBeVisible();
  await expect(page.getByText("Standard cases correct")).toBeVisible();
  await expect(page.getByText("Unauthorized submissions")).toBeVisible();
  // Normal workflow stays reachable behind the same control.
  await page.getByRole("button", { name: "Evaluation" }).click();
  await expect(page.getByRole("button", { name: /run preflight/i })).toBeVisible();
});