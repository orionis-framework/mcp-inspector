import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  APP_VERSION,
  SEO_IMAGE_HEIGHT,
  SEO_IMAGE_WIDTH,
  SEO_ORIGIN,
  localePath,
  localeUrl,
  seoContent,
  structuredData,
  type SeoLocale,
} from "../src/seo/content";
import {
  renderRobots,
  renderSeoHead,
  renderSeoHtml,
  renderSitemap,
} from "../scripts/seo";

const template = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);

describe("public static SEO documents", () => {
  it.each<SeoLocale>(["en", "es"])(
    "publishes an independently canonical %s document with reciprocal languages",
    (locale) => {
      const html = renderSeoHtml(template, locale);
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(
        `id="seo-canonical" rel="canonical" href="${localeUrl(locale)}"`,
      );
      expect(html).toContain(`hreflang="en" href="${SEO_ORIGIN}/"`);
      expect(html).toContain(`hreflang="es" href="${SEO_ORIGIN}/es/"`);
      expect(html).toContain(`hreflang="x-default" href="${SEO_ORIGIN}/"`);
      expect(html.match(/rel="canonical"/g)).toHaveLength(1);
      expect(html).toContain(`<h1>Orionis MCP Inspector</h1>`);
      expect(html).toContain(seoContent[locale].summary);
      expect(html).toContain(seoContent[locale].connectionNote);
      expect(html.match(/<h3>/g)).toHaveLength(4);
      expect(html).toContain("<noscript>");
      expect(html).toContain("max-image-preview:large");
      expect(html).not.toContain("noindex");
    },
  );

  it("uses the supplied promotional image with truthful dimensions in both card formats", () => {
    for (const locale of ["en", "es"] as const) {
      const head = renderSeoHead(locale);
      expect(head).toContain(
        'property="og:image" content="https://inspector.orionis-framework.com/images/orionis-mcp-inspector.png"',
      );
      expect(head).toContain(
        'name="twitter:card" content="summary_large_image"',
      );
      expect(head).toContain(
        'name="twitter:image" content="https://inspector.orionis-framework.com/images/orionis-mcp-inspector.png"',
      );
      expect(head).toContain(
        `property="og:image:width" content="${SEO_IMAGE_WIDTH}"`,
      );
      expect(head).toContain(
        `property="og:image:height" content="${SEO_IMAGE_HEIGHT}"`,
      );
      expect(head).toContain('property="og:image:type" content="image/png"');
      expect(head).not.toContain('rel="preload"');
      expect(head).not.toContain('name="keywords"');
    }
    expect(SEO_IMAGE_WIDTH).toBe(1672);
    expect(SEO_IMAGE_HEIGHT).toBe(941);
  });

  it("keeps structured metadata public, factual and parseable without invented rich-result claims", () => {
    for (const locale of ["en", "es"] as const) {
      const head = renderSeoHead(locale);
      const json = head.match(
        /type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )?.[1];
      expect(json).toBeDefined();
      const data = JSON.parse(json!);
      expect(data).toEqual(structuredData(locale));
      expect(
        data["@graph"].map((node: { "@type": string }) => node["@type"]),
      ).toEqual(["Organization", "WebSite", "WebPage", "WebApplication"]);
      const app = data["@graph"].find(
        (node: { "@type": string }) => node["@type"] === "WebApplication",
      );
      expect(app.softwareVersion).toBe(APP_VERSION);
      expect(app.isAccessibleForFree).toBe(true);
      expect(app.url).toBe(localeUrl(locale));
      expect(app).not.toHaveProperty("aggregateRating");
      expect(app).not.toHaveProperty("review");
      expect(app).not.toHaveProperty("screenshot");
      expect(data).not.toHaveProperty("potentialAction");
      expect(json).not.toMatch(
        /server\/discover|Authorization|mcp\.example\.test/,
      );
    }
  });

  it("allows crawling the app and exposes only real localized public pages in the sitemap", () => {
    const groups = renderRobots().trim().split(/\n\s*\n/);
    for (const agent of ["*", "OAI-SearchBot", "GPTBot", "ChatGPT-User"]) {
      expect(groups).toContain(`User-agent: ${agent}\nAllow: /`);
    }
    expect(renderRobots()).toContain(`Sitemap: ${SEO_ORIGIN}/sitemap.xml`);
    expect(renderRobots()).not.toContain("Disallow");
    const sitemap = renderSitemap();
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(urls).toEqual([localeUrl("en"), localeUrl("es")]);
    expect(sitemap).not.toMatch(/editor\.html|lastmod|changefreq|priority/);
    expect(localePath("en")).toBe("/");
    expect(localePath("es")).toBe("/es/");
  });

  it("excludes the standalone editor from indexing without hiding it from crawlers", () => {
    const editor = readFileSync(
      new URL("../editor.html", import.meta.url),
      "utf8",
    );
    expect(editor).toContain('name="robots" content="noindex, nofollow"');
    expect(renderRobots()).not.toContain("editor.html");
  });

  it("can localize Vite output without dropping built scripts or weakening executable script policy", () => {
    const built = renderSeoHtml(
      template.replace("/src/main.tsx", "/assets/app-fixture.js"),
      "en",
    );
    const spanish = renderSeoHtml(built, "es");
    expect(spanish).toContain("/assets/app-fixture.js");
    expect(spanish).toContain(seoContent.es.summary);
    expect(spanish).not.toContain(seoContent.en.summary);
    expect(spanish.match(/id="seo-structured-data"/g)).toHaveLength(1);
    expect(spanish.match(/<title>/g)).toHaveLength(1);
    const scripts = spanish.match(/script-src ([^;]+)/)?.[1];
    expect(scripts).toBeDefined();
    expect(scripts).not.toContain("unsafe-inline");
    expect(scripts).not.toContain("https:");
  });
});
