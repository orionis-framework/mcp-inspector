import { expect, test, type Page } from "@playwright/test";
import { endpoint } from "./fixtures";

async function attempt(page: Page, spanish = false) {
  await page.goto(spanish ? "/es/" : "/");
  await page.getByRole("textbox", { name: spanish ? "Endpoint del servidor MCP" : "MCP server endpoint", exact: true }).fill(endpoint);
  await page.getByRole("button", { name: spanish ? "Conectar" : "Connect", exact: true }).click();
}

async function response(page: Page, status: number, contentType: string, body: string) {
  const methods: string[] = [];
  await page.route(endpoint, async (route) => {
    const method = route.request().method();
    if (method !== "OPTIONS") methods.push(route.request().postDataJSON().method);
    await route.fulfill({
      status: method === "OPTIONS" ? 204 : status,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "*",
        "content-type": contentType,
      },
      body: method === "OPTIONS" ? "" : body,
    });
  });
  return methods;
}

test("Orionis environment setup can be copied before connecting in both languages", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/es/");
  const setup = page.locator(".orionis-setup");
  await setup.locator("summary").click();
  await expect(setup).toContainText("config/mcp.py");
  await expect(setup).toContainText("config/http.py");
  await setup.getByRole("button", { name: "Copiar ejemplo .env" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('CORS_ALLOW_ORIGINS="list:[\'https://inspector.orionis-framework.com\', \'http://127.0.0.1:4173\']"');
  expect(copied).toContain('CORS_ALLOW_METHODS="list:[\'POST\', \'OPTIONS\']"');
  expect(copied).toContain('CORS_ALLOW_HEADERS="list:[\'*\']"');
  await page.getByRole("combobox", { name: "Idioma", exact: true }).selectOption("en");
  await expect(setup.locator("summary")).toHaveText("Orionis server setup");
});

for (const scenario of [
  { name: "HTTP 404", status: 404, contentType: "text/html", body: "<html>Not found</html>", expected: "HTTP 404: no se encontró la ruta" },
  { name: "non-MCP HTML", status: 200, contentType: "text/html", body: "<html>Ordinary website</html>", expected: "la respuesta no es MCP válida" },
  { name: "non-MCP JSON", status: 200, contentType: "application/json", body: '{"ok":true}', expected: "La respuesta no es MCP válida" },
  { name: "FortiGuard", status: 403, contentType: "text/html", body: "<html><title>Web Filter Violation</title><h1>FortiGuard: acceso bloqueado</h1></html>", expected: "restricción de red de FortiGuard" },
]) {
  test(`identifies ${scenario.name} before attempting any catalog calls`, async ({ page }) => {
    const methods = await response(page, scenario.status, scenario.contentType, scenario.body);
    await attempt(page, true);
    const help = page.locator(".cors-help");
    await expect(help).toContainText(scenario.expected);
    await expect(help).toContainText("Respuesta HTTP recibida");
    expect(methods).toEqual(["server/discover"]);
    await expect(page.locator(".metric").filter({ hasText: "PUNTUACIÓN DE CALIDAD" }).locator("strong")).toHaveText("—");
  });
}

test("hidden network errors use terminal evidence to distinguish TLS, DNS and a missing CORS policy", async ({ page }, testInfo) => {
  await page.route(endpoint, (route) => route.abort("failed"));
  await attempt(page);
  await expect(page.locator(".cors-help")).toContainText("No accessible HTTP response");
  const terminal = page.locator(".terminal-diagnostics");
  await terminal.locator("summary").click();
  const input = terminal.getByRole("textbox", { name: "Preflight terminal output" });
  await input.fill("curl: (60) schannel: SEC_E_UNTRUSTED_ROOT (0x80090325)");
  await terminal.getByRole("button", { name: "Analyze output locally" }).click();
  await expect(terminal.locator(".terminal-result h4")).toHaveText("Untrusted TLS certificate chain");
  await input.fill("curl: (6) Could not resolve host: nonexistent.example");
  await terminal.getByRole("button", { name: "Analyze output locally" }).click();
  await expect(terminal.locator(".terminal-result h4")).toHaveText("Hostname could not be resolved");
  await input.fill("curl: (60) schannel: SEC_E_UNTRUSTED_ROOT\nHTTP/1.1 200 OK\nAllow: OPTIONS, POST\nContent-Length: 0\nServer: Orionis RSGI\n\n");
  await terminal.getByRole("button", { name: "Analyze output locally" }).click();
  await expect(terminal.locator(".terminal-result h4")).toHaveText("Preflight does not allow this inspector origin");
  await expect(terminal.locator(".terminal-result")).toContainText("HTTP 200 and Allow: OPTIONS, POST do not grant");
  await expect(page.locator(".metric").filter({ hasText: "QUALITY SCORE" }).locator("strong")).toHaveText("—");
  await page.screenshot({ path: testInfo.outputPath("connection-diagnostics.png"), fullPage: true });
  await terminal.getByRole("button", { name: "Clear terminal evidence" }).click();
  await expect(input).toHaveValue("");
  await expect(terminal.locator(".terminal-result")).toHaveCount(0);
});
