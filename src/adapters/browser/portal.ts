import type { Page } from "@playwright/test";
import type { PortalField } from "../../domain/mapping/contracts.js";

// Playwright portal adapter (TASK-005D). Browser-specific and DOM-aware, but
// semantically blind: it enumerates controls and reports their metadata, and
// it fills/reads controls by stable id. Meaning ALWAYS comes from the
// semantic mapper; this adapter never decides what a label means, never
// matches labels to canonical fields, and never validates.

export async function inspectPortalFields(page: Page): Promise<PortalField[]> {
  return page.locator("#sp-form").evaluate((root) => {
    const controls = [...root.querySelectorAll("input, textarea, select")];
    return controls.map((el) => {
      const input = el as HTMLInputElement;
      const labels = [...(input.labels ?? [])].map((l) => (l.textContent ?? "").trim()).filter((t) => t !== "");
      return {
        id: input.id,
        label: labels.join(" ").trim(),
        inputType: (input.getAttribute("type") ?? input.tagName.toLowerCase()).toLowerCase(),
        required: input.required || input.getAttribute("aria-required") === "true",
      };
    });
  });
}

function escapeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

export async function fillPortalField(page: Page, portalFieldId: string, value: string): Promise<void> {
  const target = page.locator(`#${escapeId(portalFieldId)}`);
  const tag = await target.evaluate((el) => el.tagName.toLowerCase());
  if (tag !== "input" && tag !== "textarea") {
    throw new Error(`Unsupported portal control <${tag}> for field ${portalFieldId}.`);
  }
  await target.fill(value);
}

export async function readPortalField(page: Page, portalFieldId: string): Promise<string> {
  return page.locator(`#${escapeId(portalFieldId)}`).inputValue();
}

export async function clickSaveDraft(page: Page): Promise<void> {
  await page.getByTestId("save-draft").click();
}

export async function readPortalState(page: Page): Promise<string> {
  return (await page.getByTestId("application-status").textContent())?.trim() ?? "";
}
