import { expect, test } from "@playwright/test";
import { connect, endpoint, mockMcp } from "./fixtures";

test("required Orionis prompt arguments accept empty strings but reject missing values", async ({ page }) => {
  const requests = await mockMcp(page);
  await connect(page);
  await page.getByRole("button", { name: "support_reply", exact: true }).click();
  await page.getByRole("button", { name: "Execute request", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Required argument: topic");
  expect(requests.filter((request) => request.method === "prompts/get")).toHaveLength(0);

  await page.getByRole("textbox", { name: "Prompt arguments" }).fill('{"topic":""}');
  await page.getByRole("button", { name: "Execute request", exact: true }).click();
  await expect(page.locator(".result")).toContainText("Create a reply about shipping.");
  expect(requests.filter((request) => request.method === "prompts/get")).toHaveLength(1);
  expect(requests.find((request) => request.method === "prompts/get")?.params.arguments).toEqual({ topic: "" });
});

test("Orionis requestState continuations are clearly incomplete and never replayed automatically", async ({ page }) => {
  await mockMcp(page);
  let reads = 0;
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const request = route.request().postDataJSON() as { method: string; id: string };
    if (request.method !== "resources/read") return route.fallback();
    reads++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          resultType: "input_required",
          requestState: "opaque-continuation-state",
          _meta: { "io.modelcontextprotocol/serverInfo": { name: "Controlled MCP fixture", version: "1.0.0" } },
        },
      }),
    });
  });
  await connect(page);
  await page.getByRole("button", { name: "service_guide", exact: true }).click();
  await page.getByRole("button", { name: "Execute request", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "This operation is incomplete." })).toBeVisible();
  await expect(page.locator(".result")).toContainText("input_required");
  await expect(page.locator(".detail")).toContainText("Not Tested");
  expect(reads).toBe(1);
});

test("catalog previews hide known credentials while forms preserve operational enum values", async ({ page }) => {
  const credential = "private-catalog-display-marker";
  const requests = await mockMcp(page);
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const request = route.request().postDataJSON() as { method: string; id: string };
    if (request.method !== "tools/list") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          resultType: "complete",
          tools: [{
            name: "greet_customer",
            title: `Tool ${credential}`,
            description: `Description ${credential}`,
            inputSchema: {
              type: "object",
              properties: { region: { type: "string", enum: ["eu", "us"], description: `Region ${credential}` } },
              required: ["region"],
            },
          }],
        },
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Authentication", exact: true }).click();
  await page.getByLabel("Authentication mode").selectOption("bearer");
  await page.getByLabel("Credential", { exact: true }).fill("eu");
  await page.getByLabel("Additional headers (JSON)").fill(JSON.stringify({ "X-Secret": credential }));
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("textbox", { name: "MCP server endpoint" }).fill(endpoint);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Connected. Each request is independent.")).toBeVisible();
  await page.getByRole("button", { name: "greet_customer", exact: true }).click();
  await expect(page.locator(".detail")).not.toContainText(credential);
  await expect(page.locator(".detail h1")).toContainText("[REDACTED]");
  await page.getByRole("button", { name: "Schemas & annotations", exact: true }).click();
  await expect(page.locator(".detail")).not.toContainText(credential);
  await page.getByRole("button", { name: "Form", exact: true }).click();
  await expect(page.locator(".detail")).not.toContainText(credential);
  await page.getByLabel(/^region/).selectOption('"eu"');
  await page.getByRole("button", { name: "Apply to JSON editor" }).click();
  await page.getByRole("button", { name: "Execute tool", exact: true }).click();
  await page.getByRole("button", { name: "Confirm execution", exact: true }).click();
  await expect(page.locator(".result")).toContainText("Greeting created.");
  expect(requests.find((request) => request.method === "tools/call")?.params.arguments).toEqual({ region: "eu" });
});

test("resource and prompt verdicts validate raw content before redacting matching credentials", async ({ page }) => {
  await mockMcp(page);
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const request = route.request().postDataJSON() as { method: string; id: string };
    if (!["resources/read", "prompts/get"].includes(request.method)) return route.fallback();
    const result = request.method === "resources/read"
      ? { contents: [{ uri: "guide://service", blob: "AQID", mimeType: "application/octet-stream" }] }
      : { messages: [{ role: "user", content: { type: "image", data: "AQID", mimeType: "image/png" } }] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { resultType: "complete", ...result } }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Authentication", exact: true }).click();
  await page.getByLabel("Authentication mode").selectOption("bearer");
  await page.getByLabel("Credential", { exact: true }).fill("AQID");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("textbox", { name: "MCP server endpoint" }).fill(endpoint);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Connected. Each request is independent.")).toBeVisible();
  await page.getByRole("button", { name: "service_guide", exact: true }).click();
  await page.getByRole("button", { name: "Execute request", exact: true }).click();
  await expect(page.locator(".detail .finding").filter({ hasText: "Resource content structure" })).toContainText("Passed");
  await expect(page.locator(".result")).not.toContainText("AQID");
  await page.getByRole("button", { name: "support_reply", exact: true }).click();
  await page.getByRole("textbox", { name: "Prompt arguments" }).fill('{"topic":"shipping"}');
  await page.getByRole("button", { name: "Execute request", exact: true }).click();
  await expect(page.locator(".detail .finding").filter({ hasText: "Prompt message structure" })).toContainText("Passed");
  await expect(page.locator(".result")).not.toContainText("AQID");
});
