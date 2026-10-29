import { useState } from "react";
import { useInspector } from "@/stores/inspector";
import { useI18n } from "@/i18n/react";
import { translateGenerated } from "@/i18n";
import { TerminalDiagnostics } from "./TerminalDiagnostics";
import {
  requestAsCurl,
  requestAsPreflightCurl,
  requestAsPreflightPowerShell,
  preflightHeaderNames,
  downloadBlob,
  requestAsJson,
} from "@/core/reporting";
import { Button } from "@/components/ui/button";
export function CorsHelp() {
  const { t, locale } = useI18n();
  const { snapshot } = useInspector();
  const [copyStatus, setCopyStatus] = useState("");
  const r = snapshot.records.at(-1);
  if (!r?.error || r.error.kind === "cancelled") return null;
  const names = Object.keys(r.configuredHeaders);
  const origin = window.location.origin;
  const productionOrigin = "https://inspector.orionis-framework.com";
  const preflight = requestAsPreflightPowerShell(r, origin);
  return (
    <details className="cors-help" open>
      <summary>{t("Connection diagnostics")}</summary>
      <p role="status">
        <strong>{t(r.httpStatus === undefined ? "No accessible HTTP response" : "HTTP response received")}</strong>
        {r.httpStatus !== undefined && <code> — HTTP {r.httpStatus}</code>}
      </p>
      <p>{translateGenerated(r.error.message, locale)}</p>
      <p>
        {t(
          r.httpStatus === undefined
            ? "The browser did not expose an HTTP response. DNS, TLS certificates, firewall restrictions, CORS, mixed content or redirects may prevent access. This does not prove a CORS problem, a 404 or an invalid MCP server. Use the terminal check below to gather evidence."
            : "An HTTP response is available. Its status, content type and JSON-RPC discovery result are checked before MCP catalog tests. An HTTP response alone does not establish a valid MCP server.",
        )}
      </p>
      <p>{t("A 404 means the requested route was not found on a responding server. A hostname that cannot be resolved is a DNS failure, not an HTTP 404.")}</p>
      <details>
        <summary>{t("Review browser access and CORS")}</summary>
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
      <p>{t("HTTP 200 and Allow: OPTIONS, POST are not sufficient for CORS. The response must include the Access-Control-Allow-* headers shown here.")}</p>
      </details>
      <h4>{t("Check the preflight from a terminal")}</h4>
      <p>PowerShell</p>
      <pre>{preflight}</pre>
      <Button size="sm" variant="secondary" onClick={async () => {
        try {
          await navigator.clipboard.writeText(preflight);
          setCopyStatus("Command copied.");
        } catch {
          setCopyStatus("Copy failed. Select and copy the command manually.");
        }
      }}>{t("Copy PowerShell command")}</Button>
      {copyStatus && <p role="status">{t(copyStatus)}</p>}
      <details>
        <summary>{t("Command for macOS / Linux")}</summary>
        <pre>{requestAsPreflightCurl(r, origin)}</pre>
      </details>
      <p>
        {t(
          "Inspect that response's status and Access-Control-Allow-* headers. This command sends no credentials and executes no MCP operation. A successful POST with cURL does not confirm browser access: cURL does not enforce CORS.",
        )}
      </p>
      <TerminalDiagnostics origin={origin} requestedHeaders={preflightHeaderNames(r)} />
      <details>
        <summary>{t("Equivalent POST request")}</summary>
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
    </details>
  );
}
