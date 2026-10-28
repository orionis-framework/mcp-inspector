import type { Locale } from "../i18n";
import { localePath, localeUrl, seoContent, structuredData } from "./content";

export function localeFromPath(path: string): Locale {
  return /^\/es(?:\/|$)/.test(path) ? "es" : "en";
}

/** Only public product copy belongs in metadata. Never pass session or MCP data here. */
export function updatePageMetadata(locale: Locale) {
  const copy = seoContent[locale];
  document.documentElement.lang = locale;
  document.title = copy.title;
  const values: Record<string, string> = {
    "seo-description": copy.description,
    "seo-og-title": copy.title,
    "seo-og-description": copy.description,
    "seo-og-url": localeUrl(locale),
    "seo-og-locale": locale === "es" ? "es_ES" : "en_US",
    "seo-og-locale-alternate": locale === "es" ? "en_US" : "es_ES",
    "seo-og-image-alt": copy.imageAlt,
    "seo-twitter-title": copy.title,
    "seo-twitter-description": copy.description,
    "seo-twitter-image-alt": copy.imageAlt,
  };
  for (const [id, value] of Object.entries(values))
    document.getElementById(id)?.setAttribute("content", value);
  document
    .getElementById("seo-canonical")
    ?.setAttribute("href", localeUrl(locale));
  const data = document.getElementById("seo-structured-data");
  if (data)
    data.textContent = JSON.stringify(structuredData(locale)).replace(
      /</g,
      "\\u003c",
    );
  const path = localePath(locale);
  if (window.location.pathname !== path || window.location.search)
    window.history.replaceState(window.history.state, "", path);
}
