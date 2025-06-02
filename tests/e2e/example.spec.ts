import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test("basic traces", async ({ page }) => {
  const chart = page.locator("#chartSparkLines");
  expect(chart.all()).toBeNull();
});

