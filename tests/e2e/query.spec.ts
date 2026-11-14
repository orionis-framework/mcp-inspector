import { expect, test } from "@playwright/test";
import { endpoint, mockMcp } from "./fixtures";

test("a link prefills once, connects only on demand and survives reload and language changes", async ({ page }) => {
  const requests = await mockMcp(page);
  const query = "?mcp=" + encodeURIComponent(endpoint);
  await page.goto("/" + query);
  const input = page.locator("#endpoint");
  await expect(input).toHaveValue(endpoint);
  await expect(page.locator(".statusbar").getByRole("status")).toContainText("select Connect");
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".statusbar").getByRole("status")).toContainText("Connected. Each request is independent.");
  expect(requests.filter((request) => request.method === "server/discover")).toHaveLength(1);
  const count = requests.length;
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("es");
  await expect(page).toHaveURL("http://127.0.0.1:4173/es/" + query);
  await expect(input).toHaveValue(endpoint);
  expect(requests).toHaveLength(count);
  const head = await page.locator("head").innerHTML();
  expect(head).not.toContain(endpoint);
  expect(head).not.toContain(encodeURIComponent(endpoint));
  await page.reload();
  await expect(input).toHaveValue(endpoint);
  await expect(page.locator(".statusbar").getByRole("status")).toContainText("selecciona Conectar");
  expect(requests).toHaveLength(count);
  await input.fill("https://other.example/mcp");
  await page.getByRole("combobox", { name: "Idioma", exact: true }).selectOption("en");
  await expect(input).toHaveValue("https://other.example/mcp");
  await page.reload();
  await expect(input).toHaveValue(endpoint);
  expect(requests).toHaveLength(count);
});

test("encoded paths, ports and internal query parameters reach the existing MCP transport intact", async ({ page }) => {
  const target = "https://mcp.example.test:8443/api/mcp/a%2Fb?tenant=a%2Bb&next=%2Fspace%3Fx%3D1&flag=";
  const observed: string[] = [];
  await page.route(target, async (route) => {
    observed.push(route.request().url());
    const request = route.request().postDataJSON() as { id: string; method: string };
    expect(request.method).toBe("server/discover");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { resultType: "complete", supportedVersions: ["2026-07-28"], capabilities: {} },
      }),
    });
  });
  await page.goto("/?mcp=" + encodeURIComponent(target));
  await expect(page.locator("#endpoint")).toHaveValue(target);
  expect(observed).toEqual([]);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".statusbar").getByRole("status")).toContainText("Connected.");
  expect(observed).toEqual([target]);
});

for (const [value, message] of [
  ["", "is empty"],
  ["   ", "is empty"],
  ["not a URL", "is invalid"],
  ["javascript:alert(1)", "is invalid"],
  ["https://user:password@example.com/mcp", "is invalid"],
  ["https://example.com/mcp#fragment", "is invalid"],
]) {
  test(`invalid link is recoverable without a request: ${value || "empty"}`, async ({ page }) => {
    const requests = await mockMcp(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?mcp=" + encodeURIComponent(value));
    await expect(page.locator("#endpoint")).toHaveValue("");
    await expect(page.locator(".statusbar").getByRole("status")).toContainText(message);
    await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeDisabled();
    expect(requests).toHaveLength(0);
    await page.locator("#endpoint").fill(endpoint);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.locator(".statusbar").getByRole("status")).toContainText("Connected.");
    expect(requests.filter((request) => request.method === "server/discover")).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test("the absent parameter preserves the empty manual connection flow", async ({ page }) => {
  const requests = await mockMcp(page);
  await page.goto("/?unrelated=discarded");
  await expect(page).toHaveURL("http://127.0.0.1:4173/");
  await expect(page.locator("#endpoint")).toHaveValue("");
  await expect(page.locator(".statusbar").getByRole("status")).toContainText("Ready to inspect.");
  expect(requests).toHaveLength(0);
  await page.locator("#endpoint").fill(endpoint);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".statusbar").getByRole("status")).toContainText("Connected.");
  await page.reload();
  await expect(page.locator("#endpoint")).toHaveValue("");
});
