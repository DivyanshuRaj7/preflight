import { expect, test } from "@playwright/test";

// Full UI proof: READY console → Run browser agent → real trace rendered
// from the live run (entered + independently verified + SAVED).
test("browser agent UI: trace renders from a genuine run", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByLabel(/synthetic case/i).selectOption("CASE-001-clean");
  await page.getByRole("button", { name: /run preflight/i }).click();
  await expect(page.getByText("READY").first()).toBeVisible();
  await page.getByRole("button", { name: /run browser agent/i }).click();
  await expect(page.getByText("6 values independently verified")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Portal state verified: SAVED")).toBeVisible();
  await expect(page.getByText("Browser agent completed successfully.")).toBeVisible();
  const agent = page.locator('section[aria-label="Browser agent execution"]');
  await expect(agent.getByText("Rina Das").first()).toBeVisible();
});
