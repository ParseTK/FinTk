import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const AXE = readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

/** What a finished Google or GitHub sign-in leaves behind, without the provider (dev only). */
function mintSession(email: string): string {
  return execFileSync("uv", ["run", "python", "-m", "scripts.make_session", email], {
    cwd: path.join(process.cwd(), "..", "backend"),
    encoding: "utf8",
  }).trim();
}

async function violations(page: Page): Promise<string[]> {
  await page.evaluate(AXE);
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected into the page by the line above
    const result = await axe.run(document, { rules: { "color-contrast": { enabled: true } } });
    return result.violations.map(
      (v: { id: string; nodes: unknown[] }) => `${v.id} (${v.nodes.length})`,
    );
  });
}

test.describe("the public site", () => {
  test("shows market data from the vendor stand-in, with the required credit", async ({ page }) => {
    await page.goto("/crypto/markets");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /CoinMarketCap\.com/ }).first()).toBeVisible();
    await expect(page.getByText("Example Gold").first()).toBeVisible();
  });

  test("a coin page opens for a covered coin and is a real 404 for an unknown one", async ({
    page,
  }) => {
    const known = await page.goto("/crypto/coins/example-gold");
    expect(known?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Example Gold");
    const unknown = await page.goto("/crypto/coins/no-such-coin");
    expect(unknown?.status()).toBe(404);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`key pages have no accessibility violations (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      for (const route of [
        "/",
        "/crypto",
        "/crypto/markets",
        "/crypto/coins/example-gold",
        "/resources",
        "/resources/tools",
        "/sign-in",
      ]) {
        await page.goto(route);
        await page.waitForTimeout(1000); // entrance animations settle, so contrast is measured at rest
        expect(await violations(page), route).toEqual([]);
      }
    });
  }
});

test.describe("sign-in is required for personal pages", () => {
  test("a visitor with no session is sent to sign in, and comes back to the page", async ({
    page,
  }) => {
    await page.goto("/holdings");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fholdings$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Continue with/ }).first()).toBeVisible();
  });

  test("the API is not reachable through the website for priced data", async ({ request }) => {
    // Priced vendor data may only be shown inside our own pages: the proxy must not forward it.
    const response = await request.get("/api/v1/portfolio");
    expect(response.status()).toBe(404);
  });
});

test.describe("a signed-in person", () => {
  test("watches a coin, records a holding, removes both, then deletes the account", async ({
    page,
    context,
  }) => {
    const email = `e2e-${Date.now()}@example.test`;
    await context.addCookies([
      { name: "virello_session", value: mintSession(email), url: "http://localhost" },
    ]);

    // Watch.
    await page.goto("/crypto/coins/example-gold");
    const watch = page.getByRole("button", { name: "Watch Example Gold" });
    await expect(watch).toHaveAttribute("aria-pressed", "false");
    await watch.click();
    await expect(watch).toHaveAttribute("aria-pressed", "true");

    // It is on the watchlist page.
    await page.goto("/holdings/watchlist");
    await expect(page.getByText("Example Gold").first()).toBeVisible();

    // Record a holding.
    await page.goto("/crypto/coins/example-gold");
    await page.getByLabel("Amount of EXG").fill("2.5");
    await page.getByLabel("Total paid in US dollars (optional)").fill("100");
    await page.getByRole("button", { name: "Save holding" }).click();
    await expect(page.getByText("Saved 2.5 EXG.")).toBeVisible();

    // It is on the portfolio page, valued at the stand-in's price.
    await page.goto("/holdings");
    await expect(page.getByText("Example Gold").first()).toBeVisible();
    await expect(page.getByText(/\$/).first()).toBeVisible();

    // Remove the holding (two presses: the second confirms).
    await page.getByRole("button", { name: /^Remove\s+Example Gold/ }).click();
    await page.getByRole("button", { name: /^Confirm remove\s+Example Gold/ }).click();
    await expect(page.getByText("Example Gold")).toHaveCount(0);

    // Remove from the watchlist.
    await page.goto("/holdings/watchlist");
    await page.getByRole("button", { name: /^Remove\s+Example Gold/ }).click();
    await page.getByRole("button", { name: /^Confirm remove\s+Example Gold/ }).click();
    await expect(page.getByText("Example Gold")).toHaveCount(0);

    // Delete the account (also cleans up after this test).
    await page.goto("/account");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Yes, delete my account" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/holdings");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
