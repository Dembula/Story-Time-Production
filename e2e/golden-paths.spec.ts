import { test, expect } from "@playwright/test";

test.describe("public golden paths", () => {
  test("home page loads", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveTitle(/Story Time/i);
  });

  test("sign-in page renders", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("wallet redirects unauthenticated users", async ({ page }) => {
    await page.goto("/creator/wallet");
    await expect(page).toHaveURL(/signin|login|auth/i);
  });
});

test.describe("authenticated golden paths", () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for auth flows");

    await page.goto("/auth/signin");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/creator|dashboard|wallet/i, { timeout: 30_000 });
  });

  test("creator wallet page loads", async ({ page }) => {
    await page.goto("/creator/wallet");
    await expect(page.getByRole("heading", { name: /wallet/i })).toBeVisible({ timeout: 20_000 });
  });

  test("music creator scoring hub loads", async ({ page }) => {
    test.skip(process.env.E2E_TEST_ROLE !== "music-creator", "Requires music-creator test account");
    await page.goto("/music-creator/scoring");
    await expect(page.getByText(/scoring|sync/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
