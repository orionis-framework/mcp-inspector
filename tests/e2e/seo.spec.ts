import { expect, test, type Page } from "@playwright/test";
import { connect, endpoint, mockMcp } from "./fixtures";

const origin = "https://inspector.orionis-framework.com";
const imagePath = "/images/orionis-mcp-inspector.png";

async function expectMetadata(page: Page, locale: "en" | "es") {
  const canonical = origin + (locale === "es" ? "/es/" : "/");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page).toHaveTitle(/Orionis MCP Inspector/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    canonical,
  );
  const alternates = page.locator('link[rel="alternate"][hreflang]');
  await expect(alternates).toHaveCount(3);
  for (const [language, path] of [
    ["en", "/"],
    ["es", "/es/"],
    ["x-default", "/"],
  ]) {
    await expect(
      page.locator('link[rel="alternate"][hreflang="' + language + '"]'),
    ).toHaveAttribute("href", origin + path);
  }
  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveCount(1);
  expect((await description.getAttribute("content"))?.length).toBeGreaterThan(
    80,
  );
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    "content",
    /noindex/i,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    canonical,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    await page.title(),
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    (await description.getAttribute("content"))!,
  );
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    locale === "es" ? "es_ES" : "en_US",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    origin + imagePath,
  );
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    "content",
    "image/png",
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1672",
  );
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute("content", "941");
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    /Orionis/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    origin + imagePath,
  );
  const dataBlock = page.locator('script[type="application/ld+json"]');
  await expect(dataBlock).toHaveCount(1);
  const data = JSON.parse((await dataBlock.textContent())!) as {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  };
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@graph"].map((entity) => entity["@type"])).toEqual(
    expect.arrayContaining([
      "Organization",
      "WebSite",
      "WebPage",
      "WebApplication",
    ]),
  );
  const webPage = data["@graph"].find(
    (entity) => entity["@type"] === "WebPage",
  );
  expect(webPage?.url).toBe(canonical);
  expect(JSON.stringify(data)).not.toMatch(
    /"(?:aggregateRating|review|screenshot)"\s*:/,
  );
}

test.describe("crawlable localized HTML without JavaScript", () => {
  test.use({ javaScriptEnabled: false, locale: "es-CO" });
  for (const locale of ["en", "es"] as const) {
    test(
      locale +
        " document exposes readable content and localized search metadata",
      async ({ page }) => {
        const response = await page.goto(locale === "es" ? "/es/" : "/");
        expect(response?.status()).toBe(200);
        await expectMetadata(page, locale);
        const content = page.locator("main.seo-static");
        await expect(
          content.getByRole("heading", {
            name: "Orionis MCP Inspector",
            exact: true,
            level: 1,
          }),
        ).toBeVisible();
        await expect(
          content.getByRole("heading", {
            name:
              locale === "es"
                ? "Inspecciona servidores MCP desde tu navegador"
                : "Inspect MCP servers directly in your browser",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          content.getByRole("heading", {
            name:
              locale === "es"
                ? "Herramientas y JSON Schema"
                : "Tools & JSON Schema",
            exact: true,
          }),
        ).toBeVisible();
        await expect(content).toContainText("CORS");
        await expect(content).toContainText("2026-07-28");
        await expect(
          content.locator(
            'a[href="https://github.com/orionis-framework/mcp-inspector"]',
          ),
        ).toBeVisible();
      },
    );
  }
});

test("crawler resources expose only public pages and the supplied social image", async ({
  page,
  request,
}) => {
  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  const robots = await robotsResponse.text();
  const groups = robots.replaceAll("\r\n", "\n").trim().split(/\n\s*\n/);
  for (const agent of ["*", "OAI-SearchBot", "GPTBot", "ChatGPT-User"]) {
    expect(groups).toContain(`User-agent: ${agent}\nAllow: /`);
  }
  expect(robots).toContain("Sitemap: " + origin + "/sitemap.xml");
  expect(robots).not.toMatch(/Disallow:\s*\S+/i);

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  const parsed = await page.evaluate((xml) => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return {
      errors: document.querySelectorAll("parsererror").length,
      urls: [...document.getElementsByTagName("loc")].map(
        (node) => node.textContent,
      ),
    };
  }, sitemap);
  expect(parsed.errors).toBe(0);
  expect(parsed.urls.sort()).toEqual([origin + "/", origin + "/es/"].sort());
  expect(sitemap).not.toContain("editor.html");

  const editor = await request.get("/editor.html");
  expect(editor.status()).toBe(200);
  const editorMetadata = await page.evaluate(
    (html) => {
      const document = new DOMParser().parseFromString(html, "text/html");
      return document
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content");
    },
    await editor.text(),
  );
  expect(editorMetadata).toMatch(/noindex/);
  expect(editorMetadata).toMatch(/nofollow/);

  const imageResponse = await request.get(imagePath);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toMatch(/^image\/png/);
  const image = await imageResponse.body();
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(image.readUInt32BE(16)).toBe(1672);
  expect(image.readUInt32BE(20)).toBe(941);
});

test("language URLs and metadata change without reconnecting or exposing MCP data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to|CSP/i.test(message.text())
    ) {
      errors.push(message.text());
    }
  });
  const requests = await mockMcp(page);
  await connect(page);
  const initialCount = requests.length;
  await expectMetadata(page, "en");
  const englishDescription = await page
    .locator('meta[name="description"]')
    .getAttribute("content");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("es");
  await expect(page).toHaveURL(/\/es\/$/);
  await expectMetadata(page, "es");
  expect(
    await page.locator('meta[name="description"]').getAttribute("content"),
  ).not.toBe(englishDescription);
  await expect(
    page.locator(".metric").filter({ hasText: "ESTADO DEL SERVIDOR" }),
  ).toContainText("Conectado");
  expect(requests).toHaveLength(initialCount);
  const head = await page.locator("head").innerHTML();
  expect(head).not.toContain(endpoint);
  expect(head).not.toContain("Controlled MCP fixture");

  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Idioma", exact: true }),
  ).toHaveValue("es");
  await expectMetadata(page, "es");
  await expect(
    page.getByRole("heading", {
      name: "Orionis MCP Inspector",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await expect(page).toHaveURL(/\/$/);
  expect(new URL(page.url()).pathname).toBe("/");
  await expectMetadata(page, "en");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toHaveValue("en");
  expect(errors).toEqual([]);
});
