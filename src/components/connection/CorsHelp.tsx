import { useInspector } from "@/stores/inspector";
import { useI18n } from "@/i18n/react";
import {
  requestAsCurl,
  requestAsPreflightCurl,
  downloadBlob,
  requestAsJson,
} from "@/core/reporting";
import { Button } from "@/components/ui/button";
export function CorsHelp() {
  const { t } = useI18n();
  const { snapshot } = useInspector();
  const r = snapshot.records.at(-1);
  if (r?.error?.kind !== "network") return null;
  const names = Object.keys(r.configuredHeaders);
  const origin = window.location.origin;
  const productionOrigin = "https://inspector.orionis-framework.com";
  return (
    <details className="cors-help" open>
      <summary>{t("Possible CORS block or connectivity problem")}</summary>
      <p>
        {t(
          "Fetch cannot confirm the cause. Check DNS, TLS, connectivity, mixed content, redirects and the browser network console. The inspector rejects redirects to avoid forwarding credentials. A network error does not establish an MCP server defect.",
        )}
      </p>
      <p>
        {t("Current inspector origin:")} <code>{origin}</code>.{" "}
        {t("The server policy must allow this exact origin.")}
      </p>
      {origin !== productionOrigin && (
        <p>
          {t("For public deployment, also allow")}{" "}
          <code>{productionOrigin}</code>{" "}
          {t(
            "in the server's origin allowlist. Return a single allowed origin in Access-Control-Allow-Origin, never a list.",
          )}
        </p>
      )}
      <p>
        {t(
          "The browser automatically sends OPTIONS before POST because the request uses JSON and MCP headers. The preflight must return a 2xx status and allow the origin, POST and requested headers. Rejected OPTIONS or a missing Access-Control-Allow-Origin prevents the browser from sending POST. The POST response also needs Access-Control-Allow-Origin.",
        )}
      </p>
      <pre>
        {[
          "Access-Control-Allow-Origin: " + origin,
          "Access-Control-Allow-Methods: POST, OPTIONS",
          "Access-Control-Allow-Headers: " + names.join(", "),
          "Access-Control-Expose-Headers: Content-Type, MCP-Protocol-Version, Retry-After",
          "Vary: Origin",
        ].join("\n")}
      </pre>
      <p>
        {t(
          "Illustrative MCP server configuration using this request's header names. OPTIONS must respond before requiring POST credentials. For tools, also allow their x-mcp-header mappings. Preflight details and unexposed headers are unavailable to this application.",
        )}
      </p>
      <h4>{t("Check the preflight from a terminal")}</h4>
      <pre>{requestAsPreflightCurl(r, origin)}</pre>
      <p>
        {t(
          "Inspect that response's status and Access-Control-Allow-* headers. This command sends no credentials and executes no MCP operation. A successful POST with cURL does not confirm browser access: cURL does not enforce CORS.",
        )}
      </p>
      <h4>{t("Equivalent POST request")}</h4>
      <pre>{requestAsCurl(r)}</pre>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          downloadBlob(
            new Blob([requestAsJson(r)], { type: "application/json" }),
            "failed-request.json",
          )
        }
      >
        {t("Export request")}
      </Button>
    </details>
  );
}
