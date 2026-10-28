import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { connect, endpoint, mockMcp } from "./fixtures";

test.use({ locale: "es-CO" });

async function changeLanguage(page: Page, language: "en" | "es") {
  await page
    .getByRole("combobox", { name: /^(Language|Idioma)$/ })
    .selectOption(language);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

test("English is the default regardless of browser locale and workspace dialogs switch to Spanish", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toHaveValue("en");
  await expect(
    page.getByRole("button", { name: "Connect", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "MCP server endpoint", exact: true })
    .fill(endpoint);

  await changeLanguage(page, "es");
  await expect(
    page.getByRole("navigation", { name: "Explorador MCP", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resumen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "Endpoint del servidor MCP",
      exact: true,
    }),
  ).toHaveValue(endpoint);

  await page
    .getByRole("button", { name: "Autenticación", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Conexión y autenticación",
  );
  await expect(
    page.getByRole("combobox", { name: "Modo de autenticación", exact: true }),
  ).toHaveValue("none");
  await page.getByRole("button", { name: "Listo", exact: true }).click();

  await page
    .getByRole("button", { name: "Exportar informe", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Exportar inspección",
  );
  await expect(
    page.getByRole("button", { name: "Informe HTML", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cerrar diálogo", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("spanish-desktop.png"),
    fullPage: true,
  });

  await changeLanguage(page, "en");
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "MCP server endpoint", exact: true }),
  ).toHaveValue(endpoint);
});

test("language changes preserve connection, edited arguments and original MCP data", async ({
  page,
}) => {
  const requests = await mockMcp(page);
  await connect(page);
  const initialCount = requests.length;
  await page
    .getByRole("button", { name: "greet_customer", exact: true })
    .click();
  await page.getByRole("button", { name: "Form", exact: true }).click();
  await page.getByLabel(/^name/).fill("Lucía Original");

  await changeLanguage(page, "es");
  await expect(
    page.getByRole("button", { name: "Formulario", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^name/)).toHaveValue("Lucía Original");
  await expect(
    page.getByText("Customer display name.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Create a customer greeting using the supplied customer name.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "Endpoint del servidor MCP",
      exact: true,
    }),
  ).toHaveValue(endpoint);
  await expect(
    page.locator(".metric").filter({ hasText: "ESTADO DEL SERVIDOR" }),
  ).toContainText("Conectado");
  expect(requests).toHaveLength(initialCount);

  await page
    .getByRole("button", { name: "Aplicar al editor JSON", exact: true })
    .click();
  await expect(
    page.frameLocator(".json-editor iframe").locator(".monaco-editor"),
  ).toBeVisible();
  const editor = page.frameLocator(".json-editor iframe");
  await editor
    .locator(".monaco-editor")
    .click({ button: "right", position: { x: 120, y: 35 } });
  await expect(
    editor.getByRole("menuitem", { name: /Dar formato al documento/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await changeLanguage(page, "en");
  await expect(editor.locator(".monaco-editor")).toBeVisible();
  await editor
    .locator(".monaco-editor")
    .click({ button: "right", position: { x: 120, y: 35 } });
  await expect(
    editor.getByRole("menuitem", { name: /Format Document/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Execute tool", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm execution", exact: true })
    .click();
  await expect(page.locator(".result")).toContainText("Hello, Lucía Original!");
  expect(
    requests.filter((request) => request.method === "tools/call"),
  ).toHaveLength(1);
  expect(
    requests.find((request) => request.method === "tools/call")?.params
      .arguments,
  ).toEqual({
    name: "Lucía Original",
  });

  await changeLanguage(page, "es");
  await expect(
    page.getByRole("heading", { name: "Resultado", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result")).toContainText("Greeting created.");
  await expect(page.locator(".result")).toContainText("Hello, Lucía Original!");
  await page
    .getByRole("button", { name: "Exportar informe", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Informe HTML", exact: true }).click();
  const download = await downloadPromise;
  const reportPath = await download.path();
  expect(reportPath).not.toBeNull();
  const html = await readFile(reportPath!, "utf8");
  expect(html).toContain('<html lang="es">');
  expect(html).toContain("<h1>Informe de inspección</h1>");
  expect(html).toContain(
    "Create a customer greeting using the supplied customer name.",
  );
  expect(html).toContain("Hello, Lucía Original!");
});

test("CORS diagnostics and missing score switch languages without retrying the request", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route(endpoint, (route) => {
    requested.push(route.request().method());
    return route.abort("failed");
  });
  await page.goto("/");
  await changeLanguage(page, "es");
  await page
    .getByRole("textbox", { name: "Endpoint del servidor MCP", exact: true })
    .fill(endpoint);
  await page.getByRole("button", { name: "Conectar", exact: true }).click();
  await expect(
    page.getByText("Posible bloqueo CORS o problema de conectividad", {
      exact: true,
    }),
  ).toBeVisible();
  const quality = page
    .locator(".metric")
    .filter({ hasText: "PUNTUACIÓN DE CALIDAD" });
  await expect(quality.locator("strong")).toHaveText("—");
  await expect(quality).toContainText("Sin verificar");
  await expect(quality).toContainText("0% de cobertura");
  await expect(page.locator(".cors-help")).toContainText(
    "Access-Control-Request-Method: POST",
  );
  const countAfterFailure = requested.length;

  await changeLanguage(page, "en");
  await expect(
    page.getByText("Possible CORS block or connectivity problem", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".metric").filter({ hasText: "QUALITY SCORE" }),
  ).toContainText("Not Verified");
  expect(requested).toHaveLength(countAfterFailure);
});

test("Spanish workspace remains usable within the mobile viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await changeLanguage(page, "es");
  await expect(
    page.getByRole("button", { name: "Conectar", exact: true }),
  ).toBeVisible();
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport + 1);
  await page.screenshot({
    path: testInfo.outputPath("spanish-mobile.png"),
    fullPage: true,
  });
});
