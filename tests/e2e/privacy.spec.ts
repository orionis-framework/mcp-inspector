import { expect, test } from "@playwright/test";

test("shared MCP endpoint remains private before connect and across language changes", async ({ page }) => {
  const external: string[] = [];
  await page.route("https://**/*", (route) => {
    external.push(route.request().url());
    return route.abort();
  });
  const endpoint = "https://private.example:8443/mcp?token=private-value&scope=read";
  await page.goto("/?mcp=" + encodeURIComponent(endpoint));
  await expect(page.getByRole("textbox", { name: "MCP server endpoint" })).toHaveValue(endpoint);
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  expect(await page.evaluate(() => "dataLayer" in window)).toBe(false);
  expect(external).toEqual([]);
  expect(await page.locator("head").innerHTML()).not.toContain("private-value");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});
