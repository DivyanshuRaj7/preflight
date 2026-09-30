import { expect, test } from "@playwright/test";

// TASK-005B browser smoke test — NOT an agent test. It proves a real
// Chromium can reach the synthetic portal, read it through accessible
// semantics, interact with one safe field, and observe the state change.
// No filling automation, no mapping, no submission.
test("portal smoke: read, edit Full Name, save draft", async ({ page }) => {
  // 2. Open the real rendered portal (webServer starts Vite automatically).
  await page.goto("/portal/scholarship-renewal");

  // 3-4. Portal identity.
  await expect(page.getByRole("heading", { name: "Scholarship Renewal Portal" })).toBeVisible();
  await expect(page.getByText("SYNTHETIC PORTAL", { exact: true })).toBeVisible();

  // 5. Initial state.
  await expect(page.getByTestId("application-status")).toHaveText("DRAFT");

  // 6-7. Semantic locator; deterministic synthetic initial value.
  const fullName = page.getByLabel("Full Name");
  await expect(fullName).toHaveValue("Rina Das");

  // 8-9. One safe deterministic edit, verified in the DOM.
  await fullName.fill("Rina Das Test");
  await expect(fullName).toHaveValue("Rina Das Test");

  // 10-12. Save and observe.
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByTestId("application-status")).toHaveText("SAVED");
  await expect(page.getByText("Draft saved")).toBeVisible();
});
