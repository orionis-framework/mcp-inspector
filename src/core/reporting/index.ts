import { translate, translateGenerated, type Locale } from "../../i18n";
import type { RequestRecord } from "../../types/mcp";
import { redact, redactUrl } from "../../utils/redact";

export interface ReportSnapshot {
  endpoint: string;
  generatedAt?: string;
  protocolVersion?: string;
  discovery?: unknown;
  serverInfo?: unknown;
  capabilities?: unknown;
  tools?: readonly unknown[];
  resources?: readonly unknown[];
  resourceTemplates?: readonly unknown[];
  prompts?: readonly unknown[];
  tests?: readonly unknown[];
  score?: unknown;
  coverage?: unknown;
  diagnostics?: readonly unknown[];
  metrics?: unknown;
  history?: readonly RequestRecord[];
}

const limitations = [
  "Observations are limited to this browser, endpoint, credentials and execution window.",
  "An ambiguous Fetch failure does not confirm CORS. Preflight details and unexposed headers cannot be inspected by this application.",
  "Latency includes browser, network and server work; it is not exclusive server processing time.",
  "Unexecuted, blocked and optional checks are distinguished from successful checks. Heuristics are not protocol requirements.",
  "Sensitive keys and known credentials are redacted. Review business data before sharing this report.",
];

function safeSnapshot(
  snapshot: ReportSnapshot,
  secrets: string[] = [],
  locale: Locale = "en",
) {
  return redact(
    {
      format: "orionis-mcp-inspector-report/1",
      ...snapshot,
      language: locale,
      generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
      endpoint: redactUrl(snapshot.endpoint),
      limitations,
    },
    secrets,
  );
}

export function exportReportJson(
  snapshot: ReportSnapshot,
  secrets: string[] = [],
  locale: Locale = "en",
): string {
  return JSON.stringify(safeSnapshot(snapshot, secrets, locale), null, 2);
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

/** Translate only inspector-owned presentation fields. Keep server catalogs and traffic verbatim. */
function presentationSnapshot(
  snapshot: ReportSnapshot,
  secrets: string[],
  locale: Locale,
) {
  const data = safeSnapshot(snapshot, secrets, locale) as Record<
    string,
    unknown
  >;
  const translateFields = (value: unknown, fields: string[]): unknown => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const copy = { ...value } as Record<string, unknown>;
    for (const field of fields) {
      if (typeof copy[field] === "string")
        copy[field] = translateGenerated(copy[field], locale);
    }
    return copy;
  };
  for (const field of ["tests", "diagnostics"]) {
    if (Array.isArray(data[field]))
      data[field] = data[field].map((test) =>
        translateFields(test, [
          "label",
          "status",
          "severity",
          "category",
          "issue",
          "evidence",
          "recommendation",
        ]),
      );
  }
  data.score = translateFields(data.score, [
    "classification",
    "readiness",
    "reason",
  ]);
  data.limitations = limitations.map((message) => translate(message, locale));
  return data;
}
export function exportReportHtml(
  snapshot: ReportSnapshot,
  secrets: string[] = [],
  locale: Locale = "en",
): string {
  const data = presentationSnapshot(snapshot, secrets, locale);
  const t = (message: string) => translate(message, locale);
  const section = (title: string, value: unknown) =>
    `<section><h2>${escapeHtml(t(title))}</h2><pre>${escapeHtml(JSON.stringify(value ?? t("Not evaluated"), null, 2))}</pre></section>`;
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(t("Orionis MCP Inspector — local report"))}</title>
<style>body{font:15px/1.65 system-ui,sans-serif;margin:0;background:#f6f8fb;color:#182433}main{max-width:1040px;margin:auto;padding:40px 24px}header{border-bottom:3px solid #206bc4;padding-bottom:24px}h1{font-size:30px;margin:0}h2{font-size:18px;margin-top:0}p{overflow-wrap:anywhere}section{margin-top:20px;border:1px solid #dce1e7;border-radius:12px;background:#fff;padding:22px}pre{font:12px/1.7 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}small{color:#626e7f}@media print{body{background:#fff}main{padding:0}section{break-inside:avoid;box-shadow:none}}</style></head><body><main>
<header><small>ORIONIS / MCP INSPECTOR &amp; VALIDATOR</small><h1>${escapeHtml(t("Inspection report"))}</h1><p>${escapeHtml(String(data.endpoint))}</p><small>${escapeHtml(String(data.generatedAt))} · ${escapeHtml(t("Generated locally in the browser"))}</small></header>
${section("Protocol version", data.protocolVersion)}
${section("Server identity & discovery", { serverInfo: data.serverInfo, discovery: data.discovery, capabilities: data.capabilities })}
${section("Quality score & coverage", { score: data.score, coverage: data.coverage })}
${section("Tools", data.tools)}${section("Resources", data.resources)}${section("Resource templates", data.resourceTemplates)}${section("Prompts", data.prompts)}
${section("Tests", data.tests)}${section("Findings & recommendations", data.diagnostics)}${section("Browser-observed metrics", data.metrics)}
${section("Request evidence", data.history)}${section("Scope & limitations", data.limitations)}
</main></body></html>`;
}

/** Text is escaped to ASCII so built-in PDF fonts preserve arbitrary Unicode as JSON escapes. */
export async function exportReportPdf(
  snapshot: ReportSnapshot,
  secrets: string[] = [],
  locale: Locale = "en",
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const t = (message: string) => translate(message, locale);
  const document = new jsPDF({ unit: "mm", format: "a4", compress: true });
  document.setProperties({
    title: t("Orionis MCP Inspector report"),
    creator: t("Orionis MCP Inspector (local browser)"),
  });
  document.setFont("helvetica", "bold");
  document.setFontSize(17);
  document.text("Orionis MCP Inspector", 16, 20);
  document.setFontSize(9);
  document.setFont("helvetica", "normal");
  document.text(
    t("Local evidence report. Unicode evidence uses JSON escapes."),
    16,
    28,
  );
  document.setFont("courier", "normal");
  document.setFontSize(8);
  const text = JSON.stringify(
    presentationSnapshot(snapshot, secrets, locale),
    null,
    2,
  ).replace(
    /[^\x20-\x7e\n\r\t]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  const lines: string[] = document.splitTextToSize(text, 178) as string[];
  let y = 38;
  for (const line of lines) {
    if (y > 280) {
      document.addPage();
      y = 18;
    }
    document.text(line, 16, y);
    y += 3.8;
  }
  return document.output("blob");
}

function safeRequest(record: RequestRecord, secrets: string[] = []) {
  return redact(
    {
      url: redactUrl(record.endpoint),
      method: "POST",
      headers: record.configuredHeaders,
      body: record.request,
    },
    secrets,
  ) as {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
}

export function requestAsJson(
  record: RequestRecord,
  secrets: string[] = [],
): string {
  return JSON.stringify(safeRequest(record, secrets), null, 2);
}

// POSIX shell quoting: single quotes in arbitrary endpoint or payload cannot escape into commands.
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function requestAsCurl(
  record: RequestRecord,
  secrets: string[] = [],
): string {
  const request = safeRequest(record, secrets);
  return [
    "# POSIX shell; redacted values must be replaced locally. cURL does not enforce browser CORS.",
    `curl --request POST ${shellQuote(request.url)} \\`,
    ...Object.entries(request.headers).map(
      ([name, value]) => `  --header ${shellQuote(`${name}: ${value}`)} \\`,
    ),
    `  --data-raw ${shellQuote(JSON.stringify(request.body))}`,
  ].join("\n");
}

/** Header names for this transport's CORS preflight, never authentication values. */
function preflightHeaderNames(record: RequestRecord): string[] {
  const unsafeValue = (value: string) =>
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return (
        code <= 8 ||
        (code >= 10 && code <= 31) ||
        code === 127 ||
        '"():<>?@[\\]{}'.includes(character)
      );
    });
  return [...new Headers(record.configuredHeaders).entries()]
    .filter(([name, value]) => {
      if (new TextEncoder().encode(value).byteLength > 128) return true;
      if (name === "accept") return unsafeValue(value);
      if (name === "accept-language" || name === "content-language")
        return !/^[0-9A-Za-z *,\-.;=]*$/.test(value);
      if (name === "content-type")
        return (
          unsafeValue(value) ||
          ![
            "application/x-www-form-urlencoded",
            "multipart/form-data",
            "text/plain",
          ].includes(value.split(";")[0].trim().toLowerCase())
        );
      if (name === "range") return !/^bytes=\d+-\d*$/.test(value);
      return true;
    })
    .map(([name]) => name)
    .sort();
}

/** A diagnostic OPTIONS request. It does not bypass or certify browser CORS. */
export function requestAsPreflightCurl(
  record: RequestRecord,
  origin: string,
  secrets: string[] = [],
): string {
  const inspectorOrigin = new URL(origin);
  if (!["http:", "https:"].includes(inspectorOrigin.protocol))
    throw new Error("A preflight probe requires an HTTP(S) inspector origin.");
  const request = safeRequest(record, secrets);
  const headers = [
    "Origin: " + inspectorOrigin.origin,
    "Access-Control-Request-Method: POST",
  ];
  const names = preflightHeaderNames(record);
  if (names.length)
    headers.push("Access-Control-Request-Headers: " + names.join(", "));
  return [
    "# POSIX shell; diagnostic preflight. cURL does not enforce browser CORS.",
    "# Header names only; no token, API key value or JSON-RPC payload is sent.",
    "# Replace redacted URL values locally if required. Redirects are not followed.",
    "curl --include --request OPTIONS " + shellQuote(request.url) + " \\",
    ...headers.map(
      (value, index) =>
        "  --header " +
        shellQuote(value) +
        (index < headers.length - 1 ? " \\" : ""),
    ),
  ].join("\n");
}

export function requestAsFetch(
  record: RequestRecord,
  secrets: string[] = [],
): string {
  const request = safeRequest(record, secrets);
  return `// Replace redacted credentials locally. The browser enforces CORS.\nconst response = await fetch(${JSON.stringify(request.url)}, {\n  method: "POST",\n  mode: "cors",\n  credentials: "omit",\n  redirect: "error",\n  headers: ${JSON.stringify(request.headers, null, 2)},\n  body: ${JSON.stringify(JSON.stringify(request.body))},\n  signal: AbortSignal.timeout(15000),\n});\nconsole.log(response.status, await response.text());\n`;
}

/** Native Hermes YAML, verified against Orionis and Hermes configuration references. */
export function hermesConfig(endpoint: string): string {
  const url = new URL(endpoint);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Hermes requires an HTTP(S) MCP endpoint.");
  return `# ~/.hermes/config.yaml — requires a Hermes release supporting MCP 2026-07-28\n# Credentials are intentionally omitted. Configure authentication locally.\nmcp_servers:\n  ORIONIS_MCP:\n    url: ${JSON.stringify(redactUrl(url.href))}\n    protocol: stateless\n    supports_parallel_tool_calls: false\n`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Delay release until the browser has consumed the download URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
