import { describe, expect, it } from "vitest";
import {
  exportReportHtml,
  exportReportJson,
  exportReportPdf,
  hermesConfig,
  requestAsCurl,
  requestAsPreflightCurl,
  requestAsPreflightPowerShell,
  requestAsFetch,
  requestAsJson,
} from "../src/core/reporting";
import type { RequestRecord } from "../src/types/mcp";
import { redact } from "../src/utils/redact";
import { sanitizeFinding, sanitizeScore } from "../src/utils/sanitize";

const record: RequestRecord = {
  id: "test-1",
  endpoint: "https://example.com/mcp?api_key=query-secret",
  method: "tools/call",
  startedAt: "2026-10-28T12:00:00.000Z",
  durationMs: 12,
  bytes: 120,
  events: [],
  configuredHeaders: {
    Authorization: "Bearer private-token",
    "X-Api-Key": "header-secret",
    "MCP-Method": "tools/call",
  },
  accessibleHeaders: { "content-type": "application/json" },
  request: {
    jsonrpc: "2.0",
    id: "test-1",
    method: "tools/call",
    params: {
      name: "lookup",
      arguments: { value: "user's $(secret)", password: "payload-secret" },
    },
  },
};

describe("local report exports", () => {
  it.each(["Passed", "protocol", "client", "info", "Ready", "Excellent"])(
    "keeps inspector verdicts meaningful when a query value is %s", (queryValue) => {
      const verdict = {
        id: "MCP-PROTOCOL-001",
        status: "Passed", category: "protocol", severity: "info", component: "client",
        evidence: `The server echoed ${queryValue} and private-value`,
        label: `Server label ${queryValue}`, description: queryValue,
      };
      const snapshot = {
        endpoint: "https://example.com/mcp?v=" + encodeURIComponent(queryValue),
        tests: [verdict], diagnostics: [verdict],
        score: { classification: "Excellent", readiness: "Ready", score: 100 },
        tools: [{ name: queryValue, description: "private-value" }],
      };
      const data = JSON.parse(exportReportJson(snapshot, ["private-value"]));
      for (const field of ["tests", "diagnostics"]) {
        expect(data[field][0]).toMatchObject({
          status: "Passed", category: "protocol", severity: "info", component: "client",
        });
        expect(data[field][0].evidence).not.toContain(queryValue);
        expect(data[field][0].evidence).not.toContain("private-value");
        expect(data[field][0].label).not.toContain(queryValue);
        expect(data[field][0].description).toBe("[REDACTED]");
      }
      expect(data.score).toMatchObject({ classification: "Excellent", readiness: "Ready" });
      expect(data.tools[0]).toEqual({ name: "[REDACTED]", description: "[REDACTED]" });
      const html = exportReportHtml(snapshot, ["private-value"]);
      expect(html).toContain('&quot;status&quot;: &quot;Passed&quot;');
      expect(html).toContain('&quot;category&quot;: &quot;protocol&quot;');
      expect(html).not.toContain("private-value");
    },
  );

  it("redacts dynamic finding identities while keeping recognized internal codes", () => {
    const sanitize = <T>(value: T) => redact(value, ["private-value", "MCP", "Passed"]);
    const test = sanitizeFinding({
      id: "MCP-OUTPUT:private-value", component: "tool:private-value",
      status: "Passed", category: "protocol", severity: "info", evidence: "private-value Passed",
    }, sanitize);
    expect(test).toMatchObject({
      id: "MCP-OUTPUT:[REDACTED]", component: "tool:[REDACTED]", status: "Passed",
      category: "protocol", severity: "info", evidence: "[REDACTED] [REDACTED]",
    });
    expect(sanitizeFinding({ status: "private-value", id: "private-value" }, sanitize))
      .toEqual({ status: "[REDACTED]", id: "[REDACTED]" });
    expect(sanitizeScore({ readiness: "private-value" }, sanitize))
      .toEqual({ readiness: "[REDACTED]" });
  });

  it("preserves history protocol constants and errors without restoring arbitrary response data", () => {
    const id = "orionis-12345678-1234-1234-1234-123456789012-1";
    const history: RequestRecord = {
      ...record, id, endpoint: "https://example.com/mcp?v=2",
      request: {
        ...record.request, id,
        params: {
          name: "private-value", arguments: { code: "2" },
          _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
        },
      },
      configuredHeaders: {
        "MCP-Method": "tools/call", "MCP-Protocol-Version": "2026-07-28",
        "Content-Type": "application/json", Authorization: "Bearer private-value",
      },
      response: {
        jsonrpc: "2.0", id,
        result: { resultType: "complete", cacheScope: "private", content: [{ type: "text", text: "2 protocol private-value" }] },
      },
      error: { kind: "protocol", message: "protocol private-value" },
    };
    const data = JSON.parse(exportReportJson({
      endpoint: history.endpoint, history: [history], protocolVersion: "2026-07-28",
      discovery: { resultType: "complete", supportedVersions: ["2026-07-28", "private-value"],
        capabilities: {}, instructions: "private-value" },
    }, ["protocol", "complete", "private", "private-value"]));
    expect(data.protocolVersion).toBe("2026-07-28");
    expect(data.discovery).toMatchObject({
      resultType: "complete", supportedVersions: ["2026-07-28", "[REDACTED]"],
      instructions: "[REDACTED]",
    });
    const exported = data.history[0];
    expect(exported.id).toBe(id);
    expect(exported.startedAt).toBe(history.startedAt);
    expect(exported.request).toMatchObject({
      jsonrpc: "2.0", id, method: "tools/call",
      params: { name: "[REDACTED]", arguments: { code: "[REDACTED]" },
        _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } },
    });
    expect(exported.response).toMatchObject({ jsonrpc: "2.0", id,
      result: { resultType: "complete", cacheScope: "private",
        content: [{ type: "text", text: "[REDACTED] [REDACTED] [REDACTED]" }] } });
    expect(exported.error).toEqual({ kind: "protocol", message: "[REDACTED] [REDACTED]" });
    expect(exported.configuredHeaders["MCP-Protocol-Version"]).toBe("2026-07-28");
    expect(exported.configuredHeaders.Authorization).toBe("[REDACTED]");
  });

  it("redacts arbitrary endpoint query values echoed inside operational catalogs", () => {
    const snapshot = {
      endpoint: "https://example.com/mcp?tenant=private-tenant",
      tools: [{ name: "private-tenant_lookup", inputSchema: { enum: ["private-tenant"] } }],
    };
    for (const exportReport of [exportReportJson, exportReportHtml])
      expect(exportReport(snapshot)).not.toContain("private-tenant");
  });
  it("keeps execution evidence and coverage without credentials", () => {
    const report = exportReportJson(
      {
        endpoint: record.endpoint,
        protocolVersion: "2026-07-28",
        history: [record],
        tests: [{ status: "Not Tested" }],
        score: { value: null },
        coverage: 0,
      },
      ["private-token", "header-secret", "payload-secret", "query-secret"],
    );
    expect(JSON.parse(report)).toMatchObject({
      protocolVersion: "2026-07-28",
      coverage: 0,
      tests: [{ status: "Not Tested" }],
    });
    for (const secret of [
      "private-token",
      "header-secret",
      "payload-secret",
      "query-secret",
    ])
      expect(report).not.toContain(secret);
  });

  it("escapes hostile server content and contains no executable report script", () => {
    const report = exportReportHtml({
      endpoint: "https://example.com/mcp",
      diagnostics: [
        { evidence: "<script>alert(1)</script><img src=x onerror=alert(2)>" },
      ],
    });
    expect(report).toContain("&lt;script&gt;");
    expect(report).not.toContain("<script>");
    expect(report).not.toContain("<img");
    expect(report).toContain("default-src 'none'");
  });

  it("generates a local PDF Blob from evidence", async () => {
    const blob = await exportReportPdf({
      endpoint: "https://example.com/mcp",
      tests: [{ status: "Passed", evidence: "Español 漢字" }],
    });
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("request exports", () => {
  it.each([requestAsJson, requestAsCurl, requestAsFetch])(
    "redacts authorization, API keys and payload secrets",
    (exporter) => {
      const result = exporter(record, ["query-secret"]);
      for (const secret of [
        "private-token",
        "header-secret",
        "payload-secret",
        "query-secret",
      ])
        expect(result).not.toContain(secret);
      expect(result).toContain("tools/call");
    },
  );

  it("quotes apostrophes safely for POSIX cURL and explains CORS difference", () => {
    const result = requestAsCurl(record);
    expect(result).toContain(`user'"'"'s $(secret)`);
    expect(result).toContain("does not enforce browser CORS");
  });

  it("creates direct Fetch instructions with no proxy, cookies or insecure CORS mode", () => {
    const result = requestAsFetch(record);
    expect(result).toContain('credentials: "omit"');
    expect(result).toContain('redirect: "error"');
    expect(result).not.toContain("no-cors");
    expect(result).not.toContain("/api/");
  });
});

describe("Hermes native configuration", () => {
  it("uses documented native YAML and stateless transport without credentials", () => {
    const output = hermesConfig(
      "https://user:pass@example.com/mcp?token=private-token",
    );
    expect(output).toContain("mcp_servers:");
    expect(output).toContain("protocol: stateless");
    expect(output).toContain("supports_parallel_tool_calls: false");
    expect(output).not.toContain("user:pass");
    expect(output).not.toContain("private-token");
  });

  it("rejects non-HTTP configuration URLs", () => {
    expect(() => hermesConfig("javascript:alert(1)")).toThrow("HTTP(S)");
  });
});

describe("diagnostic preflight exports", () => {
  it("exports literal PowerShell arguments without credentials or certificate bypass", () => {
    const output = requestAsPreflightPowerShell({
      ...record,
      endpoint: "https://example.com/mcp/o'neil$(secret)?token=private-value",
    }, "https://inspector.orionis-framework.com");
    expect(output).toContain("curl.exe --include --max-time 20 --request OPTIONS '");
    expect(output).toContain("o''neil$(secret)");
    expect(output).toContain("Access-Control-Request-Method: POST");
    for (const value of ["private-value", "private-token", "header-secret", "--insecure", "--location", "--data"])
      expect(output).not.toContain(value);
    expect(() => requestAsPreflightPowerShell(record, "file:///tmp/test")).toThrow("HTTP(S)");
  });
  it("uses the current origin and excludes safelisted Accept from required header names", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        configuredHeaders: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2026-07-28",
          "MCP-Method": "server/discover",
          Authorization: "Bearer private-token",
        },
      },
      "http://127.0.0.1:4173",
    );
    expect(output).toContain("Origin: http://127.0.0.1:4173");
    expect(output).toContain("Access-Control-Request-Method: POST");
    expect(output).toContain(
      "Access-Control-Request-Headers: authorization, content-type, mcp-method, mcp-protocol-version",
    );
    expect(output).not.toContain("private-token");
    expect(output).not.toContain("--data");
    expect(output).not.toContain("--location");
  });

  it("redacts URL credentials and never exports header values or payloads", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        endpoint: "https://user:pass@example.com/mcp?api_key=query-secret",
      },
      "https://inspector.orionis-framework.com",
    );
    for (const secret of [
      "user:pass",
      "query-secret",
      "private-token",
      "header-secret",
      "payload-secret",
    ])
      expect(output).not.toContain(secret);
    expect(output).toContain(
      "Access-Control-Request-Headers: authorization, mcp-method, x-api-key",
    );
    expect(output).not.toContain("tools/call");
  });

  it("quotes hostile URL characters as one shell argument and validates the origin", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        endpoint: "https://example.com/mcp/o'neil$(touch-pwned)",
      },
      "http://localhost:4174",
    );
    expect(output).toContain("o'\"'\"'neil$(touch-pwned)");
    expect(() =>
      requestAsPreflightCurl(record, "file:///tmp/index.html"),
    ).toThrow("HTTP(S)");
  });

  it("retains unsafe Accept values and omits ordinary language and text/plain headers", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        configuredHeaders: {
          Accept: 'text/html;value="quoted"',
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "text/plain",
          "X-Test": "custom-header-private-value",
        },
      },
      "https://example.com",
    );
    expect(output).toContain("Access-Control-Request-Headers: accept, x-test");
    expect(output).not.toContain("custom-header-private-value");
  });
});
