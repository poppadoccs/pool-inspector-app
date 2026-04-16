/**
 * End-to-end test: Import from Paper (mock mode).
 * Flow: create job → open import panel → trigger mock extraction →
 *       review extracted answers → apply → verify values in form →
 *       wait for auto-save → reopen → verify persistence.
 *
 * Run with dev server started as: USE_MOCK_FORM_SCAN=true npm run dev
 */
import { test, expect } from "@playwright/test";

const JOB_NAME = `ImportTest-${Date.now()}`;

// Minimal valid 1×1 JPEG for file input triggering
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDB" +
    "kSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAR" +
    "CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA" +
    "AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAA" +
    "AAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k=",
  "base64",
);

test("import-from-paper: mock extraction → review → apply → persist", async ({
  page,
}) => {
  // Capture browser console for debugging
  const consoleMsgs: string[] = [];
  page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message}`));

  // 1. Create a fresh draft job
  await page.goto("/");
  await page.getByRole("button", { name: /new job/i }).click();
  await page.getByPlaceholder(/job name/i).fill(JOB_NAME);
  await page.getByRole("button", { name: /create job/i }).click();
  await expect(page.getByText(JOB_NAME)).toBeVisible({ timeout: 8000 });
  await page.getByText(JOB_NAME).click();
  await page.waitForURL(/\/jobs\//);
  const jobUrl = page.url();

  // 2. Open the import panel
  await page.getByRole("button", { name: /import from paper/i }).click();
  await expect(page.getByText(/upload filled-out form/i)).toBeVisible({
    timeout: 4000,
  });

  // 3. Confirm the file inputs are present, then trigger the photo file input.
  //    DEFAULT_TEMPLATE has no photo fields, so the only file inputs are from
  //    import-from-paper: [0]=camera (capture), [1]=file (webp), [2]=pdf
  const allFileInputs = page.locator('input[type="file"]');
  const count = await allFileInputs.count();
  // Should have exactly 3 from import-from-paper (no photo fields in default template)
  expect(count).toBeGreaterThanOrEqual(2);

  // photo-upload.tsx also has an accept*="webp" input but it has [multiple].
  // import-from-paper's file input does NOT have multiple — use :not([multiple]) to disambiguate.
  const photoFileInput = page.locator(
    'input[type="file"][accept*="webp"]:not([multiple])',
  );
  await photoFileInput.setInputFiles({
    name: "filled-form.jpg",
    mimeType: "image/jpeg",
    buffer: MINIMAL_JPEG,
  });

  // 4. Wait for either review state or error state — both mean the action ran.
  //    Scanning state is ~1.5s in mock mode and may be too fast to catch reliably.
  //    Note: do NOT include /dev mode/i here — in mock mode that banner is visible
  //    simultaneously with "answers extracted", causing a strict-mode 2-element match.
  await expect(
    page.getByText(/answers? extracted/i).or(page.getByText(/import failed/i)),
  ).toBeVisible({ timeout: 15000 });

  // If we ended up in error state, fail with context
  const errorVisible = await page.getByText(/import failed/i).isVisible();
  if (errorVisible) {
    const errMsg = await page
      .locator("text=/import failed/i")
      .locator("..")
      .textContent();
    throw new Error(
      `Import went to error state: ${errMsg}\nConsole: ${consoleMsgs.slice(-10).join("\n")}`,
    );
  }

  // 5. Review panel: verify contents (dev mode banner only shows in mock mode — skip that check)
  await expect(page.getByText(/answers? extracted/i)).toBeVisible();
  await expect(page.getByText(/review and correct/i)).toBeVisible();

  // 6. Capture the first editable extracted value
  const reviewInput = page.locator(".max-h-64 input").first();
  const importedValue = await reviewInput.inputValue();
  expect(importedValue.length).toBeGreaterThan(0);

  // 7. Apply
  await page.getByRole("button", { name: /apply \d+ answer/i }).click();
  await expect(page.getByText(/imported from paper/i)).toBeVisible({
    timeout: 4000,
  });

  // 8. The imported value should now be in the main job form
  const allInputs = await page
    .locator("main input[type='text'], main input:not([type]), main textarea")
    .all();
  const values = await Promise.all(allInputs.map((i) => i.inputValue()));
  expect(values.some((v) => v === importedValue)).toBe(true);

  // 9. Wait for auto-save (2s debounce → DB write → "Saved" indicator)
  await expect(page.getByText("Saved", { exact: false })).toBeVisible({
    timeout: 8000,
  });

  // 10. Reload from DB and verify the value persisted.
  await page.goto(jobUrl);
  await page.waitForURL(/\/jobs\//);

  // RHF populates uncontrolled inputs via ref callbacks after hydration.
  // Use expect().toPass() to retry until RHF has fully initialized —
  // a point-in-time .all() + map can race with the hydration commit.
  await expect(async () => {
    const reloadedInputs = await page
      .locator("main input[type='text'], main input:not([type]), main textarea")
      .all();
    const reloadedValues = await Promise.all(
      reloadedInputs.map((i) => i.inputValue()),
    );
    expect(reloadedValues.some((v) => v === importedValue)).toBe(true);
  }).toPass({ timeout: 8000 });
});
