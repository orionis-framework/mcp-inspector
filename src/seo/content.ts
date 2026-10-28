import { APP_VERSION } from "../version";
export { APP_VERSION } from "../version";

export type SeoLocale = "en" | "es";
export const SEO_ORIGIN = "https://inspector.orionis-framework.com";
export const SEO_IMAGE_PATH = "/images/orionis-mcp-inspector.png";
export const SEO_IMAGE_WIDTH = 1672;
export const SEO_IMAGE_HEIGHT = 941;
export const SEO_REPOSITORY =
  "https://github.com/orionis-framework/mcp-inspector";
export const SEO_DOCS = "https://docs.orionis-framework.com/en/mcp/";

interface SeoContent {
  title: string;
  description: string;
  heading: string;
  summary: string;
  features: { title: string; body: string }[];
  connectionNote: string;
  imageAlt: string;
  javascriptNote: string;
  docsLabel: string;
  sourceLabel: string;
}

export const seoContent: Record<SeoLocale, SeoContent> = {
  en: {
    title: "Orionis MCP Inspector | Test & Validate MCP Servers",
    description:
      "Inspect and test stateless MCP servers in your browser. Explore tools, validate JSON Schema, diagnose requests and export local reports with Orionis MCP Inspector.",
    heading: "Inspect MCP servers directly in your browser",
    summary:
      "Orionis MCP Inspector is a free, open-source workspace for inspecting, testing and validating Model Context Protocol (MCP) servers. Connect an HTTP endpoint to discover capabilities, inspect JSON-RPC traffic and understand the evidence behind each diagnostic. It supports stateless MCP 2026-07-28, including servers built with Orionis Framework, with an interface in English and Spanish.",
    features: [
      {
        title: "Tools & JSON Schema",
        body: "Explore available tools, review input and output schemas, and build arguments with a form or JSON editor. Execute tools manually with confirmation and validate their results against declared schemas.",
      },
      {
        title: "Resources & prompts",
        body: "Browse resources, URI templates and prompts when the server declares them. Read selected resources, supply prompt arguments and inspect the returned content without treating optional capabilities as requirements.",
      },
      {
        title: "Diagnostics backed by evidence",
        body: "Run safe checks for discovery, protocol messages and schemas. Review request headers, accessible responses, browser latency and coverage. Untested checks are not counted as passes, and AI readiness advice is identified as heuristic.",
      },
      {
        title: "Local reports & session privacy",
        body: "Generate JSON, HTML and PDF reports in your browser. Credentials remain in session memory and are redacted from logs and exports. MCP traffic goes directly to your chosen endpoint, without an inspector proxy or external analysis service.",
      },
    ],
    connectionNote:
      "Use an HTTP(S) endpoint supporting stateless MCP 2026-07-28. The server must permit the inspector origin through CORS; an ambiguous browser network error does not prove a server defect. Automated safe tests do not execute tools on your behalf.",
    imageAlt:
      "Promotional illustration of Orionis MCP Inspector showing the Orionis Framework and MCP identities, protocol inspection and validation features.",
    javascriptNote:
      "Enable JavaScript to open the interactive inspector. Requests are sent only when you choose an endpoint and start an inspection.",
    docsLabel: "Read the Orionis MCP documentation",
    sourceLabel: "View the open-source project on GitHub",
  },
  es: {
    title: "Orionis MCP Inspector | Prueba y valida servidores MCP",
    description:
      "Inspecciona y prueba servidores MCP sin estado desde tu navegador. Explora herramientas, valida JSON Schema y exporta informes con Orionis MCP Inspector.",
    heading: "Inspecciona servidores MCP desde tu navegador",
    summary:
      "Orionis MCP Inspector es un espacio de trabajo gratuito y de código abierto para inspeccionar, probar y validar servidores Model Context Protocol (MCP). Conecta un endpoint HTTP para descubrir capacidades, examinar tráfico JSON-RPC y comprender la evidencia de cada diagnóstico. Admite MCP 2026-07-28 sin estado, incluidos servidores creados con Orionis Framework, con interfaz en inglés y español.",
    features: [
      {
        title: "Herramientas y JSON Schema",
        body: "Explora las herramientas disponibles, revisa sus esquemas de entrada y salida y prepara argumentos mediante un formulario o editor JSON. Ejecuta herramientas manualmente con confirmación y valida sus resultados contra los esquemas declarados.",
      },
      {
        title: "Recursos y prompts",
        body: "Explora recursos, plantillas URI y prompts cuando el servidor los declare. Lee los recursos seleccionados, proporciona argumentos a los prompts e inspecciona su contenido sin convertir capacidades opcionales en requisitos.",
      },
      {
        title: "Diagnósticos basados en evidencia",
        body: "Ejecuta comprobaciones seguras de discovery, mensajes del protocolo y esquemas. Revisa headers, respuestas accesibles, latencia del navegador y cobertura. Las pruebas sin ejecutar no cuentan como aprobadas y las recomendaciones de preparación para IA se identifican como heurísticas.",
      },
      {
        title: "Informes locales y privacidad de sesión",
        body: "Genera informes JSON, HTML y PDF en tu navegador. Las credenciales permanecen en la memoria de la sesión y se ocultan en registros y exportaciones. El tráfico MCP va directamente al endpoint elegido, sin un proxy del inspector ni servicios externos de análisis.",
      },
    ],
    connectionNote:
      "Utiliza un endpoint HTTP(S) compatible con MCP 2026-07-28 sin estado. El servidor debe permitir el origen del inspector mediante CORS; un error de red ambiguo del navegador no demuestra un defecto del servidor. Las pruebas seguras automáticas no ejecutan herramientas por ti.",
    imageAlt:
      "Ilustración promocional de Orionis MCP Inspector con las identidades de Orionis Framework y MCP y sus funciones de inspección y validación del protocolo.",
    javascriptNote:
      "Activa JavaScript para abrir el inspector interactivo. Las solicitudes se envían únicamente cuando eliges un endpoint e inicias una inspección.",
    docsLabel: "Lee la documentación de Orionis MCP",
    sourceLabel: "Consulta el proyecto de código abierto en GitHub",
  },
};

export const localePath = (locale: SeoLocale): string =>
  locale === "es" ? "/es/" : "/";
export const localeUrl = (locale: SeoLocale): string =>
  SEO_ORIGIN + localePath(locale);

/** Only public product metadata belongs here: never session or MCP response data. */
export function structuredData(locale: SeoLocale) {
  const content = seoContent[locale];
  const organization = `${SEO_ORIGIN}/#organization`;
  const website = `${SEO_ORIGIN}/#website`;
  const application = `${SEO_ORIGIN}/#application`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: "Orionis Framework",
        url: "https://orionis-framework.com/",
        logo: `${SEO_ORIGIN}/favicon.svg`,
        sameAs: ["https://github.com/orionis-framework"],
      },
      {
        "@type": "WebSite",
        "@id": website,
        name: "Orionis MCP Inspector",
        url: `${SEO_ORIGIN}/`,
        inLanguage: ["en", "es"],
        publisher: { "@id": organization },
      },
      {
        "@type": "WebPage",
        "@id": `${localeUrl(locale)}#webpage`,
        url: localeUrl(locale),
        name: content.title,
        description: content.description,
        inLanguage: locale,
        isPartOf: { "@id": website },
        about: { "@id": application },
        mainEntity: { "@id": application },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: SEO_ORIGIN + SEO_IMAGE_PATH,
          width: SEO_IMAGE_WIDTH,
          height: SEO_IMAGE_HEIGHT,
          caption: content.imageAlt,
        },
      },
      {
        "@type": "WebApplication",
        "@id": application,
        name: "Orionis MCP Inspector",
        url: localeUrl(locale),
        description: content.description,
        applicationCategory: "DeveloperApplication",
        applicationSubCategory:
          "Model Context Protocol inspection and validation",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and a modern web browser.",
        softwareVersion: APP_VERSION,
        inLanguage: ["en", "es"],
        isAccessibleForFree: true,
        license: `${SEO_REPOSITORY}/blob/master/LICENSE`,
        author: { "@id": organization },
        publisher: { "@id": organization },
        image: SEO_ORIGIN + SEO_IMAGE_PATH,
        featureList: content.features.map((feature) => feature.title),
      },
    ],
  };
}
