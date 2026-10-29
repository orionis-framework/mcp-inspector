/** Interpret user-supplied terminal evidence locally; this never probes an endpoint. */
export const MAX_TERMINAL_CHARS = 65_536;

export interface TerminalOptions {
  origin: string;
  requestedHeaders: string[];
  /** Explicit confirmation when copying omitted the terminating blank line. */
  completeOutput?: boolean;
}

export interface TerminalFinding {
  kind: "tls" | "network-restriction" | "dns" | "connectivity" | "timeout" | "http" | "cors" | "preflight" | "unknown";
  title: string;
  evidence: string;
  recommendation: string;
  httpStatus?: number;
}

type Event = { index: number; end: number; status?: number; code?: number; tls?: boolean; dns?: boolean; proxy?: boolean };

function finding(kind: TerminalFinding["kind"], title: string, evidence: string, recommendation: string, httpStatus?: number): TerminalFinding {
  return { kind, title, evidence, recommendation, ...(httpStatus === undefined ? {} : { httpStatus }) };
}

function blockedPage(text: string): boolean {
  const hasStatus = /^(?:<\s*)?HTTP\//.test(text);
  const separator = /\n(?:<\s*)?\n/.exec(text);
  const body = hasStatus ? (separator ? text.slice(separator.index + separator[0].length) : "") : text;
  // A header or JSON string mentioning a firewall is not a blocking HTML page.
  if (!/^\s*</.test(body)) return false;
  for (const match of body.matchAll(/<(title|h[1-3])\b[^>]*>([\s\S]{0,1000}?)<\/\1\s*>/gi)) {
    const heading = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (/^web filter violation$/i.test(heading) ||
        /forti(?:guard|net).{0,120}(?:acceso bloqueado|access blocked|web page blocked)/i.test(heading)) return true;
  }
  return false;
}

const tokens = (value: string) => value.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);

export function analyzeTerminalOutput(input: string, options: TerminalOptions): TerminalFinding {
  if (input.length > MAX_TERMINAL_CHARS)
    return finding("unknown", "Terminal output is too large", "The local analysis limit is 64 KiB of text.", "Paste only the most recent preflight attempt, without credentials.");
  const text = input.replace(/\r\n?/g, "\n");
  const events: Event[] = [];
  for (const match of text.matchAll(/^(?:<\s*)?HTTP\/(?:1\.[01]|2|3)\s+(\d{3})[^\n]*$/gm))
    events.push({ index: match.index, end: match.index + match[0].length, status: Number(match[1]), proxy: /connection established/i.test(match[0]) });
  for (const match of text.matchAll(/^\s*curl:\s*\((\d+)\)[^\n]*$/gm))
    events.push({ index: match.index, end: match.index + match[0].length, code: Number(match[1]), tls: /SEC_E_UNTRUSTED_ROOT/i.test(match[0]) });
  for (const match of text.matchAll(/^\s*(?:Error:\s*)?(?:net::)?(?:SEC_E_UNTRUSTED_ROOT|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED)\b[^\n]*$/gm))
    events.push({ index: match.index, end: match.index + match[0].length, tls: !match[0].includes("NAME_NOT_RESOLVED"), dns: match[0].includes("NAME_NOT_RESOLVED") });
  events.sort((a, b) => a.index - b.index);
  let last = events.at(-1);
  if (last?.code === 22) {
    const errorIndex = last.index;
    const response = [...events].reverse().find((event) => event.status !== undefined && event.status >= 400 && event.index < errorIndex);
    // --fail reports error 22 after the received HTTP status. Retain that evidence
    // unless a new terminal command separates the response and the error.
    if (response && !/^(?:PS\s+[^\n]*>|\$\s*curl\b)/m.test(text.slice(response.end, last.index))) last = response;
  }

  if (last?.tls)
    return finding("tls", "Untrusted TLS certificate chain", "The supplied output reports an untrusted certificate authority or SEC_E_UNTRUSTED_ROOT.", "Check the server certificate chain and the trusted certificate authorities on this device with your administrator. TLS inspection is a possible cause, not a confirmed network block. Keep certificate verification enabled.");
  if (last?.code === 60)
    return finding("tls", "TLS certificate validation failed", "cURL reported certificate verification error 60 before a usable HTTP response.", "Check certificate validity, hostname and the certificate chain with your administrator. CORS settings do not fix TLS validation; keep certificate verification enabled.");
  if (last?.dns || last?.code === 6)
    return finding("dns", "Hostname could not be resolved", "The supplied output reports a DNS resolution failure, not an HTTP 404 response.", "Check the hostname and DNS access on the current network. This evidence does not prove that the domain does not exist globally.");
  if (last?.code === 7 || last?.code === 5)
    return finding("connectivity", "Connection could not be established", "cURL could not connect to the destination or resolve its proxy.", "Check the host, port, server availability and the network or proxy policy. No MCP or CORS response was verified.");
  if (last?.code === 28)
    return finding("timeout", "Connection or response timed out", "cURL reported timeout error 28.", "Check server availability and the current network. A timeout alone does not identify CORS or a firewall block.");
  if (last?.code !== undefined)
    return finding("unknown", "Terminal request did not complete", "The latest cURL attempt ended with an error that this analyzer cannot classify precisely.", "Review the latest terminal error and the network or server logs. Do not infer an MCP defect from an unavailable response.");

  // Scope all subsequent evidence to the latest HTTP response, never an older failure.
  const responseText = last?.status !== undefined ? text.slice(last.index) : text;
  if (blockedPage(responseText))
    return finding("network-restriction", "Network filtering page detected", "The supplied response contains an explicit web-filter blocking page, such as FortiGuard or Web Filter Violation.", "Ask the administrator of the current network to review access to this endpoint. Changing Orionis CORS cannot remove a network policy block. This page does not verify the MCP server.", last?.status);
  if (last?.status === undefined)
    return finding("unknown", "Insufficient terminal evidence", "No recognizable HTTP response or supported connection error was found.", "Paste the complete output of the preflight command, including the status line, response headers and any terminal error. Remove credentials first.");

  const status = last.status;
  if (last.proxy || status < 200)
    return finding("unknown", "Final endpoint response is missing", "Only a proxy handshake or an informational HTTP response was supplied.", "Include the final endpoint response or the subsequent terminal error. A proxy handshake does not confirm endpoint connectivity.", status);
  if (status === 404 || status === 410)
    return finding("http", "Endpoint path was not found", "An HTTP server responded that the requested resource is missing or no longer available.", "Check the complete MCP route and any path prefix. A 404 or 410 response means a server answered; it does not mean the hostname is unreal.", status);
  if (status === 401 || status === 403)
    return finding("http", "Request was refused", "The HTTP response refuses access, but no explicit network-filter page was identified.", "Check authentication, authorization, Origin policy and gateway logs. Status 401 or 403 alone cannot distinguish these causes from a network restriction.", status);
  if (status === 405)
    return finding("http", "Preflight method was rejected", "The endpoint returned HTTP 405 to the supplied request.", "Confirm this output came from OPTIONS and allow the browser preflight before requiring POST credentials.", status);
  if (status >= 300 && status < 400)
    return finding("http", "Endpoint redirects the request", "The endpoint returned an HTTP redirect.", "Use the final MCP endpoint URL directly. The inspector rejects redirects to avoid forwarding credentials.", status);
  if (status >= 500)
    return finding("http", "Server or gateway error", "An HTTP response was received, but the server or gateway could not complete the request.", "Review the server and gateway logs. This status alone does not establish a CORS configuration error or a valid MCP endpoint.", status);
  if (status < 200 || status >= 300)
    return finding("http", "HTTP request was rejected", "The supplied response has an unsuccessful HTTP status.", "Review the HTTP status and server logs before retrying discovery.", status);

  const headers = new Map<string, string[]>();
  let complete = false;
  const afterStatus = text.slice(last.end).replace(/^\n/, "");
  const lines = afterStatus.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.trim() || line.trim() === "<") {
      complete = line.trim() === "<" || index < lines.length - 1;
      break;
    }
    if (/^PS\s+[^\n]*>/.test(line)) {
      complete = true;
      break;
    }
    const match = /^(?:<\s*)?([!#$%&'*+.^_`|~\w-]+):\s*(.*)$/.exec(line);
    if (!match) break;
    const key = match[1].toLowerCase();
    headers.set(key, [...(headers.get(key) ?? []), match[2].trim()]);
  }
  if (!complete && !options.completeOutput)
    return finding("unknown", "Response headers may be incomplete", "An HTTP response was found, but the end of its header block was not included.", "Paste the terminating blank line or confirm that you pasted the complete preflight response. Missing headers cannot be diagnosed from a partial copy.", status);

  const origins = headers.get("access-control-allow-origin") ?? [];
  if (origins.length !== 1 || (origins[0] !== options.origin && origins[0] !== "*"))
    return finding("cors", "Preflight does not allow this inspector origin", "The complete response has no single matching Access-Control-Allow-Origin. HTTP 200 and Allow: OPTIONS, POST do not grant browser CORS access.", "Configure CORS_ALLOW_ORIGINS for the inspector origin in Orionis, restart the application, and return Access-Control-Allow-Origin on both OPTIONS and POST responses.", status);
  const methods = (headers.get("access-control-allow-methods") ?? []).join(",").split(",").map((method) => method.trim());
  if (!methods.includes("POST") && !methods.includes("*"))
    return finding("cors", "Preflight does not allow POST", "Access-Control-Allow-Methods does not authorize POST. The separate Allow header does not substitute for it.", "Configure CORS_ALLOW_METHODS to allow POST and OPTIONS, then restart Orionis and repeat the preflight.", status);
  const allowed = tokens((headers.get("access-control-allow-headers") ?? []).join(","));
  const missing = options.requestedHeaders.map((name) => name.toLowerCase()).some((name) =>
    !allowed.includes(name) && !(allowed.includes("*") && name !== "authorization"));
  if (missing)
    return finding("cors", "Preflight does not allow the requested headers", "Access-Control-Allow-Headers does not cover every header requested by this inspector. Authorization requires explicit permission when the response uses a wildcard.", "Configure CORS_ALLOW_HEADERS for the MCP and authentication headers. Orionis can reflect the requested headers when configured with list:['*']; repeat the preflight after restarting.", status);
  return finding("preflight", "Preflight headers allow this request", "The supplied successful response allows the origin, POST and the requested headers for the inspector's requests without cookies.", "Reconnect to run server/discover. A successful OPTIONS response does not prove MCP compatibility, and the actual POST response must also allow the origin.", status);
}
