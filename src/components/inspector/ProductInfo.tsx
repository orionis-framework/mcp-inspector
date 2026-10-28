import { useI18n } from "@/i18n/react";
import {
  seoContent,
  SEO_IMAGE_PATH,
  SEO_IMAGE_WIDTH,
  SEO_IMAGE_HEIGHT,
  localePath,
} from "@/seo/content";

/** Shares its copy with the static HTML so users and crawlers get the same information. */
export function ProductInfo() {
  const { locale, setLocale } = useI18n();
  const copy = seoContent[locale];
  return (
    <section className="product-info" aria-labelledby="product-heading">
      <h2 id="product-heading">{copy.heading}</h2>
      <p>{copy.summary}</p>
      <div className="product-feature-grid">
        {copy.features.map((feature) => (
          <article key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
      <p>{copy.connectionNote}</p>
      <nav
        className="product-links"
        aria-label={
          locale === "es"
            ? "Información del producto e idiomas"
            : "Product information and languages"
        }
      >
        <a
          href="https://docs.orionis-framework.com/en/mcp/"
          target="_blank"
          rel="noreferrer"
        >
          {copy.docsLabel}
        </a>
        <a
          href="https://github.com/orionis-framework/mcp-inspector"
          target="_blank"
          rel="noreferrer"
        >
          {copy.sourceLabel}
        </a>
        {(["en", "es"] as const).map((language) => (
          <a
            key={language}
            href={localePath(language)}
            hrefLang={language}
            lang={language}
            aria-current={language === locale ? "page" : undefined}
            onClick={(event) => {
              if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                setLocale(language);
              }
            }}
          >
            {language === "en" ? "English" : "Español"}
          </a>
        ))}
      </nav>
      <img
        className="product-image"
        src={SEO_IMAGE_PATH}
        alt={copy.imageAlt}
        width={SEO_IMAGE_WIDTH}
        height={SEO_IMAGE_HEIGHT}
        loading="lazy"
        decoding="async"
      />
    </section>
  );
}
