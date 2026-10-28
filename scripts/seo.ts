import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import {
  SEO_ORIGIN,
  SEO_IMAGE_PATH,
  SEO_IMAGE_WIDTH,
  SEO_IMAGE_HEIGHT,
  SEO_DOCS,
  SEO_REPOSITORY,
  seoContent,
  localeUrl,
  structuredData,
  type SeoLocale,
} from "../src/seo/content";

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const meta = (name: string, content: string, property = false, id?: string) =>
  `<meta ${id ? `id="${id}" ` : ""}${property ? "property" : "name"}="${name}" content="${escape(content)}" />`;

export function renderSeoHead(locale: SeoLocale): string {
  const content = seoContent[locale];
  const image = SEO_ORIGIN + SEO_IMAGE_PATH;
  // JSON-LD is an inert data block; keep the executable-script CSP unchanged.
  const json = JSON.stringify(structuredData(locale)).replace(/</g, "\\u003c");
  return [
    `<title>${escape(content.title)}</title>`,
    meta("description", content.description, false, "seo-description"),
    meta(
      "robots",
      "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    ),
    meta("application-name", "Orionis MCP Inspector"),
    `<link id="seo-canonical" rel="canonical" href="${localeUrl(locale)}" />`,
    `<link rel="alternate" hreflang="en" href="${localeUrl("en")}" />`,
    `<link rel="alternate" hreflang="es" href="${localeUrl("es")}" />`,
    `<link rel="alternate" hreflang="x-default" href="${localeUrl("en")}" />`,
    meta("og:type", "website", true),
    meta("og:site_name", "Orionis MCP Inspector", true),
    meta("og:title", content.title, true, "seo-og-title"),
    meta("og:description", content.description, true, "seo-og-description"),
    meta("og:url", localeUrl(locale), true, "seo-og-url"),
    meta(
      "og:locale",
      locale === "es" ? "es_ES" : "en_US",
      true,
      "seo-og-locale",
    ),
    meta(
      "og:locale:alternate",
      locale === "es" ? "en_US" : "es_ES",
      true,
      "seo-og-locale-alternate",
    ),
    meta("og:image", image, true),
    meta("og:image:secure_url", image, true),
    meta("og:image:type", "image/png", true),
    meta("og:image:width", String(SEO_IMAGE_WIDTH), true),
    meta("og:image:height", String(SEO_IMAGE_HEIGHT), true),
    meta("og:image:alt", content.imageAlt, true, "seo-og-image-alt"),
    meta("twitter:card", "summary_large_image"),
    meta("twitter:title", content.title, false, "seo-twitter-title"),
    meta(
      "twitter:description",
      content.description,
      false,
      "seo-twitter-description",
    ),
    meta("twitter:image", image),
    meta("twitter:image:alt", content.imageAlt, false, "seo-twitter-image-alt"),
    `<script id="seo-structured-data" type="application/ld+json">${json}</script>`,
  ].join("\n");
}

export function renderStaticContent(locale: SeoLocale): string {
  const content = seoContent[locale];
  return `<main class="seo-static" style="height:100dvh;overflow:auto;max-width:960px;margin:0 auto;padding:32px 24px;line-height:1.65">
<header><img src="/favicon.svg" width="48" height="48" alt="" /><h1>Orionis MCP Inspector</h1></header>
<nav aria-label="${locale === "es" ? "Idioma" : "Language"}"><a href="/" hreflang="en" lang="en">English</a> · <a href="/es/" hreflang="es" lang="es">Español</a></nav>
<section class="product-info" aria-labelledby="static-product-heading"><h2 id="static-product-heading">${escape(content.heading)}</h2><p>${escape(content.summary)}</p>
${content.features.map((feature) => `<section><h3>${escape(feature.title)}</h3><p>${escape(feature.body)}</p></section>`).join("\n")}
<p>${escape(content.connectionNote)}</p>
<p class="product-links"><a href="${SEO_DOCS}">${escape(content.docsLabel)}</a> · <a href="${SEO_REPOSITORY}">${escape(content.sourceLabel)}</a></p>
<img class="product-image" src="${SEO_IMAGE_PATH}" width="${SEO_IMAGE_WIDTH}" height="${SEO_IMAGE_HEIGHT}" alt="${escape(content.imageAlt)}" loading="lazy" decoding="async" style="display:block;max-width:100%;height:auto" />
</section><noscript><p>${escape(content.javascriptNote)}</p></noscript></main>`;
}

function replaceSection(
  html: string,
  section: string,
  content: string,
): string {
  const pattern = new RegExp(
    `<!-- seo:${section}:start -->[\\s\\S]*?<!-- seo:${section}:end -->`,
  );
  if (!pattern.test(html))
    throw new Error(`Missing SEO template section: ${section}`);
  return html.replace(
    pattern,
    () =>
      `<!-- seo:${section}:start -->\n${content}\n<!-- seo:${section}:end -->`,
  );
}

export function renderSeoHtml(html: string, locale: SeoLocale): string {
  const head = replaceSection(html, "head", renderSeoHead(locale));
  return replaceSection(head, "content", renderStaticContent(locale)).replace(
    /<html\s+lang="[^"]*"/,
    `<html lang="${locale}"`,
  );
}

export const renderRobots = (): string =>
  `User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nSitemap: ${SEO_ORIGIN}/sitemap.xml\n`;
export const renderSitemap =
  (): string => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${localeUrl("en")}</loc></url>
  <url><loc>${localeUrl("es")}</loc></url>
</urlset>\n`;

export function seoPages(): Plugin {
  return {
    name: "orionis-static-seo",
    enforce: "post",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        if (!html.includes("<!-- seo:head:start -->")) return html;
        return renderSeoHtml(
          html,
          context.path.startsWith("/es/") ? "es" : "en",
        );
      },
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        if (path === "/robots.txt" || path === "/sitemap.xml") {
          response.setHeader(
            "Content-Type",
            path.endsWith(".xml")
              ? "application/xml; charset=utf-8"
              : "text/plain; charset=utf-8",
          );
          response.end(
            path.endsWith(".xml") ? renderSitemap() : renderRobots(),
          );
          return;
        }
        if (path === "/es") {
          response.statusCode = 308;
          response.setHeader("Location", "/es/");
          response.end();
          return;
        }
        if (path !== "/es/" && path !== "/es/index.html") return next();
        try {
          const template = await readFile(
            resolve(server.config.root, "index.html"),
            "utf8",
          );
          const html = await server.transformIndexHtml("/es/", template);
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"];
        if (!index || index.type !== "asset")
          throw new Error(
            "Built index.html is required for localized SEO pages",
          );
        this.emitFile({
          type: "asset",
          fileName: "es/index.html",
          source: renderSeoHtml(String(index.source), "es"),
        });
        this.emitFile({
          type: "asset",
          fileName: "robots.txt",
          source: renderRobots(),
        });
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: renderSitemap(),
        });
      },
    },
  };
}
