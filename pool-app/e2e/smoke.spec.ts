/**
 * Baseline smoke test: create job → fill form → save → reopen → verify persistence.
 * Requires the dev server to be running on localhost:3000.
 */
import { test, expect } from "@playwright/test";

const JOB_NAME = `SmokeTest-${Date.now()}`;
const FIELD_VALUE = "Playwright baseline value";

test("create job, fill form, save, reopen, verify persisted data", async ({
  page,
}) => {
  // 1. Load home page
  await page.goto("/");
  await expect(page.getByText("Pool Field Forms")).toBeVisible();

  // 2. Open the create-job form
  await page.getByRole("button", { name: /new job/i }).click();
  await expect(page.getByPlaceholder(/job name/i)).toBeVisible();

  // 3. Fill job name and submit
  await page.getByPlaceholder(/job name/i).fill(JOB_NAME);
  await page.getByRole("button", { name: /create job/i }).click();

  // 4. Wait for form to close (toast appears briefly; job card appears)
  await expect(page.getByText(JOB_NAME)).toBeVisible({ timeout: 8000 });

  // 5. Click the job card to open the detail page
  await page.getByText(JOB_NAME).click();
  await page.waitForURL(/\/jobs\//);

  // 6. Find the first visible text input inside the form card and fill it
  const formCard = page.locator("main").getByText("Form").locator("..");
  const firstInput = formCard
    .locator('input[type="text"], input:not([type]), textarea')
    .first();
  await expect(firstInput).toBeVisible({ timeout: 5000 });
  await firstInput.fill(FIELD_VALUE);

  // 7. Wait for auto-save to complete (2s debounce + DB write → "Saved" indicator)
  await expect(page.getByText("Saved", { exact: false })).toBeVisible({
    timeout: 8000,
  });

  // Capture the job URL so we can return to it
  const jobUrl = page.url();

  // 8. Navigate back to home
  await page.getByRole("button", { name: /back to jobs/i }).click();
  await page.waitForURL("/");

  // 9. Re-open the same job
  await page.goto(jobUrl);
  await page.waitForURL(/\/jobs\//);

  // 10. Verify the value persisted (from DB, not localStorage)
  const reloadedInput = page
    .locator('input[type="text"], input:not([type]), textarea')
    .first();
  await expect(reloadedInput).toHaveValue(FIELD_VALUE, { timeout: 5000 });
});
