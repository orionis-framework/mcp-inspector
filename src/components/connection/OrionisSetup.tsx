import { useState } from "react";
import { Button } from "@/components/ui/button";
import { INSPECTOR_ORIGIN, orionisEnvironment } from "@/core/connection/orionis-setup";
import { useI18n } from "@/i18n/react";

export function OrionisSetup() {
  const { t, locale } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const origin = typeof window === "undefined" ? INSPECTOR_ORIGIN : window.location.origin;
  const example = orionisEnvironment(origin);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <details className="connection-help orionis-setup">
      <summary>{t("Orionis server setup")}</summary>
      <p>
        {t("Add these variables to your Orionis application's .env, then restart the application. Keep any other origins and HTTP methods your application needs.")}
      </p>
      <pre><code>{example}</code></pre>
      <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
        {t("Copy .env example")}
      </Button>
      <span role="status" aria-live="polite">
        {copyState === "copied" && t("Environment example copied.")}
        {copyState === "failed" && t("Copy unavailable. Select and copy the example manually.")}
      </span>
      {origin !== INSPECTOR_ORIGIN && (
        <p>{t("This example includes the public inspector and this preview's origin. Retain only the origins you use.")}</p>
      )}
      <p>
        {t("The wildcard permits request headers, including MCP parameter headers. CORS_ALLOW_ORIGINS must contain explicit HTTP(S) origins; MCP does not accept a wildcard origin.")}
      </p>
      <p>
        {t("config/mcp.py validates allowed_origins; config/http.py configures HTTP CORS. Both read CORS_ALLOW_ORIGINS in the standard Orionis configuration. A value already set in .env, even list:[], overrides the default passed to Env.get(...). Changing only the fallback in config/mcp.py does not configure HTTP CORS.")}
      </p>
      <p>
        {t("The inspector sends no cookies. You do not need to enable CORS_ALLOW_CREDENTIALS for it. In the standard Orionis HTTP pipeline, CORS handles OPTIONS; no separate MCP OPTIONS route is needed.")}
      </p>
      <h4>{t("What a successful preflight must include")}</h4>
      <p>
        {t("HTTP 200 or 204 and Allow: OPTIONS, POST only show that an HTTP server responded. The response must also include Access-Control-Allow-Origin for this inspector, Access-Control-Allow-Methods permitting POST, and Access-Control-Allow-Headers permitting the requested headers. The POST response needs Access-Control-Allow-Origin too.")}
      </p>
      <p>
        {t("CORS settings cannot fix an untrusted TLS certificate, an unresolved hostname or a firewall restriction. Compare the browser's network details with the credential-free terminal preflight and analyze its output in the connection diagnostics.")}
      </p>
      <a href={`https://docs.orionis-framework.com/${locale}/mcp/stdio-and-configuration/`} target="_blank" rel="noreferrer">
        {t("Orionis MCP configuration reference")}
      </a>
    </details>
  );
}
