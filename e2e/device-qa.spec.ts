import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14 Pro", width: 393, height: 852 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "iPad Mini", width: 768, height: 1024 },
] as const;

const ROUTES = [
  "/",
  "/auth/signin",
  "/browse",
  "/creator/projects",
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`device QA — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route} has no horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      });
    }

    test("touch targets on sign-in are at least 40px tall", async ({ page }) => {
      await page.goto("/auth/signin");
      const button = page.getByRole("button", { name: /sign in/i });
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    });
  });
}
