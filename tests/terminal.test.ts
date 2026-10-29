import { describe, expect, it } from "vitest";
import { analyzeTerminalOutput, MAX_TERMINAL_CHARS } from "../src/core/connection/terminal";
import { terminalEs } from "../src/i18n/terminal";

const origin = "https://inspector.orionis-framework.com";
const options = { origin, requestedHeaders: ["content-type", "mcp-method", "mcp-protocol-version"] };
const tls = "curl: (60) schannel: SEC_E_UNTRUSTED_ROOT (0x80090325) - La cadena de certificación fue emitida por una entidad en la que no se confía.\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it.";
const successHeaders = [
  "HTTP/1.1 204 No Content",
  `Access-Control-Allow-Origin: ${origin}`,
  "Access-Control-Allow-Methods: OPTIONS, POST",
  "Access-Control-Allow-Headers: Content-Type, MCP-Method, MCP-Protocol-Version",
];
const complete = (lines: string[]) => lines.join("\r\n") + "\r\n\r\n";

describe("local terminal connection analysis", () => {
  it("recognizes an untrusted certificate chain without claiming a firewall", () => {
    const result = analyzeTerminalOutput(tls, options);
    expect(result.kind).toBe("tls");
    expect(result.title).toBe("Untrusted TLS certificate chain");
    expect(result.recommendation).toContain("not a confirmed network block");
    expect(result.recommendation).toContain("Keep certificate verification enabled");
  });
  it("keeps generic certificate error 60 distinct from untrusted roots", () => {
    expect(analyzeTerminalOutput("curl: (60) SSL: certificate subject name does not match target host", options).title).toBe("TLS certificate validation failed");
  });
  it("recognizes explicit network filtering evidence and does not echo secrets", () => {
    const result = analyzeTerminalOutput("HTTP/1.1 403 Forbidden\r\nContent-Type: text/html\r\n\r\n<title>Web Filter Violation</title><h1>Prevención de intrusiones de FortiGuard: acceso bloqueado</h1><p>URL https://private.test/?token=secret-token</p>", options);
    expect(result).toMatchObject({ kind: "network-restriction", httpStatus: 403 });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("private.test");
  });
  it.each([401, 403])("does not infer a firewall from status %s alone", (status) => {
    expect(analyzeTerminalOutput(`HTTP/1.1 ${status} Refused\nContent-Length: 0\n\n`, options).kind).toBe("http");
  });
  it("does not treat a casual Fortinet mention as a filtering page", () => {
    expect(analyzeTerminalOutput("HTTP/1.1 200 OK\nContent-Type: text/html\n\n<html>About Fortinet products</html>", options).kind).toBe("cors");
  });
  it("does not mistake header or JSON references to a filter for a blocking page", () => {
    expect(analyzeTerminalOutput(complete([...successHeaders, "X-Debug-Message: No Web Filter Violation detected"]), options).kind).toBe("preflight");
    expect(analyzeTerminalOutput('HTTP/1.1 403 Forbidden\nContent-Type: application/json\n\n{"message":"FortiGuard access blocked", "example":"<title>Web Filter Violation</title>"}', options).kind).toBe("http");
    expect(analyzeTerminalOutput("HTTP/1.1 200 OK\nX-Debug: <title>Web Filter Violation</title>\n\n", options).kind).toBe("cors");
  });
  it("preserves the received HTTP error when curl --fail appends error 22", () => {
    expect(analyzeTerminalOutput("HTTP/2 404\nContent-Length: 0\n\ncurl: (22) The requested URL returned error: 404", options)).toMatchObject({ kind: "http", title: "Endpoint path was not found", httpStatus: 404 });
    expect(analyzeTerminalOutput("HTTP/2 404\n\nPS C:\\Users\\example> curl --fail https://other.test\ncurl: (22) The requested URL returned error: 500", options).kind).toBe("unknown");
  });
  it.each(["curl: (6) Could not resolve host: not-real.invalid", "net::ERR_NAME_NOT_RESOLVED"])("distinguishes DNS from a 404: %s", (text) => {
    const result = analyzeTerminalOutput(text, options);
    expect(result.kind).toBe("dns");
    expect(result.httpStatus).toBeUndefined();
    expect(result.recommendation).toContain("does not prove");
  });
  it.each([404, 410])("identifies a missing endpoint path from HTTP %s", (status) => {
    expect(analyzeTerminalOutput(`HTTP/2 ${status}\nContent-Type: text/html\n\nmissing`, options)).toMatchObject({ kind: "http", title: "Endpoint path was not found", httpStatus: status });
  });
  it.each([[7, "connectivity"], [5, "connectivity"], [28, "timeout"], [35, "unknown"]])("classifies cURL error %s conservatively", (code, kind) => {
    expect(analyzeTerminalOutput(`curl: (${code}) request failed`, options).kind).toBe(kind);
  });
  it("uses the later HTTP 200 in the user's TLS failure then successful request transcript", () => {
    const response = "HTTP/1.1 200 OK\r\nAllow: OPTIONS, POST\r\nContent-Length: 0\r\nDate: Thu, 29 Oct 2026 13:45:34 GMT\r\nNgrok-Agent-Ips: 192.0.2.1\r\nServer: Orionis RSGI\r\nX-Robots-Tag: noindex, nofollow";
    const transcript = `${tls}\nPS C:\\Users\\example> curl.exe -i -X OPTIONS "https://example.test/mcp"\n${response}`;
    const result = analyzeTerminalOutput(transcript, { ...options, completeOutput: true });
    expect(result).toMatchObject({ kind: "cors", httpStatus: 200, title: "Preflight does not allow this inspector origin" });
    expect(result.evidence).toContain("HTTP 200 and Allow: OPTIONS, POST do not grant");
  });
  it("uses a later failed attempt instead of an earlier successful response", () => {
    const result = analyzeTerminalOutput(complete(successHeaders) + tls, options);
    expect(result.kind).toBe("tls");
    expect(result.httpStatus).toBeUndefined();
  });
  it("does not let an older filter page contaminate a later valid preflight", () => {
    expect(analyzeTerminalOutput("HTTP/1.1 403 Forbidden\n\nWeb Filter Violation\n" + complete(successHeaders), options).kind).toBe("preflight");
  });
  it("requires a complete header block before claiming missing CORS headers", () => {
    for (const response of ["HTTP/1.1 200 OK", "HTTP/1.1 200 OK\n", "HTTP/1.1 200 OK\nAllow: POST\n"]) {
      expect(analyzeTerminalOutput(response, options).kind).toBe("unknown");
      expect(analyzeTerminalOutput(response, options).title).toBe("Response headers may be incomplete");
    }
    expect(analyzeTerminalOutput("HTTP/1.1 200 OK\nAllow: POST\n\n", options).kind).toBe("cors");
  });
  it("accepts explicit confirmation of a complete copied header block", () => {
    expect(analyzeTerminalOutput(successHeaders.join("\n"), { ...options, completeOutput: true }).kind).toBe("preflight");
  });
  it("accepts a returned PowerShell prompt as the end of the response", () => {
    expect(analyzeTerminalOutput(successHeaders.join("\n") + "\nPS C:\\Users\\example>", options).kind).toBe("preflight");
  });
  it("validates origin, method and headers rather than HTTP success alone", () => {
    expect(analyzeTerminalOutput(complete(successHeaders), options).kind).toBe("preflight");
    expect(analyzeTerminalOutput(complete(successHeaders).replace(origin, "https://other.test"), options).title).toContain("origin");
    expect(analyzeTerminalOutput(complete(successHeaders).replace("OPTIONS, POST", "OPTIONS, GET"), options).title).toBe("Preflight does not allow POST");
    expect(analyzeTerminalOutput(complete(successHeaders).replace("OPTIONS, POST", "options, post"), options).title).toBe("Preflight does not allow POST");
    expect(analyzeTerminalOutput(complete(successHeaders).replace(", MCP-Protocol-Version", ""), options).title).toBe("Preflight does not allow the requested headers");
  });
  it("rejects duplicate and comma-separated ACAO values", () => {
    expect(analyzeTerminalOutput(complete([...successHeaders, `Access-Control-Allow-Origin: ${origin}`]), options).kind).toBe("cors");
    expect(analyzeTerminalOutput(complete(successHeaders).replace(origin, `${origin}, https://other.test`), options).kind).toBe("cors");
  });
  it("supports anonymous wildcards but requires explicit Authorization permission", () => {
    const output = complete(["HTTP/2 204", "Access-Control-Allow-Origin: *", "Access-Control-Allow-Methods: *", "Access-Control-Allow-Headers: *"]);
    expect(analyzeTerminalOutput(output, options).kind).toBe("preflight");
    expect(analyzeTerminalOutput(output, { ...options, requestedHeaders: [...options.requestedHeaders, "Authorization"] }).kind).toBe("cors");
  });
  it("accepts verbose cURL response headers", () => {
    const output = successHeaders.map((line) => `< ${line}`).join("\n") + "\n<\n";
    expect(analyzeTerminalOutput(output, options).kind).toBe("preflight");
  });
  it("does not mistake a proxy handshake for the endpoint response", () => {
    expect(analyzeTerminalOutput("HTTP/1.1 200 Connection established\n\n", options).title).toBe("Final endpoint response is missing");
    expect(analyzeTerminalOutput("HTTP/1.1 100 Continue\n\n", options).kind).toBe("unknown");
    expect(analyzeTerminalOutput("HTTP/1.1 200 Connection established\n\n" + tls, options).kind).toBe("tls");
  });
  it.each([[302, "Endpoint redirects the request"], [405, "Preflight method was rejected"], [502, "Server or gateway error"], [400, "HTTP request was rejected"]])("classifies HTTP %s before CORS", (status, title) => {
    expect(analyzeTerminalOutput(`HTTP/1.1 ${status} Error\n\n`, options).title).toBe(title);
  });
  it("does not read certificate error strings from an HTML page as a new terminal failure", () => {
    const output = complete(successHeaders) + "<p>See SEC_E_UNTRUSTED_ROOT for details</p>";
    expect(analyzeTerminalOutput(output, options).kind).toBe("preflight");
  });
  it("bounds input and preserves unknown results for unrecognized evidence", () => {
    expect(analyzeTerminalOutput("x".repeat(MAX_TERMINAL_CHARS + 1), options).title).toBe("Terminal output is too large");
    expect(analyzeTerminalOutput("not enough information", options).title).toBe("Insufficient terminal evidence");
  });
  it("provides Spanish translations for returned diagnosis text", () => {
    const samples = [tls, "curl: (60) certificate invalid", "curl: (6) error", "curl: (7) error", "curl: (28) error", "curl: (35) error", "<title>Web Filter Violation</title>", "no evidence", "HTTP/1.1 100 Continue\n\n", ...[404, 401, 405, 302, 502, 400].map((status) => `HTTP/2 ${status}\n\n`), "HTTP/1.1 200 OK", "HTTP/1.1 200 OK\n\n", complete(successHeaders), complete(successHeaders).replace("OPTIONS, POST", "GET"), complete(successHeaders).replace(", MCP-Protocol-Version", ""), "x".repeat(MAX_TERMINAL_CHARS + 1)];
    for (const sample of samples) {
      const result = analyzeTerminalOutput(sample, options);
      for (const key of [result.title, result.evidence, result.recommendation]) expect(terminalEs[key], key).toBeTruthy();
    }
  });
});
